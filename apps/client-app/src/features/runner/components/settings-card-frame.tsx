import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SettingsCardFrame({
  title,
  description,
  error,
  saveError,
  isRunnerRunning,
  validationErrors,
  headerAction = null,
  footerAction,
  footer,
  children,
}: {
  title: string;
  description: string;
  error: string | null;
  saveError: string | null;
  isRunnerRunning: boolean;
  validationErrors: string[];
  headerAction?: ReactNode;
  footerAction: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {headerAction ? <CardAction>{headerAction}</CardAction> : null}
      </CardHeader>

      <CardContent className="grid gap-6">
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Request failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {isRunnerRunning ? (
          <Alert>
            <AlertTitle>Runner is running</AlertTitle>
            <AlertDescription>
              AI settings can be changed after the current run stops.
            </AlertDescription>
          </Alert>
        ) : null}

        {children}
      </CardContent>

      <CardFooter className="grid gap-3 border-t text-sm text-muted-foreground">
        {saveError ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Save failed</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}

        {validationErrors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Invalid settings</AlertTitle>
            <AlertDescription>
              <ul className="ml-4 list-disc">
                {validationErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {footer}
          </div>
          {footerAction}
        </div>
      </CardFooter>
    </Card>
  );
}

export function SaveButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled}>
      Save
    </Button>
  );
}

export function SettingsFooter({ isSaving }: { isSaving: boolean }) {
  return (
    <>
      <span>Config file: runtime/ai-processing-config.json</span>
      {isSaving ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Saving
        </span>
      ) : null}
    </>
  );
}
