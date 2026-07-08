import { test, expect } from 'vitest';
import { preprocessPlantUML } from './src/core/plantuml/preprocessor';
import { parsePlantUML } from './src/core/plantuml/parser';
import { convertPlantUMLToDrawio } from './src/core/plantuml/converter';

test('PlantUML Preprocessor', () => {
  const code = `
    @startuml
    ' This is a comment
    Alice -> Bob: Hello
    @enduml
  `;
  const lines = preprocessPlantUML(code);
  expect(lines).toEqual([{ text: 'Alice -> Bob: Hello', line: 4 }]);
});

test('PlantUML Parser', () => {
  const lines = ['participant "Alice" as A', 'A -> Bob: Hello'];
  const ast = parsePlantUML(lines);
  
  expect(ast.nodes.length).toBe(2);
  expect(ast.nodes[0].name).toBe('Alice'); // stripped quotes
  expect(ast.nodes[1].name).toBe('Bob'); // Auto-registered
  
  expect(ast.edges.length).toBe(1);
  expect(ast.edges[0].sourceId).toBe(ast.nodes[0].id);
  expect(ast.edges[0].targetId).toBe(ast.nodes[1].id);
  expect(ast.edges[0].label).toBe('Hello');
  expect(ast.edges[0].isDashed).toBe(false);
});

test('PlantUML Converter', () => {
  const ast = {
    type: 'sequence',
    nodes: [
      { id: '1', name: 'Alice', type: 'participant' as const },
      { id: '2', name: 'Bob', type: 'participant' as const }
    ],
    edges: [
      { sourceId: '1', targetId: '2', label: 'Message', isDashed: false }
    ],
    notes: [],
    groups: [],
    activations: [],
    unsupportedFeatures: [],
  };
  
  const result = convertPlantUMLToDrawio(ast);
  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('shape=umlLifeline');
  expect(result.drawioXml).toContain('Alice');
  expect(result.drawioXml).toContain('Bob');
  expect(result.drawioXml).toContain('Message');
});

test('PlantUML Converter handles dashed replies and self messages like Mermaid sequence', () => {
  const ast = {
    type: 'sequence',
    nodes: [
      { id: '1', name: 'Alice', type: 'participant' as const },
      { id: '2', name: 'Bob', type: 'participant' as const }
    ],
    edges: [
      { sourceId: '1', targetId: '2', label: 'Request', isDashed: false },
      { sourceId: '2', targetId: '1', label: 'Reply', isDashed: true },
      { sourceId: '2', targetId: '2', label: 'Internal work', isDashed: false }
    ],
    notes: [],
    groups: [],
    activations: [],
    unsupportedFeatures: [],
  };

  const result = convertPlantUMLToDrawio(ast);

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('dashed=1;');
  expect(result.drawioXml).toContain('Internal work');
  expect(result.drawioXml).toContain('<Array as="points">');
});
