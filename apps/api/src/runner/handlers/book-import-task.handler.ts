import { Injectable } from "@nestjs/common";
import { PdfPageImportService } from "@/ocr/pdf-page-import.service";
import type { RunnerTaskHandler } from "../runner-task-handler";
import type { RunnerTask } from "../runner-types";

@Injectable()
export class BookImportTaskHandler implements RunnerTaskHandler {
  constructor(private readonly pdfPageImportService: PdfPageImportService) {}

  async run(task: RunnerTask): Promise<void> {
    if (!task.bookPath) {
      throw new Error("Book import task is missing a book path.");
    }

    await this.pdfPageImportService.importBookPages(task.bookPath);
  }
}
