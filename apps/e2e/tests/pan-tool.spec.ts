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

	test("should temporarily switch to pan with Space key", async ({ page }) => {
		// Start with select tool
		await page.click('button:has-text("選択")');

		// Verify select tool is active
		const selectButton = page.locator('button:has-text("選択")');
		await expect(selectButton).toHaveClass(/active/);

		// Press and hold Space key
		await page.keyboard.down("Space");

		// Wait for tool switch
		await page.waitForTimeout(100);

		// Verify pan tool is now active
		const panButton = page.locator('button:has-text("パン")');
		await expect(panButton).toHaveClass(/active/);

		// Release Space key
		await page.keyboard.up("Space");

		// Wait for tool switch back
		await page.waitForTimeout(100);

		// Verify select tool is active again
		await expect(selectButton).toHaveClass(/active/);
	});

	test("should pan while Space key is held", async ({ page }) => {
		// Start with rectangle tool
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Get initial camera position
		const initialCameraY = await page.evaluate(() => {
			const store = (window as any).whiteboardStore?.getState();
			return store?.camera?.y || 0;
		});

		// Hold Space and drag
		await page.keyboard.down("Space");
		await page.waitForTimeout(100);

		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 100, { steps: 10 });
		await page.mouse.up();

		await page.keyboard.up("Space");

		// Wait for updates
		await page.waitForTimeout(100);

		// Get new camera position
		const newCameraY = await page.evaluate(() => {
			const store = (window as any).whiteboardStore?.getState();
			return store?.camera?.y || 0;
		});

		// Camera should have moved
		// Dragged up (-100px), so camera should move down (+100px)
		expect(newCameraY).toBeGreaterThan(initialCameraY);

		// Verify we're back to rectangle tool
		const rectButton = page.locator('button:has-text("四角形")');
		await expect(rectButton).toHaveClass(/active/);
	});

	test("should not interfere with Space key in input fields", async ({ page }) => {
		// This test would need a text input field in the UI
		// Skip for now or implement when text editing is available
		test.skip();
	});

	test("should handle rapid Space key presses", async ({ page }) => {
		// Start with select tool
		await page.click('button:has-text("選択")');

		// Rapidly press and release Space multiple times
		for (let i = 0; i < 5; i++) {
			await page.keyboard.down("Space");
			await page.waitForTimeout(50);
			await page.keyboard.up("Space");
			await page.waitForTimeout(50);
		}

		// Should end up back at select tool
		const selectButton = page.locator('button:has-text("選択")');
		await expect(selectButton).toHaveClass(/active/);
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
