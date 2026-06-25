import { readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { z } from "zod";

const booleanEnvSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");
const optionalSecretEnvSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const portEnvSchema = z.coerce.number().int().min(1).max(65_535);
const ocrProfileEnvSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === "" ? undefined : trimmedValue.toLowerCase();
  },
  z.enum(["full", "fast"]).default("full"),
);
const LIBRARY_DIR = "library";
const RUNNER_STATE_DIR = "runtime/runner";
const AI_PROCESSING_CONFIG_PATH = "runtime/ai-processing-config.json";
const AI_PROCESSING_DEFAULT_CONFIG_PATH = "ai-processing-default-config.json";
const CLIENT_APP_DIST_DIR = "apps/client-app/dist";
const AI_PROCESSING_ENABLED_DEFAULT = true;

const envSchema = z.object({
  APP_PASSWORD: z.string().min(12),
  SESSION_SECRET: z.string().min(16),
  API_PORT: portEnvSchema.default(3000),
  CLIENT_APP_PORT: portEnvSchema.default(5173),
  ACCESS_TOKEN_COOKIE_NAME: z.string().min(1).default("yomika_access_token"),
  AUTH_COOKIE_SECURE: booleanEnvSchema,
  TRANSLATION_SOURCE_DEFAULT_LANGUAGES: z.string().min(1),
  TRANSLATION_TARGET_DEFAULT_LANGUAGE: z.string().min(1),
  VOCABULARY_ENABLED_BY_DEFAULT: booleanEnvSchema,
  PADDLEOCR_VL_BASE_URL: z.string().url(),
  OCR_PROFILE: ocrProfileEnvSchema,
  GEMINI_API_KEY: optionalSecretEnvSchema,
  GITHUB_MODELS_TOKEN: optionalSecretEnvSchema,
});

export type OcrProfile = z.infer<typeof ocrProfileEnvSchema>;

export type AppConfig = {
  appVersion: string;
  appPassword: string;
  sessionSecret: string;
  apiPort: number;
  clientAppPort: number;
  accessTokenCookieName: string;
  authCookieSecure: boolean;
  libraryDir: string;
  runnerStateDir: string;
  aiProcessingConfigPath: string;
  aiProcessingDefaultConfigPath: string;
  clientAppDistDir: string;
  translationSourceLanguages: string[];
  translationTargetLanguage: string;
  aiProcessingEnabled: boolean;
  vocabularyEnabled: boolean;
  paddleOcrVlBaseUrl: string;
  ocrProfile: OcrProfile;
  geminiApiKey: string | undefined;
  githubModelsToken: string | undefined;
};

export function loadAppConfig(projectRoot = findProjectRoot()): AppConfig {
  const env = envSchema.parse(process.env);
  const sourceLanguages = env.TRANSLATION_SOURCE_DEFAULT_LANGUAGES.split(",")
    .map((language) => language.trim())
    .filter((language) => language.length > 0);

  if (sourceLanguages.length === 0) {
    throw new Error(
      "TRANSLATION_SOURCE_DEFAULT_LANGUAGES must include one language.",
    );
  }

  return {
    appVersion: loadPackageVersion(projectRoot),
    appPassword: env.APP_PASSWORD,
    sessionSecret: env.SESSION_SECRET,
    apiPort: env.API_PORT,
    clientAppPort: env.CLIENT_APP_PORT,
    accessTokenCookieName: env.ACCESS_TOKEN_COOKIE_NAME,
    authCookieSecure: env.AUTH_COOKIE_SECURE,
    libraryDir: resolveMaybeRelative(projectRoot, LIBRARY_DIR),
    runnerStateDir: resolveMaybeRelative(projectRoot, RUNNER_STATE_DIR),
    aiProcessingConfigPath: resolveMaybeRelative(
      projectRoot,
      AI_PROCESSING_CONFIG_PATH,
    ),
    aiProcessingDefaultConfigPath: resolveMaybeRelative(
      projectRoot,
      AI_PROCESSING_DEFAULT_CONFIG_PATH,
    ),
    clientAppDistDir: resolveMaybeRelative(projectRoot, CLIENT_APP_DIST_DIR),
    translationSourceLanguages: sourceLanguages,
    translationTargetLanguage: env.TRANSLATION_TARGET_DEFAULT_LANGUAGE,
    aiProcessingEnabled: AI_PROCESSING_ENABLED_DEFAULT,
    vocabularyEnabled: env.VOCABULARY_ENABLED_BY_DEFAULT,
    paddleOcrVlBaseUrl: env.PADDLEOCR_VL_BASE_URL,
    ocrProfile: env.OCR_PROFILE,
    geminiApiKey: env.GEMINI_API_KEY,
    githubModelsToken: env.GITHUB_MODELS_TOKEN,
  };
}

function loadPackageVersion(projectRoot: string): string {
  const packageJsonPath = resolve(projectRoot, "package.json");
  const parsedPackageJson = z
    .object({
      version: z.string().min(1),
    })
    .parse(JSON.parse(readFileSync(packageJsonPath, "utf8")));

  return parsedPackageJson.version;
}

function resolveMaybeRelative(projectRoot: string, path: string): string {
  return isAbsolute(path) ? path : resolve(projectRoot, path);
}

function findProjectRoot(): string {
  const cwd = process.cwd();

  if (basename(cwd) === "api" && basename(dirname(cwd)) === "apps") {
    return resolve(cwd, "../..");
  }

  return cwd;
}
