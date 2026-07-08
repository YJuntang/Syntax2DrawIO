import { EdgePosition, NodePosition, RenderResult } from '../mermaid/renderer';
import {
  findRenderHintNode,
  getRenderHintEdgeWaypoints,
  normalizeRenderHints,
  type RenderHintSet,
} from './renderHints';

export interface NormalizedRenderResult extends RenderResult {
  nodes: NodePosition[];
  edges: EdgePosition[];
}

export function normalizeRenderResult(renderResult: RenderResult, padding?: number): NormalizedRenderResult {
  return normalizeRenderHints(renderResult as RenderHintSet, padding) as NormalizedRenderResult;
}

export function findRenderedNode(nodes: NodePosition[], id: string, label?: string): NodePosition | undefined {
  return findRenderHintNode(nodes, id, label) as NodePosition | undefined;
}

export function getEdgeWaypoints(edges: EdgePosition[], index: number) {
  return getRenderHintEdgeWaypoints(edges, index);
}
