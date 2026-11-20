const fs = require('fs');
const path = require('path');
const { Resvg } = require('../scratch_pptx/node_modules/@resvg/resvg-js');

const svgPath = path.resolve(__dirname, 'system_interaction_flow.svg');
const pngPath = path.resolve(__dirname, 'system_interaction_flow.png');

const svg = fs.readFileSync(svgPath, 'utf8');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 2400 }, // 초고화질 2400px 폭
  font: {
    loadSystemFonts: true,
    defaultFontFamily: 'Malgun Gothic'
  }
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();
fs.writeFileSync(pngPath, pngBuffer);
console.log('FLOW_PNG_CREATED:', pngBuffer.length);
