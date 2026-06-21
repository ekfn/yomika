const OCR_RUNTIME_VALUES = new Set(["cpu", "gpu"]);
const OCR_PROFILE_VALUES = new Set(["full", "fast"]);
const LOCAL_OCR_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function loadOcrRuntime() {
  const rawRuntime = process.env.OCR_RUNTIME;

  if (!rawRuntime || rawRuntime.trim() === "") {
    throw new Error("OCR_RUNTIME is required. Set it to cpu or gpu.");
  }

  const runtime = rawRuntime.trim().toLowerCase();

  if (!OCR_RUNTIME_VALUES.has(runtime)) {
    throw new Error("OCR_RUNTIME must be either cpu or gpu.");
  }

  return runtime;
}

export function loadOcrProfile() {
  const rawProfile = process.env.OCR_PROFILE;

  if (!rawProfile || rawProfile.trim() === "") {
    return "full";
  }

  const profile = rawProfile.trim().toLowerCase();

  if (!OCR_PROFILE_VALUES.has(profile)) {
    throw new Error("OCR_PROFILE must be either full or fast.");
  }

  return profile;
}

export function loadPaddleOcrVlBaseUrl() {
  const rawBaseUrl = process.env.PADDLEOCR_VL_BASE_URL;

  if (!rawBaseUrl || rawBaseUrl.trim() === "") {
    throw new Error("PADDLEOCR_VL_BASE_URL is required.");
  }

  let baseUrl;

  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error("PADDLEOCR_VL_BASE_URL must be a valid URL.");
  }

  if (baseUrl.protocol !== "http:") {
    throw new Error("PADDLEOCR_VL_BASE_URL must use http://.");
  }

  if (!LOCAL_OCR_HOSTS.has(baseUrl.hostname)) {
    throw new Error("PADDLEOCR_VL_BASE_URL must use 127.0.0.1 or localhost.");
  }

  if (!baseUrl.port) {
    throw new Error("PADDLEOCR_VL_BASE_URL must include an explicit port.");
  }

  return baseUrl;
}
