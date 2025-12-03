import { describe, expect, it } from 'vitest';
import { cleanString, parseCloudflareMetadata } from '@/utils/cloudflareMetadata';

describe('parseCloudflareMetadata', () => {
  it('returns an empty object for empty input', () => {
    expect(parseCloudflareMetadata(undefined)).toEqual({});
    expect(parseCloudflareMetadata(null)).toEqual({});
  });

  it('parses already parsed metadata objects', () => {
    const meta = { folder: 'emails', tags: ['hero'] };
    expect(parseCloudflareMetadata(meta)).toEqual(meta);
  });

  it('parses JSON strings', () => {
    const jsonString = JSON.stringify({ folder: 'campaign', tags: ['splash'] });
    expect(parseCloudflareMetadata(jsonString)).toEqual({ folder: 'campaign', tags: ['splash'] });
  });

  it('ignores invalid JSON', () => {
    const result = parseCloudflareMetadata('not-valid-json');
    expect(result).toEqual({});
  });
});

describe('cleanString', () => {
  it('trims whitespace and returns undefined for falsy values', () => {
    expect(cleanString('  hello  ')).toBe('hello');
    expect(cleanString('')).toBeUndefined();
    expect(cleanString('undefined')).toBeUndefined();
    expect(cleanString('   undefined   ')).toBeUndefined();
  });
});
