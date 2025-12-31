#!/usr/bin/env node
/**
 * Audit script: checks Cloudflare delivery URLs for 404/410 responses.
 *
 * Usage:
 *   node scripts/audit-broken-images.mjs
 *   AUDIT_API_BASE=https://your-host AUDIT_REFRESH=1 AUDIT_VARIANT=public node scripts/audit-broken-images.mjs
 */

const API_BASE = process.env.AUDIT_API_BASE ?? 'http://localhost:3000';
const FORCE_REFRESH = process.env.AUDIT_REFRESH === '1';
const VARIANT = process.env.AUDIT_VARIANT ?? 'public';
const LIMIT = process.env.AUDIT_LIMIT;
const OFFSET = process.env.AUDIT_OFFSET;
const CONCURRENCY = process.env.AUDIT_CONCURRENCY;

const buildAuditUrl = () => {
  const url = new URL('/api/images/audit', API_BASE);
  url.searchParams.set('variant', VARIANT);
  if (FORCE_REFRESH) url.searchParams.set('refresh', '1');
  if (LIMIT) url.searchParams.set('limit', LIMIT);
  if (OFFSET) url.searchParams.set('offset', OFFSET);
  if (CONCURRENCY) url.searchParams.set('concurrency', CONCURRENCY);
  return url;
};

const main = async () => {
  const url = buildAuditUrl();
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Audit failed: ${resp.status} ${text}`);
  }
  const payload = await resp.json();
  const broken = Array.isArray(payload.broken) ? payload.broken : [];
  const errors = Array.isArray(payload.errors) ? payload.errors : [];

  console.log(`Checked ${payload.checked}/${payload.totalImages} images (variant=${payload.variant}).`);
  console.log(`Broken: ${broken.length} | Errors: ${errors.length}`);
  if (payload.checkedAt) {
    console.log(`Checked at: ${payload.checkedAt}`);
  }

  if (broken.length) {
    console.log('\nBroken images:');
    broken.forEach((entry) => {
      const status = entry.status ? `status=${entry.status}` : 'status=unknown';
      const reason = entry.reason ? `reason=${entry.reason}` : 'reason=unknown';
      console.log(`- id=${entry.id} ${status} ${reason} url=${entry.url || '[none]'}`);
    });
  }

  if (errors.length) {
    console.log('\nRequest errors:');
    errors.forEach((entry) => {
      const status = entry.status ? `status=${entry.status}` : 'status=unknown';
      const reason = entry.reason ? `reason=${entry.reason}` : 'reason=unknown';
      console.log(`- id=${entry.id} ${status} ${reason} url=${entry.url || '[none]'}`);
    });
  }

  if (!broken.length && !errors.length) {
    console.log('No broken URLs detected.');
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
