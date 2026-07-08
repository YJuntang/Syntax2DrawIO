// @vitest-environment jsdom

import { afterEach, expect, test, vi } from 'vitest';
import { analyzeDrawioExport } from './analysis';
import { EMPTY_SUPPORT_ANALYSIS } from './support';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('keeps valid native exports editable', () => {
  const result = analyzeDrawioExport({
    drawioXml: `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`,
    drawioMode: 'native-full',
    svg: '<svg width="100" height="60"></svg>',
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  });

  expect(result.drawioMode).toBe('native-full');
  expect(result.editabilityLabel).toBe('Editable');
});

test('downgrades unsupported native exports to hybrid-native', () => {
  const result = analyzeDrawioExport({
    drawioXml: `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`,
    drawioMode: 'native-full',
    svg: '<svg width="100" height="60"></svg>',
    unsupportedFeatures: ['Subgraph container preserved, but style directives were discarded.'],
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  });

  expect(result.drawioMode).toBe('native-hybrid');
  expect(result.editabilityLabel).toBe('Editable with visual fallbacks');
});

test('downgrades invalid native exports to visual fallback', () => {
  const result = analyzeDrawioExport({
    drawioXml: `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="edge-0" edge="1" parent="1" source="missing" target="also-missing"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`,
    drawioMode: 'native-full',
    svg: '<svg width="100" height="60"></svg>',
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  });

  expect(result.drawioMode).toBe('visual-full');
  expect(result.editabilityLabel).toBe('Visual only');
  expect(result.exportDiagnostics.join(' ')).toContain('Validation failed');
});

test('downgrades image-backed native exports to visual fallback', () => {
  const result = analyzeDrawioExport({
    drawioXml: `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="image" value="" style="shape=image;image=data:image/svg+xml,test;html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`,
    drawioMode: 'native-full',
    svg: '<svg width="100" height="60"></svg>',
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  });

  expect(result.drawioMode).toBe('visual-full');
  expect(result.exportDiagnostics.join(' ')).toContain('image fallback cells');
});

test('downgrades duplicate draw.io cell ids to visual fallback once', () => {
  const result = analyzeDrawioExport({
    drawioXml: `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="dup" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="60" as="geometry"/></mxCell><mxCell id="dup" vertex="1" parent="1"><mxGeometry x="120" y="0" width="100" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`,
    drawioMode: 'native-full',
    svg: '<svg width="100" height="60"></svg>',
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  });

  expect(result.drawioMode).toBe('visual-full');
  expect(result.exportDiagnostics.filter((message) => message.includes('duplicate cell ids'))).toHaveLength(1);
});

test('validates required semantic content with a worker-safe XML parser', () => {
  vi.stubGlobal('DOMParser', undefined);
  const result = analyzeDrawioExport({
    drawioXml: '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>',
    drawioMode: 'native-full',
    svg: '<svg width="100" height="60"></svg>',
    expectedContent: { vertexIds: ['a', 'b', 'c'], edgeIds: ['edge-0', 'edge-1'] },
  });

  expect(result.drawioMode).toBe('visual-full');
  expect(result.exportDiagnostics.join(' ')).toContain('missing expected vertices');
});

test('validates expected content against normalized draw.io ids', () => {
  const result = analyzeDrawioExport({
    drawioXml: `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="E-Commerce-System" vertex="1" parent="1"><mxGeometry x="0" y="0" width="400" height="240" as="geometry"/></mxCell><mxCell id="Browse-Products" vertex="1" parent="E-Commerce-System"><mxGeometry x="20" y="40" width="160" height="60" as="geometry"/></mxCell><mxCell id="edge-0" edge="1" parent="1" source="Browse-Products" target="E-Commerce-System"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`,
    drawioMode: 'native-full',
    svg: '<svg width="400" height="240"></svg>',
    expectedContent: {
      vertexIds: ['E-Commerce System', 'Browse Products'],
      edgeIds: ['edge-0'],
    },
  });

  expect(result.drawioMode).toBe('native-full');
  expect(result.exportDiagnostics).toEqual([]);
});

test('keeps diagnostic-only hybrid exports free of hidden visual reference cells', () => {
  const result = analyzeDrawioExport({
    drawioXml: `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`,
    drawioMode: 'native-full',
    svg: '<svg width="100" height="60"></svg>',
    diagnostics: [{ severity: 'warning', code: 'partial', message: 'One statement was approximated.' }],
    coverage: { fidelity: 'partial', statementsTotal: 2, statementsParsed: 1, statementsIgnored: 1 },
  });

  expect(result.drawioMode).toBe('native-hybrid');
  expect(result.drawioXml).not.toContain('Original visual reference');
  expect(result.drawioXml).not.toContain('shape=image');
  expect(result.drawioXml).not.toContain('s2d-original-reference-layer');
});

test('adds a hidden locked visual reference only when fallback regions exist', () => {
  const result = analyzeDrawioExport({
    drawioXml: `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`,
    drawioMode: 'native-full',
    svg: '<svg width="100" height="60"></svg>',
    supportAnalysis: {
      supportedFeatures: [],
      partialFeatures: [],
      fallbackRegions: [{ id: 'visual-1', label: 'visual-only region', kind: 'fallback', reason: 'preserved visually' }],
    },
  });

  expect(result.drawioMode).toBe('native-hybrid');
  expect(result.drawioXml).toContain('Original visual reference');
  expect(result.drawioXml).toContain('visible="0"');
  expect(result.drawioXml).toContain('locked="1"');
  expect(result.drawioXml).toContain('parent="1" visible="0" locked="1"');
});
