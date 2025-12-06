'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useMemo, CSSProperties, useRef, useCallback } from 'react';
import { Trash2, Copy, ExternalLink, Sparkles, Layers } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import MonoSelect from './MonoSelect';
import GalleryCommandBar from './GalleryCommandBar';
import FolderManagerButton from './FolderManagerButton';
import { getCloudflareImageUrl, getMultipleImageUrls } from '@/utils/imageUtils';
import { useToast } from './Toast';
import { useImageAspectRatio } from '@/hooks/useImageAspectRatio';
import HoverPreview from './HoverPreview';
import { downloadImageToFile, formatDownloadFileName } from '@/utils/downloadUtils';
import { filterImagesForGallery } from '@/utils/galleryFilter';

interface CloudflareImage {
  id: string;
  filename: string;
  uploaded: string;
  variants: string[];
  folder?: string;
  tags?: string[];
  aspectRatio?: string;
  dimensions?: { width: number; height: number };
  altTag?: string;
  parentId?: string;
  linkedAssetId?: string;
  originalUrl?: string;
}

interface ImageGalleryProps {
  refreshTrigger?: number;
}

export interface ImageGalleryRef {
  refreshImages: () => void;
}

const PAGE_SIZE = 30;
const HIDDEN_FOLDERS_STORAGE_KEY = 'galleryHiddenFolders';

const loadHiddenFoldersFromStorage = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const storedValue = window.localStorage.getItem(HIDDEN_FOLDERS_STORAGE_KEY);
    if (!storedValue) {
      return [];
    }
    const parsed = JSON.parse(storedValue);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean);
    }
  } catch (error) {
    console.warn('Failed to parse hidden folders', error);
  }
  return [];
};

const persistHiddenFolders = (folders: string[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(HIDDEN_FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch (error) {
    console.warn('Failed to save hidden folders', error);
  }
};

const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(({ refreshTrigger }, ref) => {
  const getStoredPreferences = () => {
    if (typeof window === 'undefined') {
      return {
        variant: 'public',
        onlyCanonical: false,
        respectAspectRatio: false,
        onlyWithVariants: false,
        selectedFolder: 'all',
        selectedTag: '',
        searchTerm: '',
        viewMode: 'grid' as 'grid' | 'list',
        filtersCollapsed: false
      };
    }
    try {
      const stored = window.localStorage.getItem('galleryPreferences');
      if (stored) {
        const parsed = JSON.parse(stored) as {
          variant?: string;
          onlyCanonical?: boolean;
          respectAspectRatio?: boolean;
          onlyWithVariants?: boolean;
          selectedFolder?: string;
          selectedTag?: string;
          searchTerm?: string;
          viewMode?: 'grid' | 'list';
          filtersCollapsed?: boolean;
        };
        return {
          variant: typeof parsed.variant === 'string' ? parsed.variant : 'public',
          onlyCanonical: Boolean(parsed.onlyCanonical),
          respectAspectRatio: Boolean(parsed.respectAspectRatio),
          onlyWithVariants: Boolean(parsed.onlyWithVariants),
          selectedFolder: parsed.selectedFolder ?? 'all',
          selectedTag: parsed.selectedTag ?? '',
          searchTerm: parsed.searchTerm ?? '',
          viewMode: parsed.viewMode === 'list' ? 'list' : 'grid',
          filtersCollapsed: Boolean(parsed.filtersCollapsed)
        };
      }
    } catch (error) {
      console.warn('Failed to parse gallery preferences', error);
    }
    return {
      variant: 'public',
      onlyCanonical: false,
      respectAspectRatio: false,
      onlyWithVariants: false,
      selectedFolder: 'all',
      selectedTag: '',
      searchTerm: '',
      viewMode: 'grid',
      filtersCollapsed: false
    };
  };

  const storedPreferencesRef = useRef(getStoredPreferences());

  const [images, setImages] = useState<CloudflareImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string>(storedPreferencesRef.current.variant);
  const [openCopyMenu, setOpenCopyMenu] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>(storedPreferencesRef.current.selectedFolder ?? 'all');
  const [searchTerm, setSearchTerm] = useState<string>(storedPreferencesRef.current.searchTerm ?? '');
  const [selectedTag, setSelectedTag] = useState<string>(storedPreferencesRef.current.selectedTag ?? '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(storedPreferencesRef.current.viewMode ?? 'grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [onlyCanonical, setOnlyCanonical] = useState(storedPreferencesRef.current.onlyCanonical);
  const [respectAspectRatio, setRespectAspectRatio] = useState(storedPreferencesRef.current.respectAspectRatio);
  const [onlyWithVariants, setOnlyWithVariants] = useState(storedPreferencesRef.current.onlyWithVariants);
  const [hiddenFolders, setHiddenFolders] = useState<string[]>(() => loadHiddenFoldersFromStorage());
  const [filtersCollapsed, setFiltersCollapsed] = useState(storedPreferencesRef.current.filtersCollapsed ?? false);
  const utilityButtonClasses = 'text-[0.65rem] font-mono px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('galleryPreferences', JSON.stringify({
        onlyCanonical,
        respectAspectRatio,
        variant: selectedVariant,
        onlyWithVariants,
        selectedFolder,
        selectedTag,
        searchTerm,
        viewMode,
        filtersCollapsed
      }));
    } catch (error) {
      console.warn('Failed to save gallery prefs', error);
    }
  }, [onlyCanonical, respectAspectRatio, selectedVariant, onlyWithVariants, selectedFolder, selectedTag, searchTerm, viewMode, filtersCollapsed]);
  useEffect(() => {
    persistHiddenFolders(hiddenFolders);
  }, [hiddenFolders]);
  useEffect(() => {
    if (
      selectedFolder !== 'all' &&
      selectedFolder !== 'no-folder' &&
      hiddenFolders.includes(selectedFolder)
    ) {
      setSelectedFolder('all');
    }
  }, [hiddenFolders, selectedFolder]);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  const [editFolderSelect, setEditFolderSelect] = useState<string>('');
  const [newEditFolder, setNewEditFolder] = useState<string>('');
  const [altLoadingMap, setAltLoadingMap] = useState<Record<string, boolean>>({});
  
  // Hover preview state
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const galleryTopRef = useRef<HTMLDivElement | null>(null);

  const scrollGalleryToTop = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const targetTop = galleryTopRef.current?.offsetTop ?? 0;
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);
  const scrollToUploader = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const uploaderSection = document.getElementById('uploader-section');
    if (uploaderSection) {
      uploaderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, []);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchImages(true); // Silent refresh
    }
  }, [refreshTrigger]);

  // Expose the refresh function via ref
  useImperativeHandle(ref, () => ({
    refreshImages: () => fetchImages(true) // Silent refresh for better UX
  }));

  const fetchImages = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await fetch('/api/images');
      const data = await response.json();
      if (response.ok) {
        setImages(data.images || []);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleFoldersChanged = async () => {
    await fetchImages(true);
  };

  const deleteImage = async (imageId: string) => {
    try {
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setImages(prev => prev.filter(img => img.id !== imageId));
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const generateAltTag = async (imageId: string) => {
    setAltLoadingMap(prev => ({ ...prev, [imageId]: true }));
    try {
      const response = await fetch(`/api/images/${imageId}/alt`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Failed to generate ALT text';
        toast.push(message);
        return;
      }

      if (!data?.altTag) {
        toast.push('ALT text response was empty');
        return;
      }

      setImages(prev => prev.map(img => (img.id === imageId ? { ...img, altTag: data.altTag } : img)));
      toast.push('ALT text updated');
    } catch (error) {
      console.error('Failed to generate ALT text:', error);
      toast.push('Failed to generate ALT text');
    } finally {
      setAltLoadingMap(prev => {
        const next = { ...prev };
        delete next[imageId];
        return next;
      });
    }
  };

  const startEdit = (image: CloudflareImage) => {
    setEditingImage(image.id);
    setEditFolderSelect(image.folder || '');
    setNewEditFolder('');
    setEditTags(image.tags ? image.tags.join(', ') : '');
  };

  const cancelEdit = () => {
    setEditingImage(null);
    setEditFolderSelect('');
    setNewEditFolder('');
    setEditTags('');
  };

  const saveEdit = async (imageId: string) => {
    try {
      const finalFolder = editFolderSelect === '__create__' ? (newEditFolder.trim() || undefined) : (editFolderSelect === '' ? undefined : editFolderSelect);

      const response = await fetch(`/api/images/${imageId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folder: finalFolder,
          tags: editTags.trim() ? editTags.split(',').map(t => t.trim()) : []
        })
      });

      if (response.ok) {
        // Update the local state
        setImages(prev => prev.map(img => 
          img.id === imageId 
            ? { 
                ...img, 
                folder: finalFolder,
                tags: editTags.trim() ? editTags.split(',').map(t => t.trim()) : []
              }
            : img
        ));
        cancelEdit();
      } else {
        alert('Failed to update image metadata');
      }
    } catch (error) {
      console.error('Failed to update image:', error);
      alert('Failed to update image metadata');
    }
  };

  const toast = useToast();

  const copyToClipboard = async (url: string, label?: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        toast.push(label ? `${label} URL copied` : 'URL copied to clipboard');
        return;
      }

      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        toast.push(label ? `${label} URL copied` : 'URL copied to clipboard');
      } catch (fallbackErr) {
        console.error('Fallback copy failed: ', fallbackErr);
        prompt('Copy this URL manually:', url);
      }

      document.body.removeChild(textArea);
    } catch (err) {
      console.error('Failed to copy: ', err);
      prompt('Copy this URL manually:', url);
    }
  };

  const downloadVariantToFile = async (url: string, filenameHint?: string) => {
    try {
      const downloadName = formatDownloadFileName(filenameHint);
      await downloadImageToFile(url, downloadName);
      toast.push('Download started');
    } catch (error) {
      console.error('Failed to download image', error);
      toast.push('Failed to download image');
    }
  };

  // Hover preview handlers
  const handleMouseEnter = (imageId: string, event: React.MouseEvent) => {
    if (!(event.nativeEvent as MouseEvent).shiftKey) {
      setShowPreview(false);
      return;
    }
    setHoveredImage(imageId);
    setMousePosition({ x: event.clientX, y: event.clientY });
    setShowPreview(true);
  };

  const handleMouseMove = (imageId: string, event: React.MouseEvent) => {
    if (!(event.nativeEvent as MouseEvent).shiftKey) {
      setShowPreview(false);
      return;
    }
    if (hoveredImage !== imageId) {
      setHoveredImage(imageId);
    }
    setMousePosition({ x: event.clientX, y: event.clientY });
    setShowPreview(true);
  };

  const handleMouseLeave = () => {
    setHoveredImage(null);
    setShowPreview(false);
  };

  const hideFolderByName = useCallback((folderName: string) => {
    const sanitized = folderName.trim();
    if (!sanitized) {
      return false;
    }
    let added = false;
    setHiddenFolders(prev => {
      if (prev.includes(sanitized)) {
        return prev;
      }
      added = true;
      return [...prev, sanitized];
    });
    return added;
  }, []);

  const unhideFolderByName = useCallback((folderName: string) => {
    const sanitized = folderName.trim();
    if (!sanitized) {
      return false;
    }
    let removed = false;
    setHiddenFolders(prev => {
      if (!prev.includes(sanitized)) {
        return prev;
      }
      removed = true;
      return prev.filter(folder => folder !== sanitized);
    });
    return removed;
  }, []);

  const clearHiddenFolders = useCallback(() => {
    if (hiddenFolders.length === 0) {
      return false;
    }
    setHiddenFolders([]);
    return true;
  }, [hiddenFolders]);

  const getImageUrl = (image: CloudflareImage, variant: string) => {
    // Use the utility function with the variant string directly
    return getCloudflareImageUrl(image.id, variant === 'public' ? 'original' : variant);
  };

  // Helper function to get orientation icon based on aspect ratio
  const getOrientationIcon = (aspectRatioString: string) => {
    // Parse the aspect ratio to determine orientation
    const parts = aspectRatioString.split(':');
    if (parts.length === 2) {
      const width = parseFloat(parts[0]);
      const height = parseFloat(parts[1]);
      const ratio = width / height;
      
      if (Math.abs(ratio - 1) < 0.1) {
        // Square (1:1 or close)
        return (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="inline-block">
            <rect x="1" y="1" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="0.8"/>
          </svg>
        );
      } else if (ratio > 1) {
        // Landscape (wider than tall)
        return (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className="inline-block">
            <rect x="1" y="1" width="8" height="4" fill="none" stroke="currentColor" strokeWidth="0.8"/>
          </svg>
        );
      } else {
        // Portrait (taller than wide)
        return (
          <svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor" className="inline-block">
            <rect x="1" y="1" width="4" height="8" fill="none" stroke="currentColor" strokeWidth="0.8"/>
          </svg>
        );
      }
    }
    
    // Default to square if we can't parse
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="inline-block">
        <rect x="1" y="1" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="0.8"/>
      </svg>
    );
  };

  // Component for displaying aspect ratio
  const AspectRatioDisplay: React.FC<{ imageId: string }> = ({ imageId }) => {
    const { aspectRatio, loading, error } = useImageAspectRatio(imageId);

    if (loading) {
      return (
        <p className="text-sm font-mono text-gray-400">
          📐 <span className="inline-block w-8 h-2 bg-gray-200 rounded animate-pulse"></span>
        </p>
      );
    }

    if (error || !aspectRatio) {
      return <p className="text-sm font-mono text-gray-400">📐 --</p>;
    }

    return (
      <p className="text-[0.6rem] font-mono text-gray-500 flex items-center gap-1">
        📐 {aspectRatio} {getOrientationIcon(aspectRatio)}
      </p>
    );
  };

  const VARIANT_PRESETS = ['small', 'medium', 'large', 'xlarge', 'original', 'thumbnail'];

  const getVariantUrls = (image: CloudflareImage) => {
    return getMultipleImageUrls(image.id, VARIANT_PRESETS);
  };

  const uniqueFolders = useMemo(() => {
    const folderNames = images
      .map(img => img.folder?.trim())
      .filter((folder): folder is string => Boolean(folder));
    return Array.from(new Set(folderNames));
  }, [images]);
  const visibleFolders = useMemo(
    () => uniqueFolders.filter(folder => !hiddenFolders.includes(folder)),
    [uniqueFolders, hiddenFolders]
  );

  const childrenMap = useMemo(() => {
    const map: Record<string, CloudflareImage[]> = {};
    images.forEach(image => {
      if (image.parentId) {
        map[image.parentId] = [...(map[image.parentId] || []), image];
      }
    });
    return map;
  }, [images]);

  const uniqueTags = useMemo(
    () => Array.from(new Set(images.flatMap(img => Array.isArray(img.tags) ? img.tags.filter(tag => tag && tag.trim()) : []))),
    [images]
  );

  const folderFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All folders' },
      { value: 'no-folder', label: 'No folder' },
      ...visibleFolders.map(folder => ({ value: folder, label: folder as string }))
    ],
    [visibleFolders]
  );

  const tagFilterOptions = useMemo(
    () => [
      { value: '', label: 'All tags' },
      ...uniqueTags.map(tag => ({ value: tag as string, label: tag as string }))
    ],
    [uniqueTags]
  );

  const variantOptions = useMemo(
    () => [
      { value: 'public', label: 'Original (Full Size)' },
      { value: 'w=300', label: 'Small (300px)' },
      { value: 'w=600', label: 'Medium (600px)' },
      { value: 'w=900', label: 'Large (900px)' },
      { value: 'w=1230', label: 'X-Large (1230px)' },
      { value: 'w=150', label: 'Thumbnail-ish (150px)' }
    ],
    []
  );

  const editFolderOptions = useMemo(
    () => [
      { value: '', label: '[none]' },
      ...uniqueFolders.map(folder => ({ value: folder as string, label: folder as string })),
      { value: '__create__', label: 'Create new folder...' }
    ],
    [uniqueFolders]
  );

  const isSvgImage = (img: CloudflareImage) => img.filename?.toLowerCase().endsWith('.svg') ?? false;

  const filteredImages = useMemo(() => {
    return filterImagesForGallery(images, {
      selectedFolder,
      selectedTag,
      searchTerm,
      onlyCanonical,
      hiddenFolders
    });
  }, [images, selectedFolder, selectedTag, searchTerm, onlyCanonical, hiddenFolders]);

  const filteredWithVariants = useMemo(() => {
    if (!onlyWithVariants) {
      return filteredImages;
    }
    const parentIdsWithChildren = new Set(
      Object.entries(childrenMap)
        .filter(([, value]) => (value?.length ?? 0) > 0)
        .map(([key]) => key)
    );
    return filteredImages.filter(image => parentIdsWithChildren.has(image.id));
  }, [filteredImages, onlyWithVariants, childrenMap]);

  const sortedImages = useMemo(() => {
    return [...filteredWithVariants].sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());
  }, [filteredWithVariants]);

  const totalPages = Math.max(1, Math.ceil(sortedImages.length / PAGE_SIZE));
  const pageIndex = Math.min(currentPage, totalPages);
  const pageSliceStart = (pageIndex - 1) * PAGE_SIZE;
  const pageImages = sortedImages.slice(pageSliceStart, pageSliceStart + PAGE_SIZE);
  const showPagination = sortedImages.length > PAGE_SIZE;
  const hasResults = sortedImages.length > 0;

  useEffect(() => {
    setCurrentPage(1);
    scrollGalleryToTop();
  }, [selectedFolder, selectedTag, searchTerm, onlyWithVariants, scrollGalleryToTop]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const formatDateRangeLabel = (items: CloudflareImage[]) => {
    if (!items.length) return null;

    const formatDate = (value: string) =>
      new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

    const newestLabel = formatDate(items[0].uploaded);
    const oldestLabel = formatDate(items[items.length - 1].uploaded);

    return newestLabel === oldestLabel ? newestLabel : `${newestLabel} - ${oldestLabel}`;
  };

  const getPageDateRangeLabel = (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > totalPages) return null;
    const startIndex = (pageNumber - 1) * PAGE_SIZE;
    const slice = sortedImages.slice(startIndex, startIndex + PAGE_SIZE);
    return formatDateRangeLabel(slice);
  };

  const currentPageRangeLabel = formatDateRangeLabel(pageImages);
  const prevPageRangeLabel = getPageDateRangeLabel(pageIndex - 1);
  const nextPageRangeLabel = getPageDateRangeLabel(pageIndex + 1);

  const goToPreviousPage = () =>
    setCurrentPage(prev => {
      const next = Math.max(1, prev - 1);
      if (next !== prev) {
        scrollGalleryToTop();
      }
      return next;
    });
  const goToNextPage = () =>
    setCurrentPage(prev => {
      const next = Math.min(totalPages, prev + 1);
      if (next !== prev) {
        scrollGalleryToTop();
      }
      return next;
    });

  useEffect(() => {
    scrollGalleryToTop();
  }, [scrollGalleryToTop]);

  if (loading) {
    return (
      <div id="image-gallery-loading" className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-300 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="image-gallery-card" ref={galleryTopRef} className="overscroll-none bg-white rounded-lg shadow-lg p-6">
      <div
        ref={galleryTopRef}
        id="gallery-filter-bar"
        className="sticky top-0 z-20 -m-6 mb-6 p-6 pb-4 bg-white/95 backdrop-blur rounded-t-lg border-b border-gray-100"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-[0.7em] font-mono font-mono text-gray-900">
              Image Gallery ({filteredWithVariants.length}/{images.length})
            </p>
            {showPagination && currentPageRangeLabel && (
              <p className="font-mono text-[0.7em] font-mono text-gray-500">
                Showing uploads from {currentPageRangeLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showPagination && (
              <div className="flex items-center gap-2 text-[0.7em] font-mono text-gray-600">
                <button
                  onClick={goToPreviousPage}
                  disabled={pageIndex === 1}
                  className="px-3 py-1 border rounded-md disabled:opacity-40"
                  title={prevPageRangeLabel ? `Previous (${prevPageRangeLabel})` : 'Previous page'}
                >
                  Prev
                </button>
                <span>
                  Page {pageIndex} / {totalPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={pageIndex === totalPages}
                  className="px-3 py-1 border rounded-md disabled:opacity-40"
                  title={nextPageRangeLabel ? `Next (${nextPageRangeLabel})` : 'Next page'}
                >
                  Next
                </button>
              </div>
            )}
            <button
              onClick={() => setFiltersCollapsed(prev => !prev)}
              className="px-3 py-1 text-[0.7em] font-mono border border-gray-200 rounded-md hover:bg-gray-100 transition"
              aria-pressed={!filtersCollapsed}
            >
              {filtersCollapsed ? 'Show filters' : 'Hide filters'}
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="px-3 py-1 text-[0.7em] font-mono bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              {viewMode === 'grid' ? '📋 List' : '🔲 Grid'}
            </button>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${filtersCollapsed ? 'max-h-0' : 'max-h-[1200px]'}`}
          aria-hidden={filtersCollapsed}
        >
          <div
            id="gallery-filter-controls"
            className={`grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg items-end transition-opacity duration-300 ${filtersCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <div>
            <label htmlFor="search" className="block text-[0.7em] font-mono font-mono font-medum text-gray-700 mb-1">
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search files, tags, folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-[0.7em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="folder-filter" className="block text-[0.7em] font-mono font-mono font-medum text-gray-700">
                Folder
              </label>
              <FolderManagerButton onFoldersChanged={handleFoldersChanged} size="sm" label="Manage" />
            </div>
            <MonoSelect
              id="folder-filter"
              value={selectedFolder}
              onChange={setSelectedFolder}
              options={folderFilterOptions}
              className="w-full"
            />
          </div>
          
          <div>
            <label htmlFor="tag-filter" className="block text-[0.7em] font-mono font-mono font-medum text-gray-700 mb-1">
              Tag
            </label>
            <MonoSelect
              id="tag-filter"
              value={selectedTag}
              onChange={setSelectedTag}
              options={tagFilterOptions}
              className="w-full"
              placeholder="All tags"
            />
          </div>
          <div>
            <label htmlFor="variant-select" className="block text-[0.7em] font-mono font-mono font-medum text-gray-700 mb-1">
              Image Size
            </label>
            <MonoSelect
              id="variant-select"
              value={selectedVariant}
              onChange={setSelectedVariant}
              options={variantOptions}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1 text-[0.7em] font-mono text-gray-700">
            <label htmlFor="canonical-filter" className="flex items-center gap-1 font-mono">
              <input
                id="canonical-filter"
                type="checkbox"
                checked={onlyCanonical}
                onChange={(e) => setOnlyCanonical(e.target.checked)}
                className="h-3 w-3 font-mono text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              canonical
            </label>
            <label htmlFor="aspect-filter" className="flex items-center gap-1 font-mono">
              <input
                id="aspect-filter"
                type="checkbox"
                checked={respectAspectRatio}
                onChange={(e) => setRespectAspectRatio(e.target.checked)}
                className="h-3 w-3 font-mono text-[0.7em] font-mono text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              aspect
            </label>
            <label htmlFor="variants-filter" className="flex items-center gap-1 font-mono">
              <input
                id="variants-filter"
                type="checkbox"
                checked={onlyWithVariants}
                onChange={(e) => setOnlyWithVariants(e.target.checked)}
                className="h-3 w-3 font-mono text-[0.7em] font-mono text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              parents
            </label>
          </div>
          <div className="md:col-span-5">
            <GalleryCommandBar
              hiddenFolders={hiddenFolders}
              knownFolders={uniqueFolders}
              onHideFolder={hideFolderByName}
              onUnhideFolder={unhideFolderByName}
              onClearHidden={clearHiddenFolders}
              showParentsOnly={onlyWithVariants}
              onSetParentsOnly={setOnlyWithVariants}
            />
          </div>
            {hiddenFolders.length > 0 && (
              <div className="md:col-span-5 flex flex-wrap items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg text-[0.65rem] font-mono text-gray-700">
                <span className="uppercase tracking-wide text-gray-500 text-[0.6rem]">Hidden folders</span>
                {hiddenFolders.map(folder => (
                  <button
                    key={folder}
                    onClick={() => unhideFolderByName(folder)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900 text-white hover:bg-black transition"
                    title="Unhide folder"
                  >
                    {folder}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                <button
                  onClick={clearHiddenFolders}
                  className="ml-auto text-[0.6rem] uppercase tracking-wide text-blue-600 hover:text-blue-700"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 bg-gray-900 text-white border border-gray-700 rounded-full shadow-lg px-4 py-2">
          <span className="uppercase tracking-wide text-[0.55rem] text-gray-400">Utility</span>
          <button
            onClick={() => setFiltersCollapsed(prev => !prev)}
            className={utilityButtonClasses}
            aria-pressed={!filtersCollapsed}
          >
            {filtersCollapsed ? 'Show filters' : 'Hide filters'}
          </button>
          <button
            onClick={scrollGalleryToTop}
            className={utilityButtonClasses}
          >
            Scroll top
          </button>
          <button
            onClick={scrollToUploader}
            className={utilityButtonClasses}
          >
            Go to uploader
          </button>
        </div>
      </div>

      {!hasResults ? (
        <div id="gallery-empty-state" className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 20 20" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500">
            {images.length === 0 ? 'No images uploaded yet' : 'No images match your filters'}
          </p>
          <p className="text-[0.7em] font-mono text-gray-400">
            {images.length === 0 ? 'Upload some images to see them here' : 'Try adjusting your search or filters'}
          </p>
        </div>
      ) : (
        viewMode === 'grid' ? (
          <div id="gallery-results-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 [grid-auto-rows:1fr]">
            {pageImages.map((image) => {
              const variationChildren = childrenMap[image.id] || [];
              const imageUrl = getImageUrl(image, selectedVariant);
              const svgImage = isSvgImage(image);
              const displayUrl = svgImage ? getCloudflareImageUrl(image.id, 'original') : imageUrl;
              return (
                <div
                  key={image.id}
                  className="z-0 group bg-gray-100 rounded-lg overflow-hidden flex flex-col h-full"
                >
                  <Link
                    href={`/images/${image.id}`}
                    className={`relative block w-full cursor-pointer ${respectAspectRatio ? '' : 'aspect-square'}`}
                    style={
                      respectAspectRatio && image.dimensions
                        ? { paddingBottom: `${(image.dimensions.height / image.dimensions.width) * 100}%` }
                        : respectAspectRatio
                          ? { paddingBottom: '75%' }
                          : undefined
                    }
                    onMouseEnter={(e) => handleMouseEnter(image.id, e)}
                    onMouseMove={(e) => handleMouseMove(image.id, e)}
                    onMouseLeave={handleMouseLeave}
                    prefetch={false}
                  >
                    {svgImage ? (
                      <img
                        src={displayUrl}
                        alt={image.filename}
                        className={`absolute inset-0 w-full h-full ${respectAspectRatio ? 'object-contain bg-white' : 'object-cover'}`}
                      />
                    ) : (
                      <Image
                        src={displayUrl}
                        alt={image.filename}
                        fill
                        className={respectAspectRatio ? 'object-contain bg-gray-50' : 'object-cover'}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    )}
                  </Link>
                  
                  {/* Metadata footer */}
                  <div id="metadata-footer" className="px-3 py-2 bg-white border-t border-gray-100 flex-1 flex flex-col">
                    <div className="flex-1 flex flex-col gap-1">
                      <p className="text-[0.6rem] font-mono font-semibold text-gray-900 truncate" title={image.filename} style={{ lineHeight: '1.2' }}>
                        {image.filename}
                      </p>
                      <div className="text-gray-500 text-[0.6rem] mt-1 space-y-0.5">
                        <p>{new Date(image.uploaded).toLocaleDateString()}</p>
                        <p>📁 {image.folder ? image.folder : '[none]'}</p>
                        <AspectRatioDisplay imageId={image.id} />
                        {image.tags && image.tags.length > 0 ? (
                          <p>🏷️ {image.tags.slice(0, 2).join(', ')}{image.tags.length > 2 ? '...' : ''}</p>
                        ) : (
                          <p className="text-gray-400">🏷️ [no tags]</p>
                        )}
                        <p
                          className={`text-[0.6rem] truncate leading-snug ${image.altTag ? 'text-gray-600' : 'text-gray-400 italic'}`}
                          title={image.altTag || undefined}
                        >
                          {image.altTag ? `📝 ${image.altTag}` : 'No ALT text yet'}
                        </p>
                        {variationChildren.length > 0 && (
                          <p className="text-[0.6rem] text-blue-600 flex items-center gap-1" title="Has variations">
                            <Layers className="h-3.5 w-3.5" />
                            {variationChildren.length} variation{variationChildren.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); generateAltTag(image.id); }}
                        disabled={Boolean(altLoadingMap[image.id])}
                        className="w-full inline-flex items-center justify-center gap-2 bg-gray-900 text-white rounded-md px-3 py-1.5 text-[0.6rem] transition hover:bg-black disabled:opacity-50"
                      >
                        <Sparkles className="text-[0.8rem] h-3.5 w-3.5" />
                        {altLoadingMap[image.id] ? 'Generating ALT...' : image.altTag ? 'Refresh text' : 'Gen ALT text'}
                      </button>
                    </div>
                  </div>

                  {/* Action bar below metadata to ensure icons are never obscured */}
                  <div className="flex flex-wrap justify-center gap-1.5 py-1.5 bg-white border-b border-gray-200 z-30 mt-auto">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenCopyMenu(openCopyMenu === image.id ? null : image.id); }}
                      className="inline-flex items-center justify-center bg-black text-white rounded-full px-2.5 py-1 text-[0.7rem] shadow-sm min-h-[32px] min-w-[32px] cursor-pointer transition-transform transform hover:scale-105 active:scale-95 hover:shadow-lg focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-black/40"
                      title="Copy URL"
                      aria-label="Copy URL"
                    >
                      <Copy className="h-[12px] w-[12px]" />
                    </button>
                    <button
                      onClick={() => window.open(`/images/${image.id}`, '_blank')}
                      className="inline-flex items-center justify-center bg-black text-white rounded-full px-2.5 py-1 text-[0.7rem] shadow-sm min-h-[32px] min-w-[32px] cursor-pointer transition-transform transform hover:scale-105 active:scale-95 hover:shadow-lg focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-black/40"
                      title="Open in new tab"
                      aria-label="Open in new tab"
                    >
                      <ExternalLink className="h-[12px] w-[12px]" />
                    </button>
                    <button
                      onClick={() => startEdit(image)}
                      className="inline-flex items-center justify-center bg-black text-white rounded-full px-2.5 py-1 text-[0.7rem] shadow-sm min-h-[32px] min-w-[32px] cursor-pointer transition-transform transform hover:scale-105 active:scale-95 hover:shadow-lg focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-black/40"
                      title="Edit folder/tags"
                      aria-label="Edit folder/tags"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Variants button removed — clipboard button opens the full-sheet modal */}
                    <button
                      onClick={() => deleteImage(image.id)}
                      className="inline-flex items-center justify-center bg-black text-white rounded-full px-2.5 py-1 text-[0.7rem] shadow-sm min-h-[32px] min-w-[32px] cursor-pointer transition-transform transform hover:scale-105 active:scale-95 hover:shadow-lg focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-black/40"
                      title="Delete image"
                      aria-label="Delete image"
                    >
                      <Trash2 className="h-[12px] w-[12px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {pageImages.map((image) => {
              const variationChildren = childrenMap[image.id] || [];
              const imageUrl = getImageUrl(image, selectedVariant);
              const svgImage = isSvgImage(image);
              const displayUrl = svgImage ? getCloudflareImageUrl(image.id, 'original') : imageUrl;
              return (
                <div
                  key={image.id}
                  className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Link
                    href={`/images/${image.id}`}
                    className="w-16 h-16 relative bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnter(image.id, e)}
                    onMouseMove={(e) => handleMouseMove(image.id, e)}
                    onMouseLeave={handleMouseLeave}
                    prefetch={false}
                  >
                    {svgImage ? (
                      <img
                        src={displayUrl}
                        alt={image.filename}
                        className="absolute inset-0 w-full h-full object-contain bg-white"
                      />
                    ) : (
                      <Image
                        src={displayUrl}
                        alt={image.filename}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    )}
                  </Link>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.7em] font-mono font-mono font-medum text-gray-900 truncate">
                      {image.filename}
                    </p>
                    <p className="text-[0.7em] font-mono text-gray-500">
                      {new Date(image.uploaded).toLocaleDateString()}
                    </p>
                    <p className="text-[0.7em] font-mono text-gray-500">📁 {image.folder ? image.folder : '[none]'}</p>
                    <div className="text-[0.7em] font-mono text-gray-500">
                      <AspectRatioDisplay imageId={image.id} />
                    </div>
                    {image.tags && image.tags.length > 0 ? (
                      <p className="text-[0.7em] font-mono text-gray-500">🏷️ {image.tags.join(', ')}</p>
                    ) : (
                      <p className="text-[0.7em] font-mono text-gray-400">🏷️ [no tags]</p>
                    )}
                    <p
                      className={`text-[0.7em] font-mono mt-1 ${image.altTag ? 'text-gray-600' : 'text-gray-400 italic'}`}
                      title={image.altTag || undefined}
                    >
                      {image.altTag ? `📝 ${image.altTag}` : 'No ALT text yet'}
                    </p>
                    {variationChildren.length > 0 && (
                      <p className="text-[0.7em] font-mono text-blue-600 flex items-center gap-1 mt-1" title="Has variations">
                        <Layers className="h-3.5 w-3.5" />
                        {variationChildren.length} variation{variationChildren.length > 1 ? 's' : ''}
                      </p>
                    )}
                    <button
                      onClick={() => generateAltTag(image.id)}
                      disabled={Boolean(altLoadingMap[image.id])}
                      className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-[0.7em] font-mono rounded-md border border-gray-200 text-gray-700 hover:border-gray-300 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {altLoadingMap[image.id] ? 'Generating ALT...' : image.altTag ? 'Refresh' : 'Generate ALT text'}
                    </button>
                  </div>
                  
                  <div className="flex space-x-2">
                    <div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenCopyMenu(openCopyMenu === image.id ? null : image.id); }}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer transition-transform transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300"
                        title="Copy URL"
                      >
                        <Copy className="h-[12px] w-[12px]" />
                      </button>
                    </div>
                    <button
                      onClick={() => window.open(`/images/${image.id}`, '_blank')}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors cursor-pointer transition-transform transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-300"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-[12px] w-[12px]" />
                    </button>
                    <button
                      onClick={() => startEdit(image)}
                      className="p-2 text-gray-400 hover:text-yellow-600 transition-colors cursor-pointer transition-transform transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-300"
                      title="Edit folder/tags"
                    >
                      <svg className="h-[12px] w-[12px]" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteImage(image.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors cursor-pointer transition-transform transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-300"
                      title="Delete image"
                    >
                      <Trash2 className="h-[12px] w-[12px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {showPagination && hasResults && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 text-[0.7em] font-mono text-gray-600 border-t border-gray-100 pt-4">
          <div>
            {currentPageRangeLabel && (
              <p>Currently viewing uploads from {currentPageRangeLabel}</p>
            )}
            <p className="text-[0.7em] font-mono text-gray-400">Page {pageIndex} of {totalPages}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousPage}
              disabled={pageIndex === 1}
              className="px-3 py-1.5 border rounded-md disabled:opacity-40"
              title={prevPageRangeLabel ? `Previous (${prevPageRangeLabel})` : 'Previous page'}
            >
              Previous
            </button>
            <button
              onClick={goToNextPage}
              disabled={pageIndex === totalPages}
              className="px-3 py-1.5 border rounded-md disabled:opacity-40"
              title={nextPageRangeLabel ? `Next (${nextPageRangeLabel})` : 'Next page'}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Global Copy Modal (works for grid and list) */}
      {openCopyMenu && (() => {
        const modalImage = images.find(i => i.id === openCopyMenu);
        if (!modalImage) return null;
        const blurOverlayStyle: CSSProperties = {
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        };
        return (
          <>
              <div
                className="fixed inset-0 bg-black/30 backdrop-blur-md z-[100000]"
                style={blurOverlayStyle}
                onClick={(e) => { e.stopPropagation(); setOpenCopyMenu(null); }}
              />
              <div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-white rounded-lg shadow-xl z-[100001] text-[0.7em] font-mono text-gray-800 border">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="text-[0.7em] font-mono font-mono font-medum">Copy Image URL</div>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenCopyMenu(null); }}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-[0.7em] font-mono"
                  title="Close"
                >
                  ×
                </button>
              </div>
              <div className="p-3 max-h-80 overflow-auto">
                {Object.entries(getVariantUrls(modalImage)).map(([variant, url]) => (
                  <div key={variant} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="text-[0.7em] font-mono font-mono font-semibold text-gray-900 capitalize">{variant}</div>
                      <div className="text-[0.7em] font-mono text-gray-500 truncate">{String(url)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(String(url), variant); setOpenCopyMenu(null); }}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 active:bg-blue-300 rounded text-[0.7em] font-mono font-medium flex-shrink-0 cursor-pointer transition transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300"
                      >
                        Copy
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await downloadVariantToFile(String(url), modalImage.filename);
                        }}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-[0.7em] font-mono font-medium flex-shrink-0 cursor-pointer"
                        title="Download"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* Edit Modal */}
      {editingImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit Image Organization
            </h3>
            
            <div id="gallery-results-list" className="space-y-4">
              <div>
                <label htmlFor="edit-folder" className="block text-[0.7em] font-mono font-mono font-medum text-gray-700 mb-1">
                  Folder
                </label>
                <div>
                  <MonoSelect
                    id="edit-folder"
                    value={editFolderSelect}
                    onChange={setEditFolderSelect}
                    options={editFolderOptions}
                    className="w-full"
                  />
                  {editFolderSelect === '__create__' && (
                    <input
                      value={newEditFolder}
                      onChange={(e) => setNewEditFolder(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-[0.7em] font-mono mt-2"
                      placeholder="Type new folder name"
                    />
                  )}
                </div>
                <p className="text-[0.7em] font-mono text-gray-500 mt-1">Select existing folder or create a new one</p>
              </div>
              
              <div>
                <label htmlFor="edit-tags" className="block text-[0.7em] font-mono font-mono font-medum text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  id="edit-tags"
                  type="text"
                  placeholder="logo, header, banner (comma separated)"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-[0.7em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[0.7em] font-mono text-gray-500 mt-1">Separate tags with commas</p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-[0.7em] font-mono text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveEdit(editingImage)}
                className="px-4 py-2 text-[0.7em] font-mono bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hover Preview */}
      {hoveredImage && showPreview && (
        <HoverPreview
          imageId={hoveredImage}
          filename={images.find(img => img.id === hoveredImage)?.filename || 'Unknown'}
          isVisible={showPreview}
          mousePosition={mousePosition}
          onClose={handleMouseLeave}
          dimensions={images.find(img => img.id === hoveredImage)?.dimensions}
        />
      )}
    </div>
  );
});

ImageGallery.displayName = 'ImageGallery';

export default ImageGallery;
