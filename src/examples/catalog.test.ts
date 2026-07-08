// @vitest-environment jsdom

import { expect, test } from 'vitest';
import { analyzeDrawioExport } from '../core/drawio/analysis';
import { normalizeDrawioId } from '../core/drawio/builder';
import { prepareDrawioTransfer } from '../core/drawio/transfer';
import { convertMermaidToDrawio } from '../core/mermaid/converter';
import { parseMermaidAst, type ParsedMermaid } from '../core/mermaid/parser';
import type { RenderResult } from '../core/mermaid/renderer';
import { convertPlantUMLToDrawio } from '../core/plantuml/converter';
import { parsePlantUML } from '../core/plantuml/parser';
import { preprocessPlantUML } from '../core/plantuml/preprocessor';
import { DIAGRAM_EXAMPLES } from './catalog';

test('catalog contains one native complex example for every supported diagram family', () => {
  expect(DIAGRAM_EXAMPLES.map((example) => example.id)).toEqual([
    'mermaid-flowchart',
    'mermaid-sequence',
    'mermaid-class',
    'mermaid-er',
    'plantuml-sequence',
    'plantuml-class',
    'plantuml-usecase',
  ]);
  expect(DIAGRAM_EXAMPLES.every((example) => example.expectedMode === 'native-full')).toBe(true);
});

test('all bundled Mermaid examples are accepted by the installed Mermaid runtime', async () => {
  const mermaid = (await import('mermaid')).default;
  for (const example of DIAGRAM_EXAMPLES.filter((item) => item.type === 'mermaid')) {
    await expect(mermaid.parse(example.code), example.id).resolves.toBeTruthy();
  }
});

test.each(DIAGRAM_EXAMPLES)('$name is exact, native, non-empty, and safe for Draw.io transfer', async (example) => {
  const svg = '<svg width="1200" height="800" viewBox="0 0 1200 800"></svg>';
  let astNodes: Array<{ id: string; label: string }> = [];
  let astEdges: Array<{ id?: string }> = [];
  let subtype = '';
  let coverage;
  let diagnostics;
  let unsupportedFeatures: string[] = [];
  let rawResult;

  if (example.type === 'mermaid') {
    const ast = await parseMermaidAst(example.code);
    const renderResult = createRenderResult(ast, svg);
    rawResult = convertMermaidToDrawio(ast, renderResult, example.code, { classExportMode: 'editable' });
    astNodes = [
      ...ast.nodes,
      ...(ast.subgraphs || []).map((subgraph) => ({ id: subgraph.id, label: subgraph.label })),
    ];
    astEdges = ast.edges;
    subtype = ast.type === 'class'
      ? 'classDiagram'
      : ast.type === 'er'
          ? 'erDiagram'
          : ast.type;
    coverage = ast.coverage;
    diagnostics = ast.diagnostics;
    unsupportedFeatures = ast.unsupportedFeatures || [];
  } else {
    const ast = parsePlantUML(preprocessPlantUML(example.code));
    rawResult = convertPlantUMLToDrawio(ast, svg);
    astNodes = ast.nodes.map((node) => ({ id: node.id, label: node.name }));
    astEdges = ast.edges;
    subtype = ast.type;
    coverage = ast.coverage;
    diagnostics = ast.diagnostics;
    unsupportedFeatures = ast.unsupportedFeatures;
  }

  const result = analyzeDrawioExport({
    drawioXml: rawResult.drawioXml,
    drawioMode: rawResult.drawioMode,
    svg,
    unsupportedFeatures,
    supportAnalysis: rawResult.supportAnalysis,
    diagnostics,
    coverage,
    expectedContent: {
      vertexIds: astNodes.map((node) => normalizeDrawioId(node.id)),
      edgeIds: astEdges.map((edge, index) => normalizeDrawioId(edge.id || `edge-${index}`)),
    },
  });
  const transfer = prepareDrawioTransfer(result.drawioXml);

  expect(subtype).toBe(example.subtype);
  expect(astNodes.length).toBeGreaterThanOrEqual(example.minimumNodes);
  expect(astEdges.length).toBeGreaterThanOrEqual(example.minimumEdges);
  expect(coverage?.fidelity).toBe('exact');
  expect(diagnostics || []).toEqual([]);
  expect(unsupportedFeatures).toEqual([]);
  expect(result.drawioMode).toBe(example.expectedMode);
  expect(result.exportDiagnostics).toEqual([]);
  expect(transfer).not.toBeNull();
  expect(transfer!.fileXml).toMatch(/^<mxfile\b/);
  expect(transfer!.graphModelXml).toMatch(/^<mxGraphModel\b/);
  expect(transfer!.graphModelXml).toMatch(/(?:vertex|edge)="1"/);
  expect(transfer!.htmlFragment).toContain('&lt;mxGraphModel');

  const forbidden = [
    'shape=image',
    'data:image',
    'Original visual reference',
    'text/uri-list',
    'file:',
    'http://',
    'https://',
    'href=',
  ];
  forbidden.forEach((token) => expect(result.drawioXml).not.toContain(token));
  example.expectedLabels.forEach((label) => {
    const normalizedLabel = label.replace(/\\n/g, '\n');
    expect(
      astNodes.some((node) => node.label === normalizedLabel || node.label.includes(normalizedLabel)),
      `Missing expected label "${normalizedLabel}" from ${example.id}: ${astNodes.map((node) => node.label).join(', ')}`
    ).toBe(true);
  });
});

function createRenderResult(ast: ParsedMermaid, svg: string): RenderResult {
  const subgraphNodes = (ast.subgraphs || []).map((subgraph, index) => ({
    id: `cluster-${subgraph.id}`,
    label: subgraph.label,
    x: 30 + index * 30,
    y: 30 + index * 30,
    width: 1000 - index * 60,
    height: 680 - index * 60,
    shape: 'cluster',
  }));
  return {
    svg,
    nodes: [
      ...subgraphNodes,
      ...ast.nodes.map((node, index) => ({
        id: node.id,
        label: node.label,
        x: 100 + (index % 4) * 230,
        y: 100 + Math.floor(index / 4) * 150,
        width: 170,
        height: 80,
        shape: node.type || 'rect',
      })),
    ],
    edges: ast.edges.map((edge, index) => ({
      id: edge.id || `edge-${index}`,
      sourceId: edge.source,
      targetId: edge.target,
      label: edge.label || '',
      waypoints: [],
    })),
  };
}
