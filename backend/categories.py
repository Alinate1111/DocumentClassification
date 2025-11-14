import os
import json
import time
from datetime import datetime
from fastapi import APIRouter, Request
from core.db_conn import db_pool


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
# Category Routes
# ============================================================

router = APIRouter(prefix="/api")


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
                    example_format = '{"category": "기관명"}'
                elif level == 2:
                    level_instruction = """2단계 구조로 반환하세요.
- category와 subcategory 필드만 반드시 포함하세요
- detail, subdetail 필드를 절대 포함하지 마세요"""
                    example_format = '{"category": "기관명", "subcategory": "문서유형"}'
                elif level == 3:
                    level_instruction = """3단계 구조로 반환하세요.
- category, subcategory, detail 필드를 반드시 모두 포함하세요
- subdetail 필드를 절대 포함하지 마세요
- 각 단계별로 구체적인 분류를 작성하세요"""
                    example_format = '{"category": "기관명", "subcategory": "문서유형", "detail": "상세분류"}'
                else:
                    level_instruction = """4단계 구조로 반환하세요.
- category, subcategory, detail, subdetail 필드를 반드시 모두 포함하세요
- 각 단계별로 구체적인 분류를 작성하세요"""
                    example_format = '{"category": "기관명", "subcategory": "문서유형", "detail": "상세분류", "subdetail": "세부항목"}'

                # 파일명에서 힌트 추출
                file_name = doc['file_path'].split('/')[-1]

                # Gemma3 프롬프트 생성
                prompt = f"""다음은 국회 문서입니다. 파일명과 문서 내용을 분석하여 적절한 카테고리로 분류해주세요.

파일명: {file_name}
문서 내용:
{doc['text'][:800]}

요구사항:
1. category는 문서를 작성한 기관명입니다 (예: 교육위원회, 의사국 의안과, 법제사법위원회 등)
2. subcategory는 문서의 유형입니다 (예: 검토보고서, 심사보고서, 의안원문 등)
3. 파일명과 문서 내용을 종합적으로 분석하여 정확하게 분류하세요
4. {level_instruction}
5. 응답은 반드시 아래 JSON 형식으로만 작성하세요 (다른 설명 없이):

형식: {example_format}

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
