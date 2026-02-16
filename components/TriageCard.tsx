/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Store {
  id: string;
  name: string;
  eligible_brands?: string[];
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

const MASTER_BRANDS = [
  'Veeba', 
  'Santoor', 
  'Reckitt', 
  'Lotus', 
  'Surf Excel', 
  'Ariel (End Cap) + Tide (Floor Stack)'
];

export default function TriageCard({ 
  id, 
  imageUrl, 
  rawText, 
  time, 
  dbStores, 
  initialStore, 
  onComplete 
}: TriageCardProps) {
  
  const [step, setStep] = useState<'store-select' | 'brand-select'>('store-select');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState(initialStore?.name || '');
  const [selectedStore, setSelectedStore] = useState<Store | null>(initialStore || null);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  
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

  // Rejects the task (keeps it in DB as 'rejected' for reporting)
  const handleReject = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('photos')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;
      onComplete(id);
    } catch (err: any) {
      alert(`Error rejecting task: ${err.message}`);
      setIsUpdating(false);
    }
  };

  // Permanently deletes the task from the database
  const handleDelete = async () => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this photo?");
    if (!confirmDelete) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      onComplete(id); // Instantly removes it from the screen
    } catch (err: any) {
      alert(`Error deleting task: ${err.message}`);
      setIsUpdating(false);
    }
  };

  const handleFinalApprove = async () => {
    if (!selectedBrand) {
      alert("Please select a brand.");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('photos')
        .update({ 
          status: 'approved', 
          store_id: selectedStore?.id || null,
          brand: selectedBrand 
        })
        .eq('id', id);

      if (error) throw error;
      onComplete(id);
    } catch (err: any) {
      alert(`Error saving task: ${err.message}`);
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
        </div>

        {step === 'store-select' ? (
          <>
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
            </div>

            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setStep('brand-select')}
                disabled={!selectedStore}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold shadow hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve & Tag Brand →
              </button>
              <button 
                onClick={handleReject}
                disabled={isUpdating}
                className="flex-1 bg-red-100 text-red-700 py-3 rounded-xl font-bold hover:bg-red-200 transition-all disabled:opacity-50"
              >
                Reject
              </button>
              {/* --- NEW DELETE BUTTON --- */}
              <button 
                onClick={handleDelete}
                disabled={isUpdating}
                title="Permanently delete from database"
                className="px-4 bg-slate-100 text-slate-500 rounded-xl font-bold hover:bg-red-50 hover:text-red-700 transition-all disabled:opacity-50"
              >
                🗑️
              </button>
            </div>
          </>
        ) : (
          <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-bold text-blue-900">Select Brand in Photo</label>
              <button 
                onClick={() => setStep('store-select')} 
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                ← Back to Store
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {MASTER_BRANDS.map(brand => {
                const isSelected = selectedBrand === brand;
                const isEligible = selectedStore?.eligible_brands?.includes(brand); 
                
                return (
                  <button
                    key={brand}
                    onClick={() => setSelectedBrand(brand)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : isEligible 
                          ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' 
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {brand} {isEligible && !isSelected && '✨'}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={handleFinalApprove}
              disabled={isUpdating || !selectedBrand}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Saving to Database...' : 'Confirm & Save Execution'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}