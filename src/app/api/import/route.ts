import { NextRequest, NextResponse } from 'next/server';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB to match uploader

const isValidUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const IMAGE_EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

const getMimeFromExtension = (value: string) => {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split('.');
    if (segments.length > 1) {
      const ext = segments.pop()?.toLowerCase();
      if (ext && IMAGE_EXTENSION_MIME_MAP[ext]) {
        return IMAGE_EXTENSION_MIME_MAP[ext];
      }
    }
  } catch {
    // ignore
  }
  return undefined;
};

const getFilenameFromUrl = (url: string, mimeType?: string | null) => {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
      return lastSegment;
    }
  } catch {
    // ignore
  }
  const extension = mimeType?.split('/')[1] || 'jpg';
  return `remote-image-${Date.now()}.${extension}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sourceUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!sourceUrl || !isValidUrl(sourceUrl)) {
      return NextResponse.json({ error: 'A valid image URL is required' }, { status: 400 });
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to download the image' }, { status: 400 });
    }

    const rawContentType = response.headers.get('content-type') ?? '';
    const normalizedType = rawContentType.split(';')[0].trim().toLowerCase();
    const inferredContentType =
      (normalizedType && normalizedType.startsWith('image/')
        ? normalizedType
        : undefined) ?? getMimeFromExtension(sourceUrl);
    if (!inferredContentType) {
      return NextResponse.json({ error: 'URL must point to an image' }, { status: 400 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Remote image exceeds 10MB limit' }, { status: 400 });
    }

    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const filename = getFilenameFromUrl(sourceUrl, inferredContentType);

    return NextResponse.json({
      name: filename,
      type: inferredContentType,
      size: buffer.length,
      data: base64,
      originalUrl: sourceUrl,
    });
  } catch (error) {
    console.error('Import image error:', error);
    return NextResponse.json({ error: 'Failed to import image' }, { status: 500 });
  }
}
