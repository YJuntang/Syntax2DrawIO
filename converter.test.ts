import { test, expect } from 'vitest';
import { convertMermaidToDrawio } from './src/core/mermaid/converter';
import { parseMermaidAst } from './src/core/mermaid/parser';
import { RenderResult } from './src/core/mermaid/renderer';

const flowchartRenderResult: RenderResult = {
  svg: '<svg width="320" height="120"></svg>',
  nodes: [
    { id: 'flowchart-A-0', x: 0, y: 0, width: 100, height: 50, label: 'Start', shape: 'rect' },
    { id: 'flowchart-B-1', x: 180, y: 0, width: 100, height: 50, label: 'Finish', shape: 'rect' },
  ],
  edges: [
    { id: 'edge-0', sourceId: 'A', targetId: 'B', label: '', waypoints: [{ x: 120, y: 25 }] },
  ],
};

const fallbackRenderResult: RenderResult = {
  svg: '<svg width="240" height="160"></svg>',
  nodes: [],
  edges: [],
};

const classRenderResult: RenderResult = {
  svg: '<svg width="520" height="260"></svg>',
  nodes: [
    { id: 'classId-Animal-0', x: 160, y: 10, width: 170, height: 116, label: 'Animal', shape: 'class' },
    { id: 'classId-Duck-1', x: 20, y: 180, width: 170, height: 116, label: 'Duck', shape: 'class' },
  ],
  edges: [
    { id: 'edge-0', sourceId: 'Duck', targetId: 'Animal', label: '', waypoints: [{ x: 135, y: 150 }, { x: 180, y: 120 }] },
  ],
};

function getCellMarkup(xml: string, cellId: string) {
  const escapedId = cellId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<mxCell id="${escapedId}"[\\s\\S]*?<\\/mxCell>`));
  return match?.[0] || '';
}

function getCellWidth(xml: string, cellId: string) {
  const markup = getCellMarkup(xml, cellId);
  const match = markup.match(/width="([0-9.]+)"/);
  return match ? Number(match[1]) : 0;
}

function getCellStyle(xml: string, cellId: string) {
  const markup = getCellMarkup(xml, cellId);
  const match = markup.match(/style="([^"]+)"/);
  return match?.[1] || '';
}

function getCellNumber(xml: string, cellId: string, attr: 'x' | 'y' | 'width' | 'height') {
  const markup = getCellMarkup(xml, cellId);
  const match = markup.match(new RegExp(`<mxGeometry[^>]*\\s${attr}="([0-9.]+)"`));
  return match ? Number(match[1]) : 0;
}

function getCellPoints(xml: string, cellId: string) {
  const markup = getCellMarkup(xml, cellId);
  const points = Array.from(markup.matchAll(/<mxPoint x="([0-9.-]+)" y="([0-9.-]+)"\/>/g));
  return points.map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
}

function expectNoImageFallback(xml: string) {
  expect(xml).not.toContain('shape=image');
}

test('convertMermaidToDrawio - Flowchart stays native', async () => {
  const code = 'flowchart TD\nA[Start] --> B[Finish]';
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, flowchartRenderResult, code);

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('Start');
  expect(result.drawioXml).toContain('Finish');
  expect(result.drawioXml).toContain('endArrow=classic');
  expect(result.drawioXml).toContain('<Array as="points">');
  expect(result.drawioXml).toContain('<mxPoint x="160" y="65"/>');
  expectNoImageFallback(result.drawioXml);
});

test('convertMermaidToDrawio - Flowchart uses rendered shape hints for native preview parity', async () => {
  const code = 'flowchart TD\nA --> B';
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, {
    svg: '<svg width="320" height="120"></svg>',
    nodes: [
      { id: 'flowchart-A-0', x: 0, y: 0, width: 100, height: 50, label: 'A', shape: 'rect' },
      { id: 'flowchart-B-1', x: 180, y: 0, width: 120, height: 60, label: 'B', shape: 'hexagon' },
    ],
    edges: [],
  }, code);

  expect(result.drawioMode).toBe('native-full');
  expect(getCellStyle(result.drawioXml, 'B')).toContain('shape=hexagon');
  expectNoImageFallback(result.drawioXml);
});

test('convertMermaidToDrawio - chained flowchart preserves three vertices and two edges', async () => {
  const code = 'flowchart TD\nA-->B-->C';
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, {
    svg: '<svg width="480" height="120"></svg>',
    nodes: [
      { id: 'flowchart-A-0', x: 0, y: 0, width: 100, height: 50, label: 'A', shape: 'rect' },
      { id: 'flowchart-B-1', x: 180, y: 0, width: 100, height: 50, label: 'B', shape: 'rect' },
      { id: 'flowchart-C-2', x: 360, y: 0, width: 100, height: 50, label: 'C', shape: 'rect' },
    ],
    edges: [],
  }, code);

  expect((result.drawioXml.match(/vertex="1"/g) || [])).toHaveLength(3);
  expect((result.drawioXml.match(/edge="1"/g) || [])).toHaveLength(2);
});

test('convertMermaidToDrawio - Flowchart maps dashed thick and no-arrow edges', async () => {
  const code = [
    'flowchart TD',
    'A[Start] -.-> B[Maybe]',
    'B ==> C[Done]',
    'C --- D[Loose]',
  ].join('\n');
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, {
    svg: '<svg width="640" height="240"></svg>',
    nodes: [
      { id: 'flowchart-A-0', x: 0, y: 0, width: 100, height: 50, label: 'Start', shape: 'rect' },
      { id: 'flowchart-B-1', x: 150, y: 0, width: 100, height: 50, label: 'Maybe', shape: 'rounded_rect' },
      { id: 'flowchart-C-2', x: 300, y: 0, width: 100, height: 50, label: 'Done', shape: 'diamond' },
      { id: 'flowchart-D-3', x: 450, y: 0, width: 100, height: 50, label: 'Loose', shape: 'circle' },
    ],
    edges: [],
  }, code);

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('dashed=1');
  expect(result.drawioXml).toContain('strokeWidth=2');
  expect(result.drawioXml).toContain('endArrow=none');
  expect(result.drawioXml).toContain('ellipse;whiteSpace=wrap;html=1;aspect=fixed;');
});

test('convertMermaidToDrawio - Flowchart maps circle and bidirectional edges', async () => {
  const code = [
    'flowchart TD',
    'A[[Routine]] o--> B[(Store)]',
    'B <--> C{{Gateway}}',
  ].join('\n');
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, {
    svg: '<svg width="640" height="240"></svg>',
    nodes: [
      { id: 'flowchart-A-0', x: 0, y: 0, width: 120, height: 50, label: 'Routine', shape: 'subroutine' },
      { id: 'flowchart-B-1', x: 180, y: 0, width: 120, height: 50, label: 'Store', shape: 'cylinder' },
      { id: 'flowchart-C-2', x: 360, y: 0, width: 120, height: 50, label: 'Gateway', shape: 'hexagon' },
    ],
    edges: [],
  }, code);

  expect(result.drawioXml).toContain('endArrow=oval;endFill=0;');
  expect(result.drawioXml).toContain('startArrow=classic;endArrow=classic;');
  expect(result.drawioXml).toContain('shape=process;whiteSpace=wrap;html=1;');
  expect(result.drawioXml).toContain('shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;size=15;');
  expect(result.drawioXml).toContain('shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;');
});

test('convertMermaidToDrawio - Sequence Diagram', async () => {
  const code = [
    'sequenceDiagram',
    'participant Alice',
    'participant John',
    'Alice->>+John: Hello John, how are you?',
    'John-->>-Alice: Hi Alice, I can hear you!',
    'John->>John: Internal note',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code);

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('shape=umlLifeline');
  expect(result.drawioXml).toContain('Alice');
  expect(result.drawioXml).toContain('John');
  expect(result.drawioXml).toContain('Hello John, how are you?');
  expect(result.drawioXml).toContain('Hi Alice, I can hear you!');
  expect(result.drawioXml).toContain('dashed=1;');
  expect(result.drawioXml).toContain('<Array as="points">');
  expectNoImageFallback(result.drawioXml);
});

test('convertMermaidToDrawio - Sequence Diagram increases spacing for long labels', async () => {
  const code = [
    'sequenceDiagram',
    'participant Alice',
    'participant John',
    'Alice->>John: This is a much longer message that needs extra room',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code);

  expect(result.drawioMode).toBe('native-full');
  expect(getCellNumber(result.drawioXml, 'participant-1', 'x')).toBeGreaterThan(190);
});

test('convertMermaidToDrawio - Sequence notes sit below right-of message anchors', async () => {
  const code = [
    'sequenceDiagram',
    'participant API',
    'API->>API: Record audit event',
    'Note right of API: Correlation ID retained',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code);

  expect(getCellNumber(result.drawioXml, 'note-0', 'y')).toBeGreaterThan(getCellPoints(result.drawioXml, 'edge-0')[0].y);
});

test('convertMermaidToDrawio - Class LR fallback ranks mixed relationship graphs left to right', async () => {
  const code = [
    'classDiagram',
    'direction LR',
    'class OrderService',
    'class Order',
    'class LineItem',
    'class PaymentGateway',
    'class StripeGateway',
    'class Customer',
    'Customer "1" --> "*" Order : places',
    'Order "1" *-- "1..*" LineItem : contains',
    'OrderService --> Order : manages',
    'OrderService ..> PaymentGateway : uses',
    'StripeGateway ..|> PaymentGateway',
    'OrderService o-- StripeGateway : configures',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(getCellNumber(result.drawioXml, 'Customer', 'x')).toBeLessThan(getCellNumber(result.drawioXml, 'Order', 'x'));
  expect(getCellNumber(result.drawioXml, 'OrderService', 'x')).toBeLessThan(getCellNumber(result.drawioXml, 'Order', 'x'));
  expect(getCellNumber(result.drawioXml, 'Order', 'x')).toBeLessThan(getCellNumber(result.drawioXml, 'LineItem', 'x'));
  expect(getCellNumber(result.drawioXml, 'StripeGateway', 'x')).toBeLessThan(getCellNumber(result.drawioXml, 'PaymentGateway', 'x'));
  expect(getCellStyle(result.drawioXml, 'edge-1')).toContain('startArrow=diamond;startFill=1;endArrow=none;endFill=0');
  expect(getCellStyle(result.drawioXml, 'edge-5')).toContain('startArrow=diamond;startFill=0;endArrow=none;endFill=0');
});

test('convertMermaidToDrawio - Class Diagram defaults to editable native UML class export', async () => {
  const code = [
    'classDiagram',
    'Animal <|-- Duck',
    'Animal : +int age',
    'class Duck{',
    '  +String beakColor',
    '}',
  ].join('\n');
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, classRenderResult, code);

  expect(result.drawioMode).toBe('native-full');
  expect(getCellNumber(result.drawioXml, 'Animal', 'y')).toBeLessThan(getCellNumber(result.drawioXml, 'Duck', 'y'));
  expect(getCellNumber(result.drawioXml, 'Animal', 'x')).toBeGreaterThan(getCellNumber(result.drawioXml, 'Duck', 'x'));
  expect(getCellNumber(result.drawioXml, 'Animal', 'width')).toBeGreaterThanOrEqual(160);
  expect(getCellNumber(result.drawioXml, 'Animal', 'height')).toBeGreaterThanOrEqual(50);
  expect(result.drawioXml).toContain('startSize=26');
  expect(result.drawioXml).toContain('value="+int age"');
  expect(result.drawioXml).toContain('value="+String beakColor"');
  expect(result.drawioXml).not.toContain('value="attributes"');
  expect(result.drawioXml).not.toContain('value="operations"');
  expect(result.drawioXml).toContain('source="Duck" target="Animal"');
  expect(getCellStyle(result.drawioXml, 'edge-0')).toContain('edgeStyle=none');
  expect(getCellStyle(result.drawioXml, 'edge-0')).toContain('exitX=0.5;exitY=0;entryX=0.5;entryY=1;');
  expect(getCellStyle(result.drawioXml, 'Animal')).toContain('childLayout=stackLayout');
  expect(getCellStyle(result.drawioXml, 'Animal')).toContain('resizeParent=1');
  expect(getCellNumber(result.drawioXml, 'Animal-attribute-0', 'x')).toBe(0);
  expect(getCellNumber(result.drawioXml, 'Animal-attribute-0', 'y')).toBe(26);
  expect(getCellNumber(result.drawioXml, 'Duck-attribute-0', 'x')).toBe(0);
  expect(getCellNumber(result.drawioXml, 'Duck-attribute-0', 'y')).toBe(26);
});

test('convertMermaidToDrawio - Class Diagram visual mode', async () => {
  const code = [
    'classDiagram',
    'Animal <|-- Duck',
    'Animal : +int age',
    'class Duck{',
    '  +String beakColor',
    '}',
  ].join('\n');
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'visual' });

  expect(result.drawioMode).toBe('visual-full');
  expect(result.drawioXml).toContain('shape=image;image=data:image/svg+xml,');
  expect(result.drawioXml).toContain('width="240"');
  expect(result.drawioXml).toContain('height="160"');
  expect(result.drawioXml).not.toContain('shape=umlClass');
});

test('convertMermaidToDrawio - Class Diagram editable mode', async () => {
  const code = [
    'classDiagram',
    'Animal <|-- Duck',
    'Animal : +int age',
    'Animal: +mate()',
    'class Duck{',
    '  +String beakColor',
    '  +quack()',
    '}',
  ].join('\n');
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('startSize=26');
  expect(result.drawioXml).toContain('Animal');
  expect(result.drawioXml).toContain('+int age');
  expect(result.drawioXml).toContain('+mate()');
  expect(result.drawioXml).toContain('Duck');
  expect(result.drawioXml).toContain('+String beakColor');
  expect(result.drawioXml).toContain('+quack()');
  expect(result.drawioXml).not.toContain('value="attributes"');
  expect(result.drawioXml).not.toContain('value="operations"');
  expect(result.drawioXml).not.toContain('&#xa;--&#xa;');
  expect(getCellStyle(result.drawioXml, 'edge-0')).toContain('endArrow=block;endFill=0');
  expect(result.drawioXml).toContain('source="Duck" target="Animal"');
});

test('convertMermaidToDrawio - Class Diagram with attributes only omits method compartment', async () => {
  const code = [
    'classDiagram',
    'class Service {',
    '  +String endpoint',
    '}',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('id="Service" value="Service" style="swimlane');
  expect(result.drawioXml).toContain('+String endpoint');
  expect(result.drawioXml).not.toContain('value="operations"');
  expect(getCellNumber(result.drawioXml, 'Service-attribute-0', 'x')).toBe(0);
  expect(getCellNumber(result.drawioXml, 'Service-attribute-0', 'y')).toBe(26);
});

test('convertMermaidToDrawio - Class Diagram with methods only omits attribute compartment', async () => {
  const code = [
    'classDiagram',
    'class Worker {',
    '  +run()',
    '}',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('id="Worker" value="Worker" style="swimlane');
  expect(result.drawioXml).toContain('+run()');
  expect(result.drawioXml).not.toContain('value="attributes"');
  expect(getCellNumber(result.drawioXml, 'Worker-method-0', 'x')).toBe(0);
  expect(getCellNumber(result.drawioXml, 'Worker-method-0', 'y')).toBe(26);
});

test('convertMermaidToDrawio - Empty class declaration keeps a single title compartment', async () => {
  const code = [
    'classDiagram',
    'class Empty',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('id="Empty" value="Empty" style="swimlane');
  expect(result.drawioXml).not.toContain('-divider-');
  expect(result.drawioXml).not.toContain('-attribute-');
  expect(result.drawioXml).not.toContain('-method-');
});

test('convertMermaidToDrawio - Class Diagram grows width for long members', async () => {
  const code = [
    'classDiagram',
    'class Repository {',
    '  +String extraordinarilyVerboseConfigurationProperty',
    '}',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(result.drawioMode).toBe('native-full');
  expect(getCellWidth(result.drawioXml, 'Repository')).toBeGreaterThan(160);
  expect(getCellWidth(result.drawioXml, 'Repository-attribute-0')).toBe(getCellWidth(result.drawioXml, 'Repository'));
});

test('convertMermaidToDrawio - Class Diagram positions attributes divider and methods explicitly', async () => {
  const code = [
    'classDiagram',
    'class Animal {',
    '  +int age',
    '  +String gender',
    '  +isMammal()',
    '}',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(getCellNumber(result.drawioXml, 'Animal-attribute-0', 'y')).toBe(26);
  expect(getCellNumber(result.drawioXml, 'Animal-attribute-1', 'y')).toBe(52);
  expect(getCellNumber(result.drawioXml, 'Animal-divider-2', 'y')).toBe(78);
  expect(getCellNumber(result.drawioXml, 'Animal-method-3', 'y')).toBe(86);
  expect(getCellWidth(result.drawioXml, 'Animal-divider-2')).toBe(getCellWidth(result.drawioXml, 'Animal'));
  expect(getCellNumber(result.drawioXml, 'Animal', 'height')).toBe(112);
});

test('convertMermaidToDrawio - Class Diagram multiline headers push rows below the full title block', async () => {
  const code = [
    'classDiagram',
    'class "Order Service" as OrderService {',
    '  <<service>>',
    '  +submit(order: Order)',
    '}',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(result.drawioXml).toContain('value="«service»&#xa;Order Service"');
  expect(result.drawioXml).toContain('startSize=44');
  expect(getCellNumber(result.drawioXml, 'OrderService-method-0', 'y')).toBe(44);
  expect(getCellNumber(result.drawioXml, 'OrderService', 'height')).toBe(70);
});

test('convertMermaidToDrawio - Class Diagram sample from editor opens with rows already arranged', async () => {
  const code = [
    'classDiagram',
    'Animal <|-- Duck',
    'Animal <|-- Fish',
    'Animal <|-- Zebra',
    'Animal : +int age',
    'Animal : +String gender',
    'Animal: +isMammal()',
    'Animal: +mate()',
    'class Duck{',
    '  +String beakColor',
    '  +swim()',
    '  +quack()',
    '}',
    'class Fish{',
    '  -int sizeInFeet',
    '  -canEat()',
    '}',
    'class Zebra{',
    '  +bool is_wild',
    '  +run()',
    '}',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(getCellNumber(result.drawioXml, 'Animal-attribute-0', 'y')).toBe(26);
  expect(getCellNumber(result.drawioXml, 'Animal-attribute-1', 'y')).toBe(52);
  expect(getCellNumber(result.drawioXml, 'Animal-divider-2', 'y')).toBe(78);
  expect(getCellNumber(result.drawioXml, 'Animal-method-3', 'y')).toBe(86);
  expect(getCellNumber(result.drawioXml, 'Animal-method-4', 'y')).toBe(112);
  expect(getCellNumber(result.drawioXml, 'Duck-attribute-0', 'y')).toBe(26);
  expect(getCellNumber(result.drawioXml, 'Duck-divider-1', 'y')).toBe(52);
  expect(getCellNumber(result.drawioXml, 'Duck-method-2', 'y')).toBe(60);
  expect(getCellNumber(result.drawioXml, 'Duck-method-3', 'y')).toBe(86);
  expect(getCellNumber(result.drawioXml, 'Fish-attribute-0', 'y')).toBe(26);
  expect(getCellNumber(result.drawioXml, 'Fish-divider-1', 'y')).toBe(52);
  expect(getCellNumber(result.drawioXml, 'Fish-method-2', 'y')).toBe(60);
  expect(getCellNumber(result.drawioXml, 'Zebra-attribute-0', 'y')).toBe(26);
  expect(getCellNumber(result.drawioXml, 'Zebra-divider-1', 'y')).toBe(52);
  expect(getCellNumber(result.drawioXml, 'Zebra-method-2', 'y')).toBe(60);
  expect(getCellStyle(result.drawioXml, 'Animal')).toContain('childLayout=stackLayout');
  expect(getCellStyle(result.drawioXml, 'Animal')).toContain('resizeParent=1');
});

test('convertMermaidToDrawio - Class Diagram preserves annotations and cardinalities', async () => {
  const code = [
    'classDiagram',
    'direction LR',
    'class "Order Service" as OrderService {',
    '  <<service>>',
    '  +submit(order: Order)',
    '}',
    'OrderService "1" --> "*" Order~T~ : handles',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(result.drawioMode).toBe('native-full');
  expect(getCellNumber(result.drawioXml, 'OrderService', 'x')).toBeLessThan(getCellNumber(result.drawioXml, 'Order~T~', 'x'));
  expect(Math.abs(getCellNumber(result.drawioXml, 'OrderService', 'y') - getCellNumber(result.drawioXml, 'Order~T~', 'y'))).toBeLessThanOrEqual(10);
  expect(result.drawioXml).toContain('value="«service»&#xa;Order Service"');
  expect(result.drawioXml).toContain('value="+submit(order: Order)"');
  expect(result.drawioXml).toContain('source="OrderService" target="Order~T~"');
  expect(getCellStyle(result.drawioXml, 'edge-0')).toContain('endArrow=open;endFill=0');
  expect(getCellStyle(result.drawioXml, 'edge-0')).toContain('exitX=1;exitY=0.5;entryX=0;entryY=0.5;');
  expect(result.drawioXml).toContain('id="edge-0-source-cardinality" value="1"');
  expect(result.drawioXml).toContain('id="edge-0-target-cardinality" value="*"');
  expect(getCellStyle(result.drawioXml, 'edge-0-source-cardinality')).toContain('align=left');
  expect(getCellStyle(result.drawioXml, 'edge-0-target-cardinality')).toContain('align=right');
});

test('convertMermaidToDrawio - Class Diagram preserves Mermaid node placement and waypoints for editable layout', async () => {
  const code = [
    'classDiagram',
    'Animal <|-- Duck',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, {
    svg: '<svg width="600" height="280"></svg>',
    nodes: [
      { id: 'classId-Duck-0', x: 20, y: 0, width: 170, height: 116, label: 'Duck', shape: 'class' },
      { id: 'classId-Animal-1', x: 420, y: 190, width: 170, height: 116, label: 'Animal', shape: 'class' },
    ],
    edges: [
      { id: 'edge-0', sourceId: 'Duck', targetId: 'Animal', label: '', waypoints: [{ x: 999, y: 888 }] },
    ],
  }, code, { classExportMode: 'editable' });

  expect(getCellNumber(result.drawioXml, 'Duck', 'y')).toBeLessThan(getCellNumber(result.drawioXml, 'Animal', 'y'));
  expect(getCellNumber(result.drawioXml, 'Duck', 'x')).toBeLessThan(getCellNumber(result.drawioXml, 'Animal', 'x'));
  expect(result.drawioXml).toContain('<mxPoint x="1020" y="930"/>');
});

test('convertMermaidToDrawio - complex class layout keeps the preview topology', async () => {
  const code = [
    'classDiagram',
    'direction LR',
    'Customer --> Order : places',
    'Order *-- LineItem : contains',
    'OrderService --> Order : manages',
    'OrderService ..> PaymentGateway : uses',
    'StripeGateway ..|> PaymentGateway',
    'OrderService o-- StripeGateway : configures',
  ].join('\n');
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, {
    svg: '<svg width="900" height="420"></svg>',
    nodes: [
      { id: 'classId-Customer-0', x: 20, y: 20, width: 160, height: 60, label: 'Customer', shape: 'class' },
      { id: 'classId-OrderService-1', x: 20, y: 180, width: 180, height: 80, label: 'OrderService', shape: 'class' },
      { id: 'classId-Order-2', x: 300, y: 20, width: 170, height: 100, label: 'Order', shape: 'class' },
      { id: 'classId-LineItem-3', x: 600, y: 20, width: 170, height: 80, label: 'LineItem', shape: 'class' },
      { id: 'classId-StripeGateway-4', x: 300, y: 230, width: 180, height: 60, label: 'StripeGateway', shape: 'class' },
      { id: 'classId-PaymentGateway-5', x: 600, y: 180, width: 190, height: 80, label: 'PaymentGateway', shape: 'class' },
    ],
    edges: ast.edges.map((edge, index) => ({
      id: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      label: edge.label || '',
      waypoints: [{ x: 220 + index * 20, y: 100 + index * 25 }],
    })),
  }, code, { classExportMode: 'editable' });

  expect(getCellNumber(result.drawioXml, 'Customer', 'x')).toBeLessThan(getCellNumber(result.drawioXml, 'Order', 'x'));
  expect(getCellNumber(result.drawioXml, 'Order', 'x')).toBeLessThan(getCellNumber(result.drawioXml, 'LineItem', 'x'));
  expect(getCellNumber(result.drawioXml, 'OrderService', 'y')).toBeGreaterThan(getCellNumber(result.drawioXml, 'Customer', 'y'));
  expect(getCellNumber(result.drawioXml, 'StripeGateway', 'x')).toBeLessThan(getCellNumber(result.drawioXml, 'PaymentGateway', 'x'));
  expect(getCellPoints(result.drawioXml, 'edge-0')).toContainEqual({ x: 240, y: 120 });
});

test('convertMermaidToDrawio - Class Diagram deconflicts repeated relationships', async () => {
  const code = [
    'classDiagram',
    'ClassA --> ClassB : uses',
    'ClassA ..> ClassB : depends',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });
  const edge0Points = getCellPoints(result.drawioXml, 'edge-0');
  const edge1Points = getCellPoints(result.drawioXml, 'edge-1');

  expect(edge0Points.length).toBeGreaterThan(0);
  expect(edge1Points.length).toBeGreaterThan(0);
  expect(edge0Points).not.toEqual(edge1Points);
});

test('convertMermaidToDrawio - Class Diagram honors vertical direction variants', async () => {
  const code = [
    'classDiagram',
    'direction BT',
    'Animal <|-- Duck',
  ].join('\n');

  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code, { classExportMode: 'editable' });

  expect(getCellNumber(result.drawioXml, 'Animal', 'y')).toBeGreaterThan(getCellNumber(result.drawioXml, 'Duck', 'y'));
  expect(getCellStyle(result.drawioXml, 'edge-0')).toContain('exitX=0.5;exitY=1;entryX=0.5;entryY=0;');
});

test('convertMermaidToDrawio - State Diagram uses visual fallback because support is disabled', async () => {
  const code = 'stateDiagram-v2\n[*] --> State1';
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code);

  expect(result.drawioMode).toBe('visual-full');
  expect(result.drawioXml).toContain('shape=image;image=data:image/svg+xml,');
  expect(result.drawioXml).not.toContain('shape=umlState');
});

test('convertMermaidToDrawio - ER Diagram exports native entity shapes', async () => {
  const code = 'erDiagram\nCUSTOMER ||--o{ ORDER : places';
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code);

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('swimlane;horizontal=1');
  expect(result.drawioXml).toContain('CUSTOMER-attribute-0');
  expectNoImageFallback(result.drawioXml);
});

test('convertMermaidToDrawio - Gantt Chart uses visual fallback because support is disabled', async () => {
  const code = 'gantt\ntitle A Gantt Diagram';
  const ast = await parseMermaidAst(code);
  const result = convertMermaidToDrawio(ast, fallbackRenderResult, code);

  expect(result.drawioMode).toBe('visual-full');
  expect(result.drawioXml).toContain('shape=image;image=data:image/svg+xml,');
  expect(result.drawioXml).not.toContain('value="Tasks"');
});
