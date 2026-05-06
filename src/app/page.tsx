'use client';

import React, { useState, useEffect } from 'react';
import { Search, Loader2, Book as BookIcon, CheckCircle2, XCircle, ExternalLink, Library, Settings, X, ShieldCheck, Save, Check, History, ListPlus, List } from 'lucide-react';
import Link from 'next/link';

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
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [libraryCode, setLibraryCode] = useState('');
  const [libraryPin, setLibraryPin] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [filter, setFilter] = useState<BookWithStatus['status'] | 'all'>('all');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showListSelector, setShowListSelector] = useState<Book | null>(null);
  const [userLists, setUserLists] = useState<{id: string, name: string}[]>([]);

  // Load settings on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const configRes = await fetch('/api/config');
        const configData = await configRes.json();
        if (configData.code) setLibraryCode(configData.code);
        if (configData.pin) setLibraryPin(configData.pin);
        if (configData.geminiApiKey) setGeminiApiKey(configData.geminiApiKey);

        const listsRes = await fetch('/api/lists');
        const listsData = await listsRes.json();
        setUserLists(listsData.lists || []);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    
    loadData();
  }, []);

  const addToList = async (listId: string, book: BookWithStatus) => {
    try {
      await fetch('/api/lists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listId, action: 'add', book }),
      });
      setShowListSelector(null);
    } catch (err) {
      console.error('Failed to add to list:', err);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: libraryCode, pin: libraryPin, geminiApiKey }),
      });
      if (response.ok) {
        setShowSettings(false);
      } else {
        alert('Failed to save settings');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Error saving settings');
    }
  };

  const saveResults = async () => {
    if (books.length === 0) return;
    setSaving(true);
    try {
      const response = await fetch('/api/save-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, books }),
      });
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save results:', err);
    } finally {
      setSaving(false);
    }
  };

  const fetchBooks = async () => {
    setLoading(true);
    setExtracting(url.includes('reddit.com'));
    setError(null);
    setBooks([]);
    setSaved(false);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
      setExtracting(false);
    }
  };

  const updateBookStatus = (index: number, updates: Partial<BookWithStatus>) => {
    setBooks(prev => {
      const newBooks = [...prev];
      newBooks[index] = { ...newBooks[index], ...updates };
      return newBooks;
    });
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
          libraryUrl: data.libraryUrl,
          imageUrl: data.localImageUrl || book.imageUrl
        });
      } catch (err) {
        console.error('Search failed:', err);
        updateBookStatus(nextBookIndex, { status: 'error' });
      }
    };

    processQueue();
  }, [books]);

  const stats = {
    total: books.length,
    found: books.filter(b => b.status === 'found').length,
    notFound: books.filter(b => b.status === 'not_found').length,
    searching: books.filter(b => b.status === 'searching').length,
    queued: books.filter(b => b.status === 'queued').length,
  };

  const filteredBooks = filter === 'all' 
    ? books 
    : books.filter(b => b.status === filter);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto relative">
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute right-0 top-0 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
          title="Library Settings"
        >
          <Settings className="h-6 w-6" />
        </button>

        <Link
          href="/archive"
          className="absolute right-10 top-0 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
          title="View Archive"
        >
          <History className="h-6 w-6" />
        </Link>

        <Link
          href="/lists"
          className="absolute right-20 top-0 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
          title="My Lists"
        >
          <List className="h-6 w-6" />
        </Link>

        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center justify-center gap-3">
            <Library className="text-indigo-600" /> Book Checker
          </h1>
          <p className="text-slate-600">Enter a Goodreads list or Reddit thread URL to check availability at Mitcham Library</p>
        </header>

        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-lg">
                  <ShieldCheck className="text-indigo-600 h-5 w-5" />
                  Library Credentials
                </div>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={saveSettings} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Membership Code
                  </label>
                  <input
                    type="text"
                    value={libraryCode}
                    onChange={(e) => setLibraryCode(e.target.value)}
                    placeholder="X00..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    PIN / Password
                  </label>
                  <input
                    type="password"
                    value={libraryPin}
                    onChange={(e) => setLibraryPin(e.target.value)}
                    placeholder="••••"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Gemini API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-900"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    Used for smarter book extraction from Reddit threads.
                  </p>
                </div>
                <p className="text-xs text-slate-500 italic">
                  These credentials are saved to library-config.md in the project root.
                </p>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="flex-1 px-4 py-2 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                  >
                    Save Settings
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Goodreads list or Reddit thread URL..."
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
          {extracting && (
            <div className="mt-4 flex items-center gap-3 text-indigo-600 bg-indigo-50 p-3 rounded-lg border border-indigo-100 animate-pulse">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm font-medium">Gemini is analyzing the Reddit thread to extract book titles...</p>
            </div>
          )}
          {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
        </div>

        {books.length > 0 && (
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Results</h2>
              <button
                onClick={saveResults}
                disabled={saving || books.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Results Saved' : 'Save Results Locally'}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard 
                label="Total Books" 
                value={stats.total} 
                color="bg-slate-100 text-slate-700" 
                active={filter === 'all'}
                onClick={() => setFilter('all')}
              />
              <StatCard 
                label="Found" 
                value={stats.found} 
                color="bg-green-100 text-green-700" 
                active={filter === 'found'}
                onClick={() => setFilter('found')}
              />
              <StatCard 
                label="Not Found" 
                value={stats.notFound} 
                color="bg-orange-100 text-orange-700" 
                active={filter === 'not_found'}
                onClick={() => setFilter('not_found')}
              />
              <StatCard 
                label="Searching" 
                value={stats.searching} 
                color="bg-blue-100 text-blue-700" 
                active={filter === 'searching'}
                onClick={() => setFilter('searching')}
              />
              <StatCard 
                label="Queued" 
                value={stats.queued} 
                color="bg-gray-100 text-gray-500" 
                active={filter === 'queued'}
                onClick={() => setFilter('queued')}
              />
            </div>
          </div>
        )}

        {showListSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Add to List</h3>
                <button onClick={() => setShowListSelector(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-sm text-slate-600 mb-4 line-clamp-1">Adding <strong>{showListSelector.title}</strong> to...</p>
                {userLists.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4 italic">No lists found. Create one first in the &quot;My Lists&quot; section.</p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    {userLists.map(list => (
                      <button
                        key={list.id}
                        onClick={() => addToList(list.id, showListSelector as BookWithStatus)}
                        className="w-full text-left px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-sm font-medium"
                      >
                        {list.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="pt-4 border-t border-slate-100">
                  <Link
                    href="/lists"
                    className="flex items-center justify-center gap-2 w-full py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-semibold"
                  >
                    Manage Lists
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBooks.map((book, idx) => (
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
                  <div className="flex items-center gap-2">
                    <StatusBadge status={book.status} />
                    <button 
                      onClick={() => setShowListSelector(book)}
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Add to My List"
                    >
                      <ListPlus className="h-4 w-4" />
                    </button>
                  </div>
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

function StatCard({ label, value, color, onClick, active }: { label: string; value: number; color: string; onClick: () => void; active: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`${color} p-4 rounded-xl text-center shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95 ${active ? 'ring-2 ring-offset-2 ring-indigo-500 ring-offset-slate-50' : 'opacity-70 hover:opacity-100'}`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wider font-semibold opacity-80">{label}</div>
    </button>
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
