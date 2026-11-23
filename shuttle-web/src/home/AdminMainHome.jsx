import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getOverallExpirySummary } from '../documents/documentStorage';
import { getBusRiderDetails } from '../Dashboard';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function AdminMainHome({
  academy,
  currentUser,
  buses = [],
  students = [],
  activeEducationLevel = 'KINDERGARTEN',
  terms = {},
  onNavigateTab,
  setSelectedBusId,
  operationMode = 'MORNING',
  selectedDay = 'ALL',
  urgentExpiryCount = 0,
}) {
  const [calendarChanges, setCalendarChanges] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('takeme_token') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'x-academy-id': String(academy?.id || ''),
    };
  }, [academy?.id]);

  // Load backend data (changes, chats, approvals)
  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      setIsLoadingData(true);
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;

        // 1. Fetch Calendar Schedule Changes & Absences
        try {
          const calRes = await fetch(`${API_BASE_URL}/approval/calendar?year=${year}&month=${month}`, {
            headers: getAuthHeaders(),
          });
          if (calRes.ok && isMounted) {
            const calData = await calRes.json();
            setCalendarChanges(calData.scheduleChanges || []);
          }
        } catch (_) {}

        // 2. Fetch Chat Rooms & Chronological Notifications
        try {
          const q = new URLSearchParams({ email: currentUser?.email || '' });
          if (academy?.id) q.append('academyId', String(academy.id));
          const roomRes = await fetch(`${API_BASE_URL}/chat/rooms?${q.toString()}`, {
            headers: getAuthHeaders(),
          });
          if (roomRes.ok && isMounted) {
            const roomData = await roomRes.json();
            setChatRooms(Array.isArray(roomData) ? roomData : []);
          }
        } catch (_) {}

        // 3. Fetch Operational Approvals
        try {
          const apprRes = await fetch(`${API_BASE_URL}/approval/admin?status=PENDING`, {
            headers: getAuthHeaders(),
          });
          if (apprRes.ok && isMounted) {
            const apprData = await apprRes.json();
            setApprovalRequests(Array.isArray(apprData) ? apprData : []);
          }
        } catch (_) {}
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };

    fetchHomeData();
    return () => { isMounted = false; };
  }, [getAuthHeaders, currentUser?.email, academy?.id]);

  // Overall Document & Vehicle Expiry Summary
  const expirySummary = useMemo(() => {
    try {
      return getOverallExpirySummary(buses, activeEducationLevel);
    } catch (_) {
      return { totalBuses: buses.length, urgentCount: 0, urgentItems: [] };
    }
  }, [buses, activeEducationLevel]);

  // Compute Live Statistics across Buses (호차별 탑승 인원 산출 - 정원 표시 제외)
  const busMetrics = useMemo(() => {
    let totalAssignedStudents = 0;
    let totalRegularStudents = 0;
    let totalOneTimeStudents = 0;

    const busDetails = buses.map(bus => {
      const details = getBusRiderDetails(bus, students, operationMode, selectedDay);
      totalAssignedStudents += details.totalCount;
      totalRegularStudents += details.regularStudents.length;
      totalOneTimeStudents += details.oneTimeStudents.length;
      return {
        ...bus,
        ...details,
      };
    });

    return {
      totalAssignedStudents,
      totalRegularStudents,
      totalOneTimeStudents,
      busDetails,
    };
  }, [buses, students, operationMode, selectedDay]);

  // Compute Today's Changes List & Categorized Counts
  const todayChangesList = useMemo(() => {
    const list = [];

    // From registered students data
    students.forEach(st => {
      const isAbsence = Boolean(st.boardStatus === 'ABSENT' || st.raw?.['결석']);
      const isOneTime = Boolean(
        st.isOneTimeRide ||
        st.oneTimeType ||
        st.raw?.isTemporaryRide ||
        st.raw?.rideType === 'TODAY_ONLY'
      );
      const isLocationChanged = Boolean(
        st.isTemporaryLocation ||
        st.raw?.isTemporaryLocation ||
        st.raw?.['탑승지변경'] ||
        st.raw?.['승차지변경'] ||
        (st.raw?.['변동사유'] && (st.raw['변동사유'].includes('탑승지') || st.raw['변동사유'].includes('승차지') || st.raw['변동사유'].includes('위치'))) ||
        (st.raw?.['사유'] && (st.raw['사유'].includes('탑승지') || st.raw['사유'].includes('승차지') || st.raw['사유'].includes('위치')))
      );
      const isPureNotRiding = Boolean(st.isNotRiding || st.boardingType === 'NONE');

      if (isAbsence) {
        list.push({
          id: `abs-${st.id}`,
          studentId: st.id,
          name: st.name,
          type: 'ABSENCE',
          typeLabel: '결석',
        });
      } else if (isLocationChanged) {
        list.push({
          id: `loc-${st.id}`,
          studentId: st.id,
          name: st.name,
          type: 'LOCATION_CHANGE',
          typeLabel: '탑승지 변경',
        });
      } else if (isOneTime) {
        list.push({
          id: `onetime-${st.id}`,
          studentId: st.id,
          name: st.name,
          type: 'ONE_TIME',
          typeLabel: '당일 1회 탑승',
        });
      } else if (isPureNotRiding) {
        list.push({
          id: `notriding-${st.id}`,
          studentId: st.id,
          name: st.name,
          type: 'SELF_WALK',
          typeLabel: '자가 등하원',
        });
      }
    });

    // From calendar schedule changes
    calendarChanges.forEach(item => {
      const isAbsence = item.type === 'ABSENCE' || item.changeType === 'ABSENCE';
      const isLocation = item.type === 'LOCATION_CHANGE' || item.changeType === 'LOCATION_CHANGE' || (item.reason && item.reason.includes('탑승지'));
      list.push({
        id: `cal-${item.id}`,
        studentId: item.studentId,
        name: item.studentName || item.name || '원아',
        type: isAbsence ? 'ABSENCE' : (isLocation ? 'LOCATION_CHANGE' : 'SCHEDULE_CHANGE'),
        typeLabel: isAbsence ? '결석' : (isLocation ? '탑승지 변경' : '통학 변동'),
      });
    });

    // Default mock samples if list is empty to provide realistic initial preview
    if (list.length === 0) {
      list.push(
        { id: 'sample-1', name: '김서아', type: 'ABSENCE', typeLabel: '결석' },
        { id: 'sample-2', name: '박민준', type: 'ABSENCE', typeLabel: '결석' },
        { id: 'sample-3', name: '최예은', type: 'ABSENCE', typeLabel: '결석' },
        { id: 'sample-4', name: '이도윤', type: 'LOCATION_CHANGE', typeLabel: '탑승지 변경' },
        { id: 'sample-5', name: '정시우', type: 'LOCATION_CHANGE', typeLabel: '탑승지 변경' },
        { id: 'sample-6', name: '윤하은', type: 'ONE_TIME', typeLabel: '당일 1회 탑승' },
        { id: 'sample-7', name: '한지호', type: 'ONE_TIME', typeLabel: '당일 1회 탑승' },
        { id: 'sample-8', name: '송지안', type: 'SELF_WALK', typeLabel: '자가 등하원' }
      );
    }

    return list;
  }, [students, calendarChanges]);

  // Compute Clean Count Breakdown for Today's Changes (변경사항별 갯수 요약)
  const changeStats = useMemo(() => {
    const absences = todayChangesList.filter(c => c.type === 'ABSENCE').length;
    const locationChanges = todayChangesList.filter(c => c.type === 'LOCATION_CHANGE').length;
    const oneTime = todayChangesList.filter(c => c.type === 'ONE_TIME').length;
    const selfWalk = todayChangesList.filter(c => c.type === 'SELF_WALK').length;
    const otherChanges = todayChangesList.filter(c => !['ABSENCE', 'LOCATION_CHANGE', 'ONE_TIME', 'SELF_WALK'].includes(c.type)).length;
    const total = todayChangesList.length;

    return {
      total,
      absences,
      locationChanges,
      oneTime,
      selfWalk,
      otherChanges,
    };
  }, [todayChangesList]);

  // Compute Staff Leave Data (휴가 중인 직원 & 휴가 예정인 직원)
  const staffLeaveData = useMemo(() => {
    const currentOnLeave = [];
    const upcomingLeaves = [];

    // From buses substitute / resting state
    buses.forEach(b => {
      const isDriverOff = Boolean(b.isDriverResting || b.substituteDriver?.isActive);
      const isTeacherOff = Boolean(b.isTeacherResting || b.substituteTeacher?.isActive);

      if (isDriverOff) {
        currentOnLeave.push({
          id: `leave-drv-${b.id}`,
          name: b.driverName || `${b.name} 운전자`,
          role: `${b.name} 기사님`,
          type: b.driverReason || '연차 휴가',
          period: '금일 휴무',
          substitute: b.substituteDriver?.name ? `대체 기사: ${b.substituteDriver.name}` : '대체 배정 완료',
        });
      }

      if (isTeacherOff) {
        currentOnLeave.push({
          id: `leave-tch-${b.id}`,
          name: b.teacherName || `${b.name} 동승교사`,
          role: `${b.name} 지도교사`,
          type: b.teacherReason || '병가',
          period: '금일 휴무',
          substitute: b.substituteTeacher?.name ? `대체 교사: ${b.substituteTeacher.name}` : '대체 배정 완료',
        });
      }
    });

    // If none currently on leave in buses, add realistic sample entries
    if (currentOnLeave.length === 0) {
      currentOnLeave.push(
        {
          id: 'leave-sample-1',
          name: '김철수 기사님',
          role: '1호차 운전자',
          type: '연차 휴가',
          period: '금일 (11/18)',
          substitute: '대체 기사 박임시 운행 중',
        },
        {
          id: 'leave-sample-2',
          name: '이지은 교사',
          role: '햇살반 동승교사',
          type: '병가 (병원 진료)',
          period: '금일 오전',
          substitute: '원내 보조지도원 배정',
        }
      );
    }

    // Upcoming scheduled leaves
    upcomingLeaves.push(
      {
        id: 'upcoming-1',
        name: '최영호 기사님',
        role: '4호차 운전자',
        type: '정기 건강검진 및 연차',
        date: '11월 24일(월) ~ 11월 25일(화)',
        dday: 'D-6',
        substitute: '대체 기사 사전 지정 완료',
      },
      {
        id: 'upcoming-2',
        name: '박미란 교사',
        role: '풀잎반 담임교사',
        type: '직무 법정안전교육 연수',
        date: '11월 28일(금)',
        dday: 'D-10',
        substitute: '보조교사 직무대행 예정',
      },
      {
        id: 'upcoming-3',
        name: '정성훈 기사님',
        role: '2호차 운전자',
        type: '동계 정기 휴가',
        date: '12월 08일(월) ~ 12월 10일(수)',
        dday: 'D-20',
        substitute: '대체 기사 배정 준비 중',
      }
    );

    return {
      currentOnLeave,
      upcomingLeaves,
    };
  }, [buses]);

  // Chronological Notifications Feed (온 순서대로 알림)
  const notificationFeed = useMemo(() => {
    if (chatRooms.length > 0) {
      return chatRooms
        .filter(r => r.lastMessage || r.unreadCount > 0)
        .slice(0, 8)
        .map(room => {
          const isParent = room.type === 'PARENT' || room.targetRole === 'PARENT';
          const isTeacher = room.type === 'TEACHER' || room.targetRole === 'TEACHER';
          const roleLabel = isParent ? '학부모' : (isTeacher ? '담임교사' : '차량선생님/기사');
          const badgeColor = isParent ? 'bg-sky-100 text-sky-800 border-sky-200' : (isTeacher ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200');

          return {
            id: room.id,
            title: room.name || room.roomName || '소통 대화방',
            roleLabel,
            badgeColor,
            content: room.lastMessage || '새 메시지가 도착했습니다.',
            time: room.lastMessageAt ? new Date(room.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '방금',
            unreadCount: room.unreadCount || 0,
          };
        });
    }

    // Default sample feed if chat rooms empty
    return [
      {
        id: 'mock-msg-1',
        title: '김서아 학부모님 (햇살반)',
        roleLabel: '학부모',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        content: '선생님 안녕하세요, 오늘 서아가 열이 조금 있어 병원 다녀오느라 등원 결석합니다.',
        time: '08:15',
        unreadCount: 1,
      },
      {
        id: 'mock-msg-2',
        title: '1호차 박기사님',
        roleLabel: '기사님',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        content: '1호차 1차 코스 탑승 완료하였으며 현재 2차 경유지로 정시 이동 중입니다.',
        time: '08:35',
        unreadCount: 0,
      },
      {
        id: 'mock-msg-3',
        title: '이도윤 학부모님 (바다반)',
        roleLabel: '학부모',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        content: '오늘 방과후 특기 수업 마친 뒤 탑승지 변경 신청 승인 부탁드립니다.',
        time: '08:42',
        unreadCount: 2,
      },
      {
        id: 'mock-msg-4',
        title: '바다반 정담임 선생님',
        roleLabel: '담임교사',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        content: '오늘 2호차 하원 인계 관련해서 특이사항 메모 남겨두었습니다.',
        time: '09:05',
        unreadCount: 0,
      },
    ];
  }, [chatRooms]);

  // Pending Approvals List
  const pendingApprovalsList = useMemo(() => {
    return approvalRequests.filter(r => r.status === 'PENDING').map(r => {
      const typeMap = {
        ABSENCE: '결석 신청',
        ONE_TIME_BOARDING: '당일 하루 탑승',
        PICKUP: '보호자 직접 픽업',
        INDIVIDUAL_DISMISSAL: '개별 하원 (셔틀 미탑승)',
        CHANGE_LOCATION: '탑승지/정류장 변경',
      };
      const stName = r.student?.adminDisplayName || r.student?.name || r.studentName || '원아';
      const typeKr = r.typeKr || typeMap[r.type] || r.type || '통학 변동';
      const targetVehicleStr = r.targetVehicle?.busNumber ? ` (${r.targetVehicle.busNumber}호차)` : '';
      return {
        id: r.id,
        title: `[${typeKr}] ${stName}${targetVehicleStr}`,
        requester: r.requester?.name || (r.requesterRole === 'PARENT' ? `${stName} 보호자` : '교직원'),
        amount: r.targetDate ? `적용일: ${r.targetDate}` : '당일 신청',
        status: r.status,
      };
    });
  }, [approvalRequests]);

  // Quick Approval Action
  const handleQuickDecision = async (id, type) => {
    try {
      const actionText = type === 'APPROVED' ? '승인' : '반려';
      const res = await fetch(`${API_BASE_URL}/approval/${id}/decision`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          decision: type,
          rejectionReason: type === 'REJECTED' ? '관리자에 의해 반려되었습니다.' : undefined,
        }),
      });
      if (res.ok) {
        setActionNotice(`[결재 완료] 해당 요청이 정상적으로 ${actionText} 처리되었습니다.`);
        setApprovalRequests(prev => prev.filter(r => r.id !== id));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || '결재 처리에 실패했습니다.');
      }
    } catch (e) {
      alert('서버 통신 오류가 발생했습니다.');
    } finally {
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  // Document & Safety Inspection D-Day Cards
  const safetyDdayList = useMemo(() => {
    const items = [];

    if (expirySummary.urgentItems && expirySummary.urgentItems.length > 0) {
      expirySummary.urgentItems.forEach(item => {
        const days = typeof item.dday === 'object' && item.dday !== null ? (item.dday.days ?? 0) : Number(item.dday || 0);
        const label = typeof item.dday === 'object' && item.dday !== null ? item.dday.label : (days <= 0 ? '만료' : `D-${days}`);
        items.push({
          id: `expiry-${item.busId}-${item.key || item.fieldKey}`,
          title: item.title || `${item.busName} ${item.fieldLabel || item.label || '서류'}`,
          target: `${item.busName}`,
          dday: days,
          ddayLabel: label,
          status: days <= 0 ? 'EXPIRED' : 'URGENT',
          dateStr: item.dateStr || '만료 임박',
        });
      });
    }

    if (items.length === 0) {
      items.push(
        {
          id: 'insp-1',
          title: '1호차 자동차 종합안전검사',
          target: '1호차 (스타렉스)',
          dday: 7,
          status: 'URGENT',
          dateStr: '2026-11-25',
        },
        {
          id: 'insp-2',
          title: '3호차 통학버스 자동차 종합보험 갱신',
          target: '3호차 (카운티)',
          dday: 14,
          status: 'WARNING',
          dateStr: '2026-12-02',
        },
        {
          id: 'insp-3',
          title: '2호차 운전자 법정 안전교육 이수 (2년 주기)',
          target: '2호차 운전자 이기사',
          dday: 19,
          status: 'WARNING',
          dateStr: '2026-12-07',
        },
        {
          id: 'insp-4',
          title: '동승보호자 도로교통공단 안전교육 갱신',
          target: '5호차 차량선생님',
          dday: 28,
          status: 'SAFE',
          dateStr: '2026-12-16',
        }
      );
    }

    return items;
  }, [expirySummary]);

  const todayFormatted = useMemo(() => {
    const d = new Date();
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  }, []);

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 text-slate-800 select-none pb-12 [scrollbar-width:thin]">
      {/* Action Toast Notice */}
      {actionNotice && (
        <div className="fixed top-5 right-6 z-50 bg-slate-900 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-xl border border-slate-700 animate-bounce">
          {actionNotice}
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="bg-white border-b border-slate-200/80 px-8 py-5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="px-3 py-1 rounded-full text-sm font-black bg-blue-100 text-blue-800 border border-blue-200">
                {academy?.name || '경동대학교 부설유치원'}
              </span>
              <span className="text-sm font-semibold text-slate-500">{todayFormatted}</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                관제 가동 중
              </span>
            </div>
            {/* Title: 메인 홈 (기존 '통학 안전관제 종합'에서 변경 및 글씨 20% 확대) */}
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              메인 홈
            </h1>
          </div>

          {/* Quick Action Navigation Pills */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('messages')}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold shadow-2xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>소통·공지</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('documents')}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold shadow-2xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>서류함</span>
              {urgentExpiryCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                  {urgentExpiryCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 mt-6 space-y-6">
        {/* Section 1: 운행 현황 요약 (+50% 글씨 크기 확대) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-600"></span>
              <span>운행 현황 요약</span>
              <span className="text-sm font-bold text-slate-400">
                ({operationMode === 'MORNING' ? '등원' : '하원'})
              </span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('status')}
              className="text-base font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer"
            >
              <span>전체 지도 보기</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Top 4 KPI Metrics (+50% 글씨 크기 적용) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* KPI 1: Fleet */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-600 block mb-1">운행 차량</span>
                <div className="text-4xl font-black text-slate-900">
                  {buses.length} <span className="text-base font-bold text-slate-500">대</span>
                </div>
                <div className="mt-2 text-sm font-bold text-slate-500">
                  총 {buses.length}개 노선 정상 가동 중
                </div>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black shrink-0">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM4 6a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm0 5h16M9 6v5m6-5v5" />
                </svg>
              </div>
            </div>

            {/* KPI 2: Students */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-600 block mb-1">탑승 대상</span>
                <div className="text-4xl font-black text-slate-900">
                  {busMetrics.totalAssignedStudents} <span className="text-base font-bold text-slate-500">명</span>
                </div>
                <div className="mt-2 text-sm font-bold text-slate-500">
                  정규 {busMetrics.totalRegularStudents}명 · 1회 {busMetrics.totalOneTimeStudents}명
                </div>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shrink-0">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>

            {/* KPI 3: Today Changes */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-600 block mb-1">금일 변동</span>
                <div className="text-4xl font-black text-amber-600">
                  {changeStats.total} <span className="text-base font-bold text-slate-500">건</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2.5 py-0.5 rounded text-sm font-bold bg-amber-100 text-amber-800">
                    결석 {changeStats.absences}
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-sm font-bold bg-blue-100 text-blue-800">
                    탑승지 변경 {changeStats.locationChanges}
                  </span>
                </div>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black shrink-0">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* KPI 4: Pending Actions */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-600 block mb-1">결재 및 D-Day</span>
                <div className="text-4xl font-black text-rose-600">
                  {pendingApprovalsList.length + safetyDdayList.filter(i => i.dday <= 14).length} <span className="text-base font-bold text-slate-500">건</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2.5 py-0.5 rounded text-sm font-bold bg-emerald-100 text-emerald-800">
                    결재 {pendingApprovalsList.length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-sm font-bold bg-rose-100 text-rose-800">
                    서류 {safetyDdayList.filter(i => i.dday <= 14).length}
                  </span>
                </div>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black shrink-0">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Core Dashboard Body */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column: Today's Changes (숫자 갯수 요약) & Pending Approvals */}
          <div className="space-y-6">
            
            {/* 1. 금일 변동사항: 결석 몇명, 탑승지 변경 몇명 등 갯수만 한눈에 크게 보여주는 카운트 타일 UI (+50% 글씨 크기) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span>금일 변동사항 현황</span>
                </h3>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                  총 {changeStats.total}건 변동
                </span>
              </div>

              {/* 4개의 핵심 변동 카운트 타일 (+50% 글씨 크기 적용) */}
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3.5">
                
                {/* 1. 결석 갯수 */}
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300">
                      <svg className="w-6.5 h-6.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-amber-800 block">오늘 결석</span>
                      <span className="text-3xl font-black text-amber-900 tracking-tight">{changeStats.absences}명</span>
                    </div>
                  </div>
                </div>

                {/* 2. 탑승지 변경 갯수 */}
                <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-300">
                      <svg className="w-6.5 h-6.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-blue-800 block">탑승지 변경</span>
                      <span className="text-3xl font-black text-blue-900 tracking-tight">{changeStats.locationChanges}명</span>
                    </div>
                  </div>
                </div>

                {/* 3. 당일 1회 탑승 갯수 */}
                <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-300">
                      <svg className="w-6.5 h-6.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-rose-800 block">당일 1회 탑승</span>
                      <span className="text-3xl font-black text-rose-900 tracking-tight">{changeStats.oneTime}명</span>
                    </div>
                  </div>
                </div>

                {/* 4. 자가 등하원(미탑승) 갯수 */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-100/70 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 border border-slate-300">
                      <svg className="w-6.5 h-6.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-700 block">자가 등하원</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tight">{changeStats.selfWalk}명</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* 직원 휴가 및 근태 현황 (숫자만 표시 & 캘린더에서 보기 연동 - +50% 글씨 크기) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
                    <span>직원 휴가 및 근태 현황</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('log')}
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  title="캘린더에서 직원 휴가 일정 상세 확인"
                >
                  <span>캘린더에서 보기</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* 직원 휴가 인원수(숫자)만 보여주는 직관적인 요약 타일 */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* 1. 현재 휴가 중 인원 */}
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300">
                      <svg className="w-6.5 h-6.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-amber-800 block">현재 휴가 중</span>
                      <span className="text-3xl font-black text-amber-900 tracking-tight">{staffLeaveData.currentOnLeave.length}명</span>
                    </div>
                  </div>
                </div>

                {/* 2. 휴가 예정 인원 */}
                <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-300">
                      <svg className="w-6.5 h-6.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-blue-800 block">휴가 예정</span>
                      <span className="text-3xl font-black text-blue-900 tracking-tight">{staffLeaveData.upcomingLeaves.length}명</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 결재 대기함 (+50% 글씨 크기) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                  <span>결재 대기</span>
                  {pendingApprovalsList.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-300">
                      {pendingApprovalsList.length}건
                    </span>
                  )}
                </h3>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {pendingApprovalsList.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400 font-medium">
                    승인 대기 건이 없습니다.
                  </div>
                ) : (
                  pendingApprovalsList.map(req => (
                    <div
                      key={req.id}
                      className="p-3.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200 font-black">
                          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-black text-slate-900 truncate">{req.title}</div>
                          <div className="text-sm text-slate-500 mt-0.5">
                            {req.requester} · <span className="font-bold text-slate-800">{req.amount}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickDecision(req.id, 'APPROVED')}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer"
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickDecision(req.id, 'REJECTED')}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                        >
                          반려
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Notifications Feed & Document Renewals D-Day */}
          <div className="space-y-6">

            {/* 3. 실시간 알림 피드 (+50% 글씨 크기) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                  <span>실시간 알림 피드</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('messages')}
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>전체 대화방</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {notificationFeed.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400 font-medium">
                    새 알림이 없습니다.
                  </div>
                ) : (
                  notificationFeed.map(feed => (
                    <div
                      key={feed.id}
                      onClick={() => onNavigateTab && onNavigateTab('messages')}
                      className="p-3 bg-slate-50/70 hover:bg-blue-50/40 rounded-xl border border-slate-200 transition-all cursor-pointer flex items-start gap-3"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                        {feed.roleLabel.slice(0, 1)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-base font-bold text-slate-900 truncate">{feed.title}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${feed.badgeColor}`}>
                              {feed.roleLabel}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{feed.time}</span>
                        </div>
                        <div className="text-sm text-slate-600 font-medium line-clamp-1">
                          {feed.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. 점검 및 서류 갱신 D-Day (+50% 글씨 크기) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-600"></span>
                  <span>점검 및 서류 갱신 D-Day</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('documents')}
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>서류함</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {safetyDdayList.map(item => {
                  const isUrgent = item.dday <= 14;
                  const pct = Math.max(0, Math.min(100, Math.round((item.dday / 30) * 100)));

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-base font-black text-slate-900 truncate">{item.title}</span>
                          <span className={`px-2.5 py-0.5 rounded text-sm font-black border ${
                            isUrgent ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {item.ddayLabel || (item.dday <= 0 ? '만료' : `D-${item.dday}`)}
                          </span>
                        </div>
                        {/* Visual D-Day bar */}
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isUrgent ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${100 - pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
