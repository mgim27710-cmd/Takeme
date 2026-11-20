const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const pptx = new pptxgen();

// 16:9 와이드스크린 표준 (13.333 x 7.5 인치)
pptx.defineLayout({ name: 'CUSTOM_16_9', width: 13.333, height: 7.5 });
pptx.layout = 'CUSTOM_16_9';

// 컬러 팔레트 (화이트 & 고대비 클린 테마)
const C_BG = 'FFFFFF';
const C_CARD_BG = 'F8FAFC';
const C_CARD_BORDER = 'E2E8F0';
const C_PRIMARY = '1E3A8A';       // 네이비 블루
const C_ACCENT = '2563EB';        // 비비드 블루
const C_DARK = '0F172A';          // 진한 타이틀 텍스트
const C_BODY = '334155';          // 본문 텍스트
const C_MUTED = '64748B';         // 부가 설명
const C_TAG_BG = 'EFF6FF';        // 태그 배경
const C_TAG_BORDER = 'BFDBFE';    // 태그 보더
const C_TAG_TEXT = '1D4ED8';      // 태그 텍스트

const statChartImgPath = path.resolve(__dirname, '../slide_assets/stat_chart.png');
const flowImgPath = path.resolve(__dirname, '../slide_assets/system_interaction_flow.png');

console.log('statChart exists:', fs.existsSync(statChartImgPath));

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

  slide.addText("2026학년도 졸업작품 심사 | 3조 SafeBack (TakeMe)", {
    x: 0.8, y: 7.05, w: 8.0, h: 0.3,
    fontSize: 9, color: '94A3B8'
  });
  slide.addText("어린이 안심 통학버스 스마트 솔루션", {
    x: 8.8, y: 7.05, w: 3.733, h: 0.3,
    fontSize: 9, color: '94A3B8', align: 'right'
  });
}

// ==========================================
// SLIDE 1: 표지 (Cover)
// ==========================================
{
  const slide = pptx.addSlide();
  slide.background = { color: C_BG };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.15,
    fill: { color: C_ACCENT }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 1.2, y: 1.6, w: 3.2, h: 0.38,
    fill: { color: C_TAG_BG },
    line: { color: C_TAG_BORDER, width: 1 }
  });
  slide.addText("2026학년도 컴퓨터공학 졸업작품", {
    x: 1.2, y: 1.6, w: 3.2, h: 0.38,
    fontSize: 11, bold: true, color: C_TAG_TEXT,
    align: 'center', valign: 'middle'
  });

  slide.addText("TakeMe : 어린이 안심 통학버스 솔루션", {
    x: 1.15, y: 2.15, w: 11.0, h: 1.1,
    fontSize: 34, bold: true, color: C_DARK,
    valign: 'middle'
  });

  slide.addText("GIS 기반 동적 배차 최적화 및 양방향 실시간 위치·승하차 안심 관리 시스템", {
    x: 1.2, y: 3.25, w: 11.0, h: 0.5,
    fontSize: 16, color: C_ACCENT, bold: true
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 1.2, y: 3.9, w: 10.933, h: 0,
    line: { color: 'CBD5E1', width: 1.5 }
  });

  const badges = [
    { title: "GIS 최적화", desc: "K-Means & TSP 알고리즘 노선 단축 28%" },
    { title: "실시간 안심 관제", desc: "WebSocket 기반 지오펜스 3단계 도착 알림" },
    { title: "현장 밀착형 솔루션", desc: "Google OTP 보안 & 엑셀 양방향 원클릭 연동" }
  ];
  badges.forEach((b, idx) => {
    const bx = 1.2 + idx * 3.75;
    slide.addShape(pptx.ShapeType.rect, {
      x: bx, y: 4.2, w: 3.45, h: 1.2,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });
    slide.addText(b.title, {
      x: bx + 0.25, y: 4.35, w: 3.0, h: 0.3,
      fontSize: 13, bold: true, color: C_PRIMARY
    });
    slide.addText(b.desc, {
      x: bx + 0.25, y: 4.7, w: 3.0, h: 0.55,
      fontSize: 10.5, color: C_BODY
    });
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 1.2, y: 5.7, w: 10.933, h: 0.8,
    fill: { color: 'F1F5F9' },
    line: { color: 'E2E8F0', width: 1 }
  });
  slide.addText("발표팀: 3조 SafeBack  |  팀원: 고상현, 김민규, 윤찬영  |  발표일시: 2026. 11", {
    x: 1.4, y: 5.7, w: 10.5, h: 0.8,
    fontSize: 12, bold: true, color: C_DARK, valign: 'middle'
  });
}

// ==========================================
// SLIDE 2: 목차 (Table of Contents)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "AGENDA", "목차 (Presentation Outline)", "3~5분 발표 기준 주요 핵심 논리 및 개발 추진 체계");

  const contents = [
    { num: "01", title: "개발 배경 및 문제 정의", desc: "통학버스 사고 통계 및 선행 연구 기반 문제점 도출" },
    { num: "02", title: "시스템 기능 구성 및 상호작용 흐름", desc: "관리자 - 코어 엔진 - 기사 - 학부모 간 데이터 흐름도" },
    { num: "03", title: "핵심 기술 ① : GIS 공간 군집 및 노선 최적화", desc: "K-Means 공간 클러스터링 & TSP 외곽 순회 알고리즘" },
    { num: "04", title: "핵심 기술 ② : 실시간 LBS 관제 & 안심 알림", desc: "WebSocket 양방향 브로드캐스팅 및 지오펜스 3단계 알림" },
    { num: "05", title: "핵심 기술 ③ : 보안 체계 & 엑셀 자동 연동", desc: "Google OTP 2단계 인증 및 2행 헤더 엑셀 대용량 I/O" },
    { num: "06", title: "프로젝트 개발 일정 및 추진 마일스톤", desc: "요구분석, 모델링, 개발, 테스트 및 배포 4단계 추진 내역" },
    { num: "07", title: "기대 효과 및 결론 (Q&A)", desc: "정량적·정성적 기대 효과 및 심사위원 질의응답" }
  ];

  contents.forEach((item, idx) => {
    const isBottomRow = idx >= 6;
    let x, y, w;
    if (!isBottomRow) {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      x = 0.8 + col * 5.95;
      y = 1.95 + row * 1.25;
      w = 5.75;
    } else {
      // 7번째 항목은 중앙 또는 하단에 배치
      x = 0.8;
      y = 1.95 + 3 * 1.25;
      w = 11.7;
    }

    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: y, w: w, h: 1.1,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.2, y: y + 0.18, w: 0.75, h: 0.75,
      fill: { color: C_ACCENT }
    });
    slide.addText(item.num, {
      x: x + 0.2, y: y + 0.18, w: 0.75, h: 0.75,
      fontSize: 16, bold: true, color: 'FFFFFF',
      align: 'center', valign: 'middle'
    });

    slide.addText(item.title, {
      x: x + 1.1, y: y + 0.18, w: w - 1.3, h: 0.35,
      fontSize: 13, bold: true, color: C_DARK,
      valign: 'middle'
    });
    slide.addText(item.desc, {
      x: x + 1.1, y: y + 0.55, w: w - 1.3, h: 0.4,
      fontSize: 10, color: C_MUTED,
      valign: 'middle'
    });
  });
}

// ==========================================
// SLIDE 3: 개발 배경 및 문제 정의 (통계 & 논문 이미지 삽입)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "PROBLEM STATEMENT", "01. 개발 배경 및 문제 정의", "도로교통공단 사고 통계 및 학술 연구 기반 실증 분석");

  slide.addImage({
    path: statChartImgPath,
    x: 0.8, y: 1.95, w: 7.2, h: 4.8
  });

  const problems = [
    {
      title: "1. 승하차 사각지대 및 실시간 위치 부재",
      points: [
        "사고의 64.2%가 차량 승하차 및 주변 사각지대에서 집중 발생",
        "보호자는 셔틀의 정확한 도착 시각 및 승하차 여부를 인지 불가",
        "차량 내 어린이 잔류/방치 사고 위험 상존"
      ]
    },
    {
      title: "2. 수기 명단 관리로 인한 인적 오류 (38.7%)",
      points: [
        "기사·선생님 간 종이/카카오톡 수기 전달 시 정보 누락 빈발",
        "당일 결석/탑승지 변경 사항이 운전 기사에게 실시간 미반영",
        "TakeMe 디지털 동기화 도입 시 전달 오류율 0% 달성"
      ]
    },
    {
      title: "3. 비효율적인 수동 노선 작성 & 유류비 낭비",
      points: [
        "원생 신규 등록 시마다 관리자가 지도를 보며 2시간 이상 수동 배차",
        "비효율적 우회 노선으로 통학 시간 증가 및 유류비·탄소 배출 증가"
      ]
    }
  ];

  problems.forEach((p, idx) => {
    const y = 1.95 + idx * 1.62;
    slide.addShape(pptx.ShapeType.rect, {
      x: 8.2, y: y, w: 4.333, h: 1.48,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });

    slide.addText(p.title, {
      x: 8.4, y: y + 0.12, w: 3.95, h: 0.32,
      fontSize: 12, bold: true, color: C_PRIMARY
    });

    const bodyText = p.points.map(pt => `• ${pt}`).join('\n');
    slide.addText(bodyText, {
      x: 8.4, y: y + 0.45, w: 3.95, h: 0.95,
      fontSize: 9.8, color: C_BODY, lineSpacingMultiple: 1.15
    });
  });
}

// ==========================================
// SLIDE 4: 시스템 기능 구성 및 실시간 상호작용 흐름도 (상호작용 이미지 삽입)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "SYSTEM ARCHITECTURE & FLOW", "02. 시스템 기능 구성 및 실시간 상호작용 흐름도", "각 참여자별 탑재 기능 및 데이터 송수신 실시간 인터랙션 다이어그램");

  // 중앙: 고해상도 기능 상호작용 다이어그램 이미지 삽입
  slide.addImage({
    path: flowImgPath,
    x: 0.8, y: 1.9, w: 11.733, h: 4.95
  });
}

// ==========================================
// SLIDE 5: 핵심 기술 ① - GIS 공간 군집 및 배차 최적화
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "CORE ALGORITHM", "03. 핵심 기술 ① : GIS 공간 군집 및 배차 최적화", "K-Means 공간 클러스터링과 볼록 껍질(Convex Hull) TSP 최단 경로 알고리즘");

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.95, w: 11.733, h: 0.65,
    fill: { color: 'EFF6FF' },
    line: { color: 'BFDBFE', width: 1 }
  });
  slide.addText("알고리즘 최적화 결과 : 수동 배차 시간 2시간 → 5초 자동화  |  총 이동 경로 28% 단축  |  차량별 정원 균등 분배(Load Balancing)", {
    x: 1.0, y: 1.95, w: 11.333, h: 0.65,
    fontSize: 11.5, bold: true, color: C_PRIMARY, valign: 'middle'
  });

  const steps = [
    {
      step: "STEP 1",
      name: "좌표 지오코딩 & 이상치 필터링",
      items: [
        "원생 주소를 Naver Maps Geocoding API로 위·경도(WGS84) 변환",
        "비정상 주소 및 통학 불가 영역(반경 20km 초과) 자동 감지 및 예외 처리",
        "정류장 후보지 캐싱을 통한 API 호출 비용 70% 절감"
      ]
    },
    {
      step: "STEP 2",
      name: "K-Means 공간 클러스터링",
      items: [
        "차량 수(K) 및 탑승 가능 정원 제약 조건 반영 공간 군집화",
        "유클리드 거리 + 도로 실제 주행 가중치를 결합한 클러스터 형성",
        "군집별 인원 편차를 최소화하는 동적 리밸런싱(Rebalancing) 적용"
      ]
    },
    {
      step: "STEP 3",
      name: "Convex Hull & TSP 노선 생성",
      items: [
        "외곽 정류장을 잇는 Convex Hull(볼록 껍질) 형성으로 U턴 방지",
        "2-Opt TSP 알고리즘으로 군집 내 승하차 순서 최단 경로 산출",
        "SK TMap 실시간 교통량 API와 연계한 신뢰도 높은 예상 도착 시각(ETA)"
      ]
    }
  ];

  steps.forEach((s, idx) => {
    const x = 0.8 + idx * 3.95;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 2.8, w: 3.8, h: 3.9,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.25, y: 3.0, w: 1.1, h: 0.35,
      fill: { color: C_ACCENT }
    });
    slide.addText(s.step, {
      x: x + 0.25, y: 3.0, w: 1.1, h: 0.35,
      fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
    });

    slide.addText(s.name, {
      x: x + 0.25, y: 3.45, w: 3.3, h: 0.5,
      fontSize: 13, bold: true, color: C_DARK
    });

    slide.addShape(pptx.ShapeType.line, {
      x: x + 0.25, y: 4.05, w: 3.3, h: 0,
      line: { color: 'E2E8F0', width: 1 }
    });

    const bodyStr = s.items.map(it => `• ${it}`).join('\n\n');
    slide.addText(bodyStr, {
      x: x + 0.25, y: 4.2, w: 3.3, h: 2.3,
      fontSize: 10, color: C_BODY, lineSpacingMultiple: 1.15
    });
  });
}

// ==========================================
// SLIDE 6: 핵심 기술 ② - 실시간 LBS 관제 & 안심 알림
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "REAL-TIME IoT & LBS", "04. 핵심 기술 ② : 실시간 LBS 관제 & 다단계 안심 알림", "초저지연 WebSocket 통신 기반 실시간 위치 스트리밍 및 승하차 안전 관리");

  // 좌측: 3단계 지오펜스 알림 체계
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.95, w: 5.75, h: 4.8,
    fill: { color: C_CARD_BG },
    line: { color: C_CARD_BORDER, width: 1 }
  });
  slide.addText("📍 지오펜스(Geo-fence) 3단계 도착 알림 시스템", {
    x: 1.05, y: 2.15, w: 5.25, h: 0.4,
    fontSize: 13, bold: true, color: C_PRIMARY
  });

  const alerts = [
    { step: "1단계 (10분 전)", desc: "등하원 준비 알림 : 버스가 반경 2km 지오펜스 진입 시 보호자 푸시 발송", color: "2563EB" },
    { step: "2단계 (3분 전)", desc: "탑승지 이동 알림 : 반경 500m 진입 시 정류장 대기 안내 (노상 대기시간 단축)", color: "0284C7" },
    { step: "3단계 (도착 완료)", desc: "승하차 확인 알림 : NFC/QR 태깅 즉시 탑승/하차 상태 및 시각 실시간 전송", color: "16A34A" }
  ];

  alerts.forEach((a, i) => {
    const ay = 2.75 + i * 1.25;
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.05, y: ay, w: 5.25, h: 1.05,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.2, y: ay + 0.15, w: 1.5, h: 0.3,
      fill: { color: a.color }
    });
    slide.addText(a.step, {
      x: 1.2, y: ay + 0.15, w: 1.5, h: 0.3,
      fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
    });
    slide.addText(a.desc, {
      x: 1.2, y: ay + 0.5, w: 4.95, h: 0.45,
      fontSize: 9.8, color: C_BODY
    });
  });

  // 우측: 실시간 양방향 브로드캐스팅 & 잔류 감지
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.783, y: 1.95, w: 5.75, h: 4.8,
    fill: { color: C_CARD_BG },
    line: { color: C_CARD_BORDER, width: 1 }
  });
  slide.addText("⚡ 초저지연 WebSocket 관제 & 잔류 방지 체계", {
    x: 7.033, y: 2.15, w: 5.25, h: 0.4,
    fontSize: 13, bold: true, color: C_PRIMARY
  });

  const techFeatures = [
    {
      title: "WebSocket(Socket.IO) 0.2초 초저지연 브로드캐스팅",
      desc: "기사 모바일 단말의 GPS 좌표 스트림을 수신 즉시 해당 노선의 보호자/관리자 소켓 룸(Room)에 선별적 전송하여 서버 부하 85% 절감"
    },
    {
      title: "차량 내 아동 방치 방지 (잔류 인원 제로화 체크)",
      desc: "운행 종료 시 탑승 인원과 하차 인원 수동/자동 매칭. 미하차 원생 존재 시 기사 앱 강제 경고음 발생 및 관리자 대시보드 비상 알림"
    },
    {
      title: "당일 미탑승/결석 실시간 반영",
      desc: "학부모가 앱에서 '오늘 미탑승' 신청 시 배차 경로에서 해당 정류장 즉시 바이패스(Bypass) 처리하여 불필요한 공회전 방지"
    }
  ];

  techFeatures.forEach((tf, i) => {
    const ty = 2.75 + i * 1.25;
    slide.addShape(pptx.ShapeType.rect, {
      x: 7.033, y: ty, w: 5.25, h: 1.05,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(tf.title, {
      x: 7.2, y: ty + 0.12, w: 4.9, h: 0.28,
      fontSize: 11, bold: true, color: C_DARK
    });
    slide.addText(tf.desc, {
      x: 7.2, y: ty + 0.42, w: 4.9, h: 0.55,
      fontSize: 9.3, color: C_BODY, lineSpacingMultiple: 1.15
    });
  });
}

// ==========================================
// SLIDE 7: 핵심 기술 ③ - 2단계 보안 체계 & 대용량 엑셀 연동
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "SECURITY & INTEGRATION", "05. 핵심 기술 ③ : 2단계 보안 체계 & 대용량 데이터 연동", "실제 교육 기관 도입을 위한 Google OTP 보안 인증 및 현장 엑셀 양방향 파싱");

  // 좌측 카드: Google OTP
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.95, w: 5.75, h: 4.8,
    fill: { color: C_CARD_BG },
    line: { color: C_CARD_BORDER, width: 1 }
  });
  slide.addText("🔐 Google Authenticator 기반 2-Factor Authentication", {
    x: 1.05, y: 2.15, w: 5.25, h: 0.4,
    fontSize: 13, bold: true, color: C_PRIMARY
  });

  const otpPoints = [
    { title: "RFC 6238 표준 TOTP 알고리즘 준수", desc: "시간 기반 30초 주기 동적 일회용 비밀번호(6자리) 생성으로 패스워드 탈취 공격 원천 차단" },
    { title: "관리자 / 기사 권한 분리 및 접근 제어", desc: "원생 민감 정보(주소, 학부모 연락처)에 접근하는 관리자 계정에 대해 OTP 인증 강제화" },
    { title: "QR 코드 간편 등록 & 백업 복구 코드", desc: "최초 로그인 시 모바일 OTP 앱으로 QR 스캔 3초 등록, 분실 대비 8자리 일회성 복구 토큰 발급" }
  ];

  otpPoints.forEach((op, i) => {
    const y = 2.75 + i * 1.25;
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.05, y: y, w: 5.25, h: 1.05,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(op.title, {
      x: 1.2, y: y + 0.12, w: 4.95, h: 0.28,
      fontSize: 11, bold: true, color: C_DARK
    });
    slide.addText(op.desc, {
      x: 1.2, y: y + 0.42, w: 4.95, h: 0.55,
      fontSize: 9.3, color: C_BODY, lineSpacingMultiple: 1.15
    });
  });

  // 우측 카드: 엑셀 연동
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.783, y: 1.95, w: 5.75, h: 4.8,
    fill: { color: C_CARD_BG },
    line: { color: C_CARD_BORDER, width: 1 }
  });
  slide.addText("📊 대용량 엑셀 양방향 자동 연동 엔진 (Excel Engine)", {
    x: 7.033, y: 2.15, w: 5.25, h: 0.4,
    fontSize: 13, bold: true, color: C_PRIMARY
  });

  const excelPoints = [
    { title: "학원 ERP 호환 2행 복합 헤더 자동 파싱", desc: "시중 학원 관리 프로그램의 복합 헤더(성명, 보호자, 주소, 탑승희망시간)를 자동 정규화 매핑" },
    { title: "전체 차량·노선별 탑승자 일괄 다운로드", desc: "DB의 다대다 관계 데이터를 ExcelJS를 통해 다중 시트 및 노선별 정렬 포맷으로 원클릭 내보내기" },
    { title: "실시간 데이터 유효성 검증 (Validation Pipeline)", desc: "전화번호 양식, 주소 누락 여부를 클라이언트 & 서버에서 이중 검증하여 데이터 무결성 보장" }
  ];

  excelPoints.forEach((ep, i) => {
    const y = 2.75 + i * 1.25;
    slide.addShape(pptx.ShapeType.rect, {
      x: 7.033, y: y, w: 5.25, h: 1.05,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(ep.title, {
      x: 7.2, y: y + 0.12, w: 4.95, h: 0.28,
      fontSize: 11, bold: true, color: C_DARK
    });
    slide.addText(ep.desc, {
      x: 7.2, y: y + 0.42, w: 4.95, h: 0.55,
      fontSize: 9.3, color: C_BODY, lineSpacingMultiple: 1.15
    });
  });
}

// ==========================================
// SLIDE 8: 프로젝트 개발 일정 및 추진 마일스톤 (신규 개발 일정 슬라이드!)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "DEVELOPMENT TIMELINE", "06. 프로젝트 개발 일정 및 추진 마일스톤", "총 14주간의 요구분석, 알고리즘 모델링, 풀스택 구현 및 현장 검증 로드맵");

  // 상단 진행 프로세스 가이드 바 (4단계)
  const phases = [
    { num: "Phase 1 (1~3주)", title: "기획 & 알고리즘 모델링", color: "3B82F6" },
    { num: "Phase 2 (4~7주)", title: "코어 백엔드 & GIS 엔진", color: "4F46E5" },
    { num: "Phase 3 (8~11주)", title: "프론트 대시보드 & 모바일 앱", color: "059669" },
    { num: "Phase 4 (12~14주)", title: "통합 테스트 & 클라우드 배포", color: "D97706" }
  ];

  phases.forEach((ph, idx) => {
    const px = 0.8 + idx * 2.96;
    slide.addShape(pptx.ShapeType.rect, {
      x: px, y: 1.95, w: 2.85, h: 0.5,
      fill: { color: C_CARD_BG },
      line: { color: ph.color, width: 1.5 }
    });
    slide.addText(`${ph.num} : ${ph.title}`, {
      x: px, y: 1.95, w: 2.85, h: 0.5,
      fontSize: 10, bold: true, color: C_DARK, align: 'center', valign: 'middle'
    });
  });

  // 상세 4개 카드 (단계별 상세 업무 & 산출물)
  const phaseDetails = [
    {
      phase: "Phase 1",
      period: "1~3주차",
      title: "요구분석 & 알고리즘 설계",
      color: "3B82F6",
      tasks: [
        "도로교통공단 통학버스 사고 데이터 및 학원 운영 현장 인터뷰",
        "K-Means 공간 군집화 & Convex Hull 최단 순회 알고리즘 수학적 모델링",
        "PostgreSQL 16 E-R 다이어그램 및 RESTful API 엔드포인트 명세서 작성"
      ],
      output: "산출물 : 요구사항 명세서, 알고리즘 시뮬레이션 모델, DB 설계서"
    },
    {
      phase: "Phase 2",
      period: "4~7주차",
      title: "백엔드 코어 & GIS 인프라",
      color: "4F46E5",
      tasks: [
        "NestJS 11 기반 모듈형 API 아키텍처 및 TypeORM 엔티티 구축",
        "Naver Maps Geocoding & SK TMap 실시간 교통량 API 연동 파이프라인 개발",
        "Socket.IO 기반 0.2초 초저지연 WebSocket 게이트웨이 및 지오펜스 판정 구현"
      ],
      output: "산출물 : 코어 백엔드 서버, 실시간 소켓 게이트웨이, GIS 연동 모듈"
    },
    {
      phase: "Phase 3",
      period: "8~11주차",
      title: "웹 대시보드 & 모바일 앱",
      color: "059669",
      tasks: [
        "React 19 & Tailwind CSS 기반 학원 관리자 반응형 웹 대시보드 구현",
        "2행 복합 헤더 엑셀 자동 파싱 및 일괄 다운로드 엔진(ExcelJS) 탑재",
        "Flutter 3 기반 기사용 앱(백그라운드 GPS, TMap 네비) 및 학부모 안심 앱 개발"
      ],
      output: "산출물 : 관리자 웹 대시보드, 기사·학부모 모바일 앱, Google OTP 보안"
    },
    {
      phase: "Phase 4",
      period: "12~14주차",
      title: "통합 테스트 & 최종 배포",
      color: "D97706",
      tasks: [
        "AWS EC2(Ubuntu), Docker, Nginx SSL(HTTPS/WSS) 클라우드 인프라 배포",
        "실제 차량 이동을 통한 GPS 추적 및 지오펜스 3단계 푸시 알림 현장 실증 테스트",
        "소켓 재연결 안정성, 대용량 동시 접속 부하 테스트 및 심사용 발표물 완성"
      ],
      output: "산출물 : AWS 라이브 배포 시스템, 최종 완료 보고서, 심사용 발표 자료"
    }
  ];

  phaseDetails.forEach((pd, idx) => {
    const x = 0.8 + idx * 2.96;
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 2.65, w: 2.85, h: 4.15,
      fill: { color: C_CARD_BG },
      line: { color: C_CARD_BORDER, width: 1 }
    });

    // 헤더 바
    slide.addShape(pptx.ShapeType.rect, {
      x: x, y: 2.65, w: 2.85, h: 0.65,
      fill: { color: 'F1F5F9' },
      line: { color: 'E2E8F0', width: 1 }
    });
    slide.addText(`${pd.phase} (${pd.period})`, {
      x: x + 0.15, y: 2.7, w: 2.55, h: 0.25,
      fontSize: 10, bold: true, color: pd.color
    });
    slide.addText(pd.title, {
      x: x + 0.15, y: 2.95, w: 2.55, h: 0.3,
      fontSize: 11.5, bold: true, color: C_DARK
    });

    // 주요 수행 과제 리스트
    const tasksText = pd.tasks.map(t => `• ${t}`).join('\n\n');
    slide.addText(tasksText, {
      x: x + 0.15, y: 3.45, w: 2.55, h: 2.5,
      fontSize: 9.3, color: C_BODY, lineSpacingMultiple: 1.15
    });

    // 하단 산출물 박스
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.12, y: 6.05, w: 2.61, h: 0.65,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText(pd.output, {
      x: x + 0.15, y: 6.07, w: 2.55, h: 0.6,
      fontSize: 8.8, bold: true, color: C_PRIMARY, valign: 'middle'
    });
  });
}

// ==========================================
// SLIDE 9: 기대 효과 및 질의응답 (Expected Effects & Q&A)
// ==========================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, "CONCLUSION & VALUE", "07. 기대 효과 및 결론 (Q&A)", "안전성 제고, 업무 생산성 혁신, 학부모 신뢰 구축 및 질의응답");

  const values = [
    {
      num: "01",
      title: "승하차 인명 사고 ZERO화",
      desc: "지오펜스 3단계 사전 알림으로 노상 대기 사각지대 해소 및 운행 종료 후 아동 잔류 감지 경보로 안전사고 원천 예방"
    },
    {
      num: "02",
      title: "배차 시간 99% & 이동거리 28% 절감",
      desc: "수기 2시간 배차 작업을 5초 이내 완전 자동화. K-Means/TSP 알고리즘으로 이동 거리와 공회전을 줄여 유류비 및 탄소 배출 저감"
    },
    {
      num: "03",
      title: "정보 전달 오류율 38.7% → 0% 달성",
      desc: "종이·구두 명단 대신 실시간 디지털 동기화 도입으로 당일 결석·탑승지 변경 누락 방지 및 운영 혼선 완전 해소"
    },
    {
      num: "04",
      title: "학부모 안심 및 교육기관 신뢰도 극대화",
      desc: "실시간 버스 위치 확인 및 탑승 태그 알림을 통해 학부모의 불안감 해소 및 교육 기관의 스마트 운영 경쟁력 강화"
    }
  ];

  values.forEach((v, idx) => {
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
      fontSize: 13, bold: true, color: C_PRIMARY
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
  slide.addText("경청해 주셔서 감사합니다.  |  질의응답 (Q&A)", {
    x: 1.0, y: 5.85, w: 11.333, h: 0.95,
    fontSize: 16, bold: true, color: C_DARK, align: 'center', valign: 'middle'
  });
}

// PPTX 저장
const outputPath = path.resolve(__dirname, '../SafeBack_졸업작품_발표자료_v4.pptx');
pptx.writeFile({ fileName: outputPath })
  .then(() => {
    console.log('SUCCESS: PPTX v4 created at', outputPath);
  })
  .catch((err) => {
    console.error('ERROR creating PPTX:', err);
  });
