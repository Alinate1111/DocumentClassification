# Gemma vs BERT 모델 성능 평가 가이드

## 📋 개요

Gemma (LLM) 모델과 BERT (2-Task) 모델의 문서 분류 성능을 비교하는 평가 도구입니다.

### 평가 항목
- **Accuracy** (정확도): 전체 예측 중 정답 비율
- **Precision** (정밀도): 양성으로 예측한 것 중 실제 양성 비율
- **Recall** (재현율): 실제 양성 중 양성으로 예측한 비율
- **F1-score**: Precision과 Recall의 조화 평균
- **처리 속도**: 샘플당 평균 처리 시간

---

## 🚀 사용 방법

### 1. 필요한 패키지 설치

```bash
pip install scikit-learn matplotlib numpy requests
```

### 2. 데이터 준비

- `train.json` 파일이 backend 폴더에 있어야 합니다.
- 각 샘플은 다음 형식이어야 합니다:

```json
{
  "text": "문서 내용...",
  "기관": "기관명",
  "문서유형": "문서유형"
}
```

### 3. 모델 평가 실행

#### (1) BERT 모델만 평가

```bash
cd backend
python evaluate_models.py
```

기본 설정에서는 BERT만 평가합니다 (50개 샘플).

#### (2) Gemma 모델만 평가

`evaluate_models.py` 파일의 마지막 줄을 수정:

```python
evaluator.run_evaluation(eval_bert=False, eval_gemma=True)
```

#### (3) 두 모델 모두 평가

```python
evaluator.run_evaluation(eval_bert=True, eval_gemma=True)
```

#### (4) 전체 데이터셋으로 평가

```python
evaluator = ModelEvaluator(
    test_data_path='train.json',
    sample_size=None  # 전체 데이터 사용
)
```

### 4. 결과 시각화

평가가 완료되면 `evaluation_results.json` 파일이 생성됩니다.

```bash
python visualize_results.py
```

**생성되는 파일:**
- `accuracy_comparison.png` - 정확도 비교 막대 그래프
- `metrics_comparison.png` - Precision/Recall/F1 비교
- `speed_comparison.png` - 처리 속도 비교
- `comparison_table.txt` - 성능 비교 테이블

---

## 📊 출력 예시

### 콘솔 출력

```
================================================================================
📊 모델 성능 비교 결과
================================================================================

🤖 BERT 모델 성능
--------------------------------------------------------------------------------
  [기관 분류]
    - Accuracy:  0.9200 (92.00%)
    - Precision: 0.9150
    - Recall:    0.9180
    - F1-score:  0.9165
  [문서유형 분류]
    - Accuracy:  0.8800 (88.00%)
    - Precision: 0.8750
    - Recall:    0.8720
    - F1-score:  0.8735
  [전체]
    - Overall Accuracy: 0.9000 (90.00%)
    - 처리 시간: 125.50초
    - 평균 처리 시간: 2.51초/샘플
    - 오류 수: 2개

🤖 Gemma 모델 성능
--------------------------------------------------------------------------------
  [기관 분류]
    - Accuracy:  0.8600 (86.00%)
    - Precision: 0.8550
    - Recall:    0.8580
    - F1-score:  0.8565
  [문서유형 분류]
    - Accuracy:  0.8200 (82.00%)
    - Precision: 0.8150
    - Recall:    0.8120
    - F1-score:  0.8135
  [전체]
    - Overall Accuracy: 0.8400 (84.00%)
    - 처리 시간: 450.20초
    - 평균 처리 시간: 9.00초/샘플
    - 오류 수: 5개

📈 모델 비교
--------------------------------------------------------------------------------
  [정확도 비교]
    - BERT Overall Accuracy:  0.9000
    - Gemma Overall Accuracy: 0.8400
    ✅ BERT가 6.00% 더 높음
  [속도 비교]
    - BERT 평균 처리 시간:  2.51초/샘플
    - Gemma 평균 처리 시간: 9.00초/샘플
    ✅ BERT가 3.59배 빠름
```

---

## 🔧 고급 설정

### API 엔드포인트 변경

#### BERT API 변경

`evaluate_models.py`의 `evaluate_bert_model()` 함수에서:

```python
response = requests.post(
    'http://localhost:8000/api/classify/document',  # ← 여기 수정
    json={'text': sample['text']},
    timeout=30
)
```

#### Gemma API 변경

`evaluate_models.py`의 `evaluate_gemma_model()` 함수에서:

```python
response = requests.post(
    'http://localhost:11434/api/generate',  # ← 여기 수정
    json={
        'model': 'gemma2',  # ← 모델명 수정
        'prompt': prompt,
        'stream': False,
        'format': 'json'
    },
    timeout=60
)
```

### 평가 샘플 수 조정

```python
evaluator = ModelEvaluator(
    test_data_path='train.json',
    sample_size=100  # 100개 샘플만 평가
)
```

---

## 📁 파일 구조

```
backend/
├── train.json                    # 평가 데이터셋
├── evaluate_models.py            # 모델 평가 스크립트
├── visualize_results.py          # 시각화 스크립트
├── evaluation_results.json       # 평가 결과 (생성됨)
├── accuracy_comparison.png       # 그래프 (생성됨)
├── metrics_comparison.png        # 그래프 (생성됨)
├── speed_comparison.png          # 그래프 (생성됨)
└── comparison_table.txt          # 테이블 (생성됨)
```

---

## ⚠️ 주의사항

### BERT 평가 시
- FastAPI 서버가 실행 중이어야 함 (`python app.py`)
- `/api/classify/document` 엔드포인트가 동작해야 함

### Gemma 평가 시
- Ollama 서버가 실행 중이어야 함
- `gemma2` 모델이 설치되어 있어야 함
- 메모리가 충분해야 함 (최소 8GB 권장)

### 네트워크
- API 호출 시간이 길 수 있으므로 timeout 설정 확인
- 대용량 데이터 평가 시 시간이 오래 걸릴 수 있음

---

## 🎨 PPT에 사용하기

### 1. 그래프 삽입
- `accuracy_comparison.png` - 메인 슬라이드
- `metrics_comparison.png` - 세부 분석 슬라이드
- `speed_comparison.png` - 성능 비교 슬라이드

### 2. 테이블 삽입
- `comparison_table.txt` 내용을 복사하여 PPT 표로 변환

### 3. 결론 요약
```
✅ BERT 모델
  - 정확도: 90% (Gemma 대비 +6%)
  - 처리 속도: 3.6배 빠름
  - 안정성: 오류 적음

⚠️ Gemma 모델
  - 정확도: 84%
  - 처리 속도: 느림
  - 장점: 추가 학습 없이 즉시 사용 가능
```

---

## 🐛 문제 해결

### "Connection refused" 오류
→ BERT 서버나 Gemma(Ollama) 서버가 실행 중인지 확인

### "Timeout" 오류
→ `evaluate_models.py`에서 timeout 값 증가

```python
response = requests.post(..., timeout=120)  # 60 → 120
```

### "No module named 'sklearn'" 오류
→ scikit-learn 설치

```bash
pip install scikit-learn
```

### 한글 폰트 깨짐
→ `visualize_results.py`의 폰트 설정 변경

```python
matplotlib.rcParams['font.family'] = 'NanumGothic'  # 또는 다른 한글 폰트
```

---

## 📞 문의

문제가 발생하면 평가 로그와 함께 문의해주세요!
