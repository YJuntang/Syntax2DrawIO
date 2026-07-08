import type { DrawioSupportAnalysis } from './support';

export type DrawioMode = 'native-full' | 'native-hybrid' | 'visual-full' | 'fallback-url';

export type DrawioEditabilityLabel = 'Editable' | 'Editable with visual fallbacks' | 'Visual only';

export interface DrawioExportMetadata {
  editabilityLabel: DrawioEditabilityLabel;
  exportDiagnostics: string[];
  unsupportedFeatures: string[];
  supportAnalysis: DrawioSupportAnalysis;
}

export interface DrawioConversionResult {
  drawioXml: string;
  drawioMode: DrawioMode;
  editabilityLabel?: DrawioEditabilityLabel;
  exportDiagnostics?: string[];
  unsupportedFeatures?: string[];
  supportAnalysis?: DrawioSupportAnalysis;
}

export function isEditableDrawioMode(mode: DrawioMode): boolean {
  return mode === 'native-full' || mode === 'native-hybrid';
}

export function getDrawioExportLabel(mode: DrawioMode): string {
  if (mode === 'native-full') {
    return '.drawio (Editable)';
  }

  if (mode === 'native-hybrid') {
    return '.drawio (Hybrid)';
  }

  return '.drawio (Visual)';
}
