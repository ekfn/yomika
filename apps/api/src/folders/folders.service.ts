import { BadRequestException, Injectable } from "@nestjs/common";
import {
  getFolderDisplayName,
  getLibraryPathParent,
  isSameOrDescendantPath,
  validatePlainDirectoryName,
} from "@/library/library-directory-names";
import { LibraryRepository } from "@/library/library.repository";
import { RunnerStateService } from "@/runner/runner-state.service";

type CreateFolderInput = {
  name: string;
  parentPath?: string | null;
};

type UpdateFolderInput = {
  name: string;
};

type MoveFolderInput = {
  targetParentPath?: string | null;
};

export type FolderOutput = {
  path: string;
};

@Injectable()
export class FoldersService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly runnerState: RunnerStateService,
  ) {}

  async listFolders(parentPath?: string | null): Promise<FolderOutput[]> {
    if (parentPath !== undefined) {
      await this.assertFolderExists(parentPath);

      return (
        await this.libraryRepository.listChildFolderRecords(parentPath)
      ).map((folder) => this.toFolderOutput(folder.path));
    }

    return (await this.libraryRepository.listFolders()).map((folder) =>
      this.toFolderOutput(folder.path),
    );
  }

  async getFolder(path: string): Promise<FolderOutput> {
    return this.toFolderOutput(
      (await this.libraryRepository.getFolderByPath(path)).path,
    );
  }

  async createFolder(input: CreateFolderInput): Promise<FolderOutput> {
    const name = normalizeDirectoryName(input.name);
    const parentPath = input.parentPath ?? null;

    if (parentPath) {
      await this.libraryRepository.getFolderByPath(parentPath);
    }

    return this.toFolderOutput(
      (
        await this.libraryRepository.createFolder(
          this.libraryRepository.getFolderPathForCreate(parentPath, name),
        )
      ).path,
    );
  }

  async updateFolder(
    path: string,
    input: UpdateFolderInput,
  ): Promise<FolderOutput> {
    this.assertRunnerIsIdle(
      "Wait until the runner finishes or stop it before renaming library items.",
    );

    const record = await this.libraryRepository.getFolderByPath(path);
    const parentPath = getLibraryPathParent(record.path);
    const nextFolderPath = this.libraryRepository.getFolderPathForCreate(
      parentPath,
      normalizeDirectoryName(input.name),
    );

    if (nextFolderPath === record.path) {
      return this.toFolderOutput(record.path);
    }

    return this.toFolderOutput(
      (await this.libraryRepository.moveFolder(record.path, nextFolderPath))
        .path,
    );
  }

  async moveFolder(
    path: string,
    input: MoveFolderInput,
  ): Promise<FolderOutput> {
    this.assertRunnerIsIdle(
      "Wait until the runner finishes or stop it before moving library items.",
    );

    const record = await this.libraryRepository.getFolderByPath(path);
    const targetParentPath = input.targetParentPath ?? null;

    if (
      targetParentPath &&
      isSameOrDescendantPath(targetParentPath, record.path)
    ) {
      throw new BadRequestException(
        "Folder cannot be moved into itself or a nested folder.",
      );
    }

    await this.assertFolderExists(targetParentPath);

    const nextFolderPath = this.libraryRepository.getFolderPathForCreate(
      targetParentPath,
      getFolderDisplayName(record.path),
    );

    if (nextFolderPath === record.path) {
      return this.toFolderOutput(record.path);
    }

    return this.toFolderOutput(
      (await this.libraryRepository.moveFolder(record.path, nextFolderPath))
        .path,
    );
  }

  async assertFolderExists(
    folderPath: string | null | undefined,
  ): Promise<void> {
    if (!folderPath) {
      return;
    }

    await this.libraryRepository.getFolderByPath(folderPath);
  }

  private toFolderOutput(path: string): FolderOutput {
    return { path };
  }

  private assertRunnerIsIdle(message: string): void {
    if (this.runnerState.isRunning()) {
      throw new BadRequestException(message);
    }
  }
}

function normalizeDirectoryName(name: string): string {
  const normalizedName = validatePlainDirectoryName(name);

  if (!normalizedName) {
    throw new BadRequestException(
      "Folder name must be a plain directory name without a book. or page. prefix.",
    );
  }

  return normalizedName;
}
