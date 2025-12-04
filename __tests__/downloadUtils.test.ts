import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadImageToFile, formatDownloadFileName } from '@/utils/downloadUtils';

describe('formatDownloadFileName', () => {
  it('builds a file name with timestamp and extension', () => {
    const mockDate = new Date(2025, 2, 12, 10, 30, 5); // March 12, 2025 10:30:05 local time
    const result = formatDownloadFileName('example.png', 'webp', mockDate);
    expect(result).toBe('example_03122025103005.webp');
  });

  it('falls back to defaults when filename missing', () => {
    const mockDate = new Date(2024, 0, 1, 0, 0, 0);
    const result = formatDownloadFileName(undefined, undefined, mockDate);
    expect(result).toBe('image_01012024000000.webp');
  });
});

describe('downloadImageToFile', () => {
  const originalFetch = global.fetch;
  let windowBackup: typeof window | undefined;
  let documentBackup: typeof document | undefined;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let createElementSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['mock-image'], { type: 'image/png' })
    }));

    appendChildSpy = vi.fn();
    removeChildSpy = vi.fn();
    clickSpy = vi.fn();
    const mockLink = { click: clickSpy, style: {} } as unknown as HTMLAnchorElement;
    createElementSpy = vi.fn(() => mockLink);

    documentBackup = (globalThis as any).document;
    (globalThis as any).document = {
      createElement: createElementSpy,
      body: {
        appendChild: appendChildSpy,
        removeChild: removeChildSpy
      }
    };

    windowBackup = (globalThis as any).window;
    (globalThis as any).window = {
      URL: {
        createObjectURL: vi.fn(() => 'blob:mock'),
        revokeObjectURL: vi.fn()
      },
      setTimeout: global.setTimeout.bind(global)
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    (globalThis as any).fetch = originalFetch;
    if (documentBackup) {
      (globalThis as any).document = documentBackup;
    } else {
      delete (globalThis as any).document;
    }
    if (windowBackup) {
      (globalThis as any).window = windowBackup;
    } else {
      delete (globalThis as any).window;
    }
  });

  it('fetches, creates blob URL, triggers click, and cleans up', async () => {
    await downloadImageToFile('https://example.com/image', 'download.webp');

    expect(global.fetch).toHaveBeenCalledWith('https://example.com/image');
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('throws when fetch fails', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ ok: false, status: 500 }));
    await expect(downloadImageToFile('https://example.com/bad', 'error.webp')).rejects.toThrow(
      /Failed to fetch image/
    );
  });
});
