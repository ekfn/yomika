import { Injectable } from "@nestjs/common";
import { BooksService, type BookOutput } from "@/books/books.service";
import { FoldersService, type FolderOutput } from "@/folders/folders.service";
import { PagesService, type PageOutput } from "@/pages/pages.service";

export type LibraryFolderContentsInput = {
  parentPath?: string | null;
};

export type LibraryFolderContentsOutput = {
  parentPath: string | null;
  folders: FolderOutput[];
  books: BookOutput[];
  pages: PageOutput[];
};

@Injectable()
export class LibraryContentsService {
  constructor(
    private readonly foldersService: FoldersService,
    private readonly booksService: BooksService,
    private readonly pagesService: PagesService,
  ) {}

  async getFolderContents(
    parentPath?: string | null,
  ): Promise<LibraryFolderContentsOutput> {
    const normalizedParentPath = parentPath ?? null;
    const [folders, books, pages] = await Promise.all([
      this.foldersService.listFolders(normalizedParentPath),
      this.booksService.listBooks(normalizedParentPath),
      this.pagesService.listPages(normalizedParentPath),
    ]);

    return {
      parentPath: normalizedParentPath,
      folders,
      books,
      pages,
    };
  }

  async getFolderContentsBatch(
    input: readonly LibraryFolderContentsInput[],
  ): Promise<LibraryFolderContentsOutput[]> {
    return Promise.all(
      input.map((item) => this.getFolderContents(item.parentPath)),
    );
  }
}
