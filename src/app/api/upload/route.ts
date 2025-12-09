import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { transformApiImageToCached, upsertCachedImage } from '@/server/cloudflareImageCache';
import { findDuplicatesByFilename, toDuplicateSummary } from '@/server/duplicateDetector';

const logIssue = (message: string, details?: Record<string, unknown>) => {
  console.warn('[upload] ' + message, details);
};

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
      logIssue('No file provided in form submission');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      logIssue('Rejected non-image upload', { filename: file.name, type: file.type });
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      logIssue('Rejected oversized upload', { filename: file.name, bytes: file.size, limit: maxSize });
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer and shrink if necessary
    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    const shrinkIfNeeded = async (input: Buffer, type: string): Promise<Buffer> => {
      if (input.byteLength <= maxSize) {
        return input;
      }
      const transformer = sharp(input).rotate();
      const metadata = await transformer.metadata();
      const width = metadata.width || 4096;
      const height = metadata.height || 4096;
      const maxDimension = Math.max(width, height);
      const targetDimension = Math.min(maxDimension, 4000);
      const scale = targetDimension / maxDimension;
      const resized = transformer.resize(Math.round(width * scale), Math.round(height * scale), { fit: 'inside' });
      const format = type.includes('png') ? 'png' : 'jpeg';
      const encoded = await resized.toFormat(format, { quality: 85 }).toBuffer();
      if (encoded.byteLength <= maxSize) {
        return encoded;
      }
      return resized.toFormat(format, { quality: 70 }).toBuffer();
    };

    buffer = await shrinkIfNeeded(buffer, file.type);

    const duplicateMatches = await findDuplicatesByFilename(file.name);
    if (duplicateMatches.length) {
      console.warn('[upload] Duplicate filename detected', {
        filename: file.name,
        duplicateIds: duplicateMatches.map(match => match.id),
        folders: duplicateMatches.map(match => match.folder || null)
      });
      return NextResponse.json(
        {
          error: `Duplicate filename "${file.name}" detected`,
          duplicates: duplicateMatches.map(toDuplicateSummary)
        },
        { status: 409 }
      );
    }

    // Upload to Cloudflare Images
    const uploadFormData = new FormData();
    uploadFormData.append('file', new Blob([buffer], { type: file.type }), file.name);
    
    // Get folder, tags, description, and originalUrl from form data
    const folder = formData.get('folder') as string;
    const tags = formData.get('tags') as string;
    const description = formData.get('description') as string;
    const originalUrl = formData.get('originalUrl') as string;
    const parentIdRaw = formData.get('parentId');
    
    // Clean up values - handle empty strings and "undefined" strings
    const cleanFolder = folder && folder.trim() && folder !== 'undefined' ? folder.trim() : undefined;
    const cleanTags = tags && tags.trim() ? tags.trim().split(',').map(t => t.trim()).filter(t => t) : [];
    const cleanDescription = description && description.trim() && description !== 'undefined' ? description.trim() : undefined;
    const cleanOriginalUrl = originalUrl && originalUrl.trim() && originalUrl !== 'undefined' ? originalUrl.trim() : undefined;
    const parentIdValue = typeof parentIdRaw === 'string' ? parentIdRaw.trim() : '';
    const cleanParentId = parentIdValue && parentIdValue !== 'undefined' ? parentIdValue : undefined;

    // Add metadata including organization info
    const metadataPayload: Record<string, unknown> = {
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      size: file.size,
      type: file.type,
      folder: cleanFolder,
      tags: cleanTags,
      description: cleanDescription,
      originalUrl: cleanOriginalUrl,
      variationParentId: cleanParentId,
    };

    const metadata = JSON.stringify(metadataPayload);
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

    const imageData = result.result;
    const baseMeta = imageData.meta ?? metadataPayload;
    const primaryCached = transformApiImageToCached({
      id: imageData.id,
      filename: imageData.filename,
      uploaded: imageData.uploaded,
      variants: imageData.variants,
      meta: baseMeta
    });
    upsertCachedImage(primaryCached);

    let webpVariantId: string | undefined;
    if (file.type === 'image/svg+xml') {
      try {
        const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
        const webpName = file.name.replace(/\.svg$/i, '') + '.webp';
        const webpFormData = new FormData();
        webpFormData.append('file', new Blob([webpBuffer], { type: 'image/webp' }), webpName);
        const webpMetadataPayload = {
          ...metadataPayload,
          filename: webpName,
          variationParentId: cleanParentId,
          linkedAssetId: imageData.id,
        };
        webpFormData.append('metadata', JSON.stringify(webpMetadataPayload));
        const webpResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
            },
            body: webpFormData,
          }
        );
        const webpJson = await webpResponse.json();
        if (!webpResponse.ok) {
          console.error('Cloudflare WebP upload error:', webpJson);
        } else {
          const webpResult = webpJson.result;
          webpVariantId = webpResult?.id;
          if (webpResult) {
            const cachedVariant = transformApiImageToCached({
              id: webpResult.id,
              filename: webpResult.filename,
              uploaded: webpResult.uploaded,
              variants: webpResult.variants,
              meta: webpResult.meta ?? webpMetadataPayload
            });
            upsertCachedImage(cachedVariant);
          }
        }
      } catch (err) {
        console.error('Failed to convert SVG to WebP', err);
      }
    }

    if (webpVariantId) {
      const updatedMetadata = {
        ...metadataPayload,
        linkedAssetId: webpVariantId,
        updatedAt: new Date().toISOString(),
      };
      try {
        const patchResp = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageData.id}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ metadata: updatedMetadata }),
          }
        );
        if (!patchResp.ok) {
          const patchJson = await patchResp.json();
          console.error('Failed to patch SVG metadata', patchJson);
        } else {
          const updatedPrimary = transformApiImageToCached({
            id: imageData.id,
            filename: imageData.filename,
            uploaded: imageData.uploaded,
            variants: imageData.variants,
            meta: updatedMetadata
          });
          upsertCachedImage(updatedPrimary);
        }
      } catch (err) {
        console.error('Failed to patch SVG metadata', err);
      }
    }

    return NextResponse.json({
      id: imageData.id,
      filename: file.name,
      url: imageData.variants.find((v: string) => v.includes('public')) || imageData.variants[0],
      variants: imageData.variants,
      uploaded: new Date().toISOString(),
      folder: cleanFolder,
      tags: cleanTags,
      description: cleanDescription,
      originalUrl: cleanOriginalUrl,
      parentId: cleanParentId,
      linkedAssetId: webpVariantId,
      webpVariantId,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
