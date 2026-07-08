import type { ParsedMermaid } from '../core/mermaid/parser';
import type { EdgePosition, NodePosition } from '../core/mermaid/renderer';
import type { MermaidClassExportMode } from '../core/mermaid/converter';
import type { DrawioEditabilityLabel, DrawioMode } from '../core/drawio/output';
import type { DrawioSupportAnalysis } from '../core/drawio/support';
import type { ParsedPlantUML } from '../core/plantuml/parser';
import type { ExtractedSvgLayoutEdge, ExtractedSvgLayoutNode } from '../core/drawio/svgLayout';
import type { ParseCoverage, ParseDiagnostic } from '../types/diagnostics';

export type ConvertMermaidMessage = {
  type: 'convert-mermaid';
  requestId: number;
  ast: ParsedMermaid;
  positions: NodePosition[];
  edges: EdgePosition[];
  code: string;
  svg: string;
  classExportMode: MermaidClassExportMode;
};

export type ConvertPlantUmlMessage = {
  type: 'convert-plantuml';
  requestId: number;
  ast: ParsedPlantUML;
  svg: string;
  positions: ExtractedSvgLayoutNode[];
  edges?: ExtractedSvgLayoutEdge[];
};

export type WorkerResultMessage = {
  type: 'result';
  requestId: number;
  drawioXml: string;
  drawioMode: DrawioMode;
  editabilityLabel: DrawioEditabilityLabel;
  exportDiagnostics: string[];
  unsupportedFeatures: string[];
  supportAnalysis: DrawioSupportAnalysis;
  svg?: string;
  diagnostics?: ParseDiagnostic[];
  coverage?: ParseCoverage;
};

export type WorkerErrorMessage = {
  type: 'error';
  requestId: number;
  error: { message: string; line?: number; suggestion?: string };
};

export type WorkerMessage =
  | ConvertMermaidMessage
  | ConvertPlantUmlMessage
  | WorkerResultMessage
  | WorkerErrorMessage;
