import { expect, test } from 'vitest';
import { getDesktopSaveErrorMessage, normalizeDesktopPath } from './platform';

test('normalizeDesktopPath leaves plain filesystem paths unchanged', () => {
  const result = normalizeDesktopPath('/Users/kal/Downloads/diagram.drawio');

  expect(result.target).toBe('/Users/kal/Downloads/diagram.drawio');
  expect(result.displayPath).toBe('/Users/kal/Downloads/diagram.drawio');
});

test('normalizeDesktopPath converts file URLs for desktop writes', () => {
  const result = normalizeDesktopPath('file:///Users/kal/Downloads/diagram.drawio');

  expect(result.target).toBeInstanceOf(URL);
  expect(result.displayPath).toBe('/Users/kal/Downloads/diagram.drawio');
});

test('normalizeDesktopPath strips the leading slash from Windows file URLs', () => {
  const result = normalizeDesktopPath('file:///C:/Users/kal/Downloads/diagram.drawio');

  expect(result.target).toBeInstanceOf(URL);
  expect(result.displayPath).toBe('C:/Users/kal/Downloads/diagram.drawio');
});

test('getDesktopSaveErrorMessage prefers the thrown error message', () => {
  expect(getDesktopSaveErrorMessage(new Error('permission denied'), 'Failed to save file.')).toBe('permission denied');
});

test('getDesktopSaveErrorMessage falls back when no usable message exists', () => {
  expect(getDesktopSaveErrorMessage({}, 'Failed to save file.')).toBe('Failed to save file.');
});
