'use client';

import { useState } from 'react';
import { Check, X, Copy, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function TriageCard({
  id,
  imageUrl,
  rawText,
  time,
  onComplete,
}: any) {
  const [activeTab, setActiveTab] = useState<'default' | 'valid' | 'invalid'>(
    'default'
  );
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brands = [
    'Reckitt',
    'Veeba',
    'Ariel',
    'Tide',
    'Surf Excel',
    'Lotus',
    'Santoor',
  ];
  const reasons = [
    'Too less quantity',
    'It should be a shelf execution',
    'It should be an end cap execution',
    'Do not mix different brand in a single execution',
    'Others',
  ];

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const handleSubmit = async (status: string) => {
    setIsSubmitting(true);

    const updateData: any = { status };
    if (status === 'valid') updateData.tagged_brands = selectedBrands;
    if (status === 'invalid') updateData.rejection_reason = rejectReason;

    // Update the database
    await supabase.from('photos').update(updateData).eq('id', id);

    setIsSubmitting(false);
    onComplete(id); // Removes the card from the UI
  };

  return (
    <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
      {/* Image Section */}
      <div className="w-64 h-64 bg-slate-100 flex-shrink-0">
        <img
          src={imageUrl}
          alt="Execution"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Details & Actions Section */}
      <div className="p-6 flex flex-col justify-between w-full">
        <div>
          <p className="text-sm text-slate-500 mb-1">{time}</p>
          <p className="text-lg font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">
            {rawText}
          </p>
        </div>

        {/* Dynamic Action Area */}
        <div className="mt-4">
          {/* DEFAULT VIEW: The 3 main buttons */}
          {activeTab === 'default' && (
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('valid')}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors"
              >
                <Check size={18} /> Valid
              </button>
              <button
                onClick={() => setActiveTab('invalid')}
                className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-2.5 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors"
              >
                <X size={18} /> Invalid
              </button>
              <button
                onClick={() => handleSubmit('redundant')}
                disabled={isSubmitting}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Copy size={18} /> {isSubmitting ? 'Saving...' : 'Redundant'}
              </button>
            </div>
          )}

          {/* VALID VIEW: Multi-select Brands */}
          {activeTab === 'valid' && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <p className="text-sm font-semibold text-green-800 mb-2">
                Select Brands Present:
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {brands.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      selectedBrands.includes(brand)
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-green-600'
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('default')}
                  className="px-4 py-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmit('valid')}
                  disabled={selectedBrands.length === 0 || isSubmitting}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          )}

          {/* INVALID VIEW: Select Reason */}
          {activeTab === 'invalid' && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <p className="text-sm font-semibold text-red-800 mb-2">
                Select Rejection Reason:
              </p>
              <select
                className="w-full p-2.5 mb-4 border border-red-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                <option value="" disabled>
                  Choose a reason...
                </option>
                {reasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('default')}
                  className="px-4 py-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmit('invalid')}
                  disabled={!rejectReason || isSubmitting}
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
