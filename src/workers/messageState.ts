import { ParseResult } from '../store/editorStore';
import { WorkerErrorMessage, WorkerResultMessage } from './types';

export function applyWorkerResult(
  previous: ParseResult | null,
  message: WorkerResultMessage,
  activeRequestId: number
): ParseResult | null {
  if (message.requestId !== activeRequestId) {
    return null;
  }

  return {
    svg: message.svg || previous?.svg || '',
    drawioXml: message.drawioXml,
    drawioMode: message.drawioMode,
    editabilityLabel: message.editabilityLabel,
    exportDiagnostics: message.exportDiagnostics,
    unsupportedFeatures: message.unsupportedFeatures,
    supportAnalysis: message.supportAnalysis,
    xmlStatus: 'ready',
    diagnostics: message.diagnostics || previous?.diagnostics || [],
    coverage: message.coverage || previous?.coverage,
    isStale: false,
  };
}

export function applyWorkerError(
  previous: ParseResult | null,
  message: WorkerErrorMessage,
  activeRequestId: number
): ParseResult | null {
  if (message.requestId !== activeRequestId || !previous) {
    return null;
  }

  return {
    ...previous,
    drawioXml: '',
    editabilityLabel: previous.editabilityLabel,
    exportDiagnostics: previous.exportDiagnostics,
    unsupportedFeatures: previous.unsupportedFeatures,
    supportAnalysis: previous.supportAnalysis,
    xmlStatus: 'error',
  };
}
