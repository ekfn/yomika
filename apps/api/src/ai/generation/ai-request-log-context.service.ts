import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";

type AiRequestLogContext = {
  recordAiRequest: (modelId: string) => Promise<void> | void;
};

@Injectable()
export class AiRequestLogContextService {
  private readonly storage = new AsyncLocalStorage<AiRequestLogContext>();

  run<T>(context: AiRequestLogContext, callback: () => Promise<T>): Promise<T> {
    return this.storage.run(context, callback);
  }

  async recordAiRequest(modelId: string): Promise<void> {
    await this.storage.getStore()?.recordAiRequest(modelId);
  }
}
