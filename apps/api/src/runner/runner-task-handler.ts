import type { RunnerTask } from "./runner-types";

export interface RunnerTaskHandler {
  run(task: RunnerTask): Promise<void>;
}
