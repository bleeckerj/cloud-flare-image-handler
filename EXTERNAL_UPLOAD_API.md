## External Upload API

You can push images into this service from other local tools (Astro, scripts, etc.) via the new endpoint:

- **Endpoint**: `POST http://localhost:3000/api/upload/external`
- **CORS**: Open to any origin (handy for local multi-port setups)
- **Content-Type**: `multipart/form-data`

| Field | Required | Notes |
| --- | --- | --- |
| `file` | ✅ | Binary image file (max 10 MB, must be `image/*`). |
| `folder` | ❌ | Optional folder name (e.g., `astro-uploads`). |
| `tags` | ❌ | Comma-separated list (`landing, hero`). |
| `description` | ❌ | Brief text description. |
| `originalUrl` | ❌ | Reference URL of the source image. |

**Sample response**

```json
{
   "id": "abc123",
   "filename": "photo.png",
   "url": "https://imagedelivery.net/<hash>/abc123/public",
   "variants": ["…/public", "…/thumbnail"],
   "uploaded": "2025-11-28T17:05:12.345Z",
   "folder": "astro-uploads",
   "tags": ["astro", "cloudflare"],
   "description": "Hero image"
}
```

**cURL example**

```bash
curl -X POST http://localhost:3000/api/upload/external \
   -F "file=@./photo.png" \
   -F "folder=astro-uploads" \
   -F "tags=astro,cloudflare"
```
