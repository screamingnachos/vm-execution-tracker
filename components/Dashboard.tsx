'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

export default function Dashboard() {
  const brands = [
    'Veeba',
    'Reckitt',
    'Ariel + Tide',
    'Surf Excel',
    'Lotus',
    'Santoor',
  ];
  const [activeBrand, setActiveBrand] = useState('Veeba');
  const [search, setSearch] = useState('');

  const dummyStores = [
    {
      name: 'AA Supermarket Rayachoty',
      w1: 'valid',
      w2: 'pending',
      w3: 'missing',
      w4: 'missing',
      score: '₹250 / ₹1000',
    },
    {
      name: 'Gold Supermarket Padarupalli',
      w1: 'valid',
      w2: 'valid',
      w3: 'missing',
      w4: 'missing',
      score: '₹500 / ₹1000',
    },
    {
      name: 'Sri Hari Supermarket',
      w1: 'missing',
      w2: 'missing',
      w3: 'missing',
      w4: 'missing',
      score: '₹0 / ₹1000',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
          <Search
            className="absolute left-3 top-2.5 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
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
            {dummyStores.map((store, i) => (
              <tr
                key={i}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td className="p-4 text-sm font-medium text-slate-800">
                  {store.name}
                </td>
                <td className="p-4 text-center">
                  <div
                    className={`w-8 h-8 mx-auto rounded ${
                      store.w1 === 'valid'
                        ? 'bg-green-500'
                        : store.w1 === 'pending'
                        ? 'bg-yellow-400'
                        : 'bg-slate-200'
                    }`}
                  ></div>
                </td>
                <td className="p-4 text-center">
                  <div
                    className={`w-8 h-8 mx-auto rounded ${
                      store.w2 === 'valid'
                        ? 'bg-green-500'
                        : store.w2 === 'pending'
                        ? 'bg-yellow-400'
                        : 'bg-slate-200'
                    }`}
                  ></div>
                </td>
                <td className="p-4 text-center">
                  <div
                    className={`w-8 h-8 mx-auto rounded ${
                      store.w3 === 'valid'
                        ? 'bg-green-500'
                        : store.w3 === 'pending'
                        ? 'bg-yellow-400'
                        : 'bg-slate-200'
                    }`}
                  ></div>
                </td>
                <td className="p-4 text-center">
                  <div
                    className={`w-8 h-8 mx-auto rounded ${
                      store.w4 === 'valid'
                        ? 'bg-green-500'
                        : store.w4 === 'pending'
                        ? 'bg-yellow-400'
                        : 'bg-slate-200'
                    }`}
                  ></div>
                </td>
                <td className="p-4 text-right font-bold text-green-700">
                  {store.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
