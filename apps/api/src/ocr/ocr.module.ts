import { Module } from "@nestjs/common";
import { LibraryModule } from "@/library/library.module";
import { ImagePreviewService } from "./image-preview.service";
import { PaddleOcrClient } from "./paddle-ocr-client";
import { PdfPageImportService } from "./pdf-page-import.service";

@Module({
  imports: [LibraryModule],
  providers: [ImagePreviewService, PaddleOcrClient, PdfPageImportService],
  exports: [PaddleOcrClient, PdfPageImportService],
})
export class OcrModule {}
