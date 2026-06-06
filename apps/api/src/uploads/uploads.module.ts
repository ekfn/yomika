import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { LibraryModule } from "@/library/library.module";
import { UploadStagingService } from "./upload-staging.service";
import { UploadsController } from "./uploads.controller";

@Module({
  imports: [AuthModule, LibraryModule],
  controllers: [UploadsController],
  providers: [UploadStagingService],
  exports: [UploadStagingService],
})
export class UploadsModule {}
