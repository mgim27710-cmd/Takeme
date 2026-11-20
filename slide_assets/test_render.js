const { Resvg } = require('C:/2224046/Takeme/scratch_pptx/node_modules/@resvg/resvg-js');
const fs = require('fs');

const svg = `
<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="100" fill="#059669" rx="10"/>
  <text x="100" y="55" fill="#ffffff" font-size="20" font-family="sans-serif" text-anchor="middle" font-weight="bold">TakeMe OK</text>
</svg>
`;

const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 400 } });
const pngData = resvg.render();
const pngBuffer = pngData.asPng();
fs.writeFileSync('C:/2224046/Takeme/slide_assets/test_resvg.png', pngBuffer);
console.log('PNG_GENERATED_BYTES:', pngBuffer.length);
