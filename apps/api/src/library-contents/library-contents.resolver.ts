import { UseGuards } from "@nestjs/common";
import { Args, Query, Resolver } from "@nestjs/graphql";
import { AuthGuard } from "@/auth/auth.guard";
import {
  LibraryContentsService,
  type LibraryFolderContentsInput,
  type LibraryFolderContentsOutput,
} from "./library-contents.service";

@Resolver()
@UseGuards(AuthGuard)
export class LibraryContentsResolver {
  constructor(
    private readonly libraryContentsService: LibraryContentsService,
  ) {}

  @Query("libraryFolderContents")
  libraryFolderContents(
    @Args("parentPath", { nullable: true }) parentPath?: string | null,
  ): Promise<LibraryFolderContentsOutput> {
    return this.libraryContentsService.getFolderContents(parentPath);
  }

  @Query("libraryFolderContentsBatch")
  libraryFolderContentsBatch(
    @Args("input") input: LibraryFolderContentsInput[],
  ): Promise<LibraryFolderContentsOutput[]> {
    return this.libraryContentsService.getFolderContentsBatch(input);
  }
}
