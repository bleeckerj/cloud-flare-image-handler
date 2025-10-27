'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Trash2, Copy, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { getCloudflareImageUrl, getMultipleImageUrls } from '@/utils/imageUtils';
import { useToast } from './Toast';

interface CloudflareImage {
  id: string;
  filename: string;
  uploaded: string;
  variants: string[];
  folder?: string;
  tags?: string[];
}

interface ImageGalleryProps {
  refreshTrigger?: number;
}

export interface ImageGalleryRef {
  refreshImages: () => void;
}

const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(({ refreshTrigger }, ref) => {
  const [images, setImages] = useState<CloudflareImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string>('public');
  const [openCopyMenu, setOpenCopyMenu] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editFolder, setEditFolder] = useState<string>('');
  const [editTags, setEditTags] = useState<string>('');

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

  const startEdit = (image: CloudflareImage) => {
    setEditingImage(image.id);
    setEditFolder(image.folder || '');
    setEditTags(image.tags ? image.tags.join(', ') : '');
  };

  const cancelEdit = () => {
    setEditingImage(null);
    setEditFolder('');
    setEditTags('');
  };

  const saveEdit = async (imageId: string) => {
    try {
      const response = await fetch(`/api/images/${imageId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folder: editFolder.trim() || undefined,
          tags: editTags.trim() ? editTags.split(',').map(t => t.trim()) : []
        })
      });

      if (response.ok) {
        // Update the local state
        setImages(prev => prev.map(img => 
          img.id === imageId 
            ? { 
                ...img, 
                folder: editFolder.trim() || undefined,
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

  const getImageUrl = (image: CloudflareImage, variant: string = 'public') => {
    // Use the utility function with the variant string directly
    return getCloudflareImageUrl(image.id, variant === 'public' ? 'original' : variant);
  };

  const VARIANT_PRESETS = ['small', 'medium', 'large', 'xlarge', 'original', 'thumbnail'];

  const getVariantUrls = (image: CloudflareImage) => {
    return getMultipleImageUrls(image.id, VARIANT_PRESETS);
  };

  // Get unique folders and tags for filtering
  const uniqueFolders = Array.from(new Set(images.filter(img => img.folder && img.folder.trim()).map(img => img.folder)));
  const uniqueTags = Array.from(new Set(images.flatMap(img => Array.isArray(img.tags) ? img.tags.filter(tag => tag && tag.trim()) : [])));
  
  // Debug: Log folders and tags
  console.log('Unique folders found:', uniqueFolders);
  console.log('Unique tags found:', uniqueTags);
  console.log('Total images:', images.length);

  // Filter images based on search and selections
  const filteredImages = images.filter(image => {
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Image Gallery ({filteredImages.length}/{images.length})
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            {viewMode === 'grid' ? '📋 List' : '🔲 Grid'}
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search files, tags, folders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="folder-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Folder
          </label>
          <select
            id="folder-filter"
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All folders</option>
            <option value="no-folder">No folder</option>
            {uniqueFolders.map(folder => (
              <option key={folder} value={folder}>{folder}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="tag-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Tag
          </label>
          <select
            id="tag-filter"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All tags</option>
            {uniqueTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="variant-select" className="block text-sm font-medium text-gray-700 mb-1">
            Image Size
          </label>
          <select
            id="variant-select"
            value={selectedVariant}
            onChange={(e) => setSelectedVariant(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="public">Original (Full Size)</option>
            <option value="w=300">Small (300px)</option>
            <option value="w=600">Medium (600px)</option>
            <option value="w=900">Large (900px)</option>
            <option value="w=1230">X-Large (1230px)</option>
            <option value="thumbnail">Thumbnail (preset)</option>
          </select>
        </div>
      </div>

      {filteredImages.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500">
            {images.length === 0 ? 'No images uploaded yet' : 'No images match your filters'}
          </p>
          <p className="text-sm text-gray-400">
            {images.length === 0 ? 'Upload some images to see them here' : 'Try adjusting your search or filters'}
          </p>
        </div>
      ) : (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredImages.map((image) => {
              const imageUrl = getImageUrl(image, selectedVariant);
              return (
                <div
                  key={image.id}
                  className="group bg-gray-100 rounded-lg overflow-hidden"
                >
                  <div className="relative w-full aspect-square">
                    <Image
                      src={imageUrl}
                      alt={image.filename}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  
                  {/* Metadata footer (always visible, outside image) */}
                  <div className="px-3 py-2 bg-white border-t border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate" title={image.filename} style={{ lineHeight: '1.2' }}>
                      {image.filename}
                    </p>
                    <div className="text-gray-500 text-xs mt-1 space-y-0.5">
                      <p>{new Date(image.uploaded).toLocaleDateString()}</p>
                      <p>📁 {image.folder ? image.folder : '[none]'}</p>
                      {image.tags && image.tags.length > 0 ? (
                        <p>🏷️ {image.tags.slice(0, 2).join(', ')}{image.tags.length > 2 ? '...' : ''}</p>
                      ) : (
                        // Keep a blank line for alignment when tags are absent
                        <p className="h-4">&nbsp;</p>
                      )}
                      {/* description field is optional in CloudflareImage; omitted here */}
                    </div>
                  </div>

                  {/* Action bar below metadata to ensure icons are never obscured */}
                  <div className="flex flex-wrap justify-center gap-2 py-2 bg-white border-b border-gray-200 z-30">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenCopyMenu(openCopyMenu === image.id ? null : image.id); }}
                      className="inline-flex items-center gap-2 bg-black text-white rounded-full px-3 py-1.5 text-xs shadow-sm min-h-[36px] min-w-[36px]"
                      title="Copy URL"
                      aria-label="Copy URL"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => window.open(imageUrl, '_blank')}
                      className="inline-flex items-center gap-2 bg-black text-white rounded-full px-3 py-1.5 text-xs shadow-sm min-h-[36px] min-w-[36px]"
                      title="Open in new tab"
                      aria-label="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => startEdit(image)}
                      className="inline-flex items-center gap-2 bg-black text-white rounded-full px-3 py-1.5 text-xs shadow-sm min-h-[36px] min-w-[36px]"
                      title="Edit folder/tags"
                      aria-label="Edit folder/tags"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Variants button removed — clipboard button opens the full-sheet modal */}
                    <button
                      onClick={() => deleteImage(image.id)}
                      className="inline-flex items-center gap-2 bg-black text-white rounded-full px-3 py-1.5 text-xs shadow-sm min-h-[36px] min-w-[36px]"
                      title="Delete image"
                      aria-label="Delete image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredImages.map((image) => {
              const imageUrl = getImageUrl(image, selectedVariant);
              return (
                <div
                  key={image.id}
                  className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="w-16 h-16 relative bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={imageUrl}
                      alt={image.filename}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {image.filename}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(image.uploaded).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">📁 {image.folder ? image.folder : '[none]'}</p>
                    {image.tags && image.tags.length > 0 && (
                      <p className="text-xs text-gray-500">🏷️ {image.tags.join(', ')}</p>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenCopyMenu(openCopyMenu === image.id ? null : image.id); }}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Copy URL"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => window.open(imageUrl, '_blank')}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => startEdit(image)}
                      className="p-2 text-gray-400 hover:text-yellow-600 transition-colors"
                      title="Edit folder/tags"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteImage(image.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Global Copy Modal (works for grid and list) */}
      {openCopyMenu && (() => {
        const modalImage = images.find(i => i.id === openCopyMenu);
        if (!modalImage) return null;
        return (
          <>
              <div
                className="fixed inset-0 bg-black/30 backdrop-blur-md z-[100000]"
                style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any}
                onClick={(e) => { e.stopPropagation(); setOpenCopyMenu(null); }}
              />
              <div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-white rounded-lg shadow-xl z-[100001] text-sm text-gray-800 border">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="text-sm font-medium">Copy Image URL</div>
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
                      className="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs font-medium flex-shrink-0"
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
                <label htmlFor="edit-folder" className="block text-sm font-medium text-gray-700 mb-1">
                  Folder
                </label>
                <input
                  id="edit-folder"
                  type="text"
                  list="folder-options"
                  placeholder="Type folder name or select existing"
                  value={editFolder}
                  onChange={(e) => setEditFolder(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="folder-options">
                  <option value="" />
                  <option value="email-campaigns" />
                  <option value="website-images" />
                  <option value="social-media" />
                  <option value="blog-posts" />
                  {uniqueFolders.map(folder => (
                    <option key={folder} value={folder} />
                  ))}
                </datalist>
                <p className="text-xs text-gray-500 mt-1">Type a new folder name or select from existing ones</p>
              </div>
              
              <div>
                <label htmlFor="edit-tags" className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  id="edit-tags"
                  type="text"
                  placeholder="logo, header, banner (comma separated)"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveEdit(editingImage)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ImageGallery.displayName = 'ImageGallery';

export default ImageGallery;