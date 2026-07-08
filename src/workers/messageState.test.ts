import { expect, test } from 'vitest';
import { applyWorkerError, applyWorkerResult } from './messageState';
import { ParseResult } from '../store/editorStore';
import { EMPTY_SUPPORT_ANALYSIS } from '../core/drawio/support';

const pendingResult: ParseResult = {
  svg: '<svg width="100" height="100"></svg>',
  drawioXml: '',
  drawioMode: 'native-full',
  editabilityLabel: 'Editable',
  exportDiagnostics: [],
  unsupportedFeatures: [],
  supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  xmlStatus: 'pending',
};

test('applyWorkerResult ignores stale worker responses', () => {
  const next = applyWorkerResult(pendingResult, {
    type: 'result',
    requestId: 3,
    drawioXml: '<mxfile />',
    drawioMode: 'native-full',
    editabilityLabel: 'Editable',
    exportDiagnostics: [],
    unsupportedFeatures: [],
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  }, 4);

  expect(next).toBeNull();
});

test('applyWorkerResult marks the latest worker response ready', () => {
  const next = applyWorkerResult(pendingResult, {
    type: 'result',
    requestId: 4,
    drawioXml: '<mxfile />',
    drawioMode: 'native-hybrid',
    editabilityLabel: 'Editable with visual fallbacks',
    exportDiagnostics: ['subgraph preserved as a container'],
    unsupportedFeatures: ['subgraph preserved as a container'],
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  }, 4);

  expect(next).toEqual({
    svg: '<svg width="100" height="100"></svg>',
    drawioXml: '<mxfile />',
    drawioMode: 'native-hybrid',
    editabilityLabel: 'Editable with visual fallbacks',
    exportDiagnostics: ['subgraph preserved as a container'],
    unsupportedFeatures: ['subgraph preserved as a container'],
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
    xmlStatus: 'ready',
    diagnostics: [],
    coverage: undefined,
    isStale: false,
  });
});

test('applyWorkerError marks the latest worker response unavailable', () => {
  const next = applyWorkerError(pendingResult, {
    type: 'error',
    requestId: 4,
    error: { message: 'boom' },
  }, 4);

  expect(next).toEqual({
    svg: '<svg width="100" height="100"></svg>',
    drawioXml: '',
    drawioMode: 'native-full',
    editabilityLabel: 'Editable',
    exportDiagnostics: [],
    unsupportedFeatures: [],
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
    xmlStatus: 'error',
  });
});
