import { expect, test } from "@playwright/test";

for (const fallback of [false, true]) {
  test(`dismisses inspection when resuming gameplay${fallback ? " with drag look" : ""}`, async ({
    page,
  }) => {
    if (fallback)
      await page.addInitScript(() => {
        HTMLElement.prototype.requestPointerLock = () => {
          throw new Error("Pointer lock unavailable in this test browser.");
        };
      });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.locator("#demo").click();
    await page.locator('[data-mode="walk"]').click();
    await page.evaluate(() => document.exitPointerLock());
    const inspect = async () => {
      await page
        .getByRole("button", { name: "Find a file", exact: true })
        .click();
      await page.locator("#search-input").fill("Graph.ts");
      await page.locator(".search-result").first().click();
      await expect(page.locator("#inspector h2")).toHaveText("Graph.ts");
    };
    await inspect();
    await page.keyboard.press("Escape");
    await expect(page.locator("#inspector")).toBeHidden();
    await expect(page.locator('[data-mode="walk"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await inspect();
    await page
      .locator("canvas.world-canvas")
      .click({ position: { x: 250, y: 450 } });
    await expect(page.locator("#inspector")).toBeHidden();
    await expect(page.locator('[data-mode="walk"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    if (!fallback)
      await expect
        .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
        .toBe("CANVAS");
    await page.evaluate(() => document.exitPointerLock());
    expect(errors).toEqual([]);
  });
}
