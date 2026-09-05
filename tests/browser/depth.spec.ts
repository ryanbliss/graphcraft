import { expect, test } from "@playwright/test";

test("preserves separated surfaces and shared roads through postprocessing at Neo distances", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/tests/test-fixtures/depth/index.html");
  await expect(page.locator("#result")).toHaveAttribute("data-errors", "0");
  expect(errors).toEqual([]);
});
