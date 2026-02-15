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

  // 1. Exact Match
  const exactMatch = stores.find(s => cleanText.includes(s.name.toLowerCase()));
  if (exactMatch) return exactMatch;

  // 2. Keyword Scoring
  const scoredStores = stores.map(store => {
    const keywords = store.name.toLowerCase().split(' ');
    let score = 0;
    
    keywords.forEach((word) => {
      // Matches meaningful words (3+ chars)
      if (word.length > 2 && cleanText.includes(word)) {
        score += 1;
      }
    });
    return { ...store, score };
  });

  // Filter and sort by highest score
  const bestMatches = scoredStores.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  
  return bestMatches.length > 0 ? bestMatches[0] : null;
};

// --- MAIN COMPONENT ---
export default function Home() {
  const [view, setView] = useState('triage');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbStores, setDbStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingTasks();
  }, []);

  async function fetchPendingTasks() {
    setLoading(true);
    try {
      // 1. Fetch Stores
      const { data: storesData } = await supabase.from('stores').select('*');
      if (storesData) setDbStores(storesData);

      // 2. Fetch Photos (Joined with Slack Message Data)
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select(`
          id, 
          image_url, 
          created_at,
          slack_messages ( 
            raw_text, 
            created_at 
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }); // Show newest first

      if (photosError) throw photosError;

      // 3. Map Data & Apply Fuzzy Logic
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
        alert(`Success! Imported ${data.count} photos.`);
      } else {
        alert(`Sync Failed: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Network Error: ${error.message}`);
    }
    fetchPendingTasks();
  };

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
          <div className="flex flex-col gap-6">
            {loading ? (
              <div className="text-center py-20 text-slate-500">Updating triage queue...</div>
            ) : tasks.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-400 text-lg">All caught up! No pending photos.</p>
              </div>
            ) : (
              tasks.map((task) => (
                <TriageCard 
                  key={task.id}
                  id={task.id}
                  imageUrl={task.image_url} 
                  rawText={task.slack_messages?.raw_text || "No text provided"} 
                  // Display formatted Indian Date
                  time={new Date(task.slack_messages?.created_at || task.created_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
                  })} 
                  dbStores={dbStores}
                  initialStore={task.suggestedStore} // Passes fuzzy match result
                  onComplete={(id: string) => setTasks(prev => prev.filter(t => t.id !== id))}
                />
              ))
            )}
          </div>
        ) : (
          <Dashboard />
        )}

      </div>
    </div>
  );
}