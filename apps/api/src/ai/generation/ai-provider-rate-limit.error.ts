export class AiProviderRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderRateLimitError";
  }
}

export function isAiProviderRateLimitError(
  error: unknown,
): error is AiProviderRateLimitError {
  return error instanceof AiProviderRateLimitError;
}
