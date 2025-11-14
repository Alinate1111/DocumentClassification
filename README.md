# 프로젝트 설정 가이드

OCR 기반 문서 자동 분류 시스템 설정 가이드입니다.

## 📋 목차

1. [사전 요구사항](#사전-요구사항)
2. [데이터베이스 설정](#데이터베이스-설정)
3. [백엔드 설정](#백엔드-설정)
4. [프론트엔드 설정](#프론트엔드-설정)
5. [OCR 및 AI 모델 설정](#ocr-및-ai-모델-설정)
6. [실행](#실행)

## 사전 요구사항

### 필수 설치

- **Python 3.9+**
- **Node.js 18+**
- **PostgreSQL 14+**

### 선택 설치 (OCR/AI 기능 사용 시)

- **CUDA 11.8+** (GPU 사용 시)
- **8GB+ GPU** (PaddleOCR 사용 시 권장)

## 데이터베이스 설정

### 1. PostgreSQL 데이터베이스 생성

```bash
# PostgreSQL 접속
psql -U postgres

# 데이터베이스 생성 (이미 있다면 생략)
CREATE DATABASE postgres;
```

### 2. 스키마 생성

```bash
# Readme.md의 SQL 스크립트 실행
psql -U postgres -d postgres -f Readme.md
```

### 3. OCR 컬럼 추가

```bash
# OCR 컬럼 추가
psql -U postgres -d postgres -f backend/add_ocr_column.sql
```

### 4. 데이터베이스 연결 정보 확인

`backend/db_conn.py` 파일에서 DB 연결 정보 확인:

```python
dbname="postgres"
user="postgres"
password="1234"
host="localhost"
port="5432"
```

## 백엔드 설정

### 1. 가상환경 생성 및 활성화

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. 필수 패키지 설치

```bash
pip install fastapi uvicorn sqlalchemy psycopg2-binary
pip install PyPDF2 passlib[bcrypt]==1.7.4 bcrypt==4.0.1
pip install python-multipart itsdangerous
```

### 3. OCR 기능 설치 (선택사항)

**⚠️ GPU(필수)의 경우 (최소 vram 8GB):**

```bash
# PaddlePaddle GPU 버전 - https://www.paddlepaddle.org.cn/install/quick?docurl=/documentation/docs/zh/develop/install/pip/windows-pip.html (이 사이트에서 자신 컴퓨팅에 맞는 paddle paddle을 설치)
python -m pip install paddlepaddle-gpu==3.2.1 -i https://www.paddlepaddle.org.cn/packages/stable/cu126/

# PaddleOCR
python -m pip install -U "paddleocr[doc-parser]"

# PaddleOCR VL
# For Linux systems, run:
python -m pip install https://paddle-whl.bj.bcebos.com/nightly/cu126/safetensors/safetensors-0.6.2.dev0-cp38-abi3-linux_x86_64.whl
# For Windows systems, run:
python -m pip install https://xly-devops.cdn.bcebos.com/safetensors-nightly/safetensors-0.6.2.dev0-cp38-abi3-win_amd64.whl

# PDF to Image
pip install pdf2image Pillow
```


### 4. BERT 분류 모델 설치 (선택사항)

```bash
pip install torch>=2.0.0
pip install transformers>=4.30.0
pip install numpy
```

**Note:** OCR/BERT 모델을 설치하지 않아도 다른 기능은 정상 작동합니다.

## 프론트엔드 설정

### 1. 의존성 설치

```bash
cd front
npm install
```

### 2. Vite 포트 확인

기본적으로 Vite는 `http://localhost:5173`에서 실행됩니다.

## OCR 및 AI 모델 설정

### 1. BERT 모델 위치 확인

`backend/twotask_bert_model/` 디렉토리에 다음 파일이 있어야 합니다:

```
twotask_bert_model/
├── model.pt
├── config.json
├── label_mappings.json
├── tokenizer_config.json
├── vocab.txt
└── ...
```

### 2. 모델 경로 설정

`backend/classification_service.py`에서 모델 경로가 올바른지 확인:

```python
model_dir = os.path.join(os.path.dirname(__file__), "twotask_bert_model")
```

## 실행

### 1. 데이터베이스 시작

```bash
# PostgreSQL 서비스 시작 (Windows)
# 서비스 관리자에서 PostgreSQL 시작

# Linux
sudo systemctl start postgresql
```

### 2. 백엔드 시작

```bash
cd backend
python app.py

# 또는
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

백엔드가 `http://localhost:8000`에서 실행됩니다.

### 3. 프론트엔드 시작

```bash
cd front
npm run dev
```

프론트엔드가 `http://localhost:5173`에서 실행됩니다.

### 4. 접속

브라우저에서 `http://localhost:5173` 접속

## API 엔드포인트

### 인증 (Prefix 없음)

- `POST /login` - 로그인
- `GET /logout` - 로그아웃
- `POST /member/add` - 회원가입
- `GET /member/me` - 내 정보 조회
- `GET /member/count` - 전체 회원 수

### 문서 관리 (`/api` prefix)

- `POST /api/upload` - 파일 업로드
- `GET /api/files` - 파일 목록 조회
- `DELETE /api/remove` - 파일 삭제

### OCR 처리 (`/api` prefix)

- `POST /api/ocr/process` - OCR 처리 실행
- `POST /api/ocrcompleted` - OCR 완료 상태 업데이트

### 문서 분류 (`/api` prefix)

- `POST /api/classify/document` - 문서 자동 분류
- `GET /api/classification/{doc_id}` - 분류 결과 조회

## 문제 해결

### OCR이 작동하지 않음

1. PaddleOCR이 설치되어 있는지 확인
2. GPU 메모리 부족 시 `ocr_service.py`의 `PDF_DPI`를 낮춤 (100 → 72)

### BERT 분류가 작동하지 않음

1. `twotask_bert_model` 디렉토리가 있는지 확인
2. `torch`와 `transformers`가 설치되어 있는지 확인
3. `2_train_2task_bert.py` 파일이 `backend/backend/` 폴더에 있는지 확인

### API 연결 오류

1. 백엔드가 8000 포트에서 실행 중인지 확인
2. CORS 설정 확인 (`app.py`)
3. 프론트엔드 API 호출 URL 확인

## 테스트

### 1. 회원가입 및 로그인

1. 브라우저에서 회원가입
2. 로그인

### 2. 파일 업로드

1. PDF 파일 업로드
2. 파일 목록에서 확인

### 3. OCR 처리

1. 업로드된 파일 선택
2. "OCR 처리 시작" 클릭
3. 진행 상태 확인

### 4. 문서 분류

OCR 처리 완료 후 자동으로 분류가 실행됩니다.

## 주의사항

- **OCR/BERT 모델은 선택사항**입니다. 설치하지 않아도 기본 기능은 작동합니다.
- GPU 메모리가 부족할 경우 OCR DPI를 낮추세요.
- 프로덕션 환경에서는 `app.py`의 `secret_key`를 환경변수로 관리하세요.



## 빠진내용들

- 만약 설명이 부족하여 패키지 인스톨 오류가 뜬다면 별다른 버젼 설정없이 없다고 오류 알람이 뜬 라이브러리들은 그대로 설치해도 문제가 없습니다.