import { ParsedMermaid } from './parser';
import { RenderResult } from './renderer';
import { generateImageFallbackXml } from '../drawio/fallback';
import { DrawioConversionResult } from '../drawio/output';

import { convertFlowchart } from './diagrams/flowchart';
import { convertClassDiagram } from './diagrams/classDiagram';
import { convertSequence } from './diagrams/sequence';
import { convertErDiagram } from './diagrams/erDiagram';
import { mergeSupportAnalysis } from '../drawio/support';

export type MermaidClassExportMode = 'visual' | 'editable';

export interface MermaidConversionOptions {
  classExportMode?: MermaidClassExportMode;
}

export function convertMermaidToDrawio(
  ast: ParsedMermaid,
  renderResult: RenderResult,
  code: string,
  options: MermaidConversionOptions = {}
): DrawioConversionResult {
  if (ast.type === 'flowchart') {
    const supportAnalysis = mergeSupportAnalysis({
      supportedFeatures: ['flowchart nodes', 'flowchart edges', 'subgraphs', 'simple style/classDef/linkStyle directives'],
      partialFeatures: ast.unsupportedFeatures || [],
      fallbackRegions: [],
    });
    return {
      drawioXml: convertFlowchart(ast, renderResult),
      drawioMode: getNativeModeForSupport(supportAnalysis),
      supportAnalysis,
    };
  }

  if (ast.type === 'sequence') {
    const supportAnalysis = mergeSupportAnalysis({
      supportedFeatures: ['sequence participants', 'sequence messages', 'notes', 'groups', 'rect regions', 'activations'],
      partialFeatures: ast.unsupportedFeatures || [],
      fallbackRegions: [],
    });
    return {
      drawioXml: convertSequence(ast, renderResult),
      drawioMode: getNativeModeForSupport(supportAnalysis),
      supportAnalysis,
    };
  }

  if (ast.type === 'class') {
    if ((options.classExportMode ?? 'editable') === 'visual') {
      return generateImageFallbackXml(renderResult.svg);
    }

    const supportAnalysis = mergeSupportAnalysis({
      supportedFeatures: ['class nodes', 'class relationships', 'cardinalities', 'annotations'],
      partialFeatures: ast.unsupportedFeatures || [],
      fallbackRegions: [],
    });
    return {
      drawioXml: convertClassDiagram(ast, renderResult),
      drawioMode: getNativeModeForSupport(supportAnalysis),
      supportAnalysis,
    };
  }

  if (ast.type === 'er') {
    const supportAnalysis = mergeSupportAnalysis({
      supportedFeatures: ['entities', 'entity attributes', "crow's-foot cardinality relationships"],
      partialFeatures: ast.unsupportedFeatures || [],
      fallbackRegions: [],
    });
    return {
      drawioXml: convertErDiagram(ast, renderResult),
      drawioMode: getNativeModeForSupport(supportAnalysis),
      supportAnalysis,
    };
  }

  return generateImageFallbackXml(renderResult.svg);
}

function getNativeModeForSupport(supportAnalysis: ReturnType<typeof mergeSupportAnalysis>) {
  return supportAnalysis.partialFeatures.length > 0 || supportAnalysis.fallbackRegions.length > 0
    ? 'native-hybrid'
    : 'native-full';
}
