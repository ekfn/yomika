import { mkdir, readdir, rename } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JsonFileService } from "./json-file.service";
import {
  bookJsonSchema,
  pageJsonSchema,
  type BookJson,
  type PageJson,
} from "./library-schemas";
import { LibraryPathsService } from "./library-paths.service";

const BOOK_DIRECTORY_PREFIX = "book.";
const PAGE_DIRECTORY_PREFIX = "page.";
const BOOK_JSON_FILE_NAME = "book.json";
const PAGE_JSON_FILE_NAME = "page.json";
const BOOK_SOURCE_DIRECTORY_NAME = "source";
const PAGE_DIRECTORY_NUMBER_WIDTH = 4;

export type FolderRecord = {
  path: string;
};

export type BookRecord = {
  path: string;
  parentPath: string | null;
  book: BookJson;
  bookDir: string;
  jsonPath: string;
  relativeJsonPath: string;
};

export type PageRecord = {
  path: string;
  parentPath: string | null;
  bookPath: string | null;
  page: PageJson;
  pageDir: string;
  jsonPath: string;
  relativeJsonPath: string;
};

@Injectable()
export class LibraryRepository {
  constructor(
    private readonly paths: LibraryPathsService,
    private readonly jsonFiles: JsonFileService,
  ) {}

  async ensureLibraryRoots(): Promise<void> {
    await mkdir(this.paths.getLibraryDir(), { recursive: true });
  }

  async listFolders(): Promise<FolderRecord[]> {
    return this.listFolderRecords();
  }

  async listFolderRecords(): Promise<FolderRecord[]> {
    const records = await this.listFolderRecordsUnder(
      this.paths.getLibraryDir(),
      null,
    );

    return records.sort(compareFolderRecords);
  }

  async listChildFolderRecords(
    parentPath: string | null,
  ): Promise<FolderRecord[]> {
    const directoryNames = await this.listDirectoryNames(
      this.getParentLibraryDirectory(parentPath),
    );
    const records = await Promise.all(
      directoryNames
        .filter((directoryName) => !isSpecialDirectoryName(directoryName))
        .map((directoryName) =>
          this.readFolderRecord(joinLibraryPath(parentPath, directoryName)),
        ),
    );

    return records.sort(compareFolderRecords);
  }

  async getFolderByPath(folderPath: string): Promise<FolderRecord> {
    try {
      return await this.readFolderRecord(folderPath);
    } catch (error) {
      if (isFileNotFoundError(error)) {
        throw new NotFoundException(`Folder ${folderPath} was not found.`);
      }
      throw error;
    }
  }

  async createFolder(folderPath: string): Promise<FolderRecord> {
    try {
      await mkdir(this.getLibraryDirectory(folderPath));
    } catch (error) {
      if (isFileAlreadyExistsError(error)) {
        throw new BadRequestException(`Folder ${folderPath} already exists.`);
      }
      if (isFileNotFoundError(error)) {
        throw new NotFoundException(
          `Parent folder ${getParentPath(folderPath) ?? ""} was not found.`,
        );
      }
      throw error;
    }

    return this.readFolderRecord(folderPath);
  }

  async listBooks(): Promise<BookRecord[]> {
    return this.listBookRecords();
  }

  async listBookRecords(): Promise<BookRecord[]> {
    const records = await this.listBookRecordsUnder(
      this.paths.getLibraryDir(),
      null,
    );

    return records.sort((left, right) =>
      right.book.createdAt.localeCompare(left.book.createdAt),
    );
  }

  async listChildBookRecords(parentPath: string | null): Promise<BookRecord[]> {
    const directoryNames = await this.listDirectoryNames(
      this.getParentLibraryDirectory(parentPath),
    );
    const records = await Promise.all(
      directoryNames
        .filter(isBookDirectoryName)
        .map((directoryName) =>
          this.readBookRecord(joinLibraryPath(parentPath, directoryName)),
        ),
    );

    return records.sort((left, right) =>
      right.book.createdAt.localeCompare(left.book.createdAt),
    );
  }

  async getBookByPath(bookPath: string): Promise<BookRecord> {
    try {
      return await this.readBookRecord(bookPath);
    } catch (error) {
      if (isFileNotFoundError(error)) {
        throw new NotFoundException(`Book ${bookPath} was not found.`);
      }
      throw error;
    }
  }

  async createBookDirectory(bookPath: string): Promise<string> {
    await this.createSpecialDirectory(bookPath, "Book");
    return this.getLibraryDirectory(bookPath);
  }

  async moveBook(bookPath: string, nextBookPath: string): Promise<BookRecord> {
    await this.moveSpecialDirectory(bookPath, nextBookPath, "Book");
    return this.readBookRecord(nextBookPath);
  }

  async writeBook(bookPath: string, book: BookJson): Promise<void> {
    await this.jsonFiles.writeJsonFileAtomically(
      this.getBookJsonPath(bookPath),
      book,
    );
  }

  async listAllPageRecords(): Promise<PageRecord[]> {
    const records = await this.listPageRecordsUnder(
      this.paths.getLibraryDir(),
      null,
    );

    return this.sortPageRecords(records);
  }

  async listAllPages(): Promise<PageRecord[]> {
    return this.listAllPageRecords();
  }

  async listChildStandalonePageRecords(
    parentPath: string | null,
  ): Promise<PageRecord[]> {
    const directoryNames = await this.listDirectoryNames(
      this.getParentLibraryDirectory(parentPath),
    );
    const records = await Promise.all(
      directoryNames
        .filter(isPageDirectoryName)
        .map((directoryName) =>
          this.readPageRecord(joinLibraryPath(parentPath, directoryName)),
        ),
    );

    return this.sortPageRecords(records);
  }

  async listBookPageRecords(bookPath: string): Promise<PageRecord[]> {
    const bookDir = this.getLibraryDirectory(bookPath);
    const pageDirectoryNames = (await this.listDirectoryNames(bookDir)).filter(
      isPageDirectoryName,
    );
    const records = await Promise.all(
      pageDirectoryNames.map((pageDirectoryName) =>
        this.readPageRecord(joinLibraryPath(bookPath, pageDirectoryName)),
      ),
    );

    return this.sortPageRecords(records);
  }

  async getPageByPath(pagePath: string): Promise<PageRecord> {
    try {
      return await this.readPageRecord(pagePath);
    } catch (error) {
      if (isFileNotFoundError(error)) {
        throw new NotFoundException(`Page ${pagePath} was not found.`);
      }
      throw error;
    }
  }

  async createPageDirectory(pagePath: string): Promise<string> {
    await this.createSpecialDirectory(pagePath, "Page");
    return this.getLibraryDirectory(pagePath);
  }

  async movePage(pagePath: string, nextPagePath: string): Promise<PageRecord> {
    await this.moveSpecialDirectory(pagePath, nextPagePath, "Page");
    return this.readPageRecord(nextPagePath);
  }

  async writePage(pagePath: string, page: PageJson): Promise<void> {
    await this.jsonFiles.writeJsonFileAtomically(
      this.getPageJsonPath(pagePath),
      page,
    );
  }

  getFolderPathForCreate(parentPath: string | null, name: string): string {
    return joinLibraryPath(parentPath, name);
  }

  getBookPathForCreate(parentPath: string | null, name: string): string {
    return joinLibraryPath(parentPath, `${BOOK_DIRECTORY_PREFIX}${name}`);
  }

  getStandalonePagePathForCreate(
    parentPath: string | null,
    name: string,
  ): string {
    return joinLibraryPath(parentPath, `${PAGE_DIRECTORY_PREFIX}${name}`);
  }

  getBookPagePathForCreate(bookPath: string, pageNumber: number): string {
    return joinLibraryPath(
      bookPath,
      `${PAGE_DIRECTORY_PREFIX}${formatPageDirectoryNumber(pageNumber)}`,
    );
  }

  getBookDirectoryForCreate(bookPath: string): string {
    return this.getLibraryDirectory(bookPath);
  }

  getPageDirectoryForCreate(pagePath: string): string {
    return this.getLibraryDirectory(pagePath);
  }

  getBookSourcePdfUrl(record: BookRecord): string | null {
    if (!record.book.sourcePdf) {
      return null;
    }

    return this.paths.toMediaUrl(
      join(
        record.path,
        BOOK_SOURCE_DIRECTORY_NAME,
        record.book.sourcePdf.fileName,
      ),
    );
  }

  getBookSourcePdfPath(record: BookRecord): string | null {
    if (!record.book.sourcePdf) {
      return null;
    }

    return this.paths.assertInsideLibrary(
      join(
        record.bookDir,
        BOOK_SOURCE_DIRECTORY_NAME,
        record.book.sourcePdf.fileName,
      ),
    );
  }

  getPageSourceImageUrl(record: PageRecord): string {
    return this.paths.toMediaUrl(
      join(record.path, record.page.sourceImage.fileName),
    );
  }

  getPageSourceImagePath(record: PageRecord): string {
    return this.paths.assertInsideLibrary(
      join(record.pageDir, record.page.sourceImage.fileName),
    );
  }

  getPagePreviewImageUrl(record: PageRecord): string | null {
    if (!record.page.sourceImage.previewFileName) {
      return null;
    }

    return this.paths.toMediaUrl(
      join(record.path, record.page.sourceImage.previewFileName),
    );
  }

  private async createSpecialDirectory(
    entityPath: string,
    entityName: string,
  ): Promise<void> {
    try {
      await mkdir(this.getLibraryDirectory(entityPath));
    } catch (error) {
      if (isFileAlreadyExistsError(error)) {
        throw new BadRequestException(
          `${entityName} ${entityPath} already exists.`,
        );
      }
      if (isFileNotFoundError(error)) {
        throw new NotFoundException(
          `Parent folder ${getParentPath(entityPath) ?? ""} was not found.`,
        );
      }
      throw error;
    }
  }

  private async moveSpecialDirectory(
    entityPath: string,
    nextEntityPath: string,
    entityName: string,
  ): Promise<void> {
    try {
      await rename(
        this.getLibraryDirectory(entityPath),
        this.getLibraryDirectory(nextEntityPath),
      );
    } catch (error) {
      if (isFileAlreadyExistsError(error)) {
        throw new BadRequestException(
          `${entityName} ${nextEntityPath} already exists.`,
        );
      }
      if (isFileNotFoundError(error)) {
        throw new NotFoundException(
          `${entityName} ${entityPath} was not found.`,
        );
      }
      throw error;
    }
  }

  private async listFolderRecordsUnder(
    directoryPath: string,
    parentPath: string | null,
  ): Promise<FolderRecord[]> {
    const directoryNames = await this.listDirectoryNames(directoryPath);
    const nestedRecords = await Promise.all(
      directoryNames.map(async (directoryName) => {
        if (isSpecialDirectoryName(directoryName)) {
          return [];
        }

        const folderPath = joinLibraryPath(parentPath, directoryName);
        const folderDirectory = this.getLibraryDirectory(folderPath);
        const childRecords = await this.listFolderRecordsUnder(
          folderDirectory,
          folderPath,
        );

        return [await this.readFolderRecord(folderPath), ...childRecords];
      }),
    );

    return nestedRecords.flat();
  }

  private async listBookRecordsUnder(
    directoryPath: string,
    parentPath: string | null,
  ): Promise<BookRecord[]> {
    const directoryNames = await this.listDirectoryNames(directoryPath);
    const nestedRecords = await Promise.all(
      directoryNames.map(async (directoryName) => {
        const childPath = joinLibraryPath(parentPath, directoryName);

        if (isBookDirectoryName(directoryName)) {
          return [await this.readBookRecord(childPath)];
        }

        if (isPageDirectoryName(directoryName)) {
          return [];
        }

        return this.listBookRecordsUnder(
          this.getLibraryDirectory(childPath),
          childPath,
        );
      }),
    );

    return nestedRecords.flat();
  }

  private async listPageRecordsUnder(
    directoryPath: string,
    parentPath: string | null,
  ): Promise<PageRecord[]> {
    const directoryNames = await this.listDirectoryNames(directoryPath);
    const nestedRecords = await Promise.all(
      directoryNames.map(async (directoryName) => {
        const childPath = joinLibraryPath(parentPath, directoryName);

        if (isBookDirectoryName(directoryName)) {
          return this.listBookPageRecords(childPath);
        }

        if (isPageDirectoryName(directoryName)) {
          return [await this.readPageRecord(childPath)];
        }

        return this.listPageRecordsUnder(
          this.getLibraryDirectory(childPath),
          childPath,
        );
      }),
    );

    return nestedRecords.flat();
  }

  private async readFolderRecord(folderPath: string): Promise<FolderRecord> {
    const normalizedFolderPath = normalizeLibraryPath(folderPath);
    const directoryName = getPathBasename(normalizedFolderPath);

    if (isSpecialDirectoryName(directoryName)) {
      throw new BadRequestException(
        `${normalizedFolderPath} is a special library directory.`,
      );
    }

    const folderDir = this.getLibraryDirectory(normalizedFolderPath);
    await this.listDirectoryNames(folderDir);

    return {
      path: normalizedFolderPath,
    };
  }

  private async readBookRecord(bookPath: string): Promise<BookRecord> {
    const normalizedBookPath = normalizeLibraryPath(bookPath);
    const directoryName = getPathBasename(normalizedBookPath);

    if (!isBookDirectoryName(directoryName)) {
      throw new BadRequestException(`${normalizedBookPath} is not a book.`);
    }

    const bookDir = this.getLibraryDirectory(normalizedBookPath);
    const jsonPath = this.getBookJsonPath(normalizedBookPath);

    return {
      path: normalizedBookPath,
      parentPath: getParentPath(normalizedBookPath),
      book: await this.jsonFiles.readJsonFile(
        jsonPath,
        bookJsonSchema,
        this.paths.getRelativeLibraryPath(jsonPath),
      ),
      bookDir,
      jsonPath,
      relativeJsonPath: this.paths.getRelativeLibraryPath(jsonPath),
    };
  }

  private async readPageRecord(pagePath: string): Promise<PageRecord> {
    const normalizedPagePath = normalizeLibraryPath(pagePath);
    const directoryName = getPathBasename(normalizedPagePath);

    if (!isPageDirectoryName(directoryName)) {
      throw new BadRequestException(`${normalizedPagePath} is not a page.`);
    }

    const pageDir = this.getLibraryDirectory(normalizedPagePath);
    const jsonPath = this.getPageJsonPath(normalizedPagePath);
    const parentPath = getParentPath(normalizedPagePath);
    const bookPath =
      parentPath && isBookDirectoryName(getPathBasename(parentPath))
        ? parentPath
        : null;

    return {
      path: normalizedPagePath,
      parentPath,
      bookPath,
      page: await this.jsonFiles.readJsonFile(
        jsonPath,
        pageJsonSchema,
        this.paths.getRelativeLibraryPath(jsonPath),
      ),
      pageDir,
      jsonPath,
      relativeJsonPath: this.paths.getRelativeLibraryPath(jsonPath),
    };
  }

  private getBookJsonPath(bookPath: string): string {
    return join(this.getLibraryDirectory(bookPath), BOOK_JSON_FILE_NAME);
  }

  private getPageJsonPath(pagePath: string): string {
    return join(this.getLibraryDirectory(pagePath), PAGE_JSON_FILE_NAME);
  }

  private getLibraryDirectory(libraryPath: string): string {
    const normalizedLibraryPath = normalizeLibraryPath(libraryPath);
    const resolvedLibraryDir = resolve(this.paths.getLibraryDir());
    const resolvedDirectory = resolve(
      resolvedLibraryDir,
      ...normalizedLibraryPath.split("/"),
    );

    if (
      resolvedDirectory === resolvedLibraryDir ||
      !resolvedDirectory.startsWith(`${resolvedLibraryDir}${sep}`)
    ) {
      throw new BadRequestException("Unsafe library path.");
    }

    return resolvedDirectory;
  }

  private getParentLibraryDirectory(parentPath: string | null): string {
    return parentPath
      ? this.getLibraryDirectory(parentPath)
      : this.paths.getLibraryDir();
  }

  private async listDirectoryNames(path: string): Promise<string[]> {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }

  private sortPageRecords(records: PageRecord[]): PageRecord[] {
    return [...records].sort((left, right) => {
      const leftPageNumber = left.page.pageNumber;
      const rightPageNumber = right.page.pageNumber;

      if (left.bookPath && right.bookPath && left.bookPath === right.bookPath) {
        return (leftPageNumber ?? 0) - (rightPageNumber ?? 0);
      }

      return right.page.createdAt.localeCompare(left.page.createdAt);
    });
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isFileAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

function normalizeLibraryPath(libraryPath: string): string {
  const trimmedPath = libraryPath.trim();

  if (
    !trimmedPath ||
    trimmedPath.startsWith("/") ||
    trimmedPath.startsWith("\\")
  ) {
    throw new BadRequestException("Unsafe library path.");
  }

  const pathParts = trimmedPath.split(/[\\/]+/);

  if (
    pathParts.some(
      (pathPart) => !pathPart || pathPart === "." || pathPart === "..",
    )
  ) {
    throw new BadRequestException("Unsafe library path.");
  }

  return pathParts.join("/");
}

function joinLibraryPath(
  parentPath: string | null | undefined,
  directoryName: string,
): string {
  if (!parentPath) {
    return directoryName;
  }

  return `${normalizeLibraryPath(parentPath)}/${directoryName}`;
}

function getParentPath(libraryPath: string): string | null {
  const normalizedPath = normalizeLibraryPath(libraryPath);
  const pathParts = normalizedPath.split("/");

  if (pathParts.length <= 1) {
    return null;
  }

  return pathParts.slice(0, -1).join("/");
}

function getPathBasename(libraryPath: string): string {
  return basename(normalizeLibraryPath(libraryPath));
}

function isBookDirectoryName(directoryName: string): boolean {
  return directoryName.startsWith(BOOK_DIRECTORY_PREFIX);
}

function isPageDirectoryName(directoryName: string): boolean {
  return directoryName.startsWith(PAGE_DIRECTORY_PREFIX);
}

function isSpecialDirectoryName(directoryName: string): boolean {
  return (
    isBookDirectoryName(directoryName) || isPageDirectoryName(directoryName)
  );
}

function compareFolderRecords(left: FolderRecord, right: FolderRecord): number {
  return left.path.localeCompare(right.path, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function formatPageDirectoryNumber(pageNumber: number): string {
  return String(pageNumber).padStart(PAGE_DIRECTORY_NUMBER_WIDTH, "0");
}
