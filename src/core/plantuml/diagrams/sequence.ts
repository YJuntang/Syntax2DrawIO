import { convertSequenceToDrawio } from '../../drawio/sequence';
import type { RenderHintSet } from '../../drawio/renderHints';
import { ParsedPlantUML } from '../parser';

export function convertSequence(ast: ParsedPlantUML, renderHints?: RenderHintSet): string {
  return convertSequenceToDrawio(
    ast.nodes.map((node) => ({
      id: node.id,
      label: node.name,
      type: node.type,
    })),
    ast.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.sourceId,
      target: edge.targetId,
      label: edge.label,
      isDashed: edge.isDashed,
      isSelf: edge.sourceId === edge.targetId,
    })),
    {
      notes: ast.notes || [],
      groups: ast.groups || [],
      activations: ast.activations || [],
      renderHints,
    }
  );
}
