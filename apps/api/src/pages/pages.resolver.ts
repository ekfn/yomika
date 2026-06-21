import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AuthGuard } from "@/auth/auth.guard";
import type {
  AiProcessingStatus,
  OcrStatus,
} from "@/library/library-status-values";
import { PagesService, type PageOutput } from "./pages.service";

type CreatePageInput = {
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

type UpdatePageInput = {
  name?: string | null;
  ocrStatus?: OcrStatus | null;
  aiProcessingStatus?: AiProcessingStatus | null;
  settings?: {
    translationSourceLanguages?: string[] | null;
    translationTargetLanguage?: string | null;
    aiProcessingEnabled?: boolean | null;
    vocabularyEnabled?: boolean | null;
  } | null;
};

type OverwritePageSourceImageInput = {
  sourceUploadId: string;
};

type UpdatePageSegmentTextWithReadingInput = {
  blockId: string;
  segmentId: string;
  textWithReading?: string | null;
};

type UpdatePageSegmentSourceTextInput = {
  blockId: string;
  segmentId: string;
  sourceText: string;
};

type UpdatePageSegmentTranslationInput = {
  blockId: string;
  segmentId: string;
  translation?: string | null;
};

@Resolver()
@UseGuards(AuthGuard)
export class PagesResolver {
  constructor(private readonly pagesService: PagesService) {}

  @Query("pages")
  pages(
    @Args("parentPath", { nullable: true }) parentPath?: string | null,
  ): Promise<PageOutput[]> {
    return this.pagesService.listPages(parentPath);
  }

  @Query("page")
  page(@Args("path") path: string): Promise<PageOutput> {
    return this.pagesService.getPage(path);
  }

  @Mutation("createPage")
  createPage(@Args("input") input: CreatePageInput): Promise<PageOutput> {
    return this.pagesService.createPage(input);
  }

  @Mutation("updatePage")
  updatePage(
    @Args("path") path: string,
    @Args("input") input: UpdatePageInput,
  ): Promise<PageOutput> {
    return this.pagesService.updatePage(path, input);
  }

  @Mutation("overwritePageSourceImage")
  overwritePageSourceImage(
    @Args("path") path: string,
    @Args("input") input: OverwritePageSourceImageInput,
  ): Promise<PageOutput> {
    return this.pagesService.overwritePageSourceImage(path, input);
  }

  @Mutation("updatePageSegmentTextWithReading")
  updatePageSegmentTextWithReading(
    @Args("path") path: string,
    @Args("input") input: UpdatePageSegmentTextWithReadingInput,
  ): Promise<PageOutput> {
    return this.pagesService.updatePageSegmentTextWithReading(path, input);
  }

  @Mutation("updatePageSegmentSourceText")
  updatePageSegmentSourceText(
    @Args("path") path: string,
    @Args("input") input: UpdatePageSegmentSourceTextInput,
  ): Promise<PageOutput> {
    return this.pagesService.updatePageSegmentSourceText(path, input);
  }

  @Mutation("updatePageSegmentTranslation")
  updatePageSegmentTranslation(
    @Args("path") path: string,
    @Args("input") input: UpdatePageSegmentTranslationInput,
  ): Promise<PageOutput> {
    return this.pagesService.updatePageSegmentTranslation(path, input);
  }
}
