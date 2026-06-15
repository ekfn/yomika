# Yomika

Yomika is a local app for managing a file-based library of books and pages,
running OCR, and using AI processing for cleanup, splitting, translation, and
vocabulary.

## Processing

Books and pages are processed by the runner. Creating a book or page starts the
runner automatically when it is not already running. You can also open
`/runner` to check progress, start it manually, or ask it to stop after the
current operation.

Processing is sequential. Each step uses the data produced by the previous step,
so a new page gradually moves from a source image to OCR text, cleaned text,
translation segments, translations, and vocabulary.

1. Book import reads a PDF and creates one page for each PDF page. After
   this step, the book page list is populated and each created page has its
   source image ready for OCR.
2. OCR analyzes the source image and detects text blocks with their positions on
   the page. After this step, the page can display detected OCR regions over the
   image and the raw OCR block data.
3. Cleanup sends the OCR blocks to AI and asks it to fix recognition errors,
   normalize the text, and produce clean page blocks. After this step, the page
   has readable cleaned blocks that are better suited for splitting and
   translation.
4. Split sends the cleaned block text to AI and divides it into smaller source
   segments. After this step, each block has segment rows that can be reviewed,
   edited, and translated independently.
5. Translation sends the source segments to AI and fills in translations and
   reading-aware text. After this step, the translation view shows the original
   segment text, the reading view, and the translated text.
6. Vocabulary runs after translation when vocabulary is enabled for the book or
   page. After this step, translated segments can show vocabulary entries with
   readings and translations.

If AI processing is disabled for a book or page, the AI steps are skipped.

## Library Files

Yomika stores display data in the project `library/` directory.

Regular directories are shown as folders in `/library`.

Books are directories whose names start with `book.`:

```text
library/
  book.My Book/
    book.json
    source/
      source.pdf
    page.0001/
      page.json
      source.png
      preview.png
```

Standalone pages are directories whose names start with `page.`:

```text
library/
  page.My Page/
    page.json
    source.png
    preview.png
```

Source files and previews are stored inside the related book or page directory.
The app serves these files from the library for display in the UI.

## Install

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` before starting the app. At minimum, set:

- `APP_PASSWORD`
- `SESSION_SECRET`
- `GEMINI_API_KEY`
- `TRANSLATION_SOURCE_DEFAULT_LANGUAGES`
- `TRANSLATION_TARGET_DEFAULT_LANGUAGE`

Install dependencies:

```bash
pnpm install
```

Install the local OCR runtime if you want to process OCR tasks:

```bash
pnpm ocr:setup
```

On Windows, use:

```bash
pnpm ocr:setup:win
```

Build the app:

```bash
pnpm build
```

## Run

Start the app with the OCR runtime:

```bash
pnpm start
```

On Windows, use:

```bash
pnpm start:win
```

Or start only the app without the OCR runtime to use less memory:

```bash
pnpm start:no-ocr
```

Open:

```text
http://127.0.0.1:43100
```

## Environment

Authentication and session:

| Variable                   | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `APP_PASSWORD`             | Password used to log in                    |
| `SESSION_SECRET`           | Secret used for the session                |
| `ACCESS_TOKEN_COOKIE_NAME` | Login cookie name                          |
| `AUTH_COOKIE_SECURE`       | Set to `true` only when serving over HTTPS |

Ports:

| Variable          | Purpose                |
| ----------------- | ---------------------- |
| `API_PORT`        | Yomika app port        |
| `CLIENT_APP_PORT` | Client dev server port |

Translation defaults:

| Variable                               | Purpose                                              |
| -------------------------------------- | ---------------------------------------------------- |
| `TRANSLATION_SOURCE_DEFAULT_LANGUAGES` | Comma-separated source languages for new books/pages |
| `TRANSLATION_TARGET_DEFAULT_LANGUAGE`  | Target language for new books/pages                  |
| `VOCABULARY_ENABLED_BY_DEFAULT`        | Default vocabulary setting for new books/pages       |

AI and OCR:

| Variable                | Purpose                              |
| ----------------------- | ------------------------------------ |
| `GEMINI_API_KEY`        | Gemini API key for AI processing     |
| `PADDLEOCR_VL_BASE_URL` | PaddleOCR wrapper URL used by Yomika |
| `MLX_VLM_SERVER_URL`    | MLX VLM URL used by the OCR wrapper  |

## Update

```bash
git pull origin main
```

After pulling project changes, install dependencies if `package.json` or
`pnpm-lock.yaml` changed:

```bash
pnpm install
```

Rebuild:

```bash
pnpm build
```

Start again:

```bash
pnpm start
```
