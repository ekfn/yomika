import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOcrRuntime, loadPaddleOcrVlBaseUrl } from "./ocr-env.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
let mode;
let paddleOcrVlBaseUrl;

try {
  mode = loadOcrRuntime();
  paddleOcrVlBaseUrl = loadPaddleOcrVlBaseUrl();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const venvDir = `.venv_paddleocr_${mode}`;
const venvPython =
  process.platform === "win32"
    ? join(projectRoot, venvDir, "Scripts", "python.exe")
    : join(projectRoot, venvDir, "bin", "python");

if (!existsSync(venvPython)) {
  console.error(
    `OCR ${mode} runtime is not installed. Run pnpm ocr:setup first.`,
  );
  process.exit(1);
}

const result = spawnSync(
  venvPython,
  [
    "-m",
    "uvicorn",
    "--app-dir",
    "infra/paddleocr-vl",
    "app:app",
    "--host",
    paddleOcrVlBaseUrl.hostname,
    "--port",
    paddleOcrVlBaseUrl.port,
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      YOMIKA_OCR_DEVICE: mode,
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
