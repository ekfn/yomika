import { useMemo } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { PageDetailSideCard } from "./page-detail-side-card";
import { parseRawOcrBlocks, type RawOcrBlocksResult } from "./raw-ocr-blocks";
import { SegmentSourceTextEditor } from "./segment-source-text-editor";
import { SegmentTranslationEditor } from "./segment-translation-editor";
import { SegmentTextWithReadingEditor } from "./text-with-reading-editor";
import type { PageBlock } from "./types";
import { formatBlockLabel, formatCoordinate } from "./utils";

const BLOCK_CONTENT_TAB_VALUES = ["blocks", "rawBlocks"] as const;

export type BlockContentTabValue = (typeof BLOCK_CONTENT_TAB_VALUES)[number];

type PageBlockContentCardProps = {
  ocrRawJson: string | null;
  pagePath: string;
  selectedTab: BlockContentTabValue;
  selectedBlock: PageBlock | null;
  previousBlock?: PageBlock | null;
  nextBlock?: PageBlock | null;
  onSelectBlock?: (blockId: string) => void;
  onSelectedTabChange: (value: BlockContentTabValue) => void;
};

function isBlockContentTabValue(value: string): value is BlockContentTabValue {
  return BLOCK_CONTENT_TAB_VALUES.some((tabValue) => tabValue === value);
}

function renderSegmentLanguages(languages: readonly string[]) {
  if (languages.length === 0) {
    return <span className="text-xs text-muted-foreground">No language</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {languages.map((language) => (
        <Badge key={language} variant="outline" className="text-xs">
          {language}
        </Badge>
      ))}
    </div>
  );
}

function BlocksTabContent({
  pagePath,
  selectedBlock,
}: {
  pagePath: string;
  selectedBlock: PageBlock | null;
}) {
  if (!selectedBlock) {
    return (
      <Empty className="min-h-48">
        <EmptyHeader>
          <EmptyTitle>No available blocks</EmptyTitle>
          <EmptyDescription>
            Cleaned OCR blocks will appear after cleanup.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Label</dt>
          <dd>
            <Badge variant="secondary">
              {selectedBlock.label ?? "unknown"}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Order index</dt>
          <dd>{selectedBlock.orderIndex}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-foreground">BBox</dt>
          <dd>
            {[
              selectedBlock.bboxX1,
              selectedBlock.bboxY1,
              selectedBlock.bboxX2,
              selectedBlock.bboxY2,
            ]
              .map(formatCoordinate)
              .join(", ")}
          </dd>
        </div>
      </dl>

      <Separator />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">Content</h3>
        {selectedBlock.content.trim().length > 0 ? (
          <p className="overflow-auto whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
            {selectedBlock.content}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This OCR block has empty content.
          </p>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">Segments</h3>
        {selectedBlock.segments.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {selectedBlock.segments.map((segment) => (
              <li
                key={segment.id}
                className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-sm leading-relaxed text-foreground"
              >
                <SegmentSourceTextEditor
                  blockId={selectedBlock.id}
                  pagePath={pagePath}
                  segment={segment}
                />
                <SegmentTextWithReadingEditor
                  blockId={selectedBlock.id}
                  pagePath={pagePath}
                  segment={segment}
                />
                <SegmentTranslationEditor
                  blockId={selectedBlock.id}
                  pagePath={pagePath}
                  segment={segment}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Languages
                  </span>
                  {renderSegmentLanguages(segment.languages)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            This OCR block does not have segments yet.
          </p>
        )}
      </div>
    </div>
  );
}

function RawBlocksTabContent({ result }: { result: RawOcrBlocksResult }) {
  if (result.status !== "ready") {
    return (
      <Empty className="min-h-48">
        <EmptyHeader>
          <EmptyTitle>Raw blocks unavailable</EmptyTitle>
          <EmptyDescription>{result.message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (result.blocks.length === 0) {
    return (
      <Empty className="min-h-48">
        <EmptyHeader>
          <EmptyTitle>No raw blocks</EmptyTitle>
          <EmptyDescription>
            The raw OCR response does not contain any parsed blocks.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {result.blocks.map((block, index) => (
        <li
          key={block.key}
          className="flex flex-col gap-3 rounded-lg border border-border px-3 py-3"
        >
          <dl className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">Label</dt>
              <dd>
                <Badge variant="secondary">{block.label ?? "unknown"}</Badge>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Order index</dt>
              <dd>{block.orderIndex ?? index}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-foreground">Raw BBox</dt>
              <dd>
                {(block.bbox ?? [null, null, null, null])
                  .map(formatCoordinate)
                  .join(", ")}
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">Content</h3>
            {block.content.trim().length > 0 ? (
              <p className="overflow-auto whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
                {block.content}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                This raw OCR block has empty content.
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PageBlockContentCard({
  ocrRawJson,
  pagePath,
  selectedTab,
  selectedBlock,
  previousBlock = null,
  nextBlock = null,
  onSelectBlock,
  onSelectedTabChange,
}: PageBlockContentCardProps) {
  const rawBlocksResult = useMemo(
    () => parseRawOcrBlocks(ocrRawJson),
    [ocrRawJson],
  );

  return (
    <PageDetailSideCard
      title="OCR block content"
      actions={
        selectedTab === "blocks" && selectedBlock ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!previousBlock || !onSelectBlock}
              aria-label={
                previousBlock
                  ? `Select previous OCR block: ${formatBlockLabel(previousBlock)}`
                  : "No previous OCR block"
              }
              onClick={() => {
                if (previousBlock) {
                  onSelectBlock?.(previousBlock.id);
                }
              }}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!nextBlock || !onSelectBlock}
              aria-label={
                nextBlock
                  ? `Select next OCR block: ${formatBlockLabel(nextBlock)}`
                  : "No next OCR block"
              }
              onClick={() => {
                if (nextBlock) {
                  onSelectBlock?.(nextBlock.id);
                }
              }}
            >
              Next
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </>
        ) : null
      }
    >
      <Tabs
        value={selectedTab}
        className="gap-4"
        onValueChange={(value) => {
          if (isBlockContentTabValue(value)) {
            onSelectedTabChange(value);
          }
        }}
      >
        <div className="overflow-x-auto pb-1.5">
          <TabsList variant="line" className="min-w-max">
            <TabsTrigger value="blocks">Blocks</TabsTrigger>
            <TabsTrigger value="rawBlocks">Raw blocks</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="blocks">
          <BlocksTabContent pagePath={pagePath} selectedBlock={selectedBlock} />
        </TabsContent>
        <TabsContent value="rawBlocks">
          <RawBlocksTabContent result={rawBlocksResult} />
        </TabsContent>
      </Tabs>
    </PageDetailSideCard>
  );
}
