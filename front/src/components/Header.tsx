'use client';

import { useEffect, useState } from 'react';
import { Bell, HelpCircle, User } from 'lucide-react';
import { UserPopover } from './UserPopover';

interface HeaderProps {
  onPageChange: (
    page:
      | 'home'
      | 'management'
      | 'history'
      | 'documents'
      | 'statistics'
      | 'profile'
  ) => void;
  onLogout?: () => void; // 자동 로그아웃을 위해 추가
  sessionDuration?: number; // 세션 유지 시간 (초)
}

interface ProcessingLog {
  log_id?: number;
  doc_id?: number;
  filename?: string;
  message: string;
  process_type: string;
  status: string;
  timestamp: string;
}

export function Header({
  onPageChange,
  onLogout,
  sessionDuration = 3600, // 기본 1시간
}: HeaderProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [remainingTime, setRemainingTime] = useState(sessionDuration);
  const [sessionStart] = useState(Date.now()); // 현재 시점 기준 시작
  const [showNotifications, setShowNotifications] = useState(false);
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ProcessingLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [readTasks, setReadTasks] = useState<Set<string>>(new Set());

  // 남은 시간 계산
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
      const remaining = sessionDuration - elapsed;
      if (remaining <= 0) {
        setRemainingTime(0);
        clearInterval(interval);

        // 자동 로그아웃 실행 (옵션)
        if (onLogout) {
          alert('세션이 만료되었습니다. 다시 로그인해주세요.');
          onLogout();
        }
      } else {
        setRemainingTime(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionDuration, sessionStart, onLogout]);

  // 작업 이력 로드
  useEffect(() => {
    fetch("http://localhost:8000/api/statistics/processing-logs?limit=50", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.logs) {
          setProcessingLogs(data.logs);
        }
      })
      .catch(err => console.error("작업 이력 로드 실패:", err));

    // 로컬 스토리지에서 읽은 task 목록 불러오기
    const saved = localStorage.getItem('readTasks');
    if (saved) {
      setReadTasks(new Set(JSON.parse(saved)));
    }
  }, []);

  // 알람 버튼 클릭 토글
  const handleNotificationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newShowNotifications = !showNotifications;
    setShowNotifications(newShowNotifications);

    // 알람을 열 때 모든 task를 읽음으로 처리
    if (newShowNotifications && processingLogs.length > 0) {
      const tasks: Set<string> = new Set();
      processingLogs.forEach((log) => {
        const logTime = new Date(log.timestamp);
        const roundedTime = new Date(logTime.getFullYear(), logTime.getMonth(), logTime.getDate(), logTime.getHours(), logTime.getMinutes());
        const taskKey = `${log.process_type}_${roundedTime.getTime()}`;
        tasks.add(taskKey);
      });

      const newReadTasks = new Set([...readTasks, ...tasks]);
      setReadTasks(newReadTasks);
      localStorage.setItem('readTasks', JSON.stringify([...newReadTasks]));
    }
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = () => {
      if (showNotifications) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showNotifications]);

  // 이력 클릭 핸들러
  const handleLogClick = (log: ProcessingLog) => {
    setSelectedLog(log);
    setIsModalOpen(true);
    setShowNotifications(false);
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLog(null);
  };

  // 날짜 포맷 함수
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  };

  // 전체 날짜 포맷 함수 (모달용)
  const formatFullDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 남은 시간을 mm:ss로 포맷팅
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Popover 제어
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  // Task 개수 계산 (안 읽은 것만)
  const getTaskCount = () => {
    if (processingLogs.length === 0) return 0;

    const tasks: Set<string> = new Set();
    processingLogs.forEach((log) => {
      const logTime = new Date(log.timestamp);
      const roundedTime = new Date(logTime.getFullYear(), logTime.getMonth(), logTime.getDate(), logTime.getHours(), logTime.getMinutes());
      const taskKey = `${log.process_type}_${roundedTime.getTime()}`;

      // 읽지 않은 task만 카운트
      if (!readTasks.has(taskKey)) {
        tasks.add(taskKey);
      }
    });

    return tasks.size;
  };

  return (
    <>
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between overflow-visible">
      {/* ✅ 세션 만료 표시 */}
      <div className="text-sm text-gray-600">
        <span className="mr-1">⏰</span>
        {remainingTime > 0 ? (
          <span>{formatTime(remainingTime)} 후 세션이 종료됩니다.</span>
        ) : (
          <span className="text-red-500">세션이 만료되었습니다.</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative cursor-pointer" onClick={handleNotificationClick}>
          <Bell className="w-5 h-5 text-gray-600" />
          {getTaskCount() > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-semibold">{getTaskCount()}</span>
            </div>
          )}

          {/* 알림 드롭다운 */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: '32px',
                right: '-350px',
                width: '800px',
                maxHeight: '600px',
                overflow: 'auto',
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                zIndex: 50
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>작업 이력</h3>
              </div>
              <div style={{ padding: '8px' }}>
                {processingLogs.length > 0 ? (
                  (() => {
                    // Task 단위로 그룹화
                    const tasks: { [key: string]: ProcessingLog[] } = {};

                    processingLogs.forEach((log) => {
                      // 시간을 분 단위로 반올림하여 같은 시간대의 작업을 그룹화
                      const logTime = new Date(log.timestamp);
                      const roundedTime = new Date(logTime.getFullYear(), logTime.getMonth(), logTime.getDate(), logTime.getHours(), logTime.getMinutes());
                      const taskKey = `${log.process_type}_${roundedTime.getTime()}`;

                      if (!tasks[taskKey]) {
                        tasks[taskKey] = [];
                      }
                      tasks[taskKey].push(log);
                    });

                    // Task를 시간순으로 정렬
                    const sortedTasks = Object.entries(tasks).sort((a, b) => {
                      const timeA = new Date(a[1][0].timestamp).getTime();
                      const timeB = new Date(b[1][0].timestamp).getTime();
                      return timeB - timeA;
                    });

                    return sortedTasks.map(([taskKey, logs], index) => {
                      const firstLog = logs[0];
                      const processTypeName =
                        firstLog.process_type === 'OCR' ? 'OCR 처리' :
                        firstLog.process_type === 'CLASSIFICATION' ? '문서 분류' :
                        firstLog.process_type === 'UPLOAD' ? '파일 업로드' : firstLog.process_type;

                      const successCount = logs.filter(l => l.status === 'SUCCESS').length;
                      const failCount = logs.filter(l => l.status === 'FAILED').length;

                      return (
                        <div
                          key={index}
                          style={{
                            padding: '16px',
                            cursor: 'pointer',
                            borderBottom: index === sortedTasks.length - 1 ? 'none' : '1px solid #F3F4F6'
                          }}
                          onClick={() => {
                            // task의 첫 번째 로그를 보여줌
                            handleLogClick(firstLog);
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937' }}>
                                {processTypeName} 작업 ({logs.length}건)
                              </div>
                              <div style={{ fontSize: '14px', color: '#4B5563', marginTop: '4px' }}>
                                성공: <span style={{ fontWeight: '600', color: '#10B981' }}>{successCount}</span>건
                                {failCount > 0 && <span style={{ marginLeft: '12px' }}>실패: <span style={{ fontWeight: '600', color: '#EF4444' }}>{failCount}</span>건</span>}
                              </div>
                            </div>
                            <div style={{ fontSize: '14px', color: '#9CA3AF', marginLeft: '16px', whiteSpace: 'nowrap' }}>
                              {formatDate(firstLog.timestamp)}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '14px', color: '#6B7280' }}>
                    작업 이력이 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <HelpCircle className="w-5 h-5 text-gray-600 cursor-pointer" />

        {/* 사용자 메뉴 */}
        <div className="relative">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={handleClick}
          >
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600" />
            </div>
            <span className="text-sm text-gray-700">▼</span>
          </div>
        </div>

        {/* Popover */}
        <UserPopover
          anchorEl={anchorEl}
          onClose={handleClose}
          open={open}
          onPageChange={onPageChange}
        />
      </div>
    </header>

    {/* 작업 이력 상세 모달 */}
    {isModalOpen && selectedLog && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={handleCloseModal}
      >
        <div
          style={{
            background: 'white',
            borderRadius: 8,
            padding: 30,
            width: 500,
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.15)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 모달 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: '700', color: '#333333', margin: 0 }}>작업 이력 상세</h2>
            <button
              onClick={handleCloseModal}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: '#999999',
                padding: 0,
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>

          {/* 모달 내용 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {selectedLog.log_id && (
              <div>
                <div style={{ fontSize: 12, color: '#999999', marginBottom: 5 }}>로그 ID</div>
                <div style={{ fontSize: 14, color: '#333333' }}>{selectedLog.log_id}</div>
              </div>
            )}

            {selectedLog.doc_id && (
              <div>
                <div style={{ fontSize: 12, color: '#999999', marginBottom: 5 }}>문서 ID</div>
                <div style={{ fontSize: 14, color: '#333333' }}>{selectedLog.doc_id}</div>
              </div>
            )}

            {selectedLog.filename && (
              <div>
                <div style={{ fontSize: 12, color: '#999999', marginBottom: 5 }}>파일명</div>
                <div style={{ fontSize: 14, color: '#333333', wordBreak: 'break-all' }}>{selectedLog.filename}</div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 12, color: '#999999', marginBottom: 5 }}>작업 유형</div>
              <div style={{ fontSize: 14, color: '#333333' }}>
                {selectedLog.process_type === 'OCR' ? 'OCR 처리' :
                 selectedLog.process_type === 'CLASSIFICATION' ? '문서 분류' :
                 selectedLog.process_type === 'UPLOAD' ? '파일 업로드' : selectedLog.process_type}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#999999', marginBottom: 5 }}>상태</div>
              <div style={{
                fontSize: 14,
                color: selectedLog.status === 'SUCCESS' ? '#10B981' : '#EF4444',
                fontWeight: '600'
              }}>
                {selectedLog.status === 'SUCCESS' ? '성공' :
                 selectedLog.status === 'FAILED' ? '실패' : selectedLog.status}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#999999', marginBottom: 5 }}>메시지</div>
              <div style={{ fontSize: 14, color: '#333333', lineHeight: '1.6' }}>{selectedLog.message}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#999999', marginBottom: 5 }}>처리 시간</div>
              <div style={{ fontSize: 14, color: '#333333' }}>
                {formatFullDate(selectedLog.timestamp)}
              </div>
            </div>
          </div>

          {/* 닫기 버튼 */}
          <div style={{ marginTop: 25, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCloseModal}
              style={{
                background: '#1E90FF',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
