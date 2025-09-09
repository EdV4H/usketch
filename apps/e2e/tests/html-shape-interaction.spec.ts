import { expect, test } from "@playwright/test";

test.describe("HTML Shape Interaction", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the whiteboard app on port 5173
		await page.goto("http://localhost:5173/");

		// Wait for the canvas to be ready
		await page.waitForSelector(".whiteboard-canvas", { timeout: 5000 });

		// Wait for initial shapes to load
		await page.waitForTimeout(1000);
	});

	test("should be able to drag HTML shapes from non-interactive areas", async ({ page }) => {
		// Find the color picker shape
		const colorPicker = await page.locator('[data-shape-type="color-picker-unified"]').first();

		// Get initial position
		const initialBox = await colorPicker.boundingBox();
		expect(initialBox).toBeTruthy();

		console.log("Initial position:", initialBox);

		// Try to drag from the header/title area which has cursor: "move"
		// The header is the first div child with the title "Color Picker"
		const header = await colorPicker.locator("div").filter({ hasText: "Color Picker" }).first();
		const headerBox = await header.boundingBox();
		console.log("Header position:", headerBox);

		if (headerBox) {
			// Click in the center of the header and drag
			await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
			await page.mouse.down();
			await page.mouse.move(headerBox.x + 100, headerBox.y + 100);
			await page.mouse.up();
		} else {
			// Fallback: try dragging from the top part of the shape
			await page.mouse.move(initialBox!.x + initialBox!.width / 2, initialBox!.y + 10);
			await page.mouse.down();
			await page.mouse.move(initialBox!.x + 100, initialBox!.y + 100);
			await page.mouse.up();
		}

		// Wait for movement to complete
		await page.waitForTimeout(500);

		// Check new position
		const newBox = await colorPicker.boundingBox();
		console.log("New position:", newBox);

		// Shape should have moved
		expect(newBox!.x).not.toBe(initialBox!.x);
		expect(newBox!.y).not.toBe(initialBox!.y);
	});

	test("should not drag when clicking on buttons", async ({ page }) => {
		// Find the color picker shape
		const colorPicker = await page.locator('[data-shape-type="color-picker-unified"]').first();

		// Get initial position
		const initialBox = await colorPicker.boundingBox();
		expect(initialBox).toBeTruthy();

		// Try to drag from a color button
		const colorButton = await colorPicker.locator("button").first();
		await colorButton.hover();
		await page.mouse.down();
		await page.mouse.move(initialBox!.x + 100, initialBox!.y + 100);
		await page.mouse.up();

		// Wait for potential movement
		await page.waitForTimeout(500);

		// Check position - should not have moved
		const newBox = await colorPicker.boundingBox();
		expect(newBox!.x).toBe(initialBox!.x);
		expect(newBox!.y).toBe(initialBox!.y);
	});

	test("should be able to click buttons without selecting the shape", async ({ page }) => {
		// Find the HTML counter shape
		const counter = await page.locator('[data-shape-type="html-counter-unified"]').first();

		// Get the counter display value
		const getCounterValue = async () => {
			const display = await counter.locator("div").filter({ hasText: /^\d+$/ }).first();
			return await display.textContent();
		};

		const initialValue = await getCounterValue();
		console.log("Initial counter value:", initialValue);

		// Click the increment button
		const incrementButton = await counter.locator("button").filter({ hasText: "+" }).first();
		await incrementButton.click();

		// Wait for update
		await page.waitForTimeout(200);

		// Check that counter incremented
		const newValue = await getCounterValue();
		console.log("New counter value:", newValue);

		expect(parseInt(newValue!)).toBe(parseInt(initialValue!) + 1);
	});

	test("should be able to drag counter from non-button areas", async ({ page }) => {
		// Find the HTML counter shape
		const counter = await page.locator('[data-shape-type="html-counter-unified"]').first();

		// Get initial position
		const initialBox = await counter.boundingBox();
		expect(initialBox).toBeTruthy();

		console.log("Initial counter position:", initialBox);

		// Try to drag from the center display area (not buttons)
		const displayArea = await counter.locator("div").filter({ hasText: "Counter" }).first();
		const displayBox = await displayArea.boundingBox();

		if (displayBox) {
			// Click and drag from the display area center
			await page.mouse.move(
				displayBox.x + displayBox.width / 2,
				displayBox.y + displayBox.height / 2,
			);
			await page.mouse.down();
			await page.mouse.move(displayBox.x + 150, displayBox.y + 150);
			await page.mouse.up();

			// Wait for movement to complete
			await page.waitForTimeout(500);

			// Check new position
			const newBox = await counter.boundingBox();
			console.log("New counter position:", newBox);

			// Shape should have moved
			expect(newBox!.x).not.toBe(initialBox!.x);
			expect(newBox!.y).not.toBe(initialBox!.y);
		}
	});

	test("debugging: log all event listeners", async ({ page }) => {
		// Enable console logging
		page.on("console", (msg) => console.log("Browser console:", msg.text()));

		// Find shapes and log their event listeners
		await page.evaluate(() => {
			const shapes = document.querySelectorAll("[data-shape-type]");
			shapes.forEach((shape: any) => {
				console.log("Shape type:", shape.dataset.shapeType);
				console.log("Shape element:", shape);

				// Try to get event listeners (this is limited in browsers)
				const events = [
					"click",
					"pointerdown",
					"pointermove",
					"pointerup",
					"mousedown",
					"mousemove",
					"mouseup",
				];
				events.forEach((eventType) => {
					// Check if element has inline handlers
					const handler = (shape as any)[`on${eventType}`];
					if (handler) {
						console.log(`  Has ${eventType} handler:`, handler.toString().substring(0, 100));
					}
				});

				// Check computed styles
				const styles = window.getComputedStyle(shape);
				console.log("  Pointer events:", styles.pointerEvents);
				console.log("  Position:", styles.position);
				console.log("  Z-index:", styles.zIndex);
			});
		});
	});

	test("debug ColorPicker drag issue", async ({ page }) => {
		// Enable console logging
		page.on("console", (msg) => console.log("Browser console:", msg.text()));

		// Find the color picker shape
		const colorPicker = await page.locator('[data-shape-type="color-picker-unified"]').first();

		// Inspect the ColorPicker structure
		await page.evaluate(() => {
			const cp = document.querySelector('[data-shape-type="color-picker-unified"]');
			console.log("ColorPicker element:", cp);
			console.log("ColorPicker parent:", cp?.parentElement);
			console.log("ColorPicker tagName:", cp?.tagName);

			// Check if it's in a foreignObject
			const fo = cp?.closest("foreignObject");
			console.log("Is in foreignObject:", !!fo);
			if (fo) {
				console.log("ForeignObject props:", {
					x: fo.getAttribute("x"),
					y: fo.getAttribute("y"),
					width: fo.getAttribute("width"),
					height: fo.getAttribute("height"),
					pointerEvents: window.getComputedStyle(fo).pointerEvents,
				});
			}

			// Find the header div
			const header = cp?.querySelector('div[title="Drag here to move"]');
			console.log("Header element found:", !!header);
			if (header) {
				const styles = window.getComputedStyle(header);
				console.log("Header styles:", {
					cursor: styles.cursor,
					pointerEvents: styles.pointerEvents,
					userSelect: styles.userSelect,
				});
			}
		});

		// Try to simulate a drag manually
		const initialBox = await colorPicker.boundingBox();
		console.log("Initial ColorPicker position:", initialBox);

		// Find and drag the header
		await page.evaluate(() => {
			const cp = document.querySelector('[data-shape-type="color-picker-unified"]');
			const header = cp?.querySelector('div[title="Drag here to move"]') as HTMLElement;

			if (header) {
				console.log("Simulating pointer events on header");

				// Create and dispatch pointerdown event
				const downEvent = new PointerEvent("pointerdown", {
					bubbles: true,
					cancelable: true,
					clientX: header.getBoundingClientRect().left + 10,
					clientY: header.getBoundingClientRect().top + 10,
					pointerId: 1,
				});
				header.dispatchEvent(downEvent);
				console.log("Dispatched pointerdown");

				// Create and dispatch pointermove event
				setTimeout(() => {
					const moveEvent = new PointerEvent("pointermove", {
						bubbles: true,
						cancelable: true,
						clientX: header.getBoundingClientRect().left + 110,
						clientY: header.getBoundingClientRect().top + 110,
						pointerId: 1,
					});
					document.dispatchEvent(moveEvent);
					console.log("Dispatched pointermove");

					// Create and dispatch pointerup event
					setTimeout(() => {
						const upEvent = new PointerEvent("pointerup", {
							bubbles: true,
							cancelable: true,
							clientX: header.getBoundingClientRect().left + 110,
							clientY: header.getBoundingClientRect().top + 110,
							pointerId: 1,
						});
						document.dispatchEvent(upEvent);
						console.log("Dispatched pointerup");
					}, 100);
				}, 100);
			}
		});

		// Wait for potential movement
		await page.waitForTimeout(1000);

		const finalBox = await colorPicker.boundingBox();
		console.log("Final ColorPicker position:", finalBox);

		// Log if it moved
		if (finalBox && initialBox) {
			console.log("ColorPicker moved:", {
				dx: finalBox.x - initialBox.x,
				dy: finalBox.y - initialBox.y,
			});
		}
	});

	test("check if foreignObject is blocking events", async ({ page }) => {
		await page.evaluate(() => {
			// Find all foreignObject elements
			const foreignObjects = document.querySelectorAll("foreignObject");
			console.log("Found foreignObjects:", foreignObjects.length);

			foreignObjects.forEach((fo: any, index) => {
				console.log(`ForeignObject ${index}:`);
				console.log("  Pointer events:", window.getComputedStyle(fo).pointerEvents);
				console.log("  Overflow:", window.getComputedStyle(fo).overflow);

				// Check children
				const children = fo.querySelectorAll("*");
				console.log("  Children count:", children.length);

				// Check first level div
				const firstDiv = fo.querySelector("div");
				if (firstDiv) {
					console.log(
						"  First div pointer events:",
						window.getComputedStyle(firstDiv).pointerEvents,
					);
					console.log("  First div position:", window.getComputedStyle(firstDiv).position);
				}
			});
		});
	});
});
