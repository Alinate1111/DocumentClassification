from fastapi import APIRouter
from core.db_conn import db_pool


# ============================================================
# Statistics Routes
# ============================================================

router = APIRouter(prefix="/api")


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
