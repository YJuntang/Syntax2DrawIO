import { expect, test } from 'vitest';
import { formatUmlAnnotation } from './umlLabels';

test('formats UML stereotypes as visible guillemets for HTML-enabled Draw.io labels', () => {
  expect(formatUmlAnnotation('<<service>>')).toBe('«service»');
  expect(formatUmlAnnotation('<<include>>')).toBe('«include»');
});

test('leaves non-stereotype annotations unchanged', () => {
  expect(formatUmlAnnotation('{abstract}')).toBe('{abstract}');
  expect(formatUmlAnnotation('service')).toBe('service');
});
