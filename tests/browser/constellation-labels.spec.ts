import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProjectGraph } from "../../src/graph/types.ts";

test("keeps long package names on one line and labels attached during inward travel", async ({
  page,
}) => {
  const graph: ProjectGraph = JSON.parse(
    readFileSync(resolve("public/demo.graph.json"), "utf8"),
  );
  const name = "@graphcraft/constellation-language";
  const renamed = graph.packages.find((pkg) => pkg.directory === "packages/ui");
  if (!renamed) throw new Error("The demo UI package is missing.");
  renamed.name = name;
  await page.route("**/demo.graph.json", (route) =>
    route.fulfill({ json: graph }),
  );
  await page.goto("/");
  await page.locator("#demo").click();
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole("button", { name: "Constellation", exact: true })
    .click();
  const folder = page.getByRole("button", {
    name: "Explore packages",
    exact: true,
  });
  await expect(folder).toBeVisible();
  await folder.evaluate((button) => {
    if (!(button instanceof HTMLButtonElement))
      throw new Error("The packages label must be a button.");
    button.click();
  });
  const labels = page.locator(".celestial-labels");
  await expect(labels).toHaveCSS("opacity", "0");
  await expect(labels).toHaveCSS("opacity", "1");
  const galaxy = page.getByRole("button", {
    name: `Explore ${name}`,
    exact: true,
  });
  await expect(galaxy).toBeVisible();
  const text = galaxy.locator("strong");
  const typography = await text.evaluate((element) => ({
    whiteSpace: getComputedStyle(element).whiteSpace,
    width: element.clientWidth,
    textWidth: element.scrollWidth,
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(typography.whiteSpace).toBe("nowrap");
  expect(typography.textWidth).toBeLessThanOrEqual(typography.width);
  expect(typography.height).toBeLessThanOrEqual(typography.lineHeight + 1);
  const frames = await galaxy.evaluate(async (button) => {
    if (!(button instanceof HTMLButtonElement))
      throw new Error("The package galaxy label must be a button.");
    // Start travel and sampling together so a moving label cannot escape the click.
    button.click();
    const samples: {
      id: string;
      x: number;
      y: number;
      dx: number;
      dy: number;
    }[][] = [];
    const start = performance.now();
    while (performance.now() - start < 700) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const canvas = document
        .querySelector("canvas.world-canvas")!
        .getBoundingClientRect();
      const lines = document.querySelectorAll(".celestial-leaders line");
      samples.push(
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(".celestial-label"),
        ).flatMap((button, index) => {
          if (button.hidden) return [];
          const rectangle = button.getBoundingClientRect();
          const x = Number(lines[index].getAttribute("x1"));
          const y = Number(lines[index].getAttribute("y1"));
          return [
            {
              id: button.title,
              x,
              y,
              dx: rectangle.x - canvas.x - x,
              dy: rectangle.y - canvas.y - y,
            },
          ];
        }),
      );
    }
    return samples;
  });
  await expect(
    page
      .getByRole("navigation", { name: "Constellation breadcrumb" })
      .getByRole("button", { name, exact: true }),
  ).toBeVisible();
  const first = new Map<
    string,
    { x: number; y: number; dx: number; dy: number }
  >();
  let travel = 0;
  let comparisons = 0;
  for (const frame of frames)
    for (const label of frame) {
      const initial = first.get(label.id);
      if (!initial) {
        first.set(label.id, label);
        continue;
      }
      travel = Math.max(
        travel,
        Math.hypot(label.x - initial.x, label.y - initial.y),
      );
      expect(Math.abs(label.dx - initial.dx), label.id).toBeLessThan(0.1);
      expect(Math.abs(label.dy - initial.dy), label.id).toBeLessThan(0.1);
      comparisons++;
    }
  expect(comparisons).toBeGreaterThan(5);
  expect(travel).toBeGreaterThan(20);
});
