import { normalizeRenderResult } from '../../drawio/layout';
import { renderUmlClassDiagram } from '../../drawio/umlClass';
import { ParsedMermaid } from '../parser';
import { RenderResult } from '../renderer';

export function convertClassDiagram(ast: ParsedMermaid, renderResult: RenderResult): string {
  const normalizedRenderResult = normalizeRenderResult(renderResult);
  return renderUmlClassDiagram(ast.nodes, ast.edges, {
    direction: ast.direction || 'TB',
    renderNodes: normalizedRenderResult.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    })),
    renderEdges: normalizedRenderResult.edges.map((edge) => ({
      id: edge.id,
      waypoints: edge.waypoints,
    })),
  });
}
