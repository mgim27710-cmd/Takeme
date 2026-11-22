const fs = require('fs');
const path = require('path');
const { Resvg } = require('../scratch_pptx/node_modules/@resvg/resvg-js');

// 1600 x 900 (레퍼런스 이미지 비율)
const width = 1600;
const height = 900;

// 공식 React 아톰 SVG (중심 원 + 3개 회전 타원 궤도, #61DAFB)
const reactOfficialIcon = `
  <g transform="translate(68, 38) scale(2.2)">
    <!-- React 공식 심볼 (Atom) -->
    <circle cx="0" cy="0" r="2.2" fill="#00D8FF"/>
    <g stroke="#00D8FF" stroke-width="1.1" fill="none">
      <ellipse rx="11" ry="4.2"/>
      <ellipse rx="11" ry="4.2" transform="rotate(60)"/>
      <ellipse rx="11" ry="4.2" transform="rotate(120)"/>
    </g>
  </g>
`;

// 공식 Flutter 셰브론 날개 SVG (#02569B, #0175C2, #47C5FB)
const flutterOfficialIcon = `
  <g transform="translate(48, 12) scale(0.18)">
    <path d="M125 0L0 125l38 38L201 0h-76z" fill="#47C5FB"/>
    <path d="M125 120L46 198l38 38 40-40 77-76h-76z" fill="#00569E"/>
    <path d="M125 197l-40 40 40 40h76l-76-80z" fill="#02569B"/>
    <path d="M125 197l-38 38 38 38 38-38-38-38z" fill="#0175C2"/>
  </g>
`;

const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L7,3 z" fill="#1E293B" />
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#FFFFFF" />

  <!-- 1. 좌측 박스: End Users & Clients -->
  <g transform="translate(60, 100)">
    <rect width="400" height="700" fill="#FFFFFF" stroke="#64748B" stroke-width="1.8" />

    <rect x="0" y="0" width="180" height="42" fill="#475569" />
    <g transform="translate(14, 10)" fill="#FFFFFF">
      <path d="M2 20h18v-2H2v2zm2-4h4v-2H4v2zm0-4h4v-2H4v2zm0-4h4V6H4v2zm6 8h4v-2h-4v2zm0-4h4v-2h-4v2zm0-4h4V6h-4v2zm6 8h4v-2h-4v2zm0-4h4v-2h-4v2zm0-4h4V6h-4v2zM0 2h22v20H0V2z"/>
    </g>
    <text x="50" y="27" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">
      Users &amp; Clients
    </text>

    <!-- Users Icon -->
    <g transform="translate(50, 180)">
      <g fill="#334155" transform="scale(1.8)">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        <path d="M18 10c1.66 0 3-1.34 3-3s-1.34-3-3-3c-.3 0-.58.05-.85.13C17.72 4.78 18 5.86 18 7s-.28 2.22-.85 2.87c.27.08.55.13.85.13zm0 2c-.29 0-.62.02-.97.06 1.16.84 1.97 1.97 1.97 3.44v1.5H22v-1.5c0-1.87-3.13-3.5-4-3.5z" opacity="0.7"/>
      </g>
      <text x="25" y="75" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="15" font-weight="bold" fill="#1E293B" text-anchor="middle">
        Users
      </text>
      <text x="25" y="96" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11.5" fill="#64748B" text-anchor="middle">
        (관리자·기사·교사·학부모)
      </text>
    </g>

    <!-- 점선 화살표 -->
    <line x1="160" y1="210" x2="230" y2="210" stroke="#1E293B" stroke-width="1.8" stroke-dasharray="4,4" marker-end="url(#arrow)" />

    <!-- 1. 관리자 웹 (공식 100% React Atom 로고 적용!) -->
    <g transform="translate(240, 75)">
      <rect width="135" height="115" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2" />
      <rect x="8" y="8" width="119" height="58" rx="6" fill="#0F172A" />
      ${reactOfficialIcon}
      <text x="68" y="84" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" font-weight="bold" fill="#0F172A" text-anchor="middle">
        Web Console
      </text>
      <text x="68" y="99" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11" font-weight="bold" fill="#0284C7" text-anchor="middle">
        React / Next.js
      </text>
      <text x="68" y="111" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="9" fill="#64748B" text-anchor="middle">
        (원장·관리자)
      </text>
    </g>

    <!-- 2. 기사 내비 앱 (Flutter 공식 로고) -->
    <g transform="translate(240, 220)">
      <rect width="135" height="115" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2" />
      ${flutterOfficialIcon}
      <text x="68" y="74" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" font-weight="bold" fill="#0F172A" text-anchor="middle">
        Driver App
      </text>
      <text x="68" y="92" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11" font-weight="bold" fill="#0284C7" text-anchor="middle">
        Flutter / TMap
      </text>
      <text x="68" y="106" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="9.5" fill="#64748B" text-anchor="middle">
        (릴레이 길안내)
      </text>
    </g>

    <!-- 3. 교사 앱 (Flutter 공식 로고 + NFC) -->
    <g transform="translate(240, 365)">
      <rect width="135" height="115" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2" />
      ${flutterOfficialIcon}
      <text x="68" y="74" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" font-weight="bold" fill="#0F172A" text-anchor="middle">
        Teacher App
      </text>
      <text x="68" y="92" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11" font-weight="bold" fill="#0D9488" text-anchor="middle">
        Flutter / NFC
      </text>
      <text x="68" y="106" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="9.5" fill="#64748B" text-anchor="middle">
        (승하차 태깅)
      </text>
    </g>

    <!-- 4. 학부모 앱 (Flutter 공식 로고 + Maps) -->
    <g transform="translate(240, 510)">
      <rect width="135" height="115" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2" />
      ${flutterOfficialIcon}
      <text x="68" y="74" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" font-weight="bold" fill="#0F172A" text-anchor="middle">
        Parent App
      </text>
      <text x="68" y="92" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11" font-weight="bold" fill="#EA580C" text-anchor="middle">
        Flutter / Maps
      </text>
      <text x="68" y="106" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="9.5" fill="#64748B" text-anchor="middle">
        (실시간 위치·푸시)
      </text>
    </g>
  </g>

  <!-- 2. 점선 화살표 연결 -->
  <path d="M 460 275 L 530 275 L 530 450 L 590 450" fill="none" stroke="#1E293B" stroke-width="1.8" stroke-dasharray="4,4" marker-end="url(#arrow)" />
  <text x="530" y="435" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11" font-weight="bold" fill="#475569" text-anchor="middle">
    HTTPS / WSS
  </text>

  <!-- 3. 우측 큰 박스: Cloud VPC -->
  <g transform="translate(570, 60)">
    <rect width="970" height="780" fill="#FFFFFF" stroke="#16A34A" stroke-width="2.2" />

    <rect x="0" y="0" width="170" height="40" fill="#16A34A" />
    <g transform="translate(14, 10)" fill="#FFFFFF">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </g>
    <text x="46" y="26" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">
      Cloud VPC
    </text>

    <!-- ALB 진입 아이콘 -->
    <g transform="translate(110, 390)">
      <circle cx="0" cy="0" r="34" fill="#FFFFFF" stroke="#7C3AED" stroke-width="2.5" />
      <g transform="translate(-16, -16) scale(1.3)" fill="#7C3AED">
        <rect x="7" y="1" width="10" height="7" rx="1" fill="none" stroke="#7C3AED" stroke-width="2"/>
        <rect x="1" y="16" width="8" height="6" rx="1" fill="none" stroke="#7C3AED" stroke-width="2"/>
        <rect x="15" y="16" width="8" height="6" rx="1" fill="none" stroke="#7C3AED" stroke-width="2"/>
        <path d="M12 8v4M5 12h14v4" fill="none" stroke="#7C3AED" stroke-width="2"/>
      </g>
      <text x="0" y="55" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="13" font-weight="bold" fill="#0F172A" text-anchor="middle">
        ALB / Gateway
      </text>
      <text x="0" y="73" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11" fill="#64748B" text-anchor="middle">
        (Nginx, Socket.IO)
      </text>
    </g>

    <!-- 화살표: ALB to Private Subnet -->
    <line x1="150" y1="390" x2="310" y2="390" stroke="#1E293B" stroke-width="1.8" marker-end="url(#arrow)" />

    <!-- Availability Zone 1 -->
    <g transform="translate(220, 90)">
      <rect width="320" height="600" fill="none" stroke="#2563EB" stroke-width="1.8" stroke-dasharray="6,6" />
      <text x="160" y="35" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="13" font-weight="bold" fill="#2563EB" text-anchor="middle">
        Availability Zone 1
      </text>

      <!-- Private Subnet -->
      <g transform="translate(30, 60)">
        <rect width="260" height="480" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2" />

        <g transform="translate(14, 14)">
          <rect width="32" height="32" rx="4" fill="#2563EB" />
          <path d="M16 10c-1.66 0-3 1.34-3 3v2h-1v6h8v-6h-1v-2c0-1.66-1.34-3-3-3zm1.5 5h-3v-2c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v2z" fill="#FFFFFF"/>
          <text x="42" y="22" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" font-weight="bold" fill="#1E40AF">
            Private subnet
          </text>
        </g>

        <!-- Linux VM (CPU Icon) -->
        <g transform="translate(130, 240)">
          <g transform="translate(-24, -24) scale(1.6)">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="#EA580C" stroke-width="2"/>
            <rect x="8" y="8" width="8" height="8" fill="#EA580C"/>
            <line x1="1" y1="8" x2="4" y2="8" stroke="#EA580C" stroke-width="2"/>
            <line x1="1" y1="12" x2="4" y2="12" stroke="#EA580C" stroke-width="2"/>
            <line x1="1" y1="16" x2="4" y2="16" stroke="#EA580C" stroke-width="2"/>
            <line x1="20" y1="8" x2="23" y2="8" stroke="#EA580C" stroke-width="2"/>
            <line x1="20" y1="12" x2="23" y2="12" stroke="#EA580C" stroke-width="2"/>
            <line x1="20" y1="16" x2="23" y2="16" stroke="#EA580C" stroke-width="2"/>
            <line x1="8" y1="1" x2="8" y2="4" stroke="#EA580C" stroke-width="2"/>
            <line x1="12" y1="1" x2="12" y2="4" stroke="#EA580C" stroke-width="2"/>
            <line x1="16" y1="1" x2="16" y2="4" stroke="#EA580C" stroke-width="2"/>
            <line x1="8" y1="20" x2="8" y2="23" stroke="#EA580C" stroke-width="2"/>
            <line x1="12" y1="20" x2="12" y2="23" stroke="#EA580C" stroke-width="2"/>
            <line x1="16" y1="20" x2="16" y2="23" stroke="#EA580C" stroke-width="2"/>
          </g>

          <text x="0" y="48" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="14" font-weight="900" fill="#0F172A" text-anchor="middle">
            Linux VM (EC2)
          </text>
          <text x="0" y="68" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11.5" font-weight="bold" fill="#EA580C" text-anchor="middle">
            NestJS Core Server
          </text>
          <text x="0" y="86" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="10.5" fill="#475569" text-anchor="middle">
            (TSP 엔진, 지오펜스 FSM)
          </text>
        </g>
      </g>
    </g>

    <!-- 화살표 분기들 -->
    <path d="M 400 370 L 590 370 L 590 190 L 680 190" fill="none" stroke="#1E293B" stroke-width="1.8" marker-end="url(#arrow)" />
    <path d="M 400 385 L 620 385 L 620 340 L 680 340" fill="none" stroke="#1E293B" stroke-width="1.8" marker-end="url(#arrow)" />
    <path d="M 400 395 L 620 395 L 620 490 L 680 490" fill="none" stroke="#1E293B" stroke-width="1.8" marker-end="url(#arrow)" />
    <path d="M 400 410 L 590 410 L 590 640 L 680 640" fill="none" stroke="#1E293B" stroke-width="1.8" marker-end="url(#arrow)" />

    <!-- 타겟 1: PostgreSQL -->
    <g transform="translate(700, 190)">
      <g transform="translate(0, -22) scale(1.6)">
        <rect width="30" height="30" rx="6" fill="#3B82F6" />
        <ellipse cx="15" cy="8" rx="10" ry="3.5" fill="#FFFFFF"/>
        <path d="M5 8v6c0 2 4.5 3.5 10 3.5s10-1.5 10-3.5V8" fill="none" stroke="#FFFFFF" stroke-width="1.8"/>
        <path d="M5 14v6c0 2 4.5 3.5 10 3.5s10-1.5 10-3.5v-6" fill="none" stroke="#FFFFFF" stroke-width="1.8"/>
      </g>
      <text x="65" y="-5" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="15" font-weight="900" fill="#0F172A">
        PostgreSQL 16
      </text>
      <text x="65" y="16" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" fill="#475569">
        Target Database (RDS)
      </text>
      <text x="65" y="32" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="10.5" fill="#3B82F6">
        (원생·노선·안전운행기록 DB)
      </text>
    </g>

    <!-- 타겟 2: Redis -->
    <g transform="translate(700, 340)">
      <g transform="translate(0, -22) scale(1.6)">
        <rect width="30" height="30" rx="6" fill="#DC2626" />
        <path d="M15 6l9 4.5v9L15 24l-9-4.5v-9L15 6zm0 2.5L9 11.5 15 14l6-2.5L15 8.5z" fill="#FFFFFF"/>
      </g>
      <text x="65" y="-5" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="15" font-weight="900" fill="#0F172A">
        Redis 7
      </text>
      <text x="65" y="16" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" fill="#475569">
        In-Memory Cache
      </text>
      <text x="65" y="32" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="10.5" fill="#DC2626">
        (실시간 버스 GPS 좌표 캐시)
      </text>
    </g>

    <!-- 타겟 3: AWS S3 -->
    <g transform="translate(700, 490)">
      <g transform="translate(0, -22) scale(1.6)">
        <rect width="30" height="30" rx="6" fill="#EA580C" />
        <ellipse cx="15" cy="9" rx="9" ry="3.5" fill="#FFFFFF"/>
        <path d="M6 9v11c0 2 4 3.5 9 3.5s9-1.5 9-3.5V9" fill="none" stroke="#FFFFFF" stroke-width="1.8"/>
        <path d="M13 14l2-2 2 2M15 12v6" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
      </g>
      <text x="65" y="-5" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="15" font-weight="900" fill="#0F172A">
        AWS S3
      </text>
      <text x="65" y="16" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" fill="#475569">
        Target Storage (Object Bucket)
      </text>
      <text x="65" y="32" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="10.5" fill="#EA580C">
        (알림장 사진 &amp; 법정 서식 PDF)
      </text>
    </g>

    <!-- 타겟 4: FCM / SNS -->
    <g transform="translate(700, 640)">
      <g transform="translate(0, -22) scale(1.6)">
        <rect width="30" height="30" rx="6" fill="#0284C7" />
        <path d="M15 6a6 6 0 0 0-6 6v5l-2 2v1h16v-1l-2-2v-5a6 6 0 0 0-6-6zm-2 16a2 2 0 0 0 4 0h-4z" fill="#FFFFFF"/>
      </g>
      <text x="65" y="-5" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="15" font-weight="900" fill="#0F172A">
        FCM &amp; AWS SNS
      </text>
      <text x="65" y="16" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" fill="#475569">
        Target Notification Service
      </text>
      <text x="65" y="32" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="10.5" fill="#0284C7">
        (지오펜스 3단계 도착 알림 푸시)
      </text>
    </g>
  </g>
</svg>`;

// 파일 저장 경로
const outputSvgPath = path.resolve(__dirname, 'clean_system_architecture.svg');
const outputPngPath = path.resolve(__dirname, 'clean_system_architecture.png');
const downloadsPngPath = 'C:/Users/favid/Downloads/Takeme_단순_시스템구조도.png';

fs.writeFileSync(outputSvgPath, svgContent, 'utf-8');

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
  fs.writeFileSync(downloadsPngPath, pngBuffer);
  console.log('React 공식 로고 반영된 PNG 다운로드 저장 성공:', downloadsPngPath);
} catch (e) {
  console.error('PNG 변환 에러:', e);
}
