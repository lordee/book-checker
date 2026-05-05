import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dir = path.join(process.cwd(), 'saved-searches');
    if (!fs.existsSync(dir)) {
      return NextResponse.json({ archives: [] });
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    const archives = files.map(filename => {
      const content = fs.readFileSync(path.join(dir, filename), 'utf8');
      const dateMatch = content.match(/Date: (.*)/);
      const urlMatch = content.match(/Source URL: (.*)/);
      const titleMatch = content.match(/# (.*)/);
      
      return {
        filename,
        title: titleMatch ? titleMatch[1] : filename,
        date: dateMatch ? dateMatch[1] : '',
        url: urlMatch ? urlMatch[1] : ''
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
    
    return NextResponse.json({ archives });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list archives' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, books } = await req.json();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dateStr = new Date().toLocaleString();
    
    let archiveTitle = "Book Search Result";
    if (url.includes('reddit.com')) {
      const parts = url.split('/');
      archiveTitle = "Reddit: " + (parts[parts.length - 2] || parts[parts.length - 1] || "Post").replace(/_/g, ' ');
    } else if (url.includes('goodreads.com')) {
      archiveTitle = "Goodreads List";
    }

    const filename = `search-results-${timestamp}.md`;
    const dir = path.join(process.cwd(), 'saved-searches');
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    let mdContent = `# ${archiveTitle}\n\n`;
    mdContent += `Date: ${dateStr}\n`;
    mdContent += `Source URL: ${url}\n\n`;
    mdContent += `## Results\n\n`;
    
    books.forEach((book: any) => {
      const statusEmoji = book.status === 'found' ? '✅' : book.status === 'not_found' ? '❌' : '⏳';
      mdContent += `### ${statusEmoji} ${book.title}\n`;
      mdContent += `- Author: ${book.author}\n`;
      mdContent += `- Status: ${book.status}\n`;
      if (book.availability) mdContent += `- Availability: ${book.availability}\n`;
      if (book.libraryUrl) mdContent += `- Library Link: ${book.libraryUrl}\n`;
      if (book.imageUrl) mdContent += `- Image: ${book.imageUrl}\n`;
      mdContent += `\n---\n\n`;
    });

    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, mdContent, 'utf8');
    
    return NextResponse.json({ success: true, filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { filename } = await req.json();
    const filePath = path.join(process.cwd(), 'saved-searches', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete archive' }, { status: 500 });
  }
}
