import { NextRequest, NextResponse } from 'next/server';
import { getCachedImages } from '@/server/cloudflareImageCache';
import { getCloudflareImageUrl } from '@/utils/imageUtils';

type AuditEntry = {
  id: string;
  filename?: string;
  url?: string;
  status?: number;
  reason?: string;
};

const parseNumber = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildUrlForImage = (image: { id: string; variants: string[] }, variant: string) => {
  try {
    return getCloudflareImageUrl(image.id, variant);
  } catch {
    if (!Array.isArray(image.variants) || image.variants.length === 0) {
      return undefined;
    }
    const variantMatch = image.variants.find((url) => url.includes(`/${variant}`));
    return variantMatch ?? image.variants[0];
  }
};

const fetchWithFallback = async (url: string) => {
  const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
  if (head.status !== 405 && head.status !== 501) {
    return head;
  }
  return fetch(url, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    cache: 'no-store'
  });
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get('refresh') === '1';
  const limit = parseNumber(searchParams.get('limit'), 0);
  const offset = Math.max(0, parseNumber(searchParams.get('offset'), 0));
  const concurrency = Math.max(1, parseNumber(searchParams.get('concurrency'), 8));
  const variant = searchParams.get('variant') || 'public';
  const verbose = searchParams.get('verbose') === '1';

  const images = await getCachedImages(refresh);
  const sliceStart = offset;
  const sliceEnd = limit > 0 ? offset + limit : undefined;
  const targets = images.slice(sliceStart, sliceEnd);

  const broken: AuditEntry[] = [];
  const errors: AuditEntry[] = [];
  const results: AuditEntry[] = [];
  let index = 0;

  const worker = async () => {
    while (index < targets.length) {
      const current = targets[index++];
      const url = buildUrlForImage(current, variant);
      const filename = current.filename;
      if (!url) {
        const entry = { id: current.id, filename, reason: 'missing-url' };
        broken.push(entry);
        if (verbose) {
          results.push(entry);
        }
        continue;
      }
      try {
        const response = await fetchWithFallback(url);
        if (response.status === 404 || response.status === 410) {
          const entry = { id: current.id, filename, url, status: response.status, reason: 'not-found' };
          broken.push(entry);
          if (verbose) {
            results.push(entry);
          }
        } else if (!response.ok) {
          const entry = { id: current.id, filename, url, status: response.status, reason: 'request-failed' };
          errors.push(entry);
          if (verbose) {
            results.push(entry);
          }
        } else if (verbose) {
          results.push({ id: current.id, filename, url, status: response.status, reason: 'ok' });
        }
      } catch (error) {
        const entry = {
          id: current.id,
          filename,
          url,
          reason: error instanceof Error ? error.message : 'request-error'
        };
        errors.push(entry);
        if (verbose) {
          results.push(entry);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));

  return NextResponse.json({
    totalImages: images.length,
    checked: targets.length,
    broken,
    errors,
    results: verbose ? results : undefined,
    variant,
    offset: sliceStart,
    checkedAt: new Date().toISOString()
  });
}
