import "reflect-metadata";
import { existsSync } from "node:fs";
import { join } from "node:path";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { loadAppConfig } from "@/config/app-config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const config = loadAppConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProduction = process.env.NODE_ENV === "production";

  app.use(cookieParser());
  rewritePublicApiPaths(app);

  if (!isProduction) {
    app.enableCors({
      origin: `http://localhost:${config.clientAppPort}`,
      credentials: true,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (isProduction) {
    serveClientApp(app, config.clientAppDistDir);
  }

  await app.listen(config.apiPort, "127.0.0.1");
}

void bootstrap();

function rewritePublicApiPaths(app: NestExpressApplication): void {
  app.use((request: Request, _response: Response, next: NextFunction) => {
    request.url = request.url
      .replace(/^\/api\/graphql(?=\/|\?|$)/, "/graphql/client")
      .replace(/^\/api\/uploads(?=\/|\?|$)/, "/uploads");

    next();
  });
}

function serveClientApp(
  app: NestExpressApplication,
  clientAppDistDir: string,
): void {
  const indexPath = join(clientAppDistDir, "index.html");

  if (!existsSync(indexPath)) {
    throw new Error(
      `Client app build was not found at ${indexPath}. Run pnpm build before production start.`,
    );
  }

  app.useStaticAssets(clientAppDistDir, {
    index: false,
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    if (!isClientAppRouteRequest(request)) {
      next();
      return;
    }

    response.sendFile(indexPath);
  });
}

function isClientAppRouteRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  if (!request.accepts("html")) {
    return false;
  }

  return !["/api", "/graphql", "/uploads", "/media", "/assets"].some(
    (prefix) =>
      request.path === prefix || request.path.startsWith(`${prefix}/`),
  );
}
