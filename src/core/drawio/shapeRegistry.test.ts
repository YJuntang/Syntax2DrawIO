import { expect, test } from 'vitest';
import { getDrawioNodeStyle, getMermaidEdgeStyle, getMermaidNodeStyle } from './shapeRegistry';

test('registry maps Mermaid flowchart semantics to native draw.io styles', () => {
  expect(getMermaidNodeStyle('doc')).toContain('shape=document');
  expect(getMermaidNodeStyle('manual_input')).toContain('shape=manualInput');
  expect(getMermaidEdgeStyle('dotted')).toContain('dashed=1');
});

test('registry maps PlantUML component semantics to native draw.io styles', () => {
  expect(getDrawioNodeStyle('component.node')).toContain('shape=cube');
  expect(getDrawioNodeStyle('component.cloud')).toContain('shape=cloud');
  expect(getDrawioNodeStyle('component.database')).toContain('shape=cylinder3');
  expect(getDrawioNodeStyle('component.queue')).toContain('shape=internalStorage');
  expect(getDrawioNodeStyle('component.usecase')).toContain('ellipse');
  expect(getDrawioNodeStyle('uml.actor')).toContain('shape=umlActor');
});
