import os
import json
import time
from fastapi import APIRouter, Form, HTTPException
from core.db_conn import db_pool

# OCR 서비스
try:
    from services.ocr_service import get_ocr_service, OCR_AVAILABLE
except Exception as e:
    OCR_AVAILABLE = False
    print(f"⚠️ OCR service not available: {e}")


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
# OCR Routes
# ============================================================

router = APIRouter(prefix="/api")


@router.post("/ocr/process")
async def process_ocr(filepath: str = Form(...)):
    """
    OCR 처리: PDF 파일에서 텍스트 추출

    Args:
        filepath: 처리할 PDF 파일 경로

    Returns:
        OCR 결과 (텍스트, 페이지 정보)
    """
    print(f"\n{'='*60}")
    print(f"📄 OCR 처리 시작")
    print(f"   요청 경로: {filepath}")
    print(f"   현재 작업 디렉토리: {os.getcwd()}")
    print(f"{'='*60}\n")

    if not OCR_AVAILABLE:
        print(f"❌ OCR 서비스를 사용할 수 없습니다")
        return {"success": False, "error": "OCR service not available"}

    # 파일 경로 정규화
    normalized_path = filepath.replace('\\', '/')

    # ./ 로 시작하는 상대 경로를 절대 경로로 변환
    if normalized_path.startswith('./'):
        normalized_path = normalized_path[2:]  # ./ 제거

    # 상대 경로를 절대 경로로 변환
    if not os.path.isabs(normalized_path):
        normalized_path = os.path.join(os.getcwd(), normalized_path)

    # 경로 정규화 (중복 슬래시 제거 등)
    normalized_path = os.path.normpath(normalized_path)

    print(f"🔍 정규화된 경로: {normalized_path}")
    print(f"📂 파일 존재 여부: {os.path.exists(normalized_path)}")

    if not os.path.exists(normalized_path):
        print(f"❌ 파일을 찾을 수 없습니다: {normalized_path}")
        # 가능한 경로들 출력 (디버깅용)
        possible_paths = [
            os.path.join(os.getcwd(), filepath),
            os.path.join(os.getcwd(), filepath.lstrip('./')),
            filepath
        ]
        print(f"   시도한 경로들:")
        for p in possible_paths:
            print(f"     - {p} (존재: {os.path.exists(p)})")
        return {"success": False, "error": f"파일을 찾을 수 없습니다: {filepath}"}

    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
        # 파일 존재 여부 확인 (원본 경로로 DB 조회)
        print(f"🔍 DB 조회 중... 경로: {filepath}")
        cur.execute("SELECT doc_id, page_count FROM pdf_documents WHERE filename = %s", (filepath,))
        row = cur.fetchone()

        if not row:
            print(f"❌ DB에서 파일을 찾을 수 없습니다: {filepath}")
            return {"success": False, "message": f"파일 {filepath} 이(가) DB에 없습니다."}

        doc_id = row[0]
        page_count = row[1]
        print(f"✅ DB에서 파일 발견 - doc_id: {doc_id}, 페이지 수: {page_count}")

        # OCR 처리 시작
        print(f"🚀 OCR 엔진 시작...")
        start_time = time.time()

        try:
            # Context manager로 OCR 서비스 사용 - 자동으로 메모리 해제
            with get_ocr_service() as ocr:
                full_text, page_data = ocr.extract_text_from_pdf(normalized_path)

            processing_time = time.time() - start_time
            print(f"✅ OCR 완료 - 처리 시간: {processing_time:.2f}초, 추출된 페이지: {len(page_data)}개")

            # OCR 결과 DB 저장
            cur.execute("""
                INSERT INTO ocr_results (doc_id, full_text, page_data, ocr_engine, processing_time)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING ocr_id
            """, (doc_id, full_text, json.dumps(page_data, ensure_ascii=False), "PaddleOCRVL", processing_time))

            ocr_id = cur.fetchone()[0]

            # PDF 문서 상태 업데이트
            cur.execute("""
                UPDATE pdf_documents
                SET ocr = TRUE, status = 'OCR_COMPLETED', updated_at = NOW()
                WHERE filename = %s
            """, (filepath,))

            conn.commit()

            # 작업 로그 기록
            log_processing(
                conn=conn,
                doc_id=doc_id,
                filename=filepath,
                process_type='OCR',
                status='SUCCESS',
                message=f"OCR 처리 완료: {filepath.split('/')[-1]} ({len(page_data)}페이지)"
            )

            print(f"💾 DB 저장 완료 - ocr_id: {ocr_id}")
            print(f"{'='*60}\n")

            return {
                "success": True,
                "message": f"OCR 완료: {filepath}",
                "ocr_id": ocr_id,
                "doc_id": doc_id,
                "processing_time": processing_time,
                "page_count": len(page_data),
                "text_preview": full_text[:200] if full_text else ""
            }

        except Exception as ocr_error:
            conn.rollback()
            print(f"❌ OCR 엔진 오류: {str(ocr_error)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": f"OCR 처리 실패: {str(ocr_error)}"}

    except Exception as e:
        conn.rollback()
        print(f"❌ OCR 처리 중 예외 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)


@router.post("/ocrcompleted")
async def ocrcomplet(filepath: str = Form(...)):
    """
    OCR 완료 상태 업데이트 (기존 엔드포인트 유지)
    """
    print(f"📄 OCR 완료된 파일 경로: {filepath}")
    conn = db_pool.get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT 1 FROM pdf_documents WHERE filename = %s", (filepath,))
        exists = cur.fetchone()

        if not exists:
            return {"success": False, "message": f"파일 {filepath} 이(가) DB에 없습니다."}

        cur.execute("""
            UPDATE pdf_documents
            SET ocr = TRUE, updated_at = NOW()
            WHERE filename = %s
        """, (filepath,))
        conn.commit()

        return {"success": True, "message": f"OCR 완료 처리됨: {filepath}"}
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)
