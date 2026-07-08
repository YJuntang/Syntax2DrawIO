import { createParseCoverage, type ParseCoverage, type ParseDiagnostic } from '../../types/diagnostics';
import { validateAstInvariants } from '../astValidation';
import type { PlantUMLStatement } from './preprocessor';

export interface PlantUMLNode {
  id: string;
  name: string;
  type:
    | 'actor'
    | 'participant'
    | 'database'
    | 'boundary'
    | 'entity'
    | 'control'
    | 'class'
    | 'abstractClass'
    | 'interface'
    | 'enum'
    | 'component'
    | 'package'
    | 'node'
    | 'cloud'
    | 'folder'
    | 'rectangle'
    | 'queue'
    | 'usecase'
    | 'note';
  alias?: string;
  parentId?: string;
  annotations?: string[];
  attributes?: string[];
  methods?: string[];
  noteAnchorId?: string;
  notePlacement?: 'left' | 'right' | 'top' | 'bottom';
}

export interface PlantUMLEdge {
  id?: string;
  sourceId: string;
  targetId: string;
  label: string;
  isDashed: boolean;
  type?: string;
  sourceCardinality?: string;
  targetCardinality?: string;
  directionHint?: 'left' | 'right' | 'up' | 'down';
  styleOverrides?: Record<string, string>;
}

export interface PlantUMLSequenceNote {
  placement: 'left of' | 'right of' | 'over';
  participants: string[];
  text: string;
  messageIndex: number;
}

export interface PlantUMLSequenceGroup {
  type: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'group';
  label: string;
  startMessageIndex: number;
  endMessageIndex: number;
  branches?: Array<{ label: string; messageIndex: number }>;
}

export interface PlantUMLSequenceActivation {
  participantId: string;
  startMessageIndex: number;
  endMessageIndex: number;
  depth: number;
}

export interface ParsedPlantUML {
  type: 'sequence' | 'class' | 'usecase' | 'unsupported';
  nodes: PlantUMLNode[];
  edges: PlantUMLEdge[];
  notes: PlantUMLSequenceNote[];
  groups: PlantUMLSequenceGroup[];
  activations: PlantUMLSequenceActivation[];
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  title?: string;
  unsupportedFeatures: string[];
  diagnostics?: ParseDiagnostic[];
  coverage?: ParseCoverage;
}

type ParsedPlantUmlDeclaration = {
  type: PlantUMLNode['type'];
  id: string;
  label: string;
  alias?: string;
  annotations: string[];
  inlineMembers: string[];
  opensMembers: boolean;
  opensContainer: boolean;
};

const SEQUENCE_ENDPOINT = '(?:"([^"]+)"|([A-Za-z0-9_.~:-]+))';
const SEQUENCE_MESSAGE_REGEX = new RegExp(
  `^\\s*${SEQUENCE_ENDPOINT}\\s*(->|-->|->>|-->>|<-|<--|<<-|<<--)\\s*${SEQUENCE_ENDPOINT}(?:\\s*:\\s*(.*))?$`
);
const SEQUENCE_PARTICIPANT_REGEX = /^\s*(participant|actor|database|boundary|entity|control)\s+(?:"([^"]+)"|([A-Za-z0-9_.~:-]+))(?:\s+as\s+(?:"([^"]+)"|([A-Za-z0-9_.~:-]+)))?\s*$/;
const STRUCTURAL_KEYWORD_REGEX = /^(abstract\s+class|class|interface|enum|component|package|node|cloud|folder|rectangle|database|queue|actor|usecase)\b/i;

const RELATIONSHIP_OPERATORS = [
  '<|..',
  '..|>',
  '<|--',
  '--|>',
  '*--',
  '--*',
  'o--',
  '--o',
  '*..',
  '..*',
  'o..',
  '..o',
  '..>',
  '<..',
  '-->',
  '<--',
  '..',
  '--',
];

type PlantUMLInputStatement = string | PlantUMLStatement;

export function parsePlantUML(input: PlantUMLInputStatement[]): ParsedPlantUML {
  const statements = input.map((statement, index) => typeof statement === 'string'
    ? { text: statement, line: index + 1 }
    : statement);
  if (looksLikeUseCaseDiagram(statements)) {
    return finalizePlantUmlResult(parsePlantUmlUseCase(statements), statements);
  }

  const sequence = parsePlantUmlSequence(statements);
  if (sequence.type === 'sequence' && (hasExplicitSequenceSyntax(statements) || !looksLikeStructuralDiagram(statements))) {
    return finalizePlantUmlResult(sequence, statements);
  }

  if (looksLikeStructuralDiagram(statements)) {
    return finalizePlantUmlResult(parsePlantUmlStructural(statements), statements);
  }

  return finalizePlantUmlResult(parsePlantUmlStructural(statements), statements);
}

function parsePlantUmlUseCase(lines: PlantUMLStatement[]): ParsedPlantUML {
  const nodes: PlantUMLNode[] = [];
  const edges: PlantUMLEdge[] = [];
  const nodeMap = new Map<string, PlantUMLNode>();
  const lookup = new Map<string, PlantUMLNode>();
  const containerStack: string[] = [];
  const unsupportedFeatures = new Set<string>();
  const diagnostics: ParseDiagnostic[] = [];
  let parsedStatements = 0;
  let direction: ParsedPlantUML['direction'] = 'LR';

  const reportVisualStylePartial = (statement: PlantUMLStatement) => {
    const message = 'PlantUML Use Case inline colors and visual styles are preserved only in the visual reference.';
    unsupportedFeatures.add(message);
    diagnostics.push({
      severity: 'warning',
      code: 'plantuml.usecase.inline-style-partial',
      message,
      line: statement.line,
      statement: statement.text.trim(),
    });
  };

  const registerNode = (
    id: string,
    label: string,
    type: PlantUMLNode['type'],
    options: {
      alias?: string;
      annotations?: string[];
      explicit?: boolean;
      line?: number;
      parentId?: string;
      noteAnchorId?: string;
      notePlacement?: PlantUMLNode['notePlacement'];
    } = {}
  ) => {
    const normalizedId = id.trim();
    const existing = nodeMap.get(normalizedId);
    if (existing) {
      if (options.explicit) {
        diagnostics.push({
          severity: 'warning',
          code: 'plantuml.usecase.duplicate-id',
          message: `The Use Case identifier "${normalizedId}" was declared more than once.`,
          line: options.line,
          statement: normalizedId,
        });
      }
      return existing;
    }

    const node: PlantUMLNode = {
      id: normalizedId,
      name: normalizeUseCaseLabel(label),
      type,
      alias: options.alias,
      parentId: options.parentId ?? containerStack[containerStack.length - 1],
      annotations: options.annotations || [],
      attributes: [],
      methods: [],
      noteAnchorId: options.noteAnchorId,
      notePlacement: options.notePlacement,
    };
    nodes.push(node);
    nodeMap.set(normalizedId, node);
    [normalizedId, options.alias, label, normalizeUseCaseLabel(label)]
      .filter((key): key is string => Boolean(key))
      .forEach((key) => lookup.set(key.trim(), node));
    return node;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const statement = lines[lineIndex];
    const line = statement.text.trim();
    if (!line || line.startsWith("'")) {
      continue;
    }

    const directionDirective = parseUseCaseDirection(line);
    if (directionDirective) {
      direction = directionDirective;
      parsedStatements += 1;
      continue;
    }

    if (line === '}') {
      if (containerStack.length === 0) {
        diagnostics.push({
          severity: 'warning',
          code: 'plantuml.usecase.container-close-unmatched',
          message: 'A Use Case system-boundary closing brace had no matching container.',
          line: statement.line,
          statement: line,
        });
      } else {
        containerStack.pop();
        parsedStatements += 1;
      }
      continue;
    }

    const noteBlockStart = parseUseCaseAttachedNoteStart(line);
    if (noteBlockStart && !noteBlockStart.text) {
      const body: string[] = [];
      let endLine = lineIndex;
      for (let noteIndex = lineIndex + 1; noteIndex < lines.length; noteIndex += 1) {
        const bodyLine = lines[noteIndex].text.trim();
        endLine = noteIndex;
        if (/^end\s*note$/i.test(bodyLine)) {
          break;
        }
        if (bodyLine) {
          body.push(bodyLine);
        }
      }
      lineIndex = endLine;
      registerUseCaseNote(noteBlockStart, body.join('\n'), statement.line, registerNode, lookup);
      parsedStatements += 1;
      continue;
    }

    const attachedNote = parseUseCaseAttachedNoteStart(line);
    if (attachedNote?.text) {
      registerUseCaseNote(attachedNote, attachedNote.text, statement.line, registerNode, lookup);
      parsedStatements += 1;
      continue;
    }

    const standaloneNote = parseUseCaseStandaloneNote(line);
    if (standaloneNote) {
      registerNode(standaloneNote.id, standaloneNote.label, 'note', {
        alias: standaloneNote.alias,
        explicit: true,
        line: statement.line,
      });
      parsedStatements += 1;
      continue;
    }

    const unsupportedDirective = parseUseCaseUnsupportedDirective(line);
    if (unsupportedDirective) {
      unsupportedFeatures.add(unsupportedDirective.message);
      diagnostics.push({
        severity: 'warning',
        code: unsupportedDirective.code,
        message: unsupportedDirective.message,
        line: statement.line,
        statement: line,
      });
      continue;
    }

    const container = parseUseCaseContainer(line);
    if (container) {
      if (container.visualPartial) {
        reportVisualStylePartial(statement);
      }
      const node = registerNode(container.id, container.label, container.type, {
        alias: container.alias,
        annotations: container.annotations,
        explicit: true,
        line: statement.line,
      });
      if (container.opensBlock) {
        containerStack.push(node.id);
      }
      parsedStatements += 1;
      continue;
    }

    const actor = parseUseCaseActor(line);
    if (actor) {
      if (actor.visualPartial) {
        reportVisualStylePartial(statement);
      }
      registerNode(actor.id, actor.label, 'actor', {
        alias: actor.alias,
        annotations: actor.annotations,
        explicit: true,
        line: statement.line,
      });
      parsedStatements += 1;
      continue;
    }

    const usecase = parseUseCaseDeclaration(line);
    if (usecase) {
      if (usecase.visualPartial) {
        reportVisualStylePartial(statement);
      }
      registerNode(usecase.id, usecase.label, 'usecase', {
        alias: usecase.alias,
        annotations: usecase.annotations,
        explicit: true,
        line: statement.line,
      });
      parsedStatements += 1;
      continue;
    }

    const relationship = parseUseCaseRelationship(line);
    if (relationship) {
      if (relationship.approximation) {
        unsupportedFeatures.add(relationship.approximation);
        diagnostics.push({
          severity: 'warning',
          code: 'plantuml.usecase.arrow-hint-partial',
          message: relationship.approximation,
          line: statement.line,
          statement: line,
        });
      }

      const source = resolveUseCaseEndpoint(
        relationship.source,
        relationship.target,
        lookup,
        registerNode
      );
      const target = resolveUseCaseEndpoint(
        relationship.target,
        relationship.source,
        lookup,
        registerNode
      );
      if (!source || !target) {
        diagnostics.push({
          severity: 'warning',
          code: 'plantuml.usecase.relationship-endpoint-invalid',
          message: 'A Use Case relationship had a missing or malformed endpoint.',
          line: statement.line,
          statement: line,
        });
        continue;
      }

      edges.push({
        id: `edge-${edges.length}`,
        sourceId: relationship.reversed ? target.id : source.id,
        targetId: relationship.reversed ? source.id : target.id,
        label: relationship.label,
        isDashed: relationship.isDashed,
        type: relationship.type,
        directionHint: relationship.directionHint,
      });
      parsedStatements += 1;
      continue;
    }

    diagnostics.push({
      severity: 'warning',
      code: 'plantuml.usecase.statement-unparsed',
      message: 'This PlantUML Use Case statement could not be converted faithfully.',
      line: statement.line,
      statement: line,
      suggestion: 'Use actors, use cases, system boundaries, and supported UML relationships.',
    });
  }

  while (containerStack.length > 0) {
    const containerId = containerStack.pop()!;
    const message = `Use Case system boundary "${containerId}" was missing a closing brace and was auto-closed.`;
    unsupportedFeatures.add(message);
    diagnostics.push({
      severity: 'warning',
      code: 'plantuml.usecase.container-unclosed',
      message,
    });
  }

  return {
    type: 'usecase',
    nodes,
    edges,
    notes: [],
    groups: [],
    activations: [],
    direction,
    unsupportedFeatures: Array.from(unsupportedFeatures),
    diagnostics,
    coverage: createParseCoverage(lines.length, parsedStatements, diagnostics.length),
  };
}

function parsePlantUmlSequence(lines: PlantUMLStatement[]): ParsedPlantUML {
  const nodes: PlantUMLNode[] = [];
  const edges: PlantUMLEdge[] = [];
  const notes: PlantUMLSequenceNote[] = [];
  const groups: PlantUMLSequenceGroup[] = [];
  const activations: PlantUMLSequenceActivation[] = [];
  const unsupportedFeatures = new Set<string>();
  const diagnostics: ParseDiagnostic[] = [];
  let parsedStatements = 0;
  let hasSequenceMessages = false;

  const nodeMap = new Map<string, PlantUMLNode>();
  const openGroups: Array<{
    type: PlantUMLSequenceGroup['type'];
    label: string;
    startMessageIndex: number;
    branches?: Array<{ label: string; messageIndex: number }>;
  }> = [];
  const activationStacks = new Map<string, number[]>();
  let sequenceNumber: number | null = null;

  const registerNode = (key: string, label: string, type: PlantUMLNode['type'] = 'participant') => {
    const cleanLabel = label.replace(/^"(.*)"$/, '$1');
    if (!nodeMap.has(key)) {
      const node: PlantUMLNode = { id: `node-${nodes.length}`, name: cleanLabel, type };
      nodeMap.set(key, node);
      nodes.push(node);
    }
    return nodeMap.get(key)!;
  };

  for (const statement of lines) {
    const line = statement.text;
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("'")) {
      continue;
    }

    const pMatch = line.match(SEQUENCE_PARTICIPANT_REGEX);
    if (pMatch) {
      const type = pMatch[1] as PlantUMLNode['type'];
      const name = pMatch[2] || pMatch[3];
      const alias = pMatch[4] || pMatch[5];
      const node = registerNode(alias || name, name, type);
      if (alias) {
        nodeMap.set(name, node);
      }
      parsedStatements += 1;
      continue;
    }

    const note = parsePlantUmlNote(trimmedLine);
    if (note) {
      notes.push({
        placement: note.placement,
        participants: note.participants.map((participant) => registerNode(participant, participant).id),
        text: note.text,
        messageIndex: Math.max(edges.length - 1, 0),
      });
      parsedStatements += 1;
      continue;
    }

    const groupStart = parsePlantUmlGroupStart(trimmedLine);
    if (groupStart) {
      openGroups.push({ ...groupStart, startMessageIndex: edges.length });
      parsedStatements += 1;
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
      parsedStatements += 1;
      continue;
    }

    const activation = parsePlantUmlActivation(trimmedLine);
    if (activation) {
      const participantId = registerNode(activation.participant, activation.participant).id;
      applyActivationEvent(activationStacks, activations, participantId, activation.type, Math.max(edges.length - 1, 0));
      parsedStatements += 1;
      continue;
    }

    const autonumber = parsePlantUmlAutonumber(trimmedLine);
    if (autonumber) {
      sequenceNumber = autonumber.start;
      parsedStatements += 1;
      continue;
    }

    if (/^(title|skinparam)\b/i.test(trimmedLine)) {
      unsupportedFeatures.add('PlantUML rendering directives are not preserved in editable sequence export.');
      diagnostics.push({
        severity: 'warning',
        code: 'plantuml.sequence.directive-partial',
        message: 'This rendering directive is not preserved in editable export.',
        line: statement.line,
        statement: trimmedLine,
      });
      continue;
    }

    const branch = parsePlantUmlGroupBranch(trimmedLine);
    if (branch) {
      const currentGroup = openGroups[openGroups.length - 1];
      if (currentGroup && currentGroup.type === 'alt') {
        currentGroup.branches = [
          ...(currentGroup.branches || []),
          { label: branch.label, messageIndex: edges.length },
        ];
        parsedStatements += 1;
      } else {
        diagnostics.push({
          severity: 'warning',
          code: 'plantuml.sequence.else-unmatched',
          message: 'This branch marker is outside an alt block and could not be represented.',
          line: statement.line,
          statement: trimmedLine,
        });
      }
      continue;
    }

    const mMatch = line.match(SEQUENCE_MESSAGE_REGEX);
    if (mMatch) {
      hasSequenceMessages = true;
      const leftName = mMatch[1] || mMatch[2];
      const arrow = mMatch[3];
      const rightName = mMatch[4] || mMatch[5];
      const rawLabel = mMatch[6] || '';
      const label = sequenceNumber === null
        ? rawLabel
        : `${sequenceNumber++}${rawLabel ? ` ${rawLabel}` : ''}`;
      const reversed = arrow.includes('<');
      const sourceName = reversed ? rightName : leftName;
      const targetName = reversed ? leftName : rightName;

      const sourceNode = registerNode(sourceName, sourceName);
      const targetNode = registerNode(targetName, targetName);

      edges.push({
        id: `edge-${edges.length}`,
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        label,
        isDashed: arrow.includes('--'),
      });
      parsedStatements += 1;
      continue;
    }

    if (!/^@(?:start|end)\w+/i.test(trimmedLine)) {
      diagnostics.push({
        severity: 'warning',
        code: 'plantuml.sequence.statement-unparsed',
        message: 'This PlantUML sequence statement could not be converted faithfully.',
        line: statement.line,
        statement: trimmedLine,
        suggestion: 'Use a supported participant, message, note, activation, or group statement.',
      });
    }
  }

  closeRemainingActivations(activationStacks, activations, Math.max(edges.length - 1, 0));
  while (openGroups.length > 0) {
    const currentGroup = openGroups.pop()!;
    groups.push({
      ...currentGroup,
      endMessageIndex: Math.max(edges.length - 1, currentGroup.startMessageIndex),
    });
    unsupportedFeatures.add(`PlantUML ${currentGroup.type} block was missing an end marker and was auto-closed in export.`);
  }

  return {
    type: hasSequenceMessages ? 'sequence' : 'unsupported',
    nodes,
    edges,
    notes,
    groups,
    activations,
    unsupportedFeatures: Array.from(unsupportedFeatures),
    diagnostics,
    coverage: createParseCoverage(lines.length, parsedStatements, diagnostics.length),
  };
}

function parsePlantUmlStructural(lines: PlantUMLStatement[]): ParsedPlantUML {
  const nodes: PlantUMLNode[] = [];
  const edges: PlantUMLEdge[] = [];
  const nodeMap = new Map<string, PlantUMLNode>();
  const unsupportedFeatures = new Set<string>();
  const diagnostics: ParseDiagnostic[] = [];
  let parsedStatements = 0;
  const containerStack: string[] = [];
  let currentMemberOwner: string | null = null;
  let hasHardClassEvidence = false;
  let hasInterfaceEvidence = false;
  let hasComponentEvidence = false;
  let title: string | undefined;

  const currentFallbackFamily = (): 'class' | 'component' =>
    hasHardClassEvidence || (hasInterfaceEvidence && !hasComponentEvidence) ? 'class' : 'component';

  const markDeclarationEvidence = (type: PlantUMLNode['type'], opensMembers = false) => {
    if (type === 'class' || type === 'abstractClass' || type === 'enum' || opensMembers) {
      hasHardClassEvidence = true;
      return;
    }

    if (type === 'interface') {
      hasInterfaceEvidence = true;
      return;
    }

    if (isComponentStructuralType(type)) {
      hasComponentEvidence = true;
    }
  };

  const registerNode = (
    rawId: string,
    label: string,
    type: PlantUMLNode['type'],
    options: { parentId?: string; alias?: string } = {}
  ) => {
    const id = rawId.trim();
    const existing = nodeMap.get(id);
    if (existing) {
      if (label && existing.name === existing.id) {
        existing.name = label;
      }
      if (options.parentId && !existing.parentId) {
        existing.parentId = options.parentId;
      }
      return existing;
    }

    const node: PlantUMLNode = {
      id,
      name: label || id,
      type,
      alias: options.alias,
      parentId: options.parentId,
      annotations: [],
      attributes: [],
      methods: [],
    };
    nodeMap.set(id, node);
    nodes.push(node);
    return node;
  };

  lines.forEach((statement) => {
    const line = statement.text.trim();
    if (!line || line.startsWith("'")) {
      return;
    }

    if (/^skinparam\b/i.test(line)) {
      unsupportedFeatures.add('PlantUML skinparam directives are not preserved in editable structural export.');
      diagnostics.push({ severity: 'warning', code: 'plantuml.skinparam-partial', message: 'skinparam is visual-only.', line: statement.line, statement: line });
      return;
    }

    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      parsedStatements += 1;
      return;
    }

    if (/^(hide|show)\b/i.test(line)) {
      unsupportedFeatures.add('PlantUML hide/show directives are not preserved in editable structural export.');
      diagnostics.push({ severity: 'warning', code: 'plantuml.hide-show-partial', message: 'hide/show is visual-only.', line: statement.line, statement: line });
      return;
    }

    if (/^note\b/i.test(line)) {
      unsupportedFeatures.add('PlantUML structural notes are not preserved in editable export.');
      diagnostics.push({ severity: 'warning', code: 'plantuml.structural-note-partial', message: 'Structural notes are visual-only.', line: statement.line, statement: line });
      return;
    }

    if (/^(left\s+to\s+right|right\s+to\s+left|top\s+to\s+bottom|bottom\s+to\s+top)\s+direction$/i.test(line)) {
      parsedStatements += 1;
      return;
    }

    if (line === '}') {
      if (currentMemberOwner) {
        currentMemberOwner = null;
      } else {
        containerStack.pop();
      }
      parsedStatements += 1;
      return;
    }

    if (currentMemberOwner) {
      const node = nodeMap.get(currentMemberOwner);
      if (node) {
        addPlantUmlMember(node, line);
      }
      parsedStatements += 1;
      return;
    }

    const declaration = parsePlantUmlDeclaration(line);
    if (declaration) {
      const parentId = containerStack[containerStack.length - 1];
      const node = registerNode(declaration.id, declaration.label, declaration.type, {
        parentId,
        alias: declaration.alias,
      });

      if (declaration.annotations.length > 0) {
        node.annotations = [...(node.annotations || []), ...declaration.annotations];
      }

      declaration.inlineMembers.forEach((member) => addPlantUmlMember(node, member));
      markDeclarationEvidence(declaration.type, declaration.opensMembers);

      if (declaration.opensMembers) {
        currentMemberOwner = node.id;
        parsedStatements += 1;
        return;
      }

      if (declaration.opensContainer) {
        containerStack.push(node.id);
      }
      parsedStatements += 1;
      return;
    }

    const standaloneComponent = parseStandaloneBracketComponent(line);
    if (standaloneComponent) {
      registerNode(standaloneComponent.id, standaloneComponent.label, 'component', {
        parentId: containerStack[containerStack.length - 1],
        alias: standaloneComponent.alias,
      });
      hasComponentEvidence = true;
      parsedStatements += 1;
      return;
    }

    const relationship = parsePlantUmlRelationship(line, currentFallbackFamily());
    if (relationship) {
      const parentId = containerStack[containerStack.length - 1];
      const sourceNode = registerNode(relationship.source.id, relationship.source.label, relationship.source.type, { parentId });
      const targetNode = registerNode(relationship.target.id, relationship.target.label, relationship.target.type, { parentId });

      edges.push({
        id: `edge-${edges.length}`,
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        label: relationship.label,
        isDashed: relationship.isDashed,
        type: relationship.type,
        sourceCardinality: relationship.sourceCardinality,
        targetCardinality: relationship.targetCardinality,
        styleOverrides: relationship.styleOverrides,
      });

      markDeclarationEvidence(relationship.source.type);
      markDeclarationEvidence(relationship.target.type);
      if (!hasHardClassEvidence && !hasInterfaceEvidence && !hasComponentEvidence) {
        hasComponentEvidence = true;
      }
      parsedStatements += 1;
      return;
    }

    const memberMatch = line.match(/^(.+?)\s*:\s*(.+)$/);
    if (memberMatch) {
      const nodeId = normalizeStructuralToken(memberMatch[1]).id;
      const owner = registerNode(nodeId, nodeId, currentFallbackFamily() === 'class' ? 'class' : 'component');
      addPlantUmlMember(owner, memberMatch[2].trim());
      if (owner.type === 'class') {
        hasHardClassEvidence = true;
      } else {
        hasComponentEvidence = true;
      }
      parsedStatements += 1;
      return;
    }

    diagnostics.push({
      severity: 'warning',
      code: 'plantuml.structural.statement-unparsed',
      message: 'This PlantUML structural statement could not be converted faithfully.',
      line: statement.line,
      statement: line,
    });
  });

  const structuralType: ParsedPlantUML['type'] = hasHardClassEvidence || (!hasComponentEvidence && hasInterfaceEvidence)
    ? 'class'
    : 'unsupported';
  let direction: ParsedPlantUML['direction'];
  switch (structuralType) {
    case 'class':
      direction = 'TB';
      break;
    default:
      direction = undefined;
  }

  return {
    type: structuralType,
    nodes,
    edges,
    notes: [],
    groups: [],
    activations: [],
    direction,
    title,
    unsupportedFeatures: Array.from(unsupportedFeatures),
    diagnostics,
    coverage: createParseCoverage(lines.length, parsedStatements, diagnostics.length),
  };
}

function looksLikeUseCaseDiagram(lines: PlantUMLStatement[]) {
  const meaningful = lines
    .map((statement) => statement.text.trim())
    .filter((line) => line && !line.startsWith("'"));

  if (meaningful.some((line) =>
    /^usecase\b/i.test(line)
    || /^:[^:]+:(?:\s+as\s+\S+)?/i.test(line)
    || /^\([^()]+\)(?:\s+as\s+\S+)?/i.test(line)
  )) {
    return true;
  }

  const hasActor = meaningful.some((line) => /^actor\b/i.test(line));
  const hasUseCaseRelationship = meaningful.some((line) =>
    /(?:\([^()]+\)|:[^:]+:)\s*(?:<?[-.]+[|>]?>?)|(?:<?[-.]+[|>]?>?)\s*(?:\([^()]+\)|:[^:]+:)/.test(line)
  );
  return hasActor && hasUseCaseRelationship;
}

function parseUseCaseDirection(line: string): ParsedPlantUML['direction'] | null {
  if (/^left\s+to\s+right\s+direction$/i.test(line)) return 'LR';
  if (/^right\s+to\s+left\s+direction$/i.test(line)) return 'RL';
  if (/^top\s+to\s+bottom\s+direction$/i.test(line)) return 'TB';
  if (/^bottom\s+to\s+top\s+direction$/i.test(line)) return 'BT';
  return null;
}

function parseUseCaseUnsupportedDirective(line: string) {
  if (/^(skinparam|style|hide|show)\b/i.test(line)) {
    return {
      code: 'plantuml.usecase.style-partial',
      message: 'PlantUML Use Case styling directives are preserved only in the visual reference.',
    };
  }
  if (/^note\b/i.test(line)) {
    return {
      code: 'plantuml.usecase.note-partial',
      message: 'PlantUML Use Case notes are preserved only in the visual reference.',
    };
  }
  if (/^newpage\b/i.test(line)) {
    return {
      code: 'plantuml.usecase.newpage-partial',
      message: 'PlantUML Use Case page breaks are not represented in editable export.',
    };
  }
  if (
    /^\/.*\/(?:\s+as\s+\S+)?/i.test(line)
    || /^\([^()]+\)\/(?:\s+as\s+\S+)?/i.test(line)
    || /^(actor|usecase)\s+\/.*\//i.test(line)
  ) {
    return {
      code: 'plantuml.usecase.business-variant-partial',
      message: 'PlantUML business actor and business use-case variants are preserved only in the visual reference.',
    };
  }
  return null;
}

function parseUseCaseContainer(line: string) {
  const stripped = stripUseCaseInlineStyle(line);
  const match = stripped.text.match(/^(package|rectangle)\s+(.+?)(?:\s*\{\s*)$/i);
  if (!match) {
    return null;
  }

  const { token, annotations } = extractTrailingAnnotations(match[2].trim());
  const parsed = normalizeUseCaseNamedToken(token);
  if (!parsed) {
    return null;
  }

  return {
    ...parsed,
    type: match[1].toLowerCase() as 'package' | 'rectangle',
    annotations,
    opensBlock: true,
    visualPartial: stripped.visualPartial,
  };
}

function parseUseCaseActor(line: string) {
  const stripped = stripUseCaseInlineStyle(line);
  const keywordMatch = stripped.text.match(/^actor\s+(.+)$/i);
  const colonMatch = stripped.text.match(/^:([^:]+):(?:\s+as\s+([A-Za-z0-9_.~:-]+))?(?:\s+(<<[^>]+>>(?:\s+<<[^>]+>>)*)\s*)?$/i);
  if (colonMatch) {
    const label = colonMatch[1].trim();
    const alias = colonMatch[2];
    return {
      id: alias || label,
      label,
      alias,
      annotations: extractAnnotationList(colonMatch[3]),
      visualPartial: stripped.visualPartial,
    };
  }
  if (!keywordMatch) {
    return null;
  }

  const { token, annotations } = extractTrailingAnnotations(keywordMatch[1].trim());
  const parsed = normalizeUseCaseNamedToken(token);
  return parsed ? { ...parsed, annotations, visualPartial: stripped.visualPartial } : null;
}

function parseUseCaseDeclaration(line: string) {
  const stripped = stripUseCaseInlineStyle(line);
  const keywordMatch = stripped.text.match(/^usecase\s+(.+)$/i);
  const shorthandMatch = stripped.text.match(/^\(([\s\S]+)\)(?:\s+as\s+([A-Za-z0-9_.~:-]+))?(?:\s+(<<[^>]+>>(?:\s+<<[^>]+>>)*)\s*)?$/i);
  if (shorthandMatch) {
    const label = shorthandMatch[1].trim();
    const alias = shorthandMatch[2];
    return {
      id: alias || label,
      label,
      alias,
      annotations: extractAnnotationList(shorthandMatch[3]),
      visualPartial: stripped.visualPartial,
    };
  }
  if (!keywordMatch) {
    return null;
  }

  const { token, annotations } = extractTrailingAnnotations(keywordMatch[1].trim());
  const parsed = normalizeUseCaseNamedToken(token);
  return parsed ? { ...parsed, annotations, visualPartial: stripped.visualPartial } : null;
}

function stripUseCaseInlineStyle(line: string) {
  const text = line
    .replace(/\s+#[^\s{}]+(?=\s*\{?\s*$)/, '')
    .replace(/\s+\[[#A-Za-z][^\]]*\](?=\s*\{?\s*$)/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return {
    text,
    visualPartial: text !== line.trim(),
  };
}

function normalizeUseCaseNamedToken(raw: string) {
  const trimmed = raw.trim();
  const reversedAlias = trimmed.match(/^([A-Za-z0-9_.~:-]+)\s+as\s+(?:"([^"]+)"|:([^:]+):|\(([\s\S]+)\))$/i);
  if (reversedAlias) {
    const id = reversedAlias[1];
    return {
      id,
      label: reversedAlias[2] || reversedAlias[3] || reversedAlias[4],
      alias: id,
    };
  }

  const match = trimmed.match(/^(?:"([^"]+)"|:([^:]+):|\(([\s\S]+)\)|([A-Za-z0-9_.~:-]+))(?:\s+as\s+([A-Za-z0-9_.~:-]+))?$/);
  if (!match) {
    return null;
  }
  const label = match[1] || match[2] || match[3] || match[4];
  const alias = match[5];
  return {
    id: alias || label,
    label,
    alias,
  };
}

function extractAnnotationList(raw?: string) {
  return raw ? Array.from(raw.matchAll(/<<[^>]+>>/g)).map((match) => match[0]) : [];
}

function normalizeUseCaseLabel(value: string) {
  return value.replace(/\\n/g, '\n').trim();
}

type ParsedUseCaseAttachedNote = {
  placement: NonNullable<PlantUMLNode['notePlacement']>;
  anchor: string;
  text?: string;
};

function parseUseCaseAttachedNoteStart(line: string): ParsedUseCaseAttachedNote | null {
  const match = line.match(/^note\s+(left|right|top|bottom)\s+of\s+(.+?)(?:\s*:\s*([\s\S]+))?$/i);
  if (!match) {
    return null;
  }

  return {
    placement: normalizeUseCaseNotePlacement(match[1]),
    anchor: match[2].trim(),
    text: match[3]?.trim(),
  };
}

function parseUseCaseStandaloneNote(line: string) {
  const match = line.match(/^note\s+(?:"([\s\S]+)"|([A-Za-z0-9_.~:-]+))\s+as\s+([A-Za-z0-9_.~:-]+)$/i);
  if (!match) {
    return null;
  }

  return {
    id: match[3],
    label: match[1] || match[2],
    alias: match[3],
  };
}

function registerUseCaseNote(
  note: ParsedUseCaseAttachedNote,
  text: string,
  line: number,
  registerNode: (
    id: string,
    label: string,
    type: PlantUMLNode['type'],
    options?: {
      alias?: string;
      annotations?: string[];
      explicit?: boolean;
      line?: number;
      parentId?: string;
      noteAnchorId?: string;
      notePlacement?: PlantUMLNode['notePlacement'];
    }
  ) => PlantUMLNode,
  lookup: Map<string, PlantUMLNode>
) {
  const anchor = resolveExistingUseCaseNode(note.anchor, lookup);
  const noteIndex = Array.from(lookup.values()).filter((node) => node.type === 'note').length;
  const id = `note-${anchor?.id || sanitizeUseCaseId(note.anchor)}-${noteIndex}`;
  registerNode(id, text, 'note', {
    parentId: anchor?.parentId,
    noteAnchorId: anchor?.id || sanitizeUseCaseId(note.anchor),
    notePlacement: note.placement,
    explicit: true,
    line,
  });
}

function resolveExistingUseCaseNode(raw: string, lookup: Map<string, PlantUMLNode>) {
  const token = raw.trim();
  const wrappedLabel = token.match(/^\(([\s\S]+)\)$/)?.[1]
    || token.match(/^:([^:]+):$/)?.[1]
    || token.match(/^"([^"]+)"$/)?.[1];
  return lookup.get(token) || (wrappedLabel ? lookup.get(normalizeUseCaseLabel(wrappedLabel)) : undefined);
}

function sanitizeUseCaseId(value: string) {
  return normalizeUseCaseLabel(value)
    .replace(/^[:(]|[:)]$/g, '')
    .replace(/^"|"$/g, '')
    .replace(/[^A-Za-z0-9_.:~-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'note';
}

function normalizeUseCaseNotePlacement(value: string): NonNullable<PlantUMLNode['notePlacement']> {
  const placement = value.toLowerCase();
  return placement === 'top' || placement === 'bottom' || placement === 'left' || placement === 'right'
    ? placement
    : 'right';
}

function parseUseCaseRelationship(line: string) {
  let body = line;
  let approximation: string | undefined;
  let directionHint: PlantUMLEdge['directionHint'];

  const directionMatch = body.match(/[-.](left|right|up|down|l|r|u|d)[-.]/i);
  if (directionMatch) {
    directionHint = normalizeUseCaseDirectionHint(directionMatch[1]);
  }

  if (/[-.]\s*(left|right|up|down|l|r|u|d)\s*[-.]/i.test(body) || /\.{3,}|-{3,}/.test(body)) {
    approximation = 'PlantUML Use Case directional and length arrow hints are simplified in editable export.';
    body = body
      .replace(/[-.]\s*(left|right|up|down|l|r|u|d)\s*[-.]/ig, (match) => match.includes('.') ? '..' : '--')
      .replace(/-{3,}/g, '--')
      .replace(/\.{3,}/g, '..');
  }

  const operatorMatch = body.match(/(<\|--|--\|>|<\.\.|\.\.>|<-+|-+>|<--|-->|<\.\.|\.\.>|<\.|\.>|--|\.\.)/);
  if (!operatorMatch || operatorMatch.index === undefined) {
    return null;
  }

  const operator = operatorMatch[1];
  const source = body.slice(0, operatorMatch.index).trim();
  const targetAndLabel = splitUseCaseTargetAndLabel(
    body.slice(operatorMatch.index + operator.length).trim()
  );
  const target = targetAndLabel.target;
  if (!source || !target) {
    return {
      source,
      target,
      label: targetAndLabel.label,
      isDashed: operator.includes('.'),
      type: 'association',
      reversed: false,
      approximation,
      directionHint,
    };
  }

  const stereotype = targetAndLabel.label.toLowerCase();
  const type = operator.includes('|')
    ? 'generalization'
    : stereotype.includes('include') || stereotype.includes('extend')
      ? 'dependency'
      : operator.includes('.')
        ? 'dependency'
        : operator.includes('>')
          ? 'directedAssociation'
          : 'association';

  return {
    source,
    target,
    label: targetAndLabel.label,
    isDashed: operator.includes('.') || type === 'dependency',
    type,
    reversed: operator.startsWith('<'),
    approximation,
    directionHint,
  };
}

function normalizeUseCaseDirectionHint(value: string): PlantUMLEdge['directionHint'] {
  switch (value.toLowerCase()) {
    case 'l':
    case 'left':
      return 'left';
    case 'r':
    case 'right':
      return 'right';
    case 'u':
    case 'up':
      return 'up';
    case 'd':
    case 'down':
      return 'down';
    default:
      return undefined;
  }
}

function splitUseCaseTargetAndLabel(raw: string) {
  if (raw.startsWith(':')) {
    const closingColon = raw.indexOf(':', 1);
    if (closingColon !== -1) {
      const labelSeparator = raw.indexOf(':', closingColon + 1);
      if (labelSeparator !== -1) {
        return {
          target: raw.slice(0, labelSeparator).trim(),
          label: raw.slice(labelSeparator + 1).trim(),
        };
      }
    }
  }

  const separator = raw.search(/\s+:\s*/);
  return separator === -1
    ? { target: raw.trim(), label: '' }
    : {
        target: raw.slice(0, separator).trim(),
        label: raw.slice(separator).replace(/^\s*:\s*/, '').trim(),
      };
}

function resolveUseCaseEndpoint(
  raw: string,
  otherRaw: string,
  lookup: Map<string, PlantUMLNode>,
  registerNode: (
    id: string,
    label: string,
    type: PlantUMLNode['type'],
    options?: { alias?: string; annotations?: string[]; explicit?: boolean; line?: number }
  ) => PlantUMLNode
) {
  const token = raw.trim();
  const wrappedLabel = token.match(/^\(([\s\S]+)\)$/)?.[1]
    || token.match(/^:([^:]+):$/)?.[1]
    || token.match(/^"([^"]+)"$/)?.[1];
  const existing = lookup.get(token) || (wrappedLabel ? lookup.get(wrappedLabel.trim()) : undefined);
  if (existing) {
    return existing;
  }

  const actor = parseUseCaseActor(token);
  if (actor) {
    return registerNode(actor.id, actor.label, 'actor', {
      alias: actor.alias,
      annotations: actor.annotations,
    });
  }
  const usecase = parseUseCaseDeclaration(token);
  if (usecase) {
    return registerNode(usecase.id, usecase.label, 'usecase', {
      alias: usecase.alias,
      annotations: usecase.annotations,
    });
  }

  const quoted = token.match(/^"([^"]+)"$/);
  const label = quoted ? quoted[1] : token;
  if (!label) {
    return null;
  }
  const otherLooksLikeActor = /^actor\b/i.test(otherRaw) || /^:[^:]+:/.test(otherRaw);
  const inferredType: PlantUMLNode['type'] = otherLooksLikeActor ? 'usecase' : 'actor';
  return registerNode(label, label, inferredType);
}

function looksLikeStructuralDiagram(lines: PlantUMLStatement[]) {
  return lines.some((statement) => {
    const trimmed = statement.text.trim();
    if (!trimmed || trimmed.startsWith("'")) {
      return false;
    }

    if (SEQUENCE_MESSAGE_REGEX.test(trimmed)) {
      return false;
    }

    return STRUCTURAL_KEYWORD_REGEX.test(trimmed)
      || /^\[[^\]]+\](?:\s+as\s+\w+)?(?:\s*\{)?$/.test(trimmed)
      || RELATIONSHIP_OPERATORS.some((operator) => trimmed.includes(operator));
  });
}

function hasExplicitSequenceSyntax(lines: PlantUMLStatement[]) {
  return lines.some((statement) => {
    const trimmed = statement.text.trim();
    if (!trimmed || trimmed.startsWith("'")) {
      return false;
    }

    return /^participant\b/i.test(trimmed)
      || /^(loop|alt|opt|par|critical|break|group|note|activate|deactivate)\b/i.test(trimmed)
      || /->>|-->>/.test(trimmed);
  });
}

function parsePlantUmlDeclaration(line: string): ParsedPlantUmlDeclaration | null {
  const match = line.match(/^(abstract\s+class|class|interface|enum|component|package|node|cloud|folder|rectangle|database|queue|actor|usecase)\b\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const type = normalizeDeclarationType(match[1]);
  const split = splitDeclarationHeaderAndBody(match[2].trim());
  const { token, annotations } = extractTrailingAnnotations(split.header);
  const parsed = normalizeStructuralToken(token, type);
  const isClassFamily = type === 'class' || type === 'abstractClass' || type === 'interface' || type === 'enum';

  return {
    type,
    id: parsed.id,
    label: parsed.label,
    alias: parsed.alias,
    annotations,
    inlineMembers: split.inlineMembers,
    opensMembers: split.opensBlock && !split.closesBlock && isClassFamily,
    opensContainer: split.opensBlock && !split.closesBlock && !isClassFamily,
  };
}

function splitDeclarationHeaderAndBody(raw: string) {
  const openIndex = raw.indexOf('{');
  if (openIndex === -1) {
    return { header: raw.trim(), inlineMembers: [] as string[], opensBlock: false, closesBlock: false };
  }

  const closeIndex = raw.lastIndexOf('}');
  const header = raw.slice(0, openIndex).trim();
  const body = closeIndex > openIndex
    ? raw.slice(openIndex + 1, closeIndex).trim()
    : raw.slice(openIndex + 1).trim();

  return {
    header,
    inlineMembers: parseInlineMembers(body),
    opensBlock: true,
    closesBlock: closeIndex > openIndex,
  };
}

function extractTrailingAnnotations(rawHeader: string) {
  const annotations = Array.from(rawHeader.matchAll(/<<[^>]+>>/g)).map((match) => match[0]);
  const token = rawHeader.replace(/<<[^>]+>>/g, '').trim();
  return { token, annotations };
}

function parseInlineMembers(body: string) {
  if (!body) {
    return [];
  }

  const compactBody = body.replace(/\s+/g, ' ').trim();
  const matches = compactBody.match(/(?:^|\s)([+#\-~][^+#\-~]*?)(?=\s+[+#\-~]|$)/g);
  return matches ? matches.map((member) => member.trim()) : [];
}

function parseStandaloneBracketComponent(line: string) {
  const match = line.match(/^\[([^\]]+)\](?:\s+as\s+([A-Za-z0-9_.~:-]+))?$/);
  if (!match) {
    return null;
  }

  return {
    id: match[2] || sanitizeStructuralId(match[1]),
    label: match[1].trim(),
    alias: match[2],
  };
}
function normalizeDeclarationType(rawType: string): PlantUMLNode['type'] {
  switch (rawType.toLowerCase()) {
    case 'abstract class':
      return 'abstractClass';
    default:
      return rawType.toLowerCase().replace(/\s+/g, '') as PlantUMLNode['type'];
  }
}

function isComponentStructuralType(type: PlantUMLNode['type']) {
  return type === 'actor'
    || type === 'component'
    || type === 'package'
    || type === 'node'
    || type === 'cloud'
    || type === 'folder'
    || type === 'rectangle'
    || type === 'database'
    || type === 'queue'
    || type === 'usecase';
}

function normalizeStructuralToken(rawToken: string, fallbackType: PlantUMLNode['type'] = 'component') {
  const aliasMatch = rawToken.match(/^(?:"([^"]+)"|\[([^\]]+)\]|([A-Za-z0-9_.~:-]+))(?:\s+as\s+([A-Za-z0-9_.~:-]+))?$/);
  if (aliasMatch) {
    const label = aliasMatch[1] || aliasMatch[2] || aliasMatch[3];
    const alias = aliasMatch[4];
    return {
      id: alias || sanitizeStructuralId(label),
      label: label.trim(),
      alias,
      type: aliasMatch[2] ? 'component' : fallbackType,
    };
  }

  const trimmed = rawToken.trim().replace(/^"(.*)"$/, '$1');
  return {
    id: sanitizeStructuralId(trimmed),
    label: trimmed,
    type: fallbackType,
  };
}

function sanitizeStructuralId(value: string) {
  return value.trim();
}

function parsePlantUmlRelationship(line: string, fallbackFamily: 'class' | 'component') {
  const labelMatch = line.match(/^(.*?)(?:\s*:\s*(.+))?$/);
  if (!labelMatch) {
    return null;
  }

  const relationshipBody = labelMatch[1].trim();
  const label = (labelMatch[2] || '').trim();
  const operatorMatch = findRelationshipOperator(relationshipBody);
  if (!operatorMatch) {
    return null;
  }

  const { operator, start, end } = operatorMatch;
  const leftRaw = relationshipBody.slice(0, start);
  const rightRaw = relationshipBody.slice(end);
  if (!leftRaw || !rightRaw) {
    return null;
  }

  const left = parseRelationshipEndpoint(leftRaw, fallbackFamily, 'left');
  const right = parseRelationshipEndpoint(rightRaw, fallbackFamily, 'right');
  const reversed = operator.startsWith('<');
  const source = reversed ? right : left;
  const target = reversed ? left : right;

  return {
    source,
    target,
    label,
    isDashed: operator.includes('..'),
    type: getRelationshipType(operator),
    sourceCardinality: reversed ? right.cardinality : left.cardinality,
    targetCardinality: reversed ? left.cardinality : right.cardinality,
    styleOverrides: getRelationshipStyleOverrides(operator),
  };
}

function findRelationshipOperator(relationshipBody: string) {
  let quote: string | null = null;

  for (let index = 0; index < relationshipBody.length; index += 1) {
    const char = relationshipBody[index];
    if ((char === '"' || char === "'") && relationshipBody[index - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
      continue;
    }

    if (quote) {
      continue;
    }

    const operator = RELATIONSHIP_OPERATORS.find((candidate) => relationshipBody.startsWith(candidate, index));
    if (operator) {
      return {
        operator,
        start: index,
        end: index + operator.length,
      };
    }
  }

  return null;
}

function parseRelationshipEndpoint(
  rawEndpoint: string,
  fallbackFamily: 'class' | 'component',
  side: 'left' | 'right'
) {
  const cardinalityMatch = side === 'left'
    ? rawEndpoint.match(/^(.*?)(?:\s+"([^"]+)")?\s*$/)
    : rawEndpoint.match(/^\s*(?:"([^"]+)")?\s*(.*?)$/);
  const body = side === 'left'
    ? (cardinalityMatch?.[1]?.trim() || rawEndpoint.trim())
    : (cardinalityMatch?.[2]?.trim() || rawEndpoint.trim());
  const cardinality = side === 'left'
    ? cardinalityMatch?.[2]?.trim()
    : cardinalityMatch?.[1]?.trim();
  const parsed = normalizeStructuralToken(body, fallbackFamily === 'class' ? 'class' : 'component');

  return {
    id: parsed.id,
    label: parsed.label,
    type: parsed.type,
    cardinality,
  };
}

function getRelationshipType(operator: string) {
  if (operator.includes('|')) {
    return operator.includes('..') ? 'realization' : 'generalization';
  }
  if (operator.includes('*')) {
    return 'composition';
  }
  if (operator.includes('o')) {
    return 'aggregation';
  }
  if (operator.includes('..')) {
    return operator.includes('>') || operator.startsWith('<') ? 'dependency' : 'association';
  }
  if (operator.includes('>') || operator.startsWith('<')) {
    return 'directedAssociation';
  }
  return 'association';
}

function getRelationshipStyleOverrides(operator: string) {
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

function addPlantUmlMember(node: PlantUMLNode, rawMember: string) {
  const member = rawMember.trim();
  if (!member) {
    return;
  }

  if (/^<<[^>]+>>$/.test(member) || /^\{[^}]+\}$/.test(member)) {
    node.annotations = [...(node.annotations || []), member];
    return;
  }

  if (member.includes('(')) {
    node.methods = [...(node.methods || []), member];
    return;
  }

  node.attributes = [...(node.attributes || []), member];
}

function parsePlantUmlNote(line: string) {
  const match = line.match(/^note\s+(left of|right of|over)\s+(.+?)\s*:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    placement: match[1].toLowerCase() as PlantUMLSequenceNote['placement'],
    participants: match[2].split(',').map((value) => value.trim()),
    text: match[3].trim(),
  };
}

function parsePlantUmlGroupStart(line: string) {
  const match = line.match(/^(loop|alt|opt|par|critical|break|group)\b(?:#[A-Za-z0-9]+(?:\s+#[A-Za-z0-9]+)?)?(?:\s+(.*))?$/i);
  if (!match) {
    return null;
  }

  return {
    type: match[1].toLowerCase() as PlantUMLSequenceGroup['type'],
    label: (match[2] || '').trim(),
  };
}

function parsePlantUmlGroupBranch(line: string) {
  const match = line.match(/^else\b(?:#[A-Za-z0-9]+(?:\s+#[A-Za-z0-9]+)?)?(?:\s+(.*))?$/i);
  if (!match) {
    return null;
  }

  return {
    label: (match[1] || '').trim(),
  };
}

function parsePlantUmlAutonumber(line: string) {
  const match = line.match(/^autonumber(?:\s+(\d+))?\b/i);
  if (!match) {
    return null;
  }

  return {
    start: match[1] ? Number(match[1]) : 1,
  };
}

function parsePlantUmlActivation(line: string) {
  const match = line.match(/^(activate|deactivate)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    type: match[1].toLowerCase() as 'activate' | 'deactivate',
    participant: match[2].trim().replace(/^"(.*)"$/, '$1'),
  };
}

function applyActivationEvent(
  activationStacks: Map<string, number[]>,
  activations: PlantUMLSequenceActivation[],
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
  activations: PlantUMLSequenceActivation[],
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

function finalizePlantUmlResult(result: ParsedPlantUML, lines: PlantUMLStatement[]) {
  result.diagnostics ||= [];
  result.coverage ||= createParseCoverage(lines.length, Math.max(0, lines.length - result.diagnostics.length), result.diagnostics.length);
  if (result.type === 'unsupported' && result.diagnostics.length === 0 && lines.length > 0) {
    result.diagnostics.push({
      severity: 'warning',
      code: 'plantuml.family-unsupported',
      message: 'No supported editable PlantUML statements were detected.',
      line: lines[0].line,
      statement: lines[0].text,
    });
    result.coverage = createParseCoverage(lines.length, 0, lines.length);
  }
  result.diagnostics.push(...validateAstInvariants(
    result.nodes,
    result.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
    })),
    'plantuml.ast'
  ));
  if (result.diagnostics.some((diagnostic) => diagnostic.severity === 'error') && result.coverage) {
    result.coverage = {
      ...result.coverage,
      fidelity: 'partial',
      statementsIgnored: Math.max(1, result.coverage.statementsIgnored),
    };
  }
  return result;
}
