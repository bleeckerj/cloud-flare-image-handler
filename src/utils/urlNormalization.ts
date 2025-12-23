import { cleanString } from '@/utils/cloudflareMetadata';

export function normalizeOriginalUrl(value?: string | null): string | undefined {
  const cleaned = cleanString(value);
  if (!cleaned) {
    return undefined;
  }

  try {
    const parsed = new URL(cleaned);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    let port = parsed.port;

    if ((protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443')) {
      port = '';
    }

    const origin = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    const pathname = parsed.pathname || '/';
    const search = parsed.search;

    return `${origin}${pathname}${search}`;
  } catch {
    return undefined;
  }
}
