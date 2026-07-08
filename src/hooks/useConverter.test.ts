import { expect, test } from 'vitest';
import { createStalePreview } from './useConverter';
import { EMPTY_SUPPORT_ANALYSIS } from '../core/drawio/support';

test('stale previews retain only the visual and cannot claim current editable output', () => {
  const stale = createStalePreview({
    svg: '<svg width="100" height="60"></svg>',
    drawioXml: '<mxfile>old editable document</mxfile>',
    drawioMode: 'native-full',
    editabilityLabel: 'Editable',
    exportDiagnostics: [],
    unsupportedFeatures: [],
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
    xmlStatus: 'ready',
  });

  expect(stale.svg).toContain('<svg');
  expect(stale.drawioXml).toBe('');
  expect(stale.drawioMode).toBe('visual-full');
  expect(stale.editabilityLabel).toBe('Visual only');
  expect(stale.xmlStatus).toBe('pending');
  expect(stale.isStale).toBe(true);
});
