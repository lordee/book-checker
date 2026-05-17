import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { scrapeGoodreadsList, scrapeRedditThread, searchLibrary } from './lib/scrapers';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5173;

// Paths
// In Home Assistant, /data is the persistent storage. 
// Locally, we fallback to a 'data' directory in the project root.
const isDocker = fs.existsSync('/.dockerenv') || fs.existsSync('/proc/1/cgroup') && fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
const DEFAULT_ROOT = isDocker ? '/data' : path.join(process.cwd(), '..', 'data');
const PROJECT_ROOT = process.env.PROJECT_ROOT || DEFAULT_ROOT;

const LISTS_DIR = path.join(PROJECT_ROOT, 'custom-lists');
const SAVED_SEARCHES_DIR = path.join(PROJECT_ROOT, 'saved-searches');
const CONFIG_FILE = path.join(PROJECT_ROOT, 'library-config.md');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

// Middleware
app.use(cors());
app.use(express.json());

// Serve book covers from PUBLIC_DIR
app.use('/book-covers', express.static(path.join(PUBLIC_DIR, 'book-covers')));

// Serve frontend static files in production
// Check multiple possible locations for frontend-dist
const FRONTEND_DIST_LOCATIONS = [
  path.join(process.cwd(), 'frontend-dist'),       // Docker structure
  path.join(process.cwd(), '..', 'frontend', 'dist') // Local dev structure
];

let frontendDistPath = '';
for (const loc of FRONTEND_DIST_LOCATIONS) {
  if (fs.existsSync(loc)) {
    frontendDistPath = loc;
    break;
  }
}

if (frontendDistPath) {
  console.log(`Serving frontend from ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
} else {
  console.warn('Frontend distribution directory not found. API only mode.');
}

// Ensure directories exist
[LISTS_DIR, SAVED_SEARCHES_DIR, path.join(PUBLIC_DIR, 'book-covers')].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    } catch (err) {
      console.error(`Failed to create directory ${dir}:`, err);
    }
  }
});

// Routes

// Scrape books from URL
app.post('/api/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let books;
    if (url.includes('reddit.com')) {
      books = await scrapeRedditThread(url);
    } else {
      books = await scrapeGoodreadsList(url);
    }
    res.json({ books });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search library for a book
app.get('/api/search', async (req, res) => {
  const { title, author } = req.query;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const status = await searchLibrary(title as string, author as string || '');
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Config management
app.get('/api/config', (req, res) => {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return res.json({ code: '', pin: '', geminiApiKey: '' });
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    const codeMatch = content.match(/Membership Code: (.*)/);
    const pinMatch = content.match(/PIN: (.*)/);
    const geminiMatch = content.match(/Gemini API Key: (.*)/);
    
    res.json({
      code: codeMatch ? codeMatch[1].trim() : '',
      pin: pinMatch ? pinMatch[1].trim() : '',
      geminiApiKey: geminiMatch ? geminiMatch[1].trim() : ''
    });
  } catch {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const { code, pin, geminiApiKey } = req.body;
    const content = `# Library Credentials\n\nMembership Code: ${code}\nPIN: ${pin}\nGemini API Key: ${geminiApiKey || ''}\n`;
    fs.writeFileSync(CONFIG_FILE, content, 'utf8');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// Lists management
app.get('/api/lists', (req, res) => {
  try {
    const { id } = req.query;

    if (id) {
      const filePath = path.join(LISTS_DIR, `${id}.json`);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'List not found' });
      const content = fs.readFileSync(filePath, 'utf8');
      return res.json(JSON.parse(content));
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

    res.json({ lists });
  } catch {
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

app.post('/api/lists', (req, res) => {
  try {
    const { name } = req.body;
    const id = Date.now().toString();
    const newList = {
      id,
      name,
      books: [],
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(path.join(LISTS_DIR, `${id}.json`), JSON.stringify(newList, null, 2));
    res.json(newList);
  } catch {
    res.status(500).json({ error: 'Failed to create list' });
  }
});

app.put('/api/lists', (req, res) => {
  try {
    const { id, action, book, bookIndex } = req.body;
    const filePath = path.join(LISTS_DIR, `${id}.json`);
    
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'List not found' });
    
    const content = fs.readFileSync(filePath, 'utf8');
    const list = JSON.parse(content);
    
    if (action === 'add') {
      const exists = list.books.some((b: any) => b.title === book.title && b.author === book.author);
      if (!exists) list.books.push(book);
    } else if (action === 'remove') {
      if (typeof bookIndex === 'number') {
        list.books.splice(bookIndex, 1);
      } else {
        list.books = list.books.filter((b: any) => !(b.title === book.title && b.author === book.author));
      }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
    res.json(list);
  } catch {
    res.status(500).json({ error: 'Failed to update list' });
  }
});

app.delete('/api/lists', (req, res) => {
  try {
    const { id } = req.body;
    const filePath = path.join(LISTS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

// Saved results management
app.get('/api/save-results', (req, res) => {
  try {
    const { filename } = req.query;

    if (filename) {
      const filePath = path.join(SAVED_SEARCHES_DIR, filename as string);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archive not found' });
      const content = fs.readFileSync(filePath, 'utf8');
      
      const titleMatch = content.match(/# (.*)/);
      const dateMatch = content.match(/Date: (.*)/);
      const urlMatch = content.match(/Source URL: (.*)/);
      
      const bookSections = content.split('---');
      const books = bookSections.slice(0, -1).map(section => {
        const titleMatch = section.match(/### (?:✅|❌|⏳) (.*)/);
        const authorMatch = section.match(/- Author: (.*)/);
        const statusMatch = section.match(/- Status: (.*)/);
        const availabilityMatch = section.match(/- Availability: (.*)/);
        const libraryUrlMatch = section.match(/- Library Link: (.*)/);
        const imageUrlMatch = section.match(/- Image: (.*)/);
        
        return {
          title: titleMatch ? titleMatch[1].trim() : '',
          author: authorMatch ? authorMatch[1].trim() : '',
          status: statusMatch ? statusMatch[1].trim() : '',
          availability: availabilityMatch ? availabilityMatch[1].trim() : '',
          libraryUrl: libraryUrlMatch ? libraryUrlMatch[1].trim() : '',
          imageUrl: imageUrlMatch ? imageUrlMatch[1].trim() : ''
        };
      }).filter(b => b.title);

      return res.json({
        title: titleMatch ? titleMatch[1] : filename,
        date: dateMatch ? dateMatch[1] : '',
        url: urlMatch ? urlMatch[1] : '',
        books
      });
    }

    if (!fs.existsSync(SAVED_SEARCHES_DIR)) return res.json({ archives: [] });
    
    const files = fs.readdirSync(SAVED_SEARCHES_DIR).filter(f => f.endsWith('.md'));
    const archives = files.map(filename => {
      const content = fs.readFileSync(path.join(SAVED_SEARCHES_DIR, filename), 'utf8');
      const dateMatch = content.match(/Date: (.*)/);
      const urlMatch = content.match(/Source URL: (.*)/);
      const titleMatch = content.match(/# (.*)/);
      
      return {
        filename,
        title: titleMatch ? titleMatch[1] : filename,
        date: dateMatch ? dateMatch[1] : '',
        url: urlMatch ? urlMatch[1] : ''
      };
    }).sort((a: any, b: any) => b.date.localeCompare(a.date));
    
    res.json({ archives });
  } catch {
    res.status(500).json({ error: 'Failed to list archives' });
  }
});

app.post('/api/save-results', (req, res) => {
  try {
    const { url, books } = req.body;
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

    fs.writeFileSync(path.join(SAVED_SEARCHES_DIR, filename), mdContent, 'utf8');
    res.json({ success: true, filename });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/save-results', (req, res) => {
  try {
    const { filename } = req.body;
    const filePath = path.join(SAVED_SEARCHES_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete archive' });
  }
});

// Catch-all for SPA moved to end
if (frontendDistPath) {
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/book-covers')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is listening on 0.0.0.0:${PORT}`);
});
