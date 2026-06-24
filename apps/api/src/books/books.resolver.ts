import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@/auth/auth.guard";
import { BooksService, type BookOutput } from "./books.service";

type CreateBookInput = {
  name: string;
  parentPath?: string | null;
  sourceUploadId: string;
  settings?: {
    translationSourceLanguages?: string[] | null;
    translationTargetLanguage?: string | null;
    aiProcessingEnabled?: boolean | null;
    vocabularyEnabled?: boolean | null;
  } | null;
};

type UpdateBookInput = {
  name?: string | null;
  settings?: {
    translationSourceLanguages?: string[] | null;
    translationTargetLanguage?: string | null;
    aiProcessingEnabled?: boolean | null;
    vocabularyEnabled?: boolean | null;
  } | null;
};

type MoveBookInput = {
  targetParentPath?: string | null;
};

@Resolver()
@UseGuards(AuthGuard)
export class BooksResolver {
  constructor(private readonly booksService: BooksService) {}

  @Query("books")
  books(
    @Args("parentPath", { nullable: true }) parentPath?: string | null,
  ): Promise<BookOutput[]> {
    return this.booksService.listBooks(parentPath);
  }

  @Query("book")
  book(@Args("path") path: string): Promise<BookOutput> {
    return this.booksService.getBook(path);
  }

  @Mutation("createBook")
  createBook(@Args("input") input: CreateBookInput): Promise<BookOutput> {
    return this.booksService.createBook(input);
  }

  @Mutation("updateBook")
  updateBook(
    @Args("path") path: string,
    @Args("input") input: UpdateBookInput,
  ): Promise<BookOutput> {
    return this.booksService.updateBook(path, input);
  }

  @Mutation("moveBook")
  moveBook(
    @Args("path") path: string,
    @Args("input") input: MoveBookInput,
  ): Promise<BookOutput> {
    return this.booksService.moveBook(path, input);
  }
}
