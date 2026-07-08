import { LayoutHintEdge, renderUmlClassDiagram } from '../../drawio/umlClass';
import { ParsedPlantUML } from '../parser';

export function convertClassDiagram(
  ast: ParsedPlantUML,
  renderNodes?: Array<{ id: string; label: string; x: number; y: number; width?: number; height?: number }>,
  renderEdges?: LayoutHintEdge[]
) {
  return renderUmlClassDiagram(
    ast.nodes.map((node) => ({
      id: node.id,
      label: node.name,
      type: node.type,
      annotations: node.annotations,
      attributes: node.attributes,
      methods: node.methods,
      parentId: node.parentId,
    })),
    ast.edges.map((edge, index) => ({
      id: edge.id || `edge-${index}`,
      source: edge.sourceId,
      target: edge.targetId,
      label: edge.label,
      type: edge.type,
      isDashed: edge.isDashed,
      sourceCardinality: edge.sourceCardinality,
      targetCardinality: edge.targetCardinality,
      styleOverrides: edge.styleOverrides,
    })),
    {
      direction: ast.direction || 'TB',
      title: ast.title,
      renderNodes,
      renderEdges,
    }
  );
}
