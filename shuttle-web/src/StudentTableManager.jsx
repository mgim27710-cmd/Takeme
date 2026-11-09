import React, { useState, useMemo } from 'react';
import { API_BASE_URL } from './config';

function calculateAge(birthDate) {
  if (!birthDate) return '-';
  const clean = String(birthDate).replace(/[^0-9]/g, '');
  if (clean.length < 6) return '-';
  
  let birthYear = 0;
  if (clean.length === 6) {
    const yy = parseInt(clean.substring(0, 2), 10);
    birthYear = yy > 20 ? 1900 + yy : 2000 + yy;
  } else if (clean.length >= 8) {
    birthYear = parseInt(clean.substring(0, 4), 10);
  }
  if (!birthYear) return '-';
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  return age > 0 ? `${age}세` : '-';
}

export default function StudentTableManager({
  students = [],
  buses = [],
  availableClasses = [],
  onRefresh,
  onOpenAddModal,
  onOpenUpload,
  selectedAcademyId,
  currentUser,
}) {
  const [search, setSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [selectedBusFilter, setSelectedBusFilter] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Dirty edited rows: studentId -> modified fields
  const [editedRows, setEditedRows] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('takeme_token') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'x-academy-id': String(selectedAcademyId || ''),
    };
  };

  const handleFieldChange = (id, field, value) => {
    setEditedRows(prev => {
      const existing = prev[id] || {};
      return {
        ...prev,
        [id]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const handleBatchSave = async () => {
    const ids = Object.keys(editedRows);
    if (ids.length === 0) {
      alert('수정된 내용이 없습니다.');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const payload = ids.map(idStr => {
        const id = Number(idStr);
        const changes = editedRows[idStr];
        return {
          id,
          ...changes,
        };
      });

      const res = await fetch(`${API_BASE_URL}/routing/students/batch-update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          students: payload,
          academyId: selectedAcademyId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveMessage(`${data.count || payload.length}명의 원아 정보가 일괄 저장되었습니다.`);
        setEditedRows({});
        setTimeout(() => setSaveMessage(null), 3000);
        if (onRefresh) onRefresh();
      } else {
        alert(data.message || '일괄 저장 처리에 실패했습니다.');
      }
    } catch (e) {
      alert('일괄 저장 요청 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredAndSortedStudents = useMemo(() => {
    let list = students.map(st => {
      const overrides = editedRows[st.id] || {};
      const schedules = st.schedules || [];
      const inSched = schedules.find(s => s.type === 'BOARDING');
      const outSched = schedules.find(s => s.type === 'ALIGHTING');

      const raw = st.raw || {};
      const birthDate = overrides.birthDate !== undefined ? overrides.birthDate : (st.birthDate || raw['생년월일'] || raw['생일'] || '');
      const gender = overrides.gender !== undefined ? overrides.gender : (st.gender || raw['성별'] || '');
      const className = overrides.className !== undefined ? overrides.className : (st.className || raw['반명'] || raw['반'] || '');
      const phone = overrides.phone !== undefined ? overrides.phone : (st.parentPhone || st.phone || raw['부모연락처'] || raw['학부모연락처'] || raw['연락처'] || '');
      const inBusId = overrides.inBusId !== undefined ? overrides.inBusId : (inSched?.assignedVehicle?.id || st.assignedBusId || '');
      const outBusId = overrides.outBusId !== undefined ? overrides.outBusId : (outSched?.assignedVehicle?.id || st.assignedBusId || '');

      return {
        ...st,
        currentGender: gender,
        currentBirthDate: birthDate,
        currentClass: className,
        currentPhone: phone,
        currentInBusId: inBusId ? Number(inBusId) : null,
        currentOutBusId: outBusId ? Number(outBusId) : null,
        isModified: !!editedRows[st.id],
      };
    });

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.currentClass && s.currentClass.toLowerCase().includes(q)) ||
        (s.currentPhone && s.currentPhone.includes(q))
      );
    }

    if (selectedClassFilter) {
      list = list.filter(s => s.currentClass === selectedClassFilter);
    }

    if (selectedBusFilter) {
      const bId = Number(selectedBusFilter);
      list = list.filter(s => s.currentInBusId === bId || s.currentOutBusId === bId);
    }

    list.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (sortField === 'className') {
        valA = a.currentClass || '';
        valB = b.currentClass || '';
      } else if (sortField === 'birthDate') {
        valA = a.currentBirthDate || '';
        valB = b.currentBirthDate || '';
      }
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB, 'ko');
        return sortAsc ? cmp : -cmp;
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return list;
  }, [students, editedRows, search, selectedClassFilter, selectedBusFilter, sortField, sortAsc]);

  const handleSort = field => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const modifiedCount = Object.keys(editedRows).length;

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Controls Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800">원아 명단 관리</h1>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
              총 {students.length}명
            </span>
            {modifiedCount > 0 && (
              <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
                수정 중 {modifiedCount}건
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            원아별 성별·생년월일·연락처·반·등하원 차량을 확인하고 표에서 직접 수정한 후 일괄 저장할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onOpenAddModal}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            원아 추가
          </button>

          <button
            onClick={onOpenUpload}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all shadow-xs"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
            </svg>
            엑셀 업로드
          </button>

          <button
            onClick={handleBatchSave}
            disabled={modifiedCount === 0 || isSaving}
            className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all ${
              modifiedCount > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                저장 중...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                일괄 저장 ({modifiedCount})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {saveMessage && (
        <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>{saveMessage}</span>
          </div>
          <button onClick={() => setSaveMessage(null)} className="text-white hover:text-emerald-200 font-bold">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="이름, 반, 전화번호 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedClassFilter}
            onChange={e => setSelectedClassFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="">전체 반</option>
            {availableClasses.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          <select
            value={selectedBusFilter}
            onChange={e => setSelectedBusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="">전체 차량</option>
            {buses.map(b => (
              <option key={b.id} value={b.id}>{b.busNumber}호차</option>
            ))}
          </select>

          {(search || selectedClassFilter || selectedBusFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedClassFilter('');
                setSelectedBusFilter('');
              }}
              className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Table Container (Horizontal Scroll Support for Tablet/Mobile) */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-[1000px] w-full border-collapse text-left text-xs bg-white">
          <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
            <tr>
              <th className="py-3 px-3 w-12 text-center">번호</th>
              <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">
                  이름 {sortField === 'name' && (sortAsc ? '▲' : '▼')}
                </div>
              </th>
              <th className="py-3 px-3 w-20">성별</th>
              <th className="py-3 px-3 w-32 cursor-pointer select-none" onClick={() => handleSort('birthDate')}>
                <div className="flex items-center gap-1">
                  생년월일 {sortField === 'birthDate' && (sortAsc ? '▲' : '▼')}
                </div>
              </th>
              <th className="py-3 px-3 w-16 text-center">나이</th>
              <th className="py-3 px-3 w-36">연락처</th>
              <th className="py-3 px-3 w-28 cursor-pointer select-none" onClick={() => handleSort('className')}>
                <div className="flex items-center gap-1">
                  담당 반 {sortField === 'className' && (sortAsc ? '▲' : '▼')}
                </div>
              </th>
              <th className="py-3 px-3 w-32">등원 차량</th>
              <th className="py-3 px-3 w-32">하원 차량</th>
              <th className="py-3 px-3">주소 / 탑승지</th>
              <th className="py-3 px-3 w-20 text-center">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {filteredAndSortedStudents.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                  검색 조건에 일치하는 원아가 없습니다.
                </td>
              </tr>
            ) : (
              filteredAndSortedStudents.map((st, idx) => {
                const age = calculateAge(st.currentBirthDate);
                const isModified = st.isModified;

                return (
                  <tr
                    key={st.id}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      isModified ? 'bg-amber-50/60 font-semibold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                      {idx + 1}
                    </td>

                    {/* 이름 */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800">{st.name}</div>
                      {st.realName && st.realName !== st.name && (
                        <div className="text-[10px] text-slate-400">({st.realName})</div>
                      )}
                    </td>

                    {/* 성별 */}
                    <td className="py-2.5 px-3">
                      <select
                        value={st.currentGender || ''}
                        onChange={e => handleFieldChange(st.id, 'gender', e.target.value)}
                        className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-</option>
                        <option value="남">남</option>
                        <option value="여">여</option>
                      </select>
                    </td>

                    {/* 생년월일 */}
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD"
                        value={st.currentBirthDate || ''}
                        onChange={e => handleFieldChange(st.id, 'birthDate', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* 나이 */}
                    <td className="py-2.5 px-3 text-center text-slate-600 font-bold">
                      {age}
                    </td>

                    {/* 연락처 */}
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        placeholder="010-0000-0000"
                        value={st.currentPhone || ''}
                        onChange={e => handleFieldChange(st.id, 'phone', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* 반 */}
                    <td className="py-2.5 px-3">
                      <select
                        value={st.currentClass || ''}
                        onChange={e => handleFieldChange(st.id, 'className', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-700 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">미배정</option>
                        {availableClasses.map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                    </td>

                    {/* 등원 차량 */}
                    <td className="py-2.5 px-3">
                      <select
                        value={st.currentInBusId || ''}
                        onChange={e => handleFieldChange(st.id, 'inBusId', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-blue-700 font-bold focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">미배정</option>
                        {buses.map(b => (
                          <option key={b.id} value={b.id}>{b.busNumber}호차</option>
                        ))}
                      </select>
                    </td>

                    {/* 하원 차량 */}
                    <td className="py-2.5 px-3">
                      <select
                        value={st.currentOutBusId || ''}
                        onChange={e => handleFieldChange(st.id, 'outBusId', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-purple-700 font-bold focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">미배정</option>
                        {buses.map(b => (
                          <option key={b.id} value={b.id}>{b.busNumber}호차</option>
                        ))}
                      </select>
                    </td>

                    {/* 주소 / 탑승지 */}
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]" title={st.boardingLocation || st.address}>
                      {st.boardingLocation || st.address || '-'}
                    </td>

                    {/* 상태 */}
                    <td className="py-2.5 px-3 text-center">
                      {isModified ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          수정됨
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          저장됨
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

