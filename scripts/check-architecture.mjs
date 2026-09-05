import { readdir, readFile } from "node:fs/promises";
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      await check(path);
      continue;
    }
    if (!path.endsWith(".ts")) continue;
    const content = await readFile(path, "utf8");
    if (
      /from\s+['"][^'"]*(?:tests\/|__fixtures__|test-fixtures|vitest|playwright)/.test(
        content,
      )
    )
      throw new Error(`Runtime source imports test infrastructure: ${path}`);
    if (/from\s+['"]node:/.test(content))
      throw new Error(`Browser source imports a Node-only API: ${path}`);
  }
}
await check("src");
console.log("Architecture checks passed.");
