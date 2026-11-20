const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const pptx = new pptxgen();

// 16:9 와이드스크린 표준 (13.333 x 7.5 인치)
pptx.defineLayout({ name: 'CUSTOM_16_9', width: 13.333, height: 7.5 });
pptx.layout = 'CUSTOM_16_9';

// 컬러 팔레트 (화이트 & 비즈니스 클린 테마)
const C_BG = 'FFFFFF';
const C_CARD_BG = 'F8FAFC';
const C_CARD_BORDER = 'E2E8F0';
const C_PRIMARY = '0F172A';       // 다크 슬레이트
const C_ACCENT = '2563EB';        // 비비드 블루
const C_DARK = '0F172A';          // 진한 타이틀 텍스트
const C_BODY = '334155';          // 본문 텍스트
const C_MUTED = '64748B';         // 부가 설명
const C_TAG_BG = 'EFF6FF';        // 태그 배경
const C_TAG_BORDER = 'BFDBFE';    // 태그 보더
const C_TAG_TEXT = '1D4ED8';      // 태그 텍스트

const statChartImgPath = path.resolve(__dirname, '../slide_assets/stat_chart.png');
const archDiagramImgPath = path.resolve(__dirname, '../slide_assets/architecture_diagram.png');

// 공통 슬라이드 헤더 함수
function addSlideHeader(slide, category, title, subtitle) {
  slide.background = { color: C_BG };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 0.45, w: 2.2, h: 0.32,
    fill: { color: C_TAG_BG },
    line: { color: C_TAG_BORDER, width: 1 }
  });
  slide.addText(category, {
    x: 0.8, y: 0.45, w: 2.2, h: 0.32,
    fontSize: 10, bold: true, color: C_TAG_TEXT,
    align: 'center', valign: 'middle'
  });

  slide.addText(title, {
    x: 0.8, y: 0.85, w: 10.5, h: 0.55,
    fontSize: 22, bold: true, color: C_DARK,
    valign: 'middle'
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8, y: 1.4, w: 11.7, h: 0.3,
      fontSize: 11.5, color: C_MUTED,
      valign: 'top'
    });
  }

  slide.addShape(pptx.ShapeType.line, {
    x: 0.8, y: 1.75, w: 11.733, h: 0,
    line: { color: 'E2E8F0', width: 1 }
  });

  slide.addText("TakeMe | 스마트 통학버스 위치·승하차 관리 솔루션", {
    x: 0.8, y: 7.05, w: 8.0, h: 0.3,
    fontSize: 9, color: '94A3B8'
  });
  slide.addText("SafeBack Inc.", {
    x: 8.8, y: 7.05, w: 3.733, h: 0.3,
    fontSize: 9, color: '94A3B8', align: 'right'
  });
}

// SLIDE 1: 표지
{
  const slide = pptx.addSlide();
  slide.background = { color: C_BG };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.15,
    fill: { color: C_ACCENT }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 1.2, y: 1.6, w: 2.8, h: 0.38,
    fill: { color: C_TAG_BG },
    line: { color: C_TAG_BORDER, width: 1 }
  });
  slide.addText("서비스 소개서 (Solution Brief)", {
    x: 1.2, y: 1.6, w: 2.8, h: 0.38,
    fontSize: 11, bold: true, color: C_TAG_TEXT,
    align: 'center', valign: 'middle'
  });

  slide.addText("TakeMe : 어린이 안심 통학버스 스마트 솔루션", {
    x: 1.15, y: 2.15, w: 11.0, h: 1.1,
    fontSize: 34, bold: true, color: C_DARK,
    valign: 'middle'
  });

  slide.addText("인공지능 최적 노선 자동 생성 & 학부모·학원 실시간 안심 관제 플랫폼", {
    x: 1.2, y: 3.25, w: 11.0, h: 0.5,
    fontSize: 16, color: C_ACCENT, bold: true
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 1.2, y: 3.9, w: 10.933, h: 0,
    line: { color: 'CBD5E1', width: 1.5 }
  });

  const cards = [
    { title: "원클릭 노선 최적화", desc: "복잡한 수동 배차를 단 5초 만에 최적화하여 유류비와 통학 시간을 획기적으로 절감" },
    { title: "초정밀 실시간 안심 알림", desc: "정류장 10분/3분 전 지오펜스 자동 푸시와 탑승 여부 즉시 전송" },
    { title: "학원 행정 업무 간소화", desc: "기존 엑셀 원생 명단 양방향 자동 연동 및 Google OTP 2단계 보안 탑재" }
  ];
  cards.forEach((c, idx) => {
    const bx = 1.2 + idx * 3.75;
    slide.addShape(pptx.ShapeType.rect, {
      x: bx, y: 4.2, w: 3.45, h: 1.3,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });
    slide.addText(c.title, {
      x: bx + 0.25, y: 4.35, w: 3.0, h: 0.35,
      fontSize: 13, bold: true, color: '1E3A8A'
    });
    slide.addText(c.desc, {
      x: bx + 0.25, y: 4.75, w: 3.0, h: 0.65,
      fontSize: 10.5, color: C_BODY
    });
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 1.2, y: 5.8, w: 10.933, h: 0.75,
    fill: { color: 'F1F5F9' },
    line: { color: 'E2E8F0', width: 1 }
  });
  slide.addText("SafeBack 개발팀 | 공식 문의: contact@safeback.io | 웹 서비스: https://52.63.245.203.sslip.io", {
    x: 1.4, y: 5.8, w: 10.5, h: 0.75,
    fontSize: 11.5, bold: true, color: C_DARK, valign: 'middle'
  });
}

// SLIDE 2: 목차
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "TABLE OF CONTENTS", "목차 (Service Overview)", "TakeMe 솔루션 도입 가치와 주요 핵심 기능");

  const contents = [
    { num: "01", title: "도입 배경 및 시장 현황", desc: "통학버스 사고 통계 및 수기 명단 관리의 문제점" },
    { num: "02", title: "전체 서비스 구상도 및 구조", desc: "학원 관리자 - 운전 기사 - 학부모 간 유기적 연결 구조" },
    { num: "03", title: "핵심 기능 ① : 스마트 동적 노선 최적화", desc: "주소 입력만으로 완성되는 5초 자동 배차 알고리즘" },
    { num: "04", title: "핵심 기능 ② : 실시간 위치 관제 & 안심 알림", desc: "3단계 지오펜스 사전 알림 및 잔류 아동 제로화" },
    { num: "05", title: "핵심 기능 ③ : 엑셀 일괄 연동 & 보안 체계", desc: "기존 학원 관리 프로그램 100% 호환 및 OTP 2단계 인증" },
    { num: "06", title: "도입 효과 및 비즈니스 가치", desc: "운영 비용 절감, 행정 효율화, 브랜드 신뢰도 향상" }
  ];

  contents.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 0.8 + col * 5.95;
    const y = 2.05 + row * 1.55;

    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: y, w: 5.75, h: 1.35,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.25, y: y + 0.25, w: 0.85, h: 0.85,
      fill: { color: C_ACCENT }
    });
    slide.addText(item.num, {
      x: x + 0.25, y: y + 0.25, w: 0.85, h: 0.85,
      fontSize: 18, bold: true, color: 'FFFFFF',
      align: 'center', valign: 'middle'
    });

    slide.addText(item.title, {
      x: x + 1.25, y: y + 0.25, w: 4.3, h: 0.4,
      fontSize: 13.5, bold: true, color: C_DARK,
      valign: 'middle'
    });
    slide.addText(item.desc, {
      x: x + 1.25, y: y + 0.65, w: 4.3, h: 0.45,
      fontSize: 10.5, color: C_MUTED,
      valign: 'middle'
    });
  });
}

// SLIDE 3: 도입 배경 (통계 이미지 삽입)
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "MARKET BACKGROUND", "01. 도입 배경 및 시장 현황", "통학버스 사고 데이터 및 수기 운영의 한계 극복");

  slide.addImage({
    path: statChartImgPath,
    x: 0.8, y: 1.95, w: 7.2, h: 4.8
  });

  const cards = [
    {
      title: "통학버스 안전 사고의 64.2%가 승하차 중 발생",
      desc: "어린이 체구 특성상 운전자의 사각지대가 발생하며, 길거리 대기 시간이 길어질수록 돌발 사고 위험이 급격히 증가합니다."
    },
    {
      title: "수기 명단 관리로 인한 38.7%의 전달 착오",
      desc: "전화나 메신저로 급작스럽게 전달되는 결석/탑승지 변경 사항이 누락되어 헛걸음 운행 및 학부모 민원이 상시 발생합니다."
    },
    {
      title: "학원 관리자의 과도한 배차 시간 낭비",
      desc: "신학기나 시간표 변경 시마다 관리자가 지도를 보며 몇 시간씩 수기로 노선을 짜야 하는 행정 비효율이 존재합니다."
    }
  ];

  cards.forEach((c, idx) => {
    const y = 1.95 + idx * 1.62;
    slide.addShape(pptx.ShapeType.rect, {
      x: 8.2, y: y, w: 4.333, h: 1.48,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });
    slide.addText(c.title, {
      x: 8.4, y: y + 0.15, w: 3.95, h: 0.35,
      fontSize: 11.5, bold: true, color: '1E3A8A'
    });
    slide.addText(c.desc, {
      x: 8.4, y: y + 0.55, w: 3.95, h: 0.8,
      fontSize: 9.8, color: C_BODY, lineSpacingMultiple: 1.15
    });
  });
}

// SLIDE 4: 전체 서비스 구상도 (구상도 이미지 삽입)
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "SERVICE ARCHITECTURE", "02. 전체 서비스 구상도 및 구조", "학원 관리자, 통학버스 기사, 학부모를 하나로 연결하는 클라우드 생태계");

  slide.addImage({
    path: archDiagramImgPath,
    x: 0.8, y: 1.95, w: 11.733, h: 3.75
  });

  const roleCards = [
    {
      role: "학원 관리자 (웹 대시보드)",
      desc: "원생 명단 엑셀 업로드, 5초 만에 생성되는 최적 배차 노선 승인, 실시간 전 차량 운행 상태 모니터링"
    },
    {
      role: "통학버스 기사 (모바일 앱)",
      desc: "최적화된 정류장 순서 TMap 네비게이션 자동 안내, 탑승 명단 확인 및 승하차 태깅, 운행 종료 후 잔류 체크"
    },
    {
      role: "학부모 (모바일 앱)",
      desc: "셔틀 실시간 위치 확인, 10분/3분 전 도착 예정 사전 푸시 알림 수신, 당일 결석/미탑승 1초 신청"
    }
  ];

  roleCards.forEach((rc, idx) => {
    const x = 0.8 + idx * 3.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 5.85, w: 3.8, h: 1.05,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });
    slide.addText(rc.role, {
      x: x + 0.2, y: 5.95, w: 3.4, h: 0.25,
      fontSize: 11, bold: true, color: '1E3A8A'
    });
    slide.addText(rc.desc, {
      x: x + 0.2, y: 6.22, w: 3.4, h: 0.6,
      fontSize: 9.2, color: C_BODY, lineSpacingMultiple: 1.1
    });
  });
}

// SLIDE 5: 핵심 기능 ①
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "ROUTE OPTIMIZATION", "03. 핵심 기능 ① : 스마트 동적 노선 최적화", "원생 주소 입력만으로 5초 만에 완성되는 인공지능 기반 최적 배차");

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.95, w: 11.733, h: 0.65,
    fill: { color: 'EFF6FF' },
    line: { color: 'BFDBFE', width: 1 }
  });
  slide.addText("혁신적 성과 : 수기 배차 2시간 → 단 5초 완료  |  차량 총 주행 거리 28% 단축  |  유류비 및 차량 유지보수 비용 대폭 절감", {
    x: 1.0, y: 1.95, w: 11.333, h: 0.65,
    fontSize: 11.5, bold: true, color: '1E3A8A', valign: 'middle'
  });

  const cards = [
    {
      title: "정밀 주소 지오코딩",
      points: [
        "네이버 지도 API를 활용한 원생 자택 주소의 고정밀 좌표 자동 변환",
        "유치원/학원 통학권 외 이상 좌표 자동 탐지 및 오류 사전 방지",
        "반복 조회 주소 캐싱으로 고속 처리 및 안정성 확보"
      ]
    },
    {
      title: "지능형 공간 클러스터링",
      points: [
        "차량 대수 및 정원 한계(15인승, 25인승 등)를 고려한 최적 균등 분할",
        "아이들이 차량에 탑승해 있는 체류 시간을 최소화하는 공간 군집 생성",
        "등원/하원 시간대별 유연한 인원 배분 알고리즘"
      ]
    },
    {
      title: "실시간 교통량 반영 TSP 순회",
      points: [
        "U턴이나 막다른 골목을 방지하는 Convex Hull 외곽 순회 경로 설계",
        "SK TMap 실시간 교통 정보를 반영한 정확한 예상 도착 시간(ETA) 제공",
        "기사 단말기용 직관적 턴바이턴 네비게이션 연동"
      ]
    }
  ];

  cards.forEach((c, idx) => {
    const x = 0.8 + idx * 3.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 2.8, w: 3.8, h: 3.9,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.25, y: 3.0, w: 3.3, h: 0.45,
      fill: { color: C_ACCENT }
    });
    slide.addText(c.title, {
      x: x + 0.25, y: 3.0, w: 3.3, h: 0.45,
      fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
    });
    const body = c.points.map(p => `• ${p}`).join('\n\n');
    slide.addText(body, {
      x: x + 0.25, y: 3.65, w: 3.3, h: 2.8,
      fontSize: 10, color: C_BODY, lineSpacingMultiple: 1.2
    });
  });
}

// SLIDE 6: 핵심 기능 ②
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "SAFETY & LBS", "04. 핵심 기능 ② : 실시간 위치 관제 & 안심 알림", "거리 대기 시간 제로화 및 어린이 차량 방치 사고 원천 차단");

  const blocks = [
    {
      title: "지오펜스 기반 3단계 사전 도착 알림",
      items: [
        "1단계 (10분 전) : 차량이 2km 반경 진입 시 '등원 준비' 안내",
        "2단계 (3분 전) : 차량이 500m 반경 진입 시 '정류장 이동' 안내",
        "3단계 (도착 완료) : 승하차 태깅 시 즉시 안전 확인 알림 전송",
        "효과 : 도로변 위험 대기 시간 80% 감소 및 학부모 불안감 해소"
      ]
    },
    {
      title: "안전 하차 검증 및 차량 잔류 감지",
      items: [
        "기사 앱에서 탑승 원생 전원 하차 완료 여부를 체크리스트로 최종 확인",
        "미하차 원생 잔류 시 차량 종료 불가 및 기사 앱 경고음 발생",
        "관리자 관제실에 실시간 미하차 비상 알림 팝업 전송",
        "효과 : 폭염/한파 시 차량 내 어린이 방치 인명 사고 원천 예방"
      ]
    }
  ];

  blocks.forEach((b, idx) => {
    const x = 0.8 + idx * 5.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 5.75, h: 4.8,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });
    slide.addText(b.title, {
      x: x + 0.3, y: 2.2, w: 5.15, h: 0.4,
      fontSize: 13, bold: true, color: '1E3A8A'
    });
    slide.addShape(pptx.ShapeType.line, {
      x: x + 0.3, y: 2.7, w: 5.15, h: 0,
      line: { color: 'CBD5E1', width: 1 }
    });
    const content = b.items.map(it => `• ${it}`).join('\n\n');
    slide.addText(content, {
      x: x + 0.3, y: 2.9, w: 5.15, h: 3.5,
      fontSize: 10.5, color: C_BODY, lineSpacingMultiple: 1.2
    });
  });
}

// SLIDE 7: 핵심 기능 ③
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "ENTERPRISE READY", "05. 핵심 기능 ③ : 엑셀 일괄 연동 & 철저한 보안 체계", "현장 실무자를 위한 직관적 데이터 도구 및 민감 정보 보호");

  const blocks = [
    {
      title: "기존 학원 엑셀 서식 100% 호환",
      items: [
        "복합 헤더 자동 파싱 : 이름, 주소, 시간표가 섞인 복잡한 기존 서식을 원클릭 업로드",
        "전체 노선 일괄 다운로드 : 배차 결과를 운전 기사용 출력물 및 학원 보관용 엑셀로 즉시 추출",
        "실시간 유효성 검사 : 전화번호 형식, 오타 주소를 즉시 표시하여 관리자 수정 유도"
      ]
    },
    {
      title: "Google OTP 기반 2-Factor 인증",
      items: [
        "아이들의 집 주소와 학부모 연락처 등 민감 개인정보 철저 보호",
        "Google Authenticator 6자리 일회용 번호로 관리자 로그인 보안 강화",
        "기사 및 교직원 계정별 세분화된 접근 권한 관리(RBAC)"
      ]
    }
  ];

  blocks.forEach((b, idx) => {
    const x = 0.8 + idx * 5.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 1.95, w: 5.75, h: 4.8,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });
    slide.addText(b.title, {
      x: x + 0.3, y: 2.2, w: 5.15, h: 0.4,
      fontSize: 13, bold: true, color: '1E3A8A'
    });
    slide.addShape(pptx.ShapeType.line, {
      x: x + 0.3, y: 2.7, w: 5.15, h: 0,
      line: { color: 'CBD5E1', width: 1 }
    });
    const content = b.items.map(it => `• ${it}`).join('\n\n');
    slide.addText(content, {
      x: x + 0.3, y: 2.9, w: 5.15, h: 3.5,
      fontSize: 10.5, color: C_BODY, lineSpacingMultiple: 1.2
    });
  });
}

// SLIDE 8: 도입 효과
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "VALUE & SUMMARY", "06. 도입 효과 및 비즈니스 가치", "안전, 효율, 신뢰의 3대 핵심 가치 실현");

  const cards = [
    { num: "01", title: "안전성 극대화", desc: "실시간 위치 알림과 차량 잔류 방지 시스템으로 학부모 불안감 해소 및 인명 사고 ZERO 달성" },
    { num: "02", title: "운영 비용 절감", desc: "최적 경로 주행으로 통학버스 유류비 20% 이상 절감 및 노선 작성 시간 99% 단축" },
    { num: "03", title: "학원 행정 효율화", desc: "등하원 관련 단순 문의 전화 급감 및 엑셀 일괄 연동을 통한 교직원의 본업 집중도 제고" },
    { num: "04", title: "원생 유치 경쟁력 강화", desc: "안심 스마트 통학 인프라를 통해 학부모의 신뢰를 확보하고 학원 브랜드 가치 상승" }
  ];

  cards.forEach((v, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 0.8 + col * 5.95;
    const y = 1.95 + row * 1.85;

    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: y, w: 5.75, h: 1.65,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.25, y: y + 0.25, w: 0.65, h: 0.65,
      fill: { color: C_ACCENT }
    });
    slide.addText(v.num, {
      x: x + 0.25, y: y + 0.25, w: 0.65, h: 0.65,
      fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
    });

    slide.addText(v.title, {
      x: x + 1.05, y: y + 0.22, w: 4.5, h: 0.35,
      fontSize: 13, bold: true, color: '1E3A8A'
    });

    slide.addText(v.desc, {
      x: x + 1.05, y: y + 0.62, w: 4.5, h: 0.85,
      fontSize: 10, color: C_BODY, lineSpacingMultiple: 1.15
    });
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 5.85, w: 11.733, h: 0.95,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', width: 1.5 }
  });
  slide.addText("아이들의 안전한 내일을 만드는 스마트 셔틀, TakeMe가 함께합니다.", {
    x: 1.0, y: 5.85, w: 11.333, h: 0.95,
    fontSize: 15, bold: true, color: C_DARK, align: 'center', valign: 'middle'
  });
}

// PPTX 저장
const outputPath = path.resolve(__dirname, '../TakeMe_서비스_소개서_v3.pptx');
pptx.writeFile({ fileName: outputPath })
  .then(() => {
    console.log('SUCCESS: Intro PPTX v3 created at', outputPath);
  })
  .catch((err) => {
    console.error('ERROR creating Intro PPTX:', err);
  });
