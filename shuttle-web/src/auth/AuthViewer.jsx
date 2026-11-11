import React, { useState, useMemo } from 'react';
import { formatTeacherName } from '../utils/teacherUtil';

export default function AuthViewer({
  isClosing,
  currentTab = 'STUDENT', // 'STUDENT' | 'STAFF' | 'TEACHER' | 'SUBSTITUTE'
  setCurrentTab,
  students = [],
  buses = [],
  teachers = [],
  academy,
  handleApproveStudent,
  handleRevokeStudent,
  handleApproveStaff,
  handleRevokeStaff,
  handleRevokeTeacher,
  fetchTeachers,
  refreshAllData,
  handleGenerateAuthCode,
  handleUnlockUser,
  onOpenSubstituteModal,
  isProcessing
}) {
  const [studentStatusFilter, setStudentStatusFilter] = useState('ALL'); // 'ALL', 'PENDING', 'APPROVED', 'UNREGISTERED'
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [substituteRoleTab, setSubstituteRoleTab] = useState('DRIVER'); // 'DRIVER' | 'TEACHER'
  const [substituteStatusFilter, setSubstituteStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // Extract all unique class names from students
  const availableClasses = useMemo(() => {
    const set = new Set();
    students.forEach(st => {
      const cls = st.className || st.raw?.['반명'] || st.raw?.['반'] || st.raw?.['학급'];
      if (cls && typeof cls === 'string' && cls.trim()) {
        set.add(cls.trim());
      }
    });
    return Array.from(set).sort();
  }, [students]);

  // Student counts
  const studentCounts = useMemo(() => {
    const total = students.length;
    const pending = students.filter(s => s.approvalStatus === 'PENDING').length;
    const approved = students.filter(s => s.approvalStatus === 'APPROVED').length;
    const unregistered = students.filter(s => !s.approvalStatus || s.approvalStatus === 'UNREGISTERED').length;
    return { total, pending, approved, unregistered };
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      // Status filter
      if (studentStatusFilter === 'PENDING' && st.approvalStatus !== 'PENDING') return false;
      if (studentStatusFilter === 'APPROVED' && st.approvalStatus !== 'APPROVED') return false;
      if (studentStatusFilter === 'UNREGISTERED' && (st.approvalStatus === 'PENDING' || st.approvalStatus === 'APPROVED')) return false;

      // Class filter
      if (selectedClassFilter !== 'ALL') {
        const cls = (st.className || st.raw?.['반명'] || st.raw?.['반'] || st.raw?.['학급'] || '').trim();
        if (cls !== selectedClassFilter) return false;
      }

      // Search keyword
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase().trim();
        const name = (st.name || '').toLowerCase();
        const address = (st.address || '').toLowerCase();
        const phone = (st.parentPhone || st.raw?.['부모연락처'] || st.raw?.['보호자연락처'] || '').toLowerCase();
        const bus = buses.find(b => b.id === st.assignedBusId);
        const busName = (bus?.name || '').toLowerCase();

        return name.includes(kw) || address.includes(kw) || phone.includes(kw) || busName.includes(kw);
      }

      return true;
    });
  }, [students, studentStatusFilter, selectedClassFilter, searchKeyword, buses]);

  // Filtered Buses for Staff tab
  const filteredBuses = useMemo(() => {
    if (!searchKeyword.trim()) return buses;
    const kw = searchKeyword.toLowerCase().trim();
    return buses.filter(b => {
      const name = (b.name || '').toLowerCase();
      const plate = (b.plateNumber || '').toLowerCase();
      const driver = (b.driverName || '').toLowerCase();
      const teacher = (b.teacherName || '').toLowerCase();
      return name.includes(kw) || plate.includes(kw) || driver.includes(kw) || teacher.includes(kw);
    });
  }, [buses, searchKeyword]);

  // Filtered Teachers
  const filteredTeachers = useMemo(() => {
    if (!searchKeyword.trim()) return teachers;
    const kw = searchKeyword.toLowerCase().trim();
    return teachers.filter(t => {
      const name = (t.name || '').toLowerCase();
      const email = (t.email || '').toLowerCase();
      const cls = (t.assignedClass || '').toLowerCase();
      const phone = (t.phone || '').toLowerCase();
      return name.includes(kw) || email.includes(kw) || cls.includes(kw) || phone.includes(kw);
    });
  }, [teachers, searchKeyword]);

  // Substitute Staff Counts & Filtered Buses (대체 기사/교사 임시 계정 통계 및 필터링)
  const substituteStats = useMemo(() => {
    let activeDrivers = 0;
    let activeTeachers = 0;
    buses.forEach(b => {
      if (b.isDriverResting || b.substituteDriver?.isActive) activeDrivers++;
      if (b.isTeacherResting || b.substituteTeacher?.isActive) activeTeachers++;
    });
    return {
      totalBuses: buses.length,
      activeDrivers,
      activeTeachers,
      inactiveDrivers: Math.max(0, buses.length - activeDrivers),
      inactiveTeachers: Math.max(0, buses.length - activeTeachers)
    };
  }, [buses]);

  const filteredSubstituteBuses = useMemo(() => {
    return buses.filter(bus => {
      const isDriverMode = substituteRoleTab === 'DRIVER';
      const isResting = isDriverMode 
        ? Boolean(bus.isDriverResting || bus.substituteDriver?.isActive)
        : Boolean(bus.isTeacherResting || bus.substituteTeacher?.isActive);
      
      if (substituteStatusFilter === 'ACTIVE' && !isResting) return false;
      if (substituteStatusFilter === 'INACTIVE' && isResting) return false;

      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase().trim();
        const busName = (bus.name || '').toLowerCase();
        const plate = (bus.plateNumber || '').toLowerCase();
        const origName = isDriverMode ? (bus.driverName || '').toLowerCase() : (bus.teacherName || '').toLowerCase();
        const subData = isDriverMode ? (bus.substituteDriver || {}) : (bus.substituteTeacher || {});
        const subName = (subData.name || '').toLowerCase();
        const subEmail = (subData.email || '').toLowerCase();
        const subPhone = (subData.phone || '').toLowerCase();

        return busName.includes(kw) || plate.includes(kw) || origName.includes(kw) || subName.includes(kw) || subEmail.includes(kw) || subPhone.includes(kw);
      }
      return true;
    });
  }, [buses, substituteRoleTab, substituteStatusFilter, searchKeyword]);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      if (typeof refreshAllData === 'function') await refreshAllData();
      if (typeof fetchTeachers === 'function') await fetchTeachers();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  return (
    <div className={`absolute inset-0 z-[2000] flex flex-col bg-slate-100 h-full overflow-hidden transition-all duration-300 ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      
      {/* Top Bar Header */}
      <div className="bg-white px-8 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs shrink-0 z-10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              {currentTab === 'STUDENT' && <span>원생·학부모 키 인증 및 승인</span>}
              {currentTab === 'STAFF' && <span>차량 스태프 (기사·교사) 승인</span>}
              {currentTab === 'TEACHER' && <span>유치원 교사 가입 및 승인 현황</span>}
              {currentTab === 'SUBSTITUTE' && <span>대체 기사 임시 계정 일괄 관리 현황</span>}
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              원 인증: {academy?.authCode || '미발급'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {currentTab === 'STUDENT' && '앱에 원 인증코드를 입력하고 가입한 원아 및 학부모의 접근 권한을 승인하거나 해제합니다.'}
            {currentTab === 'STAFF' && '통학차량 기사님과 동승 지도교사의 계정 연동 및 운행 권한을 관리합니다.'}
            {currentTab === 'TEACHER' && '원 인증코드로 가입된 유치원 교사의 계정 연동 상태를 확인하고 관리합니다.'}
            {currentTab === 'SUBSTITUTE' && '각 호차별 기사님의 휴식(연차·병가 등)에 따른 대체 기사 임시 로그인 계정 발급 및 활성화 상태를 일괄 관리합니다.'}
          </p>
        </div>

        {/* Tab Pills & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sub-tab Switcher Pills */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setCurrentTab('STUDENT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'STUDENT'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>전체 원생</span>
              <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full font-bold">
                {studentCounts.total}
              </span>
              {studentCounts.pending > 0 && (
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('STAFF')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'STAFF'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>차량 스태프</span>
              <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full font-bold">
                {buses.length}호차
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('TEACHER')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'TEACHER'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>유치원 교사</span>
              <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full font-bold">
                {teachers.length}명
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('SUBSTITUTE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'SUBSTITUTE'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>대체 기사 임시 계정</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                buses.some(b => b.isDriverResting || b.substituteDriver?.isActive)
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {buses.some(b => b.isDriverResting || b.substituteDriver?.isActive)
                  ? `운행중 ${buses.filter(b => b.isDriverResting || b.substituteDriver?.isActive).length}`
                  : `${buses.length}호차`}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="이름, 연락처, 반 검색..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white w-48 transition-all"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors shadow-xs"
            title="새로고침"
          >
            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* TAB 1: STUDENT VIEW */}
        {currentTab === 'STUDENT' && (
          <div className="space-y-6">
            {/* Top Summary Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div 
                onClick={() => setStudentStatusFilter('ALL')}
                className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer shadow-xs ${
                  studentStatusFilter === 'ALL' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-500">전체 원아</div>
                <div className="text-2xl font-black text-slate-800 mt-1">{studentCounts.total}<span className="text-sm font-medium text-slate-500 ml-1">명</span></div>
              </div>

              <div 
                onClick={() => setStudentStatusFilter('PENDING')}
                className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer shadow-xs ${
                  studentStatusFilter === 'PENDING' ? 'border-orange-500 ring-2 ring-orange-100 bg-orange-50/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-orange-600 flex items-center justify-between">
                  <span>승인 대기</span>
                  {studentCounts.pending > 0 && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                  )}
                </div>
                <div className="text-2xl font-black text-orange-600 mt-1">{studentCounts.pending}<span className="text-sm font-medium text-orange-400 ml-1">명</span></div>
              </div>

              <div 
                onClick={() => setStudentStatusFilter('APPROVED')}
                className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer shadow-xs ${
                  studentStatusFilter === 'APPROVED' ? 'border-green-500 ring-2 ring-green-100 bg-green-50/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-green-700">승인 완료</div>
                <div className="text-2xl font-black text-green-700 mt-1">{studentCounts.approved}<span className="text-sm font-medium text-green-500 ml-1">명</span></div>
              </div>

              <div 
                onClick={() => setStudentStatusFilter('UNREGISTERED')}
                className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer shadow-xs ${
                  studentStatusFilter === 'UNREGISTERED' ? 'border-slate-400 ring-2 ring-slate-100 bg-slate-50/40' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-500">미가입</div>
                <div className="text-2xl font-black text-slate-500 mt-1">{studentCounts.unregistered}<span className="text-sm font-medium text-slate-400 ml-1">명</span></div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600">상태 필터:</span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setStudentStatusFilter('ALL')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      studentStatusFilter === 'ALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    전체 ({studentCounts.total})
                  </button>
                  <button
                    onClick={() => setStudentStatusFilter('PENDING')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      studentStatusFilter === 'PENDING' ? 'bg-orange-500 text-white shadow-xs' : 'text-orange-700 hover:text-orange-900'
                    }`}
                  >
                    대기 ({studentCounts.pending})
                  </button>
                  <button
                    onClick={() => setStudentStatusFilter('APPROVED')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      studentStatusFilter === 'APPROVED' ? 'bg-green-600 text-white shadow-xs' : 'text-green-700 hover:text-green-900'
                    }`}
                  >
                    승인 ({studentCounts.approved})
                  </button>
                  <button
                    onClick={() => setStudentStatusFilter('UNREGISTERED')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      studentStatusFilter === 'UNREGISTERED' ? 'bg-slate-300 text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    미가입 ({studentCounts.unregistered})
                  </button>
                </div>
              </div>

              {/* Class Dropdown Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">반 선택:</span>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">전체 학급</option>
                  {availableClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-400 font-medium">
                  검색 결과: <strong className="text-slate-700">{filteredStudents.length}</strong>명
                </span>
              </div>
            </div>

            {/* Students Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredStudents.map(st => {
                const assignedBus = buses.find(b => b.id === st.assignedBusId);
                const className = st.className || st.raw?.['반명'] || st.raw?.['반'] || st.raw?.['학급'];
                const parentPhone = st.parentPhone || st.raw?.['부모연락처'] || st.raw?.['보호자연락처'] || st.raw?.['연락처'];
                const parentName = st.parentName || st.raw?.['보호자 성함'] || st.raw?.['보호자성함'] || st.raw?.['학부모성함'];

                return (
                  <div 
                    key={st.id} 
                    className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      {/* Card Header: Name, Class, Status Badge */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-black text-sm flex items-center justify-center shrink-0">
                            {st.name?.[0] || '원'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-bold text-slate-900 truncate">{st.name}</span>
                              {className && (
                                <span className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200 font-bold whitespace-nowrap">
                                  {className}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 truncate mt-0.5">
                              {parentName ? `보호자: ${parentName}` : '원아 계정'}
                              {parentPhone && ` (${parentPhone})`}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {st.approvalStatus === 'APPROVED' ? (
                            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold border border-green-200 flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                              승인완료
                            </span>
                          ) : st.approvalStatus === 'PENDING' ? (
                            <span className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-bold border border-orange-200 flex items-center gap-1 shadow-2xs animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
                              승인대기
                            </span>
                          ) : (
                            <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-medium border border-slate-200">
                              미가입
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail Info Body */}
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 w-16 shrink-0">배정 차량</span>
                          {assignedBus ? (
                            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                              {assignedBus.name} ({assignedBus.plateNumber || '차량'})
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">차량 미배정 (도보 등)</span>
                          )}
                        </div>

                        {st.address && (
                          <div className="flex items-start gap-1.5">
                            <span className="text-slate-400 w-16 shrink-0 mt-0.5">주소</span>
                            <span className="font-medium text-slate-700 truncate" title={st.address}>{st.address}</span>
                          </div>
                        )}

                        {st.boardingLocation && st.boardingLocation !== st.address && (
                          <div className="flex items-start gap-1.5">
                            <span className="text-slate-400 w-16 shrink-0 mt-0.5">등원탑승지</span>
                            <span className="font-medium text-slate-700 truncate" title={st.boardingLocation}>{st.boardingLocation}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      {st.isLocked && (
                        <div className="flex items-center gap-1.5 mr-auto">
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[11px] font-bold rounded-lg border border-red-200">
                            계정 잠김 (5회 실패)
                          </span>
                          {handleUnlockUser && (
                            <button
                              onClick={() => handleUnlockUser(st.parentUserId || st.studentUserId)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                            >
                              잠금 해제
                            </button>
                          )}
                        </div>
                      )}
                      {st.approvalStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleRevokeStudent(st.id, true)}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                          >
                            가입 거절
                          </button>
                          <button
                            onClick={() => handleApproveStudent(st.id)}
                            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1"
                          >
                            <span>가입 승인</span>
                          </button>
                        </>
                      )}

                      {st.approvalStatus === 'APPROVED' && (
                        <button
                          onClick={() => handleRevokeStudent(st.id, false)}
                          className="px-3.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors"
                        >
                          연동 해제
                        </button>
                      )}

                      {(!st.approvalStatus || st.approvalStatus === 'UNREGISTERED') && (
                        <span className="text-[11px] text-slate-400 italic">
                          학부모가 앱에서 원 코드로 가입하면 대기 상태가 됩니다.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredStudents.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                
                <p className="font-bold text-slate-600">조건에 일치하는 원아가 없습니다.</p>
                <p className="text-xs text-slate-400 mt-1">필터나 검색어를 변경해보세요.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STAFF (DRIVER & BUS TEACHER) VIEW */}
        {currentTab === 'STAFF' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">통학차량 스태프 가입 및 승인 현황</h3>
                <p className="text-xs text-slate-500 mt-0.5">각 호차별 기사님 및 동승 지도교사의 앱 연동 승인 상태를 관리합니다.</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600">등록 차량:</span>
                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{buses.length}대</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredBuses.map(bus => {
                const assignedCount = students.filter(s => s.assignedBusId === bus.id).length;

                return (
                  <div key={bus.id} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-5">
                    <div>
                      {/* Bus Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                            차량
                          </div>
                          <div>
                            <div className="text-base font-bold text-slate-900">{bus.name}</div>
                            <div className="text-xs text-slate-400 font-mono">{bus.plateNumber || '차량번호 미입력'}</div>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                          원생 {assignedCount}명 탑승
                        </span>
                      </div>

                      {/* Driver & Teacher Cards inside */}
                      <div className="mt-4 space-y-3">
                        {/* 1. Driver Card */}
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                              기사
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                                  {bus.driverName || '기사 미지정'}
                                </span>
                                {bus.driverApprovalStatus === 'APPROVED' ? (
                                  <span className="text-[11px] bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-bold border border-green-200 whitespace-nowrap">
                                    승인완료
                                  </span>
                                ) : bus.driverApprovalStatus === 'PENDING' ? (
                                  <span className="text-[11px] bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full font-bold border border-orange-200 animate-pulse whitespace-nowrap">
                                    승인대기
                                  </span>
                                ) : (
                                  <span className="text-[11px] bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                                    미가입
                                  </span>
                                )}
                              </div>
                              {bus.driverPhone && (
                                <div className="text-xs text-slate-400 mt-0.5">{bus.driverPhone}</div>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            {bus.isDriverLocked && handleUnlockUser && (
                              <button
                                onClick={() => handleUnlockUser(bus.driverUserId)}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition shadow-xs"
                              >
                                잠금 해제
                              </button>
                            )}
                            {bus.driverApprovalStatus === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleApproveStaff(bus.id, 'DRIVER')}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                                >
                                  승인
                                </button>
                                <button
                                  onClick={() => handleRevokeStaff(bus.id, 'DRIVER', true)}
                                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition"
                                >
                                  거절
                                </button>
                              </>
                            )}
                            {bus.driverApprovalStatus === 'APPROVED' && (
                              <button
                                onClick={() => handleRevokeStaff(bus.id, 'DRIVER', false)}
                                className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition"
                              >
                                연동 해제
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 2. Escort Teacher Card */}
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                              동승
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                                  {bus.teacherName || '지도교사 미지정'}
                                </span>
                                {bus.teacherApprovalStatus === 'APPROVED' ? (
                                  <span className="text-[11px] bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-bold border border-green-200 whitespace-nowrap">
                                    승인완료
                                  </span>
                                ) : bus.teacherApprovalStatus === 'PENDING' ? (
                                  <span className="text-[11px] bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full font-bold border border-orange-200 animate-pulse whitespace-nowrap">
                                    승인대기
                                  </span>
                                ) : (
                                  <span className="text-[11px] bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                                    미가입
                                  </span>
                                )}
                              </div>
                              {bus.teacherPhone && (
                                <div className="text-xs text-slate-400 mt-0.5">{bus.teacherPhone}</div>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            {bus.isTeacherLocked && handleUnlockUser && (
                              <button
                                onClick={() => handleUnlockUser(bus.teacherUserId)}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition shadow-xs"
                              >
                                잠금 해제
                              </button>
                            )}
                            {bus.teacherApprovalStatus === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleApproveStaff(bus.id, 'TEACHER')}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                                >
                                  승인
                                </button>
                                <button
                                  onClick={() => handleRevokeStaff(bus.id, 'TEACHER', true)}
                                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition"
                                >
                                  거절
                                </button>
                              </>
                            )}
                            {bus.teacherApprovalStatus === 'APPROVED' && (
                              <button
                                onClick={() => handleRevokeStaff(bus.id, 'TEACHER', false)}
                                className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition"
                              >
                                연동 해제
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 bg-slate-50/50 p-2.5 rounded-xl border border-dashed border-slate-200">
                      기사님/교사가 앱에서 회원가입 시 '운전기사' 또는 '차량 지도교사'를 선택하고 해당 차량을 지정하면 승인 대기 목록에 표시됩니다.
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredBuses.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                
                <p className="font-bold text-slate-600">등록된 통학차량이 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TEACHER VIEW */}
        {currentTab === 'TEACHER' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">유치원 담당 교사 가입 및 승인 현황 ({teachers.length}명)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  교사 계정의 연동 상태를 확인합니다. 담임 배정 및 분반은 [반 관리] 메뉴에서 진행할 수 있습니다.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  담임 배정: {teachers.filter(t => t.assignedClass).length}명
                </span>
                <span className="font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                  반 미배정: {teachers.filter(t => !t.assignedClass).length}명
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTeachers.map(teacher => {
                const currentClass = teacher.assignedClass;

                return (
                  <div key={teacher.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                          {teacher.name?.[0] || '교'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-base whitespace-nowrap">{formatTeacherName(teacher.name)}</span>
                            <span className="text-[11px] bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-bold border border-green-200 whitespace-nowrap">
                              가입 승인됨
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 truncate" title={teacher.email}>
                            <span>{teacher.email}</span>
                            {teacher.phone && <span className="text-slate-400"> • {teacher.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {currentClass && currentClass !== '미배정' ? (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-bold border border-blue-100">
                            {currentClass} 담임교사
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg font-medium border border-slate-200">
                            반 미배정
                          </span>
                        )}
                        {teacher.isLocked && (
                          <span className="text-[11px] bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-bold border border-red-200">
                            계정 잠김
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {teacher.isLocked && handleUnlockUser && (
                          <button
                            onClick={() => handleUnlockUser(teacher.id)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition shadow-xs"
                          >
                            잠금 해제
                          </button>
                        )}
                        <button
                          onClick={() => handleRevokeTeacher(teacher.id)}
                          className="px-3.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition shadow-xs"
                        >
                          연동 해제
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTeachers.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                <p className="font-bold text-slate-600">등록된 유치원 교사가 없습니다.</p>
                <p className="text-xs text-slate-400 mt-1">교사가 회원가입 시 '유치원 교사'를 선택하고 원 코드로 가입하면 여기에 표시됩니다.</p>
              </div>
            )}
          </div>
        )}

        {/* SUBSTITUTE TAB (대체 기사 / 교사 임시 계정 일괄 관리) */}
        {currentTab === 'SUBSTITUTE' && (
          <div className="space-y-6">
            {/* Top Summary Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-500">전체 통학차량</div>
                  <div className="text-2xl font-black text-slate-800 mt-0.5">{substituteStats.totalBuses}호차</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-lg font-bold">
                  🚌
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-amber-50/40">
                <div>
                  <div className="text-[11px] font-bold text-amber-700">현재 대체기사 운행중</div>
                  <div className="text-2xl font-black text-amber-600 mt-0.5 flex items-center gap-1.5">
                    {substituteStats.activeDrivers}명
                    {substituteStats.activeDrivers > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping inline-block" />
                    )}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold">
                  ⚡
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-500">대기 / 보안 잠금</div>
                  <div className="text-2xl font-black text-slate-700 mt-0.5">{substituteStats.inactiveDrivers}명</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-lg font-bold">
                  🔒
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-indigo-50/40">
                <div>
                  <div className="text-[11px] font-bold text-indigo-700">대체 지도교사 운행중</div>
                  <div className="text-2xl font-black text-indigo-600 mt-0.5">{substituteStats.activeTeachers}명</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-bold">
                  👩‍🏫
                </div>
              </div>
            </div>

            {/* Security Notice Banner */}
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50/40 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900 leading-relaxed shadow-xs">
              <span className="text-lg shrink-0 mt-0.5">🛡️</span>
              <div className="min-w-0">
                <span className="font-bold text-amber-950 block mb-0.5">대체 인력 임시 계정 보안 관리 수칙</span>
                대체 기사 임시 계정은 정규 기사님이 휴식(연차·병가 등) 처리된 동안에만 로그인할 수 있도록 설계되어 있습니다.
                평소에는 무단 접속 방지를 위해 <b>비활성화(로그인 불가 잠금)</b> 상태로 유지되며, [휴식/대체 설정] 시 즉시 활성화됩니다.
              </div>
            </div>

            {/* Role & Filter Control Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Role Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSubstituteRoleTab('DRIVER')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      substituteRoleTab === 'DRIVER'
                        ? 'bg-white text-amber-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🚌 대체 기사 임시 계정</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-800">
                      {substituteStats.totalBuses}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubstituteRoleTab('TEACHER')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      substituteRoleTab === 'TEACHER'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>👩‍🏫 대체 교사 임시 계정</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-indigo-100 text-indigo-800">
                      {substituteStats.totalBuses}
                    </span>
                  </button>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setSubstituteStatusFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      substituteStatusFilter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    전체 보기 ({buses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubstituteStatusFilter('ACTIVE')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      substituteStatusFilter === 'ACTIVE' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    운행 중 활성 ({substituteRoleTab === 'DRIVER' ? substituteStats.activeDrivers : substituteStats.activeTeachers})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubstituteStatusFilter('INACTIVE')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      substituteStatusFilter === 'INACTIVE' ? 'bg-slate-500 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    대기 잠금 ({substituteRoleTab === 'DRIVER' ? substituteStats.inactiveDrivers : substituteStats.inactiveTeachers})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const lines = filteredSubstituteBuses.map(b => {
                      const isDriver = substituteRoleTab === 'DRIVER';
                      const sub = isDriver ? (b.substituteDriver || {}) : (b.substituteTeacher || {});
                      const isActive = isDriver ? (b.isDriverResting || sub.isActive) : (b.isTeacherResting || sub.isActive);
                      return `[${b.name || `${b.busNumber}호차`}] ${sub.name || (isDriver ? '대체기사' : '대체교사')} | 아이디: ${sub.email || `sub_${isDriver ? 'driver' : 'teacher'}${b.id}@takeme.com`} | 비밀번호: ${sub.password || 'password123!'} | 상태: ${isActive ? '운행중(로그인가능)' : '잠금(로그인불가)'}`;
                    });
                    navigator.clipboard?.writeText(lines.join('\n'));
                    alert('현재 조회된 임시 계정 명단 목록이 클립보드에 복사되었습니다.');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer border border-slate-200"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  목록 전체 복사
                </button>
              </div>
            </div>

            {/* Bus Substitute Account Cards Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {filteredSubstituteBuses.map(bus => {
                const isDriver = substituteRoleTab === 'DRIVER';
                const sub = isDriver ? (bus.substituteDriver || {}) : (bus.substituteTeacher || {});
                const isResting = isDriver ? Boolean(bus.isDriverResting || sub.isActive) : Boolean(bus.isTeacherResting || sub.isActive);
                const originalName = isDriver ? (bus.driverName || '기사 미배정') : (bus.teacherName || '지도교사 미배정');
                const originalPhone = isDriver ? (bus.driverPhone || '') : (bus.teacherPhone || '');
                const defaultEmail = isDriver ? `sub_driver${bus.id}@takeme.com` : `sub_teacher${bus.id}@takeme.com`;
                const accountEmail = sub.email || defaultEmail;
                const accountPassword = sub.password || 'password123!';
                const isPasswordVisible = Boolean(visiblePasswords[bus.id]);

                return (
                  <div
                    key={bus.id}
                    className={`p-5 bg-white rounded-2xl border transition-all shadow-xs flex flex-col justify-between gap-4 ${
                      isResting
                        ? 'border-amber-300 ring-2 ring-amber-100 shadow-amber-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Card Header: Bus & Original Staff Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-base shrink-0 shadow-xs"
                          style={{ backgroundColor: bus.color || '#2563eb' }}
                        >
                          {bus.busNumber || `${bus.id}호`}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-base">{bus.name}</span>
                            {bus.plateNumber && (
                              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                {bus.plateNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>본래 {isDriver ? '기사' : '교사'}: <b>{originalName}</b></span>
                            {originalPhone && <span className="text-slate-400">({originalPhone})</span>}
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                              isResting ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {isResting ? '⚠️ 휴식 중' : '정상 운행'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0 text-right">
                        {isResting ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            운행 중 (로그인 허용)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            보안 잠금 (로그인 차단)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Substitute Staff & Account Info Box */}
                    <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">
                            {sub.name || (isDriver ? '대체 기사님' : '대체 지도교사님')}
                          </span>
                          {sub.phone && (
                            <span className="text-slate-500 font-mono text-[11px]">{sub.phone}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-amber-800 bg-amber-100/80 font-bold px-2 py-0.5 rounded-md">
                          사유: {sub.reason || (isDriver ? '연차 휴가' : '병가')}
                        </span>
                      </div>

                      {/* Credentials Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Email / ID */}
                        <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-1">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 font-bold block">임시 계정 아이디 (이메일)</span>
                            <span className="font-mono text-xs text-slate-800 font-bold truncate block" title={accountEmail}>
                              {accountEmail}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(accountEmail);
                              alert(`아이디(${accountEmail})가 복사되었습니다.`);
                            }}
                            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors shrink-0 cursor-pointer"
                            title="아이디 복사"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>

                        {/* Password */}
                        <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-1">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 font-bold block">임시 비밀번호</span>
                            <span className="font-mono text-xs text-slate-800 font-bold truncate block">
                              {isPasswordVisible ? accountPassword : '••••••••••••'}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setVisiblePasswords(prev => ({
                                  ...prev,
                                  [bus.id]: !prev[bus.id]
                                }));
                              }}
                              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                              title={isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                            >
                              <span className="text-xs">{isPasswordVisible ? '🙈' : '👁️'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(accountPassword);
                                alert('비밀번호가 복사되었습니다.');
                              }}
                              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                              title="비밀번호 복사"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const guide = `[TakeMe 통학차량 대체 ${isDriver ? '기사' : '교사'} 임시 로그인 안내]\n호차: ${bus.name}\n성함: ${sub.name || (isDriver ? '대체 기사님' : '대체 교사님')}\n아이디: ${accountEmail}\n비밀번호: ${accountPassword}\n* 정규 ${isDriver ? '기사' : '교사'}님 휴식 기간 중에만 앱 로그인이 가능합니다.`;
                          navigator.clipboard?.writeText(guide);
                          alert(`[${bus.name}] 대체 ${isDriver ? '기사' : '교사'}님께 전달할 로그인 안내 문구가 클립보드에 복사되었습니다!`);
                        }}
                        className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        기사님 전달용 정보 복사
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (typeof onOpenSubstituteModal === 'function') {
                            onOpenSubstituteModal(bus);
                          }
                        }}
                        className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                          isResting
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {isResting ? '복귀 / 휴식 상태 변경' : '휴식 처리 및 계정 활성화'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredSubstituteBuses.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                <p className="font-bold text-slate-600">조회된 대체 인력 차량이 없습니다.</p>
                <p className="text-xs text-slate-400 mt-1">검색어나 상태 필터를 확인해주세요.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
