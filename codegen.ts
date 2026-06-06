import type { CodegenConfig } from "@graphql-codegen/cli";

const clientSchema = [
  "apps/api/src/graphql/client/schema/**/*.graphql",
  "apps/api/src/features/**/graphql/client/schema/**/*.graphql",
];

const config: CodegenConfig = {
  overwrite: true,
  generates: {
    "packages/graphql-schemas/client/schema.graphql": {
      schema: clientSchema,
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
    "apps/client-app/src/graphql/generated/": {
      schema: clientSchema,
      documents: ["apps/client-app/src/graphql/operations/**/*.graphql"],
      preset: "client",
      presetConfig: {
        gqlTagName: "graphql",
        fragmentMasking: false,
      },
    },
  },
};

export default config;
