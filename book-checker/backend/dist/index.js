"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const scrapers_1 = require("./lib/scrapers");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Paths
const PROJECT_ROOT = path_1.default.join(process.cwd(), '..');
const LISTS_DIR = path_1.default.join(PROJECT_ROOT, 'custom-lists');
const SAVED_SEARCHES_DIR = path_1.default.join(PROJECT_ROOT, 'saved-searches');
const CONFIG_FILE = path_1.default.join(PROJECT_ROOT, 'library-config.md');
const PUBLIC_DIR = path_1.default.join(PROJECT_ROOT, 'public');
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/book-covers', express_1.default.static(path_1.default.join(PUBLIC_DIR, 'book-covers')));
// Ensure directories exist
[LISTS_DIR, SAVED_SEARCHES_DIR, path_1.default.join(PUBLIC_DIR, 'book-covers')].forEach(dir => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
});
// Routes
// Scrape books from URL
app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url)
            return res.status(400).json({ error: 'URL is required' });
        let books;
        if (url.includes('reddit.com')) {
            books = await (0, scrapers_1.scrapeRedditThread)(url);
        }
        else {
            books = await (0, scrapers_1.scrapeGoodreadsList)(url);
        }
        res.json({ books });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Search library for a book
app.get('/api/search', async (req, res) => {
    const { title, author } = req.query;
    if (!title)
        return res.status(400).json({ error: 'Title is required' });
    try {
        const status = await (0, scrapers_1.searchLibrary)(title, author || '');
        res.json(status);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Config management
app.get('/api/config', (req, res) => {
    try {
        if (!fs_1.default.existsSync(CONFIG_FILE)) {
            return res.json({ code: '', pin: '', geminiApiKey: '' });
        }
        const content = fs_1.default.readFileSync(CONFIG_FILE, 'utf8');
        const codeMatch = content.match(/Membership Code: (.*)/);
        const pinMatch = content.match(/PIN: (.*)/);
        const geminiMatch = content.match(/Gemini API Key: (.*)/);
        res.json({
            code: codeMatch ? codeMatch[1].trim() : '',
            pin: pinMatch ? pinMatch[1].trim() : '',
            geminiApiKey: geminiMatch ? geminiMatch[1].trim() : ''
        });
    }
    catch {
        res.status(500).json({ error: 'Failed to read config' });
    }
});
app.post('/api/config', (req, res) => {
    try {
        const { code, pin, geminiApiKey } = req.body;
        const content = `# Library Credentials\n\nMembership Code: ${code}\nPIN: ${pin}\nGemini API Key: ${geminiApiKey || ''}\n`;
        fs_1.default.writeFileSync(CONFIG_FILE, content, 'utf8');
        res.json({ success: true });
    }
    catch {
        res.status(500).json({ error: 'Failed to save config' });
    }
});
// Lists management
app.get('/api/lists', (req, res) => {
    try {
        const { id } = req.query;
        if (id) {
            const filePath = path_1.default.join(LISTS_DIR, `${id}.json`);
            if (!fs_1.default.existsSync(filePath))
                return res.status(404).json({ error: 'List not found' });
            const content = fs_1.default.readFileSync(filePath, 'utf8');
            return res.json(JSON.parse(content));
        }
        const files = fs_1.default.readdirSync(LISTS_DIR).filter(f => f.endsWith('.json'));
        const lists = files.map(filename => {
            const content = fs_1.default.readFileSync(path_1.default.join(LISTS_DIR, filename), 'utf8');
            const data = JSON.parse(content);
            return {
                id: data.id,
                name: data.name,
                bookCount: data.books.length,
                createdAt: data.createdAt
            };
        }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        res.json({ lists });
    }
    catch {
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
        fs_1.default.writeFileSync(path_1.default.join(LISTS_DIR, `${id}.json`), JSON.stringify(newList, null, 2));
        res.json(newList);
    }
    catch {
        res.status(500).json({ error: 'Failed to create list' });
    }
});
app.put('/api/lists', (req, res) => {
    try {
        const { id, action, book, bookIndex } = req.body;
        const filePath = path_1.default.join(LISTS_DIR, `${id}.json`);
        if (!fs_1.default.existsSync(filePath))
            return res.status(404).json({ error: 'List not found' });
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        const list = JSON.parse(content);
        if (action === 'add') {
            const exists = list.books.some((b) => b.title === book.title && b.author === book.author);
            if (!exists)
                list.books.push(book);
        }
        else if (action === 'remove') {
            if (typeof bookIndex === 'number') {
                list.books.splice(bookIndex, 1);
            }
            else {
                list.books = list.books.filter((b) => !(b.title === book.title && b.author === book.author));
            }
        }
        fs_1.default.writeFileSync(filePath, JSON.stringify(list, null, 2));
        res.json(list);
    }
    catch {
        res.status(500).json({ error: 'Failed to update list' });
    }
});
app.delete('/api/lists', (req, res) => {
    try {
        const { id } = req.body;
        const filePath = path_1.default.join(LISTS_DIR, `${id}.json`);
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
        res.json({ success: true });
    }
    catch {
        res.status(500).json({ error: 'Failed to delete list' });
    }
});
// Saved results management
app.get('/api/save-results', (req, res) => {
    try {
        const { filename } = req.query;
        if (filename) {
            const filePath = path_1.default.join(SAVED_SEARCHES_DIR, filename);
            if (!fs_1.default.existsSync(filePath))
                return res.status(404).json({ error: 'Archive not found' });
            const content = fs_1.default.readFileSync(filePath, 'utf8');
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
        if (!fs_1.default.existsSync(SAVED_SEARCHES_DIR))
            return res.json({ archives: [] });
        const files = fs_1.default.readdirSync(SAVED_SEARCHES_DIR).filter(f => f.endsWith('.md'));
        const archives = files.map(filename => {
            const content = fs_1.default.readFileSync(path_1.default.join(SAVED_SEARCHES_DIR, filename), 'utf8');
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
        res.json({ archives });
    }
    catch {
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
        }
        else if (url.includes('goodreads.com')) {
            archiveTitle = "Goodreads List";
        }
        const filename = `search-results-${timestamp}.md`;
        let mdContent = `# ${archiveTitle}\n\n`;
        mdContent += `Date: ${dateStr}\n`;
        mdContent += `Source URL: ${url}\n\n`;
        mdContent += `## Results\n\n`;
        books.forEach((book) => {
            const statusEmoji = book.status === 'found' ? '✅' : book.status === 'not_found' ? '❌' : '⏳';
            mdContent += `### ${statusEmoji} ${book.title}\n`;
            mdContent += `- Author: ${book.author}\n`;
            mdContent += `- Status: ${book.status}\n`;
            if (book.availability)
                mdContent += `- Availability: ${book.availability}\n`;
            if (book.libraryUrl)
                mdContent += `- Library Link: ${book.libraryUrl}\n`;
            if (book.imageUrl)
                mdContent += `- Image: ${book.imageUrl}\n`;
            mdContent += `\n---\n\n`;
        });
        fs_1.default.writeFileSync(path_1.default.join(SAVED_SEARCHES_DIR, filename), mdContent, 'utf8');
        res.json({ success: true, filename });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/api/save-results', (req, res) => {
    try {
        const { filename } = req.body;
        const filePath = path_1.default.join(SAVED_SEARCHES_DIR, filename);
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
        res.json({ success: true });
    }
    catch {
        res.status(500).json({ error: 'Failed to delete archive' });
    }
});
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
