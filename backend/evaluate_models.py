"""
Gemma 모델 vs BERT 모델 성능 비교 스크립트
- Gemma: LLM 기반 카테고리 자동 생성/분류
- BERT: 2-Task BERT 문서 분류 (기관 + 문서유형)
"""
import json
import time
import requests
from datetime import datetime
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report, confusion_matrix
import numpy as np
from collections import defaultdict
import editdistance  # CER 계산용
import unicodedata  # 유니코드 정규화용

# WER/PER 계산용 (선택적 import)
try:
    from jiwer import wer as calculate_wer_jiwer
    WER_AVAILABLE = True
except ImportError:
    WER_AVAILABLE = False
    print("⚠️ jiwer not installed. WER calculation will be skipped.")

# PER 계산용 - g2pk2는 eunjeon 의존성이 필요함
try:
    from g2pk2 import G2p
    try:
        g2p = G2p()
        PER_AVAILABLE = True
        print("✅ g2pk2 (PER) 초기화 성공")
    except Exception as e:
        # eunjeon 미설치 등의 초기화 오류
        PER_AVAILABLE = False
        g2p = None
        error_msg = str(e)
        if 'eunjeon' in error_msg or 'mecab' in error_msg.lower():
            print("⚠️ PER 계산을 위해서는 eunjeon 설치가 필요합니다: pip install eunjeon")
        else:
            print(f"⚠️ g2pk2 초기화 실패: {error_msg}")
except ImportError:
    PER_AVAILABLE = False
    g2p = None
    print("⚠️ g2pk2 not installed. PER calculation will be skipped.")


class ModelEvaluator:
    def __init__(self, test_data_path='training_recommended.json', sample_size=100):
        """
        Args:
            test_data_path: 테스트 데이터 경로
            sample_size: 평가할 샘플 수 (None이면 전체)
        """
        self.test_data_path = test_data_path
        self.sample_size = sample_size
        self.test_data = []
        self.results = {
            'gemma': {'predictions': [], 'ground_truth': [], 'time': 0, 'errors': []},
            'bert': {'predictions': [], 'ground_truth': [], 'time': 0, 'errors': []}
        }

    def load_data(self):
        """JSON 데이터 로드"""
        print(f"\n{'='*60}")
        print(f"📁 데이터 로딩 중: {self.test_data_path}")

        with open(self.test_data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 샘플 추출
        if self.sample_size and self.sample_size < len(data):
            import random
            random.seed(42)
            self.test_data = random.sample(data, self.sample_size)
        else:
            self.test_data = data

        print(f"✅ 데이터 로드 완료: {len(self.test_data)}개 샘플")
        print(f"{'='*60}\n")

        return self.test_data

    def evaluate_bert_model(self):
        """BERT 모델 평가"""
        print(f"\n{'='*60}")
        print(f"🤖 BERT 모델 평가 시작")
        print(f"{'='*60}")

        start_time = time.time()

        for idx, sample in enumerate(self.test_data):
            try:
                # 텍스트 추출 (conversations 형식)
                text = sample['conversations'][0]['content'][0]['text']

                # BERT API 호출 (평가용 엔드포인트 사용, form-data로 전송)
                response = requests.post(
                    'http://localhost:8000/api/classify/text',
                    data={'text': text},  # form-data로 전송
                    timeout=30
                )

                if response.status_code == 200:
                    result = response.json()

                    # 예측값 저장
                    pred_agency = result.get('agency', 'UNKNOWN')
                    pred_doc_type = result.get('document_type', 'UNKNOWN')

                    # Ground truth (metadata에서 추출)
                    categories = sample.get('metadata', {}).get('categories', {})
                    true_agency = categories.get('기관', 'UNKNOWN')
                    true_doc_type = categories.get('문서유형', 'UNKNOWN')

                    self.results['bert']['predictions'].append({
                        'agency': pred_agency,
                        'document_type': pred_doc_type
                    })
                    self.results['bert']['ground_truth'].append({
                        'agency': true_agency,
                        'document_type': true_doc_type
                    })

                    if (idx + 1) % 10 == 0:
                        print(f"   진행률: {idx + 1}/{len(self.test_data)} ({(idx+1)/len(self.test_data)*100:.1f}%)")
                else:
                    print(f"   ❌ 오류 (샘플 {idx}): HTTP {response.status_code}")
                    self.results['bert']['errors'].append(idx)

            except Exception as e:
                print(f"   ❌ 예외 발생 (샘플 {idx}): {str(e)}")
                self.results['bert']['errors'].append(idx)

        self.results['bert']['time'] = time.time() - start_time
        print(f"\n✅ BERT 평가 완료!")
        print(f"   총 소요시간: {self.results['bert']['time']:.2f}초")
        print(f"   평균 처리시간: {self.results['bert']['time']/len(self.test_data):.2f}초/샘플")

    def evaluate_gemma_model(self):
        """Gemma 모델 평가 (LLM 기반 분류)"""
        print(f"\n{'='*60}")
        print(f"🤖 Gemma 모델 평가 시작")
        print(f"{'='*60}")

        start_time = time.time()

        for idx, sample in enumerate(self.test_data):
            try:
                # 텍스트 추출 (conversations 형식)
                text = sample['conversations'][0]['content'][0]['text']

                # Gemma API 호출 (가정: Ollama 서버 사용)
                prompt = f"""다음 문서를 분석하여 '기관'과 '문서유형'을 분류해주세요.

문서 내용:
{text[:1000]}

출력 형식 (JSON):
{{"기관": "...", "문서유형": "..."}}
"""

                response = requests.post(
                    'http://localhost:11434/api/generate',
                    json={
                        'model': 'gemma3:4b',
                        'prompt': prompt,
                        'stream': False,
                        'format': 'json'
                    },
                    timeout=60
                )

                if response.status_code == 200:
                    result = response.json()
                    response_text = result.get('response', '{}')

                    try:
                        parsed = json.loads(response_text)
                        pred_agency = parsed.get('기관', 'UNKNOWN')
                        pred_doc_type = parsed.get('문서유형', 'UNKNOWN')
                    except:
                        pred_agency = 'UNKNOWN'
                        pred_doc_type = 'UNKNOWN'

                    # Ground truth (metadata에서 추출)
                    categories = sample.get('metadata', {}).get('categories', {})
                    true_agency = categories.get('기관', 'UNKNOWN')
                    true_doc_type = categories.get('문서유형', 'UNKNOWN')

                    self.results['gemma']['predictions'].append({
                        'agency': pred_agency,
                        'document_type': pred_doc_type
                    })
                    self.results['gemma']['ground_truth'].append({
                        'agency': true_agency,
                        'document_type': true_doc_type
                    })

                    if (idx + 1) % 10 == 0:
                        print(f"   진행률: {idx + 1}/{len(self.test_data)} ({(idx+1)/len(self.test_data)*100:.1f}%)")
                else:
                    print(f"   ❌ 오류 (샘플 {idx}): HTTP {response.status_code}")
                    self.results['gemma']['errors'].append(idx)

            except Exception as e:
                print(f"   ❌ 예외 발생 (샘플 {idx}): {str(e)}")
                self.results['gemma']['errors'].append(idx)

        self.results['gemma']['time'] = time.time() - start_time
        print(f"\n✅ Gemma 평가 완료!")
        print(f"   총 소요시간: {self.results['gemma']['time']:.2f}초")
        print(f"   평균 처리시간: {self.results['gemma']['time']/len(self.test_data):.2f}초/샘플")

    def calculate_cer(self, ref_list, hyp_list):
        """
        CER (Character Error Rate) 계산

        Args:
            ref_list: 정답 레이블 리스트
            hyp_list: 예측 레이블 리스트

        Returns:
            평균 CER 값 (0~1, 낮을수록 좋음)
        """
        total_cer = 0
        for ref, hyp in zip(ref_list, hyp_list):
            ref_chars = list(str(ref))
            hyp_chars = list(str(hyp))
            if len(ref_chars) == 0:
                cer = 1.0 if len(hyp_chars) > 0 else 0.0
            else:
                cer = editdistance.eval(ref_chars, hyp_chars) / len(ref_chars)
            total_cer += cer

        return total_cer / len(ref_list) if ref_list else 1.0

    def calculate_wer(self, ref_list, hyp_list):
        """
        WER (Word Error Rate) 계산 - 공백으로 단어 분리

        Args:
            ref_list: 정답 레이블 리스트
            hyp_list: 예측 레이블 리스트

        Returns:
            평균 WER 값 (0~1, 낮을수록 좋음)
        """
        if not WER_AVAILABLE:
            return None

        total_wer = 0
        valid_count = 0

        for ref, hyp in zip(ref_list, hyp_list):
            ref_str = str(ref).strip()
            hyp_str = str(hyp).strip()

            # 빈 문자열 처리
            if not ref_str:
                if hyp_str:
                    total_wer += 1.0
                valid_count += 1
                continue

            try:
                wer_val = calculate_wer_jiwer(ref_str, hyp_str)
                total_wer += wer_val
                valid_count += 1
            except:
                # WER 계산 실패 시 무시
                pass

        return total_wer / valid_count if valid_count > 0 else 1.0

    def calculate_per(self, ref_list, hyp_list):
        """
        PER (Phoneme Error Rate) 계산 - 한글 음소 단위

        Args:
            ref_list: 정답 레이블 리스트
            hyp_list: 예측 레이블 리스트

        Returns:
            평균 PER 값 (0~1, 낮을수록 좋음)
        """
        if not PER_AVAILABLE or g2p is None:
            return None

        total_per = 0
        valid_count = 0

        for ref, hyp in zip(ref_list, hyp_list):
            ref_str = str(ref).strip()
            hyp_str = str(hyp).strip()

            if not ref_str:
                if hyp_str:
                    total_per += 1.0
                valid_count += 1
                continue

            try:
                # G2P 변환 (한글 → 음소)
                ref_phonemes = list("".join(g2p(ref_str)))
                hyp_phonemes = list("".join(g2p(hyp_str)))

                if len(ref_phonemes) == 0:
                    per = 1.0 if len(hyp_phonemes) > 0 else 0.0
                else:
                    per = editdistance.eval(ref_phonemes, hyp_phonemes) / len(ref_phonemes)

                total_per += per
                valid_count += 1
            except:
                # PER 계산 실패 시 무시
                pass

        return total_per / valid_count if valid_count > 0 else 1.0

    def normalize_label(self, value):
        """레이블을 문자열로 정규화 (유니코드 정규화 포함)"""
        if value is None:
            return 'UNKNOWN'
        if isinstance(value, list):
            # 리스트인 경우 첫 번째 요소를 사용하거나 빈 리스트면 'UNKNOWN'
            value = str(value[0]) if value else 'UNKNOWN'
        elif isinstance(value, dict):
            # dict인 경우 'UNKNOWN'
            return 'UNKNOWN'
        else:
            value = str(value)

        # 유니코드 정규화 (NFC 형식으로 통일)
        # 한글의 경우 조합형/분해형 차이를 해결
        return unicodedata.normalize('NFC', value)

    def calculate_metrics(self, model_name):
        """메트릭 계산"""
        preds = self.results[model_name]['predictions']
        truths = self.results[model_name]['ground_truth']

        if not preds or not truths:
            return None

        # 기관 분류 메트릭 (데이터 정규화)
        y_true_agency = [self.normalize_label(t['agency']) for t in truths]
        y_pred_agency = [self.normalize_label(p['agency']) for p in preds]

        # 문서유형 분류 메트릭 (데이터 정규화)
        y_true_doctype = [self.normalize_label(t['document_type']) for t in truths]
        y_pred_doctype = [self.normalize_label(p['document_type']) for p in preds]

        # Exact Match Accuracy 계산
        agency_acc = accuracy_score(y_true_agency, y_pred_agency)
        doctype_acc = accuracy_score(y_true_doctype, y_pred_doctype)

        # CER 기반 유사도 계산 (1 - CER = 유사도)
        agency_cer = self.calculate_cer(y_true_agency, y_pred_agency)
        doctype_cer = self.calculate_cer(y_true_doctype, y_pred_doctype)

        agency_similarity = 1 - agency_cer
        doctype_similarity = 1 - doctype_cer

        # WER 계산 (선택적)
        agency_wer = self.calculate_wer(y_true_agency, y_pred_agency)
        doctype_wer = self.calculate_wer(y_true_doctype, y_pred_doctype)

        # PER 계산 (선택적)
        agency_per = self.calculate_per(y_true_agency, y_pred_agency)
        doctype_per = self.calculate_per(y_true_doctype, y_pred_doctype)

        # Precision, Recall, F1 계산
        agency_metrics = precision_recall_fscore_support(
            y_true_agency, y_pred_agency, average='weighted', zero_division=0
        )
        doctype_metrics = precision_recall_fscore_support(
            y_true_doctype, y_pred_doctype, average='weighted', zero_division=0
        )

        return {
            'agency': {
                'accuracy': agency_acc,
                'cer': agency_cer,
                'wer': agency_wer,
                'per': agency_per,
                'similarity': agency_similarity,
                'precision': agency_metrics[0],
                'recall': agency_metrics[1],
                'f1': agency_metrics[2]
            },
            'document_type': {
                'accuracy': doctype_acc,
                'cer': doctype_cer,
                'wer': doctype_wer,
                'per': doctype_per,
                'similarity': doctype_similarity,
                'precision': doctype_metrics[0],
                'recall': doctype_metrics[1],
                'f1': doctype_metrics[2]
            },
            'overall_accuracy': (agency_acc + doctype_acc) / 2,
            'overall_similarity': (agency_similarity + doctype_similarity) / 2,
            'overall_cer': (agency_cer + doctype_cer) / 2,
            'overall_wer': (agency_wer + doctype_wer) / 2 if agency_wer is not None and doctype_wer is not None else None,
            'overall_per': (agency_per + doctype_per) / 2 if agency_per is not None and doctype_per is not None else None,
            'processing_time': self.results[model_name]['time'],
            'avg_time_per_sample': self.results[model_name]['time'] / len(preds) if preds else 0,
            'error_count': len(self.results[model_name]['errors'])
        }

    def print_results(self):
        """결과 출력"""
        print(f"\n{'='*80}")
        print(f"📊 모델 성능 비교 결과")
        print(f"{'='*80}\n")

        # 디버깅: 매칭 통계
        print(f"🔍 매칭 통계:")
        print(f"{'-'*80}")
        for model_name in ['bert', 'gemma']:
            preds = self.results[model_name]['predictions']
            truths = self.results[model_name]['ground_truth']

            agency_matches = sum(1 for p, t in zip(preds, truths) if self.normalize_label(p['agency']) == self.normalize_label(t['agency']))
            doctype_matches = sum(1 for p, t in zip(preds, truths) if self.normalize_label(p['document_type']) == self.normalize_label(t['document_type']))
            both_matches = sum(1 for p, t in zip(preds, truths) if
                             self.normalize_label(p['agency']) == self.normalize_label(t['agency']) and
                             self.normalize_label(p['document_type']) == self.normalize_label(t['document_type']))

            print(f"\n[{model_name.upper()}] (총 {len(preds)}개)")
            print(f"  기관 일치: {agency_matches}/{len(preds)} ({agency_matches/len(preds)*100:.1f}%)")
            print(f"  문서유형 일치: {doctype_matches}/{len(preds)} ({doctype_matches/len(preds)*100:.1f}%)")
            print(f"  둘 다 일치: {both_matches}/{len(preds)} ({both_matches/len(preds)*100:.1f}%)")

        # 처음 5개 샘플 출력 + 디버깅
        print(f"\n{'='*80}")
        print(f"🔍 샘플 예측 결과 (처음 5개):")
        print(f"{'-'*80}")
        for model_name in ['bert']:  # BERT만 상세 출력
            preds = self.results[model_name]['predictions'][:5]
            truths = self.results[model_name]['ground_truth'][:5]
            print(f"\n[{model_name.upper()}]")
            for i, (pred, truth) in enumerate(zip(preds, truths)):
                p_agency = self.normalize_label(pred['agency'])
                p_doctype = self.normalize_label(pred['document_type'])
                t_agency = self.normalize_label(truth['agency'])
                t_doctype = self.normalize_label(truth['document_type'])

                match_agency = "✓" if p_agency == t_agency else "✗"
                match_doctype = "✓" if p_doctype == t_doctype else "✗"

                print(f"  샘플 {i+1}:")
                print(f"    예측 - 기관: '{p_agency}' {match_agency} | 문서유형: '{p_doctype}' {match_doctype}")
                print(f"    정답 - 기관: '{t_agency}' | 문서유형: '{t_doctype}'")

                # 첫 번째 샘플만 상세 디버깅
                if i == 0:
                    print(f"\n    🔍 디버깅 (샘플 1):")
                    print(f"      예측 기관 repr: {repr(p_agency)}")
                    print(f"      정답 기관 repr: {repr(t_agency)}")
                    print(f"      예측 기관 type: {type(p_agency)}")
                    print(f"      정답 기관 type: {type(t_agency)}")
                    print(f"      같은가? {p_agency == t_agency}")
                    print(f"      예측 원본: {repr(pred['agency'])}")
                    print(f"      정답 원본: {repr(truth['agency'])}")
        print(f"\n{'='*80}\n")

        bert_metrics = self.calculate_metrics('bert')
        gemma_metrics = self.calculate_metrics('gemma')

        # BERT 결과
        print(f"🤖 BERT 모델 성능")
        print(f"{'-'*80}")
        if bert_metrics:
            print(f"  [기관 분류]")
            print(f"    - Exact Match Accuracy: {bert_metrics['agency']['accuracy']:.4f} ({bert_metrics['agency']['accuracy']*100:.2f}%)")
            print(f"    - CER (낮을수록 좋음):  {bert_metrics['agency']['cer']:.4f}")
            if bert_metrics['agency']['wer'] is not None:
                print(f"    - WER (낮을수록 좋음):  {bert_metrics['agency']['wer']:.4f}")
            if bert_metrics['agency']['per'] is not None:
                print(f"    - PER (낮을수록 좋음):  {bert_metrics['agency']['per']:.4f}")
            print(f"    - Similarity (유사도):  {bert_metrics['agency']['similarity']:.4f} ({bert_metrics['agency']['similarity']*100:.2f}%)")
            print(f"    - Precision: {bert_metrics['agency']['precision']:.4f}")
            print(f"    - Recall:    {bert_metrics['agency']['recall']:.4f}")
            print(f"    - F1-score:  {bert_metrics['agency']['f1']:.4f}")
            print(f"  [문서유형 분류]")
            print(f"    - Exact Match Accuracy: {bert_metrics['document_type']['accuracy']:.4f} ({bert_metrics['document_type']['accuracy']*100:.2f}%)")
            print(f"    - CER (낮을수록 좋음):  {bert_metrics['document_type']['cer']:.4f}")
            if bert_metrics['document_type']['wer'] is not None:
                print(f"    - WER (낮을수록 좋음):  {bert_metrics['document_type']['wer']:.4f}")
            if bert_metrics['document_type']['per'] is not None:
                print(f"    - PER (낮을수록 좋음):  {bert_metrics['document_type']['per']:.4f}")
            print(f"    - Similarity (유사도):  {bert_metrics['document_type']['similarity']:.4f} ({bert_metrics['document_type']['similarity']*100:.2f}%)")
            print(f"    - Precision: {bert_metrics['document_type']['precision']:.4f}")
            print(f"    - Recall:    {bert_metrics['document_type']['recall']:.4f}")
            print(f"    - F1-score:  {bert_metrics['document_type']['f1']:.4f}")
            print(f"  [전체]")
            print(f"    - Overall Accuracy: {bert_metrics['overall_accuracy']:.4f} ({bert_metrics['overall_accuracy']*100:.2f}%)")
            print(f"    - Overall Similarity: {bert_metrics['overall_similarity']:.4f} ({bert_metrics['overall_similarity']*100:.2f}%)")
            print(f"    - Overall CER: {bert_metrics['overall_cer']:.4f}")
            if bert_metrics['overall_wer'] is not None:
                print(f"    - Overall WER: {bert_metrics['overall_wer']:.4f}")
            if bert_metrics['overall_per'] is not None:
                print(f"    - Overall PER: {bert_metrics['overall_per']:.4f}")
            print(f"    - 처리 시간: {bert_metrics['processing_time']:.2f}초")
            print(f"    - 평균 처리 시간: {bert_metrics['avg_time_per_sample']:.2f}초/샘플")
            print(f"    - 오류 수: {bert_metrics['error_count']}개\n")
        else:
            print(f"  ❌ 평가 결과 없음\n")

        # Gemma 결과
        print(f"🤖 Gemma 모델 성능")
        print(f"{'-'*80}")
        if gemma_metrics:
            print(f"  [기관 분류]")
            print(f"    - Exact Match Accuracy: {gemma_metrics['agency']['accuracy']:.4f} ({gemma_metrics['agency']['accuracy']*100:.2f}%)")
            print(f"    - CER (낮을수록 좋음):  {gemma_metrics['agency']['cer']:.4f}")
            if gemma_metrics['agency']['wer'] is not None:
                print(f"    - WER (낮을수록 좋음):  {gemma_metrics['agency']['wer']:.4f}")
            if gemma_metrics['agency']['per'] is not None:
                print(f"    - PER (낮을수록 좋음):  {gemma_metrics['agency']['per']:.4f}")
            print(f"    - Similarity (유사도):  {gemma_metrics['agency']['similarity']:.4f} ({gemma_metrics['agency']['similarity']*100:.2f}%)")
            print(f"    - Precision: {gemma_metrics['agency']['precision']:.4f}")
            print(f"    - Recall:    {gemma_metrics['agency']['recall']:.4f}")
            print(f"    - F1-score:  {gemma_metrics['agency']['f1']:.4f}")
            print(f"  [문서유형 분류]")
            print(f"    - Exact Match Accuracy: {gemma_metrics['document_type']['accuracy']:.4f} ({gemma_metrics['document_type']['accuracy']*100:.2f}%)")
            print(f"    - CER (낮을수록 좋음):  {gemma_metrics['document_type']['cer']:.4f}")
            if gemma_metrics['document_type']['wer'] is not None:
                print(f"    - WER (낮을수록 좋음):  {gemma_metrics['document_type']['wer']:.4f}")
            if gemma_metrics['document_type']['per'] is not None:
                print(f"    - PER (낮을수록 좋음):  {gemma_metrics['document_type']['per']:.4f}")
            print(f"    - Similarity (유사도):  {gemma_metrics['document_type']['similarity']:.4f} ({gemma_metrics['document_type']['similarity']*100:.2f}%)")
            print(f"    - Precision: {gemma_metrics['document_type']['precision']:.4f}")
            print(f"    - Recall:    {gemma_metrics['document_type']['recall']:.4f}")
            print(f"    - F1-score:  {gemma_metrics['document_type']['f1']:.4f}")
            print(f"  [전체]")
            print(f"    - Overall Accuracy: {gemma_metrics['overall_accuracy']:.4f} ({gemma_metrics['overall_accuracy']*100:.2f}%)")
            print(f"    - Overall Similarity: {gemma_metrics['overall_similarity']:.4f} ({gemma_metrics['overall_similarity']*100:.2f}%)")
            print(f"    - Overall CER: {gemma_metrics['overall_cer']:.4f}")
            if gemma_metrics['overall_wer'] is not None:
                print(f"    - Overall WER: {gemma_metrics['overall_wer']:.4f}")
            if gemma_metrics['overall_per'] is not None:
                print(f"    - Overall PER: {gemma_metrics['overall_per']:.4f}")
            print(f"    - 처리 시간: {gemma_metrics['processing_time']:.2f}초")
            print(f"    - 평균 처리 시간: {gemma_metrics['avg_time_per_sample']:.2f}초/샘플")
            print(f"    - 오류 수: {gemma_metrics['error_count']}개\n")
        else:
            print(f"  ❌ 평가 결과 없음\n")

        # 비교
        if bert_metrics and gemma_metrics:
            print(f"📈 모델 비교")
            print(f"{'-'*80}")
            print(f"  [Exact Match 정확도 비교]")
            print(f"    - BERT Overall Accuracy:  {bert_metrics['overall_accuracy']:.4f} ({bert_metrics['overall_accuracy']*100:.2f}%)")
            print(f"    - Gemma Overall Accuracy: {gemma_metrics['overall_accuracy']:.4f} ({gemma_metrics['overall_accuracy']*100:.2f}%)")
            if bert_metrics['overall_accuracy'] > gemma_metrics['overall_accuracy']:
                diff = (bert_metrics['overall_accuracy'] - gemma_metrics['overall_accuracy']) * 100
                print(f"    ✅ BERT가 {diff:.2f}%p 더 높음")
            else:
                diff = (gemma_metrics['overall_accuracy'] - bert_metrics['overall_accuracy']) * 100
                print(f"    ✅ Gemma가 {diff:.2f}%p 더 높음")

            print(f"\n  [유사도 비교 (CER 기반)]")
            print(f"    - BERT Overall Similarity:  {bert_metrics['overall_similarity']:.4f} ({bert_metrics['overall_similarity']*100:.2f}%)")
            print(f"    - Gemma Overall Similarity: {gemma_metrics['overall_similarity']:.4f} ({gemma_metrics['overall_similarity']*100:.2f}%)")
            if bert_metrics['overall_similarity'] > gemma_metrics['overall_similarity']:
                diff = (bert_metrics['overall_similarity'] - gemma_metrics['overall_similarity']) * 100
                print(f"    ✅ BERT가 {diff:.2f}%p 더 높음")
            else:
                diff = (gemma_metrics['overall_similarity'] - bert_metrics['overall_similarity']) * 100
                print(f"    ✅ Gemma가 {diff:.2f}%p 더 높음")

            print(f"\n  [속도 비교]")
            print(f"    - BERT 평균 처리 시간:  {bert_metrics['avg_time_per_sample']:.2f}초/샘플")
            print(f"    - Gemma 평균 처리 시간: {gemma_metrics['avg_time_per_sample']:.2f}초/샘플")
            if bert_metrics['avg_time_per_sample'] < gemma_metrics['avg_time_per_sample']:
                ratio = gemma_metrics['avg_time_per_sample'] / bert_metrics['avg_time_per_sample']
                print(f"    ✅ BERT가 {ratio:.2f}배 빠름")
            else:
                ratio = bert_metrics['avg_time_per_sample'] / gemma_metrics['avg_time_per_sample']
                print(f"    ✅ Gemma가 {ratio:.2f}배 빠름")

        print(f"\n{'='*80}\n")

    def save_results(self, output_file='evaluation_results.json'):
        """결과 저장"""
        results = {
            'timestamp': datetime.now().isoformat(),
            'test_data_size': len(self.test_data),
            'bert': self.calculate_metrics('bert'),
            'gemma': self.calculate_metrics('gemma')
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        print(f"✅ 결과 저장 완료: {output_file}\n")

    def run_evaluation(self, eval_bert=True, eval_gemma=True):
        """전체 평가 실행"""
        print(f"\n{'#'*80}")
        print(f"#  Gemma vs BERT 모델 성능 비교 평가")
        print(f"#  시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'#'*80}\n")

        # 데이터 로드
        self.load_data()

        # BERT 평가
        if eval_bert:
            self.evaluate_bert_model()

        # Gemma 평가
        if eval_gemma:
            self.evaluate_gemma_model()

        # 결과 출력
        self.print_results()

        # 결과 저장
        self.save_results()


if __name__ == "__main__":
    # 평가 실행
    evaluator = ModelEvaluator(
        test_data_path='training_recommended.json',
        sample_size=50  # 50개 샘플로 테스트 (전체는 None)
    )

    # BERT만 평가하려면: eval_bert=True, eval_gemma=False
    # Gemma만 평가하려면: eval_bert=False, eval_gemma=True
    evaluator.run_evaluation(eval_bert=True, eval_gemma=True)  # 일단 BERT만
