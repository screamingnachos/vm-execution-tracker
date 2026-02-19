/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  rejection_reason?: string | null;
  stores?: { name: string };
}

const getWeekNumber = (dateString: string) => {
  const day = new Date(dateString).getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
};

export default function Dashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('General');
  
  // --- NEW: DATE FILTER STATE ---
  // Defaults to current year and month
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0 = Jan, 1 = Feb...

  const [earningsMap, setEarningsMap] = useState<Record<string, number>>({});
  const [dynamicTabs, setDynamicTabs] = useState<string[]>(['General']);
  
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  
  const [modalPhotos, setModalPhotos] = useState<Photo[]>([]);
  const [modalTitle, setModalTitle] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStore, setModalStore] = useState<Store | null>(null);
  const [modalWeek, setModalWeek] = useState<number | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]); // Re-fetch whenever date changes

  async function fetchData() {
    setLoading(true);
    try {
      const { data: storesData } = await supabase.from('stores').select('*').limit(5000);
      if (storesData) setAllStores(storesData);

      const { data: brandsData } = await supabase.from('brands').select('*');
      if (brandsData) {
        const eMap: Record<string, number> = {};
        brandsData.forEach(b => { eMap[b.name] = b.payout_amount; });
        setEarningsMap(eMap);
        setDynamicTabs(['General', ...brandsData.map(b => b.name)]);
      }

      // --- NEW: DATE RANGE FILTER ---
      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

      const { data: photosData } = await supabase
        .from('photos')
        .select(`id, brand, created_at, status, image_url, rejection_reason, stores ( name )`)
        .in('status', ['approved', 'rejected'])
        .not('brand', 'is', null)
        .gte('created_at', startDate) // Filter start of month
        .lte('created_at', endDate)   // Filter end of month
        .order('created_at', { ascending: false });

      if (photosData) setPhotos(photosData as unknown as Photo[]);
    } catch (err: any) {
      console.error("Dashboard Error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const openModal = (weekPhotos: Photo[], store: Store, weekNum: number) => {
    setModalPhotos(weekPhotos);
    setModalStore(store);
    setModalWeek(weekNum);
    setModalTitle(`${store.name} - Week ${weekNum}`);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (photo: Photo) => {
    const newStatus = photo.status === 'approved' ? 'rejected' : 'approved';
    let reason: string | undefined = undefined;

    if (newStatus === 'rejected') {
      const promptResult = window.prompt("Please enter the reason for rejecting this execution:");
      if (promptResult === null) return;
      reason = promptResult;
    }

    try {
      const { error } = await supabase.from('photos').update({ status: newStatus, rejection_reason: reason || null }).eq('id', photo.id);
      if (error) throw error;

      const updatedPhoto: Photo = { ...photo, status: newStatus as 'approved' | 'rejected', rejection_reason: reason };
      setPhotos(photos.map(p => p.id === photo.id ? updatedPhoto : p));
      setModalPhotos(modalPhotos.map(p => p.id === photo.id ? updatedPhoto : p));
      
    } catch (err: any) { alert(`Error updating status: ${err.message}`); }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this execution photo?")) return;
    try {
      const { error } = await supabase.from('photos').delete().eq('id', photoId);
      if (error) throw error;
      setPhotos(photos.filter(p => p.id !== photoId));
      setModalPhotos(modalPhotos.filter(p => p.id !== photoId));
    } catch (err: any) { alert(`Error deleting photo: ${err.message}`); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modalStore || !modalWeek) return;

    setIsUploading(true);
    try {
      const fileName = `manual-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const { error: uploadError } = await supabase.storage.from('execution-images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('execution-images').getPublicUrl(fileName);

      // IMPORTANT: Use the SELECTED month/year for the manual upload date!
      let fakeDay = 1;
      if (modalWeek === 1) fakeDay = 4;
      else if (modalWeek === 2) fakeDay = 11;
      else if (modalWeek === 3) fakeDay = 18;
      else if (modalWeek === 4) fakeDay = 25;
      
      const targetDate = new Date(selectedYear, selectedMonth, fakeDay, 12, 0, 0).toISOString();

      const { data: newPhotoData, error: dbError } = await supabase
        .from('photos')
        .insert([{
          store_id: modalStore.id,
          brand: activeTab,
          image_url: publicUrlData.publicUrl,
          status: 'approved',
          created_at: targetDate
        }])
        .select(`id, brand, created_at, status, image_url, rejection_reason, stores ( name )`)
        .single();

      if (dbError) throw dbError;

      if (newPhotoData) {
        const parsedPhoto = newPhotoData as unknown as Photo;
        setPhotos(prev => [parsedPhoto, ...prev]);
        setModalPhotos(prev => [...prev, parsedPhoto]);
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- CSV EXPORT ENGINE ---
  const exportToCSV = () => {
    const brandsToExport = dynamicTabs.filter(t => t !== 'General');
    let csvContent = "Store Name,Brand,Week 1,Week 2,Week 3,Week 4,Total Earnings,Max Potential,Payout Status\n";

    brandsToExport.forEach(brand => {
      const eligibleStores = allStores.filter(s => 
        s.eligible_brands?.includes(brand) || ((brand === 'Ariel' || brand === 'Tide') && s.eligible_brands?.includes('Ariel (End Cap) + Tide (Floor Stack)'))
      ).sort((a, b) => a.name.localeCompare(b.name));

      const brandPhotos = photos.filter(p => p.brand?.includes(brand));
      const maxEarning = (earningsMap[brand] || 0) * 4;

      eligibleStores.forEach(store => {
        const storePhotos = brandPhotos.filter(p => p.stores?.name === store.name);
        const weeks: Record<number, Photo[]> = { 1: [], 2: [], 3: [], 4: [] };
        storePhotos.forEach(p => weeks[getWeekNumber(p.created_at)].push(p));

        let totalEarned = 0;
        const weekStatuses: string[] = [];

        [1, 2, 3, 4].forEach(w => {
          if (weeks[w].length === 0) weekStatuses.push('Missed');
          else if (weeks[w].some(p => p.status === 'approved')) {
            totalEarned += earningsMap[brand];
            weekStatuses.push('Approved');
          } else {
            weekStatuses.push('Rejected');
          }
        });

        // Add row to CSV
        const payoutStatus = totalEarned === maxEarning ? "Full Payout" : totalEarned > 0 ? "Partial Payout" : "No Payout";
        const row = `"${store.name}","${brand}",${weekStatuses.join(',')},${totalEarned},${maxEarning},${payoutStatus}`;
        csvContent += row + "\n";
      });
    });

    // Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Payout_Analysis_${selectedYear}_${selectedMonth + 1}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const brandTabs = dynamicTabs.filter(t => t !== 'General');

      brandTabs.forEach((brand, index) => {
        if (index > 0) doc.addPage();
        doc.setFontSize(16); doc.setTextColor(15, 23, 42); doc.text(`Execution Payout: ${brand}`, 14, 22);
        const monthName = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
        doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.text(`Billing Cycle: ${monthName}`, 14, 28);

        const eligibleStores = allStores.filter(s => s.eligible_brands?.includes(brand) || (brand === 'Ariel' || brand === 'Tide' ? s.eligible_brands?.includes('Ariel (End Cap) + Tide (Floor Stack)') : false)).sort((a, b) => a.name.localeCompare(b.name));
        const brandPhotos = photos.filter(p => p.brand?.includes(brand));
        const maxEarning = (earningsMap[brand] || 0) * 4;

        const tableData = eligibleStores.map(store => {
          const storePhotos = brandPhotos.filter(p => p.stores?.name === store.name);
          const weeks: Record<number, Photo[]> = { 1: [], 2: [], 3: [], 4: [] };
          storePhotos.forEach(p => weeks[getWeekNumber(p.created_at)].push(p));

          let totalEarned = 0;
          const rowData = [store.name];

          [1, 2, 3, 4].forEach(w => {
            if (weeks[w].length === 0) rowData.push('-'); 
            else if (weeks[w].some(p => p.status === 'approved')) {
              totalEarned += earningsMap[brand];
              rowData.push('Approved');
            } else rowData.push('Rejected');
          });
          rowData.push(`Rs. ${totalEarned} / ${maxEarning}`);
          return rowData;
        });

        autoTable(doc, { startY: 35, head: [['Store Name', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Total Earnings']], body: tableData, theme: 'grid', headStyles: { fillColor: [37, 99, 235] }, styles: { fontSize: 9 }, alternateRowStyles: { fillColor: [248, 250, 252] } });
      });
      doc.save(`Franchise_Payouts_${selectedYear}_${selectedMonth + 1}.pdf`);
    } catch (err) {
      alert("Error generating PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const renderBrandTable = () => {
    const eligibleStores = allStores.filter(s => 
      s.eligible_brands?.includes(activeTab) || ((activeTab === 'Ariel' || activeTab === 'Tide') && s.eligible_brands?.includes('Ariel (End Cap) + Tide (Floor Stack)'))
    ).sort((a, b) => a.name.localeCompare(b.name));

    const brandPhotos = photos.filter(p => p.brand?.includes(activeTab));
    const maxEarning = (earningsMap[activeTab] || 0) * 4;

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
              <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No stores configured for {activeTab}.</td></tr>
            ) : (
              eligibleStores.map((store) => {
                const storePhotos = brandPhotos.filter(p => p.stores?.name === store.name);
                const weeks: Record<number, Photo[]> = { 1: [], 2: [], 3: [], 4: [] };
                storePhotos.forEach(p => weeks[getWeekNumber(p.created_at)].push(p));

                let totalEarned = 0;

                [1, 2, 3, 4].forEach(w => {
                  if (weeks[w].length > 0 && weeks[w].some(p => p.status === 'approved')) {
                    totalEarned += earningsMap[activeTab];
                  }
                });

                return (
                  <tr key={store.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{store.name}</td>
                    {[1, 2, 3, 4].map(w => {
                      const wPhotos = weeks[w];
                      if (wPhotos.length === 0) {
                        return (
                          <td key={w} className="p-4 text-center">
                            <div 
                              onClick={() => openModal([], store, w)} 
                              className="w-5 h-5 mx-auto rounded-full cursor-pointer transition-transform hover:scale-125 bg-slate-50 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-200" 
                              title="Click to view/add photo"
                            ></div>
                          </td>
                        );
                      }
                      
                      const isSuccess = wPhotos.some(p => p.status === 'approved');
                      const circleColor = isSuccess ? 'bg-green-500 shadow-sm shadow-green-200' : 'bg-red-500 shadow-sm shadow-red-200';
                      
                      return (
                        <td key={w} className="p-4 text-center">
                          <div onClick={() => openModal(wPhotos, store, w)} className={`w-5 h-5 mx-auto rounded-full cursor-pointer transition-transform hover:scale-125 ${circleColor}`} title="Click to view/add photo"></div>
                        </td>
                      );
                    })}
                    <td className="p-4 text-right">
                      <span className={`font-bold ${totalEarned > 0 ? 'text-green-600' : 'text-slate-400'}`}>₹{totalEarned}</span>
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

  const renderGeneralTab = () => {
    const approvedCount = photos.filter(p => p.status === 'approved').length;
    const rejectedCount = photos.filter(p => p.status === 'rejected').length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Approved</h3><p className="text-4xl font-extrabold text-green-600">{approvedCount}</p></div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Rejected</h3><p className="text-4xl font-extrabold text-red-500">{rejectedCount}</p></div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-sm text-white flex flex-col justify-center"><h3 className="text-sm font-bold opacity-70 uppercase tracking-wider mb-2">Processed Executions</h3><p className="text-4xl font-extrabold">{photos.length}</p></div>
      </div>
    );
  };

  if (loading) return <div className="flex flex-col items-center justify-center py-32"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-slate-500 font-medium">Crunching payout data...</p></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        
        {/* MONTH & YEAR PICKER */}
        <div className="flex gap-2">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>

        {/* TABS */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full md:w-auto">
          {dynamicTabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>{tab}</button>
          ))}
        </div>

        {/* EXPORT BUTTONS */}
        <div className="flex gap-2 w-full md:w-auto">
           <button onClick={exportToCSV} className="flex-1 bg-green-600 text-white px-4 py-2.5 text-sm font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
            📄 CSV
          </button>
          <button onClick={exportToPDF} disabled={isExporting} className="flex-1 bg-slate-800 text-white px-4 py-2.5 text-sm font-bold rounded-lg shadow-md hover:bg-slate-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isExporting ? 'Generating...' : '⬇ PDF'}
          </button>
        </div>
      </div>

      {activeTab === 'General' ? renderGeneralTab() : renderBrandTable()}

      {/* MODAL (unchanged logic, just re-rendering) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">{modalTitle}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-600 rounded-full transition-colors font-bold">✕</button>
            </div>

            {isAdmin && (
              <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-600">Manually upload a missed execution:</span>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading ? 'Uploading...' : '+ Add Approved Execution'}
                </button>
              </div>
            )}

            <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
              {modalPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-2xl">📷</div>
                  <p className="font-medium">No executions recorded for this week.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {modalPhotos.map(photo => (
                    <div key={photo.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
                      <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm z-10 ${photo.status === 'approved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {photo.status}
                      </div>
                      <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold bg-slate-900/80 text-white backdrop-blur-sm shadow-sm z-10">
                        {photo.brand}
                      </div>
                      <div className="h-64 bg-slate-900 flex items-center justify-center p-1">
                        <img src={photo.image_url} alt="Execution" className="w-full h-full object-contain" />
                      </div>
                      <div className="p-3 text-xs text-slate-500 font-medium text-center bg-white border-t border-slate-100">
                        Submitted/Logged: {new Date(photo.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}
                      </div>
                      {photo.status === 'rejected' && photo.rejection_reason && (
                        <div className="p-3 bg-red-50 text-red-800 text-xs font-semibold border-t border-red-100 text-center">
                          <span className="font-bold uppercase tracking-wider text-red-500 mr-2">Reason:</span> 
                          {photo.rejection_reason}
                        </div>
                      )}
                      {isAdmin && (
                        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between gap-2">
                          <button 
                            onClick={() => handleDeletePhoto(photo.id)}
                            title="Permanently Delete"
                            className="w-10 h-10 flex items-center justify-center bg-slate-200 text-slate-600 rounded-lg font-bold hover:bg-red-100 hover:text-red-700 transition-colors"
                          >
                            🗑️
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(photo)}
                            className={`flex-1 px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors ${
                              photo.status === 'approved' 
                                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            Change to {photo.status === 'approved' ? 'Rejected' : 'Approved'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}