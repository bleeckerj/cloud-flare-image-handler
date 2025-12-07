import { getCachedImages, CachedCloudflareImage } from './cloudflareImageCache';

const normalize = (value?: string | null) => (value ?? '').trim().toLowerCase();

export interface DuplicateSummary {
  id: string;
  filename: string;
  folder?: string;
  uploaded: string;
  url?: string;
}

export const toDuplicateSummary = (image: CachedCloudflareImage): DuplicateSummary => ({
  id: image.id,
  filename: image.filename,
  folder: image.folder,
  uploaded: image.uploaded,
  url: image.variants?.[0]
});

export async function findDuplicatesByFilename(filename: string) {
  const normalized = normalize(filename);
  if (!normalized) {
    return [];
  }
  const images = await getCachedImages();
  return images.filter((img) => normalize(img.filename) === normalized);
}
