import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Use environment variable or default to project root
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(process.cwd(), '..');
const CONFIG_FILE = path.join(PROJECT_ROOT, 'library-config.md');

function getGeminiApiKey(): string | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      const match = content.match(/Gemini API Key:\s*(.*)/i);
      if (match && match[1].trim()) {
        const key = match[1].trim();
        if (key.length > 5) return key;
      }
    }
  } catch (error) {
    console.error('Error reading Gemini API key from config:', error);
  }

  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  return null;
}

async function extractBooksWithGemini(text: string, apiKey: string): Promise<Book[]> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
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
  } catch (error) {
    console.error('Gemini extraction failed:', error);
    return [];
  }
}

export interface Book {
  title: string;
  author: string;
  goodreadsUrl?: string;
  imageUrl?: string;
}

async function fetchWithRetry(url: string, options: any = {}, retries: number = 3, backoff: number = 1000): Promise<Response> {
  const timeout = options.timeout || 30000;
  delete options.timeout;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (err: any) {
      clearTimeout(id);
      const isLastRetry = i === retries - 1;
      const isTimeout = err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT';
      const isConnReset = err.code === 'ECONNRESET';

      if (isLastRetry) throw err;

      if (isTimeout || isConnReset) {
        console.warn(`Fetch failed (${err.code || err.name}), retrying in ${backoff}ms... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2; // Exponential backoff
        continue;
      }

      throw err;
    }
  }
  throw new Error('Fetch failed after retries');
}

export async function scrapeGoodreadsList(url: string): Promise<Book[]> {
  console.log('Scraping Goodreads URL:', url);
  try {
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    if (!response.ok) {
      throw new Error(`Goodreads returned status ${response.status}`);
    }

    const data = await response.text();
    const $ = cheerio.load(data);
    const books: Book[] = [];

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error scraping Goodreads:', error);
    throw new Error(`Failed to scrape Goodreads list: ${message}`);
  }
}

export async function scrapeRedditThread(url: string): Promise<Book[]> {
  console.log('Scraping Reddit URL:', url);
  try {
    const oldRedditUrl = url.replace('www.reddit.com', 'old.reddit.com').split('?')[0];
    const response = await fetchWithRetry(oldRedditUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
      },
      timeout: 15000
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

    const books: Book[] = [];
    const seen = new Set<string>();

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error scraping Reddit:', error);
    throw new Error(`Failed to scrape Reddit thread: ${message}`);
  }
}

export interface LibraryStatus {
  found: boolean;
  availability?: string;
  libraryUrl?: string;
  localImageUrl?: string;
}

async function downloadImage(url: string, filename: string): Promise<string | undefined> {
  try {
    const response = await fetchWithRetry(url, { timeout: 10000 });
    if (!response.ok) return undefined;
    const buffer = await response.arrayBuffer();
    const dir = path.join(PROJECT_ROOT, 'public', 'book-covers');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
    const sanitizedTitle = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    const safeName = `${sanitizedTitle}_${hash}.jpg`;
    const filePath = path.join(dir, safeName);
    
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return `book-covers/${safeName}`;
  } catch (error) {
    console.error('Failed to download image:', error);
    return undefined;
  }
}

export async function searchLibrary(title: string, author: string = ''): Promise<LibraryStatus> {
  try {
    // Clean up the query: remove special characters that might confuse the library search
    // Keep letters, numbers, and spaces. Remove things like (#1), [graphic novel], etc.
    const cleanTitle = title
      .replace(/\(.*?\)/g, '') // Remove (parentheses)
      .replace(/\[.*?\]/g, '') // Remove [brackets]
      .replace(/[^a-zA-Z0-9\s]/g, ' ') // Replace special chars with space
      .replace(/\s+/g, ' ')
      .trim();
    
    const cleanAuthor = author
      ? author.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    
    const queryStr = cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle;
    const query = encodeURIComponent(queryStr);
    // Added qf=FORMAT%09Format%09BOOK%09Books to ensure only books are returned
    const url = `https://onecard.network/client/en_AU/mitcham/search/results?qu=${query}&qf=FORMAT%09Format%09BOOK%09Books&dt=thumb`;
    
    console.log(`Searching library for: "${queryStr}" (Books only)`);

    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      timeout: 25000
    });

    if (!response.ok) {
      console.error(`Library search failed with status: ${response.status}`);
      return { found: false };
    }

    const data = await response.text();
    const $ = cheerio.load(data);
    
    // Check if results exist - updated with more selectors
    const noResultsFound = $('.no_results_wrapper').length > 0 || 
                          $('#results_summary').text().includes('0 results found') || 
                          $('.noResults').length > 0 ||
                          $('.results_cell').length === 0;

    if (noResultsFound) {
      console.log(`No results found for "${queryStr}"`);
      // If we searched with an author and found nothing, try again with just the title
      if (cleanAuthor) {
        console.log(`Retrying with title only: "${cleanTitle}"`);
        return searchLibrary(cleanTitle, '');
      }
      return { found: false };
    }

    // Look for the first result that matches
    const firstResult = $('.results_cell').first();
    
    let availability = 'Check library for details';
    // The library site often loads availability via JS, but sometimes there's a fallback or summary
    const availText = firstResult.find('.availability').text().trim() || 
                     $('.availabilityCount').first().text().trim() ||
                     firstResult.find('.results_right').text().trim();
    
    if (availText && availText.length > 2) {
      availability = availText.replace(/\s+/g, ' ').trim();
    }

    console.log(`Found result for "${cleanTitle}". Availability: ${availability}`);

    // Extract image
    let localImageUrl: string | undefined = undefined;
    const resultCells = $('.results_cell');
    
    for (let i = 0; i < Math.min(resultCells.length, 3); i++) {
      const cell = $(resultCells[i]);
      const imgElements = cell.find('.thumbnail img, img.results_img, .results_img_container img');
      
      let foundValidImage = false;
      for (let j = 0; j < imgElements.length; j++) {
        let libraryImgUrl = $(imgElements[j]).attr('src');
        if (libraryImgUrl) {
          if (libraryImgUrl.includes('no_image.png') || libraryImgUrl.includes('imageURL') || libraryImgUrl.includes('spacer.gif')) continue;
          if (libraryImgUrl.startsWith('/')) libraryImgUrl = `https://onecard.network${libraryImgUrl}`;
          if (libraryImgUrl.startsWith('http')) {
            localImageUrl = await downloadImage(libraryImgUrl, `${cleanTitle.substring(0, 20)}_${i}`);
            if (localImageUrl) {
              foundValidImage = true;
              break;
            }
          }
        }
      }
      if (foundValidImage) break;
    }

    return {
      found: true,
      availability,
      libraryUrl: url,
      localImageUrl
    };
  } catch (error) {
    console.error('Error searching library:', error);
    return { found: false };
  }
}
