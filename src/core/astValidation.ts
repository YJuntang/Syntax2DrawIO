import type { ParseDiagnostic } from '../types/diagnostics';
import { normalizeDrawioId } from './drawio/builder';

interface AstNodeLike {
  id: string;
  parentId?: string;
}

interface AstEdgeLike {
  id?: string;
  source: string;
  target: string;
}

export function validateAstInvariants(
  nodes: AstNodeLike[],
  edges: AstEdgeLike[],
  codePrefix: string
): ParseDiagnostic[] {
  const diagnostics: ParseDiagnostic[] = [];
  const nodeIds = new Set<string>();
  const drawioIds = new Set<string>();

  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      diagnostics.push({
        severity: 'error',
        code: `${codePrefix}.duplicate-node-id`,
        message: `Duplicate node id "${node.id}" cannot be exported safely.`,
      });
    }
    nodeIds.add(node.id);

    const drawioId = normalizeDrawioId(node.id);
    if (!drawioId || drawioIds.has(drawioId)) {
      diagnostics.push({
        severity: 'error',
        code: `${codePrefix}.drawio-id-collision`,
        message: `Node id "${node.id}" collides after Draw.io id normalization.`,
      });
    }
    drawioIds.add(drawioId);
  }

  for (const node of nodes) {
    if (node.parentId && !nodeIds.has(node.parentId)) {
      diagnostics.push({
        severity: 'error',
        code: `${codePrefix}.missing-parent`,
        message: `Node "${node.id}" references missing parent "${node.parentId}".`,
      });
    }
  }

  const edgeIds = new Set<string>();
  edges.forEach((edge, index) => {
    const edgeId = edge.id || `edge-${index}`;
    const normalizedEdgeId = normalizeDrawioId(edgeId);
    if (edgeIds.has(normalizedEdgeId) || drawioIds.has(normalizedEdgeId)) {
      diagnostics.push({
        severity: 'error',
        code: `${codePrefix}.duplicate-edge-id`,
        message: `Edge id "${edgeId}" collides with another exported cell.`,
      });
    }
    edgeIds.add(normalizedEdgeId);

    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      diagnostics.push({
        severity: 'error',
        code: `${codePrefix}.missing-edge-endpoint`,
        message: `Edge "${edgeId}" references a missing node.`,
      });
    }
  });

  return diagnostics;
}
