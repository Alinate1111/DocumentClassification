"""
Core module - 핵심 설정 및 데이터베이스 연결
"""
from .config import *
from .db_conn import db_pool

__all__ = ['db_pool']
