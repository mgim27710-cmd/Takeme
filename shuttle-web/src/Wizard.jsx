import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from './config';

export default function Wizard() {
  const [step, setStep] = useState(1); // 1: 학원 기본정보 및 반 일정 설문, 2: 엑셀 업로드, 3: 차량 및 기사/교사 정보
  const [vehicleCount, setVehicleCount] = useState(1);
  const [parsedData, setParsedData] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('takeme_user') || '{}');
    } catch (e) {
      return {};
    }
  })();
  const isAuthenticated = Boolean(currentUser && currentUser.id && currentUser.role);

  // 1. Academy Basic Information Survey State
  const [academyInfo, setAcademyInfo] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('takeme_academy_info') || '{}');
      return {
        academyName: saved.academyName || currentUser?.academyName || '',
        academyAddress: saved.academyAddress || '',
        bizNumber: saved.bizNumber || '',
        vehicleCount: saved.vehicleCount || 2,
      };
    } catch (e) {
      return {
        academyName: currentUser?.academyName || '',
        academyAddress: '',
        bizNumber: '',
        vehicleCount: 2,
      };
    }
  });

  // 2. Operating Sessions Survey State (정규하원, 방과후하원, 종일반)
  const [scheduleSessions, setScheduleSessions] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('takeme_academy_schedule_settings') || '[]');
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch (e) {}
    return [
      {
        id: 'reg_drop',
        name: '정규하원',
        startTime: '09:00',
        endTime: '14:30',
        isFullDay: false,
        shuttleOffset: '반 시작 40분 전',
        days: ['월', '화', '수', '목', '금'],
      },
      {
        id: 'after_drop',
        name: '방과후하원',
        startTime: '14:30',
        endTime: '16:30',
        isFullDay: false,
        shuttleOffset: '반 시작 30분 전',
        days: ['월', '화', '수', '목', '금'],
      },
      {
        id: 'fullday_drop',
        name: '종일반하원',
        startTime: '09:00',
        endTime: '19:30',
        isFullDay: true,
        shuttleOffset: '반 시작 40분 전',
        days: ['월', '화', '수', '목', '금'],
      },
    ];
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  // Handle advancing from Step 1 (Survey) to Step 2 (Excel Upload)
  const handleCompleteSurveyStep1 = () => {
    if (!academyInfo.academyName.trim()) {
      alert('학원(유치원) 이름을 입력해주세요.');
      return;
    }
    if (!academyInfo.academyAddress.trim()) {
      alert('학원 위치(도로명 주소)를 입력해주세요.');
      return;
    }

    try {
      localStorage.setItem('takeme_academy_info', JSON.stringify(academyInfo));
      localStorage.setItem('takeme_academy_schedule_settings', JSON.stringify(scheduleSessions));
      window.dispatchEvent(new Event('takeme_schedule_settings_changed'));
    } catch (e) {}

    const count = Number(academyInfo.vehicleCount) || 1;
    setVehicleCount(count);
    setStep(2);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      setParsedData(data);

      // Extract unique bus numbers from 등원차량, 하원차량
      const busSet = new Set();
      data.forEach((row) => {
        if (row['등원차량']) busSet.add(row['등원차량'].toString().trim());
        if (row['하원차량']) busSet.add(row['하원차량'].toString().trim());
      });

      const extractedCount = busSet.size > 0 ? busSet.size : Number(academyInfo.vehicleCount) || 1;
      setVehicleCount(extractedCount);

      // Initialize dynamic form
      const initialVehicles = Array.from({ length: extractedCount }).map((_, i) => ({
        id: i + 1,
        busNumber: Array.from(busSet)[i] || `${i + 1}호차`,
        plateNumber: '',
        driverName: '',
        driverPhone: '',
        teacherName: '',
        teacherPhone: '',
        capacity: 25,
      }));
      setVehicles(initialVehicles);
      setStep(3);
    };
    reader.readAsBinaryString(file);
  };

  // Direct manual vehicle setup without Excel file
  const handleSkipExcel = () => {
    const count = Number(academyInfo.vehicleCount) || 1;
    const initialVehicles = Array.from({ length: count }).map((_, i) => ({
      id: i + 1,
      busNumber: `${i + 1}호차`,
      plateNumber: '',
      driverName: '',
      driverPhone: '',
      teacherName: '',
      teacherPhone: '',
      capacity: 25,
    }));
    setVehicles(initialVehicles);
    setStep(3);
  };

  const handleKoreanOnly = (value) => {
    return value.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');
  };

  const handlePhoneFormat = (value) => {
    const nums = value.replace(/\D/g, '');
    if (nums.length <= 3) return nums;
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`;
  };

  const updateVehicle = (index, field, value) => {
    const newVehicles = [...vehicles];
    if (field === 'driverName' || field === 'teacherName') {
      newVehicles[index][field] = handleKoreanOnly(value);
    } else if (field === 'driverPhone' || field === 'teacherPhone') {
      newVehicles[index][field] = handlePhoneFormat(value);
    } else {
      newVehicles[index][field] = value;
    }
    setVehicles(newVehicles);
  };

  const isFormValid = () => {
    return vehicles.every(
      (v) =>
        v.busNumber &&
        v.plateNumber &&
        v.driverName &&
        v.driverPhone.length >= 12 &&
        v.teacherName &&
        v.teacherPhone.length >= 12 &&
        v.capacity > 0
    );
  };

  const submitWizard = async () => {
    if (!isFormValid()) return alert('모든 차량 정보를 올바르게 입력해주세요.');

    try {
      // Save settings to local storage as fallback
      localStorage.setItem('takeme_academy_info', JSON.stringify(academyInfo));
      localStorage.setItem('takeme_academy_schedule_settings', JSON.stringify(scheduleSessions));

      const res = await fetch(`${API_BASE_URL}/routing/init-zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicles,
          parsedData,
          academyInfo,
          scheduleSessions,
        }),
      });
      const data = await res.json();

      alert('학원 환경 설정 및 차량 정보가 성공적으로 등록되었습니다!');
      navigate('/dashboard', { state: { buses: data, scheduleSessions, academyInfo } });
    } catch (e) {
      alert('데이터 저장 및 구역 생성에 실패했습니다.');
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black">초기 배차 및 운영 환경 설정 (온보딩 설문)</h2>
              <p className="text-blue-100 text-xs mt-1">
                {step === 1 && '1단계: 학원 기본 정보 및 운영 반/시간표(정규·방과후·종일반) 설문을 작성합니다.'}
                {step === 2 && '2단계: 전년도 배차 엑셀을 업로드하거나 직접 등록으로 진행합니다.'}
                {step === 3 && '3단계: 등록된 차량들의 기사님 및 차량선생님 상세 정보를 입력합니다.'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full text-xs font-black">
              <span>{step} / 3 단계</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* ================= STEP 1: 학원 기본 정보 & 운영 반·시간표 설문 ================= */}
          {step === 1 && (
            <div className="space-y-8 animate-fade-in">
              {/* 학원 기본 인적사항 섹션 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <h3 className="text-base font-black text-slate-800">1. 학원·유치원 기본 인적 정보</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      학원 / 유치원 명칭 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={academyInfo.academyName}
                      onChange={(e) => setAcademyInfo({ ...academyInfo, academyName: e.target.value })}
                      placeholder="예: 해솔유치원, 이화학원"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      사업자등록번호
                    </label>
                    <input
                      type="text"
                      value={academyInfo.bizNumber}
                      onChange={(e) => setAcademyInfo({ ...academyInfo, bizNumber: e.target.value })}
                      placeholder="예: 123-45-67890"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      학원 위치 (도로명 주소 / 셔틀 차고지) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={academyInfo.academyAddress}
                      onChange={(e) => setAcademyInfo({ ...academyInfo, academyAddress: e.target.value })}
                      placeholder="예: 서울특별시 강서구 마곡중앙로 123 (실시간 셔틀 경로 기준지)"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      보유 통학차량 대수 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={academyInfo.vehicleCount}
                      onChange={(e) => setAcademyInfo({ ...academyInfo, vehicleCount: Math.max(1, Number(e.target.value)) })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 운영 반 및 하원 세션 설정 섹션 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    <h3 className="text-base font-black text-slate-800">
                      2. 운영 반 / 하원 세션 및 시간표 설정 (정규·방과후·종일반)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    추후 반 배정 화면에서 언제든 수정 가능
                  </span>
                </div>

                <div className="space-y-3">
                  {scheduleSessions.map((session, sIdx) => (
                    <div
                      key={session.id || sIdx}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 hover:border-indigo-300 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                          <input
                            type="text"
                            value={session.name}
                            onChange={(e) => {
                              const next = [...scheduleSessions];
                              next[sIdx].name = e.target.value;
                              setScheduleSessions(next);
                            }}
                            className="font-black text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="반/세션 명칭"
                          />
                          <label className="flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={Boolean(session.isFullDay)}
                              onChange={(e) => {
                                const next = [...scheduleSessions];
                                next[sIdx].isFullDay = e.target.checked;
                                setScheduleSessions(next);
                              }}
                              className="rounded text-purple-600 focus:ring-purple-500"
                            />
                            <span>종일반 여부</span>
                          </label>
                        </div>

                        {scheduleSessions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setScheduleSessions(scheduleSessions.filter((_, idx) => idx !== sIdx));
                            }}
                            className="text-xs text-slate-400 hover:text-red-600 font-bold px-2 py-1"
                          >
                            삭제
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-500 font-bold mb-1">반 시작 시간</label>
                          <input
                            type="time"
                            value={session.startTime}
                            onChange={(e) => {
                              const next = [...scheduleSessions];
                              next[sIdx].startTime = e.target.value;
                              setScheduleSessions(next);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-bold mb-1">반 종료(하원) 시간</label>
                          <input
                            type="time"
                            value={session.endTime}
                            onChange={(e) => {
                              const next = [...scheduleSessions];
                              next[sIdx].endTime = e.target.value;
                              setScheduleSessions(next);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-bold mb-1">차량 출발 시간 (오프셋)</label>
                          <select
                            value={session.shuttleOffset}
                            onChange={(e) => {
                              const next = [...scheduleSessions];
                              next[sIdx].shuttleOffset = e.target.value;
                              setScheduleSessions(next);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="반 시작 20분 전">반 시작 20분 전</option>
                            <option value="반 시작 30분 전">반 시작 30분 전</option>
                            <option value="반 시작 40분 전">반 시작 40분 전</option>
                            <option value="반 시작 50분 전">반 시작 50분 전</option>
                            <option value="반 시작 1시간 전">반 시작 1시간 전</option>
                            <option value="반 시작 1시간 10분 전">반 시작 1시간 10분 전</option>
                            <option value="반 시작 1시간 20분 전">반 시작 1시간 20분 전</option>
                            <option value="반 시작 1시간 30분 전">반 시작 1시간 30분 전</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">운영 요일 선택</label>
                        <div className="flex items-center gap-1.5">
                          {['월', '화', '수', '목', '금', '토'].map((day) => {
                            const isSelected = (session.days || []).includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  const next = [...scheduleSessions];
                                  const curDays = next[sIdx].days || [];
                                  next[sIdx].days = isSelected
                                    ? curDays.filter((d) => d !== day)
                                    : [...curDays, day];
                                  setScheduleSessions(next);
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setScheduleSessions([
                      ...scheduleSessions,
                      {
                        id: `session_${Date.now()}`,
                        name: '새로운 운영반',
                        startTime: '09:00',
                        endTime: '15:00',
                        isFullDay: false,
                        shuttleOffset: '반 시작 30분 전',
                        days: ['월', '화', '수', '목', '금'],
                      },
                    ]);
                  }}
                  className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-2xl border border-dashed border-slate-300 transition"
                >
                  + 운영 반 / 세션 추가하기
                </button>
              </div>

              {/* Next Step Button */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCompleteSurveyStep1}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl shadow-md hover:shadow-lg transition flex items-center gap-2"
                >
                  <span>다음 단계: 배차 엑셀 업로드로 이동</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: 전년도 배차 엑셀 업로드 ================= */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/60 p-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-black mb-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-1">전년도 배차참조용 엑셀 업로드</h3>
                <p className="text-slate-500 mb-6 text-center text-xs max-w-md leading-relaxed">
                  파일을 업로드하면 시스템에서 주소를 분석하고 운행 중인 차량별 노선 및 원아 데이터를 자동 연동합니다.
                </p>

                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl shadow-sm transition"
                >
                  엑셀 파일 선택하기 (.xlsx)
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition"
                >
                  ← 1단계 설문 수정
                </button>
                <button
                  type="button"
                  onClick={handleSkipExcel}
                  className="px-5 py-2.5 bg-white hover:bg-slate-50 text-indigo-600 font-bold text-xs rounded-xl border border-indigo-200 transition"
                >
                  엑셀 파일 없이 차량 직접 입력하기 →
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: 차량별 기사 및 교사 상세 정보 ================= */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-wrap justify-between items-center bg-blue-50/80 p-4 rounded-2xl border border-blue-100 text-xs gap-2">
                <span className="font-extrabold text-blue-900">
                  등록 대상 통학 차량: 총 {vehicleCount}대
                </span>
                <span className="text-blue-700">
                  이름은 한글, 전화번호는 숫자만 입력하시면 자동으로 하이픈이 생성됩니다.
                </span>
              </div>

              <div className="space-y-4">
                {vehicles.map((v, idx) => (
                  <div
                    key={v.id}
                    className="p-5 border border-slate-200 rounded-2xl bg-slate-50/60 relative space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="bg-slate-800 text-white text-[11px] font-black px-3 py-1 rounded-lg">
                        {idx + 1}호차 차량 정보
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold">기사 및 차량선생님 1:1 매칭</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">배차 명칭</label>
                        <input
                          type="text"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          value={v.busNumber}
                          onChange={(e) => updateVehicle(idx, 'busNumber', e.target.value)}
                          placeholder="1호차"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">차량 번호판</label>
                        <input
                          type="text"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          value={v.plateNumber}
                          onChange={(e) => updateVehicle(idx, 'plateNumber', e.target.value)}
                          placeholder="예: 70가 1234"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">기사님 성함</label>
                        <input
                          type="text"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          value={v.driverName}
                          onChange={(e) => updateVehicle(idx, 'driverName', e.target.value)}
                          placeholder="홍길동"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">기사님 연락처</label>
                        <input
                          type="text"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          value={v.driverPhone}
                          onChange={(e) => updateVehicle(idx, 'driverPhone', e.target.value)}
                          placeholder="010-0000-0000"
                          maxLength={13}
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">차량선생님 성함</label>
                        <input
                          type="text"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          value={v.teacherName}
                          onChange={(e) => updateVehicle(idx, 'teacherName', e.target.value)}
                          placeholder="김영희"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">차량선생님 연락처</label>
                        <input
                          type="text"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          value={v.teacherPhone}
                          onChange={(e) => updateVehicle(idx, 'teacherPhone', e.target.value)}
                          placeholder="010-0000-0000"
                          maxLength={13}
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">최대 탑승 정원</label>
                        <input
                          type="number"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          value={v.capacity}
                          onChange={(e) => updateVehicle(idx, 'capacity', e.target.value)}
                          min={1}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition"
                >
                  ← 이전 단계
                </button>
                <button
                  type="button"
                  onClick={submitWizard}
                  disabled={!isFormValid()}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black text-sm rounded-2xl shadow-md transition"
                >
                  설문 및 배차 환경 설정 완료하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
