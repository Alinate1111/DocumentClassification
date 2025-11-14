"""
모델 평가 결과 시각화 및 PPT용 자료 생성
"""
import json
import matplotlib.pyplot as plt
import matplotlib
matplotlib.rcParams['font.family'] = 'Malgun Gothic'  # 한글 폰트 설정
matplotlib.rcParams['axes.unicode_minus'] = False  # 마이너스 기호 깨짐 방지
import numpy as np
from datetime import datetime


class ResultVisualizer:
    def __init__(self, results_file='evaluation_results.json'):
        self.results_file = results_file
        self.results = None

    def load_results(self):
        """결과 파일 로드"""
        with open(self.results_file, 'r', encoding='utf-8') as f:
            self.results = json.load(f)
        print(f"✅ 결과 파일 로드 완료: {self.results_file}")

    def plot_accuracy_comparison(self):
        """정확도 비교 막대 그래프"""
        if not self.results:
            self.load_results()

        bert_data = self.results.get('bert', {})
        gemma_data = self.results.get('gemma', {})

        if not bert_data or not gemma_data:
            print("⚠️  BERT 또는 Gemma 데이터가 없습니다.")
            return

        # 데이터 준비
        categories = ['기관 분류', '문서유형 분류', '전체 정확도']
        bert_scores = [
            bert_data['agency']['accuracy'] * 100,
            bert_data['document_type']['accuracy'] * 100,
            bert_data['overall_accuracy'] * 100
        ]
        gemma_scores = [
            gemma_data['agency']['accuracy'] * 100,
            gemma_data['document_type']['accuracy'] * 100,
            gemma_data['overall_accuracy'] * 100
        ]

        # 그래프 생성
        x = np.arange(len(categories))
        width = 0.35

        fig, ax = plt.subplots(figsize=(12, 7))
        bars1 = ax.bar(x - width/2, bert_scores, width, label='BERT', color='#4472C4', alpha=0.8)
        bars2 = ax.bar(x + width/2, gemma_scores, width, label='Gemma', color='#ED7D31', alpha=0.8)

        # 레이블 및 제목
        ax.set_xlabel('평가 항목', fontsize=12, weight='bold')
        ax.set_ylabel('정확도 (%)', fontsize=12, weight='bold')
        ax.set_title('Gemma vs BERT 모델 정확도 비교', fontsize=16, weight='bold', pad=20)
        ax.set_xticks(x)
        ax.set_xticklabels(categories, fontsize=11)
        ax.legend(fontsize=12)
        ax.set_ylim(0, 100)
        ax.grid(axis='y', alpha=0.3)

        # 막대 위에 값 표시
        def autolabel(bars):
            for bar in bars:
                height = bar.get_height()
                ax.annotate(f'{height:.1f}%',
                           xy=(bar.get_x() + bar.get_width() / 2, height),
                           xytext=(0, 3),
                           textcoords="offset points",
                           ha='center', va='bottom',
                           fontsize=10, weight='bold')

        autolabel(bars1)
        autolabel(bars2)

        plt.tight_layout()
        plt.savefig('accuracy_comparison.png', dpi=300, bbox_inches='tight')
        print(f"✅ 정확도 비교 그래프 저장: accuracy_comparison.png")
        plt.close()

    def plot_metrics_comparison(self):
        """Precision, Recall, F1-score 비교"""
        if not self.results:
            self.load_results()

        bert_data = self.results.get('bert', {})
        gemma_data = self.results.get('gemma', {})

        if not bert_data or not gemma_data:
            return

        # 기관 분류 메트릭
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))

        metrics = ['Precision', 'Recall', 'F1-score']

        # 기관 분류
        bert_agency = [
            bert_data['agency']['precision'],
            bert_data['agency']['recall'],
            bert_data['agency']['f1']
        ]
        gemma_agency = [
            gemma_data['agency']['precision'],
            gemma_data['agency']['recall'],
            gemma_data['agency']['f1']
        ]

        x = np.arange(len(metrics))
        width = 0.35

        bars1 = ax1.bar(x - width/2, bert_agency, width, label='BERT', color='#4472C4', alpha=0.8)
        bars2 = ax1.bar(x + width/2, gemma_agency, width, label='Gemma', color='#ED7D31', alpha=0.8)

        ax1.set_ylabel('점수', fontsize=11, weight='bold')
        ax1.set_title('기관 분류 성능 비교', fontsize=13, weight='bold')
        ax1.set_xticks(x)
        ax1.set_xticklabels(metrics)
        ax1.legend()
        ax1.set_ylim(0, 1.0)
        ax1.grid(axis='y', alpha=0.3)

        # 문서유형 분류
        bert_doctype = [
            bert_data['document_type']['precision'],
            bert_data['document_type']['recall'],
            bert_data['document_type']['f1']
        ]
        gemma_doctype = [
            gemma_data['document_type']['precision'],
            gemma_data['document_type']['recall'],
            gemma_data['document_type']['f1']
        ]

        bars3 = ax2.bar(x - width/2, bert_doctype, width, label='BERT', color='#4472C4', alpha=0.8)
        bars4 = ax2.bar(x + width/2, gemma_doctype, width, label='Gemma', color='#ED7D31', alpha=0.8)

        ax2.set_ylabel('점수', fontsize=11, weight='bold')
        ax2.set_title('문서유형 분류 성능 비교', fontsize=13, weight='bold')
        ax2.set_xticks(x)
        ax2.set_xticklabels(metrics)
        ax2.legend()
        ax2.set_ylim(0, 1.0)
        ax2.grid(axis='y', alpha=0.3)

        plt.tight_layout()
        plt.savefig('metrics_comparison.png', dpi=300, bbox_inches='tight')
        print(f"✅ 세부 메트릭 비교 그래프 저장: metrics_comparison.png")
        plt.close()

    def plot_error_rates(self):
        """WER/CER/PER 오류율 비교 (낮을수록 좋음)"""
        if not self.results:
            self.load_results()

        bert_data = self.results.get('bert', {})
        gemma_data = self.results.get('gemma', {})

        if not bert_data or not gemma_data:
            return

        # CER/WER/PER 데이터 수집 (있는 것만)
        error_metrics = []
        bert_values = []
        gemma_values = []

        # CER (Character Error Rate)
        if 'agency' in bert_data and 'cer' in bert_data['agency']:
            error_metrics.append('CER\n(기관)')
            bert_values.append(bert_data['agency']['cer'])
            gemma_values.append(gemma_data['agency']['cer'])

        if 'document_type' in bert_data and 'cer' in bert_data['document_type']:
            error_metrics.append('CER\n(문서유형)')
            bert_values.append(bert_data['document_type']['cer'])
            gemma_values.append(gemma_data['document_type']['cer'])

        # WER (Word Error Rate)
        if 'agency' in bert_data and 'wer' in bert_data['agency'] and bert_data['agency']['wer'] is not None:
            error_metrics.append('WER\n(기관)')
            bert_values.append(bert_data['agency']['wer'])
            gemma_values.append(gemma_data['agency']['wer'])

        if 'document_type' in bert_data and 'wer' in bert_data['document_type'] and bert_data['document_type']['wer'] is not None:
            error_metrics.append('WER\n(문서유형)')
            bert_values.append(bert_data['document_type']['wer'])
            gemma_values.append(gemma_data['document_type']['wer'])

        # PER (Phoneme Error Rate)
        if 'agency' in bert_data and 'per' in bert_data['agency'] and bert_data['agency']['per'] is not None:
            error_metrics.append('PER\n(기관)')
            bert_values.append(bert_data['agency']['per'])
            gemma_values.append(gemma_data['agency']['per'])

        if 'document_type' in bert_data and 'per' in bert_data['document_type'] and bert_data['document_type']['per'] is not None:
            error_metrics.append('PER\n(문서유형)')
            bert_values.append(bert_data['document_type']['per'])
            gemma_values.append(gemma_data['document_type']['per'])

        if not error_metrics:
            print("⚠️  CER/WER/PER 데이터가 없습니다.")
            return

        # 그래프 생성
        x = np.arange(len(error_metrics))
        width = 0.35

        fig, ax = plt.subplots(figsize=(14, 7))
        bars1 = ax.bar(x - width/2, bert_values, width, label='BERT', color='#4472C4', alpha=0.8)
        bars2 = ax.bar(x + width/2, gemma_values, width, label='Gemma', color='#ED7D31', alpha=0.8)

        ax.set_xlabel('오류율 메트릭', fontsize=12, weight='bold')
        ax.set_ylabel('오류율 (낮을수록 좋음)', fontsize=12, weight='bold')
        ax.set_title('CER / WER / PER 오류율 비교', fontsize=16, weight='bold', pad=20)
        ax.set_xticks(x)
        ax.set_xticklabels(error_metrics, fontsize=10)
        ax.legend(fontsize=12)
        ax.grid(axis='y', alpha=0.3)

        # 막대 위에 값 표시
        def autolabel(bars):
            for bar in bars:
                height = bar.get_height()
                ax.annotate(f'{height:.3f}',
                           xy=(bar.get_x() + bar.get_width() / 2, height),
                           xytext=(0, 3),
                           textcoords="offset points",
                           ha='center', va='bottom',
                           fontsize=9, weight='bold')

        autolabel(bars1)
        autolabel(bars2)

        plt.tight_layout()
        plt.savefig('error_rates_comparison.png', dpi=300, bbox_inches='tight')
        print(f"✅ 오류율 비교 그래프 저장: error_rates_comparison.png")
        plt.close()

    def plot_speed_comparison(self):
        """처리 속도 비교"""
        if not self.results:
            self.load_results()

        bert_data = self.results.get('bert', {})
        gemma_data = self.results.get('gemma', {})

        if not bert_data or not gemma_data:
            return

        models = ['BERT', 'Gemma']
        speeds = [
            bert_data['avg_time_per_sample'],
            gemma_data['avg_time_per_sample']
        ]

        fig, ax = plt.subplots(figsize=(10, 6))
        colors = ['#4472C4', '#ED7D31']
        bars = ax.bar(models, speeds, color=colors, alpha=0.8, width=0.6)

        ax.set_ylabel('평균 처리 시간 (초/샘플)', fontsize=12, weight='bold')
        ax.set_title('모델별 처리 속도 비교', fontsize=16, weight='bold', pad=20)
        ax.grid(axis='y', alpha=0.3)

        # 막대 위에 값 표시
        for bar in bars:
            height = bar.get_height()
            ax.annotate(f'{height:.2f}초',
                       xy=(bar.get_x() + bar.get_width() / 2, height),
                       xytext=(0, 3),
                       textcoords="offset points",
                       ha='center', va='bottom',
                       fontsize=12, weight='bold')

        # 빠른 모델 표시
        if speeds[0] < speeds[1]:
            ratio = speeds[1] / speeds[0]
            ax.text(0.5, max(speeds) * 0.8, f'BERT가 {ratio:.1f}배 빠름',
                   ha='center', fontsize=13, weight='bold',
                   bbox=dict(boxstyle='round', facecolor='lightgreen', alpha=0.5))
        else:
            ratio = speeds[0] / speeds[1]
            ax.text(0.5, max(speeds) * 0.8, f'Gemma가 {ratio:.1f}배 빠름',
                   ha='center', fontsize=13, weight='bold',
                   bbox=dict(boxstyle='round', facecolor='lightgreen', alpha=0.5))

        plt.tight_layout()
        plt.savefig('speed_comparison.png', dpi=300, bbox_inches='tight')
        print(f"✅ 처리 속도 비교 그래프 저장: speed_comparison.png")
        plt.close()

    def generate_comparison_table(self):
        """비교 테이블 생성 (텍스트)"""
        if not self.results:
            self.load_results()

        bert_data = self.results.get('bert', {})
        gemma_data = self.results.get('gemma', {})

        print(f"\n{'='*80}")
        print(f"📊 모델 성능 비교 테이블 (PPT용)")
        print(f"{'='*80}\n")

        # CER/WER/PER 추가 행 생성
        error_rate_rows = ""
        if 'cer' in bert_data.get('agency', {}):
            error_rate_rows += f"│ 기관 CER            │    {bert_data['agency']['cer']:.4f}    │    {gemma_data['agency']['cer']:.4f}    │    {abs(bert_data['agency']['cer']-gemma_data['agency']['cer']):.4f}    │\n"
        if 'cer' in bert_data.get('document_type', {}):
            error_rate_rows += f"│ 문서유형 CER        │    {bert_data['document_type']['cer']:.4f}    │    {gemma_data['document_type']['cer']:.4f}    │    {abs(bert_data['document_type']['cer']-gemma_data['document_type']['cer']):.4f}    │\n"

        if bert_data.get('agency', {}).get('wer') is not None:
            error_rate_rows += f"│ 기관 WER            │    {bert_data['agency']['wer']:.4f}    │    {gemma_data['agency']['wer']:.4f}    │    {abs(bert_data['agency']['wer']-gemma_data['agency']['wer']):.4f}    │\n"
        if bert_data.get('document_type', {}).get('wer') is not None:
            error_rate_rows += f"│ 문서유형 WER        │    {bert_data['document_type']['wer']:.4f}    │    {gemma_data['document_type']['wer']:.4f}    │    {abs(bert_data['document_type']['wer']-gemma_data['document_type']['wer']):.4f}    │\n"

        if bert_data.get('agency', {}).get('per') is not None:
            error_rate_rows += f"│ 기관 PER            │    {bert_data['agency']['per']:.4f}    │    {gemma_data['agency']['per']:.4f}    │    {abs(bert_data['agency']['per']-gemma_data['agency']['per']):.4f}    │\n"
        if bert_data.get('document_type', {}).get('per') is not None:
            error_rate_rows += f"│ 문서유형 PER        │    {bert_data['document_type']['per']:.4f}    │    {gemma_data['document_type']['per']:.4f}    │    {abs(bert_data['document_type']['per']-gemma_data['document_type']['per']):.4f}    │\n"

        table = f"""
┌─────────────────────┬──────────────┬──────────────┬──────────────┐
│                     │     BERT     │    Gemma     │    차이      │
├─────────────────────┼──────────────┼──────────────┼──────────────┤
│ 기관 정확도         │  {bert_data['agency']['accuracy']*100:>6.2f}%   │  {gemma_data['agency']['accuracy']*100:>6.2f}%   │  {abs(bert_data['agency']['accuracy']-gemma_data['agency']['accuracy'])*100:>6.2f}%   │
│ 문서유형 정확도     │  {bert_data['document_type']['accuracy']*100:>6.2f}%   │  {gemma_data['document_type']['accuracy']*100:>6.2f}%   │  {abs(bert_data['document_type']['accuracy']-gemma_data['document_type']['accuracy'])*100:>6.2f}%   │
│ 전체 정확도         │  {bert_data['overall_accuracy']*100:>6.2f}%   │  {gemma_data['overall_accuracy']*100:>6.2f}%   │  {abs(bert_data['overall_accuracy']-gemma_data['overall_accuracy'])*100:>6.2f}%   │
├─────────────────────┼──────────────┼──────────────┼──────────────┤
│ 기관 F1-score       │    {bert_data['agency']['f1']:.4f}    │    {gemma_data['agency']['f1']:.4f}    │    {abs(bert_data['agency']['f1']-gemma_data['agency']['f1']):.4f}    │
│ 문서유형 F1-score   │    {bert_data['document_type']['f1']:.4f}    │    {gemma_data['document_type']['f1']:.4f}    │    {abs(bert_data['document_type']['f1']-gemma_data['document_type']['f1']):.4f}    │
├─────────────────────┼──────────────┼──────────────┼──────────────┤
{error_rate_rows}├─────────────────────┼──────────────┼──────────────┼──────────────┤
│ 평균 처리시간(초)   │    {bert_data['avg_time_per_sample']:>6.2f}    │    {gemma_data['avg_time_per_sample']:>6.2f}    │    {abs(bert_data['avg_time_per_sample']-gemma_data['avg_time_per_sample']):>6.2f}    │
│ 오류 수             │    {bert_data['error_count']:>6}    │    {gemma_data['error_count']:>6}    │    {abs(bert_data['error_count']-gemma_data['error_count']):>6}    │
└─────────────────────┴──────────────┴──────────────┴──────────────┘
"""
        print(table)

        # 파일로 저장
        with open('comparison_table.txt', 'w', encoding='utf-8') as f:
            f.write(table)
        print(f"✅ 비교 테이블 저장: comparison_table.txt\n")

    def generate_all_visualizations(self):
        """모든 시각화 생성"""
        print(f"\n{'='*80}")
        print(f"📈 시각화 자료 생성 중...")
        print(f"{'='*80}\n")

        self.load_results()
        self.plot_accuracy_comparison()
        self.plot_metrics_comparison()
        self.plot_error_rates()  # WER/CER/PER 오류율 비교 추가
        self.plot_speed_comparison()
        self.generate_comparison_table()

        print(f"\n{'='*80}")
        print(f"✅ 모든 시각화 완료!")
        print(f"{'='*80}\n")
        print(f"생성된 파일:")
        print(f"  1. accuracy_comparison.png - 정확도 비교 그래프")
        print(f"  2. metrics_comparison.png - 세부 메트릭 비교")
        print(f"  3. error_rates_comparison.png - CER/WER/PER 오류율 비교")
        print(f"  4. speed_comparison.png - 처리 속도 비교")
        print(f"  5. comparison_table.txt - 비교 테이블\n")


if __name__ == "__main__":
    visualizer = ResultVisualizer('evaluation_results.json')
    visualizer.generate_all_visualizations()
