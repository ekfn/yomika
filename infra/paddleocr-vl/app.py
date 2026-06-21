import asyncio
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from paddleocr import PaddleOCR, PaddleOCRVL

app = FastAPI()
request_semaphore = asyncio.Semaphore(1)


def parse_positive_int(name: str, default: int) -> int:
    raw = os.getenv(name)

    if raw is None or raw == "":
        return default

    value = int(raw)

    if value < 1:
        raise RuntimeError(f"{name} must be greater than 0.")

    return value


PADDLEOCR_VL_CPU_THREADS = parse_positive_int("PADDLEOCR_VL_CPU_THREADS", 16)
PADDLEOCR_VL_MKLDNN_CACHE_CAPACITY = parse_positive_int(
    "PADDLEOCR_VL_MKLDNN_CACHE_CAPACITY",
    32,
)
pipeline = PaddleOCRVL(
    device="cpu",
    pipeline_version="v1.5",
    enable_mkldnn=True,
    mkldnn_cache_capacity=PADDLEOCR_VL_MKLDNN_CACHE_CAPACITY,
    cpu_threads=PADDLEOCR_VL_CPU_THREADS,
    use_doc_orientation_classify=True,
    use_doc_unwarping=True,
)
text_presence_pipeline = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    lang="japan",
    ocr_version="PP-OCRv5",
)
PREDICT_OPTION_NAME_MAP = {
    "useDocOrientationClassify": "use_doc_orientation_classify",
    "useDocUnwarping": "use_doc_unwarping",
    "useOcrForImageBlock": "use_ocr_for_image_block",
    "mergeLayoutBlocks": "merge_layout_blocks",
}


def parse_predict_options(raw_options: str | None) -> dict[str, bool]:
    if raw_options is None or raw_options == "":
        return {}

    try:
        parsed = json.loads(raw_options)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=400,
            detail="The OCR options payload must be valid JSON.",
        ) from error

    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=400,
            detail="The OCR options payload must be a JSON object.",
        )

    predict_options: dict[str, bool] = {}

    for key, value in parsed.items():
        mapped_key = PREDICT_OPTION_NAME_MAP.get(key)

        if mapped_key is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported OCR option: {key}.",
            )

        if not isinstance(value, bool):
            raise HTTPException(
                status_code=400,
                detail=f"OCR option {key} must be a boolean.",
            )

        predict_options[mapped_key] = value

    return predict_options


def get_result_payload(result):
    if not hasattr(result, "json"):
        return None

    payload = result.json

    if callable(payload):
        payload = payload()

    if isinstance(payload, str):
        payload = json.loads(payload)

    if not isinstance(payload, dict):
        return None

    payload_result = payload.get("res")

    return payload_result if isinstance(payload_result, dict) else None


def get_text_image_block_bbox(block_bbox):
    if (
        not isinstance(block_bbox, list)
        or len(block_bbox) != 4
        or any(not isinstance(value, (int, float)) for value in block_bbox)
    ):
        return None

    return block_bbox


def get_text_image_block_sort_value(block, key):
    value = block.get(key)

    return value if isinstance(value, (int, float)) else 0


def get_text_image_blocks(payload):
    parsing_res_list = payload.get("parsing_res_list")
    lines = []

    if not isinstance(parsing_res_list, list):
        return lines

    blocks = []

    for block in parsing_res_list:
        if not isinstance(block, dict):
            continue

        content = block.get("block_content")

        if not isinstance(content, str):
            continue

        text = content.strip()

        if not text:
            continue

        blocks.append(
            {
                "block": block,
                "line": {
                    "text": text,
                    "confidence": None,
                    "bbox": get_text_image_block_bbox(block.get("block_bbox")),
                },
            }
        )

    blocks.sort(
        key=lambda item: (
            get_text_image_block_sort_value(item["block"], "block_order"),
            get_text_image_block_sort_value(item["block"], "block_id"),
        )
    )

    return [item["line"] for item in blocks]


def parse_text_image_vl_results(results):
    lines = []

    for result in results:
        payload = get_result_payload(result)

        if payload is None:
            continue

        lines.extend(get_text_image_blocks(payload))

    return {
        "text": "\n".join(line["text"] for line in lines),
        "lines": lines,
    }


def get_plain_ocr_rec_texts(payload):
    rec_texts = payload.get("rec_texts")

    if not isinstance(rec_texts, list):
        return []

    return [
        text.strip()
        for text in rec_texts
        if isinstance(text, str) and len(text.strip()) > 1
    ]


def get_plain_ocr_line_bbox(raw_box):
    if isinstance(raw_box, list) and len(raw_box) == 4 and all(
        isinstance(value, (int, float)) for value in raw_box
    ):
        return raw_box

    if not isinstance(raw_box, list):
        return None

    points = []

    for point in raw_box:
        if (
            not isinstance(point, list)
            or len(point) < 2
            or not isinstance(point[0], (int, float))
            or not isinstance(point[1], (int, float))
        ):
            return None

        points.append((point[0], point[1]))

    if not points:
        return None

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]

    return [min(xs), min(ys), max(xs), max(ys)]


def get_plain_ocr_line_confidence(raw_scores, index):
    if not isinstance(raw_scores, list) or index >= len(raw_scores):
        return None

    score = raw_scores[index]

    return score if isinstance(score, (int, float)) else None


def get_plain_ocr_line_boxes(payload):
    for key in ("rec_boxes", "rec_polys", "dt_polys"):
        boxes = payload.get(key)

        if isinstance(boxes, list):
            return boxes

    return []


def get_plain_ocr_lines(payload):
    rec_texts = payload.get("rec_texts")

    if not isinstance(rec_texts, list):
        return []

    raw_boxes = get_plain_ocr_line_boxes(payload)
    raw_scores = payload.get("rec_scores")
    lines = []

    for index, text in enumerate(rec_texts):
        if not isinstance(text, str) or not text.strip():
            continue

        if index >= len(raw_boxes):
            continue

        bbox = get_plain_ocr_line_bbox(raw_boxes[index])

        if bbox is None:
            continue

        lines.append(
            {
                "text": text.strip(),
                "confidence": get_plain_ocr_line_confidence(raw_scores, index),
                "bbox": bbox,
            }
        )

    return lines


def parse_text_detection_results(results):
    lines = []

    for result in results:
        payload = get_result_payload(result)

        if payload is None:
            continue

        lines.extend(get_plain_ocr_lines(payload))

    return {
        "text": "\n".join(line["text"] for line in lines),
        "lines": lines,
    }


def has_plain_ocr_text(results):
    for result in results:
        payload = get_result_payload(result)

        if payload is None:
            continue

        if get_plain_ocr_rec_texts(payload):
            return True

    return False


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr/paddleocr-vl/page-image")
async def run_ocr(
    file: UploadFile = File(...),
    options: str | None = Form(None),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="A file upload is required.")

    payload = await file.read()

    if not payload:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    async with request_semaphore:
        try:
            suffix = Path(file.filename).suffix or ".png"
            predict_options = parse_predict_options(options)

            with TemporaryDirectory() as workdir_name:
                workdir = Path(workdir_name)
                input_path = workdir / f"source{suffix}"
                input_path.write_bytes(payload)
                results = []

                for result in pipeline.predict(
                    input=str(input_path),
                    **predict_options,
                ):
                    if hasattr(result, "json"):
                        results.append(result.json)
                    else:
                        results.append(result)

                if not results:
                    raise HTTPException(
                        status_code=422,
                        detail="PaddleOCR-VL returned no page results.",
                    )

                return {"results": results}
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=500, detail=f"OCR failed: {error}") from error


@app.post("/ocr/paddleocr/text-detection")
async def run_text_detection_ocr(
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="A file upload is required.")

    payload = await file.read()

    if not payload:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    async with request_semaphore:
        try:
            suffix = Path(file.filename).suffix or ".png"

            with TemporaryDirectory() as workdir_name:
                workdir = Path(workdir_name)
                input_path = workdir / f"source{suffix}"
                input_path.write_bytes(payload)
                results = list(text_presence_pipeline.predict(input=str(input_path)))

                return parse_text_detection_results(results)
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=500, detail=f"OCR failed: {error}") from error


@app.post("/ocr/paddleocr/text-image")
async def run_text_image_ocr(
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="A file upload is required.")

    payload = await file.read()

    if not payload:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    async with request_semaphore:
        try:
            suffix = Path(file.filename).suffix or ".png"

            with TemporaryDirectory() as workdir_name:
                workdir = Path(workdir_name)
                input_path = workdir / f"source{suffix}"
                input_path.write_bytes(payload)
                text_presence_results = list(
                    text_presence_pipeline.predict(input=str(input_path))
                )

                if not has_plain_ocr_text(text_presence_results):
                    return {"text": "", "lines": []}

                results = list(
                    pipeline.predict(
                        input=str(input_path),
                        use_doc_orientation_classify=False,
                        use_doc_unwarping=False,
                        use_ocr_for_image_block=True,
                        merge_layout_blocks=False,
                    )
                )

                return parse_text_image_vl_results(results)
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=500, detail=f"OCR failed: {error}") from error
