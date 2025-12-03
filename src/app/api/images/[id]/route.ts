import { NextRequest, NextResponse } from 'next/server';
import { cleanString, parseCloudflareMetadata } from '@/utils/cloudflareMetadata';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: imageId } = await params;
    
    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    // Delete image from Cloudflare
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Cloudflare API error:', result);
      return NextResponse.json(
        { error: result.errors?.[0]?.message || 'Failed to delete image from Cloudflare' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete image error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Cloudflare credentials not configured' },
        { status: 500 }
      );
    }

    const { id: imageId } = await params;
    if (!imageId) {
      return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
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
        { error: result.errors?.[0]?.message || 'Failed to fetch image from Cloudflare' },
        { status: response.status }
      );
    }

    const image = result.result;
    const parsedMeta = parseCloudflareMetadata(image.meta);
    const cleanFolder = parsedMeta.folder && parsedMeta.folder !== 'undefined' ? parsedMeta.folder : undefined;
    const cleanTags = Array.isArray(parsedMeta.tags)
      ? parsedMeta.tags.filter((tag): tag is string => Boolean(tag) && tag !== 'undefined')
      : [];
    const cleanDescription = parsedMeta.description && parsedMeta.description !== 'undefined' ? parsedMeta.description : undefined;
    const cleanOriginalUrl = parsedMeta.originalUrl && parsedMeta.originalUrl !== 'undefined' ? parsedMeta.originalUrl : undefined;
    const cleanAltTag = parsedMeta.altTag && parsedMeta.altTag !== 'undefined' ? parsedMeta.altTag : undefined;
    const parentId = cleanString(parsedMeta.variationParentId);

    const transformed = {
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

    return NextResponse.json({ image: transformed });
  } catch (error) {
    console.error('Fetch single image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
