import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("opens mixed TypeScript and C# projects with real references and static JSON", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .locator("#directory-input")
    .setInputFiles(resolve("tests/test-fixtures/mixed-picker"));
  await expect(page.locator(".project-name")).toHaveText("mixed-picker", {
    timeout: 15000,
  });
  await expect(page.locator("#loading")).toBeHidden();
  await page.getByRole("button", { name: "Teleport", exact: true }).click();
  const destinations = page.locator("#travel-dialog");
  await expect(
    destinations.getByRole("button", {
      name: "Teleport to Mixed.App, App",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    destinations.getByRole("button", {
      name: "Teleport to Mixed.Domain, Domain",
      exact: true,
    }),
  ).toBeVisible();
  await destinations
    .getByRole("button", { name: "Close teleport menu" })
    .click();

  const inspector = page.locator("#inspector");
  const inspect = async (name: string, path: string) => {
    await page
      .getByRole("button", { name: "Find a file", exact: true })
      .click();
    await page.locator("#search-input").fill(name);
    await page.locator(".search-result").filter({ hasText: path }).click();
    await expect(inspector.locator("h2")).toHaveText(name);
    await expect(inspector.getByLabel("Full path", { exact: true })).toHaveText(
      path,
    );
  };
  await inspect("Runner.cs", "App/Runner.cs");
  await expect(inspector.locator(".identity-package")).toHaveText("Mixed.App");
  const referencedType = inspector
    .locator(".relation")
    .filter({ hasText: "Domain/Widget.cs" });
  await expect(referencedType.locator("small")).toHaveText("type");
  await referencedType.click();
  await expect(inspector.locator("h2")).toHaveText("Widget.cs");
  await expect(inspector.locator(".identity-package")).toHaveText(
    "Mixed.Domain",
  );
  await expect(
    inspector.locator(".relation").filter({ hasText: "App/Runner.cs" }),
  ).toBeVisible();
  await inspector.getByRole("button", { name: "Close inspector" }).click();

  await inspect("theme.json", "data/theme.json");
  await expect(inspector.locator(".relation")).toHaveCount(0);
  await expect(
    inspector.getByRole("heading", { name: "Imports", exact: true }),
  ).toBeVisible();
  await expect(inspector.locator(".empty-small").first()).toHaveText(
    "No connections found.",
  );
  await inspector.getByRole("button", { name: "Close inspector" }).click();

  await inspect("index.ts", "src/index.ts");
  await expect(inspector.locator(".identity-package")).toHaveText(
    "mixed-picker",
  );
  await expect(
    inspector
      .locator(".relation")
      .filter({ hasText: "src/settings.ts" })
      .locator("small"),
  ).toHaveText("import");
  expect(errors).toEqual([]);
});
