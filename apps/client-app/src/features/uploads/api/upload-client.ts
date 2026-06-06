type UploadResponse = {
  uploadId: string;
};

export type UploadProgress = {
  loadedBytes: number;
  percentage: number | null;
  totalBytes: number;
};

type UploadFileOptions = {
  onProgress?: (progress: UploadProgress) => void;
};

type StartBookPdfChunkedUploadResult = {
  uploadId: string;
  chunkSizeBytes: number;
  chunkCount: number;
};

const BOOK_PDF_CHUNKED_UPLOAD_PATH = "/api/uploads/books/pdf/chunked";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getUploadErrorMessage(payload: unknown, status?: number): string {
  if (status === 413) {
    return "The upload was rejected by a server or proxy size limit.";
  }

  if (!isRecord(payload)) {
    return status
      ? `The upload request failed with status ${status}.`
      : "The upload request failed.";
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (
    Array.isArray(payload.message) &&
    payload.message.every((message) => typeof message === "string")
  ) {
    return payload.message.join(" ");
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  return status
    ? `The upload request failed with status ${status}.`
    : "The upload request failed.";
}

function parseUploadResponseText(responseText: string): unknown {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return null;
  }
}

function parsePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return Number(value);
  }

  return null;
}

function parseUploadResponse(payload: unknown): UploadResponse {
  if (!isRecord(payload)) {
    throw new Error("The upload server returned an invalid response.");
  }

  const { uploadId } = payload;

  if (typeof uploadId !== "string" || uploadId.length === 0) {
    throw new Error("Upload response did not include an upload id.");
  }

  return { uploadId };
}

function parseStartBookPdfChunkedUploadResult(
  payload: unknown,
  fileSize: number,
): StartBookPdfChunkedUploadResult {
  if (!isRecord(payload)) {
    throw new Error("The upload server returned an invalid upload session.");
  }

  const { chunkCount, chunkSizeBytes, uploadId } = payload;
  const parsedChunkSizeBytes = parsePositiveInteger(chunkSizeBytes);

  if (
    typeof uploadId !== "string" ||
    !parsedChunkSizeBytes ||
    !Number.isInteger(fileSize) ||
    fileSize < 1
  ) {
    throw new Error("The upload server returned an invalid upload session.");
  }

  const expectedChunkCount = Math.ceil(fileSize / parsedChunkSizeBytes);
  const parsedChunkCount = parsePositiveInteger(chunkCount);

  if (parsedChunkCount && parsedChunkCount !== expectedChunkCount) {
    throw new Error("The upload server returned an invalid chunk count.");
  }

  return {
    uploadId,
    chunkSizeBytes: parsedChunkSizeBytes,
    chunkCount: expectedChunkCount,
  };
}

function buildUploadProgress(
  loadedBytes: number,
  totalBytes: number,
): UploadProgress {
  return {
    loadedBytes,
    totalBytes,
    percentage:
      totalBytes > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((loadedBytes / totalBytes) * 100)),
          )
        : null,
  };
}

async function postUploadJson<Result>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<Result> {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new Error(getUploadErrorMessage(payload, response.status));
  }

  return response.json() as Promise<Result>;
}

function uploadFileWithProgress(
  endpoint: string,
  file: File,
  options: UploadFileOptions,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    const xhr = new XMLHttpRequest();

    formData.append("file", file);
    xhr.open("POST", endpoint);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      const totalBytes =
        event.lengthComputable && event.total > 0 ? event.total : file.size;

      options.onProgress?.(buildUploadProgress(event.loaded, totalBytes));
    };

    xhr.onload = () => {
      const payload = parseUploadResponseText(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parseUploadResponse(payload));
        return;
      }

      reject(new Error(getUploadErrorMessage(payload, xhr.status)));
    };

    xhr.onerror = () => {
      reject(new Error("The upload request failed."));
    };

    xhr.onabort = () => {
      reject(new Error("The upload request was cancelled."));
    };

    xhr.send(formData);
  });
}

async function uploadFile(
  endpoint: string,
  file: File,
  options: UploadFileOptions = {},
): Promise<string> {
  if (options.onProgress) {
    return (await uploadFileWithProgress(endpoint, file, options)).uploadId;
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new Error(getUploadErrorMessage(payload, response.status));
  }

  return parseUploadResponse((await response.json()) as unknown).uploadId;
}

function uploadBookPdfChunk(
  uploadId: string,
  chunkIndex: number,
  chunk: Blob,
  fileName: string,
  confirmedLoadedBytes: number,
  totalBytes: number,
  options: UploadFileOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    const xhr = new XMLHttpRequest();

    formData.append("chunk", chunk, `${fileName}.part`);
    xhr.open(
      "PUT",
      `${BOOK_PDF_CHUNKED_UPLOAD_PATH}/${uploadId}/chunks/${chunkIndex}`,
    );
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      const chunkLoadedBytes =
        event.lengthComputable && event.total > 0
          ? Math.min(event.loaded, chunk.size)
          : chunk.size;

      options.onProgress?.(
        buildUploadProgress(
          Math.min(totalBytes, confirmedLoadedBytes + chunkLoadedBytes),
          totalBytes,
        ),
      );
    };

    xhr.onload = () => {
      const payload = parseUploadResponseText(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(getUploadErrorMessage(payload, xhr.status)));
    };

    xhr.onerror = () => {
      reject(new Error("The upload chunk request failed."));
    };

    xhr.onabort = () => {
      reject(new Error("The upload chunk request was cancelled."));
    };

    xhr.send(formData);
  });
}

async function uploadBookPdfChunkWithRetry(
  uploadId: string,
  chunkIndex: number,
  chunk: Blob,
  fileName: string,
  confirmedLoadedBytes: number,
  totalBytes: number,
  options: UploadFileOptions,
) {
  let lastError: unknown = null;

  for (let attemptIndex = 0; attemptIndex < 3; attemptIndex += 1) {
    try {
      await uploadBookPdfChunk(
        uploadId,
        chunkIndex,
        chunk,
        fileName,
        confirmedLoadedBytes,
        totalBytes,
        options,
      );
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The upload chunk request failed.");
}

async function uploadBookPdfChunked(
  file: File,
  options: UploadFileOptions = {},
): Promise<string> {
  const upload = parseStartBookPdfChunkedUploadResult(
    await postUploadJson<unknown>(`${BOOK_PDF_CHUNKED_UPLOAD_PATH}/start`, {
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
    file.size,
  );
  let confirmedLoadedBytes = 0;

  for (let chunkIndex = 0; chunkIndex < upload.chunkCount; chunkIndex += 1) {
    const chunkStart = chunkIndex * upload.chunkSizeBytes;
    const chunkEnd = Math.min(file.size, chunkStart + upload.chunkSizeBytes);
    const chunk = file.slice(chunkStart, chunkEnd);

    await uploadBookPdfChunkWithRetry(
      upload.uploadId,
      chunkIndex,
      chunk,
      file.name,
      confirmedLoadedBytes,
      file.size,
      options,
    );

    confirmedLoadedBytes = chunkEnd;
    options.onProgress?.(buildUploadProgress(confirmedLoadedBytes, file.size));
  }

  const result = parseUploadResponse(
    await postUploadJson<unknown>(
      `${BOOK_PDF_CHUNKED_UPLOAD_PATH}/${upload.uploadId}/complete`,
      {},
    ),
  );

  options.onProgress?.(buildUploadProgress(file.size, file.size));

  return result.uploadId;
}

export function uploadBookPdf(
  file: File,
  options?: UploadFileOptions,
): Promise<string> {
  return uploadBookPdfChunked(file, options);
}

export function uploadPageImage(
  file: File,
  options?: UploadFileOptions,
): Promise<string> {
  return uploadFile("/api/uploads/pages/image", file, options);
}
