import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config';

export default function IntegratedCalendar({
  selectedAcademyId,
  currentUser,
  availableClasses = [],
  buses = [],
  onNavigateToApproval,
  onClose,
}) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [selectedDateStr, setSelectedDateStr] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  );

  const [calendarData, setCalendarData] = useState({
    summary: { pendingCount: 0, todayNewCount: 0, monthApprovedCount: 0 },
    holidays: [],
    scheduleChanges: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState(''); // '', 'HOLIDAY', 'EVENT', 'VACATION', 'CHANGE'
  const [filterClass, setFilterClass] = useState('');
  const [search, setSearch] = useState('');

  // Add Event Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    type: 'EVENT',
    title: '',
    startDate: selectedDateStr,
    endDate: selectedDateStr,
    targetClass: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('takeme_token') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'x-academy-id': String(selectedAcademyId || ''),
    };
  };

  const loadCalendar = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        year: String(currentYear),
        month: String(currentMonth),
      });
      if (filterClass) queryParams.append('className', filterClass);

      const res = await fetch(`${API_BASE_URL}/approval/calendar?${queryParams.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCalendarData(data);
      }
    } catch (e) {
      console.error('Failed to load calendar data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [currentYear, currentMonth, filterClass, selectedAcademyId]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
    setSelectedDateStr(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    );
  };

  const handleCreateEvent = async e => {
    e.preventDefault();
    if (!newEvent.title.trim()) {
      alert('일정/행사 제목을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/approval/calendar/event`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newEvent),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAddModalOpen(false);
        setNewEvent({
          type: 'EVENT',
          title: '',
          startDate: selectedDateStr,
          endDate: selectedDateStr,
          targetClass: '',
          reason: '',
        });
        loadCalendar();
      } else {
        alert(data.message || '일정 등록에 실패했습니다.');
      }
    } catch (err) {
      alert('일정 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async eventId => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/approval/calendar/event/${eventId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        loadCalendar();
      } else {
        alert('일정 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('일정 삭제 중 오류가 발생했습니다.');
    }
  };

  // Generate calendar days
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const calendarDays = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  // Selected date events & changes
  const selectedDayEvents = (calendarData.holidays || []).filter(h => {
    return h.startDate <= selectedDateStr && h.endDate >= selectedDateStr;
  });

  const selectedDayChanges = (calendarData.scheduleChanges || []).filter(c => {
    return c.startDate <= selectedDateStr && c.endDate >= selectedDateStr;
  });

  const { pendingCount, todayNewCount, monthApprovedCount } = calendarData.summary || {};

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Top 3 Metric Cards with Quick Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* 1. 결재 대기 */}
          <div
            onClick={onNavigateToApproval}
            className="p-3.5 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50/40 border border-red-200/80 cursor-pointer hover:shadow-md transition-all active:scale-[0.99] flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                결재 대기 신청
              </div>
              <div className="text-2xl font-black text-slate-800 mt-0.5">
                {pendingCount || 0}<span className="text-sm font-bold text-slate-500 ml-1">건</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
              신청함 ➔
            </div>
          </div>

          {/* 2. 오늘 신규 신청 */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/40 border border-blue-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-blue-600">오늘 신규 접수</div>
              <div className="text-2xl font-black text-slate-800 mt-0.5">
                {todayNewCount || 0}<span className="text-sm font-bold text-slate-500 ml-1">건</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
              📝
            </div>
          </div>

          {/* 3. 이번 달 승인된 변경 */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-emerald-600">이번 달 통학 변경 반영</div>
              <div className="text-2xl font-black text-slate-800 mt-0.5">
                {monthApprovedCount || 0}<span className="text-sm font-bold text-slate-500 ml-1">건</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              🚍
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Controls & Month Navigator */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold"
            >
              ◀
            </button>
            <h2 className="text-base font-extrabold text-slate-800 px-2 min-w-[120px] text-center">
              {currentYear}년 {currentMonth}월
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold"
            >
              ▶
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="">모든 반</option>
            {availableClasses.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setNewEvent(prev => ({
                ...prev,
                startDate: selectedDateStr,
                endDate: selectedDateStr,
              }));
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            일정 등록
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-xs flex items-center gap-1 transition-all"
              title="지도 화면으로 복귀"
            >
              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              지도 복귀
            </button>
          )}
        </div>
      </div>

      {/* Main Grid & Side Schedule */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Monthly Calendar View (Left/Main) */}
        <div className="flex-1 p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Days of week */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-600 py-2.5">
              <span className="text-red-500">일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span className="text-blue-500">토</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[500px]">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="bg-slate-50/40 p-2 min-h-[90px]" />;
                }

                const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = dateStr === selectedDateStr;
                const isCurrentDate = dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                const dayHolidays = (calendarData.holidays || []).filter(h => h.startDate <= dateStr && h.endDate >= dateStr);
                const dayChanges = (calendarData.scheduleChanges || []).filter(c => c.startDate <= dateStr && c.endDate >= dateStr);

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`p-2 min-h-[95px] flex flex-col justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 ring-2 ring-blue-500 ring-inset'
                        : isCurrentDate
                        ? 'bg-amber-50/40 hover:bg-slate-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                        isCurrentDate ? 'bg-blue-600 text-white' : 'text-slate-700'
                      }`}>
                        {day}
                      </span>

                      {(dayHolidays.length > 0 || dayChanges.length > 0) && (
                        <span className="text-[10px] font-bold text-slate-400">
                          {dayHolidays.length + dayChanges.length}건
                        </span>
                      )}
                    </div>

                    {/* Chips Preview */}
                    <div className="space-y-1 mt-1 overflow-hidden">
                      {dayHolidays.slice(0, 2).map(h => (
                        <div
                          key={`h-${h.id}`}
                          className="text-[10px] truncate px-1.5 py-0.5 rounded font-bold bg-red-100 text-red-800"
                          title={h.title}
                        >
                          {h.title}
                        </div>
                      ))}

                      {dayChanges.slice(0, 2).map(c => (
                        <div
                          key={`c-${c.id}`}
                          className="text-[10px] truncate px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-800"
                          title={`${c.student?.name} (${c.overrideType})`}
                        >
                          {c.student?.name} ({c.overrideType === 'ABSENCE' ? '결석' : '변경'})
                        </div>
                      ))}

                      {(dayHolidays.length + dayChanges.length > 4) && (
                        <div className="text-[9px] text-slate-400 font-bold pl-1">
                          +{dayHolidays.length + dayChanges.length - 4}건 더보기
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Date Details Panel (Right Pane) */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-blue-600">선택 날짜 상세</div>
              <div className="text-base font-extrabold text-slate-800">{selectedDateStr}</div>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              총 {selectedDayEvents.length + selectedDayChanges.length}건
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 1. 휴업 및 행사 섹션 */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>기관 휴업 / 행사</span>
                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">
                  {selectedDayEvents.length}
                </span>
              </h4>

              {selectedDayEvents.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">
                  등록된 휴업/행사가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map(h => (
                    <div key={h.id} className="p-3 rounded-xl border border-red-200 bg-red-50/40 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-800">{h.title}</span>
                        <button
                          onClick={() => handleDeleteEvent(h.id)}
                          className="text-slate-400 hover:text-red-600 text-xs font-bold"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">
                        기간: {h.startDate} ~ {h.endDate}
                        {h.targetClass && <span className="ml-2 font-bold text-purple-700">({h.targetClass})</span>}
                      </div>
                      {h.reason && <div className="text-[11px] text-slate-500 mt-0.5">{h.reason}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. 승인된 통학 변경 명단 섹션 */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>통학 변경 반영 원아</span>
                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full text-[10px]">
                  {selectedDayChanges.length}
                </span>
              </h4>

              {selectedDayChanges.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">
                  반영된 통학 변동 사항이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayChanges.map(c => (
                    <div key={c.id} className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">{c.student?.name}</span>
                          {c.student?.className && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                              {c.student.className}
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          c.overrideType === 'ABSENCE' ? 'bg-red-100 text-red-700' :
                          c.overrideType === 'LATENESS' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {c.overrideType === 'ABSENCE' ? '결석' : c.overrideType === 'LATENESS' ? '지각' : '정류장 변경'}
                        </span>
                      </div>

                      {c.newAddress && (
                        <div className="text-[11px] text-slate-600 truncate">
                          <span className="font-semibold text-slate-400">변경지:</span> {c.newAddress}
                        </div>
                      )}
                      {c.reason && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span className="font-semibold text-slate-400">사유:</span> {c.reason}
                        </div>
                      )}
                      {c.student?.phone && (
                        <div className="text-[11px] text-blue-600 mt-0.5 font-mono">
                          연락처: {c.student.phone}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <h3 className="text-base font-bold text-slate-800 mb-1">새 일정 / 휴업 등록</h3>
            <p className="text-xs text-slate-500 mb-4">
              기관 휴업, 반별 휴업, 방학, 행사 일정을 등록하면 통합 캘린더에 반영됩니다.
            </p>

            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">유형</label>
                <select
                  value={newEvent.type}
                  onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="EVENT">유치원/학원 행사</option>
                  <option value="ACADEMY_HOLIDAY">기관 전체 휴업</option>
                  <option value="CLASS_HOLIDAY">반별 휴업</option>
                  <option value="VACATION">방학</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">일정 제목 *</label>
                <input
                  type="text"
                  placeholder="예: 봄 소풍, 개원기념일, 여름방학"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">시작일</label>
                  <input
                    type="date"
                    value={newEvent.startDate}
                    onChange={e => setNewEvent({ ...newEvent, startDate: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">종료일</label>
                  <input
                    type="date"
                    value={newEvent.endDate}
                    onChange={e => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
              </div>

              {newEvent.type === 'CLASS_HOLIDAY' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">대상 반</label>
                  <select
                    value={newEvent.targetClass}
                    onChange={e => setNewEvent({ ...newEvent, targetClass: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-purple-700"
                    required
                  >
                    <option value="">반을 선택하세요</option>
                    {availableClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">상세 내용 / 사유</label>
                <textarea
                  rows={2}
                  placeholder="상세 안내 사항을 입력하세요 (선택)"
                  value={newEvent.reason}
                  onChange={e => setNewEvent({ ...newEvent, reason: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  {isSubmitting ? '등록 중...' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

