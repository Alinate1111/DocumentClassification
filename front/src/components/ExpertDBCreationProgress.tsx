import { useState, useEffect } from 'react';

interface ExpertDBCreationProgressProps {
  onCancel?: () => void;
  onComplete?: () => void;
}

export function ExpertDBCreationProgress({ onCancel, onComplete }: ExpertDBCreationProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          if (onComplete) onComplete();
          return 100;
        }
        return prev + 2;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [onComplete]);

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
                <div style={{ width: '178px', height: '34px', left: '616px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
                  <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 생성 및 문서 분류</div>
                </div>
                <div style={{ left: '802px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
                <div style={{ width: '166px', height: '32px', left: '812px', top: '1px', position: 'absolute', background: '#5A6F95', borderRadius: '4px' }}>
                  <div style={{ left: '16px', top: '8px', position: 'absolute', color: 'white', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 전문가 DB 생성</div>
                </div>
                <div style={{ left: '986px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
                <div style={{ width: '136px', height: '34px', left: '996px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
                  <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 생성 완료</div>
                </div>
              </div>
              <div style={{ left: '17px', top: '17px', position: 'absolute', color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>생성된 카테고리와 사용자의 사용 이력을 이용하여 카테고리 전문가와 목록을 생성합니다.</div>
              <div style={{ width: '1302px', height: '400.50px', left: '17px', top: '132px', position: 'absolute' }}>
                <div style={{ width: '120px', height: '100px', left: '591px', top: '0px', position: 'absolute', overflow: 'hidden' }}>
                  <div style={{ width: '120px', height: '100px', left: '0px', top: '0px', position: 'absolute', background: '#DDDDDD', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="animate-spin" style={{ width: '50px', height: '50px', border: '5px solid #999999', borderTopColor: '#4A658F', borderRadius: '50%' }}></div>
                  </div>
                </div>
                <div style={{ width: '576px', height: '32px', left: '363px', top: '198.50px', position: 'absolute' }}>
                  <div style={{ width: '576px', height: '16px', left: '0px', top: '0px', position: 'absolute' }}>
                    <div style={{ left: '0px', top: '0px', position: 'absolute', color: '#4A658F', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>작업 진행 중...</div>
                    <div style={{ left: '558.66px', top: '0px', position: 'absolute', color: '#999999', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>{progress}%</div>
                  </div>
                  <div style={{ width: '576px', height: '12px', left: '0px', top: '20px', position: 'absolute', background: '#E5E5E5', borderRadius: '9999px' }}>
                    <div style={{ width: `${progress * 5.76}px`, height: '12px', left: '0px', top: '0px', position: 'absolute', background: '#4A658F', borderRadius: '9999px' }}></div>
                  </div>
                </div>
                <div style={{ width: '576px', height: '72px', left: '363px', top: '262.50px', position: 'absolute' }}>
                  <div style={{ width: '576px', height: '24px', left: '0px', top: '0px', position: 'absolute' }}>
                    <div style={{ left: '1px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 최대 생성 단계</div>
                    <div style={{ left: '544.31px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>1단계</div>
                  </div>
                  <div style={{ width: '576px', height: '24px', left: '0px', top: '24px', position: 'absolute' }}>
                    <div style={{ left: '1px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word' }}>생성 시작 시간</div>
                    <div style={{ left: '463.56px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>2024-09-12 12:14:02</div>
                  </div>
                  <div style={{ width: '576px', height: '24px', left: '0px', top: '48px', position: 'absolute' }}>
                    <div style={{ left: '1px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word' }}>종료 예상 시간</div>
                    <div style={{ left: '463.56px', top: '4px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>2024-09-12 12:15:02</div>
                  </div>
                </div>
                <div
                  onClick={onCancel}
                  style={{ width: '74px', height: '34px', left: '614px', top: '366.50px', position: 'absolute', borderRadius: '4px', border: '1px #E5E5E5 solid', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div style={{ color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>취소</div>
                </div>
                <div style={{ width: '266.23px', height: '39.50px', left: '555px', top: '124px', position: 'absolute' }}>
                  <span style={{ color: '#333333', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '19px', wordWrap: 'break-word' }}>생성된 카테고리와 사용자의 사용 이력을 이용하여</span>
                  <span style={{ color: 'black', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '19px', wordWrap: 'break-word' }}> <br /></span>
                  <span style={{ color: '#333333', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '19px', wordWrap: 'break-word' }}>카테고리 전문가와 목록을 생성하고 있습니다.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
