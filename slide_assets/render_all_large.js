const fs = require('fs');
const path = require('path');
const { Resvg } = require('../scratch_pptx/node_modules/@resvg/resvg-js');

// 1. generate schedule gantt
require('./generate_schedule_gantt.js');

// 2. render system_interaction_flow
const flowSvgPath = path.resolve(__dirname, 'system_interaction_flow.svg');
const flowPngPath = path.resolve(__dirname, 'system_interaction_flow.png');
const flowSvg = fs.readFileSync(flowSvgPath, 'utf8');
const flowResvg = new Resvg(flowSvg, {
  fitTo: { mode: 'width', value: 2880 }, // 초고화질
  font: { loadSystemFonts: true, defaultFontFamily: 'Malgun Gothic' }
});
fs.writeFileSync(flowPngPath, flowResvg.render().asPng());
console.log('FLOW_RENDERED');

// 3. render stat_chart
const statSvgPath = path.resolve(__dirname, 'stat_chart.svg');
const statPngPath = path.resolve(__dirname, 'stat_chart.png');
const statSvg = fs.readFileSync(statSvgPath, 'utf8');
const statResvg = new Resvg(statSvg, {
  fitTo: { mode: 'width', value: 2880 },
  font: { loadSystemFonts: true, defaultFontFamily: 'Malgun Gothic' }
});
fs.writeFileSync(statPngPath, statResvg.render().asPng());
console.log('STAT_RENDERED');
