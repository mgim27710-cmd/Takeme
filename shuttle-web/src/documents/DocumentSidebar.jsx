import React, { useState, useEffect, useRef } from 'react';
import {
  saveDocument,
  getDocuments,
  deleteDocument,
  downloadDocument,
  previewDocumentInNewTab,
  formatFileSize,
  getOverallExpirySummary,
} from './documentStorage';
import { openPrintDocument } from './pdfDocumentGenerator';

export default function DocumentSidebar({ 
  academyId, 
  academyName, 
  currentUser, 
  buses = [], 
  students = [],
  activeEducationLevel,
  terms,
}) {
  const currentEducationLevel = activeEducationLevel || currentUser?.educationLevel || localStorage.getItem('takeme_selected_education_level') || '유치원';
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBusId, setSelectedBusId] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [sidebarTab, setSidebarTab] = useState('templates'); // 'templates' | 'expiry' | 'docs'
  const [expirySummary, setExpirySummary] = useState({ urgentCount: 0, warningCount: 0, safeCount: 0, urgentItems: [] });
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('unsupported');
  const [previewText, setPreviewText] = useState('');
  const fileInputRef = useRef(null);

  const handleOpenPreview = async (doc) => {
    if (!doc || !doc.fileBlob) {
      alert('미리보기할 파일 데이터를 찾을 수 없습니다.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const ext = doc.fileName?.split('.').pop()?.toLowerCase() || '';
    const mime = doc.fileType?.toLowerCase() || '';

    if (ext === 'pdf' || mime.includes('pdf')) {
      const blob = doc.fileBlob.type === 'application/pdf'
        ? doc.fileBlob
        : new Blob([doc.fileBlob], { type: 'application/pdf' });
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewType('pdf');
      setPreviewText('');
      setPreviewDoc(doc);
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || mime.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(doc.fileBlob));
      setPreviewType('image');
      setPreviewText('');
      setPreviewDoc(doc);
    } else if (['txt', 'csv', 'json', 'md', 'log'].includes(ext) || mime.startsWith('text/')) {
      try {
        setPreviewText(await doc.fileBlob.text());
        setPreviewType('text');
        setPreviewUrl('');
        setPreviewDoc(doc);
      } catch (e) {
        setPreviewType('unsupported');
        setPreviewUrl('');
        setPreviewDoc(doc);
      }
    } else {
      setPreviewType('unsupported');
      setPreviewUrl('');
      setPreviewText('');
      setPreviewDoc(doc);
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewText('');
    setPreviewDoc(null);
  };


  const loadExpiry = () => {
    const summary = getOverallExpirySummary(buses, currentEducationLevel);
    setExpirySummary(summary);
  };

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const docs = await getDocuments(academyId, currentEducationLevel);
      setDocuments(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
    loadExpiry();

    const handleDocsChanged = () => loadDocs();
    const handleExpiryChanged = () => loadExpiry();

    window.addEventListener('takeme_docs_changed', handleDocsChanged);
    window.addEventListener('takeme_expiry_changed', handleExpiryChanged);

    return () => {
      window.removeEventListener('takeme_docs_changed', handleDocsChanged);
      window.removeEventListener('takeme_expiry_changed', handleExpiryChanged);
    };
  }, [academyId, buses, currentEducationLevel]);


  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const defaultTitle = file.name.replace(/\.[^/.]+$/, '');
    const title = window.prompt('등록할 서류의 명칭을 입력해주세요:', defaultTitle);
    if (!title || !title.trim()) return;

    setIsUploading(true);
    try {
      await saveDocument({
        academyId,
        educationLevel: currentEducationLevel,
        title: title.trim(),
        category: '행정서류',
        file,
        uploadedBy: currentUser?.name ? `${currentUser.name} 관리자` : '관리자',
      });
      alert(`'${title}' 서류가 성공적으로 등록되었습니다.`);
    } catch (err) {
      console.error(err);
      alert('서류 등록 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc) => {
    if (window.confirm(`'${doc.title}' 서류를 삭제하시겠습니까?`)) {
      try {
        await deleteDocument(doc.id);
      } catch (err) {
        console.error(err);
        alert('삭제 실패');
      }
    }
  };

  // Active bus and filtered students
  const activeBus = buses.find(b => String(b.id) === String(selectedBusId)) || null;
  const activeBusStudents = students.filter(s => {
    if (!activeBus) return false;
    if (s.assignedBusId && String(s.assignedBusId) === String(activeBus.id)) return true;
    if (s.raw && (s.raw['등원차량'] === activeBus.name || s.raw['하원차량'] === activeBus.name)) return true;
    if (s.assignedVehicle && String(s.assignedVehicle.id) === String(activeBus.id)) return true;
    return false;
  });

  const availableStudents = activeBus ? activeBusStudents : students;
  const activeStudent = availableStudents.find(s => String(s.id) === String(selectedStudentId)) || availableStudents[0] || null;

  const handleDownloadTemplate = (type) => {
    openPrintDocument(type, {
      academyName,
      date: new Date().toISOString().split('T')[0],
      selectedBus: activeBus,
      busStudents: type === 'health-allergy' ? students : (activeBus ? activeBusStudents : students),
      selectedStudent: activeStudent,
    });
  };

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto break-keep select-none bg-white">
      {/* Header - 다른 사이드바 창과 완전히 동일한 규격 및 타이포그래피 */}
      <div className="mb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              서류 관리
            </h2>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-black shadow-xs flex items-center gap-1 border ${terms?.themeBadge || 'bg-blue-100 text-blue-800 border-blue-200'}`}>
              <span>{terms?.icon || '🏫'}</span>
              <span>{currentEducationLevel}</span>
            </span>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-lg border border-slate-200">
            총 {documents.length}건
          </span>
        </div>
        <p className="text-xs text-slate-600 font-medium mt-1">
          법정 의무 서식 출력, 안전 서류 및 유효기간을 통합 관리합니다.
        </p>
      </div>

      {/* Sidebar Sub Tabs - 세그먼트 버튼 */}
      <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0 select-none shadow-2xs mb-4">
        <button
          type="button"
          onClick={() => setSidebarTab('templates')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            sidebarTab === 'templates'
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📄</span>
          <span>서식 출력</span>
        </button>
        <button
          type="button"
          onClick={() => setSidebarTab('expiry')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            sidebarTab === 'expiry'
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>⏳</span>
          <span>만료일</span>
          {expirySummary.urgentCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {expirySummary.urgentCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSidebarTab('docs')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            sidebarTab === 'docs'
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📁</span>
          <span>보관 서류</span>
        </button>
      </div>

      <div className="flex-1 space-y-4">
        {/* Tab 1: Templates (서식 출력) */}
        {sidebarTab === 'templates' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Bus Selector */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">차량(호차) 선택</label>
              <select
                value={selectedBusId}
                onChange={(e) => setSelectedBusId(e.target.value)}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-blue-500 shadow-2xs"
              >
                <option value="all">전체 호차 (기본 서식)</option>
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.busNumber} {b.plateNumber ? `(${b.plateNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Template List */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1 pt-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-xs font-black text-slate-700 tracking-tight">차량 및 안전운행 서식</span>
              </div>
              <button
                onClick={() => handleDownloadTemplate('safety')}
                className="w-full py-2.5 px-3.5 bg-white hover:bg-slate-50 text-xs sm:text-sm font-extrabold text-slate-800 border border-slate-200/90 border-l-4 border-l-blue-500 hover:border-blue-400 rounded-xl transition-all shadow-2xs flex items-center justify-between group cursor-pointer"
              >
                <span>일일 안전점검표 {activeBus ? `(${activeBus.name})` : ''}</span>
                <span className="text-xs text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-md group-hover:bg-blue-600 group-hover:text-white transition-colors">출력</span>
              </button>
              <button
                onClick={() => handleDownloadTemplate('companion')}
                className="w-full py-2.5 px-3.5 bg-white hover:bg-slate-50 text-xs sm:text-sm font-extrabold text-slate-800 border border-slate-200/90 border-l-4 border-l-blue-500 hover:border-blue-400 rounded-xl transition-all shadow-2xs flex items-center justify-between group cursor-pointer"
              >
                <span>동승보호자 탑승일지 및 승하차명부</span>
                <span className="text-xs text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-md group-hover:bg-blue-600 group-hover:text-white transition-colors">출력</span>
              </button>
              <button
                onClick={() => handleDownloadTemplate('emergency')}
                className="w-full py-2.5 px-3.5 bg-white hover:bg-slate-50 text-xs sm:text-sm font-extrabold text-slate-800 border border-slate-200/90 border-l-4 border-l-blue-500 hover:border-blue-400 rounded-xl transition-all shadow-2xs flex items-center justify-between group cursor-pointer"
              >
                <span>비상연락망 및 특이사항 명부</span>
                <span className="text-xs text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-md group-hover:bg-blue-600 group-hover:text-white transition-colors">출력</span>
              </button>
              <button
                onClick={() => handleDownloadTemplate('timetable')}
                className="w-full py-2.5 px-3.5 bg-white hover:bg-slate-50 text-xs sm:text-sm font-extrabold text-slate-800 border border-slate-200/90 border-l-4 border-l-blue-500 hover:border-blue-400 rounded-xl transition-all shadow-2xs flex items-center justify-between group cursor-pointer"
              >
                <span>운행 노선표 및 시간표</span>
                <span className="text-xs text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-md group-hover:bg-blue-600 group-hover:text-white transition-colors">출력</span>
              </button>
              <button
                onClick={() => handleDownloadTemplate('attendance-log')}
                className="w-full py-2.5 px-3.5 bg-white hover:bg-slate-50 text-xs sm:text-sm font-extrabold text-slate-800 border border-slate-200/90 border-l-4 border-l-amber-500 hover:border-amber-400 rounded-xl transition-all shadow-2xs flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-amber-500 text-sm font-black">★</span>
                  <span className="truncate">교직원·셔틀 근태표 (월간 출근부) {activeBus ? `(${activeBus.name})` : ''}</span>
                </div>
                <span className="text-xs text-amber-700 font-black bg-amber-50 px-2 py-0.5 rounded-md group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">출력</span>
              </button>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-1.5 px-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-black text-slate-700 tracking-tight">원아 및 보호자 동의서</span>
              </div>
              {availableStudents.length > 0 && (
                <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 shadow-2xs mb-2">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none cursor-pointer focus:border-blue-500 shadow-2xs"
                  >
                    {availableStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.className || st.raw?.['반명'] || '원아'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={() => handleDownloadTemplate('consent')}
                className="w-full py-2.5 px-3.5 bg-white hover:bg-slate-50 text-xs sm:text-sm font-extrabold text-slate-800 border border-slate-200/90 border-l-4 border-l-emerald-500 hover:border-emerald-400 rounded-xl transition-all shadow-2xs flex items-center justify-between group cursor-pointer"
              >
                <span>차량 이용 신청 및 안전동의서</span>
                <span className="text-xs text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-md group-hover:bg-emerald-600 group-hover:text-white transition-colors">출력</span>
              </button>
              <button
                onClick={() => handleDownloadTemplate('handover')}
                className="w-full py-2.5 px-3.5 bg-white hover:bg-slate-50 text-xs sm:text-sm font-extrabold text-slate-800 border border-slate-200/90 border-l-4 border-l-emerald-500 hover:border-emerald-400 rounded-xl transition-all shadow-2xs flex items-center justify-between group cursor-pointer"
              >
                <span>영유아 귀가 및 응급처치 동의서</span>
                <span className="text-xs text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-md group-hover:bg-emerald-600 group-hover:text-white transition-colors">출력</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Expiry (만료일 현황) */}
        {sidebarTab === 'expiry' && (
          <div className="space-y-3 animate-in fade-in">
            <div className={`p-3.5 rounded-xl border transition-all ${
              expirySummary.urgentCount > 0 
                ? 'bg-red-50/70 border-red-200' 
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-black text-slate-800">
                  서류·교육 만료 상태
                </div>
                {expirySummary.urgentCount > 0 ? (
                  <span className="text-xs font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-md animate-pulse">
                    긴급 {expirySummary.urgentCount}건
                  </span>
                ) : (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">
                    정상
                  </span>
                )}
              </div>

              {expirySummary.urgentCount > 0 && expirySummary.urgentItems[0] && (
                <div className="text-[11px] font-bold text-red-700 bg-white/90 p-2.5 rounded-lg border border-red-100 mb-2.5 leading-tight">
                  {expirySummary.urgentItems[0].busName} {expirySummary.urgentItems[0].fieldLabel}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{expirySummary.urgentItems[0].dateStr}</span>
                    <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-extrabold">
                      {expirySummary.urgentItems[0].dday.label}
                    </span>
                  </div>
                </div>
              )}

              {/* Traffic Light Counter */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="bg-white py-2 px-1 rounded-lg border border-slate-200/70 shadow-2xs">
                  <span className="text-red-600 font-extrabold text-xs">{expirySummary.urgentCount}</span>
                  <div className="text-slate-400 text-[9px] mt-0.5">긴급/만료</div>
                </div>
                <div className="bg-white py-2 px-1 rounded-lg border border-slate-200/70 shadow-2xs">
                  <span className="text-amber-600 font-extrabold text-xs">{expirySummary.warningCount}</span>
                  <div className="text-slate-400 text-[9px] mt-0.5">갱신주의</div>
                </div>
                <div className="bg-white py-2 px-1 rounded-lg border border-slate-200/70 shadow-2xs">
                  <span className="text-emerald-600 font-extrabold text-xs">{expirySummary.safeCount}</span>
                  <div className="text-slate-400 text-[9px] mt-0.5">정상</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center mt-3 font-medium">
                오른쪽 대화면 [만료일 알림 현황] 탭에서 호차별 날짜 수정이 가능합니다.
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Docs (등록 서류 보관함) */}
        {sidebarTab === 'docs' && (
          <div className="space-y-3 animate-in fade-in">
            {/* Upload Action */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50 active:scale-98"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {isUploading ? '업로드 등록 중...' : '서류 파일 바로 올리기'}
            </button>

            {/* Document List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">보관된 서류 목록</span>
                <span className="text-[11px] text-slate-400">최신순</span>
              </div>

              {isLoading ? (
                <div className="text-center py-6 text-xs text-slate-400">목록 조회 중...</div>
              ) : documents.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center text-xs text-slate-400">
                  등록된 서류가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="text-[11px] text-blue-600 font-bold mb-0.5">{doc.category}</div>
                          <div className="text-sm font-bold text-slate-800 break-all leading-snug" title={doc.title}>
                            {doc.title}
                          </div>
                          <div className="text-xs text-slate-500 break-all leading-tight mt-1" title={doc.fileName}>
                            {doc.fileName} <span className="text-slate-400 text-[11px]">({formatFileSize(doc.fileSize)})</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDelete(doc)}
                          className="text-slate-300 hover:text-red-500 p-1 transition-colors shrink-0 cursor-pointer"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          onClick={() => handleOpenPreview(doc)}
                          className="py-2 px-2.5 bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          미리보기
                        </button>
                        <button
                          onClick={() => downloadDocument(doc)}
                          className="py-2 px-2.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          다운로드
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[2200] p-4"
          onClick={handleClosePreview}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[86vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">
                    {previewDoc.category}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {previewDoc.fileName} ({formatFileSize(previewDoc.fileSize)})
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-800 truncate mt-0.5" title={previewDoc.title}>
                  {previewDoc.title}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(previewType === 'pdf' || previewType === 'image' || previewType === 'text') && (
                  <button
                    onClick={() => previewDocumentInNewTab(previewDoc)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    새 창으로 열기
                  </button>
                )}
                <button
                  onClick={() => downloadDocument(previewDoc)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                >
                  파일 다운로드
                </button>
                <button
                  onClick={handleClosePreview}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors text-lg font-bold ml-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-4 overflow-hidden flex items-center justify-center">
              {previewType === 'pdf' && previewUrl && (
                <iframe
                  src={previewUrl}
                  title={previewDoc.title}
                  className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-inner"
                />
              )}

              {previewType === 'image' && previewUrl && (
                <div className="w-full h-full flex items-center justify-center overflow-auto bg-slate-900/5 rounded-xl p-4">
                  <img
                    src={previewUrl}
                    alt={previewDoc.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md bg-white"
                  />
                </div>
              )}

              {previewType === 'text' && (
                <div className="w-full h-full bg-white rounded-xl border border-slate-200 p-5 overflow-auto shadow-inner">
                  <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-all leading-relaxed">
                    {previewText || '(내용이 없는 텍스트 파일입니다.)'}
                  </pre>
                </div>
              )}

              {previewType === 'unsupported' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 max-w-md w-full text-center shadow-sm">
                  <h4 className="text-base font-extrabold text-slate-800 mb-1.5">
                    브라우저 직접 미리보기를 지원하지 않는 형식입니다
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-5">
                    한글(HWP), 엑셀(XLSX), 워드(DOCX) 등의 전용 문서 파일은 다운로드한 후 전용 프로그램에서 열람해주세요.
                  </p>
                  <button
                    onClick={() => downloadDocument(previewDoc)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                  >
                    {previewDoc.fileName} 다운로드
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
