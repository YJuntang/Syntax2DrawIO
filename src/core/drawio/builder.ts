import { DRAWIO_XML_PREFIX, DRAWIO_XML_SUFFIX, escapeXml } from './constants';

export interface Point {
  x: number;
  y: number;
}

export interface VertexOptions {
  isHtmlLabel?: boolean;
}

export interface ChildVertexOptions extends VertexOptions {
  relative?: boolean;
  x?: number;
  y?: number;
  connectable?: boolean;
  offset?: Point;
}

export class DrawioXmlBuilder {
  private cells: string[] = [];
  private idCounter = 2; // 0 and 1 are reserved for root
  private usedIds = new Set<string>(['0', '1']);
  private vertexIdMap = new Map<string, string>();

  constructor() {}

  public generateId(): string {
    return `cell-${this.idCounter++}`;
  }

  public addVertex(id: string, label: string, x: number, y: number, w: number, h: number, style: string, parent: string = '1', options: VertexOptions = {}): this {
    const safeId = this.registerVertexId(id);
    const escapedLabel = escapeXml(label);
    const normalizedStyle = options.isHtmlLabel && !style.includes('html=1') ? `${style}html=1;` : style;
    const safeParent = this.resolveVertexReference(parent);
    const cell = `        <mxCell id="${safeId}" value="${escapedLabel}" style="${escapeXml(normalizedStyle)}" vertex="1" parent="${safeParent}">
          <mxGeometry x="${normalizeGeometryValue(x)}" y="${normalizeGeometryValue(y)}" width="${normalizeGeometryValue(w, 10)}" height="${normalizeGeometryValue(h, 10)}" as="geometry"/>
        </mxCell>`;
    this.cells.push(cell);
    return this;
  }

  public addContainer(id: string, label: string, x: number, y: number, w: number, h: number, style: string, parent: string = '1', options: VertexOptions = {}): this {
    // Containers are just vertices with container=1 in style
    const containerStyle = style.includes('container=1') ? style : `${style}container=1;`;
    return this.addVertex(id, label, x, y, w, h, containerStyle, parent, options);
  }

  public addChildVertex(id: string, label: string, parent: string, w: number, h: number, style: string, options: ChildVertexOptions = {}): this {
    const safeId = this.registerVertexId(id);
    const escapedLabel = escapeXml(label);
    const normalizedStyle = options.isHtmlLabel && !style.includes('html=1') ? `${style}html=1;` : style;
    const relative = options.relative ? ' relative="1"' : '';
    const connectable = options.connectable === false ? ' connectable="0"' : '';
    const x = options.x !== undefined ? ` x="${normalizeGeometryValue(options.x)}"` : '';
    const y = options.y !== undefined ? ` y="${normalizeGeometryValue(options.y)}"` : '';
    const offset = options.offset
      ? `\n            <mxPoint x="${normalizeGeometryValue(options.offset.x)}" y="${normalizeGeometryValue(options.offset.y)}" as="offset"/>`
      : '';
    const cell = `        <mxCell id="${safeId}" value="${escapedLabel}" style="${escapeXml(normalizedStyle)}" vertex="1" parent="${this.resolveVertexReference(parent)}"${connectable}>
          <mxGeometry${relative}${x}${y} width="${normalizeGeometryValue(w, 10)}" height="${normalizeGeometryValue(h, 10)}" as="geometry">${offset}
          </mxGeometry>
        </mxCell>`;
    this.cells.push(cell);
    return this;
  }

  public addEdge(id: string, source: string, target: string, label: string = '', style: string, waypoints: Point[] = [], parent: string = '1'): this {
    const safeId = this.registerEdgeId(id);
    const escapedLabel = escapeXml(label);

    let waypointsXml = '';
    if (waypoints.length > 0) {
      const points = waypoints
        .map((p) => `            <mxPoint x="${normalizeGeometryValue(p.x)}" y="${normalizeGeometryValue(p.y)}"/>`)
        .join('\n');
      waypointsXml = `\n          <Array as="points">\n${points}\n          </Array>`;
    }

    const cell = `        <mxCell id="${safeId}" value="${escapedLabel}" style="${escapeXml(style)}" edge="1" parent="${this.resolveVertexReference(parent)}" source="${this.resolveVertexReference(source)}" target="${this.resolveVertexReference(target)}">
          <mxGeometry relative="1" as="geometry">
            <mxPoint as="sourcePoint"/>
            <mxPoint as="targetPoint"/>${waypointsXml}
          </mxGeometry>
        </mxCell>`;
    this.cells.push(cell);
    return this;
  }
  
  public toXml(): string {
    return DRAWIO_XML_PREFIX + '\n' + this.cells.join('\n') + '\n' + DRAWIO_XML_SUFFIX;
  }

  private registerVertexId(preferredId: string): string {
    const existing = this.vertexIdMap.get(preferredId);
    if (existing) {
      return existing;
    }

    const safe = this.allocateId(preferredId);
    this.vertexIdMap.set(preferredId, safe);
    return safe;
  }

  private registerEdgeId(preferredId: string): string {
    const safe = this.allocateId(preferredId);
    this.vertexIdMap.set(preferredId, safe);
    return safe;
  }

  private resolveVertexReference(reference: string): string {
    if (reference === '0' || reference === '1') {
      return reference;
    }

    return this.vertexIdMap.get(reference) || this.registerVertexId(reference);
  }

  private allocateId(preferredId: string): string {
    const normalized = normalizeDrawioId(preferredId) || this.generateId();
    let candidate = normalized;
    let suffix = 1;

    while (this.usedIds.has(candidate)) {
      candidate = `${normalized}-${suffix++}`;
    }

    this.usedIds.add(candidate);
    return candidate;
  }
}

export function normalizeDrawioId(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_.:~-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeGeometryValue(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  if (Math.abs(value) > 1_000_000) {
    return fallback;
  }

  return Number(value.toFixed(2));
}
