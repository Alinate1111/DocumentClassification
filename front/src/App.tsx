import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { CategoryClassification } from './components/CategoryClassification';
import { ChangeHistory } from './components/ChangeHistory';
import { DocumentClassification } from './components/DocumentClassification';
import { Statistics } from './components/Statistics';
import SignIn from './SignIn';
import SignUp from './SignUp';
import { isLoggedIn, logout } from './utils/auth';
import { AccountDetailsForm } from './components/AccountDetails';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState<
    'home' | 'management' | 'history' | 'documents' | 'statistics' | 'signup' | 'profile'
  >('home');

  // ✅ 세션 유지 시간 (예: 1시간 = 3600초)
  const SESSION_DURATION = 3600;

  useEffect(() => {
    const checkLogin = async () => {
      const status = await isLoggedIn();
      setLoggedIn(status);
    };
    checkLogin();
  }, []);

  // ✅ 로그아웃 처리
  const handleLogout = async () => {
    await logout();
    setLoggedIn(false);
    setCurrentPage('home'); // 로그아웃 시 홈으로 이동
  };

  // ✅ 회원가입 페이지 (로그인 여부 무관)
  if (currentPage === 'signup') {
    return (
      <SignUp
        onSignupSuccess={() => setCurrentPage('home')}
        onGoToSignIn={() => setCurrentPage('home')}
      />
    );
  }

  // ✅ 로그인 필요 페이지
  if (!loggedIn) {
    return (
      <SignIn
        onLoginSuccess={() => setLoggedIn(true)}
        setCurrentPage={setCurrentPage}
      />
    );
  }

  // ✅ 메인 화면
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ✅ 세션 만료 타이머와 자동 로그아웃 기능 포함 */}
        <Header
          onLogout={handleLogout}
          onPageChange={setCurrentPage}
          sessionDuration={SESSION_DURATION}
        />

        <main className="flex-1 overflow-y-auto">
          {currentPage === 'home' && <Home />}
          {currentPage === 'management' && <CategoryClassification />}
          {currentPage === 'documents' && <DocumentClassification />}
          {currentPage === 'history' && <ChangeHistory />}
          {currentPage === 'statistics' && <Statistics />}

          {/* ✅ 프로필 수정 후 홈으로 이동 */}
          {currentPage === 'profile' && (
            <AccountDetailsForm goHome={() => setCurrentPage('home')} />
          )}
        </main>
      </div>
    </div>
  );
}
