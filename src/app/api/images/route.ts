import { NextResponse } from 'next/server';

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
    const images = result.result.images.map((image: any) => {
      // Try to parse metadata if it exists
      let parsedMeta = null;
      if (image.meta) {
        if (typeof image.meta === 'string') {
          try {
            parsedMeta = JSON.parse(image.meta);
          } catch (e) {
            console.warn('Failed to parse image metadata as JSON:', e);
          }
        } else if (typeof image.meta === 'object') {
          parsedMeta = image.meta;
        }
      }

      // Clean up folder and tags
      const cleanFolder = parsedMeta?.folder && parsedMeta.folder !== 'undefined' ? parsedMeta.folder : undefined;
      const cleanTags = Array.isArray(parsedMeta?.tags) ? parsedMeta.tags.filter((t: any) => t && t !== 'undefined') : [];
      const cleanDescription = parsedMeta?.description && parsedMeta.description !== 'undefined' ? parsedMeta.description : undefined;
      const cleanOriginalUrl = parsedMeta?.originalUrl && parsedMeta.originalUrl !== 'undefined' ? parsedMeta.originalUrl : undefined;

      return {
        id: image.id,
        filename: image.filename || parsedMeta?.filename || 'Unknown',
        uploaded: image.uploaded,
        variants: image.variants,
        folder: cleanFolder,
        tags: cleanTags,
        description: cleanDescription,
        originalUrl: cleanOriginalUrl
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