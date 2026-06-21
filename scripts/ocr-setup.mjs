import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOcrRuntime } from "./ocr-env.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const modes = {
  cpu: {
    venvDir: ".venv_paddleocr_cpu",
    packageName: "paddlepaddle==3.2.1",
    packageIndex: "https://www.paddlepaddle.org.cn/packages/stable/cpu/",
  },
  gpu: {
    venvDir: ".venv_paddleocr_gpu",
    packageName: "paddlepaddle-gpu==3.2.1",
    packageIndex: "https://www.paddlepaddle.org.cn/packages/stable/cu126/",
  },
};

let mode;

try {
  mode = loadOcrRuntime();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const config = modes[mode];

const python = process.env.PYTHON ?? "python";
const venvPython =
  process.platform === "win32"
    ? join(projectRoot, config.venvDir, "Scripts", "python.exe")
    : join(projectRoot, config.venvDir, "bin", "python");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(python, ["-m", "venv", config.venvDir]);
run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"]);
run(venvPython, [
  "-m",
  "pip",
  "install",
  config.packageName,
  "-i",
  config.packageIndex,
]);
run(venvPython, [
  "-m",
  "pip",
  "install",
  "-r",
  "infra/paddleocr-vl/requirements.txt",
]);
