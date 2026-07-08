import { describe, expect, it } from 'vitest';
import {
  findRenderHintNode,
  getRenderHintEdgeWaypoints,
  normalizeRenderHints,
  renderHintsHaveAllNodes,
} from './renderHints';

describe('renderHints', () => {
  it('normalizes nodes and edge label positions with shared padding', () => {
    const normalized = normalizeRenderHints({
      nodes: [
        { id: 'flowchart-A-0', label: 'Alpha', x: 100, y: 200, width: 80, height: 40 },
      ],
      edges: [
        {
          id: 'edge-0',
          waypoints: [{ x: 180, y: 220 }],
          labelPosition: { x: 150, y: 210 },
        },
      ],
    });

    expect(normalized.nodes[0]).toMatchObject({ x: 40, y: 40 });
    expect(normalized.edges[0].waypoints[0]).toEqual({ x: 120, y: 60 });
    expect(normalized.edges[0].labelPosition).toEqual({ x: 90, y: 50 });
  });

  it('matches Mermaid and PlantUML generated IDs back to source IDs', () => {
    const nodes = [
      { id: 'flowchart-Service-12', label: 'Service', x: 0, y: 0, width: 100, height: 50 },
      { id: 'elem_User', label: 'User', x: 0, y: 0, width: 100, height: 50 },
      { id: 'cluster_Package', label: 'Package', x: 0, y: 0, width: 100, height: 50 },
    ];

    expect(findRenderHintNode(nodes, 'Service')?.label).toBe('Service');
    expect(findRenderHintNode(nodes, 'User')?.label).toBe('User');
    expect(findRenderHintNode(nodes, 'Package')?.label).toBe('Package');
  });

  it('falls back to normalized label matching when IDs differ', () => {
    const nodes = [
      { id: 'svg-node-1', label: 'Checkout Service', x: 0, y: 0, width: 100, height: 50 },
    ];

    expect(findRenderHintNode(nodes, 'checkout', 'Checkout   Service')?.id).toBe('svg-node-1');
    expect(renderHintsHaveAllNodes([{ id: 'checkout', label: 'Checkout Service' }], nodes)).toBe(true);
  });

  it('returns edge waypoints by ID before index fallback', () => {
    const edges = [
      { id: 'edge-0', waypoints: [{ x: 1, y: 1 }] },
      { id: 'edge-1', waypoints: [{ x: 2, y: 2 }] },
    ];

    expect(getRenderHintEdgeWaypoints(edges, 0, 'edge-1')).toEqual([{ x: 2, y: 2 }]);
    expect(getRenderHintEdgeWaypoints(edges, 1, 'missing')).toEqual([{ x: 2, y: 2 }]);
  });
});
