from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

# 라우트 모듈 import
from routes.auth import auth_router
from routes.documents import router as documents_router
from ocr import router as ocr_router
from classification import router as classification_router
from categories import router as categories_router
from history import router as history_router
from statistics import router as statistics_router

app = FastAPI(title="OCR Document Classification API")

# 설정 불러오기
from core.config import SESSION_SECRET_KEY, SESSION_MAX_AGE, CORS_ORIGINS, HOST, PORT, DEBUG_MODE

# ✅ 세션 설정
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    max_age=SESSION_MAX_AGE,
    same_site="lax",
    https_only=False,      # 🔹 HTTPS 사용 시 True로 변경
)

# ✅ CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,  # 자격 증명 허용
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ 라우터 등록
app.include_router(auth_router)           # 인증 관련 경로 (prefix 없음)
app.include_router(documents_router)      # 문서/파일 관리 (/api/*)
app.include_router(ocr_router)            # OCR 처리 (/api/ocr/*)
app.include_router(classification_router) # 문서 분류 (/api/classify/*, /api/classification/*)
app.include_router(categories_router)     # 카테고리 관리 (/api/category/*)
app.include_router(history_router)        # 히스토리 (/api/history/*)
app.include_router(statistics_router)     # 통계 (/api/statistics/*)


# ✅ 메인 실행
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)
