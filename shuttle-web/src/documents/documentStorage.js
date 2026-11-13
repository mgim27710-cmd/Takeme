// IndexedDB storage utility for Takeme Document Management

const DB_NAME = 'TakemeDocumentDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('academyId', 'academyId', { unique: false });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocument({ academyId, educationLevel, title, category, file, note = '', uploadedBy = '관리자' }) {
  const db = await openDB();
  const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const currentEdu = educationLevel || localStorage.getItem('takeme_selected_education_level') || '유치원';

  const docRecord = {
    id,
    academyId: academyId || 'default',
    educationLevel: currentEdu,
    title: title || file.name,
    category: category || '기타서류',
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    note,
    fileBlob: file, // IndexedDB natively supports storing File/Blob
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.add(docRecord);

    req.onsuccess = () => {
      window.dispatchEvent(new CustomEvent('takeme_docs_changed'));
      resolve(docRecord);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDocuments(academyId, educationLevel) {
  const db = await openDB();
  const currentEdu = educationLevel || localStorage.getItem('takeme_selected_education_level') || '유치원';
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const allDocs = req.result || [];
      // 1. 교육 부문(educationLevel) 격리 필터
      const eduFiltered = allDocs.filter(d => {
        const docEdu = d.educationLevel || '유치원';
        return docEdu === currentEdu;
      });

      // 2. 기관 ID(academyId) 필터
      if (!academyId || academyId === 'all') {
        resolve(eduFiltered.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)));
      } else {
        const filtered = eduFiltered.filter(d => String(d.academyId) === String(academyId) || d.academyId === 'default');
        resolve(filtered.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)));
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDocument(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => {
      window.dispatchEvent(new CustomEvent('takeme_docs_changed'));
      resolve(true);
    };
    req.onerror = () => reject(req.error);
  });
}

export function downloadDocument(doc) {
  if (!doc || !doc.fileBlob) {
    alert('다운로드할 파일 데이터가 없습니다.');
    return;
  }
  const url = URL.createObjectURL(doc.fileBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.fileName || `${doc.title}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function previewDocumentInNewTab(doc) {
  if (!doc || !doc.fileBlob) {
    alert('미리보기할 파일 데이터가 없습니다.');
    return;
  }
  const ext = (doc.fileName || '').split('.').pop().toLowerCase();
  let blob = doc.fileBlob;
  if (ext === 'pdf' && blob.type !== 'application/pdf') {
    blob = new Blob([blob], { type: 'application/pdf' });
  } else if (['jpg', 'jpeg'].includes(ext) && !blob.type.startsWith('image/')) {
    blob = new Blob([blob], { type: 'image/jpeg' });
  } else if (ext === 'png' && !blob.type.startsWith('image/')) {
    blob = new Blob([blob], { type: 'image/png' });
  }
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    alert('팝업 차단이 감지되었습니다. 브라우저에서 팝업을 허용해주세요.');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// --------------------------------------------------------------------------
// 교육 · 보험 · 신고증명서 만료일 알림 관리 시스템
// --------------------------------------------------------------------------

export function getExpiryStorageKey(educationLevel) {
  const currentEdu = educationLevel || localStorage.getItem('takeme_selected_education_level') || '유치원';
  return `takeme_legal_expiry_records_${currentEdu}`;
}

/**
 * 모든 호차의 만료일 레코드를 불러옵니다. (학제별 격리)
 */
export function getExpiryRecords(educationLevel) {
  const key = getExpiryStorageKey(educationLevel);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const defaults = generateDefaultExpiryRecords();
      localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('만료일 정보 로드 실패:', err);
    return {};
  }
}

/**
 * 특정 호차의 만료일 레코드를 저장합니다. (학제별 격리)
 */
export function saveExpiryRecord(busId, record, educationLevel) {
  const key = getExpiryStorageKey(educationLevel);
  try {
    const records = getExpiryRecords(educationLevel);
    records[String(busId)] = {
      ...(records[String(busId)] || {}),
      ...record,
      busId: String(busId),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent('takeme_expiry_changed'));
    return records[String(busId)];
  } catch (err) {
    console.error('만료일 정보 저장 실패:', err);
    throw err;
  }
}

/**
 * D-Day 상태와 일수, 뱃지 색상을 과학적이고 명확하게 계산합니다.
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {{ days: number|null, status: 'expired'|'urgent'|'warning'|'safe'|'empty', label: string, color: string, bg: string, border: string }}
 */
export function calculateDday(dateStr) {
  if (!dateStr) {
    return {
      days: null,
      status: 'empty',
      label: '미등록',
      color: 'text-slate-400',
      bg: 'bg-slate-100',
      border: 'border-slate-200',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      days: diffDays,
      status: 'expired',
      label: `만료 (+${Math.abs(diffDays)}일)`,
      color: 'text-red-700',
      bg: 'bg-red-100',
      border: 'border-red-300',
      badge: '만료',
    };
  }
  // 1달 전(D-30 이하): 만료 임박 (urgent)
  if (diffDays <= 30) {
    return {
      days: diffDays,
      status: 'urgent',
      label: diffDays === 0 ? 'D-Day (오늘 만료)' : `D-${diffDays}`,
      color: 'text-rose-700',
      bg: 'bg-rose-100',
      border: 'border-rose-300',
      badge: '만료 임박 (1달 이내)',
    };
  }
  // 2달 전(D-60 이하): 주의 (warning)
  if (diffDays <= 60) {
    return {
      days: diffDays,
      status: 'warning',
      label: `D-${diffDays}`,
      color: 'text-amber-700',
      bg: 'bg-amber-100',
      border: 'border-amber-300',
      badge: '갱신 주의 (2달 이내)',
    };
  }
  return {
    days: diffDays,
    status: 'safe',
    label: `D-${diffDays}`,
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    badge: '정상',
  };
}

/**
 * 전체 호차의 만료 현황을 종합 분석합니다. (학제별 격리)
 */
export function getOverallExpirySummary(buses = [], educationLevel) {
  const records = getExpiryRecords(educationLevel);
  const summary = {
    totalBuses: buses.length,
    urgentCount: 0,   // 만료 또는 D-7 이내
    warningCount: 0,  // D-30 이내
    safeCount: 0,
    urgentItems: [],  // 긴급 알림 배너에 노출할 항목들
  };

  const fields = [
    { key: 'insuranceExpiry', label: '자동차 종합보험' },
    { key: 'inspectionExpiry', label: '정기안전검사/신고필증' },
    { key: 'driverEduExpiry', label: '운전자 안전교육' },
    { key: 'companionEduExpiry', label: '동승보호자 안전교육' },
  ];

  buses.forEach((bus) => {
    const busId = String(bus.id);
    const busRecord = records[busId] || {};
    const busName = bus.name || bus.busNumber || `${busId}호차`;

    fields.forEach((f) => {
      const dateStr = busRecord[f.key];
      const dday = calculateDday(dateStr);

      if (dday.status === 'expired' || dday.status === 'urgent') {
        summary.urgentCount += 1;
        summary.urgentItems.push({
          busId,
          busName,
          fieldKey: f.key,
          fieldLabel: f.label,
          dateStr,
          dday,
        });
      } else if (dday.status === 'warning') {
        summary.warningCount += 1;
      } else if (dday.status === 'safe') {
        summary.safeCount += 1;
      }
    });
  });

  // 긴급 항목은 가장 촉박한 순으로 정렬
  summary.urgentItems.sort((a, b) => (a.dday.days ?? 999) - (b.dday.days ?? 999));

  return summary;
}

/**
 * 2달 전부터 주의, 1달 전 만료 임박, 2주 전 매일/2달~2주 주 1회 알림 규칙 판별
 * @param {string} dateStr 'YYYY-MM-DD'
 */
export function getExpiryNotificationSchedule(dateStr) {
  const dday = calculateDday(dateStr);
  if (dday.status === 'empty') {
    return { shouldNotify: false, frequency: 'none', reason: '미등록', dday };
  }

  const days = dday.days;

  // 1. 만료 후 또는 만료 2주 전(14일 이내): 매일 알림
  if (days <= 14) {
    return {
      shouldNotify: true,
      frequency: 'daily',
      frequencyLabel: '매일 알림',
      intervalDays: 1,
      urgency: days < 0 ? 'expired' : 'urgent',
      urgencyLabel: days < 0 ? '만료 경과' : '만료 임박 (2주 이내)',
      dday,
    };
  }

  // 2. 만료 2달 전부터 2주 전까지(15일 ~ 60일): 일주일에 1번 알림
  if (days <= 60) {
    return {
      shouldNotify: true,
      frequency: 'weekly',
      frequencyLabel: '주 1회 알림',
      intervalDays: 7,
      urgency: days <= 30 ? 'urgent' : 'warning',
      urgencyLabel: days <= 30 ? '만료 임박 (1달 이내)' : '주의 (2달 이내)',
      dday,
    };
  }

  // 3. 2달 초과(61일 이상): 정상 (알림 미발송)
  return {
    shouldNotify: false,
    frequency: 'none',
    frequencyLabel: '알림 없음 (정상)',
    intervalDays: 0,
    urgency: 'safe',
    urgencyLabel: '정상',
    dday,
  };
}

const STAFF_NOTIFICATIONS_KEY = 'takeme_staff_notifications';

/**
 * 호차 정보를 바탕으로 기사 및 교사 앱으로 발송될 알림 메시지를 생성하고 동기화합니다.
 * @param {Array} buses 호차 목록
 * @returns {{ driverNotifications: Array, teacherNotifications: Array, allCount: number }}
 */
export function syncStaffExpiryNotifications(buses = [], educationLevel) {
  const records = getExpiryRecords(educationLevel);
  const driverNotifications = [];
  const teacherNotifications = [];

  buses.forEach((bus) => {
    const busId = String(bus.id);
    const busName = bus.name || bus.busNumber || `${busId}호차`;
    const plate = bus.plateNumber || '차량번호 미등록';
    const driverName = bus.driverName || '기사님';
    const teacherName = bus.teacherName || '동승교사';
    const busRecord = records[busId] || {};

    const items = [
      {
        key: 'insuranceExpiry',
        label: '자동차 종합보험',
        targetRoles: ['driver', 'teacher'],
        dateStr: busRecord.insuranceExpiry,
      },
      {
        key: 'inspectionExpiry',
        label: '정기안전검사/신고필증',
        targetRoles: ['driver', 'teacher'],
        dateStr: busRecord.inspectionExpiry,
      },
      {
        key: 'driverEduExpiry',
        label: '운전자 안전교육',
        targetRoles: ['driver'],
        dateStr: busRecord.driverEduExpiry,
      },
      {
        key: 'companionEduExpiry',
        label: '동승보호자 안전교육',
        targetRoles: ['teacher'],
        dateStr: busRecord.companionEduExpiry,
      },
    ];

    items.forEach((item) => {
      const schedule = getExpiryNotificationSchedule(item.dateStr);
      if (!schedule.shouldNotify) return;

      const dday = schedule.dday;
      const days = dday.days;
      let titlePrefix = '';
      if (schedule.urgency === 'expired') {
        titlePrefix = `[법정서류 만료 (+${Math.abs(days)}일)]`;
      } else if (days <= 14) {
        titlePrefix = `[긴급 매일알림 D-${days}]`;
      } else if (days <= 30) {
        titlePrefix = `[만료임박 주간알림 D-${days}]`;
      } else {
        titlePrefix = `[주의 주간알림 D-${days}]`;
      }

      const message = `${titlePrefix} ${busName}(${plate}) ${item.label} 만료일(${item.dateStr})이 ${dday.label}입니다. 서류 갱신 및 이수를 확인해주세요.`;

      const notiObject = {
        id: `noti_${busId}_${item.key}_${Date.now()}`,
        busId,
        busName,
        plateNumber: plate,
        itemKey: item.key,
        itemLabel: item.label,
        expiryDate: item.dateStr,
        daysRemaining: days,
        frequency: schedule.frequency,
        frequencyLabel: schedule.frequencyLabel,
        urgency: schedule.urgency,
        urgencyLabel: schedule.urgencyLabel,
        titlePrefix,
        message,
        createdAt: new Date().toISOString(),
      };

      if (item.targetRoles.includes('driver')) {
        driverNotifications.push({
          ...notiObject,
          targetRole: 'driver',
          targetName: driverName,
        });
      }
      if (item.targetRoles.includes('teacher')) {
        teacherNotifications.push({
          ...notiObject,
          targetRole: 'teacher',
          targetName: teacherName,
        });
      }
    });
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    driverNotifications,
    teacherNotifications,
  };

  try {
    localStorage.setItem(STAFF_NOTIFICATIONS_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('takeme_staff_notifications_updated', { detail: payload }));
  } catch (e) {
    console.error('기사/교사 알림 저장 실패:', e);
  }

  return {
    driverNotifications,
    teacherNotifications,
    allCount: driverNotifications.length + teacherNotifications.length,
  };
}

/**
 * 기사용/교사용으로 생성된 만료 알림 목록을 조회합니다.
 */
export function getStaffNotifications(role = 'all') {
  try {
    const raw = localStorage.getItem(STAFF_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (role === 'driver') return parsed.driverNotifications || [];
    if (role === 'teacher') return parsed.teacherNotifications || [];
    return [...(parsed.driverNotifications || []), ...(parsed.teacherNotifications || [])];
  } catch (err) {
    return [];
  }
}


