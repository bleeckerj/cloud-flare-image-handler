#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

const API_BASE = process.env.HASH_CACHE_API_BASE ?? 'http://localhost:3000';
const PAGE_SIZE = Number(process.env.HASH_CACHE_PAGE_SIZE ?? '75');
const TARGET_FOLDER = process.env.HASH_CACHE_FOLDER;
const OUTPUT_PATH = path.join(process.cwd(), 'logs', 'image-migrations', 'hash-cache.json');

const normalizeHash = (value) => value.replace(/^sha256:/i, '').toLowerCase();

const fetchUploads = async (page) => {
  const url = new URL('/api/uploads', API_BASE);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(PAGE_SIZE));
  if (TARGET_FOLDER) {
    url.searchParams.set('folder', TARGET_FOLDER);
  }
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to fetch uploads: ${response.status} ${payload}`);
  }
  return response.json();
};

const hashFromStream = async (url) => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download asset for hashing: ${response.status}`);
  }
  const hash = crypto.createHash('sha256');
  const stream = Readable.fromWeb(response.body);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
};

const ensureHash = async (upload) => {
  if (upload.contentHash) {
    return normalizeHash(upload.contentHash);
  }
  const downloadUrl = new URL(`/api/uploads/${upload.uploadId}/download`, API_BASE);
  return hashFromStream(downloadUrl);
};

const main = async () => {
  const entries = new Map();
  let page = 1;
  while (true) {
    console.log(`Fetching uploads page ${page}...`);
    const payload = await fetchUploads(page);
    for (const upload of payload.uploads) {
      const hash = await ensureHash(upload);
      entries.set(hash, {
        uploadId: upload.uploadId,
        cloudflareUrl: upload.cloudflareUrl,
        originalUrl: upload.originalUrl,
        filename: upload.filename
      });
    }
    if (!payload.hasMore || !payload.nextPage) {
      break;
    }
    page = payload.nextPage;
  }

  const output = {};
  for (const [hash, record] of entries.entries()) {
    output[hash] = record;
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${entries.size} entries to ${OUTPUT_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
