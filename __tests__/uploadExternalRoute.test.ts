import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/upload/external/route';

const TEST_URL = 'http://localhost/api/upload/external';
const ORIGINAL_ENV = { ...process.env };

function createRequest(formData: FormData) {
  const baseRequest = new Request(TEST_URL, {
    method: 'POST',
    body: formData,
  });
  return new NextRequest(baseRequest);
}

describe('POST /api/upload/external', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 400 when no file is provided', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    process.env.CLOUDFLARE_API_TOKEN = 'token';

    const formData = new FormData();
    const request = createRequest(formData);

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/No file/i);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns 500 when Cloudflare credentials are missing', async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;

    const file = new File(['test'], 'sample.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', file);

    const request = createRequest(formData);
    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/Cloudflare credentials not configured/i);
  });

  it('uploads successfully and returns Cloudflare metadata', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    process.env.CLOUDFLARE_API_TOKEN = 'token';

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            id: 'abc123',
            variants: [
              'https://imagedelivery.net/hash/abc123/public',
              'https://imagedelivery.net/hash/abc123/thumb',
            ],
          },
        }),
        { status: 200 }
      ) as Response
    );

    const file = new File(['hello world'], 'photo.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'astro-uploads');
    formData.append('tags', 'astro,cloudflare');

    const request = createRequest(formData);
    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe('abc123');
    expect(payload.url).toContain('public');
    expect(payload.folder).toBe('astro-uploads');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('creates a webp variant when uploading an SVG', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    process.env.CLOUDFLARE_API_TOKEN = 'token';

    const mockFetch = vi.spyOn(globalThis, 'fetch');
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: {
            id: 'svg123',
            variants: ['https://example.com/svg123/public']
          }
        }),
        { status: 200 }
      ) as Response
    );
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: {
            id: 'webp789',
            variants: ['https://example.com/webp789/public']
          }
        }),
        { status: 200 }
      ) as Response
    );
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }) as Response);

    const file = new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'icons');
    const request = createRequest(formData);

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe('svg123');
    expect(payload.webpVariantId).toBe('webp789');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
