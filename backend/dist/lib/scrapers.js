"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeGoodreadsList = scrapeGoodreadsList;
exports.scrapeRedditThread = scrapeRedditThread;
exports.searchLibrary = searchLibrary;
const cheerio = __importStar(require("cheerio"));
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
// Adjusting paths to be relative to the project root (one level up from backend/src)
const PROJECT_ROOT = path_1.default.join(__dirname, '..', '..', '..');
const CONFIG_FILE = path_1.default.join(PROJECT_ROOT, 'library-config.md');
function getGeminiApiKey() {
    try {
        if (fs_1.default.existsSync(CONFIG_FILE)) {
            const content = fs_1.default.readFileSync(CONFIG_FILE, 'utf8');
            const match = content.match(/Gemini API Key:\s*(.*)/i);
            if (match && match[1].trim()) {
                const key = match[1].trim();
                if (key.length > 5)
                    return key;
            }
        }
    }
    catch (error) {
        console.error('Error reading Gemini API key from config:', error);
    }
    if (process.env.GEMINI_API_KEY)
        return process.env.GEMINI_API_KEY;
    return null;
}
async function extractBooksWithGemini(text, apiKey) {
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const prompt = `
      Extract a list of books mentioned in the following text from a Reddit book recommendation thread.
      Return the result as a JSON array of objects with "title" and "author" keys.
      Only include actual book titles. If the author is unknown, leave it as an empty string.
      Be thorough and extract as many unique books as possible.
      
      Text:
      ${text.substring(0, 30000)}
      
      JSON Response:
    `;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let jsonText = response.text().trim();
        if (jsonText.includes("```")) {
            const match = jsonText.match(/```(?:json)?([\s\S]*?)```/);
            if (match) {
                jsonText = match[1].trim();
            }
        }
        return JSON.parse(jsonText);
    }
    catch (error) {
        console.error('Gemini extraction failed:', error);
        return [];
    }
}
async function scrapeGoodreadsList(url) {
    console.log('Scraping Goodreads URL:', url);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!response.ok) {
            throw new Error(`Goodreads returned status ${response.status}`);
        }
        const data = await response.text();
        const $ = cheerio.load(data);
        const books = [];
        $('tr[itemtype="http://schema.org/Book"]').each((_, element) => {
            const title = $(element).find('a.bookTitle span[itemprop="name"]').text().trim();
            const author = $(element).find('a.authorName span[itemprop="name"]').text().trim();
            const relativeUrl = $(element).find('a.bookTitle').attr('href');
            const imageUrl = $(element).find('img.bookCover').attr('src');
            if (title && author) {
                books.push({
                    title,
                    author,
                    goodreadsUrl: relativeUrl ? `https://www.goodreads.com${relativeUrl}` : undefined,
                    imageUrl
                });
            }
        });
        return books;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error scraping Goodreads:', error);
        throw new Error(`Failed to scrape Goodreads list: ${message}`);
    }
}
async function scrapeRedditThread(url) {
    console.log('Scraping Reddit URL:', url);
    try {
        const oldRedditUrl = url.replace('www.reddit.com', 'old.reddit.com').split('?')[0];
        const response = await fetch(oldRedditUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            throw new Error(`Reddit returned status ${response.status}`);
        }
        const data = await response.text();
        const $ = cheerio.load(data);
        let allText = '';
        $('.usertext-body').each((_, element) => {
            allText += $(element).text() + '\n---\n';
        });
        const apiKey = getGeminiApiKey();
        if (apiKey && apiKey.length > 5) {
            const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
            console.log(`Using Gemini API Key for model gemini-flash-latest: ${maskedKey}`);
            const geminiBooks = await extractBooksWithGemini(allText, apiKey);
            if (geminiBooks && geminiBooks.length > 0) {
                return geminiBooks;
            }
        }
        const books = [];
        const seen = new Set();
        $('.usertext-body').each((_, element) => {
            const $el = $(element);
            const text = $el.text();
            const byAuthorRegex = /["']?([^"'\n]{2,60})["']?\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
            let match;
            while ((match = byAuthorRegex.exec(text)) !== null) {
                const title = match[1].trim().replace(/^["']|["']$/g, '');
                const author = match[2].trim();
                const key = `${title.toLowerCase()}-${author.toLowerCase()}`;
                if (title.length > 2 && !seen.has(key)) {
                    books.push({ title, author });
                    seen.add(key);
                }
            }
            const bracketRegex = /\{\{(.+?)\}\}|\[\[(.+?)\]\]/g;
            while ((match = bracketRegex.exec(text)) !== null) {
                const title = (match[1] || match[2]).trim();
                if (title && title.length > 2 && title.length < 100 && !seen.has(title.toLowerCase())) {
                    books.push({ title, author: '' });
                    seen.add(title.toLowerCase());
                }
            }
            $el.find('em, strong, i, b').each((_, subEl) => {
                const title = $(subEl).text().trim();
                const words = title.split(/\s+/);
                if (words.length >= 1 && words.length <= 8 && title.length > 3 && !seen.has(title.toLowerCase())) {
                    if (/^[A-Z0-9]/.test(title)) {
                        const noise = ['Edit', 'Reddit', 'Reply', 'Post', 'Books', 'Read'];
                        if (!noise.includes(title)) {
                            books.push({ title, author: '' });
                            seen.add(title.toLowerCase());
                        }
                    }
                }
            });
        });
        if (books.length < 5) {
            $('.usertext-body').each((_, element) => {
                const lines = $(element).text().split('\n');
                for (let line of lines) {
                    line = line.trim();
                    const words = line.split(/\s+/);
                    if (words.length >= 1 && words.length <= 5 && /^[A-Z]/.test(line) && line.length > 5) {
                        if (!seen.has(line.toLowerCase())) {
                            books.push({ title: line, author: '' });
                            seen.add(line.toLowerCase());
                        }
                    }
                }
            });
        }
        return books;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error scraping Reddit:', error);
        throw new Error(`Failed to scrape Reddit thread: ${message}`);
    }
}
async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok)
            return undefined;
        const buffer = await response.arrayBuffer();
        const dir = path_1.default.join(PROJECT_ROOT, 'public', 'book-covers');
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        const hash = crypto_1.default.createHash('md5').update(url).digest('hex').substring(0, 8);
        const sanitizedTitle = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
        const safeName = `${sanitizedTitle}_${hash}.jpg`;
        const filePath = path_1.default.join(dir, safeName);
        fs_1.default.writeFileSync(filePath, Buffer.from(buffer));
        return `/book-covers/${safeName}`;
    }
    catch (error) {
        console.error('Failed to download image:', error);
        return undefined;
    }
}
async function searchLibrary(title, author = '') {
    try {
        const cleanTitle = title.replace(/\s+/g, ' ').trim();
        const cleanAuthor = author ? author.replace(/\s+/g, ' ').trim() : '';
        const queryStr = cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle;
        const query = encodeURIComponent(queryStr);
        const url = `https://onecard.network/client/en_AU/mitcham/search/results?qu=${query}&dt=thumb`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!response.ok) {
            return { found: false };
        }
        const data = await response.text();
        const $ = cheerio.load(data);
        const noResultsFound = $('.no_results_wrapper').length > 0 ||
            $('#results_summary').text().includes('0 results found') ||
            $('.noResults').length > 0;
        if (noResultsFound) {
            if (cleanAuthor) {
                return searchLibrary(cleanTitle, '');
            }
            return { found: false };
        }
        const firstResult = $('.result_cell').first();
        let availability = 'Check library for details';
        const availText = firstResult.find('.availability').text().trim() || $('.availabilityCount').first().text().trim();
        if (availText) {
            availability = availText;
        }
        let localImageUrl = undefined;
        const resultCells = $('.results_cell');
        for (let i = 0; i < Math.min(resultCells.length, 5); i++) {
            const cell = $(resultCells[i]);
            const imgElements = cell.find('.thumbnail img, img.results_img, .results_img_container img');
            let foundValidImage = false;
            for (let j = 0; j < imgElements.length; j++) {
                let libraryImgUrl = $(imgElements[j]).attr('src');
                if (libraryImgUrl) {
                    if (libraryImgUrl.includes('no_image.png') ||
                        libraryImgUrl.includes('imageURL') ||
                        libraryImgUrl.includes('spacer.gif')) {
                        continue;
                    }
                    if (libraryImgUrl.startsWith('/')) {
                        libraryImgUrl = `https://onecard.network${libraryImgUrl}`;
                    }
                    if (libraryImgUrl.startsWith('http')) {
                        localImageUrl = await downloadImage(libraryImgUrl, `${cleanTitle}_${cleanAuthor}_${i}_${j}`);
                        if (localImageUrl) {
                            foundValidImage = true;
                            break;
                        }
                    }
                }
            }
            if (foundValidImage)
                break;
        }
        return {
            found: true,
            availability,
            libraryUrl: url,
            localImageUrl
        };
    }
    catch (error) {
        console.error('Error searching library:', error);
        return { found: false };
    }
}
