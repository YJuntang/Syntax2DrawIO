import { expect, test } from 'vitest';
import { generateImageFallbackXml } from './fallback';

test('fallback generates correct drawio xml', () => {
  const result = generateImageFallbackXml('<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>');
  expect(result.drawioMode).toBe('visual-full');
  expect(result.drawioXml).toContain('shape=image;image=data:image/svg+xml,');
  expect(result.drawioXml).toContain('width="100"');
});
