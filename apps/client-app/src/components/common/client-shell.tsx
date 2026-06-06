import {
  FolderIcon,
  LogOutIcon,
  MenuIcon,
  PlayCircleIcon,
  type LucideIcon,
} from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";
import { useQuery } from "@apollo/client/react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { RunnerState, RunnerStatusDocument } from "@/graphql/generated/graphql";
import { cn } from "@/lib/utils";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui";

type ClientShellProps = {
  children: ReactNode;
  currentUserLabel: string;
  onLogout: () => Promise<void>;
};

type ClientShellLogo = {
  label: string;
  to: string;
  Icon: (props: ComponentPropsWithoutRef<"svg">) => ReactElement;
};

type ClientShellNavItem = {
  label: string;
  to: string;
  Icon: LucideIcon;
};

const CLIENT_SHELL_LOGO = {
  label: "Yomika",
  to: "/library",
  Icon: YomikaLogoIcon,
} as const satisfies ClientShellLogo;

const CLIENT_SHELL_NAV_ITEMS = [
  {
    label: "Library",
    to: "/library",
    Icon: FolderIcon,
  },
  {
    label: "Runner",
    to: "/runner",
    Icon: PlayCircleIcon,
  },
] as const satisfies readonly ClientShellNavItem[];

const YOMIKA_LOGO_YO_PATH =
  "M13.45 16.75 Q13.28 19 11.93 20.12 Q10.59 21.25 8.38 21.25 Q7.13 21.25 5.98 20.78 Q4.82 20.31 4.08 19.37 Q3.35 18.43 3.35 17.07 Q3.35 16.37 3.61 15.68 Q3.88 15 4.49 14.38 Q6 12.87 8.75 12.87 Q9.19 12.87 9.63 12.92 Q10.06 12.96 10.55 13.03 Q10.52 10.95 10.44 8.33 Q10.35 5.7 10.24 3.06 Q10.24 2.75 10.55 2.75 L13.1 2.77 Q13.37 2.77 13.41 3.08 L13.43 6.71 L19.66 6.64 Q19.97 6.64 19.97 6.95 L19.97 9.11 Q19.97 9.42 19.66 9.42 L13.45 9.46 L13.48 13.79 Q15.12 14.41 16.92 15.41 Q18.72 16.42 20.52 17.82 Q20.65 17.9 20.65 18.06 Q20.65 18.14 20.58 18.25 L19.01 20.4 Q18.92 20.53 18.79 20.53 Q18.72 20.53 18.59 20.44 Q17.52 19.48 16.17 18.48 Q14.81 17.49 13.45 16.75 Z M6.19 17.1 Q6.19 17.64 6.53 17.99 Q6.87 18.34 7.38 18.49 Q7.88 18.65 8.34 18.65 Q9.34 18.65 9.82 18.22 Q10.31 17.79 10.45 17.07 Q10.59 16.35 10.59 15.52 Q9.74 15.28 8.86 15.28 Q8.18 15.28 7.57 15.48 Q6.96 15.67 6.57 16.18 Q6.19 16.57 6.19 17.1 Z";

function YomikaLogoIcon({
  className,
  ...props
}: ComponentPropsWithoutRef<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path
        d={YOMIKA_LOGO_YO_PATH}
        fill="#c83a45"
        stroke="#fff"
        strokeLinejoin="round"
        strokeWidth="1.35"
        paintOrder="stroke fill"
      />
    </svg>
  );
}

const clientShellAsideClasses =
  "relative z-10 hidden overflow-hidden border-r border-stone-200 bg-white px-3 py-8 lg:block lg:w-16";

const clientShellNavItemClasses =
  "flex h-10 w-full items-center justify-start gap-3 overflow-hidden rounded-md bg-transparent px-2 text-left text-sm font-medium text-stone-700 transition-colors";

const clientShellNavButtonResetClasses =
  "active:not-aria-[haspopup]:translate-y-0 disabled:pointer-events-none disabled:opacity-100";

const clientShellNavItemInteractiveClasses =
  "hover:bg-stone-100 hover:text-stone-950";

const clientShellNavItemActiveClasses = "bg-stone-100 text-stone-950";

const clientShellNavIconClasses = "size-5 shrink-0";

const clientShellLabelClasses = "min-w-0 flex-1 truncate lg:hidden";

type ClientShellRunnerMenuStatus = {
  label: string;
  indicatorClassName: string;
};

const isClientShellPathActive = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`);

function getClientShellRunnerMenuStatus(
  state: RunnerState | null | undefined,
): ClientShellRunnerMenuStatus {
  if (state === RunnerState.Running) {
    return {
      label: "Running",
      indicatorClassName: "bg-emerald-500",
    };
  }

  if (state === RunnerState.StoppedAfterError) {
    return {
      label: "Stopped after error",
      indicatorClassName: "bg-red-500",
    };
  }

  if (state === RunnerState.IdleWithSkippedTasks) {
    return {
      label: "Skipped tasks",
      indicatorClassName: "bg-amber-500",
    };
  }

  return {
    label: "Idle",
    indicatorClassName: "bg-stone-400",
  };
}

function getClientShellNavItemStatus(
  to: string,
  runnerMenuStatus: ClientShellRunnerMenuStatus,
): ClientShellRunnerMenuStatus | null {
  return to === "/runner" ? runnerMenuStatus : null;
}

function getClientShellNavItemLabel(
  label: string,
  status: ClientShellRunnerMenuStatus | null,
): string {
  return status ? `${label} (${status.label})` : label;
}

function ClientShellNavIcon({
  className,
  Icon,
  status,
  ...props
}: {
  Icon: LucideIcon;
  status: ClientShellRunnerMenuStatus | null;
} & ComponentPropsWithoutRef<"span">) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} {...props}>
      <Icon className={clientShellNavIconClasses} />
      {status ? (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-white",
            status.indicatorClassName,
          )}
        />
      ) : null}
    </span>
  );
}

export function ClientShell({
  children,
  currentUserLabel,
  onLogout,
}: ClientShellProps) {
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { data: runnerStatusData } = useQuery(RunnerStatusDocument, {
    pollInterval: 2000,
    skipPollAttempt: () => document.visibilityState !== "visible",
  });
  const LogoIcon = CLIENT_SHELL_LOGO.Icon;
  const logoutLabel = isSigningOut ? "Signing out..." : "Sign out";
  const runnerMenuStatus = getClientShellRunnerMenuStatus(
    runnerStatusData?.runnerStatus.state,
  );

  const handleLogout = async () => {
    setIsSigningOut(true);

    try {
      await onLogout();
      setIsMobileMenuOpen(false);
    } finally {
      setIsSigningOut(false);
    }
  };

  const withCollapsedTooltip = (label: string, child: ReactElement) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{child}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="flex h-14 items-center justify-between border-b border-stone-200 bg-white px-4 lg:hidden">
        <Link
          to={CLIENT_SHELL_LOGO.to}
          aria-label={CLIENT_SHELL_LOGO.label}
          className="flex min-w-0 items-center gap-2 text-stone-950"
        >
          <LogoIcon className="size-6 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate text-base font-semibold tracking-tight">
            {CLIENT_SHELL_LOGO.label}
          </span>
        </Link>

        <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Open menu"
            >
              <MenuIcon />
            </Button>
          </DialogTrigger>
          <DialogContent className="fixed top-0 right-0 left-auto flex h-dvh w-80 max-w-[calc(100%-2rem)] translate-x-0 translate-y-0 flex-col content-start gap-6 rounded-none p-4 sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex min-w-0 items-center gap-2">
                <LogoIcon className="size-6 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">
                  {CLIENT_SHELL_LOGO.label}
                </span>
              </DialogTitle>
              <p className="truncate text-sm text-muted-foreground">
                {currentUserLabel}
              </p>
            </DialogHeader>

            <nav className="flex flex-col gap-2">
              {CLIENT_SHELL_NAV_ITEMS.map(({ to, label, Icon }) => {
                const isActive = isClientShellPathActive(pathname, to);
                const menuStatus = getClientShellNavItemStatus(
                  to,
                  runnerMenuStatus,
                );

                return (
                  <NavLink
                    key={to}
                    to={to}
                    aria-label={getClientShellNavItemLabel(label, menuStatus)}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      clientShellNavItemClasses,
                      clientShellNavItemInteractiveClasses,
                      isActive && clientShellNavItemActiveClasses,
                    )}
                  >
                    <ClientShellNavIcon
                      Icon={Icon}
                      status={menuStatus}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-auto">
              <Separator className="my-4" />
              <Button
                type="button"
                variant="ghost"
                disabled={isSigningOut}
                aria-label={logoutLabel}
                onClick={() => void handleLogout()}
                className={cn(
                  clientShellNavItemClasses,
                  clientShellNavButtonResetClasses,
                  clientShellNavItemInteractiveClasses,
                )}
              >
                <LogOutIcon
                  className={clientShellNavIconClasses}
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{logoutLabel}</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>
      <div className="lg:flex lg:min-h-screen">
        <aside className={clientShellAsideClasses}>
          {withCollapsedTooltip(
            CLIENT_SHELL_LOGO.label,
            <Link
              to={CLIENT_SHELL_LOGO.to}
              aria-label={CLIENT_SHELL_LOGO.label}
              className={cn(clientShellNavItemClasses, "text-stone-950")}
            >
              <LogoIcon className="size-6 shrink-0" aria-hidden="true" />
              <span
                className={cn(
                  "text-lg font-semibold tracking-tight",
                  clientShellLabelClasses,
                )}
              >
                {CLIENT_SHELL_LOGO.label}
              </span>
            </Link>,
          )}

          <p
            className={cn(
              "mt-3 px-2 text-sm text-stone-500",
              clientShellLabelClasses,
            )}
          >
            {currentUserLabel}
          </p>

          <nav className="mt-8 flex flex-col gap-2">
            {CLIENT_SHELL_NAV_ITEMS.map(({ to, label, Icon }) => {
              const isActive = isClientShellPathActive(pathname, to);
              const menuStatus = getClientShellNavItemStatus(
                to,
                runnerMenuStatus,
              );
              const tooltipLabel = getClientShellNavItemLabel(
                label,
                menuStatus,
              );

              return (
                <div key={to}>
                  {withCollapsedTooltip(
                    tooltipLabel,
                    <NavLink
                      to={to}
                      aria-label={tooltipLabel}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        clientShellNavItemClasses,
                        clientShellNavItemInteractiveClasses,
                        isActive && clientShellNavItemActiveClasses,
                      )}
                    >
                      <ClientShellNavIcon
                        Icon={Icon}
                        status={menuStatus}
                        aria-hidden="true"
                      />
                      <span className={clientShellLabelClasses}>{label}</span>
                    </NavLink>,
                  )}
                </div>
              );
            })}
          </nav>

          <div className="mt-8">
            <Separator className="my-4" />
            {withCollapsedTooltip(
              logoutLabel,
              <Button
                type="button"
                variant="ghost"
                disabled={isSigningOut}
                aria-label={logoutLabel}
                onClick={() => void handleLogout()}
                className={cn(
                  clientShellNavItemClasses,
                  clientShellNavButtonResetClasses,
                  clientShellNavItemInteractiveClasses,
                )}
              >
                <LogOutIcon
                  className={clientShellNavIconClasses}
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                <span className={clientShellLabelClasses}>{logoutLabel}</span>
              </Button>,
            )}
          </div>
        </aside>

        <main className="min-w-0 px-6 py-8 lg:flex-1 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
