import { expect, test } from 'vitest';
import { parseMermaidAst } from './parser';

test('parseMermaidAst registers explicit and implicit sequence participants in order', async () => {
  const ast = await parseMermaidAst([
    'sequenceDiagram',
    'participant Alice',
    'Alice->>+John: Hello',
    'John-->>-Alice: Hi',
  ].join('\n'));

  expect(ast.type).toBe('sequence');
  expect(ast.nodes.map((node) => node.label)).toEqual(['Alice', 'John']);
  expect(ast.edges).toHaveLength(2);
  expect(ast.edges[0].label).toBe('Hello');
  expect(ast.edges[1].label).toBe('Hi');
  expect(ast.edges[1].isDashed).toBe(true);
  expect(ast.activations).toHaveLength(1);
});

test('parseMermaidAst preserves aliases and self messages for sequence diagrams', async () => {
  const ast = await parseMermaidAst([
    'sequenceDiagram',
    'participant "First Class" as A',
    'A->>A: Loop back',
  ].join('\n'));

  expect(ast.nodes).toHaveLength(1);
  expect(ast.nodes[0].label).toBe('First Class');
  expect(ast.edges[0].isSelf).toBe(true);
  expect(ast.edges[0].source).toBe(ast.edges[0].target);
});

test('parseMermaidAst parses class members and inheritance', async () => {
  const ast = await parseMermaidAst([
    'classDiagram',
    'Animal <|-- Duck',
    'Animal : +int age',
    'Animal: +mate()',
    'class Duck{',
    '  +String beakColor',
    '  +quack()',
    '}',
  ].join('\n'));

  const animal = ast.nodes.find((node) => node.id === 'Animal');
  const duck = ast.nodes.find((node) => node.id === 'Duck');

  expect(ast.type).toBe('class');
  expect(animal?.attributes).toEqual(['+int age']);
  expect(animal?.methods).toEqual(['+mate()']);
  expect(duck?.attributes).toEqual(['+String beakColor']);
  expect(duck?.methods).toEqual(['+quack()']);
  expect(ast.edges).toEqual([
    {
      id: 'edge-0',
      source: 'Duck',
      target: 'Animal',
      label: undefined,
      sourceCardinality: undefined,
      targetCardinality: undefined,
      type: 'generalization',
      isDashed: false,
    },
  ]);
});

test('parseMermaidAst preserves Mermaid class annotations, aliases, and cardinalities', async () => {
  const ast = await parseMermaidAst([
    'classDiagram',
    'direction LR',
    'class "Order Service" as OrderService {',
    '  <<service>>',
    '  +submit(order: Order)',
    '}',
    'OrderService "1" --> "*" Order~T~ : handles',
  ].join('\n'));

  const orderService = ast.nodes.find((node) => node.id === 'OrderService');
  const order = ast.nodes.find((node) => node.id === 'Order~T~');

  expect(ast.direction).toBe('LR');
  expect(orderService?.label).toBe('Order Service');
  expect(orderService?.annotations).toEqual(['<<service>>']);
  expect(orderService?.methods).toEqual(['+submit(order: Order)']);
  expect(order?.label).toBe('Order~T~');
  expect(ast.edges).toEqual([
    {
      id: 'edge-0',
      source: 'OrderService',
      target: 'Order~T~',
      label: 'handles',
      sourceCardinality: '1',
      targetCardinality: '*',
      type: 'directedAssociation',
      isDashed: false,
    },
  ]);
});

test('parseMermaidAst defaults class direction when none is specified', async () => {
  const ast = await parseMermaidAst([
    'classDiagram',
    'class Animal',
  ].join('\n'));

  expect(ast.type).toBe('class');
  expect(ast.direction).toBeUndefined();
});

test('parseMermaidAst preserves flowchart subgraphs and declared labels', async () => {
  const ast = await parseMermaidAst([
    'flowchart TD',
    'subgraph Payments["Payments Core"]',
    '  A[Charge Card] --> B{Approved?}',
    'end',
    'B -->|Yes| C[Send Receipt]',
  ].join('\n'));

  expect(ast.type).toBe('flowchart');
  expect(ast.subgraphs).toEqual([
    {
      id: 'Payments',
      label: 'Payments Core',
      parentId: undefined,
      childNodeIds: ['A', 'B'],
    },
  ]);
  expect(ast.nodes.find((node) => node.id === 'A')?.label).toBe('Charge Card');
  expect(ast.nodes.find((node) => node.id === 'B')?.parentId).toBe('Payments');
  expect(ast.edges[1].label).toBe('Yes');
});

test('parseMermaidAst recognizes expanded flowchart shapes and edge types', async () => {
  const ast = await parseMermaidAst([
    'flowchart TD',
    'A[[Routine]] o--> B[(Store)]',
    'B <--> C{{Gateway}}',
  ].join('\n'));

  expect(ast.nodes.find((node) => node.id === 'A')?.type).toBe('subroutine');
  expect(ast.nodes.find((node) => node.id === 'B')?.type).toBe('cylinder');
  expect(ast.nodes.find((node) => node.id === 'C')?.type).toBe('hexagon');
  expect(ast.edges[0].type).toBe('circle');
  expect(ast.edges[1].type).toBe('both');
});

test('parseMermaidAst reports Mermaid state diagrams as unsupported', async () => {
  const ast = await parseMermaidAst([
    'stateDiagram-v2',
    'Idle --> Active',
    'note right of Active : Waiting for input',
  ].join('\n'));

  expect(ast.type).toBe('state');
  expect(ast.nodes).toEqual([]);
  expect(ast.edges).toEqual([]);
  expect(ast.coverage?.fidelity).toBe('none');
  expect(ast.unsupportedFeatures).toEqual([
    'Mermaid State diagram support is disabled because current native export is unreliable.',
  ]);
  expect(ast.diagnostics).toEqual([
    expect.objectContaining({
      code: 'mermaid.state.unsupported',
      severity: 'warning',
    }),
  ]);
});

test('parseMermaidAst reports Mermaid gantt charts as unsupported', async () => {
  const ast = await parseMermaidAst([
    'gantt',
    'title Release Plan',
    'section Build',
    'Parser :active, parser, 2026-07-01, 3d',
  ].join('\n'));

  expect(ast.type).toBe('gantt');
  expect(ast.nodes).toEqual([]);
  expect(ast.edges).toEqual([]);
  expect(ast.coverage?.fidelity).toBe('none');
  expect(ast.unsupportedFeatures).toEqual([
    'Mermaid Gantt chart support is disabled because current native export is unreliable.',
  ]);
  expect(ast.diagnostics).toEqual([
    expect.objectContaining({
      code: 'mermaid.gantt.unsupported',
      severity: 'warning',
    }),
  ]);
});

test('parseMermaidAst preserves sequence notes and groups', async () => {
  const ast = await parseMermaidAst([
    'sequenceDiagram',
    'participant API',
    'participant DB',
    'loop Retry',
    'API->>DB: Load',
    'Note right of DB: Cached',
    'end',
  ].join('\n'));

  expect(ast.groups).toEqual([
    {
      type: 'loop',
      label: 'Retry',
      startMessageIndex: 0,
      endMessageIndex: 0,
    },
  ]);
  expect(ast.notes).toEqual([
    {
      placement: 'right of',
      participants: ['participant-1'],
      text: 'Cached',
      messageIndex: 0,
    },
  ]);
});

test('parseMermaidAst expands chained and grouped flowchart edges without losing nodes', async () => {
  const ast = await parseMermaidAst([
    'flowchart TD',
    'A-->B-->C',
    'A & B -- accepted --> D',
    'D -->|retry| A',
  ].join('\n'));

  expect(ast.nodes.map((node) => node.id)).toEqual(['A', 'B', 'C', 'D']);
  expect(ast.edges.map((edge) => [edge.source, edge.target, edge.label])).toEqual([
    ['A', 'B', undefined],
    ['B', 'C', undefined],
    ['A', 'D', 'accepted'],
    ['B', 'D', 'accepted'],
    ['D', 'A', 'retry'],
  ]);
  expect(ast.coverage?.fidelity).toBe('exact');
  expect(ast.diagnostics).toEqual([]);
});

test('parseMermaidAst supports semicolon-separated statements and reports ignored syntax', async () => {
  const ast = await parseMermaidAst('flowchart TD\nA-->B; unsupported ???; B-->C');

  expect(ast.edges).toHaveLength(2);
  expect(ast.coverage?.fidelity).toBe('partial');
  expect(ast.diagnostics?.[0]).toMatchObject({
    code: 'mermaid.flowchart.statement-unparsed',
    statement: 'unsupported ???',
  });
});

test('Mermaid class parsing reports unsupported statements with source lines instead of claiming exact fidelity', async () => {
  const ast = await parseMermaidAst([
    'classDiagram',
    'class User {',
    '  +String id',
    '}',
    'namespace Commerce {',
  ].join('\n'));

  expect(ast.type).toBe('class');
  expect(ast.coverage?.fidelity).toBe('partial');
  expect(ast.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({
      code: 'mermaid.class.statement-unparsed',
      line: 5,
      statement: 'namespace Commerce {',
    }),
  ]));
});
