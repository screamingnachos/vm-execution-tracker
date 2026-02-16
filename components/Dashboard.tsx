'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// --- TYPES ---
interface ApprovedPhoto {
  id: string;
  brand: string;
  created_at: string;
  stores?: {
    name: string;
  };
}

interface BrandStat {
  brand: string;
  count: number;
  percentage: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  
  // Dashboard Metrics
  const [totalApproved, setTotalApproved] = useState(0);
  const [brandStats, setBrandStats] = useState<BrandStat[]>([]);
  const [recentActivity, setRecentActivity] = useState<ApprovedPhoto[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      // Fetch ONLY approved photos, and join with the stores table to get the store name
      const { data, error } = await supabase
        .from('photos')
        .select(`
          id, 
          brand, 
          created_at,
          stores ( name )
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // 1. Total Count
        setTotalApproved(data.length);

        // 2. Recent Activity (Top 5 newest)
        setRecentActivity(data.slice(0, 5) as unknown as ApprovedPhoto[]);

        // 3. Calculate Brand Breakdown
        const counts: Record<string, number> = {};
        data.forEach(photo => {
          const brand = photo.brand || 'Unknown Brand';
          counts[brand] = (counts[brand] || 0) + 1;
        });

        // Convert to array and calculate percentages for the UI bars
        const statsArray = Object.keys(counts).map(brand => ({
          brand,
          count: counts[brand],
          percentage: data.length > 0 ? Math.round((counts[brand] / data.length) * 100) : 0
        }));

        // Sort by highest count first
        statsArray.sort((a, b) => b.count - a.count);
        setBrandStats(statsArray);
      }
    } catch (err: any) {
      console.error("Dashboard Error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Crunching your execution data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* 1. TOP KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Approved</h3>
          <p className="text-4xl font-extrabold text-blue-600">{totalApproved}</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Brands Tracked</h3>
          <p className="text-4xl font-extrabold text-indigo-600">{brandStats.length}</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-sm text-white flex flex-col justify-center">
          <h3 className="text-sm font-bold opacity-80 uppercase tracking-wider mb-2">Live Status</h3>
          <p className="text-xl font-semibold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></span>
            Syncing from Database
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 2. BRAND BREAKDOWN (Tailwind Bar Charts) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Executions by Brand</h2>
          
          {brandStats.length === 0 ? (
            <p className="text-slate-500 text-center py-10">No brands tagged yet.</p>
          ) : (
            <div className="space-y-5">
              {brandStats.map((stat) => (
                <div key={stat.brand}>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <span className="text-slate-700">{stat.brand}</span>
                    <span className="text-slate-500">{stat.count} ({stat.percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div 
                      className="bg-blue-500 h-3 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${stat.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. RECENT ACTIVITY FEED */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Recent Approvals</h2>
          
          {recentActivity.length === 0 ? (
            <p className="text-slate-500 text-center py-10">No recent activity.</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((photo) => (
                <div key={photo.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-lg">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {photo.stores?.name || 'Unknown Store'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tagged as <span className="font-semibold text-blue-600">{photo.brand || 'Unbranded'}</span>
                    </p>
                  </div>
                  <div className="ml-auto text-xs font-medium text-slate-400">
                    {new Date(photo.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}