import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AuthGuard } from "@/auth/auth.guard";
import { FoldersService, type FolderOutput } from "./folders.service";

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

@Resolver()
@UseGuards(AuthGuard)
export class FoldersResolver {
  constructor(private readonly foldersService: FoldersService) {}

  @Query("folders")
  folders(@Args("parentPath", { nullable: true }) parentPath?: string | null) {
    return this.foldersService.listFolders(parentPath);
  }

  @Query("folder")
  folder(@Args("path") path: string): Promise<FolderOutput> {
    return this.foldersService.getFolder(path);
  }

  @Mutation("createFolder")
  createFolder(@Args("input") input: CreateFolderInput): Promise<FolderOutput> {
    return this.foldersService.createFolder(input);
  }

  @Mutation("updateFolder")
  updateFolder(
    @Args("path") path: string,
    @Args("input") input: UpdateFolderInput,
  ): Promise<FolderOutput> {
    return this.foldersService.updateFolder(path, input);
  }

  @Mutation("moveFolder")
  moveFolder(
    @Args("path") path: string,
    @Args("input") input: MoveFolderInput,
  ): Promise<FolderOutput> {
    return this.foldersService.moveFolder(path, input);
  }
}
