// @vitest-environment jsdom

import { expect, test } from 'vitest';
import { parseMermaidAst } from '../parser';
import { convertErDiagram } from './erDiagram';

const EMPTY_RENDER_RESULT = {
  svg: '<svg width="1" height="1"></svg>',
  nodes: [],
  edges: [],
};

test('ER export maps mirrored crow-foot cardinalities to native draw.io markers', async () => {
  const ast = await parseMermaidAst([
    'erDiagram',
    'ORDER }o--|| CUSTOMER : belongs_to',
  ].join('\n'));
  const xml = convertErDiagram(ast, EMPTY_RENDER_RESULT);

  expect(xml).toContain('startArrow=ERzeroToMany');
  expect(xml).toContain('endArrow=ERmandOne');
});

test('ER export creates editable attribute rows instead of flattening entity text', async () => {
  const ast = await parseMermaidAst([
    'erDiagram',
    'CUSTOMER {',
    '  string customer_id PK',
    '  string email',
    '}',
  ].join('\n'));
  const xml = convertErDiagram(ast, EMPTY_RENDER_RESULT);
  const document = new DOMParser().parseFromString(xml, 'application/xml');

  expect(document.querySelector('mxCell[id="CUSTOMER"]')?.getAttribute('value')).toBe('CUSTOMER');
  expect(document.querySelector('mxCell[id="CUSTOMER-attribute-0"]')?.getAttribute('parent')).toBe('CUSTOMER');
  expect(document.querySelector('mxCell[id="CUSTOMER-attribute-0"]')?.getAttribute('value')).toContain('customer_id');
  expect(document.querySelector('mxCell[id="CUSTOMER"]')?.getAttribute('value')).not.toContain('customer_id');
});

test('ER export preserves renderer edge waypoints for preview-like routing', async () => {
  const ast = await parseMermaidAst([
    'erDiagram',
    'CUSTOMER ||--o{ ORDER : places',
  ].join('\n'));
  const xml = convertErDiagram(ast, {
    svg: '<svg/>',
    nodes: [
      { id: 'CUSTOMER', label: 'CUSTOMER', x: 0, y: 0, width: 180, height: 80, shape: 'entity' },
      { id: 'ORDER', label: 'ORDER', x: 300, y: 120, width: 180, height: 80, shape: 'entity' },
    ],
    edges: [{ id: 'edge-0', sourceId: 'CUSTOMER', targetId: 'ORDER', label: 'places', waypoints: [{ x: 220, y: 90 }] }],
  });

  expect(xml).toContain('<mxPoint x="260" y="130"/>');
});
