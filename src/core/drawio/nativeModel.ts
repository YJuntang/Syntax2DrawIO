import { DrawioXmlBuilder, Point } from './builder';

export interface NativeDiagramNode {
  id: string;
  label: string;
  style: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  isContainer?: boolean;
}

export interface NativeDiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style: string;
  waypoints?: Point[];
}

export interface NativeDiagramModel {
  nodes: NativeDiagramNode[];
  edges: NativeDiagramEdge[];
}

export function renderNativeDiagramModel(model: NativeDiagramModel) {
  const builder = new DrawioXmlBuilder();

  model.nodes
    .filter((node) => node.isContainer)
    .forEach((node) => {
      builder.addContainer(
        node.id,
        node.label,
        node.x,
        node.y,
        node.width,
        node.height,
        node.style,
        node.parentId || '1'
      );
    });

  model.nodes
    .filter((node) => !node.isContainer)
    .forEach((node) => {
      if (node.parentId) {
        builder.addChildVertex(node.id, node.label, node.parentId, node.width, node.height, node.style, {
          x: node.x,
          y: node.y,
        });
        return;
      }

      builder.addVertex(node.id, node.label, node.x, node.y, node.width, node.height, node.style);
    });

  model.edges.forEach((edge) => {
    builder.addEdge(edge.id, edge.source, edge.target, edge.label || '', edge.style, edge.waypoints || []);
  });

  return builder.toXml();
}
