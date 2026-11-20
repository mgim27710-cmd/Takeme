const fs = require('fs');
const path = require('path');
const { Resvg } = require('../scratch_pptx/node_modules/@resvg/resvg-js');

// 1. generate gantt clean
require('./generate_gantt_clean.js');

// 2. render system_flow_clean
const flowSvgPath = path.resolve(__dirname, 'system_flow_clean.svg');
const flowPngPath = path.resolve(__dirname, 'system_flow_clean.png');
const flowSvg = fs.readFileSync(flowSvgPath, 'utf8');
const flowResvg = new Resvg(flowSvg, {
  fitTo: { mode: 'width', value: 3000 },
  font: { loadSystemFonts: true, defaultFontFamily: 'Malgun Gothic' }
});
fs.writeFileSync(flowPngPath, flowResvg.render().asPng());
console.log('FLOW_CLEAN_RENDERED');

// 3. render stat_chart_clean
const statSvgPath = path.resolve(__dirname, 'stat_chart_clean.svg');
const statPngPath = path.resolve(__dirname, 'stat_chart_clean.png');
const statSvg = fs.readFileSync(statSvgPath, 'utf8');
const statResvg = new Resvg(statSvg, {
  fitTo: { mode: 'width', value: 3000 },
  font: { loadSystemFonts: true, defaultFontFamily: 'Malgun Gothic' }
});
fs.writeFileSync(statPngPath, statResvg.render().asPng());
console.log('STAT_CLEAN_RENDERED');
