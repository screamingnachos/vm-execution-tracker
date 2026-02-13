'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Payout mapping based on your rules
const PAYOUTS: any = {
  'Reckitt': 750,
  'Veeba': 250,
  'Ariel + Tide': 1000,
  'Surf Excel': 750,
  'Lotus': 400,
  'Santoor': 400
};

export default function Dashboard() {
  const brands = ['Veeba', 'Reckitt', 'Ariel + Tide', 'Surf Excel', 'Lotus', 'Santoor'];
  const [activeBrand, setActiveBrand] = useState('Veeba');
  const [search, setSearch] = useState('');
  
  const [dbStores, setDbStores] = useState<any[]>([]);
  const [validPhotos, setValidPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    // 1. Fetch all stores
    const { data: stores } = await supabase.from('stores').select('*');
    if (stores) setDbStores(stores);

    // 2. Fetch all 'valid' photos
    const { data: photos } = await supabase
      .from('photos')
      .select('store_id, tagged_brands, created_at')
      .eq('status', 'valid');
    if (photos) setValidPhotos(photos);

    setLoading(false);
  }

  // Helper to determine week of the month (1, 2, 3, or 4) for simple display
  const getWeek = (dateString: string) => {
    const date = new Date(dateString);
    return Math.ceil(date.getDate() / 7); 
  };

  // Process data for the table based on the active brand
  const processedData = dbStores
    .filter(store => {
      // Filter stores eligible for the active brand
      if (activeBrand === 'Ariel + Tide') {
        return store.eligible_brands?.includes('Ariel') || store.eligible_brands?.includes('Tide');
      }
      return store.eligible_brands?.includes(activeBrand);
    })
    .filter(store => store.name.toLowerCase().includes(search.toLowerCase()))
    .map(store => {
      // Find all valid photos for this specific store
      const storePhotos = validPhotos.filter(p => p.store_id === store.id);
      
      let weeklyStatus = { w1: 'missing', w2: 'missing', w3: 'missing', w4: 'missing' };
      let earned = 0;
      let maxEarned = PAYOUTS[activeBrand] * 4; // 4 weeks in a month

      // Check each week (1 to 4)
      for (let i = 1; i <= 4; i++) {
        const photosThisWeek = storePhotos.filter(p => getWeek(p.created_at) === i);
        let isValidForWeek = false;

        if (activeBrand === 'Ariel + Tide') {
          // Special Rule: Needs BOTH Ariel and Tide
          const hasAriel = photosThisWeek.some(p => p.tagged_brands?.includes('Ariel'));
          const hasTide = photosThisWeek.some(p => p.tagged_brands?.includes('Tide'));
          isValidForWeek = hasAriel && hasTide;
        } else {
          // Normal Rule: Needs the active brand
          isValidForWeek = photosThisWeek.some(p => p.tagged_brands?.includes(activeBrand));
        }

        if (isValidForWeek) {
          weeklyStatus[`w${i}` as keyof typeof weeklyStatus] = 'valid';
          earned += PAYOUTS[activeBrand];
        }
      }

      return {
        name: store.name,
        ...weeklyStatus,
        score: `₹${earned} / ₹${maxEarned}`
      };
    });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Tabs & Search */}
      <div className="border-b border-slate-200 p-4 flex justify-between items-center bg-slate-50">
        <div className="flex gap-2 overflow-x-auto">
          {brands.map((brand) => (
            <button
              key={brand}
              onClick={() => setActiveBrand(brand)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                activeBrand === brand 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {brand}
            </button>
          ))}
        </div>

        <div className="relative ml-4">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      {/* Data Grid */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Calculating scores...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                <th className="p-4 font-semibold">Store Name</th>
                <th className="p-4 font-semibold text-center">Week 1</th>
                <th className="p-4 font-semibold text-center">Week 2</th>
                <th className="p-4 font-semibold text-center">Week 3</th>
                <th className="p-4 font-semibold text-center">Week 4</th>
                <th className="p-4 font-semibold text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No stores found for this brand.</td>
                </tr>
              ) : (
                processedData.map((store, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-800">{store.name}</td>
                    <td className="p-4"><div className={`w-6 h-6 mx-auto rounded-full ${store.w1 === 'valid' ? 'bg-green-500' : 'bg-slate-200'}`}></div></td>
                    <td className="p-4"><div className={`w-6 h-6 mx-auto rounded-full ${store.w2 === 'valid' ? 'bg-green-500' : 'bg-slate-200'}`}></div></td>
                    <td className="p-4"><div className={`w-6 h-6 mx-auto rounded-full ${store.w3 === 'valid' ? 'bg-green-500' : 'bg-slate-200'}`}></div></td>
                    <td className="p-4"><div className={`w-6 h-6 mx-auto rounded-full ${store.w4 === 'valid' ? 'bg-green-500' : 'bg-slate-200'}`}></div></td>
                    <td className="p-4 text-right font-bold text-green-700">{store.score}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}