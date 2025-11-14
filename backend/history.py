from typing import Optional
from fastapi import APIRouter, Form
from core.db_conn import db_pool


# ============================================================
# History Routes
# ============================================================

router = APIRouter(prefix="/api")


@router.post("/history/add")
async def add_classification_history(
    doc_id: int = Form(...),
    file_name: str = Form(...),
    full_path: str = Form(...),
    original_folder: str = Form(...),
    agency: str = Form(...),
    document_type: str = Form(...),
    confidence_agency: float = Form(...),
    confidence_document_type: float = Form(...),
    change_type: str = Form(...),  # 'created', 'updated', 'deleted'
    previous_category: Optional[str] = Form(None)
):
    """
    분류 결과를 변경이력에 저장
    """
    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
        # 변경이력 테이블이 없으면 생성
        cur.execute("""
            CREATE TABLE IF NOT EXISTS classification_history (
                history_id SERIAL PRIMARY KEY,
                doc_id INTEGER NOT NULL,
                file_name VARCHAR(500) NOT NULL,
                full_path TEXT NOT NULL,
                original_folder TEXT,
                agency VARCHAR(200),
                document_type VARCHAR(200),
                confidence_agency FLOAT,
                confidence_document_type FLOAT,
                avg_confidence FLOAT,
                change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                change_type VARCHAR(50) NOT NULL,
                previous_category VARCHAR(500)
            )
        """)

        # 기존 테이블에 original_folder 컬럼이 없으면 추가
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='classification_history' AND column_name='original_folder'
        """)
        if not cur.fetchone():
            print("Adding 'original_folder' column to classification_history table...")
            cur.execute("""
                ALTER TABLE classification_history
                ADD COLUMN original_folder TEXT
            """)
            print("✅ Column added successfully")
        conn.commit()

        # 평균 신뢰도 계산
        avg_confidence = (confidence_agency + confidence_document_type) / 2

        print(f"📊 Confidence 값 확인:")
        print(f"  confidence_agency: {confidence_agency} (type: {type(confidence_agency)})")
        print(f"  confidence_document_type: {confidence_document_type} (type: {type(confidence_document_type)})")
        print(f"  avg_confidence: {avg_confidence}")

        # pdf_documents에서 현재 분류 정보 확인
        cur.execute("""
            SELECT agency, document_type, confidence_agency, confidence_document_type
            FROM pdf_documents
            WHERE doc_id = %s
        """, (doc_id,))
        current_classification = cur.fetchone()

        # 이전 분류 정보와 비교
        if current_classification:
            prev_agency, prev_document_type, prev_conf_agency, prev_conf_document = current_classification

            # 분류가 실제로 변경되었는지 확인
            is_changed = (
                prev_agency != agency or
                prev_document_type != document_type
            )

            if prev_agency and prev_document_type:
                # 이미 분류되어 있었고, 변경이 있으면 updated
                actual_change_type = 'updated' if is_changed else change_type
                prev_category = f"{prev_agency}/{prev_document_type}"
            else:
                # 처음 분류되는 경우
                actual_change_type = 'created'
                prev_category = previous_category
        else:
            # pdf_documents에 레코드가 없으면 신규
            actual_change_type = 'created'
            prev_category = previous_category
            is_changed = True

        # 변경이 있을 때만 이력에 기록
        if is_changed or actual_change_type == 'deleted':
            cur.execute("""
                INSERT INTO classification_history
                (doc_id, file_name, full_path, original_folder, agency, document_type,
                 confidence_agency, confidence_document_type, avg_confidence,
                 change_type, previous_category)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING history_id, change_date
            """, (
                doc_id, file_name, full_path, original_folder, agency, document_type,
                confidence_agency, confidence_document_type, avg_confidence,
                actual_change_type, prev_category
            ))

            history_id, change_date = cur.fetchone()
            print(f"✅ 변경이력 기록: history_id={history_id}, type={actual_change_type}, file={file_name}")
        else:
            # 변경이 없으면 이력 기록하지 않음
            print(f"ℹ️  변경사항 없음 - 이력 기록 생략: file={file_name}")
            history_id = None
            change_date = None

        conn.commit()

        print(f"✅ 분류 정보 처리 완료: file={file_name}")

        return {
            "success": True,
            "history_id": history_id,
            "change_date": change_date.isoformat() if change_date else None
        }

    except Exception as e:
        conn.rollback()
        print(f"❌ 변경이력 저장 실패: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)


@router.get("/history/list")
async def get_classification_history(
    limit: int = 100,
    change_type: Optional[str] = None
):
    """
    변경이력 조회 - pdf_documents 테이블 기반 (실제 현재 상태)
    """
    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
        # pdf_documents에서 분류된 파일들 조회 (실제 현재 상태)
        where_clause = "WHERE is_classified = TRUE"
        params = []

        # change_type 필터는 classification_history를 참조
        # 하지만 기본적으로는 pdf_documents의 현재 상태를 보여줌

        query = f"""
            SELECT
                p.doc_id,
                p.filename,
                p.filename as full_path,
                p.filename as original_folder,
                p.agency,
                p.document_type,
                p.confidence_agency,
                p.confidence_document_type,
                (p.confidence_agency + p.confidence_document_type) / 2.0 as avg_confidence,
                p.classified_date,
                'created' as change_type
            FROM pdf_documents p
            {where_clause}
            ORDER BY p.classified_date DESC
            LIMIT %s
        """
        params.append(limit)

        cur.execute(query, tuple(params))
        rows = cur.fetchall()

        history = []
        for row in rows:
            doc_id = row[0]
            filename = row[1]
            agency = row[4]
            document_type = row[5]
            classified_date = row[9]

            # 파일명 추출
            file_name = filename.split('/')[-1] if filename else "Unknown"

            # 원본 경로에서 사용자 폴더명 추출 (./upload/username/uid/폴더명/... 형태에서 폴더명 추출)
            top_folder = ""
            if filename:
                # ./upload/username/uid/ 이후의 경로 추출
                parts = filename.split('/')
                # ./upload/username/uid/폴더명/파일.pdf 형태에서 폴더명은 인덱스 4
                if len(parts) > 4 and parts[0] == '.':
                    # upload 다음 사용자 정보를 건너뛰고 실제 폴더명 추출
                    folder_parts = parts[4:-1]  # 마지막은 파일명이므로 제외
                    if folder_parts:
                        top_folder = folder_parts[0]  # 첫 번째 폴더명
                elif len(parts) > 1:
                    # 다른 형태의 경로면 첫 번째 의미있는 폴더명 사용
                    for part in parts[:-1]:  # 마지막 파일명 제외
                        if part and part not in ['.', 'upload']:
                            top_folder = part
                            break

            # 분류된 전체 경로 생성 (레벨에 맞게)
            # 레벨1: 최상위폴더/기관/파일명
            # 레벨2+: 최상위폴더/기관/문서유형/파일명
            path_parts = []
            if top_folder:
                path_parts.append(top_folder)
            path_parts.append(agency)
            if document_type:
                path_parts.append(document_type)
            path_parts.append(file_name)
            full_path = '/'.join(path_parts)

            history.append({
                "id": str(doc_id),
                "doc_id": doc_id,
                "fileName": file_name,
                "fullPath": full_path,
                "originalFolder": filename,  # 원본 경로
                "agency": agency,
                "documentType": document_type if document_type else "",
                "confidenceAgency": row[6],
                "confidenceDocumentType": row[7],
                "confidence": int(row[8] * 100) if row[8] else 0,  # 평균 신뢰도 (0~1 → 0~100)
                "changeDate": classified_date.strftime("%Y-%m-%d %H:%M:%S") if classified_date else "",
                "changeType": row[10],
                "previousCategory": None
            })

        return {
            "success": True,
            "history": history,
            "total": len(history)
        }

    except Exception as e:
        print(f"❌ 변경이력 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)
