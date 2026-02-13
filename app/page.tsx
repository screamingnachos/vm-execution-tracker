'use client';

import { useState, useEffect } from 'react';
import TriageCard from '../components/TriageCard';
import Dashboard from '../components/Dashboard';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [view, setView] = useState('triage');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // dbStores must be declared right here at the top level of the component
  const [dbStores, setDbStores] = useState<any[]>([]);

  useEffect(() => {
    fetchPendingTasks();
  }, []);

  async function fetchPendingTasks() {
    setLoading(true);
    
    // Fetch pending photos
    const { data: photosData } = await supabase
      .from('photos')
      .select(`id, image_url, slack_messages ( raw_text, created_at )`)
      .eq('status', 'pending');

    // Fetch all real stores from your DB
    const { data: storesData } = await supabase
      .from('stores')
      .select('*');

    if (photosData) setTasks(photosData);
    if (storesData) setDbStores(storesData);
    
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header & Main Navigation */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex gap-4">
            <button 
              onClick={() => setView('triage')}
              className={`text-2xl font-bold pb-2 ${view === 'triage' ? 'border-b-4 border-blue-600 text-slate-900' : 'text-slate-400'}`}
            >
              Triage Queue
            </button>
            <button 
              onClick={() => setView('dashboard')}
              className={`text-2xl font-bold pb-2 ${view === 'dashboard' ? 'border-b-4 border-blue-600 text-slate-900' : 'text-slate-400'}`}
            >
              Dashboards
            </button>
          </div>

          {view === 'triage' && (
            <button 
              onClick={async () => {
                setLoading(true);
                const res = await fetch('/api/sync', { method: 'POST' });
                const data = await res.json();
                if (data.count > 0) alert(`Imported ${data.count} old messages!`);
                else if (data.count === 0) alert('No new messages found.');
                else alert('Error syncing messages.');
                fetchPendingTasks();
              }}
              disabled={loading}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Syncing...' : 'Sync History'}
            </button>
          )}
        </div>

        {/* View Rendering */}
        {view === 'triage' ? (
          <div className="flex flex-col gap-2 max-w-4xl">
            {loading ? (
              <p className="text-slate-500">Loading tasks from Supabase...</p>
            ) : tasks.length === 0 ? (
              <p className="text-slate-500 bg-white p-6 rounded-xl border border-slate-200">No pending executions. You are all caught up!</p>
            ) : (
              tasks.map((task) => (
                <TriageCard 
                  key={task.id}
                  id={task.id}
                  imageUrl={task.image_url} 
                  rawText={task.slack_messages?.raw_text || "No text provided"} 
                  time={new Date(task.slack_messages?.created_at).toLocaleString()} 
                  dbStores={dbStores}
                  onComplete={(id: string) => setTasks(tasks.filter(t => t.id !== id))}
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