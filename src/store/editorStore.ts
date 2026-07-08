import { create } from 'zustand';
import { DrawioEditabilityLabel, DrawioMode } from '../core/drawio/output';
import { DrawioSupportAnalysis } from '../core/drawio/support';
import {
  DEFAULT_PREVIEW_VIEWPORT,
  fitPreviewViewport,
  panPreviewViewportBy,
  PreviewViewport,
  resetPreviewViewport,
  setPreviewContentSize,
  setPreviewViewportSize,
  zoomPreviewViewportAtPoint,
} from '../components/preview/previewViewport';
import type { ParseCoverage, ParseDiagnostic } from '../types/diagnostics';
import { DEFAULT_EXAMPLE } from '../examples/catalog';

export const DEFAULT_SOURCE_CODE = DEFAULT_EXAMPLE.code;

export interface ParseError {
  message: string;
  line?: number;
  suggestion?: string;
}

export type XmlStatus = 'pending' | 'ready' | 'error';

export interface ParseResult {
  svg: string;
  drawioXml: string;
  drawioMode: DrawioMode;
  editabilityLabel: DrawioEditabilityLabel;
  exportDiagnostics: string[];
  unsupportedFeatures: string[];
  supportAnalysis: DrawioSupportAnalysis;
  xmlStatus: XmlStatus;
  diagnostics?: ParseDiagnostic[];
  coverage?: ParseCoverage;
  isStale?: boolean;
}

interface EditorState {
  sourceCode: string;
  sourceFilePath: string | null;
  currentFilePath: string | null;
  lastSavedSourceCode: string;
  lastExportPath: string | null;
  diagramType: {
    detected: 'mermaid' | 'plantuml' | null;
    subtype: string;
    confidence: number;
    override: 'mermaid' | 'plantuml' | null;
  };
  parseResult: ParseResult | null;
  parseError: ParseError | null;
  isConverting: boolean;
  previewViewport: PreviewViewport;
  
  setSourceCode: (code: string) => void;
  loadDocument: (code: string, filePath?: string | null) => void;
  markSourceSaved: (filePath?: string | null) => void;
  markDocumentSaved: (filePath?: string | null) => void;
  markExportSaved: (filePath?: string | null) => void;
  setSourceFilePath: (filePath: string | null) => void;
  setCurrentFilePath: (filePath: string | null) => void;
  setDiagramTypeOverride: (override: 'mermaid' | 'plantuml' | null) => void;
  setDetectedType: (detected: 'mermaid' | 'plantuml' | null, subtype: string, confidence: number) => void;
  setParseResult: (result: ParseResult | null) => void;
  setParseError: (error: ParseError | null) => void;
  setIsConverting: (isConverting: boolean) => void;
  setPreviewViewport: (viewport: Partial<PreviewViewport>) => void;
  setPreviewViewportSize: (viewportWidth: number, viewportHeight: number) => void;
  setPreviewContentSize: (contentWidth: number, contentHeight: number) => void;
  panPreviewBy: (deltaX: number, deltaY: number) => void;
  zoomPreviewAtPoint: (nextZoom: number, anchorX: number, anchorY: number) => void;
  fitPreview: (padding?: number) => void;
  resetPreview: () => void;
  resetPreviewState: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  sourceCode: DEFAULT_SOURCE_CODE,
  sourceFilePath: null,
  currentFilePath: null,
  lastSavedSourceCode: DEFAULT_SOURCE_CODE,
  lastExportPath: null,
  diagramType: {
    detected: null,
    subtype: '',
    confidence: 0,
    override: null,
  },
  parseResult: null,
  parseError: null,
  isConverting: false,
  previewViewport: DEFAULT_PREVIEW_VIEWPORT,

  setSourceCode: (sourceCode) => set({ sourceCode }),
  loadDocument: (sourceCode, sourceFilePath = null) =>
    set({
      sourceCode,
      sourceFilePath,
      currentFilePath: sourceFilePath,
      lastSavedSourceCode: sourceCode,
    }),
  markSourceSaved: (filePath) =>
    set((state) => ({
      sourceFilePath: filePath ?? state.sourceFilePath,
      currentFilePath: filePath ?? state.currentFilePath,
      lastSavedSourceCode: state.sourceCode,
    })),
  markDocumentSaved: (filePath) =>
    set((state) => ({
      sourceFilePath: filePath ?? state.sourceFilePath,
      currentFilePath: filePath ?? state.currentFilePath,
      lastSavedSourceCode: state.sourceCode,
    })),
  markExportSaved: (lastExportPath) => set({ lastExportPath }),
  setSourceFilePath: (sourceFilePath) => set({ sourceFilePath, currentFilePath: sourceFilePath }),
  setCurrentFilePath: (currentFilePath) => set({ currentFilePath, sourceFilePath: currentFilePath }),
  setDiagramTypeOverride: (override) => 
    set((state) => ({ 
      diagramType: { ...state.diagramType, override } 
    })),
  setDetectedType: (detected, subtype, confidence) =>
    set((state) => ({
      diagramType: { ...state.diagramType, detected, subtype, confidence }
    })),
  setParseResult: (parseResult) => set({ parseResult }),
  setParseError: (parseError) => set({ parseError }),
  setIsConverting: (isConverting) => set({ isConverting }),
  setPreviewViewport: (previewViewport) =>
    set((state) => ({
      previewViewport: { ...state.previewViewport, ...previewViewport },
    })),
  setPreviewViewportSize: (viewportWidth, viewportHeight) =>
    set((state) => ({
      previewViewport: setPreviewViewportSize(state.previewViewport, viewportWidth, viewportHeight),
    })),
  setPreviewContentSize: (contentWidth, contentHeight) =>
    set((state) => ({
      previewViewport: setPreviewContentSize(state.previewViewport, contentWidth, contentHeight),
    })),
  panPreviewBy: (deltaX, deltaY) =>
    set((state) => ({
      previewViewport: panPreviewViewportBy(state.previewViewport, deltaX, deltaY),
    })),
  zoomPreviewAtPoint: (nextZoom, anchorX, anchorY) =>
    set((state) => ({
      previewViewport: zoomPreviewViewportAtPoint(state.previewViewport, nextZoom, anchorX, anchorY),
    })),
  fitPreview: (padding) =>
    set((state) => ({
      previewViewport: fitPreviewViewport(state.previewViewport, padding),
    })),
  resetPreview: () =>
    set((state) => ({
      previewViewport: resetPreviewViewport(state.previewViewport),
    })),
  resetPreviewState: () => set({ previewViewport: DEFAULT_PREVIEW_VIEWPORT }),
}));
