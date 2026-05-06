'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, List, ListPlus, Loader2, Book as BookIcon, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Book {
  title: string;
  author: string;
  status: string;
  availability?: string;
  libraryUrl?: string;
  imageUrl?: string;
}

interface UserList {
  id: string;
  name: string;
  bookCount: number;
  createdAt: string;
}

interface ListDetail extends UserList {
  books: Book[];
}

export default function ListsPage() {
  const [lists, setLists] = useState<UserList[]>([]);
  const [selectedList, setSelectedList] = useState<ListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchLists = async () => {
    try {
      const response = await fetch('/api/lists');
      const data = await response.json();
      setLists(data.lists || []);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchListDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/lists?id=${id}`);
      const data = await response.json();
      setSelectedList(data);
    } catch (err) {
      console.error('Failed to fetch list detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setIsCreating(true);
    
    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      const newList = await response.json();
      setLists([newList, ...lists]);
      setNewListName('');
      fetchListDetail(newList.id);
    } catch (err) {
      console.error('Failed to create list:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteList = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this list?')) return;
    
    try {
      const response = await fetch('/api/lists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        setLists(prev => prev.filter(l => l.id !== id));
        if (selectedList?.id === id) setSelectedList(null);
      }
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  const removeBookFromList = async (bookIndex: number, book: Book) => {
    if (!selectedList) return;
    
    try {
      const response = await fetch('/api/lists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: selectedList.id, 
          action: 'remove', 
          bookIndex,
          book
        }),
      });
      if (response.ok) {
        const updatedList = await response.json();
        setSelectedList(updatedList);
        setLists(prev => prev.map(l => l.id === updatedList.id ? { ...l, bookCount: updatedList.books.length } : l));
      }
    } catch (err) {
      console.error('Failed to remove book:', err);
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
            <List className="text-indigo-600" /> My Lists
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - User Lists */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4">
              <form onSubmit={createList} className="flex gap-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="New list name..."
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-900"
                />
                <button
                  type="submit"
                  disabled={isCreating || !newListName.trim()}
                  className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <ListPlus className="h-5 w-5" />
                </button>
              </form>
            </div>

            <h2 className="text-lg font-bold text-slate-800 mb-2">Your Lists</h2>
            {loading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : lists.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm">No lists yet. Create one above!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {lists.map((list) => (
                  <div 
                    key={list.id}
                    onClick={() => fetchListDetail(list.id)}
                    className={`w-full text-left bg-white rounded-xl p-4 border transition-all flex flex-col gap-2 hover:shadow-md cursor-pointer ${selectedList?.id === list.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'}`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{list.name}</h3>
                      <button 
                        onClick={(e) => deleteList(e, list.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1 -mt-1 -mr-1"
                        title="Delete List"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full self-start">
                      {list.bookCount} books
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main Content - List Detail */}
          <div className="lg:col-span-2">
            {loadingDetail ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500">Loading list...</p>
              </div>
            ) : selectedList ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedList.name}</h2>
                    <p className="text-sm text-slate-500 mt-1">{selectedList.books.length} books</p>
                  </div>
                </div>

                {selectedList.books.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center gap-4 h-[40vh] justify-center text-slate-400">
                    <BookIcon className="h-12 w-12 opacity-20" />
                    <p>This list is empty. Add books from the search page or archive.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedList.books.map((book, idx) => (
                      <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md relative group">
                        <button
                          onClick={() => removeBookFromList(idx, book)}
                          className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full text-slate-400 hover:text-red-600 hover:bg-white transition-all shadow-sm opacity-0 group-hover:opacity-100 z-10"
                          title="Remove from list"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex p-4 gap-4">
                          <div className="w-16 h-24 bg-slate-100 rounded flex-shrink-0 overflow-hidden">
                            {book.imageUrl ? (
                              <img src={book.imageUrl} alt={book.title} className="w-full h-full object-cover" />
                            ) : (
                              <BookIcon className="w-full h-full p-4 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-4">
                            <h3 className="font-bold text-slate-900 truncate text-sm mb-1" title={book.title}>{book.title}</h3>
                            <p className="text-xs text-slate-500 truncate mb-2">{book.author}</p>
                            <div className="flex items-center gap-3">
                              <StatusBadge status={book.status} />
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
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center gap-4 h-full justify-center text-slate-400">
                <List className="h-12 w-12 opacity-20" />
                <p>Select a list to view its books</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'found':
      return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium"><CheckCircle2 className="h-3 w-3" /> Available</span>;
    case 'not_found':
      return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium"><XCircle className="h-3 w-3" /> Not Found</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">Pending</span>;
  }
}
