import {
  DRAWIO_SHAPE_REGISTRY,
  getMermaidEdgeStyleMap,
  getMermaidShapeStyleMap,
} from './shapeRegistry';

export const DEFAULT_VERTEX_STYLE = DRAWIO_SHAPE_REGISTRY.nodes.default;
export const DEFAULT_EDGE_STYLE = DRAWIO_SHAPE_REGISTRY.edges.default;

export const MERMAID_SHAPE_MAP: Record<string, string> = getMermaidShapeStyleMap();
export const MERMAID_EDGE_MAP: Record<string, string> = getMermaidEdgeStyleMap();

export const UML_STYLES = {
  class: DRAWIO_SHAPE_REGISTRY.nodes['uml.class'],
  abstractClass: DRAWIO_SHAPE_REGISTRY.nodes['uml.abstractClass'],
  interface: DRAWIO_SHAPE_REGISTRY.nodes['uml.interface'],
  enum: DRAWIO_SHAPE_REGISTRY.nodes['uml.enum'],
  actor: DRAWIO_SHAPE_REGISTRY.nodes['uml.actor'],
  lifeline: DRAWIO_SHAPE_REGISTRY.nodes['uml.lifeline'],
  state: DRAWIO_SHAPE_REGISTRY.nodes['uml.state'],
  startState: DRAWIO_SHAPE_REGISTRY.nodes['uml.startState'],
  endState: DRAWIO_SHAPE_REGISTRY.nodes['uml.endState'],
  frame: DRAWIO_SHAPE_REGISTRY.nodes['uml.frame'],
  note: DRAWIO_SHAPE_REGISTRY.nodes['uml.note'],
  package: DRAWIO_SHAPE_REGISTRY.nodes['uml.package'],
  folder: DRAWIO_SHAPE_REGISTRY.nodes['uml.folder'],
};

export const UML_EDGE_STYLES = {
  association: DRAWIO_SHAPE_REGISTRY.edges['uml.association'],
  directedAssociation: DRAWIO_SHAPE_REGISTRY.edges['uml.directedAssociation'],
  dependency: DRAWIO_SHAPE_REGISTRY.edges['uml.dependency'],
  generalization: DRAWIO_SHAPE_REGISTRY.edges['uml.generalization'],
  realization: DRAWIO_SHAPE_REGISTRY.edges['uml.realization'],
  aggregation: DRAWIO_SHAPE_REGISTRY.edges['uml.aggregation'],
  composition: DRAWIO_SHAPE_REGISTRY.edges['uml.composition'],
};
