import { Injectable } from "@nestjs/common";
import { LibraryRepository } from "@/library/library.repository";
import { PaddleOcrClient } from "@/ocr/paddle-ocr-client";
import type { RunnerTaskHandler } from "../runner-task-handler";
import { RunnerTaskStateService } from "../runner-task-state.service";
import type { RunnerTask } from "../runner-types";

@Injectable()
export class OcrTaskHandler implements RunnerTaskHandler {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly paddleOcrClient: PaddleOcrClient,
    private readonly runnerTaskState: RunnerTaskStateService,
  ) {}

  async run(task: RunnerTask): Promise<void> {
    const pageRecord = await this.runnerTaskState.getTaskPage(task);
    const processingPageRecord = await this.runnerTaskState.writePage(
      pageRecord,
      {
        ...pageRecord.page,
        ocrStatus: "PROCESSING",
      },
    );
    const sourceImagePath =
      this.libraryRepository.getPageSourceImagePath(processingPageRecord);
    const rawJson = await this.paddleOcrClient.run(sourceImagePath, {
      mimeType: processingPageRecord.page.sourceImage.mimeType,
      widthPx: processingPageRecord.page.sourceImage.widthPx,
      heightPx: processingPageRecord.page.sourceImage.heightPx,
    });

    await this.runnerTaskState.writePage(processingPageRecord, {
      ...processingPageRecord.page,
      ocrStatus: "COMPLETE",
      ocrRawJson: rawJson,
    });
  }
}
