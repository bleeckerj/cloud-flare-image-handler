import { NextRequest, NextResponse } from 'next/server';
import { fetchCloudflareImages } from '@/utils/cloudflareClient';
import { addFolder, listStoredFolders } from '@/utils/folderStore';

export async function GET() {
  try {
    const [cloudflareImages, storedFolders] = await Promise.all([
      fetchCloudflareImages().catch((err) => {
        console.error('Failed to fetch Cloudflare images for folder list', err);
        return [];
      }),
      listStoredFolders()
    ]);

    const derivedFolders = Array.from(
      new Set(
        cloudflareImages
          .map((image) => image.folder)
          .filter((folder): folder is string => Boolean(folder))
      )
    );

    const allFolders = Array.from(new Set([...storedFolders, ...derivedFolders])).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ folders: allFolders });
  } catch (error) {
    console.error('List folders error', error);
    return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }
    await addFolder(name);
    return NextResponse.json({ success: true, name });
  } catch (error) {
    console.error('Create folder error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create folder' }, { status: 500 });
  }
}
