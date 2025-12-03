"use client";

import React, { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getMultipleImageUrls, getCloudflareImageUrl } from '@/utils/imageUtils';
import { useToast } from '@/components/Toast';
import { Sparkles } from 'lucide-react';
import FolderManagerButton from '@/components/FolderManagerButton';
import MonoSelect from '@/components/MonoSelect';

import { useParams } from 'next/navigation';

interface CloudflareImage {
  id: string;
  filename: string;
  uploaded: string;
  variants?: string[];
  folder?: string;
  tags?: string[];
  description?: string;
  originalUrl?: string;
  parentId?: string;
  linkedAssetId?: string;
}

export default function ImageDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [image, setImage] = useState<CloudflareImage | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [allImages, setAllImages] = useState<CloudflareImage[]>([]);
  const [reassignParentId, setReassignParentId] = useState('');
  const [adoptImageId, setAdoptImageId] = useState('');
  const [parentActionLoading, setParentActionLoading] = useState(false);
  const [childDetachingId, setChildDetachingId] = useState<string | null>(null);
  const [adoptLoading, setAdoptLoading] = useState(false);
  const [adoptSearch, setAdoptSearch] = useState('');
  const [childUploadFiles, setChildUploadFiles] = useState<File[]>([]);
  const [childUploadTags, setChildUploadTags] = useState('');
  const [childUploadFolder, setChildUploadFolder] = useState('');
  const [childUploadLoading, setChildUploadLoading] = useState(false);
  const [adoptFolderFilter, setAdoptFolderFilter] = useState('');
  const [altLoadingMap, setAltLoadingMap] = useState<Record<string, boolean>>({});
  const [variationPage, setVariationPage] = useState(1);
  const [adoptPage, setAdoptPage] = useState(1);
  const VARIATION_PAGE_SIZE = 12;
  const ADOPT_PAGE_SIZE = 12;
  const [hoverPreview, setHoverPreview] = useState<{
    url: string;
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const childUploadInputRef = useRef<HTMLInputElement | null>(null);

  const [folderSelect, setFolderSelect] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [originalUrlInput, setOriginalUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uniqueFolders, setUniqueFolders] = useState<string[]>([]);
const [newFolderInput, setNewFolderInput] = useState('');
  const [variantModalState, setVariantModalState] = useState<{ target: CloudflareImage; mode: 'single' | 'list' } | null>(null);

  useEffect(() => {
    setVariationPage(1);
  }, [image?.id, image?.parentId]);

  const syncImages = useCallback(
    (imagesData: CloudflareImage[]) => {
      setAllImages(imagesData);
      const found = imagesData.find((img) => img.id === id) || null;
      setImage(found);
      if (found) {
        setFolderSelect(found.folder || '');
        setTagsInput(Array.isArray(found.tags) ? found.tags.join(', ') : '');
        setDescriptionInput(found.description || '');
        setOriginalUrlInput(found.originalUrl || '');
        setReassignParentId(found.parentId || '');
        setChildUploadFolder(found.folder || '');
      } else {
        setFolderSelect('');
        setTagsInput('');
        setDescriptionInput('');
        setOriginalUrlInput('');
        setReassignParentId('');
        setChildUploadFolder('');
      }
      const folders = Array.from(
        new Set(
          imagesData
            .filter((img) => img.folder && img.folder.trim())
            .map((img) => String(img.folder))
        )
      );
      setUniqueFolders(folders as string[]);
    },
    [id]
  );

  const refreshImageList = useCallback(async () => {
    if (!id) {
      return;
    }
    try {
      const response = await fetch('/api/images');
      const data = await response.json();
      if (Array.isArray(data.images)) {
        syncImages(data.images);
      }
    } catch (error) {
      console.error('Failed to refresh images', error);
    }
  }, [syncImages, id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        if (!id) {
          return;
        }
        const res = await fetch('/api/images');
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data.images)) {
          syncImages(data.images);
        }
      } catch (err) {
        console.error('Failed to fetch image from API', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, syncImages]);

  const variationChildren = useMemo(
    () => (id ? allImages.filter((img) => img.parentId === id) : []),
    [allImages, id]
  );

  const siblingVariations = useMemo(() => {
    if (!image?.parentId) return [];
    return allImages.filter(
      (img) => img.parentId === image.parentId && img.id !== image.id
    );
  }, [allImages, image?.parentId, image?.id]);

  const displayedVariations = useMemo(() => {
    return image?.parentId ? siblingVariations : variationChildren;
  }, [image?.parentId, siblingVariations, variationChildren]);

  const pagedVariations = useMemo(() => {
    const start = (variationPage - 1) * VARIATION_PAGE_SIZE;
    return displayedVariations.slice(start, start + VARIATION_PAGE_SIZE);
  }, [displayedVariations, variationPage]);

  const totalVariationPages = Math.max(
    1,
    Math.ceil(displayedVariations.length / VARIATION_PAGE_SIZE)
  );

  const parentImage = useMemo(() => {
    if (!image?.parentId) return null;
    return allImages.find((img) => img.id === image.parentId) || null;
  }, [allImages, image?.parentId]);

  const parentWithChildren = useMemo(() => {
    const set = new Set<string>();
    allImages.forEach((img) => {
      if (img.parentId) {
        set.add(img.parentId);
      }
    });
    return set;
  }, [allImages]);

  const adoptableImages = useMemo(
    () => allImages.filter((img) => !img.parentId && !parentWithChildren.has(img.id) && img.id !== id),
    [allImages, id, parentWithChildren]
  );

  const filteredAdoptableImages = useMemo(() => {
    const base = adoptableImages.filter((img) => {
      if (!adoptFolderFilter) return true;
      return (img.folder || '').toLowerCase() === adoptFolderFilter.toLowerCase();
    });

    if (!adoptSearch.trim()) {
      return base;
    }

    const term = adoptSearch.toLowerCase();
    return base.filter((img) => {
      const haystack = [
        img.filename,
        img.folder,
        ...(img.tags || []),
      ]
        .filter(Boolean)
        .map(String)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [adoptSearch, adoptableImages, adoptFolderFilter]);

  const totalAdoptPages = Math.max(1, Math.ceil(filteredAdoptableImages.length / ADOPT_PAGE_SIZE));
  const pagedAdoptableImages = useMemo(() => {
    const start = (adoptPage - 1) * ADOPT_PAGE_SIZE;
    return filteredAdoptableImages.slice(start, start + ADOPT_PAGE_SIZE);
  }, [filteredAdoptableImages, adoptPage]);

  const variants = useMemo(
    () => (id ? getMultipleImageUrls(id, ['thumbnail','small','medium','large','xlarge','original']) : {}),
    [id]
  );

  const originalDeliveryUrl = useMemo(
    () => (id ? getCloudflareImageUrl(id, 'original') : ''),
    [id]
  );

  const isChildImage = Boolean(image?.parentId);
  const variationCount = displayedVariations.length;

  const detailFolderOptions = useMemo(
    () => [
      { value: '', label: '[none]' },
      ...uniqueFolders.map((folder) => ({ value: folder, label: folder })),
      { value: '__create__', label: 'Create new folder…' }
    ],
    [uniqueFolders]
  );

  const reassignParentOptions = useMemo(
    () => [
      { value: '', label: 'No parent (make canonical)' },
      ...adoptableImages.map((candidate) => ({
        value: candidate.id,
        label: candidate.filename || candidate.id
      }))
    ],
    [adoptableImages]
  );

  const adoptFolderOptions = useMemo(
    () => [
      { value: '', label: 'All folders' },
      ...uniqueFolders.map((folder) => ({ value: folder, label: folder }))
    ],
    [uniqueFolders]
  );

  const copyToClipboard = async (text: string, label?: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.push(label ? `${label} URL copied` : 'URL copied to clipboard');
        return;
      }

      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        toast.push(label ? `${label} URL copied` : 'URL copied to clipboard');
      } catch (e) {
        console.error('Fallback copy failed', e);
        prompt('Copy this URL manually:', text);
      }
      document.body.removeChild(textArea);
    } catch (err) {
      console.error('Failed to copy', err);
      prompt('Copy this URL manually:', text);
    }
  };

  const patchParentAssignment = useCallback(
    async (targetId: string, parentIdValue: string) => {
      const response = await fetch(`/api/images/${targetId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: parentIdValue }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update parent relationship');
      }
      await refreshImageList();
      return payload;
    },
    [refreshImageList]
  );

  const handleDetachFromParent = useCallback(async () => {
    if (!image) return;
    setParentActionLoading(true);
    try {
      await patchParentAssignment(image.id, '');
      toast.push('Image detached from its parent');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to detach image';
      toast.push(message);
    } finally {
      setParentActionLoading(false);
    }
  }, [image, patchParentAssignment, toast]);

  const handleReassignParent = useCallback(async () => {
    if (!image) return;
    if (reassignParentId === (image.parentId ?? '')) {
      return;
    }
    setParentActionLoading(true);
    try {
      await patchParentAssignment(image.id, reassignParentId || '');
      toast.push('Parent updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update parent';
      toast.push(message);
    } finally {
      setParentActionLoading(false);
    }
  }, [image, patchParentAssignment, reassignParentId, toast]);

  const handleDetachChild = useCallback(
    async (childId: string) => {
      setChildDetachingId(childId);
      try {
        await patchParentAssignment(childId, '');
        toast.push('Variation detached');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to detach variation';
        toast.push(message);
      } finally {
        setChildDetachingId(null);
      }
    },
    [patchParentAssignment, toast]
  );

  const handleAdoptImage = useCallback(async () => {
    if (!adoptImageId) {
      return;
    }
    setAdoptLoading(true);
    try {
      await patchParentAssignment(adoptImageId, id);
      toast.push('Variation adopted');
      setAdoptImageId('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to adopt variation';
      toast.push(message);
    } finally {
      setAdoptLoading(false);
    }
  }, [adoptImageId, id, patchParentAssignment, toast]);

  const [assigningId, setAssigningId] = useState<string | null>(null);

  const handleAssignExistingAsChild = useCallback(async (targetId: string) => {
    setAssigningId(targetId);
    try {
      await patchParentAssignment(targetId, id as string);
      toast.push('Variation assigned');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign variation';
      toast.push(message);
    } finally {
      setAssigningId(null);
    }
  }, [id, patchParentAssignment, toast]);

  const handleChildUpload = useCallback(async () => {
    if (!id || childUploadFiles.length === 0) return;
    setChildUploadLoading(true);
    try {
      for (const file of childUploadFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (childUploadFolder.trim()) formData.append('folder', childUploadFolder.trim());
        if (childUploadTags.trim()) formData.append('tags', childUploadTags.trim());
        formData.append('parentId', id);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Upload failed');
        }
      }
      toast.push('Variation upload complete');
      setChildUploadFiles([]);
      await refreshImageList();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload variation';
      toast.push(message);
    } finally {
      setChildUploadLoading(false);
    }
  }, [childUploadFiles, childUploadFolder, childUploadTags, id, refreshImageList, toast]);

  const handleFolderManagerChange = useCallback(async () => {
    await refreshImageList();
  }, [refreshImageList]);

  const handleThumbMouseMove = useCallback((url: string, label: string, evt: React.MouseEvent) => {
    setHoverPreview({
      url,
      label,
      x: evt.clientX + 16,
      y: evt.clientY + 16,
    });
  }, []);

  const handleThumbLeave = useCallback(() => {
    setHoverPreview(null);
  }, []);

  const generateAltTag = useCallback(async (targetId: string) => {
    setAltLoadingMap(prev => ({ ...prev, [targetId]: true }));
    try {
      const response = await fetch(`/api/images/${targetId}/alt`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.altTag) {
        toast.push(data?.error || 'Failed to generate description');
        return;
      }
      setImage(prev => prev && prev.id === targetId ? { ...prev, altTag: data.altTag } : prev);
      if (targetId === id) {
        setDescriptionInput(data.altTag);
      }
      setAllImages(prev => prev.map(img => img.id === targetId ? { ...img, altTag: data.altTag } : img));
      toast.push('Description updated');
    } catch (error) {
      console.error('Failed to generate ALT text:', error);
      toast.push('Failed to generate description');
    } finally {
      setAltLoadingMap(prev => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    }
  }, [toast]);

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-xs text-red-500">Image ID is missing.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!image) {
    return (
      <div className="p-6">
        <p className="text-xl font-semibold">Image not found</p>
        <p className="text-xs text-gray-500">Could not fetch image metadata from server.</p>
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-xs text-blue-600 underline">
              ← Back to gallery
            </Link>
          </div>
          <div className="w-full mb-4">
            <div className="relative w-full aspect-[3/2] bg-gray-100 rounded">
              <Image
                src={originalDeliveryUrl}
                alt={image.filename || 'image'}
                fill
                className="object-contain"
                unoptimized
                priority
              />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs mono font-semibold text-gray-900">{image.filename || 'Image'}</p>
            <p className="text-xs text-gray-500 mt-1">
              Uploaded {new Date(image.uploaded).toLocaleString()}
            </p>
          </div>

          <div className="space-y-4">
            <div id="description-section">
              <p className="text-xs font-mono font-medum text-gray-700">Description</p>
              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                className="w-full font-mono text-xs border border-gray-300 rounded-md px-3 py-2 mt-2"
                rows={3}
                placeholder="Add a short description"
              />
              <button
                onClick={() => generateAltTag(image.id)}
                disabled={Boolean(altLoadingMap[image.id])}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-700 hover:border-gray-300 disabled:opacity-50 mt-2"
              >
                <Sparkles className="h-4 w-4" />
                {altLoadingMap[image.id]
                  ? 'Generating description…'
                  : image.altTag
                    ? 'Refresh AI description'
                    : 'Generate AI description'}
              </button>
            </div>

            <div id="folder-section">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono font-medum text-gray-700">Folder</p>
                <FolderManagerButton
                  size="sm"
                  label="Manage"
                  onFoldersChanged={handleFolderManagerChange}
                />
              </div>
              <div className="mt-2">
                <MonoSelect
                  value={folderSelect}
                  onChange={setFolderSelect}
                  options={detailFolderOptions}
                  className="w-full"
                  placeholder="[none]"
                />
                {folderSelect === '__create__' && (
                  <input
                    value={newFolderInput}
                    onChange={(e) => setNewFolderInput(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs mt-2"
                    placeholder="Type new folder name"
                  />
                )}
              </div>
            </div>

            <div id="tags-section">
              <p className="text-xs font-mono font-medum text-gray-700">Tags</p>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs mt-2"
                placeholder="Comma-separated tags"
              />
            </div>

            <div id="original-url-section">
              <p className="text-xs font-mono font-medum text-gray-700">Original URL</p>
              <div className="flex items-center gap-3 mt-2">
                <input
                  value={originalUrlInput}
                  onChange={(e) => setOriginalUrlInput(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-xs"
                  placeholder="Original source URL"
                />
                <button
                  onClick={async () => { await copyToClipboard(originalUrlInput || originalDeliveryUrl, 'Original'); }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs cursor-pointer transition transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300"
                >
                  Copy
                </button>
              </div>
            </div>

            <div id="variant-links-section">
              <p className="text-xs font-mono font-medum text-gray-700">Available variants</p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(variants).map(([variant, url]) => (
                  <div key={variant} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="text-xs font-mono font-semibold text-gray-900 capitalize">{variant}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs break-all">{url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600">Open</a>
                      <button
                        onClick={async () => { await copyToClipboard(url, String(variant)); }}
                        className="px-2 py-1 bg-blue-100 hover:bg-blue-200 active:bg-blue-300 rounded text-xs font-medium cursor-pointer transition transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {parentImage && (
                <div id="parent-info-section" className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 space-y-3">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1">
                      {/* <p className="text-xs font-semibold text-yellow-800">
                        Member of {parentImage.filename || 'parent image'}
                      </p> */}
                      <p className="text-xs text-yellow-700">This image is stored as a variation.</p>
                    </div>
                    <Link
                      href={`/images/${parentImage.id}`}
                      className="flex items-center gap-3 text-left group"
                      onMouseMove={(e) =>
                        handleThumbMouseMove(
                          getCloudflareImageUrl(parentImage.id, 'w=800'),
                          parentImage.filename || 'Parent image',
                          e
                        )
                      }
                      onMouseLeave={handleThumbLeave}
                      prefetch={false}
                    >
                      <div className="relative w-40 h-28 sm:w-48 sm:h-32 rounded-xl overflow-hidden border-2 border-yellow-300 bg-white shadow-sm">
                        <Image
                          src={getCloudflareImageUrl(parentImage.id, 'w=600')}
                          alt={parentImage.filename || 'Parent image'}
                          fill
                          className="object-cover transition-transform duration-200 group-hover:scale-105"
                          sizes="192px"
                          unoptimized
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-yellow-700">Parent image</p>
                        <p className="text-xs font-semibold text-blue-700 underline decoration-dotted group-hover:text-blue-800">
                          View parent details →
                        </p>
                        <p className="text-xs text-gray-600 truncate max-w-[12rem]">
                          {parentImage.filename || parentImage.id}
                        </p>
                      </div>
                    </Link>
                    <button
                      onClick={handleDetachFromParent}
                      disabled={parentActionLoading}
                      className="px-3 py-1 text-xs border border-yellow-500 text-yellow-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {parentActionLoading ? 'Detaching…' : 'Detach'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="reassign-parent" className="text-xs font-medium text-gray-700">
                      Parent
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <MonoSelect
                        id="reassign-parent"
                        value={reassignParentId}
                        onChange={setReassignParentId}
                        options={reassignParentOptions}
                        className="flex-1"
                        placeholder="Select parent"
                      />
                      <button
                        onClick={handleReassignParent}
                        disabled={
                          parentActionLoading ||
                          reassignParentId === (image.parentId ?? '')
                        }
                        className="px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {parentActionLoading ? 'Updating…' : 'Update parent'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div id="variations-section" className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono font-medum text-gray-700">
                    {isChildImage ? 'Other variations from this parent' : 'Variations'}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">
                      {variationCount}{' '}
                      {isChildImage ? 'other variation' : 'variation'}
                      {variationCount !== 1 ? 's' : ''}
                    </p>
                    {!isChildImage && (
                      <button
                        onClick={() => setVariantModalState({ target: image, mode: 'list' })}
                        className="px-2 py-1 text-[11px] border border-gray-300 rounded-md text-blue-600 hover:bg-blue-50"
                      >
                        Copy list
                      </button>
                    )}
                  </div>
                </div>

                {variationCount === 0 ? (
                  <p className="text-xs text-gray-500">
                    {isChildImage
                      ? 'No other variations exist for this parent yet.'
                      : 'No variations have been added yet.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pagedVariations.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-4 border border-gray-200 rounded-lg p-3 relative"
                        onMouseLeave={handleThumbLeave}
                      >
                        <Link
                          href={`/images/${child.id}`}
                          className="w-16 h-12 relative rounded overflow-hidden bg-gray-100 block"
                          onMouseMove={(e) => handleThumbMouseMove(getCloudflareImageUrl(child.id, 'w=600'), child.filename || 'Variation', e)}
                        >
                          <Image
                            src={getCloudflareImageUrl(child.id, 'w=300')}
                            alt={child.filename || 'Variation'}
                            fill
                            className="object-cover"
                            sizes="64px"
                            unoptimized
                          />
                        </Link>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs font-mono font-medum text-gray-900 truncate">{child.filename}</p>
                          <p className="text-xs text-gray-500">
                            Uploaded {new Date(child.uploaded).toLocaleDateString()}
                          </p>
                          <button
                            onClick={() => setVariantModalState({ target: child, mode: 'single' })}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 underline"
                          >
                            View sizes
                          </button>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <button
                            onClick={async () => await copyToClipboard(getCloudflareImageUrl(child.id, 'original'), 'Variation')}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Copy URL
                          </button>
                          {!isChildImage && (
                            <button
                              onClick={() => handleDetachChild(child.id)}
                              disabled={childDetachingId === child.id}
                              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {childDetachingId === child.id ? 'Detaching…' : 'Detach'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {variationCount > VARIATION_PAGE_SIZE && (
                  <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
                    <div>
                      Page {variationPage} of {totalVariationPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setVariationPage((p) => Math.max(1, p - 1))}
                        disabled={variationPage === 1}
                        className="px-2 py-1 border rounded disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setVariationPage((p) => Math.min(totalVariationPages, p + 1))}
                        disabled={variationPage === totalVariationPages}
                        className="px-2 py-1 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

            {!image.parentId && (
              <>
                <div id="adopt-variation-section" className="space-y-3 border border-dashed rounded-lg p-3 bg-gray-50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label htmlFor="adopt-search" className="text-xs font-medium text-gray-700">
                      Adopt existing image as a variation
                    </label>
                    <input
                      id="adopt-search"
                      type="text"
                      value={adoptSearch}
                      onChange={(e) => setAdoptSearch(e.target.value)}
                      placeholder="Search by name, folder, or tag"
                      className="w-full sm:w-64 border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label htmlFor="adopt-folder" className="text-xs font-medium text-gray-700">Filter by folder</label>
                    <MonoSelect
                      id="adopt-folder"
                      value={adoptFolderFilter}
                      onChange={setAdoptFolderFilter}
                      options={adoptFolderOptions}
                      className="w-full sm:w-48"
                      placeholder="All folders"
                    />
                  </div>
                  {filteredAdoptableImages.length === 0 ? (
                    <p className="text-xs text-gray-500">No canonical images found. Upload a base image first.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pagedAdoptableImages.map((candidate) => (
                        <div
                          key={candidate.id}
                          className="flex items-center gap-3 p-2 border rounded-md bg-white"
                          onMouseLeave={handleThumbLeave}
                        >
                          <Link
                            href={`/images/${candidate.id}`}
                            className="w-14 h-14 relative rounded overflow-hidden bg-gray-100 block"
                            onMouseMove={(e) => handleThumbMouseMove(getCloudflareImageUrl(candidate.id, 'w=600'), candidate.filename || 'Image', e)}
                          >
                            <Image
                              src={getCloudflareImageUrl(candidate.id, 'w=300')}
                              alt={candidate.filename || 'Image'}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </Link>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono font-medum text-gray-900 truncate">{candidate.filename}</p>
                            <p className="text-xs text-gray-500 truncate">{candidate.folder || '[no folder]'}</p>
                          </div>
                <button
                  onClick={() => handleAssignExistingAsChild(candidate.id)}
                  disabled={assigningId === candidate.id}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigningId === candidate.id ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            ))}
          </div>
        )}
                  {filteredAdoptableImages.length > ADOPT_PAGE_SIZE && (
                    <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
                      <div>
                        Page {adoptPage} of {totalAdoptPages}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAdoptPage((p) => Math.max(1, p - 1))}
                          disabled={adoptPage === 1}
                          className="px-2 py-1 border rounded disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setAdoptPage((p) => Math.min(totalAdoptPages, p + 1))}
                          disabled={adoptPage === totalAdoptPages}
                          className="px-2 py-1 border rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div id="upload-variation-section" className="space-y-2 border border-dashed rounded-lg p-3 bg-blue-50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-mono font-medum text-gray-800">Upload a new variation</h3>
                      <p className="text-xs text-gray-600">Files will be linked under this image.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={childUploadInputRef}
                        type="file"
                        multiple
                        onChange={(e) => setChildUploadFiles(Array.from(e.target.files || []))}
                        className="hidden"
                        id="detail-upload-input"
                      />
                      <button
                        type="button"
                        onClick={() => childUploadInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-100"
                      >
                        Choose files
                      </button>
                      {childUploadFiles.length > 0 && (
                        <span className="text-xs text-gray-600">{childUploadFiles.length} selected</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Folder (optional)"
                      value={childUploadFolder}
                      onChange={(e) => setChildUploadFolder(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Tags (comma separated, optional)"
                      value={childUploadTags}
                      onChange={(e) => setChildUploadTags(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {childUploadFiles.length > 0 && (
                    <div className="text-xs text-gray-700 space-y-1">
                      {childUploadFiles.map((file, idx) => (
                        <p key={`${file.name}-${idx}`} className="truncate">
                          • {file.name}
                        </p>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleChildUpload}
                    disabled={childUploadLoading || childUploadFiles.length === 0}
                    className="px-4 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {childUploadLoading ? 'Uploading…' : 'Upload variation(s)'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => {
              setFolderSelect(image.folder || '');
              setNewFolderInput('');
              setTagsInput(image.tags ? image.tags.join(', ') : '');
              setDescriptionInput(image.description || '');
              setOriginalUrlInput(image.originalUrl || '');
            }}
            className="px-4 py-2 text-xs text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              try {
                const finalFolder = folderSelect === '__create__'
                  ? (newFolderInput.trim() || undefined)
                  : (folderSelect === '' ? undefined : folderSelect);
                const payload = {
                  folder: finalFolder,
                  tags: tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [],
                  description: descriptionInput || undefined,
                  originalUrl: originalUrlInput || undefined,
                };
                const res = await fetch(`/api/images/${id}/update`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                const body = await res.json() as CloudflareImage;
                if (res.ok) {
                  toast.push('Metadata updated');
                  setImage(prev => prev ? ({ ...prev, folder: body.folder, tags: body.tags, description: body.description, originalUrl: body.originalUrl }) : prev);
                  await refreshImageList();
                } else {
                  toast.push(body.error || 'Failed to update metadata');
                }
              } catch (err) {
                console.error('Update failed', err);
                toast.push('Failed to update metadata');
              } finally {
                setSaving(false);
              }
            }}
            className="px-4 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
        </div>
      </div>
      {variantModalState && (() => {
        const { target, mode } = variantModalState;
        const blurOverlayStyle: CSSProperties = {
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        };
        const variantEntries = Object.entries(
          getMultipleImageUrls(target.id, ['thumbnail','small','medium','large','xlarge','original'])
        );

        const formatEntriesAsYaml = (entries: { url: string; altText: string }[]) => {
          const lines = ['imagesFromGridDirectory:'];
          entries.forEach((entry) => {
            lines.push('  - url: ' + entry.url);
            lines.push('    altText: ' + JSON.stringify(entry.altText ?? ''));
          });
          return lines.join('\n');
        };

        const handleCopyVariantList = async (variant: string, url: string) => {
          const buildEntry = (img: CloudflareImage, entryUrl: string) => ({
            url: entryUrl,
            altText: img.description || ''
          });

          if (mode === 'list') {
            const entries = [buildEntry(image, getCloudflareImageUrl(image.id, variant)), ...displayedVariations.map((child) => buildEntry(child, getCloudflareImageUrl(child.id, variant)))];
            const payload = formatEntriesAsYaml(entries);
            await copyToClipboard(payload, `${variant} list`);
          } else {
            await copyToClipboard(url, `${variant} variant`);
          }
          setVariantModalState(null);
        };

        return (
          <>
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-md z-[100000]"
              style={blurOverlayStyle}
              onClick={() => setVariantModalState(null)}
            />
            <div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-white rounded-lg shadow-xl z-[100001] text-xs text-gray-800 border">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="text-xs font-mono font-medum">
                  Copy Image URL
                </div>
                <button
                  onClick={() => setVariantModalState(null)}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                >
                  ×
                </button>
              </div>
              <div className="p-3 max-h-80 overflow-auto">
                {variantEntries.map(([variant, url]) => (
                  <div key={variant} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="text-xs font-mono font-semibold text-gray-900 capitalize">{variant}</div>
                      <div className="text-xs text-gray-500 truncate">{String(url)}</div>
                    </div>
                    <button
                      onClick={async () => {
                        await handleCopyVariantList(variant, String(url));
                      }}
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
      {hoverPreview && (
        <div
          className="fixed z-50 pointer-events-none border border-black/10 shadow-lg rounded-lg overflow-hidden bg-white"
          style={{ top: hoverPreview.y, left: hoverPreview.x, width: 340, height: 280 }}
        >
          <Image
            src={hoverPreview.url}
            alt={hoverPreview.label}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      )}
    </div>
  );
}
