import type { DrawioMode } from '../core/drawio/output';

export type ExampleKind = 'mermaid' | 'plantuml';

export interface DiagramExample {
  id: string;
  group: 'Mermaid' | 'PlantUML';
  name: string;
  type: ExampleKind;
  subtype: string;
  code: string;
  expectedMode: DrawioMode;
  minimumNodes: number;
  minimumEdges: number;
  expectedLabels: string[];
}

export const DIAGRAM_EXAMPLES: DiagramExample[] = [
  {
    id: 'mermaid-flowchart',
    group: 'Mermaid',
    name: 'Mermaid Flowchart',
    type: 'mermaid',
    subtype: 'flowchart',
    expectedMode: 'native-full',
    minimumNodes: 10,
    minimumEdges: 11,
    expectedLabels: ['Checkout Request', 'Fraud Review', 'Order Database', 'Send Receipt'],
    code: `flowchart LR
    subgraph Client["Customer Experience"]
      Start([Checkout Request]) --> Validate{Cart valid?}
      Validate -->|No| Fix[Fix Cart]
      Fix --> Start
    end
    subgraph Platform["Commerce Platform"]
      Validate -->|Yes| Risk{{Fraud Review}}
      Risk -->|Approve| Reserve[[Reserve Inventory]]
      Risk -->|Reject| Reject[Reject Order]
      Reserve --> Charge[/Charge Payment/]
      Charge --> Orders[(Order Database)]
      Orders --> Receipt[Send Receipt]
    end
    Receipt --> Done((Complete))
    Reject --> Start`,
  },
  {
    id: 'mermaid-sequence',
    group: 'Mermaid',
    name: 'Mermaid Sequence',
    type: 'mermaid',
    subtype: 'sequence',
    expectedMode: 'native-full',
    minimumNodes: 4,
    minimumEdges: 7,
    expectedLabels: ['Customer', 'Web App', 'Order API', 'Inventory DB'],
    code: `sequenceDiagram
    actor Customer
    participant "Web App" as Web
    participant "Order API" as API
    participant "Inventory DB" as DB
    Customer->>Web: Submit checkout
    activate Web
    Web->>API: Create order
    activate API
    loop Reserve each line item
      API->>DB: Reserve inventory
      DB-->>API: Reservation result
    end
    opt Audit successful checkout
      API->>API: Record audit event
      Note right of API: Correlation ID retained
    end
    API-->>Web: Order confirmed
    deactivate API
    Web-->>Customer: Show confirmation
    deactivate Web`,
  },
  {
    id: 'mermaid-class',
    group: 'Mermaid',
    name: 'Mermaid Class',
    type: 'mermaid',
    subtype: 'classDiagram',
    expectedMode: 'native-full',
    minimumNodes: 6,
    minimumEdges: 6,
    expectedLabels: ['OrderService', 'Order', 'PaymentGateway', 'LineItem'],
    code: `classDiagram
    direction LR
    class OrderService {
      <<service>>
      +submit(order: Order)
      +cancel(orderId: String)
    }
    class Order {
      <<entity>>
      -id: String
      -status: OrderStatus
      +total(): Decimal
    }
    class LineItem {
      -quantity: int
      +subtotal(): Decimal
    }
    class PaymentGateway {
      <<interface>>
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
    OrderService o-- StripeGateway : configures`,
  },
  {
    id: 'mermaid-er',
    group: 'Mermaid',
    name: 'Mermaid ER',
    type: 'mermaid',
    subtype: 'erDiagram',
    expectedMode: 'native-full',
    minimumNodes: 5,
    minimumEdges: 5,
    expectedLabels: ['CUSTOMER', 'ORDER', 'LINE_ITEM', 'PRODUCT', 'PAYMENT'],
    code: `erDiagram
    CUSTOMER {
      string customer_id PK
      string email
      string tier
    }
    ORDER {
      string order_id PK
      date placed_at
      decimal total
    }
    LINE_ITEM {
      int quantity
      decimal unit_price
    }
    PRODUCT {
      string sku PK
      string name
    }
    PAYMENT {
      string payment_id PK
      string status
    }
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : referenced_by
    ORDER ||--o| PAYMENT : settled_by
    CUSTOMER }o--o{ PRODUCT : favorites`,
  },
  {
    id: 'plantuml-sequence',
    group: 'PlantUML',
    name: 'PlantUML Sequence',
    type: 'plantuml',
    subtype: 'sequence',
    expectedMode: 'native-full',
    minimumNodes: 4,
    minimumEdges: 7,
    expectedLabels: ['Customer', 'Web App', 'Order Service', 'Inventory DB'],
    code: `@startuml
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
@enduml`,
  },
  {
    id: 'plantuml-class',
    group: 'PlantUML',
    name: 'PlantUML Class',
    type: 'plantuml',
    subtype: 'class',
    expectedMode: 'native-full',
    minimumNodes: 6,
    minimumEdges: 6,
    expectedLabels: ['Order Service', 'Order', 'PaymentGateway', 'StripeGateway'],
    code: `@startuml
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
@enduml`,
  },
  {
    id: 'plantuml-usecase',
    group: 'PlantUML',
    name: 'PlantUML Use Case',
    type: 'plantuml',
    subtype: 'usecase',
    expectedMode: 'native-full',
    minimumNodes: 11,
    minimumEdges: 10,
    expectedLabels: ['Customer', 'Support Agent', 'Checkout\\nOrder', 'Authenticate User', 'Commerce Platform'],
    code: `@startuml
left to right direction
actor "Customer" as Customer <<human>>
:Support Agent: as Support
actor "Premium Customer" as Premium
package "Commerce Platform" as Platform {
  rectangle "Ordering System" as Ordering {
    usecase "Browse Catalog" as Browse
    (Checkout\\nOrder) as Checkout <<primary>>
    usecase "Authenticate User" as Authenticate
    usecase "Apply Loyalty Discount" as Discount
    usecase "Process Refund" as Refund
    usecase "Review Audit Log" as AuditLog
  }
}
Customer --> Browse : explores
Customer --> Checkout : starts
Support --> Refund : assists
Premium --|> Customer
Checkout ..> Authenticate : <<include>>
Checkout ..> Discount : <<extend>>
Refund ..> Authenticate : <<include>>
Auditor --> AuditLog : reviews
Browse --> Checkout : selects items
Checkout --> Refund : may request
@enduml`,
  },
];

export const DEFAULT_EXAMPLE = DIAGRAM_EXAMPLES[0];

export function getDiagramExample(id: string) {
  return DIAGRAM_EXAMPLES.find((example) => example.id === id);
}
