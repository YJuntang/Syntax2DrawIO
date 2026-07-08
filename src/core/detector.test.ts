import { expect, test } from 'vitest';
import { detectDiagramType } from './detector';

test.each([
  ['\uFEFF%% comment\r\nflowchart TD\r\nA-->B', 'flowchart'],
  ['%%{init: {"theme": "dark"}}%%\nsequenceDiagram\nA->>B: hi', 'sequence'],
  ['---\ntitle: Demo\n---\nclassDiagram\nclass User', 'classDiagram'],
  ['SEQUENCEDIAGRAM\nA->>B: hi', 'sequence'],
])('detects Mermaid after supported preambles', (source, subtype) => {
  expect(detectDiagramType(source)).toMatchObject({
    detected: 'mermaid',
    subtype,
    confidence: 1,
  });
});

test('detects case-insensitive PlantUML wrappers with a title', () => {
  expect(detectDiagramType('@STARTUML checkout\nAlice -> Bob\n@ENDUML')).toMatchObject({
    detected: 'plantuml',
    confidence: 1,
  });
});
