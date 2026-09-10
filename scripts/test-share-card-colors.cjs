const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../utils/shareCanvas.js'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export \{[\s\S]*?\};\r?\n/gm, '')
  .replace('export default shareCanvas;', 'module.exports = shareCanvas;');
const sandbox = {
  module: { exports: {} },
  console: { log() {}, warn(...args) { throw new Error(args.join(' ')); } }
};
vm.runInNewContext(source, sandbox, { filename: 'utils/shareCanvas.js' });
const { drawShareCardContent } = sandbox.module.exports;

async function drawColors(postColors, shareConfig, expected) {
  const painted = [];
  let fillColor;
  const ctx = {
    clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {},
    quadraticCurveTo() {}, closePath() {}, save() {}, restore() {}, stroke() {},
    setLineWidth() {}, setStrokeStyle() {}, setTextAlign() {}, setFontSize() {},
    setFillStyle(color) { fillColor = color; },
    fill() { painted.push({ kind: 'background', color: fillColor }); },
    fillText(text) { painted.push({ kind: 'text', text, color: fillColor }); },
    measureText(text) { return { width: text.length * 20 }; }
  };
  const post = Object.freeze({
    title: 'Test title', content: 'Test poem', authorName: 'Test author',
    ...postColors
  });
  await drawShareCardContent({
    ctx, post, shareConfig: Object.freeze({ ...shareConfig }),
    canvasWidth: 750, canvasHeight: 1000, processedLines: [post.content],
    titleHeight: 70, signatureDrawHeight: 0, fontSize: 38, lineHeight: 48,
    titleFontSize: 46, titleLineHeight: 56, titleBottomSpacing: 32,
    actualFontFamily: 'Huiwen-mincho', textPadding: 60, textTopPadding: 80,
    textAreaWidth: 630, signatureTopGap: 40, fixedSignatureWidth: 240,
    signatureTextFontSize: 28, shouldShowSignature: true
  });
  assert.equal(painted.find(item => item.kind === 'background').color, expected.backgroundColor,
    'Card background must use the selected color');
  for (const text of [post.title, post.content, post.authorName]) {
    assert.equal(painted.find(item => item.text === text).color, expected.textColor,
      `${text} must use the selected text color`);
  }
}

(async () => {
  const original = { backgroundColor: '#ACCAB2', textColor: '#D44720' };
  const navy = { backgroundColor: '#28374D', textColor: '#DDE6ED' };
  const warm = { backgroundColor: '#E9A752', textColor: '#78614D' };

  // Opening a card preserves its colors; each subsequent selection must change the drawing.
  await drawColors(original, original, original);
  await drawColors(original, navy, navy);
  await drawColors(original, warm, warm);
  await drawColors(original, original, original);

  // Each missing or blank setting falls back independently to the original post.
  await drawColors(original, {}, original);
  await drawColors(original, { backgroundColor: '  ', textColor: '\t' }, original);
  await drawColors(original, { backgroundColor: navy.backgroundColor }, {
    backgroundColor: navy.backgroundColor, textColor: original.textColor
  });
  await drawColors(original, { textColor: navy.textColor }, {
    backgroundColor: original.backgroundColor, textColor: navy.textColor
  });
  await drawColors({}, navy, navy);
  await drawColors({}, {}, { backgroundColor: '#a4c4bd', textColor: '#333333' });
  await drawColors(original, { backgroundColor: ` ${navy.backgroundColor} `, textColor: ` ${navy.textColor} ` }, navy);
  console.log('[test-share-card-colors] PASS (11 render cases: background, title, poem and author colors)');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
