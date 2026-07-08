import { expect, test } from 'vitest';
import { classifyDroppedPath, isImportableDroppedPath, shouldProcessDroppedPath } from './useDesktopWindow';

test('rejects dropped drawio exports', () => {
  expect(isImportableDroppedPath('/Users/kal/Downloads/diagram.drawio')).toBe(false);
  expect(classifyDroppedPath('/Users/kal/Downloads/diagram.drawio.svg')).toBe('reject-export-artifact');
});

test('accepts dropped PlantUML source files', () => {
  expect(isImportableDroppedPath('/Users/kal/Downloads/diagram.puml')).toBe(true);
  expect(classifyDroppedPath('/Users/kal/Downloads/diagram.mermaid')).toBe('import-source');
});

test('ignores self-dropped drag-export artifacts', () => {
  expect(classifyDroppedPath('/private/var/folders/xyz/T/Syntax2DrawIO/drag-export/diagram-1.drawio')).toBe('ignore-self-export');
});

test('deduplicates repeated drop events for the same path', () => {
  const previous = { path: '/Users/kal/Downloads/diagram.puml', at: 100 };

  expect(shouldProcessDroppedPath(previous, '/Users/kal/Downloads/diagram.puml', 500)).toBe(false);
  expect(shouldProcessDroppedPath(previous, '/Users/kal/Downloads/another.puml', 500)).toBe(true);
  expect(shouldProcessDroppedPath(previous, '/Users/kal/Downloads/diagram.puml', 1500)).toBe(true);
});
