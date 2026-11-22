const fs = require('fs');
const path = require('path');
const { Resvg } = require('../scratch_pptx/node_modules/@resvg/resvg-js');

// 1600 x 900 표준 16:9 와이드
const width = 1600;
const height = 900;

// 공식 SVG 로고 (크기 정규화 및 겹침 제로 설계)
const LOGOS = {
  // 1. NestJS (48 x 48)
  nestjs: `
    <g transform="scale(2)">
      <path d="M12 0c-.3 0-.5 0-.8.1L1.5 2.9A2.5 2.5 0 0 0 0 5.3v13.4a2.5 2.5 0 0 0 1.5 2.4l9.7 2.8c.5.2 1.1.2 1.6 0l9.7-2.8a2.5 2.5 0 0 0 1.5-2.4V5.3a2.5 2.5 0 0 0-1.5-2.4L12.8.1c-.3-.1-.5-.1-.8-.1z" fill="#E0234E"/>
      <path d="M19 12c-1.5 3-4.5 5-7.5 5-4 0-6.5-3-6.5-7 0-3 2-5 4.5-5 2 0 3.5 1 4.5 3l-2.5 1.5c-.5-1-1-1.5-2-1.5-1.5 0-2.5 1.5-2.5 3.5 0 2.5 1.5 4 4 4 1.8 0 3.2-1 4.2-2.8L19 12z" fill="#FFFFFF"/>
    </g>
  `,
  // 2. PostgreSQL (50 x 50)
  postgresql: `
    <g transform="scale(0.25)">
      <rect width="200" height="200" rx="30" fill="#336791"/>
      <path d="M100 25c-35 0-55 20-55 45 0 18 10 32 25 38v22c0 22 15 45 40 45s40-23 40-45v-22c15-6 25-20 25-38 0-25-20-45-55-45zm-15 35c8 0 15 7 15 15s-7 15-15 15-15-7-15-15 7-15 15-15zm45 70c0 12-8 25-20 25s-20-13-20-25v-18h40v18zm0-30h-40v-8c8-2 15-7 20-14 5 7 12 12 20 14v8zm15-25c-8 0-15-7-15-15s7-15 15-15 15 7 15 15-7 15-15 15z" fill="#FFFFFF"/>
    </g>
  `,
  // 3. Redis (48 x 48)
  redis: `
    <g transform="scale(2)">
      <rect width="24" height="24" rx="5" fill="#DC382D"/>
      <path d="M12 4l7 3.5v9L12 20l-7-3.5v-9L12 4zm0 2.2L7.5 8.5 12 10.7l4.5-2.2L12 6.2zm-5 4v5.3l5 2.5v-5.3l-5-2.5zm10 0l-4 2v5.3l4-2v-5.3z" fill="#FFFFFF"/>
    </g>
  `,
  // 4. Socket.IO (48 x 48)
  socketio: `
    <g transform="scale(2)">
      <circle cx="12" cy="12" r="11" fill="#010101"/>
      <circle cx="12" cy="12" r="9" fill="none" stroke="#FFFFFF" stroke-width="2"/>
      <path d="M13.5 4.5L7 13.5h5l-1.5 6 6.5-9h-5l1.5-6z" fill="#FFFFFF"/>
    </g>
  `,
  // 5. AWS EC2 (공식 주황색 EC2 서버 로고, 48 x 48)
  ec2: `
    <g transform="scale(2)">
      <rect width="24" height="24" rx="5" fill="#EA580C"/>
      <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="#FFFFFF" stroke-width="1.8"/>
      <rect x="8" y="8" width="8" height="8" fill="#FFFFFF"/>
      <line x1="1" y1="8" x2="4" y2="8" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="1" y1="12" x2="4" y2="12" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="1" y1="16" x2="4" y2="16" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="20" y1="8" x2="23" y2="8" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="20" y1="12" x2="23" y2="12" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="20" y1="16" x2="23" y2="16" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="8" y1="1" x2="8" y2="4" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="12" y1="1" x2="12" y2="4" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="16" y1="1" x2="16" y2="4" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="8" y1="20" x2="8" y2="23" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="12" y1="20" x2="12" y2="23" stroke="#FFFFFF" stroke-width="1.8"/>
      <line x1="16" y1="20" x2="16" y2="23" stroke="#FFFFFF" stroke-width="1.8"/>
    </g>
  `,
  // 6. Node.js (50 x 50)
  nodejs: `
    <g transform="scale(1.0)">
      <path d="M25 5L5 17v24l20 12 20-12V17L25 5z" fill="#339933"/>
      <path d="M25 15c-5.5 0-9 3-9 9v6c0 6 3.5 9 9 9s9-3 9-9v-6c0-6-3.5-9-9-9zm0 20c-2.5 0-4-1.5-4-4v-6c0-2.5 1.5-4 4-4s4 1.5 4 4v6c0 2.5-1.5 4-4 4z" fill="#FFFFFF"/>
    </g>
  `,
  // 7. TypeScript (50 x 50)
  typescript: `
    <g transform="scale(0.28)">
      <rect width="180" height="180" rx="25" fill="#3178C6"/>
      <path d="M40 70h60v20H75v60H55V90H40V70zm65 55c5 10 15 15 25 15 12 0 18-6 18-14 0-20-35-15-35-40 0-15 12-26 30-26 12 0 22 5 28 14l-12 12c-4-6-10-9-16-9-7 0-12 4-12 9 0 18 35 12 35 39 0 16-12 28-34 28-15 0-27-6-33-16l16-12z" fill="#FFFFFF"/>
    </g>
  `,
  // 8. Amazon S3 (60 x 70)
  s3: `
    <g transform="scale(0.42)">
      <path d="M80 15L20 45l60 30 60-30-60-30z" fill="#E05243"/>
      <path d="M20 45v60l60 30V75L20 45z" fill="#C73E31"/>
      <path d="M140 45v60l-60 30V75l60-30z" fill="#A82F24"/>
      <path d="M50 80v35l30 15V95L50 80z" fill="#E05243"/>
      <path d="M110 80v35l-30 15V95l30-15z" fill="#C73E31"/>
    </g>
  `,
  // 9. React.js (65 x 65 아톰 로고)
  react: `
    <g transform="scale(2.2)">
      <circle cx="16" cy="16" r="3" fill="#00D8FF"/>
      <g stroke="#00D8FF" stroke-width="1.3" fill="none">
        <ellipse cx="16" cy="16" rx="14" ry="5.5"/>
        <ellipse cx="16" cy="16" rx="14" ry="5.5" transform="rotate(60 16 16)"/>
        <ellipse cx="16" cy="16" rx="14" ry="5.5" transform="rotate(120 16 16)"/>
      </g>
    </g>
  `,
  // 10. Vite (공식 번개 로고)
  vite: `
    <g transform="scale(1.2)">
      <path d="M39.6 4.4L20.8 40.5a1.2 1.2 0 0 1-2.1.1L2.4 8.7a1.2 1.2 0 0 1 1-1.8h35.2a1.2 1.2 0 0 1 1 1.7v-.2z" fill="#41D1FF"/>
      <path d="M29.5 4.3L19.8 40.6a1.2 1.2 0 0 1-2.2 0L9.5 22.8l20-18.5z" fill="#BD34FE"/>
      <path d="M21.5 7.5l-9.8 8.8 6.5.6-4.2 8.5 10.5-8.8-6.2-.6 3.2-8.5z" fill="#FFD026"/>
    </g>
  `,
  // 11. Flutter (공식 파란 셰브론)
  flutter: `
    <g transform="scale(0.32)">
      <path d="M125 0L0 125l38 38L201 0h-76z" fill="#47C5FB"/>
      <path d="M125 120L46 198l38 38 40-40 77-76h-76z" fill="#00569E"/>
      <path d="M125 197l-40 40 40 40h76l-76-80z" fill="#02569B"/>
      <path d="M125 197l-38 38 38 38 38-38-38-38z" fill="#0175C2"/>
    </g>
  `,
  // 12. Tailwind CSS (48 x 48)
  tailwind: `
    <g transform="scale(2.0)">
      <path d="M12 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.9.2 1.6.9 2.3 1.6C13.7 10.6 15 12 18 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.9-.2-1.6-.9-2.3-1.6C16.3 6.2 15 4.8 12 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.9.2 1.6.9 2.3 1.6 1.2 1.2 2.5 2.6 5.5 2.6 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.9-.2-1.6-.9-2.3-1.6-1.2-1.2-2.5-2.6-5.5-2.6z" fill="#06B6D4"/>
    </g>
  `,
  // 13. GitHub (50 x 50)
  github: `
    <g transform="scale(0.28)">
      <path d="M90 0C40.3 0 0 40.3 0 90c0 39.8 25.8 73.5 61.6 85.4 4.5.8 6.1-2 6.1-4.3 0-2.1-.1-9.3-.1-17-22.6 4.1-28.7-5.5-30.5-10.6-1-2.6-5.4-10.6-9.2-12.7-3.1-1.7-7.6-5.9 0-6 7-.1 12 6.5 13.7 9.1 8 13.6 20.9 9.8 26.1 7.4 1-6 3.2-9.8 5.7-12.1-20-2.3-41-10-41-44.5 0-9.8 3.5-17.9 9.2-24.2-.9-2.3-4-11.4.9-23.8 0 0 7.6-2.4 24.8 9.2 7.2-2 14.9-3 22.5-3s15.3 1 22.5 3c17.2-11.7 24.8-9.2 24.8-9.2 4.9 12.4 1.8 21.5.9 23.8 5.7 6.3 9.2 14.3 9.2 24.2 0 34.6-21.1 42.1-41.2 44.4 3.3 2.8 6.2 8.3 6.2 16.8 0 12.2-.1 22-.1 25 0 2.4 1.6 5.2 6.2 4.3C154.2 163.4 180 129.7 180 90c0-49.7-40.3-90-90-90z" fill="#181717"/>
    </g>
  `,
  // 14. Git (50 x 50)
  git: `
    <g transform="scale(0.35)">
      <path d="M125 15l45 45c5 5 5 13 0 18l-45 45c-5 5-13 5-18 0l-45-45c-5-5-5-13 0-18l45-45c5-5 13-5 18 0z" fill="#F05032"/>
      <circle cx="100" cy="55" r="9" fill="#FFFFFF"/>
      <circle cx="135" cy="90" r="9" fill="#FFFFFF"/>
      <circle cx="100" cy="100" r="9" fill="#FFFFFF"/>
      <path d="M100 55v45m0-20l35 10" stroke="#FFFFFF" stroke-width="6" fill="none"/>
    </g>
  `,
  // 15. Users (50 x 50)
  user: `
    <g transform="scale(0.32)">
      <circle cx="90" cy="50" r="40" fill="#1E293B"/>
      <path d="M20 170c0-38 31-70 70-70s70 32 70 70v10H20v-10z" fill="#1E293B"/>
    </g>
  `
};

const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowOrange" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#EA580C" />
    </marker>
  </defs>

  <!-- 순백색 바탕 -->
  <rect width="100%" height="100%" fill="#FFFFFF" />

  <!-- 상단 타이틀 영역 -->
  <g transform="translate(60, 45)">
    <rect x="0" y="0" width="60" height="26" rx="4" fill="#EA580C" />
    <text x="30" y="18" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11" font-weight="900" fill="#FFFFFF" text-anchor="middle">
      TakeMe
    </text>

    <text x="75" y="19" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="20" font-weight="900" fill="#0F172A">
      03. 구현 사항 — 서비스 구현 환경
    </text>
    <circle cx="430" cy="13" r="4" fill="#EA580C" />
    <line x1="435" y1="13" x2="1480" y2="13" stroke="#FDBA74" stroke-width="2.5" />

    <text x="75" y="52" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="17" font-weight="bold" fill="#334155">
      -  개발 환경 (Development Environment)
    </text>
  </g>

  <!-- ============================================================== -->
  <!-- [좌측] Front — End 박스 (요청에 따라 위치 반전 적용!) -->
  <!-- ============================================================== -->
  <g transform="translate(60, 140)">
    <text x="415" y="-12" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="24" font-weight="900" fill="#0F172A" text-anchor="middle">
      Front — End
    </text>

    <!-- 메인 오렌지 둥근 박스 (830 x 460) -->
    <rect width="830" height="460" rx="28" fill="#FFFFFF" stroke="#EA580C" stroke-width="3" />

    <!-- 내부 왼쪽: 중첩된 둥근 박스 (React, Vite, Flutter, Tailwind, TMap/Kakao) -->
    <g transform="translate(25, 25)">
      <rect width="560" height="410" rx="22" fill="#FFFFFF" stroke="#EA580C" stroke-width="2" />

      <!-- 1. React.js (상단 메인) -->
      <g transform="translate(280, 25)">
        <g transform="translate(-32, 0)">${LOGOS.react}</g>
        <text x="0" y="85" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="20" font-weight="900" fill="#0F172A" text-anchor="middle">
          React.js
        </text>
        <text x="0" y="106" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" fill="#0284C7" text-anchor="middle">
          (관리자 종합 관제 웹)
        </text>
      </g>

      <!-- 2. Vite (좌측) -->
      <g transform="translate(95, 175)">
        <g transform="translate(-24, 0)">${LOGOS.vite}</g>
        <text x="0" y="70" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="16" font-weight="900" fill="#0F172A" text-anchor="middle">
          Vite
        </text>
        <text x="0" y="90" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11.5" fill="#8B5CF6" text-anchor="middle">
          Fast Build Tool
        </text>
      </g>

      <!-- 3. Flutter (중앙: 4대 앱) -->
      <g transform="translate(280, 175)">
        <g transform="translate(-25, 0)">${LOGOS.flutter}</g>
        <text x="0" y="70" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="16" font-weight="900" fill="#0F172A" text-anchor="middle">
          Flutter 3.x
        </text>
        <text x="0" y="90" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11.5" fill="#0284C7" text-anchor="middle">
          기사/교사/학부모 앱
        </text>
      </g>

      <!-- 4. Tailwind CSS (우측) -->
      <g transform="translate(465, 175)">
        <g transform="translate(-24, 0)">${LOGOS.tailwind}</g>
        <text x="0" y="70" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="16" font-weight="900" fill="#0F172A" text-anchor="middle">
          Tailwind CSS
        </text>
        <text x="0" y="90" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="11.5" fill="#06B6D4" text-anchor="middle">
          Utility-First UI
        </text>
      </g>

      <!-- 하단: TMap & Kakao SDK 뱃지 -->
      <g transform="translate(205, 335)">
        <rect width="150" height="34" rx="17" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2" />
        <text x="75" y="22" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" font-weight="bold" fill="#1D4ED8" text-anchor="middle">
          🗺️ TMap &amp; Kakao SDK
        </text>
      </g>
    </g>

    <!-- 내부 오른쪽: Amazon S3 -->
    <g transform="translate(675, 150)">
      <g transform="translate(5, 0)">${LOGOS.s3}</g>
      <text x="40" y="105" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="19" font-weight="900" fill="#0F172A" text-anchor="middle">
        Amazon S3
      </text>
      <text x="40" y="128" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" fill="#64748B" text-anchor="middle">
        (사진·서식 스토리지)
      </text>
    </g>
  </g>

  <!-- ============================================================== -->
  <!-- [중앙 연결] Front-End <-> Back-End 양방향 꺾임 화살표 -->
  <!-- ============================================================== -->
  <g fill="none" stroke="#EA580C" stroke-width="2.5">
    <path d="M 890 320 L 980 320 L 980 370 L 1060 370" marker-end="url(#arrowOrange)" />
    <path d="M 1060 430 L 980 430 L 980 480 L 890 480" marker-end="url(#arrowOrange)" />
  </g>
  <text x="980" y="305" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" font-weight="bold" fill="#EA580C" text-anchor="middle">
    REST API
  </text>
  <text x="980" y="505" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" font-weight="bold" fill="#EA580C" text-anchor="middle">
    WebSocket
  </text>

  <!-- ============================================================== -->
  <!-- [우측] Back — End 박스 (요청에 따라 위치 반전 및 AWS EC2 추가!) -->
  <!-- ============================================================== -->
  <g transform="translate(1070, 140)">
    <text x="235" y="-12" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="24" font-weight="900" fill="#0F172A" text-anchor="middle">
      Back — End
    </text>

    <!-- 메인 오렌지 둥근 박스 (470 x 640) -->
    <rect width="470" height="640" rx="28" fill="#FFFFFF" stroke="#EA580C" stroke-width="3" />

    <!-- 1. NestJS Core Server -->
    <g transform="translate(35, 30)">
      <g transform="translate(0, 0)">${LOGOS.nestjs}</g>
      <text x="75" y="24" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="17" font-weight="900" fill="#0F172A">
        NestJS Core Server
      </text>
      <text x="75" y="44" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" fill="#64748B">
        RESTful API &amp; 비즈니스 로직
      </text>
    </g>

    <!-- 2. PostgreSQL 16 (PostGIS) -->
    <g transform="translate(35, 120)">
      <g transform="translate(0, 0)">${LOGOS.postgresql}</g>
      <text x="75" y="24" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="17" font-weight="900" fill="#0F172A">
        PostgreSQL 16
      </text>
      <text x="75" y="44" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" fill="#64748B">
        PostGIS 공간 데이터 &amp; 원생 DB
      </text>
    </g>

    <!-- 3. Redis 7 -->
    <g transform="translate(35, 210)">
      <g transform="translate(0, 0)">${LOGOS.redis}</g>
      <text x="75" y="24" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="17" font-weight="900" fill="#0F172A">
        Redis 7 (In-Memory)
      </text>
      <text x="75" y="44" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" fill="#64748B">
        실시간 버스 GPS 좌표 캐시
      </text>
    </g>

    <!-- 4. Socket.IO -->
    <g transform="translate(35, 300)">
      <g transform="translate(0, 0)">${LOGOS.socketio}</g>
      <text x="75" y="24" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="17" font-weight="900" fill="#0F172A">
        Socket.IO
      </text>
      <text x="75" y="44" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" fill="#64748B">
        0.2초 초저지연 WebSocket 브로커
      </text>
    </g>

    <!-- 5. AWS EC2 (실제 서버 배포 호스팅 인프라 반영!) -->
    <g transform="translate(35, 390)">
      <g transform="translate(0, 0)">${LOGOS.ec2}</g>
      <text x="75" y="24" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="17" font-weight="900" fill="#0F172A">
        AWS EC2 (Linux Server)
      </text>
      <text x="75" y="44" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12.5" fill="#64748B">
        클라우드 인스턴스 &amp; Nginx 호스팅
      </text>
    </g>

    <!-- 중간 구분선 -->
    <line x1="25" y1="480" x2="445" y2="480" stroke="#EA580C" stroke-width="2" />

    <!-- 하단 런타임 & 언어 (Node.js & TypeScript) -->
    <g transform="translate(100, 510)">
      ${LOGOS.nodejs}
      <text x="25" y="75" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="15" font-weight="bold" fill="#0F172A" text-anchor="middle">
        Node.js
      </text>
    </g>

    <g transform="translate(310, 510)">
      ${LOGOS.typescript}
      <text x="25" y="75" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="15" font-weight="bold" fill="#0F172A" text-anchor="middle">
        TypeScript
      </text>
    </g>
  </g>

  <!-- ============================================================== -->
  <!-- 하단 영역 : Users (좌측 Front-End 아래) & GitHub/Git (우측) -->
  <!-- ============================================================== -->
  <!-- 1. Front-End 아래 -> 굵은 오렌지 하향 화살표 -> Users (사용자) -->
  <g transform="translate(320, 610)">
    <path d="M 30 50 L 15 30 H 25 V 0 H 35 V 30 H 45 Z" fill="#EA580C" />

    <!-- User 실루엣 -->
    <g transform="translate(0, 65)">
      ${LOGOS.user}
      <text x="30" y="80" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="16" font-weight="900" fill="#0F172A" text-anchor="middle">
        Users
      </text>
      <text x="30" y="100" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="12" fill="#64748B" text-anchor="middle">
        (관리자·기사·교사·학부모)
      </text>
    </g>
  </g>

  <!-- 2. Amazon S3 / 인프라 아래 -> 굵은 오렌지 양방향 화살표 -> GitHub & Git -->
  <g transform="translate(680, 610)">
    <path d="M 30 0 L 15 15 H 25 V 45 H 15 L 30 60 L 45 45 H 35 V 15 H 45 Z" fill="#EA580C" />

    <!-- GitHub -->
    <g transform="translate(5, 75)">
      ${LOGOS.github}
      <text x="25" y="72" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="16" font-weight="900" fill="#0F172A" text-anchor="middle">
        GitHub
      </text>
    </g>

    <!-- 양방향 수평 화살표 -->
    <g transform="translate(95, 100)">
      <path d="M 0 8 L 10 0 V 5 H 30 V 0 L 40 8 L 30 16 V 11 H 10 V 16 Z" fill="#EA580C" />
    </g>

    <!-- Git -->
    <g transform="translate(165, 75)">
      ${LOGOS.git}
      <text x="25" y="72" font-family="'Malgun Gothic', 'Arial', sans-serif" font-size="16" font-weight="900" fill="#0F172A" text-anchor="middle">
        Git
      </text>
    </g>
  </g>

</svg>`;

// 파일 저장 경로
const outputSvgPath = path.resolve(__dirname, 'clean_system_architecture.svg');
const outputPngPath = path.resolve(__dirname, 'clean_system_architecture.png');
const downloadsPngPath = 'C:/Users/favid/Downloads/Takeme_개발환경_구조도.png';

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
  fs.writeFileSync('C:/Users/favid/Downloads/Takeme_단순_시스템구조도.png', pngBuffer);
  console.log('좌우 반전 및 AWS EC2 추가 완성 PNG 저장 성공:', downloadsPngPath);
} catch (e) {
  console.error('PNG 변환 에러:', e);
}
