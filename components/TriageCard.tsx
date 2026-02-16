'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// --- TYPES ---
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
  
  // Custom Dropdown State
  const [searchQuery, setSearchQuery] = useState(initialStore?.name || '');
  const [selectedStore, setSelectedStore] = useState<Store | null>(initialStore || null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown if clicked outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter stores based on what you type
  const filteredStores = dbStores.filter(store => 
    store.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (status === 'approved' && !selectedStore) {
      alert("Please select a store before approving.");
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
      
      onComplete(id); // Removes card from screen instantly
    } catch (err: any) {
      alert(`Error updating task: ${err.message}`);
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row mb-4 transition-all hover:shadow-md">
      
      {/* 1. THE IMAGE FIX: object-contain prevents cropping */}
      <div className="w-full md:w-1/3 h-72 bg-slate-100 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 p-2">
        <img 
          src={imageUrl} 
          alt="Execution photo" 
          className="w-full h-full object-contain rounded-lg"
        />
      </div>

      {/* 2. CARD CONTENT */}
      <div className="w-full md:w-2/3 p-6 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Slack Submission</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{time}</span>
          </div>
          
          <p className="text-slate-700 text-lg mb-6 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
            "{rawText}"
          </p>
          
          {/* 3. SEARCHABLE CUSTOM DROPDOWN */}
          <div className="mb-6 relative" ref={dropdownRef}>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Mapped Store</label>
            
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
                // If they change the text, un-select the current store until they click a new one
                if (selectedStore && e.target.value !== selectedStore.name) {
                  setSelectedStore(null);
                }
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Search store name..."
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                !selectedStore && searchQuery !== '' ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
              }`}
            />

            {/* Dropdown Options List */}
            {isDropdownOpen && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredStores.length === 0 ? (
                  <li className="px-4 py-3 text-slate-500 text-sm">No stores found.</li>
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
            
            {/* Warning if they typed a name but didn't select from the list */}
            {!selectedStore && searchQuery !== '' && (
              <p className="text-xs text-amber-600 mt-2 font-medium">Please select a store from the dropdown list.</p>
            )}
          </div>
        </div>

        {/* 4. ACTION BUTTONS */}
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