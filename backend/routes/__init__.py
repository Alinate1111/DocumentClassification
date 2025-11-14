"""
API 라우트 모듈
"""
from .auth import auth_router
from .documents import router as documents_router

__all__ = ['auth_router', 'documents_router']
