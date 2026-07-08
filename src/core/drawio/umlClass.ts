import { ASTEdge, ASTNode } from '../../types/ast';
import { DrawioXmlBuilder, Point } from './builder';
import { simplifyRenderedWaypoints } from './edgeWaypoints';
import { DEFAULT_EDGE_STYLE, UML_EDGE_STYLES } from './styles';
import { formatUmlAnnotation } from './umlLabels';
import { findRenderHintNode } from './renderHints';

const CLASS_MIN_WIDTH = 160;
const CLASS_HORIZONTAL_PADDING = 24;
const CLASS_ROW_HEIGHT = 26;
const CLASS_TITLE_MIN_HEIGHT = 26;
const CLASS_TITLE_LINE_HEIGHT = 18;
const CLASS_TITLE_VERTICAL_PADDING = 8;
const CLASS_DIVIDER_HEIGHT = 8;
const GRID_SIZE = 10;
const CLASS_GAP_X = 80;
const CLASS_GAP_Y = 100;
const COMPONENT_GAP_X = 140;
const COMPONENT_GAP_Y = 140;
const COMPONENT_WRAP_WIDTH = 1200;
const PARALLEL_EDGE_GAP = 30;
const SELF_EDGE_GAP = 60;

const UML_CLASS_STYLE = 'swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=%START_SIZE%;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0;whiteSpace=wrap;html=1;';
const UML_CLASS_MEMBER_ROW_STYLE = 'text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;whiteSpace=wrap;html=1;';
const UML_CLASS_DIVIDER_STYLE = 'line;strokeWidth=1;fillColor=none;align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;spacingRight=3;rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;';
const UML_DIRECT_EDGE_STYLE = 'edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;';
const UML_CURVED_EDGE_STYLE = 'edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;curved=1;';
const UML_EDGE_LABEL_TEXT_STYLE = 'text;html=1;strokeColor=none;fillColor=#ffffff;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=12;resizable=0;rotatable=0;connectable=0;';
const UML_TITLE_STYLE = 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=18;fontStyle=1;resizable=0;rotatable=0;connectable=0;';

export type UmlDirection = 'TB' | 'BT' | 'LR' | 'RL';
type Orientation = 'horizontal' | 'vertical';
type Side = 'left' | 'right' | 'top' | 'bottom';

type ClassSize = {
  width: number;
  height: number;
  titleHeight: number;
};

export type ClassLayout = ClassSize & {
  x: number;
  y: number;
  centerX: number;
  centerY: number;
};

type ComponentLayout = {
  width: number;
  height: number;
  nodes: Map<string, { x: number; y: number }>;
};

export type LayoutHintNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type LayoutHintEdge = {
  id?: string;
  label?: string;
  labelPosition?: Point;
  sourcePoint?: Point;
  targetPoint?: Point;
  waypoints: Point[];
};

type RenderHint = {
  x: number;
  y: number;
  order: number;
};

export type EdgeRoute = {
  style: string;
  waypoints: Point[];
  sourceSide: Side;
  targetSide: Side;
  labelPosition?: Point;
};

type CardinalityPlacement = {
  x: number;
  y: number;
  style: string;
  offset: Point;
};

const HIERARCHY_EDGE_TYPES = new Set(['generalization', 'realization']);

export function renderUmlClassDiagram(
  nodes: ASTNode[],
  edges: ASTEdge[],
  options: {
    direction?: UmlDirection;
    title?: string;
    renderNodes?: LayoutHintNode[];
    renderEdges?: LayoutHintEdge[];
  } = {}
) {
  const builder = new DrawioXmlBuilder();
  const direction: UmlDirection = options.direction || 'TB';
  const renderHints = buildRenderHints(nodes, options.renderNodes || [], direction);
  const sizeById = new Map(nodes.map((node) => [node.id, estimateClassSize(node)]));
  const faithfulLayout = calculateRenderFaithfulLayouts(nodes, sizeById, options.renderNodes || []);
  const layoutById = faithfulLayout?.layouts
    || calculateUmlLayouts(nodes, edges, sizeById, renderHints, direction);
  const edgeRoutes = calculateUmlEdgeRoutes(
    edges,
    layoutById,
    direction,
    faithfulLayout ? options.renderEdges : undefined,
    faithfulLayout?.offset,
    Boolean(faithfulLayout)
  );

  addUmlDiagramTitle(builder, options.title, layoutById);

  nodes.forEach((node) => {
    const layout = layoutById.get(node.id);
    if (!layout) {
      return;
    }

    builder.addVertex(
      node.id,
      formatClassTitle(node),
      layout.x,
      layout.y,
      layout.width,
      layout.height,
      buildClassStyle(node, layout.titleHeight),
      '1'
    );

    addClassRows(builder, node.id, layout.width, layout.titleHeight, node.attributes || [], node.methods || []);
  });

  addEdges(builder, edges, edgeRoutes);
  return builder.toXml();
}

export function calculateUmlLayouts(
  nodes: ASTNode[],
  edges: ASTEdge[],
  sizeById: Map<string, ClassSize>,
  renderHints: Map<string, RenderHint>,
  direction: UmlDirection
) {
  const declarationOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const components = getComponents(nodes, edges, declarationOrder);
  const layoutById = new Map<string, ClassLayout>();

  let currentX = 40;
  let currentY = 40;
  let shelfHeight = 0;

  components.forEach((component) => {
    const componentLayout = layoutComponent(component, edges, sizeById, renderHints, declarationOrder, direction);

    if (currentX > 40 && currentX + componentLayout.width > COMPONENT_WRAP_WIDTH) {
      currentX = 40;
      currentY += shelfHeight + COMPONENT_GAP_Y;
      shelfHeight = 0;
    }

    componentLayout.nodes.forEach((position, nodeId) => {
      const size = sizeById.get(nodeId);
      if (!size) {
        return;
      }

      const x = snap(currentX + position.x);
      const y = snap(currentY + position.y);
      layoutById.set(nodeId, {
        ...size,
        x,
        y,
        centerX: x + (size.width / 2),
        centerY: y + (size.height / 2),
      });
    });

    currentX += componentLayout.width + COMPONENT_GAP_X;
    shelfHeight = Math.max(shelfHeight, componentLayout.height);
  });

  return layoutById;
}

export function calculateUmlEdgeRoutes(
  edges: ASTEdge[],
  layoutById: Map<string, ClassLayout>,
  direction: UmlDirection,
  renderEdges: LayoutHintEdge[] = [],
  renderOffset: Point = { x: 0, y: 0 },
  preferGeometry = false
) {
  const routes = new Map<string, EdgeRoute>();
  const edgesByPair = new Map<string, ASTEdge[]>();

  edges.forEach((edge) => {
    const key = edge.source === edge.target
      ? `${edge.source}::${edge.target}`
      : [edge.source, edge.target].sort().join('::');
    edgesByPair.set(key, [...(edgesByPair.get(key) || []), edge]);
  });

  edgesByPair.forEach((edgeGroup) => {
    edgeGroup.forEach((edge, index) => {
      const sourceLayout = layoutById.get(edge.source);
      const targetLayout = layoutById.get(edge.target);
      if (!sourceLayout || !targetLayout) {
        return;
      }

      const offset = (index - ((edgeGroup.length - 1) / 2)) * PARALLEL_EDGE_GAP;
      const route = buildEdgeRoute(edge, sourceLayout, targetLayout, direction, offset, preferGeometry);
      const renderedEdge = renderEdges.find((candidate) => candidate.id === edge.id)
        || findClassRenderEdge(renderEdges, edge)
        || renderEdges[indexOfEdge(edges, edge)];
      const renderedWaypoints = renderedEdge?.waypoints
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .map((point) => ({
          x: snap(point.x + renderOffset.x),
          y: snap(point.y + renderOffset.y),
        }));
      const canUseDirectGeometry = preferGeometry && edge.source !== edge.target;
      const waypoints = renderedWaypoints?.length
        ? simplifyRenderedClassWaypoints(renderedWaypoints, renderedEdge, renderOffset)
        : canUseDirectGeometry ? [] : route.waypoints;
      const shouldCurve = canUseDirectGeometry && waypoints.length > 0;
      routes.set(edge.id, {
        ...route,
        style: canUseDirectGeometry ? makeDirectEdgeStyle(route.style, shouldCurve) : route.style,
        waypoints,
        labelPosition: renderedEdge ? getRenderedClassLabelPosition(renderedEdge, edge.label || '', renderOffset) : undefined,
      });
    });
  });

  return routes;
}

export function calculateRenderFaithfulLayouts(
  nodes: ASTNode[],
  sizeById: Map<string, ClassSize>,
  renderNodes: LayoutHintNode[]
) {
  if (nodes.length === 0 || renderNodes.length === 0) {
    return null;
  }

  const matches = nodes.map((node) => ({
    node,
    rendered: findRenderedNode(renderNodes, node.id, node.label),
  }));
  if (matches.some(({ rendered }) =>
    !rendered
    || !Number.isFinite(rendered.x)
    || !Number.isFinite(rendered.y)
  )) {
    return null;
  }

  const rawLayouts = matches.map(({ node, rendered }) => {
    const size = sizeById.get(node.id)!;
    const renderedWidth = Number.isFinite(rendered!.width) && rendered!.width! > 0
      ? rendered!.width!
      : size.width;
    const renderedHeight = Number.isFinite(rendered!.height) && rendered!.height! > 0
      ? rendered!.height!
      : size.height;
    return {
      nodeId: node.id,
      size,
      centerX: rendered!.x + renderedWidth / 2,
      centerY: rendered!.y + renderedHeight / 2,
    };
  });
  const minX = Math.min(...rawLayouts.map((layout) => layout.centerX - layout.size.width / 2));
  const minY = Math.min(...rawLayouts.map((layout) => layout.centerY - layout.size.height / 2));
  const offset = {
    x: minX < 40 ? 40 - minX : 0,
    y: minY < 40 ? 40 - minY : 0,
  };
  const layouts = new Map<string, ClassLayout>();

  rawLayouts.forEach(({ nodeId, size, centerX, centerY }) => {
    const x = snap(centerX - size.width / 2 + offset.x);
    const y = snap(centerY - size.height / 2 + offset.y);
    layouts.set(nodeId, {
      ...size,
      x,
      y,
      centerX: x + size.width / 2,
      centerY: y + size.height / 2,
    });
  });

  if (hasSevereOverlap(Array.from(layouts.values()))) {
    return null;
  }

  return { layouts, offset };
}

export function buildRenderHints(nodes: ASTNode[], renderNodes: LayoutHintNode[], _direction?: UmlDirection) {
  const hints = new Map<string, RenderHint>();

  nodes.forEach((node, index) => {
    const renderedNode = findRenderedNode(renderNodes, node.id, node.label);
    if (!renderedNode) {
      return;
    }

    hints.set(node.id, {
      x: renderedNode.x,
      y: renderedNode.y,
      order: index,
    });
  });

  return hints;
}

export function addEdges(builder: DrawioXmlBuilder, edges: ASTEdge[], edgeRoutes: Map<string, EdgeRoute>) {
  edges.forEach((edge, index) => {
    const edgeId = edge.id || `edge-${index}`;
    const route = edgeRoutes.get(edgeId);
    if (!route) {
      return;
    }

    const useSeparateLabel = Boolean(edge.label?.trim() && route.labelPosition);
    builder.addEdge(edgeId, edge.source, edge.target, useSeparateLabel ? '' : edge.label || '', route.style, route.waypoints);

    if (edge.sourceCardinality) {
      const placement = getCardinalityPlacement('source', route.sourceSide);
      builder.addChildVertex(
        `${edgeId}-source-cardinality`,
        edge.sourceCardinality,
        edgeId,
        0,
        0,
        placement.style,
        {
          relative: true,
          x: placement.x,
          y: placement.y,
          offset: placement.offset,
          connectable: false,
        }
      );
    }

    if (edge.targetCardinality) {
      const placement = getCardinalityPlacement('target', route.targetSide);
      builder.addChildVertex(
        `${edgeId}-target-cardinality`,
        edge.targetCardinality,
        edgeId,
        0,
        0,
        placement.style,
        {
          relative: true,
          x: placement.x,
          y: placement.y,
          offset: placement.offset,
          connectable: false,
        }
      );
    }

    if (useSeparateLabel && route.labelPosition) {
      const labelBounds = getClassEdgeLabelBounds(edge.label || '', route.labelPosition);
      builder.addVertex(
        `${edgeId}-label`,
        edge.label || '',
        labelBounds.x,
        labelBounds.y,
        labelBounds.width,
        labelBounds.height,
        UML_EDGE_LABEL_TEXT_STYLE
      );
    }
  });
}

export function addUmlDiagramTitle(
  builder: DrawioXmlBuilder,
  title: string | undefined,
  layoutById: Map<string, ClassLayout>
) {
  if (!title?.trim() || layoutById.size === 0) {
    return;
  }

  const layouts = Array.from(layoutById.values());
  const minX = Math.min(...layouts.map((layout) => layout.x));
  const maxX = Math.max(...layouts.map((layout) => layout.x + layout.width));
  const minY = Math.min(...layouts.map((layout) => layout.y));
  const width = Math.min(720, Math.max(220, title.length * 9 + 40));
  const centerX = (minX + maxX) / 2;

  builder.addVertex(
    'diagram-title',
    title,
    snap(centerX - width / 2),
    snap(Math.max(0, minY - 50)),
    width,
    30,
    UML_TITLE_STYLE
  );
}

function addClassRows(
  builder: DrawioXmlBuilder,
  classId: string,
  width: number,
  titleHeight: number,
  attributes: string[],
  methods: string[]
) {
  let rowIndex = 0;
  let currentY = titleHeight;
  const nextId = (suffix: string) => `${classId}-${suffix}-${rowIndex++}`;

  attributes.forEach((attribute) => {
    builder.addChildVertex(nextId('attribute'), attribute, classId, width, CLASS_ROW_HEIGHT, UML_CLASS_MEMBER_ROW_STYLE, {
      x: 0,
      y: currentY,
    });
    currentY += CLASS_ROW_HEIGHT;
  });

  if (attributes.length > 0 && methods.length > 0) {
    builder.addChildVertex(nextId('divider'), '', classId, width, CLASS_DIVIDER_HEIGHT, UML_CLASS_DIVIDER_STYLE, {
      x: 0,
      y: currentY,
    });
    currentY += CLASS_DIVIDER_HEIGHT;
  }

  methods.forEach((method) => {
    builder.addChildVertex(nextId('method'), method, classId, width, CLASS_ROW_HEIGHT, UML_CLASS_MEMBER_ROW_STYLE, {
      x: 0,
      y: currentY,
    });
    currentY += CLASS_ROW_HEIGHT;
  });
}

function getComponents(nodes: ASTNode[], edges: ASTEdge[], declarationOrder: Map<string, number>) {
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach((node) => adjacency.set(node.id, new Set()));

  edges.forEach((edge) => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  const visited = new Set<string>();
  const components: string[][] = [];

  nodes.forEach((node) => {
    if (visited.has(node.id)) {
      return;
    }

    const queue = [node.id];
    visited.add(node.id);
    const component: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      Array.from(adjacency.get(current) || [])
        .sort((a, b) => (declarationOrder.get(a) || 0) - (declarationOrder.get(b) || 0))
        .forEach((next) => {
          if (visited.has(next)) {
            return;
          }
          visited.add(next);
          queue.push(next);
        });
    }

    component.sort((a, b) => (declarationOrder.get(a) || 0) - (declarationOrder.get(b) || 0));
    components.push(component);
  });

  components.sort((a, b) => (declarationOrder.get(a[0]) || 0) - (declarationOrder.get(b[0]) || 0));
  return components;
}

function layoutComponent(
  component: string[],
  edges: ASTEdge[],
  sizeById: Map<string, ClassSize>,
  renderHints: Map<string, RenderHint>,
  declarationOrder: Map<string, number>,
  direction: UmlDirection
): ComponentLayout {
  const hierarchyEdges = edges.filter((edge) => {
    return HIERARCHY_EDGE_TYPES.has(edge.type || '') && component.includes(edge.source) && component.includes(edge.target);
  });
  const componentEdges = edges.filter((edge) => component.includes(edge.source) && component.includes(edge.target));

  if (isHorizontalDirection(direction) && componentEdges.length > 0) {
    const directedGroups = buildDirectedDepthGroups(component, componentEdges, renderHints, declarationOrder, direction);
    return layoutColumns(directedGroups, sizeById);
  }

  const childrenByParent = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  component.forEach((id) => {
    childrenByParent.set(id, []);
    indegree.set(id, 0);
  });

  hierarchyEdges.forEach((edge) => {
    childrenByParent.get(edge.target)?.push(edge.source);
    indegree.set(edge.source, (indegree.get(edge.source) || 0) + 1);
  });

  const roots = component
    .filter((id) => (indegree.get(id) || 0) === 0)
    .sort((a, b) => compareNodeIds(a, b, renderHints, declarationOrder, direction));

  const depthById = new Map<string, number>();
  const queue = [...roots];
  roots.forEach((id) => depthById.set(id, 0));

  let visitedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visitedCount += 1;
    const currentDepth = depthById.get(current) || 0;
    const children = [...(childrenByParent.get(current) || [])]
      .sort((a, b) => compareNodeIds(a, b, renderHints, declarationOrder, direction));

    children.forEach((child) => {
      depthById.set(child, Math.max(depthById.get(child) || 0, currentDepth + 1));
      indegree.set(child, (indegree.get(child) || 0) - 1);
      if ((indegree.get(child) || 0) === 0) {
        queue.push(child);
      }
    });
  }

  const hasCycle = hierarchyEdges.length > 0 && visitedCount !== component.length;
  const hasHierarchy = hierarchyEdges.length > 0 && !hasCycle;

  if (!hasHierarchy) {
    const orderedComponent = [...component].sort((a, b) => compareNodeIds(a, b, renderHints, declarationOrder, direction));
    if (isHorizontalDirection(direction)) {
      return layoutRows([orderedComponent], sizeById);
    }

    component.forEach((id) => depthById.set(id, 0));
  }

  const rawMaxDepth = Math.max(...Array.from(depthById.values()), 0);
  const bucketByDepth = new Map<number, string[]>();

  component.forEach((id) => {
    const rawDepth = depthById.get(id) || 0;
    const depth = shouldReverseDepth(direction) ? rawMaxDepth - rawDepth : rawDepth;
    bucketByDepth.set(depth, [...(bucketByDepth.get(depth) || []), id]);
  });

  const depthGroups = Array.from(bucketByDepth.entries())
    .sort(([a], [b]) => a - b)
    .map(([, ids]) => ids.sort((a, b) => compareNodeIds(a, b, renderHints, declarationOrder, direction)));

  return isHorizontalDirection(direction)
    ? layoutColumns(depthGroups, sizeById)
    : layoutRows(depthGroups, sizeById);
}

function buildDirectedDepthGroups(
  component: string[],
  edges: ASTEdge[],
  renderHints: Map<string, RenderHint>,
  declarationOrder: Map<string, number>,
  direction: UmlDirection
) {
  const ranks = new Map(component.map((id) => [id, 0]));
  for (let pass = 0; pass < component.length; pass += 1) {
    let changed = false;
    edges.forEach((edge) => {
      const sourceRank = ranks.get(edge.source);
      const targetRank = ranks.get(edge.target);
      if (sourceRank === undefined || targetRank === undefined) {
        return;
      }
      if (targetRank <= sourceRank) {
        ranks.set(edge.target, sourceRank + 1);
        changed = true;
      }
    });
    if (!changed) break;
  }

  const maxRank = Math.max(...Array.from(ranks.values()), 0);
  const bucketByRank = new Map<number, string[]>();
  component.forEach((id) => {
    const rawRank = ranks.get(id) || 0;
    const rank = direction === 'RL' ? maxRank - rawRank : rawRank;
    bucketByRank.set(rank, [...(bucketByRank.get(rank) || []), id]);
  });

  return Array.from(bucketByRank.entries())
    .sort(([a], [b]) => a - b)
    .map(([, ids]) => ids.sort((a, b) => compareNodeIds(a, b, renderHints, declarationOrder, direction)));
}

function layoutRows(depthGroups: string[][], sizeById: Map<string, ClassSize>): ComponentLayout {
  const rowMeta = depthGroups.map((row) => {
    const width = row.reduce((total, id) => total + (sizeById.get(id)?.width || CLASS_MIN_WIDTH), 0)
      + Math.max(0, row.length - 1) * CLASS_GAP_X;
    const height = row.reduce((maxHeight, id) => Math.max(maxHeight, sizeById.get(id)?.height || CLASS_TITLE_MIN_HEIGHT), 0);
    return { row, width, height };
  });

  const componentWidth = Math.max(...rowMeta.map((meta) => meta.width), CLASS_MIN_WIDTH);
  const componentHeight = rowMeta.reduce((total, meta) => total + meta.height, 0)
    + Math.max(0, rowMeta.length - 1) * CLASS_GAP_Y;
  const nodes = new Map<string, { x: number; y: number }>();

  let currentY = 0;
  rowMeta.forEach((meta) => {
    const rowX = (componentWidth - meta.width) / 2;
    let currentX = rowX;

    meta.row.forEach((id) => {
      const size = sizeById.get(id) || { width: CLASS_MIN_WIDTH, height: CLASS_TITLE_MIN_HEIGHT, titleHeight: CLASS_TITLE_MIN_HEIGHT };
      nodes.set(id, { x: currentX, y: currentY });
      currentX += size.width + CLASS_GAP_X;
    });

    currentY += meta.height + CLASS_GAP_Y;
  });

  return {
    width: snap(componentWidth),
    height: snap(componentHeight),
    nodes,
  };
}

function layoutColumns(depthGroups: string[][], sizeById: Map<string, ClassSize>): ComponentLayout {
  const columnMeta = depthGroups.map((column) => {
    const width = column.reduce((maxWidth, id) => Math.max(maxWidth, sizeById.get(id)?.width || CLASS_MIN_WIDTH), 0);
    const height = column.reduce((total, id) => total + (sizeById.get(id)?.height || CLASS_TITLE_MIN_HEIGHT), 0)
      + Math.max(0, column.length - 1) * CLASS_GAP_Y;
    return { column, width, height };
  });

  const componentWidth = columnMeta.reduce((total, meta) => total + meta.width, 0)
    + Math.max(0, columnMeta.length - 1) * CLASS_GAP_X;
  const componentHeight = Math.max(...columnMeta.map((meta) => meta.height), CLASS_TITLE_MIN_HEIGHT);
  const nodes = new Map<string, { x: number; y: number }>();

  let currentX = 0;
  columnMeta.forEach((meta) => {
    const columnY = 0;
    let currentY = columnY;

    meta.column.forEach((id) => {
      const size = sizeById.get(id) || { width: CLASS_MIN_WIDTH, height: CLASS_TITLE_MIN_HEIGHT, titleHeight: CLASS_TITLE_MIN_HEIGHT };
      const x = currentX + ((meta.width - size.width) / 2);
      nodes.set(id, { x, y: currentY });
      currentY += size.height + CLASS_GAP_Y;
    });

    currentX += meta.width + CLASS_GAP_X;
  });

  return {
    width: snap(componentWidth),
    height: snap(componentHeight),
    nodes,
  };
}

function buildEdgeRoute(
  edge: ASTEdge,
  sourceLayout: ClassLayout,
  targetLayout: ClassLayout,
  direction: UmlDirection,
  parallelOffset: number,
  preferGeometry = false
): EdgeRoute {
  const baseStyle = getUmlEdgeStyle(edge);

  if (edge.source === edge.target) {
    const sourceSide = isHorizontalDirection(direction) ? 'bottom' : 'right';
    const targetSide = sourceSide;
    const style = buildEdgeStyle(baseStyle, getAnchorFractions(sourceSide), getAnchorFractions(targetSide));
    const waypoints = createSelfEdgeWaypoints(sourceLayout, direction, parallelOffset);
    return { style, waypoints, sourceSide, targetSide };
  }

  const orientation = getEdgeOrientation(edge, sourceLayout, targetLayout, direction, preferGeometry);
  const { sourceSide, targetSide } = getEdgeSides(
    edge,
    sourceLayout,
    targetLayout,
    direction,
    orientation,
    preferGeometry
  );
  const sourceAnchor = getAnchorPoint(sourceLayout, sourceSide);
  const targetAnchor = getAnchorPoint(targetLayout, targetSide);
  const waypoints = createOrthogonalWaypoints(sourceAnchor, targetAnchor, orientation, parallelOffset);
  const style = buildEdgeStyle(baseStyle, getAnchorFractions(sourceSide), getAnchorFractions(targetSide));

  return { style, waypoints, sourceSide, targetSide };
}

function getEdgeOrientation(
  edge: ASTEdge,
  sourceLayout: ClassLayout,
  targetLayout: ClassLayout,
  direction: UmlDirection,
  preferGeometry = false
): Orientation {
  if (!preferGeometry && HIERARCHY_EDGE_TYPES.has(edge.type || '')) {
    return isHorizontalDirection(direction) ? 'horizontal' : 'vertical';
  }

  const deltaX = Math.abs(targetLayout.centerX - sourceLayout.centerX);
  const deltaY = Math.abs(targetLayout.centerY - sourceLayout.centerY);
  return deltaX >= deltaY ? 'horizontal' : 'vertical';
}

function getEdgeSides(
  edge: ASTEdge,
  sourceLayout: ClassLayout,
  targetLayout: ClassLayout,
  direction: UmlDirection,
  orientation: Orientation,
  preferGeometry = false
) {
  if (!preferGeometry && HIERARCHY_EDGE_TYPES.has(edge.type || '')) {
    switch (direction) {
      case 'BT':
        return { sourceSide: 'bottom' as Side, targetSide: 'top' as Side };
      case 'LR':
        return { sourceSide: 'left' as Side, targetSide: 'right' as Side };
      case 'RL':
        return { sourceSide: 'right' as Side, targetSide: 'left' as Side };
      case 'TB':
      default:
        return { sourceSide: 'top' as Side, targetSide: 'bottom' as Side };
    }
  }

  if (orientation === 'horizontal') {
    return targetLayout.centerX >= sourceLayout.centerX
      ? { sourceSide: 'right' as Side, targetSide: 'left' as Side }
      : { sourceSide: 'left' as Side, targetSide: 'right' as Side };
  }

  return targetLayout.centerY >= sourceLayout.centerY
    ? { sourceSide: 'bottom' as Side, targetSide: 'top' as Side }
    : { sourceSide: 'top' as Side, targetSide: 'bottom' as Side };
}

function createOrthogonalWaypoints(source: Point, target: Point, orientation: Orientation, parallelOffset: number) {
  const points: Point[] = [];

  if (orientation === 'horizontal') {
    const midpointX = snap(((source.x + target.x) / 2) + parallelOffset);
    if (Math.abs(source.y - target.y) <= 1 && parallelOffset === 0) {
      return points;
    }

    points.push({ x: midpointX, y: source.y });
    points.push({ x: midpointX, y: target.y });
  } else {
    const midpointY = snap(((source.y + target.y) / 2) + parallelOffset);
    if (Math.abs(source.x - target.x) <= 1 && parallelOffset === 0) {
      return points;
    }

    points.push({ x: source.x, y: midpointY });
    points.push({ x: target.x, y: midpointY });
  }

  return dedupePoints(points);
}

function createSelfEdgeWaypoints(layout: ClassLayout, direction: UmlDirection, parallelOffset: number) {
  if (isHorizontalDirection(direction)) {
    const loopY = snap(layout.y + layout.height + SELF_EDGE_GAP + parallelOffset);
    return [
      { x: layout.centerX, y: loopY },
      { x: layout.centerX + SELF_EDGE_GAP, y: loopY },
    ];
  }

  const loopX = snap(layout.x + layout.width + SELF_EDGE_GAP + parallelOffset);
  return [
    { x: loopX, y: layout.y + Math.round(layout.height * 0.25) },
    { x: loopX, y: layout.y + Math.round(layout.height * 0.75) },
  ];
}

function getCardinalityPlacement(end: 'source' | 'target', side: Side): CardinalityPlacement {
  const x = end === 'source' ? -1 : 1;

  switch (side) {
    case 'left':
      return {
        x,
        y: 0,
        style: 'resizable=0;html=1;align=right;verticalAlign=middle;labelBackgroundColor=none;fontSize=10',
        offset: { x: -8, y: 0 },
      };
    case 'right':
      return {
        x,
        y: 0,
        style: 'resizable=0;html=1;align=left;verticalAlign=middle;labelBackgroundColor=none;fontSize=10',
        offset: { x: 8, y: 0 },
      };
    case 'bottom':
      return {
        x,
        y: 0,
        style: 'resizable=0;html=1;align=center;verticalAlign=top;labelBackgroundColor=none;fontSize=10',
        offset: { x: 0, y: 8 },
      };
    case 'top':
    default:
      return {
        x,
        y: 0,
        style: 'resizable=0;html=1;align=center;verticalAlign=bottom;labelBackgroundColor=none;fontSize=10',
        offset: { x: 0, y: -8 },
      };
  }
}

function findClassRenderEdge(renderEdges: LayoutHintEdge[], edge: ASTEdge) {
  const source = normalizeClassEdgeKey(edge.source);
  const target = normalizeClassEdgeKey(edge.target);
  return renderEdges.find((candidate) => {
    if (!candidate.id) {
      return false;
    }
    const normalizedId = normalizeClassEdgeKey(candidate.id);
    return normalizedId.includes(source) && normalizedId.includes(target);
  });
}

function getRenderedClassLabelPosition(edge: LayoutHintEdge, label: string, renderOffset: Point) {
  if (!label.trim() || !edge.labelPosition) {
    return undefined;
  }

  if (edge.label && normalizeClassEdgeKey(edge.label) !== normalizeClassEdgeKey(label)) {
    return undefined;
  }

  return {
    x: snap(edge.labelPosition.x + renderOffset.x),
    y: snap(edge.labelPosition.y + renderOffset.y - 6),
  };
}

function getClassEdgeLabelBounds(label: string, center: Point) {
  const lines = label.split('\n');
  const width = Math.min(180, Math.max(42, Math.max(...lines.map((line) => line.length)) * 7 + 14));
  const height = Math.max(18, lines.length * 16 + 4);
  return {
    x: snap(center.x - width / 2),
    y: snap(center.y - height / 2),
    width,
    height,
  };
}

function normalizeClassEdgeKey(value: string) {
  return value.toLowerCase().replace(/[«»<>]/g, '').replace(/[^a-z0-9]+/g, '');
}

function compareNodeIds(
  leftId: string,
  rightId: string,
  renderHints: Map<string, RenderHint>,
  declarationOrder: Map<string, number>,
  direction: UmlDirection
) {
  const leftHint = renderHints.get(leftId);
  const rightHint = renderHints.get(rightId);
  const useVerticalHint = isHorizontalDirection(direction);

  if (leftHint && rightHint) {
    const hintDelta = useVerticalHint
      ? leftHint.y - rightHint.y
      : leftHint.x - rightHint.x;
    if (Math.abs(hintDelta) > 1) {
      return hintDelta;
    }
  }

  return (declarationOrder.get(leftId) || 0) - (declarationOrder.get(rightId) || 0);
}

function estimateClassSize(node: ASTNode): ClassSize {
  const headerLines = getClassHeaderLines(node);
  const titleHeight = Math.max(
    CLASS_TITLE_MIN_HEIGHT,
    (headerLines.length * CLASS_TITLE_LINE_HEIGHT) + CLASS_TITLE_VERTICAL_PADDING
  );
  const contentLines = [...headerLines, ...(node.attributes || []), ...(node.methods || [])];
  const longestLineLength = contentLines.reduce((max, line) => Math.max(max, line.length), 0);
  const width = Math.max(CLASS_MIN_WIDTH, Math.ceil(longestLineLength * 7.4) + CLASS_HORIZONTAL_PADDING);
  const needsDivider = (node.attributes?.length || 0) > 0 && (node.methods?.length || 0) > 0;
  const height = titleHeight
    + ((node.attributes?.length || 0) * CLASS_ROW_HEIGHT)
    + (needsDivider ? CLASS_DIVIDER_HEIGHT : 0)
    + ((node.methods?.length || 0) * CLASS_ROW_HEIGHT);

  return { width, height, titleHeight };
}

function getClassHeaderLines(node: ASTNode) {
  const annotations = [...(node.annotations || [])];
  const stereotype = getClassStereotype(node);
  if (stereotype && !annotations.some((annotation) => annotation.toLowerCase() === stereotype.toLowerCase())) {
    annotations.unshift(stereotype);
  }

  return [...annotations.map(formatUmlAnnotation), node.label].filter(Boolean);
}

function formatClassTitle(node: ASTNode) {
  return getClassHeaderLines(node).join('\n');
}

function buildClassStyle(node: ASTNode, titleHeight: number) {
  const baseStyle = UML_CLASS_STYLE.replace('%START_SIZE%', String(titleHeight));
  if (node.type === 'abstractClass') {
    return replaceStyle(baseStyle, 'fontStyle', '3');
  }

  return baseStyle;
}

function getClassStereotype(node: ASTNode) {
  if (node.type === 'interface') {
    return '<<interface>>';
  }

  if (node.type === 'enum') {
    return '<<enumeration>>';
  }

  if (node.type === 'abstractClass') {
    return '<<abstract>>';
  }

  return null;
}

function replaceStyle(style: string, key: string, value: string) {
  const nextStyle = style.replace(new RegExp(`${key}=[^;]*;?`), '');
  return `${nextStyle}${nextStyle.endsWith(';') ? '' : ';'}${key}=${value};`;
}

function buildEdgeStyle(baseStyle: string, sourceAnchor: Point, targetAnchor: Point) {
  return `${DEFAULT_EDGE_STYLE}${baseStyle}exitX=${sourceAnchor.x};exitY=${sourceAnchor.y};entryX=${targetAnchor.x};entryY=${targetAnchor.y};`;
}

function makeDirectEdgeStyle(style: string, curved = false) {
  return style.replace(DEFAULT_EDGE_STYLE, curved ? UML_CURVED_EDGE_STYLE : UML_DIRECT_EDGE_STYLE);
}

function simplifyRenderedClassWaypoints(
  waypoints: Point[],
  renderedEdge: LayoutHintEdge | undefined,
  renderOffset: Point
) {
  const points = waypoints;
  if (!renderedEdge?.sourcePoint || !renderedEdge.targetPoint || points.length === 0) {
    return simplifyRenderedWaypoints(points);
  }

  const sourcePoint = {
    x: snap(renderedEdge.sourcePoint.x + renderOffset.x),
    y: snap(renderedEdge.sourcePoint.y + renderOffset.y),
  };
  const targetPoint = {
    x: snap(renderedEdge.targetPoint.x + renderOffset.x),
    y: snap(renderedEdge.targetPoint.y + renderOffset.y),
  };

  return simplifyRenderedWaypoints(points, sourcePoint, targetPoint);
}

function getUmlEdgeStyle(edge: ASTEdge) {
  const baseStyle = UML_EDGE_STYLES[edge.type as keyof typeof UML_EDGE_STYLES] || UML_EDGE_STYLES.association;
  return applyStyleOverrides(baseStyle, edge.styleOverrides);
}

function applyStyleOverrides(style: string, overrides?: Record<string, string>) {
  if (!overrides) {
    return style;
  }

  return Object.entries(overrides).reduce(
    (nextStyle, [key, value]) => replaceStyle(nextStyle, key, value),
    style
  );
}

function getAnchorFractions(side: Side): Point {
  switch (side) {
    case 'left':
      return { x: 0, y: 0.5 };
    case 'right':
      return { x: 1, y: 0.5 };
    case 'bottom':
      return { x: 0.5, y: 1 };
    case 'top':
    default:
      return { x: 0.5, y: 0 };
  }
}

function getAnchorPoint(layout: ClassLayout, side: Side): Point {
  switch (side) {
    case 'left':
      return { x: layout.x, y: layout.centerY };
    case 'right':
      return { x: layout.x + layout.width, y: layout.centerY };
    case 'bottom':
      return { x: layout.centerX, y: layout.y + layout.height };
    case 'top':
    default:
      return { x: layout.centerX, y: layout.y };
  }
}

function shouldReverseDepth(direction: UmlDirection) {
  return direction === 'BT' || direction === 'RL';
}

function isHorizontalDirection(direction: UmlDirection) {
  return direction === 'LR' || direction === 'RL';
}

function snap(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function dedupePoints(points: Point[]) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}

function indexOfEdge(edges: ASTEdge[], target: ASTEdge) {
  const byIdentity = edges.indexOf(target);
  if (byIdentity !== -1) {
    return byIdentity;
  }
  return edges.findIndex((edge) => edge.id === target.id);
}

function hasSevereOverlap(layouts: ClassLayout[]) {
  for (let leftIndex = 0; leftIndex < layouts.length; leftIndex += 1) {
    const left = layouts[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < layouts.length; rightIndex += 1) {
      const right = layouts[rightIndex];
      const overlapWidth = Math.max(
        0,
        Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x)
      );
      const overlapHeight = Math.max(
        0,
        Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y)
      );
      if (overlapWidth * overlapHeight > Math.min(left.width * left.height, right.width * right.height) * 0.2) {
        return true;
      }
    }
  }
  return false;
}

function findRenderedNode(nodes: LayoutHintNode[], id: string, label?: string) {
  return findRenderHintNode(
    nodes.map((node) => ({
      ...node,
      width: node.width || 0,
      height: node.height || 0,
    })),
    id,
    label
  );
}
