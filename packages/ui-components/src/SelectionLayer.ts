import type { Shape } from '@whiteboard/shared-types';

export class SelectionLayer {
  private container: HTMLElement;
  private selectionBoxes: Map<string, HTMLElement> = new Map();
  
  constructor(container: HTMLElement) {
    this.container = container;
  }
  
  updateSelection(selectedShapes: Shape[]): void {
    // Clear existing selection boxes
    this.clear();
    
    // Create selection box for each selected shape
    selectedShapes.forEach(shape => {
      const selectionBox = this.createSelectionBox(shape);
      this.selectionBoxes.set(shape.id, selectionBox);
      this.container.appendChild(selectionBox);
    });
  }
  
  private createSelectionBox(shape: Shape): HTMLElement {
    const box = document.createElement('div');
    box.className = 'selection-box';
    box.style.position = 'absolute';
    box.style.pointerEvents = 'none';
    box.style.border = '2px solid #007bff';
    
    // Position based on shape type
    if ('width' in shape && 'height' in shape) {
      box.style.left = `${shape.x}px`;
      box.style.top = `${shape.y}px`;
      box.style.width = `${shape.width}px`;
      box.style.height = `${shape.height}px`;
    }
    
    // Apply rotation if present
    if (shape.rotation) {
      box.style.transform = `rotate(${shape.rotation}rad)`;
      box.style.transformOrigin = 'center';
    }
    
    // Add resize handles
    this.addResizeHandles(box);
    
    return box;
  }
  
  private addResizeHandles(selectionBox: HTMLElement): void {
    const handlePositions = [
      { position: 'nw', top: '-4px', left: '-4px', cursor: 'nw-resize' },
      { position: 'n', top: '-4px', left: '50%', marginLeft: '-4px', cursor: 'n-resize' },
      { position: 'ne', top: '-4px', right: '-4px', cursor: 'ne-resize' },
      { position: 'e', top: '50%', right: '-4px', marginTop: '-4px', cursor: 'e-resize' },
      { position: 'se', bottom: '-4px', right: '-4px', cursor: 'se-resize' },
      { position: 's', bottom: '-4px', left: '50%', marginLeft: '-4px', cursor: 's-resize' },
      { position: 'sw', bottom: '-4px', left: '-4px', cursor: 'sw-resize' },
      { position: 'w', top: '50%', left: '-4px', marginTop: '-4px', cursor: 'w-resize' }
    ];
    
    handlePositions.forEach(({ position, ...styles }) => {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.dataset['resizeHandle'] = position;
      handle.style.position = 'absolute';
      handle.style.width = '8px';
      handle.style.height = '8px';
      handle.style.backgroundColor = '#007bff';
      handle.style.border = '1px solid white';
      handle.style.pointerEvents = 'auto';
      
      // Apply position styles
      Object.assign(handle.style, styles);
      
      selectionBox.appendChild(handle);
    });
  }
  
  clear(): void {
    this.selectionBoxes.forEach(box => box.remove());
    this.selectionBoxes.clear();
  }
}