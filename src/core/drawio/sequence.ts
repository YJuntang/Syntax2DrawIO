import { DrawioXmlBuilder } from './builder';
import {
  findRenderHintNode,
  getRenderHintMessageY,
  renderHintsHaveAllNodes,
  type RenderHintSet,
} from './renderHints';
import { UML_STYLES } from './styles';
import { formatUmlAnnotation } from './umlLabels';

export interface SequenceParticipant {
  id: string;
  label: string;
  type?: string;
}

export interface SequenceMessage {
  id?: string;
  source: string;
  target: string;
  label?: string;
  isDashed?: boolean;
  isSelf?: boolean;
}

export interface SequenceNote {
  placement: 'left of' | 'right of' | 'over';
  participants: string[];
  text: string;
  messageIndex: number;
}

export interface SequenceGroup {
  type: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'rect' | 'group';
  label: string;
  startMessageIndex: number;
  endMessageIndex: number;
  branches?: Array<{ label: string; messageIndex: number }>;
}

export interface SequenceActivation {
  participantId: string;
  startMessageIndex: number;
  endMessageIndex: number;
  depth: number;
}

export interface SequenceExtras {
  notes?: SequenceNote[];
  groups?: SequenceGroup[];
  activations?: SequenceActivation[];
  renderHints?: RenderHintSet;
}

type SequenceLifeline = { x: number; y: number; width: number; height: number; center: number };
type SequenceNoteLayout = { x: number; y: number; width: number; height: number };
type SequenceGroupBounds = { left: number; right: number; top?: number; bottom?: number };

export function convertSequenceToDrawio(
  participants: SequenceParticipant[],
  messages: SequenceMessage[],
  extras: SequenceExtras = {}
): string {
  const builder = new DrawioXmlBuilder();
  const maxParticipantLabel = participants.reduce((max, participant) => Math.max(max, participant.label.length), 0);
  const maxMessageLabel = messages.reduce((max, message) => Math.max(max, (message.label || '').length), 0);
  const lifelineWidth = Math.max(100, Math.ceil(maxParticipantLabel * 7.5) + 32);
  const spacingX = Math.max(150, Math.ceil(maxMessageLabel * 4.5) + 110);
  const baseMessageSpacingY = Math.max(40, Math.ceil(maxMessageLabel / 28) * 18 + 28);
  const extraSelfMessageHeight = 24;
  const startY = 40;
  const startX = 40;
  const messageYByIndex = new Map<number, number>();
  const lifelineHeight = 80 + messages.reduce((height, message) => {
    return height + baseMessageSpacingY + ((message.isSelf || message.source === message.target) ? extraSelfMessageHeight : 0);
  }, 0);
  const renderNodes = extras.renderHints?.nodes || [];
  const renderEdges = extras.renderHints?.edges || [];
  const canUseParticipantHints = renderHintsHaveAllNodes(participants, renderNodes);
  const lifelines: Record<string, SequenceLifeline> = {};

  participants.forEach((participant, index) => {
    const rendered = canUseParticipantHints
      ? findRenderHintNode(renderNodes, participant.id, participant.label)
      : undefined;
    const width = Math.max(lifelineWidth, rendered?.width || 0);
    const height = Math.max(lifelineHeight, rendered?.height || 0);
    const x = rendered ? rendered.x : startX + (index * spacingX);
    const y = rendered ? rendered.y : startY;
    const style = getParticipantStyle(participant.type);

    builder.addVertex(participant.id, formatParticipantLabel(participant), x, y, width, height, style);
    lifelines[participant.id] = {
      x,
      y,
      width,
      height,
      center: x + (width / 2),
    };
  });

  let messageY = startY + 60;
  messages.forEach((message, index) => {
    const source = lifelines[message.source];
    const target = lifelines[message.target];

    if (!source || !target) {
      return;
    }

    const hintedMessageY = getRenderHintMessageY(renderEdges, index, messageY, message.id || `edge-${index}`);
    messageYByIndex.set(index, hintedMessageY);

    const edgeId = message.id || `edge-${index}`;
    const sourceRelativeY = clamp((hintedMessageY - source.y) / source.height, 0.02, 0.98);
    const targetRelativeY = clamp((hintedMessageY - target.y) / target.height, 0.02, 0.98);
    const isSelf = message.isSelf || message.source === message.target;
    const isRight = target.x > source.x;
    let style = `html=1;verticalAlign=bottom;endArrow=block;endFill=1;rounded=0;${message.isDashed ? 'dashed=1;' : ''}`;

    if (isSelf) {
      const returnY = clamp((hintedMessageY + extraSelfMessageHeight - source.y) / source.height, 0.02, 0.98);
      style += `edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=${sourceRelativeY};entryX=1;entryY=${returnY};`;
      builder.addEdge(edgeId, message.source, message.target, message.label || '', style, [
        { x: source.center + 48, y: hintedMessageY },
        { x: source.center + 48, y: hintedMessageY + extraSelfMessageHeight },
      ]);
      messageY += baseMessageSpacingY + extraSelfMessageHeight;
      return;
    }

    const exitX = isRight ? 1 : 0;
    const entryX = isRight ? 0 : 1;
    style += `exitX=${exitX};exitY=${sourceRelativeY};entryX=${entryX};entryY=${targetRelativeY};`;
    builder.addEdge(edgeId, message.source, message.target, message.label || '', style);
    messageY += baseMessageSpacingY;
  });

  addSequenceActivations(builder, lifelines, messageYByIndex, baseMessageSpacingY, extras.activations || [], renderNodes);
  addSequenceGroups(
    builder,
    participants,
    messages,
    lifelines,
    messageYByIndex,
    baseMessageSpacingY,
    extras.groups || [],
    extras.notes || [],
    renderNodes
  );
  addSequenceNotes(builder, lifelines, messageYByIndex, extras.notes || [], renderNodes);

  return builder.toXml();
}

function addSequenceActivations(
  builder: DrawioXmlBuilder,
  lifelines: Record<string, SequenceLifeline>,
  messageYByIndex: Map<number, number>,
  baseMessageSpacingY: number,
  activations: SequenceActivation[],
  renderNodes: RenderHintSet['nodes']
) {
  activations.forEach((activation, index) => {
    const lifeline = lifelines[activation.participantId];
    if (!lifeline) {
      return;
    }

    const rendered = findRenderHintNode(renderNodes, `activation-${index}`);
    const startMessageY = messageYByIndex.get(activation.startMessageIndex) ?? (lifeline.y + 60);
    const endMessageY = messageYByIndex.get(activation.endMessageIndex) ?? startMessageY;
    const offsetX = rendered ? rendered.x - lifeline.x : Math.max(0, (lifeline.width / 2) - 6 + (activation.depth * 10));
    const height = rendered?.height ? Math.max(12, rendered.height) : Math.max(28, (endMessageY - startMessageY) + baseMessageSpacingY);
    builder.addChildVertex(
      `activation-${index}`,
      '',
      activation.participantId,
      rendered?.width ? Math.max(8, rendered.width) : 12,
      height,
      'rounded=0;html=1;fillColor=#dbeafe;strokeColor=#2563eb;',
      {
        x: offsetX,
        y: rendered ? rendered.y - lifeline.y : startMessageY - lifeline.y,
        connectable: false,
      }
    );
  });
}

function addSequenceGroups(
  builder: DrawioXmlBuilder,
  participants: SequenceParticipant[],
  messages: SequenceMessage[],
  lifelines: Record<string, SequenceLifeline>,
  messageYByIndex: Map<number, number>,
  baseMessageSpacingY: number,
  groups: SequenceGroup[],
  notes: SequenceNote[],
  renderNodes: RenderHintSet['nodes']
) {
  if (participants.length === 0) {
    return;
  }

  const fallbackBounds = getGroupBoundsForParticipants(
    participants.map((participant) => participant.id),
    lifelines
  );
  if (!fallbackBounds) {
    return;
  }

  groups.forEach((group, index) => {
    const title = `${group.type}${group.label ? `  ${group.label}` : ''}`;
    const groupBounds = getSequenceGroupBounds(group, messages, lifelines, notes, messageYByIndex, renderNodes)
      || fallbackBounds;
    const startY = Math.min(
      (messageYByIndex.get(group.startMessageIndex) ?? 100) - 24,
      groupBounds.top ?? Number.POSITIVE_INFINITY
    );
    const endY = Math.max(
      (messageYByIndex.get(group.endMessageIndex) ?? startY) + baseMessageSpacingY,
      groupBounds.bottom ?? Number.NEGATIVE_INFINITY
    );
    const isRect = group.type === 'rect';
    builder.addVertex(
      `group-${index}`,
      '',
      groupBounds.left,
      startY,
      Math.max(groupBounds.right - groupBounds.left, Math.max(150, Math.min(330, title.length * 7 + 24)) + 8),
      Math.max(48, endY - startY),
      isRect
        ? 'rounded=0;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=none;opacity=35;'
        : 'rounded=0;whiteSpace=wrap;html=1;fillColor=none;dashed=1;strokeColor=#64748b;'
    );
    if (!isRect) {
      builder.addVertex(
        `group-${index}-title`,
        title,
        groupBounds.left + 2,
        startY + 2,
        Math.max(150, Math.min(330, title.length * 7 + 24)),
        26,
        'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#64748b;fontStyle=1;align=left;spacingLeft=8;'
      );
      (group.branches || []).forEach((branch, branchIndex) => {
        const branchY = getSequenceGroupBranchY(branch.messageIndex, messageYByIndex, baseMessageSpacingY, startY, endY);
        const branchLabel = branch.label ? `[${branch.label}]` : '';
        builder.addVertex(
          `group-${index}-branch-${branchIndex}-line`,
          '',
          groupBounds.left,
          branchY,
          Math.max(1, groupBounds.right - groupBounds.left),
          1,
          'shape=line;html=1;strokeColor=#64748b;dashed=1;'
        );
        if (branchLabel) {
          builder.addVertex(
            `group-${index}-branch-${branchIndex}-label`,
            branchLabel,
            groupBounds.left + 8,
            branchY + 4,
            Math.max(110, Math.min(300, branchLabel.length * 7 + 16)),
            22,
            'text;html=1;strokeColor=none;fillColor=none;fontStyle=1;align=left;verticalAlign=top;spacingLeft=0;'
          );
        }
      });
    }
  });
}

function getSequenceGroupBranchY(
  messageIndex: number,
  messageYByIndex: Map<number, number>,
  baseMessageSpacingY: number,
  groupStartY: number,
  groupEndY: number
) {
  const nextMessageY = messageYByIndex.get(messageIndex);
  if (nextMessageY !== undefined) {
    return clamp(nextMessageY - (baseMessageSpacingY / 2), groupStartY + 32, groupEndY - 18);
  }

  const previousMessageY = messageYByIndex.get(messageIndex - 1);
  if (previousMessageY !== undefined) {
    return clamp(previousMessageY + (baseMessageSpacingY / 2), groupStartY + 32, groupEndY - 18);
  }

  return clamp(groupStartY + baseMessageSpacingY, groupStartY + 32, groupEndY - 18);
}

function getSequenceGroupBounds(
  group: SequenceGroup,
  messages: SequenceMessage[],
  lifelines: Record<string, SequenceLifeline>,
  notes: SequenceNote[],
  messageYByIndex: Map<number, number>,
  renderNodes: RenderHintSet['nodes']
): SequenceGroupBounds | null {
  const participantIds = new Set<string>();

  messages.slice(group.startMessageIndex, group.endMessageIndex + 1).forEach((message) => {
    participantIds.add(message.source);
    participantIds.add(message.target);
  });

  const groupNotes = notes.filter((note) => (
    note.messageIndex >= group.startMessageIndex && note.messageIndex <= group.endMessageIndex
  ));
  groupNotes.forEach((note) => note.participants.forEach((participantId) => participantIds.add(participantId)));

  const participantBounds = getGroupBoundsForParticipants([...participantIds], lifelines);
  const noteBounds = groupNotes
    .map((note, index) => getSequenceNoteLayout(note, index, lifelines, messageYByIndex, renderNodes))
    .filter((layout): layout is SequenceNoteLayout => Boolean(layout));

  const horizontalBounds = [
    ...(participantBounds ? [{ left: participantBounds.left, right: participantBounds.right }] : []),
    ...noteBounds.map((layout) => ({ left: layout.x - 12, right: layout.x + layout.width + 12 })),
  ];

  if (horizontalBounds.length === 0) {
    return null;
  }

  return {
    left: Math.min(...horizontalBounds.map((bounds) => bounds.left)),
    right: Math.max(...horizontalBounds.map((bounds) => bounds.right)),
    top: noteBounds.length > 0 ? Math.min(...noteBounds.map((layout) => layout.y - 8)) : undefined,
    bottom: noteBounds.length > 0 ? Math.max(...noteBounds.map((layout) => layout.y + layout.height + 8)) : undefined,
  };
}

function getGroupBoundsForParticipants(
  participantIds: string[],
  lifelines: Record<string, SequenceLifeline>
): SequenceGroupBounds | null {
  const relatedLifelines = participantIds
    .map((participantId) => lifelines[participantId])
    .filter((lifeline): lifeline is SequenceLifeline => Boolean(lifeline));

  if (relatedLifelines.length === 0) {
    return null;
  }

  const minCenter = Math.min(...relatedLifelines.map((lifeline) => lifeline.center));
  const maxCenter = Math.max(...relatedLifelines.map((lifeline) => lifeline.center));

  return {
    left: minCenter - 28,
    right: maxCenter + 28,
  };
}

function getParticipantStyle(type?: string) {
  const lifelineBase = `${UML_STYLES.lifeline}fillColor=#f5f3ff;strokeColor=#c4b5fd;`;
  switch (type) {
    case 'actor':
      return `${lifelineBase}fontStyle=1;`;
    case 'boundary':
      return `${UML_STYLES.lifeline}fillColor=#e0f2fe;strokeColor=#0284c7;`;
    case 'control':
      return `${UML_STYLES.lifeline}fillColor=#fef3c7;strokeColor=#d97706;`;
    case 'entity':
      return `${UML_STYLES.lifeline}fillColor=#dcfce7;strokeColor=#16a34a;`;
    case 'database':
      return `${UML_STYLES.lifeline}fillColor=#ede9fe;strokeColor=#7c3aed;`;
    default:
      return lifelineBase;
  }
}

function formatParticipantLabel(participant: SequenceParticipant) {
  switch (participant.type) {
    case 'boundary':
    case 'control':
    case 'entity':
    case 'database':
      return `${formatUmlAnnotation(`<<${participant.type}>>`)}\n${participant.label}`;
    default:
      return participant.label;
  }
}

function addSequenceNotes(
  builder: DrawioXmlBuilder,
  lifelines: Record<string, SequenceLifeline>,
  messageYByIndex: Map<number, number>,
  notes: SequenceNote[],
  renderNodes: RenderHintSet['nodes']
) {
  notes.forEach((note, index) => {
    const layout = getSequenceNoteLayout(note, index, lifelines, messageYByIndex, renderNodes);
    if (!layout) {
      return;
    }

    builder.addVertex(
      `note-${index}`,
      note.text,
      layout.x,
      layout.y,
      layout.width,
      layout.height,
      UML_STYLES.note
    );
  });
}

function getSequenceNoteLayout(
  note: SequenceNote,
  index: number,
  lifelines: Record<string, SequenceLifeline>,
  messageYByIndex: Map<number, number>,
  renderNodes: RenderHintSet['nodes']
): SequenceNoteLayout | null {
  const rendered = findRenderHintNode(renderNodes, `note-${index}`, note.text);
  const anchorY = messageYByIndex.get(note.messageIndex) ?? 100;
  const noteWidth = rendered?.width ? Math.max(80, rendered.width) : Math.max(120, Math.min(220, note.text.length * 6));
  const noteHeight = rendered?.height ? Math.max(36, rendered.height) : Math.max(48, Math.ceil(note.text.length / 28) * 18 + 24);
  const relatedLifelines = note.participants
    .map((participantId) => lifelines[participantId])
    .filter((lifeline): lifeline is SequenceLifeline => Boolean(lifeline));

  if (relatedLifelines.length === 0) {
    return null;
  }

  const minCenter = Math.min(...relatedLifelines.map((lifeline) => lifeline.center));
  const maxCenter = Math.max(...relatedLifelines.map((lifeline) => lifeline.center));
  let x = rendered?.x ?? minCenter - (noteWidth / 2);

  if (!rendered && note.placement === 'left of') {
    x = minCenter - noteWidth - (relatedLifelines[0].width / 2) - 16;
  } else if (!rendered && note.placement === 'right of') {
    x = maxCenter + (relatedLifelines[relatedLifelines.length - 1].width / 2) + 16;
  }

  const y = rendered?.y ?? (note.placement === 'over'
    ? anchorY - noteHeight - 10
    : anchorY + 12);

  return {
    x,
    y,
    width: noteWidth,
    height: noteHeight,
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
