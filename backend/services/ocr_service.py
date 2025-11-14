"""
PDF OCR 처리 서비스
PaddleOCRVL을 사용하여 PDF에서 텍스트 추출
"""
import os
import gc
from pathlib import Path
import json

try:
    from paddleocr import PaddleOCRVL
    import paddle
    from pdf2image import convert_from_path
    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False
    print("⚠️ PaddleOCR not available. OCR features will be disabled.")

# Export alias for compatibility with test_services.py
OCR_AVAILABLE = PADDLEOCR_AVAILABLE

from tempfile import NamedTemporaryFile


# PaddleOCRVL 설정
PADDLEOCR_CONFIG = {
    "use_doc_orientation_classify": False,
    "use_doc_unwarping": False,
    "use_layout_detection": False,
    "use_chart_recognition": False,
    "device": "gpu:0" if PADDLEOCR_AVAILABLE else "cpu",
}

PDF_DPI = 100


class OCRService:
    """PDF OCR 처리를 담당하는 서비스 클래스 - Lazy loading으로 VRAM 효율적 사용"""

    def __init__(self):
        """초기화 - 모델은 실제 사용 시 로드"""
        self.pipeline = None
        self._is_loaded = False

    def __enter__(self):
        """Context manager 진입"""
        self._ensure_loaded()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager 종료 - 메모리 해제"""
        self.cleanup()
        return False

    def _ensure_loaded(self):
        """모델이 로드되지 않았으면 로드"""
        if not self._is_loaded and PADDLEOCR_AVAILABLE:
            print(f"Loading PaddleOCR-VL model...")
            self.pipeline = PaddleOCRVL(**PADDLEOCR_CONFIG)
            self._is_loaded = True
            print(f"✓ PaddleOCR-VL loaded successfully")

    def cleanup(self):
        """모델 언로드 및 메모리 해제"""
        if self._is_loaded:
            print(f"🧹 Cleaning up PaddleOCR-VL model...")

            if self.pipeline is not None:
                del self.pipeline
                self.pipeline = None

            # GPU 메모리 해제
            if PADDLEOCR_AVAILABLE:
                import paddle
                paddle.device.cuda.empty_cache()

            # Python 가비지 컬렉션
            gc.collect()

            self._is_loaded = False
            print(f"✓ PaddleOCR-VL cleaned up")

    def extract_text_from_pdf(self, pdf_path: str) -> tuple:
        """PDF에서 텍스트만 추출합니다.

        Args:
            pdf_path: PDF 파일 경로

        Returns:
            tuple[str, list[dict]]: (전체 텍스트, 페이지별 데이터)
        """
        # 모델이 로드되지 않았으면 로드
        self._ensure_loaded()

        if not PADDLEOCR_AVAILABLE or self.pipeline is None:
            return "OCR not available", []

        # PDF를 이미지로 변환
        images = convert_from_path(pdf_path, dpi=PDF_DPI)

        full_text = ""
        page_data = []

        # 이미지를 한 장씩 처리 (메모리 제어)
        for page_num, image in enumerate(images, 1):
            # 임시 이미지 파일로 저장
            with NamedTemporaryFile(delete=False, suffix=".png") as tmp_img:
                image.save(tmp_img.name)
                temp_img_path = tmp_img.name

            try:
                # 이미지 한 장만 처리
                output = self.pipeline.predict(
                    input=temp_img_path,
                    use_queues=False
                )

                # 결과 추출
                for res in output:
                    md_info = res.markdown
                    page_text = md_info.get('markdown_texts', '')

                    # 전체 텍스트에 추가
                    full_text += f"[Page {page_num}]\n{page_text}\n\n"

                    # 페이지 데이터 저장
                    page_data.append({
                        "page": page_num,
                        "text": page_text
                    })

                # GPU 메모리 즉시 정리
                if PADDLEOCR_AVAILABLE:
                    paddle.device.cuda.empty_cache()
                gc.collect()

            finally:
                # 임시 이미지 파일 삭제
                if os.path.exists(temp_img_path):
                    os.remove(temp_img_path)

        return full_text, page_data


# 헬퍼 함수 - 간편한 사용을 위한 래퍼
def get_ocr_service():
    """OCRService 인스턴스를 반환 (context manager 사용 권장)"""
    return OCRService()
