import type { ASTEdge, ASTNode } from '../../../types/ast';
import { DrawioXmlBuilder, type Point } from '../../drawio/builder';
import {
  buildRenderHints,
  type LayoutHintEdge,
  type ClassLayout,
  type LayoutHintNode,
  type UmlDirection,
} from '../../drawio/umlClass';
import { findRenderHintNode, type RenderHintNode } from '../../drawio/renderHints';
import { getDrawioNodeStyle } from '../../drawio/shapeRegistry';
import { UML_EDGE_STYLES } from '../../drawio/styles';
import { formatUmlAnnotation } from '../../drawio/umlLabels';
import type { ParsedPlantUML } from '../parser';

const ACTOR_GAP = 70;
const USE_CASE_GAP_X = 90;
const USE_CASE_GAP_Y = 70;
const USE_CASE_COLUMNS = 3;
const USE_CASE_GROUP_GAP_X = 360;
const USE_CASE_GROUP_GAP_Y = 260;
const CONTAINER_PADDING_X = 32;
const CONTAINER_PADDING_TOP = 54;
const CONTAINER_PADDING_BOTTOM = 28;
const NOTE_GAP = 28;
const EDGE_LABEL_STYLE = 'labelBackgroundColor=#ffffff;rounded=0;curved=1;';
const RENDERED_EDGE_ROUTE_STYLE = 'labelBackgroundColor=#ffffff;rounded=0;edgeStyle=none;curved=0;';
const DETOUR_EDGE_ROUTE_STYLE = 'labelBackgroundColor=#ffffff;rounded=0;edgeStyle=none;curved=1;';
const EDGE_LABEL_TEXT_STYLE = 'text;html=1;strokeColor=none;fillColor=#ffffff;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=12;resizable=0;rotatable=0;connectable=0;';
const ACTOR_WIDTH = 56;
const ACTOR_HEIGHT = 74;
const OUTSIDE_ACTOR_CONTAINER_CLEARANCE = 22;
const PACKAGE_TITLE_HEIGHT = 22;
const RECTANGLE_TITLE_HEIGHT = 24;
const EDGE_OBSTACLE_CLEARANCE = 24;

type UseCaseSide = 'left' | 'right' | 'top' | 'bottom';

type UseCaseNode = ASTNode & {
  noteAnchorId?: string;
  notePlacement?: ASTNode['notePlacement'];
};

type UseCaseEdge = ASTEdge & {
  directionHint?: 'left' | 'right' | 'up' | 'down';
};

type UseCaseEdgeRoute = {
  style: string;
  waypoints: Point[];
  sourceSide: UseCaseSide;
  targetSide: UseCaseSide;
  labelPosition?: Point;
};

type UseCaseRoutePlan = {
  edge: UseCaseEdge;
  index: number;
  sourceLayout: ClassLayout;
  targetLayout: ClassLayout;
  renderedEdge: LayoutHintEdge | undefined;
  sourceSide: UseCaseSide;
  targetSide: UseCaseSide;
  sourceFraction?: number;
  targetFraction?: number;
};

export function convertUseCaseDiagram(
  ast: ParsedPlantUML,
  renderNodes: LayoutHintNode[] = [],
  renderEdges: LayoutHintEdge[] = []
) {
  const builder = new DrawioXmlBuilder();
  const direction: UmlDirection = ast.direction || 'LR';
  const leafNodes: UseCaseNode[] = ast.nodes
    .filter((node) => node.type === 'actor' || node.type === 'usecase' || node.type === 'note')
    .map((node) => ({
      id: node.id,
      label: formatNodeLabel(node.name, node.annotations),
      type: node.type,
      parentId: node.parentId,
      annotations: node.annotations,
      noteAnchorId: node.noteAnchorId,
      notePlacement: node.notePlacement,
    }));
  const containerNodes: UseCaseNode[] = ast.nodes
    .filter((node) => node.type === 'package' || node.type === 'rectangle')
    .map((node) => ({
      id: node.id,
      label: formatNodeLabel(node.name, node.annotations),
      type: node.type,
      parentId: node.parentId,
    }));
  const sourceEdges: UseCaseEdge[] = ast.edges.map((edge, index) => ({
    id: edge.id || `edge-${index}`,
    source: edge.sourceId,
    target: edge.targetId,
    label: formatUmlAnnotation(edge.label),
    type: edge.type,
    isDashed: edge.isDashed,
    directionHint: edge.directionHint,
  }));
  const noteEdges: UseCaseEdge[] = leafNodes
    .filter((node) => node.type === 'note' && node.noteAnchorId)
    .map((node, index) => ({
      id: `${node.id}-anchor-${index}`,
      source: node.noteAnchorId!,
      target: node.id,
      label: '',
      type: 'dependency',
      isDashed: true,
    }));
  const edges = [...sourceEdges, ...noteEdges];

  const layoutById = layoutUseCaseNodes(leafNodes, edges, renderNodes, direction);
  const containerBounds = calculateUseCaseContainerBounds(containerNodes, leafNodes, layoutById, renderNodes);
  keepTopLevelActorsOutsideContainers(layoutById, leafNodes, containerBounds);
  const fullLayoutById = buildFullLayoutMap(layoutById, containerBounds);
  const renderableEdges = edges.filter((edge) => fullLayoutById.has(edge.source) && fullLayoutById.has(edge.target));
  const nodesById = new Map([...leafNodes, ...containerNodes].map((node) => [node.id, node]));

  [...containerNodes]
    .sort((left, right) => getContainerDepth(left, containerNodes) - getContainerDepth(right, containerNodes))
    .forEach((node) => {
      const bounds = containerBounds.get(node.id);
      if (!bounds) {
        return;
      }
      const parentBounds = node.parentId ? containerBounds.get(node.parentId) : undefined;
      builder.addContainer(
        node.id,
        '',
        parentBounds ? bounds.x - parentBounds.x : bounds.x,
        parentBounds ? bounds.y - parentBounds.y : bounds.y,
        bounds.width,
        bounds.height,
        node.type === 'package'
          ? `${getDrawioNodeStyle('component.package')}container=1;collapsible=0;recursiveResize=0;`
          : 'rounded=0;whiteSpace=wrap;html=1;container=1;collapsible=0;recursiveResize=0;verticalAlign=top;align=left;spacingTop=8;fontStyle=1;',
        node.parentId || '1'
      );
      addUseCaseContainerTitle(builder, node, bounds, parentBounds);
    });

  leafNodes.forEach((node) => {
    const layout = layoutById.get(node.id);
    if (!layout) {
      return;
    }
    const style = getUseCaseNodeStyle(node);
    const parentBounds = node.parentId ? containerBounds.get(node.parentId) : undefined;
    if (parentBounds) {
      builder.addChildVertex(node.id, node.label, node.parentId!, layout.width, layout.height, style, {
        x: layout.x - parentBounds.x,
        y: layout.y - parentBounds.y,
      });
    } else {
      builder.addVertex(node.id, node.label, layout.x, layout.y, layout.width, layout.height, style);
    }
  });

  addUseCaseEdges(
    builder,
    renderableEdges,
    calculateUseCaseEdgeRoutes(renderableEdges, fullLayoutById, nodesById, direction, renderEdges),
    fullLayoutById
  );
  return builder.toXml();
}

function layoutUseCaseNodes(
  nodes: UseCaseNode[],
  edges: UseCaseEdge[],
  renderNodes: LayoutHintNode[],
  direction: UmlDirection
) {
  const renderHints = buildRenderHints(nodes, renderNodes, direction);
  const faithful = layoutUseCaseFromRenderer(nodes, renderNodes, edges, direction);
  if (faithful) {
    return faithful;
  }
  const declarationOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const ordered = (items: UseCaseNode[]) => items
    .sort((left, right) => {
      const leftHint = renderHints.get(left.id);
      const rightHint = renderHints.get(right.id);
      if (leftHint && rightHint) {
        const delta = direction === 'LR' || direction === 'RL'
          ? leftHint.y - rightHint.y
          : leftHint.x - rightHint.x;
        if (Math.abs(delta) > 1) {
          return delta;
        }
      }
      return (declarationOrder.get(left.id) || 0) - (declarationOrder.get(right.id) || 0);
    });
  const byType = (type: string) => ordered(nodes
    .filter((node) => node.type === type)
  );
  const actors = byType('actor');
  const usecases = byType('usecase');
  const notes = byType('note');
  const layout = new Map<string, ClassLayout>();
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  layoutUseCasesByParent(layout, usecases, direction);
  layoutActors(layout, actors, usecases, edges, direction, nodesById);
  layoutNotes(layout, notes, direction);

  nodes.forEach((node, index) => {
    if (!layout.has(node.id)) {
      const size = estimateUseCaseNodeSize(node);
      setLayout(layout, node.id, 40 + index * 200, 40, size);
    }
  });

  return layout;
}

function addUseCaseContainerTitle(
  builder: DrawioXmlBuilder,
  node: UseCaseNode,
  bounds: { x: number; y: number; width: number; height: number },
  parentBounds?: { x: number; y: number; width: number; height: number }
) {
  const parentId = node.parentId || '1';
  const baseX = parentBounds ? bounds.x - parentBounds.x : bounds.x;
  const baseY = parentBounds ? bounds.y - parentBounds.y : bounds.y;
  if (node.type === 'package') {
    const width = Math.max(96, Math.min(260, node.label.length * 8 + 18));
    builder.addChildVertex(
      `${node.id}-title`,
      node.label,
      parentId,
      width,
      PACKAGE_TITLE_HEIGHT,
      'text;html=1;strokeColor=none;fillColor=#ffffff;align=left;verticalAlign=middle;fontStyle=1;fontSize=14;resizable=0;rotatable=0;connectable=0;',
      {
        x: baseX + 4,
        y: baseY,
        connectable: false,
      }
    );
    return;
  }

  builder.addChildVertex(
    `${node.id}-title`,
    node.label,
    node.id,
    Math.min(bounds.width - 24, Math.max(120, node.label.length * 8 + 18)),
    RECTANGLE_TITLE_HEIGHT,
    'text;html=1;strokeColor=none;fillColor=#ffffff;align=center;verticalAlign=middle;fontStyle=1;fontSize=14;resizable=0;rotatable=0;connectable=0;',
    {
      x: (bounds.width - Math.min(bounds.width - 24, Math.max(120, node.label.length * 8 + 18))) / 2,
      y: 6,
      connectable: false,
    }
  );
}

function layoutUseCasesByParent(
  layout: Map<string, ClassLayout>,
  usecases: UseCaseNode[],
  direction: UmlDirection
) {
  const groups = groupByParent(usecases);
  const horizontal = direction === 'LR' || direction === 'RL';
  let groupIndex = 0;

  groups.forEach((group) => {
    const groupColumn = horizontal ? groupIndex : groupIndex % 2;
    const groupRow = horizontal ? 0 : Math.floor(groupIndex / 2);
    const baseX = horizontal
      ? 300 + groupColumn * USE_CASE_GROUP_GAP_X
      : 120 + groupColumn * USE_CASE_GROUP_GAP_X;
    const baseY = horizontal
      ? 80 + groupIndex * USE_CASE_GROUP_GAP_Y
      : 220 + groupRow * USE_CASE_GROUP_GAP_Y;

    group.nodes.forEach((usecase, index) => {
      const size = estimateUseCaseNodeSize(usecase);
      const row = horizontal ? index % USE_CASE_COLUMNS : Math.floor(index / USE_CASE_COLUMNS);
      const column = horizontal ? Math.floor(index / USE_CASE_COLUMNS) : index % USE_CASE_COLUMNS;
      setLayout(
        layout,
        usecase.id,
        baseX + column * (230 + USE_CASE_GAP_X),
        baseY + row * (size.height + USE_CASE_GAP_Y),
        size
      );
    });
    groupIndex += 1;
  });
}

function layoutActors(
  layout: Map<string, ClassLayout>,
  actors: UseCaseNode[],
  usecases: UseCaseNode[],
  edges: UseCaseEdge[],
  direction: UmlDirection,
  nodesById: Map<string, UseCaseNode>
) {
  const topLevelActors = actors.filter((actor) => !actor.parentId);
  const containedActors = actors.filter((actor) => actor.parentId);
  const primaryActors = topLevelActors.filter((actor) => classifyActorSide(actor, edges) === 'primary');
  const secondaryActors = topLevelActors.filter((actor) => classifyActorSide(actor, edges) === 'secondary');
  const contentBounds = getLayoutBounds(Array.from(layout.values())) || { minX: 300, minY: 80, maxX: 760, maxY: 360 };

  placeActorColumnOrRow(layout, primaryActors, direction, 'primary', contentBounds, edges, nodesById);
  placeActorColumnOrRow(layout, secondaryActors, direction, 'secondary', contentBounds, edges, nodesById);

  const actorsByParent = groupByParent(containedActors);
  actorsByParent.forEach((group) => {
    const parentUseCases = usecases
      .filter((usecase) => usecase.parentId === group.parentId)
      .map((usecase) => layout.get(usecase.id))
      .filter((value): value is ClassLayout => Boolean(value));
    const bounds = getLayoutBounds(parentUseCases) || contentBounds;
    group.nodes.forEach((actor, index) => {
      const size = estimateUseCaseNodeSize(actor);
      setLayout(
        layout,
        actor.id,
        Math.max(60, bounds.minX - size.width - ACTOR_GAP),
        bounds.minY + index * (size.height + ACTOR_GAP),
        size
      );
    });
  });
}

function placeActorColumnOrRow(
  layout: Map<string, ClassLayout>,
  actors: UseCaseNode[],
  direction: UmlDirection,
  side: 'primary' | 'secondary',
  contentBounds: { minX: number; minY: number; maxX: number; maxY: number },
  edges: UseCaseEdge[],
  nodesById: Map<string, UseCaseNode>
) {
  if (actors.length === 0) {
    return;
  }

  const horizontal = direction === 'LR' || direction === 'RL';
  const primaryBefore = direction === 'LR' || direction === 'TB';
  const before = side === 'primary' ? primaryBefore : !primaryBefore;
  const desiredByActor = new Map(actors.map((actor) => [
    actor.id,
    getActorDesiredAxis(actor, edges, nodesById, layout, horizontal),
  ]));
  const orderedActors = [...actors].sort((left, right) => {
    const leftDesired = desiredByActor.get(left.id);
    const rightDesired = desiredByActor.get(right.id);
    if (leftDesired !== undefined && rightDesired !== undefined && Math.abs(leftDesired - rightDesired) > 1) {
      return leftDesired - rightDesired;
    }
    if (leftDesired !== undefined) {
      return -1;
    }
    if (rightDesired !== undefined) {
      return 1;
    }
    return actors.indexOf(left) - actors.indexOf(right);
  });

  let cursor = horizontal ? contentBounds.minY : contentBounds.minX;
  orderedActors.forEach((actor) => {
    const size = estimateUseCaseNodeSize(actor);
    const desired = desiredByActor.get(actor.id);
    const axis = Math.max(cursor, desired !== undefined
      ? desired - ((horizontal ? size.height : size.width) / 2)
      : cursor);
    const x = horizontal
      ? before
        ? Math.max(40, contentBounds.minX - size.width - 130)
        : contentBounds.maxX + 130
      : axis;
    const y = horizontal
      ? axis
      : before
        ? Math.max(40, contentBounds.minY - size.height - 110)
        : contentBounds.maxY + 110;
    setLayout(layout, actor.id, x, y, size);
    cursor = axis + (horizontal ? size.height : size.width) + ACTOR_GAP;
  });
}

function getActorDesiredAxis(
  actor: UseCaseNode,
  edges: UseCaseEdge[],
  nodesById: Map<string, UseCaseNode>,
  layout: Map<string, ClassLayout>,
  horizontal: boolean
) {
  const connectedAxes = edges
    .filter((edge) => edge.source === actor.id || edge.target === actor.id)
    .map((edge) => edge.source === actor.id ? edge.target : edge.source)
    .filter((nodeId) => nodesById.get(nodeId)?.type !== 'actor')
    .map((nodeId) => layout.get(nodeId))
    .filter((value): value is ClassLayout => Boolean(value))
    .map((value) => horizontal ? value.centerY : value.centerX);

  if (connectedAxes.length === 0) {
    return undefined;
  }

  return connectedAxes.reduce((total, axis) => total + axis, 0) / connectedAxes.length;
}

function classifyActorSide(actor: UseCaseNode, edges: UseCaseEdge[]) {
  let score = 0;
  edges.forEach((edge) => {
    if (edge.source === actor.id) {
      score += edge.directionHint === 'left' || edge.directionHint === 'up' ? -2 : 1;
    }
    if (edge.target === actor.id) {
      score += edge.directionHint === 'right' || edge.directionHint === 'down' ? 2 : -1;
    }
  });

  return score >= 0 ? 'primary' : 'secondary';
}

function layoutNotes(
  layout: Map<string, ClassLayout>,
  notes: UseCaseNode[],
  direction: UmlDirection
) {
  let standaloneIndex = 0;
  notes.forEach((note) => {
    const size = estimateUseCaseNodeSize(note);
    const anchorLayout = note.noteAnchorId ? layout.get(note.noteAnchorId) : undefined;
    if (!anchorLayout) {
      setLayout(layout, note.id, 680, 80 + standaloneIndex * (size.height + NOTE_GAP), size);
      standaloneIndex += 1;
      return;
    }

    switch (note.notePlacement || (direction === 'TB' || direction === 'BT' ? 'right' : 'bottom')) {
      case 'left':
        setLayout(layout, note.id, anchorLayout.x - size.width - NOTE_GAP, anchorLayout.y, size);
        break;
      case 'top':
        setLayout(layout, note.id, anchorLayout.x, anchorLayout.y - size.height - NOTE_GAP, size);
        break;
      case 'bottom':
        setLayout(layout, note.id, anchorLayout.x, anchorLayout.y + anchorLayout.height + NOTE_GAP, size);
        break;
      case 'right':
      default:
        setLayout(layout, note.id, anchorLayout.x + anchorLayout.width + NOTE_GAP, anchorLayout.y, size);
        break;
    }
  });
}

function layoutUseCaseFromRenderer(
  nodes: UseCaseNode[],
  renderNodes: LayoutHintNode[],
  edges: UseCaseEdge[],
  direction: UmlDirection
) {
  if (nodes.length === 0 || renderNodes.length === 0) {
    return null;
  }
  const matched = nodes
    .map((node) => ({
      node,
      rendered: findUseCaseRenderHintNode(renderNodes, node.id, node.label),
    }))
    .filter((match): match is { node: UseCaseNode; rendered: RenderHintNode } => Boolean(match.rendered));

  if (matched.length === 0 || matched.length < Math.ceil(nodes.length * 0.5)) {
    return null;
  }

  const minX = Math.min(...matched.map(({ rendered }) => rendered.x));
  const minY = Math.min(...matched.map(({ rendered }) => rendered.y));
  const layout = new Map<string, ClassLayout>();

  matched.forEach(({ node, rendered }) => {
    const size = estimateUseCaseNodeSizeFromRenderHint(node, rendered);
    setLayout(
      layout,
      node.id,
      rendered.x + rendered.width / 2 - minX + 40 - size.width / 2,
      rendered.y + rendered.height / 2 - minY + 40 - size.height / 2,
      size
    );
  });

  const missing = nodes.filter((node) => !layout.has(node.id));
  if (missing.length > 0) {
    placeMissingUseCaseNodes(layout, missing, edges, direction);
  }

  return hasUseCaseOverlap(Array.from(layout.values())) ? null : layout;
}

function estimateUseCaseNodeSizeFromRenderHint(node: ASTNode, rendered: RenderHintNode) {
  const fallback = estimateUseCaseNodeSize(node);
  if (node.type === 'actor') {
    return {
      width: ACTOR_WIDTH,
      height: Math.max(ACTOR_HEIGHT, Math.min(96, rendered.height)),
      titleHeight: ACTOR_HEIGHT,
    };
  }
  if (node.type === 'usecase') {
    return {
      width: Math.max(120, Math.min(360, rendered.width)),
      height: Math.max(44, Math.min(120, rendered.height)),
      titleHeight: Math.max(44, Math.min(120, rendered.height)),
    };
  }
  return {
    width: Math.max(fallback.width, Math.min(360, rendered.width)),
    height: Math.max(fallback.height, Math.min(160, rendered.height)),
    titleHeight: fallback.titleHeight,
  };
}

function findUseCaseRenderHintNode(renderNodes: LayoutHintNode[], id: string, label?: string) {
  return findRenderHintNode(normalizeUseCaseRenderNodes(renderNodes), id, label);
}

function normalizeUseCaseRenderNodes(renderNodes: LayoutHintNode[]): RenderHintNode[] {
  return renderNodes.map((node) => ({
    ...node,
    width: node.width || 0,
    height: node.height || 0,
  }));
}

function placeMissingUseCaseNodes(
  layout: Map<string, ClassLayout>,
  missing: UseCaseNode[],
  edges: UseCaseEdge[],
  direction: UmlDirection
) {
  const bounds = getLayoutBounds(Array.from(layout.values())) || { minX: 300, minY: 80, maxX: 760, maxY: 360 };
  const horizontal = direction === 'LR' || direction === 'RL';

  missing.forEach((node, index) => {
    const size = estimateUseCaseNodeSize(node);
    const connected = edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => layout.get(edge.source === node.id ? edge.target : edge.source))
      .filter((value): value is ClassLayout => Boolean(value));
    const anchor = connected[0];
    if (anchor) {
      const offset = 110 + index * 30;
      if (node.type === 'usecase' || node.type === 'note') {
        const x = direction === 'RL'
          ? anchor.x - size.width - USE_CASE_GAP_X
          : direction === 'LR'
            ? anchor.x + anchor.width + USE_CASE_GAP_X
            : anchor.centerX - size.width / 2;
        const y = direction === 'BT'
          ? anchor.y - size.height - USE_CASE_GAP_Y
          : direction === 'TB'
            ? anchor.y + anchor.height + USE_CASE_GAP_Y
            : anchor.centerY - size.height / 2;
        setLayout(layout, node.id, x, y, size);
        return;
      }

      setLayout(
        layout,
        node.id,
        horizontal ? bounds.minX - size.width - offset : anchor.centerX - size.width / 2,
        horizontal ? anchor.centerY - size.height / 2 : bounds.maxY + offset,
        size
      );
      return;
    }

    setLayout(
      layout,
      node.id,
      bounds.maxX + 120,
      bounds.minY + index * (size.height + USE_CASE_GAP_Y),
      size
    );
  });
}

function hasUseCaseOverlap(layouts: ClassLayout[]) {
  for (let leftIndex = 0; leftIndex < layouts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < layouts.length; rightIndex += 1) {
      const left = layouts[leftIndex];
      const right = layouts[rightIndex];
      const overlapWidth = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
      const overlapHeight = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
      if (overlapWidth * overlapHeight > 0.15 * Math.min(left.width * left.height, right.width * right.height)) {
        return true;
      }
    }
  }
  return false;
}

function groupByParent(nodes: UseCaseNode[]) {
  const groups = new Map<string, UseCaseNode[]>();
  nodes.forEach((node) => {
    const key = node.parentId || '__root__';
    groups.set(key, [...(groups.get(key) || []), node]);
  });

  return Array.from(groups.entries()).map(([parentId, groupedNodes]) => ({
    parentId: parentId === '__root__' ? undefined : parentId,
    nodes: groupedNodes,
  }));
}

function getLayoutBounds(layouts: ClassLayout[]) {
  if (layouts.length === 0) {
    return null;
  }

  return {
    minX: Math.min(...layouts.map((layout) => layout.x)),
    minY: Math.min(...layouts.map((layout) => layout.y)),
    maxX: Math.max(...layouts.map((layout) => layout.x + layout.width)),
    maxY: Math.max(...layouts.map((layout) => layout.y + layout.height)),
  };
}

function buildFullLayoutMap(
  leafLayouts: Map<string, ClassLayout>,
  containerBounds: Map<string, { x: number; y: number; width: number; height: number }>
) {
  const fullLayout = new Map(leafLayouts);
  containerBounds.forEach((bounds, id) => {
    fullLayout.set(id, {
      ...bounds,
      titleHeight: bounds.height,
      centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2,
    });
  });
  return fullLayout;
}

function keepTopLevelActorsOutsideContainers(
  layoutById: Map<string, ClassLayout>,
  leafNodes: UseCaseNode[],
  containerBounds: Map<string, { x: number; y: number; width: number; height: number }>
) {
  const topLevelActors = leafNodes.filter((node) => node.type === 'actor' && !node.parentId);
  const containers = Array.from(containerBounds.values());
  topLevelActors.forEach((actor) => {
    const layout = layoutById.get(actor.id);
    if (!layout) {
      return;
    }

    containers.forEach((container) => {
      const overlapsX = layout.x < container.x + container.width && layout.x + layout.width > container.x;
      const overlapsY = layout.y < container.y + container.height && layout.y + layout.height > container.y;
      if (!overlapsX || !overlapsY) {
        return;
      }

      const actorCenterX = layout.centerX;
      const actorCenterY = layout.centerY;
      const containerCenterX = container.x + container.width / 2;
      const containerCenterY = container.y + container.height / 2;
      const deltaX = actorCenterX - containerCenterX;
      const deltaY = actorCenterY - containerCenterY;

      const protrudesLeft = layout.x < container.x && layout.x + layout.width < container.x + container.width;
      const protrudesRight = layout.x + layout.width > container.x + container.width && layout.x > container.x;
      const protrudesTop = layout.y < container.y;
      const protrudesBottom = layout.y + layout.height > container.y + container.height;

      if (!protrudesLeft && !protrudesRight && (protrudesTop || protrudesBottom || Math.abs(deltaY) >= Math.abs(deltaX))) {
        const y = deltaY < 0
          ? container.y - layout.height - OUTSIDE_ACTOR_CONTAINER_CLEARANCE
          : container.y + container.height + OUTSIDE_ACTOR_CONTAINER_CLEARANCE;
        setLayout(layoutById, actor.id, layout.x, y, layout);
        return;
      }

      const x = protrudesLeft || (!protrudesRight && deltaX < 0)
        ? container.x - layout.width - OUTSIDE_ACTOR_CONTAINER_CLEARANCE
        : container.x + container.width + OUTSIDE_ACTOR_CONTAINER_CLEARANCE;
      setLayout(layoutById, actor.id, x, layout.y, layout);
    });
  });
}

function calculateUseCaseEdgeRoutes(
  edges: UseCaseEdge[],
  layoutById: Map<string, ClassLayout>,
  nodesById: Map<string, UseCaseNode>,
  direction: UmlDirection,
  renderEdges: LayoutHintEdge[] = []
) {
  const routePlan = edges.map((edge, index) => {
    const sourceLayout = layoutById.get(edge.source);
    const targetLayout = layoutById.get(edge.target);
    if (!sourceLayout || !targetLayout) {
      return null;
    }
    const renderedEdge = findUseCaseRenderEdge(renderEdges, edge);
    const renderedAnchors = renderedEdge
      ? getRenderedUseCaseAnchors(renderedEdge, sourceLayout, targetLayout)
      : undefined;
    const sides = renderedAnchors || getUseCaseEdgeSides(edge, sourceLayout, targetLayout, nodesById, direction);
    return { edge, index, sourceLayout, targetLayout, renderedEdge, ...sides };
  }).filter((value): value is UseCaseRoutePlan => Boolean(value));
  const endpointSlots = buildEndpointSlots(routePlan);
  const routes = new Map<string, UseCaseEdgeRoute>();

  routePlan.forEach((plan) => {
    const sourceFraction = plan.sourceFraction || endpointSlots.get(`${plan.edge.id}:source`) || 0.5;
    const targetFraction = plan.targetFraction || endpointSlots.get(`${plan.edge.id}:target`) || 0.5;
    const renderedWaypoints = plan.renderedEdge ? getRenderedUseCaseWaypoints(plan.renderedEdge) : [];
    const detourWaypoints = renderedWaypoints.length === 0
      ? getUseCaseObstacleDetour(
          plan.edge,
          plan.sourceLayout,
          plan.targetLayout,
          plan.sourceSide,
          sourceFraction,
          plan.targetSide,
          targetFraction,
          layoutById,
          nodesById
        )
      : [];
    const style = buildUseCaseEdgeStyle(
      plan.edge,
      plan.sourceSide,
      sourceFraction,
      plan.targetSide,
      targetFraction,
      Boolean(plan.renderedEdge),
      detourWaypoints.length > 0
    );
    routes.set(plan.edge.id, {
      style,
      waypoints: detourWaypoints.length > 0 ? detourWaypoints : renderedWaypoints,
      sourceSide: plan.sourceSide,
      targetSide: plan.targetSide,
      labelPosition: plan.renderedEdge ? getRenderedUseCaseLabelPosition(plan.renderedEdge, plan.edge.label || '') : undefined,
    });
  });

  return routes;
}

function addUseCaseEdges(
  builder: DrawioXmlBuilder,
  edges: UseCaseEdge[],
  edgeRoutes: Map<string, UseCaseEdgeRoute>,
  layoutById: Map<string, ClassLayout>
) {
  edges.forEach((edge, index) => {
    const edgeId = edge.id || `edge-${index}`;
    const route = edgeRoutes.get(edgeId);
    if (!route) {
      return;
    }

    builder.addEdge(edgeId, edge.source, edge.target, '', route.style, route.waypoints);
  });

  edges.forEach((edge, index) => {
    const edgeId = edge.id || `edge-${index}`;
    const route = edgeRoutes.get(edgeId);
    if (!route) {
      return;
    }
    if (!edge.label?.trim()) {
      return;
    }

    const labelBounds = getUseCaseEdgeLabelBounds(
      edge.label,
      route.labelPosition || estimateUseCaseEdgeLabelPosition(edge, layoutById, route)
    );
    builder.addVertex(
      `${edgeId}-label`,
      edge.label,
      labelBounds.x,
      labelBounds.y,
      labelBounds.width,
      labelBounds.height,
      EDGE_LABEL_TEXT_STYLE
    );
  });
}

function findUseCaseRenderEdge(renderEdges: LayoutHintEdge[], edge: UseCaseEdge) {
  return renderEdges.find((candidate) => {
    if (!candidate.id) {
      return false;
    }
    const normalizedId = normalizeUseCaseEdgeId(candidate.id);
    const source = normalizeUseCaseEdgeId(edge.source);
    const target = normalizeUseCaseEdgeId(edge.target);
    return normalizedId.includes(source) && normalizedId.includes(target);
  });
}

function normalizeUseCaseEdgeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getRenderedUseCaseWaypoints(edge: LayoutHintEdge) {
  // PlantUML SVG paths are often cubic curves. Sampling them as draw.io bend
  // points creates jagged editable connectors, so use the rendered path only
  // for endpoint/label hints and let draw.io draw a clean segment.
  void edge;
  return [];
}

function getRenderedUseCaseAnchors(
  edge: LayoutHintEdge,
  sourceLayout: ClassLayout,
  targetLayout: ClassLayout
) {
  if (!edge.sourcePoint || !edge.targetPoint) {
    return undefined;
  }

  const source = getNearestUseCaseSide(sourceLayout, edge.sourcePoint);
  const target = getNearestUseCaseSide(targetLayout, edge.targetPoint);
  return {
    sourceSide: source.side,
    sourceFraction: source.fraction,
    targetSide: target.side,
    targetFraction: target.fraction,
  };
}

function getNearestUseCaseSide(layout: ClassLayout, point: Point) {
  const candidates: Array<{ side: UseCaseSide; fraction: number; distance: number }> = [
    {
      side: 'left',
      fraction: clampUseCaseFraction((point.y - layout.y) / layout.height),
      distance: Math.abs(point.x - layout.x),
    },
    {
      side: 'right',
      fraction: clampUseCaseFraction((point.y - layout.y) / layout.height),
      distance: Math.abs(point.x - (layout.x + layout.width)),
    },
    {
      side: 'top',
      fraction: clampUseCaseFraction((point.x - layout.x) / layout.width),
      distance: Math.abs(point.y - layout.y),
    },
    {
      side: 'bottom',
      fraction: clampUseCaseFraction((point.x - layout.x) / layout.width),
      distance: Math.abs(point.y - (layout.y + layout.height)),
    },
  ];
  return candidates.sort((left, right) => left.distance - right.distance)[0];
}

function getUseCaseObstacleDetour(
  edge: UseCaseEdge,
  sourceLayout: ClassLayout,
  targetLayout: ClassLayout,
  sourceSide: UseCaseSide,
  sourceFraction: number,
  targetSide: UseCaseSide,
  targetFraction: number,
  layoutById: Map<string, ClassLayout>,
  nodesById: Map<string, UseCaseNode>
) {
  if (edge.type === 'generalization' || edge.type === 'realization') {
    return [];
  }

  const source = getUseCaseAnchorPoint(sourceLayout, sourceSide, sourceFraction);
  const target = getUseCaseAnchorPoint(targetLayout, targetSide, targetFraction);
  const obstacle = getFirstUseCaseObstacle(edge, source, target, layoutById, nodesById);
  if (!obstacle) {
    return [];
  }

  return [getUseCaseDetourPoint(source, target, obstacle)];
}

function getFirstUseCaseObstacle(
  edge: UseCaseEdge,
  source: Point,
  target: Point,
  layoutById: Map<string, ClassLayout>,
  nodesById: Map<string, UseCaseNode>
) {
  const candidates: Array<{ layout: ClassLayout; projection: number }> = [];
  nodesById.forEach((node) => {
    if (node.id === edge.source || node.id === edge.target) {
      return;
    }
    if (node.type !== 'actor' && node.type !== 'usecase' && node.type !== 'note') {
      return;
    }

    const layout = layoutById.get(node.id);
    if (!layout) {
      return;
    }

    const expanded = expandUseCaseObstacle(layout, EDGE_OBSTACLE_CLEARANCE);
    if (!lineIntersectsRect(source, target, expanded)) {
      return;
    }

    candidates.push({
      layout: expanded,
      projection: getUseCaseProjection(source, target, getUseCaseRectCenter(expanded)),
    });
  });

  return candidates
    .filter((candidate) => candidate.projection > 0.05 && candidate.projection < 0.95)
    .sort((left, right) => left.projection - right.projection)[0]?.layout;
}

function getUseCaseDetourPoint(source: Point, target: Point, obstacle: ClassLayout) {
  const horizontal = Math.abs(target.x - source.x) >= Math.abs(target.y - source.y);
  const center = getUseCaseRectCenter(obstacle);
  if (horizontal) {
    const lineY = source.y + (target.y - source.y) * getUseCaseProjection(source, target, { x: center.x, y: source.y });
    return {
      x: snapUseCasePoint(center.x),
      y: snapUseCasePoint(lineY <= center.y ? obstacle.y - EDGE_OBSTACLE_CLEARANCE : obstacle.y + obstacle.height + EDGE_OBSTACLE_CLEARANCE),
    };
  }

  const lineX = source.x + (target.x - source.x) * getUseCaseProjection(source, target, { x: source.x, y: center.y });
  return {
    x: snapUseCasePoint(lineX <= center.x ? obstacle.x - EDGE_OBSTACLE_CLEARANCE : obstacle.x + obstacle.width + EDGE_OBSTACLE_CLEARANCE),
    y: snapUseCasePoint(center.y),
  };
}

function getUseCaseAnchorPoint(layout: ClassLayout, side: UseCaseSide, fraction: number) {
  const anchor = getUseCaseAnchorFractions(side, fraction);
  return {
    x: layout.x + layout.width * anchor.x,
    y: layout.y + layout.height * anchor.y,
  };
}

function expandUseCaseObstacle(layout: ClassLayout, padding: number): ClassLayout {
  return {
    ...layout,
    x: layout.x - padding,
    y: layout.y - padding,
    width: layout.width + padding * 2,
    height: layout.height + padding * 2,
  };
}

function getUseCaseRectCenter(layout: ClassLayout) {
  return {
    x: layout.x + layout.width / 2,
    y: layout.y + layout.height / 2,
  };
}

function getUseCaseProjection(source: Point, target: Point, point: Point) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return 0;
  }
  return ((point.x - source.x) * dx + (point.y - source.y) * dy) / lengthSquared;
}

function lineIntersectsRect(source: Point, target: Point, rect: ClassLayout) {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  if (pointInUseCaseRect(source, left, right, top, bottom) || pointInUseCaseRect(target, left, right, top, bottom)) {
    return true;
  }

  return segmentsIntersect(source, target, { x: left, y: top }, { x: right, y: top })
    || segmentsIntersect(source, target, { x: right, y: top }, { x: right, y: bottom })
    || segmentsIntersect(source, target, { x: right, y: bottom }, { x: left, y: bottom })
    || segmentsIntersect(source, target, { x: left, y: bottom }, { x: left, y: top });
}

function pointInUseCaseRect(point: Point, left: number, right: number, top: number, bottom: number) {
  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const ccw = (first: Point, second: Point, third: Point) =>
    (third.y - first.y) * (second.x - first.x) > (second.y - first.y) * (third.x - first.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function clampUseCaseFraction(value: number) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0.08, Math.min(0.92, value));
}

function getRenderedUseCaseLabelPosition(edge: LayoutHintEdge, label: string) {
  if (!label.trim() || !edge.labelPosition) {
    return undefined;
  }

  const normalizedLabel = normalizeUseCaseLabel(label);
  if (edge.label && normalizeUseCaseLabel(edge.label) !== normalizedLabel) {
    return undefined;
  }

  return {
    x: snapUseCasePoint(edge.labelPosition.x),
    y: snapUseCasePoint(edge.labelPosition.y - 6),
  };
}

function normalizeUseCaseLabel(value: string) {
  return value.toLowerCase().replace(/[«»<>]/g, '').replace(/[^a-z0-9]+/g, '');
}

function estimateUseCaseEdgeLabelPosition(
  edge: UseCaseEdge,
  layoutById: Map<string, ClassLayout>,
  route?: Pick<UseCaseEdgeRoute, 'sourceSide' | 'targetSide'>
) {
  const sourceLayout = layoutById.get(edge.source);
  const targetLayout = layoutById.get(edge.target);
  if (!sourceLayout || !targetLayout) {
    return { x: 0, y: 0 };
  }

  const sourcePoint = route ? getUseCaseSideCenter(sourceLayout, route.sourceSide) : { x: sourceLayout.centerX, y: sourceLayout.centerY };
  const targetPoint = route ? getUseCaseSideCenter(targetLayout, route.targetSide) : { x: targetLayout.centerX, y: targetLayout.centerY };
  const deltaX = targetPoint.x - sourcePoint.x;
  const deltaY = targetPoint.y - sourcePoint.y;
  const centerX = sourcePoint.x + deltaX * 0.5;
  const centerY = sourcePoint.y + deltaY * 0.5;
  const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);

  if (edge.type === 'dependency') {
    return horizontal
      ? {
          x: snapUseCasePoint(centerX),
          y: snapUseCasePoint(centerY - 18),
        }
      : {
          x: snapUseCasePoint(centerX + 22),
          y: snapUseCasePoint(centerY),
        };
  }

  const length = Math.hypot(deltaX, deltaY) || 1;
  return {
    x: snapUseCasePoint(centerX + (deltaY / length) * 14),
    y: snapUseCasePoint(centerY + (-deltaX / length) * 14),
  };
}

function getUseCaseSideCenter(layout: ClassLayout, side: UseCaseSide) {
  switch (side) {
    case 'left':
      return { x: layout.x, y: layout.centerY };
    case 'right':
      return { x: layout.x + layout.width, y: layout.centerY };
    case 'top':
      return { x: layout.centerX, y: layout.y };
    case 'bottom':
    default:
      return { x: layout.centerX, y: layout.y + layout.height };
  }
}

function getUseCaseEdgeLabelBounds(label: string, center: Point) {
  const lines = label.split('\n');
  const width = Math.min(180, Math.max(42, Math.max(...lines.map((line) => line.length)) * 7 + 14));
  const height = Math.max(18, lines.length * 16 + 4);
  return {
    x: snapUseCasePoint(center.x - width / 2),
    y: snapUseCasePoint(center.y - height / 2),
    width,
    height,
  };
}

function buildEndpointSlots(routePlan: Array<{
  edge: UseCaseEdge;
  sourceSide: UseCaseSide;
  targetSide: UseCaseSide;
}>) {
  const groups = new Map<string, Array<{ edgeId: string; end: 'source' | 'target' }>>();
  routePlan.forEach((plan) => {
    const sourceKey = `${plan.edge.source}:${plan.sourceSide}`;
    const targetKey = `${plan.edge.target}:${plan.targetSide}`;
    groups.set(sourceKey, [...(groups.get(sourceKey) || []), { edgeId: plan.edge.id, end: 'source' }]);
    groups.set(targetKey, [...(groups.get(targetKey) || []), { edgeId: plan.edge.id, end: 'target' }]);
  });

  const slots = new Map<string, number>();
  groups.forEach((group) => {
    group.forEach((endpoint, index) => {
      const fraction = group.length === 1
        ? 0.5
        : Math.max(0.2, Math.min(0.8, (index + 1) / (group.length + 1)));
      slots.set(`${endpoint.edgeId}:${endpoint.end}`, fraction);
    });
  });
  return slots;
}

function getUseCaseEdgeSides(
  edge: UseCaseEdge,
  sourceLayout: ClassLayout,
  targetLayout: ClassLayout,
  nodesById: Map<string, UseCaseNode>,
  _direction: UmlDirection
) {
  const sourceNode = nodesById.get(edge.source);
  const targetNode = nodesById.get(edge.target);
  if (sourceNode?.type === 'actor' && targetNode?.type === 'actor') {
    const leftLane = Math.min(sourceLayout.centerX, targetLayout.centerX) <= Math.max(sourceLayout.centerX, targetLayout.centerX);
    const side = leftLane && (sourceLayout.centerX + targetLayout.centerX) / 2 < 500 ? 'left' : 'right';
    return {
      sourceSide: side as UseCaseSide,
      targetSide: side as UseCaseSide,
    };
  }

  if (edge.directionHint) {
    return getHintedUseCaseSides(edge.directionHint);
  }

  const horizontal = Math.abs(targetLayout.centerX - sourceLayout.centerX) >= Math.abs(targetLayout.centerY - sourceLayout.centerY);
  if (horizontal) {
    return targetLayout.centerX >= sourceLayout.centerX
      ? { sourceSide: 'right' as UseCaseSide, targetSide: 'left' as UseCaseSide }
      : { sourceSide: 'left' as UseCaseSide, targetSide: 'right' as UseCaseSide };
  }

  return targetLayout.centerY >= sourceLayout.centerY
    ? { sourceSide: 'bottom' as UseCaseSide, targetSide: 'top' as UseCaseSide }
    : { sourceSide: 'top' as UseCaseSide, targetSide: 'bottom' as UseCaseSide };
}

function getHintedUseCaseSides(hint: NonNullable<UseCaseEdge['directionHint']>) {
  switch (hint) {
    case 'left':
      return { sourceSide: 'left' as UseCaseSide, targetSide: 'right' as UseCaseSide };
    case 'right':
      return { sourceSide: 'right' as UseCaseSide, targetSide: 'left' as UseCaseSide };
    case 'up':
      return { sourceSide: 'top' as UseCaseSide, targetSide: 'bottom' as UseCaseSide };
    case 'down':
    default:
      return { sourceSide: 'bottom' as UseCaseSide, targetSide: 'top' as UseCaseSide };
  }
}

function buildUseCaseEdgeStyle(
  edge: UseCaseEdge,
  sourceSide: UseCaseSide,
  sourceFraction: number,
  targetSide: UseCaseSide,
  targetFraction: number,
  hasRenderedRoute = false,
  hasObstacleDetour = false
) {
  const baseStyle = UML_EDGE_STYLES[edge.type as keyof typeof UML_EDGE_STYLES] || UML_EDGE_STYLES.association;
  return [
    baseStyle,
    hasObstacleDetour ? DETOUR_EDGE_ROUTE_STYLE : hasRenderedRoute ? RENDERED_EDGE_ROUTE_STYLE : EDGE_LABEL_STYLE,
    buildUseCaseEndpointStyle('exit', sourceSide, sourceFraction),
    buildUseCaseEndpointStyle('entry', targetSide, targetFraction),
  ].join('');
}

function buildUseCaseEndpointStyle(prefix: 'exit' | 'entry', side: UseCaseSide, fraction: number) {
  const anchor = getUseCaseAnchorFractions(side, fraction);
  return `${prefix}X=${anchor.x};${prefix}Y=${anchor.y};${prefix}Dx=0;${prefix}Dy=0;${prefix}Perimeter=1;`;
}

function getUseCaseAnchorFractions(side: UseCaseSide, fraction: number) {
  switch (side) {
    case 'left':
      return { x: 0, y: fraction };
    case 'right':
      return { x: 1, y: fraction };
    case 'top':
      return { x: fraction, y: 0 };
    case 'bottom':
    default:
      return { x: fraction, y: 1 };
  }
}

function snapUseCasePoint(value: number) {
  return Math.round(value / 10) * 10;
}

function getUseCaseNodeStyle(node: UseCaseNode) {
  if (node.type === 'actor') {
    return getDrawioNodeStyle('uml.actor');
  }
  if (node.type === 'note') {
    return getDrawioNodeStyle('uml.note');
  }
  return getDrawioNodeStyle('component.usecase');
}

function setLayout(
  layout: Map<string, ClassLayout>,
  id: string,
  x: number,
  y: number,
  size: { width: number; height: number; titleHeight: number }
) {
  layout.set(id, {
    ...size,
    x,
    y,
    centerX: x + size.width / 2,
    centerY: y + size.height / 2,
  });
}

function estimateUseCaseNodeSize(node: ASTNode) {
  const lines = node.label.split('\n');
  const longest = Math.max(...lines.map((line) => line.length), 8);
  if (node.type === 'actor') {
    return {
      width: ACTOR_WIDTH,
      height: ACTOR_HEIGHT,
      titleHeight: ACTOR_HEIGHT,
    };
  }
  if (node.type === 'note') {
    return {
      width: Math.max(150, Math.min(300, longest * 7 + 34)),
      height: Math.max(70, 36 + lines.length * 18),
      titleHeight: 70,
    };
  }
  return {
    width: Math.max(170, Math.min(320, longest * 8 + 46)),
    height: Math.max(76, 46 + lines.length * 18),
    titleHeight: 76,
  };
}

function calculateUseCaseContainerBounds(
  containers: ASTNode[],
  leaves: ASTNode[],
  leafLayouts: Map<string, ClassLayout>,
  renderNodes: LayoutHintNode[] = []
) {
  const bounds = new Map<string, { x: number; y: number; width: number; height: number }>();
  const leafParents = new Map(leaves.map((leaf) => [leaf.id, leaf.parentId]));
  const depths = [...containers].sort(
    (left, right) => getContainerDepth(right, containers) - getContainerDepth(left, containers)
  );

  depths.forEach((container) => {
    const rendered = findUseCaseRenderHintNode(renderNodes, container.id, container.label);
    const childLeafBounds = Array.from(leafLayouts.entries())
      .filter(([id]) => {
        const leafParent = leafParents.get(id);
        return leafParent === container.id;
      })
      .map(([, layout]) => ({
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
      }));
    const childContainerBounds = containers
      .filter((candidate) => candidate.parentId === container.id)
      .map((candidate) => bounds.get(candidate.id))
      .filter((value): value is { x: number; y: number; width: number; height: number } => Boolean(value));
    const children = [...childLeafBounds, ...childContainerBounds];
    if (rendered && children.length > 0) {
      const minChildX = Math.min(...children.map((child) => child.x));
      const minChildY = Math.min(...children.map((child) => child.y));
      const renderedCenterX = rendered.x + rendered.width / 2;
      const renderedCenterY = rendered.y + rendered.height / 2;
      const childCenterX = (Math.min(...children.map((child) => child.x)) + Math.max(...children.map((child) => child.x + child.width))) / 2;
      const childCenterY = (Math.min(...children.map((child) => child.y)) + Math.max(...children.map((child) => child.y + child.height))) / 2;
      const x = Math.min(minChildX - CONTAINER_PADDING_X, renderedCenterX - childCenterX + minChildX - CONTAINER_PADDING_X);
      const y = Math.min(minChildY - CONTAINER_PADDING_TOP, renderedCenterY - childCenterY + minChildY - CONTAINER_PADDING_TOP);
      bounds.set(container.id, {
        x,
        y,
        width: Math.max(rendered.width, Math.max(...children.map((child) => child.x + child.width)) - x + CONTAINER_PADDING_X),
        height: Math.max(rendered.height, Math.max(...children.map((child) => child.y + child.height)) - y + CONTAINER_PADDING_BOTTOM),
      });
      return;
    }
    if (children.length === 0) {
      const parent = container.parentId ? bounds.get(container.parentId) : undefined;
      bounds.set(container.id, {
        x: rendered ? rendered.x : parent ? parent.x + 24 : 260,
        y: rendered ? rendered.y : parent ? parent.y + 48 : 40,
        width: rendered ? Math.max(260, rendered.width) : 260,
        height: rendered ? Math.max(170, rendered.height) : 170,
      });
      return;
    }
    const minX = Math.min(...children.map((child) => child.x));
    const minY = Math.min(...children.map((child) => child.y));
    const maxX = Math.max(...children.map((child) => child.x + child.width));
    const maxY = Math.max(...children.map((child) => child.y + child.height));
    bounds.set(container.id, {
      x: minX - CONTAINER_PADDING_X,
      y: minY - CONTAINER_PADDING_TOP,
      width: maxX - minX + CONTAINER_PADDING_X * 2,
      height: maxY - minY + CONTAINER_PADDING_TOP + CONTAINER_PADDING_BOTTOM,
    });
  });

  return bounds;
}

function getContainerDepth(node: ASTNode, containers: ASTNode[]) {
  const byId = new Map(containers.map((container) => [container.id, container]));
  let depth = 0;
  let current = node.parentId ? byId.get(node.parentId) : undefined;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return depth;
}

function formatNodeLabel(label: string, annotations: string[] = []) {
  return [...annotations.map(formatUmlAnnotation), label].filter(Boolean).join('\n');
}
