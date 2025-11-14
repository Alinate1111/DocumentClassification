import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface DocumentClassificationCompleteProps {
  totalFiles?: number;
  onConfirm?: () => void;
}

interface ClassificationResult {
  doc_id: number;
  fileName: string;
  기관: string;
  문서유형: string;
  confidence: {
    기관?: number;
    문서유형?: number;
  };
  avg_confidence: number;
  needsReview: boolean;
  extractedText: string;
  main_topic: string;
  probabilities?: any;
  classified_at: string;
}

export function DocumentClassificationComplete({
  totalFiles: propTotalFiles,
  onConfirm
}: DocumentClassificationCompleteProps) {
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // OCR 완료 화면에서는 분류 결과를 가져오지 않음
  // propTotalFiles가 있으면 OCR만 완료된 것으로 간주
  useEffect(() => {
    if (propTotalFiles) {
      // OCR만 완료 - 분류 결과 조회 안 함
      setLoading(false);
      console.log(`✅ OCR 완료: ${propTotalFiles}개 파일`);
    } else {
      // 분류까지 완료된 경우 (별도 분류 단계에서 사용)
      fetch('http://localhost:8000/api/classification/results/all?limit=100', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.results) {
            const formattedResults: ClassificationResult[] = data.results.map((item: any) => ({
              doc_id: item.doc_id,
              fileName: item.filename,
              기관: item.기관 || 'Unknown',
              문서유형: item.문서유형 || 'Unknown',
              confidence: item.confidence || {},
              avg_confidence: item.avg_confidence || 0,
              needsReview: item.needs_review || false,
              extractedText: item.text_preview || '텍스트 없음',
              main_topic: item.main_topic || '',
              probabilities: item.probabilities,
              classified_at: item.classified_at || ''
            }));
            setResults(formattedResults);
          } else {
            setError('분류 결과를 불러올 수 없습니다.');
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('분류 결과 로드 실패:', err);
          setError('분류 결과 로드 실패');
          setLoading(false);
        });
    }
  }, [propTotalFiles]);

  const totalFiles = propTotalFiles || results.length;

  const successCount = results.filter(r => !r.needsReview).length;
  const reviewCount = results.filter(r => r.needsReview).length;
  const successRate = Math.round((successCount / totalFiles) * 100);

  const [selectedResult, setSelectedResult] = useState<ClassificationResult | null>(null);

  // 로딩 중 표시
  if (loading) {
    return (
      <div style={{ width: '1440px', height: '900px', position: 'relative', background: '#F9F9F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', color: '#666666', marginBottom: '8px' }}>분류 결과를 불러오는 중...</div>
          <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #E5E5E5', borderTopColor: '#3B82F6', borderRadius: '50%', margin: '0 auto' }}></div>
        </div>
      </div>
    );
  }

  // 에러 표시
  if (error) {
    return (
      <div style={{ width: '1440px', height: '900px', position: 'relative', background: '#F9F9F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <XCircle style={{ width: '64px', height: '64px', color: '#EF4444', margin: '0 auto 16px' }} />
          <div style={{ fontSize: '16px', color: '#333333', fontWeight: '600', marginBottom: '8px' }}>{error}</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 24px',
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '1440px', height: '900px', position: 'relative', background: '#F9F9F9' }}>
      <div style={{ width: '1440px', height: '844px', left: '0px', top: '56px', position: 'absolute' }}>
        <div style={{ width: '1384px', height: '844px', left: '56px', top: '0px', position: 'absolute', background: 'white' }}>

          {/* 상단 경로 */}
          <div style={{ left: '24px', top: '25px', position: 'absolute' }}>
            <span style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px' }}>문서 &gt;</span>
            <span style={{ color: 'black', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px' }}> </span>
            <span style={{ color: '#0070F3', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px' }}>분류 완료</span>
          </div>

          <div style={{ width: '1336px', height: '800px', left: '24px', top: '24px', position: 'absolute', background: 'white', borderRadius: '6px', border: '1px #E5E5E5 solid' }}>

            {/* 완료 아이콘 및 메시지 */}
            <div style={{ textAlign: 'center', paddingTop: '40px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', background: '#10B981', borderRadius: '50%', marginBottom: '16px' }}>
                <CheckCircle style={{ width: '48px', height: '48px', color: 'white' }} />
              </div>
              <div style={{ color: '#333333', fontSize: '18px', fontFamily: 'Roboto', fontWeight: '700', marginBottom: '8px' }}>
                {propTotalFiles ? 'OCR 텍스트 추출이 완료되었습니다' : '문서 분류가 완료되었습니다'}
              </div>
              <div style={{ color: '#666666', fontSize: '13px', fontFamily: 'Roboto', fontWeight: '400' }}>
                {propTotalFiles
                  ? `총 ${totalFiles}개 파일의 텍스트가 추출되었습니다`
                  : `총 ${totalFiles}개 파일 중 ${successCount}개 성공, ${reviewCount}개 검토 필요`
                }
              </div>
            </div>

            {/* 통계 요약 */}
            {propTotalFiles ? (
              // OCR만 완료된 경우
              <div style={{ width: '400px', margin: '32px auto', padding: '24px', background: '#F9F9F9', borderRadius: '8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#999999', fontSize: '11px', fontFamily: 'Roboto', fontWeight: '400', marginBottom: '8px' }}>
                    OCR 처리 완료
                  </div>
                  <div style={{ color: '#10B981', fontSize: '32px', fontFamily: 'Roboto', fontWeight: '700' }}>
                    {totalFiles}개 파일
                  </div>
                  <div style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', marginTop: '16px' }}>
                    문서 목록으로 돌아가서 OCR 상태를 확인하세요
                  </div>
                </div>
              </div>
            ) : (
              // 분류까지 완료된 경우
              <div style={{ width: '600px', margin: '32px auto', padding: '24px', background: '#F9F9F9', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999999', fontSize: '11px', fontFamily: 'Roboto', fontWeight: '400', marginBottom: '8px' }}>
                      총 파일 수
                    </div>
                    <div style={{ color: '#333333', fontSize: '24px', fontFamily: 'Roboto', fontWeight: '700' }}>
                      {totalFiles}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999999', fontSize: '11px', fontFamily: 'Roboto', fontWeight: '400', marginBottom: '8px' }}>
                      분류 성공
                    </div>
                    <div style={{ color: '#10B981', fontSize: '24px', fontFamily: 'Roboto', fontWeight: '700' }}>
                      {successCount}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999999', fontSize: '11px', fontFamily: 'Roboto', fontWeight: '400', marginBottom: '8px' }}>
                      검토 필요
                    </div>
                    <div style={{ color: '#F59E0B', fontSize: '24px', fontFamily: 'Roboto', fontWeight: '700' }}>
                      {reviewCount}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999999', fontSize: '11px', fontFamily: 'Roboto', fontWeight: '400', marginBottom: '8px' }}>
                      성공률
                    </div>
                    <div style={{ color: '#4A658F', fontSize: '24px', fontFamily: 'Roboto', fontWeight: '700' }}>
                      {successRate}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 분류 결과 테이블 - OCR만 완료된 경우 숨김 */}
            {!propTotalFiles && (
              <div style={{ width: '1288px', height: '350px', margin: '0 24px', border: '1px solid #E5E5E5', borderRadius: '4px', overflowY: 'auto' }}>
                {/* 테이블 헤더 */}
                <div style={{ display: 'flex', background: '#F9F9F9', borderBottom: '1px solid #E5E5E5', padding: '12px', fontWeight: '700', fontSize: '12px', position: 'sticky', top: 0, zIndex: 1 }}>
                  <div style={{ width: '40px', textAlign: 'center' }}>No</div>
                  <div style={{ flex: 1 }}>파일명</div>
                  <div style={{ width: '150px', textAlign: 'center' }}>카테고리</div>
                  <div style={{ width: '100px', textAlign: 'center' }}>신뢰도</div>
                  <div style={{ width: '80px', textAlign: 'center' }}>상태</div>
                  <div style={{ width: '100px', textAlign: 'center' }}>작업</div>
                </div>

                {/* 테이블 내용 */}
                {results.map((result, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    borderBottom: '1px solid #F3F3F3',
                    background: selectedResult === result ? '#EEF2FF' : 'white',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedResult(result)}
                >
                  <div style={{ width: '40px', textAlign: 'center', fontSize: '11px', color: '#666666' }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1, fontSize: '12px', color: '#333333' }}>
                    {result.fileName}
                  </div>
                  <div style={{ width: '150px', textAlign: 'center', fontSize: '12px', color: '#4A658F', fontWeight: '600' }}>
                    {result.기관} / {result.문서유형}
                  </div>
                  <div style={{ width: '100px', textAlign: 'center', fontSize: '12px' }}>
                    <span style={{ color: result.avg_confidence >= 0.7 ? '#10B981' : '#F59E0B' }}>
                      {Math.round(result.avg_confidence * 100)}%
                    </span>
                  </div>
                  <div style={{ width: '80px', textAlign: 'center' }}>
                    {result.needsReview ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', background: '#FEF3C7', borderRadius: '12px' }}>
                        <AlertCircle style={{ width: '12px', height: '12px', color: '#F59E0B', marginRight: '4px' }} />
                        <span style={{ fontSize: '10px', color: '#F59E0B' }}>검토</span>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', background: '#D1FAE5', borderRadius: '12px' }}>
                        <CheckCircle style={{ width: '12px', height: '12px', color: '#10B981', marginRight: '4px' }} />
                        <span style={{ fontSize: '10px', color: '#10B981' }}>완료</span>
                      </div>
                    )}
                  </div>
                  <div style={{ width: '100px', textAlign: 'center' }}>
                    <button
                      style={{
                        padding: '4px 12px',
                        border: '1px solid #E5E5E5',
                        borderRadius: '4px',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: '#666666'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedResult(result);
                      }}
                    >
                      상세보기
                    </button>
                  </div>
                </div>
              ))}
              </div>
            )}

            {/* 확인 버튼 */}
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                onClick={onConfirm}
                style={{
                  padding: '10px 32px',
                  background: '#2F4F8A',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 상세보기 모달 */}
      {selectedResult && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedResult(null)}
        >
          <div
            style={{
              width: '800px',
              maxHeight: '80vh',
              background: 'white',
              borderRadius: '8px',
              padding: '24px',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#333333' }}>
                분류 상세 정보
              </h3>
              <button
                onClick={() => setSelectedResult(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999999'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>파일명</div>
              <div style={{ fontSize: '14px', color: '#333333', fontWeight: '600' }}>{selectedResult.fileName}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>분류 카테고리</div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <div style={{ flex: 1, padding: '12px', background: '#F0F9FF', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>기관</div>
                  <div style={{ fontSize: '14px', color: '#4A658F', fontWeight: '700' }}>{selectedResult.기관}</div>
                  <div style={{ fontSize: '11px', color: '#999999', marginTop: '4px' }}>
                    신뢰도: {Math.round((selectedResult.confidence.기관 || 0) * 100)}%
                  </div>
                </div>
                <div style={{ flex: 1, padding: '12px', background: '#F0FDF4', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>문서유형</div>
                  <div style={{ fontSize: '14px', color: '#10B981', fontWeight: '700' }}>{selectedResult.문서유형}</div>
                  <div style={{ fontSize: '11px', color: '#999999', marginTop: '4px' }}>
                    신뢰도: {Math.round((selectedResult.confidence.문서유형 || 0) * 100)}%
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>평균 신뢰도</div>
              <div style={{ fontSize: '14px', color: selectedResult.avg_confidence >= 0.7 ? '#10B981' : '#F59E0B', fontWeight: '600' }}>
                {Math.round(selectedResult.avg_confidence * 100)}%
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>주요 토픽</div>
              <div style={{ fontSize: '13px', color: '#333333', lineHeight: '1.6', padding: '12px', background: '#F9F9F9', borderRadius: '4px' }}>
                {selectedResult.main_topic || '토픽 정보 없음'}
              </div>
            </div>

            {selectedResult.probabilities && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#999999', marginBottom: '8px' }}>상위 예측 확률</div>
                <div style={{ fontSize: '11px', color: '#666666', padding: '12px', background: '#F9F9F9', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                  {Object.entries(selectedResult.probabilities).map(([task, probs]: [string, any], idx) => (
                    <div key={idx} style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>{task}:</div>
                      {Object.entries(probs).slice(0, 3).map(([label, prob]: [string, any], i) => (
                        <div key={i} style={{ marginLeft: '12px', fontSize: '10px' }}>
                          {i + 1}. {label}: {(prob * 100).toFixed(1)}%
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>추출된 텍스트 (미리보기)</div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#666666',
                  lineHeight: '1.6',
                  padding: '12px',
                  background: '#F9F9F9',
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}
              >
                {selectedResult.extractedText}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
