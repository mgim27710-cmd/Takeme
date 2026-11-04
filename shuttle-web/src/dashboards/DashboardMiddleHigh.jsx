import React from 'react';
import Dashboard from '../Dashboard';

/**
 * 중·고등부 관리자 대시보드 페이지
 * 라우트: /dashboard/middle-high
 */
export default function DashboardMiddleHigh() {
  return <Dashboard initialEducationLevel="중,고등부" />;
}

