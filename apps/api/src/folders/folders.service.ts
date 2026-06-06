import { BadRequestException, Injectable } from "@nestjs/common";
import { validatePlainDirectoryName } from "@/library/library-directory-names";
import { LibraryRepository } from "@/library/library.repository";

type CreateFolderInput = {
  name: string;
  parentPath?: string | null;
};

export type FolderOutput = {
  path: string;
};

@Injectable()
export class FoldersService {
  constructor(private readonly libraryRepository: LibraryRepository) {}

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
