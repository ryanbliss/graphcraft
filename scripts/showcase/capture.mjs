/* global window, document, performance */
import { showcaseGraph } from "./fixture.ts";
import { ffmpeg } from "./ffmpeg.mjs";
import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";

const out = "artifacts/showcase";
await mkdir(out, { recursive: true });
const graph = process.env.SHOWCASE_GRAPH
  ? JSON.parse(await readFile(process.env.SHOWCASE_GRAPH, "utf8"))
  : showcaseGraph();
await writeFile(`${out}/graph.json`, JSON.stringify(graph));
const browser = await chromium.launch({
  channel: "chromium",
  headless: true,
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.setDefaultTimeout(120000);
page.on("pageerror", (error) => console.error(error));
await page.route("**/demo.graph.json", (route) =>
  route.fulfill({ json: graph }),
);
await page.route(/\/src\/main\.ts(?:\?.*)?$/, async (route) => {
  console.log("Instrumenting main module");
  const response = await route.fetch();
  await route.fulfill({
    response,
    body: `${await response.text()}\nwindow.__capture = {engine, travel, select, setGraph};`,
  });
});
await page.goto(process.env.SHOWCASE_URL || "http://127.0.0.1:5173/");
await page
  .waitForFunction(() => window.__capture?.engine?.city)
  .catch(async (error) => {
    console.log(
      await page.evaluate(() => ({
        capture: !!window.__capture,
        text: document.body.innerText,
      })),
    );
    await page.screenshot({ path: `${out}/error.png` });
    throw error;
  });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({
  content: `.celestial-heading,#film-caption,.walk-prompt,.view-hint,#hover,.minimap,#diagnostics,.world-location,.world-toolbar {display:none!important} .masthead {pointer-events:none} .crosshair {opacity:.5} #film-caption{position:fixed;left:48px;bottom:42px;z-index:95;font:500 28px 'Space Grotesk Variable';color:#edffe4;text-shadow:0 2px 18px #000;pointer-events:none} #film-credit{position:fixed;right:34px;bottom:18px;z-index:95;font:10px 'DM Sans Variable';color:#b7c9cc;pointer-events:none}`,
});
await page.evaluate(() => {
  const e = window.__capture.engine;
  e.renderer.setPixelRatio(2);
  e.composer.setPixelRatio(2);
  e.resize();
  e.captureMouse = () => {
    e.mouseFallback = true;
    e.hooks.lock(true);
  };
  const caption = document.createElement("div");
  caption.id = "film-caption";
  document.body.append(caption);
  window.__capture.core =
    e.layout.buildings.find((b) => b.id === ".:src/database") ??
    e.layout.buildings.find((b) => b.packageId === "packages/core");
  window.__capture.rooms = e.layout.buildings.flatMap((b) => b.rooms);
});
await writeFile(
  `${out}/scene.json`,
  JSON.stringify(
    await page.evaluate(() => {
      const e = window.__capture.engine;
      return {
        buildings: e.layout.buildings,
        titles: e.city.titlePlacements,
        shuttles: [...e.city.shuttles].map(([id, o]) => ({
          id,
          p: o.position,
        })),
        positions: [...e.layout.positions],
        sky: e.constellation.skyPickables.map((o) => ({
          id: o.userData.celestialId,
          p: o.position,
        })),
      };
    }),
    null,
    2,
  ),
);
if (process.argv.includes("--probe")) {
  await page.screenshot({ path: `${out}/home.png` });
  await browser.close();
  process.exit(0);
}
await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
await page.clock.pauseAt(new Date("2030-01-01T01:00:00Z"));
await page.evaluate(() => {
  const e = window.__capture.engine;
  e.lastFrame = performance.now();
  e.elapsed = 0;
  e.setMode("survey");
});
// Shot definitions are evaluated inside the real application. Private camera
// controls exist only in this intercepted browser response, never in the build.
await page.evaluate(await readFile("scripts/showcase/tour.js", "utf8"));
const still = process.argv.find((arg) => arg.startsWith("--still="));
if (still) {
  const t = Number(still.split("=")[1]);
  await page.evaluate((t) => window.__tour(t), t);
  await page.clock.runFor(50);
  await page.screenshot({ path: `${out}/still-${t}.png` });
  await browser.close();
  process.exit(0);
}
const encoder = spawn(
  ffmpeg,
  [
    "-y",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "-framerate",
    "30",
    "-i",
    "pipe:0",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "14",
    "-pix_fmt",
    "yuv420p",
    `${out}/silent.mp4`,
  ],
  { stdio: ["pipe", "ignore", "pipe"] },
);
let log = "";
encoder.stderr.on("data", (d) => (log += d));
const frames = 840;
for (let frame = 0; frame < frames; frame++) {
  const t = frame / 30;
  await page.evaluate((t) => window.__tour(t), t);
  await page.clock.runFor(1000 / 30);
  if (process.argv.includes("--draft") && frame % 30 !== 0) continue;
  const jpeg = await page.screenshot({ type: "jpeg", quality: 100 });
  if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, "drain");
  if (frame % 30 === 0 || frames === 30) {
    await writeFile(
      `${out}/frame-${String(Math.floor(t)).padStart(2, "0")}.jpg`,
      jpeg,
    );
    console.log(`Captured ${t.toFixed(1)}s`);
  }
}
encoder.stdin.end();
const [code] = await once(encoder, "close");
await browser.close();
if (code !== 0) throw new Error(log);
console.log("Capture complete");
