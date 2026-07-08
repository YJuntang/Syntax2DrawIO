export type DrawioNodeKind =
  | 'default'
  | 'flow.rect'
  | 'flow.rounded'
  | 'flow.stadium'
  | 'flow.subroutine'
  | 'flow.cylinder'
  | 'flow.circle'
  | 'flow.doubleCircle'
  | 'flow.diamond'
  | 'flow.hexagon'
  | 'flow.parallelogram'
  | 'flow.parallelogramAlt'
  | 'flow.trapezoid'
  | 'flow.trapezoidAlt'
  | 'flow.document'
  | 'flow.documents'
  | 'flow.manualInput'
  | 'flow.delay'
  | 'flow.fork'
  | 'flow.join'
  | 'flow.subgraph'
  | 'uml.class'
  | 'uml.abstractClass'
  | 'uml.interface'
  | 'uml.enum'
  | 'uml.actor'
  | 'uml.lifeline'
  | 'uml.state'
  | 'uml.startState'
  | 'uml.endState'
  | 'uml.frame'
  | 'uml.note'
  | 'uml.package'
  | 'uml.folder'
  | 'component.component'
  | 'component.interface'
  | 'component.package'
  | 'component.folder'
  | 'component.node'
  | 'component.cloud'
  | 'component.database'
  | 'component.queue'
  | 'component.usecase'
  | 'er.entity'
  | 'er.attribute';

export type DrawioEdgeKind =
  | 'default'
  | 'flow.normal'
  | 'flow.dotted'
  | 'flow.thick'
  | 'flow.open'
  | 'flow.none'
  | 'flow.both'
  | 'flow.cross'
  | 'flow.circle'
  | 'uml.association'
  | 'uml.directedAssociation'
  | 'uml.dependency'
  | 'uml.generalization'
  | 'uml.realization'
  | 'uml.aggregation'
  | 'uml.composition'
  | 'er.zeroOrOne'
  | 'er.zeroOrMore'
  | 'er.one'
  | 'er.oneOrMore';

export interface DrawioShapeRegistry {
  nodes: Record<DrawioNodeKind, string>;
  edges: Record<DrawioEdgeKind, string>;
  mermaidShapeAliases: Record<string, DrawioNodeKind>;
  mermaidEdgeAliases: Record<string, DrawioEdgeKind>;
}

const DEFAULT_VERTEX_STYLE = 'rounded=0;whiteSpace=wrap;html=1;';
const DEFAULT_EDGE_STYLE = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;';

export const DRAWIO_SHAPE_REGISTRY: DrawioShapeRegistry = {
  nodes: {
    default: DEFAULT_VERTEX_STYLE,
    'flow.rect': DEFAULT_VERTEX_STYLE,
    'flow.rounded': 'rounded=1;whiteSpace=wrap;html=1;',
    'flow.stadium': 'rounded=1;whiteSpace=wrap;html=1;arcSize=50;',
    'flow.subroutine': 'shape=process;whiteSpace=wrap;html=1;',
    'flow.cylinder': 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;size=15;',
    'flow.circle': 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;',
    'flow.doubleCircle': 'ellipse;shape=doubleEllipse;whiteSpace=wrap;html=1;aspect=fixed;',
    'flow.diamond': 'rhombus;whiteSpace=wrap;html=1;',
    'flow.hexagon': 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;',
    'flow.parallelogram': 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;',
    'flow.parallelogramAlt': 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;direction=south;',
    'flow.trapezoid': 'shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;',
    'flow.trapezoidAlt': 'shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;direction=south;',
    'flow.document': 'shape=document;whiteSpace=wrap;html=1;boundedLbl=1;',
    'flow.documents': 'shape=documents;whiteSpace=wrap;html=1;',
    'flow.manualInput': 'shape=manualInput;whiteSpace=wrap;html=1;',
    'flow.delay': 'shape=delay;whiteSpace=wrap;html=1;',
    'flow.fork': 'rounded=0;whiteSpace=wrap;html=1;fillColor=#111827;strokeColor=#111827;fontColor=#ffffff;',
    'flow.join': 'rounded=0;whiteSpace=wrap;html=1;fillColor=#111827;strokeColor=#111827;fontColor=#ffffff;',
    'flow.subgraph': 'rounded=1;whiteSpace=wrap;html=1;container=1;collapsible=0;recursiveResize=0;strokeColor=#94a3b8;fillColor=none;',
    'uml.class': 'shape=umlClass;verticalAlign=top;align=left;spacing=8;spacingTop=10;spacingLeft=10;spacingRight=10;fontSize=13;whiteSpace=wrap;html=1;',
    'uml.abstractClass': 'shape=umlClass;verticalAlign=top;align=left;spacing=8;spacingTop=10;spacingLeft=10;spacingRight=10;fontSize=13;fontStyle=2;whiteSpace=wrap;html=1;',
    'uml.interface': 'shape=umlClass;verticalAlign=top;align=left;spacing=8;spacingTop=10;spacingLeft=10;spacingRight=10;fontSize=13;whiteSpace=wrap;html=1;',
    'uml.enum': 'shape=umlClass;verticalAlign=top;align=left;spacing=8;spacingTop=10;spacingLeft=10;spacingRight=10;fontSize=13;whiteSpace=wrap;html=1;',
    'uml.actor': 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;',
    'uml.lifeline': 'shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=1;collapsible=0;recursiveResize=0;outlineConnect=0;',
    'uml.state': 'shape=umlState;rounded=1;arcSize=40;whiteSpace=wrap;html=1;',
    'uml.startState': 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;',
    'uml.endState': 'ellipse;shape=doubleEllipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#000000;strokeColor=#000000;',
    'uml.frame': 'shape=umlFrame;whiteSpace=wrap;html=1;container=1;',
    'uml.note': 'shape=note;whiteSpace=wrap;html=1;size=14;verticalAlign=top;align=left;spacingTop=-6;',
    'uml.package': 'shape=folder;fontStyle=1;tabWidth=64;tabHeight=20;tabPosition=left;html=1;whiteSpace=wrap;container=1;collapsible=0;recursiveResize=0;',
    'uml.folder': 'shape=folder;tabWidth=64;tabHeight=20;tabPosition=left;html=1;whiteSpace=wrap;container=1;collapsible=0;recursiveResize=0;',
    'component.component': 'shape=component;whiteSpace=wrap;html=1;',
    'component.interface': 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;',
    'component.package': 'shape=folder;fontStyle=1;tabWidth=64;tabHeight=20;tabPosition=left;html=1;whiteSpace=wrap;container=1;collapsible=0;recursiveResize=0;',
    'component.folder': 'shape=folder;tabWidth=64;tabHeight=20;tabPosition=left;html=1;whiteSpace=wrap;container=1;collapsible=0;recursiveResize=0;',
    'component.node': 'shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;',
    'component.cloud': 'ellipse;shape=cloud;whiteSpace=wrap;html=1;',
    'component.database': 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;size=15;',
    'component.queue': 'shape=internalStorage;whiteSpace=wrap;html=1;',
    'component.usecase': 'ellipse;whiteSpace=wrap;html=1;',
    'er.entity': 'swimlane;horizontal=1;startSize=30;container=1;collapsible=0;recursiveResize=0;whiteSpace=wrap;html=1;fontStyle=1;align=center;fillColor=#f5f3ff;strokeColor=#8b5cf6;',
    'er.attribute': 'text;strokeColor=none;fillColor=none;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacingLeft=8;',
  },
  edges: {
    default: DEFAULT_EDGE_STYLE,
    'flow.normal': 'endArrow=classic;html=1;',
    'flow.dotted': 'endArrow=classic;dashed=1;html=1;',
    'flow.thick': 'endArrow=classic;strokeWidth=2;html=1;',
    'flow.open': 'endArrow=open;html=1;',
    'flow.none': 'endArrow=none;html=1;',
    'flow.both': 'startArrow=classic;endArrow=classic;html=1;',
    'flow.cross': 'endArrow=cross;html=1;',
    'flow.circle': 'endArrow=oval;endFill=0;html=1;',
    'uml.association': 'endArrow=none;html=1;',
    'uml.directedAssociation': 'endArrow=open;endFill=0;html=1;',
    'uml.dependency': 'endArrow=open;endFill=0;dashed=1;html=1;',
    'uml.generalization': 'endArrow=block;endFill=0;html=1;',
    'uml.realization': 'endArrow=block;endFill=0;dashed=1;html=1;',
    'uml.aggregation': 'endArrow=diamond;endFill=0;html=1;',
    'uml.composition': 'endArrow=diamond;endFill=1;html=1;',
    'er.zeroOrOne': 'ERzeroToOne',
    'er.zeroOrMore': 'ERzeroToMany',
    'er.one': 'ERmandOne',
    'er.oneOrMore': 'ERoneToMany',
  },
  mermaidShapeAliases: {
    rect: 'flow.rect',
    rounded_rect: 'flow.rounded',
    stadium: 'flow.stadium',
    subroutine: 'flow.subroutine',
    cylinder: 'flow.cylinder',
    database: 'flow.cylinder',
    circle: 'flow.circle',
    diamond: 'flow.diamond',
    hexagon: 'flow.hexagon',
    parallelogram: 'flow.parallelogram',
    parallelogram_alt: 'flow.parallelogramAlt',
    trapezoid: 'flow.trapezoid',
    trapezoid_alt: 'flow.trapezoidAlt',
    double_circle: 'flow.doubleCircle',
    doc: 'flow.document',
    document: 'flow.document',
    docs: 'flow.documents',
    documents: 'flow.documents',
    manual_input: 'flow.manualInput',
    delay: 'flow.delay',
    fork: 'flow.fork',
    join: 'flow.join',
    default: 'default',
  },
  mermaidEdgeAliases: {
    normal: 'flow.normal',
    dotted: 'flow.dotted',
    thick: 'flow.thick',
    open: 'flow.open',
    none: 'flow.none',
    both: 'flow.both',
    cross: 'flow.cross',
    circle: 'flow.circle',
  },
};

export function getDrawioNodeStyle(kind: DrawioNodeKind, fallback = DEFAULT_VERTEX_STYLE) {
  return DRAWIO_SHAPE_REGISTRY.nodes[kind] || fallback;
}

export function getDrawioEdgeStyle(kind: DrawioEdgeKind, fallback = DEFAULT_EDGE_STYLE) {
  return DRAWIO_SHAPE_REGISTRY.edges[kind] || fallback;
}

export function getMermaidNodeStyle(shape: string | undefined, fallback = DEFAULT_VERTEX_STYLE) {
  const kind = DRAWIO_SHAPE_REGISTRY.mermaidShapeAliases[shape || 'default'];
  return kind ? getDrawioNodeStyle(kind, fallback) : fallback;
}

export function getMermaidEdgeStyle(type: string | undefined, fallback = DRAWIO_SHAPE_REGISTRY.edges['flow.normal']) {
  const kind = DRAWIO_SHAPE_REGISTRY.mermaidEdgeAliases[type || 'normal'];
  return kind ? getDrawioEdgeStyle(kind, fallback) : fallback;
}

export function getMermaidShapeStyleMap() {
  return Object.fromEntries(
    Object.entries(DRAWIO_SHAPE_REGISTRY.mermaidShapeAliases).map(([alias, kind]) => [
      alias,
      getDrawioNodeStyle(kind),
    ])
  ) as Record<string, string>;
}

export function getMermaidEdgeStyleMap() {
  return Object.fromEntries(
    Object.entries(DRAWIO_SHAPE_REGISTRY.mermaidEdgeAliases).map(([alias, kind]) => [
      alias,
      getDrawioEdgeStyle(kind),
    ])
  ) as Record<string, string>;
}
