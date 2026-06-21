import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { PageInfoTab } from "./page-info-tab";
import { PageOcrTab } from "./page-ocr-tab";
import { PageTranslationTab } from "./page-translation-tab";
import type { PageDetail, PageImageDimensions } from "./types";

type PageDetailTabsProps = {
  page: PageDetail;
  sourceImageUrl: string;
  sourceImageDimensions: PageImageDimensions | null;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
};

const PAGE_DETAIL_TAB_SEARCH_PARAM = "tab";
const PAGE_DETAIL_TAB_VALUES = ["info", "ocr", "translation"] as const;
const DEFAULT_PAGE_DETAIL_TAB_VALUE = "translation";

type PageDetailTabValue = (typeof PAGE_DETAIL_TAB_VALUES)[number];

const PAGE_DETAIL_TAB_LABELS = {
  info: "Info",
  ocr: "OCR blocks",
  translation: "Translation",
} satisfies Record<PageDetailTabValue, string>;

function isPageDetailTabValue(
  value: string | null,
): value is PageDetailTabValue {
  return PAGE_DETAIL_TAB_VALUES.some((tabValue) => tabValue === value);
}

function getPageDetailTabValue(value: string | null): PageDetailTabValue {
  return isPageDetailTabValue(value) ? value : DEFAULT_PAGE_DETAIL_TAB_VALUE;
}

function getPageDetailTabSearch(
  searchParams: URLSearchParams,
  tabValue: PageDetailTabValue,
) {
  const nextSearchParams = new URLSearchParams(searchParams);

  nextSearchParams.set(PAGE_DETAIL_TAB_SEARCH_PARAM, tabValue);

  return `?${nextSearchParams.toString()}`;
}

export function PageDetailTabs({
  page,
  sourceImageUrl,
  sourceImageDimensions,
  selectedBlockId,
  onSelectBlock,
}: PageDetailTabsProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedTab = getPageDetailTabValue(
    searchParams.get(PAGE_DETAIL_TAB_SEARCH_PARAM),
  );

  return (
    <Tabs value={selectedTab} className="gap-5">
      <div className="overflow-x-auto pb-1.5">
        <TabsList variant="line" className="min-w-max">
          {PAGE_DETAIL_TAB_VALUES.map((tabValue) => (
            <TabsTrigger key={tabValue} value={tabValue} asChild>
              <Link
                to={{
                  pathname: location.pathname,
                  search: getPageDetailTabSearch(searchParams, tabValue),
                  hash: location.hash,
                }}
                onClick={(event) => {
                  if (tabValue === selectedTab) {
                    event.preventDefault();
                  }
                }}
              >
                {PAGE_DETAIL_TAB_LABELS[tabValue]}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="info">
        <PageInfoTab
          page={page}
          sourceImageUrl={sourceImageUrl}
          sourceImageDimensions={sourceImageDimensions}
        />
      </TabsContent>

      <TabsContent value="ocr">
        <PageOcrTab
          pagePath={page.path}
          sourceImageUrl={sourceImageUrl}
          sourceImageDimensions={sourceImageDimensions}
          ocrRawJson={page.ocrRawJson ?? null}
          blocks={page.blocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
        />
      </TabsContent>

      <TabsContent value="translation">
        <PageTranslationTab
          pagePath={page.path}
          sourceImageUrl={sourceImageUrl}
          sourceImageDimensions={sourceImageDimensions}
          blocks={page.blocks}
          translationSourceLanguages={
            page.effectiveSettings.translationSourceLanguages
          }
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
        />
      </TabsContent>
    </Tabs>
  );
}
