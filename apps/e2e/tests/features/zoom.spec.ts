import { test, expect } from '../../fixtures/test-base';

test.describe('Zoom Functionality', () => {
  test.beforeEach(async ({ whiteboardPage, toolbarPage }) => {
    // Draw some shapes for zoom testing
    await toolbarPage.selectTool('rectangle');
    await whiteboardPage.drawShape('rectangle', 200, 200, 400, 400);
    await whiteboardPage.drawShape('rectangle', 500, 200, 700, 400);
  });

  test('should zoom in with keyboard shortcut', async ({ whiteboardPage, page }) => {
    // Get initial canvas transform
    const initialTransform = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform();
    });

    // Zoom in
    await whiteboardPage.zoomIn();
    
    // Wait for zoom animation
    await page.waitForTimeout(300);

    // Get new transform
    const newTransform = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform();
    });

    // Verify zoom increased (scale factor > 1)
    expect(newTransform?.a).toBeGreaterThan(initialTransform?.a || 1);
  });

  test('should zoom out with keyboard shortcut', async ({ whiteboardPage, page }) => {
    // First zoom in to have something to zoom out from
    await whiteboardPage.zoomIn();
    await whiteboardPage.zoomIn();
    await page.waitForTimeout(300);

    const initialTransform = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform();
    });

    // Zoom out
    await whiteboardPage.zoomOut();
    await page.waitForTimeout(300);

    const newTransform = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform();
    });

    // Verify zoom decreased
    expect(newTransform?.a).toBeLessThan(initialTransform?.a || 1);
  });

  test('should reset zoom with keyboard shortcut', async ({ whiteboardPage, page }) => {
    // Zoom in multiple times
    await whiteboardPage.zoomIn();
    await whiteboardPage.zoomIn();
    await whiteboardPage.zoomIn();
    await page.waitForTimeout(300);

    // Reset zoom
    await whiteboardPage.zoomReset();
    await page.waitForTimeout(300);

    // Verify zoom is back to 1
    const transform = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform();
    });

    expect(transform?.a).toBeCloseTo(1, 2);
    expect(transform?.d).toBeCloseTo(1, 2);
  });

  test('should zoom with mouse wheel', async ({ whiteboardPage, page }) => {
    const canvas = whiteboardPage.canvas;
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Get initial scale
    const initialScale = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform()?.a || 1;
    });

    // Simulate wheel event to zoom in
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.wheel(0, -100); // Negative deltaY for zoom in
    await page.waitForTimeout(300);

    // Get new scale
    const newScale = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform()?.a || 1;
    });

    expect(newScale).toBeGreaterThan(initialScale);
  });

  test('should maintain zoom center point', async ({ whiteboardPage, page }) => {
    const canvas = whiteboardPage.canvas;
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Click on a specific point to set zoom center
    const zoomCenterX = canvasBox.x + 300;
    const zoomCenterY = canvasBox.y + 300;
    
    // Draw a small shape at zoom center for reference
    await whiteboardPage.page.locator('[data-tool="ellipse"]').click();
    await whiteboardPage.drawShape('circle', 290, 290, 310, 310);

    // Get shape position before zoom
    const shapeBefore = await page.locator('[data-shape-type="ellipse"]').boundingBox();

    // Zoom in at that point
    await page.mouse.move(zoomCenterX, zoomCenterY);
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(300);

    // Get shape position after zoom
    const shapeAfter = await page.locator('[data-shape-type="ellipse"]').boundingBox();

    // The shape should still be visible and roughly in the same screen position
    expect(shapeAfter).toBeTruthy();
    
    // The distance from zoom center should be proportionally increased
    if (shapeBefore && shapeAfter) {
      const distanceBefore = Math.hypot(
        shapeBefore.x + shapeBefore.width / 2 - zoomCenterX,
        shapeBefore.y + shapeBefore.height / 2 - zoomCenterY
      );
      const distanceAfter = Math.hypot(
        shapeAfter.x + shapeAfter.width / 2 - zoomCenterX,
        shapeAfter.y + shapeAfter.height / 2 - zoomCenterY
      );
      
      // Distance should increase with zoom
      expect(distanceAfter).toBeGreaterThan(distanceBefore);
    }
  });

  test('should handle zoom limits', async ({ whiteboardPage, page }) => {
    // Zoom in to maximum
    for (let i = 0; i < 20; i++) {
      await whiteboardPage.zoomIn();
    }
    await page.waitForTimeout(300);

    const maxScale = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform()?.a || 1;
    });

    // Try to zoom in more
    await whiteboardPage.zoomIn();
    await page.waitForTimeout(300);

    const afterMaxScale = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform()?.a || 1;
    });

    // Scale should not increase beyond limit
    expect(afterMaxScale).toBe(maxScale);

    // Reset and test minimum zoom
    await whiteboardPage.zoomReset();
    await page.waitForTimeout(300);

    // Zoom out to minimum
    for (let i = 0; i < 20; i++) {
      await whiteboardPage.zoomOut();
    }
    await page.waitForTimeout(300);

    const minScale = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform()?.a || 1;
    });

    // Try to zoom out more
    await whiteboardPage.zoomOut();
    await page.waitForTimeout(300);

    const afterMinScale = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      return ctx?.getTransform()?.a || 1;
    });

    // Scale should not decrease beyond limit
    expect(afterMinScale).toBe(minScale);
  });

  test('should pan canvas while zoomed', async ({ whiteboardPage, page }) => {
    // Zoom in first
    await whiteboardPage.zoomIn();
    await whiteboardPage.zoomIn();
    await page.waitForTimeout(300);

    // Get initial transform
    const initialTransform = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      const transform = ctx?.getTransform();
      return { x: transform?.e, y: transform?.f };
    });

    // Pan the canvas
    await whiteboardPage.pan(100, 50);
    await page.waitForTimeout(300);

    // Get new transform
    const newTransform = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      const transform = ctx?.getTransform();
      return { x: transform?.e, y: transform?.f };
    });

    // Verify canvas panned
    expect(newTransform.x).not.toBe(initialTransform.x);
    expect(newTransform.y).not.toBe(initialTransform.y);
  });
});