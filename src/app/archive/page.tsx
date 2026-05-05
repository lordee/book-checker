'use client';

import React, { useState, useEffect } from 'react';
import { Library, ArrowLeft, Calendar, ExternalLink, Trash2, FileText, Loader2, Book as BookIcon, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Archive {
  filename: string;
  title: string;
  date: string;
  url: string;
}

interface ArchivedBook {
  title: string;
  author: string;
  status: string;
  availability: string;
  libraryUrl: string;
  imageUrl: string;
}

interface ArchiveDetail extends Archive {
  books: ArchivedBook[];
}

export default function ArchivePage() {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<ArchiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const fetchArchives = async () => {
      try {
        const response = await fetch('/api/save-results');
        const data = await response.json();
        setArchives(data.archives || []);
      } catch (err) {
        console.error('Failed to fetch archives:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchArchives();
  }, []);

  const fetchArchiveDetail = async (filename: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/save-results?filename=${filename}`);
      const data = await response.json();
      setSelectedArchive(data);
    } catch (err) {
      console.error('Failed to fetch archive detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const deleteArchive = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this archive?')) return;
    
    try {
      const response = await fetch('/api/save-results', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (response.ok) {
        setArchives(prev => prev.filter(a => a.filename !== filename));
        if (selectedArchive?.filename === filename) setSelectedArchive(null);
      }
    } catch (err) {
      console.error('Failed to delete archive:', err);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link 
            href="/"
            className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-colors font-medium"
          >
            <ArrowLeft className="h-5 w-5" /> Back to Search
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Library className="text-indigo-600" /> Search Archive
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Archive List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Past Searches</h2>
            {loading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : archives.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">No archives found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {archives.map((archive) => (
                  <button 
                    key={archive.filename}
                    onClick={() => fetchArchiveDetail(archive.filename)}
                    className={`w-full text-left bg-white rounded-xl p-4 border transition-all flex flex-col gap-2 hover:shadow-md ${selectedArchive?.filename === archive.filename ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'}`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-2">{archive.title}</h3>
                      <button 
                        onClick={(e) => deleteArchive(e, archive.filename)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Calendar className="h-3 w-3" /> {archive.date}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Content - Archive Detail */}
          <div className="lg:col-span-2">
            {loadingDetail ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500">Loading results...</p>
              </div>
            ) : selectedArchive ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedArchive.title}</h2>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> {selectedArchive.date}
                    </span>
                    {selectedArchive.url && (
                      <a 
                        href={selectedArchive.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-indigo-600 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" /> Original Source
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedArchive.books.map((book, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
                      <div className="flex p-4 gap-4">
                        <div className="w-16 h-24 bg-slate-100 rounded flex-shrink-0 overflow-hidden">
                          {book.imageUrl ? (
                            <img src={book.imageUrl} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                            <BookIcon className="w-full h-full p-4 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 truncate text-sm mb-1" title={book.title}>{book.title}</h3>
                          <p className="text-xs text-slate-500 truncate mb-2">{book.author}</p>
                          <div className="flex items-center gap-3">
                            <ArchiveStatusBadge status={book.status} />
                            {book.libraryUrl && book.status === 'found' && (
                              <a
                                href={book.libraryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] flex items-center gap-1 text-green-600 hover:underline font-medium"
                              >
                                Library <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      {book.availability && (
                        <div className="px-4 pb-4 mt-auto">
                          <p className="text-[10px] font-medium text-slate-600 bg-slate-50 p-2 rounded line-clamp-2">
                            {book.availability}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center gap-4 h-full justify-center text-slate-400">
                <FileText className="h-12 w-12 opacity-20" />
                <p>Select a search from the list to view results</p>
              </div>
            )}
          </div>
        </div>
        
        <p className="mt-12 text-center text-[11px] text-slate-400">
          Archives are stored as Markdown files in the <code>saved-searches/</code> directory.
        </p>
      </div>
    </main>
  );
}

function ArchiveStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'found':
      return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium"><CheckCircle2 className="h-3 w-3" /> Available</span>;
    case 'not_found':
      return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium"><XCircle className="h-3 w-3" /> Not Found</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">Pending</span>;
  }
}
