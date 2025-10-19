import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    
    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudflare Images
    const uploadFormData = new FormData();
    uploadFormData.append('file', new Blob([buffer], { type: file.type }), file.name);
    
    // Get folder and tags from form data
    const folder = formData.get('folder') as string;
    const tags = formData.get('tags') as string;
    
    // Clean up folder value - handle empty strings and "undefined" strings
    const cleanFolder = folder && folder.trim() && folder !== 'undefined' ? folder.trim() : undefined;
    const cleanTags = tags && tags.trim() ? tags.trim().split(',').map(t => t.trim()).filter(t => t) : [];

    // Add metadata including organization info
    const metadata = JSON.stringify({
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      size: file.size,
      type: file.type,
      folder: cleanFolder,
      tags: cleanTags
    });
    uploadFormData.append('metadata', metadata);

    const cloudflareResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
        body: uploadFormData,
      }
    );

    const result = await cloudflareResponse.json();

    if (!cloudflareResponse.ok) {
      console.error('Cloudflare API error:', result);
      return NextResponse.json(
        { error: result.errors?.[0]?.message || 'Failed to upload to Cloudflare' },
        { status: cloudflareResponse.status }
      );
    }

    console.log('Cloudflare upload result:', JSON.stringify(result, null, 2));

    // Return the image details
    const imageData = result.result;
    return NextResponse.json({
      id: imageData.id,
      filename: file.name,
      url: imageData.variants.find((v: string) => v.includes('public')) || imageData.variants[0],
      variants: imageData.variants,
      uploaded: new Date().toISOString(),
      folder: cleanFolder,
      tags: cleanTags
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}