// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { extractSvgEdges, extractSvgLayout } from './svgLayout';

describe('svgLayout', () => {
  it('extracts PlantUML entity, cluster, and link hints without elem ids', () => {
    document.body.innerHTML = '';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <g class="cluster" data-qualified-name="Platform.Ordering" id="ent0005">
          <rect x="100" y="80" width="400" height="220"/>
          <text x="120" y="110">Ordering System</text>
        </g>
        <g class="entity" data-qualified-name="Platform.Ordering.Checkout" id="ent0007">
          <ellipse cx="240" cy="180" rx="60" ry="30"/>
          <text x="210" y="178">Checkout</text>
          <text x="220" y="194">Order</text>
        </g>
        <g class="link" id="lnk12">
          <path id="Customer-to-Checkout" d="M10,10 C20,20 30,30 40,40"/>
          <text x="25" y="18">starts</text>
        </g>
        <g class="link" id="lnk13">
          <path id="Checkout-to-Payment" d="M40,40 C60,50 80,60 100,70"/>
          <text><tspan x="72" y="48">«include»</tspan></text>
        </g>
        <g class="link" id="lnk14">
          <path id="Gateway-to-Payment" d="M100,100 C140,180 220,185 280,110"/>
          <text x="180" y="150">uses</text>
        </g>
      </svg>
    `;

    const nodes = extractSvgLayout(svg, ['g.entity', 'g.cluster']);
    const edges = extractSvgEdges(svg, ['g.link']);

    expect(nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'Ordering', label: 'Ordering System' }),
      expect.objectContaining({ id: 'Checkout', label: 'Checkout Order' }),
    ]));
    expect(edges).toEqual([
      expect.objectContaining({
        id: 'Customer-to-Checkout',
        sourcePoint: { x: 10, y: 10 },
        targetPoint: { x: 40, y: 40 },
        waypoints: [],
        label: 'starts',
        labelPosition: { x: 25, y: 18 },
      }),
      expect.objectContaining({
        id: 'Checkout-to-Payment',
        sourcePoint: { x: 40, y: 40 },
        targetPoint: { x: 100, y: 70 },
        waypoints: [],
        label: '«include»',
        labelPosition: { x: 72, y: 48 },
      }),
      expect.objectContaining({
        id: 'Gateway-to-Payment',
        sourcePoint: { x: 100, y: 100 },
        targetPoint: { x: 280, y: 110 },
        waypoints: [{ x: 220, y: 185 }],
        label: 'uses',
        labelPosition: { x: 180, y: 150 },
      }),
    ]);
  });
});
