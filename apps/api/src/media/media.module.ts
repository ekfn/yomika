import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { LibraryModule } from "@/library/library.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [AuthModule, LibraryModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
