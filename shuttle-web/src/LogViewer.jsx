import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { API_BASE_URL } from './config';

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const formatYMD = (year, month, day) => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const toDateStr = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val.split('T')[0];
  if (val instanceof Date) {
    return formatYMD(val.getFullYear(), val.getMonth(), val.getDate());
  }
  return String(val);
};

export default function LogViewer({
  buses = [],
  students = [],
  currentTab = 'ALL', // 'ALL', 'EVENT_HOLIDAY', 'ABSENCE_VARIABLE', 'LOG'
  onTabChange,
  isClosing = false,
  currentUser = null,
  availableClasses = [],
  academyId = null,
}) {
  // Resolved user info & role
  const resolvedUser = useMemo(() => {
    if (currentUser && currentUser.role) return currentUser;
    try {
      return JSON.parse(localStorage.getItem('takeme_user') || '{}');
    } catch (e) {
      return {};
    }
  }, [currentUser]);

  const userRole = resolvedUser.role || 'ACADEMY_ADMIN';
  const isAdmin = userRole === 'ACADEMY_ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'DESK_STAFF';
  const isHomeroom = userRole === 'HOMEROOM_TEACHER';
  const isTeacher = userRole === 'TEACHER' || userRole === 'SHUTTLE_TEACHER';
  const isParent = userRole === 'PARENT';
  const myAssignedClass = resolvedUser.assignedClass || '';

  const activeAcadId = useMemo(() => {
    return academyId ||
      localStorage.getItem('takeme_selected_academy_id') ||
      resolvedUser.academyId ||
      '';
  }, [academyId, resolvedUser]);

  // Auth headers helper
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('takeme_token') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'x-academy-id': String(activeAcadId || ''),
    };
  }, [activeAcadId]);

  // Mode state: 'ALL' | 'EVENT_HOLIDAY' | 'ABSENCE_VARIABLE' | 'LOG'
  const [activeMode, setActiveMode] = useState(() => currentTab || 'ALL');

  useEffect(() => {
    if (currentTab && currentTab !== activeMode) {
      setActiveMode(currentTab);
    }
  }, [currentTab]);

  const handleModeChange = (mode) => {
    setActiveMode(mode);
    if (onTabChange) onTabChange(mode);
  };

  // Selected date state
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedDateStr = useMemo(() => toDateStr(selectedDate), [selectedDate]);

  // Class Selection: Replace vehicle tabs with Class tabs ("지금 호차별로 되어 있는거 빼고 반별로 바꿔주고")
  // "원장은 모든 일정 반별 말고 볼 수 있게 해줘" -> Director defaults to 'ALL' (전체 반)
  const classList = useMemo(() => {
    const set = new Set();
    if (Array.isArray(availableClasses) && availableClasses.length > 0) {
      availableClasses.forEach(c => { if (c) set.add(String(c).trim()); });
    }
    students.forEach(s => {
      let raw = s?.raw;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (e) {}
      }
      const c1 = raw?.['반명'] || raw?.['반'] || s.assignedClass || s.className;
      if (c1 && String(c1).trim() && String(c1).trim() !== '미배정') {
        set.add(String(c1).trim());
      }
    });
    return Array.from(set);
  }, [availableClasses, students]);

  const [selectedClass, setSelectedClass] = useState(() => {
    if (isHomeroom && myAssignedClass) return myAssignedClass;
    return 'ALL'; // Director defaults to all classes
  });

  // Bus selection for LOG mode
  const [selectedBusId, setSelectedBusId] = useState(buses?.length > 0 ? buses[0].id : null);
  useEffect(() => {
    if ((!selectedBusId || !buses?.some(b => b.id === selectedBusId)) && buses?.length > 0) {
      setSelectedBusId(buses[0].id);
    }
  }, [buses, selectedBusId]);

  // Integrated Calendar Data (Events, Holidays, Schedule Overrides/Absences)
  const [calendarHolidays, setCalendarHolidays] = useState([]);
  const [calendarOverrides, setCalendarOverrides] = useState([]);
  const [approvedRides, setApprovedRides] = useState([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // Search keyword for student absences/variables ("원장의 경우에는 결석 학생 검색할 수 있게")
  const [searchKeyword, setSearchKeyword] = useState('');

  // Add Event/Holiday Modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    type: 'EVENT', // 'EVENT', 'ACADEMY_HOLIDAY', 'VACATION', 'CLASS_HOLIDAY'
    title: '',
    startDate: selectedDateStr,
    endDate: selectedDateStr,
    targetClass: isHomeroom && myAssignedClass ? myAssignedClass : '',
    reason: '',
  });
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  // Add Absence Modal state
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [newAbsence, setNewAbsence] = useState({
    studentId: '',
    startDate: selectedDateStr,
    endDate: selectedDateStr,
    reason: '질병 또는 개인 사유',
  });
  const [isSubmittingAbsence, setIsSubmittingAbsence] = useState(false);

  // Delete Holiday / Event state
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // LOG state & cache for LOG mode
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const logsCacheRef = useRef(new Map());

  const calendarRef = useRef(null);
  const hasScrolledRef = useRef(false);

  // Precompute 13 months metadata once
  const { currentYear, currentMonth, todayStr, monthsData } = useMemo(() => {
    const now = new Date();
    const cMonth = now.getMonth();
    const cYear = now.getFullYear();
    const tStr = toDateStr(now);
    const list = [];

    for (let i = -6; i <= 6; i++) {
      let m = cMonth + i;
      let y = cYear;
      while (m < 0) { m += 12; y -= 1; }
      while (m > 11) { m -= 12; y += 1; }
      const daysInMonth = getDaysInMonth(y, m);
      const firstDay = getFirstDayOfMonth(y, m);
      const daysArray = Array.from({ length: daysInMonth }, (_, idx) => {
        const d = idx + 1;
        return {
          day: d,
          dateStr: formatYMD(y, m, d),
        };
      });
      const blanks = Array.from({ length: firstDay }, (_, idx) => idx);
      list.push({
        year: y,
        month: m,
        isCurrentMonth: y === cYear && m === cMonth,
        daysArray,
        blanks,
      });
    }
    return { currentYear: cYear, currentMonth: cMonth, todayStr: tStr, monthsData: list };
  }, []);

  // Instant scroll to current month on open
  useLayoutEffect(() => {
    if (calendarRef.current && !hasScrolledRef.current) {
      const currentMonthElement = calendarRef.current.querySelector('[data-is-current="true"]');
      if (currentMonthElement) {
        calendarRef.current.scrollTop = currentMonthElement.offsetTop - calendarRef.current.offsetTop - 20;
        hasScrolledRef.current = true;
      }
    }
  }, []);

  // Fetch Calendar Data (Holidays + Overrides) with class & search filters
  const fetchCalendarData = useCallback(async () => {
    try {
      setIsLoadingCalendar(true);
      const queryParams = new URLSearchParams();
      if (selectedClass && selectedClass !== 'ALL') {
        queryParams.append('className', selectedClass);
      }
      if (searchKeyword.trim()) {
        queryParams.append('search', searchKeyword.trim());
      }

      const res = await fetch(`${API_BASE_URL}/approval/calendar?${queryParams.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCalendarHolidays(data.holidays || []);
        setCalendarOverrides(data.scheduleChanges || []);
      }
    } catch (e) {
      console.error('Failed to load calendar data', e);
    } finally {
      setIsLoadingCalendar(false);
    }
  }, [selectedClass, searchKeyword, getAuthHeaders]);

  // Fetch Approved Rides (일회성 셔틀 탑승 승인 내역)
  const fetchApprovedRides = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/chat/payment/requests${activeAcadId ? `?academyId=${activeAcadId}` : ''}`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setApprovedRides(data.filter(d => d.status === 'APPROVED') || []);
      }
    } catch (e) {
      // ignore
    }
  }, [activeAcadId, getAuthHeaders]);

  useEffect(() => {
    fetchCalendarData();
    fetchApprovedRides();
  }, [fetchCalendarData, fetchApprovedRides]);

  // Fetch Operation Logs when in LOG mode
  useEffect(() => {
    if (activeMode !== 'LOG' || !selectedBusId) return;

    const cacheKey = `${selectedDateStr}_${selectedBusId}`;
    const cached = logsCacheRef.current.get(cacheKey);

    if (cached) {
      setLogs(cached);
      setIsLoadingLogs(false);
    } else {
      setIsLoadingLogs(true);
    }

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/routing/daily-logs?date=${selectedDateStr}&vehicleId=${selectedBusId}`, {
      signal: controller.signal,
      headers: getAuthHeaders(),
    })
      .then(r => r.json())
      .then(data => {
        const safe = Array.isArray(data) ? data : [];
        logsCacheRef.current.set(cacheKey, safe);
        setLogs(safe);
      })
      .catch(e => {
        if (e.name !== 'AbortError') console.error(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingLogs(false);
      });

    return () => controller.abort();
  }, [activeMode, selectedDateStr, selectedBusId, getAuthHeaders]);

  // Filtered Daily Variables for Selected Date
  const selectedDateEvents = useMemo(() => {
    return calendarHolidays.filter(h => {
      const s = toDateStr(h.startDate);
      const e = toDateStr(h.endDate);
      const matchDate = selectedDateStr >= s && selectedDateStr <= e;
      if (!matchDate) return false;
      if (selectedClass !== 'ALL' && h.targetClass && h.targetClass !== selectedClass) return false;
      return true;
    });
  }, [calendarHolidays, selectedDateStr, selectedClass]);

  const selectedDateOverrides = useMemo(() => {
    return calendarOverrides.filter(o => {
      const s = toDateStr(o.startDate);
      const e = toDateStr(o.endDate);
      const matchDate = selectedDateStr >= s && selectedDateStr <= e;
      if (!matchDate) return false;
      if (selectedClass !== 'ALL') {
        const studentClass = o.student?.className;
        if (studentClass && studentClass !== selectedClass) return false;
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const n = (o.student?.name || '').toLowerCase();
        const p = (o.student?.phone || '').toLowerCase();
        const r = (o.reason || '').toLowerCase();
        if (!n.includes(kw) && !p.includes(kw) && !r.includes(kw)) return false;
      }
      return true;
    });
  }, [calendarOverrides, selectedDateStr, selectedClass, searchKeyword]);

  // Partition overrides into categories
  const absencesOnDate = useMemo(() => {
    return selectedDateOverrides.filter(o => o.overrideType === 'ABSENCE');
  }, [selectedDateOverrides]);

  const locationChangesOnDate = useMemo(() => {
    return selectedDateOverrides.filter(o => o.overrideType === 'CHANGE_LOCATION');
  }, [selectedDateOverrides]);

  const otherChangesOnDate = useMemo(() => {
    return selectedDateOverrides.filter(o => o.overrideType !== 'ABSENCE' && o.overrideType !== 'CHANGE_LOCATION');
  }, [selectedDateOverrides]);

  const approvedRidesOnDate = useMemo(() => {
    return approvedRides.filter(r => {
      const matchDate = (r.createdAt && r.createdAt.startsWith(selectedDateStr)) || (r.rideDate === selectedDateStr);
      if (!matchDate) return false;
      if (selectedClass !== 'ALL') {
        const studentObj = students.find(s => s.id === (r.studentId || r.student?.id));
        const c = studentObj?.raw?.['반명'] || studentObj?.raw?.['반'] || studentObj?.assignedClass;
        if (c && c !== selectedClass) return false;
      }
      return true;
    });
  }, [approvedRides, selectedDateStr, selectedClass, students]);

  // Calendar dot flags precomputation
  const dateIndicatorMap = useMemo(() => {
    const map = new Map();
    // Holidays & events
    calendarHolidays.forEach(h => {
      const s = toDateStr(h.startDate);
      const e = toDateStr(h.endDate);
      const isHoliday = h.type === 'ACADEMY_HOLIDAY' || h.type === 'CLASS_HOLIDAY' || h.type === 'HOLIDAY';
      const isVacation = h.type === 'VACATION';
      const isEvent = h.type === 'EVENT';

      const cur = new Date(s);
      const endD = new Date(e);
      while (cur <= endD) {
        const dStr = toDateStr(cur);
        const existing = map.get(dStr) || { hasHoliday: false, hasVacation: false, hasEvent: false, absences: 0, changes: 0 };
        if (isHoliday) existing.hasHoliday = true;
        if (isVacation) existing.hasVacation = true;
        if (isEvent) existing.hasEvent = true;
        map.set(dStr, existing);
        cur.setDate(cur.getDate() + 1);
      }
    });

    // Overrides & Absences
    calendarOverrides.forEach(o => {
      const s = toDateStr(o.startDate);
      const e = toDateStr(o.endDate);
      const isAbs = o.overrideType === 'ABSENCE';

      const cur = new Date(s);
      const endD = new Date(e);
      while (cur <= endD) {
        const dStr = toDateStr(cur);
        const existing = map.get(dStr) || { hasHoliday: false, hasVacation: false, hasEvent: false, absences: 0, changes: 0 };
        if (isAbs) {
          existing.absences += 1;
        } else {
          existing.changes += 1;
        }
        map.set(dStr, existing);
        cur.setDate(cur.getDate() + 1);
      }
    });

    return map;
  }, [calendarHolidays, calendarOverrides]);

  // Handle Event / Holiday Submission
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) {
      alert('일정/행사 제목을 입력해 주세요.');
      return;
    }

    try {
      setIsSubmittingEvent(true);
      const res = await fetch(`${API_BASE_URL}/approval/calendar/event`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newEvent),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsEventModalOpen(false);
        setNewEvent({
          type: 'EVENT',
          title: '',
          startDate: selectedDateStr,
          endDate: selectedDateStr,
          targetClass: isHomeroom && myAssignedClass ? myAssignedClass : '',
          reason: '',
        });
        await fetchCalendarData();
      } else {
        alert(data.message || '일정 등록에 실패했습니다.');
      }
    } catch (err) {
      alert('일정 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  // Handle Absence Submission
  const handleSaveAbsence = async (e) => {
    e.preventDefault();
    if (!newAbsence.studentId) {
      alert('결석 원아를 선택해 주세요.');
      return;
    }

    try {
      setIsSubmittingAbsence(true);
      const res = await fetch(`${API_BASE_URL}/approval/calendar/absence`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          studentId: Number(newAbsence.studentId),
          startDate: newAbsence.startDate,
          endDate: newAbsence.endDate,
          reason: newAbsence.reason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAbsenceModalOpen(false);
        setNewAbsence({
          studentId: '',
          startDate: selectedDateStr,
          endDate: selectedDateStr,
          reason: '질병 또는 개인 사유',
        });
        await fetchCalendarData();
      } else {
        alert(data.message || '결석 등록에 실패했습니다.');
      }
    } catch (err) {
      alert('결석 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingAbsence(false);
    }
  };

  // Handle Delete Event / Holiday
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeletingItem(true);
      if (itemToDelete.isOverride) {
        // Delete Absence / Override
        const res = await fetch(`${API_BASE_URL}/approval/calendar/absence/${itemToDelete.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          setItemToDelete(null);
          await fetchCalendarData();
        } else {
          alert('삭제 처리에 실패했습니다.');
        }
      } else {
        // Delete Holiday / Event
        const res = await fetch(`${API_BASE_URL}/approval/calendar/event/${itemToDelete.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          setItemToDelete(null);
          await fetchCalendarData();
        } else {
          alert('일정 삭제 처리에 실패했습니다.');
        }
      }
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Render Calendar Date Cells
  const getDayClasses = (dateStr) => {
    let classes = 'w-10 h-10 mx-auto rounded-full flex items-center justify-center text-sm font-bold transition-all relative ';
    const isSelected = dateStr === selectedDateStr;
    const isToday = dateStr === todayStr;
    const info = dateIndicatorMap.get(dateStr);

    if (isSelected) {
      return classes + 'bg-blue-600 text-white shadow-md scale-110 ring-2 ring-blue-300';
    }

    if (info?.hasHoliday) {
      return classes + 'bg-orange-100 text-orange-700 font-black border border-orange-300 hover:bg-orange-200';
    }

    if (info?.hasVacation) {
      return classes + 'bg-purple-100 text-purple-700 font-bold border border-purple-200 hover:bg-purple-200';
    }

    if (isToday) {
      return classes + 'bg-blue-50 text-blue-700 border border-blue-300 font-black';
    }

    return classes + 'hover:bg-slate-100 text-slate-700';
  };

  const renderDots = (dateStr) => {
    const info = dateIndicatorMap.get(dateStr);
    if (!info) return null;

    return (
      <div className="absolute bottom-1 flex justify-center items-center gap-0.5 w-full pointer-events-none">
        {info.hasHoliday && (
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" title="휴업일" />
        )}
        {info.hasEvent && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="학원/반 행사" />
        )}
        {info.absences > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title={`결석 ${info.absences}명`} />
        )}
        {info.changes > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={`통학 변동 ${info.changes}건`} />
        )}
      </div>
    );
  };

  // Helper for available students in current class selection
  const eligibleStudentsForAbsence = useMemo(() => {
    if (isParent) {
      return students.filter(s => {
        return (
          s.parentUserId === resolvedUser.id ||
          s.studentUserId === resolvedUser.id ||
          (s.phone && resolvedUser.phone && s.phone === resolvedUser.phone)
        );
      });
    }
    if (selectedClass !== 'ALL') {
      return students.filter(s => {
        const c = s.raw?.['반명'] || s.raw?.['반'] || s.assignedClass || s.className;
        return c === selectedClass;
      });
    }
    return students;
  }, [students, isParent, resolvedUser, selectedClass]);

  return (
    <div className={`absolute inset-0 z-[2000] flex bg-slate-50 h-full overflow-hidden transition-all duration-300 ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      
      {/* Left Area: 13-Month Calendar Grid (50%) */}
      <div className="w-1/2 h-full border-r border-slate-200 flex flex-col bg-white">
        
        {/* Calendar Header with Legend & Quick Today Button */}
        <div className="p-4 border-b border-slate-200 flex flex-col gap-2.5 bg-slate-50/70 backdrop-blur z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">📅</span>
              <h2 className="text-base font-black text-slate-800">통합 캘린더</h2>
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold">
                {selectedDateStr}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDate(new Date());
                if (calendarRef.current) {
                  const el = calendarRef.current.querySelector('[data-is-current="true"]');
                  if (el) calendarRef.current.scrollTop = el.offsetTop - calendarRef.current.offsetTop - 20;
                }
              }}
              className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl border border-blue-200 transition-colors shadow-2xs"
            >
              오늘 날짜로 이동
            </button>
          </div>

          {/* Color Legend for Calendar Dots */}
          <div className="flex items-center gap-3.5 text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-200/60 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span>휴업일</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>행사</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>결석</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>통학 변동</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>선택일</span>
            </div>
          </div>
        </div>

        {/* 13 Months Scrollable List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-12" ref={calendarRef}>
          {monthsData.map((mData, index) => (
            <div key={index} data-is-current={mData.isCurrentMonth} className="max-w-md mx-auto">
              <h3 className="text-lg font-black text-slate-800 mb-3 flex items-center justify-between">
                <span>{mData.year}년 {monthNames[mData.month]}</span>
                {mData.isCurrentMonth && (
                  <span className="text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
                    이번 달
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                  <div key={d} className={`text-xs font-bold py-1 ${d === '일' ? 'text-red-500' : d === '토' ? 'text-blue-500' : 'text-slate-400'}`}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {mData.blanks.map(b => <div key={`blank-${b}`} className="h-10" />)}
                {mData.daysArray.map(({ day, dateStr }) => (
                  <div key={day} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(new Date(mData.year, mData.month, day))}
                      className={getDayClasses(dateStr)}
                    >
                      {day}
                    </button>
                    {renderDots(dateStr)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Area: Daily Variables & Event Management (50%) */}
      <div className="w-1/2 h-full flex flex-col bg-slate-50 overflow-hidden">
        
        {/* Top Control Bar 1: View Mode Switcher (결석용이랑 행사용 분리) */}
        <div className="p-3.5 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleModeChange('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeMode === 'ALL'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                전체 일정
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('EVENT_HOLIDAY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeMode === 'EVENT_HOLIDAY'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                행사 및 휴업일
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('ABSENCE_VARIABLE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeMode === 'ABSENCE_VARIABLE'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                원아 결석 & 변동
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('LOG')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeMode === 'LOG'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                차량 운행 일지
              </button>
            </div>

            {/* Quick Action Buttons (역할별 일정 추가) */}
            <div className="flex items-center gap-2">
              {(isAdmin || isHomeroom || isTeacher) && (
                <button
                  type="button"
                  onClick={() => {
                    setNewEvent(prev => ({
                      ...prev,
                      startDate: selectedDateStr,
                      endDate: selectedDateStr,
                    }));
                    setIsEventModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>일정/휴업 등록</span>
                </button>
              )}

              {(isAdmin || isHomeroom || isTeacher || isParent) && (
                <button
                  type="button"
                  onClick={() => {
                    setNewAbsence(prev => ({
                      ...prev,
                      startDate: selectedDateStr,
                      endDate: selectedDateStr,
                    }));
                    setIsAbsenceModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>결석 등록</span>
                </button>
              )}
            </div>
          </div>

          {/* Top Control Bar 2: Class Selection Tabs ("지금 호차별로 되어 있는거 빼고 반별로 바꿔주고") */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">반 선택:</span>
            <button
              type="button"
              onClick={() => setSelectedClass('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedClass === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              전체 반 (기관 전체)
            </button>

            {classList.map(cName => (
              <button
                key={cName}
                type="button"
                onClick={() => setSelectedClass(cName)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedClass === cName
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cName}
              </button>
            ))}
          </div>

          {/* Student Search Bar ("원장의 경우에는 결석 학생 검색할 수 있게") */}
          {(activeMode === 'ALL' || activeMode === 'ABSENCE_VARIABLE') && (
            <div className="relative mt-2.5">
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="결석/변동 원아 이름, 연락처 또는 사유 검색..."
                className="w-full text-xs py-2 pl-8 pr-8 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Vehicle Tabs when activeMode is LOG */}
          {activeMode === 'LOG' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 border-t border-slate-100 mt-2.5 scrollbar-hide">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">호차 선택:</span>
              {buses.map(bus => (
                <button
                  key={bus.id}
                  type="button"
                  onClick={() => setSelectedBusId(bus.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedBusId === bus.id
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bus.color || '#3b82f6' }} />
                  {bus.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Date Summary Header */}
        <div className="px-5 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shadow-2xs shrink-0">
          <div>
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <span>{selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일</span>
              <span className="text-xs font-bold text-slate-400">
                ({['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()]}요일)
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                {selectedClass === 'ALL' ? '전체 반' : selectedClass}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
              결석 {absencesOnDate.length}명
            </span>
            <span className="text-xs font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
              변동 {locationChangesOnDate.length + otherChangesOnDate.length + approvedRidesOnDate.length}건
            </span>
            <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
              행사/휴업 {selectedDateEvents.length}건
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* LOG Mode Content */}
          {activeMode === 'LOG' && (
            <div className="h-full">
              {isLoadingLogs ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <div className="text-3xl animate-bounce mb-2">📝</div>
                  <p className="text-xs font-bold">운행 로그를 불러오는 중입니다...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 p-8">
                  <div className="text-3xl mb-2 grayscale">📭</div>
                  <p className="text-sm font-bold text-slate-600">기록된 운행 로그가 없습니다.</p>
                  <p className="text-xs text-slate-400 mt-1">선택한 날짜 및 차량에 기록된 주행/탑승 일지가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log, index) => (
                    <div key={index} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base shrink-0">
                        {log.icon || '🚍'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-slate-800">{log.title || log.type}</span>
                          <time className="text-xs font-medium text-slate-400">
                            {log.time ? new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </time>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{log.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 1: Events & Holidays on this date */}
          {(activeMode === 'ALL' || activeMode === 'EVENT_HOLIDAY') && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎪</span>
                  <h4 className="text-sm font-black text-slate-800">학원/유치원 행사 및 휴업일</h4>
                  <span className="text-xs font-bold text-slate-400">({selectedDateEvents.length}건)</span>
                </div>
              </div>

              {selectedDateEvents.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                  <p className="text-xs font-bold text-slate-400">선택한 날짜에 등록된 행사나 휴업일이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDateEvents.map(event => {
                    const isHoliday = event.type === 'ACADEMY_HOLIDAY' || event.type === 'CLASS_HOLIDAY' || event.type === 'HOLIDAY';
                    const isVacation = event.type === 'VACATION';
                    return (
                      <div
                        key={event.id}
                        className={`bg-white rounded-2xl border p-4 shadow-2xs flex items-center justify-between transition-all ${
                          isHoliday
                            ? 'border-orange-200 hover:border-orange-300'
                            : isVacation
                            ? 'border-purple-200 hover:border-purple-300'
                            : 'border-blue-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                            isHoliday
                              ? 'bg-orange-100 text-orange-700'
                              : isVacation
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {isHoliday ? '🚨' : isVacation ? '🏖️' : '🎪'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800 text-sm">{event.title}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isHoliday
                                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                  : isVacation
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {isHoliday ? '휴업일' : isVacation ? '방학' : '학원 행사'}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {event.targetClass ? `대상: ${event.targetClass}` : '전체 반 대상'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                              <span>기간: {event.startDate} {event.startDate !== event.endDate ? `~ ${event.endDate}` : ''}</span>
                              {event.reason && (
                                <>
                                  <span className="text-slate-300">|</span>
                                  <span>{event.reason}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {(isAdmin || isHomeroom) && (
                          <button
                            type="button"
                            onClick={() => setItemToDelete({ id: event.id, title: event.title, isOverride: false })}
                            className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="일정 삭제"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Student Absences & Daily Variables on this date */}
          {(activeMode === 'ALL' || activeMode === 'ABSENCE_VARIABLE') && (
            <div className="space-y-5">
              
              {/* 2-1: 결석 원아 목록 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <h4 className="text-sm font-black text-slate-800">결석 원아</h4>
                    <span className="text-xs font-bold text-rose-600">({absencesOnDate.length}명)</span>
                  </div>
                </div>

                {absencesOnDate.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-5 text-center">
                    <p className="text-xs font-bold text-slate-400">선택한 날짜에 결석 처리된 원아가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {absencesOnDate.map(abs => (
                      <div
                        key={abs.id}
                        className="bg-white rounded-2xl border border-rose-100 p-4 shadow-2xs flex items-center justify-between hover:border-rose-300 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0 border border-rose-100">
                            결석
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800 text-sm">{abs.student?.name}</span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {abs.student?.className || '반 미배정'}
                              </span>
                              {abs.student?.phone && (
                                <span className="text-xs text-slate-400 font-medium">
                                  {abs.student.phone}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                              <span className="font-bold text-rose-600">사유: {abs.reason || '사유 미기재'}</span>
                              <span className="text-slate-300">|</span>
                              <span>기간: {abs.startDate} {abs.startDate !== abs.endDate ? `~ ${abs.endDate}` : ''}</span>
                            </div>
                          </div>
                        </div>

                        {(isAdmin || isHomeroom || isParent) && (
                          <button
                            type="button"
                            onClick={() => setItemToDelete({ id: abs.id, title: `${abs.student?.name} 원아 결석`, isOverride: true })}
                            className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-100 transition-colors"
                            title="결석 취소"
                          >
                            결석 취소
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2-2: 승하차 위치/정류장 변경 원아 목록 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h4 className="text-sm font-black text-slate-800">승하차 위치/정류장 변경</h4>
                    <span className="text-xs font-bold text-amber-600">({locationChangesOnDate.length}건)</span>
                  </div>
                </div>

                {locationChangesOnDate.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-5 text-center">
                    <p className="text-xs font-bold text-slate-400">선택한 날짜에 위치/정류장 변경 신청이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {locationChangesOnDate.map(change => (
                      <div
                        key={change.id}
                        className="bg-white rounded-2xl border border-amber-100 p-4 shadow-2xs flex items-center justify-between hover:border-amber-300 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0 border border-amber-200">
                            🚏
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800 text-sm">{change.student?.name}</span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {change.student?.className || '반 미배정'}
                              </span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                                {change.direction === 'MORNING' ? '등원 변경' : change.direction === 'AFTERNOON' ? '하원 변경' : '등·하원 전체 변경'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mt-1 flex flex-col gap-0.5">
                              <div className="font-bold text-amber-900">
                                변경 정류장/주소: {change.newAddress || '임시 지정 위치'}
                              </div>
                              <div className="text-slate-400 flex items-center gap-2">
                                <span>사유: {change.reason || '개인 사정'}</span>
                                {change.targetTime && (
                                  <>
                                    <span>|</span>
                                    <span>예정 시각: {change.targetTime}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {(isAdmin || isHomeroom) && (
                          <button
                            type="button"
                            onClick={() => setItemToDelete({ id: change.id, title: `${change.student?.name} 원아 위치 변경`, isOverride: true })}
                            className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            취소
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2-3: 결재 승인 일회성 셔틀 탑승 및 픽업 요청 */}
              {(approvedRidesOnDate.length > 0 || otherChangesOnDate.length > 0) && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <h4 className="text-sm font-black text-slate-800">일회성 탑승 & 픽업 요청</h4>
                      <span className="text-xs font-bold text-emerald-600">
                        ({approvedRidesOnDate.length + otherChangesOnDate.length}건)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {approvedRidesOnDate.map((ride, idx) => (
                      <div
                        key={`ride-${idx}`}
                        className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-2xs flex items-center justify-between hover:border-emerald-300 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200">
                            🎫
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800 text-sm">{ride.studentName || ride.student?.name}</span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                일회성 셔틀 탑승 승인
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              탑승 요청 위치: {ride.boardingLocation || ride.location || '원내 지정 정류장'}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          승인 완료
                        </span>
                      </div>
                    ))}

                    {otherChangesOnDate.map(change => (
                      <div
                        key={change.id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-200">
                            🚗
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800 text-sm">{change.student?.name}</span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {change.student?.className || '반 미배정'}
                              </span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                                {change.overrideType === 'TEMP_DROP' ? '학부모 직접 픽업' : '기타 통학 변동'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              사유: {change.reason || '사유 미작성'}
                            </div>
                          </div>
                        </div>

                        {(isAdmin || isHomeroom) && (
                          <button
                            type="button"
                            onClick={() => setItemToDelete({ id: change.id, title: `${change.student?.name} 원아 변동`, isOverride: true })}
                            className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            취소
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Add Event / Holiday (학원 행사 및 휴업일 일괄 등록) */}
      {isEventModalOpen && (
        <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-7 max-w-lg w-full shadow-2xl mx-4 transform animate-scale-up">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📝</span>
                <h3 className="text-lg font-black text-slate-800">일정 및 휴업일 등록</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">일정 유형</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewEvent(p => ({ ...p, type: 'EVENT' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 ${
                      newEvent.type === 'EVENT'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🎪</span>
                    <span>학원/유치원 행사</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewEvent(p => ({ ...p, type: 'ACADEMY_HOLIDAY' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 ${
                      newEvent.type === 'ACADEMY_HOLIDAY'
                        ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🚨</span>
                    <span>정기/임시 휴업일</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewEvent(p => ({ ...p, type: 'VACATION' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 ${
                      newEvent.type === 'VACATION'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🏖️</span>
                    <span>방학 기간</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewEvent(p => ({ ...p, type: 'CLASS_HOLIDAY' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 ${
                      newEvent.type === 'CLASS_HOLIDAY'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🎨</span>
                    <span>반별 행사/자체휴업</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">일정/행사 제목 *</label>
                <input
                  type="text"
                  required
                  value={newEvent.title}
                  onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                  placeholder="예: 가을 운동회, 학부모 참여수업, 개원기념일 휴원 등"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">시작일</label>
                  <input
                    type="date"
                    required
                    value={newEvent.startDate}
                    onChange={e => setNewEvent(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">종료일</label>
                  <input
                    type="date"
                    required
                    value={newEvent.endDate}
                    onChange={e => setNewEvent(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                  />
                </div>
              </div>

              {/* Target Class */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">대상 반 (선택)</label>
                <select
                  value={newEvent.targetClass}
                  onChange={e => setNewEvent(p => ({ ...p, targetClass: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none bg-white"
                >
                  <option value="">유치원/학원 전체 대상 (전체 반)</option>
                  {classList.map(c => (
                    <option key={c} value={c}>{c} 대상</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  특정 반을 선택하시면 해당 반 담임교사와 학부모에게 우선 안내 알림이 전송됩니다.
                </p>
              </div>

              {/* Reason / Details */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">상세 안내 및 사유</label>
                <textarea
                  rows={2}
                  value={newEvent.reason}
                  onChange={e => setNewEvent(p => ({ ...p, reason: e.target.value }))}
                  placeholder="추가 안내사항이나 일정 사유를 작성하세요."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  disabled={isSubmittingEvent}
                  onClick={() => setIsEventModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEvent}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSubmittingEvent ? '저장 및 알림 전송 중...' : '일정 등록 및 알림 발송'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Student Absence (결석 신청 및 등록) */}
      {isAbsenceModalOpen && (
        <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-7 max-w-md w-full shadow-2xl mx-4 transform animate-scale-up">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <h3 className="text-lg font-black text-slate-800">원아 결석 등록</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAbsenceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAbsence} className="space-y-4">
              {/* Student Select */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">결석 원아 선택 *</label>
                <select
                  required
                  value={newAbsence.studentId}
                  onChange={e => setNewAbsence(p => ({ ...p, studentId: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none bg-white"
                >
                  <option value="">원아를 선택하세요</option>
                  {eligibleStudentsForAbsence.map(s => {
                    const c = s.raw?.['반명'] || s.raw?.['반'] || s.assignedClass || s.className || '';
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} {c ? `(${c})` : ''} {s.phone ? `- ${s.phone}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">결석 시작일</label>
                  <input
                    type="date"
                    required
                    value={newAbsence.startDate}
                    onChange={e => setNewAbsence(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">결석 종료일</label>
                  <input
                    type="date"
                    required
                    value={newAbsence.endDate}
                    onChange={e => setNewAbsence(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">결석 사유</label>
                <input
                  type="text"
                  value={newAbsence.reason}
                  onChange={e => setNewAbsence(p => ({ ...p, reason: e.target.value }))}
                  placeholder="예: 감기 몸살, 가족 여행, 병원 진료 등"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  disabled={isSubmittingAbsence}
                  onClick={() => setIsAbsenceModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAbsence}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSubmittingAbsence ? '등록 중...' : '결석 확정 및 알림 발송'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl mx-4 transform animate-scale-up text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-base font-black text-slate-800 mb-2">삭제하시겠습니까?</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              <span className="font-bold text-slate-800">[{itemToDelete.title}]</span> 내역이 삭제되며, 캘린더 및 변동 기록에서 제거됩니다.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={handleDeleteItem}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                {isDeletingItem ? '삭제 중...' : '삭제 확정'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .animate-slide-in-right { animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-out-right { animation: slideOutRight 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fadeIn 0.15s ease forwards; }
        .animate-scale-up { animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
