# Remote Hash-Cache Refresh Hook

## Goal
Expose a canonical catalog of Cloudflare Images uploads (plus hashes or binary access) so tooling can regenerate `logs/image-migrations/hash-cache.json` without scanning local files. The endpoint must cover every asset, honor the existing upload service auth, and either return a deterministic file hash or provide a way to download bytes for hashing.

## Proposed HTTP API

### `GET /api/uploads`
List uploads with pagination and optional folder filtering.

Query params:
- `page` (default `1`)
- `pageSize` (default `50`, max `250`)
- `folder` (optional)

Response body:
```jsonc
{
  "page": 1,
  "pageSize": 50,
  "hasMore": true,
  "nextPage": 2,
  "uploads": [
    {
      "uploadId": "58f27351-...-f498",
      "cloudflareUrl": "https://imagedelivery.net/.../public",
      "folder": "static-assets-2025",
      "filename": "ghostwriter-selectric-screen.jpg",
      "originalUrl": "/images/projects/2025/ghostwriter/ghostwriter-selectric-screen.jpg",
      "bytes": 533654,
      "contentHash": "sha256:abc123...",        // optional but ideal
      "createdAt": "2025-12-05T21:59:41.036Z"
    }
  ]
}
```

### `GET /api/uploads/:uploadId/download`
Streams the original asset so callers can hash locally when `contentHash` is absent.

Both endpoints reuse the same authentication / authorization middleware as the existing `/api/upload/external` route so the CLI and scripts can call them without additional secrets.

## Implementation Strategy

1. **Server module**
   - Create `src/server/cloudflareUploadsService.ts` that wraps Cloudflare Images APIs:
     * `listUploads({ page, pageSize, folder })` → fetches via `https://api.cloudflare.com/client/v4/accounts/{accountId}/images/v1`.
     * `downloadUpload(uploadId)` → proxies the `public` variant (or `original` variant if needed) with streaming.
   - Reuse `cloudflareImageCache.ts` parsing helpers to normalize metadata (folder, originalUrl, tags, etc.) so the API shape matches what the gallery already expects.
   - If Cloudflare metadata already stores hashes (e.g., `meta.sha256`), propagate that field as `contentHash`. Otherwise consider computing hashes opportunistically when images are uploaded and storing them in metadata for future requests.

2. **API routes**
   - `src/app/api/uploads/route.ts` implements the list endpoint.
   - `src/app/api/uploads/[id]/download/route.ts` streams the file. Use `NextResponse` with a `ReadableStream` from `fetch` to avoid buffering.
   - Both routes share auth middleware (maybe `ensureApiAuth()` helper).

3. **Scripts / CLI integration**
   - Add `scripts/refresh-hash-cache.ts`:
     1. Paginate through `/api/uploads`.
     2. If `contentHash` is present, use it; otherwise call `/api/uploads/:id/download` and hash the stream.
     3. Build `{ [hash]: { uploadId, cloudflareUrl, originalUrl } }`.
     4. Prune stale entries by overwriting `hash-cache.json` with the new map.

4. **Efficiency & maintainability**
   - Keep the service module responsible for Cloudflare interaction; avoid mixing API routing logic with external calls.
   - Ensure pagination caps and timeouts are configurable via env (`UPLOADS_PAGE_SIZE`, `UPLOADS_MAX_PAGES`) to handle large catalogs.
   - Log rate-limit errors distinctly so the CLI can retry or back off.
   - Use TypeScript interfaces (`UploadRecord`, `UploadListResponse`) exported from the service to guarantee consistent typing between API and scripts.
   - Write unit tests for the service module using mocked `fetch` responses to validate pagination, metadata normalization, and hash propagation.

With this API in place, refreshing the hash cache becomes a simple scripted process that remains accurate even if local source files are missing.

## Refreshing the cache

Run `npm run refresh:hash-cache` (optionally setting `HASH_CACHE_API_BASE` or `HASH_CACHE_FOLDER`) to download the full catalog via `/api/uploads`, hash assets lacking a stored digest, and rewrite `logs/image-migrations/hash-cache.json`.
