import { expect, test } from "@playwright/test";

test.describe("Pan Tool", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
	});

	test("should have pan tool button in toolbar", async ({ page }) => {
		// Verify pan tool button exists
		const panButton = page.locator('button:has-text("パン")');
		await expect(panButton).toBeVisible();
	});

	test("should switch to pan tool when clicked", async ({ page }) => {
		// Click pan tool button
		await page.click('button:has-text("パン")');

		// Verify pan tool is selected (active class)
		const panButton = page.locator('button:has-text("パン")');
		await expect(panButton).toHaveClass(/active/);
	});

	test("should pan the canvas by dragging", async ({ page }) => {
		// Switch to pan tool
		await page.click('button:has-text("パン")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Get initial camera position (via store)
		const initialCameraX = await page.evaluate(() => {
			const store = (window as any).whiteboardStore?.getState();
			return store?.camera?.x || 0;
		});

		// Pan by dragging
		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 100, box.y + 100, { steps: 10 });
		await page.mouse.up();

		// Wait for camera update
		await page.waitForTimeout(100);

		// Get new camera position
		const newCameraX = await page.evaluate(() => {
			const store = (window as any).whiteboardStore?.getState();
			return store?.camera?.x || 0;
		});

		// Camera should have moved in opposite direction of drag
		// Dragged left (-100px), so camera should move right (+100px)
		expect(newCameraX).toBeGreaterThan(initialCameraX);
	});

	test("should maintain pan state during drag", async ({ page }) => {
		// Switch to pan tool
		await page.click('button:has-text("パン")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Start dragging
		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.down();

		// Move in multiple steps
		await page.mouse.move(box.x + 180, box.y + 180, { steps: 3 });
		await page.waitForTimeout(50);
		await page.mouse.move(box.x + 160, box.y + 160, { steps: 3 });
		await page.waitForTimeout(50);
		await page.mouse.move(box.x + 140, box.y + 140, { steps: 3 });

		await page.mouse.up();

		// Verify pan tool is still active
		const panButton = page.locator('button:has-text("パン")');
		await expect(panButton).toHaveClass(/active/);
	});

	test("should pan in all directions", async ({ page }) => {
		// Switch to pan tool
		await page.click('button:has-text("パン")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Get initial camera position
		const getCamera = () =>
			page.evaluate(() => {
				const store = (window as any).whiteboardStore?.getState();
				const camera = store?.camera || { x: 0, y: 0 };
				return { x: camera.x, y: camera.y };
			});

		const initialCamera = await getCamera();

		// Pan right (drag left)
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2, {
			steps: 5,
		});
		await page.mouse.up();
		await page.waitForTimeout(100);

		const afterRightPan = await getCamera();
		expect(afterRightPan.x).toBeGreaterThan(initialCamera.x);

		// Pan down (drag up)
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 100, {
			steps: 5,
		});
		await page.mouse.up();
		await page.waitForTimeout(100);

		const afterDownPan = await getCamera();
		expect(afterDownPan.y).toBeGreaterThan(initialCamera.y);
	});

	test("should not create shapes when panning", async ({ page }) => {
		// Verify no shapes exist initially
		const initialShapes = await page.locator('[data-shape="true"]').count();
		expect(initialShapes).toBe(0);

		// Switch to pan tool
		await page.click('button:has-text("パン")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Pan
		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 100, box.y + 100, { steps: 10 });
		await page.mouse.up();

		// Verify no shapes were created
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(0);
	});

	test("should allow switching from pan to other tools", async ({ page }) => {
		// Start with pan tool
		await page.click('button:has-text("パン")');

		// Switch to rectangle tool
		await page.click('button:has-text("四角形")');

		// Verify rectangle tool is active
		const rectButton = page.locator('button:has-text("四角形")');
		await expect(rectButton).toHaveClass(/active/);

		// Switch to select tool
		await page.click('button:has-text("選択")');

		// Verify select tool is active
		const selectButton = page.locator('button:has-text("選択")');
		await expect(selectButton).toHaveClass(/active/);
	});
});
