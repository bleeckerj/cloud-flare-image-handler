'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface UploadedImage {
  id: string;
  url: string;
  filename: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  folder?: string;
  tags?: string[];
  description?: string;
  originalUrl?: string;
}

interface ImageUploaderProps {
  onImageUploaded?: () => void;
}

export default function ImageUploader({ onImageUploaded }: ImageUploaderProps) {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [newFolder, setNewFolder] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [folders, setFolders] = useState<string[]>(['email-campaigns', 'website-images', 'social-media', 'blog-posts']);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  
  // Debug: Log current state
  console.log('ImageUploader - Selected folder:', selectedFolder);
  console.log('ImageUploader - Available folders:', folders);

  // Function to actually upload files
  const uploadFiles = useCallback(async (filesToUpload: File[]) => {
    setIsUploading(true);
    
    // Create initial entries for all files
    const initialImages: UploadedImage[] = filesToUpload.map(file => ({
      id: Math.random().toString(36).substring(7),
      url: '',
      filename: file.name,
      status: 'uploading' as const,
    }));
    
    setUploadedImages(prev => [...prev, ...initialImages]);

    // Upload each file
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const imageId = initialImages[i].id;
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (selectedFolder && selectedFolder.trim()) {
          formData.append('folder', selectedFolder.trim());
        }
        if (tags && tags.trim()) {
          formData.append('tags', tags.trim());
        }
        if (description && description.trim()) {
          formData.append('description', description.trim());
        }
        if (originalUrl && originalUrl.trim()) {
          formData.append('originalUrl', originalUrl.trim());
        }
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (response.ok) {
          setUploadedImages(prev => prev.map(img => 
            img.id === imageId 
              ? { 
                  ...img, 
                  status: 'success', 
                  url: result.url,
                  folder: selectedFolder,
                  tags: tags.trim() ? tags.trim().split(',').map(t => t.trim()) : [],
                  description: description || undefined,
                  originalUrl: originalUrl || undefined
                }
              : img
          ));
          // Call the callback to refresh the gallery after a short delay
          // This ensures Cloudflare has processed the image
          if (onImageUploaded) {
            setTimeout(() => {
              onImageUploaded();
            }, 500);
          }
        } else {
          setUploadedImages(prev => prev.map(img => 
            img.id === imageId 
              ? { ...img, status: 'error', error: result.error || 'Upload failed' }
              : img
          ));
        }
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        setUploadedImages(prev => prev.map(img => 
          img.id === imageId 
            ? { ...img, status: 'error', error: 'Network error' }
            : img
        ));
      }
    }
    
    setIsUploading(false);
    
    // Clear form inputs after successful upload
    setSelectedFolder('');
    setNewFolder('');
    setTags('');
    setDescription('');
    setOriginalUrl('');
  }, [selectedFolder, tags, description, originalUrl, onImageUploaded]);

  // Handle drag and drop - either queue or upload immediately
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setQueuedFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  // Manual upload button handler
  const handleManualUpload = () => {
    if (queuedFiles.length > 0) {
      uploadFiles(queuedFiles);
      setQueuedFiles([]); // Clear the queue
    }
  };

  // Clear queued files
  const clearQueue = () => {
    setQueuedFiles([]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
  });

  const removeImage = (id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  };

  const copyToClipboard = async (url: string) => {
    try {
      // Check if the modern clipboard API is available
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        alert('URL copied to clipboard!');
      } else {
        // Fallback for older browsers or non-secure contexts
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
          alert('URL copied to clipboard!');
        } catch (fallbackErr) {
          console.error('Fallback copy failed: ', fallbackErr);
          // Show the URL in a prompt as last resort
          prompt('Copy this URL manually:', url);
        }
        
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy: ', err);
      // Show the URL in a prompt as fallback
      prompt('Copy this URL manually:', url);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Images</h2>
      
      {/* Organization Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <label htmlFor="folder-select" className="block text-sm font-medium text-gray-700 mb-2">
            Folder (Optional)
          </label>
          <div className="flex space-x-2">
            <select
              id="folder-select"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No folder</option>
              {folders.map(folder => (
                <option key={folder} value={folder}>{folder}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="New folder"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolder.trim()) {
                  const folderName = newFolder.trim().toLowerCase().replace(/\s+/g, '-');
                  if (!folders.includes(folderName)) {
                    setFolders(prev => [...prev, folderName]);
                    setSelectedFolder(folderName);
                  }
                  setNewFolder('');
                }
              }}
              className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Press Enter to create new folder</p>
        </div>
        
        <div>
          <label htmlFor="tags-input" className="block text-sm font-medium text-gray-700 mb-2">
            Tags (Optional)
          </label>
          <input
            id="tags-input"
            type="text"
            placeholder="logo, header, banner (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
        </div>
        
        <div>
          <label htmlFor="description-input" className="block text-sm font-medium text-gray-700 mb-2">
            Description (Optional)
          </label>
          <textarea
            id="description-input"
            placeholder="Brief description of the image..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
          />
          <p className="text-xs text-gray-500 mt-1">Optional description for the image</p>
        </div>
        
        <div>
          <label htmlFor="original-url-input" className="block text-sm font-medium text-gray-700 mb-2">
            Original URL (Optional)
          </label>
          <input
            id="original-url-input"
            type="url"
            placeholder="https://example.com/original-image.jpg"
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Reference to the original source URL</p>
        </div>
      </div>
      
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">
          {isUploading ? 'Uploading...' : isDragActive ? 'Drop images here' : 'Drag & drop images here'}
        </p>
        <p className="text-gray-500">
          {isUploading ? 'Please wait while your images are being uploaded' : 'or click to select files'}
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Supports: JPEG, PNG, GIF, WebP • Files will be queued for upload
        </p>
      </div>

      {/* Queued Files Section */}
      {queuedFiles.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Queued Files ({queuedFiles.length})
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={clearQueue}
                className="px-3 py-1 text-sm text-gray-600 hover:text-red-600 border border-gray-300 rounded-md hover:border-red-300"
                disabled={isUploading}
              >
                Clear Queue
              </button>
              <button
                onClick={handleManualUpload}
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Upload {queuedFiles.length} File{queuedFiles.length !== 1 ? 's' : ''}</span>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {queuedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={() => setQueuedFiles(prev => prev.filter((_, i) => i !== index))}
                  className="mt-1 text-xs text-red-600 hover:text-red-800"
                  disabled={isUploading}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadedImages.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Uploaded Images ({uploadedImages.length})
          </h3>
          <div className="space-y-3">
            {uploadedImages.map((image) => (
              <div
                key={image.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {image.status === 'uploading' && (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    )}
                    {image.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {image.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {image.filename}
                    </p>
                    {image.folder && (
                      <p className="text-xs text-gray-500">
                        📁 {image.folder}
                      </p>
                    )}
                    {image.description && (
                      <p className="text-xs text-gray-500">📝 {image.description}</p>
                    )}
                    {image.originalUrl && (
                      <p className="text-xs text-gray-500">🔗 <a href={image.originalUrl} target="_blank" rel="noreferrer" className="underline">Original</a></p>
                    )}
                    {image.tags && image.tags.length > 0 && (
                      <p className="text-xs text-gray-500">
                        🏷️ {image.tags.join(', ')}
                      </p>
                    )}
                    {image.status === 'success' && image.url && (
                      <button
                        onClick={() => copyToClipboard(image.url)}
                        className="text-xs text-blue-600 hover:text-blue-800 truncate block max-w-xs"
                      >
                        {image.url}
                      </button>
                    )}
                    {image.status === 'error' && (
                      <p className="text-xs text-red-600">
                        {image.error}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeImage(image.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}