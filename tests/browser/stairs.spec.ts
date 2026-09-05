import { expect, test } from "@playwright/test";

test("walks front and rear stairs through the full building shell", async ({
  page,
}) => {
  await page.goto("/tests/test-fixtures/stairs/index.html");
  const result = page.locator("#result");
  await expect(result).toHaveAttribute("data-status", "passed");
});
