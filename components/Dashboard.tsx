/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// --- TYPES ---
interface Store {
  id: string;
  name: string;
  eligible_brands?: string[];
}

interface Photo {
  id: string;
  brand: string;
  created_at: string;
  status: 'approved' | 'rejected';
  image_url: string;
  stores?: { name: string };
}

// --- CONSTANTS & PAYOUT RULES ---
const EARNINGS_MAP: Record<string, number> = {
  'Reckitt': 750,
  'Veeba': 250,
  'Ariel (End Cap) + Tide (Floor Stack)': 1000,
  'Surf Excel': 750,
  'Lotus': 400,
  'Santoor': 400
};

const TABS = [
  'General',
  'Veeba',
  'Santoor',
  'Reckitt',
  'Lotus',
  'Surf Excel',
  'Ariel (End Cap) + Tide (Floor Stack)'
];

// --- HELPER FUNCTIONS ---
const getWeekNumber = (dateString: string) => {
  const day = new Date(dateString).getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('General');
  
  // Data States
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  
  // Modal State
  const [modalPhotos, setModalPhotos] = useState<Photo[]>([]);
  const [modalTitle, setModalTitle] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Fetch Master Stores List (Needed to find missing submissions)
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('*')
        .limit(5000);
      
      if (storesError) throw storesError;
      if (storesData) setAllStores(storesData);

      // 2. Fetch Processed Photos
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select(`id, brand, created_at, status, image_url, stores ( name )`)
        .in('status', ['approved', 'rejected'])
        .not('brand', 'is', null)
        .order('created_at', { ascending: false });

      if (photosError) throw photosError;
      if (photosData) setPhotos(photosData as unknown as Photo[]);
      
    } catch (err: any) {
      console.error("Dashboard Error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const openModal = (weekPhotos: Photo[], storeName: string, weekNum: number) => {
    setModalPhotos(weekPhotos);
    setModalTitle(`${storeName} - Week ${weekNum}`);
    setIsModalOpen(true);
  };

  // --- DATA PROCESSING FOR BRAND TABS ---
  const renderBrandTable = () => {
    // 1. Find all stores that are ELIGIBLE for this specific brand
    const eligibleStores = allStores
      .filter(s => s.eligible_brands?.includes(activeTab))
      .sort((a, b) => a.name.localeCompare(b.name)); // Alphabetical order

    // 2. Filter photos for this specific brand
    const brandPhotos = photos.filter(p => p.brand === activeTab);
    
    const maxEarning = (EARNINGS_MAP[activeTab] || 0) * 4;
    const isAriel = activeTab === 'Ariel (End Cap) + Tide (Floor Stack)';

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm tracking-wider uppercase">
              <th className="p-4 font-bold min-w-[250px]">Store Name</th>
              <th className="p-4 font-bold text-center">Week 1<br/><span className="text-xs font-normal text-slate-400">(1st - 7th)</span></th>
              <th className="p-4 font-bold text-center">Week 2<br/><span className="text-xs font-normal text-slate-400">(8th - 14th)</span></th>
              <th className="p-4 font-bold text-center">Week 3<br/><span className="text-xs font-normal text-slate-400">(15th - 21st)</span></th>
              <th className="p-4 font-bold text-center">Week 4<br/><span className="text-xs font-normal text-slate-400">(22nd+)</span></th>
              <th className="p-4 font-bold text-right text-blue-600">Earnings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {eligibleStores.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                  No stores are configured for {activeTab} in your database.
                </td>
              </tr>
            ) : (
              eligibleStores.map((store) => {
                // Get photos belonging to this store
                const storePhotos = brandPhotos.filter(p => p.stores?.name === store.name);
                
                // Group photos by week
                const weeks: Record<number, Photo[]> = { 1: [], 2: [], 3: [], 4: [] };
                storePhotos.forEach(p => {
                  weeks[getWeekNumber(p.created_at)].push(p);
                });

                let totalEarned = 0;

                // Calculate total earnings across the 4 weeks
                [1, 2, 3, 4].forEach(w => {
                  const approvedCount = weeks[w].filter(p => p.status === 'approved').length;
                  if (isAriel) {
                    if (approvedCount >= 2) totalEarned += EARNINGS_MAP[activeTab];
                  } else {
                    if (approvedCount >= 1) totalEarned += EARNINGS_MAP[activeTab];
                  }
                });

                return (
                  <tr key={store.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{store.name}</td>
                    
                    {[1, 2, 3, 4].map(w => {
                      const wPhotos = weeks[w];
                      
                      // Renders an empty, hollow circle if no photos were sent
                      if (wPhotos.length === 0) {
                        return (
                          <td key={w} className="p-4 text-center">
                            <div className="w-5 h-5 mx-auto rounded-full bg-slate-50 border-2 border-slate-200"></div>
                          </td>
                        );
                      }
                      
                      const hasApproved = wPhotos.some(p => p.status === 'approved');
                      const circleColor = hasApproved ? 'bg-green-500 shadow-sm shadow-green-200' : 'bg-red-500 shadow-sm shadow-red-200';

                      return (
                        <td key={w} className="p-4 text-center">
                          <div 
                            onClick={() => openModal(wPhotos, store.name, w)}
                            className={`w-5 h-5 mx-auto rounded-full cursor-pointer transition-transform hover:scale-125 ${circleColor}`}
                            title="Click to view photos"
                          ></div>
                        </td>
                      );
                    })}

                    <td className="p-4 text-right">
                      <span className={`font-bold ${totalEarned > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                        ₹{totalEarned}
                      </span>
                      <span className="text-slate-400 text-sm ml-1 font-medium">/ ₹{maxEarning}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // --- GENERAL TAB VIEW ---
  const renderGeneralTab = () => {
    const approvedCount = photos.filter(p => p.status === 'approved').length;
    const rejectedCount = photos.filter(p => p.status === 'rejected').length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Approved</h3>
          <p className="text-4xl font-extrabold text-green-600">{approvedCount}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Rejected</h3>
          <p className="text-4xl font-extrabold text-red-500">{rejectedCount}</p>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-sm text-white flex flex-col justify-center">
          <h3 className="text-sm font-bold opacity-70 uppercase tracking-wider mb-2">Processed Executions</h3>
          <p className="text-4xl font-extrabold">{photos.length}</p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Crunching payout data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      
      {/* TABS NAVIGATION */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === tab 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* DYNAMIC CONTENT */}
      {activeTab === 'General' ? renderGeneralTab() : renderBrandTable()}

      {/* PHOTO VIEWER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">{modalTitle}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-600 rounded-full transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {modalPhotos.map(photo => (
                  <div key={photo.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
                    
                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm z-10 ${
                      photo.status === 'approved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {photo.status}
                    </div>

                    <div className="h-64 bg-slate-900 flex items-center justify-center p-1">
                      <img 
                        src={photo.image_url} 
                        alt="Execution" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    
                    <div className="p-3 text-xs text-slate-500 font-medium text-center bg-white border-t border-slate-100">
                      Submitted: {new Date(photo.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}