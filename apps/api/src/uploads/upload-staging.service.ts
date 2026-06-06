import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LibraryPathsService } from "@/library/library-paths.service";
import { z } from "zod";
import {
  OCR_BOOK_ALLOWED_MIME_TYPES,
  OCR_BOOK_CHUNK_UPLOAD_SIZE_BYTES,
  OCR_BOOK_UPLOAD_MAX_FILE_SIZE_BYTES,
} from "./upload-limits";

export type StagedUploadKind = "BOOK_PDF" | "PAGE_IMAGE";

export type StagedUploadMetadata = {
  uploadId: string;
  kind: StagedUploadKind;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type StagedUploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type StartBookPdfChunkedUploadInput = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

const stagedUploadMetadataSchema = z.object({
  uploadId: z.string().min(1),
  kind: z.enum(["BOOK_PDF", "PAGE_IMAGE"]),
  fileName: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
});

const chunkedBookPdfUploadMetadataSchema = z.object({
  uploadId: z.string().min(1),
  kind: z.literal("BOOK_PDF"),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  chunkSizeBytes: z.number().int().positive(),
  chunkCount: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
});

type ChunkedBookPdfUploadMetadata = z.infer<
  typeof chunkedBookPdfUploadMetadataSchema
>;

const UPLOAD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPLOAD_CLEANUP_TTL_MS = 24 * 60 * 60 * 1000;
const UPLOAD_CLEANUP_THROTTLE_MS = 10 * 60 * 1000;

const IMAGE_FILE_NAME_BY_MIME_TYPE = new Map([
  ["image/png", "source.png"],
  ["image/jpeg", "source.jpg"],
  ["image/webp", "source.webp"],
]);

function isPdfUpload(originalName: string, mimeType: string) {
  return (
    OCR_BOOK_ALLOWED_MIME_TYPES.includes(
      mimeType as (typeof OCR_BOOK_ALLOWED_MIME_TYPES)[number],
    ) || originalName.toLowerCase().endsWith(".pdf")
  );
}

function getExpectedChunkSize(
  metadata: ChunkedBookPdfUploadMetadata,
  chunkIndex: number,
) {
  const chunkStart = chunkIndex * metadata.chunkSizeBytes;
  const remainingBytes = metadata.sizeBytes - chunkStart;

  return Math.min(metadata.chunkSizeBytes, remainingBytes);
}

@Injectable()
export class UploadStagingService {
  private lastCleanupStartedAt = 0;
  private cleanupPromise: Promise<void> | null = null;

  constructor(private readonly paths: LibraryPathsService) {}

  async startBookPdfChunkedUpload(input: StartBookPdfChunkedUploadInput) {
    await this.cleanupExpiredUploadsIfDue();

    const originalName = input.originalName.trim();

    if (!originalName) {
      throw new BadRequestException("Original filename is required.");
    }

    if (!isPdfUpload(originalName, input.mimeType)) {
      throw new BadRequestException("Only PDF files are supported.");
    }

    if (
      !Number.isInteger(input.sizeBytes) ||
      input.sizeBytes < 1 ||
      input.sizeBytes > OCR_BOOK_UPLOAD_MAX_FILE_SIZE_BYTES
    ) {
      throw new BadRequestException("Invalid PDF file size.");
    }

    const uploadId = randomUUID();
    const metadata: ChunkedBookPdfUploadMetadata = {
      uploadId,
      kind: "BOOK_PDF",
      originalName,
      mimeType: "application/pdf",
      sizeBytes: input.sizeBytes,
      chunkSizeBytes: OCR_BOOK_CHUNK_UPLOAD_SIZE_BYTES,
      chunkCount: Math.ceil(input.sizeBytes / OCR_BOOK_CHUNK_UPLOAD_SIZE_BYTES),
      createdAt: new Date().toISOString(),
    };

    await mkdir(this.getChunkedUploadSessionDir(uploadId), { recursive: true });
    await writeFile(
      this.getChunkedUploadMetadataPath(uploadId),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );

    return {
      uploadId,
      chunkSizeBytes: metadata.chunkSizeBytes,
      chunkCount: metadata.chunkCount,
    };
  }

  async saveBookPdfChunk(
    uploadId: string,
    chunkIndex: number,
    file: StagedUploadedFile | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("A chunk field named 'chunk' is required.");
    }

    const metadata = await this.readChunkedBookPdfUploadMetadata(uploadId);

    if (
      !Number.isInteger(chunkIndex) ||
      chunkIndex < 0 ||
      chunkIndex >= metadata.chunkCount
    ) {
      throw new BadRequestException("Invalid chunk index.");
    }

    const expectedChunkSize = getExpectedChunkSize(metadata, chunkIndex);

    if (
      file.size !== expectedChunkSize ||
      file.buffer.length !== expectedChunkSize
    ) {
      throw new BadRequestException("Invalid chunk size.");
    }

    await writeFile(this.getChunkPath(uploadId, chunkIndex), file.buffer);

    return {
      uploadId,
      chunkIndex,
      receivedBytes: file.size,
    };
  }

  async completeBookPdfChunkedUpload(uploadId: string): Promise<string> {
    const metadata = await this.readChunkedBookPdfUploadMetadata(uploadId);
    const stagedUploadDir = this.getStagedUploadDir(uploadId);
    const destinationPath = this.getStagedUploadFilePath(
      uploadId,
      "source.pdf",
    );
    const assemblingPath = this.assertInsideUploadsDir(
      join(stagedUploadDir, "source.pdf.assembling"),
    );
    let didAssembleFile = false;

    try {
      await mkdir(stagedUploadDir, { recursive: true });
      await rm(assemblingPath, { force: true });

      let assembledBytes = 0;
      const assembledFile = await open(assemblingPath, "w");

      try {
        for (
          let chunkIndex = 0;
          chunkIndex < metadata.chunkCount;
          chunkIndex += 1
        ) {
          const chunk = await readFile(
            this.getChunkPath(uploadId, chunkIndex),
          ).catch(() => null);
          const expectedChunkSize = getExpectedChunkSize(metadata, chunkIndex);

          if (!chunk || chunk.length !== expectedChunkSize) {
            throw new BadRequestException("Upload chunks are incomplete.");
          }

          await assembledFile.write(chunk);
          assembledBytes += chunk.length;
        }
      } finally {
        await assembledFile.close();
      }

      if (assembledBytes !== metadata.sizeBytes) {
        throw new BadRequestException("Assembled PDF file size is invalid.");
      }

      const assembledStats = await stat(assemblingPath);

      if (assembledStats.size !== metadata.sizeBytes) {
        throw new BadRequestException("Assembled PDF file size is invalid.");
      }

      await rename(assemblingPath, destinationPath);
      didAssembleFile = true;
      await writeFile(
        this.getStagedUploadMetadataPath(uploadId),
        `${JSON.stringify(
          {
            uploadId,
            kind: "BOOK_PDF",
            fileName: "source.pdf",
            originalName: metadata.originalName,
            mimeType: metadata.mimeType,
            sizeBytes: metadata.sizeBytes,
            createdAt: new Date().toISOString(),
          } satisfies StagedUploadMetadata,
          null,
          2,
        )}\n`,
      );
      await rm(this.getChunkedUploadSessionDir(uploadId), {
        recursive: true,
        force: true,
      }).catch(() => undefined);
      await rm(assemblingPath, { force: true }).catch(() => undefined);

      return uploadId;
    } catch (error) {
      await rm(assemblingPath, { force: true });
      if (didAssembleFile) {
        await rm(destinationPath, { force: true });
      }

      throw error;
    }
  }

  async stagePageImage(file: StagedUploadedFile | undefined): Promise<string> {
    await this.cleanupExpiredUploadsIfDue();

    if (!file) {
      throw new BadRequestException("Image file is required.");
    }

    const fileName = IMAGE_FILE_NAME_BY_MIME_TYPE.get(file.mimetype);

    if (!fileName) {
      throw new BadRequestException(
        "Only PNG, JPEG, and WebP images are supported.",
      );
    }

    return this.stageFile(file, "PAGE_IMAGE", fileName, file.mimetype);
  }

  async readMetadata(uploadId: string): Promise<StagedUploadMetadata> {
    const metadataPath = this.getStagedUploadMetadataPath(uploadId);

    try {
      const parsed = stagedUploadMetadataSchema.safeParse(
        JSON.parse(await readFile(metadataPath, "utf8")),
      );

      if (!parsed.success) {
        throw new Error(
          `Invalid staged upload metadata ${uploadId}: ${parsed.error.issues
            .map((issue) => issue.message)
            .join("; ")}`,
        );
      }

      return parsed.data;
    } catch (error) {
      if (isFileNotFoundError(error)) {
        throw new NotFoundException(`Upload ${uploadId} was not found.`);
      }
      throw error;
    }
  }

  getStagedUploadFilePath(uploadId: string, fileName: string): string {
    return this.assertInsideUploadsDir(
      join(this.getStagedUploadDir(uploadId), fileName),
    );
  }

  async removeUpload(uploadId: string): Promise<void> {
    await rm(this.getStagedUploadDir(uploadId), {
      recursive: true,
      force: true,
    });
  }

  async removeChunkedUploadSession(uploadId: string): Promise<void> {
    await rm(this.getChunkedUploadSessionDir(uploadId), {
      recursive: true,
      force: true,
    });
  }

  async cleanupExpiredUploads(ttlMs = UPLOAD_CLEANUP_TTL_MS): Promise<void> {
    const now = Date.now();

    await Promise.all([
      this.cleanupExpiredStagedUploads(now, ttlMs),
      this.cleanupExpiredChunkedUploads(now, ttlMs),
    ]);
  }

  private async stageFile(
    file: StagedUploadedFile,
    kind: StagedUploadKind,
    fileName: string,
    mimeType: string,
  ): Promise<string> {
    const uploadId = randomUUID();
    const uploadDir = this.getStagedUploadDir(uploadId);
    const metadata: StagedUploadMetadata = {
      uploadId,
      kind,
      fileName,
      originalName:
        file.originalname || `${kind.toLowerCase()}${extname(fileName)}`,
      mimeType,
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    };

    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, fileName), file.buffer);
    await writeFile(
      join(uploadDir, "metadata.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );

    return uploadId;
  }

  private getUploadsDir(): string {
    return resolve(this.paths.getRunnerStateDir(), "..", "uploads");
  }

  private getStagedUploadDir(uploadId: string): string {
    return this.assertInsideUploadsDir(join(this.getUploadsDir(), uploadId));
  }

  private getChunkedUploadsDir(): string {
    return this.assertInsideUploadsDir(join(this.getUploadsDir(), ".chunked"));
  }

  private async cleanupExpiredUploadsIfDue(): Promise<void> {
    const now = Date.now();

    if (this.cleanupPromise) {
      await this.cleanupPromise.catch(() => undefined);
      return;
    }

    if (now - this.lastCleanupStartedAt < UPLOAD_CLEANUP_THROTTLE_MS) {
      return;
    }

    this.lastCleanupStartedAt = now;
    this.cleanupPromise = this.cleanupExpiredUploads().finally(() => {
      this.cleanupPromise = null;
    });

    await this.cleanupPromise.catch(() => undefined);
  }

  private async cleanupExpiredStagedUploads(
    now: number,
    ttlMs: number,
  ): Promise<void> {
    const entries = await this.readDirectoryEntries(this.getUploadsDir());

    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory() || entry.name === ".chunked") {
          return;
        }

        const uploadDir = this.getStagedUploadDir(entry.name);
        const metadataPath = this.getStagedUploadMetadataPath(entry.name);

        if (
          await this.isExpiredStagedUpload(uploadDir, metadataPath, now, ttlMs)
        ) {
          await rm(uploadDir, { recursive: true, force: true });
        }
      }),
    );
  }

  private async cleanupExpiredChunkedUploads(
    now: number,
    ttlMs: number,
  ): Promise<void> {
    const chunkedUploadsDir = this.getChunkedUploadsDir();
    const entries = await this.readDirectoryEntries(chunkedUploadsDir);

    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory()) {
          return;
        }

        const uploadDir = this.assertInsideUploadsDir(
          join(chunkedUploadsDir, entry.name),
        );
        const metadataPath = this.assertInsideUploadsDir(
          join(uploadDir, "metadata.json"),
        );

        if (
          await this.isExpiredChunkedUpload(uploadDir, metadataPath, now, ttlMs)
        ) {
          await rm(uploadDir, { recursive: true, force: true });
        }
      }),
    );
  }

  private async isExpiredStagedUpload(
    uploadDir: string,
    metadataPath: string,
    now: number,
    ttlMs: number,
  ): Promise<boolean> {
    const createdAtMs = await this.readStagedUploadCreatedAtMs(metadataPath);

    if (createdAtMs !== null) {
      return now - createdAtMs > ttlMs;
    }

    return this.isDirectoryExpiredByMtime(uploadDir, now, ttlMs);
  }

  private async isExpiredChunkedUpload(
    uploadDir: string,
    metadataPath: string,
    now: number,
    ttlMs: number,
  ): Promise<boolean> {
    const createdAtMs = await this.readChunkedUploadCreatedAtMs(metadataPath);

    if (createdAtMs !== null) {
      return now - createdAtMs > ttlMs;
    }

    return this.isDirectoryExpiredByMtime(uploadDir, now, ttlMs);
  }

  private async readStagedUploadCreatedAtMs(
    metadataPath: string,
  ): Promise<number | null> {
    try {
      const parsed = stagedUploadMetadataSchema.safeParse(
        JSON.parse(await readFile(metadataPath, "utf8")),
      );

      if (!parsed.success) {
        return null;
      }

      return Date.parse(parsed.data.createdAt);
    } catch {
      return null;
    }
  }

  private async readChunkedUploadCreatedAtMs(
    metadataPath: string,
  ): Promise<number | null> {
    try {
      const parsed = chunkedBookPdfUploadMetadataSchema.safeParse(
        JSON.parse(await readFile(metadataPath, "utf8")),
      );

      if (!parsed.success) {
        return null;
      }

      return Date.parse(parsed.data.createdAt);
    } catch {
      return null;
    }
  }

  private async isDirectoryExpiredByMtime(
    directoryPath: string,
    now: number,
    ttlMs: number,
  ): Promise<boolean> {
    try {
      const stats = await stat(directoryPath);

      return now - stats.mtimeMs > ttlMs;
    } catch {
      return false;
    }
  }

  private async readDirectoryEntries(path: string) {
    try {
      return await readdir(path, { withFileTypes: true });
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return [];
      }

      throw error;
    }
  }

  private getChunkedUploadSessionDir(uploadId: string): string {
    if (!UPLOAD_ID_PATTERN.test(uploadId)) {
      throw new BadRequestException("Invalid upload id.");
    }

    return this.assertInsideUploadsDir(
      join(this.getChunkedUploadsDir(), uploadId),
    );
  }

  private getChunkedUploadMetadataPath(uploadId: string): string {
    return this.assertInsideUploadsDir(
      join(this.getChunkedUploadSessionDir(uploadId), "metadata.json"),
    );
  }

  private getChunkPath(uploadId: string, chunkIndex: number): string {
    return this.assertInsideUploadsDir(
      join(this.getChunkedUploadSessionDir(uploadId), `${chunkIndex}.part`),
    );
  }

  private async readChunkedBookPdfUploadMetadata(
    uploadId: string,
  ): Promise<ChunkedBookPdfUploadMetadata> {
    try {
      const parsed = chunkedBookPdfUploadMetadataSchema.safeParse(
        JSON.parse(
          await readFile(this.getChunkedUploadMetadataPath(uploadId), "utf8"),
        ),
      );

      if (!parsed.success) {
        throw new Error(
          `Invalid chunked upload metadata ${uploadId}: ${parsed.error.issues
            .map((issue) => issue.message)
            .join("; ")}`,
        );
      }

      return parsed.data;
    } catch (error) {
      if (isFileNotFoundError(error)) {
        throw new NotFoundException("Upload session was not found.");
      }
      throw error;
    }
  }

  private getStagedUploadMetadataPath(uploadId: string): string {
    return this.assertInsideUploadsDir(
      join(this.getStagedUploadDir(uploadId), "metadata.json"),
    );
  }

  private assertInsideUploadsDir(path: string): string {
    const uploadsDir = this.getUploadsDir();
    const resolvedPath = resolve(path);

    if (
      resolvedPath !== uploadsDir &&
      !resolvedPath.startsWith(`${uploadsDir}/`)
    ) {
      throw new Error("Resolved path is outside the upload staging directory.");
    }

    return resolvedPath;
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
