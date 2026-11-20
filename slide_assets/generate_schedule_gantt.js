const fs = require('fs');
const path = require('path');
const { Resvg } = require('../scratch_pptx/node_modules/@resvg/resvg-js');

function escapeXML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const data = [
  // 1. 기획 및 요구분석 (4행)
  {
    cat1: "기획 및\n요구분석", cat1Span: 4,
    cat2: "개발방향\n수립", cat2Span: 2,
    task: "내부 의견수렴 및 개발 팀 R&R 확정",
    start: 0, end: 1
  },
  {
    task: "통학버스 안전 법령(세림이법) 규정 분석",
    start: 0, end: 2
  },
  {
    cat2: "현장 및\n선행분석", cat2Span: 2,
    task: "도로교통공단 사고 통계 및 문제점 도출",
    start: 1, end: 3
  },
  {
    task: "학원 현장 인터뷰 및 GIS 배차 논문 조사",
    start: 2, end: 4
  },

  // 2. 시스템 설계 (4행)
  {
    cat1: "시스템\n설계", cat1Span: 4,
    cat2: "알고리즘\n설계", cat2Span: 2,
    task: "K-Means 공간 군집화 수학적 모델링",
    start: 4, end: 6
  },
  {
    task: "Convex Hull & TSP 외곽 순회 노선 설계",
    start: 5, end: 7
  },
  {
    cat2: "아키텍처\n및 DB설계", cat2Span: 2,
    task: "NestJS 아키텍처 및 REST API 엔드포인트 명세",
    start: 6, end: 8
  },
  {
    task: "PostgreSQL 16 E-R 다이어그램 & 스키마 설계",
    start: 6, end: 8
  },

  // 3. 시스템 개발 (5행)
  {
    cat1: "시스템\n개발", cat1Span: 5,
    cat2: "코어 백엔드\n& GIS", cat2Span: 3,
    task: "NestJS 11 REST API 서버 및 TypeORM 구축",
    start: 7, end: 12
  },
  {
    task: "Naver 지오코딩 & SK TMap 실시간 교통량 연동",
    start: 8, end: 11
  },
  {
    task: "0.2초 초저지연 WebSocket 관제 & 3단계 알림",
    start: 9, end: 13
  },
  {
    cat2: "웹 & 모바일\n클라이언트", cat2Span: 2,
    task: "React 19 관리자 웹 & ExcelJS 엑셀 파서 개발",
    start: 8, end: 13
  },
  {
    task: "Flutter 3 기사용(GPS/네비) & 학부모 안심 앱",
    start: 9, end: 14
  },

  // 4. 테스트 및 배포 (2행)
  {
    cat1: "테스트 및\n배포", cat1Span: 2,
    cat2: "실증 및 배포", cat2Span: 2,
    task: "실차 모의 주행 현장 LBS 실증 & 부하 테스트",
    start: 13, end: 16
  },
  {
    task: "AWS EC2 클라우드 인프라 라이브 배포 (SSL)",
    start: 15, end: 17
  },

  // 5. 마일스톤 (1행)
  {
    cat1: "추진 마일스톤", cat1Span: 1,
    cat2: "심사 보고", cat2Span: 1,
    task: "사업수행 착수보고 / 중간점검 / 최종 심사보고",
    milestones: [0, 8, 17] // 착수(1M 1W), 중간(3M 1W), 최종(5M 2W)
  }
];

function generateSVG() {
  const width = 1400;
  const height = 760;

  const startX = 35;
  const startY = 48;

  const colCat1W = 100;
  const colCat2W = 110;
  const colTaskW = 380;
  const leftTableW = colCat1W + colCat2W + colTaskW; // 590px

  const numWeeks = 18;
  const gridW = (width - 70 - leftTableW); // 1400 - 70 - 590 = 740px
  const cellW = gridW / numWeeks; // 740 / 18 ≈ 41.11px per week

  const headerH1 = 30;
  const headerH2 = 28;
  const rowH = 37.5; // 행 높이를 26px에서 37.5px로 대폭 확대!

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:#ffffff; font-family:'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;">
  <style>
    .th { font-size: 15px; font-weight: 800; fill: #0F172A; text-anchor: middle; dominant-baseline: central; }
    .th-sub { font-size: 12.5px; font-weight: 700; fill: #334155; text-anchor: middle; dominant-baseline: central; }
    .td-cat1 { font-size: 14.5px; font-weight: 800; fill: #0F172A; text-anchor: middle; dominant-baseline: central; }
    .td-cat2 { font-size: 13.5px; font-weight: 700; fill: #1E293B; text-anchor: middle; dominant-baseline: central; }
    .td-task { font-size: 14.5px; font-weight: 600; fill: #1E293B; dominant-baseline: central; }
    .table-border { stroke: #64748B; stroke-width: 1.5; }
    .table-inner { stroke: #94A3B8; stroke-width: 1; }
    .grid-line { stroke: #CBD5E1; stroke-width: 0.9; }
    .grid-month { stroke: #64748B; stroke-width: 1.5; }
    .bar { fill: #475569; rx: 4; }
    .bar-milestone { fill: #1E3A8A; rx: 4; }
  </style>

  <!-- 상단 제목 및 [표] -->
  <text x="${startX}" y="32" font-size="24" font-weight="900" fill="#0F172A">추진 일정계획 ①</text>
  <text x="${width - 35}" y="32" font-size="20" font-weight="900" fill="#0F172A" text-anchor="end">[표]</text>

  <!-- 표 외곽선 테두리 -->
  <g id="table">
`;

  const tableY = startY;
  const totalRows = data.length;
  const tableTotalH = headerH1 + headerH2 + totalRows * rowH;

  // 전체 외곽선
  svg += `    <rect x="${startX}" y="${tableY}" width="${leftTableW + gridW}" height="${tableTotalH}" fill="#FFFFFF" class="table-border" />\n`;

  // 헤더 1행: 사업추진내용 (좌측 전체 병합) + 1M ~ 5M
  svg += `    <!-- Header Row 1 -->\n`;
  svg += `    <rect x="${startX}" y="${tableY}" width="${leftTableW}" height="${headerH1 + headerH2}" fill="#F1F5F9" class="table-border" />\n`;
  svg += `    <text x="${startX + leftTableW / 2}" y="${tableY + (headerH1 + headerH2) / 2}" class="th" font-size="16">사업추진내용</text>\n`;

  const months = [
    { label: "1M", weeks: 4 },
    { label: "2M", weeks: 4 },
    { label: "3M", weeks: 4 },
    { label: "4M", weeks: 4 },
    { label: "5M", weeks: 2 }
  ];

  let curX = startX + leftTableW;
  months.forEach(m => {
    const mW = m.weeks * cellW;
    svg += `    <rect x="${curX}" y="${tableY}" width="${mW}" height="${headerH1}" fill="#E2E8F0" class="table-border" />\n`;
    svg += `    <text x="${curX + mW / 2}" y="${tableY + headerH1 / 2}" class="th">${m.label}</text>\n`;
    curX += mW;
  });

  // 헤더 2행: 주차 (1W, 2W, 3W, 4W ...)
  svg += `    <!-- Header Row 2: Weeks -->\n`;
  curX = startX + leftTableW;
  months.forEach(m => {
    for (let w = 1; w <= m.weeks; w++) {
      svg += `    <rect x="${curX}" y="${tableY + headerH1}" width="${cellW}" height="${headerH2}" fill="#F8FAFC" class="grid-line" />\n`;
      svg += `    <text x="${curX + cellW / 2}" y="${tableY + headerH1 + headerH2 / 2}" class="th-sub">${w}W</text>\n`;
      curX += cellW;
    }
  });

  const rowsStartY = tableY + headerH1 + headerH2;
  const lineX1 = startX + colCat1W;
  const lineX2 = lineX1 + colCat2W;
  const lineX3 = lineX2 + colTaskW;

  // 세로 격자선 (주차별)
  for (let c = 0; c <= numWeeks; c++) {
    const gx = lineX3 + c * cellW;
    const isMonthBoundary = (c === 0 || c === 4 || c === 8 || c === 12 || c === 16 || c === 18);
    const cls = isMonthBoundary ? 'grid-month' : 'grid-line';
    svg += `    <line x1="${gx}" y1="${tableY + headerH1}" x2="${gx}" y2="${tableY + tableTotalH}" class="${cls}" />\n`;
  }

  // 행별 렌더링
  for (let i = 0; i < totalRows; i++) {
    const row = data[i];
    const ry = rowsStartY + i * rowH;

    const isLastRow = (i === totalRows - 1);
    const lineClass = isLastRow ? 'table-border' : 'table-inner';
    svg += `    <line x1="${startX}" y1="${ry + rowH}" x2="${startX + leftTableW + gridW}" y2="${ry + rowH}" class="${lineClass}" />\n`;

    // 대분류
    if (row.cat1) {
      const spanH = row.cat1Span * rowH;
      svg += `    <rect x="${startX}" y="${ry}" width="${colCat1W}" height="${spanH}" fill="#F8FAFC" class="table-border" />\n`;
      const lines = row.cat1.split('\n');
      if (lines.length === 1) {
        svg += `    <text x="${startX + colCat1W / 2}" y="${ry + spanH / 2}" class="td-cat1">${escapeXML(lines[0])}</text>\n`;
      } else {
        svg += `    <text x="${startX + colCat1W / 2}" y="${ry + spanH / 2 - 10}" class="td-cat1">${escapeXML(lines[0])}</text>\n`;
        svg += `    <text x="${startX + colCat1W / 2}" y="${ry + spanH / 2 + 10}" class="td-cat1">${escapeXML(lines[1])}</text>\n`;
      }
    }

    // 중분류
    if (row.cat2) {
      const spanH = row.cat2Span * rowH;
      svg += `    <rect x="${lineX1}" y="${ry}" width="${colCat2W}" height="${spanH}" fill="#FFFFFF" class="table-border" />\n`;
      const lines = row.cat2.split('\n');
      if (lines.length === 1) {
        svg += `    <text x="${lineX1 + colCat2W / 2}" y="${ry + spanH / 2}" class="td-cat2">${escapeXML(lines[0])}</text>\n`;
      } else {
        svg += `    <text x="${lineX1 + colCat2W / 2}" y="${ry + spanH / 2 - 10}" class="td-cat2">${escapeXML(lines[0])}</text>\n`;
        svg += `    <text x="${lineX1 + colCat2W / 2}" y="${ry + spanH / 2 + 10}" class="td-cat2">${escapeXML(lines[1])}</text>\n`;
      }
    }

    // 세부 추진내용 텍스트 (14.5px!)
    svg += `    <text x="${lineX2 + 12}" y="${ry + rowH / 2}" class="td-task">${escapeXML(row.task)}</text>\n`;

    // 간트 바 (회색 블록)
    if (row.start !== undefined && row.end !== undefined) {
      const bx = lineX3 + row.start * cellW + 3;
      const bw = (row.end - row.start + 1) * cellW - 6;
      const by = ry + 6;
      const bh = rowH - 12;
      svg += `    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" class="bar" />\n`;
    }

    // 마일스톤 블록
    if (row.milestones) {
      row.milestones.forEach(mIdx => {
        const bx = lineX3 + mIdx * cellW + 5;
        const bw = cellW - 10;
        const by = ry + 6;
        const bh = rowH - 12;
        svg += `    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" class="bar-milestone" />\n`;
      });
    }
  }

  // 좌측 세로 구분선들
  svg += `    <line x1="${lineX1}" y1="${tableY + headerH1 + headerH2}" x2="${lineX1}" y2="${tableY + tableTotalH}" class="table-border" />\n`;
  svg += `    <line x1="${lineX2}" y1="${tableY + headerH1 + headerH2}" x2="${lineX2}" y2="${tableY + tableTotalH}" class="table-border" />\n`;
  svg += `    <line x1="${lineX3}" y1="${tableY}" x2="${lineX3}" y2="${tableY + tableTotalH}" class="table-border" />\n`;

  svg += `  </g>\n</svg>`;
  return svg;
}

const svgContent = generateSVG();
const svgPath = path.resolve(__dirname, 'schedule_gantt.svg');
const pngPath = path.resolve(__dirname, 'schedule_gantt.png');

fs.writeFileSync(svgPath, svgContent);
console.log('SVG written at', svgPath);

const resvg = new Resvg(svgContent, {
  fitTo: { mode: 'width', value: 2800 },
  font: {
    loadSystemFonts: true,
    defaultFontFamily: 'Malgun Gothic'
  }
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();
fs.writeFileSync(pngPath, pngBuffer);
console.log('SCHEDULE_GANTT_PNG_CREATED (LARGE TEXT):', pngBuffer.length);
