export type CloudflareMetadata = {
  folder?: string;
  tags?: string[];
  description?: string;
  originalUrl?: string;
  altTag?: string;
  filename?: string;
  variationParentId?: string;
  linkedAssetId?: string;
  uploadedAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

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
