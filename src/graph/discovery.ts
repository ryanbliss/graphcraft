import ignore, { type Ignore } from "ignore";
import { parse } from "jsonc-parser";
import { dirname, isProjectFile, normalize, type SourceFile } from "./types.ts";

export function isScanMetadata(path: string): boolean {
  return (
    isProjectFile(`${dirname(path)}/metadata.ts`) &&
    /(?:^|\/)(?:\.gitignore|[^/]+\.code-workspace|[^/]+\.csproj|ProjectVersion\.txt|[jt]sconfig[^/]*\.json)$/.test(
      path,
    )
  );
}

export function isGeneratedSource(file: SourceFile): boolean {
  if (
    /(?:^|\/)_generated\/|\.(?:generated|gen)\.[^/]+$|\.g(?:\.i)?\.cs$/.test(
      file.path,
    )
  )
    return true;
  // Only inspect the leading comment, never strings or comments in authored code.
  const header =
    file.content.match(
      /^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))\s*)+/,
    )?.[0] ?? "";
  return /@generated\b|\bauto[- ]generated\b|\bautomatically generated\b|\bdo not edit\b/i.test(
    header,
  );
}

export class SourceFilter {
  private ignores = new Map<string, Ignore>();
  private outputs = new Set<string>();
  readonly repositories = new Set<string>();
  private dotnet = new Set<string>();
  private unity = new Set<string>();

  addRepository(directory: string) {
    const path = normalize(directory);
    if (path) this.repositories.add(path);
  }
  addDirectory(path: string, names: string[]) {
    if (names.includes(".git")) this.addRepository(path);
    if (names.includes("Assets") && names.includes("ProjectSettings"))
      this.unity.add(path);
    if (names.some((name) => name.endsWith(".csproj"))) this.dotnet.add(path);
  }

  addMetadata(file: SourceFile): void {
    const directory = dirname(file.path);
    if (file.path.endsWith(".gitignore")) {
      this.ignores.set(directory, ignore().add(file.content));
      return;
    }
    if (file.path.endsWith(".csproj")) {
      this.dotnet.add(directory);
      return;
    }
    if (file.path.endsWith("ProjectSettings/ProjectVersion.txt")) {
      this.unity.add(dirname(directory));
      return;
    }
    const data: unknown = parse(file.content);
    if (
      file.path.endsWith(".code-workspace") &&
      data &&
      typeof data === "object" &&
      "folders" in data &&
      Array.isArray(data.folders)
    ) {
      for (const folder of data.folders) {
        if (
          !folder ||
          typeof folder !== "object" ||
          !("path" in folder) ||
          typeof folder.path !== "string"
        )
          continue;
        if (
          folder.path.startsWith("/") ||
          folder.path.split(/[\\/]/).includes("..")
        )
          continue;
        this.addRepository(`${directory}/${folder.path}`);
      }
      return;
    }
    if (!data || typeof data !== "object" || !("compilerOptions" in data))
      return;
    const options = data.compilerOptions;
    if (!options || typeof options !== "object") return;
    for (const [key, value] of Object.entries(options)) {
      if (!["outDir", "declarationDir", "outFile"].includes(key)) continue;
      if (typeof value !== "string") continue;
      const output = normalize(`${directory}/${value}`);
      // A config that emits beside its inputs must not erase its source directory.
      if (output && output !== directory && !directory.startsWith(`${output}/`))
        this.outputs.add(output);
    }
  }

  includes(path: string, directory = false): boolean {
    if (!isProjectFile(directory ? `${path}/source.ts` : path)) return false;
    for (const output of this.outputs)
      if (path === output || path.startsWith(`${output}/`)) return false;
    for (const scope of this.dotnet) {
      const relative = scope ? path.slice(scope.length + 1) : path;
      if (scope && !path.startsWith(`${scope}/`)) continue;
      if (relative.split("/").some((part) => /^(?:bin|obj)$/i.test(part)))
        return false;
    }
    for (const scope of this.unity) {
      if (scope && !path.startsWith(`${scope}/`)) continue;
      const relative = scope ? path.slice(scope.length + 1) : path;
      if (
        /^(?:Library|Temp|Logs|UserSettings|MemoryCaptures|Recordings)(?:\/|$)/i.test(
          relative,
        )
      )
        return false;
    }
    const parts = path.split("/");
    let boundary = 0;
    for (const repository of this.repositories)
      if (path === repository || path.startsWith(`${repository}/`))
        boundary = Math.max(boundary, repository.split("/").length);
    for (let length = boundary + 1; length <= parts.length; length++) {
      const isDirectory = length < parts.length || directory;
      let ignored = false;
      for (let depth = boundary; depth < length; depth++) {
        const scope = parts.slice(0, depth).join("/");
        const rules = this.ignores.get(scope);
        if (!rules) continue;
        const relative =
          parts.slice(depth, length).join("/") + (isDirectory ? "/" : "");
        const result = rules.test(relative);
        if (result.ignored) ignored = true;
        if (result.unignored) ignored = false;
      }
      if (ignored) return false;
    }
    return true;
  }
}

export function contentOmission(file: SourceFile): string | undefined {
  if (/-----BEGIN (?:[A-Z ]*PRIVATE KEY|CERTIFICATE)-----/.test(file.content))
    return "credentials";
  if (file.content.includes("\0")) return "binary";
  const sample = file.content.slice(0, 8192);
  let controls = 0;
  for (const character of sample) {
    const code = character.charCodeAt(0);
    if ((code > 0 && code < 9) || (code > 13 && code < 32) || code === 0xfffd)
      controls++;
  }
  if (controls > Math.max(2, sample.length * 0.01)) return "binary";
  if (isGeneratedSource(file)) return "generated";
}
