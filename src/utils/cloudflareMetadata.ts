export type CloudflareMetadata = {
  folder?: string;
  tags?: string[];
  description?: string;
  originalUrl?: string;
  originalUrlNormalized?: string;
  contentHash?: string;
  altTag?: string;
  displayName?: string;
  filename?: string;
  variationParentId?: string;
  linkedAssetId?: string;
  exif?: Record<string, string | number>;
  uploadedAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export const CLOUDFLARE_METADATA_FIELDS = [
  'folder',
  'tags',
  'description',
  'originalUrl',
  'originalUrlNormalized',
  'contentHash',
  'altTag',
  'displayName',
  'variationParentId',
  'linkedAssetId',
  'exif',
  'updatedAt'
] as const;

type CloudflareMetadataField = typeof CLOUDFLARE_METADATA_FIELDS[number];

export function pickCloudflareMetadata(
  meta: Record<string, unknown>
): CloudflareMetadata {
  const trimmed: Record<string, unknown> = {};
  CLOUDFLARE_METADATA_FIELDS.forEach((key) => {
    const value = meta[key as CloudflareMetadataField];
    if (value !== undefined) {
      trimmed[key] = value;
    }
  });
  return trimmed as CloudflareMetadata;
}

/**
 * Parse the metadata returned by Cloudflare as JSON or object.
 */
export function parseCloudflareMetadata(rawMeta?: unknown): CloudflareMetadata {
  if (!rawMeta) {
    return {};
  }

  if (typeof rawMeta === 'string') {
    try {
      const parsed = JSON.parse(rawMeta);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as CloudflareMetadata;
      }
      return {};
    } catch (err) {
      console.warn('Failed to parse Cloudflare metadata as JSON:', err);
      return {};
    }
  }

  if (typeof rawMeta === 'object' && rawMeta !== null) {
    return rawMeta as CloudflareMetadata;
  }

  return {};
}

/**
 * Normalize a string value coming from the client/backing metadata.
 */
export function cleanString(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'undefined') {
    return undefined;
  }

  return trimmed;
}
