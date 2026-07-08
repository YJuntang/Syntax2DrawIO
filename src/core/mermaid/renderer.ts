import mermaid from 'mermaid';
import { dedupePoints, simplifyRenderedWaypoints } from '../drawio/edgeWaypoints';
import { sanitizeSvg } from '../sanitizer';

// Initial initialization
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'default',
});

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  shape: string;
}

export interface EdgePosition {
  id: string;
  sourceId: string;
  targetId: string;
  waypoints: { x: number; y: number }[];
  label: string;
  labelPosition?: { x: number; y: number };
}

export interface RenderResult {
  svg: string;
  nodes: NodePosition[];
  edges: EdgePosition[];
}

export async function renderMermaidSvg(code: string, theme: 'dark' | 'light' = 'dark'): Promise<RenderResult> {
  const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

  // Re-initialize with current theme before rendering
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: theme === 'dark' ? 'dark' : 'default',
  });

  // 1. Render to SVG string
  const { svg } = await mermaid.render(id, code);

  // 2. Sanitize the SVG
  const safeSvg = sanitizeSvg(svg);

  // 3. Extract positions by creating a hidden DOM element
  // We must append it to the document body but visually hide it
  // because getBBox() requires the element to be in the DOM and not display:none
  const container = document.createElement('div');
  container.style.visibility = 'hidden';
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.innerHTML = safeSvg;
  document.body.appendChild(container);

  const nodes: NodePosition[] = [];
  const edges: EdgePosition[] = [];

  try {
    const svgEl = container.querySelector('svg');
    if (svgEl) {
        // Extract nodes for multiple diagram types
        // Flowchart: .node, .cluster
        // Sequence: .actor, .note, .activation0
        // Class: .classGroup
        // ER: .entityBox
        const selectors = [
          '.node', '.cluster', '.actor', '.note', 
          '.classGroup', '.entityBox'
        ].join(', ');
        
        const nodeEls = svgEl.querySelectorAll(selectors);
        nodeEls.forEach((node) => {
          try {
            const bbox = (node as any).getBBox();
            const transform = node.getAttribute('transform');
            
            let x = bbox.x;
            let y = bbox.y;
            if (transform) {
              const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
              if (match) {
                x = parseFloat(match[1]) + bbox.x;
                y = parseFloat(match[2]) + bbox.y;
              }
            }
            
            // Find label
            const labelEl = node.querySelector('.label') || node.querySelector('text');
            const label = labelEl ? labelEl.textContent?.trim() || '' : '';
            
            const shape = inferRenderedNodeShape(node);
            
            // Use ID or generate one if missing
            const id = node.id || `node-${Math.random().toString(36).substr(2, 9)}`;

            nodes.push({
              id,
              x,
              y,
              width: bbox.width,
              height: bbox.height,
              label,
              shape
            });
          } catch (e) {
            // Ignore nodes that fail getBBox
          }
        });
      
      // Extract edges
      const edgeEls = svgEl.querySelectorAll([
        '.edgePaths path',
        'path.messageLine0',
        'path.messageLine1',
        'line.messageLine0',
        'line.messageLine1',
        'path.relation',
        'path.transition',
      ].join(', '));
      const edgeLabelEls = svgEl.querySelectorAll('.edgeLabels .edgeLabel, .edgeLabel');
      edgeEls.forEach((path, i) => {
        const labelEl = edgeLabelEls[i] as SVGGraphicsElement | undefined;
        let labelPosition: { x: number; y: number } | undefined;

        if (labelEl) {
          try {
            const bbox = labelEl.getBBox();
            labelPosition = {
              x: bbox.x + (bbox.width / 2),
              y: bbox.y + (bbox.height / 2),
            };
          } catch (e) {
            // Ignore labels that fail getBBox.
          }
        }

        edges.push({
          id: `edge-${i}`,
          sourceId: '', // We need AST for robust source/target mapping
          targetId: '',
          waypoints: extractEdgeWaypoints(path),
          label: labelEl?.textContent?.trim() || '',
          labelPosition,
        });
      });
    }
  } finally {
    container.remove();
    document.querySelectorAll(`body > div[id^="d${id}"]`).forEach((element) => element.remove());
  }

  return {
    svg: safeSvg,
    nodes,
    edges,
  };
}

export function inferRenderedNodeShape(node: Element): string {
  const classTokens = getClassTokens(node);
  const hasClassToken = (...tokens: string[]) =>
    tokens.some((token) => classTokens.some((classToken) => classToken.includes(token)));

  if (node.classList.contains('actor')) return 'actor';
  if (node.classList.contains('note')) return 'note';
  if (node.classList.contains('classGroup')) return 'class';
  if (node.classList.contains('entityBox')) return 'entity';
  if (node.classList.contains('task')) return 'rect';
  if (node.classList.contains('cluster')) return 'cluster';

  if (hasClassToken('doublecircle', 'double-circle')) return 'double_circle';
  if (hasClassToken('cylinder', 'database')) return 'cylinder';
  if (hasClassToken('subroutine', 'process')) return 'subroutine';
  if (hasClassToken('hexagon')) return 'hexagon';
  if (hasClassToken('trapezoid')) return hasClassToken('alt') ? 'trapezoid_alt' : 'trapezoid';
  if (hasClassToken('parallelogram', 'lean-right')) return 'parallelogram';
  if (hasClassToken('lean-left')) return 'parallelogram_alt';
  if (hasClassToken('document', 'docs')) return hasClassToken('documents', 'docs') ? 'documents' : 'doc';
  if (hasClassToken('diamond', 'rhombus', 'decision')) return 'diamond';
  if (hasClassToken('stadium')) return 'stadium';

  const polygon = node.querySelector('polygon');
  if (polygon) {
    return inferPolygonShape(polygon);
  }

  const circle = node.querySelector('circle, ellipse');
  if (circle) return 'circle';

  const rect = node.querySelector('rect');
  if (rect) {
    const rx = rect.getAttribute('rx') || rect.getAttribute('ry');
    return rx && parseFloat(rx) > 0 ? 'rounded_rect' : 'rect';
  }

  const path = node.querySelector('path');
  if (path && hasClassToken('basic')) {
    return 'rect';
  }

  return 'default';
}

function getClassTokens(node: Element): string[] {
  const tokens = new Set<string>();
  [node, ...Array.from(node.querySelectorAll('[class]'))].forEach((element) => {
    element.classList.forEach((className) => tokens.add(className.toLowerCase()));
  });
  return Array.from(tokens);
}

function inferPolygonShape(polygon: Element): string {
  const points = parsePolygonPoints(polygon.getAttribute('points') || '');
  if (points.length >= 6) {
    return 'hexagon';
  }

  if (points.length === 4) {
    const uniqueX = uniqueRounded(points.map((point) => point.x));
    const uniqueY = uniqueRounded(points.map((point) => point.y));
    if (uniqueX.length <= 3 && uniqueY.length <= 3) {
      return 'diamond';
    }
    return 'parallelogram';
  }

  return 'rect';
}

function parsePolygonPoints(points: string) {
  const values = (points.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
  const parsed: Array<{ x: number; y: number }> = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    const point = { x: values[index], y: values[index + 1] };
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      parsed.push(point);
    }
  }
  return parsed;
}

function uniqueRounded(values: number[]) {
  return Array.from(new Set(values.map((value) => Math.round(value))));
}

function extractPathWaypoints(path: SVGPathElement): { x: number; y: number }[] {
  try {
    const totalLength = path.getTotalLength();
    if (!Number.isFinite(totalLength) || totalLength <= 0) {
      return parsePathPoints(path.getAttribute('d') || '');
    }

    const sampleCount = 5;
    const points: { x: number; y: number }[] = [];
    for (let i = 1; i < sampleCount - 1; i++) {
      const point = path.getPointAtLength((totalLength * i) / (sampleCount - 1));
      points.push({ x: point.x, y: point.y });
    }
    const sourcePoint = path.getPointAtLength(0);
    const targetPoint = path.getPointAtLength(totalLength);
    return simplifyRenderedWaypoints(
      points,
      { x: sourcePoint.x, y: sourcePoint.y },
      { x: targetPoint.x, y: targetPoint.y }
    );
  } catch (e) {
    const points = parsePathPointsIncludingEnds(path.getAttribute('d') || '');
    return points.length > 2
      ? simplifyRenderedWaypoints(points.slice(1, -1), points[0], points[points.length - 1])
      : [];
  }
}

function extractEdgeWaypoints(edge: Element): { x: number; y: number }[] {
  if ((typeof SVGLineElement !== 'undefined' && edge instanceof SVGLineElement) || edge.tagName.toLowerCase() === 'line') {
    const x1 = Number(edge.getAttribute('x1'));
    const y1 = Number(edge.getAttribute('y1'));
    const x2 = Number(edge.getAttribute('x2'));
    const y2 = Number(edge.getAttribute('y2'));
    if ([x1, y1, x2, y2].every(Number.isFinite)) {
      return [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ];
    }
  }

  return extractPathWaypoints(edge as SVGPathElement);
}

function parsePathPoints(pathData: string): { x: number; y: number }[] {
  const points = parsePathPointsIncludingEnds(pathData);
  return points.length > 2 ? simplifyRenderedWaypoints(points.slice(1, -1), points[0], points[points.length - 1]) : [];
}

function parsePathPointsIncludingEnds(pathData: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const values = Array.from(pathData.matchAll(/-?\d+(?:\.\d+)?/g)).map((match) => Number(match[0]));

  for (let index = 0; index + 1 < values.length; index += 2) {
    const point = { x: values[index], y: values[index + 1] };
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      points.push(point);
    }
  }

  return dedupePoints(points);
}
