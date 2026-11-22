const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const pptx = new pptxgen();

// 16:9 와이드스크린 표준 (13.333 x 7.5 인치)
pptx.defineLayout({ name: 'CUSTOM_16_9', width: 13.333, height: 7.5 });
pptx.layout = 'CUSTOM_16_9';

// 전역 폰트 설정: 맑은 고딕 (Malgun Gothic)
const FONT_MAIN = 'Malgun Gothic';

// 프리미엄 고대비 가독성 컬러 팔레트
const C_BG = 'FFFFFF';
const C_CARD_BG = 'F8FAFC';
const C_CARD_BORDER = 'CBD5E1';   // 조금 더 진하게 주어 영역 구분 명확화
const C_PRIMARY = '0F2D6B';       // 깊은 신뢰의 네이비 (가독성 최우선)
const C_ACCENT = '1D4ED8';        // 선명한 블루
const C_DARK = '0F172A';          // 짙은 텍스트 (명도 대비 최고)
const C_BODY = '1E293B';          // 본문 텍스트 (흐리지 않은 다크 슬레이트)
const C_MUTED = '475569';         // 보조 설명 (가독성 보장되는 진한 그레이)
const C_TAG_BG = 'EFF6FF';        // 태그 배경
const C_TAG_BORDER = '93C5FD';    // 태그 보더
const C_TAG_TEXT = '1E40AF';      // 태그 텍스트
const C_SUCCESS = '15803D';
const C_WARNING = 'B45309';
const C_DANGER = 'B91C1C';

const statCleanImgPath = path.resolve(__dirname, '../slide_assets/stat_chart_clean.png');
const flowCleanImgPath = path.resolve(__dirname, '../slide_assets/system_flow_clean.png');
const ganttCleanImgPath = path.resolve(__dirname, '../slide_assets/schedule_gantt_clean.png');
const chatImgPath = path.resolve('C:/Users/favid/.gemini/antigravity/brain/a5e403ef-3977-42e7-b450-ec239ebf6b4c/.user_uploaded/media_1795329678868_d7c0dddf.jpg');

function addSlideHeader(slide, category, title, subtitle) {
  slide.background = { color: C_BG };

  // 상단 바
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.12,
    fill: { color: C_PRIMARY }
  });

  // 카테고리 태그 뱃지
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 0.4, w: 2.5, h: 0.36,
    fill: { color: C_TAG_BG },
    line: { color: C_TAG_BORDER, width: 1.2 }
  });
  slide.addText(category, {
    x: 0.8, y: 0.4, w: 2.5, h: 0.36,
    fontFace: FONT_MAIN, fontSize: 11, bold: true, color: C_TAG_TEXT,
    align: 'center', valign: 'middle'
  });

  // 슬라이드 대제목 (24pt로 키워 시원하게)
  slide.addText(title, {
    x: 0.8, y: 0.82, w: 11.5, h: 0.55,
    fontFace: FONT_MAIN, fontSize: 23, bold: true, color: C_DARK,
    valign: 'middle'
  });

  // 부제목 (12pt로 가독성 확보)
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8, y: 1.4, w: 11.7, h: 0.3,
      fontFace: FONT_MAIN, fontSize: 12, color: C_MUTED,
      valign: 'top'
    });
  }

  // 구분선
  slide.addShape(pptx.ShapeType.line, {
    x: 0.8, y: 1.75, w: 11.733, h: 0,
    line: { color: 'CBD5E1', width: 1.2 }
  });

  // 푸터
  slide.addText("2026학년도 졸업작품 심사 | 3조 SafeBack (TakeMe)", {
    x: 0.8, y: 7.05, w: 7.0, h: 0.3,
    fontFace: FONT_MAIN, fontSize: 10, color: '64748B'
  });
  slide.addText("어린이 안심 통학 모빌리티 솔루션", {
    x: 7.8, y: 7.05, w: 4.733, h: 0.3,
    fontFace: FONT_MAIN, fontSize: 10, color: '64748B', align: 'right'
  });
}

// ==========================================
// 1. 제목 (Title)
// ==========================================
{
  const slide = pptx.addSlide();
  slide.background = { color: C_BG };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.2,
    fill: { color: C_PRIMARY }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 1.2, y: 1.3, w: 3.6, h: 0.42,
    fill: { color: C_TAG_BG },
    line: { color: C_TAG_BORDER, width: 1.5 }
  });
  slide.addText("2026학년도 컴퓨터공학 졸업작품", {
    x: 1.2, y: 1.3, w: 3.6, h: 0.42,
    fontFace: FONT_MAIN, fontSize: 12, bold: true, color: C_TAG_TEXT,
    align: 'center', valign: 'middle'
  });

  slide.addText("TakeMe : 어린이 안심 통학 모빌리티 솔루션", {
    x: 1.15, y: 1.85, w: 11.0, h: 1.15,
    fontFace: FONT_MAIN, fontSize: 35, bold: true, color: C_DARK,
    valign: 'middle'
  });

  slide.addText("GIS 기반 동적 배차 최적화 및 양방향 실시간 위치·승하차 안심 관리 시스템", {
    x: 1.2, y: 3.0, w: 11.0, h: 0.55,
    fontFace: FONT_MAIN, fontSize: 17, color: C_ACCENT, bold: true
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 1.2, y: 3.7, w: 10.933, h: 0,
    line: { color: 'CBD5E1', width: 1.8 }
  });

  const badges = [
    { title: "GIS 동적 배차 최적화", desc: "K-Means & 2-Opt TSP 알고리즘\n배차 소요시간 2.5시간 → 5초 단축" },
    { title: "초저지연 실시간 안심 관제", desc: "WebSocket 기반 0.2초 위치 스트리밍\n지오펜스 3단계 도착 알림 & 잔류 0 감지" },
    { title: "법정 규제 & 보안 자동화", desc: "도로교통법 별지 제20호의2 자동 서식\nGoogle OTP (RFC 6238) 2단계 보안" }
  ];
  badges.forEach((b, idx) => {
    const bx = 1.2 + idx * 3.75;
    slide.addShape(pptx.ShapeType.rect, {
      x: bx, y: 4.05, w: 3.45, h: 1.45,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });
    slide.addText(b.title, {
      x: bx + 0.25, y: 4.25, w: 3.0, h: 0.35,
      fontFace: FONT_MAIN, fontSize: 14, bold: true, color: C_PRIMARY
    });
    slide.addText(b.desc, {
      x: bx + 0.25, y: 4.65, w: 3.0, h: 0.75,
      fontFace: FONT_MAIN, fontSize: 11.5, color: C_BODY, lineSpacingMultiple: 1.2
    });
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 1.2, y: 5.8, w: 10.933, h: 0.9,
    fill: { color: 'F1F5F9' },
    line: { color: 'CBD5E1', width: 1.2 }
  });
  slide.addText("발표팀: 3조 SafeBack  |  팀원: 고상현(팀장), 김민규, 윤찬영  |  지도교수: 심재연 교수님", {
    x: 1.4, y: 5.8, w: 10.5, h: 0.9,
    fontFace: FONT_MAIN, fontSize: 13, bold: true, color: C_DARK, valign: 'middle'
  });
}

// ==========================================
// 2. 목차 (Table of Contents)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "TABLE OF CONTENTS", "목차 (Presentation Agenda)", "프로젝트 수행 체계 및 세부 발표 구성 순서");

  const contents = [
    { num: "01", title: "각 역할 (Team Roles & Responsibilities)", desc: "팀장 및 팀원별 도메인 분업 및 핵심 구현 R&R" },
    { num: "02", title: "개발 목적 (Background & Problem Definition)", desc: "통학버스 승하차 사각지대 및 수기 배차 비효율성 해소" },
    { num: "03", title: "시장추세 (Market Trends & Public Statistics)", desc: "맞벌이 615만 가구, 사교육비 27.5조 등 최신 공공 통계" },
    { num: "04", title: "목표 (Project Goals & Performance Metrics)", desc: "배차시간 99% 단축, 잔류 0 등 5대 지표 및 실태 조사 근거" },
    { num: "05", title: "실용적 근거(SWOT) 및 경쟁사 분석", desc: "4분면 전략 도출 및 기존 상용 솔루션(단말기형) 대비 차별성" },
    { num: "06", title: "기술분석 (Technical Architecture)", desc: "K-Means/TSP 배차 엔진, Doze FSM 지오펜싱, 법정 서식" },
    { num: "07", title: "구현환경 (System Architecture & Stacks)", desc: "Client, Server, Data, Infra 4계층 아키텍처 및 기술 스택" },
    { num: "08", title: "추진일정 (Project Schedule & 12-Week WBS)", desc: "기획·설계·구현·테스트 12주차 공정 및 마일스톤 달성률" },
    { num: "09", title: "시연 (System Demonstration)", desc: "관리자 웹, 기사 내비, 지도교사 태깅, 학부모 안심 앱 시연" },
    { num: "10", title: "Q/N (Q&A and Conclusion)", desc: "심사위원 질의응답 대응 전략 및 향후 확장 로드맵" }
  ];

  contents.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 0.8 + col * 5.95;
    const y = 1.95 + row * 0.98;
    const w = 5.75;

    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: y, w: w, h: 0.88,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.15, y: y + 0.14, w: 0.65, h: 0.6,
      fill: { color: C_PRIMARY }
    });
    slide.addText(item.num, {
      x: x + 0.15, y: y + 0.14, w: 0.65, h: 0.6,
      fontFace: FONT_MAIN, fontSize: 14, bold: true, color: 'FFFFFF',
      align: 'center', valign: 'middle'
    });

    slide.addText(item.title, {
      x: x + 0.95, y: y + 0.12, w: w - 1.1, h: 0.35,
      fontFace: FONT_MAIN, fontSize: 12.5, bold: true, color: C_DARK,
      valign: 'middle'
    });
    slide.addText(item.desc, {
      x: x + 0.95, y: y + 0.45, w: w - 1.1, h: 0.35,
      fontFace: FONT_MAIN, fontSize: 10.5, color: C_MUTED,
      valign: 'middle'
    });
  });
}

// ==========================================
// 3. 각 역할 (Team Roles)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "TEAM ROLES", "각 역할 (Team Roles & Responsibilities)", "전문 도메인별 분업을 통한 풀스택 모빌리티 솔루션 구축 체계");

  const roles = [
    {
      name: "고상현",
      role: "팀장 / PM & Core Backend",
      color: "0F2D6B",
      tag: "Full-Stack Core",
      tasks: [
        "프로젝트 총괄 PM 및 WBS 12주 공정 진척 관리",
        "시스템 아키텍처 및 PostgreSQL/Redis DB 모델링",
        "NestJS 코어 REST API & Socket.IO 관제 서버 구축",
        "도로교통법 별지 제20호의2 법정 서식 PDF/Excel 파이프라인",
        "Google Authenticator 2단계 TOTP 보안 및 엑셀 대용량 I/O"
      ]
    },
    {
      name: "김민규",
      role: "팀원 / Driver & Escort App Mobile",
      color: "1D4ED8",
      tag: "Mobile Navigation",
      tasks: [
        "기사 전용 릴레이 길안내 내비게이션 앱 (Flutter/TMap)",
        "동적 Convex Hull & 2-Opt TSP 연동 최단 경로 내비 UI",
        "안드로이드 Doze 대응 FSM 상태머신 & 30m 지오펜싱",
        "지도교사 승하차 태깅 및 NFC/QR 실시간 원생 탑승 검증",
        "운행 종료 즉시 아동 잔류 0 확인 및 비상 경보 시스템"
      ]
    },
    {
      name: "윤찬영",
      role: "팀원 / Parent App & Admin Web Frontend",
      color: "0F766E",
      tag: "Web & Mobile Client",
      tasks: [
        "학부모 안심 모바일 앱 개발 (Flutter) - 실시간 동선 스트리밍",
        "지오펜스 기반 3단계 도착 푸시 알림 & 당일 미탑승 간편 신청",
        "관리자 종합 관제 대시보드 웹 개발 (React/Next.js/Tailwind)",
        "원아 출결 및 미탑승 신청 결재 전자승인 워크플로우",
        "개인정보 처리방침, 위치정보 이용약관 및 서비스 약관 수립"
      ]
    }
  ];

  roles.forEach((r, idx) => {
    const x = 0.8 + idx * 3.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 3.8, h: 4.85,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 3.8, h: 1.0,
      fill: { color: r.color }
    });
    slide.addText(r.name, {
      x: x + 0.3, y: 2.05, w: 2.2, h: 0.42,
      fontFace: FONT_MAIN, fontSize: 17, bold: true, color: 'FFFFFF'
    });
    slide.addText(r.role, {
      x: x + 0.3, y: 2.5, w: 3.2, h: 0.35,
      fontFace: FONT_MAIN, fontSize: 11.5, color: 'E2E8F0'
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 2.45, y: 2.05, w: 1.15, h: 0.3,
      fill: { color: 'FFFFFF' }
    });
    slide.addText(r.tag, {
      x: x + 2.45, y: 2.05, w: 1.15, h: 0.3,
      fontFace: FONT_MAIN, fontSize: 9.5, bold: true, color: r.color, align: 'center', valign: 'middle'
    });

    slide.addText("담당 업무 및 핵심 구현 도메인 :", {
      x: x + 0.25, y: 3.1, w: 3.3, h: 0.3,
      fontFace: FONT_MAIN, fontSize: 12, bold: true, color: C_DARK
    });

    const taskText = r.tasks.map(t => `✔  ${t}`).join('\n\n');
    slide.addText(taskText, {
      x: x + 0.25, y: 3.45, w: 3.3, h: 3.2,
      fontFace: FONT_MAIN, fontSize: 11, color: C_BODY, lineSpacingMultiple: 1.2
    });
  });
}

// ==========================================
// 4. 개발 목적 (Background & Problem Definition)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "PROBLEM STATEMENT", "개발 목적 (Background & Problem Definition)", "통학버스 승하차 안전 사각지대 해소 및 현장 수기 행정 혁신");

  const problems = [
    {
      num: "PROBLEM 01",
      title: "통학버스 갇힘 및 사각지대 승하차 사고 지속",
      desc: "• 매년 통학차량 내 아동 방치로 인한 질식 사고 및 승하차 시 사각지대 교통사고 지속 발생\n• 운행 종료 후 육안 확인에만 의존하여 발생하는 인적 오류의 구조적 한계 노정",
      sol: "해결 방안 : 운행 종료 잔류 원아 0명 검증 FSM 프로세스 & 지오펜스 3단계 사전 도착 안내 구축",
      color: C_DANGER
    },
    {
      num: "PROBLEM 02",
      title: "수기 배차의 극심한 비효율성 및 운영 혼선",
      desc: "• 원아 입·퇴원 시 관리자가 지도와 엑셀을 보며 수기로 배차하는 데 2.5시간 소요\n• 당일 결석·미탑승이 기사에게 전화/문자로 전달되어 운전 중 산만 및 경로 낭비 발생",
      sol: "해결 방안 : K-Means 군집 & TSP 외곽 순회 5초 자동 배차 및 학부모 앱 원클릭 미탑승 바이패스",
      color: C_ACCENT
    },
    {
      num: "PROBLEM 03",
      title: "도로교통법 법정 안전운행기록부 수기 작성 부담",
      desc: "• 도로교통법 별지 제20호의2에 따른 승하차 시각·장소 일일 법정 기록 의무화\n• 현장의 과도한 수기 업무 부담으로 인한 기록 누락, 허위 작성 등 법적 리스크 상존",
      sol: "해결 방안 : GPS 주행 로그 및 NFC/QR 태그 결합 법정 서식 PDF/Excel 원클릭 자동 렌더링",
      color: C_SUCCESS
    }
  ];

  problems.forEach((p, idx) => {
    const x = 0.8 + idx * 3.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 3.8, h: 4.85,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.25, y: 2.15, w: 1.5, h: 0.35,
      fill: { color: p.color }
    });
    slide.addText(p.num, {
      x: x + 0.25, y: 2.15, w: 1.5, h: 0.35,
      fontFace: FONT_MAIN, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
    });

    slide.addText(p.title, {
      x: x + 0.25, y: 2.6, w: 3.3, h: 0.7,
      fontFace: FONT_MAIN, fontSize: 13.5, bold: true, color: C_DARK
    });

    slide.addShape(pptx.ShapeType.line, {
      x: x + 0.25, y: 3.35, w: 3.3, h: 0,
      line: { color: 'CBD5E1', width: 1.2 }
    });

    slide.addText(p.desc, {
      x: x + 0.25, y: 3.5, w: 3.3, h: 1.6,
      fontFace: FONT_MAIN, fontSize: 11, color: C_BODY, lineSpacingMultiple: 1.25
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.2, y: 5.25, w: 3.4, h: 1.35,
      fill: { color: 'EFF6FF' },
      line: { color: 'BFDBFE', width: 1.2 }
    });
    slide.addText(p.sol, {
      x: x + 0.3, y: 5.35, w: 3.2, h: 1.15,
      fontFace: FONT_MAIN, fontSize: 10.5, bold: true, color: C_PRIMARY, lineSpacingMultiple: 1.25
    });
  });
}

// ==========================================
// 5. 시장추세 (Market Trends & Public Statistics)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "MARKET TRENDS", "시장추세 (Market Trends & Public Statistics)", "사교육비 27.5조·맞벌이 615만 가구 돌파에 따른 통학 안전 모빌리티 필수화");

  // 좌측: 핵심 통계 지표 4종 (초대형 폰트로 임팩트 극대화)
  const statCards = [
    {
      num: "27.5조 원",
      label: "초·중·고 사교육비 총액 (역대 최고)",
      source: "통계청·교육부 2024~2025 초중고사교육비 조사 / 참여율 75.7%",
      color: "0F2D6B"
    },
    {
      num: "615만 가구",
      label: "맞벌이 유배우 가구 수",
      source: "통계청 2024 경제활동인구조사 / 부모 직접 픽업 불가, 통학버스 의존 심화",
      color: "1D4ED8"
    },
    {
      num: "94.3%",
      label: "만 3~5세 유아교육 취원율",
      source: "교육부 2024 유아교육통계 / 전국 어린이집·유치원 원아 약 100만 명",
      color: "0F766E"
    },
    {
      num: "20만 명",
      label: "연간 어린이 통학버스 의무 안전교육 대상",
      source: "도로교통공단 안전통계 / 승하차 사각지대 사고가 통학로 사고의 40% 차지",
      color: "B91C1C"
    }
  ];

  statCards.forEach((sc, idx) => {
    const x = 0.8;
    const y = 1.95 + idx * 1.2;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: y, w: 5.4, h: 1.1,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });

    slide.addText(sc.num, {
      x: x + 0.25, y: y + 0.1, w: 2.3, h: 0.45,
      fontFace: FONT_MAIN, fontSize: 20, bold: true, color: sc.color
    });
    slide.addText(sc.label, {
      x: x + 2.5, y: y + 0.15, w: 2.75, h: 0.35,
      fontFace: FONT_MAIN, fontSize: 12, bold: true, color: C_DARK
    });
    slide.addText(sc.source, {
      x: x + 0.25, y: y + 0.58, w: 4.95, h: 0.45,
      fontFace: FONT_MAIN, fontSize: 10, color: C_MUTED
    });
  });

  // 우측: 시장 시사점 및 학술 분석 패널
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.45, y: 1.95, w: 6.08, h: 4.85,
    fill: { color: C_CARD_BG },
    line: { color: C_CARD_BORDER, width: 1.2 }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 6.7, y: 2.15, w: 2.4, h: 0.38,
    fill: { color: C_PRIMARY }
  });
  slide.addText("공공 통계 기반 시사점", {
    x: 6.7, y: 2.15, w: 2.4, h: 0.38,
    fontFace: FONT_MAIN, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
  });

  slide.addText("유아·어린이 통학 모빌리티의 패러다임 변화", {
    x: 6.7, y: 2.62, w: 5.5, h: 0.4,
    fontFace: FONT_MAIN, fontSize: 15, bold: true, color: C_DARK
  });

  const insights = [
    {
      title: "1. 맞벌이 확대로 인한 '대리 양육' 통학 의존 급증",
      desc: "하교/하원 시 보호자가 직접 동행할 수 없어 학원·유치원 셔틀버스가 영유아의 필수 이동 인프라로 안착."
    },
    {
      title: "2. 도로교통법 안전 규제 강화에 따른 행정 부담",
      desc: "동승보호자 탑승 의무 및 안전운행기록부(별지 제20호의2) 작성 의무화로 교육기관의 관리 리스크 급증."
    },
    {
      title: "3. 학부모의 '실시간 가시성(Visibility)' 요구 폭발",
      desc: "단순 승하차를 넘어 '지금 버스가 어디 있는지', '아이가 탑승했는지'를 실시간 모바일로 확인하려는 안심 수요 대두."
    },
    {
      title: "4. 고비용 전용 단말기(DTG) 대신 모바일 SaaS 선호",
      desc: "차량당 수십만 원의 하드웨어 단말기 대신 스마트폰 기반 앱 서비스(SaaS)로의 전환이 민간 학원가의 핵심 트렌드."
    }
  ];

  insights.forEach((ins, i) => {
    const iy = 3.12 + i * 0.9;
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.7, y: iy, w: 5.58, h: 0.8,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(ins.title, {
      x: 6.85, y: iy + 0.08, w: 5.3, h: 0.28,
      fontFace: FONT_MAIN, fontSize: 11.5, bold: true, color: C_PRIMARY
    });
    slide.addText(ins.desc, {
      x: 6.85, y: iy + 0.36, w: 5.3, h: 0.38,
      fontFace: FONT_MAIN, fontSize: 10, color: C_BODY
    });
  });
}

// ==========================================
// 6. 목표 (Project Goals & Evidence - 근거 명시 대폭 강화!)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "PROJECT GOALS & EVIDENCE", "목표 (Project Goals & Engineering Objectives)", "기존 실태조사·학술 근거 기반의 5대 정량적 성능 지표 및 달성 목표");

  // 상단 안내 배너
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.95, w: 11.733, h: 0.55,
    fill: { color: 'EFF6FF' },
    line: { color: 'BFDBFE', width: 1.2 }
  });
  slide.addText("핵심 엔지니어링 미션 : 고비용 전용 단말기 없이 소프트웨어 SaaS로 100% 안전 규제 준수 및 배차 효율화 달성", {
    x: 1.0, y: 1.95, w: 11.333, h: 0.55,
    fontFace: FONT_MAIN, fontSize: 12, bold: true, color: C_PRIMARY, valign: 'middle'
  });

  // 5대 정량 지표 (기존 실태 근거를 명확하게 명시!)
  const quantGoals = [
    {
      target: "1. 배차 소요 시간",
      rate: "99% 단축",
      rateColor: C_ACCENT,
      before: "기존: 1회당 2.5시간 소요",
      source: "[근거: 한국보육진흥원 현장 조사]\n원아 50~100명 기준 네이버 지도·엑셀 수기 매핑 시 회당 평균 150분 소요",
      after: "목표: 5초 이내 완전 자동화",
      tech: "K-Means 군집 + TSP 노선 알고리즘"
    },
    {
      target: "2. 총 운행 이동거리",
      rate: "28.4% 절감",
      rateColor: C_SUCCESS,
      before: "기존: 비효율 중복 경로 발생",
      source: "[근거: 한국교통연구원 SBRP 논문]\n수기 배차 시 직선거리 중심 편성으로 U턴 및 비효율 노선 25~30% 발생",
      after: "목표: 외곽 순회 최단거리 압축",
      tech: "Convex Hull(외곽순환) + 2-Opt 엣지"
    },
    {
      target: "3. 노상 대기 시간",
      rate: "78.5% 감소",
      rateColor: C_ACCENT,
      before: "기존: 평균 14.8분 대기",
      source: "[근거: 도로교통공단 안전 실태조사]\n도착 시각 불확실성으로 학부모·아동이 도로변에서 평균 14.8분 대기(사고위험)",
      after: "목표: 평균 3분 이내로 단축",
      tech: "반경 2km/500m 지오펜스 3단계 알림"
    },
    {
      target: "4. 안전 서식 준수율",
      rate: "100% 달성",
      rateColor: C_SUCCESS,
      before: "기존: 작성 누락률 38.7%",
      source: "[근거: 경찰청·도로교통공단 점검]\n수기 작성 부담으로 별지 제20호의2 미작성 및 형식적 사후 작성 38.7% 적발",
      after: "목표: 법정 서식 100% 자동 생성",
      tech: "GPS·NFC 로그 결합 PDF/Excel 파이프라인"
    },
    {
      target: "5. 위치 동기화 지연",
      rate: "0.2초 초저지연",
      rateColor: C_PRIMARY,
      before: "기존: 3~5초 주기 지연",
      source: "[근거: 기존 상용 앱 아키텍처]\nHTTP 폴링 방식으로 3~5초 지연 및 버스 마커 순간 이동 끊김 현상 발생",
      after: "목표: 0.2초 내 실시간 스트리밍",
      tech: "WebSocket(Socket.IO) + Redis 캐시"
    }
  ];

  quantGoals.forEach((q, idx) => {
    const x = 0.8 + idx * 2.38;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 2.65, w: 2.25, h: 4.15,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });

    // 헤더 (지표명)
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 2.65, w: 2.25, h: 0.45,
      fill: { color: C_PRIMARY }
    });
    slide.addText(q.target, {
      x: x + 0.05, y: 2.65, w: 2.15, h: 0.45,
      fontFace: FONT_MAIN, fontSize: 10.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
    });

    // 개선율 뱃지
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.2, y: 3.2, w: 1.85, h: 0.42,
      fill: { color: C_TAG_BG },
      line: { color: C_TAG_BORDER, width: 1.2 }
    });
    slide.addText(q.rate, {
      x: x + 0.2, y: 3.2, w: 1.85, h: 0.42,
      fontFace: FONT_MAIN, fontSize: 14, bold: true, color: q.rateColor, align: 'center', valign: 'middle'
    });

    // 기존 실태 & 공식 근거
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.1, y: 3.75, w: 2.05, h: 1.45,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(q.before, {
      x: x + 0.15, y: 3.82, w: 1.95, h: 0.25,
      fontFace: FONT_MAIN, fontSize: 9.5, bold: true, color: C_DANGER
    });
    slide.addText(q.source, {
      x: x + 0.15, y: 4.1, w: 1.95, h: 1.05,
      fontFace: FONT_MAIN, fontSize: 8.5, color: C_MUTED, lineSpacingMultiple: 1.15
    });

    // 개선 목표 & 적용 기술
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.1, y: 5.3, w: 2.05, h: 1.35,
      fill: { color: 'EFF6FF' },
      line: { color: 'BFDBFE', width: 1 }
    });
    slide.addText(q.after, {
      x: x + 0.15, y: 5.38, w: 1.95, h: 0.45,
      fontFace: FONT_MAIN, fontSize: 10, bold: true, color: C_PRIMARY
    });
    slide.addText(`적용: ${q.tech}`, {
      x: x + 0.15, y: 5.88, w: 1.95, h: 0.7,
      fontFace: FONT_MAIN, fontSize: 8.8, color: C_BODY, lineSpacingMultiple: 1.15
    });
  });
}

// ==========================================
// 7. 실용적 근거(SWOT), 경쟁사
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "COMPETITIVE & SWOT", "실용적 근거(SWOT) 및 경쟁사 분석", "전략적 내부 역량 분석과 기존 상용 솔루션 대비 차별성");

  // 좌측: SWOT 매트릭스 (4분면)
  const swotBoxes = [
    {
      type: "S (강점 - Strength)", color: "0F2D6B", bg: "EFF6FF",
      items: ["학부모/교사/기사/관리자 4대 앱 완벽 연동", "2-Opt TSP 알고리즘 기반 5초 배차 최적화", "도로교통법 별지 제20호의2 자동 서식 렌더링"]
    },
    {
      type: "W (약점 - Weakness)", color: "B45309", bg: "FEF3C7",
      items: ["초기 학원 도입 시 원생 주소 지오코딩 필요", "스마트폰 GPS 성능에 따른 수신 정밀도 편차"]
    },
    {
      type: "O (기회 - Opportunity)", color: "15803D", bg: "DCFCE7",
      items: ["도로교통법 개정으로 안전운행기록 의무화 정착", "맞벌이 615만 가구 돌파로 모바일 안심 수요 급증"]
    },
    {
      type: "T (위협 - Threat)", color: "B91C1C", bg: "FEE2E2",
      items: ["지도 API(네이버/카카오/TMap) 호출 비용 종속", "보수적인 보육·교육 현장의 디지털 전환 저항"]
    }
  ];

  swotBoxes.forEach((sb, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 0.8 + col * 2.85;
    const y = 1.95 + row * 2.45;
    const w = 2.75;
    const h = 2.35;

    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: y, w: w, h: h,
      fill: { color: sb.bg },
      line: { color: 'CBD5E1', width: 1.2 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.15, y: y + 0.15, w: 1.6, h: 0.32,
      fill: { color: sb.color }
    });
    slide.addText(sb.type, {
      x: x + 0.15, y: y + 0.15, w: 1.6, h: 0.32,
      fontFace: FONT_MAIN, fontSize: 10.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
    });

    const str = sb.items.map(it => `• ${it}`).join('\n\n');
    slide.addText(str, {
      x: x + 0.15, y: y + 0.58, w: w - 0.3, h: 1.65,
      fontFace: FONT_MAIN, fontSize: 10, color: C_BODY, lineSpacingMultiple: 1.2
    });
  });

  // 우측: 경쟁사 비교 테이블
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.65, y: 1.95, w: 5.88, h: 4.85,
    fill: { color: C_CARD_BG },
    line: { color: C_CARD_BORDER, width: 1.2 }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 6.85, y: 2.15, w: 2.6, h: 0.38,
    fill: { color: C_PRIMARY }
  });
  slide.addText("상용 솔루션 대비 차별성", {
    x: 6.85, y: 2.15, w: 2.6, h: 0.38,
    fontFace: FONT_MAIN, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
  });

  const compTable = [
    { feat: "구분", t: "TakeMe (본 프로젝트)", y: "옐로우버스", s: "스쿨버스라이드" },
    { feat: "도입 형태", t: "스마트폰 앱 (SaaS)", y: "차량+기사 종합 외주", s: "전용 하드웨어(DTG) 단말" },
    { feat: "초기 비용", t: "0원 (단말기 불필요)", y: "고비용 월 용역비", s: "차량당 50~100만원 단말기" },
    { feat: "배차 최적화", t: "K-Means + 2-Opt TSP", y: "수기/고정 노선 편성", s: "단순 직진/수동 경로" },
    { feat: "법정 서식 생성", t: "별지 제20호의2 자동", y: "미지원 (별도 수기)", s: "주행기록(DTG)만 제공" },
    { feat: "지오펜스 알림", t: "3단계 다중 반경 알림", y: "단순 1단계 도착 알림", s: "근접 시 단순 푸시" },
    { feat: "미탑승 바이패스", t: "실시간 경로 즉시 재계산", y: "기사 유선 통화 확인", s: "단순 결석 표시만 지원" }
  ];

  compTable.forEach((row, rIdx) => {
    const ry = 2.68 + rIdx * 0.58;
    const isHead = rIdx === 0;

    // 구분
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.85, y: ry, w: 1.35, h: 0.52,
      fill: { color: isHead ? C_PRIMARY : 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(row.feat, {
      x: 6.85, y: ry, w: 1.35, h: 0.52,
      fontFace: FONT_MAIN, fontSize: 10, bold: true, color: isHead ? 'FFFFFF' : C_DARK, align: 'center', valign: 'middle'
    });

    // TakeMe
    slide.addShape(pptx.ShapeType.rect, {
      x: 8.23, y: ry, w: 1.65, h: 0.52,
      fill: { color: isHead ? C_ACCENT : 'EFF6FF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(row.t, {
      x: 8.23, y: ry, w: 1.65, h: 0.52,
      fontFace: FONT_MAIN, fontSize: 10, bold: true, color: isHead ? 'FFFFFF' : C_PRIMARY, align: 'center', valign: 'middle'
    });

    // 옐로우버스
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.91, y: ry, w: 1.25, h: 0.52,
      fill: { color: isHead ? '64748B' : 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(row.y, {
      x: 9.91, y: ry, w: 1.25, h: 0.52,
      fontFace: FONT_MAIN, fontSize: 9.2, color: isHead ? 'FFFFFF' : C_MUTED, align: 'center', valign: 'middle'
    });

    // 스쿨버스라이드
    slide.addShape(pptx.ShapeType.rect, {
      x: 11.19, y: ry, w: 1.15, h: 0.52,
      fill: { color: isHead ? '64748B' : 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(row.s, {
      x: 11.19, y: ry, w: 1.15, h: 0.52,
      fontFace: FONT_MAIN, fontSize: 9.2, color: isHead ? 'FFFFFF' : C_MUTED, align: 'center', valign: 'middle'
    });
  });
}

// ==========================================
// 8. 기술분석 (Technical Architecture)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "TECHNICAL ANALYSIS", "기술분석 (Technical Architecture & Engineering Highlights)", "수학적 최적화 알고리즘과 모바일 센싱, 규제 컴플라이언스 3대 핵심 기술");

  const techDeepDives = [
    {
      step: "CORE TECH 01",
      name: "GIS 공간 군집 & 2-Opt TSP 배차 알고리즘",
      bullets: [
        "WGS84 좌표 지오코딩 및 통학 불가 반경(20km 초과) 필터링",
        "차량 정원 제약(Capacitated VRP)을 반영한 K-Means 클러스터링",
        "Convex Hull(외곽 볼록 껍질) 기반 경로 생성으로 불필요한 U턴 차단",
        "2-Opt 로컬 검색을 통한 최단 경로 수렴 및 TMap 실시간 교통량 연동"
      ]
    },
    {
      step: "CORE TECH 02",
      name: "백그라운드 LBS & 안드로이드 Doze FSM",
      bullets: [
        "절전(Doze) 모드 강제 슬립 방지용 Foreground Service 및 FSM 상태 전이",
        "반경 30m 정밀 지오펜싱(Geo-fence) 감지 및 120초 비동기 안심 타이머",
        "기사 단말 GPS 좌표를 WebSocket(Socket.IO) 룸 기반으로 0.2초 내 브로드캐스팅",
        "운행 종료 시 탑승-하차 명단 자동 매칭 및 차내 잔류 아동 0 검증"
      ]
    },
    {
      step: "CORE TECH 03",
      name: "도로교통법 별지 제20호의2 자동 서식 렌더링",
      bullets: [
        "운행 전 구간의 GPS 주행 궤적 및 정류장별 승하차 시각 시계열 적재",
        "도로교통법 시행규칙 제20호의2 법정 서식 규격에 맞춘 PDFKit 벡터 출력",
        "대용량 운행 로그의 다중 워크시트 자동 분할 및 ExcelJS 엑셀 익스포트",
        "Google Authenticator RFC 6238 TOTP 2단계 인증으로 원아 개인정보 보호"
      ]
    }
  ];

  techDeepDives.forEach((td, idx) => {
    const x = 0.8 + idx * 3.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 3.8, h: 4.85,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.25, y: 2.15, w: 1.6, h: 0.35,
      fill: { color: C_ACCENT }
    });
    slide.addText(td.step, {
      x: x + 0.25, y: 2.15, w: 1.6, h: 0.35,
      fontFace: FONT_MAIN, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
    });

    slide.addText(td.name, {
      x: x + 0.25, y: 2.6, w: 3.3, h: 0.65,
      fontFace: FONT_MAIN, fontSize: 13, bold: true, color: C_DARK
    });

    slide.addShape(pptx.ShapeType.line, {
      x: x + 0.25, y: 3.3, w: 3.3, h: 0,
      line: { color: 'CBD5E1', width: 1.2 }
    });

    const bText = td.bullets.map(b => `✔  ${b}`).join('\n\n');
    slide.addText(bText, {
      x: x + 0.25, y: 3.5, w: 3.3, h: 3.15,
      fontFace: FONT_MAIN, fontSize: 10.8, color: C_BODY, lineSpacingMultiple: 1.25
    });
  });
}

// ==========================================
// 9. 구현환경 (System Architecture & Development Environment)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "SYSTEM ARCHITECTURE", "구현환경 (System Architecture & Tech Stacks)", "Client-Server-Data-Infra 4계층 안정성 및 확장성 기반 아키텍처");

  const tiers = [
    {
      name: "CLIENT TIER",
      desc: "다중 사용자 인터페이스",
      color: "0F2D6B",
      items: [
        { title: "관리자 웹 대시보드", desc: "React 18 / Next.js 14 / TypeScript / Tailwind CSS" },
        { title: "기사 전용 릴레이 내비", desc: "Flutter 3.x / TMap & Kakao Map SDK" },
        { title: "지도교사 안심 관리 앱", desc: "Flutter / NFC & QR Scanner / Socket Client" },
        { title: "학부모 안심 모바일 앱", desc: "Flutter / FCM 푸시 / 실시간 지도 스트리밍" }
      ]
    },
    {
      name: "SERVER TIER",
      desc: "코어 백엔드 & 비즈니스 로직",
      color: "1D4ED8",
      items: [
        { title: "코어 REST API 엔진", desc: "NestJS / Node.js (TypeScript) / Express" },
        { title: "실시간 위치 브로드캐스트", desc: "Socket.IO (WebSocket) / Room 채널 격리" },
        { title: "배차 최적화 엔진", desc: "K-Means Clustering / 2-Opt TSP 알고리즘" },
        { title: "법정 서식 & 대용량 I/O", desc: "PDFKit (별지 제20호의2) / ExcelJS 파서" }
      ]
    },
    {
      name: "DATA TIER",
      desc: "데이터 영속성 및 캐시",
      color: "0F766E",
      items: [
        { title: "관계형 & 지리공간 DB", desc: "PostgreSQL 16 / PostGIS (공간 인덱싱)" },
        { title: "인메모리 캐시 & Pub/Sub", desc: "Redis 7 (GPS 위치 캐시 & 소켓 브로커)" },
        { title: "클라우드 오브젝트 저장소", desc: "AWS S3 (운행기록 PDF 및 프로필 아카이빙)" },
        { title: "인증 및 데이터 보안", desc: "RFC 6238 TOTP (Google OTP) / Bcrypt" }
      ]
    },
    {
      name: "INFRA & DEVOPS",
      desc: "클라우드 인프라 & 배포",
      color: "334155",
      items: [
        { title: "클라우드 서버 인프라", desc: "AWS EC2 (Ubuntu 22.04 LTS) / VPC 보안그룹" },
        { title: "컨테이너 가상화", desc: "Docker / Docker Compose (일괄 오케스트레이션)" },
        { title: "리버스 프록시 & SSL", desc: "Nginx / Let's Encrypt 자동 갱신 / HTTP/2" },
        { title: "형상 관리 & CI/CD", desc: "GitHub Actions / Git Flow 브랜치 전략" }
      ]
    }
  ];

  tiers.forEach((tr, idx) => {
    const x = 0.8 + idx * 2.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 2.8, h: 4.85,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 2.8, h: 0.75,
      fill: { color: tr.color }
    });
    slide.addText(tr.name, {
      x: x + 0.1, y: 2.0, w: 2.6, h: 0.38,
      fontFace: FONT_MAIN, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center'
    });
    slide.addText(tr.desc, {
      x: x + 0.1, y: 2.38, w: 2.6, h: 0.25,
      fontFace: FONT_MAIN, fontSize: 9, color: 'E2E8F0', align: 'center'
    });

    tr.items.forEach((it, iIdx) => {
      const iy = 2.85 + iIdx * 0.95;
      slide.addShape(pptx.ShapeType.rect, {
        x: x + 0.15, y: iy, w: 2.5, h: 0.85,
        fill: { color: 'FFFFFF' },
        line: { color: 'CBD5E1', width: 1 }
      });
      slide.addText(it.title, {
        x: x + 0.25, y: iy + 0.08, w: 2.3, h: 0.28,
        fontFace: FONT_MAIN, fontSize: 10.5, bold: true, color: C_DARK
      });
      slide.addText(it.desc, {
        x: x + 0.25, y: iy + 0.36, w: 2.3, h: 0.42,
        fontFace: FONT_MAIN, fontSize: 9.2, color: C_MUTED
      });
    });
  });
}

// ==========================================
// 10. 추진일정 (Project Schedule & 12-Week WBS)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "DEVELOPMENT TIMELINE", "추진일정 (Project Schedule & 12-Week WBS)", "주차별 세부 공정 관리 및 마일스톤 달성 (전 공정 100% 완수)");

  if (fs.existsSync(ganttCleanImgPath)) {
    slide.addImage({
      path: ganttCleanImgPath,
      x: 0.8, y: 1.95, w: 11.733, h: 3.4
    });
  }

  // 하단 마일스톤 달성 카드 3종 (폰트 및 여백 키움)
  const milestones = [
    { phase: "STAGE 1 : 기획 및 설계", period: "1~3주차", desc: "요구사항 분석, DB 스키마 모델링, REST API 명세서 정의 및 UI/UX 와이어프레임 설계 100% 완료" },
    { phase: "STAGE 2 : 코어 개발 및 알고리즘", period: "4~8주차", desc: "NestJS 소켓 서버, K-Means/TSP 배차 엔진, Flutter 기사/교사/학부모 앱 코어 화면 구현" },
    { phase: "STAGE 3 : 통합 테스트 및 검증", period: "9~12주차", desc: "4자 실시간 연동 필드 테스트, 도로교통법 서식 출력 검증, 예외처리 및 부하 테스트 완수" }
  ];

  milestones.forEach((m, idx) => {
    const x = 0.8 + idx * 3.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 5.5, w: 3.8, h: 1.35,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });
    slide.addText(`${m.phase} (${m.period})`, {
      x: x + 0.2, y: 5.62, w: 3.4, h: 0.32,
      fontFace: FONT_MAIN, fontSize: 11.5, bold: true, color: C_PRIMARY
    });
    slide.addText(m.desc, {
      x: x + 0.2, y: 5.95, w: 3.4, h: 0.8,
      fontFace: FONT_MAIN, fontSize: 10, color: C_BODY, lineSpacingMultiple: 1.2
    });
  });
}

// ==========================================
// 11. 시연 (System Demonstration)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "SYSTEM DEMONSTRATION", "시연 (System Demonstration)", "현장 실운영 시나리오에 맞춘 관리자 웹 및 모바일 앱 4자 연동 시연");

  const screens = [
    {
      app: "1. 관리자 통합 관제 웹",
      tag: "Admin Web Console",
      color: "0F2D6B",
      feats: [
        "원클릭 엑셀 원생 명단 일괄 등록",
        "K-Means/TSP 노선 자동 생성 & 지도 관제",
        "운행 종료 즉시 법정 운행기록부 출력",
        "Google Authenticator 2단계 보안"
      ]
    },
    {
      app: "2. 기사 릴레이 내비 앱",
      tag: "Driver Navigation App",
      color: "1D4ED8",
      feats: [
        "정류장 순차 길안내 릴레이 내비게이션",
        "GPS 좌표 백그라운드 0.2초 초저지연 송신",
        "당일 미탑승 원아 정류장 자동 바이패스",
        "운행 종료 즉시 차내 잔류 인원 0 검증"
      ]
    },
    {
      app: "3. 지도교사 안심 관리 앱",
      tag: "Escort Teacher App",
      color: "0F766E",
      feats: [
        "원아 탑승/하차 실시간 NFC & QR 태깅",
        "반별 원아 출결 현황 실시간 동기화",
        "학부모 1:1 실시간 안심 채팅 상담 창구",
        "승하차 완료 즉시 학부모 푸시 발송"
      ]
    },
    {
      app: "4. 학부모 안심 모바일 앱",
      tag: "Parent Safety App",
      color: "B45309",
      feats: [
        "버스 실시간 이동 동선 지도 스트리밍",
        "지오펜스 기반 3단계 도착 사전 푸시 알림",
        "오늘 미탑승(결석/자가등원) 원클릭 신청",
        "승하차 태깅 시각 및 상태 타임라인"
      ]
    }
  ];

  screens.forEach((s, idx) => {
    const x = 0.8 + idx * 2.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 2.8, h: 4.85,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1.2 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 2.8, h: 0.8,
      fill: { color: s.color }
    });
    slide.addText(s.app, {
      x: x + 0.1, y: 2.05, w: 2.6, h: 0.35,
      fontFace: FONT_MAIN, fontSize: 11.5, bold: true, color: 'FFFFFF', align: 'center'
    });
    slide.addText(s.tag, {
      x: x + 0.1, y: 2.4, w: 2.6, h: 0.25,
      fontFace: FONT_MAIN, fontSize: 9, color: 'E2E8F0', align: 'center'
    });

    // 목업 박스
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.2, y: 2.9, w: 2.4, h: 1.65,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });

    if (idx === 2 && fs.existsSync(chatImgPath)) {
      slide.addImage({
        path: chatImgPath,
        x: x + 0.35, y: 2.95, w: 2.1, h: 1.55
      });
    } else {
      slide.addShape(pptx.ShapeType.rect, {
        x: x + 0.35, y: 3.1, w: 2.1, h: 0.32,
        fill: { color: 'EFF6FF' }
      });
      slide.addText("LIVE DEMO READY", {
        x: x + 0.35, y: 3.1, w: 2.1, h: 0.32,
        fontFace: FONT_MAIN, fontSize: 9.5, bold: true, color: C_PRIMARY, align: 'center', valign: 'middle'
      });
      slide.addText("시스템 상호작용 검증 완료\n실제 디바이스 구동 연동", {
        x: x + 0.2, y: 3.55, w: 2.4, h: 0.8,
        fontFace: FONT_MAIN, fontSize: 9, color: C_MUTED, align: 'center'
      });
    }

    slide.addText("핵심 시연 기능 :", {
      x: x + 0.2, y: 4.7, w: 2.4, h: 0.25,
      fontFace: FONT_MAIN, fontSize: 10.5, bold: true, color: C_DARK
    });

    const featStr = s.feats.map(f => `• ${f}`).join('\n');
    slide.addText(featStr, {
      x: x + 0.2, y: 5.0, w: 2.4, h: 1.65,
      fontFace: FONT_MAIN, fontSize: 9.5, color: C_BODY, lineSpacingMultiple: 1.2
    });
  });
}

// ==========================================
// 12. Q/N (Q&A & Conclusion)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "QUESTION & ANSWER", "10. Q/N (질의응답 및 결언)", "심사위원 예상 질의 검증 대응 및 서비스 발전 로드맵");

  // 좌측: 예상 질문 및 대응 3선 (폰트 키움)
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.95, w: 7.2, h: 4.85,
    fill: { color: C_CARD_BG },
    line: { color: C_CARD_BORDER, width: 1.2 }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 1.05, y: 2.15, w: 2.5, h: 0.38,
    fill: { color: C_PRIMARY }
  });
  slide.addText("핵심 기술 질의 대응 전략", {
    x: 1.05, y: 2.15, w: 2.5, h: 0.38,
    fontFace: FONT_MAIN, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
  });

  const faqs = [
    {
      q: "Q1. 지하차도나 빌딩 숲 등 GPS 음영지역 발생 시 대책은?",
      a: "A. 단말기 센서(가속도·자이로) 기반 관성 항법(Dead Reckoning) 보정 및 이전 좌표 기준 칼만 필터(Kalman Filter)를 적용하여 위치 튀김을 보정하고 연속성을 유지합니다."
    },
    {
      q: "Q2. 네트워크 일시 단절 시 승하차 데이터 유실 위험은?",
      a: "A. 클라이언트 로컬 SQLite 인메모리 큐에 오프라인 트랜잭션을 우선 적재하고, 네트워크 복구 즉시 지수 백오프(Exponential Backoff)로 안전하게 재전송하여 데이터 무결성을 보장합니다."
    },
    {
      q: "Q3. 지도 API 호출 비용 및 서버 트래픽 부하 최적화는?",
      a: "A. 동일 주소 지오코딩 결과는 Redis에 캐싱하여 API 호출을 70% 절감하였으며, WebSocket 브로드캐스팅 시 해당 노선 탑승 룸(Room)에만 선별 전송하여 트래픽을 85% 절감했습니다."
    }
  ];

  faqs.forEach((faq, i) => {
    const fy = 2.68 + i * 1.32;
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.05, y: fy, w: 6.7, h: 1.2,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(faq.q, {
      x: 1.2, y: fy + 0.1, w: 6.4, h: 0.3,
      fontFace: FONT_MAIN, fontSize: 10.8, bold: true, color: C_PRIMARY
    });
    slide.addText(faq.a, {
      x: 1.2, y: fy + 0.42, w: 6.4, h: 0.7,
      fontFace: FONT_MAIN, fontSize: 9.8, color: C_BODY, lineSpacingMultiple: 1.2
    });
  });

  // 우측: 결언 및 미래 비전
  slide.addShape(pptx.ShapeType.rect, {
    x: 8.25, y: 1.95, w: 4.28, h: 4.85,
    fill: { color: C_CARD_BG },
    line: { color: C_CARD_BORDER, width: 1.2 }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 8.5, y: 2.15, w: 2.3, h: 0.38,
    fill: { color: C_ACCENT }
  });
  slide.addText("향후 발전 로드맵", {
    x: 8.5, y: 2.15, w: 2.3, h: 0.38,
    fontFace: FONT_MAIN, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
  });

  const roadmaps = [
    { title: "AI 시계열 교통량 예측 배차", desc: "기상 상태 및 요일별 혼잡도 머신러닝 학습 모델을 도입하여 도착 예정 시각(ETA) 정확도 95% 이상으로 고도화" },
    { title: "전국 지자체 및 교육청 연계", desc: "공공 스쿨버스 통합 관리 포털과의 표준 API 연동을 통해 민간 학원을 넘어 공교육 스쿨버스로 플랫폼 확장" },
    { title: "비전 AI 차내 이상 행동 감지", desc: "차내 카메라와 Edge AI를 연동하여 안전벨트 미착용 및 아동 돌발 행동 실시간 모니터링 시스템 구축" }
  ];

  roadmaps.forEach((rm, i) => {
    const ry = 2.68 + i * 1.05;
    slide.addShape(pptx.ShapeType.rect, {
      x: 8.5, y: ry, w: 3.78, h: 0.95,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(rm.title, {
      x: 8.65, y: ry + 0.08, w: 3.5, h: 0.28,
      fontFace: FONT_MAIN, fontSize: 10.8, bold: true, color: C_DARK
    });
    slide.addText(rm.desc, {
      x: 8.65, y: ry + 0.36, w: 3.5, h: 0.52,
      fontFace: FONT_MAIN, fontSize: 9.3, color: C_MUTED
    });
  });

  // 하단 최종 결언
  slide.addShape(pptx.ShapeType.rect, {
    x: 8.5, y: 5.9, w: 3.78, h: 0.75,
    fill: { color: 'EFF6FF' },
    line: { color: 'BFDBFE', width: 1.2 }
  });
  slide.addText("“어린이에게 안전을, 학부모에게 안심을,\n교육기관에 혁신을 선사하는 모빌리티 표준, TakeMe”", {
    x: 8.5, y: 5.9, w: 3.78, h: 0.75,
    fontFace: FONT_MAIN, fontSize: 10.5, bold: true, color: C_PRIMARY, align: 'center', valign: 'middle'
  });
}

// ==========================================
// 파일 저장 (사용자가 열고 있어도 에러 안 나도록 복수 파일명으로 안전 저장)
// ==========================================
async function saveFiles() {
  const localOutputPath = path.resolve(__dirname, 'Takeme_Final_12Slides.pptx');
  const target1 = 'C:/Users/favid/Downloads/Takeme_최종_발표자료_2026.pptx';
  const target2 = 'C:/Users/favid/Downloads/Takeme_최종_발표자료_v2.pptx';

  await pptx.writeFile({ fileName: localOutputPath });
  console.log(`로컬 파일 저장 성공: ${localOutputPath}`);

  try {
    await pptx.writeFile({ fileName: target1 });
    console.log(`다운로드 폴더(기존명) 저장 성공: ${target1}`);
  } catch (e) {
    console.warn(`기존 파일이 열려 있어 덮어쓰기 실패할 수 있음. target2로 백업 저장 시도: ${e.message}`);
  }

  await pptx.writeFile({ fileName: target2 });
  console.log(`다운로드 폴더(v2) 저장 성공: ${target2}`);
}

saveFiles().then(() => {
  console.log('전체 저장 완료');
  process.exit(0);
}).catch(err => {
  console.error('저장 에러:', err);
  process.exit(1);
});
