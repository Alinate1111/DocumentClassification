from fastapi import APIRouter, UploadFile, File, Query,Form
from utils.zip_utils import extract_zip
from core.db_conn import db_pool
import shutil, os
from datetime import datetime
from fastapi.responses import JSONResponse

router = APIRouter()

async def get_files():
    conn = db_pool.get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT *
            FROM pdf_documents p
            LEFT JOIN member_info m ON p.member_id = m.member_id
            ORDER BY p.created_at DESC
        """)
        rows = cur.fetchall()

        # 프론트는 file.filepath를 참조하므로 key 이름을 맞춰줍니다.
        return [{
            "doc_id": row[0],
            "filename": row[1],
            "upload_date": row[2],
            "file_size": row[3],
            "page_count": row[4],
            "status": row[5],
            "created_at": row[6],
            "updated_at": row[7],
            "member_id": row[8],
            "member_name": row[9],
            "member_email": row[10]
                 } for row in rows]
    except Exception as e:
        return {"error": str(e)}
    finally:
        cur.close()
        db_pool.release_conn(conn)
