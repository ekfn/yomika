import { FileTextIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getPageDisplayName } from "@yomika/shared";
import { PageOcrTab } from "@/features/pages/detail/page-ocr-tab";
import { PageTranslationTab } from "@/features/pages/detail/page-translation-tab";
import type { PageImageDimensions } from "@/features/pages/detail/types";
import {
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import type { BookQuery } from "@/graphql/generated/graphql";
import { getPageRoute } from "@/lib/library-paths";
import { BookInfoTab } from "./book-info-tab";

type BookDetail = BookQuery["book"];
type BookPage = BookDetail["pages"][number];

const BOOK_DETAIL_TAB_SEARCH_PARAM = "tab";
const BOOK_DETAIL_PAGE_SEARCH_PARAM = "pagePath";
const BOOK_DETAIL_TAB_VALUES = ["info", "ocr", "translation"] as const;
const DEFAULT_BOOK_DETAIL_TAB_VALUE = "translation";
const BOOK_DETAIL_PAGE_SCROLL_DELAY_MS = 50;

type BookDetailTabValue = (typeof BOOK_DETAIL_TAB_VALUES)[number];
type SelectedBlockIdsByPagePath = Readonly<Record<string, string | null>>;

function isBookDetailTabValue(
  value: string | null,
): value is BookDetailTabValue {
  return BOOK_DETAIL_TAB_VALUES.some((tabValue) => tabValue === value);
}

function getBookDetailTabValue(value: string | null): BookDetailTabValue {
  return isBookDetailTabValue(value) ? value : DEFAULT_BOOK_DETAIL_TAB_VALUE;
}

function getPageDisplayTitle(page: BookPage) {
  if (page.pageNumber) {
    return `Page ${page.pageNumber}`;
  }

  return getPageDisplayName(page.path);
}

function getSourceImageDimensions(page: BookPage): PageImageDimensions | null {
  if (!page.sourceImageWidthPx || !page.sourceImageHeightPx) {
    return null;
  }

  return {
    width: page.sourceImageWidthPx,
    height: page.sourceImageHeightPx,
  };
}

function BookNoPagesEmpty() {
  return (
    <Card>
      <CardContent>
        <Empty className="min-h-48">
          <EmptyHeader>
            <EmptyTitle>No pages</EmptyTitle>
            <EmptyDescription>
              No pages have been created for this book yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}

function BookPageSection({
  page,
  children,
}: {
  page: BookPage;
  children: ReactNode;
}) {
  const pageTitle = getPageDisplayTitle(page);
  const pageNumberLabel = page.pageNumber ? `Page ${page.pageNumber}` : null;

  return (
    <section className="flex flex-col gap-3" data-book-page-path={page.path}>
      <div className="min-w-0">
        <Link
          to={getPageRoute(page.path)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-start gap-2 font-heading text-base leading-snug font-medium text-foreground underline-offset-4 hover:underline"
        >
          <FileTextIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{pageTitle}</span>
        </Link>
        {pageNumberLabel && pageNumberLabel !== pageTitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pageNumberLabel}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function BookOcrTab({
  pages,
  selectedBlockIdsByPagePath,
  onSelectBlock,
}: {
  pages: readonly BookPage[];
  selectedBlockIdsByPagePath: SelectedBlockIdsByPagePath;
  onSelectBlock: (pagePath: string, blockId: string) => void;
}) {
  if (pages.length === 0) {
    return <BookNoPagesEmpty />;
  }

  return (
    <div className="flex flex-col gap-10">
      {pages.map((page) => {
        const blocks = page.blocks;
        const selectedBlockId = selectedBlockIdsByPagePath[page.path] ?? null;

        return (
          <BookPageSection key={page.path} page={page}>
            <PageOcrTab
              pagePath={page.path}
              sourceImageUrl={page.sourceImageUrl}
              sourceImageDimensions={getSourceImageDimensions(page)}
              ocrRawJson={page.ocrRawJson ?? null}
              blocks={blocks}
              selectedBlockId={selectedBlockId}
              onSelectBlock={(blockId) => {
                onSelectBlock(page.path, blockId);
              }}
            />
          </BookPageSection>
        );
      })}
    </div>
  );
}

function BookTranslationTab({
  pages,
  selectedBlockIdsByPagePath,
  onSelectBlock,
}: {
  pages: readonly BookPage[];
  selectedBlockIdsByPagePath: SelectedBlockIdsByPagePath;
  onSelectBlock: (pagePath: string, blockId: string) => void;
}) {
  if (pages.length === 0) {
    return <BookNoPagesEmpty />;
  }

  return (
    <div className="flex flex-col gap-10">
      {pages.map((page) => {
        const selectedBlockId = selectedBlockIdsByPagePath[page.path] ?? null;

        return (
          <BookPageSection key={page.path} page={page}>
            <PageTranslationTab
              pagePath={page.path}
              sourceImageUrl={page.sourceImageUrl}
              sourceImageDimensions={getSourceImageDimensions(page)}
              blocks={page.blocks}
              translationSourceLanguages={
                page.effectiveSettings.translationSourceLanguages
              }
              selectedBlockId={selectedBlockId}
              onSelectBlock={(blockId) => {
                onSelectBlock(page.path, blockId);
              }}
            />
          </BookPageSection>
        );
      })}
    </div>
  );
}

export function BookDetailTabs({ book }: { book: BookDetail }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab = getBookDetailTabValue(
    searchParams.get(BOOK_DETAIL_TAB_SEARCH_PARAM),
  );
  const targetPagePath = searchParams.get(BOOK_DETAIL_PAGE_SEARCH_PARAM);
  const [selectedBlockIdsByPagePath, setSelectedBlockIdsByPagePath] =
    useState<SelectedBlockIdsByPagePath>({});

  const handleSelectBlock = (pagePath: string, blockId: string) => {
    setSelectedBlockIdsByPagePath((currentSelectedBlockIdsByPagePath) => ({
      ...currentSelectedBlockIdsByPagePath,
      [pagePath]: blockId,
    }));
  };

  useEffect(() => {
    if (!targetPagePath) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const activeTabContent = document.querySelector<HTMLElement>(
        '[data-slot="tabs-content"][data-state="active"]',
      );
      const targetElement = [
        ...(activeTabContent?.querySelectorAll<HTMLElement>(
          "[data-book-page-path]",
        ) ?? []),
      ].find(
        (pageElement) => pageElement.dataset.bookPagePath === targetPagePath,
      );

      targetElement?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, BOOK_DETAIL_PAGE_SCROLL_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [book.path, selectedTab, targetPagePath]);

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => {
        const tabValue = getBookDetailTabValue(value);

        setSearchParams((currentSearchParams) => {
          const nextSearchParams = new URLSearchParams(currentSearchParams);

          nextSearchParams.set(BOOK_DETAIL_TAB_SEARCH_PARAM, tabValue);
          nextSearchParams.delete(BOOK_DETAIL_PAGE_SEARCH_PARAM);

          return nextSearchParams;
        });
      }}
      className="gap-5"
    >
      <div className="overflow-x-auto pb-1.5">
        <TabsList variant="line" className="min-w-max">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="ocr">OCR blocks</TabsTrigger>
          <TabsTrigger value="translation">Translation</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="info">
        <BookInfoTab book={book} />
      </TabsContent>

      <TabsContent value="ocr">
        <BookOcrTab
          pages={book.pages}
          selectedBlockIdsByPagePath={selectedBlockIdsByPagePath}
          onSelectBlock={handleSelectBlock}
        />
      </TabsContent>

      <TabsContent value="translation">
        <BookTranslationTab
          pages={book.pages}
          selectedBlockIdsByPagePath={selectedBlockIdsByPagePath}
          onSelectBlock={handleSelectBlock}
        />
      </TabsContent>
    </Tabs>
  );
}
