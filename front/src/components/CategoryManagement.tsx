import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, Plus, Trash2, Copy, Upload, CheckCircle, XCircle, Clock, X, Loader2 } from 'lucide-react';
import image1 from 'figma:asset/2046b3b04149a758bc19f31cfe38eee6466cbee0.png';
import image2 from 'figma:asset/f782915855c349f05743333beb1aa130e51428ab.png';
import illustration1 from 'figma:asset/302e6b6fd269b836fb670c2dfb696700199d47a2.png';
import { SampleDocumentFiltering } from './SampleDocumentFiltering';
import { FilteringProgress } from './FilteringProgress';
import { CategoryCreationProgress } from './CategoryCreationProgress';
import { ExpertDBCreationProgress } from './ExpertDBCreationProgress';
import { CategoryCreationComplete } from './CategoryCreationComplete';

type Step = 'select' | 'auto-level' | 'manual-edit' | 'auto-category' | 'processing' | 'db-creation' | 'complete';

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.6875 3.5H7.4375L5.6875 1.75H1.3125C0.587617 1.75 0 2.33762 0 3.0625V10.9375C0 11.6624 0.587617 12.25 1.3125 12.25H12.6875C13.4124 12.25 14 11.6624 14 10.9375V4.8125C14 4.08762 13.4124 3.5 12.6875 3.5Z" fill="#F7B500"/>
  </svg>
);

const DisabledFolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.6875 3.5H7.4375L5.6875 1.75H1.3125C0.587617 1.75 0 2.33762 0 3.0625V10.9375C0 11.6624 0.587617 12.25 1.3125 12.25H12.6875C13.4124 12.25 14 11.6624 14 10.9375V4.8125C14 4.08762 13.4124 3.5 12.6875 3.5Z" fill="#999999"/>
  </svg>
);

const CheckboxIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_checkbox)">
      <path d="M9.75001 1.08334H3.25001C2.05339 1.08334 1.08334 2.05339 1.08334 3.25001V9.75001C1.08334 10.9466 2.05339 11.9167 3.25001 11.9167H9.75001C10.9466 11.9167 11.9167 10.9466 11.9167 9.75001V3.25001C11.9167 2.05339 10.9466 1.08334 9.75001 1.08334Z" fill="#1C77F6" stroke="#1C77F6" strokeWidth="2"/>
      <path d="M3.25 6.50001L5.41667 8.66668L9.75 4.33334" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs>
      <clipPath id="clip0_checkbox">
        <rect width="13" height="13" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

export function CategoryManagement() {
  const [step, setStep] = useState<Step>('select');
  const [creationType, setCreationType] = useState<'auto' | 'manual' | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [autoGenerateLevel, setAutoGenerateLevel] = useState<1 | 2 | 3 | 4>(2);
  const [showWorkTimeModal, setShowWorkTimeModal] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentProcessingTask, setCurrentProcessingTask] = useState('');
  const [isFilteringInProgress, setIsFilteringInProgress] = useState(false);
  const [filteringComplete, setFilteringComplete] = useState(false);
  const [sampleDocuments, setSampleDocuments] = useState<Array<{
    name: string;
    category: string;
    quality: number;
    status: 'pass' | 'fail';
  }>>([]);

  // 진행상황 시뮬레이션
  useEffect(() => {
    if (step === 'processing') {
      let progress = 0;
      const tasks = [
        '문서 분석 중...',
        '유사도 계산 중...',
        '카테고리 생성 중...',
        '문서 분류 중...',
        '분류 결과 검증 중...'
      ];

      const interval = setInterval(() => {
        progress += 1;
        setProcessingProgress(progress);

        const taskIndex = Math.floor((progress / 100) * tasks.length);
        if (taskIndex < tasks.length) {
          setCurrentProcessingTask(tasks[taskIndex]);
        }

        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => setStep('db-creation'), 500);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [step]);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // 자동 생성 선택
  const handleAutoSelect = () => {
    setCreationType('auto');
    setStep('auto-level');
  };

  // 수동 생성 선택
  const handleManualSelect = () => {
    setCreationType('manual');
    setStep('manual-edit');
  };

  // 샘플 필터링 시작
  const handleStartFiltering = () => {
    setIsFilteringInProgress(true);

    // 필터링 시뮬레이션 (3초 후 완료)
    setTimeout(() => {
      setIsFilteringInProgress(false);
      setFilteringComplete(true);
      // 샘플 문서 결과 설정
      setSampleDocuments([
        { name: '2024년_1분기_재무보고서.pdf', category: '재무보고서', quality: 95, status: 'pass' },
        { name: '재무제표_분석_2024.pdf', category: '재무보고서', quality: 88, status: 'pass' },
        { name: '회의록_임시파일.pdf', category: '재무보고서', quality: 42, status: 'fail' }
      ]);
    }, 3000);
  };

  // 프로세스 플로우 렌더링
  const renderProcessFlow = () => {
    if (creationType === 'auto') {
      return (
        <div className="flex items-center justify-center gap-3">
          <div className={`px-6 py-3 rounded text-sm font-medium ${step === 'select' ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>
            자동생성
          </div>
          <div className="text-gray-400">→</div>
          <div className={`px-6 py-3 rounded text-sm ${step === 'auto-level' ? 'bg-blue-600 text-white font-medium' : 'border border-gray-300 bg-white text-gray-700'}`}>
            카테고리 최대 단계 선택
          </div>
          <div className="text-gray-400">→</div>
          <div className={`px-6 py-3 rounded text-sm ${step === 'processing' ? 'bg-blue-600 text-white font-medium' : 'border border-gray-300 bg-white text-gray-700'}`}>
            카테고리 생성 및 문서 분류
          </div>
          <div className="text-gray-400">→</div>
          <div className={`px-6 py-3 rounded text-sm ${step === 'db-creation' ? 'bg-blue-600 text-white font-medium' : 'border border-gray-300 bg-white text-gray-700'}`}>
            카테고리 전문가 DB생성
          </div>
          <div className="text-gray-400">→</div>
          <div className={`px-6 py-3 rounded text-sm ${step === 'complete' ? 'bg-blue-600 text-white font-medium' : 'border border-gray-300 bg-white text-gray-700'}`}>
            카테고리 생성 완료
          </div>
        </div>
      );
    } else if (creationType === 'manual') {
      return (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <div className={`px-6 py-3 rounded text-sm font-medium ${step === 'select' ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>
            수동생성
          </div>
          <div className="text-gray-400">→</div>
          <div className={`px-6 py-3 rounded text-sm ${step === 'manual-edit' ? 'bg-blue-600 text-white font-medium' : 'border border-gray-300 bg-white text-gray-700'}`}>
            카테고리 편집 및 샘플 문서 등록
          </div>
          <div className="text-gray-400">→</div>
          <div className={`px-6 py-3 rounded text-sm ${step === 'auto-category' ? 'bg-blue-600 text-white font-medium' : 'border border-gray-300 bg-white text-gray-700'}`}>
            미분류 문서 자동생성 선택
          </div>
          <div className="text-gray-400">→</div>
          <div className={`px-6 py-3 rounded text-sm ${step === 'processing' ? 'bg-blue-600 text-white font-medium' : 'border border-gray-300 bg-white text-gray-700'}`}>
            카테고리 생성 및 문서 분류
          </div>
          <div className="text-gray-400">→</div>
          <div className={`px-6 py-3 rounded text-sm ${step === 'db-creation' ? 'bg-blue-600 text-white font-medium' : 'border border-gray-300 bg-white text-gray-700'}`}>
            카테고리 전문가 DB생성
          </div>
          <div className="text-gray-400">→</div>
          <div className={`px-6 py-3 rounded text-sm ${step === 'complete' ? 'bg-blue-600 text-white font-medium' : 'border border-gray-300 bg-white text-gray-700'}`}>
            카테고리 생성 완료
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white min-h-screen">

      {/* Main Content - 생성 방법 선택 */}
      {step === 'select' && (
        <div style={{width: '1336px', height: '536px', position: 'relative', background: '#F3F3F3', borderRadius: '6px'}}>
          <div style={{width: '1288px', height: '200px', left: '24px', top: '24px', position: 'absolute'}}>
            <div style={{width: '1288px', height: '63px', left: '0px', top: '51px', position: 'absolute'}}>
              <div style={{width: '64px', height: '31px', left: '0px', top: '16px', position: 'absolute', background: '#2196F3', borderRadius: '2px'}}>
                <div style={{left: '12px', top: '8px', position: 'absolute', color: 'white', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>자동생성</div>
              </div>
              <div style={{left: '92px', top: '25px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>→</div>
              <div style={{left: '170px', top: '24px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>→</div>
              <div style={{width: '120px', height: '48px', left: '120px', top: '7px', position: 'absolute', background: 'white', borderRadius: '2px', outline: '1px #CCCCCC solid', outlineOffset: '-1px'}}>
                <div style={{width: '121px', height: '49px', left: '30px', top: '10px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>    카테고리<br/>최고 선택 단계</div>
              </div>
              <div style={{left: '349px', top: '21px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>→</div>
            </div>
            <div style={{width: '1288px', height: '78px', left: '0px', top: '122px', position: 'absolute'}}>
              <div style={{width: '64px', height: '31px', left: '0px', top: '23.50px', position: 'absolute', background: '#4A627A', borderRadius: '2px'}}>
                <div style={{left: '12px', top: '8px', position: 'absolute', color: 'white', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>수동생성</div>
              </div>
              <div style={{width: '120px', height: '48px', left: '123px', top: '15px', position: 'absolute', background: 'white', borderRadius: '2px', outline: '1px #CCCCCC solid', outlineOffset: '-1px'}}>
                <div style={{width: '121px', height: '49px', left: '24px', top: '10px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>카테고리 편집 및<br/>  샘플 문서 등록</div>
              </div>
              <div style={{left: '89px', top: '31px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>→</div>
              <div style={{left: '249px', top: '35px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>→</div>
              <div style={{width: '145px', height: '55px', left: '283px', top: '12px', position: 'absolute', background: 'white', borderRadius: '2px', outline: '1px #CCCCCC solid', outlineOffset: '-1px'}}>
                <div style={{width: '89px', height: '61px', left: '41px', top: '7px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>미분류 문서<br/>카테고리 자동 생성<br/>여부 선택</div>
              </div>
              <div style={{width: '120px', height: '123px', left: '483px', top: '-60px', position: 'absolute', background: 'white', borderRadius: '2px', outline: '1px #CCCCCC solid', outlineOffset: '-1px'}}>
                <div style={{width: '121px', height: '49px', left: '32px', top: '44px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>카테고리 생성<br/>및 문서 분류</div>
              </div>
              <div style={{width: '96px', height: '123px', left: '686px', top: '-60px', position: 'absolute', background: 'white', borderRadius: '2px', outline: '1px #CCCCCC solid', outlineOffset: '-1px'}}>
                <div style={{width: '97px', height: '64px', left: '13px', top: '47px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>카테고리 전문가<br/>DB 생성</div>
              </div>
              <div style={{width: '96px', height: '123px', left: '865px', top: '-60px', position: 'absolute', background: 'white', borderRadius: '2px', border: '1px #CCCCCC solid'}}></div>
              <div style={{left: '443px', top: '31px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>→</div>
              <div style={{left: '826px', top: '-5px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>→</div>
              <div style={{width: '97px', height: '49px', left: '893px', top: '-16px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>카테고리<br/>생성 완료</div>
            </div>
            <div style={{left: '634px', top: '115px', position: 'absolute', color: '#333333', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>→</div>
            <div style={{left: '0px', top: '0px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 생성 프로세스</div>
            <div style={{left: '0px', top: '20px', position: 'absolute', color: '#666666', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word'}}>자동 생성 또는 수동 생성을 선택할 수 있습니다.</div>
          </div>
          <div style={{width: '1288px', height: '248px', left: '24px', top: '264px', position: 'absolute'}}>
            <div style={{width: '240px', height: '248px', left: '324px', top: '0px', position: 'absolute'}}>
              <img style={{width: '120px', height: '100px', left: '60px', top: '0px', position: 'absolute'}} src="https://placehold.co/120x100" />
              <div onClick={handleAutoSelect} style={{width: '96px', height: '28px', left: '72px', top: '201px', position: 'absolute', borderRadius: '2px', outline: '1px #CCCCCC solid', outlineOffset: '-1px', cursor: 'pointer'}}>
                <div style={{left: '36px', top: '5px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word'}}>실행</div>
              </div>
              <div style={{left: '88px', top: '116px', position: 'absolute', color: '#333333', fontSize: '16px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '24px', wordWrap: 'break-word'}}>자동생성</div>
              <div style={{width: '231.12px', height: '27px', left: '0px', top: '146px', position: 'absolute', color: '#666666', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word'}}>AI가 카테고리를 자동으로 생성하고, 자동으로 문서도 분류합니다.</div>
            </div>
            <div style={{width: '240px', height: '248px', left: '724px', top: '0px', position: 'absolute'}}>
              <img style={{width: '120px', height: '100px', left: '60px', top: '0px', position: 'absolute'}} src="https://placehold.co/120x100" />
              <div style={{width: '240px', height: '60px', left: '0px', top: '144px', position: 'absolute'}}>
                <div style={{width: '231.12px', height: '27px', left: '0px', top: '2px', position: 'absolute', color: '#666666', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word'}}>관리자가 카테고리를 수동으로 생성하고, AI가 자동으로 문서를 분류합니다.</div>
                <div style={{width: '231.67px', height: '27px', left: '0px', top: '32px', position: 'absolute', color: '#666666', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word'}}>미 분류된 문서는 카테고리 자동 생성도 가능합니다.</div>
              </div>
              <div onClick={handleManualSelect} style={{width: '96px', height: '28px', left: '68px', top: '204px', position: 'absolute', borderRadius: '2px', outline: '1px #CCCCCC solid', outlineOffset: '-1px', cursor: 'pointer'}}>
                <div style={{left: '36px', top: '5px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word'}}>실행</div>
              </div>
              <div style={{left: '88px', top: '116px', position: 'absolute', color: '#333333', fontSize: '16px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '24px', wordWrap: 'break-word'}}>수동생성</div>
            </div>
          </div>
        </div>
      )}

      {/* 자동생성 - 카테고리 최대 단계 선택 */}
      {step === 'auto-level' && (
        <div style={{width: 1440, height: 862, position: 'relative', background: 'white'}}>
          {/* Main Container */}
          <div style={{width: 1392, height: 862, left: 48, top: 0, position: 'absolute'}}>
            {/* Process Steps */}
            <div style={{width: 1360, height: 40, left: 16, top: 16, position: 'absolute'}}>
              <div style={{width: 220, height: 36, left: 0, top: 2, position: 'absolute', background: '#2F4F8A', borderRadius: 4}}>
                <div style={{left: 16, top: 10, position: 'absolute', color: 'white', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 최대 단계 선택</div>
              </div>
              <div style={{width: 220, height: 40, left: 230, top: 0, position: 'absolute', background: '#F9F9F9', borderRadius: 4, border: '1px solid #DDDDDD'}}>
                <div style={{left: 16, top: 12, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 생성 및 문서 분류</div>
              </div>
              <div style={{width: 200, height: 40, left: 460, top: 0, position: 'absolute', background: '#F9F9F9', borderRadius: 4, border: '1px solid #DDDDDD'}}>
                <div style={{left: 16, top: 12, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 전문가 DB 생성</div>
              </div>
              <div style={{width: 150, height: 40, left: 670, top: 0, position: 'absolute', background: '#F9F9F9', borderRadius: 4, border: '1px solid #DDDDDD'}}>
                <div style={{left: 16, top: 12, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 생성 완료</div>
              </div>
            </div>

            {/* Title */}
            <div style={{width: 1360, height: 80, left: 16, top: 80, position: 'absolute'}}>
              <div style={{left: 0, top: 0, position: 'absolute', color: '#333333', fontSize: 20, fontFamily: 'Roboto', fontWeight: '700', lineHeight: '28px', wordWrap: 'break-word'}}>
                카테고리 최대 단계 선택
              </div>
              <div style={{left: 0, top: 40, position: 'absolute', color: '#666666', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>
                AI가 자동으로 생성할 카테고리의 최대 계층 단계를 선택해주세요.
              </div>
            </div>

            {/* Content Area */}
            <div style={{width: 1360, height: 600, left: 16, top: 180, position: 'absolute'}}>
              {/* Level Options */}
              <div style={{width: 1360, display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center'}}>
                {/* Level 1 */}
                <div
                  onClick={() => setAutoGenerateLevel(1)}
                  style={{
                    width: 280,
                    height: 320,
                    padding: 24,
                    background: autoGenerateLevel === 1 ? '#EEF2FF' : 'white',
                    border: autoGenerateLevel === 1 ? '2px solid #2F4F8A' : '1px solid #E5E5E5',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (autoGenerateLevel !== 1) {
                      e.currentTarget.style.borderColor = '#999999';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (autoGenerateLevel !== 1) {
                      e.currentTarget.style.borderColor = '#E5E5E5';
                    }
                  }}
                >
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 48, fontWeight: '700', color: autoGenerateLevel === 1 ? '#2F4F8A' : '#666666', marginBottom: 16}}>1단계</div>
                    <div style={{fontSize: 14, fontWeight: '600', color: '#333333', marginBottom: 12}}>단일 계층</div>
                    <div style={{fontSize: 12, color: '#666666', lineHeight: '18px'}}>
                      최상위 카테고리만 생성<br/>
                      (예: 재무보고서, 인사관리)
                    </div>
                  </div>
                  <div style={{width: '100%', padding: 12, background: autoGenerateLevel === 1 ? '#2F4F8A' : '#F9F9F9', borderRadius: 4, textAlign: 'center', color: autoGenerateLevel === 1 ? 'white' : '#666666', fontSize: 11}}>
                    가장 간단한 구조
                  </div>
                </div>

                {/* Level 2 */}
                <div
                  onClick={() => setAutoGenerateLevel(2)}
                  style={{
                    width: 280,
                    height: 320,
                    padding: 24,
                    background: autoGenerateLevel === 2 ? '#EEF2FF' : 'white',
                    border: autoGenerateLevel === 2 ? '2px solid #2F4F8A' : '1px solid #E5E5E5',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (autoGenerateLevel !== 2) {
                      e.currentTarget.style.borderColor = '#999999';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (autoGenerateLevel !== 2) {
                      e.currentTarget.style.borderColor = '#E5E5E5';
                    }
                  }}
                >
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 48, fontWeight: '700', color: autoGenerateLevel === 2 ? '#2F4F8A' : '#666666', marginBottom: 16}}>2단계</div>
                    <div style={{fontSize: 14, fontWeight: '600', color: '#333333', marginBottom: 12}}>2계층 구조</div>
                    <div style={{fontSize: 12, color: '#666666', lineHeight: '18px'}}>
                      대분류 + 중분류<br/>
                      (예: 재무보고서 &gt; 분기별)
                    </div>
                  </div>
                  <div style={{width: '100%', padding: 12, background: autoGenerateLevel === 2 ? '#2F4F8A' : '#F9F9F9', borderRadius: 4, textAlign: 'center', color: autoGenerateLevel === 2 ? 'white' : '#666666', fontSize: 11}}>
                    권장 설정
                  </div>
                </div>

                {/* Level 3 */}
                <div
                  onClick={() => setAutoGenerateLevel(3)}
                  style={{
                    width: 280,
                    height: 320,
                    padding: 24,
                    background: autoGenerateLevel === 3 ? '#EEF2FF' : 'white',
                    border: autoGenerateLevel === 3 ? '2px solid #2F4F8A' : '1px solid #E5E5E5',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (autoGenerateLevel !== 3) {
                      e.currentTarget.style.borderColor = '#999999';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (autoGenerateLevel !== 3) {
                      e.currentTarget.style.borderColor = '#E5E5E5';
                    }
                  }}
                >
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 48, fontWeight: '700', color: autoGenerateLevel === 3 ? '#2F4F8A' : '#666666', marginBottom: 16}}>3단계</div>
                    <div style={{fontSize: 14, fontWeight: '600', color: '#333333', marginBottom: 12}}>3계층 구조</div>
                    <div style={{fontSize: 12, color: '#666666', lineHeight: '18px'}}>
                      대분류 + 중분류 + 소분류<br/>
                      (예: 재무보고서 &gt; 분기별 &gt; 2024)
                    </div>
                  </div>
                  <div style={{width: '100%', padding: 12, background: autoGenerateLevel === 3 ? '#2F4F8A' : '#F9F9F9', borderRadius: 4, textAlign: 'center', color: autoGenerateLevel === 3 ? 'white' : '#666666', fontSize: 11}}>
                    상세 분류
                  </div>
                </div>

                {/* Level 4 */}
                <div
                  onClick={() => setAutoGenerateLevel(4)}
                  style={{
                    width: 280,
                    height: 320,
                    padding: 24,
                    background: autoGenerateLevel === 4 ? '#EEF2FF' : 'white',
                    border: autoGenerateLevel === 4 ? '2px solid #2F4F8A' : '1px solid #E5E5E5',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (autoGenerateLevel !== 4) {
                      e.currentTarget.style.borderColor = '#999999';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (autoGenerateLevel !== 4) {
                      e.currentTarget.style.borderColor = '#E5E5E5';
                    }
                  }}
                >
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 48, fontWeight: '700', color: autoGenerateLevel === 4 ? '#2F4F8A' : '#666666', marginBottom: 16}}>4단계</div>
                    <div style={{fontSize: 14, fontWeight: '600', color: '#333333', marginBottom: 12}}>4계층 구조</div>
                    <div style={{fontSize: 12, color: '#666666', lineHeight: '18px'}}>
                      대분류 + 중분류 + 소분류 + 세분류<br/>
                      (예: 재무보고서 &gt; 분기별 &gt; 2024 &gt; Q1)
                    </div>
                  </div>
                  <div style={{width: '100%', padding: 12, background: autoGenerateLevel === 4 ? '#2F4F8A' : '#F9F9F9', borderRadius: 4, textAlign: 'center', color: autoGenerateLevel === 4 ? 'white' : '#666666', fontSize: 11}}>
                    최대 세분화
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div style={{width: 1360, marginTop: 40, padding: 20, background: '#F9F9F9', borderRadius: 8, border: '1px solid #E5E5E5'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12}}>
                  <div style={{width: 20, height: 20, background: '#2F4F8A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 'bold'}}>!</div>
                  <div style={{fontSize: 14, fontWeight: '600', color: '#333333'}}>참고사항</div>
                </div>
                <div style={{fontSize: 12, color: '#666666', lineHeight: '20px', paddingLeft: 32}}>
                  • 단계가 많을수록 문서가 세밀하게 분류되지만, 처리 시간이 증가할 수 있습니다.<br/>
                  • 대부분의 경우 2-3단계가 적절합니다.<br/>
                  • 선택한 단계 이하로 카테고리가 생성될 수 있습니다. (예: 3단계 선택 시 1-3단계 사이에서 생성)
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div style={{width: 1360, height: 60, left: 16, top: 790, position: 'absolute', background: '#111111', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px'}}>
              <div style={{color: 'white', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px'}}>
                선택한 단계: {autoGenerateLevel}단계 - {autoGenerateLevel === 1 ? '단일 계층' : autoGenerateLevel === 2 ? '2계층 구조 (권장)' : autoGenerateLevel === 3 ? '3계층 구조' : '4계층 구조 (최대)'}
              </div>
              <div style={{display: 'flex', gap: 12}}>
                <div
                  onClick={() => setStep('select')}
                  style={{
                    padding: '8px 24px',
                    border: '1px solid #FFFFFF',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: 13
                  }}
                >
                  이전
                </div>
                <div
                  onClick={() => setStep('processing')}
                  style={{
                    padding: '8px 24px',
                    background: '#2F4F8A',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: 13
                  }}
                >
                  다음
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'manual-edit' && !isFilteringInProgress && (
        <div style={{width: 1440, height: 862, position: 'relative', background: 'white'}}>

          {/* Main Container */}
          <div style={{width: 1392, height: 862, left: 48, top: 0, position: 'absolute'}}>
            {/* Process Steps */}
            <div style={{width: 1360, height: 40, left: 16, top: 16, position: 'absolute'}}>
              <div style={{width: 250, height: 36, left: 0, top: 2, position: 'absolute', background: '#2F4F8A', borderRadius: 4}}>
                <div style={{left: 16, top: 10, position: 'absolute', color: 'white', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 편집 및 샘플 문서 등록</div>
              </div>
              <div style={{width: 300, height: 40, left: 260, top: 0, position: 'absolute', background: '#F9F9F9', borderRadius: 4, border: '1px solid #DDDDDD'}}>
                <div style={{left: 16, top: 12, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>미분류 문서 카테고리 자동 생성 여부 선택</div>
              </div>
              <div style={{width: 220, height: 40, left: 570, top: 0, position: 'absolute', background: '#F9F9F9', borderRadius: 4, border: '1px solid #DDDDDD'}}>
                <div style={{left: 16, top: 12, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 생성 및 문서 분류</div>
              </div>
              <div style={{width: 200, height: 40, left: 800, top: 0, position: 'absolute', background: '#F9F9F9', borderRadius: 4, border: '1px solid #DDDDDD'}}>
                <div style={{left: 16, top: 12, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 전문가 DB 생성</div>
              </div>
              <div style={{width: 150, height: 40, left: 1010, top: 0, position: 'absolute', background: '#F9F9F9', borderRadius: 4, border: '1px solid #DDDDDD'}}>
                <div style={{left: 16, top: 12, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 생성 완료</div>
              </div>
            </div>

            {/* Instructions */}
            <div style={{width: 900, height: 57.19, left: 16, top: 57.59, position: 'absolute'}}>
              <div style={{left: 0, top: 0.15, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>① 아래 좌측 화면에서 사용할 카테고리 목록을 편집합니다.</div>
              <div style={{left: 0, top: 14.45, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>② 생성한 카테고리에 분류하기를 원하는 샘플 문서를 등록해주세요.</div>
              <div style={{left: 0, top: 28.74, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>③ 샘플 문서까지 등록 완료한 후 우측 아래 "샘플 문서 필터링"을 클릭하면 샘플 문서 필터링 작업을 수행합니다.</div>
              <div style={{left: 0, top: 43.04, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>④ 필터링 완료 후 우측 아래 "다음"을 클릭하면 '미분류 문서 카테고리 자동 생성 여부 선택' 단계로 넘어갑니다.</div>
            </div>

            {/* Main Content Container */}
            <div style={{width: 1360, height: 667.62, left: 16, top: 130.78, position: 'absolute', borderRadius: 2, border: '1px solid #DDDDDD'}}>
              {/* Left Panel - Category Tree */}
              <div style={{width: 380, height: 665.62, left: 1, top: 1, position: 'absolute', borderRight: '1px solid #DDDDDD'}}>
                {/* Category Header */}
                <div style={{width: 355, height: 15.59, left: 12, top: 12, position: 'absolute'}}>
                  <div style={{left: 0, top: 0.30, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>카테고리</div>
                  <div style={{width: 12, height: 12, left: 343, top: 1.80, position: 'absolute'}}>
                    <Search style={{width: 12, height: 12, color: '#666666'}} />
                  </div>
                </div>

                {/* Filter Controls */}
                <div style={{width: 355, height: 58.59, left: 12, top: 35.59, position: 'absolute'}}>
                  <div style={{width: 113, height: 26, left: 0, top: 29.62, position: 'absolute', background: '#EFEFEF', borderRadius: 2, border: '1px solid #CCCCCC'}} />
                  <div style={{left: 0, top: 0.15, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>카테고리 상태</div>

                  <div style={{width: 113, height: 26, left: 121, top: 32.62, position: 'absolute', background: '#EFEFEF', borderRadius: 2, border: '1px solid #CCCCCC'}} />
                  <div style={{width: 114, height: 29.59, left: 121, top: 1.15, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>카테고리 샘플문서 상태</div>

                  <div style={{width: 89.34, height: 25.59, left: 242, top: 33, position: 'absolute', borderRadius: 2, border: '1px solid #CCCCCC'}}>
                    <div style={{left: 13, top: 5.30, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word'}}>필터 초기화</div>
                  </div>
                </div>

                {/* Category Tree */}
                <div style={{width: 355, height: 137.34, left: 12, top: 106.19, position: 'absolute'}}>
                  {/* Manual Category Header */}
                  <div style={{width: 355, height: 16.89, left: 0, top: 0, position: 'absolute'}}>
                    <div style={{width: 14, height: 14, left: 0, top: 1.44, position: 'absolute'}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M13.3273 8.63243L12.1625 7.95977C12.2801 7.3254 12.2801 6.67462 12.1625 6.04024L13.3273 5.36759C13.4613 5.29102 13.5215 5.13243 13.4777 4.98477C13.1742 4.01134 12.6574 3.13087 11.982 2.39805C11.8781 2.28594 11.7086 2.2586 11.5773 2.33516L10.4125 3.00782C9.92305 2.58673 9.35977 2.26134 8.75 2.04805V0.705476C8.75 0.552351 8.64336 0.418367 8.49297 0.385554C7.48946 0.161335 6.46133 0.172273 5.50703 0.385554C5.35664 0.418367 5.25 0.552351 5.25 0.705476V2.05079C4.64297 2.2668 4.07969 2.59219 3.5875 3.01055L2.42539 2.3379C2.29141 2.26134 2.12461 2.28594 2.02071 2.40079C1.34531 3.13087 0.828518 4.01134 0.525003 4.98751C0.478518 5.13516 0.541409 5.29376 0.675393 5.37032L1.84024 6.04298C1.72266 6.67735 1.72266 7.32813 1.84024 7.96251L0.675393 8.63516C0.541409 8.71173 0.481253 8.87032 0.525003 9.01798C0.828518 9.99141 1.34531 10.8719 2.02071 11.6047C2.12461 11.7168 2.29414 11.7441 2.42539 11.6676L3.59024 10.9949C4.07969 11.416 4.64297 11.7414 5.25274 11.9547V13.3C5.25274 13.4531 5.35938 13.5871 5.50977 13.6199C6.51328 13.8441 7.54141 13.8332 8.49571 13.6199C8.6461 13.5871 8.75274 13.4531 8.75274 13.3V11.9547C9.35977 11.7387 9.92305 11.4133 10.4152 10.9949L11.5801 11.6676C11.7141 11.7441 11.8809 11.7195 11.9848 11.6047C12.6602 10.8746 13.177 9.99415 13.4805 9.01798C13.5215 8.86759 13.4613 8.70899 13.3273 8.63243ZM7 9.18751C5.79414 9.18751 4.8125 8.20587 4.8125 7.00001C4.8125 5.79415 5.79414 4.81251 7 4.81251C8.20586 4.81251 9.1875 5.79415 9.1875 7.00001C9.1875 8.20587 8.20586 9.18751 7 9.18751Z" fill="#666666"/>
                      </svg>
                    </div>
                    <div style={{left: 18, top: 0.45, position: 'absolute', color: '#333333', fontSize: 13, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word'}}>카테고리 수동 생성</div>
                  </div>

                  {/* Category Items */}
                  <div style={{width: 339, height: 96.45, left: 16, top: 20.89, position: 'absolute'}}>
                    {/* 금융통화위원회 */}
                    <div
                      onClick={() => setSelectedCategory('finance')}
                      style={{width: 339, height: 16.89, left: 0, top: 0, position: 'absolute', cursor: 'pointer'}}
                    >
                      <div style={{width: 13, height: 13, left: 0, top: 1.94, position: 'absolute'}}>
                        <FolderIcon />
                      </div>
                      <div style={{left: 17, top: 0.45, position: 'absolute', color: '#333333', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>금융통화위원회</div>
                    </div>

                    {/* 보고서 */}
                    <div style={{width: 339, height: 75.56, left: 0, top: 20.89, position: 'absolute'}}>
                      <div
                        onClick={() => {
                          toggleNode('reports');
                          setSelectedCategory('reports');
                        }}
                        style={{width: 339, height: 16.89, left: 0, top: 0, position: 'absolute', cursor: 'pointer'}}
                      >
                        <div style={{width: 14.62, height: 13, left: 0.19, top: 1.94, position: 'absolute'}}>
                          <FolderIcon />
                        </div>
                        <div style={{left: 19, top: 0.45, position: 'absolute', color: '#333333', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>보고서</div>
                      </div>

                      {expandedNodes.has('reports') && (
                        <div style={{width: 315, height: 58.67, left: 24, top: 16.89, position: 'absolute'}}>
                          {/* 지급결제보고서 */}
                          <div
                            onClick={() => setSelectedCategory('payment')}
                            style={{width: 315, height: 16.89, left: 0, top: 0, position: 'absolute', cursor: 'pointer'}}
                          >
                            <div style={{width: 13, height: 13, left: 0, top: 1.94, position: 'absolute'}}>
                              <FolderIcon />
                            </div>
                            <div style={{left: 17, top: 0.45, position: 'absolute', color: '#333333', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>지급결제보고서</div>
                          </div>

                          {/* 금융안정보고서 */}
                          <div
                            onClick={() => setSelectedCategory('stability')}
                            style={{width: 315, height: 16.89, left: 0, top: 20.89, position: 'absolute', cursor: 'pointer'}}
                          >
                            <div style={{width: 13, height: 13, left: 0, top: 1.94, position: 'absolute'}}>
                              <FolderIcon />
                            </div>
                            <div style={{left: 17, top: 0.45, position: 'absolute', color: '#333333', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>금융안정보고서</div>
                          </div>

                          {/* 통화신용정책보고서 */}
                          <div
                            onClick={() => setSelectedCategory('monetary')}
                            style={{width: 315, height: 16.89, left: 0, top: 41.78, position: 'absolute', cursor: 'pointer'}}
                          >
                            <div style={{width: 13, height: 13, left: 0, top: 1.94, position: 'absolute'}}>
                              <FolderIcon />
                            </div>
                            <div style={{left: 17, top: 0.45, position: 'absolute', color: '#333333', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>통화신용정책보고서</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel - Document Table */}
              <div style={{width: 978, height: 665.62, left: 381, top: 1, position: 'absolute'}}>
                {/* Table Header */}
                <div style={{width: 978, height: 38.59, left: 0, top: 0, position: 'absolute', borderBottom: '1px solid #DDDDDD'}}>
                  <div style={{left: 12, top: 12.64, position: 'absolute'}}>
                    <span style={{color: '#333333', fontSize: 11, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '14px'}}>통화신용정책보고서</span>
                    <span style={{color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '14px'}}> (샘플 문서 추천 수량: </span>
                    <span style={{color: '#2F4F8A', fontSize: 11, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '14px'}}>등록</span>
                    <span style={{color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '14px'}}> 10개 이상)</span>
                  </div>

                  <div style={{width: 98.67, height: 23.59, left: 491.14, top: 7, position: 'absolute', background: '#2F4F8A', borderRadius: 2}}>
                    <div style={{left: 12, top: 4.30, position: 'absolute', color: 'white', fontSize: 12, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '15px', wordWrap: 'break-word'}}>샘플문서({filteringComplete ? sampleDocuments.length : 6}건)</div>
                  </div>

                  <div style={{width: 180, height: 29.59, left: 785.98, top: 4, position: 'absolute', borderRadius: 2, border: '1px solid #DDDDDD'}}>
                    <div style={{width: 11, height: 11, left: 172, top: 9.30, position: 'absolute'}}>
                      <Search style={{width: 11, height: 11, color: '#666666'}} />
                    </div>
                  </div>
                </div>

                {/* Filter Section */}
                <div style={{width: 978, height: 61.30, left: 0, top: 38.59, position: 'absolute', borderBottom: '1px solid #DDDDDD'}}>
                  <div style={{width: 190.80, height: 44.30, left: 12, top: 8, position: 'absolute'}}>
                    <div style={{left: 0, top: 0.15, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>등록일</div>
                    <div style={{width: 190.80, height: 26, left: 0, top: 18.30, position: 'absolute', background: '#EFEFEF', borderRadius: 2, border: '1px solid #CCCCCC'}} />
                  </div>

                  <div style={{width: 190.80, height: 44.30, left: 214.80, top: 8, position: 'absolute'}}>
                    <div style={{left: 0, top: 0.15, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>필터링 결과</div>
                    <div style={{width: 190.80, height: 26, left: 0, top: 18.30, position: 'absolute', background: '#EFEFEF', borderRadius: 2, border: '1px solid #CCCCCC'}} />
                  </div>

                  <div style={{width: 190.80, height: 44.30, left: 417.59, top: 8, position: 'absolute'}}>
                    <div style={{left: 0, top: 0.15, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>샘플문서 사용 여부</div>
                    <div style={{width: 190.80, height: 26, left: 0, top: 18.30, position: 'absolute', background: '#EFEFEF', borderRadius: 2, border: '1px solid #CCCCCC'}} />
                  </div>

                  <div style={{width: 89.34, height: 25.59, left: 620.39, top: 26.70, position: 'absolute', borderRadius: 2, border: '1px solid #CCCCCC', cursor: 'pointer'}}>
                    <div style={{left: 13, top: 5.30, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word'}}>필터 초기화</div>
                  </div>
                </div>

                {/* Table Content */}
                <div style={{width: 978, height: 213, left: 0, top: 99.89, position: 'absolute'}}>
                  {/* Table Header Row */}
                  <div style={{width: 978, height: 50.50, left: 0, top: 0, position: 'absolute', background: '#F9F9F9', borderBottom: '1px solid #DDDDDD'}}>
                    <div style={{width: 30, height: 50.50, left: 0, top: 0, position: 'absolute', borderRight: '1px solid #DDDDDD'}}>
                      <div style={{width: 13, height: 13, left: 8.25, top: 18.50, position: 'absolute'}}>
                        <CheckboxIcon />
                      </div>
                    </div>
                    <div style={{width: 568, height: 50.50, left: 30, top: 0, position: 'absolute', borderRight: '1px solid #DDDDDD'}}>
                      <div style={{left: 12.50, top: 17.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '700'}}>이름</div>
                    </div>
                    <div style={{width: 80, height: 50.50, left: 598, top: 0, position: 'absolute', borderRight: '1px solid #DDDDDD'}}>
                      <div style={{left: 43.50, top: 17.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '700'}}>크기</div>
                    </div>
                    <div style={{width: 140, height: 50.50, left: 678, top: 0, position: 'absolute', borderRight: '1px solid #DDDDDD'}}>
                      <div style={{left: 52, top: 17.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '700'}}>등록일</div>
                    </div>
                    <div style={{width: 80, height: 50.50, left: 818, top: 0, position: 'absolute', borderRight: '1px solid #DDDDDD'}}>
                      <div style={{width: 52.34, height: 32, left: 14.33, top: 9.75, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '700'}}>필터링 결과</div>
                    </div>
                    <div style={{width: 52.34, height: 32, left: 912.58, top: 9.75, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '700'}}>샘플문서 사용 여부</div>
                  </div>

                  {/* Table Data Rows */}
                  <div style={{width: 978, height: 162, left: 0, top: 50.50, position: 'absolute'}}>
                    {!filteringComplete ? (
                      <>
                        {/* Row 1 */}
                        <div style={{width: 978, height: 27, left: 0, top: 0, position: 'absolute', borderBottom: '1px solid #EEEEEE'}}>
                          <div style={{width: 30, height: 27, left: 0, top: 0, position: 'absolute', borderRight: '1px solid #EEEEEE'}}>
                            <div style={{width: 13, height: 13, left: 8.25, top: 7, position: 'absolute'}}>
                              <CheckboxIcon />
                            </div>
                          </div>
                          <div style={{left: 42.50, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>통화신용정책보고서2022년 9월.docx</div>
                          <div style={{left: 632.62, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>61379</div>
                          <div style={{left: 692.28, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>2024-09-12 16:06:36</div>
                          <div style={{left: 832.33, top: 6.50, position: 'absolute', color: '#999999', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>필터링 전</div>
                          <div style={{width: 36, height: 18, left: 920, top: 4.50, position: 'absolute', background: '#999999', borderRadius: 9999}}>
                            <div style={{left: 8, top: 3.50, position: 'absolute', color: 'white', fontSize: 10, fontFamily: 'Roboto', fontWeight: '400'}}>미정</div>
                          </div>
                        </div>

                        {/* Row 2 */}
                        <div style={{width: 978, height: 27, left: 0, top: 27, position: 'absolute', borderBottom: '1px solid #EEEEEE'}}>
                          <div style={{width: 30, height: 27, left: 0, top: 0, position: 'absolute', borderRight: '1px solid #EEEEEE'}}>
                            <div style={{width: 13, height: 13, left: 8.25, top: 7, position: 'absolute'}}>
                              <CheckboxIcon />
                            </div>
                          </div>
                          <div style={{left: 42.50, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>통화신용정책보고서2022년 12월.docx</div>
                          <div style={{left: 632.62, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>59496</div>
                          <div style={{left: 692.28, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>2024-09-12 16:06:36</div>
                          <div style={{left: 832.33, top: 6.50, position: 'absolute', color: '#999999', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>필터링 전</div>
                          <div style={{width: 36, height: 18, left: 920, top: 4.50, position: 'absolute', background: '#999999', borderRadius: 9999}}>
                            <div style={{left: 8, top: 3.50, position: 'absolute', color: 'white', fontSize: 10, fontFamily: 'Roboto', fontWeight: '400'}}>미정</div>
                          </div>
                        </div>

                        {/* Row 3 */}
                        <div style={{width: 978, height: 27, left: 0, top: 54, position: 'absolute', borderBottom: '1px solid #EEEEEE'}}>
                          <div style={{width: 30, height: 27, left: 0, top: 0, position: 'absolute', borderRight: '1px solid #EEEEEE'}}>
                            <div style={{width: 13, height: 13, left: 8.25, top: 7, position: 'absolute'}}>
                              <CheckboxIcon />
                            </div>
                          </div>
                          <div style={{left: 42.50, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>통화신용정책보고서2018년 7월.docx</div>
                          <div style={{left: 632.62, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>43018</div>
                          <div style={{left: 692.28, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>2024-09-12 16:06:35</div>
                          <div style={{left: 832.33, top: 6.50, position: 'absolute', color: '#999999', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>필터링 전</div>
                          <div style={{width: 36, height: 18, left: 920, top: 4.50, position: 'absolute', background: '#999999', borderRadius: 9999}}>
                            <div style={{left: 8, top: 3.50, position: 'absolute', color: 'white', fontSize: 10, fontFamily: 'Roboto', fontWeight: '400'}}>미정</div>
                          </div>
                        </div>

                        {/* Row 4 */}
                        <div style={{width: 978, height: 27, left: 0, top: 81, position: 'absolute', borderBottom: '1px solid #EEEEEE'}}>
                          <div style={{width: 30, height: 27, left: 0, top: 0, position: 'absolute', borderRight: '1px solid #EEEEEE'}}>
                            <div style={{width: 13, height: 13, left: 8.25, top: 7, position: 'absolute'}}>
                              <CheckboxIcon />
                            </div>
                          </div>
                          <div style={{left: 42.50, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>통화신용정책보고서2019년 8월.docx</div>
                          <div style={{left: 632.62, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>48150</div>
                          <div style={{left: 692.28, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>2024-09-12 16:06:35</div>
                          <div style={{left: 832.33, top: 6.50, position: 'absolute', color: '#999999', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>필터링 전</div>
                          <div style={{width: 36, height: 18, left: 920, top: 4.50, position: 'absolute', background: '#999999', borderRadius: 9999}}>
                            <div style={{left: 8, top: 3.50, position: 'absolute', color: 'white', fontSize: 10, fontFamily: 'Roboto', fontWeight: '400'}}>미정</div>
                          </div>
                        </div>

                        {/* Row 5 */}
                        <div style={{width: 978, height: 27, left: 0, top: 108, position: 'absolute', borderBottom: '1px solid #EEEEEE'}}>
                          <div style={{width: 30, height: 27, left: 0, top: 0, position: 'absolute', borderRight: '1px solid #EEEEEE'}}>
                            <div style={{width: 13, height: 13, left: 8.25, top: 7, position: 'absolute'}}>
                              <CheckboxIcon />
                            </div>
                          </div>
                          <div style={{left: 42.50, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>통화신용정책보고서2019년 12월.docx</div>
                          <div style={{left: 632.62, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>47688</div>
                          <div style={{left: 692.28, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>2024-09-12 16:06:35</div>
                          <div style={{left: 832.33, top: 6.50, position: 'absolute', color: '#999999', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>필터링 전</div>
                          <div style={{width: 36, height: 18, left: 920, top: 4.50, position: 'absolute', background: '#999999', borderRadius: 9999}}>
                            <div style={{left: 8, top: 3.50, position: 'absolute', color: 'white', fontSize: 10, fontFamily: 'Roboto', fontWeight: '400'}}>미정</div>
                          </div>
                        </div>

                        {/* Row 6 */}
                        <div style={{width: 978, height: 27, left: 0, top: 135, position: 'absolute', borderBottom: '1px solid #EEEEEE'}}>
                          <div style={{width: 30, height: 27, left: 0, top: 0, position: 'absolute', borderRight: '1px solid #EEEEEE'}}>
                            <div style={{width: 13, height: 13, left: 8.25, top: 7, position: 'absolute'}}>
                              <CheckboxIcon />
                            </div>
                          </div>
                          <div style={{left: 42.50, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>통화신용정책보고서2021년 6월.docx</div>
                          <div style={{left: 632.62, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>39437</div>
                          <div style={{left: 692.28, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>2024-09-12 16:06:35</div>
                          <div style={{left: 832.33, top: 6.50, position: 'absolute', color: '#999999', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>필터링 전</div>
                          <div style={{width: 36, height: 18, left: 920, top: 4.50, position: 'absolute', background: '#999999', borderRadius: 9999}}>
                            <div style={{left: 8, top: 3.50, position: 'absolute', color: 'white', fontSize: 10, fontFamily: 'Roboto', fontWeight: '400'}}>미정</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {sampleDocuments.map((doc, index) => (
                          <div key={index} style={{width: 978, height: 27, left: 0, top: index * 27, position: 'absolute', borderBottom: '1px solid #EEEEEE'}}>
                            <div style={{width: 30, height: 27, left: 0, top: 0, position: 'absolute', borderRight: '1px solid #EEEEEE'}}>
                              <div style={{width: 13, height: 13, left: 8.25, top: 7, position: 'absolute'}}>
                                <CheckboxIcon />
                              </div>
                            </div>
                            <div style={{left: 42.50, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>{doc.name}</div>
                            <div style={{left: 632.62, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>{doc.quality * 10000}</div>
                            <div style={{left: 692.28, top: 6.50, position: 'absolute', color: '#333333', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>2024-09-12 16:06:36</div>
                            <div style={{left: 832.33, top: 6.50, position: 'absolute', color: '#10B981', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400'}}>필터링 완료</div>
                            <div style={{width: 36, height: 18, left: 920, top: 4.50, position: 'absolute', background: doc.status === 'pass' ? '#2F4F8A' : '#F59E0B', borderRadius: 9999}}>
                              <div style={{left: 8, top: 3.50, position: 'absolute', color: 'white', fontSize: 10, fontFamily: 'Roboto', fontWeight: '400'}}>{doc.status === 'pass' ? '사용' : '미사용'}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Pagination */}
                <div style={{width: 978, height: 43, left: 0, top: 622.62, position: 'absolute', borderTop: '1px solid #DDDDDD'}}>
                  <div style={{width: 134, height: 26, left: 12, top: 9, position: 'absolute'}}>
                    <div style={{left: 0, top: 5.99, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>Rows per page</div>
                    <div style={{width: 52, height: 26, left: 82, top: 0, position: 'absolute', background: '#EFEFEF', borderRadius: 2, border: '1px solid #CCCCCC'}} />
                  </div>

                  <div style={{width: 107.94, height: 21.59, left: 858.06, top: 11.20, position: 'absolute'}}>
                    <div style={{left: 0, top: 3.79, position: 'absolute', color: '#666666', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>Page</div>
                    <div style={{width: 40, height: 21.59, left: 29.70, top: 0, position: 'absolute', background: 'white', borderRadius: 2, border: '1px solid #CCCCCC'}}>
                      <div style={{left: 4, top: 2, position: 'absolute', color: '#666666', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word'}}>1</div>
                    </div>
                    <div style={{width: 13.23, left: 73.70, top: 3.79, position: 'absolute', color: '#666666', fontSize: 10.40, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '14px', wordWrap: 'break-word'}}>/ 1</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with Button */}
            <div style={{width: 1360, height: 39.59, left: 16, top: 806.41, position: 'absolute', background: '#111111', borderRadius: 2}}>
              <div style={{left: 16, top: 11.79, position: 'absolute', color: 'white', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word'}}>전체적인 관리 프로세스가 간소화되고 업무의 생산성을 높이는데 기여합니다.</div>

              {!filteringComplete ? (
                <div
                  onClick={handleStartFiltering}
                  style={{width: 126.34, height: 23.59, left: 1217.66, top: 8, position: 'absolute', background: '#222222', borderRadius: 2, cursor: 'pointer'}}
                >
                  <div style={{left: 12, top: 4.30, position: 'absolute', color: 'white', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word'}}>샘플문서 필터링</div>
                </div>
              ) : (
                <div
                  onClick={() => setStep('auto-category')}
                  style={{width: 126.34, height: 23.59, left: 1217.66, top: 8, position: 'absolute', background: '#2F4F8A', borderRadius: 2, cursor: 'pointer'}}
                >
                  <div style={{left: 12, top: 4.30, position: 'absolute', color: 'white', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word'}}>다음</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 필터링 진행 화면 */}
      {isFilteringInProgress && (
        <FilteringProgress onCancel={() => setIsFilteringInProgress(false)} />
      )}

      {/* 미분류 문서 자동생성 선택 단계 */}
      {step === 'auto-category' && (
        <SampleDocumentFiltering
          onCancel={() => setStep('select')}
          onPrevious={() => setStep('manual-edit')}
          onNext={() => setStep('processing')}
        />
      )}

      {/* 카테고리 생성 및 문서 분류 진행 단계 */}
      {step === 'processing' && (
        <CategoryCreationProgress
          onCancel={() => setStep('auto-category')}
          onComplete={() => setStep('db-creation')}
        />
      )}

      {/* 카테고리 전문가 DB 생성 단계 */}
      {step === 'db-creation' && (
        <ExpertDBCreationProgress
          onCancel={() => setStep('processing')}
          onComplete={() => setStep('complete')}
        />
      )}

      {/* 카테고리 생성 완료 단계 */}
      {step === 'complete' && (
        <CategoryCreationComplete
          onConfirm={() => {
            // Reset to initial state or navigate to home
            setStep('select');
            setCreationType(null);
          }}
        />
      )}

      {/* 작업 시간 확인 모달 */}
      {showWorkTimeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">작업 시간 확인</h3>
              <button
                onClick={() => setShowWorkTimeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-6">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <Clock className="w-10 h-10 text-blue-600" />
                </div>
              </div>

              <div className="text-center mb-6">
                <p className="text-gray-700 mb-4">
                  분류할 문서의 개수와 복잡도를 분석한 결과,<br />
                  예상 작업 시간은 다음과 같습니다.
                </p>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">총 문서 수</p>
                      <p className="text-xl font-bold text-gray-900">2,891건</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">예상 소요시간</p>
                      <p className="text-xl font-bold text-blue-600">약 15-20분</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">카테고리 생성 및 문서 분류</span>
                      <span className="font-medium">10-12분</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">카테고리 전문가 DB 생성</span>
                      <span className="font-medium">5-8분</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-600">
                  작업이 진행되는 동안 다른 페이지로 이동할 수 있으며,<br />
                  완료 시 알림을 받을 수 있습니다.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowWorkTimeModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowWorkTimeModal(false);
                  setStep('processing');
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                작업 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// TreeNode 컴포넌트
interface TreeNodeProps {
  id: string;
  icon: string;
  label: string;
  expanded?: boolean;
  onToggle?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  children?: React.ReactNode;
}

function TreeNode({ icon, label, expanded, onToggle, onSelect, selected, children }: TreeNodeProps) {
  const hasChildren = !!children;

  return (
    <div>
      <div
        onClick={onSelect}
        className={`flex items-center gap-2 py-1 hover:bg-gray-50 cursor-pointer group rounded ${selected ? 'bg-blue-50 border-l-2 border-blue-600 pl-2' : ''}`}
      >
        {hasChildren && (
          <button onClick={(e) => { e.stopPropagation(); onToggle?.(); }} className="p-0.5">
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-5" />}
        <div className="flex items-center gap-2 flex-1">
          <span>{icon}</span>
          <span className="text-sm">{label}</span>
        </div>
      </div>
      {expanded && children && (
        <div className="ml-6 border-l border-gray-200 pl-2">
          {children}
        </div>
      )}
    </div>
  );
}
