import { resolve } from "node:path";
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo";
import { Module } from "@nestjs/common";
import { GraphQLISODateTime, GraphQLModule } from "@nestjs/graphql";
import { AuthModule } from "@/auth/auth.module";
import { AppConfigResolver } from "@/config/app-config.resolver";
import { FoldersModule } from "@/folders/folders.module";
import type { GraphqlContext } from "@/graphql/graphql-context";
import { HealthResolver } from "@/graphql/health.resolver";
import { LibraryContentsModule } from "@/library-contents/library-contents.module";
import { LibraryModule } from "@/library/library.module";
import { MediaModule } from "@/media/media.module";
import { BooksModule } from "@/books/books.module";
import { PagesModule } from "@/pages/pages.module";
import { RunnerModule } from "@/runner/runner.module";
import { UploadsModule } from "@/uploads/uploads.module";

const apiSourceRoot = resolve(__dirname);

function resolveApiSchemaPath(pattern: string): string {
  return resolve(apiSourceRoot, pattern);
}

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      path: "/graphql/client",
      typePaths: [resolveApiSchemaPath("graphql/client/schema/**/*.graphql")],
      sortSchema: true,
      resolvers: {
        DateTime: GraphQLISODateTime,
      },
      context: ({ req, res }: GraphqlContext): GraphqlContext => ({
        req,
        res,
      }),
    }),
    AuthModule,
    FoldersModule,
    LibraryModule,
    LibraryContentsModule,
    PagesModule,
    BooksModule,
    MediaModule,
    RunnerModule,
    UploadsModule,
  ],
  providers: [AppConfigResolver, HealthResolver],
})
export class AppModule {}
