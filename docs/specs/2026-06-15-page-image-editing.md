# Page Image Editing Spec

## Goal

Add image editing for Yomika pages, using the page image editor behavior from
`abstract-octopus` as closely as possible while adapting persistence to Yomika's
filesystem data model.

The editor must let a user edit the current page source image and save the
result back into the same page. In Yomika, saving must overwrite the page's
current source image file instead of creating a new image record or a new source
image path.

## Non-Goals

- Do not create a new logical source image for the page.
- Do not keep historical source image versions.
- Do not add persistent editable annotation layers.
- Do not add crop, rotate, text, filters, or OCR block editing.
- Do not add database concepts or uploaded image records.
- Do not change the library directory structure beyond rewriting the current
  page source image and preview files.

## Product Behavior

The page actions menu gets a new `Edit image` action. It opens a modal image
editor for the current page source image.

The editor should match `abstract-octopus` as closely as possible and support:

- marker/freehand drawing;
- straight line drawing;
- rectangle drawing with stroke only and no fill;
- filled rectangle drawing;
- rectangular select/move that snapshots the currently visible selected
  fragment, including previous edits, moves that bitmap fragment, fills the
  original location with white, and keeps the moved fragment active until it is
  applied;
- stroke color;
- stroke width;
- undo;
- redo;
- clear edits;
- cancel;
- save.

Saving should:

1. Export the edited canvas.
2. Upload the exported image through the existing page image upload endpoint.
3. Ask the API to overwrite the current page source image with that uploaded
   image.
4. Rebuild the page preview image.
5. Reset OCR and AI processing data for the page.
6. Start the runner so the page can be processed again.
7. Close the modal after the API confirms the update.

If export, upload, overwrite, preview generation, metadata update, or runner
start fails, the modal stays open and shows an error.

Yomika does not support archive state, so the archive/read-only restrictions
from `abstract-octopus` do not apply.

## Data Lifecycle

Editing is modeled as mutating the current page source image in place.

Current page data looks like:

```text
library/
  page.My Page/
    page.json
    source.png
    preview.png
```

or, for a book page:

```text
library/
  book.My Book/
    page.0001/
      page.json
      source.png
      preview.png
```

On save, the API overwrites the file referenced by
`page.sourceImage.fileName`. The page continues to reference the same logical
source image file name.

Because the browser editor export can be PNG while the current source file can
be JPEG or WebP, the API must normalize the uploaded edit before overwriting:

- if the current page source MIME type is `image/png`, write PNG bytes;
- if it is `image/jpeg`, encode the edited image as JPEG and overwrite the
  current `.jpg` file;
- if it is `image/webp`, encode the edited image as WebP and overwrite the
  current `.webp` file.

This avoids writing PNG bytes into a `.jpg` or `.webp` file.

The overwrite should use a temporary file in the same page directory and then
rename it over the current source file. Preview generation should also write a
temporary preview and rename it over the current preview file. If the operation
fails before rename, the existing source image should remain usable.

After overwrite, `page.json` is updated:

- `sourceImage.fileName` stays the same;
- `sourceImage.mimeType` stays the same;
- `sourceImage.sizeBytes`, `widthPx`, and `heightPx` are refreshed from the
  rewritten source file;
- `sourceImage.previewFileName` stays the same when it already exists, normally
  `preview.png`;
- `sourceImage.previewWidthPx` and `previewHeightPx` are refreshed;
- `ocrStatus` becomes `PENDING`;
- `aiProcessingStatus` becomes `CLEAN_UP_PENDING`;
- `ocrRawJson` becomes `null`;
- `blocks` becomes an empty array;
- `updatedAt` is refreshed;
- page settings, `pageNumber`, and `createdAt` are preserved.

The staged upload used for the edit is removed after a successful overwrite. If
the overwrite fails, normal staged upload cleanup may remove it later.

## API Design

Reuse the existing upload endpoint:

- `POST /api/uploads/pages/image`
- client helper: `uploadPageImage(file)`

Add a GraphQL mutation:

```graphql
input OverwritePageSourceImageInput {
  sourceUploadId: String!
}

extend type Mutation {
  overwritePageSourceImage(
    path: String!
    input: OverwritePageSourceImageInput!
  ): Page!
}
```

The resolver delegates to `PagesService.overwritePageSourceImage(path, input)`.

`PagesService.overwritePageSourceImage`:

1. Loads the page record by path.
2. Reads staged upload metadata and requires `kind === "PAGE_IMAGE"`.
3. Reads the staged image file.
4. Converts it with `sharp` to the current source image MIME type.
5. Writes converted bytes to a temporary source file in the page directory.
6. Reads metadata from that temporary source file.
7. Builds a new PNG preview using the same preview sizing rules used by page
   creation.
8. Writes preview bytes to a temporary preview file.
9. Renames temporary files over the current source and preview files.
10. Writes the reset page JSON.
11. Removes the staged upload.
12. Starts the runner.
13. Returns the updated `Page`.

The mutation must be protected by existing GraphQL auth.

## Client Design

Copy the image editor UI and interaction behavior from `abstract-octopus`:

- `ocr-page-image-editor.tsx`
- `ocr-page-image-editor-types.ts`
- `ocr-page-image-editor-export.ts`
- image edit dialog structure

Implementation should be copied from these `abstract-octopus` files as much as
possible, then adapted to Yomika's names, GraphQL operations, and overwrite
persistence model. Do not re-design the image editor interaction model or write
a new editor from scratch unless the existing `abstract-octopus` implementation
cannot be adapted.

Adapt names and paths to Yomika:

- `PageImageEditor`
- `PageImageEditorExportHandle`
- `PageImageEditDialog`
- `buildEditedPageImageFile`

The editor should still export PNG from the browser. The server handles final
conversion to the current source image MIME type.

Add the `Edit image` action to:

- page detail route actions menu;
- page rows in the `/library` tree actions menu.

To avoid making `/library` fetch full source image data for every page, the
library tree action should open the dialog by page path and let the dialog load
the full `Page` query only when opened. The page detail route can pass the
already loaded page data directly.

The modal should:

- use existing dialog, alert, button, and tooltip primitives;
- be large and image-focused;
- keep toolbar controls above the canvas;
- show a modal-level error when save fails;
- disable save while saving;
- disable save when there are no edits;
- close only after the overwrite mutation succeeds.

After save, the client should refetch the active page and relevant library data
through existing callbacks.

## Dependency Notes

The editor uses the same libraries as `abstract-octopus`:

- `konva`
- `react-konva`

These dependencies must be present in `apps/client-app/package.json` and the
lockfile before implementation is typechecked.

## Error Handling

Show a modal-level error when:

- the source image cannot load;
- canvas export fails;
- upload fails;
- the API rejects the staged upload;
- image conversion fails;
- source overwrite fails;
- preview generation fails;
- page JSON write fails;
- runner start fails.

If server-side overwrite fails before replacing the current source file, the old
source image should stay usable. If failure happens after the source file is
overwritten but before `page.json` is written, the API should still return an
error; the page may need a retry, but no new image path or version is created.

## Accessibility

- `Edit image` must be reachable from keyboard through existing dropdown menus.
- Toolbar controls must be real buttons.
- Icon-only buttons must have accessible labels.
- Color and stroke width controls must have labels.
- The modal must keep focus inside while open.

## Acceptance Criteria

- A user can open `Edit image` from the page detail actions menu.
- A user can open `Edit image` from a page item in `/library`.
- A user can draw freehand marker strokes.
- A user can draw straight lines.
- A user can draw outline-only rectangles.
- A user can draw filled rectangles.
- A user can use white as a drawing color.
- A user can select a rectangular image fragment and drag it to another
  position.
- A moved image fragment includes edits that were already visible inside the
  selected area.
- A moved image fragment stays selected and draggable until the user clicks
  outside it, changes tools, starts another selection, or saves the image.
- A user can undo, redo, and clear edits.
- Save is disabled when there are no edits.
- Saving overwrites the current page source image file.
- Saving does not create a new page, image record, source image filename, or
  source image version.
- Saving regenerates the current preview image.
- Saving resets OCR and AI processing state for the page.
- Saving starts the runner.
- The page detail view shows the updated image after save.
- The `/library` tree remains lazily loaded and does not fetch full image data
  for every page just to render the tree.
- `pnpm codegen` passes after GraphQL schema and operation changes.
- `pnpm format` passes.
- `pnpm typecheck` passes.

## Implementation Notes

- Reuse the existing `uploadPageImage(file)` client helper.
- Add a new client GraphQL operation for `overwritePageSourceImage`.
- Use `sharp` on the API side for MIME-preserving conversion.
- Keep preview generation consistent with page creation: max 400px wide and
  600px tall, `fit: "inside"`, `withoutEnlargement: true`, PNG output.
- Use temporary filenames such as `.source.editing.tmp` and
  `.preview.editing.tmp` inside the page directory, and remove them on failure
  when possible.
- Do not add old-image cleanup logic because no new source image file should be
  created.
