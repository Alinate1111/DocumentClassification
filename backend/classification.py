import os
import json
import time
from typing import Optional
from fastapi import APIRouter, Form
from core.db_conn import db_pool

# Classification service
try:
    from services.classification_service import get_classification_service
    CLASSIFICATION_AVAILABLE = True
except Exception as e:
    CLASSIFICATION_AVAILABLE = False
    print(f"⚠️ Classification service not available: {e}")


# ============================================================
# 작업 이력 로그 헬퍼 함수
# ============================================================

def log_processing(conn, doc_id: int, filename: str, process_type: str, status: str, message: str):
    """
    작업 이력 로그 기록

    Args:
        conn: DB 연결
        doc_id: 문서 ID
        filename: 파일명
        process_type: 'OCR', 'CLASSIFICATION', 'UPLOAD'
        status: 'SUCCESS', 'FAILED'
        message: 로그 메시지
    """
    try:
        cur = conn.cursor()

        # processing_log 테이블 생성 (없으면)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS processing_log (
                log_id SERIAL PRIMARY KEY,
                doc_id INTEGER,
                process_type VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (doc_id) REFERENCES pdf_documents(doc_id) ON DELETE CASCADE
            )
        """)

        # filename 컬럼 추가 (없으면)
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='processing_log' AND column_name='filename'
        """)
        if not cur.fetchone():
            cur.execute("ALTER TABLE processing_log ADD COLUMN filename VARCHAR(500)")
            print("✅ processing_log 테이블에 filename 컬럼 추가")

        # 인덱스 생성 (없으면)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_processing_log_created_at
            ON processing_log(created_at DESC)
        """)

        # 로그 기록
        cur.execute("""
            INSERT INTO processing_log
            (doc_id, filename, process_type, status, message)
            VALUES (%s, %s, %s, %s, %s)
        """, (doc_id, filename, process_type, status, message))

        conn.commit()
        print(f"✅ 작업 로그 기록: [{process_type}] {message}")

    except Exception as e:
        print(f"⚠️ 작업 로그 기록 실패: {e}")
        conn.rollback()


# ============================================================
# Classification Routes
# ============================================================

router = APIRouter(prefix="/api")


@router.post("/classify/text")
async def classify_text_directly(text: str = Form(...)):
    """
    텍스트를 직접 받아서 분류 (평가용)

    Args:
        text: 분류할 텍스트

    Returns:
        분류 결과 (기관, 문서유형, 신뢰도)
    """
    if not CLASSIFICATION_AVAILABLE:
        return {"success": False, "error": "Classification service not available"}

    try:
        # Context manager로 BERT 분류 서비스 사용
        with get_classification_service() as classifier:
            classification_result = classifier.predict(text, return_probs=False)

        return {
            "success": True,
            "agency": classification_result.get('기관', 'UNKNOWN'),
            "document_type": classification_result.get('문서유형', 'UNKNOWN'),
            "confidence": classification_result.get('confidence', {})
        }

    except Exception as e:
        print(f"❌ 텍스트 분류 중 예외 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@router.post("/classify/document")
async def classify_document(
    doc_id: Optional[int] = Form(None),
    file_path: Optional[str] = Form(None)
):
    """
    문서 카테고리 자동 분류 (기관, 문서유형)

    Args:
        doc_id: 분류할 문서 ID (선택)
        file_path: 분류할 문서 경로 (선택)

    Note:
        doc_id 또는 file_path 중 하나는 필수입니다.

    Returns:
        분류 결과 (기관, 문서유형, 신뢰도)
    """
    if not doc_id and not file_path:
        return {"success": False, "error": "doc_id 또는 file_path가 필요합니다"}

    print(f"\n{'='*60}")
    print(f"📋 문서 분류 시작: doc_id={doc_id}, file_path={file_path}")
    print(f"{'='*60}\n")

    if not CLASSIFICATION_AVAILABLE:
        print(f"❌ 분류 서비스를 사용할 수 없습니다")
        return {"success": False, "error": "Classification service not available"}

    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
        # file_path로부터 doc_id 조회
        if not doc_id and file_path:
            print(f"🔍 file_path로 doc_id 조회 중: {file_path}")

            # 경로 정규화
            normalized_path = file_path.replace('\\', '/')
            if normalized_path.startswith('./'):
                normalized_path = normalized_path[2:]

            cur.execute("""
                SELECT doc_id
                FROM pdf_documents
                WHERE filename = %s OR filename LIKE %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (normalized_path, f"%{normalized_path}"))

            row = cur.fetchone()
            if not row:
                print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
                return {"success": False, "error": f"파일을 찾을 수 없습니다: {file_path}"}

            doc_id = row[0]
            print(f"✅ doc_id 발견: {doc_id}")

        # OCR 결과 조회
        print(f"🔍 OCR 결과 조회 중... doc_id={doc_id}")
        cur.execute("""
            SELECT ocr_id, full_text
            FROM ocr_results
            WHERE doc_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (doc_id,))

        row = cur.fetchone()
        if not row:
            print(f"❌ OCR 결과를 찾을 수 없습니다: doc_id={doc_id}")
            return {"success": False, "error": f"OCR 결과를 찾을 수 없습니다: doc_id={doc_id}"}

        ocr_id, full_text = row
        print(f"✅ OCR 결과 발견 - ocr_id={ocr_id}, 텍스트 길이: {len(full_text)} 자")

        if not full_text or full_text.strip() == "":
            print(f"❌ OCR 텍스트가 비어있습니다")
            return {"success": False, "error": "OCR 텍스트가 비어있습니다"}

        # 분류 실행
        print(f"🚀 BERT 분류 모델 실행 중...")
        start_time = time.time()

        # Context manager로 BERT 분류 서비스 사용 - 자동으로 메모리 해제
        with get_classification_service() as classifier:
            classification_result = classifier.predict(full_text, return_probs=True)

        processing_time = time.time() - start_time
        print(f"✅ 분류 완료 - 처리 시간: {processing_time:.2f}초")
        print(f"   기관: {classification_result.get('기관')} (신뢰도: {classification_result.get('confidence', {}).get('기관', 0):.2%})")
        print(f"   문서유형: {classification_result.get('문서유형')} (신뢰도: {classification_result.get('confidence', {}).get('문서유형', 0):.2%})")

        # 분류 결과 저장 (DOCUMENT_KEYWORDS 테이블 활용)
        cur.execute("""
            INSERT INTO document_keywords (doc_id, keywords, main_topic, keyword_count, raw_response, model_name)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING keyword_id
        """, (
            doc_id,
            json.dumps(classification_result, ensure_ascii=False),  # keywords 필드에 전체 분류 결과 저장
            f"기관: {classification_result.get('기관', 'Unknown')}, 문서유형: {classification_result.get('문서유형', 'Unknown')}",
            len(classification_result.get('probabilities', {}).get('기관', {})),
            json.dumps(classification_result.get('probabilities', {}), ensure_ascii=False),
            "2-Task-BERT"
        ))

        keyword_id = cur.fetchone()[0]

        # 분류 정보 컬럼 추가 (없으면)
        try:
            cur.execute("""
                ALTER TABLE pdf_documents
                ADD COLUMN IF NOT EXISTS agency VARCHAR(200),
                ADD COLUMN IF NOT EXISTS document_type VARCHAR(200),
                ADD COLUMN IF NOT EXISTS confidence_agency FLOAT,
                ADD COLUMN IF NOT EXISTS confidence_document_type FLOAT,
                ADD COLUMN IF NOT EXISTS is_classified BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS classified_date TIMESTAMP
            """)
        except:
            pass  # 이미 컬럼이 있으면 무시

        # 문서 상태 및 분류 정보 업데이트
        cur.execute("""
            UPDATE pdf_documents
            SET status = 'CLASSIFIED',
                agency = %s,
                document_type = %s,
                confidence_agency = %s,
                confidence_document_type = %s,
                is_classified = TRUE,
                classified_date = NOW(),
                updated_at = NOW()
            WHERE doc_id = %s
        """, (
            classification_result.get('기관', 'Unknown'),
            classification_result.get('문서유형', 'Unknown'),
            classification_result.get('confidence', {}).get('기관', 0.0),
            classification_result.get('confidence', {}).get('문서유형', 0.0),
            doc_id
        ))

        conn.commit()

        # 작업 로그 기록
        cur.execute("SELECT filename FROM pdf_documents WHERE doc_id = %s", (doc_id,))
        filename_row = cur.fetchone()
        filename = filename_row[0] if filename_row else "Unknown"

        log_processing(
            conn=conn,
            doc_id=doc_id,
            filename=filename,
            process_type='CLASSIFICATION',
            status='SUCCESS',
            message=f"BERT 분류 완료: {filename.split('/')[-1]} - {classification_result.get('기관', 'Unknown')}/{classification_result.get('문서유형', 'Unknown')}"
        )

        print(f"💾 DB 저장 완료 - keyword_id: {keyword_id}")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "doc_id": doc_id,
            "keyword_id": keyword_id,
            "classification": {
                "기관": classification_result.get('기관'),
                "문서유형": classification_result.get('문서유형'),
                "confidence": classification_result.get('confidence', {}),
                "probabilities": classification_result.get('probabilities', {}) if 'probabilities' in classification_result else None
            },
            "processing_time": processing_time
        }

    except Exception as e:
        conn.rollback()
        print(f"❌ 문서 분류 중 예외 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)


@router.get("/classification/{doc_id}")
async def get_classification_result(doc_id: int):
    """
    문서 분류 결과 조회

    Args:
        doc_id: 문서 ID

    Returns:
        분류 결과
    """
    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT keyword_id, keywords, main_topic, raw_response, model_name, created_at
            FROM document_keywords
            WHERE doc_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (doc_id,))

        row = cur.fetchone()
        if not row:
            return {"success": False, "error": f"분류 결과를 찾을 수 없습니다: doc_id={doc_id}"}

        keyword_id, keywords, main_topic, raw_response, model_name, created_at = row

        # JSON 파싱
        try:
            keywords_data = json.loads(keywords) if keywords else {}
            probabilities = json.loads(raw_response) if raw_response else {}
        except:
            keywords_data = {}
            probabilities = {}

        return {
            "success": True,
            "doc_id": doc_id,
            "keyword_id": keyword_id,
            "기관": keywords_data.get('기관'),
            "문서유형": keywords_data.get('문서유형'),
            "confidence": keywords_data.get('confidence', {}),
            "probabilities": probabilities,
            "model_name": model_name,
            "created_at": created_at.isoformat() if created_at else None
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)


@router.get("/classification/results/all")
async def get_all_classification_results(limit: int = 100, offset: int = 0):
    """
    모든 분류 결과 조회 (페이지네이션)

    Args:
        limit: 조회할 최대 개수
        offset: 시작 위치

    Returns:
        분류 결과 목록
    """
    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
        # 분류된 문서 목록 조회
        cur.execute("""
            SELECT
                p.doc_id,
                p.filename,
                p.file_size,
                p.page_count,
                p.upload_date,
                k.keyword_id,
                k.keywords,
                k.main_topic,
                k.raw_response,
                k.created_at as classified_at,
                o.full_text
            FROM pdf_documents p
            INNER JOIN document_keywords k ON p.doc_id = k.doc_id
            LEFT JOIN ocr_results o ON p.doc_id = o.doc_id
            ORDER BY k.created_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))

        rows = cur.fetchall()
        results = []

        for row in rows:
            doc_id, filename, file_size, page_count, upload_date, keyword_id, keywords, main_topic, raw_response, classified_at, full_text = row

            # JSON 파싱
            try:
                keywords_data = json.loads(keywords) if keywords else {}
                probabilities = json.loads(raw_response) if raw_response else {}
            except:
                keywords_data = {}
                probabilities = {}

            # 신뢰도 계산
            confidence = keywords_data.get('confidence', {})
            avg_confidence = sum(confidence.values()) / len(confidence) if confidence else 0

            # 파일명에서 경로 제거
            display_filename = filename.split('/')[-1].split('\\')[-1]

            results.append({
                "doc_id": doc_id,
                "filename": display_filename,
                "full_path": filename,
                "file_size": file_size,
                "page_count": page_count,
                "upload_date": upload_date.isoformat() if upload_date else None,
                "keyword_id": keyword_id,
                "기관": keywords_data.get('기관'),
                "문서유형": keywords_data.get('문서유형'),
                "confidence": confidence,
                "avg_confidence": round(avg_confidence, 4),
                "needs_review": avg_confidence < 0.7,
                "probabilities": probabilities,
                "main_topic": main_topic,
                "classified_at": classified_at.isoformat() if classified_at else None,
                "text_preview": full_text[:200] if full_text else ""
            })

        # 전체 개수 조회
        cur.execute("SELECT COUNT(*) FROM document_keywords")
        total_count = cur.fetchone()[0]

        return {
            "success": True,
            "results": results,
            "total_count": total_count,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)
