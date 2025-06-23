import { useWhiteboardStore } from './store';
import { Shape, Camera } from './types';
import { getCanvasMousePosition, screenToWorld, applyCameraTransform, applyShapeTransform } from './utils/coordinates';

export class WhiteboardCanvas {
  private canvasElement: HTMLElement;
  private shapesContainer: HTMLElement;
  private gridElement: HTMLElement;
  
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragStartCamera = { x: 0, y: 0, zoom: 1 };
  
  private isShapeDragging = false;
  private draggedShapeId: string | null = null;
  private shapeDragStart = { x: 0, y: 0 };
  private shapeDragStartPosition = { x: 0, y: 0 };

  constructor(canvasElement: HTMLElement) {
    this.canvasElement = canvasElement;
    
    // Create shapes container
    this.shapesContainer = document.createElement('div');
    this.shapesContainer.style.position = 'absolute';
    this.shapesContainer.style.top = '0';
    this.shapesContainer.style.left = '0';
    this.shapesContainer.style.width = '100%';
    this.shapesContainer.style.height = '100%';
    this.shapesContainer.style.transformOrigin = '0 0';
    
    // Get grid element
    this.gridElement = canvasElement.querySelector('.grid-background') as HTMLElement;
    
    // Add shapes container after grid
    canvasElement.appendChild(this.shapesContainer);
    
    this.setupEventListeners();
    this.subscribeToStore();
  }

  private setupEventListeners(): void {
    // Mouse events for pan and zoom
    this.canvasElement.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvasElement.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvasElement.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvasElement.addEventListener('wheel', this.handleWheel.bind(this));
    
    // Prevent context menu
    this.canvasElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleMouseDown(event: MouseEvent): void {
    const store = useWhiteboardStore.getState();
    
    // Check if clicking on a shape
    const target = event.target as HTMLElement;
    const shapeId = target.dataset.shapeId || target.closest('[data-shape-id]')?.getAttribute('data-shape-id');
    
    if (shapeId && store.selectedShapeIds.has(shapeId) && event.button === 0) {
      // Start dragging the selected shape
      this.isShapeDragging = true;
      this.draggedShapeId = shapeId;
      const mousePos = getCanvasMousePosition(event, this.canvasElement);
      const worldPos = screenToWorld(mousePos, store.camera);
      this.shapeDragStart = worldPos;
      
      const shape = store.shapes[shapeId];
      this.shapeDragStartPosition = { x: shape.x, y: shape.y };
      
      this.canvasElement.style.cursor = 'grabbing';
      event.preventDefault();
      event.stopPropagation();
    } else if (event.button === 1 || (event.button === 0 && event.altKey)) {
      // Middle mouse button or Alt+Left mouse for panning
      this.isDragging = true;
      const mousePos = getCanvasMousePosition(event, this.canvasElement);
      this.dragStart = mousePos;
      this.dragStartCamera = { ...store.camera };
      this.canvasElement.style.cursor = 'grabbing';
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isShapeDragging && this.draggedShapeId) {
      // Handle shape dragging
      const store = useWhiteboardStore.getState();
      const mousePos = getCanvasMousePosition(event, this.canvasElement);
      const worldPos = screenToWorld(mousePos, store.camera);
      
      const deltaX = worldPos.x - this.shapeDragStart.x;
      const deltaY = worldPos.y - this.shapeDragStart.y;
      
      store.updateShape(this.draggedShapeId, {
        x: this.shapeDragStartPosition.x + deltaX,
        y: this.shapeDragStartPosition.y + deltaY
      });
    } else if (this.isDragging) {
      // Handle canvas panning
      const mousePos = getCanvasMousePosition(event, this.canvasElement);
      const deltaX = (mousePos.x - this.dragStart.x) / this.dragStartCamera.zoom;
      const deltaY = (mousePos.y - this.dragStart.y) / this.dragStartCamera.zoom;
      
      useWhiteboardStore.getState().setCamera({
        x: this.dragStartCamera.x - deltaX,
        y: this.dragStartCamera.y - deltaY
      });
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (this.isShapeDragging) {
      this.isShapeDragging = false;
      this.draggedShapeId = null;
      this.canvasElement.style.cursor = 'default';
    } else if (this.isDragging) {
      this.isDragging = false;
      this.canvasElement.style.cursor = 'default';
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const store = useWhiteboardStore.getState();
    const mousePos = getCanvasMousePosition(event, this.canvasElement);
    const worldPos = screenToWorld(mousePos, store.camera);
    
    // Zoom factor
    const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, store.camera.zoom * zoomDelta));
    
    // Adjust camera position to zoom towards mouse cursor
    const newCameraX = worldPos.x - (mousePos.x / newZoom);
    const newCameraY = worldPos.y - (mousePos.y / newZoom);
    
    store.setCamera({
      x: newCameraX,
      y: newCameraY,
      zoom: newZoom
    });
  }

  private subscribeToStore(): void {
    // Subscribe to store changes
    useWhiteboardStore.subscribe((state) => {
      this.updateCamera(state.camera);
      this.updateShapes(state.shapes, state.selectedShapeIds);
    });
  }

  private updateCamera(camera: Camera): void {
    // Update shapes container transform
    applyCameraTransform(this.shapesContainer, camera);
    
    // Update grid background
    if (this.gridElement) {
      const gridSize = 20 * camera.zoom;
      const offsetX = (-camera.x * camera.zoom) % gridSize;
      const offsetY = (-camera.y * camera.zoom) % gridSize;
      
      this.gridElement.style.backgroundSize = `${gridSize}px ${gridSize}px`;
      this.gridElement.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    }
  }

  private updateShapes(shapes: Record<string, Shape>, selectedShapeIds: Set<string>): void {
    // Clear existing shapes
    this.shapesContainer.innerHTML = '';
    
    // Render each shape
    Object.values(shapes).forEach(shape => {
      const shapeElement = this.createShapeElement(shape);
      if (selectedShapeIds.has(shape.id)) {
        shapeElement.classList.add('selected');
      }
      this.shapesContainer.appendChild(shapeElement);
    });
  }

  private createShapeElement(shape: Shape): HTMLElement {
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.pointerEvents = 'auto';
    element.dataset.shapeId = shape.id;
    
    // Apply common styles
    element.style.opacity = shape.opacity.toString();
    
    // Apply shape transform
    applyShapeTransform(element, shape);
    
    // Create shape-specific content
    switch (shape.type) {
      case 'rectangle':
        this.createRectangleElement(element, shape);
        break;
      case 'ellipse':
        this.createEllipseElement(element, shape);
        break;
      // Add other shape types as needed
    }
    
    // Add click handler for selection
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      const store = useWhiteboardStore.getState();
      if (store.selectedShapeIds.has(shape.id)) {
        store.deselectShape(shape.id);
      } else {
        if (!e.shiftKey) {
          store.clearSelection();
        }
        store.selectShape(shape.id);
      }
    });
    
    return element;
  }

  private createRectangleElement(element: HTMLElement, shape: Shape & { width: number; height: number }): void {
    element.style.width = `${shape.width}px`;
    element.style.height = `${shape.height}px`;
    element.style.backgroundColor = shape.fillColor;
    element.style.border = `${shape.strokeWidth}px solid ${shape.strokeColor}`;
    element.style.boxSizing = 'border-box';
  }

  private createEllipseElement(element: HTMLElement, shape: Shape & { width: number; height: number }): void {
    element.style.width = `${shape.width}px`;
    element.style.height = `${shape.height}px`;
    element.style.backgroundColor = shape.fillColor;
    element.style.border = `${shape.strokeWidth}px solid ${shape.strokeColor}`;
    element.style.borderRadius = '50%';
    element.style.boxSizing = 'border-box';
  }

  // Method to add a test shape for demonstration
  public addTestShape(): void {
    const store = useWhiteboardStore.getState();
    const testShape: Shape = {
      id: 'test-rect-' + Date.now(),
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      rotation: 0,
      opacity: 1,
      strokeColor: '#333',
      fillColor: '#e0e0ff',
      strokeWidth: 2
    };
    
    store.addShape(testShape);
  }
}