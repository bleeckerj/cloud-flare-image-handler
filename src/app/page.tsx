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
    <main className="min-h-screen bg-gray-50 overscroll-none">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <section className="z-999" id="gallery-section">
            <ImageGallery ref={galleryRef} refreshTrigger={refreshTrigger} />
          </section>
          <section id="uploader-section" className="max-w-4xl">
            <p className="text-sm font-mono text-gray-900 mb-2">
              Cloudflare Image Upload
            </p>
            <ImageUploader onImageUploaded={handleImageUploaded} />
          </section>
        </div>
      </div>
    </main>
  );
}
