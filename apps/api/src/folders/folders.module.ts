import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { LibraryModule } from "@/library/library.module";
import { FoldersResolver } from "./folders.resolver";
import { FoldersService } from "./folders.service";

@Module({
  imports: [AuthModule, LibraryModule],
  providers: [FoldersResolver, FoldersService],
  exports: [FoldersService],
})
export class FoldersModule {}
