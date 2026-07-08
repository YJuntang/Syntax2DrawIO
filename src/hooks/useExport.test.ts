import { expect, test } from 'vitest';
import { clampPngScale, getPngExportDescription } from './useExport';

test('PNG export scale is clamped to supported values', () => {
  expect(clampPngScale(Number.NaN)).toBe(1);
  expect(clampPngScale(0)).toBe(1);
  expect(clampPngScale(3)).toBe(3);
  expect(clampPngScale(8)).toBe(4);
});

test('PNG export description includes scale and background', () => {
  expect(getPngExportDescription(2, 'white')).toBe('2x, white background');
  expect(getPngExportDescription(3, 'transparent')).toBe('3x, transparent background');
});
