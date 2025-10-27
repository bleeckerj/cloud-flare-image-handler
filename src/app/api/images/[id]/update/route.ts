import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
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
    const body = await request.json();
    const { folder, tags, description, originalUrl } = body;
    
    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    // Clean up folder and tags
    const cleanFolder = folder && folder.trim() && folder !== 'undefined' ? folder.trim() : undefined;
    const cleanTags = tags && Array.isArray(tags) ? tags.filter((t: string) => t && t.trim()) : [];
    const cleanDescription = description && description.trim() && description !== 'undefined' ? description.trim() : undefined;
    const cleanOriginalUrl = originalUrl && originalUrl.trim() && originalUrl !== 'undefined' ? originalUrl.trim() : undefined;

    // Create updated metadata object (not JSON string)
    const metadata = {
      folder: cleanFolder,
      tags: cleanTags,
      description: cleanDescription,
      originalUrl: cleanOriginalUrl,
      updatedAt: new Date().toISOString()
    };

    // Update image metadata in Cloudflare using JSON body
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Cloudflare API error:', result);
      return NextResponse.json(
        { error: result.errors?.[0]?.message || 'Failed to update image metadata' },
        { status: response.status }
      );
    }

    return NextResponse.json({ 
      success: true, 
      folder: cleanFolder, 
      tags: cleanTags,
      description: cleanDescription,
      originalUrl: cleanOriginalUrl
    });

  } catch (error) {
    console.error('Update image error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}