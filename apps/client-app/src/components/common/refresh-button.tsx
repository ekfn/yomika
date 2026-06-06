import { CheckIcon, RefreshCwIcon } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { Button } from "@/components/ui";

const REFRESH_SUCCESS_VISIBLE_MS = 1000;

type RefreshButtonProps = Omit<
  ComponentPropsWithoutRef<typeof Button>,
  "children" | "onClick" | "type" | "variant"
> & {
  label?: string;
  loading?: boolean;
  onClick?: () => Promise<unknown> | unknown;
  onRefresh?: () => Promise<unknown> | unknown;
};

export function RefreshButton({
  label = "Refresh",
  disabled,
  loading,
  onClick,
  onRefresh,
  ...props
}: RefreshButtonProps) {
  const [showProgress, setShowProgress] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const isRefreshingRef = useRef(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoading = loading ?? showProgress;
  const refreshHandler = onRefresh ?? onClick;

  const clearSuccessTimeout = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  };

  useEffect(() => clearSuccessTimeout, []);

  const handleClick = () => {
    if (disabled || isRefreshingRef.current || !refreshHandler) {
      return;
    }

    isRefreshingRef.current = true;
    clearSuccessTimeout();
    setShowSuccess(false);
    setShowProgress(true);

    void Promise.resolve(refreshHandler())
      .then(() => {
        setShowSuccess(true);
        successTimeoutRef.current = setTimeout(() => {
          setShowSuccess(false);
          successTimeoutRef.current = null;
        }, REFRESH_SUCCESS_VISIBLE_MS);
      })
      .catch(() => {
        setShowSuccess(false);
      })
      .finally(() => {
        isRefreshingRef.current = false;
        setShowProgress(false);
      });
  };

  const Icon = showSuccess ? CheckIcon : RefreshCwIcon;

  return (
    <Button
      {...props}
      type="button"
      variant="outline"
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      onClick={handleClick}
    >
      <Icon
        className={isLoading ? "animate-spin" : undefined}
        aria-hidden="true"
      />
      {label}
    </Button>
  );
}
