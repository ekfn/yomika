import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApolloProvider } from "@apollo/client/react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { TooltipProvider } from "@/components/ui";
import { apolloClient } from "@/lib/apollo-client";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </ApolloProvider>
  </StrictMode>,
);
