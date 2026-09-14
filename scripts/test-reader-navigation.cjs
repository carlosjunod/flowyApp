const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Execute the real gesture worklets with deterministic animation completion.
// This verifies logic, not delivery of physical iOS touch events.
function reader({ reducedMotion = false, disabled = false, platform = 'android' } = {}) {
  let pan;
  let closes = 0;
  const values = [];
  const timings = [];
  const gesture = { Pan() {
    pan = { config: {}, handlers: {} };
    for (const key of ['enabled', 'blocksExternalGesture', 'hitSlop', 'activeOffsetX', 'failOffsetX', 'failOffsetY', 'maxPointers']) {
      pan[key] = value => { pan.config[key] = value; return pan; };
    }
    for (const key of ['onUpdate', 'onEnd', 'onFinalize']) pan[key] = callback => { pan.handlers[key] = callback; return pan; };
    return pan;
  }};
  const mocks = {
    react: { useMemo: fn => fn() },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Platform: { OS: platform }, StyleSheet: { create: x => x }, View: 'View', useWindowDimensions: () => ({ width: 390 }) },
    'react-native-gesture-handler': { Gesture: gesture, GestureDetector: 'GestureDetector' },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' },
      Easing: { out: x => x, cubic: x => x },
      runOnJS: fn => fn, useAnimatedStyle: fn => fn(), useReducedMotion: () => reducedMotion,
      useSharedValue(value) { const shared = { value }; values.push(shared); return shared; },
      withTiming(value, options, callback) { timings.push({ value, ...options }); callback?.(true); return value; },
    },
    '@/lib/theme': { useResolvedColors: () => ({ bg: '#1A1C20' }) },
  };
  const filename = path.resolve(__dirname, '../src/components/inbox/ReaderSwipe.tsx');
  const mod = new Module(filename, module);
  mod.require = name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  mod.exports.ReaderSwipe({ children: null, scrollGesture: {}, disabled, onClose: () => closes++ });
  return { pan, values, timings, closes: () => closes };
}
let cases = 0;
for (const delta of [30, 70, -130]) {
  const r = reader();
  r.pan.handlers.onUpdate({ translationX: delta });
  assert.equal(r.values[0].value, Math.max(0, delta), 'surface follows right drag only');
  r.pan.handlers.onEnd({ translationX: delta, velocityX: 10 });
  r.pan.handlers.onFinalize();
  assert.equal(r.closes(), 0);
  assert.equal(r.values[0].value, 0, 'short/reversed gestures settle back');
  cases++;
}
for (const [translationX, velocityX] of [[125, 10], [55, 800]]) {
  const r = reader();
  r.pan.handlers.onEnd({ translationX, velocityX });
  r.pan.handlers.onFinalize();
  r.pan.handlers.onEnd({ translationX, velocityX });
  assert.equal(r.closes(), 1, 'distance and deliberate flick both close exactly once');
  assert.equal(r.values[0].value, 390);
  cases++;
}
const reverse = reader();
reverse.pan.handlers.onUpdate({ translationX: -180 });
reverse.pan.handlers.onEnd({ translationX: -180, velocityX: -900 });
reverse.pan.handlers.onFinalize();
assert.equal(reverse.closes(), 0, 'fast right-to-left swipes never close');
assert.equal(reverse.values[0].value, 0);
cases++;
const cancelled = reader();
cancelled.pan.handlers.onUpdate({ translationX: 150 });
cancelled.pan.handlers.onFinalize();
assert.equal(cancelled.closes(), 0);
assert.equal(cancelled.values[0].value, 0);
cases++;
const reduced = reader({ reducedMotion: true });
reduced.pan.handlers.onEnd({ translationX: 150, velocityX: 10 });
assert.equal(reduced.timings[0].duration, 0);
assert.equal(reduced.closes(), 1);
cases++;
assert.equal(reader({ disabled: true }).pan.config.enabled, false, 'editing/embedded reader disables swipe');
cases++;
assert.equal(reader({ platform: 'ios' }).pan.config.enabled, false, 'iOS uses its system gesture without a competing custom recognizer');
cases++;
console.log(`${cases} native reader navigation scenarios passed`);
