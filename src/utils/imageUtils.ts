// Cloudflare Images utility functions

export interface ImageVariant {
  name: string;
  value: string;
  description: string;
  width?: number;
}

// Predefined image variants for easy use
export const IMAGE_VARIANTS: ImageVariant[] = [
  { name: 'original', value: 'public', description: 'Original full size', width: undefined },
  { name: 'small', value: 'w=300', description: 'Small (300px width)', width: 300 },
  { name: 'medium', value: 'w=600', description: 'Medium (600px width)', width: 600 },
  { name: 'large', value: 'w=900', description: 'Large (900px width)', width: 900 },
  { name: 'xlarge', value: 'w=1230', description: 'Extra Large (1230px width)', width: 1230 },
  { name: 'thumbnail', value: 'thumbnail', description: 'Thumbnail preset', width: 150 },
];

/**
 * Generate a Cloudflare Images URL for a specific variant/size
 * @param imageId - The Cloudflare image ID
 * @param variant - The variant name ('small', 'medium', 'large', etc.) or custom transform string
 * @param accountHash - Your Cloudflare account hash (from environment)
 * @returns The complete image URL
 */
export function getCloudflareImageUrl(
  imageId: string, 
  variant: string = 'original',
  accountHash?: string
): string {
  const hash = accountHash || process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_HASH;
  
  if (!hash) {
    throw new Error('Cloudflare account hash not found');
  }

  // Check if it's a predefined variant
  const predefinedVariant = IMAGE_VARIANTS.find(v => v.name === variant);
  const variantValue = predefinedVariant ? predefinedVariant.value : variant;

  return `https://imagedelivery.net/${hash}/${imageId}/${variantValue}`;
}

/**
 * Get multiple URLs for an image at different sizes
 * @param imageId - The Cloudflare image ID
 * @param variants - Array of variant names to generate URLs for
 * @param accountHash - Your Cloudflare account hash
 * @returns Object with variant names as keys and URLs as values
 */
export function getMultipleImageUrls(
  imageId: string,
  variants: string[] = ['small', 'medium', 'large', 'original'],
  accountHash?: string
): Record<string, string> {
  const urls: Record<string, string> = {};
  
  variants.forEach(variant => {
    urls[variant] = getCloudflareImageUrl(imageId, variant, accountHash);
  });

  return urls;
}

/**
 * Generate a responsive image srcSet for use with Next.js Image component
 * @param imageId - The Cloudflare image ID
 * @param accountHash - Your Cloudflare account hash
 * @returns srcSet string for responsive images
 */
export function getResponsiveSrcSet(imageId: string, accountHash?: string): string {
  const sizes = [
    { width: 300, descriptor: '300w' },
    { width: 600, descriptor: '600w' },
    { width: 900, descriptor: '900w' },
    { width: 1230, descriptor: '1230w' },
  ];

  return sizes
    .map(({ width, descriptor }) => 
      `${getCloudflareImageUrl(imageId, `w=${width}`, accountHash)} ${descriptor}`
    )
    .join(', ');
}

/**
 * Get an image URL with custom Cloudflare transformations
 * @param imageId - The Cloudflare image ID
 * @param transformations - Object with transformation parameters
 * @param accountHash - Your Cloudflare account hash
 * @returns The complete image URL with transformations
 */
export function getCustomImageUrl(
  imageId: string,
  transformations: {
    width?: number;
    height?: number;
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
    gravity?: 'auto' | 'side' | 'left' | 'right' | 'top' | 'bottom' | 'center';
    quality?: number;
    format?: 'auto' | 'avif' | 'webp' | 'jpg' | 'png';
  },
  accountHash?: string
): string {
  const params = new URLSearchParams();
  
  if (transformations.width) params.append('w', transformations.width.toString());
  if (transformations.height) params.append('h', transformations.height.toString());
  if (transformations.fit) params.append('fit', transformations.fit);
  if (transformations.gravity) params.append('gravity', transformations.gravity);
  if (transformations.quality) params.append('quality', transformations.quality.toString());
  if (transformations.format) params.append('format', transformations.format);

  const variantString = params.toString();
  return getCloudflareImageUrl(imageId, variantString, accountHash);
}