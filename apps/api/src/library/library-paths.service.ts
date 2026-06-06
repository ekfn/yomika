import { join, relative, resolve, sep } from "node:path";
import { Injectable } from "@nestjs/common";
import { loadAppConfig } from "@/config/app-config";

@Injectable()
export class LibraryPathsService {
  private readonly config = loadAppConfig();

  getLibraryDir(): string {
    return this.config.libraryDir;
  }

  getRunnerStateDir(): string {
    return this.config.runnerStateDir;
  }

  getRunnerOperationLogPath(): string {
    return join(this.config.runnerStateDir, "operations.log");
  }

  getRunnerPreviousOperationLogPath(): string {
    return join(this.config.runnerStateDir, "operations.previous.log");
  }

  getRelativeLibraryPath(path: string): string {
    return relative(this.config.libraryDir, path);
  }

  getRelativeRunnerPath(path: string): string {
    return relative(this.config.runnerStateDir, path);
  }

  toMediaUrl(libraryRelativePath: string): string {
    return `/media/${libraryRelativePath
      .split(sep)
      .map((part) => encodeURIComponent(part))
      .join("/")}`;
  }

  assertInsideLibrary(path: string): string {
    const resolvedPath = resolve(path);
    const resolvedLibraryDir = resolve(this.config.libraryDir);

    if (
      resolvedPath !== resolvedLibraryDir &&
      !resolvedPath.startsWith(`${resolvedLibraryDir}${sep}`)
    ) {
      throw new Error("Resolved path is outside the library directory.");
    }

    return resolvedPath;
  }
}
