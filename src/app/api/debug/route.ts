import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check for required environment variables
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    
    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Cloudflare credentials not configured' },
        { status: 500 }
      );
    }

    // Fetch images from Cloudflare
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Cloudflare API error:', result);
      return NextResponse.json(
        { error: result.errors?.[0]?.message || 'Failed to fetch images from Cloudflare' },
        { status: response.status }
      );
    }

    // Return the raw data for debugging
    return NextResponse.json({ 
      raw: result,
      count: result.result?.images?.length || 0 
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}