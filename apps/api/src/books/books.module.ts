import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { FoldersModule } from "@/folders/folders.module";
import { LibraryModule } from "@/library/library.module";
import { PagesModule } from "@/pages/pages.module";
import { RunnerModule } from "@/runner/runner.module";
import { UploadsModule } from "@/uploads/uploads.module";
import { BooksResolver } from "./books.resolver";
import { BooksService } from "./books.service";

@Module({
  imports: [
    AuthModule,
    FoldersModule,
    LibraryModule,
    PagesModule,
    RunnerModule,
    UploadsModule,
  ],
  providers: [BooksResolver, BooksService],
  exports: [BooksService],
})
export class BooksModule {}
