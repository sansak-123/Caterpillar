/**
 * Jest manual mock for `expo-file-system`'s new class-based File/Directory/Paths API.
 * There's no real filesystem to hit in Jest's Node environment, so this fakes just
 * enough (path joining, an in-memory "downloaded" ledger, exists/create semantics) to
 * verify lib/assets/downloadManager.ts's own orchestration logic — which version gets
 * skipped vs. re-downloaded, which real network calls it makes — not expo-file-system
 * itself.
 */

function joinUri(parts: Array<string | { uri: string }>): string {
  const segments = parts.map((p) => (typeof p === "string" ? p : p.uri.replace(/^mock:\/\//, "")));
  return `mock://${segments.filter(Boolean).join("/")}`;
}

const downloadedUrls: string[] = [];
const existingUris = new Set<string>();

export class MockDirectory {
  uri: string;
  constructor(...parts: Array<string | MockDirectory | MockFile>) {
    this.uri = joinUri(parts as never);
  }
  get exists(): boolean {
    return existingUris.has(this.uri);
  }
  create(): void {
    existingUris.add(this.uri);
  }
}

export class MockFile {
  uri: string;
  constructor(...parts: Array<string | MockDirectory | MockFile>) {
    this.uri = joinUri(parts as never);
  }
  get exists(): boolean {
    return existingUris.has(this.uri);
  }
  static async downloadFileAsync(
    url: string,
    destination: MockFile | MockDirectory
  ): Promise<MockFile> {
    downloadedUrls.push(url);
    const file = destination instanceof MockFile ? destination : new MockFile(destination, "downloaded");
    existingUris.add(file.uri);
    return file;
  }
}

export class MockPaths {
  static get document(): MockDirectory {
    return new MockDirectory("document");
  }
}

export function _getMockDownloadedUrls(): string[] {
  return [...downloadedUrls];
}

export function _resetMockFileSystem(): void {
  downloadedUrls.length = 0;
  existingUris.clear();
}

export { MockDirectory as Directory, MockFile as File, MockPaths as Paths };
