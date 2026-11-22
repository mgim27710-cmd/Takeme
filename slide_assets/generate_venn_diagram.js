const fs = require('fs');
const path = require('path');
const { Resvg } = require('../scratch_pptx/node_modules/@resvg/resvg-js');

// 1600 x 1100 캔버스
const width = 1600;
const height = 1100;

// SVG 벤다이어그램 생성
const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 배경 그라데이션 -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC" />
      <stop offset="100%" stop-color="#F1F5F9" />
    </linearGradient>

    <!-- 원 1 그라데이션 (Client - 블루) -->
    <linearGradient id="clientGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#1D4ED8" stop-opacity="0.28" />
    </linearGradient>

    <!-- 원 2 그라데이션 (Server - 인디고/보라) -->
    <linearGradient id="serverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#6366F1" stop-opacity="0.28" />
    </linearGradient>

    <!-- 원 3 그라데이션 (Data & Cloud - 에메랄드/청록) -->
    <linearGradient id="dataGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#0D9488" stop-opacity="0.28" />
    </linearGradient>

    <!-- 중앙 코어 그라데이션 -->
    <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E3A8A" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>

    <!-- 필터: 그림자 효과 -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0F172A" flood-opacity="0.08" />
    </filter>
    <filter id="coreShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#1E3A8A" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- 전체 배경 -->
  <rect width="100%" height="100%" fill="url(#bgGrad)" />

  <!-- 상단 헤더 타이틀 영역 -->
  <g transform="translate(80, 50)">
    <!-- 뱃지 -->
    <rect x="0" y="0" width="220" height="34" rx="17" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5" />
    <text x="110" y="22" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="13" font-weight="bold" fill="#1D4ED8" text-anchor="middle">
      TakeMe SYSTEM INTERACTION
    </text>

    <!-- 메인 타이틀 -->
    <text x="0" y="70" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="28" font-weight="900" fill="#0F172A">
      통합 모빌리티 시스템 구성 및 상호작용 벤다이어그램
    </text>
    <text x="0" y="96" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="14" fill="#64748B">
      Client Apps, Core Engine, Data &amp; Cloud Storage 3대 축의 유기적 데이터 송수신 및 기능적 교집합
    </text>
  </g>

  <!-- ============================================================== -->
  <!-- 3대 메인 원 (벤다이어그램 바디) -->
  <!-- 중심점: C1(570, 480), C2(1030, 480), C3(800, 770) / 반지름 R = 330 -->
  <!-- ============================================================== -->
  <g>
    <!-- 원 1: 클라이언트 인터페이스 (Client Apps) -->
    <circle cx="570" cy="480" r="330" fill="url(#clientGrad)" stroke="#2563EB" stroke-width="2.5" />

    <!-- 원 2: 코어 엔진 & 실시간 통신 (Core Backend) -->
    <circle cx="1030" cy="480" r="330" fill="url(#serverGrad)" stroke="#7C3AED" stroke-width="2.5" />

    <!-- 원 3: 데이터 & 클라우드 스토리지 (Data & Cloud) -->
    <circle cx="800" cy="770" r="330" fill="url(#dataGrad)" stroke="#0D9488" stroke-width="2.5" />
  </g>

  <!-- ============================================================== -->
  <!-- 각 영역별 헤더 타이틀 & 배지 -->
  <!-- ============================================================== -->

  <!-- [영역 1 헤더] CLIENT APPS (좌측 상단) -->
  <g transform="translate(310, 210)">
    <rect x="-10" y="-8" width="280" height="42" rx="10" fill="#1D4ED8" filter="url(#shadow)" />
    <text x="130" y="18" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle">
      📱 CLIENT INTERFACES
    </text>
    <text x="130" y="52" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="12" font-weight="bold" fill="#1E40AF" text-anchor="middle">
      (사용자별 맞춤형 앱 &amp; 웹 콘솔)
    </text>
  </g>

  <!-- [영역 2 헤더] CORE SERVER & ENGINE (우측 상단) -->
  <g transform="translate(1010, 210)">
    <rect x="-10" y="-8" width="280" height="42" rx="10" fill="#6D28D9" filter="url(#shadow)" />
    <text x="130" y="18" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle">
      🚀 CORE ENGINE &amp; SERVER
    </text>
    <text x="130" y="52" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="12" font-weight="bold" fill="#5B21B6" text-anchor="middle">
      (백엔드 비즈니스 &amp; 실시간 제어)
    </text>
  </g>

  <!-- [영역 3 헤더] DATA & CLOUD STORAGE (하단 중앙) -->
  <g transform="translate(660, 1020)">
    <rect x="-10" y="-8" width="300" height="42" rx="10" fill="#0F766E" filter="url(#shadow)" />
    <text x="140" y="18" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle">
      💾 DATA &amp; CLOUD STORAGE
    </text>
    <text x="140" y="50" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="12" font-weight="bold" fill="#115E59" text-anchor="middle">
      (관계형 DB, 캐시 &amp; 오브젝트 저장소)
    </text>
  </g>

  <!-- ============================================================== -->
  <!-- 영역 1 독자 시스템 카드들 (Client Apps) -->
  <!-- ============================================================== -->
  <!-- 카드 1-1: React / Next.js 관리자 웹 -->
  <g transform="translate(320, 290)" filter="url(#shadow)">
    <rect width="210" height="66" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
    <rect x="12" y="13" width="40" height="40" rx="8" fill="#EFF6FF" />
    <text x="32" y="38" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="20" text-anchor="middle">💻</text>
    <text x="62" y="32" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="13" font-weight="800" fill="#0F172A">관리자 관제 웹</text>
    <text x="62" y="49" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10.5" fill="#64748B">React 18 / Next.js 14</text>
  </g>

  <!-- 카드 1-2: Flutter 기사 전용 내비 앱 -->
  <g transform="translate(290, 375)" filter="url(#shadow)">
    <rect width="210" height="66" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
    <rect x="12" y="13" width="40" height="40" rx="8" fill="#EFF6FF" />
    <text x="32" y="38" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="20" text-anchor="middle">🚌</text>
    <text x="62" y="32" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="13" font-weight="800" fill="#0F172A">기사 릴레이 내비</text>
    <text x="62" y="49" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10.5" fill="#64748B">Flutter / TMap SDK</text>
  </g>

  <!-- 카드 1-3: Flutter 지도교사 & 학부모 앱 -->
  <g transform="translate(310, 460)" filter="url(#shadow)">
    <rect width="220" height="74" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
    <rect x="12" y="17" width="40" height="40" rx="8" fill="#EFF6FF" />
    <text x="32" y="42" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="20" text-anchor="middle">👩‍🏫</text>
    <text x="62" y="34" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="12.5" font-weight="800" fill="#0F172A">지도교사 &amp; 학부모 앱</text>
    <text x="62" y="52" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" fill="#64748B">Flutter / NFC 태깅 / 푸시</text>
  </g>

  <!-- ============================================================== -->
  <!-- 영역 2 독자 시스템 카드들 (Core Engine & Server) -->
  <!-- ============================================================== -->
  <!-- 카드 2-1: NestJS 코어 REST API -->
  <g transform="translate(1070, 290)" filter="url(#shadow)">
    <rect width="210" height="66" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
    <rect x="12" y="13" width="40" height="40" rx="8" fill="#F5F3FF" />
    <text x="32" y="38" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="20" text-anchor="middle">🚀</text>
    <text x="62" y="32" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="13" font-weight="800" fill="#0F172A">NestJS 코어 서버</text>
    <text x="62" y="49" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10.5" fill="#64748B">Node.js / TypeScript</text>
  </g>

  <!-- 카드 2-2: Socket.IO 실시간 브로드캐스팅 -->
  <g transform="translate(1100, 375)" filter="url(#shadow)">
    <rect width="210" height="66" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
    <rect x="12" y="13" width="40" height="40" rx="8" fill="#F5F3FF" />
    <text x="32" y="38" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="20" text-anchor="middle">⚡</text>
    <text x="62" y="32" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="13" font-weight="800" fill="#0F172A">Socket.IO 브로커</text>
    <text x="62" y="49" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10.5" fill="#64748B">0.2초 초저지연 WebSocket</text>
  </g>

  <!-- 카드 2-3: TSP 2-Opt 최적화 & Google OTP -->
  <g transform="translate(1070, 460)" filter="url(#shadow)">
    <rect width="220" height="74" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
    <rect x="12" y="17" width="40" height="40" rx="8" fill="#F5F3FF" />
    <text x="32" y="42" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="20" text-anchor="middle">🧭</text>
    <text x="62" y="34" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="12.5" font-weight="800" fill="#0F172A">TSP 배차 &amp; OTP 보안</text>
    <text x="62" y="52" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" fill="#64748B">K-Means / TOTP 2단계</text>
  </g>

  <!-- ============================================================== -->
  <!-- 영역 3 독자 시스템 카드들 (Data & Cloud Storage) -->
  <!-- ============================================================== -->
  <!-- 카드 3-1: PostgreSQL 16 (PostGIS) -->
  <g transform="translate(560, 875)" filter="url(#shadow)">
    <rect width="225" height="72" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
    <rect x="12" y="16" width="40" height="40" rx="8" fill="#ECFDF5" />
    <text x="32" y="41" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="20" text-anchor="middle">🐘</text>
    <text x="62" y="34" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="13" font-weight="800" fill="#0F172A">PostgreSQL 16</text>
    <text x="62" y="52" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" fill="#047857">원생/노선/법정서식 RDBMS</text>
  </g>

  <!-- 카드 3-2: Redis 7 인메모리 캐시 -->
  <g transform="translate(815, 875)" filter="url(#shadow)">
    <rect width="225" height="72" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
    <rect x="12" y="16" width="40" height="40" rx="8" fill="#ECFDF5" />
    <text x="32" y="41" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="20" text-anchor="middle">🔴</text>
    <text x="62" y="34" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="13" font-weight="800" fill="#0F172A">Redis 7 (In-Memory)</text>
    <text x="62" y="52" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" fill="#047857">실시간 GPS 캐시 &amp; Pub/Sub</text>
  </g>

  <!-- 카드 3-3: AWS S3 & 클라우드 인프라 -->
  <g transform="translate(685, 960)" filter="url(#shadow)">
    <rect width="230" height="64" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
    <rect x="12" y="12" width="40" height="40" rx="8" fill="#ECFDF5" />
    <text x="32" y="37" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="20" text-anchor="middle">🪣</text>
    <text x="62" y="30" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="12.5" font-weight="800" fill="#0F172A">AWS S3 &amp; EC2</text>
    <text x="62" y="47" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="9.5" fill="#047857">사진/PDF 파일 스토리지 &amp; 도커</text>
  </g>

  <!-- ============================================================== -->
  <!-- 2개 영역 간 상호작용 교집합 영역들 (Intersections) -->
  <!-- ============================================================== -->

  <!-- 교집합 1: [Client ∩ Server] (상단 교차부) -->
  <g transform="translate(700, 310)" filter="url(#shadow)">
    <rect width="200" height="110" rx="14" fill="#FFFFFF" stroke="#6366F1" stroke-width="1.8" />
    <rect x="10" y="10" width="180" height="26" rx="6" fill="#EEF2FF" />
    <text x="100" y="27" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="11.5" font-weight="900" fill="#4338CA" text-anchor="middle">
      Client ↔ Server 상호작용
    </text>
    <text x="100" y="54" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#1E293B" text-anchor="middle">
      • GPS 좌표 초저지연 전송 (0.2s)
    </text>
    <text x="100" y="72" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#1E293B" text-anchor="middle">
      • 지오펜스 3단계 도착 알림 푸시
    </text>
    <text x="100" y="90" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#1E293B" text-anchor="middle">
      • 교사-학부모 1:1 양방향 채팅
    </text>
  </g>

  <!-- 교집합 2: [Client ∩ Data] (좌측 하단 교차부) -->
  <g transform="translate(480, 660)" filter="url(#shadow)">
    <rect width="190" height="100" rx="14" fill="#FFFFFF" stroke="#0D9488" stroke-width="1.8" />
    <rect x="10" y="10" width="170" height="26" rx="6" fill="#F0FDFA" />
    <text x="95" y="27" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="11.5" font-weight="900" fill="#0F766E" text-anchor="middle">
      Client ↔ Data 상호작용
    </text>
    <text x="95" y="54" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#1E293B" text-anchor="middle">
      • S3 Presigned URL 사진 로딩
    </text>
    <text x="95" y="72" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#1E293B" text-anchor="middle">
      • 엑셀 원생 명단 일괄 I/O 파싱
    </text>
    <text x="95" y="90" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#1E293B" text-anchor="middle">
      • 로컬 SQLite 오프라인 캐싱
    </text>
  </g>

  <!-- 교집합 3: [Server ∩ Data] (우측 하단 교차부) -->
  <g transform="translate(930, 660)" filter="url(#shadow)">
    <rect width="190" height="100" rx="14" fill="#FFFFFF" stroke="#7C3AED" stroke-width="1.8" />
    <rect x="10" y="10" width="170" height="26" rx="6" fill="#FAF5FF" />
    <text x="95" y="27" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="11.5" font-weight="900" fill="#6B21A8" text-anchor="middle">
      Server ↔ Data 상호작용
    </text>
    <text x="95" y="54" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#1E293B" text-anchor="middle">
      • Redis 위치 캐시 &amp; 동기화
    </text>
    <text x="95" y="72" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#1E293B" text-anchor="middle">
      • 법정 운행기록부 시계열 적재
    </text>
    <text x="95" y="90" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#1E293B" text-anchor="middle">
      • PostGIS 공간 지오쿼리 연산
    </text>
  </g>

  <!-- ============================================================== -->
  <!-- 중앙 삼중 교집합: TakeMe Core Hub (Triple Intersection) -->
  <!-- ============================================================== -->
  <g transform="translate(680, 480)" filter="url(#coreShadow)">
    <!-- 중앙 메인 카드 -->
    <rect width="240" height="150" rx="20" fill="url(#coreGrad)" stroke="#60A5FA" stroke-width="2.5" />

    <text x="120" y="32" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="18" font-weight="900" fill="#60A5FA" text-anchor="middle">
      🌟 TakeMe Core
    </text>
    <text x="120" y="52" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="11" font-weight="bold" fill="#E2E8F0" text-anchor="middle">
      [통합 안심 모빌리티 솔루션]
    </text>

    <line x1="20" y1="62" x2="220" y2="62" stroke="#3B82F6" stroke-width="1.5" />

    <text x="120" y="80" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10.5" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
      ✔ K-Means &amp; TSP 배차 최적화
    </text>
    <text x="120" y="100" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10.5" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
      ✔ 안드로이드 Doze FSM 지오펜싱
    </text>
    <text x="120" y="120" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10.5" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
      ✔ 아동 잔류 0 감지 &amp; 법정서식 출력
    </text>
    <text x="120" y="138" font-family="'Malgun Gothic', 'Noto Sans KR', sans-serif" font-size="10" font-weight="bold" fill="#93C5FD" text-anchor="middle">
      (Client + Server + Data 완전 통합)
    </text>
  </g>

</svg>`;

// 파일 저장 경로
const outputSvgPath = path.resolve(__dirname, 'system_venn_diagram.svg');
const outputPngPath = path.resolve(__dirname, 'system_venn_diagram.png');
const downloadsPngPath = 'C:/Users/favid/Downloads/Takeme_시스템_상호작용_벤다이어그램.png';

// 1. SVG 파일 저장
fs.writeFileSync(outputSvgPath, svgContent, 'utf-8');
console.log('SVG 생성 성공:', outputSvgPath);

// 2. Resvg 로 고해상도 PNG 변환 (2x 스케일: 3200 x 2200)
try {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: 2400 },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'Malgun Gothic'
    }
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  fs.writeFileSync(outputPngPath, pngBuffer);
  console.log('PNG 로컬 생성 성공:', outputPngPath);

  fs.writeFileSync(downloadsPngPath, pngBuffer);
  console.log('PNG 다운로드 폴더 저장 성공:', downloadsPngPath);
} catch (e) {
  console.error('PNG 변환 에러:', e);
}
