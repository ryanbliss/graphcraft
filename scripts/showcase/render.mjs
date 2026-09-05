import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { run } from "./ffmpeg.mjs";

const destination = "media/showcase";
await mkdir(destination, { recursive: true });
const font =
  process.env.SHOWCASE_FONT ||
  [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ].find(existsSync);
if (!font)
  throw new Error(
    "Set SHOWCASE_FONT to an installed TrueType font for video captions.",
  );
const captions = JSON.parse(
  await readFile("scripts/showcase/captions.json", "utf8"),
);
function text(content, size, x, y, extra = "") {
  return `drawtext=fontfile='${font}':text='${content}':fontsize=${size}:fontcolor=0xedffe4:shadowcolor=black@0.8:shadowx=1:shadowy=2:x=${x}:y=${y}${extra}`;
}
function stages(size, y) {
  return captions
    .map((c) =>
      text(c.text, size, 48, y, `:enable='gte(t,${c.start})*lt(t,${c.end})'`),
    )
    .join(",");
}
const music = ["-ss", "17.4545", "-i", `${destination}/newer-wave.mp3`];
const audio = [
  "-t",
  "28",
  "-af",
  "loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:d=0.35,afade=t=out:st=26.5:d=1.5",
  "-ar",
  "48000",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
];
const video = [
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-color_range",
  "tv",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-movflags",
  "+faststart",
];
const metadata = [
  "-metadata",
  "title=Graphcraft showcase",
  "-metadata",
  "comment=Music: Newer Wave by Kevin MacLeod (incompetech.com), CC BY 4.0 https://creativecommons.org/licenses/by/4.0/. Excerpt trimmed, normalized and faded.",
];
run([
  "-i",
  "artifacts/showcase/silent.mp4",
  ...music,
  "-map",
  "0:v:0",
  "-map",
  "1:a:0",
  "-vf",
  `scale=in_range=pc:out_range=tv:out_color_matrix=bt709,setsar=1,${stages(48, "h-132")}`,
  ...audio,
  ...video,
  ...metadata,
  `${destination}/graphcraft-landscape.mp4`,
]);
// Keep the full UI inside the portrait safe area, with larger editorial captions
// outside the footage. Never crop away a selected galaxy or teleport button.
run([
  "-i",
  "artifacts/showcase/silent.mp4",
  ...music,
  "-filter_complex",
  `[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=35:2,eq=brightness=-0.18:saturation=0.55[back];[fg]scale=1080:608[front];[back][front]overlay=0:620,${text("Your code.", 64, 64, 320, ":enable='lt(t,26)'")},${text("A city to explore.", 64, 64, 400, ":enable='lt(t,26)'")},${stages(40, 1310)},${text("graphcraftcity.vercel.app", 36, 48, 1450, ":enable='lt(t,26)'")},${text("Explore Graphcraft", 56, "(w-tw)/2", 430, ":enable='gte(t,26)'")},${text("Newer Wave - Kevin MacLeod", 32, "(w-tw)/2", 1330, ":enable='gte(t,26)'")},${text("incompetech.com - CC BY 4.0", 28, "(w-tw)/2", 1380, ":enable='gte(t,26)'")},scale=in_range=pc:out_range=tv:out_color_matrix=bt709,setsar=1[v]`,
  "-map",
  "[v]",
  "-map",
  "1:a:0",
  ...audio,
  ...video,
  ...metadata,
  `${destination}/graphcraft-portrait.mp4`,
]);
run([
  "-i",
  `${destination}/graphcraft-landscape.mp4`,
  "-vf",
  "fps=1/3,scale=384:216,tile=6x2",
  "-frames:v",
  "1",
  "-update",
  "1",
  "artifacts/showcase/contact-sheet.jpg",
]);
