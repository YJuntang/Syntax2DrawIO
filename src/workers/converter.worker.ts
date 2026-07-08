import { WorkerMessage } from './types';
import { convertMermaidToDrawio } from '../core/mermaid/converter';
import { analyzeDrawioExport } from '../core/drawio/analysis';
import { convertPlantUMLToDrawio } from '../core/plantuml/converter';
import { normalizeDrawioId } from '../core/drawio/builder';

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;

  try {
    if (message.type === 'convert-mermaid') {
      const { requestId, ast, positions, edges, code, svg, classExportMode } = message;
      const renderResult = { svg, nodes: positions, edges };
      const rawResult = convertMermaidToDrawio(ast, renderResult, code, { classExportMode });
      const result = analyzeDrawioExport({
        drawioXml: rawResult.drawioXml,
        drawioMode: rawResult.drawioMode,
        svg,
        unsupportedFeatures: ast.unsupportedFeatures,
        supportAnalysis: rawResult.supportAnalysis,
        diagnostics: ast.diagnostics,
        coverage: ast.coverage,
        expectedContent: {
          vertexIds: [
            ...ast.nodes.map((node) => node.id),
            ...(ast.subgraphs || []).map((subgraph) => subgraph.id),
          ].map(normalizeDrawioId),
          edgeIds: ast.edges.map((edge, index) => normalizeDrawioId(edge.id || `edge-${index}`)),
        },
      });
      
      self.postMessage({
        type: 'result',
        requestId,
        drawioXml: result.drawioXml,
        drawioMode: result.drawioMode,
        editabilityLabel: result.editabilityLabel,
        exportDiagnostics: result.exportDiagnostics,
        unsupportedFeatures: result.unsupportedFeatures,
        supportAnalysis: result.supportAnalysis,
        diagnostics: ast.diagnostics || [],
        coverage: ast.coverage,
      } as WorkerMessage);
    } else if (message.type === 'convert-plantuml') {
      const { requestId, ast, svg, positions, edges } = message;
      const rawResult = convertPlantUMLToDrawio(
        ast,
        svg,
        positions.map((position) => ({
          id: position.id,
          label: position.label,
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height,
        })),
        edges
      );
      const result = analyzeDrawioExport({
        drawioXml: rawResult.drawioXml,
        drawioMode: rawResult.drawioMode,
        svg,
        unsupportedFeatures: ast.unsupportedFeatures,
        supportAnalysis: rawResult.supportAnalysis,
        diagnostics: ast.diagnostics,
        coverage: ast.coverage,
        expectedContent: {
          vertexIds: ast.nodes.map((node) => normalizeDrawioId(node.id)),
          edgeIds: ast.edges.map((edge, index) => normalizeDrawioId(edge.id || `edge-${index}`)),
        },
      });
      
      self.postMessage({
        type: 'result',
        requestId,
        drawioXml: result.drawioXml,
        drawioMode: result.drawioMode,
        editabilityLabel: result.editabilityLabel,
        exportDiagnostics: result.exportDiagnostics,
        unsupportedFeatures: result.unsupportedFeatures,
        supportAnalysis: result.supportAnalysis,
        diagnostics: ast.diagnostics || [],
        coverage: ast.coverage,
      } as WorkerMessage);
      return;
    }
  } catch (error: any) {
    const requestId = 'requestId' in message ? message.requestId : -1;
    self.postMessage({ 
      type: 'error', 
      requestId,
      error: { 
        message: error.message || 'Unknown conversion error',
      } 
    } as WorkerMessage);
  }
};
