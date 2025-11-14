import { useState } from 'react';
import { ChevronRight, FolderOpen, FileText } from 'lucide-react';

interface SampleDocumentFilteringProps {
  onCancel?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function SampleDocumentFiltering({ onCancel, onPrevious, onNext }: SampleDocumentFilteringProps = {}) {
  const [isAutoClassifyEnabled, setIsAutoClassifyEnabled] = useState(false);
  const [maxDepth, setMaxDepth] = useState(2);

  return (
    <div style={{ width: '1384px', height: '852px', position: 'relative', background: '#F9F9F9' }}>
      <div style={{ width: '1336px', height: '682px', left: '24px', top: '16px', position: 'absolute', background: 'white', boxShadow: '0px 0px 0px rgba(0, 0, 0, 0)', borderRadius: '6px', border: '1px #DDDDDD solid' }}>

        {/* Breadcrumb */}
        <div style={{ width: '1286px', height: '16px', left: '25px', top: '25px', position: 'absolute' }}>
          <div style={{ left: '0px', top: '0px', position: 'absolute', color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 생성 &gt;</div>
          <div style={{ left: '88px', top: '1px', position: 'absolute', color: '#3DD4F5', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word' }}>수동 생성</div>
        </div>

        {/* Description */}
        <div style={{ left: '25px', top: '57px', position: 'absolute', color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>관리자가 카테고리를 수동으로 생성하고, AI가 자동으로 문서를 분류합니다.</div>

        {/* Workflow Steps */}
        <div style={{ width: '1286px', height: '34px', left: '25px', top: '97px', position: 'absolute' }}>
          <div style={{ width: '205px', height: '34px', left: '131.50px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
            <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 편집 및 샘플 문서 등록</div>
          </div>
          <div style={{ width: '4.50px', height: '12px', left: '344.75px', top: '11px', position: 'absolute', overflow: 'hidden' }}>
            <ChevronRight style={{ width: '3.95px', height: '6.97px', left: '0px', top: '2.51px', position: 'absolute', color: '#666666' }} />
          </div>
          <div style={{ width: '254px', height: '32px', left: '357.50px', top: '1px', position: 'absolute', background: '#5A6F95', borderRadius: '4px' }}>
            <div style={{ left: '16px', top: '8px', position: 'absolute', color: 'white', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word' }}>미분류 문서 카테고리 자동 생성 여부 선택</div>
          </div>
          <div style={{ width: '4.50px', height: '12px', left: '619.75px', top: '11px', position: 'absolute', overflow: 'hidden' }}>
            <ChevronRight style={{ width: '3.95px', height: '6.97px', left: '0px', top: '2.51px', position: 'absolute', color: '#666666' }} />
          </div>
          <div style={{ width: '178px', height: '34px', left: '632.50px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
            <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 생성 및 문서 분류</div>
          </div>
          <div style={{ width: '4.50px', height: '12px', left: '818.75px', top: '11px', position: 'absolute', overflow: 'hidden' }}>
            <ChevronRight style={{ width: '3.95px', height: '6.97px', left: '0px', top: '2.51px', position: 'absolute', color: '#666666' }} />
          </div>
          <div style={{ width: '166px', height: '34px', left: '831.50px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
            <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 전문가 DB 생성</div>
          </div>
          <div style={{ width: '4.50px', height: '12px', left: '1005.75px', top: '11px', position: 'absolute', overflow: 'hidden' }}>
            <ChevronRight style={{ width: '3.95px', height: '6.97px', left: '0px', top: '2.51px', position: 'absolute', color: '#666666' }} />
          </div>
          <div style={{ width: '136px', height: '34px', left: '1018.50px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
            <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 생성 완료</div>
          </div>
        </div>

        {/* Toggle Section */}
        <div style={{ width: '1286px', height: '24px', left: '25px', top: '163px', position: 'absolute' }}>
          <div style={{ width: '103px', height: '24px', left: '807px', top: '0px', position: 'absolute' }}>
            <button
              onClick={() => setIsAutoClassifyEnabled(!isAutoClassifyEnabled)}
              style={{ width: '44px', height: '24px', left: '0px', top: '0px', position: 'absolute', background: isAutoClassifyEnabled ? '#1C77F6' : '#DDDDDD', borderRadius: '9999px', border: 'none', cursor: 'pointer' }}
            >
              <div style={{ width: '20px', height: '20px', left: isAutoClassifyEnabled ? '22px' : '2px', top: '2px', position: 'absolute', background: 'white', borderRadius: '9999px', border: '1px #DDDDDD solid', transition: 'left 0.2s' }}></div>
            </button>
            <div style={{ left: '52px', top: '4px', position: 'absolute', color: isAutoClassifyEnabled ? '#1C77F6' : '#999999', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>
              {isAutoClassifyEnabled ? '사용' : '사용 안함'}
            </div>
          </div>
          <div style={{ left: '376px', top: '2px', position: 'absolute', color: '#333333', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word' }}>수동 카테고리에 포함할 수 없는 문서를 자동으로 분류 하시겠습니까?</div>
        </div>

        {/* Main Content Box */}
        <div style={{ width: '896px', height: '265px', left: '220px', top: '219px', position: 'absolute', background: 'white', borderRadius: '6px', border: '1px #DDDDDD solid' }}>
          {/* Left Section */}
          <div style={{ width: '395px', height: '92px', left: '37px', top: '70px', position: 'absolute' }}>
            <div style={{ left: '0px', top: '0px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word' }}>카테고리 최대 단계 수를 선택해주세요.</div>
            <div style={{ width: '396px', height: '31px', left: '0px', top: '26.50px', position: 'absolute' }}>
              <span style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word' }}>단계가 높을수록 카테고리 분류 성능이 향상되나,</span>
              <br />
              <span style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word' }}>카테고리 생성 및 문서 분류 작업 시간은 증가합니다.</span>
            </div>
          </div>

          <div style={{ width: '69px', height: '26px', left: '244px', top: '176px', position: 'absolute', background: 'white', borderRadius: '4px', border: '1px black solid' }}>
            <select
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', fontSize: '12px', paddingLeft: '8px', cursor: 'pointer' }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>
          <div style={{ left: '37px', top: '182px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word' }}>카테고리 자동 생성 최대 단계</div>

          {/* Right Section - Auto Category Preview */}
          <div style={{ width: '427px', height: '213px', left: '444px', top: '22px', position: 'absolute', background: '#F2F2F2', borderRadius: '6px' }}>
            <div style={{ width: '395px', height: '16px', left: '32px', top: '53px', position: 'absolute' }}>
              <FolderOpen style={{ width: '8.75px', height: '14px', left: '0.12px', top: '1px', position: 'absolute', color: '#666666' }} />
              <FileText style={{ width: '12px', height: '12px', left: '17px', top: '2px', position: 'absolute', color: '#666666' }} />
              <div style={{ width: '94px', height: '16px', left: '33px', top: '0px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word' }}>자동 카테고리(4)</div>
            </div>
            <div style={{ width: '371px', height: '16px', left: '69px', top: '99px', position: 'absolute' }}>
              <FileText style={{ width: '12px', height: '12px', left: '0px', top: '2px', position: 'absolute', color: '#999999' }} />
              <div style={{ left: '20px', top: '0px', position: 'absolute', color: '#999999', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>영업</div>
            </div>
            <div style={{ width: '395px', height: '36px', left: '69px', top: '124px', position: 'absolute' }}>
              <div style={{ width: '371px', height: '16px', left: '0px', top: '2px', position: 'absolute' }}>
                <FileText style={{ width: '12px', height: '12px', left: '0px', top: '2px', position: 'absolute', color: '#999999' }} />
                <div style={{ left: '20px', top: '0px', position: 'absolute', color: '#999999', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>경영지원</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Buttons */}
        <div style={{ width: '1286px', height: '26px', left: '25px', top: '539px', position: 'absolute' }}>
          <div
            onClick={onCancel}
            style={{ width: '74px', height: '26px', left: '516px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <div style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>취소</div>
          </div>
          <div
            onClick={onPrevious}
            style={{ width: '74px', height: '26px', left: '606px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <div style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>이전</div>
          </div>
          <div
            onClick={onNext}
            style={{ width: '74px', height: '26px', left: '696px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <div style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>다음</div>
          </div>
        </div>
      </div>
    </div>
  );
}
