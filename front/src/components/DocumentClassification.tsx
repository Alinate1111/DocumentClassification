import { useRef, useState, useEffect } from "react";
import { Search, ChevronRight, ChevronDown, Folder, FolderPlus, Upload, Trash2 } from 'lucide-react';
import { OCRProgress } from './OCRProgress';
import { DocumentClassificationComplete } from './DocumentClassificationComplete';

type Step = 'select' | 'ocr' | 'complete';
type ViewMode = 'cards' | 'inside-folder';

interface FolderNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FolderNode[];
  path: string;
  ocrCompleted?: boolean;
  classificationCompleted?: boolean;
  category?: string;
  confidence?: number;
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

export function DocumentClassification() {
  // 뷰 모드 관리
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedTopFolder, setSelectedTopFolder] = useState<string | null>(null);

  // 기존 상태들
  const [step, setStep] = useState<Step>('select');
  const [folderStructure, setFolderStructure] = useState<FolderNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set()); // 왼쪽 트리: 오른쪽 패널에 표시할 파일
  const [ocrSelectedFiles, setOcrSelectedFiles] = useState<Set<string>>(new Set()); // 오른쪽 패널: OCR 처리할 파일
  const [fileStatuses, setFileStatuses] = useState<Map<string, { ocrCompleted: boolean; classificationCompleted: boolean; category?: string; confidence?: number }>>(new Map());
  const [filterOCR, setFilterOCR] = useState<'all' | 'completed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [fileMetadata, setFileMetadata] = useState<{ [key: string]: any }>({});

  // 새 폴더 생성 관련
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // 파일 업로드 관련
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // 우클릭 메뉴 관련
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: FolderNode | null;
  }>({ visible: false, x: 0, y: 0, node: null });
  const [renameMode, setRenameMode] = useState<{ nodeId: string; newName: string } | null>(null);
  const contextMenuFileInputRef = useRef<HTMLInputElement | null>(null);

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

      console.log("🔄 파일 목록 새로고침 완료");
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

  // OCR 처리 완료 후 select 단계로 돌아올 때 파일 목록 새로고침
  const prevStepRef = useRef<Step>('select');
  useEffect(() => {
    // 이전 단계가 'ocr' 또는 'complete'였고, 현재 'select'로 돌아온 경우에만 새로고침
    if (step === 'select' && (prevStepRef.current === 'ocr' || prevStepRef.current === 'complete')) {
      console.log("🔄 OCR 처리 후 목록으로 돌아옴 - 파일 목록 새로고침");
      refreshFileList();
    }
    prevStepRef.current = step;
  }, [step]);

  // 우클릭 메뉴 닫기 (클릭 시)
  useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, node: null });
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  // 파일 경로들로부터 폴더 트리 구조 생성
  const buildFolderTree = (filePaths: string[]): FolderNode[] => {
    const roots: FolderNode[] = [];

    for (const filePath of filePaths) {
      const parts = filePath.split("/").filter(Boolean);
      let currentLevel = roots;

      parts.forEach((part, index) => {
        // .folder_placeholder는 건너뛰기 (폴더 존재만 표시용)
        if (part === '.folder_placeholder') {
          return;
        }

        const isFile = index === parts.length - 1 && !part.startsWith('.');
        let existing = currentLevel.find((node) => node.name === part);

        if (!existing) {
          existing = {
            id: parts.slice(0, index + 1).join("/"),
            name: part,
            type: isFile ? "file" : "folder",
            path: parts.slice(0, index + 1).join("/"),
            children: isFile ? undefined : []
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

  // 최상위 폴더 목록과 파일 개수
  const getTopLevelFolders = () => {
    const folders: { [key: string]: number } = {};

    const countFilesInFolder = (node: FolderNode): number => {
      let count = 0;
      if (node.type === 'file') return 1;
      if (node.children) {
        for (const child of node.children) {
          count += countFilesInFolder(child);
        }
      }
      return count;
    };

    folderStructure.forEach(node => {
      if (node.type === 'folder') {
        folders[node.name] = countFilesInFolder(node);
      }
    });

    return Object.entries(folders).map(([name, count]) => ({ name, count }));
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

  // 폴더 삭제
  const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();  // 폴더 클릭 이벤트 방지

    if (!confirm(`정말로 '${folderName}' 폴더를 삭제하시겠습니까?\n폴더 내 모든 파일이 삭제됩니다.`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/api/folders/delete?folder_name=${encodeURIComponent(folderName)}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || '폴더 삭제 실패');
      }

      const result = await res.json();
      console.log('✅ 폴더 삭제 성공:', result);

      // 파일 목록 새로고침
      const filesRes = await fetch("http://localhost:8000/api/files", { credentials: 'include' });
      if (filesRes.ok) {
        const data = await filesRes.json();
        const filePaths = data.file_paths || [];
        const metadata = data.metadata || {};
        setFileMetadata(metadata);
        const tree = buildFolderTree(filePaths);
        setFolderStructure(tree);
      }

      alert(result.message);
    } catch (err: any) {
      console.error('폴더 삭제 실패:', err);
      alert(err.message || '폴더 삭제에 실패했습니다.');
    }
  };

  // 선택된 폴더의 트리만 필터링
  const getFilteredTree = () => {
    if (!selectedTopFolder) return folderStructure;
    return folderStructure.filter(node => node.name === selectedTopFolder);
  };

  // 새 폴더 생성
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('폴더 이름을 입력하세요.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('folder_name', newFolderName);

      const res = await fetch('http://localhost:8000/api/folders/create', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || '폴더 생성 실패');
      }

      const result = await res.json();
      console.log('✅ 폴더 생성 성공:', result);

      // 파일 목록 새로고침
      const filesRes = await fetch("http://localhost:8000/api/files", { credentials: 'include' });
      if (filesRes.ok) {
        const data = await filesRes.json();
        const filePaths = data.file_paths || [];
        const metadata = data.metadata || {};
        setFileMetadata(metadata);
        const tree = buildFolderTree(filePaths);
        setFolderStructure(tree);
      }

      setNewFolderName("");
      setShowNewFolderInput(false);
      alert(result.message);
    } catch (err: any) {
      console.error('폴더 생성 실패:', err);
      alert(err.message || '폴더 생성에 실패했습니다.');
    }
  };

  // 폴더 드래그 앤 드롭 업로드
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    console.log('📂 폴더 업로드:', files);

    // PDF 파일만 필터링
    const pdfFiles = Array.from(files).filter(file =>
      file.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) {
      alert('PDF 파일이 없습니다.');
      return;
    }

    try {
      const formData = new FormData();
      pdfFiles.forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch('http://localhost:8000/api/folders/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || '폴더 업로드 실패');
      }

      const result = await res.json();
      console.log('✅ 폴더 업로드 성공:', result);

      // 파일 목록 새로고침
      const filesRes = await fetch("http://localhost:8000/api/files", { credentials: 'include' });
      if (filesRes.ok) {
        const data = await filesRes.json();
        const filePaths = data.file_paths || [];
        const metadata = data.metadata || {};
        setFileMetadata(metadata);
        const tree = buildFolderTree(filePaths);
        setFolderStructure(tree);
      }

      alert(result.message +
        (result.skipped_files.length > 0 ?
          `\n건너뛴 파일: ${result.skipped_files.length}개` : '')
      );
    } catch (err: any) {
      console.error('폴더 업로드 실패:', err);
      alert(err.message || '폴더 업로드에 실패했습니다.');
    }
  };

  // 폴더/파일 선택 핸들러
  const handleNodeCheck = (node: FolderNode) => {
    const newSelectedFiles = new Set(selectedFiles);

    if (node.type === 'file') {
      // 파일 선택/해제
      if (newSelectedFiles.has(node.id)) {
        newSelectedFiles.delete(node.id);
      } else {
        newSelectedFiles.add(node.id);
      }
    } else {
      // 폴더 선택 시 모든 하위 파일 선택/해제
      const allFiles = collectAllFiles(node);
      const allSelected = allFiles.every(f => newSelectedFiles.has(f.id));

      if (allSelected) {
        // 모두 선택되어 있으면 해제
        allFiles.forEach(f => newSelectedFiles.delete(f.id));
      } else {
        // 하나라도 선택 안되어 있으면 모두 선택
        allFiles.forEach(f => newSelectedFiles.add(f.id));
      }
    }

    setSelectedFiles(newSelectedFiles);
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

    // 폴더의 경우: 모든 하위 파일이 선택되어 있으면 체크
    const allFiles = collectAllFiles(node);
    if (allFiles.length === 0) return false;
    return allFiles.every(f => selectedFiles.has(f.id));
  };

  // 폴더 내부 뷰에서 트리 렌더링 (폴더 + 파일)
  const renderTree = (nodes: FolderNode[], level: number = 0) => {
    return nodes.map(node => (
      <div key={node.id} style={{ marginLeft: `${level * 24}px` }}>
        <div
          onContextMenu={(e) => handleContextMenu(e, node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            borderRadius: '4px',
            marginBottom: '4px',
            background: 'transparent'
          }}
        >
          {/* 펼치기/접기 아이콘 (폴더만) */}
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

          {/* 체크박스 */}
          <input
            type="checkbox"
            checked={isNodeChecked(node)}
            onChange={() => handleNodeCheck(node)}
            style={{ marginLeft: '4px', marginRight: '8px', cursor: 'pointer' }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* 아이콘 */}
          {node.type === 'folder' ? <FolderIcon /> : <FileIcon />}

          {/* 이름 또는 이름 변경 입력 */}
          {renameMode && renameMode.nodeId === node.id ? (
            <input
              type="text"
              value={renameMode.newName}
              onChange={(e) => setRenameMode({ nodeId: node.id, newName: e.target.value })}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setRenameMode(null);
              }}
              autoFocus
              style={{
                fontSize: '13px',
                marginLeft: '6px',
                padding: '2px 4px',
                border: '1px solid #0070F3',
                borderRadius: '2px',
                outline: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{ fontSize: '13px', color: '#333333', marginLeft: '6px' }}>
              {node.name}
            </span>
          )}
        </div>

        {/* 하위 항목 (폴더가 펼쳐져 있을 때) */}
        {node.type === 'folder' && expandedNodes.has(node.id) && node.children && (
          <div>{renderTree(node.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  // 파일 선택 토글 (오른쪽 패널의 체크박스 - OCR 처리 대상 선택)
  const toggleOcrFileSelection = (fileId: string) => {
    const newSelected = new Set(ocrSelectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setOcrSelectedFiles(newSelected);
  };

  // 현재 선택된 파일들만 표시 (체크박스 선택된 것들)
  const getDisplayFiles = (): FolderNode[] => {
    if (!selectedTopFolder) return [];

    const selectedFolderNode = folderStructure.find(node => node.name === selectedTopFolder);
    if (!selectedFolderNode) return [];

    // 체크된 파일들만 수집
    const allFiles = collectAllFiles(selectedFolderNode);

    // 선택된 파일만 필터링
    if (selectedFiles.size === 0) {
      // 아무것도 선택 안했으면 빈 배열 반환 (안내 문구 표시용)
      return [];
    }

    return allFiles.filter(file => selectedFiles.has(file.id));
  };

  const displayFiles = getDisplayFiles();

  // 우클릭 메뉴 핸들러
  const handleContextMenu = (e: React.MouseEvent, node: FolderNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node
    });
  };

  // 파일 업로드 (폴더에 우클릭)
  const handleContextUpload = () => {
    if (contextMenu.node?.type === 'folder') {
      contextMenuFileInputRef.current?.click();
    }
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  // 이름 변경
  const handleContextRename = () => {
    if (contextMenu.node) {
      setRenameMode({ nodeId: contextMenu.node.id, newName: contextMenu.node.name });
    }
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  // 이름 변경 완료
  const handleRenameSubmit = async () => {
    if (!renameMode || !renameMode.newName.trim()) {
      setRenameMode(null);
      return;
    }

    const node = findNodeById(folderStructure, renameMode.nodeId);
    if (!node) {
      alert('노드를 찾을 수 없습니다.');
      setRenameMode(null);
      return;
    }

    try {
      const endpoint = node.type === 'folder'
        ? 'http://localhost:8000/api/rename_folder'
        : 'http://localhost:8000/api/rename_file';

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_path: node.path,
          new_name: renameMode.newName.trim()
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || '이름 변경 실패');
      }

      const result = await res.json();
      alert(result.message);

      // 파일 목록 새로고침
      const filesRes = await fetch("http://localhost:8000/api/files", { credentials: 'include' });
      if (filesRes.ok) {
        const data = await filesRes.json();
        const filePaths = data.file_paths || [];
        const metadata = data.metadata || {};
        setFileMetadata(metadata);
        const tree = buildFolderTree(filePaths);
        setFolderStructure(tree);
      }

      setRenameMode(null);
    } catch (err: any) {
      console.error('이름 변경 실패:', err);
      alert(err.message || '이름 변경에 실패했습니다.');
      setRenameMode(null);
    }
  };

  // 삭제
  const handleContextDelete = async () => {
    if (!contextMenu.node) return;

    const node = contextMenu.node;
    const confirmMsg = node.type === 'folder'
      ? `폴더 "${node.name}"와 내부의 모든 파일을 삭제하시겠습니까?`
      : `파일 "${node.name}"을 삭제하시겠습니까?`;

    if (!confirm(confirmMsg)) {
      setContextMenu({ visible: false, x: 0, y: 0, node: null });
      return;
    }

    try {
      let res;

      if (node.type === 'folder') {
        // 폴더 삭제: /api/folders/delete?folder_name=폴더명
        const folderName = node.name;
        res = await fetch(`http://localhost:8000/api/folders/delete?folder_name=${encodeURIComponent(folderName)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
      } else {
        // 파일 삭제: /api/remove?path=파일경로
        res = await fetch(`http://localhost:8000/api/remove?path=${encodeURIComponent(node.path)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || '삭제 실패');
      }

      const result = await res.json();
      alert(result.message);

      // 파일 목록 새로고침
      const filesRes = await fetch("http://localhost:8000/api/files", { credentials: 'include' });
      if (filesRes.ok) {
        const data = await filesRes.json();
        const filePaths = data.file_paths || [];
        const metadata = data.metadata || {};
        setFileMetadata(metadata);
        const tree = buildFolderTree(filePaths);
        setFolderStructure(tree);
      }

      setContextMenu({ visible: false, x: 0, y: 0, node: null });
    } catch (err: any) {
      console.error('삭제 실패:', err);
      alert(err.message || '삭제에 실패했습니다.');
      setContextMenu({ visible: false, x: 0, y: 0, node: null });
    }
  };

  // 노드 찾기 헬퍼
  const findNodeById = (nodes: FolderNode[], id: string): FolderNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleStartClassification = () => {
    if (ocrSelectedFiles.size === 0) {
      alert('OCR 처리할 파일을 선택해주세요.');
      return;
    }
    setStep('ocr');
  };

  // OCR 단계
  if (step === 'ocr') {
    // 선택된 파일의 전체 경로를 가져오기
    const selectedFilePaths = new Set<string>();
    displayFiles.forEach(file => {
      if (ocrSelectedFiles.has(file.id)) {
        selectedFilePaths.add(file.path);
      }
    });

    return (
      <OCRProgress
        selectedFiles={selectedFilePaths}
        totalFiles={selectedFilePaths.size}
        onCancel={() => {
          setStep('select');
          setOcrSelectedFiles(new Set()); // 선택 초기화
        }}
        onComplete={() => setStep('complete')}
      />
    );
  }

  // 완료 단계
  if (step === 'complete') {
    // 현재 세션에서 처리한 파일 개수만 전달
    return (
      <DocumentClassificationComplete
        totalFiles={ocrSelectedFiles.size}
        onConfirm={() => {
          setStep('select');
          setOcrSelectedFiles(new Set());
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
              문서 &gt; <span style={{ color: '#0070F3' }}>OCR 처리</span>
            </div>
          </div>

          {/* 메인 컨테이너 */}
          <div style={{ width: '1336px', height: '720px', left: '24px', top: '56px', position: 'absolute', borderRadius: '2px', border: '1px solid #DDDDDD' }}>

            {viewMode === 'cards' ? (
              // ========== 폴더 카드 뷰 ==========
              <>
                {/* 헤더 */}
                <div style={{ width: '100%', height: '60px', background: '#F9F9F9', borderBottom: '1px solid #DDDDDD', display: 'flex', alignItems: 'center', paddingLeft: '20px', paddingRight: '20px', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ color: '#333333', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '700' }}>
                      문서 폴더
                    </div>
                    <div style={{ color: '#999999', fontSize: '11px', fontFamily: 'Roboto', marginTop: '4px' }}>
                      폴더를 선택하여 OCR 처리할 문서를 관리하세요
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {/* 새 폴더 생성 버튼 */}
                    <button
                      onClick={() => setShowNewFolderInput(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        background: '#0070F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <FolderPlus style={{ width: '16px', height: '16px' }} />
                      새 폴더
                    </button>
                    {/* 폴더 업로드 버튼 */}
                    <button
                      onClick={() => folderInputRef.current?.click()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        background: 'white',
                        color: '#333333',
                        border: '1px solid #DDDDDD',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <Upload style={{ width: '16px', height: '16px' }} />
                      폴더 업로드
                    </button>
                    <input
                      ref={folderInputRef}
                      type="file"
                      {...({ webkitdirectory: "", directory: "" } as any)}
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleFolderUpload}
                    />
                  </div>
                </div>

                {/* 새 폴더 생성 입력 */}
                {showNewFolderInput && (
                  <div style={{ padding: '16px', borderBottom: '1px solid #DDDDDD', background: '#FFFBEB' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="새 폴더 이름 입력..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #DDDDDD',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleCreateFolder}
                        style={{
                          padding: '8px 16px',
                          background: '#0070F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        생성
                      </button>
                      <button
                        onClick={() => {
                          setShowNewFolderInput(false);
                          setNewFolderName("");
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#F3F3F3',
                          color: '#666666',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}

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
                            <div style={{ color: '#999999', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400' }}>
                              {folder.count}개 문서
                            </div>
                          </div>
                          {/* 삭제 버튼 */}
                          <button
                            onClick={(e) => handleDeleteFolder(folder.name, e)}
                            style={{
                              padding: '6px',
                              background: 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#FEE2E2';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <Trash2 style={{ width: '16px', height: '16px', color: '#EF4444' }} />
                          </button>
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
                  {/* 헤더 */}
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

                  {/* 검색 */}
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

                  {/* 트리 */}
                  <div style={{ height: 'calc(100% - 132px)', overflowY: 'auto', padding: '12px' }}>
                    {renderTree(getFilteredTree())}
                    {/* TODO: 폴더 생성/편집 기능 추가 */}
                  </div>
                </div>

                {/* 오른쪽 패널 - 파일 목록 */}
                <div style={{ width: 'calc(100% - 600px)', height: '100%', float: 'left' }}>
                  {/* 헤더 */}
                  <div style={{ height: '80px', padding: '12px', borderBottom: '1px solid #DDDDDD' }}>
                    <div style={{ marginBottom: '8px', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600' }}>
                      파일 목록 ({ocrSelectedFiles.size}개 OCR 처리 선택됨)
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={filterOCR}
                        onChange={(e) => setFilterOCR(e.target.value as any)}
                        style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid #CCCCCC', borderRadius: '4px' }}
                      >
                        <option value="all">OCR: 전체</option>
                        <option value="completed">OCR: 완료</option>
                        <option value="pending">OCR: 미완료</option>
                      </select>
                      <button
                        onClick={() => setFilterOCR('all')}
                        style={{ padding: '4px 12px', fontSize: '11px', border: '1px solid #CCCCCC', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                      >
                        필터 초기화
                      </button>
                      {/* 파일 업로드 버튼 */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          marginLeft: 'auto',
                          padding: '4px 12px',
                          fontSize: '11px',
                          background: '#0070F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        + 파일 업로드
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="application/pdf"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;

                          try {
                            for (const file of Array.from(files)) {
                              const formData = new FormData();
                              formData.append('file', file);
                              if (selectedTopFolder) {
                                formData.append('folder_path', selectedTopFolder);
                              }

                              const res = await fetch('http://localhost:8000/api/upload', {
                                method: 'POST',
                                credentials: 'include',
                                body: formData
                              });

                              if (!res.ok) {
                                throw new Error(`파일 업로드 실패: ${file.name}`);
                              }
                            }

                            // 파일 목록 새로고침
                            const filesRes = await fetch("http://localhost:8000/api/files", { credentials: 'include' });
                            if (filesRes.ok) {
                              const data = await filesRes.json();
                              const filePaths = data.file_paths || [];
                              const metadata = data.metadata || {};
                              setFileMetadata(metadata);
                              const tree = buildFolderTree(filePaths);
                              setFolderStructure(tree);
                            }

                            alert(`${files.length}개 파일이 업로드되었습니다.`);
                          } catch (err: any) {
                            console.error('파일 업로드 실패:', err);
                            alert(err.message || '파일 업로드에 실패했습니다.');
                          }

                          // 입력 초기화
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>

                  {/* 테이블 */}
                  <div style={{ height: 'calc(100% - 80px)', overflowY: 'auto' }}>
                    {/* 헤더 */}
                    <div style={{ display: 'flex', background: '#F9F9F9', borderBottom: '1px solid #DDDDDD', padding: '8px', fontSize: '11px', fontWeight: '700', position: 'sticky', top: 0, zIndex: 1 }}>
                      <div style={{ width: '30px', textAlign: 'center' }}>
                        <input type="checkbox" />
                      </div>
                      <div style={{ flex: 1 }}>파일명</div>
                      <div style={{ width: '100px', textAlign: 'center' }}>OCR 상태</div>
                      <div style={{ width: '150px', textAlign: 'center' }}>등록일</div>
                    </div>

                    {/* 파일 목록 */}
                    {displayFiles.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#666666' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                          {selectedFiles.size === 0 ? '📁 파일을 선택해주세요' : '파일이 없습니다'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999999' }}>
                          {selectedFiles.size === 0
                            ? '왼쪽 트리에서 폴더나 파일을 체크하면 여기에 표시됩니다.'
                            : '이 폴더에 파일이 없습니다.'}
                        </div>
                      </div>
                    ) : (
                      displayFiles.map((file) => {
                        // 메타데이터에서 OCR 상태 가져오기
                        const metadata = fileMetadata[file.path] || {};
                        const ocrCompleted = metadata.ocr_completed || false;
                        const status = fileStatuses.get(file.id) || {
                          ocrCompleted: ocrCompleted,
                          classificationCompleted: false
                        };

                        // 필터 적용
                        if (filterOCR === 'completed' && !ocrCompleted) return null;
                        if (filterOCR === 'pending' && ocrCompleted) return null;

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
                                checked={ocrSelectedFiles.has(file.id)}
                                onChange={() => toggleOcrFileSelection(file.id)}
                              />
                            </div>
                            <div style={{ flex: 1, color: '#333333', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FileIcon />
                              {file.name}
                            </div>
                            <div style={{ width: '100px', textAlign: 'center' }}>
                              {ocrCompleted ? (
                                <span style={{ color: '#10B981', fontSize: '10px' }}>✓ 완료</span>
                              ) : (
                                <span style={{ color: '#999999', fontSize: '10px' }}>미완료</span>
                              )}
                            </div>
                            <div style={{ width: '150px', textAlign: 'center', fontSize: '10px', color: '#666666' }}>
                              {fileMetadata[file.path]?.upload_date
                                ? new Date(fileMetadata[file.path].upload_date).toLocaleString('ko-KR', {
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
                선택된 파일에서 텍스트를 추출하고 서버에 저장합니다.
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
                  OCR 처리 시작
                </div>
              </div>
            </div>
          )}

          {/* 우클릭 컨텍스트 메뉴 */}
          {contextMenu.visible && (
            <div
              style={{
                position: 'fixed',
                left: `${contextMenu.x}px`,
                top: `${contextMenu.y}px`,
                background: 'white',
                border: '1px solid #DDDDDD',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 1000,
                minWidth: '160px',
                fontSize: '13px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.node?.type === 'folder' && (
                <div
                  onClick={handleContextUpload}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #F3F3F3',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F9F9F9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Upload style={{ width: '14px', height: '14px', color: '#666666' }} />
                  파일 업로드
                </div>
              )}
              <div
                onClick={handleContextRename}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #F3F3F3',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F9F9F9'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                ✏️ 이름 변경
              </div>
              <div
                onClick={handleContextDelete}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#FEF2F2'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Trash2 style={{ width: '14px', height: '14px' }} />
                삭제
              </div>
            </div>
          )}

          {/* 컨텍스트 메뉴용 숨겨진 파일 입력 */}
          <input
            ref={contextMenuFileInputRef}
            type="file"
            multiple
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const files = e.target.files;
              if (!files || files.length === 0 || !contextMenu.node) return;

              try {
                const folderPath = contextMenu.node.path;

                for (const file of Array.from(files)) {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('folder_path', folderPath);

                  const res = await fetch('http://localhost:8000/api/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                  });

                  if (!res.ok) {
                    throw new Error(`파일 업로드 실패: ${file.name}`);
                  }
                }

                // 파일 목록 새로고침
                const filesRes = await fetch("http://localhost:8000/api/files", { credentials: 'include' });
                if (filesRes.ok) {
                  const data = await filesRes.json();
                  const filePaths = data.file_paths || [];
                  const metadata = data.metadata || {};
                  setFileMetadata(metadata);
                  const tree = buildFolderTree(filePaths);
                  setFolderStructure(tree);
                }

                alert(`${files.length}개 파일이 업로드되었습니다.`);
              } catch (err: any) {
                console.error('파일 업로드 실패:', err);
                alert(err.message || '파일 업로드에 실패했습니다.');
              }

              // 입력 초기화
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}
