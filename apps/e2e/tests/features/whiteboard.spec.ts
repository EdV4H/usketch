import { test, expect } from '../../fixtures/test-base';

test.describe('Whiteboard Basic Functionality', () => {
  test.beforeEach(async ({ whiteboardPage }) => {
    // whiteboardPage fixture automatically navigates and waits for ready
  });

  test('should load whiteboard with canvas', async ({ whiteboardPage }) => {
    // Check if canvas is visible
    await expect(whiteboardPage.canvas).toBeVisible();
    
    // Check for grid background
    const gridBackground = whiteboardPage.page.locator('.grid-background');
    await expect(gridBackground).toBeVisible();
  });

  test('should draw a rectangle', async ({ whiteboardPage, toolbarPage }) => {
    // Select rectangle tool
    await toolbarPage.selectTool('rectangle');
    
    // Draw rectangle
    await whiteboardPage.drawShape('rectangle', 100, 100, 300, 200);
    
    // Verify shape was created
    const shapeCount = await whiteboardPage.getShapeCount('rectangle');
    expect(shapeCount).toBe(1);
  });

  test('should select shape on click', async ({ whiteboardPage, toolbarPage }) => {
    // Draw a rectangle first
    await toolbarPage.selectTool('rectangle');
    await whiteboardPage.drawShape('rectangle', 100, 100, 300, 200);
    
    // Switch to select tool
    await toolbarPage.selectTool('select');
    
    // Click on the shape
    await whiteboardPage.click(200, 150);
    
    // Verify shape is selected
    const selectedCount = await whiteboardPage.getSelectedShapeCount();
    expect(selectedCount).toBe(1);
  });

  test('should move selected shape', async ({ whiteboardPage, toolbarPage }) => {
    // Draw and select a shape
    await toolbarPage.selectTool('rectangle');
    await whiteboardPage.drawShape('rectangle', 100, 100, 300, 200);
    await toolbarPage.selectTool('select');
    await whiteboardPage.click(200, 150);
    
    // Get initial position
    const shape = whiteboardPage.page.locator('[data-shape-id]').first();
    const initialBox = await shape.boundingBox();
    
    // Move the shape
    await whiteboardPage.page.mouse.move(200, 150);
    await whiteboardPage.page.mouse.down();
    await whiteboardPage.page.mouse.move(300, 250);
    await whiteboardPage.page.mouse.up();
    
    // Verify shape moved
    const finalBox = await shape.boundingBox();
    expect(finalBox?.x).not.toBe(initialBox?.x);
    expect(finalBox?.y).not.toBe(initialBox?.y);
  });

  test('should delete selected shape', async ({ whiteboardPage, toolbarPage }) => {
    // Draw a shape
    await toolbarPage.selectTool('rectangle');
    await whiteboardPage.drawShape('rectangle', 100, 100, 300, 200);
    
    // Select it
    await toolbarPage.selectTool('select');
    await whiteboardPage.click(200, 150);
    
    // Delete it
    await whiteboardPage.deleteSelected();
    
    // Verify shape was deleted
    const shapeCount = await whiteboardPage.getShapeCount();
    expect(shapeCount).toBe(0);
  });

  test('should support undo/redo operations', async ({ whiteboardPage, toolbarPage }) => {
    // Draw two shapes
    await toolbarPage.selectTool('rectangle');
    await whiteboardPage.drawShape('rectangle', 100, 100, 200, 200);
    await whiteboardPage.drawShape('rectangle', 300, 100, 400, 200);
    
    // Verify 2 shapes
    expect(await whiteboardPage.getShapeCount()).toBe(2);
    
    // Undo once
    await whiteboardPage.undo();
    expect(await whiteboardPage.getShapeCount()).toBe(1);
    
    // Undo again
    await whiteboardPage.undo();
    expect(await whiteboardPage.getShapeCount()).toBe(0);
    
    // Redo
    await whiteboardPage.redo();
    expect(await whiteboardPage.getShapeCount()).toBe(1);
    
    // Redo again
    await whiteboardPage.redo();
    expect(await whiteboardPage.getShapeCount()).toBe(2);
  });

  test('should clear canvas', async ({ whiteboardPage, toolbarPage }) => {
    // Draw multiple shapes
    await toolbarPage.selectTool('rectangle');
    await whiteboardPage.drawShape('rectangle', 100, 100, 200, 200);
    await whiteboardPage.drawShape('rectangle', 300, 100, 400, 200);
    
    await toolbarPage.selectTool('ellipse');
    await whiteboardPage.drawShape('circle', 100, 300, 200, 400);
    
    // Verify shapes exist
    expect(await whiteboardPage.getShapeCount()).toBeGreaterThan(0);
    
    // Clear canvas
    await toolbarPage.clearCanvas();
    
    // Verify all shapes are gone
    expect(await whiteboardPage.getShapeCount()).toBe(0);
  });

  test('should select multiple shapes with area selection', async ({ whiteboardPage, toolbarPage }) => {
    // Draw three shapes
    await toolbarPage.selectTool('rectangle');
    await whiteboardPage.drawShape('rectangle', 100, 100, 200, 200);
    await whiteboardPage.drawShape('rectangle', 300, 100, 400, 200);
    await whiteboardPage.drawShape('rectangle', 500, 100, 600, 200);
    
    // Switch to select tool
    await toolbarPage.selectTool('select');
    
    // Area select first two shapes
    await whiteboardPage.selectMultipleShapes(50, 50, 450, 250);
    
    // Verify 2 shapes are selected
    const selectedCount = await whiteboardPage.getSelectedShapeCount();
    expect(selectedCount).toBe(2);
  });

  test('should copy and paste shapes', async ({ whiteboardPage, toolbarPage }) => {
    // Draw a shape
    await toolbarPage.selectTool('rectangle');
    await whiteboardPage.drawShape('rectangle', 100, 100, 200, 200);
    
    // Select it
    await toolbarPage.selectTool('select');
    await whiteboardPage.click(150, 150);
    
    // Copy and paste
    await whiteboardPage.copy();
    await whiteboardPage.paste();
    
    // Verify we now have 2 shapes
    expect(await whiteboardPage.getShapeCount()).toBe(2);
    
    // The pasted shape should be selected
    expect(await whiteboardPage.getSelectedShapeCount()).toBe(1);
  });
});