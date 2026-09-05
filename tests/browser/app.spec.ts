import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { layoutWorld } from "../../src/world/layout.ts";
import { planDistrictTitles } from "../../src/world/district-titles.ts";
import { SurveyHierarchy } from "../../src/world/survey.ts";
import type { ProjectGraph } from "../../src/graph/types.ts";
test("navigates physical district titles, breadcrumbs, and entrances", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Walk through your code." }),
  ).toBeVisible();
  await expect(page.locator("canvas.world-canvas")).toBeVisible();
  await page.locator("#demo").click();
  await expect(page.locator(".view-switch")).toBeVisible();
  await expect(page.locator(".world-label:visible")).toHaveCount(0);
  const graph: ProjectGraph = JSON.parse(
    readFileSync(resolve("public/demo.graph.json"), "utf8"),
  );
  const layout = layoutWorld(graph);
  const survey = new SurveyHierarchy(layout);
  const title = planDistrictTitles(layout, graph).find(
    (candidate) => candidate.title === "@harbor/ui",
  );
  if (!title)
    throw new Error("The demo UI district has no physical neon title.");
  const canvas = await page.locator("canvas.world-canvas").boundingBox();
  if (!canvas) throw new Error("The world canvas has no visible bounds.");
  const size = Math.max(layout.width, layout.depth);
  const camera = new THREE.PerspectiveCamera(
    50,
    canvas.width / canvas.height,
    0.1,
    6500,
  );
  camera.position.set(size * 0.55, size * 0.46, size * 0.65);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const projected = new THREE.Vector3(
    title.x,
    2.8 + title.titleHeight / 2,
    title.z - title.depth / 2 + 0.1,
  ).project(camera);
  await page.mouse.click(
    canvas.x + (projected.x * 0.5 + 0.5) * canvas.width,
    canvas.y + (-projected.y * 0.5 + 0.5) * canvas.height,
  );
  const inspector = page.locator("#inspector");
  await expect(inspector.locator("h2")).toHaveText(title.title);
  const immediate = survey.children(title.id);
  const contents = inspector.locator(".inspector-scroll [data-select]");
  await expect(contents).toHaveAttribute("data-select", immediate[0].id);
  expect(
    await contents.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("data-select")),
    ),
  ).toEqual(immediate.map((target) => target.id));
  const building = immediate.find((target) => "nodes" in target);
  if (!building || !("nodes" in building))
    throw new Error("The demo UI district has no direct building.");
  await contents.filter({ hasText: building.name }).click();
  await expect(inspector.locator("h2")).toHaveText(building.name);
  await expect(
    inspector.getByRole("heading", { name: "Rooms", exact: true }),
  ).toBeVisible();
  expect(
    await inspector
      .locator(".inspector-scroll [data-select]")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("data-select")),
      ),
  ).toEqual(building.rooms.map((room) => room.id));
  const breadcrumb = inspector.getByRole("navigation", {
    name: "Directory breadcrumb",
  });
  await expect(
    breadcrumb.getByRole("button", { name: "City", exact: true }),
  ).toBeVisible();
  await breadcrumb.locator(`[data-select="${title.id}"]`).click();
  await expect(inspector.locator("h2")).toHaveText(title.title);
  await expect(inspector.locator(".eyebrow")).toHaveText("District");
  await inspector.getByRole("button", { name: "Teleport to entrance" }).click();
  await expect(inspector).toBeHidden();
  await expect(page.locator('[data-mode="walk"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await page.locator('[data-mode="survey"]').click();
  expect(errors).toEqual([]);
});
test("enters the preview through a building and only shows its label on hover", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".landing")).toBeVisible();
  await expect(page.locator(".world-label")).toHaveCount(0);
  const graph: ProjectGraph = JSON.parse(
    readFileSync(resolve("public/demo.graph.json"), "utf8"),
  );
  const layout = layoutWorld(graph);
  const canvas = await page.locator("canvas.world-canvas").boundingBox();
  if (!canvas) throw new Error("The preview canvas has no visible bounds.");
  const size = Math.max(layout.width, layout.depth);
  const camera = new THREE.PerspectiveCamera(
    50,
    canvas.width / canvas.height,
    0.1,
    6500,
  );
  camera.position.set(size * 0.55, size * 0.46, size * 0.65);
  const landingBounds = await page.locator(".landing").boundingBox();
  if (!landingBounds)
    throw new Error("The landing panel has no visible bounds.");
  const project = (roofPoint: THREE.Vector3, landing: boolean) => {
    camera.lookAt(landing ? -size * 0.2 : 0, 0, 0);
    camera.updateMatrixWorld();
    const projected = roofPoint.clone().project(camera);
    return {
      x: canvas.x + (projected.x * 0.5 + 0.5) * canvas.width,
      y: canvas.y + (-projected.y * 0.5 + 0.5) * canvas.height,
    };
  };
  const landingRight = landingBounds.x + landingBounds.width;
  const exposed = layout.buildings
    .flatMap((building) =>
      [-0.25, 0.25].flatMap((dx) =>
        [-0.2, 0.2].map((dz) => {
          const roofPoint = new THREE.Vector3(
            building.x + building.width * dx,
            building.stories * 5.4 + 1,
            building.z + building.depth * dz,
          );
          return { building, roofPoint, preview: project(roofPoint, true) };
        }),
      ),
    )
    .filter(
      ({ preview }) =>
        preview.x > landingRight + 48 &&
        preview.x < canvas.x + canvas.width - 100 &&
        preview.y > canvas.y + 130 &&
        preview.y < canvas.y + canvas.height - 170,
    )
    .sort(
      (a, b) =>
        Math.hypot(
          a.preview.x - (landingRight + canvas.width) / 2,
          a.preview.y - canvas.height / 2,
        ) -
        Math.hypot(
          b.preview.x - (landingRight + canvas.width) / 2,
          b.preview.y - canvas.height / 2,
        ),
    );
  let selected: (typeof exposed)[number] | undefined;
  for (const candidate of exposed) {
    const reachesCanvas = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.matches("canvas.world-canvas") ??
        false,
      candidate.preview,
    );
    if (reachesCanvas) {
      selected = candidate;
      break;
    }
  }
  if (!selected)
    throw new Error("No demo roof is exposed beside the landing panel.");
  const { building, roofPoint, preview } = selected;
  const point = (landing: boolean) => project(roofPoint, landing);
  await page.mouse.click(preview.x, preview.y);
  const inspector = page.locator("#inspector");
  await expect(inspector.locator("h2")).toHaveText(building.name);
  await expect(page.locator(".landing")).toBeHidden();
  await inspector.locator(".inspector-scroll [data-select]").first().click();
  await inspector
    .getByRole("button", { name: "Teleport to room", exact: true })
    .click();
  await expect(page.locator('[data-mode="walk"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".landing")).toBeHidden();
  await expect(page.locator(".scene-caption")).toBeHidden();
  await expect(page.locator(".landing-footer")).toBeHidden();
  await expect(page.locator(".bottom-hud")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator('[data-mode="survey"]').click();
  await expect(page.locator(".landing")).toBeHidden();
  await expect(page.locator(".world-label")).toHaveCount(0);
  const target = point(false);
  await page.mouse.move(target.x, target.y);
  await expect(page.locator("#hover")).toBeVisible();
  await expect(page.locator("#hover strong")).toHaveText(building.directory);
  await page.mouse.move(20, 100);
  await expect(page.locator("#hover")).toBeHidden();
  await page.mouse.click(target.x, target.y);
  await expect(inspector.locator("h2")).toHaveText(building.name);
  await expect(page.locator("#hover")).toBeHidden();
  expect(errors).toEqual([]);
});
test("explores, searches, and changes views", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#demo").click();
  await expect(page.locator(".view-switch")).toBeVisible();
  await page.getByRole("button", { name: "Find a file", exact: true }).click();
  await page.locator("#search-input").fill("Graph.ts");
  await page.locator(".search-result").first().click();
  await expect(page.locator("#inspector h2")).toHaveText("Graph.ts");
  await expect(page.locator("#inspector")).toContainText("Imported by");
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page
    .getByRole("button", { name: "Constellation", exact: true })
    .click();
  await expect(page.locator('[data-mode="constellation"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Toggle import routes" }).click();
  await expect(page.locator("#routes")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await expect(page.locator("#help-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
test("opens and reopens a directory through the compatible picker", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .locator("#directory-input")
    .setInputFiles(resolve("tests/test-fixtures/picker"));
  await expect(page.locator(".project-name")).toHaveText("picker", {
    timeout: 15000,
  });
  await expect(page.locator("#loading")).toBeHidden();
  await page.getByRole("button", { name: "Find a file", exact: true }).click();
  await page.locator("#search-input").fill("greet");
  await page.locator(".search-result").click();
  await expect(page.locator("#inspector")).toContainText("index.ts");
  await page.reload();
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .locator(".landing")
    .getByRole("button", { name: "Open picker", exact: true })
    .click();
  const chooser = await chooserPromise;
  await chooser.setFiles(resolve("tests/test-fixtures/picker"));
  await expect(page.locator(".project-name")).toHaveText("picker");
  await expect(page.locator("#loading")).toBeHidden();
  expect(errors).toEqual([]);
});
test("remembers only manually opened projects and keeps mobile controls reachable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".landing .recent-projects")).toBeHidden();
  await expect(page.getByText("Neo Compose", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Retree", { exact: true })).toHaveCount(0);
  await page.locator("#choose").click();
  await page
    .getByRole("textbox", { name: "Local project directory" })
    .fill(resolve("tests/test-fixtures/picker"));
  await page.getByRole("button", { name: "Open local directory" }).click();
  await expect(page.locator(".project-name")).toHaveText("picker");
  await page.reload();
  await page
    .locator(".landing")
    .getByRole("button", { name: "Open picker", exact: true })
    .click();
  await expect(page.locator(".project-name")).toHaveText("picker");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Find a file", exact: true }).click();
  await page.locator("#search-input").fill("greet");
  await expect(page.locator(".search-result").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open a project", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Forget picker", exact: true })
    .click();
  await expect(page.locator("#project-dialog .recent-projects")).toBeHidden();
  await page.reload();
  await expect(page.locator(".landing .recent-projects")).toBeHidden();
});
