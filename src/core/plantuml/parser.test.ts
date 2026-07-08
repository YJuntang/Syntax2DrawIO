import { expect, test } from 'vitest';
import { parsePlantUML } from './parser';

test('classifies message-based PlantUML as sequence', () => {
  const result = parsePlantUML([
    'participant Alice',
    'participant Bob',
    'Alice -> Bob: hello',
  ]);

  expect(result.type).toBe('sequence');
  expect(result.nodes).toHaveLength(2);
  expect(result.edges).toHaveLength(1);
});

test('classifies dashed PlantUML messages as sequence without participants', () => {
  const result = parsePlantUML([
    'Alice --> Bob: reply',
    'Bob --> Alice: ok',
  ]);

  expect(result.type).toBe('sequence');
  expect(result.edges).toHaveLength(2);
  expect(result.nodes.map((node) => node.name)).toEqual(['Alice', 'Bob']);
});

test('classifies non-sequence PlantUML as unsupported', () => {
  const result = parsePlantUML([
    'class User',
    'class Account',
    'User -- Account',
  ]);

  expect(result.type).toBe('class');
  expect(result.edges).toHaveLength(1);
});

test('preserves PlantUML sequence groups and activations', () => {
  const result = parsePlantUML([
    'participant Alice',
    'participant Bob',
    'loop retry',
    'Alice -> Bob: hello',
    'activate Bob',
    'Bob --> Alice: ok',
    'deactivate Bob',
    'end',
  ]);

  expect(result.type).toBe('sequence');
  expect(result.groups).toEqual([
    {
      type: 'loop',
      label: 'retry',
      startMessageIndex: 0,
      endMessageIndex: 1,
    },
  ]);
  expect(result.activations).toEqual([
    {
      participantId: 'node-1',
      startMessageIndex: 0,
      endMessageIndex: 1,
      depth: 0,
    },
  ]);
});

test('preserves PlantUML alt else branches', () => {
  const result = parsePlantUML([
    'participant ATM',
    'participant Bank',
    'ATM -> Bank: Verify PIN',
    'alt Valid PIN',
    'Bank --> ATM: PIN OK',
    'else Invalid PIN',
    'Bank --> ATM: Error',
    'end',
  ]);

  expect(result.type).toBe('sequence');
  expect(result.groups).toEqual([
    {
      type: 'alt',
      label: 'Valid PIN',
      startMessageIndex: 1,
      endMessageIndex: 2,
      branches: [
        {
          label: 'Invalid PIN',
          messageIndex: 2,
        },
      ],
    },
  ]);
  expect(result.unsupportedFeatures).not.toContain('PlantUML alternate branch labels and colors are preserved only in the visual reference.');
});

test('preserves basic PlantUML sequence autonumber labels', () => {
  const result = parsePlantUML([
    'autonumber',
    'Alice -> Bob: Request',
    'Bob --> Alice: Response',
  ]);

  expect(result.type).toBe('sequence');
  expect(result.edges.map((edge) => edge.label)).toEqual([
    '1 Request',
    '2 Response',
  ]);
  expect(result.unsupportedFeatures).not.toContain('PlantUML rendering directives are not preserved in editable sequence export.');
});

test('parses PlantUML classes with members and inheritance', () => {
  const result = parsePlantUML([
    'abstract class Animal {',
    '  +age: int',
    '  +move()',
    '}',
    'class Duck',
    'Duck --|> Animal',
  ]);

  expect(result.type).toBe('class');
  expect(result.nodes.find((node) => node.id === 'Animal')?.type).toBe('abstractClass');
  expect(result.nodes.find((node) => node.id === 'Animal')?.attributes).toEqual(['+age: int']);
  expect(result.nodes.find((node) => node.id === 'Animal')?.methods).toEqual(['+move()']);
  expect(result.edges[0].type).toBe('generalization');
});

test('parses PlantUML class aliases, quoted labels, stereotypes, and inline members', () => {
  const result = parsePlantUML([
    'class "Order Service" as OrderService <<service>> {',
    '  +submit(order: Order)',
    '}',
    'class Order~T~ <<entity>> {',
    '  -id: string',
    '  +total(): number',
    '}',
  ]);

  expect(result.type).toBe('class');

  const service = result.nodes.find((node) => node.id === 'OrderService');
  expect(service?.name).toBe('Order Service');
  expect(service?.annotations).toContain('<<service>>');
  expect(service?.methods).toEqual(['+submit(order: Order)']);

  const order = result.nodes.find((node) => node.id === 'Order~T~');
  expect(order?.name).toBe('Order~T~');
  expect(order?.annotations).toContain('<<entity>>');
  expect(order?.attributes).toEqual(['-id: string']);
  expect(order?.methods).toEqual(['+total(): number']);
});

test('parses PlantUML one-line class bodies', () => {
  const result = parsePlantUML([
    'class User {',
    '  +id: string',
    '}',
    'class Session { +token: string +expiresAt(): Date }',
  ]);

  expect(result.type).toBe('class');
  expect(result.nodes.find((node) => node.id === 'User')?.attributes).toEqual(['+id: string']);
  expect(result.nodes.find((node) => node.id === 'Session')?.attributes).toEqual(['+token: string']);
  expect(result.nodes.find((node) => node.id === 'Session')?.methods).toEqual(['+expiresAt(): Date']);
});

test('parses PlantUML class relationships with types, labels, and cardinalities', () => {
  const result = parsePlantUML([
    'class Customer',
    'class Order',
    'class OnlineOrder',
    'interface Payable',
    'Customer "1" o-- "*" Order : places',
    'Order <|-- OnlineOrder',
    'OnlineOrder ..|> Payable : implements',
  ]);

  expect(result.type).toBe('class');
  expect(result.edges).toEqual([
    expect.objectContaining({
      sourceId: 'Customer',
      targetId: 'Order',
      type: 'aggregation',
      isDashed: false,
      sourceCardinality: '1',
      targetCardinality: '*',
      label: 'places',
      styleOverrides: {
        startArrow: 'diamond',
        startFill: '0',
        endArrow: 'none',
        endFill: '0',
      },
    }),
    expect.objectContaining({
      sourceId: 'OnlineOrder',
      targetId: 'Order',
      type: 'generalization',
      isDashed: false,
    }),
    expect.objectContaining({
      sourceId: 'OnlineOrder',
      targetId: 'Payable',
      type: 'realization',
      isDashed: true,
      label: 'implements',
    }),
  ]);
});

test('parses quoted cardinalities without creating bogus PlantUML class endpoints', () => {
  const result = parsePlantUML([
    'class Customer',
    'class Order',
    'class OrderItem',
    'class Product',
    'Customer "1" *-- "0..*" Order : Composition',
    'Order "1" *-- "1..*" OrderItem : Composition',
    'OrderItem "0..*" --> "1" Product : Association',
  ]);

  expect(result.type).toBe('class');
  expect(result.nodes.map((node) => node.id)).toEqual(['Customer', 'Order', 'OrderItem', 'Product']);
  expect(result.edges).toEqual([
    expect.objectContaining({
      sourceId: 'Customer',
      targetId: 'Order',
      sourceCardinality: '1',
      targetCardinality: '0..*',
      type: 'composition',
    }),
    expect.objectContaining({
      sourceId: 'Order',
      targetId: 'OrderItem',
      sourceCardinality: '1',
      targetCardinality: '1..*',
      type: 'composition',
    }),
    expect.objectContaining({
      sourceId: 'OrderItem',
      targetId: 'Product',
      sourceCardinality: '0..*',
      targetCardinality: '1',
      type: 'directedAssociation',
    }),
  ]);
});

test('classifies PlantUML component containers as unsupported', () => {
  const result = parsePlantUML([
    'package "Core" {',
    '  [Web App] as WEB',
    '  interface "HTTP API" as API',
    '  queue Jobs',
    '  database DB',
    '}',
    'actor Worker',
    'WEB --> API : serves',
    'API --> Jobs : enqueues',
    'Worker --> Jobs : drains',
    'Jobs --> DB : writes',
  ]);

  expect(result.type).toBe('unsupported');
  expect(result.nodes.find((node) => node.id === 'WEB')?.parentId).toBe('Core');
  expect(result.nodes.find((node) => node.id === 'API')).toMatchObject({
    name: 'HTTP API',
    type: 'interface',
    parentId: 'Core',
  });
  expect(result.nodes.find((node) => node.id === 'Jobs')).toMatchObject({
    name: 'Jobs',
    type: 'queue',
    parentId: 'Core',
  });
  expect(result.nodes.find((node) => node.id === 'DB')?.parentId).toBe('Core');
  expect(result.nodes.find((node) => node.id === 'Worker')?.type).toBe('actor');
  expect(result.edges[0].label).toBe('serves');
  expect(result.edges[0].type).toBe('directedAssociation');
});

test('keeps interface-only structural PlantUML on the class path', () => {
  const result = parsePlantUML([
    'interface Runnable',
    'interface Closeable',
    'Runnable <|-- Closeable',
  ]);

  expect(result.type).toBe('class');
  expect(result.nodes.every((node) => node.type === 'interface')).toBe(true);
  expect(result.edges[0]).toMatchObject({
    sourceId: 'Closeable',
    targetId: 'Runnable',
    type: 'generalization',
  });
});

test('does not let component interfaces flip unsupported component diagrams to class export', () => {
  const result = parsePlantUML([
    'interface "REST API" as API',
    'component Worker',
    'Worker --> API : calls',
  ]);

  expect(result.type).toBe('unsupported');
  expect(result.nodes.find((node) => node.id === 'API')?.type).toBe('interface');
  expect(result.edges[0]).toMatchObject({
    sourceId: 'Worker',
    targetId: 'API',
    type: 'directedAssociation',
  });
});

test('parses hyphenated aliases and reverse sequence arrows', () => {
  const result = parsePlantUML([
    'participant "API Gateway" as api-gateway',
    'Bob <- api-gateway: response',
  ]);

  expect(result.type).toBe('sequence');
  expect(result.nodes.map((node) => node.name)).toEqual(['API Gateway', 'Bob']);
  expect(result.edges[0]).toMatchObject({
    sourceId: 'node-0',
    targetId: 'node-1',
    label: 'response',
  });
  expect(result.coverage?.fidelity).toBe('exact');
});

test('parses PlantUML structural titles without downgrading class coverage', () => {
  const result = parsePlantUML([
    { text: 'title E-Commerce System', line: 2 },
    { text: 'class User {', line: 4 },
    { text: '+void login()', line: 5 },
    { text: '}', line: 6 },
  ]);

  expect(result.type).toBe('class');
  expect(result.title).toBe('E-Commerce System');
  expect(result.coverage?.fidelity).toBe('exact');
  expect(result.diagnostics).toEqual([]);
});

test('classifies actor-based sequence diagrams as sequence instead of use case', () => {
  const result = parsePlantUML([
    'actor Customer',
    'participant API',
    'Customer -> API: submit',
  ]);

  expect(result.type).toBe('sequence');
  expect(result.edges).toHaveLength(1);
});

test('parses PlantUML Use Case declarations, aliases, boundaries, and relationships', () => {
  const result = parsePlantUML([
    'left to right direction',
    'actor "Customer" as Customer <<human>>',
    ':Support Agent: as Support',
    'package "Commerce Platform" as Platform {',
    'rectangle "Ordering System" as Ordering {',
    'usecase "Browse Catalog" as Browse',
    '(Checkout\\nOrder) as Checkout <<primary>>',
    'usecase "Authenticate User" as Authenticate',
    '}',
    '}',
    'Customer --> Browse : explores',
    'Support --> Checkout : assists',
    'Checkout ..> Authenticate : <<include>>',
    'Premium --|> Customer',
  ]);

  expect(result.type).toBe('usecase');
  expect(result.direction).toBe('LR');
  expect(result.coverage?.fidelity).toBe('exact');
  expect(result.unsupportedFeatures).toEqual([]);
  expect(result.nodes.find((node) => node.id === 'Checkout')).toMatchObject({
    name: 'Checkout\nOrder',
    type: 'usecase',
    parentId: 'Ordering',
    annotations: ['<<primary>>'],
  });
  expect(result.nodes.find((node) => node.id === 'Ordering')?.parentId).toBe('Platform');
  expect(result.nodes.find((node) => node.id === 'Premium')?.type).toBe('actor');
  expect(result.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ sourceId: 'Checkout', targetId: 'Authenticate', type: 'dependency', isDashed: true, label: '<<include>>' }),
    expect.objectContaining({ sourceId: 'Premium', targetId: 'Customer', type: 'generalization' }),
  ]));
});

test('parses official-style Use Case aliases, reversed labels, directions, and arrow hints', () => {
  const result = parsePlantUML([
    'right to left direction',
    'actor :Support Agent: as Support <<human>>',
    'usecase Checkout as "Checkout Order" <<primary>>',
    '(Browse Catalog) as Browse',
    'Support -left-> Checkout : include',
    'Checkout .> Browse : extends',
  ]);

  expect(result.type).toBe('usecase');
  expect(result.direction).toBe('RL');
  expect(result.nodes.find((node) => node.id === 'Support')).toMatchObject({
    name: 'Support Agent',
    type: 'actor',
    annotations: ['<<human>>'],
  });
  expect(result.nodes.find((node) => node.id === 'Checkout')).toMatchObject({
    name: 'Checkout Order',
    type: 'usecase',
    annotations: ['<<primary>>'],
  });
  expect(result.edges).toEqual([
    expect.objectContaining({
      sourceId: 'Support',
      targetId: 'Checkout',
      label: 'include',
      type: 'dependency',
      isDashed: true,
      directionHint: 'left',
    }),
    expect.objectContaining({
      sourceId: 'Checkout',
      targetId: 'Browse',
      label: 'extends',
      type: 'dependency',
      isDashed: true,
    }),
  ]);
});

test('parses dotted Use Case direction arrows without folding hints into endpoint ids', () => {
  const result = parsePlantUML([
    'usecase "Book Ticket" as UC_Book',
    'usecase "Purchase/Upgrade Membership" as UC_Membership',
    'usecase "Add Item to Order" as UC_AddCart',
    'usecase "Filter F&B Items" as UC_FilterFnB',
    'UC_Membership .up.> UC_Book : <<extend>>',
    'UC_FilterFnB .u.> UC_AddCart : <<extend>>',
  ]);

  expect(result.type).toBe('usecase');
  expect(result.nodes.map((node) => node.id)).not.toContain('UC_Membership .up');
  expect(result.nodes.map((node) => node.id)).not.toContain('UC_FilterFnB .u');
  expect(result.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({
      sourceId: 'UC_Membership',
      targetId: 'UC_Book',
      label: '<<extend>>',
      type: 'dependency',
      isDashed: true,
      directionHint: 'up',
    }),
    expect.objectContaining({
      sourceId: 'UC_FilterFnB',
      targetId: 'UC_AddCart',
      label: '<<extend>>',
      type: 'dependency',
      isDashed: true,
      directionHint: 'up',
    }),
  ]));
});

test('parses native Use Case notes and standalone note links', () => {
  const result = parsePlantUML([
    'top to bottom direction',
    'actor Customer',
    'usecase "Checkout Order" as Checkout',
    'note right of Checkout : Requires payment',
    'note top of Customer',
    'Primary buyer',
    'end note',
    'note "Shared policy" as Policy',
    'Policy .. Checkout : documents',
  ]);

  expect(result.type).toBe('usecase');
  expect(result.direction).toBe('TB');
  expect(result.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'note',
      name: 'Requires payment',
      noteAnchorId: 'Checkout',
      notePlacement: 'right',
    }),
    expect.objectContaining({
      type: 'note',
      name: 'Primary buyer',
      noteAnchorId: 'Customer',
      notePlacement: 'top',
    }),
    expect.objectContaining({
      id: 'Policy',
      type: 'note',
      name: 'Shared policy',
    }),
  ]));
  expect(result.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({
      sourceId: 'Policy',
      targetId: 'Checkout',
      type: 'dependency',
      isDashed: true,
      label: 'documents',
    }),
  ]));
  expect(result.unsupportedFeatures).toEqual([]);
});

test('keeps Use Case declarations native when inline visual styles are present', () => {
  const result = parsePlantUML([
    'rectangle "Checkout System" as System #aliceblue {',
    'actor Customer #red',
    'usecase "Checkout Order" as Checkout <<primary>> #line:red',
    '}',
    'Customer --> Checkout',
  ]);

  expect(result.type).toBe('usecase');
  expect(result.coverage?.fidelity).toBe('partial');
  expect(result.nodes.find((node) => node.id === 'System')).toMatchObject({
    type: 'rectangle',
    name: 'Checkout System',
  });
  expect(result.nodes.find((node) => node.id === 'Customer')?.type).toBe('actor');
  expect(result.nodes.find((node) => node.id === 'Checkout')).toMatchObject({
    type: 'usecase',
    annotations: ['<<primary>>'],
    parentId: 'System',
  });
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'plantuml.usecase.inline-style-partial' }),
  ]));
  expect(result.diagnostics).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'plantuml.usecase.statement-unparsed' }),
  ]));
});

test('supports implicit actors that connect to declared use cases', () => {
  const result = parsePlantUML([
    'usecase "Review Audit Log" as AuditLog',
    'Auditor --> AuditLog : reviews',
  ]);

  expect(result.type).toBe('usecase');
  expect(result.nodes.find((node) => node.id === 'Auditor')?.type).toBe('actor');
  expect(result.edges[0]).toMatchObject({
    sourceId: 'Auditor',
    targetId: 'AuditLog',
    type: 'directedAssociation',
  });
});

test('resolves shorthand relationship endpoints back to declared aliases', () => {
  const result = parsePlantUML([
    'actor "Customer User" as Customer',
    'usecase "Browse Catalog" as Browse',
    ':Customer User: --> (Browse Catalog)',
  ]);

  expect(result.nodes).toHaveLength(2);
  expect(result.edges[0]).toMatchObject({
    sourceId: 'Customer',
    targetId: 'Browse',
  });
});

test('reports malformed, duplicate, unclosed, and visual-only Use Case syntax', () => {
  const result = parsePlantUML([
    { text: 'rectangle "System" as System {', line: 2 },
    { text: 'usecase "Login" as Login', line: 3 },
    { text: 'usecase "Duplicate Login" as Login', line: 4 },
    { text: 'note right of Login: visual note', line: 5 },
    { text: '(Business Login)/', line: 6 },
    { text: 'Login -right->', line: 7 },
  ]);

  expect(result.type).toBe('usecase');
  expect(result.coverage?.fidelity).toBe('partial');
  expect(result.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'note',
      name: 'visual note',
      noteAnchorId: 'Login',
      notePlacement: 'right',
    }),
  ]));
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'plantuml.usecase.duplicate-id' }),
    expect.objectContaining({ code: 'plantuml.usecase.business-variant-partial', line: 6 }),
    expect.objectContaining({ code: 'plantuml.usecase.relationship-endpoint-invalid', line: 7 }),
    expect.objectContaining({ code: 'plantuml.usecase.container-unclosed' }),
  ]));
});
