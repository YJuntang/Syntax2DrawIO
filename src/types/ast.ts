export interface ASTNode {
  id: string;
  label: string;
  type?: string; // e.g. shape type
  alias?: string;
  parentId?: string;
  annotations?: string[];
  attributes?: string[];
  methods?: string[];
  styleOverrides?: Record<string, string>;
  // Used for layout coordinates
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  noteAnchorId?: string;
  notePlacement?: 'left' | 'right' | 'top' | 'bottom' | 'over';
}

export interface ASTEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceCardinality?: string;
  targetCardinality?: string;
  type?: string; // e.g. arrow style
  isDashed?: boolean;
  isSelf?: boolean;
  styleOverrides?: Record<string, string>;
}

export interface UnifiedAST {
  nodes: ASTNode[];
  edges: ASTEdge[];
  diagnostics?: ParseDiagnostic[];
  coverage?: ParseCoverage;
}
import type { ParseCoverage, ParseDiagnostic } from './diagnostics';
