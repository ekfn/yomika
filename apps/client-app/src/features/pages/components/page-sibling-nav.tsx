import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { getPageRoute } from "@/lib/library-paths";

type PageSibling = {
  path: string;
  pageNumber?: number | null;
};

type PageSiblingNavProps = {
  currentPageNumber?: number | null | undefined;
  totalPageCount?: number | null | undefined;
  previousPage?: PageSibling | null | undefined;
  nextPage?: PageSibling | null | undefined;
  pages?: readonly PageSibling[];
};

export function PageSiblingNav({
  currentPageNumber,
  totalPageCount,
  previousPage,
  nextPage,
  pages = [],
}: PageSiblingNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isPagePickerOpen, setIsPagePickerOpen] = useState(false);
  const [pageNumberInput, setPageNumberInput] = useState("");
  const pageCounter =
    currentPageNumber && totalPageCount
      ? `Page ${currentPageNumber} of ${totalPageCount}`
      : null;

  useEffect(() => {
    setPageNumberInput("");
  }, [currentPageNumber]);

  const pageByNumber = useMemo(() => {
    return new Map(
      pages
        .filter((page) => page.pageNumber != null)
        .map((page) => [page.pageNumber, page]),
    );
  }, [pages]);
  const firstPage = pages.at(0) ?? null;
  const lastPage = pages.at(-1) ?? null;
  const requestedPageNumber = pageNumberInput.trim()
    ? Number(pageNumberInput)
    : null;
  const canJumpToPage =
    requestedPageNumber != null &&
    Number.isInteger(requestedPageNumber) &&
    requestedPageNumber > 0 &&
    requestedPageNumber !== currentPageNumber &&
    pageByNumber.has(requestedPageNumber);
  const canJumpToFirstPage =
    firstPage?.pageNumber != null && firstPage.pageNumber !== currentPageNumber;
  const canJumpToLastPage =
    lastPage?.pageNumber != null && lastPage.pageNumber !== currentPageNumber;

  const navigateToPage = (targetPage: PageSibling) => {
    setIsPagePickerOpen(false);
    setPageNumberInput("");

    navigate({
      pathname: getPageRoute(targetPage.path),
      search: location.search,
    });
  };

  const handlePageJumpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canJumpToPage || requestedPageNumber == null) {
      return;
    }

    const targetPage = pageByNumber.get(requestedPageNumber);

    if (!targetPage) {
      return;
    }

    navigateToPage(targetPage);
  };

  return (
    <nav
      aria-label="Book page navigation"
      className="flex flex-wrap items-center justify-end gap-3"
    >
      {previousPage ? (
        <Button asChild variant="outline" size="sm">
          <Link
            to={{
              pathname: getPageRoute(previousPage.path),
              search: location.search,
            }}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Previous page
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled>
          <ChevronLeftIcon data-icon="inline-start" />
          Previous page
        </Button>
      )}

      {pageCounter && pages.length > 0 ? (
        <Popover open={isPagePickerOpen} onOpenChange={setIsPagePickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              {pageCounter}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <form
              className="flex items-center gap-2"
              onSubmit={handlePageJumpSubmit}
            >
              <Input
                aria-label="Go to page number"
                className="h-9"
                inputMode="numeric"
                min={1}
                max={totalPageCount ?? undefined}
                placeholder="Page number"
                type="number"
                value={pageNumberInput}
                onChange={(event) => {
                  setPageNumberInput(event.target.value);
                }}
              />
              <Button type="submit" disabled={!canJumpToPage}>
                Go
              </Button>
            </form>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canJumpToFirstPage}
                onClick={() => {
                  if (firstPage) {
                    navigateToPage(firstPage);
                  }
                }}
              >
                First page
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canJumpToLastPage}
                onClick={() => {
                  if (lastPage) {
                    navigateToPage(lastPage);
                  }
                }}
              >
                Last page
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : pageCounter ? (
        <span className="text-sm text-muted-foreground">{pageCounter}</span>
      ) : null}

      {nextPage ? (
        <Button asChild variant="outline" size="sm">
          <Link
            to={{
              pathname: getPageRoute(nextPage.path),
              search: location.search,
            }}
          >
            Next page
            <ChevronRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled>
          Next page
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      )}
    </nav>
  );
}
