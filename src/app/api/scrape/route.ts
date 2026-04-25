import { NextRequest, NextResponse } from 'next/server';
import { scrapeGoodreadsList } from '@/lib/scrapers';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const books = await scrapeGoodreadsList(url);
    return NextResponse.json({ books });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
