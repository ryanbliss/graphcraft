import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const saved = "artifacts/showcase/ffmpeg-path";
export const ffmpeg =
  process.env.FFMPEG ||
  (existsSync(saved) ? readFileSync(saved, "utf8").trim() : "ffmpeg");
export function run(args) {
  const result = spawnSync(ffmpeg, ["-y", "-hide_banner", ...args], {
    stdio: "inherit",
  });
  if (result.error)
    throw new Error(
      `Unable to launch FFmpeg. Install it or set FFMPEG to its executable path. ${result.error.message}`,
    );
  if (result.status !== 0)
    throw new Error(`FFmpeg exited with ${result.status}`);
}
