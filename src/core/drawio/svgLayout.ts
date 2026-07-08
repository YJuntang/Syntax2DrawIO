import { dedupePoints, simplifyRenderedWaypoints } from './edgeWaypoints';

export interface ExtractedSvgLayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedSvgLayoutEdge {
  id?: string;
  sourcePoint?: { x: number; y: number };
  targetPoint?: { x: number; y: number };
  waypoints: Array<{ x: number; y: number }>;
  label?: string;
  labelPosition?: { x: number; y: number };
}

export function extractSvgLayout(svg: string, selectors: string[] = ['g']) {
  if (!svg.trim() || typeof document === 'undefined') {
    return [] as ExtractedSvgLayoutNode[];
  }

  const container = document.createElement('div');
  container.style.visibility = 'hidden';
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.innerHTML = svg;
  document.body.appendChild(container);

  try {
    const svgRoot = container.querySelector('svg');
    if (!svgRoot) {
      return [];
    }

    const nodes: ExtractedSvgLayoutNode[] = [];
    svgRoot.querySelectorAll(selectors.join(', ')).forEach((element, index) => {
      const hasShape = element.querySelector('rect, polygon, ellipse, circle, path');
      const textNodes = Array.from(element.querySelectorAll('text'));
      const label = textNodes.map((node) => node.textContent?.trim() || '').filter(Boolean).join(' ').trim();
      if (!hasShape || !label) {
        return;
      }

      const bbox = getElementBounds(element);
      if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
        return;
      }

      nodes.push({
        id: getPlantUmlElementId(element) || element.id || `svg-node-${index}`,
        label,
        x: bbox.x + getTranslate(element).x,
        y: bbox.y + getTranslate(element).y,
        width: bbox.width,
        height: bbox.height,
      });
    });

    return nodes;
  } finally {
    document.body.removeChild(container);
  }
}

function getElementBounds(element: Element) {
  try {
    const bbox = (element as SVGGraphicsElement).getBBox?.();
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      return bbox;
    }
  } catch {
    // Fall through to attribute-based bounds for PlantUML SVG groups.
  }

  const boxes = Array.from(element.querySelectorAll('rect, ellipse, circle, path'))
    .map(getShapeBounds)
    .filter((value): value is { x: number; y: number; width: number; height: number } => Boolean(value));
  if (boxes.length === 0) {
    return null;
  }

  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getShapeBounds(shape: Element) {
  const tagName = shape.tagName.toLowerCase();
  if (tagName === 'rect') {
    const x = Number(shape.getAttribute('x'));
    const y = Number(shape.getAttribute('y'));
    const width = Number(shape.getAttribute('width'));
    const height = Number(shape.getAttribute('height'));
    return [x, y, width, height].every(Number.isFinite) ? { x, y, width, height } : null;
  }
  if (tagName === 'ellipse') {
    const cx = Number(shape.getAttribute('cx'));
    const cy = Number(shape.getAttribute('cy'));
    const rx = Number(shape.getAttribute('rx'));
    const ry = Number(shape.getAttribute('ry'));
    return [cx, cy, rx, ry].every(Number.isFinite)
      ? { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
      : null;
  }
  if (tagName === 'circle') {
    const cx = Number(shape.getAttribute('cx'));
    const cy = Number(shape.getAttribute('cy'));
    const r = Number(shape.getAttribute('r'));
    return [cx, cy, r].every(Number.isFinite)
      ? { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }
      : null;
  }

  const points = parsePathPointsIncludingEnds(shape.getAttribute('d') || '');
  if (points.length === 0) {
    return null;
  }
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function extractSvgEdges(svg: string, selectors: string[] = ['g[id^="link_"]']) {
  if (!svg.trim() || typeof document === 'undefined') {
    return [] as ExtractedSvgLayoutEdge[];
  }

  const container = document.createElement('div');
  container.style.visibility = 'hidden';
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.innerHTML = svg;
  document.body.appendChild(container);

  try {
    const edges: ExtractedSvgLayoutEdge[] = [];
    container.querySelectorAll(selectors.join(', ')).forEach((element, index) => {
      const path = element.querySelector('path');
      if (!path) {
        return;
      }
      const translate = addPoints(getTranslate(element), getTranslate(path));
      const waypoints = extractPathWaypoints(path as SVGPathElement);
      const endpoints = extractPathEndpoints(path as SVGPathElement);
      if (waypoints.length === 0 && !endpoints) {
        return;
      }
      const labels = extractEdgeLabels(element);
      const sourcePoint = endpoints ? addPoints(endpoints.sourcePoint, translate) : undefined;
      const targetPoint = endpoints ? addPoints(endpoints.targetPoint, translate) : undefined;
      edges.push({
        id: path.getAttribute('id') || element.id || `svg-edge-${index}`,
        sourcePoint,
        targetPoint,
        waypoints: simplifyRenderedWaypoints(
          waypoints.map((point) => addPoints(point, translate)),
          sourcePoint,
          targetPoint
        ),
        label: labels.map((label) => label.text).join('\n') || undefined,
        labelPosition: labels[0] ? { x: labels[0].x, y: labels[0].y } : undefined,
      });
    });
    return edges;
  } finally {
    document.body.removeChild(container);
  }
}

function addPoints(left: { x: number; y: number }, right: { x: number; y: number }) {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
  };
}

function extractEdgeLabels(element: Element) {
  return Array.from(element.querySelectorAll('text'))
    .map((text) => {
      const value = text.textContent?.trim();
      if (!value) {
        return null;
      }
      const ownTranslate = getTranslate(text);
      const groupTranslate = getTranslate(element);
      const rawPoint = getSvgTextPoint(text);
      const x = rawPoint.x + ownTranslate.x + groupTranslate.x;
      const y = rawPoint.y + ownTranslate.y + groupTranslate.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return { text: value, x, y };
    })
    .filter((value): value is { text: string; x: number; y: number } => Boolean(value));
}

function getSvgTextPoint(text: Element) {
  const x = text.hasAttribute('x') ? Number(text.getAttribute('x')) : Number.NaN;
  const y = text.hasAttribute('y') ? Number(text.getAttribute('y')) : Number.NaN;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { x, y };
  }

  const tspan = text.querySelector('tspan[x], tspan[y]');
  const tspanX = tspan?.hasAttribute('x') ? Number(tspan.getAttribute('x')) : Number.NaN;
  const tspanY = tspan?.hasAttribute('y') ? Number(tspan.getAttribute('y')) : Number.NaN;
  if (Number.isFinite(tspanX) && Number.isFinite(tspanY)) {
    return { x: tspanX, y: tspanY };
  }

  const bounds = getElementBounds(text);
  if (bounds) {
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  return { x: Number.NaN, y: Number.NaN };
}

function getPlantUmlElementId(element: Element) {
  const qualifiedName = element.getAttribute('data-qualified-name');
  if (!qualifiedName) {
    return null;
  }

  return qualifiedName.split('.').filter(Boolean).pop() || qualifiedName;
}

function getTranslate(element: Element) {
  const transform = element.getAttribute('transform') || '';
  const match = transform.match(/translate\(([-\d.]+)(?:[,\s]+([-\d.]+))?\)/);
  if (!match) {
    return { x: 0, y: 0 };
  }

  return {
    x: Number(match[1]) || 0,
    y: Number(match[2]) || 0,
  };
}

function extractPathWaypoints(path: SVGPathElement) {
  try {
    const totalLength = path.getTotalLength();
    if (!Number.isFinite(totalLength) || totalLength <= 0) {
      return parsePathPoints(path.getAttribute('d') || '');
    }

    const sampleCount = 7;
    const points: Array<{ x: number; y: number }> = [];
    for (let index = 1; index < sampleCount - 1; index += 1) {
      const point = path.getPointAtLength((totalLength * index) / (sampleCount - 1));
      points.push({ x: point.x, y: point.y });
    }
    return dedupePoints(points);
  } catch {
    return parsePathPoints(path.getAttribute('d') || '');
  }
}

function extractPathEndpoints(path: SVGPathElement) {
  try {
    const totalLength = path.getTotalLength();
    if (Number.isFinite(totalLength) && totalLength > 0) {
      const sourcePoint = path.getPointAtLength(0);
      const targetPoint = path.getPointAtLength(totalLength);
      return {
        sourcePoint: { x: sourcePoint.x, y: sourcePoint.y },
        targetPoint: { x: targetPoint.x, y: targetPoint.y },
      };
    }
  } catch {
    // Fall through to path-data parsing in test/jsdom environments.
  }

  const points = parsePathPointsIncludingEnds(path.getAttribute('d') || '');
  if (points.length < 2) {
    return null;
  }
  return {
    sourcePoint: points[0],
    targetPoint: points[points.length - 1],
  };
}

function parsePathPoints(pathData: string) {
  const points = parsePathPointsIncludingEnds(pathData);
  return points.length > 2 ? dedupePoints(points.slice(1, -1)) : [];
}

function parsePathPointsIncludingEnds(pathData: string) {
  const points: Array<{ x: number; y: number }> = [];
  const values = Array.from(pathData.matchAll(/-?\d+(?:\.\d+)?/g)).map((match) => Number(match[0]));

  for (let index = 0; index + 1 < values.length; index += 2) {
    const point = {
      x: values[index],
      y: values[index + 1],
    };
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      points.push(point);
    }
  }

  return dedupePoints(points);
}
