'use client';

import { useState, useEffect } from 'react';
import { Check, X, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getBestStoreMatch } from '../lib/matcher';

// We added dbStores right here in the props
export default function TriageCard({ id, imageUrl, rawText, time, dbStores, onComplete }: any) {
  const [activeTab, setActiveTab] = useState<'default' | 'valid' | 'invalid'>('default');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStore, setSelectedStore] = useState('');

  useEffect(() => {
    const bestMatch = getBestStoreMatch(rawText);
    setSelectedStore(bestMatch);
  }, [rawText]);

  const brands = ['Reckitt', 'Veeba', 'Ariel', 'Tide', 'Surf Excel', 'Lotus', 'Santoor'];
  const reasons = [
    'Too less quantity',
    'It should be a shelf execution',
    'It should be an end cap execution',
    'Do not mix different brand in a single execution',
    'Others'
  ];

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev => 
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };

  const handleSubmit = async (status: string) => {
    setIsSubmitting(true);
    
    // Find the matching store object in the database to get its UUID
    const matchedStore = dbStores?.find((s: any) => s.name === selectedStore);
    
    const updateData: any = { status };
    if (matchedStore) updateData.store_id = matchedStore.id; // Links photo to store
    if (status === 'valid') updateData.tagged_brands = selectedBrands;
    if (status === 'invalid') updateData.rejection_reason = rejectReason;

    await supabase.from('photos').update(updateData).eq('id', id);
    
    setIsSubmitting(false);
    onComplete(id); // Removes the card from the UI
  };

  return (
    <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
      <div className="w-64 h-64 bg-slate-100 flex-shrink-0">
        <img src={imageUrl} alt="Execution" className="w-full h-full object-cover" />
      </div>

      <div className="p-6 flex flex-col justify-between w-full">
        <div>
          <p className="text-sm text-slate-500 mb-1">{time}</p>
          <p className="text-lg font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3">
            {rawText}
          </p>
          
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700 mb-1">Mapped Store (Verify):</label>
            <select 
              className="p-2 border border-slate-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            >
              <option value="">-- Select a Store --</option>
              {/* Uses the real DB stores here */}
              {dbStores?.map((store: any) => (
                <option key={store.id} value={store.name}>{store.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          {activeTab === 'default' && (
            <div className="flex gap-3">
              <button onClick={() => setActiveTab('valid')} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium flex justify-center items-center gap-2">
                <Check size={18} /> Valid
              </button>
              <button onClick={() => setActiveTab('invalid')} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-2.5 rounded-lg font-medium flex justify-center items-center gap-2">
                <X size={18} /> Invalid
              </button>
              <button onClick={() => handleSubmit('redundant')} disabled={isSubmitting} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg font-medium flex justify-center items-center gap-2 disabled:opacity-50">
                <Copy size={18} /> {isSubmitting ? 'Saving...' : 'Redundant'}
              </button>
            </div>
          )}

          {activeTab === 'valid' && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <p className="text-sm font-semibold text-green-800 mb-2">Select Brands Present:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {brands.map(brand => (
                  <button
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${selectedBrands.includes(brand) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-300 hover:border-green-600'}`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActiveTab('default')} className="px-4 py-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button 
                  onClick={() => handleSubmit('valid')} 
                  disabled={selectedBrands.length === 0 || !selectedStore || isSubmitting}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'invalid' && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <p className="text-sm font-semibold text-red-800 mb-2">Select Rejection Reason:</p>
              <select 
                className="w-full p-2.5 mb-4 border border-red-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                <option value="" disabled>Choose a reason...</option>
                {reasons.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setActiveTab('default')} className="px-4 py-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button 
                  onClick={() => handleSubmit('invalid')} 
                  disabled={!rejectReason || !selectedStore || isSubmitting}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-red-700 transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}