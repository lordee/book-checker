'use client';

import React, { useState, useEffect } from 'react';
import { Search, Loader2, Book as BookIcon, CheckCircle2, XCircle, ExternalLink, Library } from 'lucide-react';

interface Book {
  title: string;
  author: string;
  goodreadsUrl?: string;
  imageUrl?: string;
}

interface BookWithStatus extends Book {
  status: 'queued' | 'searching' | 'found' | 'not_found' | 'error';
  availability?: string;
  libraryUrl?: string;
}

export default function Home() {
  const [url, setUrl] = useState('https://www.goodreads.com/list/show/99103.Top_100_Children_s_Books_on_Goodreads');
  const [books, setBooks] = useState<BookWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    setBooks([]);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      const booksWithStatus: BookWithStatus[] = data.books.map((b: Book) => ({
        ...b,
        status: 'queued'
      }));
      setBooks(booksWithStatus);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const processQueue = async () => {
      const nextBookIndex = books.findIndex(b => b.status === 'queued');
      if (nextBookIndex === -1) return;

      // Limit concurrent searches to avoid being blocked
      const activeSearches = books.filter(b => b.status === 'searching').length;
      if (activeSearches >= 3) return;

      const book = books[nextBookIndex];
      
      // Update status to searching
      updateBookStatus(nextBookIndex, { status: 'searching' });

      try {
        const response = await fetch(`/api/search?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`);
        const data = await response.json();
        
        updateBookStatus(nextBookIndex, { 
          status: data.found ? 'found' : 'not_found',
          availability: data.availability,
          libraryUrl: data.libraryUrl
        });
      } catch (err) {
        updateBookStatus(nextBookIndex, { status: 'error' });
      }
    };

    processQueue();
  }, [books]);

  const updateBookStatus = (index: number, updates: Partial<BookWithStatus>) => {
    setBooks(prev => {
      const newBooks = [...prev];
      newBooks[index] = { ...newBooks[index], ...updates };
      return newBooks;
    });
  };

  const stats = {
    total: books.length,
    found: books.filter(b => b.status === 'found').length,
    notFound: books.filter(b => b.status === 'not_found').length,
    searching: books.filter(b => b.status === 'searching').length,
    queued: books.filter(b => b.status === 'queued').length,
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center justify-center gap-3">
            <Library className="text-indigo-600" /> Book Availability Checker
          </h1>
          <p className="text-slate-600">Enter a Goodreads list URL to check availability at Mitcham Library</p>
        </header>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.goodreads.com/list/show/..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-900"
              />
            </div>
            <button
              onClick={fetchBooks}
              disabled={loading || !url}
              className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Fetch & Check'}
            </button>
          </div>
          {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
        </div>

        {books.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <StatCard label="Total Books" value={stats.total} color="bg-slate-100 text-slate-700" />
            <StatCard label="Found" value={stats.found} color="bg-green-100 text-green-700" />
            <StatCard label="Not Found" value={stats.notFound} color="bg-orange-100 text-orange-700" />
            <StatCard label="Searching" value={stats.searching} color="bg-blue-100 text-blue-700" />
            <StatCard label="Queued" value={stats.queued} color="bg-gray-100 text-gray-500" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
              <div className="flex p-4 gap-4">
                <div className="w-20 h-28 bg-slate-100 rounded flex-shrink-0 overflow-hidden">
                  {book.imageUrl ? (
                    <img src={book.imageUrl} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookIcon className="w-full h-full p-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate mb-1" title={book.title}>{book.title}</h3>
                  <p className="text-sm text-slate-500 truncate mb-2">{book.author}</p>
                  <StatusBadge status={book.status} />
                </div>
              </div>
              
              <div className="px-4 pb-4 mt-auto">
                {book.availability && (
                  <p className="text-xs font-medium text-slate-600 mb-3 bg-slate-50 p-2 rounded">
                    {book.availability}
                  </p>
                )}
                <div className="flex gap-2">
                  {book.goodreadsUrl && (
                    <a
                      href={book.goodreadsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      Goodreads <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {book.libraryUrl && book.status === 'found' && (
                    <a
                      href={book.libraryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 text-green-600 hover:underline"
                    >
                      Library <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} p-4 rounded-xl text-center shadow-sm`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wider font-semibold opacity-80">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: BookWithStatus['status'] }) {
  switch (status) {
    case 'queued':
      return <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full font-medium">Queued</span>;
    case 'searching':
      return <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full font-medium animate-pulse">Searching...</span>;
    case 'found':
      return <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium"><CheckCircle2 className="h-3 w-3" /> Available</span>;
    case 'not_found':
      return <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium"><XCircle className="h-3 w-3" /> Not Found</span>;
    case 'error':
      return <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">Error</span>;
    default:
      return null;
  }
}
