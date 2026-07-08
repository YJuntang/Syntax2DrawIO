import { generateImageFallbackXml } from '../drawio/fallback';
import { DrawioConversionResult } from '../drawio/output';
import { mergeSupportAnalysis } from '../drawio/support';
import { ParsedPlantUML } from './parser';
import { normalizeRenderHints, type RenderHintEdge, type RenderHintNode } from '../drawio/renderHints';

import { convertClassDiagram } from './diagrams/class';
import { convertSequence } from './diagrams/sequence';
import { convertUseCaseDiagram } from './diagrams/usecase';

export function convertPlantUMLToDrawio(
  ast: ParsedPlantUML,
  svg?: string,
  renderNodes?: Array<{ id: string; label: string; x: number; y: number; width?: number; height?: number }>,
  renderEdges?: Array<{
    id?: string;
    label?: string;
    labelPosition?: { x: number; y: number };
    sourcePoint?: { x: number; y: number };
    targetPoint?: { x: number; y: number };
    waypoints: Array<{ x: number; y: number }>;
  }>
): DrawioConversionResult {
  const renderHints = normalizeRenderHints({
    svg,
    nodes: (renderNodes || []).map((node): RenderHintNode => ({
      ...node,
      width: node.width || 0,
      height: node.height || 0,
    })),
    edges: (renderEdges || []).map((edge): RenderHintEdge => ({
      ...edge,
      waypoints: edge.waypoints,
    })),
  });

  if (ast.type === 'sequence') {
    const supportAnalysis = mergeSupportAnalysis({
      supportedFeatures: ['sequence participants and variants', 'sequence messages', 'notes', 'groups', 'activations'],
      partialFeatures: ast.unsupportedFeatures,
      fallbackRegions: [],
    });
    return {
      drawioXml: convertSequence(ast, renderHints),
      drawioMode: getNativeModeForSupport(supportAnalysis),
      supportAnalysis,
    };
  }

  if (ast.type === 'class') {
    const supportAnalysis = mergeSupportAnalysis({
      supportedFeatures: ['class nodes', 'abstract/interface/enum types', 'class relationships', 'cardinalities', 'annotations'],
      partialFeatures: ast.unsupportedFeatures,
      fallbackRegions: [],
    });
    return {
      drawioXml: convertClassDiagram(ast, renderHints.nodes, renderHints.edges),
      drawioMode: getNativeModeForSupport(supportAnalysis),
      supportAnalysis,
    };
  }

  if (ast.type === 'usecase') {
    const supportAnalysis = mergeSupportAnalysis({
      supportedFeatures: [
        'actors and use cases',
        'aliases and stereotypes',
        'system boundaries',
        'associations',
        'include/extend dependencies',
        'generalization',
      ],
      partialFeatures: ast.unsupportedFeatures,
      fallbackRegions: [],
    });
    return {
      drawioXml: convertUseCaseDiagram(ast, renderHints.nodes, renderHints.edges),
      drawioMode: getNativeModeForSupport(supportAnalysis),
      supportAnalysis,
    };
  }

  return generateImageFallbackXml(svg || '');
}

function getNativeModeForSupport(supportAnalysis: ReturnType<typeof mergeSupportAnalysis>) {
  return supportAnalysis.partialFeatures.length > 0 || supportAnalysis.fallbackRegions.length > 0
    ? 'native-hybrid'
    : 'native-full';
}
