import { NextRequest, NextResponse } from 'next/server';
import { fetchCloudflareImages, updateImageFolder } from '@/utils/cloudflareClient';
import { removeFolder, renameFolder } from '@/utils/folderStore';
import { cleanString } from '@/utils/cloudflareMetadata';

async function updateAllImages(oldName: string, newName?: string) {
  const images = await fetchCloudflareImages();
  const targets = images.filter((img) => img.folder === oldName);
  for (const image of targets) {
    await updateImageFolder(image.id, newName);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();
    const newName = cleanString(typeof body?.newName === 'string' ? body.newName : undefined);
    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }
    if (!newName) {
      return NextResponse.json({ error: 'New folder name is required' }, { status: 400 });
    }
    await renameFolder(name, newName);
    await updateAllImages(name, newName);
    return NextResponse.json({ success: true, name: newName });
  } catch (error) {
    console.error('Rename folder error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to rename folder' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }
    await removeFolder(name);
    await updateAllImages(name, undefined);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete folder error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete folder' }, { status: 500 });
  }
}
