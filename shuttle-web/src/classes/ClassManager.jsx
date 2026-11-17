import React, { useState, useMemo, useEffect, useCallback } from 'react';

import { formatTeacherName } from '../utils/teacherUtil';
import { API_BASE_URL } from '../config';

// Age parsing helper
export function getStudentAge(st) {
  if (!st) return '미입력';
  const raw = typeof st.raw === 'object' && st.raw ? st.raw : {};
  let val = raw['연령'] ?? raw['나이'] ?? raw['학년'] ?? '';
  if (val !== undefined && val !== null && String(val).trim()) {
    const s = String(val).trim();
    if (s.endsWith('세') || s.endsWith('학년')) return s;
    if (!isNaN(Number(s))) return `${s}세`;
    return s;
  }
  const b = st.birthDate || raw['생년월일'] || raw['생일'];
  if (b && String(b).length >= 4) {
    const year = parseInt(String(b).slice(0, 4), 10);
    if (!isNaN(year) && year > 1900) {
      const currentYear = new Date().getFullYear();
      const age = currentYear - year + 1;
      if (age >= 1 && age <= 19) return `${age}세`;
    }
  }
  return '미입력';
}

// Gender parsing helper
export function getStudentGender(st) {
  if (!st) return '미입력';
  const raw = typeof st.raw === 'object' && st.raw ? st.raw : {};
  const g = String(raw['성별'] || raw['성'] || '').trim();
  if (g.startsWith('남') || g.toLowerCase() === 'm' || g.toLowerCase() === 'male') return '남';
  if (g.startsWith('여') || g.toLowerCase() === 'f' || g.toLowerCase() === 'female') return '여';
  return '미입력';
}

const AGE_OPTIONS = ['3세', '4세', '5세', '6세', '7세', '혼합반'];
const WEEKDAY_OPTIONS = ['월', '화', '수', '목', '금', '토'];

export const CLASS_TYPE_OPTIONS = [
  { id: 'MORNING', name: '오전(정규)반', time: '09:00 ~ 14:30', desc: '정규 하원 세션 기준', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'FULL_DAY', name: '종일반', time: '09:00 ~ 19:30', desc: '종일반 하원 세션 기준', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'AFTERNOON', name: '방과후반', time: '14:30 ~ 16:30', desc: '방과후 하원 세션 기준', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' },
];

const DEFAULT_OPERATING_SESSIONS = [
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

export default function ClassManager({
  academyId,
  academy,
  currentUser,
  students = [],
  setStudents,
  teachers = [],
  setTeachers,
  availableClasses = [],
  customClasses = [],
  setCustomClasses,
  onRefreshData,
  isClosing,
  onClose,
  onDirtyChange,
}) {
  // New Class Form State
  const [newClassName, setNewClassName] = useState('');
  const [newClassAge, setNewClassAge] = useState('5세');

  // Search & Filter States
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [classSearchKeyword, setClassSearchKeyword] = useState('');
  const [globalStudentSearch, setGlobalStudentSearch] = useState('');
  
  // Class age filter tab (전체, 3세반, 4세반, 5세반, 6세반, 7세반, 혼합반)
  const [selectedClassAgeTab, setSelectedClassAgeTab] = useState('ALL');

  // Unassigned pool age & gender filter
  const [unassignedAgeFilter, setUnassignedAgeFilter] = useState('ALL');
  const [unassignedGenderFilter, setUnassignedGenderFilter] = useState('ALL');

  // Selection for bulk move
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState([]);
  const [bulkTargetClass, setBulkTargetClass] = useState('');

  // Drag and drop state
  const [dragOverClass, setDragOverClass] = useState(null); // className or '__UNASSIGNED__'
  const [draggingStudentId, setDraggingStudentId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Staged changes: { [studentId]: targetClassName }
  // When targetClassName === '', it means unassigned.
  const [stagedAssignments, setStagedAssignments] = useState({});

  // Operating schedule sessions state (정규하원, 방과후하원, 종일반)
  const [scheduleSessions, setScheduleSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('takeme_academy_schedule_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_OPERATING_SESSIONS;
  });

  // Modal for editing operating schedule sessions
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [tempScheduleSessions, setTempScheduleSessions] = useState([]);

  // Day filter state ('ALL', '월', '화', '수', '목', '금', '토')
  const [selectedDayFilter, setSelectedDayFilter] = useState('ALL');

  // Synchronize schedule settings if changed in other views
  useEffect(() => {
    const handleSync = (e) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setScheduleSessions(e.detail);
      } else {
        try {
          const saved = localStorage.getItem('takeme_academy_schedule_settings');
          if (saved) setScheduleSessions(JSON.parse(saved));
        } catch (_) {}
      }
    };
    window.addEventListener('takeme_schedule_settings_changed', handleSync);
    return () => window.removeEventListener('takeme_schedule_settings_changed', handleSync);
  }, []);

  // Class Age metadata: { [className]: '3세' | '4세' | '5세' | '6세' | '7세' | '혼합반' }
  const [classAgeMap, setClassAgeMap] = useState(() => {
    try {
      const saved = localStorage.getItem(`takeme_class_ages_${academyId || 'default'}`);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      '새싹반': '3세',
      '풀잎반': '4세',
      '햇살반': '5세',
      '열매반': '6세',
      '바다반': '7세',
      '하늘반': '7세',
    };
  });

  // Save class ages to localStorage
  const updateClassAge = (className, age) => {
    setClassAgeMap(prev => {
      const updated = { ...prev, [className]: age };
      try {
        localStorage.setItem(`takeme_class_ages_${academyId || 'default'}`, JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  // Class Type metadata: { [className]: 'MORNING' | 'FULL_DAY' | 'AFTERNOON' }
  const [classTypeMap, setClassTypeMap] = useState(() => {
    try {
      const saved = localStorage.getItem(`takeme_class_types_${academyId || 'default'}`);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      '새싹반': 'MORNING',
      '풀잎반': 'MORNING',
      '햇살반': 'MORNING',
      '열매반': 'FULL_DAY',
      '바다반': 'FULL_DAY',
      '하늘반': 'AFTERNOON',
    };
  });

  const updateClassType = (className, type) => {
    setClassTypeMap(prev => {
      const updated = { ...prev, [className]: type };
      try {
        localStorage.setItem(`takeme_class_types_${academyId || 'default'}`, JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  // Filter tabs for Class Type
  const [selectedClassTypeTab, setSelectedClassTypeTab] = useState('ALL'); // 'ALL' | 'MORNING' | 'FULL_DAY' | 'AFTERNOON'

  // Dedicated Card Cell Modal for Creating and Editing Classes
  const [classModal, setClassModal] = useState({
    isOpen: false,
    mode: 'CREATE', // 'CREATE' | 'EDIT'
    targetClassName: '',
    name: '',
    age: '5세',
    type: 'MORNING',
    teacherId: '',
  });

  const openCreateClassModal = () => {
    setClassModal({
      isOpen: true,
      mode: 'CREATE',
      targetClassName: '',
      name: '',
      age: '5세',
      type: 'MORNING',
      teacherId: '',
    });
  };

  const openEditClassModal = (className) => {
    const teacher = (teachers || []).find(t => t.assignedClass && t.assignedClass.trim() === className.trim());
    setClassModal({
      isOpen: true,
      mode: 'EDIT',
      targetClassName: className,
      name: className,
      age: classAgeMap[className] || '5세',
      type: classTypeMap[className] || 'MORNING',
      teacherId: teacher?.id ? String(teacher.id) : '',
    });
  };

  const closeClassModal = () => {
    setClassModal(prev => ({ ...prev, isOpen: false }));
  };

  // Combine custom classes and any classes found in students or teachers
  const allClassNames = useMemo(() => {
    const set = new Set();
    (customClasses || []).forEach(c => {
      if (c && String(c).trim()) set.add(String(c).trim());
    });
    (students || []).forEach(st => {
      const cls = st.raw?.['반명'] || st.raw?.['반'] || '';
      if (cls && String(cls).trim() && cls !== '미배정') set.add(String(cls).trim());
    });
    (teachers || []).forEach(t => {
      if (t.assignedClass && String(t.assignedClass).trim() && t.assignedClass !== '미배정') {
        set.add(String(t.assignedClass).trim());
      }
    });
    if (set.size === 0) {
      ['새싹반', '햇살반', '열매반'].forEach(c => set.add(c));
    }
    return Array.from(set).sort();
  }, [customClasses, students, teachers]);

  // Compute effective students based on original students + stagedAssignments
  const effectiveStudents = useMemo(() => {
    return (students || []).map(st => {
      if (stagedAssignments[st.id] !== undefined) {
        const newClass = stagedAssignments[st.id];
        const rawObj = typeof st.raw === 'object' && st.raw ? { ...st.raw } : {};
        rawObj['반명'] = newClass;
        rawObj['반'] = newClass;
        return {
          ...st,
          raw: rawObj,
          className: newClass,
          _isStaged: true,
          _stagedClass: newClass,
        };
      }
      return st;
    });
  }, [students, stagedAssignments]);

  // Count unsaved changes
  const unsavedCount = useMemo(() => {
    return Object.keys(stagedAssignments).length;
  }, [stagedAssignments]);

  const hasUnsavedChanges = unsavedCount > 0;

  // Notify parent component about unsaved changes (navigation guard)
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(hasUnsavedChanges);
    }
  }, [hasUnsavedChanges, onDirtyChange]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '저장되지 않은 반배정 변경사항이 있습니다. 나가시겠습니까?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Filtered Class Names by search keyword, Age category tab, and Class Type tab
  const filteredClassNames = useMemo(() => {
    return allClassNames.filter(c => {
      if (classSearchKeyword.trim()) {
        const kw = classSearchKeyword.trim().toLowerCase();
        if (!c.toLowerCase().includes(kw)) return false;
      }
      if (selectedClassAgeTab !== 'ALL') {
        const age = classAgeMap[c] || '혼합반';
        if (age !== selectedClassAgeTab) return false;
      }
      if (selectedClassTypeTab !== 'ALL') {
        const type = classTypeMap[c] || 'MORNING';
        if (type !== selectedClassTypeTab) return false;
      }
      return true;
    });
  }, [allClassNames, classSearchKeyword, selectedClassAgeTab, selectedClassTypeTab, classAgeMap, classTypeMap]);

  // Search filter for students
  const matchesStudentSearch = (st) => {
    if (!globalStudentSearch.trim()) return true;
    const q = globalStudentSearch.trim().toLowerCase();
    const name = (st.name || '').toLowerCase();
    const phone = (st.phone || st.raw?.['부모연락처'] || st.raw?.['보호자연락처'] || st.raw?.['학부모전화번호'] || '').toLowerCase();
    const age = getStudentAge(st).toLowerCase();
    const gender = getStudentGender(st).toLowerCase();
    return name.includes(q) || phone.includes(q) || age.includes(q) || gender.includes(q);
  };

  // Set default bulk target class
  useEffect(() => {
    if (allClassNames.length > 0 && !bulkTargetClass) {
      setBulkTargetClass(allClassNames[0]);
    }
  }, [allClassNames, bulkTargetClass]);

  // Determine if a student attends on a specific day
  const isStudentAttendingOnDay = useCallback((st, day) => {
    if (!day || day === 'ALL') return true;
    const raw = typeof st?.raw === 'object' && st.raw ? st.raw : {};

    // 1. Check explicit raw day column if present
    const rawDayVal = raw['등원요일'] || raw['운영요일'] || raw['요일'] || raw['등하원요일'] || raw['출석요일'] || st?.operatingDays || '';
    if (rawDayVal && String(rawDayVal).trim()) {
      return String(rawDayVal).includes(day);
    }

    // 2. Check matching session based on departureType / 하원구분
    const depType = String(st?.departureType || raw['하원구분'] || raw['구분'] || raw['반형태'] || raw['등하원구분'] || '').trim().toLowerCase();

    let matchedSession = null;
    if (depType.includes('종일')) {
      matchedSession = scheduleSessions.find(s => s.isFullDay || (s.name && s.name.includes('종일')));
    } else if (depType.includes('방과후')) {
      matchedSession = scheduleSessions.find(s => s.id === 'after_drop' || (s.name && s.name.includes('방과후')));
    } else if (depType.includes('정규')) {
      matchedSession = scheduleSessions.find(s => s.id === 'reg_drop' || (s.name && s.name.includes('정규')));
    }

    if (matchedSession && Array.isArray(matchedSession.days) && matchedSession.days.length > 0) {
      return matchedSession.days.includes(day);
    }

    // 3. Fallback: Standard Monday to Friday attendance
    return ['월', '화', '수', '목', '금'].includes(day);
  }, [scheduleSessions]);

  // Day-filtered effective students
  const dayFilteredStudents = useMemo(() => {
    if (selectedDayFilter === 'ALL') return effectiveStudents;
    return effectiveStudents.filter(st => isStudentAttendingOnDay(st, selectedDayFilter));
  }, [effectiveStudents, selectedDayFilter, isStudentAttendingOnDay]);

  // Effective Unassigned Students (day-filtered)
  const unassignedStudents = useMemo(() => {
    return dayFilteredStudents.filter(st => {
      const cls = (st.raw?.['반명'] || st.raw?.['반'] || '').trim();
      return !cls || cls === '미배정' || !allClassNames.includes(cls);
    });
  }, [dayFilteredStudents, allClassNames]);

  // Filtered Unassigned Students by search keyword, age, and gender
  const filteredUnassignedStudents = useMemo(() => {
    return unassignedStudents.filter(st => {
      if (!matchesStudentSearch(st)) return false;

      if (unassignedSearch.trim()) {
        const kw = unassignedSearch.trim().toLowerCase();
        const name = (st.name || '').toLowerCase();
        const phone = (st.phone || st.raw?.['부모연락처'] || st.raw?.['보호자연락처'] || st.raw?.['학부모전화번호'] || '').toLowerCase();
        if (!name.includes(kw) && !phone.includes(kw)) return false;
      }

      if (unassignedAgeFilter !== 'ALL') {
        const age = getStudentAge(st);
        if (unassignedAgeFilter === 'OTHER') {
          if (['3세', '4세', '5세', '6세', '7세'].includes(age)) return false;
        } else {
          if (!age.includes(unassignedAgeFilter.replace('세', ''))) return false;
        }
      }

      if (unassignedGenderFilter !== 'ALL') {
        const gender = getStudentGender(st);
        if (gender !== unassignedGenderFilter) return false;
      }

      return true;
    });
  }, [unassignedStudents, unassignedSearch, globalStudentSearch, unassignedAgeFilter, unassignedGenderFilter]);

  // Unassigned breakdown stats (Total, Male, Female, Ages)
  const unassignedStats = useMemo(() => {
    let male = 0;
    let female = 0;
    const ageCount = {};
    unassignedStudents.forEach(st => {
      const g = getStudentGender(st);
      if (g === '남') male++;
      else if (g === '여') female++;
      const a = getStudentAge(st);
      ageCount[a] = (ageCount[a] || 0) + 1;
    });
    return { male, female, ageCount };
  }, [unassignedStudents]);

  // Group assigned students by class (day-filtered)
  const classStudentMap = useMemo(() => {
    const map = {};
    allClassNames.forEach(c => {
      map[c] = [];
    });
    dayFilteredStudents.forEach(st => {
      const cls = (st.raw?.['반명'] || st.raw?.['반'] || '').trim();
      if (cls && map[cls]) {
        map[cls].push(st);
      }
    });
    return map;
  }, [allClassNames, dayFilteredStudents]);

  // Map of homeroom teacher for each class
  const classTeacherMap = useMemo(() => {
    const map = {};
    allClassNames.forEach(c => {
      map[c] = (teachers || []).find(t => t.assignedClass && t.assignedClass.trim() === c.trim()) || null;
    });
    return map;
  }, [allClassNames, teachers]);

  // 1. Create a New Class with Assigned Age
  const handleCreateClass = (e) => {
    e?.preventDefault();
    const trimmed = newClassName.trim();
    if (!trimmed) {
      alert('개설할 반 이름을 입력해 주세요.');
      return;
    }
    if (allClassNames.includes(trimmed)) {
      alert(`이미 존재하는 반 이름입니다: [${trimmed}]`);
      return;
    }

    const updated = Array.from(new Set([...customClasses, trimmed]));
    setCustomClasses(updated);
    try {
      localStorage.setItem(`takeme_custom_classes_${academyId || 'default'}`, JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }

    // Save target age for this class
    updateClassAge(trimmed, newClassAge);

    setNewClassName('');
    alert(`[${trimmed}] (${newClassAge}반)이(가) 성공적으로 개설되었습니다.`);
  };

  // Dedicated Card Cell Modal Save Handler (creates or edits class)
  const handleSaveClassModal = async (e) => {
    e?.preventDefault();
    const trimmedName = (classModal.name || '').trim();
    if (!trimmedName) {
      alert('반 명칭을 입력해 주세요.');
      return;
    }

    const { mode, targetClassName, age, type, teacherId } = classModal;

    if (mode === 'CREATE') {
      if (allClassNames.includes(trimmedName)) {
        alert(`이미 존재하는 반 이름입니다: [${trimmedName}]`);
        return;
      }

      // Add to custom classes
      const updated = Array.from(new Set([...customClasses, trimmedName]));
      setCustomClasses(updated);
      try {
        localStorage.setItem(`takeme_custom_classes_${academyId || 'default'}`, JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }

      // Save Age & Type
      updateClassAge(trimmedName, age || '5세');
      updateClassType(trimmedName, type || 'MORNING');

      // Assign Teacher if selected
      if (teacherId) {
        await handleAssignTeacherToClass(trimmedName, teacherId);
      }

      closeClassModal();
      alert(`[${trimmedName}] 반이 성공적으로 개설되었습니다.`);
    } else {
      // EDIT MODE
      setIsProcessing(true);
      try {
        // Did name change?
        if (targetClassName !== trimmedName) {
          if (allClassNames.includes(trimmedName)) {
            alert(`이미 존재하는 다른 반 이름입니다: [${trimmedName}]`);
            setIsProcessing(false);
            return;
          }

          // Rename in custom classes
          const updatedCustom = customClasses.map(c => (c === targetClassName ? trimmedName : c));
          if (!updatedCustom.includes(trimmedName)) updatedCustom.push(trimmedName);
          setCustomClasses(updatedCustom);
          try {
            localStorage.setItem(`takeme_custom_classes_${academyId || 'default'}`, JSON.stringify(updatedCustom));
          } catch (err) {
            console.error(err);
          }

          // Migrate age and type maps
          setClassAgeMap(prev => {
            const next = { ...prev };
            delete next[targetClassName];
            next[trimmedName] = age || '5세';
            try {
              localStorage.setItem(`takeme_class_ages_${academyId || 'default'}`, JSON.stringify(next));
            } catch (_) {}
            return next;
          });

          setClassTypeMap(prev => {
            const next = { ...prev };
            delete next[targetClassName];
            next[trimmedName] = type || 'MORNING';
            try {
              localStorage.setItem(`takeme_class_types_${academyId || 'default'}`, JSON.stringify(next));
            } catch (_) {}
            return next;
          });

          // Move existing students from targetClassName to trimmedName in backend & state
          const studentsInTarget = (students || []).filter(s => {
            const c = (s.raw?.['반명'] || s.raw?.['반'] || '').trim();
            return c === targetClassName;
          });

          if (studentsInTarget.length > 0) {
            const sIds = studentsInTarget.map(s => s.id);
            await fetch(`${API_BASE_URL}/routing/students/assign-class`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ studentIds: sIds, className: trimmedName })
            }).catch(e => console.warn(e));

            setStudents(prev => prev.map(st => {
              if (sIds.includes(st.id)) {
                const rawObj = typeof st.raw === 'object' && st.raw ? { ...st.raw } : {};
                rawObj['반명'] = trimmedName;
                rawObj['반'] = trimmedName;
                return { ...st, raw: rawObj, className: trimmedName };
              }
              return st;
            }));
          }

          // Move staged assignments from targetClassName to trimmedName
          setStagedAssignments(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => {
              if (next[k] === targetClassName) next[k] = trimmedName;
            });
            return next;
          });

          // Update teacher assignment
          await handleAssignTeacherToClass(trimmedName, teacherId);
        } else {
          // Name unchanged: just update age, type, teacher
          updateClassAge(trimmedName, age || '5세');
          updateClassType(trimmedName, type || 'MORNING');
          const currentTeacher = classTeacherMap[trimmedName];
          const currId = currentTeacher?.id ? String(currentTeacher.id) : '';
          if (currId !== String(teacherId || '')) {
            await handleAssignTeacherToClass(trimmedName, teacherId);
          }
        }

        closeClassModal();
        alert(`[${trimmedName}] 반 정보가 성공적으로 수정되었습니다.`);
        if (onRefreshData) onRefreshData();
      } catch (err) {
        console.error('Update class error:', err);
        alert('반 정보 수정 중 오류가 발생했습니다.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // 2. Delete Class
  const handleDeleteClass = async (classNameToDelete) => {
    const assignedCount = classStudentMap[classNameToDelete]?.length || 0;
    const teacher = classTeacherMap[classNameToDelete];
    const confirmMsg = assignedCount > 0
      ? `[${classNameToDelete}] 에 속한 원아 ${assignedCount}명이 모두 '미배정' 상태로 변경됩니다. 정말 삭제하시겠습니까?`
      : `[${classNameToDelete}] 을(를) 삭제하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      // Unassign students from backend & state
      if (assignedCount > 0) {
        const studentIds = classStudentMap[classNameToDelete].map(s => s.id);
        await fetch(`${API_BASE_URL}/routing/students/assign-class`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentIds, className: '' })
        }).catch(err => console.warn(err));

        setStudents(prev => prev.map(st => {
          if (studentIds.includes(st.id)) {
            const rawObj = typeof st.raw === 'object' && st.raw ? { ...st.raw } : {};
            rawObj['반명'] = '';
            rawObj['반'] = '';
            return { ...st, raw: rawObj };
          }
          return st;
        }));
      }

      // Unassign teacher if assigned
      if (teacher) {
        await fetch(`${API_BASE_URL}/routing/teacher/assign-class`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherId: teacher.id, assignedClass: '' })
        }).catch(err => console.warn(err));

        setTeachers(prev => prev.map(t => (t.id === teacher.id ? { ...t, assignedClass: '' } : t)));
      }

      // Remove from custom classes
      const updated = customClasses.filter(c => c !== classNameToDelete);
      setCustomClasses(updated);
      try {
        localStorage.setItem(`takeme_custom_classes_${academyId || 'default'}`, JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
    } catch (e) {
      console.error('Delete class failed', e);
      alert('반 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
      if (onRefreshData) onRefreshData();
    }
  };

  // 3. Stage student assignment (Local change without saving immediately)
  const handleStageAssignStudent = (studentId, targetClass) => {
    const finalClass = (targetClass || '').trim();
    const originalStudent = (students || []).find(s => s.id === studentId);
    const originalClass = (originalStudent?.raw?.['반명'] || originalStudent?.raw?.['반'] || '').trim();

    setStagedAssignments(prev => {
      // If moving back to original class, remove from staged
      if (finalClass === originalClass) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return {
        ...prev,
        [studentId]: finalClass,
      };
    });
  };

  // 4. Bulk Stage selected unassigned students
  const handleBulkStageAssign = () => {
    if (selectedUnassignedIds.length === 0) {
      alert('이동할 원아를 선택해 주세요.');
      return;
    }
    if (!bulkTargetClass) {
      alert('배정할 반을 선택해 주세요.');
      return;
    }

    setStagedAssignments(prev => {
      const next = { ...prev };
      selectedUnassignedIds.forEach(id => {
        const originalStudent = (students || []).find(s => s.id === id);
        const originalClass = (originalStudent?.raw?.['반명'] || originalStudent?.raw?.['반'] || '').trim();
        if (bulkTargetClass === originalClass) {
          delete next[id];
        } else {
          next[id] = bulkTargetClass;
        }
      });
      return next;
    });

    setSelectedUnassignedIds([]);
  };

  // 5. Save all staged changes to backend
  const handleSaveAllChanges = async () => {
    if (!hasUnsavedChanges) return;

    setIsProcessing(true);
    try {
      // Group studentIds by target class
      const classToStudentIds = {};
      Object.entries(stagedAssignments).forEach(([sIdStr, targetCls]) => {
        const sId = Number(sIdStr);
        if (!classToStudentIds[targetCls]) {
          classToStudentIds[targetCls] = [];
        }
        classToStudentIds[targetCls].push(sId);
      });

      // Execute batch updates
      const promises = Object.entries(classToStudentIds).map(([targetCls, ids]) => {
        return fetch(`${API_BASE_URL}/routing/students/assign-class`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentIds: ids, className: targetCls })
        });
      });

      await Promise.all(promises);

      // Commit to parent students state
      setStudents(effectiveStudents.map(st => {
        const clean = { ...st };
        delete clean._isStaged;
        delete clean._stagedClass;
        return clean;
      }));

      const count = unsavedCount;
      setStagedAssignments({});
      if (onDirtyChange) onDirtyChange(false);

      alert(`반배정 변경사항 ${count}건이 안전하게 저장되었습니다.`);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to save class assignments', err);
      alert('반배정 저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Discard all staged changes (원복)
  const handleDiscardChanges = () => {
    if (!hasUnsavedChanges) return;
    if (window.confirm('저장하지 않은 반배정 변경사항을 모두 취소하고 처음 상태로 되돌리시겠습니까?')) {
      setStagedAssignments({});
      if (onDirtyChange) onDirtyChange(false);
    }
  };

  // 7. Assign Teacher to Class
  const handleAssignTeacherToClass = async (className, teacherIdStr) => {
    const teacherId = teacherIdStr ? Number(teacherIdStr) : null;
    setIsProcessing(true);

    try {
      if (!teacherId) {
        const currentTeacher = classTeacherMap[className];
        if (currentTeacher) {
          await fetch(`${API_BASE_URL}/routing/teacher/assign-class`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId: currentTeacher.id, assignedClass: '' })
          });
          setTeachers(prev => prev.map(t => (t.id === currentTeacher.id ? { ...t, assignedClass: '' } : t)));
        }
      } else {
        const prevTeacher = classTeacherMap[className];
        if (prevTeacher && prevTeacher.id !== teacherId) {
          await fetch(`${API_BASE_URL}/routing/teacher/assign-class`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId: prevTeacher.id, assignedClass: '' })
          }).catch(err => console.warn(err));
        }

        await fetch(`${API_BASE_URL}/routing/teacher/assign-class`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherId, assignedClass: className })
        });

        setTeachers(prev => prev.map(t => {
          if (t.id === teacherId) return { ...t, assignedClass: className };
          if (prevTeacher && t.id === prevTeacher.id) return { ...t, assignedClass: '' };
          return t;
        }));
      }
    } catch (e) {
      console.error('Assign teacher failed', e);
      alert('교사 배정 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
      if (onRefreshData) onRefreshData();
    }
  };

  // 8. Drag and Drop handlers
  const handleDragStart = (e, studentId) => {
    e.dataTransfer.setData('text/plain', String(studentId));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingStudentId(studentId);
  };

  const handleDragEnd = () => {
    setDraggingStudentId(null);
    setDragOverClass(null);
  };

  const handleDragOver = (e, targetName) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverClass !== targetName) {
      setDragOverClass(targetName);
    }
  };

  const handleDragLeave = () => {
    setDragOverClass(null);
  };

  const handleDrop = (e, targetClass) => {
    e.preventDefault();
    setDragOverClass(null);
    setDraggingStudentId(null);
    const studentIdStr = e.dataTransfer.getData('text/plain');
    if (!studentIdStr) return;
    const studentId = Number(studentIdStr);
    handleStageAssignStudent(studentId, targetClass === '__UNASSIGNED__' ? '' : targetClass);
  };

  // Safe close button handler with dirty check
  const handleCloseClick = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        `저장되지 않은 반배정 변경사항이 ${unsavedCount}건 있습니다.\n저장하지 않고 창을 닫으시겠습니까?`
      );
      if (!confirmLeave) return;
      setStagedAssignments({});
      if (onDirtyChange) onDirtyChange(false);
    }
    if (onClose) onClose();
  };

  return (
    <div className={`absolute inset-0 z-[2000] flex flex-col bg-slate-100 h-full overflow-hidden transition-all duration-300 ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      
      {/* ================= STICKY DIRTY WARNING / SAVE BAR ================= */}
      {hasUnsavedChanges && (
        <div className="bg-amber-500 text-white px-8 py-2.5 flex flex-wrap items-center justify-between gap-4 shadow-md shrink-0 z-30 animate-fade-in">
          <div className="flex items-center gap-2.5 text-xs font-black">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
            <svg className="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              저장되지 않은 반배정 변경사항이 <strong className="underline underline-offset-2">{unsavedCount}건</strong> 있습니다. 변경사항 저장을 눌러야 최종 반영됩니다.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition"
            >
              변경 취소 (원복)
            </button>
            <button
              type="button"
              onClick={handleSaveAllChanges}
              disabled={isProcessing}
              className="px-4 py-1.5 bg-white hover:bg-slate-50 text-amber-900 text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
            >
              <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>변경사항 저장하기 ({unsavedCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TIER 1: MAIN HEADER & PRIMARY ACTIONS ================= */}
      <div className="bg-white px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0 z-10">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-800 tracking-tight">
                반 관리 및 분반 / 교사 배정
              </h1>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                총 {allClassNames.length}개 반
              </span>
              {hasUnsavedChanges && (
                <span className="text-[11px] font-black px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-300 animate-pulse">
                  저장 대기 {unsavedCount}건
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              원아들을 원하는 반으로 드래그하여 배정하고, 반별 운영 형태(종일반/오전반)와 담임교사를 설정합니다.
            </p>
          </div>

          {/* Quick Stat Badges */}
          <div className="hidden xl:flex items-center gap-2 bg-slate-50/90 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-400 font-bold text-[11px]">원아:</span>
            <span className="font-extrabold text-blue-700">배정 {effectiveStudents.length - unassignedStudents.length}명</span>
            <span className="text-slate-300">/</span>
            <span className="font-extrabold text-amber-700">미배정 {unassignedStudents.length}명</span>
            <span className="text-slate-400 text-[11px] font-medium">(남 {unassignedStats.male} · 여 {unassignedStats.female})</span>
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-slate-400 font-bold text-[11px]">교사:</span>
            <span className="font-extrabold text-emerald-700">담임 {teachers.filter(t => t.assignedClass).length}명</span>
            <span className="text-slate-300">/</span>
            <span className="font-extrabold text-slate-600">미배정 {teachers.filter(t => !t.assignedClass).length}명</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Operating Sessions Button (with active chip overview) */}
          <button
            type="button"
            onClick={() => {
              setTempScheduleSessions(JSON.parse(JSON.stringify(scheduleSessions)));
              setIsScheduleModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 transition flex items-center gap-1.5 active:scale-95"
            title="운영 세션(정규/방과후/종일반) 시작·종료 시간 및 차량 출발 시점 설정"
          >
            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>운영 세션·시간표 설정</span>
            <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full">
              {scheduleSessions.length}개
            </span>
          </button>

          {/* New Class Modal Trigger Button */}
          <button
            type="button"
            onClick={openCreateClassModal}
            className="px-3.5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow-indigo-500/20 transition flex items-center gap-1.5 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ 새 반 개설</span>
          </button>

          {/* Save Changes Button */}
          <button
            type="button"
            onClick={handleSaveAllChanges}
            disabled={!hasUnsavedChanges || isProcessing}
            className={`px-4 py-2 rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5 ${
              hasUnsavedChanges
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            title={hasUnsavedChanges ? '변경사항 최종 저장' : '저장할 변경사항이 없습니다'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>변경사항 저장 {hasUnsavedChanges ? `(${unsavedCount})` : ''}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={handleCloseClick}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              title="닫기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ================= TIER 2: UNIFIED FILTER & SEARCH CONTROL STRIP ================= */}
      <div className="bg-slate-50/95 backdrop-blur-xs px-6 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs shadow-2xs">
        {/* Left: Operating Day Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black text-slate-700 flex items-center gap-1 shrink-0">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            등원 요일:
          </span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedDayFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${
                selectedDayFilter === 'ALL'
                  ? 'bg-blue-600 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              전체 ({effectiveStudents.length})
            </button>
            {WEEKDAY_OPTIONS.map(day => {
              const count = effectiveStudents.filter(st => isStudentAttendingOnDay(st, day)).length;
              const isSelected = selectedDayFilter === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDayFilter(day)}
                  className={`px-2 py-1 rounded-lg text-xs transition flex items-center gap-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{day}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-slate-300 mx-1 hidden lg:block" />

          {/* Class Type Filter Tabs (반 구분: 전체, 오전(정규)반, 종일반, 방과후반) */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs font-bold">
            <span className="text-[11px] text-slate-400 px-1 font-bold">운영:</span>
            <button
              type="button"
              onClick={() => setSelectedClassTypeTab('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${
                selectedClassTypeTab === 'ALL'
                  ? 'bg-slate-800 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              전체
            </button>
            {CLASS_TYPE_OPTIONS.map(opt => {
              const count = allClassNames.filter(c => (classTypeMap[c] || 'MORNING') === opt.id).length;
              const isSelected = selectedClassTypeTab === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedClassTypeTab(opt.id)}
                  className={`px-2 py-1 rounded-lg text-xs transition flex items-center gap-1 ${
                    isSelected
                      ? 'bg-slate-800 text-white font-black shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{opt.name}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-slate-300 mx-1 hidden lg:block" />

          {/* Class Age Filter Tabs (반 연령: 전체, 3세~7세, 혼합반) */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs font-bold">
            <span className="text-[11px] text-slate-400 px-1 font-bold">연령:</span>
            <button
              type="button"
              onClick={() => setSelectedClassAgeTab('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${
                selectedClassAgeTab === 'ALL'
                  ? 'bg-blue-600 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              전체
            </button>
            {AGE_OPTIONS.map(opt => {
              const count = allClassNames.filter(c => (classAgeMap[c] || '혼합반') === opt).length;
              const isSelected = selectedClassAgeTab === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedClassAgeTab(opt)}
                  className={`px-2 py-1 rounded-lg text-xs transition flex items-center gap-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white font-black shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{opt}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Class & Student Search */}
        <div className="flex items-center gap-2">
          {/* 반 검색 */}
          <div className="relative w-36">
            <input
              type="text"
              value={classSearchKeyword}
              onChange={(e) => setClassSearchKeyword(e.target.value)}
              placeholder="반 이름 검색..."
              className="w-full pl-7 pr-5 py-1 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-2xs"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {classSearchKeyword && (
              <button
                type="button"
                onClick={() => setClassSearchKeyword('')}
                className="absolute right-2 top-1 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* 원아 검색 */}
          <div className="relative w-44">
            <input
              type="text"
              value={globalStudentSearch}
              onChange={(e) => setGlobalStudentSearch(e.target.value)}
              placeholder="원아 검색 (이름/연락처)..."
              className="w-full pl-7 pr-5 py-1 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-2xs"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {globalStudentSearch && (
              <button
                type="button"
                onClick={() => setGlobalStudentSearch('')}
                className="absolute right-2 top-1 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Kanban Workspace Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 lg:p-8">
        <div className="flex gap-6 h-full items-start min-w-max pb-4">
          
          {/* ================= COLUMN 1: 미배정 원아 풀 (Unassigned Pool with Age & Gender classification) ================= */}
          <div
            onDragOver={(e) => handleDragOver(e, '__UNASSIGNED__')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, '__UNASSIGNED__')}
            className={`w-96 h-full flex flex-col rounded-3xl bg-slate-50 border-2 transition-all shadow-xs ${
              dragOverClass === '__UNASSIGNED__'
                ? 'border-amber-500 bg-amber-50/60 scale-[1.01]'
                : 'border-slate-300/80 hover:border-slate-400'
            }`}
          >
            {/* Header */}
            <div className="p-4 bg-white rounded-t-3xl border-b border-slate-200/80 shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <h3 className="font-extrabold text-slate-900 text-sm">미배정 원아 풀</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                    {unassignedStudents.length}명
                  </span>
                </div>
              </div>

              {/* Age & Gender Breakdown Pill Banner */}
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    남아 {unassignedStats.male}명
                  </span>
                  <span className="text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded border border-pink-200">
                    여아 {unassignedStats.female}명
                  </span>
                </div>
                <span className="text-slate-400 text-[10px]">
                  {Object.entries(unassignedStats.ageCount)
                    .slice(0, 3)
                    .map(([a, c]) => `${a}:${c}`)
                    .join(' ')}
                </span>
              </div>

              {/* Filter Tabs: 나이별 & 성별 선택 */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                {/* 1. 나이 필터 */}
                <div className="flex items-center gap-1 text-[11px] font-bold overflow-x-auto pb-0.5">
                  <span className="text-slate-400 text-[10px] shrink-0">나이:</span>
                  <button
                    type="button"
                    onClick={() => setUnassignedAgeFilter('ALL')}
                    className={`px-2 py-0.5 rounded-lg transition shrink-0 ${
                      unassignedAgeFilter === 'ALL' ? 'bg-amber-500 text-white font-black' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    전체
                  </button>
                  {['3세', '4세', '5세', '6세', '7세'].map(age => (
                    <button
                      key={age}
                      type="button"
                      onClick={() => setUnassignedAgeFilter(age)}
                      className={`px-2 py-0.5 rounded-lg transition shrink-0 ${
                        unassignedAgeFilter === age ? 'bg-amber-500 text-white font-black' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {age}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setUnassignedAgeFilter('OTHER')}
                    className={`px-1.5 py-0.5 rounded-lg transition shrink-0 ${
                      unassignedAgeFilter === 'OTHER' ? 'bg-amber-500 text-white font-black' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    기타
                  </button>
                </div>

                {/* 2. 성별 필터 */}
                <div className="flex items-center gap-1 text-[11px] font-bold">
                  <span className="text-slate-400 text-[10px] shrink-0">성별:</span>
                  <button
                    type="button"
                    onClick={() => setUnassignedGenderFilter('ALL')}
                    className={`px-2 py-0.5 rounded-lg transition ${
                      unassignedGenderFilter === 'ALL' ? 'bg-blue-600 text-white font-black' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnassignedGenderFilter('남')}
                    className={`px-2 py-0.5 rounded-lg transition flex items-center gap-1 ${
                      unassignedGenderFilter === '남' ? 'bg-blue-600 text-white font-black' : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                    }`}
                  >
                    <span>남아</span>
                    <span className="text-[10px]">({unassignedStats.male})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnassignedGenderFilter('여')}
                    className={`px-2 py-0.5 rounded-lg transition flex items-center gap-1 ${
                      unassignedGenderFilter === '여' ? 'bg-pink-600 text-white font-black' : 'text-pink-700 bg-pink-50 hover:bg-pink-100'
                    }`}
                  >
                    <span>여아</span>
                    <span className="text-[10px]">({unassignedStats.female})</span>
                  </button>
                </div>
              </div>

              {/* Bulk Move Controls */}
              {unassignedStudents.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs">
                  <label className="flex items-center gap-1.5 text-slate-600 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filteredUnassignedStudents.length > 0 && selectedUnassignedIds.length === filteredUnassignedStudents.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUnassignedIds(filteredUnassignedStudents.map(s => s.id));
                        } else {
                          setSelectedUnassignedIds([]);
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>전체 선택 ({filteredUnassignedStudents.length})</span>
                  </label>

                  {selectedUnassignedIds.length > 0 && (
                    <div className="flex items-center gap-1">
                      <select
                        value={bulkTargetClass}
                        onChange={(e) => setBulkTargetClass(e.target.value)}
                        className="text-[11px] font-bold px-1.5 py-1 bg-white border border-slate-300 rounded-lg max-w-[100px]"
                      >
                        {allClassNames.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleBulkStageAssign}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] shadow-xs shrink-0"
                      >
                        이동 ({selectedUnassignedIds.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Students List in Unassigned */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredUnassignedStudents.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-xs font-bold">조건에 맞는 미배정 원아가 없습니다.</p>
                  <p className="text-[11px] mt-1">필터를 변경하거나 원아를 검색해보세요.</p>
                </div>
              ) : (
                filteredUnassignedStudents.map(st => {
                  const isSelected = selectedUnassignedIds.includes(st.id);
                  const isDragging = draggingStudentId === st.id;
                  const gender = getStudentGender(st);
                  const age = getStudentAge(st);
                  const phone = st.phone || st.raw?.['부모연락처'] || st.raw?.['보호자연락처'] || st.raw?.['학부모전화번호'] || '';
                  const isStaged = st._isStaged;

                  return (
                    <div
                      key={st.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, st.id)}
                      onDragEnd={handleDragEnd}
                      className={`p-3 bg-white rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none shadow-xs hover:shadow-md hover:border-blue-400 ${
                        isDragging ? 'opacity-40 border-dashed border-blue-400' : 'border-slate-200'
                      } ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''} ${
                        isStaged ? 'border-amber-400 bg-amber-50/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedUnassignedIds(prev =>
                                prev.includes(st.id) ? prev.filter(id => id !== st.id) : [...prev, st.id]
                              );
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                            gender === '남' ? 'bg-blue-100 text-blue-700' : gender === '여' ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {st.name?.[0] || '원'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-extrabold text-slate-900 text-xs">{st.name}</h4>
                              {gender && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                  gender === '남' ? 'bg-blue-100 text-blue-700 border border-blue-200' : gender === '여' ? 'bg-pink-100 text-pink-700 border border-pink-200' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {gender === '남' ? '남아' : gender === '여' ? '여아' : gender}
                                </span>
                              )}
                              {age && (
                                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded-md border border-slate-200">
                                  {age}
                                </span>
                              )}
                              {isStaged && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                  변경 대기
                                </span>
                              )}
                            </div>
                            {phone && (
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{phone}</p>
                            )}
                          </div>
                        </div>

                        {/* Quick Assign Dropdown */}
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleStageAssignStudent(st.id, e.target.value);
                          }}
                          className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 cursor-pointer"
                        >
                          <option value="">배정 ▼</option>
                          {allClassNames.map(c => {
                            const cAge = classAgeMap[c] || '혼합반';
                            return (
                              <option key={c} value={c}>{c} ({cAge})</option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ================= COLUMNS 2..N: 개설된 반 목록 (Class Kanban Columns) ================= */}
          {filteredClassNames.map(className => {
            const allInClass = classStudentMap[className] || [];
            const classStudents = allInClass.filter(matchesStudentSearch);
            const assignedTeacher = classTeacherMap[className];
            const isDropTarget = dragOverClass === className;
            const currentClassAge = classAgeMap[className] || '5세';

            // Gender stats inside this class
            const maleCount = allInClass.filter(s => getStudentGender(s) === '남').length;
            const femaleCount = allInClass.filter(s => getStudentGender(s) === '여').length;

            return (
              <div
                key={className}
                onDragOver={(e) => handleDragOver(e, className)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, className)}
                className={`w-88 h-full flex flex-col rounded-3xl bg-white border-2 transition-all shadow-xs ${
                  isDropTarget
                    ? 'border-blue-500 bg-blue-50/40 scale-[1.01] ring-4 ring-blue-100'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Class Column Header */}
                <div className="p-3.5 bg-slate-50/90 rounded-t-3xl border-b border-slate-200 shrink-0 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div
                      onClick={() => openEditClassModal(className)}
                      className="flex items-center gap-2 cursor-pointer group flex-1 min-w-0 pr-2"
                      title="클릭하여 반 명칭, 종일/오전 운영 유형, 연령, 담임교사 수정"
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${
                        (classTypeMap[className] || 'MORNING') === 'FULL_DAY'
                          ? 'bg-amber-500 ring-2 ring-amber-200'
                          : (classTypeMap[className] || 'MORNING') === 'AFTERNOON'
                          ? 'bg-purple-500 ring-2 ring-purple-200'
                          : 'bg-blue-600 ring-2 ring-blue-200'
                      }`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-black text-slate-900 text-sm group-hover:text-blue-600 transition flex items-center gap-1 truncate">
                            <span>{className}</span>
                            <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 opacity-60 group-hover:opacity-100 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </h3>

                          {/* Class Type Badge */}
                          {(() => {
                            const cType = classTypeMap[className] || 'MORNING';
                            const opt = CLASS_TYPE_OPTIONS.find(o => o.id === cType) || CLASS_TYPE_OPTIONS[0];
                            return (
                              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md border shrink-0 ${opt.badgeClass}`}>
                                {opt.name}
                              </span>
                            );
                          })()}

                          {/* Class Age Badge */}
                          <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-md border border-slate-200 shrink-0">
                            {currentClassAge}반
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-black bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                        {classStudents.length}명
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditClassModal(className)}
                        className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition"
                        title="반 정보 및 설정 수정"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(className)}
                        className="text-slate-400 hover:text-red-500 text-xs font-bold p-1 rounded transition"
                        title="반 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Gender and Age Breakdown in this Class */}
                  <div className="flex items-center justify-between text-[11px] font-bold bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600">
                    <span className="text-slate-500">성별 구성:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700">남 {maleCount}명</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-pink-700">여 {femaleCount}명</span>
                    </div>
                  </div>

                  {/* Homeroom Teacher Selection Area */}
                  <div className="bg-white rounded-2xl p-2.5 border border-slate-200 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600">담당 담임교사:</span>
                      {assignedTeacher ? (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-md border border-emerald-200">
                          배정 완료
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">미배정</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={assignedTeacher?.id || ''}
                        onChange={(e) => handleAssignTeacherToClass(className, e.target.value)}
                        disabled={isProcessing}
                        className="flex-1 text-xs font-bold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- 담임교사 선택 --</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>
                            {formatTeacherName(t.name)} {t.assignedClass ? `(${t.assignedClass} 담임)` : '(미배정)'}
                          </option>
                        ))}
                      </select>
                      {assignedTeacher && (
                        <button
                          type="button"
                          onClick={() => handleAssignTeacherToClass(className, '')}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl text-[11px] font-bold transition"
                          title="담임 해제"
                        >
                          해제
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Class Student Cards Dropzone */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {classStudents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl m-1">
                      <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <p className="text-xs font-bold text-slate-500">배정된 원아가 없습니다</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        원아 카드를 마우스로 끌어다 놓으세요
                      </p>
                    </div>
                  ) : (
                    classStudents.map((st, idx) => {
                      const isDragging = draggingStudentId === st.id;
                      const gender = getStudentGender(st);
                      const age = getStudentAge(st);
                      const phone = st.phone || st.raw?.['부모연락처'] || st.raw?.['보호자연락처'] || st.raw?.['학부모전화번호'] || '';
                      const isStaged = st._isStaged;

                      return (
                        <div
                          key={st.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, st.id)}
                          onDragEnd={handleDragEnd}
                          className={`p-3 bg-white rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none shadow-xs hover:shadow-md hover:border-blue-400 ${
                            isDragging ? 'opacity-40 border-dashed border-blue-400' : 'border-slate-200'
                          } ${isStaged ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-200' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                                gender === '남' ? 'bg-blue-100 text-blue-700' : gender === '여' ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-extrabold text-slate-900 text-xs">{st.name}</h4>
                                  {gender && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                      gender === '남' ? 'bg-blue-100 text-blue-700 border border-blue-200' : gender === '여' ? 'bg-pink-100 text-pink-700 border border-pink-200' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {gender === '남' ? '남아' : gender === '여' ? '여아' : gender}
                                    </span>
                                  )}
                                  {age && (
                                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded-md border border-slate-200">
                                      {age}
                                    </span>
                                  )}
                                  {isStaged && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-300">
                                      변경 대기
                                    </span>
                                  )}
                                </div>
                                {phone && (
                                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{phone}</p>
                                )}
                              </div>
                            </div>

                            {/* Dropdown to move to another class or unassign */}
                            <div className="flex items-center gap-1">
                              <select
                                value={className}
                                onChange={(e) => handleStageAssignStudent(st.id, e.target.value)}
                                className="text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 cursor-pointer max-w-[85px]"
                              >
                                <option value="">미배정으로</option>
                                {allClassNames.map(c => {
                                  const cAge = classAgeMap[c] || '혼합반';
                                  return (
                                    <option key={c} value={c}>{c} ({cAge})</option>
                                  );
                                })}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleStageAssignStudent(st.id, '')}
                                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center text-xs font-bold transition"
                                title="반 배정 취소 (미배정 풀로 이동)"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operating Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 lg:p-7 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900">운영 세션 및 시간표 설정</h3>
                <p className="text-xs text-slate-500 mt-1">
                  정규하원, 방과후하원, 종일반의 시작·종료 시간, 차량 출발 시점, 종일반 여부 및 운영 요일을 설정합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {tempScheduleSessions.map((session, sIdx) => (
                <div key={session.id || sIdx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-blue-900 bg-blue-100 px-2.5 py-1 rounded-lg">
                        세션 {sIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={session.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempScheduleSessions(prev => prev.map((s, idx) => idx === sIdx ? { ...s, name: val } : s));
                        }}
                        className="text-sm font-extrabold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                      <input
                        type="checkbox"
                        checked={session.isFullDay || false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setTempScheduleSessions(prev => prev.map((s, idx) => idx === sIdx ? { ...s, isFullDay: checked } : s));
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span>종일반 여부</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">반 시작시간</label>
                      <input
                        type="time"
                        value={session.startTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempScheduleSessions(prev => prev.map((s, idx) => idx === sIdx ? { ...s, startTime: val } : s));
                        }}
                        className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">반 종료시간</label>
                      <input
                        type="time"
                        value={session.endTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempScheduleSessions(prev => prev.map((s, idx) => idx === sIdx ? { ...s, endTime: val } : s));
                        }}
                        className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">차량 출발 시점</label>
                      <input
                        type="text"
                        value={session.shuttleOffset || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempScheduleSessions(prev => prev.map((s, idx) => idx === sIdx ? { ...s, shuttleOffset: val } : s));
                        }}
                        placeholder="예: 반 시작 40분 전"
                        className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">운영 요일 선택</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {WEEKDAY_OPTIONS.map(day => {
                        const isChecked = Array.isArray(session.days) && session.days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setTempScheduleSessions(prev => prev.map((s, idx) => {
                                if (idx !== sIdx) return s;
                                const currentDays = Array.isArray(s.days) ? s.days : [];
                                const updatedDays = currentDays.includes(day)
                                  ? currentDays.filter(d => d !== day)
                                  : [...currentDays, day];
                                return { ...s, days: updatedDays };
                              }));
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition border ${
                              isChecked
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-black'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {day}요일
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setScheduleSessions(tempScheduleSessions);
                  try {
                    localStorage.setItem('takeme_academy_schedule_settings', JSON.stringify(tempScheduleSessions));
                    window.dispatchEvent(new CustomEvent('takeme_schedule_settings_changed', { detail: tempScheduleSessions }));
                  } catch (err) {
                    console.error(err);
                  }
                  setIsScheduleModalOpen(false);
                  alert('운영 세션 및 시간표 설정이 성공적으로 저장되었습니다.');
                }}
                className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
              >
                설정 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CLASS CREATE / EDIT APPROVAL-STYLE CARD CELL MODAL ================= */}
      {classModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    {classModal.mode === 'CREATE' ? '새 반 개설 신청 / 등록' : `반 정보 및 운영 설정 수정 [${classModal.targetClassName}]`}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
                    {classModal.mode === 'CREATE'
                      ? '반 명칭, 종일반/오전반 운영 유형, 대상 연령 및 담임 교사를 지정합니다.'
                      : '반의 운영 형태, 대상 연령, 명칭 및 배정 교사를 변경합니다.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeClassModal}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveClassModal} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              
              {/* Field 1: 반 명칭 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  반 명칭 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={classModal.name}
                  onChange={(e) => setClassModal(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 햇살반, 풀잎반, 사과반"
                  className="w-full px-3.5 py-2.5 text-sm font-bold border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  autoFocus
                />
              </div>

              {/* Field 2: 반 운영 유형 (종일반 vs 오전(정규)반 vs 방과후반) - Card Cells */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  운영 세션 유형 선택 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {CLASS_TYPE_OPTIONS.map(opt => {
                    const isSelected = classModal.type === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setClassModal(prev => ({ ...prev, type: opt.id }))}
                        className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? opt.id === 'FULL_DAY'
                              ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-200'
                              : opt.id === 'AFTERNOON'
                              ? 'border-purple-500 bg-purple-50/60 ring-2 ring-purple-200'
                              : 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-200'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-black ${
                            isSelected
                              ? opt.id === 'FULL_DAY' ? 'text-amber-900' : opt.id === 'AFTERNOON' ? 'text-purple-900' : 'text-blue-900'
                              : 'text-slate-700'
                          }`}>
                            {opt.name}
                          </span>
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                            isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                          }`}>
                            {isSelected && '✓'}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] font-extrabold text-slate-600 mb-1">
                          {opt.time}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {opt.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Field 3: 대상 연령 선택 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  대상 연령 그룹 선택
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {AGE_OPTIONS.map(opt => {
                    const isSelected = classModal.age === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setClassModal(prev => ({ ...prev, age: opt }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt}반
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field 4: 담당 담임교사 배정 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  담당 담임교사 배정
                </label>
                <select
                  value={classModal.teacherId}
                  onChange={(e) => setClassModal(prev => ({ ...prev, teacherId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- 미지정 (추후 배정) --</option>
                  {teachers.map(t => {
                    const isAssignedElsewhere = t.assignedClass && t.assignedClass !== classModal.targetClassName;
                    return (
                      <option key={t.id} value={t.id}>
                        {formatTeacherName(t.name)} {isAssignedElsewhere ? `(${t.assignedClass} 담임 중)` : t.assignedClass ? '(현재 담임)' : '(미배정)'}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  다른 반의 담임교사를 선택할 경우 해당 교사의 이전 반 배정은 자동으로 해제됩니다.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div>
                  {classModal.mode === 'EDIT' && (
                    <button
                      type="button"
                      onClick={() => {
                        closeClassModal();
                        handleDeleteClass(classModal.targetClassName);
                      }}
                      className="px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>반 삭제</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeClassModal}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!classModal.name.trim() || isProcessing}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow-indigo-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{classModal.mode === 'CREATE' ? '반 개설 확정' : '변경사항 저장'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
