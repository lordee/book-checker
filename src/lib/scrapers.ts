import * as cheerio from 'cheerio';

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
  } catch (error: any) {
    console.error('Error scraping Goodreads:', error);
    throw new Error(`Failed to scrape Goodreads list: ${error.message}`);
  }
}

export interface LibraryStatus {
  found: boolean;
  availability?: string;
  libraryUrl?: string;
}

export async function searchLibrary(title: string, author: string): Promise<LibraryStatus> {
  try {
    const query = encodeURIComponent(`${title} ${author}`);
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
    const resultsCountText = $('#results_summary').text().trim();
    const noResults = resultsCountText.includes('0 results found') || $('.noResults').length > 0;

    if (noResults) {
      return { found: false };
    }

    // Look for the first result that matches
    const firstResult = $('.result_cell').first();
    
    let availability = 'Check library for details';
    const availText = firstResult.find('.availability').text().trim() || $('.availabilityCount').first().text().trim();
    if (availText) {
      availability = availText;
    }

    return {
      found: true,
      availability,
      libraryUrl: url
    };
  } catch (error) {
    console.error('Error searching library:', error);
    return { found: false };
  }
}
