import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import type { GetChatCompletionsParameters } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { Injectable } from "@nestjs/common";
import type { AiGenerationModelConfig } from "@/ai/config/ai-processing-config.service";
import { loadAppConfig } from "@/config/app-config";
import { AiProviderRateLimitError } from "./ai-provider-rate-limit.error";
import type {
  AiJsonGenerationInput,
  AiProviderJsonGenerationClient,
} from "./ai-json-generation-client";

const GITHUB_MODELS_ENDPOINT = "https://models.github.ai/inference";
const GITHUB_MODELS_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class GithubModelsJsonGenerationClient implements AiProviderJsonGenerationClient {
  private readonly config = loadAppConfig();

  async generateJson(
    input: AiJsonGenerationInput,
    modelConfig: AiGenerationModelConfig,
  ): Promise<unknown> {
    if (!this.config.githubModelsToken) {
      throw new Error(
        `GitHub Models ${input.operationName} requires GITHUB_MODELS_TOKEN.`,
      );
    }

    const client = ModelClient(
      GITHUB_MODELS_ENDPOINT,
      new AzureKeyCredential(this.config.githubModelsToken),
    );
    const parameters = modelConfig.parameters as Partial<
      GetChatCompletionsParameters["body"]
    > &
      Record<string, unknown>;
    const responseFormatParameters = getRecord(parameters.response_format);
    const jsonSchemaParameters = getRecord(
      responseFormatParameters.json_schema,
    );

    const abortController = new AbortController();
    const response = await withGithubModelsTimeout({
      input,
      modelConfig,
      abortController,
      request: client.path("/chat/completions").post({
        abortSignal: abortController.signal,
        body: {
          ...parameters,
          model: modelConfig.modelId,
          messages: [
            {
              role: "user",
              content: input.prompt,
            },
          ],
          response_format: {
            ...responseFormatParameters,
            type: "json_schema",
            json_schema: {
              ...jsonSchemaParameters,
              name: `${input.operation}_response`,
              schema: input.responseJsonSchema as Record<string, unknown>,
              strict: true,
            },
          },
        },
      }),
    });

    if (isUnexpected(response)) {
      if (response.status === "429") {
        throw new AiProviderRateLimitError(
          `GitHub Models ${input.operationName} was rate limited for ${modelConfig.modelId}.`,
        );
      }

      throw new Error(
        `GitHub Models ${input.operationName} request failed with ${response.status}: ${formatGithubModelsError(response.body)}`,
      );
    }

    const content = response.body.choices[0]?.message.content;

    if (!content) {
      throw new Error(
        `GitHub Models ${input.operationName} returned an empty response.`,
      );
    }

    return JSON.parse(content) as unknown;
  }
}

async function withGithubModelsTimeout<T>(input: {
  input: AiJsonGenerationInput;
  modelConfig: AiGenerationModelConfig;
  abortController: AbortController;
  request: PromiseLike<T>;
}): Promise<T> {
  let didTimeout = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutError = new AiProviderRateLimitError(
    `GitHub Models ${input.input.operationName} timed out after ${formatDuration(
      GITHUB_MODELS_REQUEST_TIMEOUT_MS,
    )} for ${input.modelConfig.modelId}. Treating the model as exhausted for this runner run.`,
  );
  const guardedRequest = Promise.resolve(input.request).catch(
    (error: unknown) => {
      if (didTimeout || isAbortError(error)) {
        throw timeoutError;
      }

      throw error;
    },
  );
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      input.abortController.abort();
      reject(timeoutError);
    }, GITHUB_MODELS_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([guardedRequest, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function formatDuration(durationMs: number): string {
  return `${Math.round(durationMs / 1000)} seconds`;
}

function formatGithubModelsError(error: unknown): string {
  if (typeof error === "object" && error !== null && "error" in error) {
    const innerError = error.error;

    if (
      typeof innerError === "object" &&
      innerError !== null &&
      "message" in innerError &&
      typeof innerError.message === "string"
    ) {
      return innerError.message;
    }
  }

  return JSON.stringify(error);
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
