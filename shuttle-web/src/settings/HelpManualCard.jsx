import React, { useState, useMemo } from 'react';

const GUIDE_ITEMS = [
  {
    id: 'student-excel',
    category: 'students',
    categoryLabel: '원아 관리',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    question: '원아 명단을 엑셀 파일로 한 번에 등록하려면 어떻게 하나요?',
    answer: (
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed pt-1">
        <p>
          <strong className="text-slate-900 font-bold">1단계:</strong> 좌측 사이드바 [차량 및 구역 관리] 상단의 <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-xs">엑셀 등록</span> 버튼을 클릭합니다.
        </p>
        <p>
          <strong className="text-slate-900 font-bold">2단계:</strong> 유치원/어린이집에서 사용 중인 원아 명단 엑셀(.xlsx, .xls)을 업로드합니다.
        </p>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="font-bold text-slate-800 mb-1 text-xs">📌 권장 엑셀 컬럼명:</p>
          <p className="text-xs text-slate-600 font-mono">
            원아명(이름), 반(학급), 주소(도로명주소), 학부모연락처(부모핸드폰), 등원지, 하원지
          </p>
        </div>
        <p>
          <strong className="text-slate-900 font-bold">3단계:</strong> 파일 업로드 즉시 도로명 주소가 지도 상의 정확한 위도·경도 좌표로 자동 변환(지오코딩)됩니다.
        </p>
      </div>
    )
  },
  {
    id: 'student-address-fix',
    category: 'students',
    categoryLabel: '원아 관리',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    question: "'주소필요' 빨간색 경고가 뜨는 원아는 어떻게 해결하나요?",
    answer: (
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed pt-1">
        <p>
          지번 주소, 오타, 건물명 누락으로 인해 표준 도로명 주소 변환에 실패하면 <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded text-xs">주소필요</span> 뱃지가 표시됩니다.
        </p>
        <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
          <p className="font-bold">💡 해결 절차:</p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>해당 원아 카드의 <span className="text-blue-600 font-bold underline">입력</span> 또는 <span className="font-bold">[정보 수정]</span> 버튼을 클릭합니다.</li>
            <li>팝업에서 <span className="font-bold">[주소 검색]</span>을 눌러 공식 도로명 주소를 선택합니다.</li>
            <li>저장 즉시 지도 좌표가 자동 생성되어 정상 배정 대기 상태로 전환됩니다.</li>
          </ol>
        </div>
      </div>
    )
  },
  {
    id: 'shuttle-routing',
    category: 'shuttle',
    categoryLabel: '차량 & 노선',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    question: '셔틀버스 노선 생성 및 정류장 순서는 어떻게 최적화하나요?',
    answer: (
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed pt-1">
        <p>
          <strong className="text-slate-900 font-bold">호차 선택:</strong> 사이드바 차량 목록에서 노선을 설정할 호차(1호차, 2호차 등)를 선택합니다.
        </p>
        <p>
          <strong className="text-slate-900 font-bold">AI 자동 경로 생성:</strong> 원아들의 주소지를 기반으로 실시간 도로망 기준 최단 시간 순서로 노선이 자동 연결됩니다.
        </p>
        <p>
          <strong className="text-slate-900 font-bold">수동 순서 조정:</strong> 정류장 목록에서 항목을 상/하로 드래그하여 특정 원아의 승차 순서를 직접 변경할 수 있으며, 지도 상의 주행 궤적이 실시간 갱신됩니다.
        </p>
      </div>
    )
  },
  {
    id: 'documents-print',
    category: 'documents',
    categoryLabel: '서류함',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    question: '통학버스 운행기록일지나 안전 점검 서류는 어디서 출력하나요?',
    answer: (
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed pt-1">
        <p>
          좌측 네비게이션의 <strong className="text-indigo-700 font-bold">[서류함]</strong> 탭을 클릭하여 법정 서류 관리함으로 이동합니다.
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs my-1.5">
          <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100">
            <span className="font-bold text-blue-800 block text-xs mb-0.5">차량 서식 4종</span>
            <span className="text-slate-600 text-[11px] leading-tight block">운행기록부, 점검표, 소독일지, 노선표</span>
          </div>
          <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-100">
            <span className="font-bold text-emerald-800 block text-xs mb-0.5">동의서 3종</span>
            <span className="text-slate-600 text-[11px] leading-tight block">통학동의서, 귀가지도, 응급처치</span>
          </div>
          <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100">
            <span className="font-bold text-indigo-800 block text-xs mb-0.5">회계 서식 3종</span>
            <span className="text-slate-600 text-[11px] leading-tight block">유류비, 정비내역, 결재품의서</span>
          </div>
        </div>
        <p>
          서식을 선택하면 당일 운행 및 원아 데이터가 자동으로 채워지며, 우측 상단의 <span className="font-bold text-slate-900">[인쇄 / PDF 다운로드]</span> 버튼으로 구청/교육청 제출용 규격으로 즉시 출력할 수 있습니다.
        </p>
      </div>
    )
  },
  {
    id: 'substitute-login',
    category: 'account',
    categoryLabel: '계정 & 대체인력',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    question: '정규 기사님이나 선생님 휴가 시 대체 인력 로그인은 어떻게 하나요?',
    answer: (
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed pt-1">
        <p>
          네비게이션의 <strong className="text-slate-900 font-bold">[가입승인]</strong> 탭에서 호차별로 <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-xs">임시 대체 기사/교사 발급</span> 버튼을 제공합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 pl-1 text-xs">
          <li>생성된 1회용 계정 정보는 원클릭 복사하여 카카오톡이나 문자로 전송할 수 있습니다.</li>
          <li>대체 근무자는 별도 가입 절차 없이 당일 앱에서 승하차 체크 기능을 바로 이용합니다.</li>
          <li>정규 근무자가 복귀하면 임시 권한은 안전하게 자동 만료됩니다.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'attendance-sync',
    category: 'students',
    categoryLabel: '출결 & 소통',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    question: '학부모가 앱으로 신청한 결석이나 개별 픽업은 어떻게 반영되나요?',
    answer: (
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed pt-1">
        <p>
          학부모 앱에서 결석이나 직접 픽업을 접수하면, 대시보드에 실시간 푸시 알림과 함께 원아 카드에 <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded text-xs">결석</span> 또는 <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded text-xs">개별픽업</span> 뱃지가 표기됩니다.
        </p>
        <p>
          당일 통학버스 운행 경로에서도 해당 원아의 정류장이 경유지에서 자동 제외되어 운행 시간이 단축됩니다.
        </p>
      </div>
    )
  }
];

const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'students', label: '원아·출결' },
  { id: 'shuttle', label: '차량·노선' },
  { id: 'documents', label: '서류함' },
  { id: 'account', label: '계정·대체' },
];

export default function HelpManualCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState({ 'student-excel': true });

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleExpandAll = (expand) => {
    if (!expand) {
      setExpandedIds({});
      return;
    }
    const all = {};
    GUIDE_ITEMS.forEach(item => {
      all[item.id] = true;
    });
    setExpandedIds(all);
  };

  const filteredItems = useMemo(() => {
    return GUIDE_ITEMS.filter(item => {
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchCategory;
      const matchText = item.question.toLowerCase().includes(q) || item.categoryLabel.toLowerCase().includes(q);
      return matchCategory && matchText;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs transition-all overflow-hidden">
      {/* Slim Header Bar (접혀있을 때는 컴팩트 1줄 바) */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-50/80 hover:bg-blue-50/40 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base shrink-0">📖</span>
          <span className="font-extrabold text-slate-900 text-sm tracking-tight truncate">
            시스템 이용 가이드 & FAQ
          </span>
          <span className="text-[11px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full shrink-0">
            도움말 {GUIDE_ITEMS.length}개
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-slate-500 font-bold text-xs">
          <span className="hover:text-blue-600">
            {isOpen ? '도움말 접기' : '도움말 펼쳐보기'}
          </span>
          <span className={`text-xs transition-transform font-black ${isOpen ? 'rotate-180 text-blue-600' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded Body: 펼쳐졌을 때는 시원시원하고 큼직한 가독성 */}
      {isOpen && (
        <div className="p-4 border-t border-slate-200 space-y-3.5 animate-fade-in bg-white">
          {/* Header Controls (검색 & 전체 열기/닫기) */}
          <div className="flex items-center justify-between gap-2">
            {/* Search Bar */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="궁금한 기능이나 키워드를 검색하세요 (예: 엑셀, 주소, 노선, 서류)"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white placeholder-slate-400 font-medium"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleExpandAll(true)}
                className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                모두 펼치기
              </button>
              <button
                type="button"
                onClick={() => handleExpandAll(false)}
                className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                접기
              </button>
            </div>
          </div>

          {/* Category Pills (넉넉한 터치 영역) */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Large Readable Accordion Items List (시원한 최대 높이 480px) */}
          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                검색 결과와 일치하는 도움말 항목이 없습니다.
              </div>
            ) : (
              filteredItems.map(item => {
                const isExpanded = !!expandedIds[item.id];
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border transition-all ${
                      isExpanded 
                        ? 'border-blue-300 bg-white shadow-xs ring-1 ring-blue-100' 
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="w-full text-left p-3.5 flex items-start justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border shrink-0 ${item.badgeColor}`}>
                          {item.categoryLabel}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 tracking-tight leading-snug">
                          {item.question}
                        </span>
                      </div>
                      <span className={`text-xs font-black text-slate-400 transition-transform shrink-0 mt-0.5 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-white">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Support Tip */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>💡 시스템 사용 중 추가 문의나 기술 지원이 필요하신가요?</span>
            <span className="font-extrabold text-blue-600 text-xs">고객지원센터 1588-0000</span>
          </div>
        </div>
      )}
    </div>
  );
}
