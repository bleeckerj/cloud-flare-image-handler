'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useMemo, CSSProperties, useRef } from 'react';
import { Trash2, Copy, ExternalLink, Sparkles, Layers } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import MonoSelect from './MonoSelect';
import { getCloudflareImageUrl, getMultipleImageUrls } from '@/utils/imageUtils';
import { useToast } from './Toast';
import { useImageAspectRatio } from '@/hooks/useImageAspectRatio';
import HoverPreview from './HoverPreview';

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
}

interface ImageGalleryProps {
  refreshTrigger?: number;
}

export interface ImageGalleryRef {
  refreshImages: () => void;
}

const PAGE_SIZE = 15;

const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(({ refreshTrigger }, ref) => {
  const [images, setImages] = useState<CloudflareImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string>('public');
  const [openCopyMenu, setOpenCopyMenu] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  const [editFolderSelect, setEditFolderSelect] = useState<string>('');
  const [newEditFolder, setNewEditFolder] = useState<string>('');
  const [altLoadingMap, setAltLoadingMap] = useState<Record<string, boolean>>({});
  
  // Hover preview state
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const galleryTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchImages(true); // Silent refresh
    }
  }, [refreshTrigger]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

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

  // Hover preview handlers
  const handleMouseEnter = (imageId: string, event: React.MouseEvent) => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    setHoveredImage(imageId);
    setMousePosition({ x: event.clientX, y: event.clientY });

    // Set timeout for 800ms before showing preview
    const timeout = setTimeout(() => {
      setShowPreview(true);
    }, 800);

    setHoverTimeout(timeout);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    setMousePosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseLeave = () => {
    // Clear timeout and hide preview
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    
    setHoveredImage(null);
    setShowPreview(false);
  };

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
        <p className="text-xs text-gray-400">
          📐 <span className="inline-block w-8 h-2 bg-gray-200 rounded animate-pulse"></span>
        </p>
      );
    }

    if (error || !aspectRatio) {
      return <p className="text-xs text-gray-400">📐 --</p>;
    }

    return (
      <p className="text-xs text-gray-500 flex items-center gap-1">
        📐 {aspectRatio} {getOrientationIcon(aspectRatio)}
      </p>
    );
  };

  const VARIANT_PRESETS = ['small', 'medium', 'large', 'xlarge', 'original', 'thumbnail'];

  const getVariantUrls = (image: CloudflareImage) => {
    return getMultipleImageUrls(image.id, VARIANT_PRESETS);
  };

  const uniqueFolders = useMemo(
    () => Array.from(new Set(images.filter(img => img.folder && img.folder.trim()).map(img => img.folder))),
    [images]
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
      ...uniqueFolders.map(folder => ({ value: folder, label: folder as string }))
    ],
    [uniqueFolders]
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

  const filteredImages = useMemo(() => {
    return images.filter(image => {
      const matchesFolder = selectedFolder === 'all' ||
        (selectedFolder === 'no-folder' && !image.folder) ||
        image.folder === selectedFolder;

      const matchesTag = !selectedTag || (image.tags && image.tags.includes(selectedTag));

      const matchesSearch = !searchTerm ||
        image.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (image.tags && image.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (image.folder && image.folder.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesFolder && matchesTag && matchesSearch;
    });
  }, [images, selectedFolder, selectedTag, searchTerm]);

  const sortedImages = useMemo(() => {
    return [...filteredImages].sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());
  }, [filteredImages]);

  const totalPages = Math.max(1, Math.ceil(sortedImages.length / PAGE_SIZE));
  const pageIndex = Math.min(currentPage, totalPages);
  const pageSliceStart = (pageIndex - 1) * PAGE_SIZE;
  const pageImages = sortedImages.slice(pageSliceStart, pageSliceStart + PAGE_SIZE);
  const showPagination = sortedImages.length > PAGE_SIZE;
  const hasResults = sortedImages.length > 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFolder, selectedTag, searchTerm]);

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

  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  useEffect(() => {
    if (galleryTopRef.current) {
      galleryTopRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [currentPage]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
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
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div
        ref={galleryTopRef}
        className="sticky top-0 z-20 -m-6 mb-6 p-6 pb-4 bg-white/95 backdrop-blur rounded-t-lg border-b border-gray-100"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-mono text-gray-900">
              Image Gallery ({filteredImages.length}/{images.length})
            </p>
            {showPagination && currentPageRangeLabel && (
              <p className="font-mono text-xs text-gray-500">
                Showing uploads from {currentPageRangeLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showPagination && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
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
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              {viewMode === 'grid' ? '📋 List' : '🔲 Grid'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label htmlFor="search" className="block text-xs font-mono font-medum text-gray-700 mb-1">
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search files, tags, folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="folder-filter" className="block text-xs font-mono font-medum text-gray-700 mb-1">
              Folder
            </label>
            <MonoSelect
              id="folder-filter"
              value={selectedFolder}
              onChange={setSelectedFolder}
              options={folderFilterOptions}
              className="w-full"
            />
          </div>
          
          <div>
            <label htmlFor="tag-filter" className="block text-xs font-mono font-medum text-gray-700 mb-1">
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
            <label htmlFor="variant-select" className="block text-xs font-mono font-medum text-gray-700 mb-1">
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
        </div>
      </div>

      {!hasResults ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 20 20" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500">
            {images.length === 0 ? 'No images uploaded yet' : 'No images match your filters'}
          </p>
          <p className="text-xs text-gray-400">
            {images.length === 0 ? 'Upload some images to see them here' : 'Try adjusting your search or filters'}
          </p>
        </div>
      ) : (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 [grid-auto-rows:1fr]">
            {pageImages.map((image) => {
              const variationChildren = childrenMap[image.id] || [];
              const imageUrl = getImageUrl(image, selectedVariant);
              return (
                <div
                  key={image.id}
                  className="group bg-gray-100 rounded-lg overflow-hidden flex flex-col h-full"
                >
                  <Link
                    href={`/images/${image.id}`}
                    className="relative block w-full aspect-square cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnter(image.id, e)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    prefetch={false}
                  >
                    <Image
                      src={imageUrl}
                      alt={image.filename}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </Link>
                  
                  {/* Metadata footer */}
                  <div className="px-3 py-2 bg-white border-t border-gray-100 flex-1 flex flex-col">
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
              return (
                <div
                  key={image.id}
                  className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Link
                    href={`/images/${image.id}`}
                    className="w-16 h-16 relative bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnter(image.id, e)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    prefetch={false}
                  >
                    <Image
                      src={imageUrl}
                      alt={image.filename}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </Link>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medum text-gray-900 truncate">
                      {image.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(image.uploaded).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">📁 {image.folder ? image.folder : '[none]'}</p>
                    <div className="text-xs text-gray-500">
                      <AspectRatioDisplay imageId={image.id} />
                    </div>
                    {image.tags && image.tags.length > 0 ? (
                      <p className="text-xs text-gray-500">🏷️ {image.tags.join(', ')}</p>
                    ) : (
                      <p className="text-xs text-gray-400">🏷️ [no tags]</p>
                    )}
                    <p
                      className={`text-xs mt-1 ${image.altTag ? 'text-gray-600' : 'text-gray-400 italic'}`}
                      title={image.altTag || undefined}
                    >
                      {image.altTag ? `📝 ${image.altTag}` : 'No ALT text yet'}
                    </p>
                    {variationChildren.length > 0 && (
                      <p className="text-xs text-blue-600 flex items-center gap-1 mt-1" title="Has variations">
                        <Layers className="h-3.5 w-3.5" />
                        {variationChildren.length} variation{variationChildren.length > 1 ? 's' : ''}
                      </p>
                    )}
                    <button
                      onClick={() => generateAltTag(image.id)}
                      disabled={Boolean(altLoadingMap[image.id])}
                      className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-700 hover:border-gray-300 disabled:opacity-50"
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
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 text-xs text-gray-600 border-t border-gray-100 pt-4">
          <div>
            {currentPageRangeLabel && (
              <p>Currently viewing uploads from {currentPageRangeLabel}</p>
            )}
            <p className="text-xs text-gray-400">Page {pageIndex} of {totalPages}</p>
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
              <div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-white rounded-lg shadow-xl z-[100001] text-xs text-gray-800 border">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="text-xs font-mono font-medum">Copy Image URL</div>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenCopyMenu(null); }}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                  title="Close"
                >
                  ×
                </button>
              </div>
              <div className="p-3 max-h-80 overflow-auto">
                {Object.entries(getVariantUrls(modalImage)).map(([variant, url]) => (
                  <div key={variant} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="text-xs font-mono font-semibold text-gray-900 capitalize">{variant}</div>
                      <div className="text-xs text-gray-500 truncate">{String(url)}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(String(url), variant); setOpenCopyMenu(null); }}
                      className="px-3 py-1 bg-blue-100 hover:bg-blue-200 active:bg-blue-300 rounded text-xs font-medium flex-shrink-0 cursor-pointer transition transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300"
                    >
                      Copy
                    </button>
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
            
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-folder" className="block text-xs font-mono font-medum text-gray-700 mb-1">
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
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs mt-2"
                      placeholder="Type new folder name"
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Select existing folder or create a new one</p>
              </div>
              
              <div>
                <label htmlFor="edit-tags" className="block text-xs font-mono font-medum text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  id="edit-tags"
                  type="text"
                  placeholder="logo, header, banner (comma separated)"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-xs text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveEdit(editingImage)}
                className="px-4 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
