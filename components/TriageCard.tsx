/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Store {
  id: string;
  name: string;
}

interface TriageCardProps {
  id: string;
  imageUrl: string;
  rawText: string;
  time: string;
  dbStores: Store[];
  initialStore?: Store | null;
  onComplete: (id: string) => void;
}

export default function TriageCard({ 
  id, 
  imageUrl, 
  rawText, 
  time, 
  dbStores, 
  initialStore, 
  onComplete 
}: TriageCardProps) {
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialStore?.name || '');
  const [selectedStore, setSelectedStore] = useState<Store | null>(initialStore || null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredStores = dbStores.filter(store => 
    store.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateStore = async () => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase
        .from('stores')
        .insert([{ name: searchQuery }])
        .select()
        .single();

      if (error) throw error;
      
      setSelectedStore(data);
      setSearchQuery(data.name);
      setIsDropdownOpen(false);
    } catch (err: any) {
      alert(`Error creating store: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (status === 'approved' && !selectedStore) {
      alert("Please select or add a store before approving.");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('photos')
        .update({ 
          status: status, 
          store_id: selectedStore?.id || null 
        })
        .eq('id', id);

      if (error) throw error;
      
      onComplete(id);
    } catch (err: any) {
      alert(`Error updating task: ${err.message}`);
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row mb-4 transition-all hover:shadow-md">
      
      <div className="w-full md:w-1/3 h-72 bg-slate-100 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 p-2">
        <img 
          src={imageUrl} 
          alt="Execution photo" 
          className="w-full h-full object-contain rounded-lg"
        />
      </div>

      <div className="w-full md:w-2/3 p-6 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Slack Submission</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{time}</span>
          </div>
          
          <p className="text-slate-700 text-lg mb-6 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
            &quot;{rawText}&quot;
          </p>
          
          <div className="mb-6 relative" ref={dropdownRef}>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Mapped Store</label>
            
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
                if (selectedStore && e.target.value !== selectedStore.name) {
                  setSelectedStore(null);
                }
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Search store name..."
              className={`w-full px-4 py-3 text-slate-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                !selectedStore && searchQuery !== '' ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
              }`}
            />

            {isDropdownOpen && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredStores.length === 0 ? (
                  <li className="px-4 py-3 flex justify-between items-center bg-slate-50 border-b border-slate-100">
                    <span className="text-slate-500 text-sm">No stores found.</span>
                    <button 
                      onClick={handleCreateStore}
                      disabled={isUpdating || !searchQuery}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isUpdating ? 'Adding...' : '+ Add Store'}
                    </button>
                  </li>
                ) : (
                  filteredStores.map(store => (
                    <li 
                      key={store.id}
                      onClick={() => {
                        setSelectedStore(store);
                        setSearchQuery(store.name);
                        setIsDropdownOpen(false);
                      }}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                    >
                      {store.name}
                    </li>
                  ))
                )}
              </ul>
            )}
            
            {!selectedStore && searchQuery !== '' && (
              <p className="text-xs text-amber-600 mt-2 font-medium">Please select or add a store.</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button 
            onClick={() => handleAction('approved')}
            disabled={isUpdating || !selectedStore}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold shadow hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Saving...' : 'Approve'}
          </button>
          <button 
            onClick={() => handleAction('rejected')}
            disabled={isUpdating}
            className="flex-1 bg-red-100 text-red-700 py-3 rounded-xl font-bold hover:bg-red-200 transition-all disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}