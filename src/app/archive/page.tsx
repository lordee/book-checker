'use client';

import React, { useState, useEffect } from 'react';
import { Library, ArrowLeft, Calendar, ExternalLink, Trash2, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Archive {
  filename: string;
  title: string;
  date: string;
  url: string;
}

export default function ArchivePage() {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArchives();
  }, []);

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

  const deleteArchive = async (filename: string) => {
    if (!confirm('Are you sure you want to delete this archive?')) return;
    
    try {
      const response = await fetch('/api/save-results', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (response.ok) {
        setArchives(prev => prev.filter(a => a.filename !== filename));
      }
    } catch (err) {
      console.error('Failed to delete archive:', err);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
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

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : archives.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No archives found</h2>
            <p className="text-slate-500">Save your search results to see them here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {archives.map((archive) => (
              <div 
                key={archive.filename}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{archive.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> {archive.date}
                    </span>
                    {archive.url && (
                      <a 
                        href={archive.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-indigo-600 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" /> Original Source
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => deleteArchive(archive.filename)}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete Archive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <p className="mt-8 text-center text-sm text-slate-500">
          Archives are stored as Markdown files in the <code>saved-searches/</code> directory.
        </p>
      </div>
    </main>
  );
}
