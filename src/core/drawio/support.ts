export interface DrawioSupportRegion {
  id: string;
  label: string;
  kind: 'native' | 'fallback';
  reason?: string;
}

export interface DrawioSupportAnalysis {
  supportedFeatures: string[];
  partialFeatures: string[];
  fallbackRegions: DrawioSupportRegion[];
}

export type DrawioSupportLevel = 'native high fidelity' | 'native basic' | 'partial' | 'visual fallback';

export interface DrawioSupportMatrixRow {
  family: string;
  feature: string;
  level: DrawioSupportLevel;
  kind: 'mermaid' | 'plantuml';
  subtypes: string[];
}

export const EMPTY_SUPPORT_ANALYSIS: DrawioSupportAnalysis = {
  supportedFeatures: [],
  partialFeatures: [],
  fallbackRegions: [],
};

export const DRAWIO_SUPPORT_MATRIX: DrawioSupportMatrixRow[] = [
  { kind: 'mermaid', subtypes: ['flowchart'], family: 'Mermaid Flowchart', feature: 'nodes, edges, subgraphs', level: 'native high fidelity' },
  { kind: 'mermaid', subtypes: ['flowchart'], family: 'Mermaid Flowchart', feature: 'classDef/style/linkStyle basics', level: 'native basic' },
  { kind: 'mermaid', subtypes: ['sequenceDiagram'], family: 'Mermaid Sequence', feature: 'participants, messages, notes, groups, activations', level: 'native high fidelity' },
  { kind: 'mermaid', subtypes: ['sequenceDiagram'], family: 'Mermaid Sequence', feature: 'rect regions and participant variants', level: 'native basic' },
  { kind: 'mermaid', subtypes: ['classDiagram'], family: 'Mermaid Class', feature: 'classes, members, relationships, stereotypes', level: 'native high fidelity' },
  { kind: 'mermaid', subtypes: ['erDiagram'], family: 'Mermaid ER', feature: "entities, attributes, crow's-foot cardinalities", level: 'native high fidelity' },
  { kind: 'plantuml', subtypes: ['sequence'], family: 'PlantUML Sequence', feature: 'participants, messages, notes, groups, activations', level: 'native basic' },
  { kind: 'plantuml', subtypes: ['class'], family: 'PlantUML Class', feature: 'classes, abstract/interface/enum, stereotypes, relationships', level: 'native high fidelity' },
  { kind: 'plantuml', subtypes: ['usecase'], family: 'PlantUML Use Case', feature: 'actors, use cases, aliases, stereotypes, and system boundaries', level: 'native high fidelity' },
  { kind: 'plantuml', subtypes: ['usecase'], family: 'PlantUML Use Case', feature: 'associations, include/extend dependencies, and generalization', level: 'native high fidelity' },
  { kind: 'plantuml', subtypes: ['unsupported'], family: 'PlantUML Other', feature: 'unsupported families', level: 'visual fallback' },
];

export function mergeSupportAnalysis(
  ...items: Array<DrawioSupportAnalysis | undefined>
): DrawioSupportAnalysis {
  const supportedFeatures = new Set<string>();
  const partialFeatures = new Set<string>();
  const fallbackRegions = new Map<string, DrawioSupportRegion>();

  items.filter(Boolean).forEach((item) => {
    item!.supportedFeatures.forEach((feature) => supportedFeatures.add(feature));
    item!.partialFeatures.forEach((feature) => partialFeatures.add(feature));
    item!.fallbackRegions.forEach((region) => fallbackRegions.set(region.id, region));
  });

  return {
    supportedFeatures: Array.from(supportedFeatures),
    partialFeatures: Array.from(partialFeatures),
    fallbackRegions: Array.from(fallbackRegions.values()),
  };
}

export function getDrawioSupportMatrixRows(
  kind: 'mermaid' | 'plantuml' | null | undefined,
  subtype: string | null | undefined
) {
  if (!kind) {
    return DRAWIO_SUPPORT_MATRIX;
  }

  const rowsForKind = DRAWIO_SUPPORT_MATRIX.filter((row) => row.kind === kind);
  if (!subtype) {
    return rowsForKind;
  }

  const exactRows = rowsForKind.filter((row) => row.subtypes.includes(subtype));
  return exactRows.length ? exactRows : rowsForKind;
}
