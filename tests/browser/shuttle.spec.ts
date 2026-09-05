import { expect, test } from "@playwright/test";
import type { WorldEngine } from "../../src/world/engine.ts";

declare global {
  interface Window {
    __flightTest: WorldEngine;
  }
}
test.use({
  channel: "chromium",
  launchOptions: {
    args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
  },
});
test("flies to a stop, lands, and supports a steerable Space bailout", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}\nwindow.__flightTest=engine;`,
    });
  });
  await page.goto("/");
  await page.locator("#demo").click();
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2030-01-01T01:00:00Z"));
  const destination = await page.evaluate(() => {
    const e = window.__flightTest;
    e["lastFrame"] = performance.now();
    const region = e.layout.regions.find(
      (r) => r.packageId === "packages/ui" && !r.parentId,
    )!;
    void e.flyTo(region.id, "packages/core");
    return e.survey.entry(region.id)!.position;
  });
  await page.clock.runFor(4200);
  expect(
    await page.evaluate(() => window.__flightTest.camera.position.y),
  ).toBeGreaterThan(30);
  await expect(page.locator(".flight-hint")).toHaveText("Space to jump out");
  await page.clock.runFor(4500);
  const landed = await page.evaluate(() => window.__flightTest.player.position);
  expect(landed.x).toBeCloseTo(destination.x);
  expect(landed.z).toBeCloseTo(destination.z);
  await expect(page.locator(".flight-hint")).toBeHidden();
  await page.evaluate(() => {
    const e = window.__flightTest;
    const region = e.layout.regions.find(
      (r) => r.packageId === "packages/core" && !r.parentId,
    )!;
    void e.flyTo(region.id, "packages/ui");
  });
  await page.clock.runFor(3000);
  await page.keyboard.press("Space");
  await expect(page.locator(".flight-hint")).toContainText(
    "Parachute deployed",
  );
  const airborne = await page.evaluate(
    () => window.__flightTest.player.position.y,
  );
  await page.clock.runFor(1200);
  const descending = await page.evaluate(
    () => window.__flightTest.player.position.y,
  );
  expect(descending).toBeLessThan(airborne);
  expect(descending).toBeGreaterThan(airborne - 6.1);
  const beforeTurn = await page.evaluate(() => ({
    camera: window.__flightTest.camera.rotation.y,
    body: window.__flightTest["flight"]["canopy"].rotation.y,
  }));
  await page.mouse.move(620, 480);
  await page.mouse.down();
  await page.mouse.move(900, 480, { steps: 6 });
  await page.mouse.up();
  await page.clock.runFor(700);
  const afterTurn = await page.evaluate(() => ({
    camera: window.__flightTest.camera.rotation.y,
    body: window.__flightTest["flight"]["canopy"].rotation.y,
  }));
  expect(Math.abs(afterTurn.camera - beforeTurn.camera)).toBeGreaterThan(0.3);
  expect(Math.abs(afterTurn.body - beforeTurn.body)).toBeGreaterThan(0.3);
  await page.clock.runFor(15000);
  await expect(page.locator(".flight-hint")).toBeHidden();
  expect(await page.evaluate(() => window.__flightTest.player.grounded)).toBe(
    true,
  );
  expect(
    await page.evaluate(() =>
      [...window.__flightTest.city.shuttles.values()].every(
        (ship) => ship.visible && ship.position.y === 0,
      ),
    ),
  ).toBe(true);
});
