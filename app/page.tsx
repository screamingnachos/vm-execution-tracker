'use client';

import { useState, useEffect } from 'react';
import TriageCard from '../components/TriageCard';
import Dashboard from '../components/Dashboard';
import { supabase } from '../lib/supabase'; // <-- Ensures database connection works

// --- ADMIN CONFIGURATION ---
const ADMIN_EMAILS = ['anuj.dalvi@superk.in'];
const ADMIN_PASSWORD = 'superk-admin';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Triage'>('Dashboard');
  
  // Auth States
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Triage States
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [dbStores, setDbStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // --- DATA FETCHING & SYNC LOGIC ---
  const fetchPendingTasks = async () => {
    setLoading(true);
    try {
      const { data: storesRes } = await supabase.from('stores').select('*');
      if (storesRes) setDbStores(storesRes);

      const { data: photosRes } = await supabase
        .from('photos')
        .select(`
          id,
          image_url,
          created_at,
          status,
          slack_messages ( raw_text, created_at )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
        
      if (photosRes) setPendingTasks(photosRes);
    } catch (error: any) {
      console.error("Fetch error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        if (data.hasMore) {
          alert(`Scanned ${data.scanned} messages and imported ${data.count} new photos.\n\nThere are still older messages to scan! Please click "Sync History" again to continue fetching.`);
        } else {
          alert(`Fully Synced! Scanned ${data.scanned} messages all the way back to Feb 1st.\n\nImported ${data.count} new photos.`);
        }
      } else {
        alert(`Sync Notice: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Network Error: ${error.message}`);
    }
    // Refresh the queue after syncing!
    await fetchPendingTasks();
  };

  // Removes a task from the screen immediately after you approve/reject it
  const removeTask = (taskId: string) => {
    setPendingTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  useEffect(() => {
    if (isAdmin) {
      fetchPendingTasks();
    }
  }, [isAdmin]);

  // --- AUTHENTICATION FUNCTIONS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (ADMIN_EMAILS.includes(email.toLowerCase()) && password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setLoginError('');
      setPassword(''); 
    } else {
      setLoginError('Invalid admin credentials.');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setActiveTab('Dashboard'); 
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      
      {/* GLOBAL NAVIGATION HEADER */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-200 pb-4">
        
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('Dashboard')}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'Dashboard' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            📊 Analytics Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('Triage')}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'Triage' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-blue-50'}`}
          >
            ✅ Triage Queue (Admin)
          </button>
        </div>

        {isAdmin && activeTab === 'Triage' && (
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg border border-red-100 hover:bg-red-100 transition-colors flex items-center gap-2"
          >
            🔒 Lock & Logout
          </button>
        )}
      </div>

      {/* TAB ROUTING */}
      {activeTab === 'Dashboard' ? (
        <Dashboard isAdmin={isAdmin} />
      ) : (
        
        isAdmin ? (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-slate-800">Pending Approvals</h1>
              <button 
                onClick={handleSync}
                disabled={loading}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Syncing...' : '🔄 Sync Slack History'}
              </button>
            </div>

            {pendingTasks.length === 0 && !loading ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-4xl">🎉</span>
                <p className="text-slate-500 font-medium mt-4">All caught up! Queue is empty.</p>
              </div>
            ) : (
              <div>
                {pendingTasks.map((task) => (
                  <TriageCard 
                    key={task.id}
                    id={task.id}
                    imageUrl={task.image_url}
                    rawText={task.slack_messages?.raw_text || 'No text provided'}
                    time={new Date(task.created_at).toLocaleString('en-IN')}
                    dbStores={dbStores}
                    onComplete={removeTask}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mt-20">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Admin Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@superk.in"
                  className="w-full px-4 py-3 text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  required 
                />
              </div>
              
              {loginError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-lg border border-red-100">
                  {loginError}
                </div>
              )}
              
              <button 
                type="submit" 
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-sm hover:bg-blue-700 transition-colors mt-2"
              >
                Unlock Triage Queue
              </button>
            </form>
          </div>
        )
      )}
    </main>
  );
}