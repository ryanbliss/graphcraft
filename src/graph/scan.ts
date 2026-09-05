import { SourceFilter, contentOmission } from "./discovery.ts";
import type { ScanSummary, SourceFile } from "./types.ts";

export class SourceScan {
  readonly filter = new SourceFilter();
  readonly files: SourceFile[] = [];
  readonly omittedPaths: string[] = [];
  readonly summary: ScanSummary = {
    files: 0,
    bytes: 0,
    omittedFiles: 0,
    omittedDirectories: 0,
    reasons: {},
  };
  omit(path: string, reason: string, directory = false) {
    this.omittedPaths.push(path);
    if (directory) this.summary.omittedDirectories++;
    else this.summary.omittedFiles++;
    this.summary.reasons[reason] = (this.summary.reasons[reason] ?? 0) + 1;
  }
  async accept(path: string, size: number, read: () => Promise<string>) {
    if (!this.filter.includes(path)) {
      this.omit(path, "ignored or unsupported");
      return;
    }
    if (size > 4 * 1024 * 1024) {
      this.omit(path, "over 4 MB");
      return;
    }
    if (this.summary.bytes + size > 256 * 1024 * 1024)
      throw new Error(
        "Project text exceeds the 256 MB scan limit. Choose a smaller workspace or package.",
      );
    if (this.files.length >= 30000)
      throw new Error(
        "Project exceeds the 30,000 text-file scan limit. Choose a smaller workspace or package.",
      );
    this.summary.bytes += size;
    const file = { path, content: await read() };
    const reason = contentOmission(file);
    if (reason) {
      this.omit(path, reason);
      return;
    }
    this.files.push(file);
    this.summary.files++;
  }
}
