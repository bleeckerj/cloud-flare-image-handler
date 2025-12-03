import { NextResponse } from 'next/server';
import { cleanString, parseCloudflareMetadata } from '@/utils/cloudflareMetadata';

type CloudflareImageResponse = {
  id: string;
  filename?: string;
  uploaded: string;
  variants: string[];
  meta?: unknown;
};

export async function GET() {
  try {
    // Check for required environment variables
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    
    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Cloudflare credentials not configured' },
        { status: 500 }
      );
    }

    // Fetch images from Cloudflare
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Cloudflare API error:', result);
      return NextResponse.json(
        { error: result.errors?.[0]?.message || 'Failed to fetch images from Cloudflare' },
        { status: response.status }
      );
    }

    // Transform the data to match our expected format
    const apiImages: CloudflareImageResponse[] = Array.isArray(result.result?.images)
      ? result.result.images
      : [];

    const images = apiImages.map((image) => {
      const parsedMeta = parseCloudflareMetadata(image.meta);
      const cleanFolder = parsedMeta.folder && parsedMeta.folder !== 'undefined' ? parsedMeta.folder : undefined;
      const cleanTags = Array.isArray(parsedMeta.tags)
        ? parsedMeta.tags.filter((tag): tag is string => Boolean(tag) && tag !== 'undefined')
        : [];
      const cleanDescription = parsedMeta.description && parsedMeta.description !== 'undefined' ? parsedMeta.description : undefined;
      const cleanOriginalUrl = parsedMeta.originalUrl && parsedMeta.originalUrl !== 'undefined' ? parsedMeta.originalUrl : undefined;
      const cleanAltTag = parsedMeta.altTag && parsedMeta.altTag !== 'undefined' ? parsedMeta.altTag : undefined;
      const parentId = cleanString(parsedMeta.variationParentId);

      return {
        id: image.id,
        filename: image.filename || parsedMeta.filename || 'Unknown',
        uploaded: image.uploaded,
        variants: image.variants,
        folder: cleanFolder,
        tags: cleanTags,
        description: cleanDescription,
        originalUrl: cleanOriginalUrl,
        altTag: cleanAltTag,
        parentId,
      };
    });

    return NextResponse.json({ images });

  } catch (error) {
    console.error('Fetch images error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
