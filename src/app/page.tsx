'use client';

import { useState, useRef } from 'react';
import ImageUploader from '@/components/ImageUploader';
import ImageGallery from '@/components/ImageGallery';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const galleryRef = useRef<{ refreshImages: () => void }>(null);

  const handleImageUploaded = () => {
    // Trigger gallery refresh
    if (galleryRef.current) {
      galleryRef.current.refreshImages();
    }
    // Also update the trigger as a fallback
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm font-mono text-gray-900 mb-2">
            Cloudflare Image Upload
          </p>
          {/* <p className="text-gray-600 mb-8">
            Upload and manage your images for email blasts and websites
          </p> */}
          
          <div className="grid gap-8">
            <ImageUploader onImageUploaded={handleImageUploaded} />
            <ImageGallery ref={galleryRef} refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </div>
    </main>
  );
}
