import { NextRequest, NextResponse } from 'next/server';
import { listUploads } from '@/server/cloudflareUploadsService';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const withCors = (response: NextResponse) => {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
};

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? '1');
    const pageSize = Number(searchParams.get('pageSize') ?? '50');
    const folder = searchParams.get('folder');

    const data = await listUploads({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
      folder
    });

    return withCors(NextResponse.json(data));
  } catch (error) {
    console.error('Failed to list uploads:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return withCors(
      NextResponse.json(
        { error: message },
        { status: message === 'Cloudflare credentials not configured' ? 500 : 502 }
      )
    );
  }
}
