import { expect, test } from "@playwright/test";

test("Survey cinema pauses for interaction, resumes after idle, and remembers its toggle", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.locator("#demo").click();
  const cinema = page.getByRole("button", { name: "Toggle cinema mode" });
  await expect(cinema).toHaveAttribute("aria-pressed", "true");
  await page.clock.fastForward(2200);
  await expect(cinema).toHaveAttribute("data-state", "playing");
  await page.mouse.move(720, 600);
  await page.mouse.down();
  await page.mouse.move(800, 620, { steps: 5 });
  await expect(cinema).toHaveAttribute("data-state", "paused");
  await page.mouse.up();
  await page.clock.fastForward(19000);
  await expect(cinema).toHaveAttribute("data-state", "paused");
  await page.clock.fastForward(1500);
  await expect(cinema).toHaveAttribute("data-state", "playing");
  await cinema.click();
  await expect(cinema).toHaveAttribute("aria-pressed", "false");
  await page.clock.fastForward(30000);
  await expect(cinema).toHaveAttribute("data-state", "off");
  await page.reload();
  await page.locator("#demo").click();
  await expect(cinema).toHaveAttribute("aria-pressed", "false");
  await cinema.click();
  await expect(cinema).toHaveAttribute("data-state", "playing");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(cinema).toHaveAttribute("data-state", "paused");
  await page.clock.fastForward(30000);
  await expect(cinema).toHaveAttribute("data-state", "paused");
});
