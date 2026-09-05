import { expect, test } from "@playwright/test";

test("initial directory import shows the shared loader and file progress above the picker", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      value: async () => ({
        kind: "directory",
        name: "Import fixture",
        async *values() {
          for (let index = 0; index < 101; index++) {
            yield {
              kind: "file",
              name: `module-${index}.ts`,
              async getFile() {
                if (index === 100)
                  await new Promise((resolve) => setTimeout(resolve, 1500));
                return new File(
                  ["export const value = 1;"],
                  `module-${index}.ts`,
                );
              },
            };
          }
        },
      }),
    });
  });
  await page.goto("/");
  await page.locator("#choose").click();
  await page.locator("#native-picker").click();
  await expect(page.locator("#project-dialog")).not.toBeVisible();
  await expect(page.locator("#loading")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Read 100 files");
  await expect(page.locator("#loading")).toBeHidden({ timeout: 30000 });
  await expect(page.locator(".project-name")).toHaveText("Import fixture");
  await expect(page.locator(".landing")).toBeHidden();
});

test("failed initial imports restore the picker with an actionable error", async ({
  page,
}) => {
  await page.route("**/api/project", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 400,
      json: { error: "Directory does not exist." },
    });
  });
  await page.goto("/");
  await page.locator("#choose").click();
  await page.locator("#project-path").fill("/missing-project");
  await page.getByRole("button", { name: "Open local directory" }).click();
  await expect(page.locator("#loading")).toBeVisible();
  await expect(page.locator("#project-dialog")).not.toBeVisible();
  await expect(page.locator("#project-error")).toHaveText(
    "Directory does not exist.",
  );
  await expect(page.locator("#project-dialog")).toBeVisible();
  await expect(page.locator("#loading")).toBeHidden();
});
