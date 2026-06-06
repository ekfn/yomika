import type { Response } from "express";
import { join } from "node:path";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LibraryPathsService } from "@/library/library-paths.service";

@Injectable()
export class MediaService {
  constructor(private readonly paths: LibraryPathsService) {}

  sendMedia(mediaKey: string, response: Response): void {
    if (
      !mediaKey ||
      mediaKey.startsWith("/") ||
      mediaKey.includes("..") ||
      mediaKey.includes("\\")
    ) {
      throw new BadRequestException("Unsafe media key.");
    }

    const mediaPath = this.paths.assertInsideLibrary(
      join(this.paths.getLibraryDir(), mediaKey),
    );

    response.sendFile(mediaPath, (error) => {
      if (error && !response.headersSent) {
        throw new NotFoundException("Media file was not found.");
      }
    });
  }
}
