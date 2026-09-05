export type FileKind =
  | "component"
  | "module"
  | "service"
  | "schema"
  | "test"
  | "config"
  | "external";
export type EdgeKind = "import" | "type" | "dynamic" | "reexport" | "component";
export interface SourceFile {
  path: string;
  content: string;
}
export interface GraphNode {
  id: string;
  name: string;
  packageId: string;
  directory: string;
  kind: FileKind;
  lines: number;
  exports: string[];
  components: string[];
  incoming: number;
  outgoing: number;
}
export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  specifier: string;
}
export interface GraphPackage {
  id: string;
  name: string;
  directory: string;
}
export interface Diagnostic {
  path: string;
  message: string;
}
export interface ProjectGraph {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  packages: GraphPackage[];
  diagnostics: Diagnostic[];
  cycles: string[][];
  seed: number;
  scan?: ScanSummary;
}
export interface ScanSummary {
  files: number;
  bytes: number;
  omittedFiles: number;
  omittedDirectories: number;
  reasons: Record<string, number>;
}
export const ignoredDirectories = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  ".cache",
  "dist",
  "build",
  "coverage",
  "vendor",
  "out",
  "storybook-static",
  "playwright-report",
  "test-results",
  "_generated",
]);
export function normalize(path: string): string {
  const result: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") result.pop();
    else result.push(part);
  }
  return result.join("/");
}
export function dirname(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf("/")));
}
export function isProjectFile(path: string): boolean {
  if (
    path
      .split("/")
      .some((part) => ignoredDirectories.has(part) || part.startsWith("."))
  )
    return false;
  const name = path.split("/").at(-1)!.toLowerCase();
  if (
    /^(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|packages\.lock\.json|bun\.lockb?|cargo\.lock|poetry\.lock)$/.test(
      name,
    )
  )
    return false;
  if (/^(?:credentials?|secrets?)(?:[.-]|$)|^(?:id_rsa|id_ed25519)$/.test(name))
    return false;
  return !/\.(?:png|jpe?g|gif|webp|ico|bmp|tiff?|psd|exr|hdr|mp[34]|wav|ogg|flac|mov|webm|avi|pdf|zip|gz|7z|rar|tar|dll|exe|pdb|so|dylib|a|o|class|jar|wasm|woff2?|ttf|otf|eot|fbx|blend|unitypackage|nupkg|snupkg|db|sqlite3?|cache|meta|pem|key|pfx|p12|keystore|suo|user|map)$/i.test(
    name,
  );
}
export function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++)
    value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}
