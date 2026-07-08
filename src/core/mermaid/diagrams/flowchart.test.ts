import { expect, test } from 'vitest';
import { parseMermaidAst } from '../parser';
import { convertFlowchart } from './flowchart';

const EMPTY_RENDER_RESULT = {
  svg: '<svg width="1" height="1"></svg>',
  nodes: [],
  edges: [],
};

test('flowchart export preserves simple Mermaid style, classDef, and linkStyle directives', async () => {
  const ast = await parseMermaidAst([
    'flowchart TD',
    'A[Start] --> B[Done]',
    'style A fill:#fff7ed,stroke:#f97316,stroke-width:3px,color:#111827',
    'classDef success fill:#dcfce7,stroke:#16a34a,color:#14532d',
    'class B success',
    'linkStyle 0 stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 5',
  ].join('\n'));
  const xml = convertFlowchart(ast, EMPTY_RENDER_RESULT);

  expect(ast.unsupportedFeatures).toEqual([]);
  expect(xml).toContain('fillColor=#fff7ed');
  expect(xml).toContain('strokeColor=#f97316');
  expect(xml).toContain('fontColor=#111827');
  expect(xml).toContain('fillColor=#dcfce7');
  expect(xml).toContain('strokeColor=#16a34a');
  expect(xml).toContain('strokeColor=#ef4444');
  expect(xml).toContain('strokeWidth=2');
  expect(xml).toContain('dashed=1');
});

test('flowchart export maps Mermaid object shape syntax to native draw.io shapes', async () => {
  const ast = await parseMermaidAst([
    'flowchart TD',
    'Spec@{ shape: doc, label: "API Spec" }',
  ].join('\n'));
  const xml = convertFlowchart(ast, EMPTY_RENDER_RESULT);

  expect(ast.nodes[0]).toMatchObject({ id: 'Spec', label: 'API Spec', type: 'doc' });
  expect(xml).toContain('shape=document');
});
