import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'library-config.md');

function getGeminiApiKey(): string | null {
  // Priority 1: Local Config File (Explicitly set by user in UI)
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

  // Priority 2: Environment Variable (Fallback)
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  return null;
}

async function extractBooksWithGemini(text: string, apiKey: string): Promise<Book[]> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Switched to "gemini-flash-latest" as requested (alias for the current stable Flash model)
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
    
    // Clean up markdown code blocks if present
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

export async function scrapeGoodreadsList(url: string): Promise<Book[]> {
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
    // Use old.reddit.com for easier scraping
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
    
    // Get all comment text
    let allText = '';
    $('.usertext-body').each((_, element) => {
      allText += $(element).text() + '\n---\n';
    });

    // Try Gemini if API key is available
    const apiKey = getGeminiApiKey();
    if (apiKey && apiKey.length > 5) {
      const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
      const isEnv = process.env.GEMINI_API_KEY === apiKey;
      console.log(`Using Gemini API Key from ${isEnv ? 'environment' : 'config'}: ${maskedKey} for model gemini-flash-latest`);
      const geminiBooks = await extractBooksWithGemini(allText, apiKey);
      if (geminiBooks && geminiBooks.length > 0) {
        return geminiBooks;
      }
      console.log('Gemini extraction returned no results, falling back to heuristics');
    } else {
      console.log('No valid Gemini API key found, using heuristic extraction');
    }

    const books: Book[] = [];
    const seen = new Set<string>();

    $('.usertext-body').each((_, element) => {
      const $el = $(element);
      const text = $el.text();

      // 1. Look for "Title" by Author
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

      // 2. Look for common patterns like {{Title}} or [[Title]]
      const bracketRegex = /\{\{(.+?)\}\}|\[\[(.+?)\]\]/g;
      while ((match = bracketRegex.exec(text)) !== null) {
        const title = (match[1] || match[2]).trim();
        if (title && title.length > 2 && title.length < 100 && !seen.has(title.toLowerCase())) {
          books.push({ title, author: '' });
          seen.add(title.toLowerCase());
        }
      }

      // 3. Look for bold/italic text that might be a book title
      $el.find('em, strong, i, b').each((_, subEl) => {
        const title = $(subEl).text().trim();
        const words = title.split(/\s+/);
        if (words.length >= 1 && words.length <= 8 && title.length > 3 && !seen.has(title.toLowerCase())) {
          if (/^[A-Z0-9]/.test(title)) {
            // Exclude some common noise
            const noise = ['Edit', 'Reddit', 'Reply', 'Post', 'Books', 'Read'];
            if (!noise.includes(title)) {
                books.push({ title, author: '' });
                seen.add(title.toLowerCase());
            }
          }
        }
      });
    });

    // Special case: if we found very few books, try line-by-line extraction for anything that looks like a title
    if (books.length < 5) {
        $('.usertext-body').each((_, element) => {
            const lines = $(element).text().split('\n');
            for (let line of lines) {
                line = line.trim();
                // If a line is just 1-5 words and capitalized, it might be a title
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
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const buffer = await response.arrayBuffer();
    const dir = path.join(process.cwd(), 'public', 'book-covers');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // Sanitize filename
    const safeName = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.jpg';
    const filePath = path.join(dir, safeName);
    
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return `/book-covers/${safeName}`;
  } catch (error) {
    console.error('Failed to download image:', error);
    return undefined;
  }
}

export async function searchLibrary(title: string, author: string = ''): Promise<LibraryStatus> {
  try {
    // Clean up the query: remove extra whitespace and newlines that might be in the title/author
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
    
    // Check if results exist
    const noResultsFound = $('.no_results_wrapper').length > 0 || 
                          $('#results_summary').text().includes('0 results found') || 
                          $('.noResults').length > 0;

    if (noResultsFound) {
      // If we searched with an author and found nothing, try again with just the title
      if (cleanAuthor) {
        console.log(`No results for "${cleanTitle}" by "${cleanAuthor}", retrying with title only...`);
        return searchLibrary(cleanTitle, '');
      }
      return { found: false };
    }

    // Look for the first result that matches
    const firstResult = $('.result_cell').first();
    
    let availability = 'Check library for details';
    const availText = firstResult.find('.availability').text().trim() || $('.availabilityCount').first().text().trim();
    if (availText) {
      availability = availText;
    }

    // Extract image - try all result cells if the first one has no image
    let localImageUrl: string | undefined = undefined;
    const resultCells = $('.results_cell'); // Use the specific class we identified
    
    for (let i = 0; i < Math.min(resultCells.length, 5); i++) {
      const cell = $(resultCells[i]);
      
      // Target the thumbnail specific structure identified in the source
      const imgElements = cell.find('.thumbnail img, img.results_img, .results_img_container img');
      
      let foundValidImage = false;
      
      for (let j = 0; j < imgElements.length; j++) {
        let libraryImgUrl = $(imgElements[j]).attr('src');
        
        if (libraryImgUrl) {
          // Skip placeholders and transparent GIFs
          // We specifically identified MC.GIF as a placeholder in the user's report
          if (libraryImgUrl.includes('no_image.png') || 
              libraryImgUrl.includes('MC.GIF') || 
              libraryImgUrl.includes('imageURL') ||
              libraryImgUrl.includes('spacer.gif')) {
            console.log(`Skipping placeholder image: ${libraryImgUrl}`);
            continue;
          }

          // Handle relative URLs
          if (libraryImgUrl.startsWith('/')) {
            libraryImgUrl = `https://onecard.network${libraryImgUrl}`;
          }
          
          if (libraryImgUrl.startsWith('http')) {
            console.log(`Found candidate image for "${cleanTitle}": ${libraryImgUrl}`);
            localImageUrl = await downloadImage(libraryImgUrl, `${cleanTitle}_${cleanAuthor}_${i}_${j}`);
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
