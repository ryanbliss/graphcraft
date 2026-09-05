import { minimatch } from "minimatch";
import {
  dirname,
  type Diagnostic,
  type GraphEdge,
  type GraphNode,
  type GraphPackage,
} from "./types.ts";

interface XmlItem {
  name: string;
  attributes: Record<string, string>;
  text: string;
  conditional: boolean;
}
function xmlItems(xml: string): XmlItem[] {
  const result: XmlItem[] = [],
    stack: XmlItem[] = [];
  for (const match of xml
    .replace(/<!--[\s\S]*?-->/g, "")
    .matchAll(/<\/?[\w:.]+\b[^>]*>|[^<]+/g)) {
    const value = match[0];
    if (value.startsWith("</")) {
      stack.pop();
      continue;
    }
    if (!value.startsWith("<")) {
      if (stack.length) stack.at(-1)!.text += value;
      continue;
    }
    const name = value
      .match(/^<([\w:.]+)/)![1]
      .split(":")
      .at(-1)!;
    const attributes: Record<string, string> = {};
    for (const attribute of value.matchAll(/([\w:.]+)\s*=\s*(["'])(.*?)\2/g))
      attributes[attribute[1]] = attribute[3]
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    const item = {
      name,
      attributes,
      text: "",
      conditional: !!attributes.Condition || !!stack.at(-1)?.conditional,
    };
    result.push(item);
    if (!value.endsWith("/>")) stack.push(item);
  }
  return result;
}
function projectPath(directory: string, relative: string): string | undefined {
  if (/^(?:[A-Za-z]:|[/\\])/.test(relative) || /\$\(|@\(/.test(relative))
    return;
  const parts = directory ? directory.split("/") : [];
  for (const part of relative.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}
interface Project {
  path: string;
  directory: string;
  id: string;
  items: XmlItem[];
  sdk: boolean;
  references: string[];
  members: Set<string>;
}
interface Using {
  name: string;
  alias?: string;
  scope: string;
  global: boolean;
  static: boolean;
}
interface Declaration {
  name: string;
  full: string;
  path: string;
}
interface Reference {
  name: string;
  namespace: string;
  kind: "type" | "import";
}
interface ParsedFile {
  declarations: Declaration[];
  references: Reference[];
  usings: Using[];
}

function tokens(content: string): string[] {
  const result: string[] = [];
  let index = 0;
  while (index < content.length) {
    if (/\s/.test(content[index])) {
      index++;
      continue;
    }
    if (content.startsWith("//", index)) {
      const end = content.indexOf("\n", index);
      index = end < 0 ? content.length : end;
      continue;
    }
    if (content.startsWith("/*", index)) {
      const end = content.indexOf("*/", index + 2);
      index = end < 0 ? content.length : end + 2;
      continue;
    }
    const prefix = content.slice(index).match(/^(?:\$+@?|@\$?)?("+)|^(')/);
    if (prefix) {
      const quote = prefix[2] ?? '"',
        run = prefix[1]?.length ?? 1;
      const verbatim = prefix[0].includes("@");
      index += prefix[0].length;
      if (run === 2) continue;
      if (run >= 3) {
        const end = content.indexOf('"'.repeat(run), index);
        index = end < 0 ? content.length : end + run;
        continue;
      }
      while (index < content.length) {
        if (!verbatim && content[index] === "\\") {
          index += 2;
          continue;
        }
        if (content[index] === quote) {
          if (verbatim && content[index + 1] === quote) {
            index += 2;
            continue;
          }
          index++;
          break;
        }
        index++;
      }
      continue;
    }
    const word = content.slice(index).match(/^@?[A-Za-z_]\w*|^::/);
    if (word) {
      result.push(word[0].replace(/^@/, ""));
      index += word[0].length;
    } else result.push(content[index++]);
  }
  return result;
}
function parseCSharp(content: string, path: string): ParsedFile {
  const words = tokens(content),
    usings: Using[] = [],
    declarations: Declaration[] = [],
    references: Reference[] = [];
  const contexts: string[] = [],
    excluded = new Set<number>(),
    typeParameters = new Set<string>();
  let namespace = "",
    type = "",
    pendingNamespace: string | undefined,
    pendingType: string | undefined;
  const stack: { namespace: string; type: string }[] = [];
  const qualified = (start: number) => {
    let end = start,
      name = words[start] ?? "";
    if (name === "global" && words[start + 1] === "::") {
      end += 2;
      name = words[end] ?? "";
    }
    while (
      words[end + 1] === "." &&
      /^[A-Za-z_]\w*$/.test(words[end + 2] ?? "")
    ) {
      end += 2;
      name += `.${words[end]}`;
    }
    return { name, end };
  };
  for (let i = 0; i < words.length; i++) {
    contexts[i] = namespace;
    if (words[i] === "namespace") {
      const found = qualified(i + 1);
      const full = [namespace, found.name].filter(Boolean).join(".");
      for (let j = i; j <= found.end; j++) excluded.add(j);
      if (words[found.end + 1] === ";") namespace = full;
      else pendingNamespace = full;
    } else if (words[i] === "using" && words[i + 1] !== "(") {
      let start = i + 1;
      const isStatic = words[start] === "static";
      if (isStatic) start++;
      let alias: string | undefined;
      if (words[start + 1] === "=") {
        alias = words[start];
        start += 2;
      }
      const found = qualified(start);
      if (words[found.end + 1] === ";") {
        usings.push({
          name: found.name,
          alias,
          scope: namespace,
          global: words[i - 1] === "global",
          static: isStatic,
        });
        if (isStatic)
          references.push({ name: found.name, namespace, kind: "import" });
        for (let j = i; j <= found.end + 1; j++) excluded.add(j);
      }
    } else if (
      ["class", "struct", "interface", "enum", "record"].includes(words[i])
    ) {
      if (
        words[i - 1] === "record" ||
        words[i - 1] === ":" ||
        words[i - 1] === "where"
      )
        continue;
      const next =
        words[i] === "record" && ["class", "struct"].includes(words[i + 1])
          ? i + 2
          : i + 1;
      const name = words[next];
      if (!/^[A-Za-z_]\w*$/.test(name ?? "")) continue;
      declarations.push({
        name,
        full: [namespace, type, name].filter(Boolean).join("."),
        path,
      });
      excluded.add(next);
      pendingType = [type, name].filter(Boolean).join(".");
      if (words[next + 1] === "<")
        for (let j = next + 2; j < words.length && words[j] !== ">"; j++)
          if (/^[A-Za-z_]\w*$/.test(words[j])) typeParameters.add(words[j]);
    }
    if (words[i] === "{") {
      stack.push({ namespace, type });
      namespace = pendingNamespace ?? namespace;
      type = pendingType ?? type;
      pendingNamespace = pendingType = undefined;
    }
    if (words[i] === "}") {
      const previous = stack.pop();
      if (previous) {
        namespace = previous.namespace;
        type = previous.type;
      }
    }
    if (words[i] === ";") pendingType = undefined;
  }
  for (let i = 0; i < words.length; i++) {
    if (
      excluded.has(i) ||
      typeParameters.has(words[i]) ||
      !/^[A-Za-z_]\w*$/.test(words[i])
    )
      continue;
    if (words[i - 1] === "." || words[i - 1] === "::") continue;
    const found = qualified(i),
      before = words[i - 1],
      after = words[found.end + 1];
    const explicit =
      ["new", "as", "is", ":"].includes(before) ||
      (before === "(" &&
        ["typeof", "sizeof", "default"].includes(words[i - 2]));
    let following = found.end + 1;
    if (words[following] === "?") following++;
    while (words[following] === "[" && words[following + 1] === "]")
      following += 2;
    const declaration =
      /^[A-Za-z_]\w*$/.test(words[following] ?? "") &&
      [";", "=", "{", "(", ")", ","].includes(words[following + 1]);
    const genericArgument =
      ["<", ","].includes(before) &&
      [">", ","].includes(after) &&
      words.slice(Math.max(0, i - 8), i).includes("<");
    if (explicit || declaration || genericArgument)
      references.push({
        name: found.name,
        namespace: contexts[i] ?? "",
        kind: "type",
      });
  }
  return { declarations, references, usings };
}

export function addCSharpGraph(
  files: Map<string, string>,
  nodes: GraphNode[],
  packages: GraphPackage[],
  edges: GraphEdge[],
  diagnostics: Diagnostic[],
) {
  const code = [...files.keys()].filter((path) => /\.csx?$/i.test(path));
  const projects: Project[] = [...files.keys()]
    .filter((path) => /\.csproj$/i.test(path))
    .map((path) => {
      const items = xmlItems(files.get(path)!);
      return {
        path,
        id: `dotnet:${path}`,
        directory: dirname(path),
        items,
        sdk: items.some(
          (item) => item.name === "Project" && !!item.attributes.Sdk,
        ),
        references: [],
        members: new Set<string>(),
      };
    });
  if (!code.length && !projects.length) return;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const projectByPath = new Map(
    projects.map((project) => [project.path, project]),
  );
  let unsupported = 0,
    ambiguous = 0;
  const seen = new Set(
    edges.map((edge) => `${edge.source}\0${edge.target}\0${edge.kind}`),
  );
  const edge = (
    source: string,
    target: string,
    kind: "type" | "import",
    specifier: string,
  ) => {
    if (source === target || !byId.has(source) || !byId.has(target)) return;
    const key = `${source}\0${target}\0${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, kind, specifier });
    byId.get(source)!.outgoing++;
    byId.get(target)!.incoming++;
  };
  const external = (id: string, name: string) => {
    if (byId.has(id)) return;
    const node: GraphNode = {
      id,
      name,
      packageId: "~external",
      directory: "~external",
      kind: "external",
      lines: 0,
      exports: [],
      components: [],
      incoming: 0,
      outgoing: 0,
    };
    nodes.push(node);
    byId.set(id, node);
  };
  for (const project of projects) {
    const property = (name: string) =>
      project.items
        .find((item) => item.name === name && !item.conditional)
        ?.text.trim();
    packages.push({
      id: project.id,
      directory: project.directory,
      name:
        property("AssemblyName") ||
        project.path
          .split("/")
          .at(-1)!
          .replace(/\.csproj$/i, ""),
    });
    byId.get(project.path)!.packageId = project.id;
    const implicit =
      project.sdk &&
      property("EnableDefaultCompileItems")?.toLowerCase() !== "false" &&
      property("EnableDefaultItems")?.toLowerCase() !== "false";
    const operations = project.items.filter(
      (item) => item.name === "Compile" && !item.conditional,
    );
    for (const path of code) {
      const relative = project.directory
        ? path.slice(project.directory.length + 1)
        : path;
      let included =
        implicit &&
        (!project.directory || path.startsWith(`${project.directory}/`));
      for (const item of operations)
        for (const operation of ["Remove", "Include"] as const) {
          const patterns = item.attributes[operation]?.split(";") ?? [];
          for (const pattern of patterns) {
            if (/\$\(|@\(/.test(pattern)) continue;
            const normalized = projectPath(project.directory, pattern);
            if (normalized && minimatch(path, normalized, { dot: true }))
              included = operation === "Include";
          }
        }
      if (included && !relative.startsWith("../")) project.members.add(path);
    }
    for (const item of project.items) {
      if (item.conditional || /\$\(|@\(/.test(item.attributes.Include ?? "")) {
        unsupported++;
        continue;
      }
      const include = item.attributes.Include;
      if (!include) continue;
      if (item.name === "ProjectReference") {
        const target = projectPath(project.directory, include);
        if (target && projectByPath.has(target)) {
          project.references.push(target);
          edge(project.path, target, "import", include);
        }
      }
      if (item.name === "PackageReference") {
        external(`nuget:${include}`, include);
        edge(project.path, `nuget:${include}`, "import", include);
      }
    }
  }
  const memberships = new Map<string, Project[]>();
  for (const project of projects)
    for (const path of project.members) {
      const list = memberships.get(path) ?? [];
      list.push(project);
      memberships.set(path, list);
    }
  for (const node of nodes) {
    if (
      node.kind === "external" ||
      /\.[cm]?[jt]sx?$/.test(node.id) ||
      projectByPath.has(node.id)
    )
      continue;
    const owners =
      memberships.get(node.id) ??
      projects.filter(
        (project) =>
          !project.directory || node.id.startsWith(`${project.directory}/`),
      );
    if (owners.length === 1) node.packageId = owners[0].id;
    else if (memberships.has(node.id)) ambiguous++;
  }
  const parsed = new Map(
    code.map((path): [string, ParsedFile] => {
      const content = files.get(path)!;
      if (/^\s*#(?:if|elif|else)\b/m.test(content)) {
        unsupported++;
        return [
          path,
          { declarations: [], references: [], usings: [] },
        ] as const;
      }
      return [path, parseCSharp(content, path)];
    }),
  );
  const symbols = new Map<string, Declaration[]>();
  for (const [path, source] of parsed) {
    byId.get(path)!.exports = source.declarations.map(
      (declaration) => declaration.full,
    );
    for (const declaration of source.declarations) {
      const list = symbols.get(declaration.full) ?? [];
      list.push(declaration);
      symbols.set(declaration.full, list);
    }
  }
  const globals = new Map(
    projects.map((project) => [
      project.path,
      [...project.members].flatMap(
        (member) =>
          parsed.get(member)?.usings.filter((item) => item.global) ?? [],
      ),
    ]),
  );
  for (const [path, source] of parsed) {
    const owner = memberships.get(path);
    if (owner?.length !== 1) continue;
    const project = owner[0],
      visible = new Set([project.path, ...project.references]);
    const globalUsings = globals.get(project.path) ?? [];
    for (const reference of source.references) {
      const applicable = [...source.usings, ...globalUsings].filter(
        (item) =>
          !item.scope ||
          reference.namespace === item.scope ||
          reference.namespace.startsWith(`${item.scope}.`),
      );
      const names = new Set<string>([reference.name]);
      for (const item of applicable) {
        if (item.alias) {
          if (reference.name === item.alias) names.add(item.name);
          else if (reference.name.startsWith(`${item.alias}.`))
            names.add(item.name + reference.name.slice(item.alias.length));
        } else if (!item.static) names.add(`${item.name}.${reference.name}`);
      }
      let namespace = reference.namespace;
      while (namespace) {
        names.add(`${namespace}.${reference.name}`);
        namespace = namespace.slice(0, Math.max(0, namespace.lastIndexOf(".")));
      }
      const candidates = new Set<string>();
      for (const name of names)
        for (const declaration of symbols.get(name) ?? [])
          if (
            memberships
              .get(declaration.path)
              ?.some((member) => visible.has(member.path))
          )
            candidates.add(declaration.path);
      if (candidates.size === 1)
        edge(path, [...candidates][0], reference.kind, reference.name);
      else if (candidates.size > 1) ambiguous++;
    }
  }
  for (const [path, content] of files) {
    if (!/\.slnx?$/i.test(path)) continue;
    const references = /\.slnx$/i.test(path)
      ? xmlItems(content)
          .filter((item) => item.name === "Project")
          .map((item) => item.attributes.Path)
      : [...content.matchAll(/"([^"\r\n]+\.csproj)"/gi)].map(
          (match) => match[1],
        );
    for (const reference of references)
      if (reference) {
        const target = projectPath(dirname(path), reference);
        if (target) edge(path, target, "import", reference);
      }
  }
  diagnostics.push({
    path: "",
    message: `C# analysis is conservative: explicit project/NuGet references and uniquely resolved type declarations only; Files without unique authored project membership remain static; Unity asmdef resolution, MSBuild imports, conditional items, preprocessor branches, reflection and ambiguous symbols are not evaluated. ${unsupported} conditional/dynamic items and ${ambiguous} ambiguous memberships/references were left unresolved.`,
  });
}
