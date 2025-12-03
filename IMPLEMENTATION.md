# Image Variation Feature Plan

## Vision
Enable a simple parent/child relationship for Cloudflare images so every upload can optionally belong to a canonical image and the gallery/detail screens surface those relationships (iconic cues, variation lists, copy controls). This lets users keep a single “master” image while storing aspect-ratio or stylistic alternatives as children.

## Backend work

1. **Persist the relationship in Cloudflare metadata**
   - Introduce a metadata key such as `variationParentId`. Children store the parent’s image ID, parents omit it (canonical). Keep all other metadata (tags, folder, alt text, etc.) intact by merging with the existing metadata block instead of overwriting it.
   - Extend `GET /api/images` and `GET /api/images/:id` to parse and return `parentId` plus any derived fields we need (e.g., `hasChildren`, `childrenCount`) so the UI can compute indicators without extra fetches.
2. **Make uploads/updates aware of parents**
   - Allow `/api/upload` (and `/api/upload/external`) to accept a `parentId` form field and write it into the metadata payload.
   - Update `/api/images/:id/update` to accept a `parentId` entry, merge it into metadata, and preserve existing metadata properties (alt tag, description, etc.). Keep the update response in sync so clients can refresh local state easily.
3. **Support assignment/detachment flows**
   - Reuse the PATCH route to clear a `parentId` for detaching a child or assign a new parent. Ensure any downstream callers (frontend detail page, uploader) handle success/failure cleanly.

## UI work

1. **ImageUploader**
   - Fetch canonical images (those without `parentId`) and surface them in a `Variation of…` select/dropdown. Allow selecting “None” to keep the image canonical.
   - Send the selected parent ID alongside the upload form so new uploads are correctly categorized.
   - Provide a short helper copy (e.g., “Upload a variation of an existing image to keep them grouped”).
2. **ImageGallery**
   - Compute a `childrenMap` from the fetched images (filter by `parentId`) and mark images that have children.
   - Add a small semantic icon (layers, stacked squares, etc.) near the filename or inside the metadata footer whenever `childrenCount > 0`. Consider a tooltip like “Has variations”.
   - Optionally show a badge with the number of variations when there’s room.
3. **Image detail page**
   - Show a “Variations” panel listing all direct children (thumbnails + filename + uploaded date) with copy buttons (copy the child’s original URL) and a “Detach” action that clears its `parentId`.
   - If the current image itself has a `parentId`, show a “Member of [parent filename]” bar with a “Detach” button and, below it, a `Parent` select to reassign to another canonical image.
   - On the canonical side, add a control to “Adopt an existing image as a variation” so admins can pick any unassigned image and set its `parentId` to the current image.
   - Refresh the page data after metadata updates so the list of variations stays accurate; show toast feedback on success/failure.

## Data & UX sync

- Keep the gallery and detail page’s `images` cache in sync after any parent/child mutation (trigger refetches or optimistically update the in-memory structures).
- Ensure the uploader’s parent list refreshes after uploads/updates (new canonical image might appear) so users can immediately assign new children.
- Handle edge cases (e.g., don’t allow an image to become its own parent or to adopt its own ancestors) by limiting selectable parents to canonical images and excluding the current image.

## Verification

1. Upload a base image and then upload a variation with a parent selected; confirm the gallery icon appears and the detail view lists the child.
2. On a variation’s detail view, reassign or detach the parent; ensure metadata updates on Cloudflare, the UI refreshes, and children map behaves accordingly.
3. From a parent’s detail view, adopt an existing unassigned image as its child and verify the “Variations” list updates; use the copy buttons to grab any child URL.
4. Run the existing test suite (`npm run test`) after backend code changes to ensure no regressions.

## Next steps

1. Implement metadata enhancements (upload/update routes + data merging).
2. Update gallery/detail components with relationship-aware UI and refresh logic.
3. Extend the uploader flow to let users create variations during upload and document the new metadata contract for future maintenance.
