import * as ExpoFileSystem from "expo-file-system";

/** Same pattern as lib/db/testHelpers.ts and lib/storage/testHelpers.ts — the real
 * expo-file-system has no `_getMockDownloadedUrls`/`_resetMockFileSystem` exports; they
 * only exist on the Jest manual mock. One typed cast here instead of `as any` per test. */
type MockableFileSystem = typeof ExpoFileSystem & {
  _getMockDownloadedUrls?: () => string[];
  _resetMockFileSystem?: () => void;
};

export function getMockDownloadedUrls(): string[] {
  return (ExpoFileSystem as MockableFileSystem)._getMockDownloadedUrls?.() ?? [];
}

export function resetMockFileSystem(): void {
  (ExpoFileSystem as MockableFileSystem)._resetMockFileSystem?.();
}
