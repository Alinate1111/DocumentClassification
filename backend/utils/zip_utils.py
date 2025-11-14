import zipfile, os
from core.db_conn import db_pool
from datetime import datetime
from PyPDF2 import PdfReader

def fix_zip_filename(name: str) -> str:
    """ZIP 내부 한글 파일명 복원"""
    try:
        if any('\uac00' <= ch <= '\ud7a3' for ch in name):
            return name
        try:
            return name.encode('cp437').decode('utf-8')
        except UnicodeDecodeError:
            return name.encode('cp437').decode('cp949')
    except Exception:
        return name


def extract_zip(zip_path: str, zip_filename: str) -> int:
    added = 0
    zip_root = os.path.splitext(zip_filename)[0]
    extract_dir = os.path.join("uploads", zip_root)  # ZIP 해제 폴더
    os.makedirs(extract_dir, exist_ok=True)

    conn = db_pool.get_conn()
    cursor = conn.cursor()

    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            for info in z.infolist():
                if info.is_dir() or not info.filename.lower().endswith(".pdf"):
                    continue

                fixed = fix_zip_filename(info.filename).replace("\\", "/")
                zip_path_any = fixed # 이건 그현재 경로 가져오는거 
                filename = os.path.basename(fixed)  # 경로 없이 파일명만
                new_path = os.path.join(extract_dir, filename)  # 실제 저장될 경로

                # ZIP에서 PDF를 추출 (이제 실제로 파일이 생김)
                with z.open(info) as src, open(new_path, "wb") as dst:
                    dst.write(src.read())

                # 파일 크기 계산 (이제 실제 존재함!)
                size = round(os.path.getsize(new_path) / (1024 * 1024),4)
                reader = PdfReader(new_path)
                
                
                


                # 중복 확인
                cursor.execute("SELECT 1 FROM pdf_documents WHERE filename = %s", (new_path,))
                if cursor.fetchone():
                    continue
      
                # DB 삽입
                cursor.execute("""
                    INSERT INTO pdf_documents (page_count,filename, status, file_size, created_at, updated_at)
                    VALUES (%s,%s, %s, %s, %s, %s)
                """, (len(reader.pages),zip_path_any, 'uploaded', size, datetime.now(), datetime.now()))

                added += 1
                
        conn.commit()
        return added

    except Exception as e:
        conn.rollback()
        print("ZIP 처리 오류:", e)
        raise e

    finally:
        cursor.close()
        db_pool.release_conn(conn)