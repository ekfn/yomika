import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

type ErrorStateProps = {
  title?: string;
  message?: string;
};

export function ErrorState({
  title = "Request failed",
  message,
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="min-h-32">
      <AlertTriangle />
      <AlertTitle>{title}</AlertTitle>
      {message ? <AlertDescription>{message}</AlertDescription> : null}
    </Alert>
  );
}
