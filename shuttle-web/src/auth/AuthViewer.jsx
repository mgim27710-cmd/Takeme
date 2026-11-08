import React, { useState, useMemo } from 'react';

export default function AuthViewer({
  isClosing,
  currentTab = 'STUDENT', // 'STUDENT' | 'STAFF' | 'TEACHER'
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
  isProcessing
}) {
  const [studentStatusFilter, setStudentStatusFilter] = useState('ALL'); // 'ALL', 'PENDING', 'APPROVED', 'UNREGISTERED'
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Desk Staff & Internal Attendance States
  const [deskStaffList, setDeskStaffList] = useState(() => {
    try {
      const stored = localStorage.getItem('takeme_desk_staff');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [
      { id: 'desk_1', name: '이지은', phone: '010-3321-8841', email: 'desk1@takeme.com', duty: '원서 상담 및 수납', status: '정상 근무' },
      { id: 'desk_2', name: '박서현', phone: '010-4920-1123', email: 'desk2@takeme.com', duty: '행정 서류 및 학부모 민원', status: '정상 근무' },
    ];
  });
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({ name: '', phone: '', email: '', duty: '원서 상담 및 수납' });

  // Internal Staff Attendance List
  const [attendanceRecords, setAttendanceRecords] = useState(() => {
    try {
      const stored = localStorage.getItem('takeme_staff_attendance');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [
      { id: 'att_1', name: '이지은', role: '데스크 직원', checkIn: '08:25', checkOut: '-', status: '출근' },
      { id: 'att_2', name: '박서현', role: '데스크 직원', checkIn: '08:30', checkOut: '-', status: '출근' },
      { id: 'att_3', name: '김지민', role: '햇살반 단임교사', checkIn: '08:15', checkOut: '-', status: '출근' },
      { id: 'att_4', name: '최유나', role: '1호차 지도교사', checkIn: '-', checkOut: '-', status: '연차/휴가 (대체자 필수)' },
    ];
  });

  // Substitute Guide Teacher Replacement State
  const [substituteAssignments, setSubstituteAssignments] = useState(() => {
    try {
      const stored = localStorage.getItem('takeme_substitute_assignments');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [
      { busId: '1', busName: '1호차', absentTeacher: '최유나 선생님', subTeacher: '박서현 데스크 직원', date: new Date().toISOString().split('T')[0], status: '배정 완료' }
    ];
  });
  const [selectedSubBus, setSelectedSubBus] = useState('1');
  const [selectedSubTeacher, setSelectedSubTeacher] = useState('');
  const [subReason, setSubReason] = useState('병가/휴가로 인한 대체 동승');

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
              {currentTab === 'DESK_STAFF' && <span>데스크 직원·근태 및 대체 지도교사 관리</span>}
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              원 인증: {academy?.authCode || '미발급'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {currentTab === 'STUDENT' && '앱에 원 인증코드를 입력하고 가입한 원아 및 학부모의 접근 권한을 승인하거나 해제합니다.'}
            {currentTab === 'STAFF' && '통학차량 기사님과 동승 지도교사의 계정 연동 및 운행 권한을 관리합니다.'}
            {currentTab === 'TEACHER' && '원 인증코드로 가입된 유치원 교사의 계정 연동 상태를 확인하고 관리합니다.'}
            {currentTab === 'DESK_STAFF' && '데스크(행정 직원) 계정, 원내 직원 근태, 지도교사 결근 시 필수 대체 근무자를 관리합니다.'}
          </p>
        </div>

        {/* Tab Pills & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sub-tab Switcher Pills */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setCurrentTab('STUDENT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
              onClick={() => setCurrentTab('DESK_STAFF')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentTab === 'DESK_STAFF'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>데스크·근태 관리</span>
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
                            <span className="font-bold text-slate-900 text-base whitespace-nowrap">{teacher.name} 선생님</span>
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

        {/* TAB 4: DESK STAFF & INTERNAL ATTENDANCE & SUBSTITUTE GUIDE TEACHER */}
        {currentTab === 'DESK_STAFF' && (
          <div className="space-y-6">
            {/* 1. Mandatory Substitute Guide Teacher Alert Banner */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
                  !
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-amber-950">
                      [도로교통법 제53조] 동승 지도교사 휴무 시 대체 인솔자 필수 배정 의무화
                    </h3>
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded-md">법적 의무</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    통학버스 동승 지도교사 결근 또는 휴가 시, 반드시 사전에 지정된 <strong>대체 근무자(단임교사 또는 데스크 행정직원)</strong>를 호차에 배정해야만 안전 운행 결재가 완료됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Substitute Assignment Action Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-800">동승 지도교사 대체 근무 배정</h3>
                  <p className="text-xs text-slate-500">결근 또는 휴무인 호차를 선택하고 대체 지도교사를 즉시 배정하세요.</p>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
                  오늘 날짜: {new Date().toLocaleDateString('ko-KR')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">대상 호차 선택</label>
                  <select
                    value={selectedSubBus}
                    onChange={(e) => setSelectedSubBus(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    {buses.length > 0 ? (
                      buses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.busNumber || `${b.id}호차`} (기존 동승: {b.teacherName || '미지정'})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1">1호차 (기존 동승: 최유나 선생님)</option>
                        <option value="2">2호차 (기존 동승: 김민지 선생님)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">대체 근무 교직원 지정 *</label>
                  <select
                    value={selectedSubTeacher}
                    onChange={(e) => setSelectedSubTeacher(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-purple-300 rounded-xl text-xs font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="">-- 대체 근무 교직원을 선택하세요 --</option>
                    <optgroup label="데스크(행정) 직원">
                      {deskStaffList.map((d) => (
                        <option key={d.id} value={`${d.name} (데스크 직원)`}>
                          {d.name} ({d.duty})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="원내 교사">
                      {teachers.map((t) => (
                        <option key={t.id} value={`${t.name} (교사)`}>
                          {t.name} 선생님 ({t.assignedClass || '교사'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">사유 / 비고</label>
                  <input
                    type="text"
                    value={subReason}
                    onChange={(e) => setSubReason(e.target.value)}
                    placeholder="예: 정기 연차로 인한 대체 배정"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedSubTeacher) {
                      return alert('대체 근무 교직원을 반드시 선택해주세요.');
                    }
                    const busObj = buses.find((b) => String(b.id) === String(selectedSubBus));
                    const busName = busObj ? (busObj.name || `${busObj.id}호차`) : `${selectedSubBus}호차`;
                    const absentTeacher = busObj?.teacherName || '담당 지도교사';
                    const newAssignment = {
                      busId: String(selectedSubBus),
                      busName,
                      absentTeacher,
                      subTeacher: selectedSubTeacher,
                      date: new Date().toISOString().split('T')[0],
                      reason: subReason,
                      status: '대체 배정 완료 (운행 가능)',
                    };
                    const updated = [newAssignment, ...substituteAssignments];
                    setSubstituteAssignments(updated);
                    try {
                      localStorage.setItem('takeme_substitute_assignments', JSON.stringify(updated));
                    } catch {
                      // ignore
                    }
                    alert(`[대체 지도교사 배정 완료]\n${busName} 대체 동승자로 '${selectedSubTeacher}'이(가) 배정되었습니다.\n도로교통법 의무 요건이 충족되어 차량 운행이 정상 승인되었습니다.`);
                    setSelectedSubTeacher('');
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-98"
                >
                  대체 지도교사 배정 및 운행 승인
                </button>
              </div>

              {/* Substitute Assignment History Table */}
              {substituteAssignments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 overflow-x-auto">
                  <h4 className="text-xs font-bold text-slate-700 mb-2">오늘의 대체 탑승 배정 현황</h4>
                  <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">날짜</th>
                        <th className="py-2 px-3">호차</th>
                        <th className="py-2 px-3">기존 지도교사</th>
                        <th className="py-2 px-3">대체 인솔자</th>
                        <th className="py-2 px-3">사유</th>
                        <th className="py-2 px-3">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {substituteAssignments.map((sub, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/30">
                          <td className="py-2 px-3 text-slate-500">{sub.date}</td>
                          <td className="py-2 px-3 font-bold text-purple-900">{sub.busName}</td>
                          <td className="py-2 px-3 text-red-600">{sub.absentTeacher} (휴무)</td>
                          <td className="py-2 px-3 font-black text-emerald-700">{sub.subTeacher}</td>
                          <td className="py-2 px-3 text-slate-500">{sub.reason || '대체 동승'}</td>
                          <td className="py-2 px-3">
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Internal Attendance Tracking Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-800">원내 내부 교직원 근태 관리</h3>
                  <p className="text-xs text-slate-500">행정 데스크 직원 및 교사의 출퇴근 현황을 실시간 관리합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    정상 출근 {attendanceRecords.filter(a => a.status === '출근').length}명
                  </span>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    휴가/연차 {attendanceRecords.filter(a => a.status.includes('휴가')).length}명
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">성명</th>
                      <th className="py-2.5 px-3">역할 / 부서</th>
                      <th className="py-2.5 px-3">출근 시각</th>
                      <th className="py-2.5 px-3">퇴근 시각</th>
                      <th className="py-2.5 px-3">근태 상태</th>
                      <th className="py-2.5 px-3 text-right">근태 처리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {attendanceRecords.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-800">{att.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{att.role}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">{att.checkIn}</td>
                        <td className="py-2.5 px-3 text-slate-500">{att.checkOut}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            att.status === '출근'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {att.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = attendanceRecords.map((a) => {
                                if (a.id === att.id) {
                                  const now = new Date();
                                  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                  if (a.status === '출근') {
                                    return { ...a, checkOut: timeStr, status: '퇴근 완료' };
                                  } else {
                                    return { ...a, checkIn: timeStr, status: '출근' };
                                  }
                                }
                                return a;
                              });
                              setAttendanceRecords(updated);
                              try { localStorage.setItem('takeme_staff_attendance', JSON.stringify(updated)); } catch {
                                // ignore
                              }
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors shadow-2xs"
                          >
                            상태 전환
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Desk Staff Member List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-800">데스크(행정 직원) 계정 목록</h3>
                  <p className="text-xs text-slate-500">상담, 수납, 서류 등록 등 원무 행정을 담당하는 직원을 등록하고 관리합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>신규 데스크 직원 등록</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {deskStaffList.map((staff) => (
                  <div
                    key={staff.id}
                    className="p-4 bg-slate-50 hover:bg-purple-50/30 border border-slate-200 hover:border-purple-300 rounded-2xl transition-all shadow-xs flex items-start justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800 text-sm">{staff.name}</span>
                        <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                          데스크 직원
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-semibold">담당: {staff.duty}</div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        연락처: {staff.phone} | 이메일: {staff.email}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {staff.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal: 신규 데스크 직원 등록 */}
            {showAddStaffModal && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[2200] p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-base font-black text-slate-800">신규 데스크 직원 계정 등록</h3>
                    <button
                      type="button"
                      onClick={() => setShowAddStaffModal(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newStaffForm.name.trim()) return alert('성명을 입력해주세요.');
                      const newStaff = {
                        id: `desk_${Date.now()}`,
                        name: newStaffForm.name.trim(),
                        phone: newStaffForm.phone.trim() || '010-0000-0000',
                        email: newStaffForm.email.trim() || `desk_${Date.now()}@takeme.com`,
                        duty: newStaffForm.duty.trim() || '원무 행정',
                        status: '정상 근무',
                      };
                      const updated = [...deskStaffList, newStaff];
                      setDeskStaffList(updated);
                      try { localStorage.setItem('takeme_desk_staff', JSON.stringify(updated)); } catch {
                        // ignore
                      }

                      // Also append to attendance list
                      const newAtt = {
                        id: `att_${Date.now()}`,
                        name: newStaff.name,
                        role: '데스크 직원',
                        checkIn: '08:30',
                        checkOut: '-',
                        status: '출근',
                      };
                      const attUpdated = [...attendanceRecords, newAtt];
                      setAttendanceRecords(attUpdated);
                      try { localStorage.setItem('takeme_staff_attendance', JSON.stringify(attUpdated)); } catch {
                        // ignore
                      }

                      alert(`'${newStaff.name}' 데스크 직원이 성공적으로 등록되었습니다!`);
                      setShowAddStaffModal(false);
                      setNewStaffForm({ name: '', phone: '', email: '', duty: '원서 상담 및 수납' });
                    }}
                    className="space-y-3.5 py-4"
                  >
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">직원 성명 *</label>
                      <input
                        type="text"
                        value={newStaffForm.name}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                        placeholder="예: 최서연"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">휴대폰 번호</label>
                      <input
                        type="text"
                        value={newStaffForm.phone}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                        placeholder="010-0000-0000"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">이메일 계정</label>
                      <input
                        type="email"
                        value={newStaffForm.email}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                        placeholder="staff@example.com"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">담당 직무</label>
                      <select
                        value={newStaffForm.duty}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, duty: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="원서 상담 및 수납">원서 상담 및 수납</option>
                        <option value="행정 서류 및 학부모 민원">행정 서류 및 학부모 민원</option>
                        <option value="통학차량 대체 동승 및 인솔">통학차량 대체 동승 및 인솔</option>
                        <option value="총무 및 시설 관리">총무 및 시설 관리</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowAddStaffModal(false)}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-all active:scale-98"
                      >
                        등록 완료
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
