import { useRef, useState, useEffect } from "react";
import { Search, ChevronRight, ChevronDown, Folder, Trash2, Plus, Copy, Upload, CheckCircle, XCircle, Clock, X, Loader2 } from 'lucide-react';
import { SampleDocumentFiltering } from './SampleDocumentFiltering';
import { FilteringProgress } from './FilteringProgress';
import { CategoryCreationProgress } from './CategoryCreationProgress';
import { ExpertDBCreationProgress } from './ExpertDBCreationProgress';
import { CategoryCreationComplete } from './CategoryCreationComplete';

type Step = 'select' | 'creation-select' | 'auto-level' | 'manual-select' | 'manual-new' | 'manual-existing' | 'auto-category' | 'processing' | 'db-creation' | 'complete';
type ViewMode = 'cards' | 'inside-folder';
type ManualType = 'new' | 'existing' | null;

interface FolderNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FolderNode[];
  path: string;
  ocrCompleted?: boolean;
  isClassified?: boolean;
  agency?: string;
  documentType?: string;
  classifiedDate?: string;
}

interface Category {
  id: string;
  name: string;
  sampleDocIds: string[];  // doc_id 목록
}

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.6875 3.5H7.4375L5.6875 1.75H1.3125C0.587617 1.75 0 2.33762 0 3.0625V10.9375C0 11.6624 0.587617 12.25 1.3125 12.25H12.6875C13.4124 12.25 14 11.6624 14 10.9375V4.8125C14 4.08762 13.4124 3.5 12.6875 3.5Z" fill="#F7B500" />
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.75 0.4375H2.625C1.89844 0.4375 1.3125 1.02344 1.3125 1.75V12.25C1.3125 12.9766 1.89844 13.5625 2.625 13.5625H11.375C12.1016 13.5625 12.6875 12.9766 12.6875 12.25V4.375L8.75 0.4375ZM11.375 12.25H2.625V1.75H8.3125V4.8125H11.375V12.25Z" fill="#999999" />
  </svg>
);

export function CategoryClassification() {
  // 뷰 모드 관리
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedTopFolder, setSelectedTopFolder] = useState<string | null>(null);

  // 기존 상태들
  const [step, setStep] = useState<Step>('select');
  const [creationType, setCreationType] = useState<'auto' | 'manual' | null>(null);
  const [manualType, setManualType] = useState<ManualType>(null);
  const [autoGenerateLevel, setAutoGenerateLevel] = useState<1 | 2 | 3 | 4>(2);
  const [selectedExistingCategory, setSelectedExistingCategory] = useState<string | null>(null);
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 카테고리 관리 상태
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);

  const [folderStructure, setFolderStructure] = useState<FolderNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [classificationSelectedFiles, setClassificationSelectedFiles] = useState<Set<string>>(new Set());
  const [fileMetadata, setFileMetadata] = useState<{ [key: string]: any }>({});
  const [searchTerm, setSearchTerm] = useState("");

  // 파일 목록 새로고침 함수
  const refreshFileList = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/files", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("서버 응답 실패");
      const data = await res.json();

      const filePaths = data.file_paths || [];
      const metadata = data.metadata || {};

      console.log("🔄 파일 목록 새로고침 완료 (분류용)");
      console.log("📊 파일 메타데이터:", metadata);

      setFileMetadata(metadata);
      const tree = buildFolderTree(filePaths);
      setFolderStructure(tree);
    } catch (err) {
      console.error("❌ 파일 트리 불러오기 실패:", err);
    }
  };

  // DB에서 파일 목록 가져오기 (초기 로드)
  useEffect(() => {
    refreshFileList();
  }, []);

  // 분류 완료 후 select 단계로 돌아올 때 파일 목록 새로고침
  const prevStepRef = useRef<Step>('select');
  useEffect(() => {
    if (step === 'select' && (prevStepRef.current === 'classification' || prevStepRef.current === 'complete')) {
      console.log("🔄 분류 처리 후 목록으로 돌아옴 - 파일 목록 새로고침");
      refreshFileList();
    }
    prevStepRef.current = step;
  }, [step]);

  // 파일 경로들로부터 폴더 트리 구조 생성
  const buildFolderTree = (filePaths: string[]): FolderNode[] => {
    const roots: FolderNode[] = [];

    for (const filePath of filePaths) {
      const parts = filePath.split("/").filter(Boolean);
      let currentLevel = roots;

      parts.forEach((part, index) => {
        if (part === '.folder_placeholder') {
          return;
        }

        const isFile = index === parts.length - 1 && !part.startsWith('.');
        let existing = currentLevel.find((node) => node.name === part);

        if (!existing) {
          const nodePath = parts.slice(0, index + 1).join("/");
          const metadata = fileMetadata[nodePath] || {};

          existing = {
            id: nodePath,
            name: part,
            type: isFile ? "file" : "folder",
            path: nodePath,
            children: isFile ? undefined : [],
            isClassified: isFile ? metadata.is_classified : undefined,
            agency: isFile ? metadata.agency : undefined,
            documentType: isFile ? metadata.document_type : undefined,
            classifiedDate: isFile ? metadata.classified_date : undefined,
          };
          currentLevel.push(existing);
        }

        if (!isFile && existing.children) {
          currentLevel = existing.children;
        }
      });
    }

    return roots;
  };

  // 최상위 폴더 목록과 OCR/분류 완료된 파일 개수
  const getTopLevelFolders = () => {
    const folders: { [key: string]: { total: number; ocrCompleted: number; classified: number } } = {};

    const countFilesInFolder = (node: FolderNode): { total: number; ocrCompleted: number; classified: number } => {
      let total = 0;
      let ocrCompleted = 0;
      let classified = 0;

      if (node.type === 'file') {
        const metadata = fileMetadata[node.path] || {};
        total = 1;
        if (metadata.ocr_completed) {
          ocrCompleted = 1;
        }
        if (metadata.is_classified) {
          classified = 1;
        }
        return { total, ocrCompleted, classified };
      }

      if (node.children) {
        for (const child of node.children) {
          const counts = countFilesInFolder(child);
          total += counts.total;
          ocrCompleted += counts.ocrCompleted;
          classified += counts.classified;
        }
      }

      return { total, ocrCompleted, classified };
    };

    folderStructure.forEach(node => {
      if (node.type === 'folder') {
        folders[node.name] = countFilesInFolder(node);
      }
    });

    return Object.entries(folders).map(([name, counts]) => ({
      name,
      totalFiles: counts.total,
      ocrCompletedFiles: counts.ocrCompleted,
      classifiedFiles: counts.classified
    }));
  };

  const topLevelFolders = getTopLevelFolders();

  // 폴더 카드 클릭 -> 폴더 내부로 진입
  const handleFolderCardClick = (folderName: string) => {
    setSelectedTopFolder(folderName);
    setViewMode('inside-folder');
  };

  // 뒤로 가기 -> 폴더 카드 뷰로 복귀
  const handleBackToCards = () => {
    setSelectedTopFolder(null);
    setViewMode('cards');
    setSelectedFiles(new Set());
    setExpandedNodes(new Set());
  };

  // 선택된 폴더의 트리만 필터링
  const getFilteredTree = () => {
    if (!selectedTopFolder) return folderStructure;
    return folderStructure.filter(node => node.name === selectedTopFolder);
  };

  // 폴더/파일 선택 핸들러
  const handleNodeCheck = (node: FolderNode) => {
    const newSelectedFiles = new Set(selectedFiles);

    if (node.type === 'file') {
      if (newSelectedFiles.has(node.id)) {
        newSelectedFiles.delete(node.id);
      } else {
        newSelectedFiles.add(node.id);
      }
    } else {
      const allFiles = collectAllFiles(node);
      const allSelected = allFiles.every(f => newSelectedFiles.has(f.id));

      if (allSelected) {
        allFiles.forEach(f => newSelectedFiles.delete(f.id));
      } else {
        allFiles.forEach(f => newSelectedFiles.add(f.id));
      }
    }

    setSelectedFiles(newSelectedFiles);
  };

  // 폴더 토글
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // 노드의 모든 하위 파일 수집
  const collectAllFiles = (node: FolderNode): FolderNode[] => {
    let files: FolderNode[] = [];

    if (node.type === 'file') {
      return [node];
    }

    if (node.children) {
      for (const child of node.children) {
        files = files.concat(collectAllFiles(child));
      }
    }

    return files;
  };

  // 폴더/파일이 선택되어 있는지 확인
  const isNodeChecked = (node: FolderNode): boolean => {
    if (node.type === 'file') {
      return selectedFiles.has(node.id);
    }

    const allFiles = collectAllFiles(node);
    if (allFiles.length === 0) return false;
    return allFiles.every(f => selectedFiles.has(f.id));
  };

  // 폴더 내부 뷰에서 트리 렌더링
  const renderTree = (nodes: FolderNode[], level: number = 0) => {
    return nodes.map(node => (
      <div key={node.id} style={{ marginLeft: `${level * 24}px` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            borderRadius: '4px',
            marginBottom: '4px',
            background: 'transparent'
          }}
        >
          {node.type === 'folder' && node.children && node.children.length > 0 ? (
            <div
              onClick={() => {
                const newExpanded = new Set(expandedNodes);
                if (newExpanded.has(node.id)) {
                  newExpanded.delete(node.id);
                } else {
                  newExpanded.add(node.id);
                }
                setExpandedNodes(newExpanded);
              }}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {expandedNodes.has(node.id)
                ? <ChevronDown style={{ width: '16px', height: '16px', color: '#666666' }} />
                : <ChevronRight style={{ width: '16px', height: '16px', color: '#666666' }} />}
            </div>
          ) : (
            <div style={{ width: '16px', height: '16px' }} />
          )}

          <input
            type="checkbox"
            checked={isNodeChecked(node)}
            onChange={() => handleNodeCheck(node)}
            style={{ marginLeft: '4px', marginRight: '8px', cursor: 'pointer' }}
            onClick={(e) => e.stopPropagation()}
          />

          {node.type === 'folder' ? <FolderIcon /> : <FileIcon />}

          <span style={{ fontSize: '13px', color: '#333333', marginLeft: '6px', flex: 1 }}>
            {node.name}
          </span>

          {/* 파일인 경우 분류 상태 표시 */}
          {node.type === 'file' && node.isClassified && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              <CheckCircle style={{ width: '12px', height: '12px', color: '#3B82F6' }} />
              <span style={{ color: '#3B82F6', fontSize: '10px', fontWeight: '600' }}>분류됨</span>
            </div>
          )}
        </div>

        {node.type === 'folder' && expandedNodes.has(node.id) && node.children && (
          <div>{renderTree(node.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  // 파일 선택 토글 (오른쪽 패널 - 분류 대상 선택)
  const toggleClassificationFileSelection = (fileId: string) => {
    const newSelected = new Set(classificationSelectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setClassificationSelectedFiles(newSelected);
  };

  // 현재 선택된 파일들 중 OCR 완료된 파일만 표시
  const getDisplayFiles = (): FolderNode[] => {
    if (!selectedTopFolder) return [];

    const selectedFolderNode = folderStructure.find(node => node.name === selectedTopFolder);
    if (!selectedFolderNode) return [];

    const allFiles = collectAllFiles(selectedFolderNode);

    if (selectedFiles.size === 0) {
      return [];
    }

    // 선택된 파일 중 OCR 완료된 파일만 필터링
    return allFiles.filter(file => {
      if (!selectedFiles.has(file.id)) return false;

      const metadata = fileMetadata[file.path] || {};
      return metadata.ocr_completed === true; // OCR 완료된 파일만
    });
  };

  const displayFiles = getDisplayFiles();

  const handleStartClassification = () => {
    if (classificationSelectedFiles.size === 0) {
      alert('분류할 파일을 선택해주세요.');
      return;
    }
    // 카테고리 생성 플로우 시작 (자동/수동 선택 화면으로)
    setStep('creation-select');
  };

  // 자동 생성 선택
  const handleAutoSelect = () => {
    setCreationType('auto');
    setStep('auto-level');
  };

  // 수동 생성 선택
  const handleManualSelect = () => {
    setCreationType('manual');
    setStep('manual-select');
  };

  // 수동 - 새 카테고리 생성
  const handleManualNew = () => {
    setManualType('new');
    setCategories([]);  // 초기화
    setSelectedCategoryForEdit(null);
    setStep('manual-new');
  };

  // 카테고리 추가
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      alert('카테고리 이름을 입력해주세요.');
      return;
    }

    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name: newCategoryName.trim(),
      sampleDocIds: []
    };

    setCategories([...categories, newCategory]);
    setNewCategoryName('');
    setShowAddCategoryModal(false);
    setSelectedCategoryForEdit(newCategory.id);  // 자동 선택
  };

  // 카테고리 삭제
  const handleDeleteCategory = (categoryId: string) => {
    if (!confirm('이 카테고리를 삭제하시겠습니까?')) return;

    setCategories(categories.filter(c => c.id !== categoryId));
    if (selectedCategoryForEdit === categoryId) {
      setSelectedCategoryForEdit(null);
    }
  };

  // 카테고리 이름 수정
  const handleRenameCategory = (categoryId: string, newName: string) => {
    if (!newName.trim()) return;

    setCategories(categories.map(c =>
      c.id === categoryId ? { ...c, name: newName.trim() } : c
    ));
  };

  // 샘플 문서 추가/제거
  const toggleSampleDoc = (categoryId: string, docId: string) => {
    setCategories(categories.map(c => {
      if (c.id !== categoryId) return c;

      const sampleDocIds = c.sampleDocIds.includes(docId)
        ? c.sampleDocIds.filter(id => id !== docId)
        : [...c.sampleDocIds, docId];

      return { ...c, sampleDocIds };
    }));
  };

  // 수동 - 기존 카테고리에 분류
  const handleManualExisting = () => {
    setManualType('existing');
    setStep('manual-existing');
  };

  // 샘플 필터링 시작
  const handleStartFiltering = () => {
    setIsFilteringInProgress(true);
    setTimeout(() => {
      setIsFilteringInProgress(false);
      setFilteringComplete(true);
      setSampleDocuments([
        { name: '2024년_1분기_재무보고서.pdf', category: '재무보고서', quality: 95, status: 'pass' },
        { name: '재무제표_분석_2024.pdf', category: '재무보고서', quality: 88, status: 'pass' },
        { name: '회의록_임시파일.pdf', category: '재무보고서', quality: 42, status: 'fail' }
      ]);
    }, 3000);
  };

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

  // 자동생성 선택 화면
  if (step === 'creation-select') {
    return (
      <div className="bg-white min-h-screen">
        <div style={{width: '1336px', height: '536px', position: 'relative', background: '#F3F3F3', borderRadius: '6px', margin: '24px'}}>
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
      </div>
    );
  }

  // 자동생성 - 카테고리 최대 단계 선택
  if (step === 'auto-level') {
    return (
      <div style={{width: 1440, height: 862, position: 'relative', background: 'white'}}>
        <div style={{width: 1392, height: 862, left: 48, top: 0, position: 'absolute'}}>
          <div style={{width: 1360, height: 80, left: 16, top: 80, position: 'absolute'}}>
            <div style={{left: 0, top: 0, position: 'absolute', color: '#333333', fontSize: 20, fontFamily: 'Roboto', fontWeight: '700', lineHeight: '28px'}}>
              카테고리 최대 단계 선택
            </div>
            <div style={{left: 0, top: 40, position: 'absolute', color: '#666666', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '20px'}}>
              AI가 자동으로 생성할 카테고리의 최대 계층 단계를 선택해주세요.
            </div>
          </div>

          <div style={{width: 1360, height: 600, left: 16, top: 180, position: 'absolute'}}>
            <div style={{width: 1360, display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center'}}>
              {[1, 2, 3, 4].map(level => (
                <div
                  key={level}
                  onClick={() => setAutoGenerateLevel(level as 1 | 2 | 3 | 4)}
                  style={{
                    width: 280,
                    height: 320,
                    padding: 24,
                    background: autoGenerateLevel === level ? '#EEF2FF' : 'white',
                    border: autoGenerateLevel === level ? '2px solid #2F4F8A' : '1px solid #E5E5E5',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 48, fontWeight: '700', color: autoGenerateLevel === level ? '#2F4F8A' : '#666666', marginBottom: 16}}>{level}단계</div>
                    <div style={{fontSize: 14, fontWeight: '600', color: '#333333', marginBottom: 12}}>
                      {level === 1 ? '단일 계층' : level === 2 ? '2계층 구조' : level === 3 ? '3계층 구조' : '4계층 구조'}
                    </div>
                    <div style={{fontSize: 12, color: '#666666', lineHeight: '18px'}}>
                      {level === 1 && (<>최상위 카테고리만 생성<br/>(예: 재무보고서, 인사관리)</>)}
                      {level === 2 && (<>대분류 + 중분류<br/>(예: 재무보고서 &gt; 분기별)</>)}
                      {level === 3 && (<>대분류 + 중분류 + 소분류<br/>(예: 재무보고서 &gt; 분기별 &gt; 2024)</>)}
                      {level === 4 && (<>대분류 + 중분류 + 소분류 + 세분류<br/>(예: 재무보고서 &gt; 분기별 &gt; 2024 &gt; Q1)</>)}
                    </div>
                  </div>
                  <div style={{width: '100%', padding: 12, background: autoGenerateLevel === level ? '#2F4F8A' : '#F9F9F9', borderRadius: 4, textAlign: 'center', color: autoGenerateLevel === level ? 'white' : '#666666', fontSize: 11}}>
                    {level === 1 ? '가장 간단한 구조' : level === 2 ? '권장 설정' : level === 3 ? '상세 분류' : '최대 세분화'}
                  </div>
                </div>
              ))}
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

          <div style={{width: 1360, height: 60, left: 16, top: 790, position: 'absolute', background: '#111111', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px'}}>
            <div style={{color: 'white', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px'}}>
              선택한 단계: {autoGenerateLevel}단계 - {autoGenerateLevel === 1 ? '단일 계층' : autoGenerateLevel === 2 ? '2계층 구조 (권장)' : autoGenerateLevel === 3 ? '3계층 구조' : '4계층 구조 (최대)'}
            </div>
            <div style={{display: 'flex', gap: 12}}>
              <div onClick={() => setStep('creation-select')} style={{padding: '8px 24px', border: '1px solid #FFFFFF', borderRadius: 4, cursor: 'pointer', color: 'white', fontSize: 13}}>
                이전
              </div>
              <div onClick={() => setStep('processing')} style={{padding: '8px 24px', background: '#2F4F8A', borderRadius: 4, cursor: 'pointer', color: 'white', fontSize: 13}}>
                다음
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 수동 생성 - 방식 선택 (새 카테고리 vs 기존 카테고리)
  if (step === 'manual-select') {
    return (
      <div className="bg-white min-h-screen">
        <div style={{width: '1336px', height: '536px', position: 'relative', background: '#F3F3F3', borderRadius: '6px', margin: '24px'}}>
          <div style={{width: '1288px', height: '200px', left: '24px', top: '24px', position: 'absolute'}}>
            <div style={{left: '0px', top: '0px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '16px'}}>수동 생성 방식 선택</div>
            <div style={{left: '0px', top: '20px', position: 'absolute', color: '#666666', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px'}}>새로운 카테고리를 생성하거나, 기존 카테고리에 문서를 분류할 수 있습니다.</div>
          </div>
          <div style={{width: '1288px', height: '248px', left: '24px', top: '264px', position: 'absolute'}}>
            <div style={{width: '240px', height: '248px', left: '324px', top: '0px', position: 'absolute'}}>
              <img style={{width: '120px', height: '100px', left: '60px', top: '0px', position: 'absolute'}} src="https://placehold.co/120x100" />
              <div onClick={handleManualNew} style={{width: '96px', height: '28px', left: '72px', top: '201px', position: 'absolute', borderRadius: '2px', outline: '1px #CCCCCC solid', outlineOffset: '-1px', cursor: 'pointer'}}>
                <div style={{left: '36px', top: '5px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px'}}>실행</div>
              </div>
              <div style={{left: '68px', top: '116px', position: 'absolute', color: '#333333', fontSize: '16px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '24px'}}>새 카테고리 생성</div>
              <div style={{width: '231.12px', height: '42px', left: '0px', top: '146px', position: 'absolute', color: '#666666', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px'}}>카테고리 구조를 직접 만들고 샘플 문서를 등록하여 BERT 모델을 학습시킵니다.</div>
            </div>
            <div style={{width: '240px', height: '248px', left: '724px', top: '0px', position: 'absolute'}}>
              <img style={{width: '120px', height: '100px', left: '60px', top: '0px', position: 'absolute'}} src="https://placehold.co/120x100" />
              <div style={{width: '240px', height: '60px', left: '0px', top: '144px', position: 'absolute'}}>
                <div style={{width: '231.12px', height: '42px', left: '0px', top: '2px', position: 'absolute', color: '#666666', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px'}}>이미 학습된 BERT 모델을 사용하여 기존 카테고리에 문서를 자동으로 분류합니다.</div>
              </div>
              <div onClick={handleManualExisting} style={{width: '96px', height: '28px', left: '68px', top: '204px', position: 'absolute', borderRadius: '2px', outline: '1px #CCCCCC solid', outlineOffset: '-1px', cursor: 'pointer'}}>
                <div style={{left: '36px', top: '5px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px'}}>실행</div>
              </div>
              <div style={{left: '58px', top: '116px', position: 'absolute', color: '#333333', fontSize: '16px', fontFamily: 'Roboto', fontWeight: '700', lineHeight: '24px'}}>기존 카테고리에 분류</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 필터링 진행 화면
  if (isFilteringInProgress) {
    return <FilteringProgress onCancel={() => setIsFilteringInProgress(false)} />;
  }

  // 수동 - 새 카테고리 생성 (카테고리 편집 및 샘플 문서 등록)
  if (step === 'manual-new') {
    const selectedCategory = categories.find(c => c.id === selectedCategoryForEdit);
    const isReadyForTraining = categories.length > 0 && categories.every(c => c.sampleDocIds.length >= 3);

    return (
      <div style={{width: 1440, height: 900, position: 'relative', background: 'white', padding: '24px'}}>
        {/* Header */}
        <div style={{marginBottom: '16px'}}>
          <div style={{color: '#333333', fontSize: '20px', fontWeight: '700', marginBottom: '8px'}}>
            새 카테고리 생성 및 샘플 문서 등록
          </div>
          <div style={{color: '#666666', fontSize: '13px', marginBottom: '16px'}}>
            ① 카테고리를 생성하고 ② 각 카테고리에 샘플 문서를 3개 이상 등록하세요. 샘플이 충분하면 학습을 시작할 수 있습니다.
          </div>
        </div>

        {/* Main Container */}
        <div style={{display: 'flex', gap: '16px', height: '700px'}}>
          {/* Left Panel - Category List */}
          <div style={{width: '350px', background: '#F9F9F9', borderRadius: '8px', border: '1px solid #E5E5E5', padding: '16px', display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
              <div style={{fontSize: '14px', fontWeight: '700', color: '#333333'}}>
                카테고리 목록 ({categories.length})
              </div>
              <button
                onClick={() => setShowAddCategoryModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  background: '#2F4F8A',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                <Plus style={{width: '14px', height: '14px'}} />
                추가
              </button>
            </div>

            {/* Category Add Modal */}
            {showAddCategoryModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  background: 'white',
                  padding: '24px',
                  borderRadius: '8px',
                  width: '400px'
                }}>
                  <div style={{fontSize: '16px', fontWeight: '700', marginBottom: '16px'}}>
                    새 카테고리 추가
                  </div>
                  <input
                    type="text"
                    placeholder="카테고리 이름"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #DDDDDD',
                      borderRadius: '4px',
                      fontSize: '14px',
                      marginBottom: '16px'
                    }}
                    autoFocus
                  />
                  <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                    <button
                      onClick={() => {
                        setShowAddCategoryModal(false);
                        setNewCategoryName('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'white',
                        border: '1px solid #DDDDDD',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      취소
                    </button>
                    <button
                      onClick={handleAddCategory}
                      style={{
                        padding: '8px 16px',
                        background: '#2F4F8A',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Category List */}
            <div style={{flex: 1, overflowY: 'auto'}}>
              {categories.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#999999',
                  fontSize: '13px'
                }}>
                  <div style={{marginBottom: '8px'}}>📁</div>
                  <div>카테고리가 없습니다.</div>
                  <div style={{fontSize: '11px', marginTop: '4px'}}>위의 "추가" 버튼을 클릭하세요.</div>
                </div>
              ) : (
                categories.map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategoryForEdit(cat.id)}
                    style={{
                      padding: '12px',
                      background: selectedCategoryForEdit === cat.id ? '#EEF2FF' : 'white',
                      border: selectedCategoryForEdit === cat.id ? '2px solid #2F4F8A' : '1px solid #E5E5E5',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <div style={{fontSize: '14px', fontWeight: '600', color: '#333333', marginBottom: '4px'}}>
                          {cat.name}
                        </div>
                        <div style={{fontSize: '11px', color: cat.sampleDocIds.length >= 3 ? '#10B981' : '#F59E0B'}}>
                          샘플: {cat.sampleDocIds.length}개 {cat.sampleDocIds.length >= 3 ? '✓' : '(최소 3개)'}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(cat.id);
                        }}
                        style={{
                          padding: '4px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#999999'
                        }}
                      >
                        <Trash2 style={{width: '16px', height: '16px'}} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - Sample Document Selection */}
          <div style={{flex: 1, background: 'white', borderRadius: '8px', border: '1px solid #E5E5E5', padding: '16px', display: 'flex', flexDirection: 'column'}}>
            {!selectedCategory ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999999',
                fontSize: '14px'
              }}>
                <div style={{textAlign: 'center'}}>
                  <div style={{marginBottom: '8px'}}>📋</div>
                  <div>카테고리를 선택하여</div>
                  <div>샘플 문서를 등록하세요</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{marginBottom: '16px'}}>
                  <div style={{fontSize: '16px', fontWeight: '700', color: '#333333', marginBottom: '4px'}}>
                    {selectedCategory.name}
                  </div>
                  <div style={{fontSize: '12px', color: '#666666'}}>
                    이 카테고리에 속하는 샘플 문서를 3개 이상 선택하세요 (현재: {selectedCategory.sampleDocIds.length}개)
                  </div>
                </div>

                {/* Sample Document List */}
                <div style={{flex: 1, overflowY: 'auto', border: '1px solid #E5E5E5', borderRadius: '4px'}}>
                  {/* Table Header */}
                  <div style={{
                    display: 'flex',
                    background: '#F9F9F9',
                    padding: '8px',
                    borderBottom: '1px solid #E5E5E5',
                    fontSize: '11px',
                    fontWeight: '700',
                    position: 'sticky',
                    top: 0
                  }}>
                    <div style={{width: '40px', textAlign: 'center'}}>선택</div>
                    <div style={{flex: 1}}>파일명</div>
                    <div style={{width: '100px', textAlign: 'center'}}>OCR 상태</div>
                  </div>

                  {/* Document Rows */}
                  {displayFiles.length === 0 ? (
                    <div style={{padding: '40px', textAlign: 'center', color: '#999999', fontSize: '12px'}}>
                      <div>OCR 완료된 파일이 없습니다.</div>
                      <div style={{marginTop: '8px', fontSize: '11px'}}>
                        먼저 파일을 선택하고 OCR 처리를 완료해주세요.
                      </div>
                    </div>
                  ) : (
                    displayFiles.map(file => {
                      const metadata = fileMetadata[file.path] || {};
                      const docId = metadata.doc_id?.toString() || file.id;
                      const isSelected = selectedCategory.sampleDocIds.includes(docId);

                      return (
                        <div
                          key={file.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 8px',
                            borderBottom: '1px solid #F3F3F3',
                            fontSize: '12px',
                            background: isSelected ? '#F0F9FF' : 'white',
                            cursor: 'pointer'
                          }}
                          onClick={() => toggleSampleDoc(selectedCategory.id, docId)}
                        >
                          <div style={{width: '40px', textAlign: 'center'}}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{cursor: 'pointer'}}
                            />
                          </div>
                          <div style={{flex: 1, color: '#333333', display: 'flex', alignItems: 'center', gap: '6px'}}>
                            <FileIcon />
                            {file.name}
                          </div>
                          <div style={{width: '100px', textAlign: 'center'}}>
                            <span style={{color: '#10B981', fontSize: '10px', fontWeight: '600'}}>✓ 완료</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div style={{marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#F9F9F9', borderRadius: '6px'}}>
          <div style={{fontSize: '12px', color: '#666666'}}>
            {isReadyForTraining
              ? `✓ 학습 준비 완료 (${categories.length}개 카테고리, ${categories.reduce((sum, c) => sum + c.sampleDocIds.length, 0)}개 샘플)`
              : `각 카테고리에 최소 3개 이상의 샘플 문서가 필요합니다`}
          </div>
          <div style={{display: 'flex', gap: '12px'}}>
            <button
              onClick={() => setStep('manual-select')}
              style={{
                padding: '10px 24px',
                background: 'white',
                border: '1px solid #DDDDDD',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              이전
            </button>
            <button
              onClick={() => {
                if (!isReadyForTraining) {
                  alert('각 카테고리에 최소 3개 이상의 샘플 문서를 등록해주세요.');
                  return;
                }
                setStep('processing');
              }}
              disabled={!isReadyForTraining}
              style={{
                padding: '10px 24px',
                background: isReadyForTraining ? '#2F4F8A' : '#CCCCCC',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isReadyForTraining ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              BERT 학습 및 분류 시작
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 수동 - 기존 카테고리에 분류
  if (step === 'manual-existing') {
    return (
      <div className="bg-white min-h-screen" style={{padding: '24px'}}>
        <div style={{width: '1336px', position: 'relative', background: 'white', borderRadius: '6px', border: '1px solid #E5E5E5', padding: '24px'}}>
          <div style={{marginBottom: '24px'}}>
            <div style={{color: '#333333', fontSize: '20px', fontFamily: 'Roboto', fontWeight: '700', marginBottom: '8px'}}>
              기존 카테고리에 문서 분류
            </div>
            <div style={{color: '#666666', fontSize: '13px', fontFamily: 'Roboto', fontWeight: '400'}}>
              학습된 BERT 모델을 사용하여 선택한 {classificationSelectedFiles.size}개 파일을 기존 카테고리에 자동으로 분류합니다.
            </div>
          </div>

          <div style={{background: '#F9F9F9', padding: '20px', borderRadius: '8px', marginBottom: '24px'}}>
            <div style={{fontSize: '14px', fontWeight: '600', color: '#333333', marginBottom: '12px'}}>분류 대상 파일</div>
            <div style={{fontSize: '12px', color: '#666666'}}>
              • 선택된 파일: {classificationSelectedFiles.size}개<br/>
              • 처리 방식: BERT 모델 자동 분류<br/>
              • 예상 소요 시간: 약 {Math.ceil(classificationSelectedFiles.size * 2 / 60)}분
            </div>
          </div>

          <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
            <button
              onClick={() => setStep('manual-select')}
              style={{
                padding: '10px 24px',
                background: 'white',
                border: '1px solid #DDDDDD',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: 'pointer',
                color: '#333333'
              }}
            >
              이전
            </button>
            <button
              onClick={() => setStep('processing')}
              style={{
                padding: '10px 24px',
                background: '#2F4F8A',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'white',
                fontWeight: '600'
              }}
            >
              분류 시작
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 미분류 문서 자동생성 선택 단계
  if (step === 'auto-category') {
    return (
      <SampleDocumentFiltering
        onCancel={() => setStep('select')}
        onPrevious={() => setStep('manual-new')}
        onNext={() => setStep('processing')}
      />
    );
  }

  // 카테고리 생성 및 문서 분류 진행 단계
  if (step === 'processing') {
    // 선택된 파일 경로 목록 생성
    const selectedFilePaths = Array.from(classificationSelectedFiles).map(fileId => {
      const file = displayFiles.find(f => f.id === fileId);
      return file ? file.path : null;
    }).filter(Boolean) as string[];

    // 카테고리 구조를 API 형식으로 변환 (manual-new용)
    const categoryStructure: { [key: string]: string[] } = {};
    if (manualType === 'new') {
      categories.forEach(cat => {
        categoryStructure[cat.name] = cat.sampleDocIds;
      });
    }

    return (
      <CategoryCreationProgress
        selectedFiles={selectedFilePaths}
        creationType={creationType}
        manualType={manualType}
        autoGenerateLevel={creationType === 'auto' ? autoGenerateLevel : undefined}
        categoryStructure={manualType === 'new' ? categoryStructure : undefined}
        onCancel={() => {
          if (creationType === 'auto') {
            setStep('auto-level');
          } else if (manualType === 'new') {
            setStep('manual-new');
          } else {
            setStep('manual-existing');
          }
        }}
        onComplete={() => setStep('db-creation')}
      />
    );
  }

  // 카테고리 전문가 DB 생성 단계
  if (step === 'db-creation') {
    return (
      <ExpertDBCreationProgress
        onCancel={() => setStep('processing')}
        onComplete={() => setStep('complete')}
      />
    );
  }

  // 카테고리 생성 완료 단계
  if (step === 'complete') {
    return (
      <CategoryCreationComplete
        onConfirm={() => {
          setStep('select');
          setCreationType(null);
          setClassificationSelectedFiles(new Set());
        }}
      />
    );
  }

  // 선택 단계
  return (
    <div style={{ width: '1440px', minHeight: '900px', position: 'relative', background: '#F9F9F9' }}>
      <div style={{ width: '1440px', height: '844px', left: '0px', top: '56px', position: 'absolute' }}>
        <div style={{ width: '1384px', height: '844px', left: '56px', top: '0px', position: 'absolute', background: 'white' }}>

          {/* 헤더 */}
          <div style={{ width: '1336px', left: '24px', top: '24px', position: 'absolute' }}>
            <div style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px' }}>
              관리 &gt; <span style={{ color: '#0070F3' }}>카테고리 분류</span>
            </div>
          </div>

          {/* 메인 컨테이너 */}
          <div style={{ width: '1336px', height: '720px', left: '24px', top: '56px', position: 'absolute', borderRadius: '2px', border: '1px solid #DDDDDD' }}>

            {viewMode === 'cards' ? (
              // ========== 폴더 카드 뷰 ==========
              <>
                <div style={{ width: '100%', height: '60px', background: '#F9F9F9', borderBottom: '1px solid #DDDDDD', display: 'flex', alignItems: 'center', paddingLeft: '20px', paddingRight: '20px', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ color: '#333333', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '700' }}>
                      문서 폴더
                    </div>
                    <div style={{ color: '#999999', fontSize: '11px', fontFamily: 'Roboto', marginTop: '4px' }}>
                      폴더를 선택하여 카테고리 분류할 문서를 선택하세요 (OCR 완료된 파일만 표시됩니다)
                    </div>
                  </div>
                </div>

                {/* 폴더 카드 그리드 */}
                <div style={{ padding: '24px', height: 'calc(100% - 60px)', overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                    {topLevelFolders.map((folder) => (
                      <div
                        key={folder.name}
                        onClick={() => handleFolderCardClick(folder.name)}
                        style={{
                          padding: '24px',
                          background: '#FFFFFF',
                          border: '1px solid #E5E5E5',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#3B82F6';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#E5E5E5';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Folder style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#333333', fontSize: '15px', fontFamily: 'Roboto', fontWeight: '700', marginBottom: '4px' }}>
                              {folder.name}
                            </div>
                            <div style={{ color: '#999999', fontSize: '11px', fontFamily: 'Roboto', fontWeight: '400' }}>
                              전체 {folder.totalFiles}개
                            </div>
                            <div style={{ color: folder.ocrCompletedFiles > 0 ? '#10B981' : '#999999', fontSize: '11px', fontFamily: 'Roboto', fontWeight: '600' }}>
                              OCR 완료 {folder.ocrCompletedFiles}개
                            </div>
                            <div style={{ color: folder.classifiedFiles > 0 ? '#3B82F6' : '#999999', fontSize: '11px', fontFamily: 'Roboto', fontWeight: '600' }}>
                              분류 완료 {folder.classifiedFiles}개
                            </div>
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          color: '#3B82F6',
                          fontSize: '11px',
                          fontFamily: 'Roboto',
                          fontWeight: '600'
                        }}>
                          자세히 보기
                          <ChevronRight style={{ width: '14px', height: '14px', marginLeft: '4px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              // ========== 폴더 내부 뷰 ==========
              <>
                {/* 왼쪽 패널 - 폴더 트리 */}
                <div style={{ width: '600px', height: '100%', float: 'left', borderRight: '1px solid #DDDDDD' }}>
                  <div style={{ height: '60px', background: '#F9F9F9', borderBottom: '1px solid #DDDDDD', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={handleBackToCards}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        background: 'white',
                        border: '1px solid #DDDDDD',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      <ChevronRight style={{ width: '14px', height: '14px', transform: 'rotate(180deg)' }} />
                      뒤로
                    </button>
                    <div>
                      <div style={{ color: '#333333', fontSize: '13px', fontFamily: 'Roboto', fontWeight: '700' }}>
                        {selectedTopFolder}
                      </div>
                      <div style={{ color: '#999999', fontSize: '11px', fontFamily: 'Roboto' }}>
                        폴더 구조
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '12px' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="폴더 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          height: '32px',
                          padding: '0 32px 0 12px',
                          border: '1px solid #CCCCCC',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                      <Search style={{ width: '14px', height: '14px', position: 'absolute', right: '12px', top: '9px', color: '#666666' }} />
                    </div>
                  </div>

                  <div style={{ height: 'calc(100% - 132px)', overflowY: 'auto', padding: '12px' }}>
                    {renderTree(getFilteredTree())}
                  </div>
                </div>

                {/* 오른쪽 패널 - OCR 완료된 파일 목록 */}
                <div style={{ width: 'calc(100% - 600px)', height: '100%', float: 'left' }}>
                  <div style={{ height: '80px', padding: '12px', borderBottom: '1px solid #DDDDDD' }}>
                    <div style={{ marginBottom: '8px', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600' }}>
                      OCR 완료 파일 ({classificationSelectedFiles.size}개 분류 선택됨)
                    </div>
                    <div style={{ color: '#666666', fontSize: '11px', fontFamily: 'Roboto' }}>
                      왼쪽에서 체크한 파일 중 OCR이 완료된 파일만 표시됩니다
                    </div>
                  </div>

                  {/* 테이블 */}
                  <div style={{ height: 'calc(100% - 80px)', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', background: '#F9F9F9', borderBottom: '1px solid #DDDDDD', padding: '8px', fontSize: '11px', fontWeight: '700', position: 'sticky', top: 0, zIndex: 1 }}>
                      <div style={{ width: '30px', textAlign: 'center' }}>
                        <input type="checkbox" />
                      </div>
                      <div style={{ flex: 1 }}>파일명</div>
                      <div style={{ width: '100px', textAlign: 'center' }}>OCR 상태</div>
                      <div style={{ width: '120px', textAlign: 'center' }}>분류 상태</div>
                      <div style={{ width: '150px', textAlign: 'center' }}>등록일</div>
                    </div>

                    {displayFiles.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#666666' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                          {selectedFiles.size === 0 ? '📁 파일을 선택해주세요' : 'OCR이 완료된 파일이 없습니다'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999999' }}>
                          {selectedFiles.size === 0
                            ? '왼쪽 트리에서 폴더나 파일을 체크하면 OCR 완료된 파일이 표시됩니다.'
                            : '선택한 파일 중 OCR이 완료된 파일이 없습니다. OCR 처리를 먼저 진행해주세요.'}
                        </div>
                      </div>
                    ) : (
                      displayFiles.map((file) => {
                        const metadata = fileMetadata[file.path] || {};

                        return (
                          <div
                            key={file.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px',
                              borderBottom: '1px solid #F3F3F3',
                              fontSize: '11px'
                            }}
                          >
                            <div style={{ width: '30px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={classificationSelectedFiles.has(file.id)}
                                onChange={() => toggleClassificationFileSelection(file.id)}
                              />
                            </div>
                            <div style={{ flex: 1, color: '#333333', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FileIcon />
                              {file.name}
                            </div>
                            <div style={{ width: '100px', textAlign: 'center' }}>
                              <span style={{ color: '#10B981', fontSize: '10px' }}>✓ 완료</span>
                            </div>
                            <div style={{ width: '120px', textAlign: 'center' }}>
                              {metadata.is_classified ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  <CheckCircle style={{ width: '12px', height: '12px', color: '#3B82F6' }} />
                                  <span style={{ color: '#3B82F6', fontSize: '10px', fontWeight: '600' }}>분류 완료</span>
                                </div>
                              ) : (
                                <span style={{ color: '#999999', fontSize: '10px' }}>미분류</span>
                              )}
                            </div>
                            <div style={{ width: '150px', textAlign: 'center', fontSize: '10px', color: '#666666' }}>
                              {metadata.upload_date
                                ? new Date(metadata.upload_date).toLocaleString('ko-KR', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false
                                  }).replace(/\. /g, '-').replace('.', '')
                                : '날짜 없음'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 하단 버튼 - 폴더 내부 뷰일 때만 표시 */}
          {viewMode === 'inside-folder' && (
            <div style={{ width: '1336px', height: '39.59px', left: '24px', top: '786px', position: 'absolute', background: '#111111', borderRadius: '2px' }}>
              <div style={{ left: '16px', top: '11.79px', position: 'absolute', color: 'white', fontSize: '13px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px' }}>
                선택된 파일을 카테고리별로 자동 분류합니다 (OCR 완료된 파일만 처리)
              </div>
              <div
                onClick={handleStartClassification}
                style={{
                  width: '152px',
                  height: '39.59px',
                  right: '0px',
                  top: '0px',
                  position: 'absolute',
                  background: '#0070F3',
                  borderRadius: '0px 2px 2px 0px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <div style={{ color: 'white', fontSize: '13px', fontFamily: 'Roboto', fontWeight: '600' }}>
                  카테고리 분류 시작
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
