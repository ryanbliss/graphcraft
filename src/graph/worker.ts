import { analyzeProject } from "./analyze.ts";
import type { SourceFile, ScanSummary } from "./types.ts";
self.onmessage = (
  event: MessageEvent<{
    files: SourceFile[];
    name: string;
    omittedPaths?: string[];
    repositoryRoots?: string[];
    scan?: ScanSummary;
  }>,
) => {
  try {
    self.postMessage({
      graph: analyzeProject(event.data.files, event.data.name, event.data),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
