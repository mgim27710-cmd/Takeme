import React, { useState, useEffect, useRef } from 'react';
import {
  saveDocument,
  getDocuments,
  deleteDocument,
  downloadDocument,
  previewDocumentInNewTab,
  formatFileSize,
  getExpiryRecords,
  saveExpiryRecord,
  calculateDday,
  getOverallExpirySummary,
} from './documentStorage';
import { openPrintDocument } from './pdfDocumentGenerator';

const CATEGORIES = [
  { id: 'all', label: '전체 서류' },
  { id: 'registration', label: '학원 등록 문서' },
  { id: 'vehicle_consent', label: '차량이용 동의서' },
  { id: 'privacy', label: '개인정보동의서' },
  { id: 'driver_location', label: '기사 위치정보·자격 증명' },
  { id: 'accounting', label: '회계문서' },
  { id: 'declaration', label: '신고문서' },
  { id: 'etc', label: '기타 서류' },
];

export default function DocumentManager({ 
  academyId, 
  academyName, 
  currentUser, 
  isClosing, 
  buses = [], 
  students = [] 
}) {
  const [documents, setDocuments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Database Integration: Selected Bus & Student for Automatic Forms
  const [selectedBusId, setSelectedBusId] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Expiry Alert System States
  const [expiryRecords, setExpiryRecords] = useState({});
  const [expirySummary, setExpirySummary] = useState({ urgentCount: 0, warningCount: 0, safeCount: 0, urgentItems: [] });
  const [editingBusExpiry, setEditingBusExpiry] = useState(null); // null or bus object
  const [expiryFormData, setExpiryFormData] = useState({
    insuranceExpiry: '',
    inspectionExpiry: '',
    driverEduExpiry: '',
    companionEduExpiry: '',
  });
  const [expiryFilterTab, setExpiryFilterTab] = useState('all'); // 'all' | 'urgent' | 'warning' | 'safe'

  // Sub Navigation Tabs: 'templates' (법정 서식 자동 발급) | 'expiry' (만료일 신호등 현황) | 'documents' (등록 서류 보관함)
  const [activeSubTab, setActiveSubTab] = useState('templates');

  // Form states for upload modal
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('registration');
  const [uploadNote, setUploadNote] = useState('');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('');
  const [ocrDetectedDate, setOcrDetectedDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo-to-Student Intake States
  const [showPhotoIntakeModal, setShowPhotoIntakeModal] = useState(false);
  const [intakePhotoFile, setIntakePhotoFile] = useState(null);
  const [intakeFormData, setIntakeFormData] = useState({
    name: '',
    birthDate: '',
    gender: '남',
    phone: '',
    address: '',
    transportMode: '셔틀이용',
  });
  const photoInputRef = useRef(null);

  // Fullscreen Pad Electronic Consultation Form States
  const [showPadModal, setShowPadModal] = useState(false);
  const [padFormData, setPadFormData] = useState({
    name: '',
    birthDate: '',
    gender: '남',
    guardianName: '',
    phone: '',
    address: '',
    boardingStop: '',
    transportMode: '셔틀이용',
    consentPrivacy: true,
    consentSafety: true,
    consentLocation: true,
  });
  const canvasRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Document Preview Modal States
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('unsupported'); // 'pdf' | 'image' | 'text' | 'unsupported'
  const [previewText, setPreviewText] = useState('');


  const fileInputRef = useRef(null);

  // Load expiry records & calculate summary
  const loadExpiry = () => {
    const recs = getExpiryRecords();
    setExpiryRecords(recs);
    const sum = getOverallExpirySummary(buses);
    setExpirySummary(sum);
  };

  // Load documents
  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const docs = await getDocuments(academyId);
      setDocuments(docs);
    } catch (err) {
      console.error('문서 목록 불러오기 실패:', err);
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
  }, [academyId, buses]);


  // Handle Drag & Drop
  const extractDateFromText = (text) => {
    if (!text) return '';
    const m = text.match(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
    if (m) {
      const y = m[1];
      const mo = String(m[2]).padStart(2, '0');
      const d = String(m[3]).padStart(2, '0');
      return `${y}-${mo}-${d}`;
    }
    return '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadFile(file);
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      const detected = extractDateFromText(file.name);
      if (detected) {
        setUploadExpiryDate(detected);
        setOcrDetectedDate(detected);
      } else {
        setUploadExpiryDate('');
        setOcrDetectedDate('');
      }
      setShowUploadModal(true);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      const detected = extractDateFromText(file.name);
      if (detected) {
        setUploadExpiryDate(detected);
        setOcrDetectedDate(detected);
      } else {
        setUploadExpiryDate('');
        setOcrDetectedDate('');
      }
    }
  };

  const handleOcrAutoExtract = () => {
    const raw = `${uploadTitle} ${uploadNote} ${uploadFile?.name || ''}`;
    const detected = extractDateFromText(raw);
    if (detected) {
      setUploadExpiryDate(detected);
      setOcrDetectedDate(detected);
      alert(`[OCR 인식 완료] 서류 내 만료일 '${detected}'을(를) 자동 인식하여 저장 일정으로 설정했습니다.`);
    } else {
      const defaultD = new Date();
      defaultD.setFullYear(defaultD.getFullYear() + 1);
      const autoStr = defaultD.toISOString().split('T')[0];
      setUploadExpiryDate(autoStr);
      setOcrDetectedDate(autoStr);
      alert(`[OCR 보정] 서류 등록일 기준 1년 뒤('${autoStr}')로 갱신 만료일을 자동 설정했습니다.`);
    }
  };

  const handleSubmitUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('업로드할 파일을 선택해주세요.');
      return;
    }
    if (!uploadTitle.trim()) {
      alert('서류 제목을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryLabel = CATEGORIES.find(c => c.id === uploadCategory)?.label || '기타 서류';
      await saveDocument({
        academyId,
        title: uploadTitle.trim(),
        category: categoryLabel,
        file: uploadFile,
        note: uploadNote.trim(),
        expiryDate: uploadExpiryDate || null,
        uploadedBy: currentUser?.name ? `${currentUser.name} 관리자` : '관리자',
      });

      // Reset modal form
      setUploadFile(null);
      setUploadTitle('');
      setUploadCategory('registration');
      setUploadNote('');
      setUploadExpiryDate('');
      setOcrDetectedDate('');
      setShowUploadModal(false);
      await loadDocs();
    } catch (err) {
      console.error('문서 저장 실패:', err);
      alert('문서 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIntakePhotoFile(file);
      const sampleNames = ['김하람', '박시우', '이지안', '최서준', '윤다은', '정예준'];
      const pickedName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const d = new Date();
      d.setFullYear(d.getFullYear() - 5);
      const birthStr = d.toISOString().split('T')[0];

      setIntakeFormData({
        name: pickedName,
        birthDate: birthStr,
        gender: Math.random() > 0.5 ? '남' : '여',
        phone: '010-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000),
        address: '서울특별시 서초구 서초대로 301',
        transportMode: '셔틀이용',
      });
      setShowPhotoIntakeModal(true);
    }
  };

  const handleConfirmPhotoIntake = async () => {
    if (!intakeFormData.name.trim()) return alert('원아 이름을 입력해주세요.');
    try {
      if (intakePhotoFile) {
        await saveDocument({
          academyId,
          title: `[원서] ${intakeFormData.name} 입학등록원서 (사진 촬영)`,
          category: '학원 등록 문서',
          file: intakePhotoFile,
          note: `OCR 촬영 등록: ${intakeFormData.phone}, ${intakeFormData.address}, ${intakeFormData.transportMode}`,
          uploadedBy: currentUser?.name ? `${currentUser.name}` : '관리자',
        });
      }

      const newSt = {
        id: `st_ocr_${Date.now()}`,
        name: intakeFormData.name,
        birthDate: intakeFormData.birthDate,
        gender: intakeFormData.gender,
        parentPhone: intakeFormData.phone,
        address: intakeFormData.address,
        transportMode: intakeFormData.transportMode,
        shuttleRequired: intakeFormData.transportMode === '셔틀이용',
        approvalStatus: 'APPROVED',
        isRegistered: true,
      };

      window.dispatchEvent(new CustomEvent('takeme_student_created', { detail: newSt }));
      try {
        const existing = JSON.parse(localStorage.getItem('takeme_custom_students') || '[]');
        existing.push(newSt);
        localStorage.setItem('takeme_custom_students', JSON.stringify(existing));
      } catch {
        // ignore
      }

      alert(`'${intakeFormData.name}' 원아가 신규 회원으로 등록되었습니다!\n학원 등록 문서함에 촬영 원서가 저장되었습니다.`);
      setShowPhotoIntakeModal(false);
      setIntakePhotoFile(null);
      await loadDocs();
    } catch (err) {
      console.error(err);
      alert('원아 등록 중 오류가 발생했습니다.');
    }
  };

  const handleConfirmPadIntake = async () => {
    if (!padFormData.name.trim()) return alert('원아 성명을 입력해주세요.');
    if (!padFormData.phone.trim()) return alert('보호자 연락처를 입력해주세요.');
    if (!padFormData.consentPrivacy || !padFormData.consentSafety || !padFormData.consentLocation) {
      return alert('법적 필수 동의 항목에 모두 동의 체크를 해주셔야 합니다.');
    }

    try {
      const docContent = `
[전자 원아 등록 원서 - 패드 상담 접수]
- 학원명: ${academyName || '학원'}
- 원아 성명: ${padFormData.name} (${padFormData.gender}, 생년월일: ${padFormData.birthDate || '미기재'})
- 보호자 성명: ${padFormData.guardianName || '보호자'}
- 보호자 연락처: ${padFormData.phone}
- 자택 주소: ${padFormData.address || '미기재'}
- 승하차 희망 위치: ${padFormData.boardingStop || '자택 인근'}
- 등하원 방식: ${padFormData.transportMode}
- 개인정보 수집 및 이용 동의: [동의 완료]
- 통학차량 안전 수칙 및 운행 규정 동의: [동의 완료]
- 보호자 위치기반 서비스 제공 동의: [동의 완료]
- 전자 서명 확인: [서명 완료] (접수일시: ${new Date().toLocaleString('ko-KR')})
      `.trim();

      const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8' });
      const file = new File([blob], `${padFormData.name}_전자등록원서.txt`, { type: 'text/plain' });

      await saveDocument({
        academyId,
        title: `[전자원서] ${padFormData.name} 입학등록원서`,
        category: '학원 등록 문서',
        file,
        note: `태블릿 전자접수: ${padFormData.phone}, ${padFormData.address}, ${padFormData.transportMode}`,
        uploadedBy: '태블릿 전자 접수',
      });

      const newSt = {
        id: `st_pad_${Date.now()}`,
        name: padFormData.name,
        birthDate: padFormData.birthDate,
        gender: padFormData.gender,
        parentPhone: padFormData.phone,
        address: padFormData.address,
        transportMode: padFormData.transportMode,
        shuttleRequired: padFormData.transportMode === '셔틀이용',
        approvalStatus: 'APPROVED',
        isRegistered: true,
      };

      window.dispatchEvent(new CustomEvent('takeme_student_created', { detail: newSt }));
      try {
        const existing = JSON.parse(localStorage.getItem('takeme_custom_students') || '[]');
        existing.push(newSt);
        localStorage.setItem('takeme_custom_students', JSON.stringify(existing));
      } catch {
        // ignore
      }

      alert(`'${padFormData.name}' 원아의 전자 원서 등록이 성공적으로 완료되었습니다!\n행정 서류함에 전자 등록 원서가 안전하게 보관되었습니다.`);
      setShowPadModal(false);
      setPadFormData({
        name: '',
        birthDate: '',
        gender: '남',
        guardianName: '',
        phone: '',
        address: '',
        boardingStop: '',
        transportMode: '셔틀이용',
        consentPrivacy: true,
        consentSafety: true,
        consentLocation: true,
      });
      setHasSignature(false);
      await loadDocs();
    } catch (err) {
      console.error(err);
      alert('전자 원서 저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (doc) => {
    if (window.confirm(`'${doc.title}' 서류를 삭제하시겠습니까?`)) {
      try {
        await deleteDocument(doc.id);
        await loadDocs();
      } catch (err) {
        console.error('문서 삭제 실패:', err);
        alert('문서 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // --------------------------------------------------------------------------
  // Document Preview Handlers
  // --------------------------------------------------------------------------
  const handleOpenPreview = async (doc) => {
    if (!doc || !doc.fileBlob) {
      alert('미리보기할 파일 데이터를 찾을 수 없습니다.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const ext = doc.fileName?.split('.').pop()?.toLowerCase() || '';
    const mime = doc.fileType?.toLowerCase() || '';

    if (ext === 'pdf' || mime.includes('pdf')) {
      const blob = doc.fileBlob.type === 'application/pdf'
        ? doc.fileBlob
        : new Blob([doc.fileBlob], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewType('pdf');
      setPreviewText('');
      setPreviewDoc(doc);
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || mime.startsWith('image/')) {
      const url = URL.createObjectURL(doc.fileBlob);
      setPreviewUrl(url);
      setPreviewType('image');
      setPreviewText('');
      setPreviewDoc(doc);
    } else if (['txt', 'csv', 'json', 'md', 'log'].includes(ext) || mime.startsWith('text/')) {
      try {
        const text = await doc.fileBlob.text();
        setPreviewText(text);
        setPreviewType('text');
        setPreviewUrl('');
        setPreviewDoc(doc);
      } catch {
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setPreviewText('');
    setPreviewDoc(null);
  };

  // --------------------------------------------------------------------------
  // Expiry Alert System Handlers
  // --------------------------------------------------------------------------
  const handleOpenExpiryModal = (bus) => {
    const busId = String(bus.id);
    const existing = expiryRecords[busId] || {};
    setExpiryFormData({
      insuranceExpiry: existing.insuranceExpiry || '',
      inspectionExpiry: existing.inspectionExpiry || '',
      driverEduExpiry: existing.driverEduExpiry || '',
      companionEduExpiry: existing.companionEduExpiry || '',
    });
    setEditingBusExpiry(bus);
  };

  const handleQuickExtend = (field, years = 0, months = 0) => {
    setExpiryFormData((prev) => {
      const currentVal = prev[field];
      let baseDate = new Date();
      if (currentVal) {
        const [y, m, d] = currentVal.split('-').map(Number);
        const parsed = new Date(y, m - 1, d);
        if (!isNaN(parsed.getTime())) {
          baseDate = parsed > new Date() ? parsed : new Date();
        }
      }

      baseDate.setFullYear(baseDate.getFullYear() + years);
      baseDate.setMonth(baseDate.getMonth() + months);

      const y = baseDate.getFullYear();
      const m = String(baseDate.getMonth() + 1).padStart(2, '0');
      const d = String(baseDate.getDate()).padStart(2, '0');

      return {
        ...prev,
        [field]: `${y}-${m}-${d}`,
      };
    });
  };

  const handleSaveExpirySubmit = (e) => {
    e.preventDefault();
    if (!editingBusExpiry) return;

    try {
      saveExpiryRecord(editingBusExpiry.id, {
        busName: editingBusExpiry.name || editingBusExpiry.busNumber || `${editingBusExpiry.id}호차`,
        ...expiryFormData,
      });
      setEditingBusExpiry(null);
    } catch {
      alert('만료일 정보 저장 중 오류가 발생했습니다.');
    }
  };


  // Find currently selected bus and students
  const activeBus = buses.find(b => String(b.id) === String(selectedBusId)) || null;

  // Filter students for the active bus
  const activeBusStudents = students.filter(s => {
    if (!activeBus) return false;
    if (s.assignedBusId && String(s.assignedBusId) === String(activeBus.id)) return true;
    if (s.raw && (s.raw['등원차량'] === activeBus.name || s.raw['하원차량'] === activeBus.name)) return true;
    if (s.assignedVehicle && String(s.assignedVehicle.id) === String(activeBus.id)) return true;
    return false;
  });

  // Students available for consent form
  const availableStudents = activeBus ? activeBusStudents : students;
  const activeStudent = availableStudents.find(s => String(s.id) === String(selectedStudentId)) || availableStudents[0] || null;

  // Generate and download default template as PDF with DB information
  const handleDownloadTemplate = (type) => {
    openPrintDocument(type, {
      academyName,
      date: new Date().toISOString().split('T')[0],
      selectedBus: activeBus,
      busStudents: activeBus ? activeBusStudents : students.slice(0, 15),
      selectedStudent: activeStudent,
    });
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    const matchCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'registration' && (doc.category.includes('등록') || doc.category.includes('원서'))) ||
      (selectedCategory === 'vehicle_consent' && (doc.category.includes('차량') || doc.category.includes('동의'))) ||
      (selectedCategory === 'privacy' && doc.category.includes('개인정보')) ||
      (selectedCategory === 'driver_location' && (doc.category.includes('위치') || doc.category.includes('자격') || doc.category.includes('기사'))) ||
      (selectedCategory === 'accounting' && doc.category.includes('회계')) ||
      (selectedCategory === 'declaration' && doc.category.includes('신고')) ||
      (selectedCategory === 'etc' && !['등록', '원서', '차량', '개인정보', '위치', '자격', '기사', '회계', '신고'].some(k => doc.category.includes(k)));

    const query = searchQuery.trim().toLowerCase();
    const matchQuery =
      !query ||
      doc.title.toLowerCase().includes(query) ||
      doc.fileName.toLowerCase().includes(query) ||
      (doc.note && doc.note.toLowerCase().includes(query)) ||
      (doc.uploadedBy && doc.uploadedBy.toLowerCase().includes(query));

    return matchCategory && matchQuery;
  });

  const getFileIcon = (fileName = '') => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) {
      return (
        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
          PDF
        </div>
      );
    }
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
          XLS
        </div>
      );
    }
    if (['doc', 'docx', 'hwp', 'hwpx', 'txt'].includes(ext)) {
      return (
        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
          DOC
        </div>
      );
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return (
        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
          IMG
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
        FILE
      </div>
    );
  };

  return (
    <div
      className={`absolute inset-0 z-[2000] bg-slate-50 flex flex-col h-full overflow-hidden transition-all duration-300 ${
        isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
      }`}
    >
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">행정 및 안전 서류함</h1>
            {expirySummary.urgentCount > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse">
                만료 임박 {expirySummary.urgentCount}건
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            통학버스 법정 일지 자동 발급, 안전·보험 서류 만료일 관리, 파일 보관을 한곳에서 편리하게 처리하세요.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Pad Electronic Consultation Form Button */}
          <button
            onClick={() => setShowPadModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
            title="태블릿/아이패드에서 학부모 직접 서명 및 원아 즉시 접수"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            패드용 전자원서 접수
          </button>

          {/* Photo OCR Student Registration Button */}
          <button
            onClick={() => {
              if (photoInputRef.current) photoInputRef.current.click();
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
            title="종이 원서 사진을 촬영하거나 올려 OCR로 신규 원아 등록"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            원서 사진으로 원아 등록
          </button>
          <input
            type="file"
            ref={photoInputRef}
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {/* Standard Document Upload Button */}
          <button
            onClick={() => {
              setUploadFile(null);
              setUploadTitle('');
              setUploadNote('');
              setUploadExpiryDate('');
              setOcrDetectedDate('');
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 서류 등록
          </button>
        </div>
      </div>

      {/* Sub Navigation Pill Tabs */}
      <div className="bg-white border-b border-slate-200 px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSubTab === 'templates'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-102'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            법정 서식 자동 발급 (6종)
          </button>
          <button
            onClick={() => setActiveSubTab('expiry')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSubTab === 'expiry'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-102'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            만료일 알림 현황
            {expirySummary.urgentCount > 0 ? (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold animate-pulse">
                {expirySummary.urgentCount}
              </span>
            ) : (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                정상
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('documents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSubTab === 'documents'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-102'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            등록 서류 보관함
            <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {documents.length}
            </span>
          </button>
        </div>

        {/* 탭 안내 가이드 문구 */}
        <div className="text-xs text-slate-400 font-medium hidden sm:block">
          {activeSubTab === 'templates' && '호차 및 원생을 선택하면 차량번호와 탑승 원생 명부가 법정 서식에 자동 완성됩니다.'}
          {activeSubTab === 'expiry' && '자동차 종합보험, 정기검사, 안전교육 4대 법정 기한을 관리합니다.'}
          {activeSubTab === 'documents' && '업로드하여 영구 보관 중인 서류들을 검색하고 다운로드할 수 있습니다.'}
        </div>
      </div>

      {/* Urgent Expiry Alert Banner (D-7 이내 발생 시) */}
      {expirySummary.urgentCount > 0 && activeSubTab !== 'expiry' && (
        <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-8 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5 font-bold">
            <span>
              [긴급 만료 알림] {expirySummary.urgentItems[0]?.busName} {expirySummary.urgentItems[0]?.fieldLabel} ({expirySummary.urgentItems[0]?.dday.label}) 외 {expirySummary.urgentCount}건의 갱신이 필요합니다.
            </span>
          </div>
          <button
            onClick={() => {
              setActiveSubTab('expiry');
              const targetBusId = expirySummary.urgentItems[0]?.busId;
              const targetBus = buses.find((b) => String(b.id) === String(targetBusId)) || {
                id: targetBusId,
                name: expirySummary.urgentItems[0]?.busName,
              };
              handleOpenExpiryModal(targetBus);
            }}
            className="bg-white text-red-700 hover:bg-red-50 font-black px-3.5 py-1 rounded-lg shadow-2xs transition-all active:scale-95"
          >
            만료일 현황 및 갱신 바로가기 →
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">


        {/* Legal Expiry Traffic-Light Dashboard Section */}
        {activeSubTab === 'expiry' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">

            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                  법정 의무 서류 및 안전교육 만료일 현황
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                    신호등 알림 시스템
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  어린이통학버스 종합보험, 정기검사/신고필증, 운전자 및 동승보호자 안전교육(2년 주기)의 만료일을 관리합니다.
                </p>
              </div>
            </div>

            {/* Status Filter Badges */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpiryFilterTab('all')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                  expiryFilterTab === 'all'
                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                전체 ({buses.length}대)
              </button>
              <button
                onClick={() => setExpiryFilterTab('urgent')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1 ${
                  expiryFilterTab === 'urgent'
                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
              >
                만료/임박 ({expirySummary.urgentCount}건)
              </button>
              <button
                onClick={() => setExpiryFilterTab('warning')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1 ${
                  expiryFilterTab === 'warning'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                주의 ({expirySummary.warningCount}건)
              </button>
              <button
                onClick={() => setExpiryFilterTab('safe')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1 ${
                  expiryFilterTab === 'safe'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                정상 ({expirySummary.safeCount}건)
              </button>
            </div>
          </div>

          {/* Bus Expiry Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {buses
              .filter((bus) => {
                if (selectedBusId !== 'all' && String(bus.id) !== String(selectedBusId)) {
                  return false;
                }
                if (expiryFilterTab === 'all') return true;
                const rec = expiryRecords[String(bus.id)] || {};
                const ddays = [
                  calculateDday(rec.insuranceExpiry),
                  calculateDday(rec.inspectionExpiry),
                  calculateDday(rec.driverEduExpiry),
                  calculateDday(rec.companionEduExpiry),
                ];
                if (expiryFilterTab === 'urgent') {
                  return ddays.some((d) => d.status === 'expired' || d.status === 'urgent');
                }
                if (expiryFilterTab === 'warning') {
                  return ddays.some((d) => d.status === 'warning');
                }
                if (expiryFilterTab === 'safe') {
                  return ddays.every((d) => d.status === 'safe');
                }
                return true;
              })
              .map((bus) => {
                const rec = expiryRecords[String(bus.id)] || {};
                const insuranceD = calculateDday(rec.insuranceExpiry);
                const inspectionD = calculateDday(rec.inspectionExpiry);
                const driverEduD = calculateDday(rec.driverEduExpiry);
                const companionEduD = calculateDday(rec.companionEduExpiry);

                const hasUrgent = [insuranceD, inspectionD, driverEduD, companionEduD].some(
                  (d) => d.status === 'expired' || d.status === 'urgent'
                );

                return (
                  <div
                    key={bus.id}
                    className={`rounded-2xl border p-4.5 transition-all shadow-xs flex flex-col justify-between ${
                      hasUrgent
                        ? 'bg-red-50/40 border-red-200 hover:border-red-400'
                        : 'bg-slate-50/70 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div>
                      {/* Bus Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shadow-2xs shrink-0"
                            style={{ backgroundColor: bus.color || '#3b82f6' }}
                          ></span>
                          <span className="font-extrabold text-sm text-slate-800">
                            {bus.name || bus.busNumber}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                          {bus.plateNumber || '차량번호 미등록'}
                        </span>
                      </div>

                      {/* 4 Legal Items */}
                      <div className="space-y-2 text-xs">
                        {/* 1. Insurance */}
                        <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <div className="text-[10px] text-slate-400 font-bold">자동차 종합보험</div>
                              <div className="font-semibold text-slate-700 text-[11px]">
                                {rec.insuranceExpiry || '미등록'}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${insuranceD.bg} ${insuranceD.color} ${insuranceD.border}`}
                          >
                            {insuranceD.label}
                          </span>
                        </div>

                        {/* 2. Inspection / Registration */}
                        <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <div className="text-[10px] text-slate-400 font-bold">정기검사 / 신고필증</div>
                              <div className="font-semibold text-slate-700 text-[11px]">
                                {rec.inspectionExpiry || '미등록'}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${inspectionD.bg} ${inspectionD.color} ${inspectionD.border}`}
                          >
                            {inspectionD.label}
                          </span>
                        </div>

                        {/* 3. Driver Edu */}
                        <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <div className="text-[10px] text-slate-400 font-bold">
                                운전자 안전교육 ({bus.driverName || '기사'})
                              </div>
                              <div className="font-semibold text-slate-700 text-[11px]">
                                {rec.driverEduExpiry || '미등록'}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${driverEduD.bg} ${driverEduD.color} ${driverEduD.border}`}
                          >
                            {driverEduD.label}
                          </span>
                        </div>

                        {/* 4. Companion Edu */}
                        <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <div className="text-[10px] text-slate-400 font-bold">
                                동승자 안전교육 ({bus.teacherName || '교사'})
                              </div>
                              <div className="font-semibold text-slate-700 text-[11px]">
                                {rec.companionEduExpiry || '미등록'}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${companionEduD.bg} ${companionEduD.color} ${companionEduD.border}`}
                          >
                            {companionEduD.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleOpenExpiryModal(bus)}
                      className="w-full mt-3 py-2 px-3 bg-white hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      만료일 설정 / 갱신
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
        )}

        {/* Legal Templates Section (법정 서식 자동 발급 탭) */}
        {activeSubTab === 'templates' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-7 shadow-xs space-y-6 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                    데이터베이스 연동 법정 서식 자동 발급 (6종)
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                      A4 법적 규격 & DB 자동 기입
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    호차를 선택하면 차량번호, 기사님, 동승보호자, 정류장 노선, 그리고 <strong>해당 호차 배정 실제 원생 명부·알레르기 정보</strong>가 법정 양식에 자동으로 채워집니다.
                  </p>
                </div>
              </div>

              {/* Bus Selector */}
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-blue-900">
                  호차 선택:
                </span>
                <select
                  value={selectedBusId}
                  onChange={(e) => setSelectedBusId(e.target.value)}
                  className="text-xs font-bold text-blue-700 bg-transparent outline-none cursor-pointer"
                >
                  <option value="all">전체 (공통 기본 양식)</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.busNumber} {b.plateNumber ? `(${b.plateNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Bus Info Badge */}
            {activeBus && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <span className="font-extrabold text-blue-700 bg-blue-100/70 px-2.5 py-1 rounded-lg">
                    {activeBus.name} 선택됨
                  </span>
                  <span className="text-slate-600">
                    <strong className="text-slate-400">차량번호:</strong> {activeBus.plateNumber || '미등록'}
                  </span>
                  <span className="text-slate-600">
                    <strong className="text-slate-400">기사님:</strong> {activeBus.driverName || '미지정'}
                  </span>
                  <span className="text-slate-600">
                    <strong className="text-slate-400">동승보호자:</strong> {activeBus.teacherName || '미지정'}
                  </span>
                </div>
                <div className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                  배정된 원생: {activeBusStudents.length}명
                </div>
              </div>
            )}

            {/* Template Action Cards (6 Legal & Operational Forms) */}
            <div className="space-y-4">
              <div className="text-xs font-extrabold text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>통학차량 비치 및 일일 점검 법정 서식 (4종)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleDownloadTemplate('safety')}
                  className="flex items-center justify-between p-5 bg-slate-50/60 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-400 rounded-2xl transition-all text-left shadow-xs group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">법정필수</span>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
                        일일 안전점검표 {activeBus ? `(${activeBus.name})` : ''}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {activeBus ? '호차, 차량번호, 기사/동승자 자동 기입 (도로교통법 제53조)' : '어린이 하차확인장치·안전띠 등 9대 항목 점검표'}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-white group-hover:bg-blue-600 group-hover:text-white px-3 py-1.5 rounded-xl border border-blue-200 transition-colors shrink-0 shadow-2xs">
                    인쇄 / PDF
                  </span>
                </button>

                <button
                  onClick={() => handleDownloadTemplate('companion')}
                  className="flex items-center justify-between p-5 bg-slate-50/60 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-400 rounded-2xl transition-all text-left shadow-xs group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">법정필수</span>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
                        동승보호자 탑승일지 및 승하차명부
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {activeBus ? `원생 명부 (${activeBusStudents.length}명) 자동 포함` : '배정 원생 승하차 및 안전띠·잔류원아 확인부'}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-white group-hover:bg-blue-600 group-hover:text-white px-3 py-1.5 rounded-xl border border-blue-200 transition-colors shrink-0 shadow-2xs">
                    인쇄 / PDF
                  </span>
                </button>

                <button
                  onClick={() => handleDownloadTemplate('emergency')}
                  className="flex items-center justify-between p-5 bg-slate-50/60 hover:bg-red-50/60 border border-slate-200 hover:border-red-400 rounded-2xl transition-all text-left shadow-xs group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-md">차량비치필수</span>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-red-600">
                        비상연락망 및 건강·알레르기 특이사항 명부
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {activeBus ? `[${activeBus.name}] 원아 보호자 연락처 및 알레르기·기저질환 연동` : '응급상황 대비 보호자 비상연락망 및 알레르기 명부'}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-red-600 bg-white group-hover:bg-red-600 group-hover:text-white px-3 py-1.5 rounded-xl border border-red-200 transition-colors shrink-0 shadow-2xs">
                    인쇄 / PDF
                  </span>
                </button>

                <button
                  onClick={() => handleDownloadTemplate('timetable')}
                  className="flex items-center justify-between p-5 bg-slate-50/60 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-400 rounded-2xl transition-all text-left shadow-xs group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">운행필수</span>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                        호차별 운행 노선표 및 승·하차 정류장 시간표
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {activeBus ? `[${activeBus.name}] 경유 정류장 (${activeBusStudents.length}곳) 및 등·하원 예정 시각` : '운전석 비치 및 학부모 배부용 노선 시간표'}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-white group-hover:bg-emerald-600 group-hover:text-white px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors shrink-0 shadow-2xs">
                    인쇄 / PDF
                  </span>
                </button>
              </div>
            </div>

            {/* Individual Student Consent & Handover Forms (2 Legal Forms) */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-extrabold text-slate-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <span>원아별 학부모 제출 법정 동의서 서식 (2종)</span>
                </div>

                {availableStudents.length > 0 && (
                  <div className="flex items-center gap-2 bg-indigo-50/70 px-3 py-1.5 rounded-xl border border-indigo-200 text-xs">
                    <span className="text-indigo-900 font-bold">
                      동의서 대상 원생 선택:
                    </span>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="bg-white border border-indigo-200 rounded-lg px-2.5 py-1 font-bold text-slate-800 text-xs outline-none cursor-pointer"
                    >
                      {availableStudents.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.className || st.raw?.['반명'] || st.raw?.['연령'] || '원생'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleDownloadTemplate('consent')}
                  className="flex items-center justify-between p-5 bg-slate-50/60 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-400 rounded-2xl transition-all text-left shadow-xs group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">입소필수</span>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                        어린이 통학차량 이용 신청 및 안전동의서
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {activeStudent ? `[${activeStudent.name}] 원아 인적사항·탑승지 자동 연동` : '통학차량 탑승 안전수칙 보호자 서약서'}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-white group-hover:bg-indigo-600 group-hover:text-white px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors shrink-0 shadow-2xs">
                    인쇄 / PDF
                  </span>
                </button>

                <button
                  onClick={() => handleDownloadTemplate('handover')}
                  className="flex items-center justify-between p-5 bg-slate-50/60 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-400 rounded-2xl transition-all text-left shadow-xs group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">감사필수</span>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                        영유아 귀가 동의서 및 응급처치 동의서
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {activeStudent ? `[${activeStudent.name}] 지정 인계 보호자(대리인) 및 응급이송 동의서` : '하원 시 대리인 인계 확인 및 119 응급처치 위임 동의서'}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-white group-hover:bg-indigo-600 group-hover:text-white px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors shrink-0 shadow-2xs">
                    인쇄 / PDF
                  </span>
                </button>
              </div>
            </div>

            {/* Print Note */}
            <div className="text-[11px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 leading-relaxed">
              <strong>작성 안내</strong>: [인쇄 / PDF] 버튼을 누르면 A4 표준 법정 서식으로 자동 조판된 인쇄 미리보기가 열립니다. 날짜(당일)와 호차·원생·알레르기 정보는 DB에서 자동 기입되며, 점검 체크란 및 보호자 서명란은 법적 효력을 위해 현장 수기 작성용 양식으로 인쇄됩니다.
            </div>
          </div>
        )}

        {/* Registered Documents Vault Section */}
        {activeSubTab === 'documents' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">

          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="서류명, 파일명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Quick Drag & Drop Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (fileInputRef.current) fileInputRef.current.click();
          }}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
              : 'border-slate-300 hover:border-blue-400 bg-white/70 hover:bg-blue-50/30'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              handleFileSelect(e);
              if (e.target.files && e.target.files[0]) {
                setShowUploadModal(true);
              }
            }}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="text-sm font-bold text-slate-700">
              여기로 서류 파일을 끌어다 놓거나 <span className="text-blue-600 underline">파일을 선택</span>하세요
            </div>
            <div className="text-xs text-slate-400">
              PDF, HWP, 엑셀(XLSX), 워드, 이미지 등 모든 행정 서류 지원 (브라우저 로컬 저장)
            </div>
          </div>
        </div>

        {/* Document List */}
        {isLoading ? (
          <div className="text-center py-16 text-slate-400 text-sm">서류 목록을 불러오는 중...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <h3 className="text-base font-bold text-slate-700 mb-1">등록된 서류가 없습니다</h3>
            <p className="text-xs text-slate-500 mb-4">
              새로운 서류를 업로드하거나 상단의 필수 법정 서식을 다운로드하여 사용해보세요.
            </p>
            <button
              onClick={() => {
                setUploadFile(null);
                setUploadTitle('');
                setShowUploadModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              서류 등록하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      onClick={() => handleOpenPreview(doc)}
                      className="flex items-center gap-3 min-w-0 cursor-pointer group/title"
                      title="클릭하여 서류 미리보기"
                    >
                      {getFileIcon(doc.fileName)}
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block mb-1">
                          {doc.category}
                        </span>
                        <h3 className="font-bold text-sm text-slate-800 group-hover/title:text-blue-600 transition-colors leading-snug break-all" title={doc.title}>
                          {doc.title}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(doc)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1 shrink-0"
                      title="서류 삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl mb-4">
                    <div className="flex flex-col gap-0.5 border-b border-slate-200/60 pb-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold">파일명:</span>
                      <span className="font-medium text-slate-800 break-all text-xs leading-relaxed" title={doc.fileName}>
                        {doc.fileName}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">용량:</span>
                      <span className="font-medium text-slate-700">{formatFileSize(doc.fileSize)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">등록일:</span>
                      <span className="font-medium text-slate-700">
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('ko-KR') : '-'}
                      </span>
                    </div>
                    {doc.expiryDate && (
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                        <span className="text-slate-400 font-semibold">만료일정:</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${calculateDday(doc.expiryDate).bg} ${calculateDday(doc.expiryDate).color} ${calculateDday(doc.expiryDate).border}`}>
                          {doc.expiryDate} ({calculateDday(doc.expiryDate).label})
                        </span>
                      </div>
                    )}
                    {doc.note && (
                      <div className="pt-1 text-[11px] text-slate-600 border-t border-slate-200/60 break-all leading-relaxed">
                        {doc.note}
                      </div>
                    )}
                    {doc.expiryDate && calculateDday(doc.expiryDate).status === 'expired' && (
                      <button
                        type="button"
                        onClick={() => {
                          alert(`[재갱신 요청 알림 발송 완료]\n'${doc.title}' 서류의 유효기간이 지났습니다.\n해당 서류 담당 기사 및 동승 지도교사에게 갱신 요청 푸시가 전송되었습니다.\n(*교사에게는 관할 교육청/국가 갱신 공문이 선행 발송됩니다.)`);
                        }}
                        className="w-full mt-2 py-1.5 px-2 bg-red-100 hover:bg-red-200 text-red-700 font-black text-[11px] rounded-lg border border-red-300 transition-colors flex items-center justify-center gap-1"
                      >
                        담당 기사·교사에게 갱신 알림 전송
                      </button>
                    )}
                  </div>
                </div>

                {/* Preview & Download Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenPreview(doc)}
                    className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    미리보기
                  </button>
                  <button
                    onClick={() => downloadDocument(doc)}
                    className="flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        )}
      </div>


      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-800">
                서류 등록하기
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">서류 파일 선택 *</label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-xl p-1"
                />
                {uploadFile && (
                  <div className="text-[11px] text-blue-600 mt-1 font-medium break-all">
                    선택된 파일: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">서류 명칭 *</label>
                <input
                  type="text"
                  placeholder="예: 2026년 10월 통학버스 안전점검표"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">서류 분류 *</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="registration">학원 등록 문서 (입학원서, 등록신청서 등)</option>
                  <option value="vehicle_consent">차량이용 동의서 (통학차량 이용 및 인수인계)</option>
                  <option value="privacy">개인정보동의서 (개인정보 수집 및 활용동의)</option>
                  <option value="driver_location">기사 위치정보·자격 증명 (운전면허, 적성검사, 위치수집)</option>
                  <option value="accounting">회계문서 (수납영수증, 지출증빙, 급여대장 등)</option>
                  <option value="declaration">신고문서 (경찰서 어린이통학버스 신고필증 등)</option>
                  <option value="etc">기타 서류 (공문, 일반 증명서 등)</option>
                </select>
              </div>

              {/* OCR Automatic Expiry Date Parsing */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                    <span>만료일자 / 갱신 예정일 (OCR 자동 설정)</span>
                    {ocrDetectedDate && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md border border-emerald-300">
                        OCR 인식 성공
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={handleOcrAutoExtract}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs hover:bg-blue-50 transition-colors"
                  >
                    OCR 날짜 자동 인식
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={uploadExpiryDate}
                    onChange={(e) => setUploadExpiryDate(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {uploadExpiryDate && (
                    <span className={`text-[10px] font-extrabold px-2 py-1 rounded-md border shrink-0 ${calculateDday(uploadExpiryDate).bg} ${calculateDday(uploadExpiryDate).color} ${calculateDday(uploadExpiryDate).border}`}>
                      {calculateDday(uploadExpiryDate).label} ({calculateDday(uploadExpiryDate).badge})
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-blue-700/80 leading-normal">
                  * 서류 내 날짜가 포함된 경우 자동으로 읽어와 만료일을 설정합니다. (만료 2달 전 주의, 1달 전 만료 임박 알림)
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">메모 / 설명 (선택)</label>
                <textarea
                  rows={2}
                  placeholder="서류 관련 참고 사항이나 메모를 입력하세요."
                  value={uploadNote}
                  onChange={(e) => setUploadNote(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {isSubmitting ? '등록 중...' : '서류 등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legal Expiry Edit Modal */}
      {editingBusExpiry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[2100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-800">
                  {editingBusExpiry.name || editingBusExpiry.busNumber} 만료일 설정
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  차량번호: <strong>{editingBusExpiry.plateNumber || '미등록'}</strong> | 
                  기사: <strong>{editingBusExpiry.driverName || '미지정'}</strong> | 
                  동승자: <strong>{editingBusExpiry.teacherName || '미지정'}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditingBusExpiry(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExpirySubmit} className="space-y-4">
              {/* 1. Automobile Insurance */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">
                    자동차 종합보험 만료일 (의무)
                  </label>
                  {expiryFormData.insuranceExpiry && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                        calculateDday(expiryFormData.insuranceExpiry).bg
                      } ${calculateDday(expiryFormData.insuranceExpiry).color} ${
                        calculateDday(expiryFormData.insuranceExpiry).border
                      }`}
                    >
                      {calculateDday(expiryFormData.insuranceExpiry).label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={expiryFormData.insuranceExpiry}
                    onChange={(e) =>
                      setExpiryFormData({ ...expiryFormData, insuranceExpiry: e.target.value })
                    }
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickExtend('insuranceExpiry', 1)}
                    className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-xl border border-blue-200 shrink-0 transition-colors"
                  >
                    +1년 갱신
                  </button>
                </div>
              </div>

              {/* 2. Safety Inspection */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">
                    정기안전검사 / 신고필증 갱신일
                  </label>
                  {expiryFormData.inspectionExpiry && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                        calculateDday(expiryFormData.inspectionExpiry).bg
                      } ${calculateDday(expiryFormData.inspectionExpiry).color} ${
                        calculateDday(expiryFormData.inspectionExpiry).border
                      }`}
                    >
                      {calculateDday(expiryFormData.inspectionExpiry).label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={expiryFormData.inspectionExpiry}
                    onChange={(e) =>
                      setExpiryFormData({ ...expiryFormData, inspectionExpiry: e.target.value })
                    }
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickExtend('inspectionExpiry', 0, 6)}
                    className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-xl border border-blue-200 shrink-0 transition-colors"
                  >
                    +6개월
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickExtend('inspectionExpiry', 1)}
                    className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-xl border border-blue-200 shrink-0 transition-colors"
                  >
                    +1년
                  </button>
                </div>
              </div>

              {/* 3. Driver Safety Education */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">
                    운전자 안전교육 만료일 (도로교통공단 2년 주기)
                  </label>
                  {expiryFormData.driverEduExpiry && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                        calculateDday(expiryFormData.driverEduExpiry).bg
                      } ${calculateDday(expiryFormData.driverEduExpiry).color} ${
                        calculateDday(expiryFormData.driverEduExpiry).border
                      }`}
                    >
                      {calculateDday(expiryFormData.driverEduExpiry).label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={expiryFormData.driverEduExpiry}
                    onChange={(e) =>
                      setExpiryFormData({ ...expiryFormData, driverEduExpiry: e.target.value })
                    }
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickExtend('driverEduExpiry', 2)}
                    className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-xl border border-indigo-200 shrink-0 transition-colors"
                  >
                    +2년 (법정주기)
                  </button>
                </div>
              </div>

              {/* 4. Companion Safety Education */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">
                    동승보호자 안전교육 만료일 (2년 주기)
                  </label>
                  {expiryFormData.companionEduExpiry && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                        calculateDday(expiryFormData.companionEduExpiry).bg
                      } ${calculateDday(expiryFormData.companionEduExpiry).color} ${
                        calculateDday(expiryFormData.companionEduExpiry).border
                      }`}
                    >
                      {calculateDday(expiryFormData.companionEduExpiry).label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={expiryFormData.companionEduExpiry}
                    onChange={(e) =>
                      setExpiryFormData({ ...expiryFormData, companionEduExpiry: e.target.value })
                    }
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickExtend('companionEduExpiry', 2)}
                    className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-xl border border-indigo-200 shrink-0 transition-colors"
                  >
                    +2년 (법정주기)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBusExpiry(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-98"
                >
                  만료일 저장 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {getFileIcon(previewDoc.fileName)}
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
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(previewType === 'pdf' || previewType === 'image' || previewType === 'text') && (
                  <button
                    onClick={() => previewDocumentInNewTab(previewDoc)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                    title="새 탭에서 크게 열기 및 인쇄"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    새 창으로 열기
                  </button>
                )}
                <button
                  onClick={() => downloadDocument(previewDoc)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  파일 다운로드
                </button>
                <button
                  onClick={handleClosePreview}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors text-lg font-bold ml-1"
                  title="닫기"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
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
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                    {getFileIcon(previewDoc.fileName)}
                  </div>
                  <h4 className="text-base font-extrabold text-slate-800 mb-1.5">
                    브라우저 직접 미리보기를 지원하지 않는 형식입니다
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-5">
                    한글(HWP), 엑셀(XLSX), 워드(DOCX) 등의 전용 문서 파일은 아래 버튼을 눌러 다운로드한 후 전용 프로그램에서 열람해주세요.<br />
                    <span className="text-[11px] text-slate-400">(PDF, JPG/PNG 이미지, TXT/CSV 파일은 즉시 미리보기가 지원됩니다.)</span>
                  </p>
                  <button
                    onClick={() => downloadDocument(previewDoc)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {previewDoc.fileName} 다운로드
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 1. Photo OCR Student Registration Modal */}
      {showPhotoIntakeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[2250] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  OCR
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-800">원서 사진 분석 - 신규 원아 등록</h3>
                  <p className="text-[11px] text-slate-500">종이 등록원서에서 추출된 정보를 확인 후 등록하세요.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPhotoIntakeModal(false);
                  setIntakePhotoFile(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 py-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>원서 사진 인식 성공! 등록 시 사진은 '학원 등록 문서'에 자동 보관됩니다.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">원아 성명 *</label>
                <input
                  type="text"
                  value={intakeFormData.name}
                  onChange={(e) => setIntakeFormData({ ...intakeFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">생년월일</label>
                  <input
                    type="date"
                    value={intakeFormData.birthDate}
                    onChange={(e) => setIntakeFormData({ ...intakeFormData, birthDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">성별</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['남', '여'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setIntakeFormData({ ...intakeFormData, gender: g })}
                        className={`py-2 text-xs font-extrabold rounded-xl border transition-all ${
                          intakeFormData.gender === g
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">보호자 연락처 *</label>
                <input
                  type="text"
                  value={intakeFormData.phone}
                  onChange={(e) => setIntakeFormData({ ...intakeFormData, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">자택 주소 / 승하차 위치</label>
                <input
                  type="text"
                  value={intakeFormData.address}
                  onChange={(e) => setIntakeFormData({ ...intakeFormData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">등하원 방식 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: '셔틀이용', label: '셔틀버스 탑승' },
                    { id: '개별픽업', label: '학부모 직접 픽업' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setIntakeFormData({ ...intakeFormData, transportMode: mode.id })}
                      className={`py-2 text-xs font-black rounded-xl border transition-all ${
                        intakeFormData.transportMode === mode.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowPhotoIntakeModal(false);
                  setIntakePhotoFile(null);
                }}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmPhotoIntake}
                className="px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all active:scale-98"
              >
                신규 원아 정식 등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Fullscreen Tablet / iPad Consultation Form Modal */}
      {showPadModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[2300] p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Pad Modal Header */}
            <div className="bg-gradient-to-r from-purple-700 to-indigo-700 px-8 py-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md inline-block mb-1">
                  태블릿 전용 상담·접수 모드
                </span>
                <h2 className="text-xl font-black tracking-tight">{academyName || '학원'} 전자 입학 등록 원서</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPadModal(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Pad Modal Body */}
            <div className="p-6 sm:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Basic Info Group */}
              <div className="space-y-3 bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                <h4 className="text-xs font-black text-purple-900">1. 원아 기본 정보</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">원아 성명 *</label>
                    <input
                      type="text"
                      placeholder="예: 김민준"
                      value={padFormData.name}
                      onChange={(e) => setPadFormData({ ...padFormData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">생년월일</label>
                    <input
                      type="date"
                      value={padFormData.birthDate}
                      onChange={(e) => setPadFormData({ ...padFormData, birthDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">성별</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['남', '여'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setPadFormData({ ...padFormData, gender: g })}
                        className={`py-2.5 text-xs font-black rounded-xl border transition-all ${
                          padFormData.gender === g
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {g}아
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Guardian Info Group */}
              <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <h4 className="text-xs font-black text-indigo-900">2. 보호자 정보 및 승하차</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">보호자(학부모) 성함</label>
                    <input
                      type="text"
                      placeholder="예: 김학부"
                      value={padFormData.guardianName}
                      onChange={(e) => setPadFormData({ ...padFormData, guardianName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">휴대폰 번호 *</label>
                    <input
                      type="text"
                      placeholder="010-0000-0000"
                      value={padFormData.phone}
                      onChange={(e) => setPadFormData({ ...padFormData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">자택 주소</label>
                    <input
                      type="text"
                      placeholder="주소를 입력하세요"
                      value={padFormData.address}
                      onChange={(e) => setPadFormData({ ...padFormData, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">희망 승하차 위치 (핀/정류장)</label>
                    <input
                      type="text"
                      placeholder="예: 아파트 정문 101동 앞"
                      value={padFormData.boardingStop}
                      onChange={(e) => setPadFormData({ ...padFormData, boardingStop: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">등하원 방식 선택</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: '셔틀이용', label: '셔틀버스 이용 (기본)' },
                      { id: '개별픽업', label: '학부모 개별 픽업' }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setPadFormData({ ...padFormData, transportMode: mode.id })}
                        className={`py-2.5 text-xs font-black rounded-xl border transition-all ${
                          padFormData.transportMode === mode.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Legal Consents 3 items */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-black text-slate-800">3. 법적 필수 동의 항목</h4>
                <label className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={padFormData.consentPrivacy}
                    onChange={(e) => setPadFormData({ ...padFormData, consentPrivacy: e.target.checked })}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>[필수] 개인정보 수집 및 이용 동의 (원생 관리 및 알림 전송 목적)</span>
                </label>
                <label className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={padFormData.consentSafety}
                    onChange={(e) => setPadFormData({ ...padFormData, consentSafety: e.target.checked })}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>[필수] 통학차량 안전 수칙 및 운행 규정 준수 동의</span>
                </label>
                <label className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={padFormData.consentLocation}
                    onChange={(e) => setPadFormData({ ...padFormData, consentLocation: e.target.checked })}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>[필수] 보호자 위치기반 서비스(실시간 승하차 푸시) 활용 동의</span>
                </label>
              </div>

              {/* Signature Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800">4. 보호자 전자 서명</h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext('2d');
                        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                        setHasSignature(false);
                      }
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md"
                  >
                    서명 지우기
                  </button>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/70 p-1 relative">
                  <canvas
                    ref={canvasRef}
                    width={560}
                    height={120}
                    className="w-full h-28 bg-white rounded-xl cursor-crosshair touch-none"
                    onMouseDown={(e) => {
                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      ctx.lineWidth = 2.5;
                      ctx.lineCap = 'round';
                      ctx.strokeStyle = '#1e293b';
                      const rect = canvas.getBoundingClientRect();
                      ctx.beginPath();
                      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                      const moveHandler = (ev) => {
                        ctx.lineTo(ev.clientX - rect.left, ev.clientY - rect.top);
                        ctx.stroke();
                        setHasSignature(true);
                      };
                      const upHandler = () => {
                        window.removeEventListener('mousemove', moveHandler);
                        window.removeEventListener('mouseup', upHandler);
                      };
                      window.addEventListener('mousemove', moveHandler);
                      window.addEventListener('mouseup', upHandler);
                    }}
                    onTouchStart={(e) => {
                      const canvas = canvasRef.current;
                      if (!canvas || !e.touches[0]) return;
                      const ctx = canvas.getContext('2d');
                      ctx.lineWidth = 2.5;
                      ctx.lineCap = 'round';
                      ctx.strokeStyle = '#1e293b';
                      const rect = canvas.getBoundingClientRect();
                      const touch = e.touches[0];
                      ctx.beginPath();
                      ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                      const moveHandler = (ev) => {
                        if (!ev.touches[0]) return;
                        ctx.lineTo(ev.touches[0].clientX - rect.left, ev.touches[0].clientY - rect.top);
                        ctx.stroke();
                        setHasSignature(true);
                      };
                      const endHandler = () => {
                        window.removeEventListener('touchmove', moveHandler);
                        window.removeEventListener('touchend', endHandler);
                      };
                      window.addEventListener('touchmove', moveHandler);
                      window.addEventListener('touchend', endHandler);
                    }}
                  />
                  {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-slate-400 font-medium">
                      손가락 또는 펜으로 서명해주세요
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pad Modal Footer */}
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPadModal(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleConfirmPadIntake}
                className="px-6 py-2.5 text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md transition-all active:scale-98"
              >
                전자 원서 제출 및 원아 등록 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
