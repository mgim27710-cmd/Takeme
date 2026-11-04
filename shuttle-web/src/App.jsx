import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './Landing';
import Wizard from './Wizard';
import Dashboard from './Dashboard';
import DashboardKindergarten from './dashboards/DashboardKindergarten';
import DashboardElementary from './dashboards/DashboardElementary';
import DashboardMiddleHigh from './dashboards/DashboardMiddleHigh';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { this.setState({ info }); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', height: '100vh', overflow: 'auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Dashboard Crash</h2>
          <p>Please copy the text below and tell the assistant:</p>
          <pre style={{ background: 'white', padding: '10px', marginTop: '10px' }}>{this.state.error?.toString()}</pre>
          <pre style={{ background: 'white', padding: '10px', marginTop: '10px' }}>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }) {
  const userStr = localStorage.getItem('takeme_user');
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    user = null;
  }

  if (!user || !user.id || !user.role) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * 타 소속 대시보드 URL 직접 입력 접근 방어 가드
 * 자신이 가입/소속된 교육 부문(유치원, 초등부, 중,고등부)과 일치하지 않는 URL로 직접 접속 시 본인 소속 페이지로 자동 강제 리다이렉트
 */
function EducationLevelGuard({ requiredLevel, children }) {
  const userStr = localStorage.getItem('takeme_user');
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    user = null;
  }

  // 최고 관리자(SUPER_ADMIN)는 검토를 위해 모든 부문 접근 허용
  if (user?.role === 'SUPER_ADMIN') {
    return children;
  }

  const userLevel = user?.educationLevel || localStorage.getItem('takeme_selected_education_level') || '유치원';

  if (userLevel !== requiredLevel) {
    const routeMap = {
      '초등부': '/dashboard/elementary',
      '중,고등부': '/dashboard/middle-high',
      '유치원': '/dashboard/kindergarten'
    };
    const myDashboardPath = routeMap[userLevel] || '/dashboard/kindergarten';
    return <Navigate to={myDashboardPath} replace />;
  }

  return children;
}

/**
 * 기본 /dashboard 접근 시 설정된 교육 부문(유치원, 초등부, 중,고등부)에 따라 해당 전용 대시보드로 자동 연결
 */
function DashboardRedirect() {
  const userStr = localStorage.getItem('takeme_user');
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    user = null;
  }
  const level = user?.educationLevel || localStorage.getItem('takeme_selected_education_level') || '유치원';
  if (level === '초등부') {
    return <Navigate to="/dashboard/elementary" replace />;
  }
  if (level === '중,고등부') {
    return <Navigate to="/dashboard/middle-high" replace />;
  }
  return <Navigate to="/dashboard/kindergarten" replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route 
          path="/wizard" 
          element={
            <ProtectedRoute>
              <Wizard />
            </ProtectedRoute>
          } 
        />
        {/* 통합 리다이렉트 라우트: 설정된 부문별 관리자 페이지로 분기 */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          } 
        />
        {/* 1. 유치원 관리자 페이지 (유치원 소속 계정만 접근 가능) */}
        <Route 
          path="/dashboard/kindergarten" 
          element={
            <ProtectedRoute>
              <EducationLevelGuard requiredLevel="유치원">
                <ErrorBoundary><DashboardKindergarten /></ErrorBoundary>
              </EducationLevelGuard>
            </ProtectedRoute>
          } 
        />
        {/* 2. 초등부 관리자 페이지 (초등부 소속 계정만 접근 가능) */}
        <Route 
          path="/dashboard/elementary" 
          element={
            <ProtectedRoute>
              <EducationLevelGuard requiredLevel="초등부">
                <ErrorBoundary><DashboardElementary /></ErrorBoundary>
              </EducationLevelGuard>
            </ProtectedRoute>
          } 
        />
        {/* 3. 중,고등부 관리자 페이지 (중·고등부 소속 계정만 접근 가능) */}
        <Route 
          path="/dashboard/middle-high" 
          element={
            <ProtectedRoute>
              <EducationLevelGuard requiredLevel="중,고등부">
                <ErrorBoundary><DashboardMiddleHigh /></ErrorBoundary>
              </EducationLevelGuard>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/teacher-dashboard" 
          element={
            <ProtectedRoute>
              <ErrorBoundary><Dashboard /></ErrorBoundary>
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
