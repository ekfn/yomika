import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { BooksModule } from "@/books/books.module";
import { FoldersModule } from "@/folders/folders.module";
import { PagesModule } from "@/pages/pages.module";
import { LibraryContentsResolver } from "./library-contents.resolver";
import { LibraryContentsService } from "./library-contents.service";

@Module({
  imports: [AuthModule, FoldersModule, BooksModule, PagesModule],
  providers: [LibraryContentsResolver, LibraryContentsService],
})
export class LibraryContentsModule {}
