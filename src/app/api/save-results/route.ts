import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { url, books } = await req.json();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `search-results-${timestamp}.json`;
    const dir = path.join(process.cwd(), 'saved-searches');
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filePath = path.join(dir, filename);
    const data = {
      savedAt: new Date().toISOString(),
      originalUrl: url,
      books: books
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    return NextResponse.json({ success: true, filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
