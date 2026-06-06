import { useState, type FormEvent } from "react";
import { useApolloClient, useMutation } from "@apollo/client/react";
import { useLocation, useNavigate } from "react-router-dom";
import { LoginDocument } from "@/graphql/generated/graphql";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  TextField,
} from "@/components/ui";

export function LoginRoute() {
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [login, loginState] = useMutation(LoginDocument);
  const client = useApolloClient();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/library";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!password.trim()) {
      setPasswordError("Password is required.");
      return;
    }

    setPasswordError(null);

    try {
      await login({
        variables: {
          input: {
            password,
          },
        },
      });
      await client.resetStore();
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-12 text-stone-900">
      <Card className="w-full max-w-md rounded-3xl py-0">
        <CardHeader className="p-8 pb-0">
          <CardDescription className="text-xs font-semibold uppercase tracking-[0.24em]">
            Client sign in
          </CardDescription>
          <CardTitle className="text-3xl tracking-tight">
            Welcome back
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <form
            className="flex flex-col gap-5"
            noValidate
            onSubmit={handleSubmit}
          >
            <TextField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              error={passwordError}
              value={password}
              onChange={(event) => {
                setPassword(event.currentTarget.value);
                setPasswordError(null);
              }}
            />

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              disabled={loginState.loading}
              size="lg"
              className="w-full"
            >
              {loginState.loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
