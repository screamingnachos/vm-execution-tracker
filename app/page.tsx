'use client';

import { useState, useEffect } from 'react';
import TriageCard from '../components/TriageCard';
import Dashboard from '../components/Dashboard';
import { supabase } from '../lib/supabase';

// --- TYPES ---
interface Store {
  id: string;
  name: string;
  location: string;
}

interface Task {
  id: string;
  image_url: string;
  created_at: string;
  slack_messages: {
    raw_text: string;
    created_at: string;
  };
  suggestedStore?: Store | null;
}

// --- FUZZY LOGIC ENGINE ---
const findBestStore = (text: string, stores: Store[]): Store | null => {
  if (!text || !stores.length) return null;
  const cleanText = text.toLowerCase();

  const exactMatch = stores.find(s => cleanText.includes(s.name.toLowerCase()));
  if (exactMatch) return exactMatch;

  const scoredStores = stores.map(store => {
    const keywords = store.name.toLowerCase().split(' ');
    let score = 0;
    
    keywords.forEach((word) => {
      if (word.length > 2 && cleanText.includes(word)) {
        score += 1;
      }
    });
    return { ...store, score };
  });

  const bestMatches = scoredStores.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  return bestMatches.length > 0 ? bestMatches[0] : null;
};

// --- MAIN COMPONENT ---
export default function Home() {
  const [view, setView] = useState('triage');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbStores, setDbStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 10;

  useEffect(() => {
    fetchPendingTasks();
  }, []);

  // Auto-adjust the page if we delete the last item on the current page
  const totalPages = Math.max(1, Math.ceil(tasks.length / tasksPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [tasks.length, currentPage, totalPages]);

  async function fetchPendingTasks() {
    setLoading(true);
    try {
      const { data: storesData } = await supabase.from('stores').select('*').limit(5000);
      if (storesData) setDbStores(storesData);

      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select(`
          id, 
          image_url, 
          created_at,
          slack_messages ( raw_text, created_at )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (photosError) throw photosError;

      if (photosData) {
        const mappedTasks = photosData.map((task: any) => ({
          ...task,
          suggestedStore: findBestStore(task.slack_messages?.raw_text || '', storesData || [])
        }));
        setTasks(mappedTasks);
      }
    } catch (err: any) {
      alert(`Load Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        if (data.hasMore) {
          // The server stopped at 500 messages to prevent crashing
          alert(`Scanned ${data.scanned} messages and imported ${data.count} new photos.\n\nThere are still older messages to scan! Please click "Sync History" again to continue fetching.`);
        } else {
          // The server successfully reached the Feb 1st limit
          alert(`Fully Synced! Scanned ${data.scanned} messages all the way back to Feb 1st.\n\nImported ${data.count} new photos.`);
        }
      } else {
        alert(`Sync Notice: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Network Error: ${error.message}`);
    }
    fetchPendingTasks();
  };

  // --- PAGINATION SLICE ---
  const startIndex = (currentPage - 1) * tasksPerPage;
  const currentTasks = tasks.slice(startIndex, startIndex + tasksPerPage);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex gap-6">
            <button 
              onClick={() => setView('triage')}
              className={`text-2xl font-bold pb-2 transition-colors ${view === 'triage' ? 'border-b-4 border-blue-600 text-slate-900' : 'text-slate-400'}`}
            >
              Triage Queue
            </button>
            <button 
              onClick={() => setView('dashboard')}
              className={`text-2xl font-bold pb-2 transition-colors ${view === 'dashboard' ? 'border-b-4 border-blue-600 text-slate-900' : 'text-slate-400'}`}
            >
              Dashboards
            </button>
          </div>

          {view === 'triage' && (
            <button 
              onClick={handleSync}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 disabled:opacity-50 transition-all"
            >
              {loading ? 'Processing...' : 'Sync History'}
            </button>
          )}
        </div>

        {/* Content View */}
        {view === 'triage' ? (
          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="text-center py-20 text-slate-500">Updating triage queue...</div>
            ) : tasks.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-400 text-lg">All caught up! No pending photos.</p>
              </div>
            ) : (
              <>
                {/* RENDER CURRENT PAGE OF TASKS */}
                {currentTasks.map((task) => (
                  <TriageCard 
                    key={task.id}
                    id={task.id}
                    imageUrl={task.image_url} 
                    rawText={task.slack_messages?.raw_text || "No text provided"} 
                    time={new Date(task.slack_messages?.created_at || task.created_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
                    })} 
                    dbStores={dbStores}
                    initialStore={task.suggestedStore}
                    onComplete={(id: string) => setTasks(prev => prev.filter(t => t.id !== id))}
                  />
                ))}

                {/* PAGINATION CONTROLS */}
                {tasks.length > tasksPerPage && (
                  <div className="flex justify-between items-center mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-5 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Previous
                    </button>
                    
                    <span className="text-slate-700 font-medium">
                      Page {currentPage} of {totalPages} 
                      <span className="text-slate-400 text-sm ml-2 font-normal hidden md:inline-block">
                        ({tasks.length} total photos)
                      </span>
                    </span>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-5 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <Dashboard />
        )}

      </div>
    </div>
  );
}