import { minimatch } from "minimatch";
import { SourceFilter, isScanMetadata, contentOmission } from "./discovery.ts";
import { parse, type ParserPlugin } from "@babel/parser";
import { findCycles } from "./cycles.ts";
import { addCSharpGraph } from "./csharp.ts";
import * as t from "@babel/types";
import { parse as parseJson, type ParseError } from "jsonc-parser";
import {
  dirname,
  hash,
  normalize,
  type SourceFile,
  type ProjectGraph,
  type GraphNode,
  type EdgeKind,
  type Diagnostic,
  type ScanSummary,
} from "./types.ts";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}
function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}
interface ImportRef {
  specifier: string;
  kind: EdgeKind;
  names: string[];
}
interface Config {
  directory: string;
  base: string;
  paths: Record<string, unknown>;
}
interface Manifest {
  directory: string;
  data: RecordValue;
}
const extensions = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".d.ts",
  ".d.mts",
  ".d.cts",
  ".json",
];
function exportTarget(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const v of value) {
      const target = exportTarget(v);
      if (target) return target;
    }
  }
  const obj = record(value);
  for (const key of [
    "source",
    "development",
    "import",
    "module",
    "default",
    "require",
    "types",
  ]) {
    const target = obj[key] && exportTarget(obj[key]);
    if (typeof target === "string") return target;
  }
}
export function analyzeProject(
  input: SourceFile[],
  name: string,
  options: {
    omittedPaths?: string[];
    repositoryRoots?: string[];
    scan?: ScanSummary;
  } = {},
): ProjectGraph {
  const omitted = new Set(options.omittedPaths?.map(normalize));
  const filter = new SourceFilter();
  for (const repository of options.repositoryRoots ?? [])
    filter.addRepository(repository);
  for (const file of input)
    if (isScanMetadata(file.path)) filter.addMetadata(file);
  const sources = input
    .filter((file) => {
      const included = filter.includes(file.path) && !contentOmission(file);
      if (!included) omitted.add(normalize(file.path));
      return included;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const files = new Map(
    sources.map((file) => [normalize(file.path), file.content]),
  );
  const diagnostics: Diagnostic[] = [];
  const json = (path: string): RecordValue => {
    const errors: ParseError[] = [];
    const value: unknown = parseJson(
      (files.get(path) ?? "{}").replace(/^\uFEFF/, ""),
      errors,
      { allowTrailingComma: true },
    );
    if (errors.length)
      diagnostics.push({
        path,
        message: "Invalid JSON configuration. Some settings could not be read.",
      });
    return record(value);
  };
  const allManifests: Manifest[] = [...files.keys()]
    .filter((p) => /(^|\/)package\.json$/.test(p))
    .map((path) => ({ directory: dirname(path), data: json(path) }));
  const isFixtureDirectory = (directory: string): boolean =>
    /(?:^|\/)(?:tests?|__tests__|fixtures?|__fixtures__|test-fixtures|__mocks__)(?:\/|$)/.test(
      directory,
    );
  const workspacePatterns = allManifests
    .filter((manifest) => !isFixtureDirectory(manifest.directory))
    .map((manifest) => {
      const workspaces = manifest.data.workspaces;
      const patterns = Array.isArray(workspaces)
        ? strings(workspaces)
        : strings(record(workspaces).packages);
      return { directory: manifest.directory, patterns };
    });
  const manifests = allManifests.filter((manifest) => {
    if (!manifest.directory) return true;
    if (
      !isFixtureDirectory(manifest.directory) &&
      typeof manifest.data.name === "string"
    )
      return true;
    return workspacePatterns.some(({ directory, patterns }) => {
      const relative = directory
        ? manifest.directory.slice(directory.length + 1)
        : manifest.directory;
      if (directory && !manifest.directory.startsWith(`${directory}/`))
        return false;
      const included = patterns.some(
        (pattern) => !pattern.startsWith("!") && minimatch(relative, pattern),
      );
      const excluded = patterns.some(
        (pattern) =>
          pattern.startsWith("!") && minimatch(relative, pattern.slice(1)),
      );
      return included && !excluded;
    });
  });
  for (const repository of filter.repositories)
    if (
      !manifests.some((manifest) => manifest.directory === repository) &&
      [...files.keys()].some((path) => path.startsWith(`${repository}/`))
    )
      manifests.push({
        directory: repository,
        data: { name: repository.split("/").at(-1) },
      });
  if (!manifests.some((m) => m.directory === ""))
    manifests.unshift({ directory: "", data: { name } });
  const packages = manifests.map((manifest) => {
    const packageName =
      typeof manifest.data.name === "string"
        ? manifest.data.name
        : manifest.directory;
    return {
      id: manifest.directory || ".",
      directory: manifest.directory,
      name: manifest.directory ? packageName : name,
    };
  });
  const manifestByName = new Map(
    manifests
      .filter((m) => typeof m.data.name === "string")
      .map((m) => [String(m.data.name), m]),
  );
  const byDirectory = new Map(packages.map((pkg) => [pkg.directory, pkg]));
  function owner(path: string) {
    let dir = dirname(path);
    while (dir) {
      const pkg = byDirectory.get(dir);
      if (pkg) return pkg;
      dir = dirname(dir);
    }
    return byDirectory.get("")!;
  }
  const configCache = new Map<string, Config>();
  function config(path: string, seen = new Set<string>()): Config {
    const cached = configCache.get(path);
    if (cached) return cached;
    const directory = dirname(path);
    if (seen.has(path)) {
      diagnostics.push({ path, message: "Circular config inheritance." });
      return { directory, base: directory, paths: {} };
    }
    seen.add(path);
    const data = json(path),
      options = record(data.compilerOptions);
    let inherited: Config = { directory, base: directory, paths: {} };
    const parents =
      typeof data.extends === "string" ? [data.extends] : strings(data.extends);
    for (const parent of parents) {
      if (!parent.startsWith(".")) {
        diagnostics.push({
          path,
          message: `Package config ${parent} is not available without node_modules.`,
        });
        continue;
      }
      let target = normalize(`${directory}/${parent}`);
      if (!target.endsWith(".json")) target += ".json";
      if (files.has(target)) inherited = config(target, new Set(seen));
      else
        diagnostics.push({ path, message: `Config ${target} was not found.` });
    }
    const base =
      typeof options.baseUrl === "string"
        ? normalize(`${directory}/${options.baseUrl}`)
        : inherited.base;
    const hasPaths = options.paths !== undefined;
    const result = {
      directory,
      base: hasPaths && !options.baseUrl && !inherited.base ? directory : base,
      paths: hasPaths ? record(options.paths) : inherited.paths,
    };
    configCache.set(path, result);
    return result;
  }
  const configs = new Map<string, Config>();
  for (const path of files.keys())
    if (/(^|\/)(tsconfig|jsconfig)\.json$/.test(path))
      configs.set(dirname(path), config(path));
  function nearestConfig(path: string): Config | undefined {
    let dir = dirname(path);
    while (true) {
      const cfg = configs.get(dir);
      if (cfg) return cfg;
      if (!dir) return;
      dir = dirname(dir);
    }
  }
  const sourceOutputs: { output: string; source: string }[] = [];
  for (const path of files.keys()) {
    if (!/(^|\/)[jt]sconfig[^/]*\.json$/.test(path)) continue;
    const options = record(json(path).compilerOptions);
    if (
      typeof options.outDir !== "string" ||
      typeof options.rootDir !== "string"
    )
      continue;
    sourceOutputs.push({
      output: normalize(`${dirname(path)}/${options.outDir}`),
      source: normalize(`${dirname(path)}/${options.rootDir}`),
    });
  }
  sourceOutputs.sort((a, b) => b.output.length - a.output.length);
  const codePaths = new Set(
    [...files.keys()].filter((p) => /\.[cm]?[jt]sx?$/.test(p)),
  );
  function isOmitted(path: string): boolean {
    let current = path;
    while (current) {
      if (omitted.has(current)) return true;
      current = dirname(current);
    }
    return false;
  }
  function findFile(
    candidate: string,
    seen = new Set<string>(),
  ): string | undefined {
    const path = normalize(candidate);
    if (seen.has(path)) return;
    seen.add(path);
    for (const mapping of sourceOutputs) {
      if (!path.startsWith(`${mapping.output}/`)) continue;
      const found = findFile(
        `${mapping.source}/${path.slice(mapping.output.length + 1)}`,
        seen,
      );
      if (found) return found;
    }
    if (isOmitted(path)) return path;
    // TypeScript substitutes source extensions even when imports name emitted .js files.
    const substitutions: Record<string, string[]> = {
      ".js": [".ts", ".tsx", ".d.ts"],
      ".jsx": [".tsx"],
      ".mjs": [".mts", ".d.mts"],
      ".cjs": [".cts", ".d.cts"],
    };
    const ext = path.match(/\.[^./]+$/)?.[0];
    if (ext && substitutions[ext])
      for (const replacement of substitutions[ext]) {
        const p = path.slice(0, -ext.length) + replacement;
        if (codePaths.has(p) || isOmitted(p)) return p;
      }
    if (files.has(path)) return path;
    for (const extension of extensions)
      if (files.has(path + extension) || isOmitted(path + extension))
        return path + extension;
    if (files.has(normalize(`${path}/package.json`))) {
      const pkg = json(normalize(`${path}/package.json`));
      for (const key of ["source", "module", "main", "types"])
        if (typeof pkg[key] === "string") {
          const target = findFile(`${path}/${pkg[key]}`, seen);
          if (target) return target;
        }
    }
    for (const extension of extensions)
      if (codePaths.has(normalize(`${path}/index${extension}`)))
        return normalize(`${path}/index${extension}`);
  }
  function matchAlias(
    specifier: string,
    aliases: RecordValue,
    base: string,
  ): string | undefined {
    const entries = Object.entries(aliases).sort(
      ([a], [b]) => b.replace("*", "").length - a.replace("*", "").length,
    );
    for (const [pattern, value] of entries) {
      const star = pattern.indexOf("*");
      let match = "";
      if (star < 0) {
        if (specifier !== pattern) continue;
      } else {
        const prefix = pattern.slice(0, star),
          suffix = pattern.slice(star + 1);
        if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix))
          continue;
        match = specifier.slice(
          prefix.length,
          specifier.length - suffix.length,
        );
      }
      const targets = typeof value === "string" ? [value] : strings(value);
      for (const target of targets) {
        const resolved = findFile(`${base}/${target.replace("*", match)}`);
        if (resolved) return resolved;
      }
    }
  }
  function packageEntry(
    pkg: { directory: string },
    entry: string,
  ): string | undefined {
    const resolved = findFile(`${pkg.directory}/${entry}`);
    if (resolved && codePaths.has(resolved)) return resolved;
    // Bundlers often keep source subdirectories under a conventional output root.
    const emitted = normalize(entry).match(/^(?:dist|build|bin|out)\/(.+)$/);
    if (emitted) {
      const source = findFile(`${pkg.directory}/src/${emitted[1]}`);
      if (source && codePaths.has(source)) return source;
    }
    return resolved;
  }
  function resolve(from: string, specifier: string): string | undefined {
    const spec = specifier.replace(/[?#].*$/, (match) =>
      specifier.startsWith("#") ? match : "",
    );
    if (spec.startsWith(".")) {
      const pkg = owner(from);
      const candidate = normalize(`${dirname(from)}/${spec}`);
      if (pkg.directory && !candidate.startsWith(`${pkg.directory}/`))
        return findFile(candidate);
      const entry = pkg.directory
        ? candidate.slice(pkg.directory.length + 1)
        : candidate;
      return packageEntry(pkg, entry);
    }
    const cfg = nearestConfig(from);
    if (cfg) {
      const found =
        matchAlias(spec, cfg.paths, cfg.base) ??
        findFile(`${cfg.base}/${spec}`);
      if (found) return found;
    }
    if (spec.startsWith("#")) {
      const pkg = manifests.find((m) => m.directory === owner(from).directory);
      return matchAlias(spec, record(pkg?.data.imports), pkg?.directory ?? "");
    }
    const pkgName = spec.startsWith("@")
      ? spec.split("/").slice(0, 2).join("/")
      : spec.split("/")[0];
    const pkg = manifestByName.get(pkgName);
    if (!pkg) return;
    const subpath = spec.slice(pkgName.length);
    const key = subpath ? `.${subpath}` : ".";
    const exported = record(pkg.data.exports);
    let target = exportTarget(
      exported[key] ?? (key === "." ? pkg.data.exports : undefined),
    );
    if (!target)
      for (const [pattern, value] of Object.entries(exported)) {
        if (!pattern.includes("*")) continue;
        const [prefix, suffix] = pattern.split("*");
        if (key.startsWith(prefix) && key.endsWith(suffix))
          target = exportTarget(value)?.replace(
            "*",
            key.slice(prefix.length, key.length - suffix.length),
          );
      }
    if (target) {
      const found = packageEntry(pkg, target);
      if (found) return found;
    }
    if (subpath)
      return (
        findFile(`${pkg.directory}/${subpath}`) ??
        findFile(`${pkg.directory}/src/${subpath}`)
      );
    for (const entry of [
      pkg.data.source,
      pkg.data.module,
      pkg.data.main,
      pkg.data.types,
      "src/index",
      "index",
    ])
      if (typeof entry === "string") {
        const found = packageEntry(pkg, entry);
        if (found) return found;
      }
  }
  const nodes: GraphNode[] = [],
    references = new Map<string, ImportRef[]>();
  for (const path of files.keys()) {
    const content = files.get(path)!;
    const node: GraphNode = {
      id: path,
      name: path.split("/").pop()!,
      packageId: owner(path).id,
      directory: dirname(path),
      kind: "module",
      lines: content.split("\n").length,
      exports: [],
      components: [],
      incoming: 0,
      outgoing: 0,
    };
    const refs: ImportRef[] = [];
    references.set(path, refs);
    if (
      /(?:^|\/)(?:__tests__|tests?|__mocks__)(?:\/)|\.(test|spec)\./.test(path)
    )
      node.kind = "test";
    else if (
      /(?:schema|types|interface)/i.test(node.name) ||
      /\.d\.ts$/.test(path)
    )
      node.kind = "schema";
    else if (/(?:config|\.setup)\./i.test(path)) node.kind = "config";
    else if (/(?:service|store|api|server|client|use[A-Z])/.test(node.name))
      node.kind = "service";
    if (!codePaths.has(path)) {
      if (
        /\.(?:json|jsonc|ya?ml|toml|xml|csproj|slnx?|props|targets|asmdef|code-workspace)$/i.test(
          path,
        )
      )
        node.kind = "config";
      nodes.push(node);
      continue;
    }
    try {
      const plugins: ParserPlugin[] = ["jsx", "decorators-legacy"];
      if (/\.[cm]?tsx?$/.test(path))
        plugins.push(["typescript", { dts: /\.d\.[cm]?ts$/.test(path) }]);
      const ast = parse(content, {
        sourceType: "unambiguous",
        allowReturnOutsideFunction: true,
        errorRecovery: true,
        attachComment: false,
        plugins,
      });
      for (const error of ast.errors ?? [])
        diagnostics.push({ path, message: error.message });
      t.traverseFast(ast, (part) => {
        if (t.isImportDeclaration(part))
          refs.push({
            specifier: part.source.value,
            kind:
              part.importKind === "type" ||
              (part.specifiers.length > 0 &&
                part.specifiers.every(
                  (s) => t.isImportSpecifier(s) && s.importKind === "type",
                ))
                ? "type"
                : "import",
            names: part.specifiers.map((s) => s.local.name),
          });
        if (
          (t.isExportNamedDeclaration(part) ||
            t.isExportAllDeclaration(part)) &&
          part.source
        )
          refs.push({
            specifier: part.source.value,
            kind: part.exportKind === "type" ? "type" : "reexport",
            names: [],
          });
        if (t.isImportExpression(part) && t.isStringLiteral(part.source))
          refs.push({
            specifier: part.source.value,
            kind: "dynamic",
            names: [],
          });
        if (
          t.isTSImportEqualsDeclaration(part) &&
          t.isTSExternalModuleReference(part.moduleReference) &&
          t.isStringLiteral(part.moduleReference.expression)
        )
          refs.push({
            specifier: part.moduleReference.expression.value,
            kind: "import",
            names: [],
          });
        if (
          t.isCallExpression(part) &&
          (t.isImport(part.callee) ||
            t.isIdentifier(part.callee, { name: "require" }))
        ) {
          const arg = part.arguments[0];
          if (t.isStringLiteral(arg))
            refs.push({
              specifier: arg.value,
              kind: t.isImport(part.callee) ? "dynamic" : "import",
              names: [],
            });
          else
            diagnostics.push({
              path,
              message: "Computed import cannot be resolved statically.",
            });
        }
        if (t.isJSXOpeningElement(part)) {
          let tag = part.name;
          while (t.isJSXMemberExpression(tag)) tag = tag.object;
          if (t.isJSXIdentifier(tag) && /^[A-Z]/.test(tag.name))
            node.components.push(tag.name);
          if (node.kind === "module") node.kind = "component";
        }
        if (t.isExportNamedDeclaration(part)) {
          for (const symbol of Object.keys(
            part.declaration ? t.getBindingIdentifiers(part.declaration) : {},
          ))
            node.exports.push(symbol);
          for (const symbol of part.specifiers)
            if (t.isIdentifier(symbol.exported))
              node.exports.push(symbol.exported.name);
        }
        if (t.isExportDefaultDeclaration(part)) node.exports.push("default");
      });
    } catch (error) {
      diagnostics.push({
        path,
        message: `Parse failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    node.components = [...new Set(node.components)].sort();
    node.exports = [...new Set(node.exports)].sort();
    nodes.push(node);
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: ProjectGraph["edges"] = [],
    seenEdges = new Set<string>();
  for (const node of [...nodes])
    for (const ref of references.get(node.id) ?? []) {
      let target = resolve(node.id, ref.specifier);
      if (target && !byId.has(target)) continue;
      if (!target) {
        if (
          /\.(css|scss|sass|less|json|svg|png|jpe?g|gif|webp|wasm|html|vue|svelte)(?:[?#].*)?$/.test(
            ref.specifier,
          )
        ) {
          diagnostics.push({
            path: node.id,
            message: `Non-code import omitted: ${ref.specifier}`,
          });
          continue;
        }
        if (
          ref.specifier.startsWith(".") ||
          ref.specifier.startsWith("#") ||
          ref.specifier.startsWith("@/")
        ) {
          diagnostics.push({
            path: node.id,
            message: `Unresolved import ${ref.specifier}`,
          });
          continue;
        }
        const spec = ref.specifier;
        const pkg = spec.startsWith("@")
          ? spec.split("/").slice(0, 2).join("/")
          : spec.split("/")[0];
        if (manifestByName.has(pkg)) {
          diagnostics.push({
            path: node.id,
            message: `Unresolved workspace import ${spec}`,
          });
          continue;
        }
        target = `npm:${pkg}`;
        if (!byId.has(target)) {
          const external: GraphNode = {
            id: target,
            name: pkg,
            packageId: "~external",
            directory: "~external",
            kind: "external",
            lines: 0,
            exports: [],
            components: [],
            incoming: 0,
            outgoing: 0,
          };
          nodes.push(external);
          byId.set(target, external);
        }
      }
      const kinds = [ref.kind];
      if (ref.names.some((local) => node.components.includes(local)))
        kinds.push("component");
      for (const kind of kinds) {
        const key = `${node.id}\0${target}\0${kind}`;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        edges.push({ source: node.id, target, kind, specifier: ref.specifier });
        node.outgoing++;
        byId.get(target)!.incoming++;
      }
    }
  addCSharpGraph(files, nodes, packages, edges, diagnostics);
  if (nodes.some((n) => n.kind === "external"))
    packages.push({
      id: "~external",
      name: "External dependencies",
      directory: "~external",
    });
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) =>
    `${a.source}:${a.target}:${a.kind}`.localeCompare(
      `${b.source}:${b.target}:${b.kind}`,
    ),
  );
  return {
    name,
    nodes,
    edges,
    ...(options.scan ? { scan: options.scan } : {}),
    packages: packages.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics,
    cycles: findCycles(nodes, edges),
    seed: hash(
      nodes.map((n) => n.id).join("\n") +
        "\n" +
        edges.map((e) => `${e.source}>${e.target}:${e.kind}`).join("\n"),
    ),
  };
}
