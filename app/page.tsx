'use client';

import Settings from '../components/Settings';
import { useState, useEffect } from 'react';
import TriageCard from '../components/TriageCard';
import Dashboard from '../components/Dashboard';
import { supabase } from '../lib/supabase'; // <-- Ensures database connection works

// --- ADMIN CONFIGURATION ---
const ADMIN_EMAILS = ['anuj.dalvi@superk.in'];
const ADMIN_PASSWORD = 'superk-admin';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Triage' | 'Settings'>('Dashboard');
  
  // Auth States
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Triage States
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
 // Sync Date & Pagination States
 const [syncStartDate, setSyncStartDate] = useState('');
 const [syncEndDate, setSyncEndDate] = useState('');
 const [currentPage, setCurrentPage] = useState(1); // <-- ADD THIS
  const [dbStores, setDbStores] = useState<any[]>([]);
  const [dbBrands, setDbBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // --- DATA FETCHING & SYNC LOGIC ---
  const fetchPendingTasks = async () => {
    setLoading(true);
    try {
      const { data: storesRes } = await supabase.from('stores').select('*');
      if (storesRes) setDbStores(storesRes);
  
      // NEW: Fetch dynamic brands for the TriageCard dropdowns
      const { data: brandsRes } = await supabase.from('brands').select('*');
      if (brandsRes) setDbBrands(brandsRes);
  
      const { data: photosRes } = await supabase
        .from('photos')
        .select(`id, image_url, created_at, status, raw_text`) // <-- UPDATE THIS LINE
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
  
      if (photosRes) setPendingTasks(photosRes);
    } catch (error: any) { console.error("Fetch error:", error.message); } 
    finally { setLoading(false); }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: syncStartDate, endDate: syncEndDate })
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.hasMore) {
          alert(`Scanned ${data.scanned} messages and imported ${data.count} new photos.\n\nThere are still older messages to scan! Please click "Sync History" again to continue fetching.`);
        } else {
          alert(`Fully Synced! Scanned ${data.scanned} messages.\n\nImported ${data.count} new photos.`);
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

  const handleClearQueue = async () => {
    if (!window.confirm("Are you sure you want to permanently delete ALL pending items in the queue?")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('photos').delete().eq('status', 'pending');
      if (error) throw error;
      
      setPendingTasks([]);
      setCurrentPage(1);
    } catch (err: any) {
      alert(`Error clearing queue: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
            Analytics Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('Triage')}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'Triage' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-blue-50'}`}
          >
            Queue (Admin)
          </button>
          {/* NEW SETTINGS BUTTON (Only visible to admins) */}
{isAdmin && (
  <button 
    onClick={() => setActiveTab('Settings' as any)}
    className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'Settings' as any ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-purple-50'}`}
  >
    ⚙️ Settings
  </button>
)}
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
      ) : activeTab === 'Settings' && isAdmin ? (
        <Settings />
      ) : (
        /* PROTECTED TRIAGE ROUTE */
        isAdmin ? (
          <div className="max-w-4xl mx-auto w-full">
            
            {/* HEADER & FILTERS (Forced to stack on top) */}
            <div className="flex flex-col mb-8 w-full border-b border-slate-200 pb-6">
              <h1 className="text-2xl font-bold text-slate-800 mb-4">Pending Approvals</h1>
              
              <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full">
                <div className="flex flex-col flex-1 min-w-[150px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Start Date</span>
                  <input type="date" value={syncStartDate} onChange={e => setSyncStartDate(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-slate-50" />
                </div>
                
                <div className="flex flex-col flex-1 min-w-[150px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">End Date</span>
                  <input type="date" value={syncEndDate} onChange={e => setSyncEndDate(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-slate-50" />
                </div>
                
                <button 
                  onClick={handleSync}
                  disabled={loading}
                  className="mt-5 bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition-all disabled:opacity-50 whitespace-nowrap shadow-sm"
                >
                  {loading ? 'Syncing...' : '🔄 Sync'}
                </button>
                <button 
                    onClick={handleClearQueue}
                    disabled={loading || pendingTasks.length === 0}
                    className="mt-5 bg-red-50 text-red-600 px-4 py-2.5 rounded-lg font-bold hover:bg-red-100 border border-red-100 transition-all disabled:opacity-50 shadow-sm"
                    title="Delete all pending tasks"
                  >
                    🗑️ Clear
                  </button>
              </div>
            </div>

            {/* QUEUE & PAGINATION */}
            {pendingTasks.length === 0 && !loading ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm w-full">
                <span className="text-4xl">🎉</span>
                <p className="text-slate-500 font-medium mt-4">All caught up! Queue is empty.</p>
              </div>
            ) : (
              <div className="w-full">
                {/* Render only the tasks for the current page */}
                {pendingTasks.slice((currentPage - 1) * 10, currentPage * 10).map((task) => (
                  <TriageCard 
                    key={task.id}
                    id={task.id}
                    imageUrl={task.image_url}
                    rawText={task.raw_text || 'No text provided'} // Reading directly from the new column!
                    time={new Date(task.created_at).toLocaleString('en-IN')}
                    dbStores={dbStores}
                    masterBrands={dbBrands.map(b => b.name)}
                    onComplete={removeTask}
                  />
                ))}

                {/* PAGINATION CONTROLS */}
                {pendingTasks.length > 10 && (
                  <div className="flex justify-between items-center mt-8 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                    >
                      ← Previous
                    </button>
                    
                    <span className="text-sm font-bold text-slate-500">
                      Page {currentPage} of {Math.ceil(pendingTasks.length / 10)}
                    </span>
                    
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(pendingTasks.length / 10), p + 1))} 
                      disabled={currentPage === Math.ceil(pendingTasks.length / 10)}
                      className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* LOGIN SCREEN */
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