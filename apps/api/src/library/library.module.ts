import { Module } from "@nestjs/common";
import { JsonFileService } from "./json-file.service";
import { LibraryPathsService } from "./library-paths.service";
import { LibraryRepository } from "./library.repository";

@Module({
  providers: [JsonFileService, LibraryPathsService, LibraryRepository],
  exports: [JsonFileService, LibraryPathsService, LibraryRepository],
})
export class LibraryModule {}
