import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: "/api/graphql",
    credentials: "include",
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "network-only",
    },
    query: {
      fetchPolicy: "network-only",
    },
  },
  cache: new InMemoryCache({
    typePolicies: {
      Book: {
        keyFields: ["path"],
      },
      Folder: {
        keyFields: ["path"],
      },
      Page: {
        keyFields: ["path"],
      },
      PageSibling: {
        keyFields: ["path"],
      },
      OcrBlock: {
        keyFields: false,
      },
      TranslationSegment: {
        keyFields: false,
      },
    },
  }),
});
