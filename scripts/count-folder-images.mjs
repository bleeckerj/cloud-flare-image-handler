#!/usr/bin/env node

import process from 'node:process';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !apiToken) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN environment variables.');
  process.exit(1);
}

const targetFolder = process.argv[2];

if (!targetFolder) {
  console.error('Usage: node scripts/count-folder-images.mjs <folder-name>');
  process.exit(1);
}

const perPageEnv = Number(process.env.CLOUDFLARE_PAGE_SIZE);
const perPage = Number.isFinite(perPageEnv) && perPageEnv > 0 && perPageEnv <= 100 ? perPageEnv : 100;
const maxPagesEnv = Number(process.env.CLOUDFLARE_MAX_PAGES);
const maxPages = Number.isFinite(maxPagesEnv) && maxPagesEnv > 0 ? maxPagesEnv : undefined;

const normalizeFolder = (value) => (typeof value === 'string' ? value.trim() : undefined);

const fetchPage = async (page) => {
  const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`
    }
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.errors?.[0]?.message || 'Cloudflare API error');
  }

  return json;
};

const main = async () => {
  let page = 0;
  let totalMatches = 0;

  while (true) {
    if (maxPages && page >= maxPages) {
      console.warn(`Reached max page limit (${maxPages}). Results may be incomplete.`);
      break;
    }

    page += 1;
    const payload = await fetchPage(page);
    const images = Array.isArray(payload?.result?.images) ? payload.result.images : [];

    const matches = images.filter((image) => normalizeFolder(image?.meta?.folder) === targetFolder);
    totalMatches += matches.length;

    console.log(
      `Page ${page}: ${matches.length} of ${images.length} images matched (running total ${totalMatches})`
    );

    if (images.length < perPage || images.length === 0) {
      break;
    }
  }

  console.log(`Total images in folder "${targetFolder}": ${totalMatches}`);
};

main().catch((error) => {
  console.error('Failed to count folder images:', error);
  process.exit(1);
});
