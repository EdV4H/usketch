# コンポーネントアーキテクチャ図

## 🏗️ システム全体のアーキテクチャ

### レイヤード構造

```mermaid
graph TB
    subgraph "Presentation Layer"
        UI[UI Components]
        TB[Toolbar]
        PM[Property Panel]
    end
    
    subgraph "Application Layer"
        WC[WhiteboardCanvas]
        TM[ToolManager]
        SL[SelectionLayer]
    end
    
    subgraph "Domain Layer"
        Tools[Tools]
        Shapes[Shapes]
        Commands[Commands]
    end
    
    subgraph "Infrastructure Layer"
        Store[WhiteboardStore]
        EventBus[EventBus]
        Renderer[DOMRenderer]
    end
    
    UI --> WC
    TB --> TM
    PM --> Store
    
    WC --> TM
    WC --> SL
    WC --> Renderer
    
    TM --> Tools
    TM --> Store
    
    SL --> Store
    SL --> Renderer
    
    Tools --> Commands
    Commands --> Store
    
    Store --> EventBus
    EventBus --> Renderer
```

## 🔄 データフローダイアグラム

### ユーザーインタラクションフロー

```mermaid
sequenceDiagram
    participant User
    participant Canvas
    participant ToolManager
    participant Tool
    participant Store
    participant SelectionLayer
    participant Renderer
    
    User->>Canvas: Click/Drag
    Canvas->>ToolManager: Pointer Event
    ToolManager->>Tool: Handle Event
    
    alt Shape Creation
        Tool->>Store: Add Shape
        Store->>EventBus: Shape Added
        EventBus->>Renderer: Update View
        EventBus->>SelectionLayer: Update Selection
    else Shape Selection
        Tool->>Store: Select Shape
        Store->>EventBus: Selection Changed
        EventBus->>SelectionLayer: Show Selection
        SelectionLayer->>Renderer: Draw Selection Box
    else Shape Modification
        Tool->>Store: Update Shape
        Store->>EventBus: Shape Updated
        EventBus->>Renderer: Update Shape
        EventBus->>SelectionLayer: Update Selection
    end
```

## 🧩 コンポーネント間の関係

### 依存関係マトリックス

```mermaid
graph LR
    subgraph "Core Components"
        WC[WhiteboardCanvas]
        TM[ToolManager]
        SL[SelectionLayer]
        ST[Store]
    end
    
    subgraph "Tools"
        SEL[SelectTool]
        RECT[RectangleTool]
        ELLI[EllipseTool]
        LINE[LineTool]
    end
    
    subgraph "Utilities"
        COORD[CoordinateSystem]
        EVT[EventEmitter]
        CMD[CommandManager]
    end
    
    WC --> TM
    WC --> SL
    WC --> ST
    WC --> COORD
    
    TM --> SEL
    TM --> RECT
    TM --> ELLI
    TM --> LINE
    TM --> ST
    TM --> EVT
    
    SL --> ST
    SL --> EVT
    
    SEL --> ST
    SEL --> CMD
    RECT --> ST
    RECT --> CMD
    ELLI --> ST
    ELLI --> CMD
    LINE --> ST
    LINE --> CMD
    
    CMD --> ST
```

## 📐 コンポーネント詳細設計

### WhiteboardCanvas

```
┌─────────────────────────────────────────────────────────┐
│                    WhiteboardCanvas                      │
├─────────────────────────────────────────────────────────┤
│ Properties:                                              │
│ - container: HTMLElement                                 │
│ - store: WhiteboardStore                                 │
│ - toolManager: ToolManager                               │
│ - selectionLayer: SelectionLayer                         │
│ - shapeLayer: HTMLElement                                │
├─────────────────────────────────────────────────────────┤
│ Methods:                                                 │
│ + initialize(): void                                     │
│ + setActiveTool(toolId: string): void                   │
│ + addShape(shape: Shape): void                          │
│ + removeShape(shapeId: string): void                    │
│ + render(): void                                         │
│ + destroy(): void                                        │
├─────────────────────────────────────────────────────────┤
│ Events:                                                  │
│ - canvas:ready                                           │
│ - canvas:destroyed                                       │
└─────────────────────────────────────────────────────────┘
```

### ToolManager

```
┌─────────────────────────────────────────────────────────┐
│                      ToolManager                         │
├─────────────────────────────────────────────────────────┤
│ Properties:                                              │
│ - tools: Map<string, Tool>                               │
│ - activeTool: Tool | null                                │
│ - context: ToolContext                                   │
│ - listeners: Map<string, EventListener>                 │
├─────────────────────────────────────────────────────────┤
│ Methods:                                                 │
│ + registerTool(tool: Tool): void                         │
│ + unregisterTool(toolId: string): void                  │
│ + setActiveTool(toolId: string): void                   │
│ + getActiveTool(): Tool | null                          │
│ + handlePointerEvent(event: PointerEvent): void         │
│ + handleKeyboardEvent(event: KeyboardEvent): void       │
├─────────────────────────────────────────────────────────┤
│ Events:                                                  │
│ - tool:activated                                         │
│ - tool:deactivated                                       │
└─────────────────────────────────────────────────────────┘
```

### SelectionLayer

```
┌─────────────────────────────────────────────────────────┐
│                    SelectionLayer                        │
├─────────────────────────────────────────────────────────┤
│ Properties:                                              │
│ - element: HTMLElement                                   │
│ - selectionBox: HTMLElement | null                       │
│ - resizeHandles: Map<string, HTMLElement>               │
│ - multiSelectBox: HTMLElement | null                     │
├─────────────────────────────────────────────────────────┤
│ Methods:                                                 │
│ + showSelection(shapeIds: string[]): void               │
│ + hideSelection(): void                                  │
│ + showResizeHandles(shape: Shape): void                 │
│ + hideResizeHandles(): void                             │
│ + updateSelection(): void                                │
│ + handleResize(handle: string, delta: Point): void      │
├─────────────────────────────────────────────────────────┤
│ Events:                                                  │
│ - selection:show                                         │
│ - selection:hide                                         │
│ - resize:start                                           │
│ - resize:end                                             │
└─────────────────────────────────────────────────────────┘
```

## 🔌 プラグインアーキテクチャ

### Tool Plugin System

```mermaid
graph TB
    subgraph "Tool Plugin System"
        TI[Tool Interface]
        BT[BaseTool]
        
        subgraph "Core Tools"
            ST[SelectTool]
            RT[RectangleTool]
            ET[EllipseTool]
            LT[LineTool]
        end
        
        subgraph "Custom Tools"
            CT1[CustomTool1]
            CT2[CustomTool2]
        end
    end
    
    TI --> BT
    BT --> ST
    BT --> RT
    BT --> ET
    BT --> LT
    TI --> CT1
    TI --> CT2
    
    TM[ToolManager] --> TI
```

### Tool Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Inactive
    Inactive --> Activating: setActiveTool()
    Activating --> Active: onActivate()
    Active --> Deactivating: Tool Change
    Deactivating --> Inactive: onDeactivate()
    
    Active --> Handling: Event Received
    Handling --> Active: Event Processed
    
    state Active {
        [*] --> Idle
        Idle --> Drawing: onPointerDown()
        Drawing --> Drawing: onPointerMove()
        Drawing --> Idle: onPointerUp()
        Drawing --> Idle: onKeyDown(Escape)
    }
```

## 🎨 レンダリングパイプライン

### Shape Rendering Flow

```mermaid
graph LR
    subgraph "Data Layer"
        S1[Shape Data]
        S2[Selection State]
        S3[Camera State]
    end
    
    subgraph "Transform Layer"
        T1[World to Screen]
        T2[Apply Camera]
        T3[Apply Selection]
    end
    
    subgraph "Render Layer"
        R1[Create DOM]
        R2[Apply Styles]
        R3[Update Attributes]
    end
    
    subgraph "DOM"
        D1[Shape Elements]
        D2[Selection Elements]
    end
    
    S1 --> T1
    S2 --> T3
    S3 --> T2
    
    T1 --> R1
    T2 --> R2
    T3 --> R3
    
    R1 --> D1
    R2 --> D1
    R3 --> D2
```

## 📊 状態管理フロー

### Store State Updates

```mermaid
graph TB
    subgraph "User Actions"
        A1[Create Shape]
        A2[Select Shape]
        A3[Move Shape]
        A4[Delete Shape]
    end
    
    subgraph "Store Actions"
        SA1[addShape]
        SA2[selectShape]
        SA3[updateShape]
        SA4[removeShape]
    end
    
    subgraph "State Updates"
        SU1[shapes[]]
        SU2[selectedShapeIds[]]
        SU3[tool{}]
        SU4[camera{}]
    end
    
    subgraph "Subscriptions"
        SUB1[Canvas Render]
        SUB2[Selection Update]
        SUB3[Tool Update]
    end
    
    A1 --> SA1
    A2 --> SA2
    A3 --> SA3
    A4 --> SA4
    
    SA1 --> SU1
    SA2 --> SU2
    SA3 --> SU1
    SA4 --> SU1
    SA4 --> SU2
    
    SU1 --> SUB1
    SU2 --> SUB2
    SU3 --> SUB3
```

## 🔒 セキュリティと検証

### Input Validation Flow

```mermaid
graph TD
    subgraph "Input Layer"
        I1[User Input]
        I2[API Input]
    end
    
    subgraph "Validation Layer"
        V1[Schema Validation]
        V2[Business Rules]
        V3[Sanitization]
    end
    
    subgraph "Processing Layer"
        P1[Tool Processing]
        P2[Store Update]
    end
    
    subgraph "Error Handling"
        E1[Validation Error]
        E2[Processing Error]
    end
    
    I1 --> V1
    I2 --> V1
    
    V1 --> V2
    V2 --> V3
    
    V3 --> P1
    P1 --> P2
    
    V1 -.-> E1
    V2 -.-> E1
    P1 -.-> E2
```

## 🚀 パフォーマンス最適化

### Rendering Optimization Strategy

```
┌─────────────────────────────────────────────────────────┐
│                 Performance Pipeline                     │
├─────────────────────────────────────────────────────────┤
│  1. Viewport Culling                                    │
│     - Only render visible shapes                        │
│     - Calculate bounding boxes                          │
│                                                         │
│  2. Batch Updates                                       │
│     - Group DOM operations                              │
│     - Use requestAnimationFrame                         │
│                                                         │
│  3. Layer Caching                                       │
│     - Cache static elements                             │
│     - Update only changed elements                      │
│                                                         │
│  4. Event Debouncing                                    │
│     - Throttle pointer events                           │
│     - Batch state updates                               │
└─────────────────────────────────────────────────────────┘
```

## 📱 レスポンシブデザイン

### Breakpoint Handling

```mermaid
graph LR
    subgraph "Screen Sizes"
        S1[Mobile<br/>< 768px]
        S2[Tablet<br/>768-1024px]
        S3[Desktop<br/>> 1024px]
    end
    
    subgraph "UI Adaptations"
        U1[Touch Controls]
        U2[Compact Toolbar]
        U3[Full Toolbar]
    end
    
    subgraph "Tool Behaviors"
        T1[Tap to Select]
        T2[Hybrid Controls]
        T3[Mouse Controls]
    end
    
    S1 --> U1
    S1 --> T1
    
    S2 --> U2
    S2 --> T2
    
    S3 --> U3
    S3 --> T3
```

---

これらの図表は、システムの構造と動作を視覚的に理解するのに役立ちます。各コンポーネントの責務と相互作用が明確になり、新しい機能の追加や既存機能の拡張時の影響範囲を把握しやすくなります。