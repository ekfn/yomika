import type { PageQuery } from "@/graphql/generated/graphql";

export type PageDetail = PageQuery["page"];
export type PageBlock = PageDetail["blocks"][number];
export type PageSegment = PageBlock["segments"][number];

export type PageImageDimensions = {
  width: number;
  height: number;
};
