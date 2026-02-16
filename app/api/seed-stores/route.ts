import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// If your stores.ts is in a different folder, adjust this import path, 
// OR just copy/paste your array directly into the `localStores` variable below.
import { storeNames } from '../../../lib/stores'; // <-- Adjust this path if needed

export async function GET() {
  try {
    // We map over your local file to make sure it matches the database columns
    const storesToInsert = storeNames.map((store: any) => ({
      name: store.name, 
      // Add location: store.location here if you have that column in Supabase
    }));

    // Upsert prevents duplicates. It adds new ones and ignores existing ones.
    const { data, error } = await supabase
      .from('stores')
      .upsert(storesToInsert, { onConflict: 'name' }) 
      .select();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `Successfully uploaded ${storesToInsert.length} stores to Supabase!` 
    });

  } catch (error: any) {
    return NextResponse.json({ error: `Upload Failed: ${error.message}` }, { status: 500 });
  }
}