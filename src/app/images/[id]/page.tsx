"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { getMultipleImageUrls, getCloudflareImageUrl } from '@/utils/imageUtils';
import { useToast } from '@/components/Toast';

interface Params {
  params: { id: string };
}

interface CloudflareImage {
  id: string;
  filename: string;
  uploaded: string;
  variants?: string[];
  folder?: string;
  tags?: string[];
  description?: string;
  originalUrl?: string;
}

export default function ImageDetailPage({ params: { id } }: Params) {
  const [image, setImage] = useState<CloudflareImage | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [folderInput, setFolderInput] = useState('');
  const [folderSelect, setFolderSelect] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [originalUrlInput, setOriginalUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uniqueFolders, setUniqueFolders] = useState<string[]>([]);
  const [newFolderInput, setNewFolderInput] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/images');
        const data = await res.json();
        const found = (data.images || []).find((i: any) => i.id === id);
        if (mounted) {
          setImage(found || null);
          // collect unique folders for select
          const folders = Array.from(new Set((data.images || []).filter((i: any) => i.folder && i.folder.trim()).map((i: any) => String(i.folder))));
          setUniqueFolders(folders as string[]);
          if (found) {
            setFolderInput(found.folder || '');
            setFolderSelect(found.folder || '');
            setTagsInput(Array.isArray(found.tags) ? found.tags.join(', ') : '');
            setDescriptionInput(found.description || '');
            setOriginalUrlInput(found.originalUrl || '');
          }
        }
      } catch (err) {
        console.error('Failed to fetch image from API', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!image) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Image not found</h1>
        <p className="text-sm text-gray-500">Could not fetch image metadata from server.</p>
      </div>
    );
  }

  const variants = getMultipleImageUrls(id, ['thumbnail','small','medium','large','xlarge','original']);
  const originalDeliveryUrl = getCloudflareImageUrl(id, 'original');

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
        // last resort
        prompt('Copy this URL manually:', text);
      }
      document.body.removeChild(textArea);
    } catch (err) {
      console.error('Failed to copy', err);
      prompt('Copy this URL manually:', text);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <a href="/" className="text-sm text-blue-600 underline">← Back to gallery</a>
      </div>
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-semibold mb-2">{image.filename || 'Image'}</h1>
          <p className="text-sm text-gray-500 mb-4">Uploaded: {new Date(image.uploaded).toLocaleString()}</p>

          <div className="w-full mb-6">
            <div className="relative w-full aspect-[3/2] bg-gray-100 rounded">
              <Image src={originalDeliveryUrl} alt={image.filename || 'image'} fill className="object-contain" unoptimized />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-gray-700">Description</h2>
              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mt-2"
                rows={3}
                placeholder="Add a short description"
              />
            </div>

            <div>
              <h2 className="text-sm font-medium text-gray-700">Folder</h2>
              <div className="mt-2">
                <select
                  value={folderSelect}
                  onChange={(e) => setFolderSelect(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">[none]</option>
                  {uniqueFolders.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="__create__">Create new folder…</option>
                </select>
                {folderSelect === '__create__' && (
                  <input
                    value={newFolderInput}
                    onChange={(e) => setNewFolderInput(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mt-2"
                    placeholder="Type new folder name"
                  />
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium text-gray-700">Tags</h2>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mt-2"
                placeholder="Comma-separated tags"
              />
            </div>

            <div>
              <h2 className="text-sm font-medium text-gray-700">Original URL</h2>
              <div className="flex items-center gap-3 mt-2">
                <input
                  value={originalUrlInput}
                  onChange={(e) => setOriginalUrlInput(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
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

            <div>
              <h2 className="text-sm font-medium text-gray-700">Available variants</h2>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(variants).map(([variant, url]) => (
                  <div key={variant} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="text-xs font-mono font-semibold text-gray-900 capitalize">{variant}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs break-all">{url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600">Open</a>
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

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                    // reset inputs to original values
                    setFolderSelect(image.folder || '');
                    setNewFolderInput('');
                    setTagsInput(image.tags ? image.tags.join(', ') : '');
                    setDescriptionInput(image.description || '');
                    setOriginalUrlInput(image.originalUrl || '');
                  }}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
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
                    const body = await res.json();
                    if (res.ok) {
                      toast.push('Metadata updated');
                      // update local image state
                      setImage(prev => prev ? ({ ...prev, folder: body.folder, tags: body.tags, description: body.description, originalUrl: body.originalUrl }) : prev);
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
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
