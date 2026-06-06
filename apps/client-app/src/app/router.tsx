import { useEffect } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import {
  createBrowserRouter,
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ClientShell } from "@/components/common/client-shell";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import {
  CurrentUserDocument,
  LogoutDocument,
} from "@/graphql/generated/graphql";
import { BookDetailRoute } from "@/routes/book-detail-route";
import { LibraryRoute } from "@/routes/library-route";
import { LoginRoute } from "@/routes/login-route";
import { PageDetailRoute } from "@/routes/page-detail-route";
import { RunnerRoute } from "@/routes/runner-route";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginRoute />,
  },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/library" replace />,
      },
      {
        path: "library",
        element: <LibraryRoute />,
      },
      {
        path: "books/*",
        element: <BookDetailRoute />,
      },
      {
        path: "pages/*",
        element: <PageDetailRoute />,
      },
      {
        path: "runner",
        element: <RunnerRoute />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/library" replace />,
  },
]);

function ProtectedLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const client = useApolloClient();
  const { data, loading, error } = useQuery(CurrentUserDocument, {
    fetchPolicy: "cache-and-network",
  });
  const [logout] = useMutation(LogoutDocument);

  useEffect(() => {
    if (!loading && !data?.currentUser) {
      navigate("/login", { replace: true, state: { from: location.pathname } });
    }
  }, [data?.currentUser, loading, location.pathname, navigate]);

  if (loading && !data) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <ErrorState message={error.message} />
        <Link className="mt-4 inline-block text-sm underline" to="/login">
          Login
        </Link>
      </main>
    );
  }

  if (!data?.currentUser) {
    return null;
  }

  return (
    <ClientShell
      currentUserLabel={data.currentUser.label}
      onLogout={async () => {
        await logout();
        await client.clearStore();
        navigate("/login", { replace: true });
      }}
    >
      <Outlet />
    </ClientShell>
  );
}
