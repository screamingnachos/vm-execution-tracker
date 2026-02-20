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
  masterBrands: string[]; // NEW: Receives dynamic brands from the database
  initialStore?: Store | null;
  onComplete: (id: string) => void;
}

const REJECTION_REASONS = [
  "Very less quantity",
  "Other brands present in the same shelf",
  "It should be a shelf execution instead of End Cap Execution",
  "It should be an end cap execution instead of shelf execution",
  "Photo not clear",
  "Other (Type custom reason)"
];

export default function TriageCard({ 
  id, 
  imageUrl, 
  rawText, 
  time, 
  dbStores, 
  masterBrands, // Destructured here
  initialStore, 
  onComplete 
}: TriageCardProps) {
  
  // --- FUZZY AUTO-MAPPING ON LOAD ---
  // We sort stores by length (longest first) so "Aparna Supermarket Nellore" matches before just "Aparna"
  const getInitialMatch = () => {
    if (initialStore) return initialStore;
    if (rawText && dbStores.length > 0) {
      const lowerText = rawText.toLowerCase();
      const sortedStores = [...dbStores].sort((a, b) => b.name.length - a.name.length);
      
      for (const store of sortedStores) {
        // Simple, clean check: does the Slack text contain the store name?
        if (lowerText.includes(store.name.toLowerCase())) {
          return store;
        }
      }
    }
    return null;
  };

  const matchedStore = getInitialMatch();

  // State initialization
  const [step, setStep] = useState<'store-select' | 'brand-select'>('store-select');
  const [pendingAction, setPendingAction] = useState<'approved' | 'rejected'>('approved');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [selectedStore, setSelectedStore] = useState<Store | null>(matchedStore);
  const [searchQuery, setSearchQuery] = useState(matchedStore ? matchedStore.name : '');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  
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
  }, [dbStores, rawText, selectedStore, searchQuery]);

  // FORGIVING DROPDOWN SEARCH
  const filteredStores = dbStores.filter(store => {
    const sName = store.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const qName = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
    return sName.includes(qName);
  });
  const handleCreateStore = async () => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.from('stores').insert([{ name: searchQuery }]).select().single();
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

  const handleDelete = async () => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this photo?");
    if (!confirmDelete) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('photos').delete().eq('id', id);
      if (error) throw error;
      onComplete(id);
    } catch (err: any) {
      alert(`Error deleting task: ${err.message}`);
      setIsUpdating(false);
    }
  };

  const toggleBrand = (brand: string) => {
    if (selectedBrands.includes(brand)) {
      setSelectedBrands(selectedBrands.filter(b => b !== brand));
    } else {
      setSelectedBrands([...selectedBrands, brand]);
    }
  };

  const handleFinalSave = async () => {
    if (selectedBrands.length === 0) return alert("Please select at least one brand.");

    let finalReason = null;
    if (pendingAction === 'rejected') {
      if (!rejectionReason) return alert("Please select a reason for rejection.");
      if (rejectionReason === "Other (Type custom reason)" && !customReason.trim()) return alert("Please type out your custom rejection reason.");
      finalReason = rejectionReason === "Other (Type custom reason)" ? customReason.trim() : rejectionReason;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('photos')
        .update({ 
          status: pendingAction,
          store_id: selectedStore?.id || null,
          brand: selectedBrands.join(', '), 
          rejection_reason: finalReason
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
        <img src={imageUrl} alt="Execution photo" className="w-full h-full object-contain rounded-lg" />
      </div>

      <div className="w-full md:w-2/3 p-6 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Slack Submission</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{time}</span>
          </div>
          <p className="text-slate-700 text-lg mb-6 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">&quot;{rawText}&quot;</p>
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
                  if (selectedStore && e.target.value !== selectedStore.name) setSelectedStore(null);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Search store name..."
                className={`w-full px-4 py-3 text-slate-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${!selectedStore && searchQuery !== '' ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
              />
              {isDropdownOpen && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredStores.length === 0 ? (
                    <li className="px-4 py-3 flex justify-between items-center bg-slate-50 border-b border-slate-100">
                      <span className="text-slate-500 text-sm">No stores found.</span>
                      <button onClick={handleCreateStore} disabled={isUpdating || !searchQuery} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50">+ Add Store</button>
                    </li>
                  ) : (
                    filteredStores.map(store => (
                      <li key={store.id} onClick={() => { setSelectedStore(store); setSearchQuery(store.name); setIsDropdownOpen(false); }} className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 transition-colors border-b border-slate-50 last:border-0">{store.name}</li>
                    ))
                  )}
                </ul>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => { setPendingAction('approved'); setStep('brand-select'); }} disabled={!selectedStore} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold shadow hover:bg-green-700 transition-all disabled:opacity-50">Approve & Tag →</button>
              <button onClick={() => { setPendingAction('rejected'); setStep('brand-select'); }} disabled={!selectedStore} className="flex-1 bg-red-100 text-red-700 py-3 rounded-xl font-bold hover:bg-red-200 transition-all disabled:opacity-50">Reject & Tag →</button>
              <button onClick={handleDelete} disabled={isUpdating} title="Permanently delete from database" className="px-4 bg-slate-100 text-slate-500 rounded-xl font-bold hover:bg-red-50 hover:text-red-700 transition-all disabled:opacity-50">🗑️</button>
            </div>
          </>
        ) : (
          <div className={`p-5 rounded-xl border ${pendingAction === 'approved' ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
            <div className="flex justify-between items-center mb-3">
              <label className={`block text-sm font-bold ${pendingAction === 'approved' ? 'text-blue-900' : 'text-red-900'}`}>Tag Brands (Select multiple if needed)</label>
              <button onClick={() => setStep('store-select')} className={`text-xs font-semibold ${pendingAction === 'approved' ? 'text-blue-600 hover:text-blue-800' : 'text-red-600 hover:text-red-800'}`}>← Back</button>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {/* NOW USING DYNAMIC MASTER BRANDS */}
              {masterBrands.map(brand => {
                const isSelected = selectedBrands.includes(brand);
                
                // Fallback for older configurations in the DB
                let isEligible = selectedStore?.eligible_brands?.includes(brand);
                if ((brand === 'Ariel' || brand === 'Tide') && selectedStore?.eligible_brands?.includes('Ariel (End Cap) + Tide (Floor Stack)')) {
                  isEligible = true;
                }
                
                let selectedStyle = 'bg-blue-600 text-white border-blue-600 shadow-sm';
                if (pendingAction === 'rejected') selectedStyle = 'bg-red-600 text-white border-red-600 shadow-sm';

                return (
                  <button
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      isSelected ? selectedStyle : isEligible ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {brand} {isEligible && !isSelected && '✨'}
                  </button>
                );
              })}
            </div>

            {pendingAction === 'rejected' && (
              <div className="mb-5 animate-in fade-in duration-200">
                <label className="block text-sm font-bold text-red-900 mb-2">Reason for Rejection <span className="text-red-500">*</span></label>
                <select value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="w-full px-4 py-3 text-slate-900 border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none bg-white mb-3">
                  <option value="" disabled>-- Select a reason --</option>
                  {REJECTION_REASONS.map(reason => (<option key={reason} value={reason}>{reason}</option>))}
                </select>
                {rejectionReason === "Other (Type custom reason)" && (
                  <input type="text" value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Type the exact reason here..." className="w-full px-4 py-3 text-slate-900 border border-red-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"/>
                )}
              </div>
            )}

            <button onClick={handleFinalSave} disabled={isUpdating || selectedBrands.length === 0} className={`w-full text-white py-3 rounded-xl font-bold shadow transition-all disabled:opacity-50 mt-2 ${pendingAction === 'approved' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {isUpdating ? 'Saving...' : `Confirm & ${pendingAction === 'approved' ? 'Approve' : 'Reject'} Execution`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}