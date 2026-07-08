// @vitest-environment jsdom

import { expect, test } from 'vitest';
import { convertPlantUMLToDrawio } from './converter';
import { parsePlantUML } from './parser';
import { preprocessPlantUML } from './preprocessor';
import { analyzeDrawioExport } from '../drawio/analysis';
import { getDrawioCellIds, getDrawioEdges, parseDrawioXml } from '../drawio/testUtils';
import type { ParsedPlantUML } from './parser';

function expectNoImageFallback(xml: string) {
  expect(xml).not.toContain('shape=image');
}

test('keeps sequence PlantUML on the native export path', () => {
  const ast: ParsedPlantUML = {
    type: 'sequence',
    nodes: [
      { id: 'a', name: 'Alice', type: 'participant' },
      { id: 'b', name: 'Bob', type: 'participant' },
    ],
    edges: [
      { sourceId: 'a', targetId: 'b', label: 'hello', isDashed: false },
    ],
    notes: [],
    groups: [],
    activations: [],
    unsupportedFeatures: [],
  };

  const result = convertPlantUMLToDrawio(ast, '<svg width="100" height="100"></svg>');

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('Alice');
  expectNoImageFallback(result.drawioXml);
});

test('sizes PlantUML sequence groups around contained lifelines and notes', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
actor Customer
boundary "Web App" as Web
control "Order Service" as Orders
database "Inventory DB" as Inventory
Customer -> Web: Submit checkout
activate Web
Web -> Orders: Create order
activate Orders
loop Reserve each item
  Orders -> Inventory: Reserve stock
  Inventory --> Orders: Reserved
end
opt Audit order
  Orders -> Orders: Record audit event
  note right of Orders: Correlation ID retained
end
Orders --> Web: Order confirmed
deactivate Orders
Web --> Customer: Show confirmation
deactivate Web
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="900" height="500"></svg>');
  const document = parseDrawioXml(result.drawioXml);
  const geometry = (id: string) => document.querySelector(`mxCell[id="${id}"] mxGeometry`)!;
  const x = (id: string) => Number(geometry(id).getAttribute('x'));
  const width = (id: string) => Number(geometry(id).getAttribute('width'));
  const right = (id: string) => x(id) + width(id);

  expect(x('group-0')).toBeGreaterThan(right('node-1'));
  expect(x('group-1')).toBeGreaterThan(right('node-1'));
  expect(right('group-0')).toBeLessThanOrEqual(right('node-3') + 30);
  expect(right('group-1')).toBeGreaterThan(right('note-0'));
  expect(x('group-0-title')).toBe(x('group-0') + 2);
  expect(x('group-1-title')).toBe(x('group-1') + 2);
});

test('renders PlantUML alt else branch dividers in sequence groups', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
autonumber
actor Customer
participant "ATM Machine" as ATM
participant "Bank Server" as Bank
Customer -> ATM: Insert debit card
ATM -> Customer: Prompt for PIN
Customer -> ATM: Enter PIN "1234"
ATM -> Bank: Verify card & PIN
activate Bank
alt Valid PIN
    Bank --> ATM: PIN OK, request approved
    ATM -> Customer: Prompt for amount
    Customer -> ATM: Select $100 Cash
    ATM -> Bank: Debit account $100
    Bank --> ATM: Dispense authorized
    ATM -> Customer: Dispense $100 cash & return card
else Invalid PIN
    Bank --> ATM: Error: Incorrect PIN
    deactivate Bank
    ATM -> Customer: Show "Wrong PIN" message & eject card
end
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="900" height="500"></svg>');
  const document = parseDrawioXml(result.drawioXml);
  const groupGeometry = document.querySelector('mxCell[id="group-0"] mxGeometry')!;
  const branchLineGeometry = document.querySelector('mxCell[id="group-0-branch-0-line"] mxGeometry')!;
  const branchLabel = document.querySelector('mxCell[id="group-0-branch-0-label"]')!;

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('1 Insert debit card');
  expect(result.drawioXml).toContain('11 Error: Incorrect PIN');
  expect(branchLabel.getAttribute('value')).toBe('[Invalid PIN]');
  expect(branchLineGeometry.getAttribute('width')).toBe(groupGeometry.getAttribute('width'));
  expect(Number(branchLineGeometry.getAttribute('y'))).toBeGreaterThan(Number(groupGeometry.getAttribute('y')));
});

test('converts unsupported PlantUML into embedded SVG fallback output', () => {
  const ast: ParsedPlantUML = {
    type: 'unsupported',
    nodes: [],
    edges: [],
    notes: [],
    groups: [],
    activations: [],
    unsupportedFeatures: ['Unsupported diagram family for editable draw.io export.'],
  };

  const result = convertPlantUMLToDrawio(ast, '<svg width="120" height="80"></svg>');

  expect(result.drawioMode).toBe('visual-full');
  expect(result.drawioXml).toContain('shape=image;image=data:image/svg+xml,');
  expect(result.drawioXml).toContain('width="120"');
});

test('keeps PlantUML class diagrams on the native export path', () => {
  const ast: ParsedPlantUML = {
    type: 'class',
    nodes: [
      { id: 'Animal', name: 'Animal', type: 'abstractClass', attributes: ['+age: int'], methods: ['+move()'] },
      { id: 'Runnable', name: 'Runnable', type: 'interface', attributes: [], methods: ['+run()'] },
      { id: 'Kind', name: 'Kind', type: 'enum', attributes: ['DUCK'], methods: [] },
      { id: 'Duck', name: 'Duck', type: 'class', attributes: [], methods: ['+quack()'] },
    ],
    edges: [
      { id: 'edge-0', sourceId: 'Duck', targetId: 'Animal', label: '', isDashed: false, type: 'generalization' },
    ],
    notes: [],
    groups: [],
    activations: [],
    direction: 'TB',
    unsupportedFeatures: [],
  };

  const result = convertPlantUMLToDrawio(ast, '<svg width="100" height="100"></svg>');

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('Animal');
  expect(result.drawioXml).toContain('+move()');
  expect(result.drawioXml).toContain('«abstract»');
  expect(result.drawioXml).toContain('«interface»');
  expect(result.drawioXml).toContain('«enumeration»');
  expect(result.drawioXml).toContain('fontStyle=3');
  expect(result.drawioXml).toContain('endArrow=block;endFill=0');
  expectNoImageFallback(result.drawioXml);
});

test('converts PlantUML class source into editable draw.io class cells', () => {
  const code = `
@startuml
class "Order Service" as OrderService <<service>> {
  +submit(order: Order)
}
class Order~T~ <<entity>> {
  -id: string
  +total(): number
}
OrderService "1" --> "*" Order~T~ : handles
@enduml
`;

  const ast = parsePlantUML(preprocessPlantUML(code));
  const result = convertPlantUMLToDrawio(ast, '<svg width="600" height="300"></svg>');
  const document = parseDrawioXml(result.drawioXml);
  const ids = getDrawioCellIds(result.drawioXml);
  const edges = getDrawioEdges(result.drawioXml);

  expect(result.drawioMode).toBe('native-full');
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual(expect.arrayContaining(['OrderService', 'Order~T~', 'edge-0-source-cardinality', 'edge-0-target-cardinality']));
  expect(edges).toHaveLength(1);
  expect(result.drawioXml).toContain('Order Service');
  expect(result.drawioXml).toContain('«service»');
  expect(result.drawioXml).toContain('«entity»');
  expect(result.drawioXml).toContain('+submit(order: Order)');
  expect(result.drawioXml).toContain('-id: string');
  expect(result.drawioXml).toContain('+total(): number');
  expect(document.querySelector('mxCell[id="OrderService"]')).toBeTruthy();
  expect(document.querySelector('mxCell[id="Order~T~"]')).toBeTruthy();
  expect(document.querySelector('mxCell[id="edge-0-source-cardinality"]')).toBeTruthy();
  expect(document.querySelector('mxCell[id="edge-0-target-cardinality"]')).toBeTruthy();
  expect(document.querySelector('mxCell[id="edge-0"]')).toBeTruthy();
});

test('marks PlantUML class export as native-hybrid when unsupported class directives are present', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
skinparam classAttributeIconSize 0
class User
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="100" height="100"></svg>');

  expect(result.drawioMode).toBe('native-hybrid');
  const supportAnalysis = result.supportAnalysis;
  expect(supportAnalysis).toBeDefined();
  expect(supportAnalysis!.partialFeatures).toContain('PlantUML skinparam directives are not preserved in editable structural export.');
  expect(result.drawioXml).toContain('User');
});

test('renders PlantUML class relationship styles in draw.io XML', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
class Base
class Child
interface Runnable
class Whole
class Part
class Service
class Gateway
Child --|> Base
Child ..|> Runnable
Whole *-- Part : owns
Part --* Whole : belongs
Service o-- Gateway : configures
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="600" height="300"></svg>');

  expect(result.drawioMode).toBe('native-full');
  expect(result.drawioXml).toContain('endArrow=block;endFill=0');
  expect(result.drawioXml).toContain('dashed=1');
  expect(result.drawioXml).toContain('startArrow=diamond;startFill=1;endArrow=none;endFill=0');
  expect(result.drawioXml).toContain('endArrow=diamond;endFill=1');
  expect(result.drawioXml).toContain('startArrow=diamond;startFill=0;endArrow=none;endFill=0');
  expect(result.drawioXml).toContain('value="owns"');
});

test('preserves PlantUML renderer node arrangement for editable class export', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
class Service
class Repository
class Gateway
Service --> Repository
Service ..> Gateway
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="800" height="400"></svg>', [
    { id: 'Service', label: 'Service', x: 20, y: 160, width: 160, height: 60 },
    { id: 'Repository', label: 'Repository', x: 340, y: 20, width: 180, height: 60 },
    { id: 'Gateway', label: 'Gateway', x: 340, y: 240, width: 160, height: 60 },
  ]);
  const document = parseDrawioXml(result.drawioXml);
  const geometry = (id: string) => document.querySelector(`mxCell[id="${id}"] mxGeometry`)!;

  expect(Number(geometry('Service').getAttribute('x'))).toBeLessThan(Number(geometry('Repository').getAttribute('x')));
  expect(Number(geometry('Repository').getAttribute('y'))).toBeLessThan(Number(geometry('Service').getAttribute('y')));
  expect(Number(geometry('Gateway').getAttribute('y'))).toBeGreaterThan(Number(geometry('Service').getAttribute('y')));
});

test('uses rendered class edge labels as clean editable text cells', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
class Customer
class Order
Customer "1" --> "*" Order : places
@enduml
`));

  const result = convertPlantUMLToDrawio(
    ast,
    '<svg width="500" height="200"></svg>',
    [
      { id: 'Customer', label: 'Customer', x: 10, y: 40, width: 160, height: 60 },
      { id: 'Order', label: 'Order', x: 320, y: 40, width: 160, height: 60 },
    ],
    [
      {
        id: 'Customer-to-Order',
        sourcePoint: { x: 170, y: 70 },
        targetPoint: { x: 320, y: 70 },
        waypoints: [],
        label: 'places',
        labelPosition: { x: 245, y: 58 },
      },
    ]
  );
  const document = parseDrawioXml(result.drawioXml);
  const customer = document.querySelector('mxCell[id="Customer"]')!;
  const edge = document.querySelector('mxCell[id="edge-0"]')!;
  const label = document.querySelector('mxCell[id="edge-0-label"]')!;

  expect(customer.getAttribute('style')).toContain('childLayout=stackLayout');
  expect(customer.getAttribute('style')).toContain('resizeParent=1');
  expect(customer.getAttribute('style')).toContain('collapsible=1');
  expect(edge.getAttribute('value')).toBe('');
  expect(label.getAttribute('value')).toBe('places');
  expect(label.getAttribute('style')).toContain('fillColor=#ffffff');
});

test('uses direct class connectors for rendered PlantUML edge geometry', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
class Service
class Order
Service --> Order : manages
@enduml
`));

  const result = convertPlantUMLToDrawio(
    ast,
    '<svg width="600" height="300"></svg>',
    [
      { id: 'Service', label: 'Service', x: 20, y: 200, width: 160, height: 80 },
      { id: 'Order', label: 'Order', x: 360, y: 40, width: 160, height: 80 },
    ],
    [
      {
        id: 'Service-to-Order',
        sourcePoint: { x: 180, y: 240 },
        targetPoint: { x: 360, y: 80 },
        waypoints: [
          { x: 240, y: 187 },
          { x: 300, y: 133 },
        ],
        label: 'manages',
        labelPosition: { x: 270, y: 155 },
      },
    ]
  );
  const document = parseDrawioXml(result.drawioXml);
  const edge = document.querySelector('mxCell[id="edge-0"]')!;

  expect(edge.getAttribute('style')).toContain('edgeStyle=none');
  expect(edge.getAttribute('style')).not.toContain('edgeStyle=orthogonalEdgeStyle');
  expect(edge.querySelector('Array[as="points"]')).toBeNull();
});

test('uses curved class connectors when rendered PlantUML edge geometry bends around obstacles', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
class Service
class Gateway
Service ..> Gateway : uses
@enduml
`));

  const result = convertPlantUMLToDrawio(
    ast,
    '<svg width="800" height="300"></svg>',
    [
      { id: 'Service', label: 'Service', x: 20, y: 40, width: 160, height: 80 },
      { id: 'Gateway', label: 'Gateway', x: 560, y: 50, width: 160, height: 80 },
    ],
    [
      {
        id: 'Service-to-Gateway',
        sourcePoint: { x: 180, y: 110 },
        targetPoint: { x: 560, y: 100 },
        waypoints: [
          { x: 220, y: 150 },
          { x: 280, y: 180 },
          { x: 350, y: 190 },
          { x: 420, y: 175 },
          { x: 500, y: 140 },
        ],
        label: 'uses',
        labelPosition: { x: 370, y: 150 },
      },
    ]
  );
  const document = parseDrawioXml(result.drawioXml);
  const edge = document.querySelector('mxCell[id="edge-0"]')!;

  expect(edge.getAttribute('style')).toContain('edgeStyle=none');
  expect(edge.getAttribute('style')).toContain('curved=1');
  expect(edge.querySelectorAll('Array[as="points"] mxPoint')).toHaveLength(1);
});

test('exports source-side PlantUML class diamonds from the full order sample', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
class "Order Service" as OrderService <<service>> {
  +submit(order: Order)
  +cancel(orderId: String)
}
class Order <<entity>> {
  -id: String
  -status: OrderStatus
  +total(): Decimal
}
class LineItem {
  -quantity: int
  +subtotal(): Decimal
}
interface PaymentGateway {
  +authorize(amount: Decimal)
}
class StripeGateway {
  +authorize(amount: Decimal)
}
class Customer {
  +customerId: String
}
Customer "1" --> "*" Order : places
Order "1" *-- "1..*" LineItem : contains
OrderService --> Order : manages
OrderService ..> PaymentGateway : uses
StripeGateway ..|> PaymentGateway
OrderService o-- StripeGateway : configures
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="1200" height="600"></svg>');
  const document = parseDrawioXml(result.drawioXml);
  const contains = document.querySelector('mxCell[id="edge-1"]')!;
  const configures = document.querySelector('mxCell[id="edge-5"]')!;

  expect(contains.getAttribute('style')).toContain('startArrow=diamond;startFill=1;endArrow=none;endFill=0');
  expect(configures.getAttribute('style')).toContain('startArrow=diamond;startFill=0;endArrow=none;endFill=0');
});

test('keeps the e-commerce PlantUML class sample aligned to renderer hints', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
skinparam classAttributeIconSize 0
title E-Commerce System - Class Diagram

interface PaymentProcessor {
    + {abstract} processPayment(amount: double): boolean
}

abstract class User {
    - id: String
    # name: String
    + email: String
    + login(): boolean
}

class Customer {
    - shippingAddress: String
    + placeOrder(): Order
}

class Order {
    - orderId: String
    - totalAmount: double
    + calculateTotal(): void
}

class OrderItem {
    - quantity: int
    - price: double
}

class Product {
    - sku: String
    + name: String
    + price: double
}

class CreditCardProcessor {
    - apiKey: String
    + processPayment(amount: double): boolean
}

User <|-- Customer : Inheritance
Customer "1" *-- "0..*" Order : Composition
Order "1" *-- "1..*" OrderItem : Composition
OrderItem "0..*" --> "1" Product : Association
Customer ..> PaymentProcessor : Dependency
PaymentProcessor <|.. CreditCardProcessor : Realization
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="900" height="1000"></svg>', [
    { id: 'User', label: 'User', x: 380, y: 60, width: 170, height: 150 },
    { id: 'Customer', label: 'Customer', x: 350, y: 300, width: 220, height: 130 },
    { id: 'Order', label: 'Order', x: 560, y: 500, width: 220, height: 160 },
    { id: 'OrderItem', label: 'OrderItem', x: 590, y: 730, width: 160, height: 120 },
    { id: 'Product', label: 'Product', x: 590, y: 960, width: 170, height: 150 },
    { id: 'PaymentProcessor', label: 'PaymentProcessor', x: 100, y: 520, width: 390, height: 90 },
    { id: 'CreditCardProcessor', label: 'CreditCardProcessor', x: 100, y: 760, width: 390, height: 120 },
  ]);
  const document = parseDrawioXml(result.drawioXml);
  const geometry = (id: string) => document.querySelector(`mxCell[id="${id}"] mxGeometry`)!;
  const cell = (id: string) => document.querySelector(`mxCell[id="${id}"]`);
  const title = document.querySelector('mxCell[id="diagram-title"]')!;

  expect(title.getAttribute('value')).toBe('E-Commerce System - Class Diagram');
  expect(cell('OrderItem-0')).toBeNull();
  expect(result.drawioXml).not.toContain('OrderItem &quot;0');
  expect(result.drawioXml).not.toContain('1&quot; Product');
  expect(Number(geometry('Customer').getAttribute('y'))).toBeGreaterThan(Number(geometry('User').getAttribute('y')));
  expect(Number(geometry('PaymentProcessor').getAttribute('x'))).toBeLessThan(Number(geometry('Customer').getAttribute('x')));
  expect(Number(geometry('OrderItem').getAttribute('y'))).toBeGreaterThan(Number(geometry('Order').getAttribute('y')));
  expect(Number(geometry('Product').getAttribute('y'))).toBeGreaterThan(Number(geometry('OrderItem').getAttribute('y')));
});

test('falls back visually for PlantUML component diagrams', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
package "Platform" as Platform {
  package "Core" as Core {
    component "Web App" as WEB <<service>>
    interface "HTTP API" as API <<boundary>>
    queue Jobs
    database DB
  }
}
actor Worker
WEB : +health()
Platform --> Core : contains
Core --> DB : owns
WEB --> API : serves
API --> Jobs : enqueues
Worker --> Jobs : drains
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="1000" height="600"></svg>');

  expect(ast.type).toBe('unsupported');
  expect(result.drawioMode).toBe('visual-full');
  expect(result.drawioXml).toContain('shape=image');
  expect(result.drawioXml).toContain('image=data:image/svg+xml');
});

test('converts PlantUML Use Case diagrams into native actors, ellipses, containers, and UML edges', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
actor "Customer" as Customer <<human>>
rectangle "Commerce Platform" as Platform {
  (Checkout\\nOrder) as Checkout <<primary>>
  usecase "Authenticate User" as Authenticate
}
Customer --> Checkout : starts
Checkout ..> Authenticate : <<include>>
Premium --|> Customer
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="900" height="500"></svg>');
  const document = parseDrawioXml(result.drawioXml);
  const ids = getDrawioCellIds(result.drawioXml);

  expect(ast.type).toBe('usecase');
  expect(result.drawioMode).toBe('native-full');
  expect(new Set(ids).size).toBe(ids.length);
  expect(document.querySelector('mxCell[id="Customer"]')?.getAttribute('style')).toContain('shape=umlActor');
  expect(document.querySelector('mxCell[id="Checkout"]')?.getAttribute('style')).toContain('ellipse');
  expect(document.querySelector('mxCell[id="Checkout"]')?.getAttribute('parent')).toBe('Platform');
  expect(document.querySelector('mxCell[id="Platform"]')?.getAttribute('style')).toContain('container=1');
  expect(result.drawioXml).toContain('«include»');
  expect(result.drawioXml).toContain('dashed=1');
  expect(result.drawioXml).toContain('endArrow=block;endFill=0');
  expect(getDrawioEdges(result.drawioXml)).toHaveLength(3);
  expectNoImageFallback(result.drawioXml);
});

test('places Use Case actors according to direction and relationship role', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
right to left direction
actor Customer
actor Fulfillment
usecase "Checkout Order" as Checkout
Customer --> Checkout : starts
Checkout --> Fulfillment : notifies
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="900" height="500"></svg>');
  const document = parseDrawioXml(result.drawioXml);
  const x = (id: string) => Number(document.querySelector(`mxCell[id="${id}"] mxGeometry`)!.getAttribute('x'));

  expect(result.drawioMode).toBe('native-full');
  expect(x('Customer')).toBeGreaterThan(x('Checkout'));
  expect(x('Fulfillment')).toBeLessThan(x('Checkout'));
});

test('routes Use Case actor hierarchy with direct pinned connectors', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
actor Customer
actor Support
rectangle "Ordering System" as Ordering {
  usecase "Browse Catalog" as Browse
  usecase "Checkout Order" as Checkout
}
Customer --> Browse : explores
Support --> Checkout : assists
Premium --|> Customer
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="900" height="500"></svg>');
  const edges = getDrawioEdges(result.drawioXml);
  const hierarchyEdge = edges.find((edge) =>
    edge.getAttribute('source') === 'Premium' && edge.getAttribute('target') === 'Customer'
  )!;
  const actorUseCaseEdge = edges.find((edge) =>
    edge.getAttribute('source') === 'Support' && edge.getAttribute('target') === 'Checkout'
  )!;
  const hierarchyPoints = Array.from(hierarchyEdge.querySelectorAll('Array[as="points"] mxPoint'));

  expect(result.drawioMode).toBe('native-full');
  expect(actorUseCaseEdge.getAttribute('style')).toContain('exitX=');
  expect(actorUseCaseEdge.getAttribute('style')).toContain('entryX=');
  expect(actorUseCaseEdge.getAttribute('style')).not.toContain('edgeStyle=orthogonalEdgeStyle');
  expect(actorUseCaseEdge.getAttribute('style')).toContain('curved=1');
  expect(hierarchyEdge.getAttribute('style')).not.toContain('edgeStyle=orthogonalEdgeStyle');
  expect(hierarchyPoints).toHaveLength(0);
});

test('preserves partial PlantUML Use Case render positions when SVG hints are incomplete', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
actor Customer
actor Auditor
actor Support
rectangle "Ordering System" as Ordering {
  usecase "Browse Catalog" as Browse
  usecase "Checkout Order" as Checkout
}
Customer --> Browse : explores
Auditor --> Checkout : reviews
Support --> Checkout : assists
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="900" height="500"></svg>', [
    { id: 'elem_Customer', label: 'Customer', x: 120, y: 260, width: 70, height: 95 },
    { id: 'elem_Auditor', label: 'Auditor', x: 40, y: 120, width: 70, height: 95 },
    { id: 'elem_Support', label: 'Support', x: 520, y: 20, width: 80, height: 95 },
    { id: 'elem_Browse', label: 'Browse Catalog', x: 280, y: 240, width: 160, height: 60 },
    { id: 'cluster_Ordering', label: 'Ordering System', x: 250, y: 190, width: 500, height: 220 },
  ]);
  const document = parseDrawioXml(result.drawioXml);
  const geometry = (id: string) => document.querySelector(`mxCell[id="${id}"] mxGeometry`)!;
  const y = (id: string) => Number(geometry(id).getAttribute('y'));

  expect(result.drawioMode).toBe('native-full');
  expect(y('Support')).toBeLessThan(y('Auditor'));
  expect(y('Auditor')).toBeLessThan(y('Customer'));
  expect(Number(geometry('Ordering').getAttribute('width'))).toBeGreaterThan(400);
});

test('keeps rendered Use Case actors compact even with long labels', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
actor "Premium Customer" as Premium
usecase "Checkout Order" as Checkout
Premium --> Checkout
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="500" height="200"></svg>', [
    { id: 'Premium', label: 'Premium Customer', x: 10, y: 30, width: 136, height: 72 },
    { id: 'Checkout', label: 'Checkout Order', x: 260, y: 50, width: 160, height: 70 },
  ]);
  const document = parseDrawioXml(result.drawioXml);
  const premium = document.querySelector('mxCell[id="Premium"] mxGeometry')!;

  expect(Number(premium.getAttribute('width'))).toBeLessThan(80);
  expect(Number(premium.getAttribute('height'))).toBeLessThan(100);
});

test('keeps top-level rendered Use Case actors clear of system boundaries', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
actor Support
package "Commerce Platform" as Platform {
  usecase "Process Refund" as Refund
}
Support --> Refund : assists
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="500" height="260"></svg>', [
    { id: 'Support', label: 'Support', x: 260, y: 40, width: 70, height: 76 },
    { id: 'Refund', label: 'Process Refund', x: 280, y: 150, width: 140, height: 34 },
    { id: 'Platform', label: 'Commerce Platform', x: 220, y: 92, width: 260, height: 130 },
  ]);
  const document = parseDrawioXml(result.drawioXml);
  const geometry = (id: string) => document.querySelector(`mxCell[id="${id}"] mxGeometry`)!;
  const support = geometry('Support');
  const platform = geometry('Platform');

  expect(Number(support.getAttribute('y')) + Number(support.getAttribute('height'))).toBeLessThan(
    Number(platform.getAttribute('y'))
  );
});

test('keeps rendered one-line Use Case ovals close to PlantUML dimensions', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
usecase "Browse Catalog" as Browse
usecase "Checkout Order" as Checkout
Browse --> Checkout
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="500" height="200"></svg>', [
    { id: 'Browse', label: 'Browse Catalog', x: 20, y: 60, width: 142, height: 34 },
    { id: 'Checkout', label: 'Checkout Order', x: 240, y: 60, width: 160, height: 34 },
  ]);
  const document = parseDrawioXml(result.drawioXml);
  const browse = document.querySelector('mxCell[id="Browse"] mxGeometry')!;

  expect(Number(browse.getAttribute('height'))).toBeLessThan(60);
  expect(Number(browse.getAttribute('width'))).toBeLessThan(170);
});

test('uses PlantUML endpoints without turning curve samples into crooked Use Case bends', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
actor Customer
usecase "Checkout Order" as Checkout
Customer --> Checkout : starts
@enduml
`));

  const result = convertPlantUMLToDrawio(
    ast,
    '<svg width="500" height="200"></svg>',
    [
      { id: 'elem_Customer', label: 'Customer', x: 20, y: 30, width: 80, height: 100 },
      { id: 'elem_Checkout', label: 'Checkout Order', x: 260, y: 60, width: 160, height: 70 },
    ],
    [
      {
        id: 'link_Customer_Checkout',
        sourcePoint: { x: 100, y: 80 },
        targetPoint: { x: 260, y: 95 },
        waypoints: [{ x: 130, y: 95 }, { x: 210, y: 110 }],
        label: 'starts',
        labelPosition: { x: 170, y: 80 },
      },
    ]
  );
  const document = parseDrawioXml(result.drawioXml);
  const edge = getDrawioEdges(result.drawioXml)[0];
  const points = Array.from(edge.querySelectorAll('Array[as="points"] mxPoint'));
  const label = document.querySelector('mxCell[id$="-label"]')!;
  const labelGeometry = label.querySelector('mxGeometry')!;

  expect(edge.getAttribute('value')).toBe('');
  expect(edge.getAttribute('style')).toContain('edgeStyle=none');
  expect(edge.getAttribute('style')).toContain('curved=0');
  expect(edge.getAttribute('style')).not.toContain('edgeStyle=orthogonalEdgeStyle');
  expect(edge.getAttribute('style')).toContain('exitX=1');
  expect(edge.getAttribute('style')).toContain('entryX=0');
  expect(points).toHaveLength(0);
  expect(label.getAttribute('value')).toBe('starts');
  expect(label.getAttribute('style')).toContain('fillColor=#ffffff');
  expect(labelGeometry.getAttribute('x')).toBe('160');
  expect(labelGeometry.getAttribute('y')).toBe('70');
});

test('curves rendered Use Case edges around blocking native shapes', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
actor Customer
usecase "View Item Details" as Details
usecase "Add to Cart" as Add
Customer --> Add
@enduml
`));

  const result = convertPlantUMLToDrawio(
    ast,
    '<svg width="700" height="300"></svg>',
    [
      { id: 'Customer', label: 'Customer', x: 20, y: 110, width: 56, height: 74 },
      { id: 'Details', label: 'View Item Details', x: 220, y: 130, width: 170, height: 70 },
      { id: 'Add', label: 'Add to Cart', x: 520, y: 150, width: 160, height: 70 },
    ],
    [
      {
        id: 'link_Customer_Add',
        sourcePoint: { x: 76, y: 147 },
        targetPoint: { x: 520, y: 185 },
        waypoints: [],
      },
    ]
  );
  const document = parseDrawioXml(result.drawioXml);
  const edge = getDrawioEdges(result.drawioXml)[0];
  const detailsGeometry = document.querySelector('mxCell[id="Details"] mxGeometry')!;
  const points = Array.from(edge.querySelectorAll('Array[as="points"] mxPoint'));
  const waypointY = Number(points[0]?.getAttribute('y'));
  const detailsY = Number(detailsGeometry.getAttribute('y'));
  const detailsBottom = detailsY + Number(detailsGeometry.getAttribute('height'));

  expect(edge.getAttribute('style')).toContain('edgeStyle=none');
  expect(edge.getAttribute('style')).toContain('curved=1');
  expect(points).toHaveLength(1);
  expect(waypointY < detailsY || waypointY > detailsBottom).toBe(true);
});

test('exports dotted Use Case direction arrows without bogus actor vertices', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
rectangle "Movie Booking" {
  usecase "Book Ticket" as UC_Book
  usecase "Purchase/Upgrade Membership" as UC_Membership
  usecase "Add Item to Order" as UC_AddCart
  usecase "Filter F&B Items" as UC_FilterFnB
  UC_Membership .up.> UC_Book : <<extend>>
  UC_FilterFnB .u.> UC_AddCart : <<extend>>
}
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="700" height="400"></svg>');
  const ids = getDrawioCellIds(result.drawioXml);
  const edges = getDrawioEdges(result.drawioXml);

  expect(ids).toContain('UC_Membership');
  expect(ids).toContain('UC_FilterFnB');
  expect(ids).not.toContain('UC_Membership .up');
  expect(ids).not.toContain('UC_FilterFnB .u');
  expect(result.drawioXml).not.toContain('UC_Membership .up');
  expect(result.drawioXml).not.toContain('UC_FilterFnB .u');
  expect(edges.some((edge) =>
    edge.getAttribute('source') === 'UC_Membership' && edge.getAttribute('target') === 'UC_Book'
  )).toBe(true);
  expect(edges.some((edge) =>
    edge.getAttribute('source') === 'UC_FilterFnB' && edge.getAttribute('target') === 'UC_AddCart'
  )).toBe(true);
});

test('places Use Case dependency labels above horizontal fallback edges', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
usecase Checkout
usecase "Make Payment" as Payment
Checkout ..> Payment : <<include>>
@enduml
`));

  const result = convertPlantUMLToDrawio(
    ast,
    '<svg width="700" height="300"></svg>',
    [
      { id: 'Checkout', label: 'Checkout', x: 120, y: 140, width: 160, height: 60 },
      { id: 'Payment', label: 'Make Payment', x: 460, y: 190, width: 190, height: 60 },
    ]
  );
  const document = parseDrawioXml(result.drawioXml);
  const checkout = document.querySelector('mxCell[id="Checkout"] mxGeometry')!;
  const payment = document.querySelector('mxCell[id="Payment"] mxGeometry')!;
  const label = document.querySelector('mxCell[id="edge-0-label"]')!;
  const labelGeometry = label.querySelector('mxGeometry')!;
  const sourceX = Number(checkout.getAttribute('x')) + Number(checkout.getAttribute('width'));
  const sourceY = Number(checkout.getAttribute('y')) + Number(checkout.getAttribute('height')) / 2;
  const targetX = Number(payment.getAttribute('x'));
  const targetY = Number(payment.getAttribute('y')) + Number(payment.getAttribute('height')) / 2;
  const labelCenterX = Number(labelGeometry.getAttribute('x')) + Number(labelGeometry.getAttribute('width')) / 2;
  const labelCenterY = Number(labelGeometry.getAttribute('y')) + Number(labelGeometry.getAttribute('height')) / 2;

  expect(label.getAttribute('value')).toBe('«include»');
  expect(labelCenterX).toBeGreaterThan(sourceX);
  expect(labelCenterX).toBeLessThan(targetX);
  expect(labelCenterY).toBeLessThan((sourceY + targetY) / 2);
});

test('renders Use Case notes and nested boundaries as editable draw.io cells', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
top to bottom direction
package "Commerce Platform" as Platform {
  rectangle "Ordering System" as Ordering {
    actor "Support Agent" as Support
    usecase Checkout as "Checkout Order" <<primary>>
    note right of Checkout
      Requires payment authorization
    end note
    note "Shared policy" as Policy
    Policy .. Checkout : documents
  }
}
Support -down-> Checkout : include
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="900" height="500"></svg>');
  const document = parseDrawioXml(result.drawioXml);
  const ids = getDrawioCellIds(result.drawioXml);
  const edges = getDrawioEdges(result.drawioXml);
  const checkout = document.querySelector('mxCell[id="Checkout"]')!;
  const ordering = document.querySelector('mxCell[id="Ordering"]')!;
  const support = document.querySelector('mxCell[id="Support"]')!;
  const attachedNote = document.querySelector('mxCell[id^="note-Checkout"]')!;
  const noteGeometry = attachedNote.querySelector('mxGeometry')!;

  expect(ast.type).toBe('usecase');
  expect(result.drawioMode).toBe('native-hybrid');
  expect(new Set(ids).size).toBe(ids.length);
  expect(ordering.getAttribute('parent')).toBe('Platform');
  expect(checkout.getAttribute('parent')).toBe('Ordering');
  expect(support.getAttribute('parent')).toBe('Ordering');
  expect(attachedNote.getAttribute('style')).toContain('shape=note');
  expect(attachedNote.getAttribute('parent')).toBe('Ordering');
  expect(Number.isFinite(Number(noteGeometry.getAttribute('x')))).toBe(true);
  expect(result.drawioXml).toContain('Requires payment authorization');
  expect(result.drawioXml).toContain('Shared policy');
  expect(result.drawioXml).toContain('«primary»');
  expect(edges.length).toBeGreaterThanOrEqual(3);
  edges.forEach((edge) => {
    expect(ids).toContain(edge.getAttribute('source'));
    expect(ids).toContain(edge.getAttribute('target'));
  });
});

test('renders Use Case container titles in PlantUML-like positions', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
package "Commerce Platform" as Platform {
  rectangle "Ordering System" as Ordering {
    usecase "Browse Catalog" as Browse
  }
}
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="700" height="300"></svg>', [
    { id: 'Platform', label: 'Commerce Platform', x: 100, y: 80, width: 520, height: 190 },
    { id: 'Ordering', label: 'Ordering System', x: 130, y: 110, width: 460, height: 130 },
    { id: 'Browse', label: 'Browse Catalog', x: 180, y: 160, width: 140, height: 34 },
  ]);
  const document = parseDrawioXml(result.drawioXml);
  const platformTitle = document.querySelector('mxCell[id="Platform-title"]')!;
  const orderingTitle = document.querySelector('mxCell[id="Ordering-title"]')!;
  const platformTitleGeometry = platformTitle.querySelector('mxGeometry')!;
  const orderingTitleGeometry = orderingTitle.querySelector('mxGeometry')!;

  expect(platformTitle.getAttribute('value')).toBe('Commerce Platform');
  expect(platformTitle.getAttribute('parent')).toBe('1');
  expect(Number(platformTitleGeometry.getAttribute('y'))).toBe(Number(document.querySelector('mxCell[id="Platform"] mxGeometry')!.getAttribute('y')));
  expect(orderingTitle.getAttribute('value')).toBe('Ordering System');
  expect(orderingTitle.getAttribute('parent')).toBe('Ordering');
  expect(orderingTitle.getAttribute('style')).toContain('align=center');
  expect(Number(orderingTitleGeometry.getAttribute('x'))).toBeGreaterThan(0);
});

test('keeps long and disconnected Use Case nodes finite and non-overlapping', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
top to bottom direction
actor Customer
usecase "Review a very long compliance and fraud investigation report" as Review
usecase "Export Evidence" as Export
Customer --> Review
@enduml
`));

  const result = convertPlantUMLToDrawio(ast, '<svg width="900" height="500"></svg>');
  const document = parseDrawioXml(result.drawioXml);
  const review = document.querySelector('mxCell[id="Review"] mxGeometry')!;
  const exported = document.querySelector('mxCell[id="Export"] mxGeometry')!;

  expect(Number(review.getAttribute('width'))).toBeGreaterThan(170);
  expect(Number.isFinite(Number(review.getAttribute('x')))).toBe(true);
  expect(Number.isFinite(Number(exported.getAttribute('x')))).toBe(true);
  expect(review.getAttribute('x')).not.toBe(exported.getAttribute('x'));
});

test('keeps partial Use Case exports with label-derived ids editable', () => {
  const ast = parsePlantUML(preprocessPlantUML(`
@startuml
left to right direction
skinparam packageStyle rectangle
actor Customer
actor Admin
rectangle "E-Commerce System" {
  Customer --> (Browse Products)
  Customer --> (Add to Cart)
  Customer --> (Checkout)
  (Checkout) ..> (Make Payment) : <<include>>
  (Checkout) ..> (Apply Discount) : <<extend>>
  Admin --> (Manage Inventory)
  Admin --> (Manage Users)
}
@enduml
`));

  const rawResult = convertPlantUMLToDrawio(ast, '<svg width="1000" height="600"></svg>');
  const result = analyzeDrawioExport({
    ...rawResult,
    svg: '<svg width="1000" height="600"></svg>',
    unsupportedFeatures: ast.unsupportedFeatures,
    diagnostics: ast.diagnostics,
    coverage: ast.coverage,
    expectedContent: {
      vertexIds: ast.nodes.map((node) => node.id),
      edgeIds: ast.edges.map((edge, index) => edge.id || `edge-${index}`),
    },
  });
  const document = parseDrawioXml(result.drawioXml);

  expect(result.drawioMode).toBe('native-hybrid');
  expect(document.querySelector('mxCell[id="Browse-Products"]')).toBeTruthy();
  expect(document.querySelector('mxCell[id="s2d-original-reference"]')).toBeNull();
  expect(result.drawioXml).not.toContain('shape=image');
  expect(result.drawioXml).not.toContain('s2d-original-reference-layer');
  expect(result.exportDiagnostics.join(' ')).not.toContain('Validation failed');
});
