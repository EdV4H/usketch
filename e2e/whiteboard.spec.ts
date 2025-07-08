import { test, expect, Page } from '@playwright/test';

// Helper functions
async function drawRectangle(page: Page, start: { x: number, y: number }, end: { x: number, y: number }) {
  const canvas = page.locator('#canvas');
  await canvas.hover({ position: start });
  await page.mouse.down();
  await canvas.hover({ position: end });
  await page.mouse.up();
}

async function drawEllipse(page: Page, start: { x: number, y: number }, end: { x: number, y: number }) {
  const canvas = page.locator('#canvas');
  await canvas.hover({ position: start });
  await page.mouse.down();
  await canvas.hover({ position: end });
  await page.mouse.up();
}

test.describe('Whiteboard Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the whiteboard to initialize
    await page.waitForSelector('#canvas', { state: 'visible' });
  });

  test('should load whiteboard with initial shapes', async ({ page }) => {
    // Check if canvas is visible
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();

    // Check for grid background
    const gridBackground = page.locator('.grid-background');
    await expect(gridBackground).toBeVisible();

    // Wait for initial test shapes (added in main.ts)
    await page.waitForTimeout(300); // Wait for setTimeout in main.ts
    
    // Check if shapes are rendered
    const shapes = page.locator('[data-shape="true"]');
    await expect(shapes).toHaveCount(2); // Two test shapes
  });

  test('should select shape on click', async ({ page }) => {
    // Wait for initial shapes
    await page.waitForTimeout(300);
    
    // Click on a shape
    const firstShape = page.locator('[data-shape="true"]').first();
    await firstShape.click();
    
    // Check if selection is visible
    const selection = page.locator('.selection-box');
    await expect(selection).toBeVisible();
    
    // Check for resize handles
    const resizeHandles = page.locator('.resize-handle');
    await expect(resizeHandles).toHaveCount(8); // 8 resize handles
  });

  test('should move shape with drag', async ({ page }) => {
    // Wait for initial shapes
    await page.waitForTimeout(300);
    
    // Get initial position
    const shape = page.locator('[data-shape="true"]').first();
    const initialBox = await shape.boundingBox();
    expect(initialBox).toBeTruthy();
    
    // Select and drag the shape
    await shape.click();
    await shape.dragTo(shape, {
      sourcePosition: { x: 10, y: 10 },
      targetPosition: { x: 60, y: 60 }
    });
    
    // Check new position
    const newBox = await shape.boundingBox();
    expect(newBox).toBeTruthy();
    expect(newBox!.x).not.toBe(initialBox!.x);
    expect(newBox!.y).not.toBe(initialBox!.y);
  });

  test('should resize shape using handles', async ({ page }) => {
    // Wait for initial shapes
    await page.waitForTimeout(300);
    
    // Select a shape
    const shape = page.locator('[data-shape="true"]').first();
    await shape.click();
    
    // Get initial size
    const initialBox = await shape.boundingBox();
    expect(initialBox).toBeTruthy();
    
    // Drag resize handle
    const resizeHandle = page.locator('.resize-handle').last(); // Bottom-right handle
    await resizeHandle.dragTo(resizeHandle, {
      targetPosition: { x: 50, y: 50 }
    });
    
    // Check new size
    const newBox = await shape.boundingBox();
    expect(newBox).toBeTruthy();
    expect(newBox!.width).not.toBe(initialBox!.width);
    expect(newBox!.height).not.toBe(initialBox!.height);
  });

  test('should deselect shape when clicking on canvas', async ({ page }) => {
    // Wait for initial shapes
    await page.waitForTimeout(300);
    
    // Select a shape
    const shape = page.locator('[data-shape="true"]').first();
    await shape.click();
    
    // Verify selection
    const selection = page.locator('.selection-box');
    await expect(selection).toBeVisible();
    
    // Click on empty area
    const canvas = page.locator('#canvas');
    await canvas.click({ position: { x: 10, y: 10 } });
    
    // Verify deselection
    await expect(selection).not.toBeVisible();
  });
});

test.describe('Drawing Tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas', { state: 'visible' });
  });

  test('should draw rectangle with mouse', async ({ page }) => {
    // Select rectangle tool
    await page.click('#rectangle-tool');
    
    // Draw rectangle
    await drawRectangle(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    
    // Wait for shape to be created
    await page.waitForTimeout(100);
    
    // Verify rectangle is created
    const shapes = page.locator('[data-shape="true"]');
    const shapeCount = await shapes.count();
    expect(shapeCount).toBeGreaterThan(2); // More than initial 2 shapes
  });

  test('should draw ellipse with mouse', async ({ page }) => {
    // TODO: Implement when toolbar is added
    // Select ellipse tool
    // await page.click('[data-tool="ellipse"]');
    
    // Draw ellipse
    await drawEllipse(page, { x: 250, y: 100 }, { x: 350, y: 200 });
    
    // Verify ellipse is created
    const shapes = page.locator('[data-shape="true"]');
    const shapeCount = await shapes.count();
    expect(shapeCount).toBeGreaterThan(2); // More than initial 2 shapes
  });
});

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas', { state: 'visible' });
    await page.waitForTimeout(300); // Wait for initial shapes
  });

  test('should delete selected shape with Delete key', async ({ page }) => {
    // Select a shape
    const shape = page.locator('[data-shape="true"]').first();
    await shape.click();
    
    // Get initial count
    const initialCount = await page.locator('[data-shape="true"]').count();
    
    // Press Delete
    await page.keyboard.press('Delete');
    
    // Verify shape is deleted
    const newCount = await page.locator('[data-shape="true"]').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should select all shapes with Ctrl+A', async ({ page }) => {
    // Press Ctrl+A
    await page.keyboard.press('Control+A');
    
    // Check if all shapes are selected
    const selectedShapes = page.locator('[data-selected="true"]');
    const allShapes = page.locator('[data-shape="true"]');
    
    const selectedCount = await selectedShapes.count();
    const totalCount = await allShapes.count();
    
    expect(selectedCount).toBe(totalCount);
  });
});

test.describe('Performance', () => {
  test('should handle multiple shapes efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas', { state: 'visible' });
    
    // Select rectangle tool
    await page.click('#rectangle-tool');
    
    const startTime = Date.now();
    
    // Create multiple rectangles
    for (let i = 0; i < 10; i++) {
      const x = 50 + (i % 5) * 100;
      const y = 50 + Math.floor(i / 5) * 100;
      await drawRectangle(page, { x, y }, { x: x + 80, y: y + 80 });
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should complete in reasonable time
    expect(totalTime).toBeLessThan(10000); // 10 seconds
    
    // Verify all shapes are created
    const shapes = page.locator('[data-shape="true"]');
    const shapeCount = await shapes.count();
    expect(shapeCount).toBeGreaterThanOrEqual(12); // 2 initial + 10 new
  });
});

test.describe('Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas', { state: 'visible' });
    
    // Tab navigation
    await page.keyboard.press('Tab');
    
    // Check if focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // TODO: Add more accessibility tests when toolbar is implemented
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    
    // Check canvas has proper role
    const canvas = page.locator('#canvas');
    await expect(canvas).toHaveAttribute('role', 'application');
    
    // TODO: Add more ARIA checks
  });
});