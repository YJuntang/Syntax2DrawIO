import type { Point } from './builder';

export interface RenderHintNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: string;
}

export interface RenderHintEdge {
  id?: string;
  sourceId?: string;
  targetId?: string;
  label?: string;
  sourcePoint?: Point;
  targetPoint?: Point;
  waypoints: Point[];
  labelPosition?: Point;
}

export interface RenderHintSet {
  svg?: string;
  nodes: RenderHintNode[];
  edges: RenderHintEdge[];
}

const DEFAULT_PADDING = 40;

export function normalizeRenderHints(renderHints: RenderHintSet, padding = DEFAULT_PADDING): RenderHintSet {
  const points: Point[] = [];

  renderHints.nodes.forEach((node) => {
    points.push({ x: node.x, y: node.y });
    points.push({ x: node.x + node.width, y: node.y + node.height });
  });

  renderHints.edges.forEach((edge) => {
    if (edge.sourcePoint) {
      points.push(edge.sourcePoint);
    }
    if (edge.targetPoint) {
      points.push(edge.targetPoint);
    }
    edge.waypoints.forEach((point) => points.push(point));
    if (edge.labelPosition) {
      points.push(edge.labelPosition);
    }
  });

  const minX = points.length > 0 ? Math.min(...points.map((point) => point.x)) : 0;
  const minY = points.length > 0 ? Math.min(...points.map((point) => point.y)) : 0;
  const offsetX = padding - minX;
  const offsetY = padding - minY;

  return {
    svg: renderHints.svg,
    nodes: renderHints.nodes.map((node) => ({
      ...node,
      x: node.x + offsetX,
      y: node.y + offsetY,
    })),
    edges: renderHints.edges.map((edge) => ({
      ...edge,
      sourcePoint: edge.sourcePoint
        ? { x: edge.sourcePoint.x + offsetX, y: edge.sourcePoint.y + offsetY }
        : undefined,
      targetPoint: edge.targetPoint
        ? { x: edge.targetPoint.x + offsetX, y: edge.targetPoint.y + offsetY }
        : undefined,
      waypoints: edge.waypoints.map((point) => ({
        x: point.x + offsetX,
        y: point.y + offsetY,
      })),
      labelPosition: edge.labelPosition
        ? { x: edge.labelPosition.x + offsetX, y: edge.labelPosition.y + offsetY }
        : undefined,
    })),
  };
}

export function findRenderHintNode(nodes: RenderHintNode[], id: string, label?: string): RenderHintNode | undefined {
  const expectedIds = getRenderHintIdCandidates(id);
  const normalizedLabel = normalizeLabel(label);

  return nodes.find((node) => intersects(expectedIds, getRenderHintIdCandidates(node.id)))
    || nodes.find((node) => Boolean(normalizedLabel) && normalizeLabel(node.label) === normalizedLabel)
    || nodes.find((node) => getRenderHintIdCandidates(node.id).some((candidate) => candidate.includes(id)))
    || nodes.find((node) => Boolean(normalizedLabel) && normalizeLabel(node.label).startsWith(normalizedLabel));
}

export function getRenderHintEdge(edges: RenderHintEdge[], index: number, edgeId?: string): RenderHintEdge | undefined {
  return edgeId ? edges.find((edge) => edge.id === edgeId) || edges[index] : edges[index];
}

export function getRenderHintEdgeWaypoints(edges: RenderHintEdge[], index: number, edgeId?: string): Point[] {
  return getRenderHintEdge(edges, index, edgeId)?.waypoints || [];
}

export function getRenderHintMessageY(edges: RenderHintEdge[], index: number, fallback: number, edgeId?: string): number {
  const edge = getRenderHintEdge(edges, index, edgeId);
  if (!edge) {
    return fallback;
  }

  if (edge.labelPosition && Number.isFinite(edge.labelPosition.y)) {
    return edge.labelPosition.y;
  }

  const yValues = edge.waypoints.map((point) => point.y).filter(Number.isFinite);
  if (yValues.length === 0) {
    return fallback;
  }

  return yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
}

export function renderHintsHaveAllNodes(
  nodes: Array<{ id: string; label?: string }>,
  renderNodes: RenderHintNode[]
) {
  return nodes.length > 0 && nodes.every((node) => findRenderHintNode(renderNodes, node.id, node.label));
}

export function toRenderHintSet(input: RenderHintSet | { svg?: string; nodes: RenderHintNode[]; edges?: RenderHintEdge[] }): RenderHintSet {
  return {
    svg: input.svg,
    nodes: input.nodes,
    edges: input.edges || [],
  };
}

export function getRenderHintIdCandidates(id: string) {
  const candidates = new Set<string>();
  const add = (value?: string | null) => {
    if (value) {
      candidates.add(value);
    }
  };

  add(id);
  add(id.replace(/^flowchart-/, '').replace(/-\d+$/, ''));
  add(id.replace(/^classId-/, '').replace(/-\d+$/, ''));
  add(id.replace(/^elem_/, ''));
  add(id.replace(/^cluster_/, ''));
  add(id.replace(/^participant-/, ''));
  add(id.replace(/^actor-/, ''));

  const flowchartMatch = id.match(/^flowchart-(.*)-\d+$/);
  add(flowchartMatch?.[1]);

  const classMatch = id.match(/^classId-(.*)-\d+$/);
  add(classMatch?.[1]);

  const elemMatch = id.match(/^elem_(.*)$/);
  add(elemMatch?.[1]);

  const clusterMatch = id.match(/^cluster_(.*)$/);
  add(clusterMatch?.[1]);

  return Array.from(candidates);
}

function normalizeLabel(label?: string) {
  return (label || '').replace(/\s+/g, ' ').trim();
}

function intersects(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}
