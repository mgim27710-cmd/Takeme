import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config';

export default function ApprovalRequestManager({
  selectedAcademyId,
  currentUser,
  socket,
  onCountsChange,
  onClose,
}) {
  const [requests, setRequests] = useState([]);
  const [filterStatus, setFilterStatus] = useState('PENDING'); // PENDING, APPROVED, REJECTED, ALL
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Reject Modal state
  const [rejectModalReq, setRejectModalReq] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [alertToast, setAlertToast] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('takeme_token') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'x-academy-id': String(selectedAcademyId || ''),
    };
  };

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const url = `${API_BASE_URL}/approval/admin`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRequests(data || []);
        if (onCountsChange) {
          const pending = (data || []).filter(r => r.status === 'PENDING').length;
          onCountsChange(pending);
        }
      }
    } catch (e) {
      console.error('Failed to load approval requests', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [selectedAcademyId]);

  // Socket listener for real-time change request events
  useEffect(() => {
    if (!socket) return;

    const handleCreated = data => {
      setAlertToast(`새로운 통학 변경 신청이 접수되었습니다: ${data.studentName} (${data.typeKr})`);
      setTimeout(() => setAlertToast(null), 5000);
      loadRequests();
    };

    const handleDecided = data => {
      loadRequests();
    };

    socket.on('changeRequestCreated', handleCreated);
    socket.on('changeRequestDecided', handleDecided);

    return () => {
      socket.off('changeRequestCreated', handleCreated);
      socket.off('changeRequestDecided', handleDecided);
    };
  }, [socket]);

  const handleApprove = async req => {
    if (!window.confirm(`[${req.studentName}] 원아의 ${req.typeKr} 신청을 승인하시겠습니까?\n승인 시 당일 운행 명단 및 캘린더에 즉시 반영됩니다.`)) {
      return;
    }

    try {
      setIsProcessing(true);
      const res = await fetch(`${API_BASE_URL}/approval/${req.id}/decision`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ decision: 'APPROVED' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlertToast(`신청이 정상적으로 승인되었습니다.`);
        setTimeout(() => setAlertToast(null), 3000);
        loadRequests();
      } else {
        alert(data.message || '승인 처리에 실패했습니다.');
      }
    } catch (e) {
      alert('승인 요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenRejectModal = req => {
    setRejectModalReq(req);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalReq) return;
    if (!rejectionReason.trim()) {
      alert('반려 사유를 반드시 입력해주세요.');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await fetch(`${API_BASE_URL}/approval/${rejectModalReq.id}/decision`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          decision: 'REJECTED',
          rejectionReason: rejectionReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlertToast('신청이 반려 처리되었습니다.');
        setRejectModalReq(null);
        setTimeout(() => setAlertToast(null), 3000);
        loadRequests();
      } else {
        alert(data.message || '반려 처리에 실패했습니다.');
      }
    } catch (e) {
      alert('반려 요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  const displayedRequests = requests.filter(r => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800">통학 변경 신청함</h1>
            {pendingCount > 0 && (
              <span className="bg-red-50 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200 animate-pulse">
                대기 중 {pendingCount}건
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            학부모 및 교사가 신청한 결석·지각·개별하원·일회성 탑승·정류장 변경 내역을 심사하고 승인 또는 반려합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={loadRequests}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition-all shadow-xs"
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

      {/* Real-time Alert Toast */}
      {alertToast && (
        <div className="bg-blue-600 text-white px-6 py-2.5 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>{alertToast}</span>
          </div>
          <button onClick={() => setAlertToast(null)} className="text-white hover:text-blue-200 font-bold">✕</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setFilterStatus('PENDING')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            filterStatus === 'PENDING'
              ? 'bg-red-50 text-red-700 border border-red-200 shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          대기 중 ({pendingCount})
        </button>
        <button
          onClick={() => setFilterStatus('APPROVED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            filterStatus === 'APPROVED'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          승인 완료 ({approvedCount})
        </button>
        <button
          onClick={() => setFilterStatus('REJECTED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            filterStatus === 'REJECTED'
              ? 'bg-slate-200 text-slate-800 shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          반려 ({rejectedCount})
        </button>
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            filterStatus === 'ALL'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          전체 보기 ({requests.length})
        </button>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-medium">
            신청 목록을 불러오는 중...
          </div>
        ) : displayedRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-semibold">해당 조건의 신청 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {displayedRequests.map(req => {
              const isPending = req.status === 'PENDING';
              const isApproved = req.status === 'APPROVED';
              const isRejected = req.status === 'REJECTED';
              const isExceeded = req.isCapacityExceeded;

              return (
                <div
                  key={req.id}
                  className={`bg-white rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                    isExceeded && isPending
                      ? 'border-amber-300 ring-2 ring-amber-100'
                      : isPending
                      ? 'border-red-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div>
                    {/* Header Row: Type Badge + Status + Date */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          req.type === 'ABSENCE' ? 'bg-red-100 text-red-800' :
                          req.type === 'LATENESS' ? 'bg-amber-100 text-amber-800' :
                          req.type === 'ONE_TIME_BOARDING' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {req.typeKr || req.type}
                        </span>

                        {isExceeded && (
                          <span className="bg-red-50 text-red-700 border border-red-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                            ⚠️ 정원 초과
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">
                          {req.createdAt ? new Date(req.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isPending ? 'bg-red-50 text-red-700 border border-red-200' :
                          isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {isPending ? '대기' : isApproved ? '승인 완료' : '반려'}
                        </span>
                      </div>
                    </div>

                    {/* Student & Request Details */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-800">{req.studentName}</span>
                        {req.studentClass && (
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                            {req.studentClass}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          (신청자: {req.requester?.name || req.requester?.email || '학부모'})
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                        <div>
                          <span className="text-slate-400">적용 일자:</span>{' '}
                          <span className="font-bold text-slate-700">{req.targetDate || req.startDate || '-'}</span>
                          {req.targetTime && <span className="ml-1 text-slate-500">({req.targetTime})</span>}
                        </div>
                        {req.direction && (
                          <div>
                            <span className="text-slate-400">구분:</span>{' '}
                            <span className="font-semibold text-slate-700">
                              {req.direction === 'MORNING' ? '등원' : req.direction === 'AFTERNOON' ? '하원' : '종일'}
                            </span>
                          </div>
                        )}
                        {req.targetVehicle && (
                          <div>
                            <span className="text-slate-400">대상 차량:</span>{' '}
                            <span className="font-bold text-blue-600">{req.targetVehicle.busNumber}호차</span>
                          </div>
                        )}
                      </div>

                      {req.newAddress && (
                        <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="font-bold text-slate-500 mr-1">변경 탑승지:</span> {req.newAddress}
                        </div>
                      )}

                      {req.reason && (
                        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="font-bold text-slate-500 mr-1">신청 사유:</span> {req.reason}
                        </div>
                      )}

                      {/* Rejection reason display if rejected */}
                      {isRejected && req.rejectionReason && (
                        <div className="text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                          <span className="font-bold mr-1">반려 사유:</span> {req.rejectionReason}
                        </div>
                      )}

                      {/* Alternate Vehicle Candidates (if capacity exceeded) */}
                      {isExceeded && isPending && req.candidateVehicles && req.candidateVehicles.length > 0 && (
                        <div className="mt-2.5 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                          <div className="text-[11px] font-bold text-amber-800 mb-1.5 flex items-center gap-1">
                            <span>💡 동일 날짜 여유 차량 추천 후보</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {req.candidateVehicles.map(c => (
                              <span
                                key={c.vehicleId}
                                className="text-[11px] bg-white border border-amber-300 text-amber-900 px-2 py-1 rounded-lg font-bold shadow-2xs"
                              >
                                {c.busNumber}호차 (잔여 {c.availableSeats}석)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons for Pending Requests */}
                  {isPending && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenRejectModal(req)}
                        disabled={isProcessing}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold text-xs rounded-xl border border-slate-200 hover:border-red-200 transition-colors"
                      >
                        반려
                      </button>

                      <button
                        onClick={() => handleApprove(req)}
                        disabled={isProcessing}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        승인
                      </button>
                    </div>
                  )}

                  {/* Processing info if completed */}
                  {!isPending && req.processedBy && (
                    <div className="pt-2 text-[11px] text-slate-400 text-right">
                      처리: {req.processedBy.name || req.processedBy.email} ({req.processedAt ? new Date(req.processedAt).toLocaleDateString() : ''})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <h3 className="text-base font-bold text-slate-800 mb-1">통학 변경 신청 반려</h3>
            <p className="text-xs text-slate-500 mb-4">
              [{rejectModalReq.studentName}] 원아의 {rejectModalReq.typeKr} 신청을 반려합니다. 학부모님께 전달될 반려 사유를 필수로 입력해주세요.
            </p>

            <textarea
              rows={3}
              placeholder="예: 해당 날짜에는 2호차 노선 정원이 초과되어 배정이 어렵습니다. 다른 시간을 선택해주세요."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden mb-4 resize-none"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs"
              >
                {isProcessing ? '처리 중...' : '반려 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

