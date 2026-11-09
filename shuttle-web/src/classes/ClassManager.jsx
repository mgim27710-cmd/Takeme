import React, { useState, useMemo, useEffect, useRef } from 'react';

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

  // Filtered Class Names by search keyword and Age category tab
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
      return true;
    });
  }, [allClassNames, classSearchKeyword, selectedClassAgeTab, classAgeMap]);

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

  // Effective Unassigned Students
  const unassignedStudents = useMemo(() => {
    return effectiveStudents.filter(st => {
      const cls = (st.raw?.['반명'] || st.raw?.['반'] || '').trim();
      return !cls || cls === '미배정' || !allClassNames.includes(cls);
    });
  }, [effectiveStudents, allClassNames]);

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

  // Group assigned students by class
  const classStudentMap = useMemo(() => {
    const map = {};
    allClassNames.forEach(c => {
      map[c] = [];
    });
    effectiveStudents.forEach(st => {
      const cls = (st.raw?.['반명'] || st.raw?.['반'] || '').trim();
      if (cls && map[cls]) {
        map[cls].push(st);
      }
    });
    return map;
  }, [allClassNames, effectiveStudents]);

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

      {/* Top Bar Header */}
      <div className="bg-white px-8 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs shrink-0 z-10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-800">
              반 관리 및 분반 / 교사 배정
            </h1>
            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              총 {allClassNames.length}개 반 개설됨
            </span>
            {hasUnsavedChanges && (
              <span className="text-xs font-extrabold px-3 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                변경 대기 {unsavedCount}건
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            원아들을 나이별·성별로 분류하고, 원하는 반으로 드래그하여 배정한 후 <strong>[변경사항 저장]</strong> 버튼을 눌러 확정하세요.
          </p>
        </div>

        {/* Quick Stats Pills & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
            <span className="text-slate-500">원아 현황:</span>
            <span className="text-blue-700">배정 {effectiveStudents.length - unassignedStudents.length}명</span>
            <span className="text-slate-300">|</span>
            <span className="text-amber-700">미배정 {unassignedStudents.length}명</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 font-normal">남 {unassignedStats.male} / 여 {unassignedStats.female}</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
            <span className="text-slate-500">교사 현황:</span>
            <span className="text-emerald-700">담임 배정 {teachers.filter(t => t.assignedClass).length}명</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">미배정 {teachers.filter(t => !t.assignedClass).length}명</span>
          </div>

          {/* Save Changes Button (Always present in top bar) */}
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

      {/* Action Sub-Bar: 새 반 개설 폼 (반 대상 나이 선택) & 반 나이별 탭 & 검색 */}
      <div className="bg-white/90 backdrop-blur-xs px-8 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        
        {/* 새 반 만들기 (반 이름 + 나이 설정 버튼) */}
        <form onSubmit={handleCreateClass} className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <div className="relative w-44">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="새 반 이름 (예: 햇살반)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>

          {/* 반 대상 나이 선택 버튼 그룹 */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 px-1">나이:</span>
            {AGE_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setNewClassAge(opt)}
                className={`px-2 py-1 rounded-lg text-[11px] font-black transition-all ${
                  newClassAge === opt
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!newClassName.trim() || isProcessing}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1 disabled:opacity-50 shrink-0"
          >
            <span>+ 개설</span>
          </button>
        </form>

        {/* 반 나이별 필터 탭 (Class Age Filter Tabs) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
          <span className="text-[11px] text-slate-400 px-2 font-bold">반 분류:</span>
          <button
            type="button"
            onClick={() => setSelectedClassAgeTab('ALL')}
            className={`px-3 py-1.5 rounded-xl transition ${
              selectedClassAgeTab === 'ALL'
                ? 'bg-white text-blue-900 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            전체 반 ({allClassNames.length})
          </button>
          {AGE_OPTIONS.map(opt => {
            const count = allClassNames.filter(c => (classAgeMap[c] || '혼합반') === opt).length;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedClassAgeTab(opt)}
                className={`px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 ${
                  selectedClassAgeTab === opt
                    ? 'bg-white text-blue-900 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{opt}반</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedClassAgeTab === opt ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Inputs */}
        <div className="flex items-center gap-2">
          {/* 반 이름 검색 */}
          <div className="relative w-44">
            <input
              type="text"
              value={classSearchKeyword}
              onChange={(e) => setClassSearchKeyword(e.target.value)}
              placeholder="반 검색..."
              className="w-full pl-7 pr-6 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {classSearchKeyword && (
              <button
                type="button"
                onClick={() => setClassSearchKeyword('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* 원아 검색 */}
          <div className="relative w-52">
            <input
              type="text"
              value={globalStudentSearch}
              onChange={(e) => setGlobalStudentSearch(e.target.value)}
              placeholder="원아 검색 (이름/연락처)..."
              className="w-full pl-7 pr-6 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {globalStudentSearch && (
              <button
                type="button"
                onClick={() => setGlobalStudentSearch('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
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
                <div className="p-4 bg-slate-50/90 rounded-t-3xl border-b border-slate-200 shrink-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-black text-slate-900 text-base">{className}</h3>
                          
                          {/* Class Target Age Selector Dropdown */}
                          <select
                            value={currentClassAge}
                            onChange={(e) => updateClassAge(className, e.target.value)}
                            className="text-[11px] font-black bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-1.5 py-0.5 cursor-pointer hover:bg-blue-100 transition"
                            title="반 대상 나이 변경"
                          >
                            {AGE_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}반</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                        {classStudents.length}명
                      </span>
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

    </div>
  );
}
