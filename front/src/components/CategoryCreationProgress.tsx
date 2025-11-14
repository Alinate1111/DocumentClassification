import { useState, useEffect, useRef } from 'react';

interface CategoryCreationProgressProps {
  selectedFiles: string[];
  creationType: 'auto' | 'manual' | null;
  manualType?: 'new' | 'existing' | null;
  autoGenerateLevel?: 1 | 2 | 3 | 4;
  categoryStructure?: { [category: string]: string[] }; // category name -> sample doc_ids
  existingModelPath?: string; // For manual-existing with custom models
  onCancel?: () => void;
  onComplete?: () => void;
}

export function CategoryCreationProgress({
  selectedFiles,
  creationType,
  manualType,
  autoGenerateLevel,
  categoryStructure,
  existingModelPath,
  onCancel,
  onComplete
}: CategoryCreationProgressProps) {
  const [progress, setProgress] = useState(7);
  const [currentTask, setCurrentTask] = useState('카테고리 분석 중...');
  const [startTime] = useState(new Date());
  const [estimatedEndTime, setEstimatedEndTime] = useState<Date>(new Date(Date.now() + 8 * 60 * 1000));
  const [processedFiles, setProcessedFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(selectedFiles.length);
  const [currentFileName, setCurrentFileName] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // 이미 처리했으면 실행하지 않음 (무한 루프 방지)
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    // 실제 API 호출
    const processCategories = async () => {
      try {
        console.log('🚀 카테고리 생성/분류 시작');
        console.log('📁 선택된 파일:', selectedFiles);
        console.log('🔧 생성 타입:', creationType);
        console.log('🔧 수동 타입:', manualType);
        console.log('📊 자동 생성 단계:', autoGenerateLevel);

        setCurrentTask('문서 분석 중...');
        setProgress(10);

        if (creationType === 'auto') {
          // 자동 생성: Gemma3 모델 사용
          console.log('🤖 Gemma3 모델로 카테고리 자동 생성 중...');
          setCurrentTask('Gemma3 모델로 카테고리 구조 생성 중...');

          try {
            const response = await fetch('http://localhost:8000/api/category/auto-generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                files: selectedFiles,
                level: autoGenerateLevel
              })
            });

            const result = await response.json();

            if (result.success) {
              console.log('✅ Gemma3 카테고리 생성 완료:', result);
              setProgress(90);
            } else {
              console.error('❌ Gemma3 카테고리 생성 실패:', result.error);
              setCurrentTask('카테고리 생성 실패');
              return;
            }
          } catch (error) {
            console.error('❌ API 호출 실패:', error);
            // 임시: 프로그레스 시뮬레이션 (fallback)
            await simulateProgress();
          }

        } else if (creationType === 'manual') {
          if (manualType === 'new') {
            // 수동 - 새 카테고리 생성: 샘플 학습 후 BERT 분류
            console.log('🧠 샘플로 BERT 학습 후 문서 분류 중...');
            console.log('📁 카테고리 구조:', categoryStructure);

            if (!categoryStructure) {
              console.error('❌ 카테고리 구조가 없습니다');
              setCurrentTask('오류: 카테고리 구조 없음');
              return;
            }

            // 1. BERT 모델 학습
            setCurrentTask('샘플 문서로 BERT 모델 학습 중...');
            setProgress(10);

            try {
              const trainResponse = await fetch('http://localhost:8000/api/category/train', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ categories: categoryStructure })
              });

              const trainResult = await trainResponse.json();

              if (!trainResult.success) {
                console.error('❌ BERT 학습 실패:', trainResult.error);
                setCurrentTask(`학습 실패: ${trainResult.error || '알 수 없는 오류'}`);
                return;
              }

              const modelPath = trainResult.model_path;
              console.log(`✅ BERT 학습 완료: ${modelPath}`);
              console.log(`   학습 시간: ${trainResult.training_time?.toFixed(2)}초`);
              console.log(`   샘플 수: ${trainResult.total_samples}개`);

              setProgress(40);
              setCurrentTask('학습된 모델로 문서 분류 중...');
              setTotalFiles(selectedFiles.length);

              // 2. 학습된 커스텀 모델로 문서 분류
              const classifyResponse = await fetch('http://localhost:8000/api/category/classify-with-custom-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  model_path: modelPath,
                  files: selectedFiles
                })
              });

              const classifyResult = await classifyResponse.json();

              if (classifyResult.success) {
                console.log(`✅ 분류 완료: ${classifyResult.classified_files}/${classifyResult.total_files}개 파일`);
                setProgress(90);
                setProcessedFiles(classifyResult.total_files || selectedFiles.length);
                setSuccessCount(classifyResult.classified_files || 0);
                setFailCount((classifyResult.total_files || 0) - (classifyResult.classified_files || 0));

                // 각 분류 결과를 변경이력에 저장
                if (classifyResult.results && Array.isArray(classifyResult.results)) {
                  for (const fileResult of classifyResult.results) {
                    if (fileResult.success && fileResult.classification) {
                      try {
                        const topFolder = fileResult.file_path?.split('/')[0] || ''; // 최상위 폴더명 추출
                        const historyData = new FormData();
                        historyData.append('doc_id', fileResult.doc_id?.toString() || '0');
                        historyData.append('file_name', fileResult.file_path?.split('/').pop() || '');
                        historyData.append('full_path', `${topFolder}/${fileResult.classification.기관 || 'Unknown'}/${fileResult.classification.문서유형 || 'Unknown'}/${fileResult.file_path?.split('/').pop() || ''}`);
                        historyData.append('original_folder', fileResult.file_path || ''); // 원본 폴더 경로
                        historyData.append('agency', fileResult.classification.기관 || 'Unknown');
                        historyData.append('document_type', fileResult.classification.문서유형 || 'Unknown');
                        historyData.append('confidence_agency', (fileResult.classification.confidence?.기관 || 0).toString());
                        historyData.append('confidence_document_type', (fileResult.classification.confidence?.문서유형 || 0).toString());
                        historyData.append('change_type', 'created');

                        await fetch('http://localhost:8000/api/history/add', {
                          method: 'POST',
                          credentials: 'include',
                          body: historyData
                        });
                      } catch (historyError) {
                        console.warn('⚠️  변경이력 저장 실패 (무시):', historyError);
                      }
                    }
                  }
                }
              } else {
                console.error('❌ 분류 실패:', classifyResult.error);
                setCurrentTask(`분류 실패: ${classifyResult.error || '알 수 없는 오류'}`);
              }

            } catch (error) {
              console.error('❌ API 호출 실패:', error);
              setCurrentTask('API 호출 실패');
            }

          } else if (manualType === 'existing') {
            // 수동 - 기존 카테고리에 분류: 학습된 BERT 사용
            console.log('🧠 학습된 BERT 모델로 문서 분류 중...');
            setCurrentTask('학습된 BERT 모델로 문서 분류 중...');
            setTotalFiles(selectedFiles.length);

            const startProcessTime = Date.now();
            let successfulFiles = 0;
            let failedFiles = 0;

            // 각 파일별로 BERT 분류 실행
            for (let i = 0; i < selectedFiles.length; i++) {
              const filePath = selectedFiles[i];
              const fileName = filePath.split('/').pop() || filePath;
              const fileProgress = Math.floor(((i + 1) / selectedFiles.length) * 80) + 10;

              setProgress(fileProgress);
              setProcessedFiles(i + 1);
              setCurrentFileName(fileName);
              setCurrentTask(`문서 분류 중... (${i + 1}/${selectedFiles.length})`);

              // 실시간 종료 예상 시간 계산
              if (i > 0) {
                const elapsedTime = Date.now() - startProcessTime;
                const avgTimePerFile = elapsedTime / (i + 1);
                const remainingFiles = selectedFiles.length - (i + 1);
                const estimatedRemainingTime = avgTimePerFile * remainingFiles;
                setEstimatedEndTime(new Date(Date.now() + estimatedRemainingTime));
              }

              try {
                const formData = new FormData();
                formData.append('file_path', filePath);

                const response = await fetch('http://localhost:8000/api/classify/document', {
                  method: 'POST',
                  credentials: 'include',
                  body: formData
                });

                const result = await response.json();

                if (result.success) {
                  successfulFiles++;
                  setSuccessCount(successfulFiles);
                  console.log(`✅ 분류 완료 (${i + 1}/${selectedFiles.length}):`, result);

                  // 변경이력에 저장
                  try {
                    const topFolder = filePath.split('/')[0]; // 최상위 폴더명 추출 (예: "샘플파일")
                    const historyData = new FormData();
                    historyData.append('doc_id', result.doc_id?.toString() || '0');
                    historyData.append('file_name', filePath.split('/').pop() || '');
                    historyData.append('full_path', `${topFolder}/${result.classification?.기관 || 'Unknown'}/${result.classification?.문서유형 || 'Unknown'}/${filePath.split('/').pop() || ''}`);
                    historyData.append('original_folder', filePath); // 원본 폴더 경로
                    historyData.append('agency', result.classification?.기관 || 'Unknown');
                    historyData.append('document_type', result.classification?.문서유형 || 'Unknown');
                    historyData.append('confidence_agency', (result.classification?.confidence?.기관 || 0).toString());
                    historyData.append('confidence_document_type', (result.classification?.confidence?.문서유형 || 0).toString());
                    historyData.append('change_type', 'created');

                    await fetch('http://localhost:8000/api/history/add', {
                      method: 'POST',
                      credentials: 'include',
                      body: historyData
                    });
                  } catch (historyError) {
                    console.warn('⚠️  변경이력 저장 실패 (무시):', historyError);
                  }
                } else {
                  failedFiles++;
                  setFailCount(failedFiles);
                  console.error(`❌ 분류 실패 (${i + 1}/${selectedFiles.length}):`, result.error);
                }
              } catch (error) {
                failedFiles++;
                setFailCount(failedFiles);
                console.error(`❌ API 호출 실패 (${i + 1}/${selectedFiles.length}):`, error);
              }

              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        setProgress(100);
        setCurrentTask('완료!');

        setTimeout(() => {
          if (onComplete) onComplete();
        }, 500);

      } catch (error) {
        console.error('❌ 카테고리 생성 실패:', error);
        setCurrentTask('오류 발생');
      }
    };

    const simulateProgress = async () => {
      for (let i = 20; i <= 90; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };

    processCategories();
  }, []); // 빈 dependency array로 한 번만 실행

  return (
    <div style={{ width: '1440px', height: '900px', position: 'relative', background: '#F9F9F9', overflow: 'hidden' }}>
      <div style={{ width: '1440px', height: '900px', left: '0px', top: '0px', position: 'absolute' }}>
        <div style={{ width: '1440px', height: '844px', left: '0px', top: '56px', position: 'absolute' }}>
          <div style={{ width: '1384px', height: '844px', left: '56px', top: '0px', position: 'absolute', background: 'white' }}>
            <div style={{ width: '1336px', height: '532.50px', left: '24px', top: '48px', position: 'absolute', background: 'white', borderRadius: '6px', border: '1px #E5E5E5 solid' }}>
              <div style={{ width: '1302px', height: '34px', left: '17px', top: '49px', position: 'absolute' }}>
                <div style={{ width: '205px', height: '34px', left: '121.31px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
                  <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 편집 및 샘플 문서 등록</div>
                </div>
                <div style={{ left: '334px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
                <div style={{ width: '254px', height: '34px', left: '344px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
                  <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>미분류 문서 카테고리 자동 생성 여부 선택</div>
                </div>
                <div style={{ left: '606px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
                <div style={{ width: '178px', height: '32px', left: '616px', top: '1px', position: 'absolute', background: '#5A6F95', borderRadius: '4px' }}>
                  <div style={{ left: '16px', top: '8px', position: 'absolute', color: 'white', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 생성 및 문서 분류</div>
                </div>
                <div style={{ left: '802px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
                <div style={{ width: '166px', height: '34px', left: '812px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
                  <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 전문가 DB 생성</div>
                </div>
                <div style={{ left: '986px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
                <div style={{ width: '136px', height: '34px', left: '996px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
                  <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 생성 완료</div>
                </div>
              </div>
              <div style={{ width: '1302px', height: '400.50px', left: '17px', top: '132px', position: 'absolute' }}>
                <div style={{ width: '120px', height: '100px', left: '591px', top: '0px', position: 'absolute', overflow: 'hidden' }}>
                  <div style={{ width: '120px', height: '100px', left: '0px', top: '0px', position: 'absolute', background: '#DDDDDD', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="animate-spin" style={{ width: '50px', height: '50px', border: '5px solid #999999', borderTopColor: '#4A658F', borderRadius: '50%' }}></div>
                  </div>
                </div>
                <div style={{ width: '576px', height: '32px', left: '363px', top: '198.50px', position: 'absolute' }}>
                  <div style={{ width: '576px', height: '16px', left: '0px', top: '0px', position: 'absolute' }}>
                    <div style={{ left: '0px', top: '0px', position: 'absolute', color: '#4A658F', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>{currentTask}</div>
                    <div style={{ left: '558.66px', top: '0px', position: 'absolute', color: '#999999', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>{progress}%</div>
                  </div>
                  <div style={{ width: '576px', height: '12px', left: '0px', top: '20px', position: 'absolute', background: '#E5E5E5', borderRadius: '9999px' }}>
                    <div style={{ width: `${progress * 5.76}px`, height: '12px', left: '0px', top: '0px', position: 'absolute', background: '#4A658F', borderRadius: '9999px' }}></div>
                  </div>
                </div>
                <div style={{ width: '576px', height: '120px', left: '363px', top: '242.50px', position: 'absolute' }}>
                  <div style={{ width: '576px', height: '24px', left: '0px', top: '0px', position: 'absolute' }}>
                    <div style={{ left: '1px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word' }}>
                      {creationType === 'auto' ? '카테고리 최대 생성 단계' : '처리 모드'}
                    </div>
                    <div style={{ left: '544.31px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>
                      {creationType === 'auto'
                        ? `${autoGenerateLevel}단계`
                        : manualType === 'new'
                          ? 'BERT 학습 + 분류'
                          : 'BERT 분류'}
                    </div>
                  </div>
                  <div style={{ width: '576px', height: '24px', left: '0px', top: '24px', position: 'absolute' }}>
                    <div style={{ left: '1px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word' }}>전체 파일 수</div>
                    <div style={{ left: '520px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>
                      {totalFiles}개
                    </div>
                  </div>
                  <div style={{ width: '576px', height: '24px', left: '0px', top: '48px', position: 'absolute' }}>
                    <div style={{ left: '1px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word' }}>생성 시작 시간</div>
                    <div style={{ left: '463.56px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>
                      {startTime.toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ width: '576px', height: '24px', left: '0px', top: '72px', position: 'absolute' }}>
                    <div style={{ left: '1px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word' }}>종료 예상 시간</div>
                    <div style={{ left: '463.56px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>
                      {estimatedEndTime.toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ width: '576px', height: '24px', left: '0px', top: '96px', position: 'absolute' }}>
                    <div style={{ left: '1px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word' }}>처리 진행률</div>
                    <div style={{ left: '480px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>
                      {processedFiles}/{totalFiles} (성공: <span style={{ color: '#4CAF50' }}>{successCount}</span> / 실패: <span style={{ color: '#F44336' }}>{failCount}</span>)
                    </div>
                  </div>
                </div>
                <div
                  onClick={onCancel}
                  style={{ width: '74px', height: '34px', left: '614px', top: '390px', position: 'absolute', borderRadius: '4px', border: '1px #E5E5E5 solid', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div style={{ color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>취소</div>
                </div>
                <div style={{ width: '400px', height: '60px', left: '500px', top: '114px', position: 'absolute', textAlign: 'center' }}>
                  <span style={{ color: '#333333', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '19px', wordWrap: 'break-word' }}>
                    {creationType === 'auto'
                      ? 'Gemma3 모델로 카테고리 구조를 생성하고'
                      : manualType === 'new'
                        ? '샘플로 BERT 모델을 학습하고 문서를 분류하여'
                        : '학습된 BERT 모델로 문서를 분류하여'}
                  </span>
                  <span style={{ color: 'black', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '19px', wordWrap: 'break-word' }}> <br /></span>
                  <span style={{ color: '#333333', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '19px', wordWrap: 'break-word' }}>
                    선택한 {totalFiles}개 파일을 처리하고 있습니다.
                  </span>
                </div>
                {/* 현재 처리 중인 파일명 */}
                {currentFileName && (
                  <div style={{ left: '400px', top: '173px', position: 'absolute', color: '#4A658F', fontSize: '11px', fontFamily: 'Roboto', fontWeight: '500', lineHeight: '16px', wordWrap: 'break-word', textAlign: 'center', width: '600px' }}>
                    현재 처리 중: {currentFileName}
                  </div>
                )}
                {/* 진행 통계 */}
                <div style={{ left: '450px', top: '188px', position: 'absolute', color: '#999999', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word', textAlign: 'center', width: '500px' }}>
                  {processedFiles > 0 ? (
                    <>처리 완료: {processedFiles}/{totalFiles} | 성공: <span style={{ color: '#4CAF50' }}>{successCount}</span> | 실패: <span style={{ color: '#F44336' }}>{failCount}</span></>
                  ) : (
                    creationType === 'auto'
                      ? '카테고리 생성이 끝나면 자동으로 문서 배치가 시작됩니다.'
                      : manualType === 'new'
                        ? 'BERT 학습 후 분류가 완료되면 각 문서가 해당 카테고리에 배치됩니다.'
                        : '분류가 완료되면 각 문서가 해당 카테고리에 배치됩니다.'
                  )}
                </div>
              </div>
              <div style={{ left: '17px', top: '17px', position: 'absolute', color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>관리자가 카테고리를 수동으로 생성하고, AI가 자동으로 문서를 분류합니다.</div>
            </div>
            <div style={{ left: '24px', top: '25px', position: 'absolute' }}>
              <span style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word' }}>생성단 &gt;</span>
              <span style={{ color: 'black', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word' }}> </span>
              <span style={{ color: '#0070F3', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word' }}>수동 생성</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
