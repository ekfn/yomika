import { Injectable } from "@nestjs/common";

const REQUEST_WINDOW_MS = 60_000;
const REQUEST_WINDOW_PADDING_MS = 25;

@Injectable()
export class AiModelRunStateService {
  private readonly exhaustedModelIds = new Set<string>();
  private readonly requestTimestampsByModelId = new Map<string, number[]>();

  reset(): void {
    this.exhaustedModelIds.clear();
    this.requestTimestampsByModelId.clear();
  }

  isModelExhausted(modelId: string): boolean {
    return this.exhaustedModelIds.has(modelId);
  }

  hasAvailableModel(modelIds: readonly string[]): boolean {
    return modelIds.some((modelId) => !this.isModelExhausted(modelId));
  }

  getExhaustedModelIds(): string[] {
    return [...this.exhaustedModelIds];
  }

  markModelExhausted(modelId: string): void {
    this.exhaustedModelIds.add(modelId);
  }

  async waitForRequestSlot(
    modelId: string,
    requestsPerMinute: number,
  ): Promise<void> {
    while (true) {
      const now = Date.now();
      const timestamps = this.pruneModelRequestTimestamps(modelId, now);

      if (timestamps.length < requestsPerMinute) {
        timestamps.push(now);
        this.requestTimestampsByModelId.set(modelId, timestamps);
        return;
      }

      const oldestTimestamp = timestamps[0] ?? now;
      const waitMs =
        oldestTimestamp + REQUEST_WINDOW_MS - now + REQUEST_WINDOW_PADDING_MS;
      await delay(Math.max(waitMs, REQUEST_WINDOW_PADDING_MS));
    }
  }

  private pruneModelRequestTimestamps(modelId: string, now: number): number[] {
    const timestamps = this.requestTimestampsByModelId.get(modelId) ?? [];
    const threshold = now - REQUEST_WINDOW_MS;
    const activeTimestamps = timestamps.filter(
      (timestamp) => timestamp > threshold,
    );

    this.requestTimestampsByModelId.set(modelId, activeTimestamps);
    return activeTimestamps;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
