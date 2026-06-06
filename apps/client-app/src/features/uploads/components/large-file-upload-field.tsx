import { useRef, useState, type ReactNode } from "react";
import { FileUpIcon } from "lucide-react";
import { formatUploadFileSize } from "@yomika/shared";
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui";
import type { UploadProgress } from "@/features/uploads/api/upload-client";

type LargeFileUploadFieldProps = {
  accept: string;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: string | null;
  id: string;
  label: string;
  uploadedContent?: ReactNode;
  onFileSelected: (
    file: File,
    options: { onProgress: (progress: UploadProgress) => void },
  ) => Promise<boolean> | boolean;
  onUploadingChange?: (isUploading: boolean) => void;
};

function getProgressLabel(progress: UploadProgress | null) {
  if (!progress) {
    return "Preparing upload";
  }

  if (progress.percentage === null) {
    return `${formatUploadFileSize(progress.loadedBytes)} uploaded`;
  }

  return `${progress.percentage}% uploaded`;
}

export function LargeFileUploadField({
  accept,
  autoFocus = false,
  disabled = false,
  error,
  id,
  label,
  uploadedContent,
  onFileSelected,
  onUploadingChange,
}: LargeFileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );
  const [isUploading, setIsUploading] = useState(false);

  const progressPercentage = uploadProgress?.percentage ?? 0;
  const hasUploadedContent = Boolean(uploadedContent);
  const selectedFileDetails = selectedFile
    ? `${selectedFile.name} · ${formatUploadFileSize(selectedFile.size)}`
    : null;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled || isUploading}
          tabIndex={-1}
          aria-invalid={error ? true : undefined}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0] ?? null;

            event.currentTarget.value = "";

            if (!file) {
              return;
            }

            setSelectedFile(file);
            setUploadProgress(null);
            setIsUploading(true);
            onUploadingChange?.(true);

            try {
              const didUpload = await onFileSelected(file, {
                onProgress: setUploadProgress,
              });

              if (!didUpload) {
                setUploadProgress(null);
              }
            } finally {
              setIsUploading(false);
              onUploadingChange?.(false);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          autoFocus={autoFocus}
          disabled={disabled || isUploading}
          className="h-auto w-full justify-start rounded-lg border-dashed px-4 py-4 text-left whitespace-normal"
          onClick={() => {
            inputRef.current?.click();
          }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FileUpIcon className="size-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-medium">
              {isUploading
                ? "Uploading..."
                : hasUploadedContent
                  ? "Replace file"
                  : "Select file"}
            </span>
            {selectedFileDetails ? (
              <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                {selectedFileDetails}
              </span>
            ) : null}
          </span>
        </Button>
      </div>
      {isUploading ? (
        <div className="space-y-1.5">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress?.percentage ?? undefined}
          >
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <FieldDescription>
            {getProgressLabel(uploadProgress)}
          </FieldDescription>
        </div>
      ) : null}
      {uploadedContent}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
