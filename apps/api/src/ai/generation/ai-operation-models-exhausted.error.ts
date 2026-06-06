import type { AiProcessingOperation } from "@/ai/config/ai-processing-config-schemas";

export class AiOperationModelsExhaustedError extends Error {
  readonly operation: AiProcessingOperation;
  readonly operationName: string;
  readonly modelIds: string[];

  constructor(input: {
    operation: AiProcessingOperation;
    operationName: string;
    modelIds: string[];
  }) {
    super(
      `Gemini ${input.operationName} could not run because every configured model returned 429 in this runner run: ${input.modelIds.join(", ")}.`,
    );
    this.name = "AiOperationModelsExhaustedError";
    this.operation = input.operation;
    this.operationName = input.operationName;
    this.modelIds = input.modelIds;
  }
}

export function isAiOperationModelsExhaustedError(
  error: unknown,
): error is AiOperationModelsExhaustedError {
  return error instanceof AiOperationModelsExhaustedError;
}
