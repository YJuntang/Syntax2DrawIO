// @vitest-environment jsdom

import { expect, test } from 'vitest';
import { sanitizeSvg } from './sanitizer';

test('removes executable SVG content while preserving safe labels', () => {
  const safe = sanitizeSvg([
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
    '<script>alert(1)</script>',
    '<a href="javascript:alert(1)"><text>click</text></a>',
    '<foreignObject><div onclick="alert(1)">label</div></foreignObject>',
    '</svg>',
  ].join(''));

  expect(safe).not.toMatch(/script|onload|onclick|javascript:/i);
  expect(safe).toContain('label');
});

test('rejects non-SVG and oversized renderer responses', () => {
  expect(() => sanitizeSvg('<html>not svg</html>')).toThrow(/SVG/i);
  expect(() => sanitizeSvg(`<svg>${'x'.repeat(5 * 1024 * 1024)}</svg>`)).toThrow(/5 MB/);
});

test('keeps current PlantUML renderer output XML-safe when labels contain non-breaking spaces and ampersands', () => {
  const safe = sanitizeSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="648px" height="538px" viewBox="0 0 648 538">'
      + '<text x="10" y="20">\u00a0</text>'
      + '<text x="30" y="20">credentials &amp; clicks Login</text>'
      + '</svg>'
  );
  const parsed = new DOMParser().parseFromString(safe, 'image/svg+xml');

  expect(parsed.querySelector('parsererror')).toBeNull();
  expect(safe).not.toContain('&nbsp;');
  expect(parsed.documentElement.textContent).toContain('credentials & clicks Login');
});
