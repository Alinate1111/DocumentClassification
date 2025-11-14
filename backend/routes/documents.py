"""
문서 및 파일 관리 API 라우트
"""
import shutil
import os
from fastapi import APIRouter, UploadFile, File, Query, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime
from PyPDF2 import PdfReader
from core.db_conn import db_pool
from utils.uploads import upload_files

# API 라우터
router = APIRouter(prefix="/api")


# ============================================================
# Pydantic 모델 정의
# ============================================================

class RenameRequest(BaseModel):
    old_path: str
    new_name: str


# ============================================================
# 파일 업로드 엔드포인트
# ============================================================

@router.post("/upload")
async def upload_res(request: Request, file: UploadFile = File(...), folder_path: str = Form(None)):
    """파일 업로드"""
    try:
        return await upload_files(request, file, folder_path)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ============================================================
# 폴더 관리 엔드포인트
# ============================================================

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


# ============================================================
# 파일/폴더 이름 변경 엔드포인트
# ============================================================

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
        if 'new_path' in locals() and os.path.exists(new_path):
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


# ============================================================
# 파일 삭제 및 조회 엔드포인트
# ============================================================

@router.delete("/remove")
def remove_file(path: str = Query(..., description="삭제할 파일 경로")):
    """파일 삭제"""
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


@router.get("/files")
async def get_files(request: Request):
    """파일 목록 조회"""
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
