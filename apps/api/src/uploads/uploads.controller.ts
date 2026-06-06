import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { HttpAuthGuard } from "@/auth/http-auth.guard";
import {
  OCR_BOOK_CHUNK_UPLOAD_FILE_SIZE_LIMIT_BYTES,
  UPLOAD_MAX_FILE_SIZE_BYTES,
} from "./upload-limits";
import {
  type StartBookPdfChunkedUploadInput,
  type StagedUploadedFile,
  UploadStagingService,
} from "./upload-staging.service";

type UploadResponse = {
  uploadId: string;
};

type StartChunkedUploadResponse = {
  uploadId: string;
  chunkSizeBytes: number;
  chunkCount: number;
};

@Controller("uploads")
@UseGuards(HttpAuthGuard)
export class UploadsController {
  constructor(private readonly uploadStagingService: UploadStagingService) {}

  @Post("books/pdf/chunked/start")
  startChunkedBookPdfUpload(
    @Body() body: StartBookPdfChunkedUploadInput,
  ): Promise<StartChunkedUploadResponse> {
    return this.uploadStagingService.startBookPdfChunkedUpload(body);
  }

  @Put("books/pdf/chunked/:uploadId/chunks/:chunkIndex")
  @UseInterceptors(
    FileInterceptor("chunk", {
      limits: { fileSize: OCR_BOOK_CHUNK_UPLOAD_FILE_SIZE_LIMIT_BYTES },
    }),
  )
  uploadBookPdfChunk(
    @Param("uploadId") uploadId: string,
    @Param("chunkIndex", ParseIntPipe) chunkIndex: number,
    @UploadedFile() file: StagedUploadedFile | undefined,
  ) {
    return this.uploadStagingService.saveBookPdfChunk(
      uploadId,
      chunkIndex,
      file,
    );
  }

  @Post("books/pdf/chunked/:uploadId/complete")
  async completeChunkedBookPdfUpload(
    @Param("uploadId") uploadId: string,
  ): Promise<UploadResponse> {
    return {
      uploadId:
        await this.uploadStagingService.completeBookPdfChunkedUpload(uploadId),
    };
  }

  @Post("pages/image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: UPLOAD_MAX_FILE_SIZE_BYTES },
    }),
  )
  async uploadPageImage(
    @UploadedFile() file: StagedUploadedFile | undefined,
  ): Promise<UploadResponse> {
    return {
      uploadId: await this.uploadStagingService.stagePageImage(file),
    };
  }
}
