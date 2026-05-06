import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LISTS_DIR = path.join(process.cwd(), 'custom-lists');

if (!fs.existsSync(LISTS_DIR)) {
  fs.mkdirSync(LISTS_DIR, { recursive: true });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const filePath = path.join(LISTS_DIR, `${id}.json`);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
      }
      const content = fs.readFileSync(filePath, 'utf8');
      return NextResponse.json(JSON.parse(content));
    }

    const files = fs.readdirSync(LISTS_DIR).filter(f => f.endsWith('.json'));
    const lists = files.map(filename => {
      const content = fs.readFileSync(path.join(LISTS_DIR, filename), 'utf8');
      const data = JSON.parse(content);
      return {
        id: data.id,
        name: data.name,
        bookCount: data.books.length,
        createdAt: data.createdAt
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ lists });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    const id = Date.now().toString();
    const newList = {
      id,
      name,
      books: [],
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(path.join(LISTS_DIR, `${id}.json`), JSON.stringify(newList, null, 2));
    return NextResponse.json(newList);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, action, book, bookIndex } = await req.json();
    const filePath = path.join(LISTS_DIR, `${id}.json`);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const list = JSON.parse(content);
    
    if (action === 'add') {
      // Check if book already exists in list
      const exists = list.books.some((b: { title: string; author: string }) => b.title === book.title && b.author === book.author);
      if (!exists) {
        list.books.push(book);
      }
    } else if (action === 'remove') {
      if (typeof bookIndex === 'number') {
        list.books.splice(bookIndex, 1);
      } else {
        list.books = list.books.filter((b: { title: string; author: string }) => !(b.title === book.title && b.author === book.author));
      }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
    return NextResponse.json(list);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const filePath = path.join(LISTS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 });
  }
}
