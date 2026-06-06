import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { FoldersModule } from "@/folders/folders.module";
import { LibraryModule } from "@/library/library.module";
import { UploadsModule } from "@/uploads/uploads.module";
import { PagesResolver } from "./pages.resolver";
import { PagesService } from "./pages.service";

@Module({
  imports: [AuthModule, FoldersModule, LibraryModule, UploadsModule],
  providers: [PagesResolver, PagesService],
  exports: [PagesService],
})
export class PagesModule {}
