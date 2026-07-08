// @vitest-environment jsdom

import { expect, test } from 'vitest';
import { inferRenderedNodeShape } from './renderer';

function svgGroup(markup: string) {
  const template = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  template.innerHTML = markup;
  return template.firstElementChild!;
}

test('infers Mermaid native shapes from rendered SVG classes', () => {
  expect(inferRenderedNodeShape(svgGroup('<g class="node hexagon"><polygon points="0,20 20,0 60,0 80,20 60,40 20,40"/></g>'))).toBe('hexagon');
  expect(inferRenderedNodeShape(svgGroup('<g class="node cylinder database"><path d="M0 0"/></g>'))).toBe('cylinder');
  expect(inferRenderedNodeShape(svgGroup('<g class="node subroutine"><rect width="80" height="40"/></g>'))).toBe('subroutine');
  expect(inferRenderedNodeShape(svgGroup('<g class="node document"><path d="M0 0"/></g>'))).toBe('doc');
});

test('infers useful native shapes from polygon geometry when classes are generic', () => {
  expect(inferRenderedNodeShape(svgGroup('<g class="node"><polygon points="40,0 80,30 40,60 0,30"/></g>'))).toBe('diamond');
  expect(inferRenderedNodeShape(svgGroup('<g class="node"><polygon points="0 20 20 0 60 0 80 20 60 40 20 40"/></g>'))).toBe('hexagon');
  expect(inferRenderedNodeShape(svgGroup('<g class="node"><polygon points="20,0 80,0 60,40 0,40"/></g>'))).toBe('parallelogram');
});
