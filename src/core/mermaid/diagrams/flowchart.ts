import { DrawioXmlBuilder } from '../../drawio/builder';
import { findRenderedNode, getEdgeWaypoints, normalizeRenderResult } from '../../drawio/layout';
import { DEFAULT_EDGE_STYLE } from '../../drawio/styles';
import { getDrawioNodeStyle, getMermaidEdgeStyle, getMermaidNodeStyle } from '../../drawio/shapeRegistry';
import { ParsedMermaid } from '../parser';
import { RenderResult } from '../renderer';

export function convertFlowchart(ast: ParsedMermaid, renderResult: RenderResult): string {
  const builder = new DrawioXmlBuilder();
  const normalizedRenderResult = normalizeRenderResult(renderResult);
  
  const clusterNodes = normalizedRenderResult.nodes.filter((node) => node.shape === 'cluster');

  (ast.subgraphs || []).forEach((subgraph) => {
    const svgCluster = clusterNodes.find((node) => node.label === subgraph.label || node.id.includes(subgraph.id));
    const x = svgCluster?.x ?? 0;
    const y = svgCluster?.y ?? 0;
    const w = svgCluster?.width ?? 320;
    const h = svgCluster?.height ?? 220;
    builder.addContainer(
      subgraph.id,
      subgraph.label,
      x,
      y,
      w,
      h,
      getDrawioNodeStyle('flow.subgraph')
    );
  });

  ast.nodes.forEach(node => {
    // Fallback position if not found in SVG
    let x = 0, y = 0, w = 120, h = 60;
    let label = node.label;
    let shape = node.type || 'rect';
    
    const svgNode = findRenderedNode(normalizedRenderResult.nodes, node.id, node.label);
    if (svgNode) {
      x = svgNode.x;
      y = svgNode.y;
      w = svgNode.width;
      h = svgNode.height;
      if (svgNode.label) label = svgNode.label;
      if (svgNode.shape && (!node.type || node.type === 'rect')) shape = svgNode.shape;
    }

    const style = applyMermaidStyleOverrides(getMermaidNodeStyle(shape), node.styleOverrides);
    if (node.parentId) {
      const parentId = node.parentId;
      const parentCluster = (ast.subgraphs || []).find((subgraph) => subgraph.id === parentId);
      const svgCluster = clusterNodes.find((cluster) => {
        if (cluster.label === parentCluster?.label) {
          return true;
        }
        return cluster.id.includes(parentId);
      });

      if (svgCluster) {
        builder.addChildVertex(node.id, label, parentId, w, h, style, {
          x: Math.max(16, x - svgCluster.x),
          y: Math.max(32, y - svgCluster.y),
        });
        return;
      }
    }

    builder.addVertex(node.id, label, x, y, w, h, style);
  });

  // Add all edges
  ast.edges.forEach((edge, index) => {
    const edgeId = `edge-${index}`;
    const edgeStyle = getMermaidEdgeStyle(edge.type);
    const style = applyMermaidStyleOverrides(`${DEFAULT_EDGE_STYLE}${edgeStyle}`, edge.styleOverrides);
    
    builder.addEdge(edgeId, edge.source, edge.target, edge.label || '', style, getEdgeWaypoints(normalizedRenderResult.edges, index));
  });

  return builder.toXml();
}

function applyMermaidStyleOverrides(baseStyle: string, overrides?: Record<string, string>) {
  if (!overrides) {
    return baseStyle;
  }

  const drawioStyle: Record<string, string> = {};
  Object.entries(overrides).forEach(([rawKey, rawValue]) => {
    const key = rawKey.trim().toLowerCase();
    const value = normalizeStyleValue(rawValue);
    if (!value) {
      return;
    }

    if (key === 'fill' || key === 'background' || key === 'background-color') {
      drawioStyle.fillColor = value;
      return;
    }

    if (key === 'stroke' || key === 'border-color') {
      drawioStyle.strokeColor = value;
      return;
    }

    if (key === 'color' || key === 'text-color') {
      drawioStyle.fontColor = value;
      return;
    }

    if (key === 'stroke-width' || key === 'border-width') {
      drawioStyle.strokeWidth = value.replace(/px$/i, '');
      return;
    }

    if (key === 'font-size') {
      drawioStyle.fontSize = value.replace(/px$/i, '');
      return;
    }

    if (key === 'font-weight' && value.toLowerCase() === 'bold') {
      drawioStyle.fontStyle = '1';
      return;
    }

    if (key === 'stroke-dasharray' || key === 'stroke-dash') {
      drawioStyle.dashed = '1';
    }
  });

  const styleEntries = Object.entries(drawioStyle).map(([key, value]) => `${key}=${value};`);
  return `${baseStyle}${baseStyle.endsWith(';') ? '' : ';'}${styleEntries.join('')}`;
}

function normalizeStyleValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}
