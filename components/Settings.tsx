'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Store { id: string; name: string; eligible_brands?: string[]; }
interface Brand { id: string; name: string; payout_amount: number; }

export default function Settings() {
  const [stores, setStores] = useState<Store[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [newStoreName, setNewStoreName] = useState('');
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandName, setBrandName] = useState('');
  const [payout, setPayout] = useState<number>(0);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: sData }, { data: bData }] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('brands').select('*').order('name')
    ]);
    if (sData) setStores(sData);
    if (bData) setBrands(bData);
    setLoading(false);
  }

  // --- STORE LOGIC ---
  const handleAddStore = async () => {
    if (!newStoreName.trim()) return;
    try {
      const { error } = await supabase.from('stores').insert([{ name: newStoreName.trim() }]);
      if (error) throw error;
      setNewStoreName('');
      fetchData();
    } catch (e: any) { alert(`Error: ${e.message}`); }
  };

  // --- CONTEST LOGIC ---
  const openContestEditor = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setBrandName(brand.name);
      setPayout(brand.payout_amount);
      setSelectedStores(stores.filter(s => s.eligible_brands?.includes(brand.name)).map(s => s.id));
    } else {
      // FIX: Set to an empty object instead of null so the modal actually opens!
      setEditingBrand({ id: '', name: '', payout_amount: 0 }); 
      setBrandName('');
      setPayout(0);
      setSelectedStores([]);
    }
  };

  const handleSaveContest = async () => {
    if (!brandName.trim()) return alert("Contest needs a name!");
    setIsSaving(true);
    
    try {
      let savedBrandName = brandName.trim();
      const oldBrandName = editingBrand?.name;
      
      // FIX: Check if it has a real ID. If yes, update. If empty, insert new!
      if (editingBrand?.id) {
        await supabase.from('brands').update({ name: savedBrandName, payout_amount: payout }).eq('id', editingBrand.id);
      } else {
        await supabase.from('brands').insert([{ name: savedBrandName, payout_amount: payout }]);
      }

      for (const store of stores) {
        let currentBrands = store.eligible_brands || [];
        const isSelected = selectedStores.includes(store.id);
        
        if (oldBrandName && oldBrandName !== savedBrandName) {
          currentBrands = currentBrands.filter(b => b !== oldBrandName);
        }

        const hasBrand = currentBrands.includes(savedBrandName);

        if (isSelected && !hasBrand) {
          await supabase.from('stores').update({ eligible_brands: [...currentBrands, savedBrandName] }).eq('id', store.id);
        } else if (!isSelected && hasBrand) {
          await supabase.from('stores').update({ eligible_brands: currentBrands.filter(b => b !== savedBrandName) }).eq('id', store.id);
        }
      }

      alert("Contest and store mappings saved successfully!");
      setEditingBrand(null);
      fetchData();
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- DELETE CONTEST LOGIC ---
  const handleDeleteContest = async (brandId: string, brandNameToDelete: string) => {
    const isConfirmed = window.confirm(`Are you absolutely sure you want to delete the "${brandNameToDelete}" contest? \n\nThis will remove it from all stores and the Dashboard. (Previously approved photos will remain in the database but won't be tracked for payouts).`);
    if (!isConfirmed) return;

    setIsSaving(true);
    try {
      for (const store of stores) {
        if (store.eligible_brands?.includes(brandNameToDelete)) {
          const cleanedBrands = store.eligible_brands.filter(b => b !== brandNameToDelete);
          await supabase.from('stores').update({ eligible_brands: cleanedBrands }).eq('id', store.id);
        }
      }

      const { error } = await supabase.from('brands').delete().eq('id', brandId);
      if (error) throw error;

      alert(`"${brandNameToDelete}" has been successfully deleted.`);
      setEditingBrand(null);
      fetchData();
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center font-medium text-slate-500">Loading settings...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* LEFT: CONTEST MANAGEMENT */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Active Contests</h2>
          <button onClick={() => openContestEditor()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700">+ New Contest</button>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {brands.map(brand => (
            <div key={brand.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="font-bold text-slate-800">{brand.name}</p>
                <p className="text-sm font-medium text-slate-500">Payout: ₹{brand.payout_amount}</p>
              </div>
              <button onClick={() => openContestEditor(brand)} className="text-blue-600 text-sm font-bold hover:underline">Edit & Assign →</button>
            </div>
          ))}
          {brands.length === 0 && <div className="text-center text-slate-400 py-6 italic">No active contests.</div>}
        </div>
      </div>

      {/* RIGHT: EDITOR & STORES */}
      <div className="space-y-8">
        
        {/* CONTEST EDITOR MODAL/FORM */}
        {editingBrand !== null && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-200 bg-blue-50/30">
            <h2 className="text-xl font-bold text-blue-900 mb-4">{editingBrand.id ? 'Edit Contest' : 'Create New Contest'}</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Brand/Contest Name</label>
                <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl" placeholder="e.g. Coca Cola" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Weekly Payout (₹)</label>
                <input type="number" value={payout} onChange={e => setPayout(Number(e.target.value))} className="w-full p-3 border border-slate-300 rounded-xl" />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold text-slate-700">Assign Eligible Stores</label>
                <div className="space-x-2">
                  <button onClick={() => setSelectedStores(stores.map(s => s.id))} className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded hover:bg-blue-200 transition-colors">Select All</button>
                  <button onClick={() => setSelectedStores([])} className="text-xs font-bold text-slate-600 bg-slate-200 px-2 py-1 rounded hover:bg-slate-300 transition-colors">Clear</button>
                </div>
              </div>
              
              <div className="h-64 overflow-y-auto border border-slate-200 rounded-xl bg-white p-3 space-y-2">
                {stores.map(store => (
                  <label key={store.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer border-b border-slate-100 last:border-0">
                    <input 
                      type="checkbox" 
                      checked={selectedStores.includes(store.id)} 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStores([...selectedStores, store.id]);
                        else setSelectedStores(selectedStores.filter(id => id !== store.id));
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="font-medium text-slate-700">{store.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button 
                onClick={handleSaveContest} 
                disabled={isSaving} 
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Syncing...' : 'Save Contest'}
              </button>
              
              {/* DELETE BUTTON (Only shows if editing an existing contest) */}
              {editingBrand.id && (
                <button 
                  onClick={() => handleDeleteContest(editingBrand.id, editingBrand.name)}
                  disabled={isSaving}
                  className="px-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 border border-red-100 transition-colors"
                  title="Delete Contest"
                >
                  🗑️
                </button>
              )}

              <button 
                onClick={() => setEditingBrand(null)} 
                className="px-5 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* QUICK ADD STORE */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Store Database ({stores.length})</h2>
          <div className="flex gap-2">
            <input type="text" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="Store Name..." className="flex-1 p-3 border border-slate-300 rounded-xl" />
            <button onClick={handleAddStore} disabled={!newStoreName.trim()} className="bg-slate-800 text-white px-5 rounded-xl font-bold hover:bg-slate-900 disabled:opacity-50">+ Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}