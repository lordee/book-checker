import { NextRequest, NextResponse } from 'next/server';
import { scrapeGoodreadsList, scrapeRedditThread } from '@/lib/scrapers';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let books;
    if (url.includes('reddit.com')) {
      books = await scrapeRedditThread(url);
    } else {
      books = await scrapeGoodreadsList(url);
    }
    
    return NextResponse.json({ books });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
