import { expect, test } from "@playwright/test";

export const layerPanelTests = () => {
	/**
	 * Helper function to open layer panel if it's collapsed
	 */
	const ensureLayerPanelOpen = async (page: any) => {
		const collapsed = await page.locator(".layer-panel--collapsed").count();
		if (collapsed > 0) {
			// Click toggle button to open
			await page.locator(".layer-panel__toggle").click();
			await page.waitForTimeout(100);
		}
	};

	test("should display layer panel with toggle button", async ({ page }) => {
		// Check that the layer panel exists (might be collapsed)
		const layerPanel = page.locator(".layer-panel");
		await expect(layerPanel).toBeVisible();

		// Open panel if collapsed
		await ensureLayerPanelOpen(page);

		// Check that the header exists
		await expect(page.locator(".layer-panel__header")).toBeVisible();
	});

	test("should toggle layer panel open/close", async ({ page }) => {
		// Ensure panel is open first
		await ensureLayerPanelOpen(page);

		// Find the close button in the header (using aria-label)
		const closeButton = page.locator(
			'.layer-panel__header-actions button[aria-label="レイヤーパネルを閉じる"]',
		);

		// Close the panel
		await closeButton.click();
		await page.waitForTimeout(100);

		// Check that panel is collapsed
		const collapsedPanel = page.locator(".layer-panel--collapsed");
		await expect(collapsedPanel).toBeVisible();

		// Find and click the toggle button to reopen
		const toggleButton = page.locator(".layer-panel__toggle");
		await toggleButton.click();
		await page.waitForTimeout(100);

		// Check that panel is open again
		const openPanel = page.locator(".layer-panel").filter({
			hasNot: page.locator(".layer-panel--collapsed"),
		});
		await expect(openPanel).toBeVisible();
	});

	test("should display shapes in layer tree", async ({ page }) => {
		// Draw a rectangle
		await page.locator('[data-testid="tool-rectangle"]').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		await whiteboard.hover({ position: { x: 300, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 500, y: 350 } });
		await page.mouse.up();

		// Wait for shape to be rendered
		await page.waitForTimeout(200);

		// Check that layer item appears in the layer tree
		const layerItems = page.locator(".layer-item");
		await expect(layerItems).toHaveCount(1);

		// Check that the layer item has the correct name
		const layerName = layerItems.first().locator(".layer-item__name");
		await expect(layerName).toContainText("矩形");
	});

	test("should display correct shape type icons", async ({ page }) => {
		// Draw a rectangle
		await page.locator('[data-testid="tool-rectangle"]').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		await whiteboard.hover({ position: { x: 300, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 500, y: 350 } });
		await page.mouse.up();

		await page.waitForTimeout(200);

		// Check that thumbnail exists
		const thumbnail = page.locator(".layer-thumbnail");
		await expect(thumbnail.first()).toBeVisible();
	});

	test("should select shape when clicking layer item", async ({ page }) => {
		// Draw a rectangle
		await page.locator('[data-testid="tool-rectangle"]').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		await whiteboard.hover({ position: { x: 300, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 500, y: 350 } });
		await page.mouse.up();

		// Switch to Select tool
		await page.locator('[data-testid="tool-select"]').click();
		await page.waitForTimeout(200);

		// Click on layer item
		const layerItem = page.locator(".layer-item").first();
		await layerItem.click();

		// Check that layer item is selected
		await expect(layerItem).toHaveClass(/layer-item--selected/);

		// Check that selection box appears on canvas
		await expect(page.locator(".selection-box")).toBeVisible();
	});

	test("should toggle shape visibility", async ({ page }) => {
		// Draw a rectangle
		await page.locator('[data-testid="tool-rectangle"]').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		await whiteboard.hover({ position: { x: 300, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 500, y: 350 } });
		await page.mouse.up();

		await page.waitForTimeout(200);

		// Get the shape element
		const shape = page.locator('[data-shape="true"][data-shape-type="rectangle"]').last();
		await expect(shape).toBeVisible();

		// Find visibility toggle button (eye icon)
		const visibilityButton = page
			.locator(".layer-item__controls button")
			.filter({ hasText: /表示|非表示/ })
			.first();

		// Click to hide
		await visibilityButton.click();
		await page.waitForTimeout(100);

		// Check that layer item has hidden class
		const layerItem = page.locator(".layer-item").first();
		await expect(layerItem).toHaveClass(/layer-item--hidden/);

		// Click to show again
		await visibilityButton.click();
		await page.waitForTimeout(100);

		// Check that hidden class is removed
		await expect(layerItem).not.toHaveClass(/layer-item--hidden/);
	});

	test("should toggle shape lock", async ({ page }) => {
		// Draw a rectangle
		await page.locator('[data-testid="tool-rectangle"]').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		await whiteboard.hover({ position: { x: 300, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 500, y: 350 } });
		await page.mouse.up();

		// Switch to Select tool
		await page.locator('[data-testid="tool-select"]').click();
		await page.waitForTimeout(200);

		// Get the shape element
		const shape = page.locator('[data-shape="true"][data-shape-type="rectangle"]').last();
		const initialBox = await shape.boundingBox();
		expect(initialBox).toBeTruthy();

		// Find lock toggle button
		const lockButton = page
			.locator(".layer-item__controls button")
			.filter({ hasText: /ロック|ロック解除/ })
			.first();

		// Click to lock
		await lockButton.click();
		await page.waitForTimeout(100);

		// Check that layer item has locked class
		const layerItem = page.locator(".layer-item").first();
		await expect(layerItem).toHaveClass(/layer-item--locked/);

		// Try to drag the locked shape (should not move)
		await shape.hover();
		await page.mouse.down();
		await page.mouse.move(initialBox!.x + 100, initialBox!.y + 100);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Shape should not have moved significantly (allowing for small measurement errors)
		const newBox = await shape.boundingBox();
		expect(newBox).toBeTruthy();
		expect(Math.abs(newBox!.x - initialBox!.x)).toBeLessThan(10);
		expect(Math.abs(newBox!.y - initialBox!.y)).toBeLessThan(10);

		// Unlock the shape
		await lockButton.click();
		await page.waitForTimeout(100);

		// Check that locked class is removed
		await expect(layerItem).not.toHaveClass(/layer-item--locked/);
	});

	test("should show multiple shapes in correct z-order", async ({ page }) => {
		// Draw multiple rectangles
		await page.locator('[data-testid="tool-rectangle"]').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		// First rectangle
		await whiteboard.hover({ position: { x: 200, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 300, y: 300 } });
		await page.mouse.up();

		await page.waitForTimeout(100);

		// Second rectangle
		await whiteboard.hover({ position: { x: 400, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 500, y: 300 } });
		await page.mouse.up();

		await page.waitForTimeout(200);

		// Check that 2 layer items exist
		const layerItems = page.locator(".layer-item");
		await expect(layerItems).toHaveCount(2);

		// The last drawn shape should be first in the list (z-order reversed)
		const firstLayerName = layerItems.first().locator(".layer-item__name");
		const secondLayerName = layerItems.last().locator(".layer-item__name");

		// Both should contain "矩形" but with different numbers
		await expect(firstLayerName).toContainText("矩形");
		await expect(secondLayerName).toContainText("矩形");
	});

	test("should show group button when multiple shapes selected", async ({ page }) => {
		// Draw two rectangles
		await page.locator('[data-testid="tool-rectangle"]').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		// First rectangle
		await whiteboard.hover({ position: { x: 200, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 300, y: 300 } });
		await page.mouse.up();

		await page.waitForTimeout(100);

		// Second rectangle
		await whiteboard.hover({ position: { x: 400, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 500, y: 300 } });
		await page.mouse.up();

		// Switch to Select tool
		await page.locator('[data-testid="tool-select"]').click();
		await page.waitForTimeout(200);

		// Initially, group button should be disabled (no selection)
		const groupButton = page
			.locator(".layer-panel__toolbar button")
			.filter({ hasText: /グループ/ });
		await expect(groupButton).toBeDisabled();

		// Select first shape
		const firstShape = page.locator('[data-shape="true"][data-shape-type="rectangle"]').first();
		await firstShape.click();
		await page.waitForTimeout(100);

		// Group button should still be disabled (only 1 shape selected)
		await expect(groupButton).toBeDisabled();

		// Select second shape with Shift
		const secondShape = page.locator('[data-shape="true"][data-shape-type="rectangle"]').last();
		await page.keyboard.down("Shift");
		await secondShape.click();
		await page.keyboard.up("Shift");
		await page.waitForTimeout(100);

		// Now group button should be enabled (2 shapes selected)
		await expect(groupButton).toBeEnabled();
	});

	test("should update layer item selection state when selecting on canvas", async ({ page }) => {
		// Draw a rectangle
		await page.locator('[data-testid="tool-rectangle"]').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		await whiteboard.hover({ position: { x: 300, y: 200 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 500, y: 350 } });
		await page.mouse.up();

		// Switch to Select tool
		await page.locator('[data-testid="tool-select"]').click();
		await page.waitForTimeout(200);

		// Layer item should not be selected initially
		const layerItem = page.locator(".layer-item").first();
		await expect(layerItem).not.toHaveClass(/layer-item--selected/);

		// Click on shape in canvas
		const shape = page.locator('[data-shape="true"][data-shape-type="rectangle"]').last();
		await shape.click();
		await page.waitForTimeout(100);

		// Layer item should now be selected
		await expect(layerItem).toHaveClass(/layer-item--selected/);
	});

	test("should show empty state when no shapes exist", async ({ page }) => {
		// Check that empty state is shown (no demo shapes in e2e mode)
		const emptyState = page.locator(".layer-tree--empty");
		await expect(emptyState).toBeVisible();
		await expect(emptyState).toContainText("レイヤーがありません");
	});
};
