import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

type CloudflareMetadata = Record<string, unknown>;

function parseMetadata(rawMeta: unknown): CloudflareMetadata {
  if (!rawMeta) return {};
  try {
    if (typeof rawMeta === 'string') {
      return JSON.parse(rawMeta);
    }
    return rawMeta as CloudflareMetadata;
  } catch (error) {
    console.warn('Failed to parse Cloudflare metadata as JSON:', error);
    return {};
  }
}

function sanitizeString(value?: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined') return undefined;
  return trimmed;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const openAiKey = process.env.OPENAI_API_KEY;

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Cloudflare credentials not configured' },
        { status: 500 }
      );
    }

    if (!openAiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const { id: imageId } = await params;
    if (!imageId) {
      return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
    }

    const imageResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    const imageResult = await imageResponse.json();
    if (!imageResponse.ok) {
      console.error('Cloudflare API error (fetch image):', imageResult);
      return NextResponse.json(
        { error: imageResult.errors?.[0]?.message || 'Failed to fetch image from Cloudflare' },
        { status: imageResponse.status }
      );
    }

    const image = imageResult.result;
    const imageUrl: string | undefined = image.variants?.find((variant: string) => variant.includes('public')) || image.variants?.[0];

    if (!imageUrl) {
      return NextResponse.json({ error: 'No accessible image variant found' }, { status: 422 });
    }

    const prompt = 'You are an accessibility assistant. Provide a concise, objective alt text (max 120 characters) that describes the main subject and context of the image.';

    const openAiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 150,
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image for use as an HTML alt attribute.' },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      })
    });

    const openAiPayload = await openAiResponse.json();
    if (!openAiResponse.ok) {
      console.error('OpenAI API error:', openAiPayload);
      return NextResponse.json(
        { error: openAiPayload.error?.message || 'Failed to generate ALT text' },
        { status: openAiResponse.status }
      );
    }

    const messageContent = openAiPayload?.choices?.[0]?.message?.content;
    let altTextRaw: string | undefined;

    if (typeof messageContent === 'string') {
      altTextRaw = messageContent;
    } else if (Array.isArray(messageContent)) {
      altTextRaw = messageContent
        .map((chunk: { text?: string }) => chunk?.text || '')
        .join(' ')
        .trim();
    }

    const altText = sanitizeString(altTextRaw);

    if (!altText) {
      return NextResponse.json(
        { error: 'OpenAI response did not contain ALT text' },
        { status: 422 }
      );
    }

    const existingMeta = parseMetadata(image.meta);
    const updatedMeta = {
      ...existingMeta,
      altTag: altText,
      updatedAt: new Date().toISOString()
    };

    const updateResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metadata: updatedMeta })
      }
    );

    const updatePayload = await updateResponse.json();
    if (!updateResponse.ok) {
      console.error('Cloudflare API error (update alt):', updatePayload);
      return NextResponse.json(
        { error: updatePayload.errors?.[0]?.message || 'Failed to save ALT text' },
        { status: updateResponse.status }
      );
    }

    return NextResponse.json({ altTag: altText });
  } catch (error) {
    console.error('ALT tag generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
