const fs = require('fs');
const path = require('path');
const { Resvg } = require('../scratch_pptx/node_modules/@resvg/resvg-js');

function escapeXML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 8대 핵심 공정 (대분류 4개 + 마일스톤 1개)
const data = [
  // 1. 기획 및 요구분석
  {
    cat1: "기획 및\n분석", cat1Span: 2,
    task: "내부 의견수렴 및 팀 R&R 확정 / 법령 분석",
    start: 0, end: 2
  },
  {
    task: "통학버스 사고 통계 분석 및 현장 요구도 조사",
    start: 1, end: 4
  },

  // 2. 시스템 설계
  {
    cat1: "시스템\n설계", cat1Span: 2,
    task: "K-Means 공간 군집화 & TSP 알고리즘 모델링",
    start: 4, end: 7
  },
  {
    task: "NestJS 아키텍처 및 PostgreSQL DB 스키마 설계",
    start: 5, end: 8
  },

  // 3. 개발 및 구현
  {
    cat1: "개발 및\n구현", cat1Span: 2,
    task: "코어 백엔드 API & SK TMap 실시간 교통량 연동",
    start: 7, end: 12
  },
  {
    task: "React 관리자 대시보드 (엑셀 연동) & Flutter 모바일 앱",
    start: 8, end: 14
  },

  // 4. 테스트 및 배포
  {
    cat1: "검증 및\n배포", cat1Span: 1,
    task: "실차 모의 주행 현장 LBS 실증 & AWS 클라우드 배포",
    start: 13, end: 17
  },

  // 5. 마일스톤
  {
    cat1: "추진\n보고", cat1Span: 1,
    task: "프로젝트 착수보고 / 중간점검 / 최종 심사보고",
    milestones: [0, 8, 17] // 착수(1M 1W), 중간(3M 1W), 최종(5M 2W)
  }
];

function generateSVG() {
  const width = 1500;
  const height = 640;

  const startX = 35;
  const startY = 48;

  const colCat1W = 120;
  const colTaskW = 500;
  const leftTableW = colCat1W + colTaskW; // 620px

  const numWeeks = 18;
  const gridW = (width - 70 - leftTableW); // 1500 - 70 - 620 = 810px
  const cellW = gridW / numWeeks; // 810 / 18 = 45px per week

  const headerH1 = 34;
  const headerH2 = 30;
  const rowH = 52; // 행 높이 52px로 시원하게 확대!

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:#ffffff; font-family:'Pretendard', 'Malgun Gothic', sans-serif;">
  <style>
    .th { font-size: 19px; font-weight: 900; fill: #0F172A; text-anchor: middle; dominant-baseline: central; }
    .th-sub { font-size: 15px; font-weight: 800; fill: #334155; text-anchor: middle; dominant-baseline: central; }
    .td-cat1 { font-size: 19px; font-weight: 900; fill: #0F172A; text-anchor: middle; dominant-baseline: central; }
    .td-task { font-size: 19px; font-weight: 800; fill: #1E293B; dominant-baseline: central; }
    .table-border { stroke: #64748B; stroke-width: 2; }
    .table-inner { stroke: #94A3B8; stroke-width: 1.2; }
    .grid-line { stroke: #CBD5E1; stroke-width: 1; }
    .grid-month { stroke: #64748B; stroke-width: 2; }
    .bar { fill: #475569; rx: 6; }
    .bar-milestone { fill: #1E3A8A; rx: 6; }
  </style>

  <!-- 상단 제목 및 [표] -->
  <text x="${startX}" y="32" font-size="28" font-weight="900" fill="#0F172A">추진 일정계획 ①</text>
  <text x="${width - 35}" y="32" font-size="24" font-weight="900" fill="#0F172A" text-anchor="end">[표]</text>

  <!-- 표 외곽선 -->
  <g id="table">
`;

  const tableY = startY;
  const totalRows = data.length;
  const tableTotalH = headerH1 + headerH2 + totalRows * rowH;

  // 전체 외곽선
  svg += `    <rect x="${startX}" y="${tableY}" width="${leftTableW + gridW}" height="${tableTotalH}" fill="#FFFFFF" class="table-border" />\n`;

  // 헤더 1행: 사업추진내용 + 1M ~ 5M
  svg += `    <rect x="${startX}" y="${tableY}" width="${leftTableW}" height="${headerH1 + headerH2}" fill="#F1F5F9" class="table-border" />\n`;
  svg += `    <text x="${startX + leftTableW / 2}" y="${tableY + (headerH1 + headerH2) / 2}" class="th" font-size="21">사업추진내용</text>\n`;

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

  // 헤더 2행: 주차
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
  const lineX2 = lineX1 + colTaskW;

  // 세로선 (주차별)
  for (let c = 0; c <= numWeeks; c++) {
    const gx = lineX2 + c * cellW;
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
        svg += `    <text x="${startX + colCat1W / 2}" y="${ry + spanH / 2 - 14}" class="td-cat1">${escapeXML(lines[0])}</text>\n`;
        svg += `    <text x="${startX + colCat1W / 2}" y="${ry + spanH / 2 + 14}" class="td-cat1">${escapeXML(lines[1])}</text>\n`;
      }
    }

    // 공정 명칭 (19px 굵은 글씨!)
    svg += `    <text x="${lineX1 + 18}" y="${ry + rowH / 2}" class="td-task">${escapeXML(row.task)}</text>\n`;

    // 간트 바
    if (row.start !== undefined && row.end !== undefined) {
      const bx = lineX2 + row.start * cellW + 4;
      const bw = (row.end - row.start + 1) * cellW - 8;
      const by = ry + 8;
      const bh = rowH - 16;
      svg += `    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" class="bar" />\n`;
    }

    // 마일스톤
    if (row.milestones) {
      row.milestones.forEach(mIdx => {
        const bx = lineX2 + mIdx * cellW + 6;
        const bw = cellW - 12;
        const by = ry + 8;
        const bh = rowH - 16;
        svg += `    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" class="bar-milestone" />\n`;
      });
    }
  }

  svg += `    <line x1="${lineX1}" y1="${tableY + headerH1 + headerH2}" x2="${lineX1}" y2="${tableY + tableTotalH}" class="table-border" />\n`;
  svg += `    <line x1="${lineX2}" y1="${tableY}" x2="${lineX2}" y2="${tableY + tableTotalH}" class="table-border" />\n`;

  svg += `  </g>\n</svg>`;
  return svg;
}

const svgContent = generateSVG();
const svgPath = path.resolve(__dirname, 'schedule_gantt_clean.svg');
const pngPath = path.resolve(__dirname, 'schedule_gantt_clean.png');

fs.writeFileSync(svgPath, svgContent);
console.log('SVG written at', svgPath);

const resvg = new Resvg(svgContent, {
  fitTo: { mode: 'width', value: 3000 },
  font: { loadSystemFonts: true, defaultFontFamily: 'Malgun Gothic' }
});

const pngData = resvg.render();
fs.writeFileSync(pngPath, pngData.asPng());
console.log('SCHEDULE_GANTT_CLEAN_PNG_CREATED:', pngData.asPng().length);
