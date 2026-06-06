import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Injectable } from "@nestjs/common";
import type { z } from "zod";

@Injectable()
export class JsonFileService {
  async readJsonFile<T>(
    path: string,
    schema: z.ZodSchema<T>,
    relativePath: string,
  ): Promise<T> {
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSON file ${relativePath}: ${message}`, {
        cause: error,
      });
    }

    const parsed = schema.safeParse(parsedJson);

    if (!parsed.success) {
      const issueSummary = parsed.error.issues
        .map((issue) => {
          const pathLabel =
            issue.path.length > 0 ? issue.path.join(".") : "<root>";
          return `${pathLabel}: ${issue.message}`;
        })
        .join("; ");
      throw new Error(`Invalid JSON file ${relativePath}: ${issueSummary}`);
    }

    return parsed.data;
  }

  async writeJsonFileAtomically(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });

    const temporaryPath = `${path}.tmp-${randomUUID()}`;
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
    await rename(temporaryPath, path);
  }
}
