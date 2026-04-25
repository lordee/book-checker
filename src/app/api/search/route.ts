import { NextRequest, NextResponse } from 'next/server';
import { searchLibrary } from '@/lib/scrapers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title');
  const author = searchParams.get('author');

  if (!title || !author) {
    return NextResponse.json({ error: 'Title and Author are required' }, { status: 400 });
  }

  try {
    const status = await searchLibrary(title, author);
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
