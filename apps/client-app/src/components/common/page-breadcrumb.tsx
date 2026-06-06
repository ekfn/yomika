import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui";

type PageBreadcrumbItem = {
  label: string;
  to?: string;
  icon?: ReactNode;
  ariaLabel?: string;
  linkWhenCurrent?: boolean;
};

type PageBreadcrumbProps = {
  items: PageBreadcrumbItem[];
};

function PageBreadcrumbItemContent({ item }: { item: PageBreadcrumbItem }) {
  if (!item.icon) {
    return item.label;
  }

  if (item.ariaLabel) {
    return item.icon;
  }

  return (
    <span className="flex items-center gap-1.5">
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
}

export function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isCurrentPage = index === items.length - 1;
          const shouldRenderLink =
            Boolean(item.to) && (!isCurrentPage || item.linkWhenCurrent);

          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {shouldRenderLink ? (
                  <BreadcrumbLink asChild>
                    <Link to={item.to ?? ""} aria-label={item.ariaLabel}>
                      <PageBreadcrumbItemContent item={item} />
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage aria-label={item.ariaLabel}>
                    <PageBreadcrumbItemContent item={item} />
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
