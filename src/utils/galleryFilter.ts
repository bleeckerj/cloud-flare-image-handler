export interface GalleryImage {
  id: string;
  filename: string;
  uploaded: string;
  variants: string[];
  folder?: string;
  tags?: string[];
  altTag?: string;
  parentId?: string;
}

export interface GalleryFilterOptions {
  selectedFolder: string;
  selectedTag: string;
  searchTerm: string;
  onlyCanonical: boolean;
}

const normalize = (value?: string) => value?.toLowerCase() ?? '';

const matchesFolderFilter = (image: GalleryImage, selectedFolder: string) => {
  if (selectedFolder === 'all') return true;
  if (selectedFolder === 'no-folder') return !image.folder;
  return image.folder === selectedFolder;
};

const matchesTagFilter = (image: GalleryImage, selectedTag: string) => {
  if (!selectedTag) return true;
  return Array.isArray(image.tags) && image.tags.includes(selectedTag);
};

const matchesSearchFilter = (image: GalleryImage, searchTerm: string) => {
  const normalizedSearch = normalize(searchTerm.trim());
  if (!normalizedSearch) return true;

  const haystacks = [
    normalize(image.filename),
    normalize(image.folder),
    normalize(image.altTag),
    ...(image.tags?.map(normalize) ?? [])
  ];

  return haystacks.some((candidate) => candidate.includes(normalizedSearch));
};

export const filterImagesForGallery = (
  images: GalleryImage[],
  options: GalleryFilterOptions
): GalleryImage[] => {
  const { selectedFolder, selectedTag, searchTerm, onlyCanonical } = options;
  return images.filter((image) => {
    if (!matchesFolderFilter(image, selectedFolder)) return false;
    if (!matchesTagFilter(image, selectedTag)) return false;
    if (!matchesSearchFilter(image, searchTerm)) return false;
    if (onlyCanonical && image.parentId) return false;
    return true;
  });
};
