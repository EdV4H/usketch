import { test, expect } from '@playwright/test';

test.describe('Zoom functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to be initialized
    await page.waitForFunction(() => (window as any).store !== undefined);
  });

  test('should zoom in on mouse wheel up', async ({ page }) => {
    // Get initial zoom
    const initialZoom = await page.evaluate(() => {
      const store = (window as any).store;
      return store.getState().camera.zoom;
    });
    
    expect(initialZoom).toBe(1);
    
    // Directly call setCamera to test zoom functionality
    const newZoom = await page.evaluate(() => {
      const store = (window as any).store;
      const targetZoom = 1.5;
      store.getState().setCamera({
        x: store.getState().camera.x,
        y: store.getState().camera.y,
        zoom: targetZoom
      });
      return store.getState().camera.zoom;
    });
    
    expect(newZoom).toBe(1.5);
    
    // Now test actual wheel event
    await page.evaluate(() => {
      const store = (window as any).store;
      // Reset zoom
      store.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    });
    
    // Use CDP to send wheel event
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: 400,
      y: 300,
      deltaX: 0,
      deltaY: -100
    });
    
    await page.waitForTimeout(100);
    
    const finalZoom = await page.evaluate(() => {
      const store = (window as any).store;
      return store.getState().camera.zoom;
    });
    
    expect(finalZoom).toBeGreaterThan(1);
    expect(finalZoom).toBeLessThan(2);
  });

  test('should zoom out on mouse wheel down', async ({ page }) => {
    const canvas = page.locator('#canvas');
    
    // Get initial zoom from store
    const initialZoom = await page.evaluate(() => {
      const store = (window as any).store;
      return store.getState().camera.zoom;
    });
    
    // Perform zoom out (wheel down)
    await canvas.hover();
    await page.mouse.wheel(0, 100);
    
    // Wait for animation
    await page.waitForTimeout(100);
    
    // Get new zoom from store
    const newZoom = await page.evaluate(() => {
      const store = (window as any).store;
      return store.getState().camera.zoom;
    });
    
    expect(newZoom).toBeLessThan(initialZoom);
    // New zoom factor calculation: Math.pow(1.002, -100) ≈ 0.82
    expect(newZoom).toBeCloseTo(0.82, 1);
  });

  test('should zoom towards mouse cursor position', async ({ page }) => {
    const canvas = page.locator('#canvas');
    
    // Create a shape at a known position
    await page.evaluate(() => {
      const store = (window as any).store;
      store.getState().addShape({
        id: 'test-shape',
        type: 'rectangle',
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        fillColor: '#ff0000',
        strokeColor: '#000000',
        strokeWidth: 2
      });
    });
    
    // Get shape's initial screen position
    const shapeElement = page.locator('[data-shape-id="test-shape"]');
    const initialBounds = await shapeElement.boundingBox();
    
    // Move mouse to the right side of canvas and zoom in
    const canvasBounds = await canvas.boundingBox();
    if (!canvasBounds || !initialBounds) throw new Error('Could not get bounds');
    
    await page.mouse.move(canvasBounds.x + canvasBounds.width - 100, canvasBounds.y + 100);
    await page.mouse.wheel(0, -500); // Strong zoom in
    
    await page.waitForTimeout(100);
    
    // Shape should move towards the left (away from zoom point)
    const newBounds = await shapeElement.boundingBox();
    if (!newBounds) throw new Error('Could not get new bounds');
    
    expect(newBounds.x).toBeLessThan(initialBounds.x);
  });

  test('should respect zoom limits', async ({ page }) => {
    const canvas = page.locator('#canvas');
    
    // Try to zoom out beyond minimum
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(50);
    }
    
    // Check minimum zoom
    const minZoom = await page.evaluate(() => {
      const store = (window as any).store;
      return store.getState().camera.zoom;
    });
    
    expect(minZoom).toBeGreaterThanOrEqual(0.1);
    
    // Try to zoom in beyond maximum
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(50);
    }
    
    // Check maximum zoom
    const maxZoom = await page.evaluate(() => {
      const store = (window as any).store;
      return store.getState().camera.zoom;
    });
    
    expect(maxZoom).toBeLessThanOrEqual(5);
  });

  test('should maintain world position when zooming', async ({ page }) => {
    // Create a shape at a known world position
    await page.evaluate(() => {
      const store = (window as any).store;
      store.getState().addShape({
        id: 'test-shape',
        type: 'rectangle',
        x: 300,
        y: 300,
        width: 50,
        height: 50,
        rotation: 0,
        opacity: 1,
        fillColor: '#00ff00',
        strokeColor: '#000000',
        strokeWidth: 2
      });
    });
    
    const canvas = page.locator('#canvas');
    const canvasBounds = await canvas.boundingBox();
    if (!canvasBounds) throw new Error('Could not get canvas bounds');
    
    // Move mouse to center and zoom
    const centerX = canvasBounds.x + canvasBounds.width / 2;
    const centerY = canvasBounds.y + canvasBounds.height / 2;
    
    await page.mouse.move(centerX, centerY);
    
    // Get world position under mouse before zoom
    const worldPosBefore = await page.evaluate(({ x, y }) => {
      const store = (window as any).store;
      const rect = document.querySelector('#canvas')!.getBoundingClientRect();
      const screenPos = { x: x - rect.left, y: y - rect.top };
      
      // Manual calculation to match the app's logic
      const camera = store.getState().camera;
      return {
        x: (screenPos.x / camera.zoom) + camera.x,
        y: (screenPos.y / camera.zoom) + camera.y
      };
    }, { x: centerX, y: centerY });
    
    // Zoom in
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(100);
    
    // Get world position under mouse after zoom
    const worldPosAfter = await page.evaluate(({ x, y }) => {
      const store = (window as any).store;
      const rect = document.querySelector('#canvas')!.getBoundingClientRect();
      const screenPos = { x: x - rect.left, y: y - rect.top };
      
      // Manual calculation to match the app's logic
      const camera = store.getState().camera;
      return {
        x: (screenPos.x / camera.zoom) + camera.x,
        y: (screenPos.y / camera.zoom) + camera.y
      };
    }, { x: centerX, y: centerY });
    
    // World position under cursor should remain (approximately) the same
    expect(worldPosAfter.x).toBeCloseTo(worldPosBefore.x, 0);
    expect(worldPosAfter.y).toBeCloseTo(worldPosBefore.y, 0);
  });

  test('should handle rapid zoom changes smoothly', async ({ page }) => {
    const canvas = page.locator('#canvas');
    
    // Perform rapid zoom changes
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -50);
      await page.waitForTimeout(10);
      await page.mouse.wheel(0, 50);
      await page.waitForTimeout(10);
    }
    
    // Check that zoom level is reasonable
    const finalZoom = await page.evaluate(() => {
      const store = (window as any).store;
      return store.getState().camera.zoom;
    });
    
    expect(finalZoom).toBeGreaterThan(0.5);
    expect(finalZoom).toBeLessThan(2);
  });
});