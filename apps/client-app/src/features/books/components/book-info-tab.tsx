import { FileTextIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { getPageDisplayName } from "@yomika/shared";
import { BookImportStatusBadge } from "@/components/common/status-badges";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import type { BookQuery } from "@/graphql/generated/graphql";
import { getPageRoute } from "@/lib/library-paths";
import { appendMediaCacheBuster } from "@/lib/media-url";
import { PageProcessingStatusBadges } from "@/features/pages/components/page-processing-status-badges";

type BookDetail = BookQuery["book"];
type BookInfoPage = BookDetail["pages"][number];

type PagePreviewDimensions = {
  width: number;
  height: number;
};

function formatDateTime(value: unknown) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatGeneratedPageCount(book: BookDetail) {
  if (book.sourcePageCount == null) {
    return `${book.pageCount}`;
  }

  return `${book.pageCount}/${book.sourcePageCount}`;
}

function formatImportProgress(book: BookDetail) {
  if (book.sourcePageCount == null || book.sourcePageCount === 0) {
    return `${book.importedPageCount} imported`;
  }

  return `${book.importedPageCount}/${book.sourcePageCount} imported`;
}

function getPageDisplayTitle(page: BookInfoPage) {
  if (page.pageNumber) {
    return `Page ${page.pageNumber}`;
  }

  return getPageDisplayName(page.path);
}

function getPagePreviewImageDimensions(
  page: BookInfoPage,
): PagePreviewDimensions | undefined {
  if (!page.sourceImagePreviewWidthPx || !page.sourceImagePreviewHeightPx) {
    return undefined;
  }

  return {
    width: page.sourceImagePreviewWidthPx,
    height: page.sourceImagePreviewHeightPx,
  };
}

function LanguageBadges({ languages }: { languages: readonly string[] }) {
  if (languages.length === 0) {
    return "None";
  }

  return (
    <div className="flex flex-wrap gap-1">
      {languages.map((language) => (
        <Badge key={language} variant="outline">
          {language}
        </Badge>
      ))}
    </div>
  );
}

function BookInfoPagePreview({ page }: { page: BookInfoPage }) {
  const sourcePreviewUrl = appendMediaCacheBuster(
    page.sourceImagePreviewUrl ?? page.sourceImageUrl,
    page.updatedAt,
  );
  const sourcePreviewDimensions = getPagePreviewImageDimensions(page);

  return (
    <div className="flex h-36 w-[102px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {sourcePreviewUrl ? (
        <img
          src={sourcePreviewUrl}
          alt=""
          loading="lazy"
          width={sourcePreviewDimensions?.width}
          height={sourcePreviewDimensions?.height}
          className="size-full object-contain"
        />
      ) : (
        <FileTextIcon
          className="size-7 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function BookInfoPagesCard({ pages }: { pages: readonly BookInfoPage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pages</CardTitle>
        <CardDescription>
          Generated pages and processing status.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pages have been created yet.
          </p>
        ) : (
          <div className="grid gap-3">
            {pages.map((page) => {
              const pageTitle = getPageDisplayTitle(page);
              const pageNumberLabel = page.pageNumber
                ? `Page ${page.pageNumber}`
                : null;

              return (
                <Link
                  key={page.path}
                  to={getPageRoute(page.path)}
                  data-book-page-path={page.path}
                  className="grid gap-3 rounded-lg border border-border p-3 transition hover:bg-muted/50 sm:grid-cols-[102px_minmax(0,1fr)]"
                >
                  <BookInfoPagePreview page={page} />
                  <div className="min-w-0 space-y-3">
                    <div className="flex items-start gap-2">
                      <FileTextIcon
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <h3 className="font-heading text-sm leading-snug font-medium text-foreground">
                          {pageTitle}
                        </h3>
                        {pageNumberLabel && pageNumberLabel !== pageTitle ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {pageNumberLabel}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <PageProcessingStatusBadges
                      ocrStatus={page.ocrStatus}
                      aiProcessingStatus={page.aiProcessingStatus}
                      aiProcessingEnabled={
                        page.effectiveSettings.aiProcessingEnabled
                      }
                      vocabularyEnabled={
                        page.effectiveSettings.vocabularyEnabled
                      }
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BookInfoTab({ book }: { book: BookDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Book details</CardTitle>
          <CardDescription>
            Source file, import status, and translation settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">Source PDF</dt>
              <dd>
                {book.sourcePdfUrl ? (
                  <a
                    href={book.sourcePdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline"
                  >
                    Open uploaded PDF
                  </a>
                ) : (
                  "Not uploaded"
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Generated pages</dt>
              <dd>{formatGeneratedPageCount(book)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Translate from</dt>
              <dd className="mt-1">
                <LanguageBadges
                  languages={book.settings.translationSourceLanguages}
                />
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Translate to</dt>
              <dd>{book.settings.translationTargetLanguage}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">AI processing</dt>
              <dd>
                {book.settings.aiProcessingEnabled ? "Enabled" : "Disabled"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Vocabulary</dt>
              <dd>
                {book.settings.vocabularyEnabled ? "Enabled" : "Disabled"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Import status</dt>
              <dd>
                <BookImportStatusBadge status={book.importStatus} />
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Import progress</dt>
              <dd>{formatImportProgress(book)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Created at</dt>
              <dd>{formatDateTime(book.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Updated at</dt>
              <dd>{formatDateTime(book.updatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <BookInfoPagesCard pages={book.pages} />
    </div>
  );
}
