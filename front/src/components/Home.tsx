import { Users, HardDrive } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface Member {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface DashboardStats {
  total_documents: number;
  total_size_gb: number;
  ocr_completed: number;
  classified_documents: number;
  today_uploads: number;
  today_updates: number;
  weekly_data?: {
    name: string;
    신규등록: number;
    업데이트: number;
  }[];
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

export function Home() {
  // 상태 관리
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [totalMembers, setTotalMembers] = useState<number>(0);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    total_documents: 0,
    total_size_gb: 0,
    ocr_completed: 0,
    classified_documents: 0,
    today_uploads: 0,
    today_updates: 0
  });
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ProcessingLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 요일별 문서 현황 데이터 (API에서 받은 실제 데이터 사용)
  const documentData = dashboardStats.weekly_data || [
    { name: '월', 신규등록: 0, 업데이트: 0 },
    { name: '화', 신규등록: 0, 업데이트: 0 },
    { name: '수', 신규등록: 0, 업데이트: 0 },
    { name: '목', 신규등록: 0, 업데이트: 0 },
    { name: '금', 신규등록: 0, 업데이트: 0 },
    { name: '토', 신규등록: 0, 업데이트: 0 },
    { name: '일', 신규등록: 0, 업데이트: 0 }
  ];

  // 접속자 데이터는 실제 로그 추적이 필요하므로 비활성화
  const connectionData = [
    { time: '00:00', 접속자: 0 },
    { time: '04:00', 접속자: 0 },
    { time: '08:00', 접속자: 0 },
    { time: '12:00', 접속자: 0 },
    { time: '16:00', 접속자: 0 },
    { time: '20:00', 접속자: 0 },
    { time: '24:00', 접속자: 0 }
  ];

  const viewData = [
    { name: 'OCR 완료', value: dashboardStats.ocr_completed, color: '#F59E0B' },
    { name: '분류 완료', value: dashboardStats.classified_documents, color: '#10B981' }
  ];

  // 사용자 정보 로드
  useEffect(() => {
    fetch('http://localhost:8000/member/me', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch member info");
        return res.json();
      })
      .then(data => setCurrentUser(data))
      .catch(err => console.error(err));
  }, []);

  // 회원 수 로드
  useEffect(() => {
    fetch("http://localhost:8000/member/count", { credentials: "include" })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch total members");
        return res.json();
      })
      .then(data => {
        if (data && typeof data.total_members === "number") {
          setTotalMembers(data.total_members);
        }
      })
      .catch(err => {
        console.error("Error fetching total members:", err);
        setTotalMembers(0);
      });
  }, []);

  // 대시보드 통계 로드
  useEffect(() => {
    fetch("http://localhost:8000/api/statistics/dashboard", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDashboardStats({
            total_documents: data.total_documents || 0,
            total_size_gb: data.total_size_gb || 0,
            ocr_completed: data.ocr_completed || 0,
            classified_documents: data.classified_documents || 0,
            today_uploads: data.today_uploads || 0,
            today_updates: data.today_updates || 0,
            weekly_data: data.weekly_data || []
          });
        }
      })
      .catch(err => console.error("대시보드 통계 로드 실패:", err));
  }, []);

  // AI 작업 이력 로드
  useEffect(() => {
    fetch("http://localhost:8000/api/statistics/processing-logs?limit=4", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.logs) {
          setProcessingLogs(data.logs);
        }
      })
      .catch(err => console.error("AI 작업 이력 로드 실패:", err));
  }, []);

  // 이력 클릭 핸들러
  const handleLogClick = (log: ProcessingLog) => {
    setSelectedLog(log);
    setIsModalOpen(true);
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

  return (
    <div style={{width: 1440, height: 852, position: 'relative', background: 'white'}}>

      {/* Top Section */}
      <div style={{width: 1336, height: 180, left: 80, top: 30, position: 'absolute'}}>
        {/* Left Card - Service Info */}
        <div style={{width: 750, height: 180, left: 0, top: 0, position: 'absolute', background: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 6}}>
          <div style={{width: 120, height: 140, left: 20, top: 20, position: 'absolute'}}>
            <div style={{width: 120, height: 40, left: 0, top: 25, position: 'absolute'}}>
              <div style={{left: 0, top: 0, position: 'absolute', color: '#666666', fontSize: 14, fontFamily: 'Roboto', fontWeight: '700', lineHeight: '20px', wordWrap: 'break-word'}}>사용자명</div>
              <div style={{left: 0, top: 20, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '20px', wordWrap: 'break-word'}}>{currentUser?.name || "USER"} {/* 여기서 사용자명 표시 */}</div>
            </div>
            <div style={{width: 120, height: 40, left: 0, top: 75, position: 'absolute'}}>
              <div style={{left: 0, top: 0, position: 'absolute', color: '#666666', fontSize: 14, fontFamily: 'Roboto', fontWeight: '700', lineHeight: '20px', wordWrap: 'break-word'}}>총 문서 수</div>
              <div style={{left: 0, top: 20, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '20px', wordWrap: 'break-word'}}>{dashboardStats.total_documents}개</div>
            </div>
          </div>

          {/* Stats Cards */}
          <div style={{width: 590, height: 140, left: 145, top: 20, position: 'absolute'}}>
            {/* Total Users Card */}
            <div style={{width: 285, height: 140, left: 0, top: 0, position: 'absolute', background: '#1E90FF', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 8}}>
              <div style={{width: 60, height: 65, left: 20, top: 37, position: 'absolute', background: '#7ED6DF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <Users style={{width: 30, height: 25, color: '#2C3E50'}} />
              </div>
              <div style={{width: 180, height: 65, left: 90, top: 37, position: 'absolute'}}>
                <div style={{left: 0, top: 0, position: 'absolute', color: 'white', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>총 사용자 수</div>
                <div style={{left: 0, top: 25, position: 'absolute', color: 'white', fontSize: 28, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '40px', wordWrap: 'break-word'}}>{totalMembers}명</div>
              </div>
            </div>

            {/* Total Storage Card */}
            <div style={{width: 285, height: 140, left: 305, top: 0, position: 'absolute', background: '#1E90FF', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 8}}>
              <div style={{width: 52, height: 65, left: 20, top: 37, position: 'absolute', background: '#7ED6DF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <HardDrive style={{width: 22, height: 25, color: '#2C3E50'}} />
              </div>
              <div style={{width: 190, height: 65, left: 82, top: 37, position: 'absolute'}}>
                <div style={{left: 0, top: 0, position: 'absolute', color: 'white', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>총 인덱싱 용량</div>
                <div style={{left: 0, top: 25, position: 'absolute', color: 'white', fontSize: 28, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '40px', wordWrap: 'break-word'}}>
                  {dashboardStats.total_size_gb > 0 ? `${dashboardStats.total_size_gb.toFixed(1)} GB` : '0 GB'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card - AI History */}
        <div style={{width: 566, height: 180, left: 770, top: 0, position: 'absolute', background: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 6}}>
          <div style={{width: 530, height: 20, left: 20, top: 20, position: 'absolute'}}>
            <div style={{left: 0, top: 0, position: 'absolute', color: '#666666', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>AI 작업 이력</div>
          </div>
          <div style={{width: 530, height: 110, left: 20, top: 50, position: 'absolute'}}>
            {processingLogs.length > 0 ? (
              (() => {
                // Task 단위로 그룹화
                const tasks: { [key: string]: ProcessingLog[] } = {};

                processingLogs.forEach((log) => {
                  const logTime = new Date(log.timestamp);
                  const roundedTime = new Date(logTime.getFullYear(), logTime.getMonth(), logTime.getDate(), logTime.getHours(), logTime.getMinutes());
                  const taskKey = `${log.process_type}_${roundedTime.getTime()}`;

                  if (!tasks[taskKey]) {
                    tasks[taskKey] = [];
                  }
                  tasks[taskKey].push(log);
                });

                // Task를 시간순으로 정렬하고 최대 4개만
                const sortedTasks = Object.entries(tasks)
                  .sort((a, b) => {
                    const timeA = new Date(a[1][0].timestamp).getTime();
                    const timeB = new Date(b[1][0].timestamp).getTime();
                    return timeB - timeA;
                  })
                  .slice(0, 4);

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
                        width: 530,
                        height: 20,
                        left: 0,
                        top: index * 30,
                        position: 'absolute',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleLogClick(firstLog)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{left: 0, top: 0, position: 'absolute', color: '#666666', fontSize: 13, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>
                        {processTypeName} ({logs.length}건)
                      </div>
                      <div style={{left: 200, top: 0, position: 'absolute', color: '#10B981', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>
                        성공: {successCount}
                        {failCount > 0 && <span style={{color: '#EF4444', marginLeft: 8}}>실패: {failCount}</span>}
                      </div>
                      <div style={{left: 410, top: 0, position: 'absolute', color: '#999999', fontSize: 11, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>
                        {formatDate(firstLog.timestamp)}
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <div style={{width: 530, height: 20, left: 0, top: 0, position: 'absolute'}}>
                <div style={{left: 0, top: 0, position: 'absolute', color: '#999999', fontSize: 13, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>
                  처리 이력이 없습니다.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div style={{width: 1336, height: 380, left: 80, top: 230, position: 'absolute'}}>
        {/* Document Status Card */}
        <div style={{width: 750, height: 380, left: 0, top: 0, position: 'absolute', background: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 6}}>
          <div style={{width: 710, height: 20, left: 20, top: 20, position: 'absolute'}}>
            <div style={{left: 0, top: 0, position: 'absolute', color: '#666666', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>문서 현황</div>
          </div>
          <div style={{width: 710, height: 40, left: 20, top: 50, position: 'absolute'}}>
            <div style={{width: 120, height: 40, left: 0, top: 0, position: 'absolute'}}>
              <div style={{left: 0, top: -2, position: 'absolute', color: '#333333', fontSize: 22, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '20px', wordWrap: 'break-word'}}>
                {dashboardStats.total_documents.toLocaleString()}건
              </div>
              <div style={{left: 0, top: 20, position: 'absolute', color: '#666666', fontSize: 14, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>전체 등록 문서</div>
            </div>
            <div style={{width: 240, height: 40, left: 470, top: 0, position: 'absolute'}}>
              <div style={{width: 100, height: 40, left: 0, top: 0, position: 'absolute', borderLeft: '2px solid #1E90FF', paddingLeft: 12}}>
                <div style={{left: 12, top: 0, position: 'absolute', color: '#1E90FF', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>금일 신규 등록</div>
                <div style={{left: 12, top: 20, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '20px', wordWrap: 'break-word'}}>{dashboardStats.today_uploads}개</div>
              </div>
              <div style={{width: 100, height: 40, left: 140, top: 0, position: 'absolute', borderLeft: '2px solid #1E90FF', paddingLeft: 12}}>
                <div style={{left: 12, top: 0, position: 'absolute', color: '#1E90FF', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>금일 업데이트</div>
                <div style={{left: 12, top: 20, position: 'absolute', color: '#333333', fontSize: 14, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '20px', wordWrap: 'break-word'}}>{dashboardStats.today_updates}개</div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={{width: 710, height: 260, left: 20, top: 100, position: 'absolute'}}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={documentData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#666666' }}
                  axisLine={{ stroke: '#E5E5E5' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#666666' }}
                  axisLine={{ stroke: '#E5E5E5' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #E5E5E5',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                <Bar dataKey="신규등록" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="업데이트" fill="#93C5FD" radius={[4, 4, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Usage Status Card */}
        <div style={{width: 280, height: 380, left: 770, top: 0, position: 'absolute', background: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 6}}>
          <div style={{width: 240, height: 20, left: 20, top: 20, position: 'absolute'}}>
            <div style={{left: 0, top: 0, position: 'absolute', color: '#666666', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>사용 현황</div>
          </div>
          <div style={{width: 240, height: 55, left: 20, top: 50, position: 'absolute'}}>
            <div style={{width: 120, height: 55, left: 0, top: 0, position: 'absolute'}}>
              <div style={{left: 0, top: 0, position: 'absolute', color: '#333333', fontSize: 16, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>OCR 완료</div>
              <div style={{left: 25, top: 20, position: 'absolute', color: '#333333', fontSize: 22, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '35px', wordWrap: 'break-word'}}>{dashboardStats.ocr_completed}건</div>
            </div>
            <div style={{width: 120, height: 55, left: 120, top: 0, position: 'absolute'}}>
              <div style={{left: 0, top: 0, position: 'absolute', color: '#333333', fontSize: 16, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>분류 완료</div>
              <div style={{left: 25, top: 20, position: 'absolute', color: '#333333', fontSize: 22, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '35px', wordWrap: 'break-word'}}>{dashboardStats.classified_documents}건</div>
            </div>
          </div>
          <div style={{left: 20, top: 115, position: 'absolute', color: '#666666', fontSize: 12, fontFamily: 'Roboto', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>접속 현황</div>

          {/* Chart */}
          <div style={{width: 240, height: 240, left: 20, top: 135, position: 'absolute'}}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={connectionData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: '#666666' }}
                  axisLine={{ stroke: '#E5E5E5' }}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#666666' }}
                  axisLine={{ stroke: '#E5E5E5' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #E5E5E5',
                    borderRadius: '6px',
                    fontSize: '11px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="접속자"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* View Status Card */}
        <div style={{width: 266, height: 380, left: 1070, top: 0, position: 'absolute', background: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 6}}>
          <div style={{width: 226, height: 20, left: 20, top: 20, position: 'absolute'}}>
            <div style={{left: 0, top: 0, position: 'absolute', color: '#666666', fontSize: 14, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>열람 현황</div>
          </div>
          <div style={{width: 226, height: 70, left: 20, top: 50, position: 'absolute'}}>
            <div style={{width: 226, height: 70, left: 0, top: 0, position: 'absolute', borderBottom: '1px solid #F59E0B'}}>
              <div style={{width: 100, height: 20, left: 3.53, top: 5, position: 'absolute', color: '#333333', fontSize: 16, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>처리 현황</div>
              <div style={{left: 70, top: 32, position: 'absolute', color: '#333333', fontSize: 22, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '35px', wordWrap: 'break-word'}}>
                {dashboardStats.ocr_completed + dashboardStats.classified_documents}건
              </div>
            </div>
          </div>
          <div style={{width: 226, height: 50, left: 20, top: 130, position: 'absolute', display: 'flex', justifyContent: 'space-around'}}>
            <div style={{textAlign: 'center'}}>
              <div style={{color: '#F59E0B', fontSize: 16, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>OCR 완료</div>
              <div style={{color: '#F59E0B', fontSize: 22, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '35px', wordWrap: 'break-word'}}>{dashboardStats.ocr_completed}건</div>
            </div>
            <div style={{textAlign: 'center'}}>
              <div style={{color: '#10B981', fontSize: 16, fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>분류 완료</div>
              <div style={{color: '#10B981', fontSize: 22, fontFamily: 'Roboto', fontWeight: '800', lineHeight: '35px', wordWrap: 'break-word'}}>{dashboardStats.classified_documents}건</div>
            </div>
          </div>

          {/* Chart */}
          <div style={{width: 226, height: 160, left: 20, top: 190, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={viewData}
                  cx="50%"
                  cy="45%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {viewData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #E5E5E5',
                    borderRadius: '6px',
                    fontSize: '11px'
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

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
    </div>
  );
}
