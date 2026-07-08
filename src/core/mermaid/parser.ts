import { UnifiedAST, ASTNode, ASTEdge } from '../../types/ast';
import { createParseCoverage, ParseDiagnostic } from '../../types/diagnostics';
import { normalizeDiagramSource } from '../detector';
import { validateAstInvariants } from '../astValidation';

export interface FlowchartSubgraph {
  id: string;
  label: string;
  parentId?: string;
  childNodeIds: string[];
}

export interface SequenceNote {
  placement: 'left of' | 'right of' | 'over';
  participants: string[];
  text: string;
  messageIndex: number;
}

export interface SequenceGroup {
  type: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'rect';
  label: string;
  startMessageIndex: number;
  endMessageIndex: number;
}

export interface SequenceActivation {
  participantId: string;
  startMessageIndex: number;
  endMessageIndex: number;
  depth: number;
}

export interface ErRelationship {
  source: string;
  target: string;
  sourceCardinality: string;
  targetCardinality: string;
  label?: string;
}

export interface ParsedMermaid extends UnifiedAST {
  type: string;
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  subgraphs?: FlowchartSubgraph[];
  notes?: SequenceNote[];
  groups?: SequenceGroup[];
  activations?: SequenceActivation[];
  erRelationships?: ErRelationship[];
  unsupportedFeatures?: string[];
}

const CLASS_ID_PATTERN = '[A-Za-z0-9_.~-]+';
const CLASS_ID_REGEX = new RegExp(`^${CLASS_ID_PATTERN}$`);
const CLASS_RELATIONSHIP_REGEX = new RegExp(
  `^(${CLASS_ID_PATTERN})\\s*(?:"([^"]+)")?\\s+([<|o*]*[.-]+[.-]*[>|o*]*)\\s*(?:"([^"]+)")?\\s+(${CLASS_ID_PATTERN})(?:\\s*:\\s*(.+))?$`
);

export async function parseMermaidAst(code: string): Promise<ParsedMermaid> {
  const trimmedCode = normalizeDiagramSource(code);
  if (!trimmedCode) {
    return {
      type: 'flowchart',
      nodes: [],
      edges: [],
      unsupportedFeatures: [],
      diagnostics: [],
      coverage: createParseCoverage(0, 0, 0),
    };
  }

  const lines = stripMermaidPreamble(trimmedCode.split('\n'));
  const firstLine = lines[0].trim();

  let result: ParsedMermaid;
  if (/^sequenceDiagram\b/i.test(firstLine)) {
    result = parseSequenceDiagram(lines);
  } else if (/^classDiagram\b/i.test(firstLine)) {
    result = parseClassDiagram(lines);
  } else if (/^stateDiagram(?:-v2)?\b/i.test(firstLine)) {
    result = parseUnsupportedMermaidDiagram(lines, 'state', 'Mermaid State diagram support is disabled because current native export is unreliable.');
  } else if (/^erDiagram\b/i.test(firstLine)) {
    result = parseErDiagram(lines);
  } else if (/^gantt\b/i.test(firstLine)) {
    result = parseUnsupportedMermaidDiagram(lines, 'gantt', 'Mermaid Gantt chart support is disabled because current native export is unreliable.');
  } else {
    result = parseFlowchartDiagram(lines);
  }

  return finalizeMermaidResult(result, lines);
}

function parseUnsupportedMermaidDiagram(lines: string[], type: string, message: string): ParsedMermaid {
  const statementCount = lines.filter((line) => line.trim() && !line.trim().startsWith('%%')).length;
  return {
    type,
    nodes: [],
    edges: [],
    unsupportedFeatures: [message],
    diagnostics: [
      {
        severity: 'warning',
        code: `mermaid.${type}.unsupported`,
        message,
        line: 1,
        statement: lines[0]?.trim(),
      },
    ],
    coverage: createParseCoverage(statementCount, 0, statementCount),
  };
}

function parseFlowchartDiagram(lines: string[]): ParsedMermaid {
  const nodeMap = new Map<string, ASTNode>();
  const edges: ASTEdge[] = [];
  const subgraphs: FlowchartSubgraph[] = [];
  const unsupportedFeatures = new Set<string>();
  const subgraphStack: FlowchartSubgraph[] = [];
  const nodeStyleOverrides = new Map<string, Record<string, string>>();
  const classDefs = new Map<string, Record<string, string>>();
  const classAssignments = new Map<string, string[]>();
  const edgeStyleOverrides = new Map<number, Record<string, string>>();
  let defaultEdgeStyleOverrides: Record<string, string> | null = null;
  const diagnostics: ParseDiagnostic[] = [];
  let statementsTotal = 0;
  let statementsParsed = 0;
  let statementsIgnored = 0;

  const registerNode = (token: FlowchartNodeToken | null) => {
    if (!token?.id) {
      return null;
    }

    const existing = nodeMap.get(token.id);
    const parentId = subgraphStack[subgraphStack.length - 1]?.id;
    if (existing) {
      if (token.label && existing.label === existing.id) {
        existing.label = token.label;
      }
      if (parentId && !existing.parentId) {
        existing.parentId = parentId;
      }
      if (token.shape && !existing.type) {
        existing.type = token.shape;
      }
      if (nodeStyleOverrides.has(token.id)) {
        existing.styleOverrides = mergeStyleOverrides(existing.styleOverrides, nodeStyleOverrides.get(token.id));
      }
      return existing;
    }

    const node: ASTNode = {
      id: token.id,
      label: token.label || token.id,
      type: token.shape || 'rect',
      parentId,
      styleOverrides: nodeStyleOverrides.get(token.id),
    };
    nodeMap.set(token.id, node);
    if (parentId) {
      const parent = subgraphs.find((subgraph) => subgraph.id === parentId);
      if (parent && !parent.childNodeIds.includes(token.id)) {
        parent.childNodeIds.push(token.id);
      }
    }
    return node;
  };

  for (const statement of splitMermaidStatements(lines.slice(1))) {
    const { text: trimmedLine, line } = statement;
    if (!trimmedLine || trimmedLine.startsWith('%%')) {
      continue;
    }
    statementsTotal += 1;

    const styleDirective = parseFlowchartStyleDirective(trimmedLine);
    if (styleDirective) {
      const nextStyle = mergeStyleOverrides(nodeStyleOverrides.get(styleDirective.nodeId), styleDirective.style);
      if (nextStyle) {
        nodeStyleOverrides.set(styleDirective.nodeId, nextStyle);
      }
      const node = nodeMap.get(styleDirective.nodeId);
      if (node) {
        node.styleOverrides = mergeStyleOverrides(node.styleOverrides, styleDirective.style);
      }
      statementsParsed += 1;
      continue;
    }

    const classDefDirective = parseFlowchartClassDefDirective(trimmedLine);
    if (classDefDirective) {
      const nextStyle = mergeStyleOverrides(classDefs.get(classDefDirective.className), classDefDirective.style);
      if (nextStyle) {
        classDefs.set(classDefDirective.className, nextStyle);
      }
      statementsParsed += 1;
      continue;
    }

    const classDirective = parseFlowchartClassDirective(trimmedLine);
    if (classDirective) {
      classDirective.nodeIds.forEach((nodeId) => {
        classAssignments.set(nodeId, [
          ...(classAssignments.get(nodeId) || []),
          ...classDirective.classNames,
        ]);
      });
      statementsParsed += 1;
      continue;
    }

    const linkStyleDirective = parseFlowchartLinkStyleDirective(trimmedLine);
    if (linkStyleDirective) {
      const nextStyle = mergeStyleOverrides(
        linkStyleDirective.edgeIndex === 'default' ? defaultEdgeStyleOverrides : edgeStyleOverrides.get(linkStyleDirective.edgeIndex),
        linkStyleDirective.style
      );
      if (linkStyleDirective.edgeIndex === 'default') {
        defaultEdgeStyleOverrides = nextStyle || null;
      } else if (nextStyle) {
        edgeStyleOverrides.set(linkStyleDirective.edgeIndex, nextStyle);
      }
      statementsParsed += 1;
      continue;
    }

    if (/^(click)\b/.test(trimmedLine)) {
      unsupportedFeatures.add('Flowchart click directives are not preserved in editable export.');
      diagnostics.push({
        severity: 'warning',
        code: 'mermaid.flowchart.click-unsupported',
        message: 'Click directives are not preserved in editable Draw.io output.',
        line,
        statement: trimmedLine,
        suggestion: 'Keep links in the source or use a visual export.',
      });
      statementsIgnored += 1;
      continue;
    }

    const subgraphStart = parseFlowchartSubgraphStart(trimmedLine);
    if (subgraphStart) {
      const nextSubgraph: FlowchartSubgraph = {
        id: subgraphStart.id,
        label: subgraphStart.label,
        parentId: subgraphStack[subgraphStack.length - 1]?.id,
        childNodeIds: [],
      };
      subgraphs.push(nextSubgraph);
      subgraphStack.push(nextSubgraph);
      statementsParsed += 1;
      continue;
    }

    if (trimmedLine === 'end') {
      subgraphStack.pop();
      statementsParsed += 1;
      continue;
    }

    const parsedEdges = parseFlowchartEdges(trimmedLine);
    if (parsedEdges.length > 0) {
      parsedEdges.forEach((edge) => {
        const sourceNode = registerNode(edge.sourceToken);
        const targetNode = registerNode(edge.targetToken);
        if (!sourceNode || !targetNode) {
          return;
        }

        edges.push({
          id: `edge-${edges.length}`,
          source: sourceNode.id,
          target: targetNode.id,
          label: edge.label,
          type: edge.type,
        });
      });
      statementsParsed += 1;
      continue;
    }

    const standaloneNode = parseFlowchartNodeToken(trimmedLine);
    if (standaloneNode) {
      registerNode(standaloneNode);
      statementsParsed += 1;
      continue;
    }

    statementsIgnored += 1;
    diagnostics.push({
      severity: 'warning',
      code: 'mermaid.flowchart.statement-unparsed',
      message: 'This flowchart statement rendered but could not be converted faithfully.',
      line,
      statement: trimmedLine,
      suggestion: 'Simplify the statement or keep the visual reference layer in the hybrid export.',
    });
  }

  while (subgraphStack.length > 0) {
    const unclosed = subgraphStack.pop()!;
    diagnostics.push({
      severity: 'warning',
      code: 'mermaid.flowchart.subgraph-unclosed',
      message: `Subgraph "${unclosed.label}" was missing an end marker.`,
      suggestion: 'Add an end statement for the subgraph.',
    });
    statementsIgnored += 1;
  }

  applyFlowchartClassStyles(nodeMap, classDefs, classAssignments);
  edges.forEach((edge, index) => {
    const overrides = mergeStyleOverrides(defaultEdgeStyleOverrides, edgeStyleOverrides.get(index));
    if (overrides) {
      edge.styleOverrides = overrides;
    }
  });

  return {
    type: 'flowchart',
    nodes: Array.from(nodeMap.values()),
    edges,
    subgraphs,
    unsupportedFeatures: Array.from(unsupportedFeatures),
    diagnostics,
    coverage: createParseCoverage(statementsTotal, statementsParsed, statementsIgnored),
  };
}

function parseSequenceDiagram(lines: string[]): ParsedMermaid {
  const nodes: ASTNode[] = [];
  const edges: ASTEdge[] = [];
  const notes: SequenceNote[] = [];
  const groups: SequenceGroup[] = [];
  const activations: SequenceActivation[] = [];
  const unsupportedFeatures = new Set<string>();
  const nodeMap = new Map<string, ASTNode>();
  const openGroups: Array<{ type: SequenceGroup['type']; label: string; startMessageIndex: number }> = [];
  const activationStacks = new Map<string, number[]>();

  const registerParticipant = (key: string, label: string, type = 'participant', aliases: string[] = []) => {
    const normalizedKeys = [key, ...aliases]
      .map(normalizeSequenceKey)
      .filter((value): value is string => Boolean(value));

    for (const normalizedKey of normalizedKeys) {
      const existingNode = nodeMap.get(normalizedKey);
      if (existingNode) {
        return existingNode;
      }
    }

    const node: ASTNode = {
      id: `participant-${nodes.length}`,
      label,
      alias: aliases[0],
      type,
    };

    nodes.push(node);
    normalizedKeys.forEach((normalizedKey) => nodeMap.set(normalizedKey, node));
    return node;
  };

  const participantRegex = /^\s*(participant|actor)\s+(?:"([^"]+)"|([A-Za-z0-9_.-]+))(?:\s+as\s+([A-Za-z0-9_.-]+))?\s*$/;
  const messageRegex = /^\s*(.+?)\s*(-->>|->>|-->|->)\s*(.+?)(?:\s*:\s*(.*))?$/;

  for (const line of lines.slice(1)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('%%')) {
      continue;
    }

    const participantMatch = trimmedLine.match(participantRegex);
    if (participantMatch) {
      const type = participantMatch[1];
      const displayName = participantMatch[2] || participantMatch[3];
      const alias = participantMatch[4];
      registerParticipant(alias || displayName, displayName, type, alias ? [displayName] : []);
      continue;
    }

    const note = parseMermaidSequenceNote(trimmedLine);
    if (note) {
      const participants = note.participants
        .map((token) => parseSequenceToken(token))
        .filter((token): token is ParsedSequenceToken => Boolean(token))
        .map((token) => registerParticipant(token.key, token.label).id);

      notes.push({
        placement: note.placement,
        participants,
        text: note.text,
        messageIndex: Math.max(edges.length - 1, 0),
      });
      continue;
    }

    const groupStart = parseMermaidSequenceGroupStart(trimmedLine);
    if (groupStart) {
      openGroups.push({ ...groupStart, startMessageIndex: edges.length });
      continue;
    }

    if (/^end\b/i.test(trimmedLine)) {
      const currentGroup = openGroups.pop();
      if (currentGroup) {
        groups.push({
          ...currentGroup,
          endMessageIndex: Math.max(edges.length - 1, currentGroup.startMessageIndex),
        });
      }
      continue;
    }

    const activationEvent = parseMermaidSequenceActivation(trimmedLine);
    if (activationEvent) {
      const token = parseSequenceToken(activationEvent.participant);
      if (!token) {
        continue;
      }
      const participantId = registerParticipant(token.key, token.label).id;
      applyActivationEvent(activationStacks, activations, participantId, activationEvent.type, Math.max(edges.length - 1, 0));
      continue;
    }

    if (/^(autonumber|title|rect)\b/i.test(trimmedLine)) {
      unsupportedFeatures.add('Sequence diagram titles and rect blocks are not preserved in editable export.');
      continue;
    }

    const messageMatch = trimmedLine.match(messageRegex);
    if (!messageMatch) {
      continue;
    }

    const sourceToken = parseSequenceToken(messageMatch[1]);
    const arrow = messageMatch[2];
    const targetToken = parseSequenceToken(messageMatch[3]);
    const label = (messageMatch[4] || '').trim();

    if (!sourceToken || !targetToken) {
      continue;
    }

    const sourceNode = registerParticipant(sourceToken.key, sourceToken.label);
    const targetNode = registerParticipant(targetToken.key, targetToken.label);
    const messageIndex = edges.length;

    edges.push({
      id: `edge-${messageIndex}`,
      source: sourceNode.id,
      target: targetNode.id,
      label,
      type: arrow,
      isDashed: arrow.includes('--'),
      isSelf: sourceNode.id === targetNode.id,
    });

    applyDecoratedTokenActivation(activationStacks, activations, sourceNode.id, sourceToken, messageIndex);
    applyDecoratedTokenActivation(activationStacks, activations, targetNode.id, targetToken, messageIndex);
  }

  closeRemainingActivations(activationStacks, activations, Math.max(edges.length - 1, 0));
  while (openGroups.length > 0) {
    const currentGroup = openGroups.pop()!;
    groups.push({
      ...currentGroup,
      endMessageIndex: Math.max(edges.length - 1, currentGroup.startMessageIndex),
    });
    unsupportedFeatures.add(`Sequence ${currentGroup.type} block was missing an end marker and was auto-closed in export.`);
  }

  return {
    type: 'sequence',
    nodes,
    edges,
    notes,
    groups,
    activations,
    unsupportedFeatures: Array.from(unsupportedFeatures),
  };
}

interface ParsedSequenceToken {
  key: string;
  label: string;
  activate: boolean;
  deactivate: boolean;
}

function parseSequenceToken(rawToken: string): ParsedSequenceToken | null {
  let token = rawToken.trim();
  if (!token) {
    return null;
  }

  const activate = token.startsWith('+') || token.endsWith('+');
  const deactivate = token.startsWith('-') || token.endsWith('-');
  token = token.replace(/^[+-]+/, '').replace(/[+-]+$/, '').trim();
  if (!token) {
    return null;
  }

  const quotedMatch = token.match(/^"(.*)"$/);
  const label = quotedMatch ? quotedMatch[1] : token;
  const key = normalizeSequenceKey(label);

  if (!key) {
    return null;
  }

  return { key, label, activate, deactivate };
}

function normalizeSequenceKey(value: string): string {
  return value.trim();
}

function parseClassDiagram(lines: string[]): ParsedMermaid {
  const nodes: ASTNode[] = [];
  const edges: ASTEdge[] = [];
  const classMap = new Map<string, ASTNode>();
  const diagnostics: ParseDiagnostic[] = [];
  const unsupportedFeatures = new Set<string>();
  let currentClass: ASTNode | null = null;
  let direction: ParsedMermaid['direction'];
  let statementsTotal = 0;
  let statementsParsed = 0;
  let statementsIgnored = 0;

  const registerClass = (name: string, displayLabel?: string) => {
    const id = normalizeClassName(name);
    const existingNode = classMap.get(id);
    if (existingNode) {
      if (displayLabel && existingNode.label === existingNode.id) {
        existingNode.label = displayLabel;
      }
      return existingNode;
    }

    const node: ASTNode = {
      id,
      label: displayLabel || id,
      type: 'class',
      annotations: [],
      attributes: [],
      methods: [],
    };
    classMap.set(id, node);
    nodes.push(node);
    return node;
  };

  for (const [lineIndex, line] of lines.slice(1).entries()) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('%%')) {
      continue;
    }
    statementsTotal += 1;
    const sourceLine = lineIndex + 2;

    const parsedDirection = parseClassDirection(trimmedLine);
    if (parsedDirection) {
      direction = parsedDirection;
      statementsParsed += 1;
      continue;
    }

    if (currentClass && trimmedLine === '}') {
      currentClass = null;
      statementsParsed += 1;
      continue;
    }

    const declaration = parseClassDeclaration(trimmedLine);
    if (declaration?.isBlockStart) {
      currentClass = registerClass(declaration.id, declaration.label);
      statementsParsed += 1;
      continue;
    }

    if (currentClass) {
      addClassMember(currentClass, trimmedLine);
      statementsParsed += 1;
      continue;
    }

    if (declaration) {
      registerClass(declaration.id, declaration.label);
      statementsParsed += 1;
      continue;
    }

    const memberMatch = trimmedLine.match(new RegExp(`^(${CLASS_ID_PATTERN})\\s*:\\s*(.+)$`));
    if (memberMatch) {
      addClassMember(registerClass(memberMatch[1]), memberMatch[2].trim());
      statementsParsed += 1;
      continue;
    }

    const relationship = parseClassRelationship(trimmedLine, edges.length);
    if (relationship) {
      registerClass(relationship.source);
      registerClass(relationship.target);
      edges.push(relationship);
      statementsParsed += 1;
      continue;
    }

    statementsIgnored += 1;
    unsupportedFeatures.add('Some Mermaid class statements are preserved only in the visual reference.');
    diagnostics.push({
      severity: 'warning',
      code: 'mermaid.class.statement-unparsed',
      message: 'This Mermaid class statement rendered but could not be converted faithfully.',
      line: sourceLine,
      statement: trimmedLine,
      suggestion: 'Simplify the statement or keep the visual reference layer in the hybrid export.',
    });
  }

  if (currentClass) {
    statementsIgnored += 1;
    diagnostics.push({
      severity: 'warning',
      code: 'mermaid.class.block-unclosed',
      message: `Class "${currentClass.label}" was missing a closing brace.`,
      suggestion: 'Add a closing brace to the class declaration.',
    });
  }

  return {
    type: 'class',
    direction,
    nodes,
    edges,
    unsupportedFeatures: Array.from(unsupportedFeatures),
    diagnostics,
    coverage: createParseCoverage(statementsTotal, statementsParsed, statementsIgnored),
  };
}

function addClassMember(node: ASTNode, rawMember: string) {
  const member = rawMember.trim();
  if (!member) {
    return;
  }

  if (isClassAnnotation(member)) {
    node.annotations = [...(node.annotations || []), member];
    return;
  }

  if (member.includes('(')) {
    node.methods = [...(node.methods || []), member];
    return;
  }

  node.attributes = [...(node.attributes || []), member];
}

function parseClassRelationship(line: string, edgeIndex: number): ASTEdge | null {
  const match = line.match(CLASS_RELATIONSHIP_REGEX);
  if (!match) {
    return null;
  }

  const left = normalizeClassName(match[1]);
  const leftCardinality = match[2]?.trim();
  const operator = match[3];
  const rightCardinality = match[4]?.trim();
  const right = normalizeClassName(match[5]);
  const label = match[6]?.trim();

  const pointsLeft = operator.includes('<|');
  const type = getClassRelationshipType(operator);

  return {
    id: `edge-${edgeIndex}`,
    source: pointsLeft ? right : left,
    target: pointsLeft ? left : right,
    label,
    sourceCardinality: pointsLeft ? rightCardinality : leftCardinality,
    targetCardinality: pointsLeft ? leftCardinality : rightCardinality,
    type,
    isDashed: operator.includes('..'),
    styleOverrides: getClassRelationshipStyleOverrides(operator),
  };
}

function getClassRelationshipType(operator: string): string {
  if (operator.includes('<|') || operator.includes('|>')) {
    return operator.includes('..') ? 'realization' : 'generalization';
  }

  if (operator.includes('*')) {
    return 'composition';
  }

  if (operator.includes('o')) {
    return 'aggregation';
  }

  if (operator.includes('..')) {
    return 'dependency';
  }

  if (operator.includes('>')) {
    return 'directedAssociation';
  }

  return 'association';
}

function getClassRelationshipStyleOverrides(operator: string): Record<string, string> | undefined {
  const isSourceComposition = operator.startsWith('*');
  const isSourceAggregation = operator.startsWith('o');
  if (!isSourceComposition && !isSourceAggregation) {
    return undefined;
  }

  return {
    startArrow: 'diamond',
    startFill: isSourceComposition ? '1' : '0',
    endArrow: 'none',
    endFill: '0',
  };
}

function normalizeClassName(value: string): string {
  return value.trim();
}

function parseClassDeclaration(line: string): { id: string; label?: string; isBlockStart: boolean } | null {
  const match = line.match(/^class\s+(.+?)(\s*\{\s*)?$/);
  if (!match) {
    return null;
  }

  const rawDeclaration = match[1].trim();
  const isBlockStart = Boolean(match[2]);

  const aliasMatch = rawDeclaration.match(new RegExp(`^"([^"]+)"\\s+as\\s+(${CLASS_ID_PATTERN})$`));
  if (aliasMatch) {
    return {
      id: normalizeClassName(aliasMatch[2]),
      label: aliasMatch[1].trim(),
      isBlockStart,
    };
  }

  const id = normalizeClassName(rawDeclaration);
  if (!CLASS_ID_REGEX.test(id)) {
    return null;
  }

  return { id, isBlockStart };
}

function isClassAnnotation(value: string): boolean {
  return /^<<[^>]+>>$/.test(value) || /^\{[^}]+\}$/.test(value);
}

function parseClassDirection(value: string): ParsedMermaid['direction'] | null {
  const match = value.match(/^direction\s+(TB|BT|LR|RL)\s*$/i);
  return match ? match[1].toUpperCase() as ParsedMermaid['direction'] : null;
}

function parseErDiagram(lines: string[]): ParsedMermaid {
  const nodes: ASTNode[] = [];
  const edges: ASTEdge[] = [];
  const unsupportedFeatures = new Set<string>();
  const nodeMap = new Map<string, ASTNode>();
  const erRelationships: ErRelationship[] = [];
  let currentEntity: ASTNode | null = null;

  const registerEntity = (id: string) => {
    const entityId = id.trim();
    const existing = nodeMap.get(entityId);
    if (existing) {
      return existing;
    }

    const node: ASTNode = {
      id: entityId,
      label: entityId,
      type: 'entity',
      attributes: [],
    };
    nodeMap.set(entityId, node);
    nodes.push(node);
    return node;
  };

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) {
      continue;
    }

    if (line === '}') {
      currentEntity = null;
      continue;
    }

    if (currentEntity) {
      currentEntity.attributes = [...(currentEntity.attributes || []), line];
      continue;
    }

    const entityStart = line.match(/^([A-Za-z0-9_.-]+)\s*\{$/);
    if (entityStart) {
      currentEntity = registerEntity(entityStart[1]);
      continue;
    }

    const relationshipMatch = line.match(/^([A-Za-z0-9_.-]+)\s+([|o}{]+)--([|o}{]+)\s+([A-Za-z0-9_.-]+)(?:\s*:\s*(.+))?$/);
    if (relationshipMatch) {
      const source = registerEntity(relationshipMatch[1]);
      const target = registerEntity(relationshipMatch[4]);
      const sourceCardinality = relationshipMatch[2];
      const targetCardinality = relationshipMatch[3];
      const label = relationshipMatch[5]?.trim();

      edges.push({
        id: `edge-${edges.length}`,
        source: source.id,
        target: target.id,
        label,
        sourceCardinality,
        targetCardinality,
        type: 'association',
      });
      erRelationships.push({
        source: source.id,
        target: target.id,
        sourceCardinality,
        targetCardinality,
        label,
      });
      continue;
    }

    unsupportedFeatures.add(`ER diagram line was preserved approximately: ${line}`);
  }

  return {
    type: 'er',
    nodes,
    edges,
    erRelationships,
    unsupportedFeatures: Array.from(unsupportedFeatures),
  };
}

interface FlowchartNodeToken {
  id: string;
  label?: string;
  shape?: string;
}

function parseFlowchartEdges(line: string) {
  const operators: Array<{
    start: number;
    end: number;
    operator: string;
    label?: string;
  }> = [];
  let cursor = 0;

  while (cursor < line.length) {
    const operator = findNextFlowchartOperator(line, cursor);
    if (!operator) {
      break;
    }
    operators.push(operator);
    cursor = operator.end;
  }

  if (operators.length === 0) {
    return [];
  }

  const groups: FlowchartNodeToken[][] = [];
  let tokenStart = 0;
  for (const operator of operators) {
    const group = splitFlowchartNodeGroup(line.slice(tokenStart, operator.start));
    if (group.length === 0) {
      return [];
    }
    groups.push(group);
    tokenStart = operator.end;
  }

  const finalGroup = splitFlowchartNodeGroup(line.slice(tokenStart));
  if (finalGroup.length === 0) {
    return [];
  }
  groups.push(finalGroup);

  const parsed: Array<{
    sourceToken: FlowchartNodeToken;
    targetToken: FlowchartNodeToken;
    label?: string;
    type: string;
  }> = [];

  operators.forEach((operator, index) => {
    for (const sourceToken of groups[index]) {
      for (const targetToken of groups[index + 1]) {
        parsed.push({
          sourceToken,
          targetToken,
          label: operator.label,
          type: getFlowchartArrowType(operator.operator),
        });
      }
    }
  });

  return parsed;
}

function findNextFlowchartOperator(line: string, startIndex: number) {
  const operators = ['<-->', 'o-->', 'x-->', '-.->', '-->', '--o', '--x', '==>', '===', '---', '-.-'];
  let quote: '"' | "'" | null = null;
  let squareDepth = 0;
  let roundDepth = 0;
  let curlyDepth = 0;

  for (let index = startIndex; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
      continue;
    }
    if (quote) {
      continue;
    }

    if (char === '[') squareDepth += 1;
    else if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    else if (char === '(') roundDepth += 1;
    else if (char === ')') roundDepth = Math.max(0, roundDepth - 1);
    else if (char === '{') curlyDepth += 1;
    else if (char === '}') curlyDepth = Math.max(0, curlyDepth - 1);

    if (squareDepth || roundDepth || curlyDepth) {
      continue;
    }

    const labeledMatch = line.slice(index).match(/^--\s+(.+?)\s+-->/);
    if (labeledMatch) {
      return {
        start: index,
        end: index + labeledMatch[0].length,
        operator: '-->',
        label: labeledMatch[1].trim(),
      };
    }

    const operator = operators.find((candidate) => line.startsWith(candidate, index));
    if (!operator) {
      continue;
    }

    let end = index + operator.length;
    let label: string | undefined;
    const pipeLabel = line.slice(end).match(/^\s*\|([^|]+)\|/);
    if (pipeLabel) {
      label = pipeLabel[1].trim();
      end += pipeLabel[0].length;
    }

    return { start: index, end, operator, label };
  }

  return null;
}

function splitFlowchartNodeGroup(rawGroup: string) {
  return splitAtTopLevel(rawGroup, '&')
    .map((token) => parseFlowchartNodeToken(token))
    .filter((token): token is FlowchartNodeToken => Boolean(token));
}

function splitAtTopLevel(value: string, delimiter: string) {
  const parts: string[] = [];
  let quote: '"' | "'" | null = null;
  let squareDepth = 0;
  let roundDepth = 0;
  let curlyDepth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
      continue;
    }
    if (quote) continue;
    if (char === '[') squareDepth += 1;
    else if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    else if (char === '(') roundDepth += 1;
    else if (char === ')') roundDepth = Math.max(0, roundDepth - 1);
    else if (char === '{') curlyDepth += 1;
    else if (char === '}') curlyDepth = Math.max(0, curlyDepth - 1);
    else if (char === delimiter && squareDepth === 0 && roundDepth === 0 && curlyDepth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function parseFlowchartNodeToken(rawToken: string): FlowchartNodeToken | null {
  const token = rawToken.trim();
  if (!token) {
    return null;
  }

  const objectShapeToken = parseFlowchartObjectShapeToken(token);
  if (objectShapeToken) {
    return objectShapeToken;
  }

  const patterns: Array<{ regex: RegExp; shape: string }> = [
    { regex: /^([A-Za-z0-9_.-]+)\[\[(.+)\]\]$/, shape: 'subroutine' },
    { regex: /^([A-Za-z0-9_.-]+)\[\((.+)\)\]$/, shape: 'cylinder' },
    { regex: /^([A-Za-z0-9_.-]+)\(\[(.+)\]\)$/, shape: 'stadium' },
    { regex: /^([A-Za-z0-9_.-]+)\{\{(.+)\}\}$/, shape: 'hexagon' },
    { regex: /^([A-Za-z0-9_.-]+)\[\/(.+)\/\]$/, shape: 'parallelogram' },
    { regex: /^([A-Za-z0-9_.-]+)\[\\(.+)\\\]$/, shape: 'parallelogram_alt' },
    { regex: /^([A-Za-z0-9_.-]+)\[\/(.+)\\\]$/, shape: 'trapezoid' },
    { regex: /^([A-Za-z0-9_.-]+)\[\\(.+)\/\]$/, shape: 'trapezoid_alt' },
    { regex: /^([A-Za-z0-9_.-]+)\["(.+)"\]$/, shape: 'rect' },
    { regex: /^([A-Za-z0-9_.-]+)\[(.+)\]$/, shape: 'rect' },
    { regex: /^([A-Za-z0-9_.-]+)\(\((.+)\)\)$/, shape: 'double_circle' },
    { regex: /^([A-Za-z0-9_.-]+)\((.+)\)$/, shape: 'rounded_rect' },
    { regex: /^([A-Za-z0-9_.-]+)\{(.+)\}$/, shape: 'diamond' },
    { regex: /^([A-Za-z0-9_.-]+)>\s*(.+)\]$/, shape: 'parallelogram' },
    { regex: /^([A-Za-z0-9_.-]+)$/, shape: 'rect' },
  ];

  for (const pattern of patterns) {
    const match = token.match(pattern.regex);
    if (!match) {
      continue;
    }

    return {
      id: match[1].trim(),
      label: match[2]?.trim(),
      shape: pattern.shape,
    };
  }

  return null;
}

function parseFlowchartObjectShapeToken(token: string): FlowchartNodeToken | null {
  const match = token.match(/^([A-Za-z0-9_.-]+)@\{\s*(.+?)\s*\}$/);
  if (!match) {
    return null;
  }

  const properties = parseObjectLikeMermaidProperties(match[2]);
  return {
    id: match[1].trim(),
    label: properties.label,
    shape: properties.shape ? normalizeMermaidShapeName(properties.shape) : 'rect',
  };
}

function parseObjectLikeMermaidProperties(rawProperties: string) {
  const properties: Record<string, string> = {};
  rawProperties.split(',').forEach((part) => {
    const [rawKey, ...rawValueParts] = part.split(':');
    const key = rawKey?.trim();
    const value = rawValueParts.join(':').trim().replace(/^['"]|['"]$/g, '');
    if (key && value) {
      properties[key] = value;
    }
  });
  return properties;
}

function parseFlowchartStyleDirective(line: string) {
  const match = line.match(/^style\s+([A-Za-z0-9_.-]+)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    nodeId: match[1].trim(),
    style: parseMermaidStyleMap(match[2]),
  };
}

function parseFlowchartClassDefDirective(line: string) {
  const match = line.match(/^classDef\s+([A-Za-z0-9_.-]+)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    className: match[1].trim(),
    style: parseMermaidStyleMap(match[2]),
  };
}

function parseFlowchartClassDirective(line: string) {
  const match = line.match(/^class\s+(.+?)\s+([A-Za-z0-9_.-]+(?:\s*,\s*[A-Za-z0-9_.-]+)*)$/i);
  if (!match) {
    return null;
  }

  return {
    nodeIds: match[1].split(',').map((value) => value.trim()).filter(Boolean),
    classNames: match[2].split(',').map((value) => value.trim()).filter(Boolean),
  };
}

function parseFlowchartLinkStyleDirective(line: string) {
  const match = line.match(/^linkStyle\s+([0-9]+|default)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    edgeIndex: match[1].toLowerCase() === 'default' ? 'default' as const : Number(match[1]),
    style: parseMermaidStyleMap(match[2]),
  };
}

function parseMermaidStyleMap(rawStyle: string) {
  return rawStyle
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((style, declaration) => {
      const [rawKey, ...rawValueParts] = declaration.split(':');
      const key = rawKey?.trim();
      const value = rawValueParts.join(':').trim();
      if (key && value) {
        style[key] = value;
      }
      return style;
    }, {});
}

function applyFlowchartClassStyles(
  nodeMap: Map<string, ASTNode>,
  classDefs: Map<string, Record<string, string>>,
  classAssignments: Map<string, string[]>
) {
  const defaultStyle = classDefs.get('default');
  if (defaultStyle) {
    nodeMap.forEach((node) => {
      node.styleOverrides = mergeStyleOverrides(node.styleOverrides, defaultStyle);
    });
  }

  classAssignments.forEach((classNames, nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) {
      return;
    }

    classNames.forEach((className) => {
      node.styleOverrides = mergeStyleOverrides(node.styleOverrides, classDefs.get(className));
    });
  });
}

function mergeStyleOverrides(
  ...styles: Array<Record<string, string> | null | undefined>
): Record<string, string> | undefined {
  const merged = styles.reduce<Record<string, string>>((nextStyle, style) => {
    if (style) {
      Object.assign(nextStyle, style);
    }
    return nextStyle;
  }, {});

  return Object.keys(merged).length ? merged : undefined;
}

function normalizeMermaidShapeName(shape: string) {
  return shape.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function parseFlowchartSubgraphStart(line: string) {
  const match = line.match(/^subgraph\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const rawValue = match[1].trim();
  const aliasMatch = rawValue.match(/^([A-Za-z0-9_.-]+)\[(.+)\]$/);
  if (aliasMatch) {
    return {
      id: aliasMatch[1].trim(),
      label: aliasMatch[2].trim().replace(/^"|"$/g, ''),
    };
  }

  const quotedMatch = rawValue.match(/^"(.+)"$/);
  if (quotedMatch) {
    const label = quotedMatch[1].trim();
    return {
      id: slugify(label),
      label,
    };
  }

  return {
    id: rawValue,
    label: rawValue,
  };
}

function getFlowchartArrowType(operator: string) {
  if (operator === '<-->') {
    return 'both';
  }

  if (operator.startsWith('o') || operator.endsWith('o')) {
    return 'circle';
  }

  if (operator.startsWith('x') || operator.endsWith('x')) {
    return 'cross';
  }

  if (operator.includes('---') || operator.includes('===')) {
    return 'none';
  }

  if (operator.includes('-.')) {
    return 'dotted';
  }

  if (operator.includes('==')) {
    return 'thick';
  }

  return 'normal';
}

function parseMermaidSequenceNote(line: string) {
  const match = line.match(/^note\s+(left of|right of|over)\s+(.+?)\s*:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    placement: match[1].toLowerCase() as SequenceNote['placement'],
    participants: match[2].split(',').map((value) => value.trim()),
    text: match[3].trim(),
  };
}

function parseMermaidSequenceGroupStart(line: string) {
  const match = line.match(/^(loop|alt|opt|par|critical|break|rect)\b(?:\s+(.*))?$/i);
  if (!match) {
    return null;
  }

  return {
    type: match[1].toLowerCase() as SequenceGroup['type'],
    label: (match[2] || '').trim(),
  };
}

function parseMermaidSequenceActivation(line: string) {
  const match = line.match(/^(activate|deactivate)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    type: match[1].toLowerCase() as 'activate' | 'deactivate',
    participant: match[2].trim(),
  };
}

function applyDecoratedTokenActivation(
  activationStacks: Map<string, number[]>,
  activations: SequenceActivation[],
  participantId: string,
  token: ParsedSequenceToken,
  messageIndex: number
) {
  if (token.activate) {
    applyActivationEvent(activationStacks, activations, participantId, 'activate', messageIndex);
  }
  if (token.deactivate) {
    applyActivationEvent(activationStacks, activations, participantId, 'deactivate', messageIndex);
  }
}

function applyActivationEvent(
  activationStacks: Map<string, number[]>,
  activations: SequenceActivation[],
  participantId: string,
  type: 'activate' | 'deactivate',
  messageIndex: number
) {
  const stack = activationStacks.get(participantId) || [];
  if (type === 'activate') {
    stack.push(messageIndex);
    activationStacks.set(participantId, stack);
    return;
  }

  const startMessageIndex = stack.pop();
  activationStacks.set(participantId, stack);
  if (startMessageIndex === undefined) {
    return;
  }

  activations.push({
    participantId,
    startMessageIndex,
    endMessageIndex: messageIndex,
    depth: stack.length,
  });
}

function closeRemainingActivations(
  activationStacks: Map<string, number[]>,
  activations: SequenceActivation[],
  lastMessageIndex: number
) {
  activationStacks.forEach((stack, participantId) => {
    while (stack.length > 0) {
      const startMessageIndex = stack.pop();
      if (startMessageIndex === undefined) {
        continue;
      }
      activations.push({
        participantId,
        startMessageIndex,
        endMessageIndex: Math.max(startMessageIndex, lastMessageIndex),
        depth: stack.length,
      });
    }
  });
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'subgraph';
}

function stripMermaidPreamble(lines: string[]) {
  const output: string[] = [];
  let inFrontmatter = false;
  let frontmatterSeen = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!frontmatterSeen && line === '---') {
      inFrontmatter = true;
      frontmatterSeen = true;
      continue;
    }
    if (inFrontmatter) {
      if (line === '---') {
        inFrontmatter = false;
      }
      continue;
    }
    if (!output.length && (!line || line.startsWith('%%'))) {
      continue;
    }
    output.push(rawLine);
  }

  return output.length ? output : ['flowchart TD'];
}

function splitMermaidStatements(lines: string[]) {
  const statements: Array<{ text: string; line: number }> = [];
  lines.forEach((rawLine, lineIndex) => {
    splitAtTopLevel(rawLine, ';').forEach((part) => {
      const text = part.trim();
      if (text) {
        statements.push({ text, line: lineIndex + 2 });
      }
    });
  });
  return statements;
}

function finalizeMermaidResult(result: ParsedMermaid, lines: string[]) {
  if (!result.diagnostics) {
    result.diagnostics = (result.unsupportedFeatures || []).map((message) => ({
      severity: 'warning' as const,
      code: 'mermaid.feature-partial',
      message,
    }));
  }
  if (!result.coverage) {
    const statementsTotal = lines.slice(1).filter((line) => {
      const value = line.trim();
      return value && !value.startsWith('%%');
    }).length;
    const statementsIgnored = result.diagnostics.filter((item) => item.severity !== 'info').length;
    result.coverage = createParseCoverage(
      statementsTotal,
      Math.max(0, statementsTotal - statementsIgnored),
      statementsIgnored
    );
  }
  result.diagnostics.push(...validateAstInvariants(
    [
      ...result.nodes,
      ...(result.subgraphs || []).map((subgraph) => ({
        id: subgraph.id,
        label: subgraph.label,
        parentId: subgraph.parentId,
      })),
    ],
    result.edges,
    'mermaid.ast'
  ));
  if (result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    result.coverage = {
      ...result.coverage,
      fidelity: 'partial',
      statementsIgnored: Math.max(1, result.coverage.statementsIgnored),
    };
  }
  return result;
}
