export const formatDownloadFileName = (
  originalFilename?: string,
  extension: string = 'webp',
  date: Date = new Date()
): string => {
  const baseName = (originalFilename || 'image').replace(/\.[^.]+$/, '') || 'image';
  const pad = (value: number) => value.toString().padStart(2, '0');
  const timestamp = [
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    date.getFullYear(),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
  const safeExtension = extension.startsWith('.') ? extension.slice(1) : extension;
  return `${baseName}_${timestamp}.${safeExtension}`;
};

export const downloadImageToFile = async (url: string, filename: string): Promise<void> => {
  if (!url) {
    throw new Error('No URL provided for download');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image for download (${response.status})`);
  }
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl);
  }, 500);
};
