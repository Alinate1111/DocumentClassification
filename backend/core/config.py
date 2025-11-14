"""
애플리케이션 설정 모듈
환경 변수를 통해 설정 값을 관리합니다.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# .env 파일 로드 (UTF-8 인코딩 명시)
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path, encoding='utf-8')
else:
    print(f"⚠️  .env 파일을 찾을 수 없습니다: {env_path}")
    print(f"⚠️  기본 설정값을 사용합니다.")

# 데이터베이스 설정
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_NAME = os.getenv('DB_NAME', 'postgres')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'your_password')

# 세션 설정
SESSION_SECRET_KEY = os.getenv('SESSION_SECRET_KEY', 'your_super_secret_key_change_this_in_production')
SESSION_MAX_AGE = int(os.getenv('SESSION_MAX_AGE', 3600))

# CORS 설정
CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',')

# 서버 설정
HOST = os.getenv('SERVER_HOST', '127.0.0.1')
PORT = int(os.getenv('SERVER_PORT', 8000))
DEBUG_MODE = os.getenv('DEBUG_MODE', 'True').lower() == 'true'

# 파일 업로드 설정
UPLOAD_DIR = os.getenv('UPLOAD_DIR', './upload')
MAX_FILE_SIZE_MB = int(os.getenv('MAX_FILE_SIZE_MB', 50))