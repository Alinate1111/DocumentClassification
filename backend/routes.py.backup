
import shutil, os, json, time
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Query,Form,HTTPException, Request, Response
from fastapi.responses import JSONResponse
from zip_utiles import extract_zip
from pydantic import BaseModel
from datetime import datetime
from login import login_member, get_current_user, logout_member
from member import add_member, update_member, delete_member, get_member_by_id, get_total_member_count
from db_conn import db_pool
from uploads import upload_files
from tempfile import NamedTemporaryFile
from PyPDF2 import PdfReader

# OCR 및 분류 서비스
try:
    from ocr_service import get_ocr_service, OCR_AVAILABLE
except Exception as e:
    OCR_AVAILABLE = False
    print(f"⚠️ OCR service not available: {e}")

try:
    from classification_service import get_classification_service
    CLASSIFICATION_AVAILABLE = True
except Exception as e:
    CLASSIFICATION_AVAILABLE = False
    print(f"⚠️ Classification service not available: {e}")
        # router.py




router = APIRouter(prefix="/api")

# 인증 관련 라우터 (prefix 없음)
auth_router = APIRouter()


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


@router.post("/upload")
async def upload_res(request: Request, file: UploadFile = File(...), folder_path: str = Form(None)):
    try:
        return await upload_files(request, file, folder_path)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/folders/create")
async def create_folder(request: Request, folder_name: str = Form(...)):
    """새 폴더 생성"""
    conn = db_pool.get_conn()
    cur = None

    try:
        if not request.session.get("user"):
            raise HTTPException(status_code=401, detail="로그인이 필요합니다")

        userid = request.session["user"].get("member_id")
        cur = conn.cursor()

        # 사용자 정보 가져오기
        cur.execute("""
            SELECT member_id, id, name
            FROM member_info
            WHERE member_id = %s
        """, (userid,))
        member_row = cur.fetchone()

        if not member_row:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

        member_id, user_uid, username = member_row

        # 폴더 경로 생성 (실제 파일시스템)
        folder_path = os.path.join(".", "upload", username, user_uid, folder_name).replace("\\", "/")
        os.makedirs(folder_path, exist_ok=True)

        # DB에 폴더 정보 저장 (빈 폴더도 표시하기 위해)
        try:
            cur.execute("""
                INSERT INTO folders (member_id, folder_name, folder_path, created_at)
                VALUES (%s, %s, %s, %s)
            """, (member_id, folder_name, folder_path, datetime.now()))
            conn.commit()
        except Exception as db_err:
            # 이미 존재하는 폴더일 경우 무시
            conn.rollback()
            print(f"폴더 DB 저장 실패 (이미 존재할 수 있음): {db_err}")

        return {
            "success": True,
            "message": f"폴더 '{folder_name}'이(가) 생성되었습니다",
            "folder_name": folder_name,
            "folder_path": f"{username}/{user_uid}/{folder_name}"
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"폴더 생성 실패: {str(e)}")
    finally:
        if cur:
            cur.close()
        db_pool.release_conn(conn)


@router.post("/folders/upload")
async def upload_folder(request: Request, files: list[UploadFile] = File(...)):
    """폴더 전체 업로드 (PDF 파일만 추출)"""
    conn = db_pool.get_conn()
    cur = None

    try:
        if not request.session.get("user"):
            raise HTTPException(status_code=401, detail="로그인이 필요합니다")

        userid = request.session["user"].get("member_id")
        cur = conn.cursor()

        # 사용자 정보 가져오기
        cur.execute("""
            SELECT member_id, id, name
            FROM member_info
            WHERE member_id = %s
        """, (userid,))
        member_row = cur.fetchone()

        if not member_row:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

        member_id, user_uid, username = member_row

        uploaded_files = []
        skipped_files = []
        created_folders = set()  # 생성된 폴더 목록

        for file in files:
            # PDF 파일만 처리
            if not file.filename.lower().endswith('.pdf'):
                skipped_files.append(file.filename)
                continue

            try:
                # 파일 경로 생성 (폴더 구조 유지)
                file_path = os.path.join(".", "upload", username, user_uid, file.filename).replace("\\", "/")
                folder_path = os.path.dirname(file_path)

                os.makedirs(folder_path, exist_ok=True)

                # 폴더 정보 수집 (중간 폴더들 포함)
                # 예: test/folder1/file.pdf -> test, test/folder1
                relative_path = file.filename
                path_parts = relative_path.split("/")
                for i in range(len(path_parts) - 1):  # 마지막은 파일이므로 제외
                    folder_relative = "/".join(path_parts[:i+1])
                    folder_full = os.path.join(".", "upload", username, user_uid, folder_relative).replace("\\", "/")
                    created_folders.add((folder_relative, folder_full))

                # 파일 저장
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)

                # PDF 정보 추출
                page_count = len(PdfReader(file_path).pages)
                size = round(os.path.getsize(file_path) / (1024 * 1024), 3)

                # DB에 저장
                cur.execute("""
                    INSERT INTO pdf_documents (member_id, filename, updated_at, status, page_count, file_size, upload_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (member_id, file_path, datetime.now(), "upload", page_count, size, datetime.now()))

                uploaded_files.append(file.filename)

            except Exception as e:
                print(f"파일 업로드 실패: {file.filename} - {str(e)}")
                skipped_files.append(file.filename)

        # 폴더 정보를 folders 테이블에 저장
        for folder_name, folder_full_path in created_folders:
            try:
                cur.execute("""
                    INSERT INTO folders (member_id, folder_name, folder_path, created_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (member_id, folder_path) DO NOTHING
                """, (member_id, folder_name.split("/")[-1], folder_full_path, datetime.now()))
            except Exception as e:
                print(f"폴더 DB 저장 실패: {folder_name} - {str(e)}")

        conn.commit()

        return {
            "success": True,
            "message": f"{len(uploaded_files)}개의 PDF 파일이 업로드되었습니다",
            "uploaded_files": uploaded_files,
            "skipped_files": skipped_files
        }

    except HTTPException as he:
        if conn:
            conn.rollback()
        raise he
    except Exception as e:
        if conn:
            conn.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"폴더 업로드 실패: {str(e)}")
    finally:
        if cur:
            cur.close()
        db_pool.release_conn(conn)














@router.delete("/remove")
def remove_file(path: str = Query(..., description="삭제할 파일 경로")):
    conn = db_pool.get_conn()
    cur = None

    try:
        cur = conn.cursor()

        # 파일 정보 조회 (변경이력 저장용)
        cur.execute("SELECT doc_id, filename FROM pdf_documents WHERE filename = %s", (path,))
        file_info = cur.fetchone()

        if not file_info:
            return JSONResponse(status_code=404, content={"success": False, "message": "해당 경로의 파일이 없습니다."})

        doc_id, filename = file_info
        file_name = filename.split('/')[-1]

        # 변경이력에 삭제 기록 추가
        try:
            cur.execute("""
                INSERT INTO classification_history
                (doc_id, file_name, full_path, original_folder, change_type)
                VALUES (%s, %s, %s, %s, 'deleted')
            """, (doc_id, file_name, filename, filename))
        except Exception as history_error:
            print(f"⚠️  변경이력 저장 실패 (무시): {history_error}")

        # 삭제 실행
        cur.execute("DELETE FROM pdf_documents WHERE filename = %s", (path,))
        conn.commit()

        return {"success": True, "message": f"{path} 삭제 완료"}

    except Exception as e:
        if conn:
            conn.rollback()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

    finally:
        if cur:
            cur.close()
        db_pool.release_conn(conn)


@router.delete("/folders/delete")
async def delete_folder(request: Request, folder_name: str = Query(...)):
    """폴더 삭제 (폴더 내 모든 파일도 삭제)"""
    conn = db_pool.get_conn()
    cur = None

    try:
        if not request.session.get("user"):
            raise HTTPException(status_code=401, detail="로그인이 필요합니다")

        userid = request.session["user"].get("member_id")
        cur = conn.cursor()

        # 사용자 정보 가져오기
        cur.execute("""
            SELECT member_id, id, name
            FROM member_info
            WHERE member_id = %s
        """, (userid,))
        member_row = cur.fetchone()

        if not member_row:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

        member_id, user_uid, username = member_row

        # 폴더 경로 생성
        folder_path = os.path.join(".", "upload", username, user_uid, folder_name).replace("\\", "/")

        # 1. 폴더 내 파일 정보 조회 (변경이력 저장용)
        cur.execute("""
            SELECT doc_id, filename
            FROM pdf_documents
            WHERE member_id = %s AND filename LIKE %s
        """, (member_id, f"{folder_path}%"))
        files_to_delete = cur.fetchall()

        # 변경이력에 삭제 기록 추가
        for doc_id, filename in files_to_delete:
            try:
                file_name = filename.split('/')[-1]
                cur.execute("""
                    INSERT INTO classification_history
                    (doc_id, file_name, full_path, original_folder, change_type)
                    VALUES (%s, %s, %s, %s, 'deleted')
                """, (doc_id, file_name, filename, filename))
            except Exception as history_error:
                print(f"⚠️  변경이력 저장 실패 (무시): {history_error}")

        # 2. 폴더 내 모든 파일 삭제 (DB)
        cur.execute("""
            DELETE FROM pdf_documents
            WHERE member_id = %s AND filename LIKE %s
        """, (member_id, f"{folder_path}%"))

        deleted_files_count = cur.rowcount

        # 3. 폴더 정보 삭제 (DB)
        cur.execute("""
            DELETE FROM folders
            WHERE member_id = %s AND folder_path LIKE %s
        """, (member_id, f"{folder_path}%"))

        deleted_folders_count = cur.rowcount

        # 4. 실제 파일시스템에서 폴더 삭제
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path)

        conn.commit()

        return {
            "success": True,
            "message": f"폴더 '{folder_name}'이(가) 삭제되었습니다",
            "deleted_files": deleted_files_count,
            "deleted_folders": deleted_folders_count
        }

    except HTTPException as he:
        if conn:
            conn.rollback()
        raise he
    except Exception as e:
        if conn:
            conn.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"폴더 삭제 실패: {str(e)}")
    finally:
        if cur:
            cur.close()
        db_pool.release_conn(conn)


class RenameRequest(BaseModel):
    old_path: str
    new_name: str


@router.post("/rename_file")
async def rename_file(request: Request, rename_req: RenameRequest):
    """개별 파일 이름 변경"""
    conn = db_pool.get_conn()
    cur = None

    try:
        if not request.session.get("user"):
            raise HTTPException(status_code=401, detail="로그인이 필요합니다")

        cur = conn.cursor()
        member_id = request.session["user"]["member_id"]

        # 기존 파일 경로
        old_path = rename_req.old_path

        # 새 파일 경로 생성 (같은 디렉토리에 새 이름)
        directory = os.path.dirname(old_path)
        new_path = os.path.join(directory, rename_req.new_name).replace("\\", "/")

        # DB에서 파일 존재 확인
        cur.execute("""
            SELECT filename FROM pdf_documents
            WHERE member_id = %s AND filename = %s
        """, (member_id, old_path))

        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")

        # 새 이름이 이미 존재하는지 확인
        cur.execute("""
            SELECT 1 FROM pdf_documents
            WHERE member_id = %s AND filename = %s
        """, (member_id, new_path))

        if cur.fetchone():
            raise HTTPException(status_code=400, detail="같은 이름의 파일이 이미 존재합니다")

        # 실제 파일 이름 변경
        if os.path.exists(old_path):
            os.rename(old_path, new_path)

        # DB 업데이트
        cur.execute("""
            UPDATE pdf_documents
            SET filename = %s, updated_at = %s
            WHERE member_id = %s AND filename = %s
        """, (new_path, datetime.now(), member_id, old_path))

        conn.commit()

        return {
            "success": True,
            "message": f"파일 이름이 '{rename_req.new_name}'(으)로 변경되었습니다",
            "new_path": new_path
        }

    except HTTPException as he:
        if conn:
            conn.rollback()
        raise he
    except Exception as e:
        if conn:
            conn.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"파일 이름 변경 실패: {str(e)}")
    finally:
        if cur:
            cur.close()
        db_pool.release_conn(conn)


@router.post("/rename_folder")
async def rename_folder(request: Request, rename_req: RenameRequest):
    """폴더 이름 변경"""
    conn = db_pool.get_conn()
    cur = None

    try:
        if not request.session.get("user"):
            raise HTTPException(status_code=401, detail="로그인이 필요합니다")

        cur = conn.cursor()
        member_id = request.session["user"]["member_id"]
        username = request.session["user"]["name"]
        user_uid = request.session["user"]["id"]

        # 기존 폴더 경로
        old_path = rename_req.old_path

        # 새 폴더 경로 생성
        parent_dir = os.path.dirname(old_path)
        new_path = os.path.join(parent_dir, rename_req.new_name).replace("\\", "/")

        # 폴더 경로 정규화 (upload 이후 부분만)
        base_dir = os.path.join(".", "upload", username, user_uid).replace("\\", "/")

        # 실제 파일시스템에서 폴더 존재 확인
        if not os.path.exists(old_path):
            raise HTTPException(status_code=404, detail="폴더를 찾을 수 없습니다")

        # 새 이름이 이미 존재하는지 확인
        if os.path.exists(new_path):
            raise HTTPException(status_code=400, detail="같은 이름의 폴더가 이미 존재합니다")

        # 실제 파일시스템에서 폴더 이름 변경
        os.rename(old_path, new_path)

        # DB에서 해당 폴더의 모든 파일 경로 업데이트
        cur.execute("""
            UPDATE pdf_documents
            SET filename = REPLACE(filename, %s, %s),
                updated_at = %s
            WHERE member_id = %s AND filename LIKE %s
        """, (old_path, new_path, datetime.now(), member_id, f"{old_path}%"))

        updated_files = cur.rowcount

        # folders 테이블도 업데이트 (있다면)
        cur.execute("""
            UPDATE folders
            SET folder_path = REPLACE(folder_path, %s, %s),
                folder_name = %s
            WHERE member_id = %s AND folder_path LIKE %s
        """, (old_path, new_path, rename_req.new_name, member_id, f"{old_path}%"))

        conn.commit()

        return {
            "success": True,
            "message": f"폴더 이름이 '{rename_req.new_name}'(으)로 변경되었습니다",
            "updated_files": updated_files,
            "new_path": new_path
        }

    except HTTPException as he:
        if conn:
            conn.rollback()
        # 파일시스템 변경 롤백
        if os.path.exists(new_path):
            os.rename(new_path, old_path)
        raise he
    except Exception as e:
        if conn:
            conn.rollback()
        # 파일시스템 변경 롤백
        if 'new_path' in locals() and os.path.exists(new_path):
            try:
                os.rename(new_path, old_path)
            except:
                pass
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"폴더 이름 변경 실패: {str(e)}")
    finally:
        if cur:
            cur.close()
        db_pool.release_conn(conn)


@router.get("/files")
async def get_files(request: Request):
    conn = db_pool.get_conn()
    cur = conn.cursor()
    try:
        # 로그인한 사용자 확인
        if not request.session.get("user"):
            raise HTTPException(status_code=401, detail="로그인이 필요합니다")

        userid = request.session["user"].get("member_id")

        # 사용자 정보 가져오기
        cur.execute("""
            SELECT member_id, id, name
            FROM member_info
            WHERE member_id = %s
        """, (userid,))
        member_row = cur.fetchone()

        if not member_row:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

        member_id, user_uid, username = member_row
        user_prefix = f"./upload/{username}/{user_uid}/"

        # 현재 로그인한 사용자의 파일만 가져오기 (분류 정보 포함)
        cur.execute("""
            SELECT
                p.doc_id,
                p.filename,
                p.upload_date,
                p.file_size,
                p.page_count,
                p.status,
                p.created_at,
                p.updated_at,
                p.member_id,
                m.name,
                m.email,
                p.ocr,
                p.is_classified,
                p.agency,
                p.document_type,
                p.confidence_agency,
                p.confidence_document_type,
                p.classified_date
            FROM pdf_documents p
            LEFT JOIN member_info m ON p.member_id = m.member_id
            WHERE p.member_id = %s
            ORDER BY p.created_at DESC
        """, (member_id,))
        rows = cur.fetchall()

        # 파일 경로와 메타데이터 수집
        file_paths = []
        file_metadata = {}  # {상대경로: {upload_date, file_size, full_path, ...}}

        for row in rows:
            full_path = row[1]
            if full_path.startswith(user_prefix):
                relative_path = full_path[len(user_prefix):]
                file_paths.append(relative_path)

                # 메타데이터 저장 (전체 경로, OCR 상태, 분류 정보 포함)
                file_metadata[relative_path] = {
                    "doc_id": row[0],
                    "upload_date": row[2].isoformat() if row[2] else None,
                    "file_size": float(row[3]) if row[3] else 0,
                    "page_count": row[4],
                    "status": row[5],
                    "full_path": full_path,  # 전체 경로
                    "ocr_completed": row[11] if len(row) > 11 else False,  # OCR 완료 여부
                    "is_classified": row[12] if len(row) > 12 else False,  # 분류 완료 여부
                    "agency": row[13] if len(row) > 13 else None,  # 기관
                    "document_type": row[14] if len(row) > 14 else None,  # 문서유형
                    "confidence_agency": row[15] if len(row) > 15 else None,  # 기관 신뢰도
                    "confidence_document_type": row[16] if len(row) > 16 else None,  # 문서유형 신뢰도
                    "classified_date": row[17].isoformat() if len(row) > 17 and row[17] else None  # 분류 일시
                }

        # 폴더 정보도 가져오기 (빈 폴더 포함)
        cur.execute("""
            SELECT folder_name, folder_path, created_at
            FROM folders
            WHERE member_id = %s
            ORDER BY created_at DESC
        """, (member_id,))
        folder_rows = cur.fetchall()

        # 빈 폴더를 파일 경로로 추가
        for folder_row in folder_rows:
            folder_path = folder_row[1]
            if folder_path.startswith(user_prefix):
                relative_folder = folder_path[len(user_prefix):]
                file_paths.append(relative_folder + "/.folder_placeholder")

        return {
            "file_paths": file_paths,
            "metadata": file_metadata
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"파일 목록 조회 실패: {str(e)}")
    finally:
        if cur:
            cur.close()
        db_pool.release_conn(conn)

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



# @router.post("/upload")
# async def upload_file(file: UploadFile = File(...)):
#     os.makedirs(f"{file.id}", exist_ok=True)
#     save_path = f"uploads/{file.filename}"
#     save_size = os.path.getsize(file.filename)
#     print("너는 경로가??????",save_path)
#     with open(save_path, "wb") as buffer:
#         shutil.copyfileobj(file.file, buffer)

#     ext = file.filename.split(".")[-1].lower()
#     conn = db_pool.get_conn()
#     cursor = conn.cursor()

#     try:
#         if ext == "zip":
#             added = extract_zip(save_path, file.filename)
#             return {"message": f"ZIP 업로드 완료 ({added}개 추가됨)", "file_count": added}
#         elif ext == "pdf":
#             cursor.execute(
#                 "SELECT 1 FROM pdf_documents WHERE filename = %s", (file.filename,)
#             )
#             if cursor.fetchone():
#                 return {"message": "이미 업로드된 파일입니다.", "file_count": 0}

#             cursor.execute("""
#                 INSERT INTO pdf_documents (file_size ,filename, status, created_at, updated_at)
#                 VALUES (%s,%s, %s, %s, %s)
#             """, (save_size,save_path, "uploaded", datetime.now(), datetime.now()))
#             conn.commit()
#             return {"message": "PDF 업로드 완료", "file_count": 1}
#         else:
#             return {"error": "zip 또는 pdf만 업로드 가능"}
#     except Exception as e:
#         conn.rollback()
#         return {"error": str(e)}
#     finally:    
#         cursor.close()
#         db_pool.release_conn(conn)




# ===== 로그인 모델 =====
class LoginRequest(BaseModel):
    id: str
    password: str

# 로그인
@auth_router.post("/login")
def login_endpoint(data: LoginRequest, request: Request):
    result = login_member(data.id, data.password, request.session)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result

# 로그아웃
@auth_router.get("/logout")
def logout_endpoint(request: Request):
    return logout_member(request.session)


@auth_router.get("/me")
def get_current_user_endpoint(request: Request):
    result = get_current_user(request.session)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


# ===== 회원 모델 =====
# 회원가입 모델
class AddMemberRequest(BaseModel):
    id: str
    password: str
    name: str
    phone: str
    email: str
    member_role: str = 'R2'
    member_grade: str = 'G2'

# 회원정보수정 모델
class UpdateMemberRequest(BaseModel):
    id: str
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    password: str | None = None
    member_role: str | None = None
    member_grade: str | None = None

# 회원가입
@auth_router.post("/member/add")
def add_member_endpoint(data: AddMemberRequest):
    try:
        member_id = add_member(
            id=data.id,
            password=data.password,
            name=data.name,
            phone=data.phone,
            email=data.email,
            member_role=data.member_role,
            member_grade=data.member_grade
        )
        return {"message": "Member added successfully", "member_id": member_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 회원 정보 조회용
@auth_router.get("/member/me")
def get_my_member_info(request: Request):
    session_user = get_current_user(request.session)
    if "error" in session_user:
        raise HTTPException(status_code=401, detail=session_user["error"])

    member_id = session_user["member_id"]
    member = get_member_by_id(member_id)  # member.py 함수 사용
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    return member  # 실제 회원 정보 반환

# 회원정보수정
@auth_router.put("/member/update")
def update_member_endpoint(data: UpdateMemberRequest):
    success = update_member(
        id=data.id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        password=data.password,
        member_role=data.member_role,
        member_grade=data.member_grade
    )
    if not success:
        raise HTTPException(status_code=400, detail="No fields to update or member not found")
    return {"message": "Member updated successfully"}

# 회원삭제
@auth_router.delete("/member/delete/{member_id}")
def delete_member_endpoint(member_id: str, response: Response):
    success = delete_member(member_id)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found")

    # 세션 쿠키 삭제 → 브라우저에서 로그아웃 처리
    response.delete_cookie(key="session")

    return {"message": "Member deleted successfully"}

# 회원 정보 조회 - 관리자용
@auth_router.get("/member/admin/{member_id}")
def get_member_endpoint_admin(member_id: str):
    member = get_member_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member

# 전체 회원수 조회 하는 코드
@auth_router.get("/member/count")
def get_member_count():
    """
    전체 회원 수 조회 API (member_role='R2'만)
    """
    try:
        total = get_total_member_count()
        return {"total_members": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics/dashboard")
async def get_dashboard_statistics():
    """
    대시보드 통계 데이터 조회
    - 총 문서 수
    - 총 인덱싱 용량
    - OCR 완료 문서 수
    - 분류 완료 문서 수
    - 금일 업로드 문서 수
    """
    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
        # 총 문서 수 및 총 용량
        cur.execute("""
            SELECT
                COUNT(*) as total_docs,
                COALESCE(SUM(file_size), 0) as total_size
            FROM pdf_documents
        """)
        row = cur.fetchone()
        total_docs = row[0] if row else 0
        total_size = float(row[1]) if row else 0.0

        # OCR 완료 문서 수
        cur.execute("SELECT COUNT(*) FROM pdf_documents WHERE ocr = TRUE")
        ocr_completed = cur.fetchone()[0]

        # 분류 완료 문서 수 (pdf_documents.is_classified 사용)
        cur.execute("SELECT COUNT(*) FROM pdf_documents WHERE is_classified = TRUE")
        classified_docs = cur.fetchone()[0]

        # 금일 업로드 문서 수
        cur.execute("""
            SELECT COUNT(*)
            FROM pdf_documents
            WHERE DATE(upload_date) = CURRENT_DATE
        """)
        today_uploads = cur.fetchone()[0]

        # 금일 업데이트 문서 수 (OCR 또는 분류 완료)
        cur.execute("""
            SELECT COUNT(*)
            FROM pdf_documents
            WHERE DATE(updated_at) = CURRENT_DATE
            AND (ocr = TRUE OR status LIKE '%CLASSIFIED%')
        """)
        today_updates = cur.fetchone()[0]

        # 최근 7일간 일별 신규 등록 및 업데이트 통계
        cur.execute("""
            WITH days AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '6 days',
                    CURRENT_DATE,
                    '1 day'::interval
                )::date AS day
            )
            SELECT
                TO_CHAR(d.day, 'Dy') as day_name,
                COALESCE(COUNT(p.doc_id) FILTER (WHERE DATE(p.upload_date) = d.day), 0) as uploads,
                COALESCE(COUNT(p.doc_id) FILTER (WHERE DATE(p.updated_at) = d.day AND p.upload_date < d.day), 0) as updates
            FROM days d
            LEFT JOIN pdf_documents p ON DATE(p.upload_date) = d.day OR DATE(p.updated_at) = d.day
            GROUP BY d.day
            ORDER BY d.day
        """)

        weekly_data = []
        day_names_kr = ['월', '화', '수', '목', '금', '토', '일']
        day_names_en = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

        for row in cur.fetchall():
            day_name_en = row[0]
            # 영문 요일을 한글로 변환
            try:
                day_index = day_names_en.index(day_name_en)
                day_name_kr = day_names_kr[day_index]
            except:
                day_name_kr = day_name_en

            weekly_data.append({
                "name": day_name_kr,
                "신규등록": int(row[1]) if row[1] else 0,
                "업데이트": int(row[2]) if row[2] else 0
            })

        return {
            "success": True,
            "total_documents": total_docs,
            "total_size_mb": round(total_size, 2),
            "total_size_gb": round(total_size / 1024, 2),
            "ocr_completed": ocr_completed,
            "classified_documents": classified_docs,
            "today_uploads": today_uploads,
            "today_updates": today_updates,
            "weekly_data": weekly_data
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)


@router.get("/statistics/processing-logs")
async def get_processing_logs(limit: int = 10):
    """
    최근 처리 로그 조회 (AI 작업 이력용)
    - processing_log 테이블에서 실제 작업 이력 조회
    """
    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
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

        # message 컬럼 추가 (없으면)
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='processing_log' AND column_name='message'
        """)
        if not cur.fetchone():
            cur.execute("ALTER TABLE processing_log ADD COLUMN message TEXT")
            print("✅ processing_log 테이블에 message 컬럼 추가")

        conn.commit()

        # processing_log 테이블에서 최근 로그 조회
        cur.execute("""
            SELECT
                log_id,
                doc_id,
                filename,
                process_type,
                status,
                message,
                created_at
            FROM processing_log
            ORDER BY created_at DESC
            LIMIT %s
        """, (limit,))

        rows = cur.fetchall()
        logs = []

        for row in rows:
            log_id, doc_id, filename, process_type, status, message, created_at = row

            logs.append({
                "log_id": log_id,
                "doc_id": doc_id,
                "filename": filename,
                "process_type": process_type,
                "status": status,
                "message": message,
                "timestamp": created_at.isoformat() if created_at else None
            })

        return {
            "success": True,
            "logs": logs
        }

    except Exception as e:
        print(f"❌ 처리 로그 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)

# 회원 정보 조회
@auth_router.get("/member/{member_id}")
def get_member_endpoint(member_id: str):
    member = get_member_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


# ============================================================================
# 카테고리 자동 생성 API (Gemma3)
# ============================================================================

@router.post("/category/auto-generate")
async def auto_generate_categories(request: Request):
    """
    Gemma3 모델을 사용하여 OCR 완료 파일들로부터 카테고리 구조 자동 생성

    Request Body:
        {
            "files": ["path1", "path2", ...],
            "level": 1~4 (카테고리 최대 단계)
        }

    Returns:
        {
            "success": bool,
            "categories": {...},  # 생성된 카테고리 구조
            "classified_documents": {...}  # 각 문서의 카테고리 배치
        }
    """
    try:
        data = await request.json()
        files = data.get('files', [])
        level = data.get('level', 2)

        print(f"\n{'='*60}")
        print(f"🤖 Gemma3 카테고리 자동 생성 시작")
        print(f"   파일 개수: {len(files)}")
        print(f"   최대 단계: {level}")
        print(f"{'='*60}\n")

        if not files:
            return {"success": False, "error": "파일 목록이 비어있습니다"}

        conn = db_pool.get_conn()
        cur = conn.cursor()

        # 1. 각 파일의 OCR 텍스트 수집
        documents = []
        for file_path in files:
            print(f"📄 파일 처리 중: {file_path}")

            # 경로 정규화
            normalized_path = file_path.replace('\\', '/')
            if normalized_path.startswith('./'):
                normalized_path = normalized_path[2:]

            # doc_id 조회
            cur.execute("""
                SELECT doc_id
                FROM pdf_documents
                WHERE filename = %s OR filename LIKE %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (normalized_path, f"%{normalized_path}"))

            row = cur.fetchone()
            if not row:
                print(f"⚠️  파일을 찾을 수 없습니다: {file_path}")
                continue

            doc_id = row[0]

            # OCR 텍스트 조회
            cur.execute("""
                SELECT full_text
                FROM ocr_results
                WHERE doc_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (doc_id,))

            ocr_row = cur.fetchone()
            if ocr_row and ocr_row[0]:
                documents.append({
                    "doc_id": doc_id,
                    "file_path": file_path,
                    "text": ocr_row[0][:1000]  # 처음 1000자만 사용 (속도 향상)
                })
                print(f"✅ OCR 텍스트 수집 완료 (doc_id={doc_id})")

        if not documents:
            return {"success": False, "error": "OCR 텍스트를 찾을 수 없습니다"}

        print(f"\n📊 총 {len(documents)}개 문서 수집 완료\n")

        # 2. 각 문서를 개별적으로 Gemma3로 분류
        print("🤖 Gemma3 모델로 문서 개별 분류 중...")

        import requests
        classified_documents = {}
        categories = {}

        for idx, doc in enumerate(documents):
            print(f"\n[{idx+1}/{len(documents)}] 문서 분류 중: {doc['file_path'].split('/')[-1]}")

            try:
                # level에 맞는 프롬프트 생성
                if level == 1:
                    level_instruction = """단일 카테고리만 반환하세요.
- subcategory, detail, subdetail 필드를 절대 포함하지 마세요
- category 필드만 반드시 포함하세요"""
                    example_format = '{"category": "법제사법위원회"}'
                elif level == 2:
                    level_instruction = """2단계 구조로 반환하세요.
- category와 subcategory 필드만 반드시 포함하세요
- detail, subdetail 필드를 절대 포함하지 마세요"""
                    example_format = '{"category": "법제사법위원회", "subcategory": "검토보고서"}'
                elif level == 3:
                    level_instruction = """3단계 구조로 반환하세요.
- category, subcategory, detail 필드를 반드시 모두 포함하세요
- subdetail 필드를 절대 포함하지 마세요
- 각 단계별로 구체적인 분류를 작성하세요"""
                    example_format = '{"category": "법제사법위원회", "subcategory": "검토보고서", "detail": "법률안"}'
                else:
                    level_instruction = """4단계 구조로 반환하세요.
- category, subcategory, detail, subdetail 필드를 반드시 모두 포함하세요
- 각 단계별로 구체적인 분류를 작성하세요"""
                    example_format = '{"category": "법제사법위원회", "subcategory": "검토보고서", "detail": "법률안", "subdetail": "2024년"}'

                # Gemma3 프롬프트 생성
                prompt = f"""다음 문서의 OCR 텍스트를 분석하여 적절한 카테고리에 분류해주세요.

문서 내용:
{doc['text'][:800]}

요구사항:
1. 문서의 내용과 성격을 분석하여 적절한 카테고리로 분류하세요
2. {level_instruction}
3. 응답은 반드시 아래 JSON 형식으로만 작성하세요 (다른 설명 없이):

{example_format}

JSON 응답:"""

                # Ollama API 호출
                ollama_url = "http://localhost:11434/api/generate"
                ollama_payload = {
                    "model": "gemma3:4b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # 더 결정적인 출력을 위해 낮춤
                        "top_p": 0.9,
                        "num_predict": 200  # JSON 응답에 충분한 길이
                    }
                }

                response = requests.post(ollama_url, json=ollama_payload, timeout=30)

                if response.status_code != 200:
                    raise Exception(f"Ollama API 오류: {response.status_code}")

                result = response.json()
                gemma_response = result.get('response', '')

                # JSON 파싱
                import re
                json_match = re.search(r'\{.*\}', gemma_response, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    json_str = gemma_response

                classification = json.loads(json_str)

                category = classification.get('category', '일반문서')
                subcategory = classification.get('subcategory')
                detail = classification.get('detail')
                subdetail = classification.get('subdetail')

                # 카테고리 구조에 추가
                if category not in categories:
                    categories[category] = {}
                if subcategory and subcategory not in categories[category]:
                    categories[category][subcategory] = []

                classified_documents[doc["doc_id"]] = {
                    "file_path": doc["file_path"],
                    "category": category,
                    "subcategory": subcategory,
                    "detail": detail,
                    "subdetail": subdetail,
                    "level": level  # 분류 레벨 정보 저장
                }

                # 로그 출력 (레벨에 맞게)
                log_parts = [category]
                if subcategory:
                    log_parts.append(subcategory)
                if detail:
                    log_parts.append(detail)
                if subdetail:
                    log_parts.append(subdetail)
                print(f"  ✅ 분류 완료: {' / '.join(log_parts)}")

            except Exception as e:
                print(f"  ⚠️  분류 실패: {e}, 기본 카테고리 사용")
                classified_documents[doc["doc_id"]] = {
                    "file_path": doc["file_path"],
                    "category": "일반문서",
                    "subcategory": None,
                    "detail": None
                }
                if "일반문서" not in categories:
                    categories["일반문서"] = {}

        print(f"\n✅ 모든 문서 분류 완료: {len(categories)}개 카테고리")

        # 폴백 처리는 이미 위에서 개별적으로 처리됨
        try:
            pass  # 이미 처리됨

        except requests.exceptions.ConnectionError:
            print("⚠️  Ollama 서버에 연결할 수 없습니다. 기본 카테고리 구조를 사용합니다.")
            # 폴백: 기본 카테고리 구조
            categories = {
                "일반문서": {}
            }
            classified_documents = {}
            for doc in documents:
                classified_documents[doc["doc_id"]] = {
                    "file_path": doc["file_path"],
                    "category": "일반문서",
                    "subcategory": None,
                    "detail": None
                }
        except json.JSONDecodeError as e:
            print(f"⚠️  JSON 파싱 실패: {e}. 기본 구조 사용")
            categories = {
                "자동분류": {}
            }
            classified_documents = {}
            for doc in documents:
                classified_documents[doc["doc_id"]] = {
                    "file_path": doc["file_path"],
                    "category": "자동분류",
                    "subcategory": None,
                    "detail": None
                }
        except Exception as e:
            print(f"⚠️  Gemma3 처리 중 오류: {e}. 기본 구조 사용")
            categories = {
                "미분류": {}
            }
            classified_documents = {}
            for doc in documents:
                classified_documents[doc["doc_id"]] = {
                    "file_path": doc["file_path"],
                    "category": "미분류",
                    "subcategory": None,
                    "detail": None
                }

        # DB에 분류 결과 저장 및 변경이력 기록
        for doc_id, classification in classified_documents.items():
            category = classification.get('category', 'Unknown')
            subcategory = classification.get('subcategory', '')
            detail = classification.get('detail', '')
            subdetail = classification.get('subdetail', '')
            file_path = classification.get('file_path', '')
            doc_level = classification.get('level', 1)

            # 레벨에 맞게 agency/document_type 설정
            if doc_level == 1:
                # 1단계: category만 사용
                agency = category
                document_type = None  # 1단계는 document_type 없음
            elif doc_level == 2:
                # 2단계: category/subcategory
                agency = category
                document_type = subcategory if subcategory else None
            elif doc_level == 3:
                # 3단계: category/subcategory/detail
                agency = category
                if subcategory and detail:
                    document_type = f"{subcategory}/{detail}"
                elif subcategory:
                    document_type = subcategory
                else:
                    document_type = None
            else:
                # 4단계: category/subcategory/detail/subdetail
                agency = category
                parts = []
                if subcategory:
                    parts.append(subcategory)
                if detail:
                    parts.append(detail)
                if subdetail:
                    parts.append(subdetail)
                document_type = '/'.join(parts) if parts else None

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

            # 이전 분류 정보 확인 (UPDATE 전에)
            cur.execute("""
                SELECT agency, document_type
                FROM pdf_documents
                WHERE doc_id = %s
            """, (doc_id,))
            prev_classification = cur.fetchone()

            change_type = 'created'
            prev_category = None
            if prev_classification and prev_classification[0]:
                change_type = 'updated'
                prev_category = f"{prev_classification[0]}/{prev_classification[1]}"

            # pdf_documents 테이블 업데이트
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
            """, (agency, document_type, 0.8, 0.8, doc_id))  # Gemma3는 신뢰도 0.8로 설정

            # 로그 출력 (레벨에 맞게)
            save_log_parts = [agency]
            if document_type:
                save_log_parts.append(document_type)
            print(f"✅ 문서 분류 저장: doc_id={doc_id}, {' / '.join(save_log_parts)}")

            # 변경이력 테이블에도 기록
            try:
                # 원본 경로에서 사용자 폴더명 추출
                file_name = file_path.split('/')[-1] if file_path else "Unknown"
                parts = file_path.split('/')
                top_folder = ""
                if len(parts) > 4 and parts[0] == '.':
                    folder_parts = parts[4:-1]
                    if folder_parts:
                        top_folder = folder_parts[0]

                # 레벨에 맞는 경로 생성
                path_parts = [top_folder] if top_folder else []
                path_parts.append(agency)
                if document_type:
                    path_parts.append(document_type)
                path_parts.append(file_name)
                full_path_for_history = '/'.join(path_parts)

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

                # original_folder 컬럼 추가 (없으면)
                cur.execute("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name='classification_history' AND column_name='original_folder'
                """)
                if not cur.fetchone():
                    cur.execute("ALTER TABLE classification_history ADD COLUMN original_folder TEXT")

                # 변경이력 기록
                avg_confidence = 0.8
                cur.execute("""
                    INSERT INTO classification_history
                    (doc_id, file_name, full_path, original_folder, agency, document_type,
                     confidence_agency, confidence_document_type, avg_confidence,
                     change_type, previous_category)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    doc_id, file_name, full_path_for_history, file_path,
                    agency, document_type, 0.8, 0.8, avg_confidence,
                    change_type, prev_category
                ))

                print(f"  📝 변경이력 기록 완료 (type={change_type})")

                # 작업 로그 기록
                classification_label = ' / '.join([p for p in [agency, document_type] if p])
                log_processing(
                    conn=conn,
                    doc_id=doc_id,
                    filename=file_path,
                    process_type='CLASSIFICATION',
                    status='SUCCESS',
                    message=f"Gemma3 분류 완료: {file_name} - {classification_label}"
                )

            except Exception as history_error:
                print(f"  ⚠️  변경이력 기록 실패 (무시): {history_error}")

        conn.commit()

        print(f"✅ 카테고리 생성 및 문서 분류 완료\n")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "categories": categories,
            "classified_documents": classified_documents,
            "total_files": len(documents)
        }

    except Exception as e:
        print(f"❌ 카테고리 자동 생성 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)


# ============================================================================
# BERT 학습 API (새 카테고리용)
# ============================================================================

@router.post("/category/train")
async def train_bert_model(request: Request):
    """
    샘플 문서로 BERT 모델 학습 (새 카테고리 시스템용)

    Request Body:
        {
            "categories": {
                "category_name": ["sample_doc_id1", "sample_doc_id2", ...],
                ...
            }
        }

    Returns:
        {
            "success": bool,
            "model_path": str,  # 학습된 모델 경로
            "training_time": float
        }
    """
    try:
        data = await request.json()
        categories = data.get('categories', {})

        print(f"\n{'='*60}")
        print(f"🧠 BERT 모델 학습 시작")
        print(f"   카테고리 개수: {len(categories)}")
        print(f"{'='*60}\n")

        if not categories:
            return {"success": False, "error": "카테고리 정보가 비어있습니다"}

        conn = db_pool.get_conn()
        cur = conn.cursor()

        # 1. 각 카테고리별 샘플 문서 수집
        training_data = []
        for category, doc_ids in categories.items():
            print(f"📂 카테고리 '{category}': {len(doc_ids)}개 샘플")

            for doc_id in doc_ids:
                # OCR 텍스트 조회
                cur.execute("""
                    SELECT full_text
                    FROM ocr_results
                    WHERE doc_id = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (doc_id,))

                row = cur.fetchone()
                if row and row[0]:
                    training_data.append({
                        "text": row[0],
                        "label": category
                    })

        if not training_data:
            return {"success": False, "error": "학습 데이터를 찾을 수 없습니다"}

        print(f"\n📊 총 {len(training_data)}개 샘플 수집 완료\n")

        # 2. BERT 모델 학습
        print("🧠 BERT 모델 학습 중...")
        start_time = time.time()

        try:
            from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
            from sklearn.model_selection import train_test_split
            import torch
            from torch.utils.data import Dataset

            # 레이블 인코딩
            label_to_id = {label: idx for idx, label in enumerate(categories.keys())}
            id_to_label = {idx: label for label, idx in label_to_id.items()}

            # 텍스트와 레이블 분리
            texts = [item["text"] for item in training_data]
            labels = [label_to_id[item["label"]] for item in training_data]

            # 훈련/검증 분할 (80/20)
            train_texts, val_texts, train_labels, val_labels = train_test_split(
                texts, labels, test_size=0.2, random_state=42, stratify=labels if len(set(labels)) > 1 else None
            )

            # 토크나이저 및 모델 초기화
            model_name = "klue/bert-base"
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(
                model_name,
                num_labels=len(categories),
                id2label=id_to_label,
                label2id=label_to_id
            )

            # 토크나이징
            train_encodings = tokenizer(train_texts, truncation=True, padding=True, max_length=512)
            val_encodings = tokenizer(val_texts, truncation=True, padding=True, max_length=512)

            # PyTorch Dataset 생성
            class CustomDataset(Dataset):
                def __init__(self, encodings, labels):
                    self.encodings = encodings
                    self.labels = labels

                def __getitem__(self, idx):
                    item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
                    item['labels'] = torch.tensor(self.labels[idx])
                    return item

                def __len__(self):
                    return len(self.labels)

            train_dataset = CustomDataset(train_encodings, train_labels)
            val_dataset = CustomDataset(val_encodings, val_labels)

            # 모델 저장 디렉토리 생성
            model_dir = f"models/bert_custom_{int(time.time())}"
            os.makedirs(model_dir, exist_ok=True)

            # 훈련 설정
            training_args = TrainingArguments(
                output_dir=model_dir,
                num_train_epochs=3,
                per_device_train_batch_size=8,
                per_device_eval_batch_size=8,
                warmup_steps=100,
                weight_decay=0.01,
                logging_dir=f"{model_dir}/logs",
                logging_steps=10,
                eval_strategy="epoch",
                save_strategy="epoch",
                load_best_model_at_end=True,
                metric_for_best_model="eval_loss",
                greater_is_better=False,
                save_total_limit=2,
                report_to="none"  # 외부 로깅 비활성화
            )

            # Trainer 초기화 및 학습
            trainer = Trainer(
                model=model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=val_dataset
            )

            print("🚀 BERT 모델 파인튜닝 시작...")
            trainer.train()

            # 모델 및 토크나이저 저장
            model.save_pretrained(model_dir)
            tokenizer.save_pretrained(model_dir)

            # 레이블 매핑 저장
            label_mapping_path = os.path.join(model_dir, "label_mappings.json")
            with open(label_mapping_path, 'w', encoding='utf-8') as f:
                json.dump({
                    "label2id": label_to_id,
                    "id2label": id_to_label,
                    "num_labels": len(categories)
                }, f, ensure_ascii=False, indent=2)

            # 학습 메타데이터 저장
            metadata_path = os.path.join(model_dir, "training_metadata.json")
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump({
                    "model_name": model_name,
                    "num_categories": len(categories),
                    "categories": list(categories.keys()),
                    "total_samples": len(training_data),
                    "train_samples": len(train_texts),
                    "val_samples": len(val_texts),
                    "training_date": datetime.now().isoformat()
                }, f, ensure_ascii=False, indent=2)

            training_time = time.time() - start_time

            print(f"✅ 모델 학습 완료 ({training_time:.2f}초)")
            print(f"   모델 저장 경로: {model_dir}")
            print(f"   훈련 샘플: {len(train_texts)}개")
            print(f"   검증 샘플: {len(val_texts)}개")
            print(f"{'='*60}\n")

            return {
                "success": True,
                "model_path": model_dir,
                "training_time": training_time,
                "total_samples": len(training_data),
                "train_samples": len(train_texts),
                "val_samples": len(val_texts),
                "categories": list(categories.keys()),
                "num_categories": len(categories)
            }

        except ImportError as e:
            print(f"❌ 필수 라이브러리를 찾을 수 없습니다: {e}")
            print("   pip install transformers torch scikit-learn 을 실행해주세요")
            return {
                "success": False,
                "error": f"필수 라이브러리 없음: {str(e)}",
                "message": "transformers, torch, scikit-learn을 설치해주세요"
            }

        except Exception as e:
            print(f"❌ BERT 학습 중 오류 발생: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e),
                "message": "BERT 모델 학습 실패"
            }

    except Exception as e:
        print(f"❌ BERT 학습 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)


# ============================================================================
# 커스텀 모델로 문서 분류 API
# ============================================================================

@router.post("/category/classify-with-custom-model")
async def classify_with_custom_model(request: Request):
    """
    커스텀 학습된 BERT 모델로 문서 분류

    Request Body:
        {
            "model_path": "models/bert_custom_1234567890",
            "files": ["path1", "path2", ...]
        }

    Returns:
        {
            "success": bool,
            "results": [
                {"doc_id": 1, "file_path": "...", "category": "...", "confidence": 0.95},
                ...
            ]
        }
    """
    try:
        data = await request.json()
        model_path = data.get('model_path')
        files = data.get('files', [])

        print(f"\n{'='*60}")
        print(f"🔍 커스텀 모델로 문서 분류 시작")
        print(f"   모델 경로: {model_path}")
        print(f"   파일 개수: {len(files)}")
        print(f"{'='*60}\n")

        if not model_path or not files:
            return {"success": False, "error": "model_path와 files가 필요합니다"}

        if not os.path.exists(model_path):
            return {"success": False, "error": f"모델을 찾을 수 없습니다: {model_path}"}

        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        import torch

        # 모델 및 토크나이저 로드
        print(f"📦 모델 로딩 중: {model_path}")
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForSequenceClassification.from_pretrained(model_path)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)
        model.eval()

        # 레이블 매핑 로드
        label_mapping_path = os.path.join(model_path, "label_mappings.json")
        with open(label_mapping_path, 'r', encoding='utf-8') as f:
            label_mappings = json.load(f)

        id_to_label = {int(k): v for k, v in label_mappings['id2label'].items()}
        print(f"✅ 모델 로드 완료 ({len(id_to_label)}개 카테고리)")

        conn = db_pool.get_conn()
        cur = conn.cursor()

        results = []

        # 각 파일 분류
        for file_path in files:
            print(f"📄 분류 중: {file_path}")

            # 경로 정규화
            normalized_path = file_path.replace('\\', '/')
            if normalized_path.startswith('./'):
                normalized_path = normalized_path[2:]

            # doc_id 조회
            cur.execute("""
                SELECT doc_id
                FROM pdf_documents
                WHERE filename = %s OR filename LIKE %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (normalized_path, f"%{normalized_path}"))

            row = cur.fetchone()
            if not row:
                print(f"⚠️  파일을 찾을 수 없습니다: {file_path}")
                results.append({
                    "file_path": file_path,
                    "success": False,
                    "error": "파일을 찾을 수 없습니다"
                })
                continue

            doc_id = row[0]

            # OCR 텍스트 조회
            cur.execute("""
                SELECT full_text
                FROM ocr_results
                WHERE doc_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (doc_id,))

            ocr_row = cur.fetchone()
            if not ocr_row or not ocr_row[0]:
                print(f"⚠️  OCR 텍스트를 찾을 수 없습니다: {file_path}")
                results.append({
                    "doc_id": doc_id,
                    "file_path": file_path,
                    "success": False,
                    "error": "OCR 텍스트를 찾을 수 없습니다"
                })
                continue

            full_text = ocr_row[0]

            # 분류 수행
            inputs = tokenizer(
                full_text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = model(**inputs)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=-1)
                predicted_class = torch.argmax(probs, dim=-1).item()
                confidence = probs[0][predicted_class].item()

            predicted_category = id_to_label[predicted_class]

            print(f"✅ 분류 완료: {predicted_category} (신뢰도: {confidence:.2%})")

            # DB에 분류 결과 저장
            cur.execute("""
                INSERT INTO document_keywords (doc_id, keywords, main_topic, keyword_count, raw_response, model_name)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING keyword_id
            """, (
                doc_id,
                json.dumps({"category": predicted_category, "confidence": confidence}, ensure_ascii=False),
                predicted_category,
                1,
                json.dumps({"all_probs": probs[0].cpu().tolist()}, ensure_ascii=False),
                f"custom-bert-{os.path.basename(model_path)}"
            ))

            keyword_id = cur.fetchone()[0]

            # 문서 상태 업데이트
            cur.execute("""
                UPDATE pdf_documents
                SET status = 'CLASSIFIED', updated_at = NOW()
                WHERE doc_id = %s
            """, (doc_id,))

            results.append({
                "doc_id": doc_id,
                "file_path": file_path,
                "category": predicted_category,
                "confidence": confidence,
                "keyword_id": keyword_id,
                "success": True
            })

        conn.commit()

        print(f"\n✅ 전체 분류 완료: {len(results)}개 문서")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "results": results,
            "total_files": len(files),
            "classified_files": len([r for r in results if r.get('success', False)])
        }

    except Exception as e:
        print(f"❌ 커스텀 모델 분류 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)


# ============================================================
# 변경이력 API
# ============================================================

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


# ============================================================
# 통계 API
# ============================================================

@router.get("/statistics/overall")
async def get_overall_statistics():
    """
    전체 파일 분류 통계 조회
    - 전체 파일 수
    - 분류 완료 파일 수
    - 미분류 파일 수
    - 카테고리별(agency) 파일 분포
    - 문서유형별(document_type) 파일 분포
    """
    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
        # 1. 전체 파일 수
        cur.execute("SELECT COUNT(*) FROM pdf_documents")
        total_files = cur.fetchone()[0]

        # 2. 분류 완료 파일 수
        cur.execute("SELECT COUNT(*) FROM pdf_documents WHERE is_classified = TRUE")
        classified_files = cur.fetchone()[0]

        # 3. 미분류 파일 수
        unclassified_files = total_files - classified_files

        # 4. 기관별(agency) 파일 분포
        cur.execute("""
            SELECT agency, COUNT(*) as count
            FROM pdf_documents
            WHERE is_classified = TRUE AND agency IS NOT NULL
            GROUP BY agency
            ORDER BY count DESC
        """)
        agency_distribution = []
        for row in cur.fetchall():
            agency_distribution.append({
                "name": row[0],
                "count": row[1]
            })

        # 5. 문서유형별(document_type) 파일 분포 - 상위 카테고리만
        cur.execute("""
            SELECT document_type, COUNT(*) as count
            FROM pdf_documents
            WHERE is_classified = TRUE AND document_type IS NOT NULL
            GROUP BY document_type
            ORDER BY count DESC
            LIMIT 10
        """)
        document_type_distribution = []
        for row in cur.fetchall():
            # document_type이 "subcategory/detail" 형태면 첫 번째만 사용
            doc_type = row[0]
            if doc_type:
                main_type = doc_type.split('/')[0]
                document_type_distribution.append({
                    "name": main_type,
                    "count": row[1]
                })

        # 미분류도 추가
        if unclassified_files > 0:
            document_type_distribution.append({
                "name": "미분류",
                "count": unclassified_files
            })

        return {
            "success": True,
            "totalFiles": total_files,
            "classifiedFiles": classified_files,
            "unclassifiedFiles": unclassified_files,
            "classificationRate": round((classified_files / total_files * 100), 1) if total_files > 0 else 0,
            "agencyDistribution": agency_distribution,
            "documentTypeDistribution": document_type_distribution
        }

    except Exception as e:
        print(f"❌ 전체 통계 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)


@router.get("/statistics/folders")
async def get_folder_statistics():
    """
    폴더별 파일 분류 통계 조회
    - 각 폴더의 전체 파일 수
    - 분류 완료/미분류 파일 수
    - 분류율
    - 폴더별 카테고리 분포
    """
    conn = db_pool.get_conn()
    cur = conn.cursor()

    try:
        # 전체 파일 조회 (폴더명 포함)
        cur.execute("""
            SELECT
                filename,
                is_classified,
                agency,
                document_type
            FROM pdf_documents
            ORDER BY filename
        """)

        files = cur.fetchall()

        # 폴더별로 그룹화
        folder_stats = {}

        for row in files:
            filename = row[0]
            is_classified = row[1]
            agency = row[2]
            document_type = row[3]

            # 폴더명 추출 (./upload/username/uid/폴더명/파일.pdf 형태)
            folder_name = "기타"
            if filename:
                parts = filename.split('/')
                if len(parts) > 4 and parts[0] == '.':
                    folder_parts = parts[4:-1]
                    if folder_parts:
                        folder_name = folder_parts[0]
                elif len(parts) > 1:
                    for part in parts[:-1]:
                        if part and part not in ['.', 'upload']:
                            folder_name = part
                            break

            # 폴더 통계 초기화
            if folder_name not in folder_stats:
                folder_stats[folder_name] = {
                    "name": folder_name,
                    "totalFiles": 0,
                    "classifiedFiles": 0,
                    "unclassifiedFiles": 0,
                    "categories": {}
                }

            # 파일 수 카운트
            folder_stats[folder_name]["totalFiles"] += 1

            if is_classified:
                folder_stats[folder_name]["classifiedFiles"] += 1

                # 카테고리 카운트 (document_type의 첫 부분만 사용)
                category = "기타"
                if document_type:
                    category = document_type.split('/')[0]
                elif agency:
                    category = agency

                if category not in folder_stats[folder_name]["categories"]:
                    folder_stats[folder_name]["categories"][category] = 0
                folder_stats[folder_name]["categories"][category] += 1
            else:
                folder_stats[folder_name]["unclassifiedFiles"] += 1
                if "미분류" not in folder_stats[folder_name]["categories"]:
                    folder_stats[folder_name]["categories"]["미분류"] = 0
                folder_stats[folder_name]["categories"]["미분류"] += 1

        # 결과 포맷팅
        result = []
        for folder_name, stats in folder_stats.items():
            total = stats["totalFiles"]
            classified = stats["classifiedFiles"]
            classification_rate = round((classified / total * 100), 1) if total > 0 else 0

            # 카테고리를 리스트로 변환
            categories = []
            for cat_name, count in stats["categories"].items():
                percentage = round((count / total * 100), 1) if total > 0 else 0
                categories.append({
                    "name": cat_name,
                    "count": count,
                    "percentage": percentage
                })

            # 카운트 순으로 정렬
            categories.sort(key=lambda x: x["count"], reverse=True)

            result.append({
                "name": folder_name,
                "totalFiles": total,
                "classifiedFiles": classified,
                "unclassifiedFiles": stats["unclassifiedFiles"],
                "classificationRate": classification_rate,
                "categories": categories
            })

        # 전체 파일 수 기준으로 정렬
        result.sort(key=lambda x: x["totalFiles"], reverse=True)

        return {
            "success": True,
            "folders": result,
            "total": len(result)
        }

    except Exception as e:
        print(f"❌ 폴더별 통계 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)

