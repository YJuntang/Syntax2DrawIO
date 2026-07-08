import { DrawioXmlBuilder } from '../../drawio/builder';
import { findRenderedNode, getEdgeWaypoints, normalizeRenderResult } from '../../drawio/layout';
import { getDrawioNodeStyle } from '../../drawio/shapeRegistry';
import { ParsedMermaid } from '../parser';
import { RenderResult } from '../renderer';

export function convertErDiagram(ast: ParsedMermaid, renderResult: RenderResult): string {
  const normalized = normalizeRenderResult(renderResult);
  const builder = new DrawioXmlBuilder();
  const layouts = new Map<string, { x: number; y: number; width: number; height: number }>();

  ast.nodes.forEach((node, index) => {
    const rendered = findRenderedNode(normalized.nodes, node.id, node.label);
    const attributes = (node.attributes || []).filter(Boolean);
    const width = Math.max(180, rendered?.width ?? estimateEntityWidth(node.label, attributes));
    const headerHeight = 30;
    const rowHeight = 24;
    const estimatedHeight = headerHeight + Math.max(1, attributes.length) * rowHeight;
    const height = Math.max(estimatedHeight, rendered?.height || 0);
    const x = rendered?.x ?? 60 + (index % 3) * 280;
    const y = rendered?.y ?? 60 + Math.floor(index / 3) * 190;
    layouts.set(node.id, { x, y, width, height });

    builder.addContainer(
      node.id,
      node.label,
      x,
      y,
      width,
      height,
      getDrawioNodeStyle('er.entity')
    );

    const rows = attributes.length > 0 ? attributes : [''];
    rows.forEach((attribute, rowIndex) => {
      builder.addChildVertex(
        `${node.id}-attribute-${rowIndex}`,
        formatAttribute(attribute),
        node.id,
        width,
        rowHeight,
        getDrawioNodeStyle('er.attribute'),
        { x: 0, y: headerHeight + rowIndex * rowHeight, connectable: false }
      );
    });
  });

  ast.edges.forEach((edge, index) => {
    const source = layouts.get(edge.source);
    const target = layouts.get(edge.target);
    const horizontal = source && target
      ? Math.abs((source.x + source.width / 2) - (target.x + target.width / 2))
        >= Math.abs((source.y + source.height / 2) - (target.y + target.height / 2))
      : true;
    builder.addEdge(
      edge.id,
      edge.source,
      edge.target,
      edge.label || '',
      `${buildErEdgeStyle(edge.sourceCardinality, edge.targetCardinality)}edgeStyle=orthogonalEdgeStyle;orthogonalLoop=1;jettySize=auto;${horizontal ? 'exitX=1;entryX=0;' : 'exitY=1;entryY=0;'}`,
      getEdgeWaypoints(normalized.edges, index)
    );
  });

  return builder.toXml();
}

function estimateEntityWidth(label: string, attributes: string[]) {
  const longest = Math.max(label.length, ...attributes.map((attribute) => attribute.length), 12);
  return Math.min(300, Math.max(180, longest * 7 + 30));
}

function formatAttribute(attribute: string) {
  const parts = attribute.trim().split(/\s+/);
  if (parts.length < 2) {
    return attribute;
  }
  const [type, name, ...constraints] = parts;
  return `${type}   ${name}${constraints.length ? `   ${constraints.join(' ')}` : ''}`;
}

function buildErEdgeStyle(sourceCardinality?: string, targetCardinality?: string) {
  return `${toErArrow('start', sourceCardinality)}${toErArrow('end', targetCardinality)}html=1;rounded=0;`;
}

function toErArrow(position: 'start' | 'end', cardinality?: string) {
  const prefix = position === 'start' ? 'startArrow' : 'endArrow';
  if (!cardinality) {
    return `${prefix}=none;`;
  }

  const normalizedCardinality = normalizeErCardinality(cardinality);
  if (normalizedCardinality === 'zeroOrMore') {
    return `${prefix}=ERzeroToMany;`;
  }
  if (normalizedCardinality === 'oneOrMore') {
    return `${prefix}=ERoneToMany;`;
  }
  if (normalizedCardinality === 'zeroOrOne') {
    return `${prefix}=ERzeroToOne;`;
  }
  if (normalizedCardinality === 'one') {
    return `${prefix}=ERmandOne;`;
  }

  return `${prefix}=none;`;
}

function normalizeErCardinality(cardinality: string) {
  const hasZero = cardinality.includes('o');
  const hasOne = cardinality.includes('|');
  const hasMany = cardinality.includes('{') || cardinality.includes('}');

  if (hasZero && hasMany) {
    return 'zeroOrMore';
  }

  if (hasOne && hasMany) {
    return 'oneOrMore';
  }

  if (hasZero && hasOne) {
    return 'zeroOrOne';
  }

  if (hasOne) {
    return 'one';
  }

  return 'none';
}
