import { convertSequenceToDrawio } from '../../drawio/sequence';
import { normalizeRenderResult } from '../../drawio/layout';
import { ParsedMermaid } from '../parser';
import { RenderResult } from '../renderer';

export function convertSequence(ast: ParsedMermaid, renderResult?: RenderResult): string {
  const renderHints = renderResult ? normalizeRenderResult(renderResult) : undefined;
  return convertSequenceToDrawio(
    ast.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
    })),
    ast.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      isDashed: edge.isDashed,
      isSelf: edge.isSelf,
    })),
    {
      notes: ast.notes || [],
      groups: ast.groups || [],
      activations: ast.activations || [],
      renderHints,
    }
  );
}
