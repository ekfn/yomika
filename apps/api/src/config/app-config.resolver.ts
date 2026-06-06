import { UseGuards } from "@nestjs/common";
import { Query, Resolver } from "@nestjs/graphql";
import { AuthGuard } from "@/auth/auth.guard";
import { loadAppConfig } from "./app-config";

type LibrarySettingsDefaultsOutput = {
  translationSourceLanguages: string[];
  translationTargetLanguage: string;
  aiProcessingEnabled: boolean;
  vocabularyEnabled: boolean;
};

@Resolver()
@UseGuards(AuthGuard)
export class AppConfigResolver {
  private readonly config = loadAppConfig();

  @Query("librarySettingsDefaults")
  librarySettingsDefaults(): LibrarySettingsDefaultsOutput {
    return {
      translationSourceLanguages: this.config.translationSourceLanguages,
      translationTargetLanguage: this.config.translationTargetLanguage,
      aiProcessingEnabled: this.config.aiProcessingEnabled,
      vocabularyEnabled: this.config.vocabularyEnabled,
    };
  }
}
