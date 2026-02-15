import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// Force Vercel to treat this as dynamic so it doesn't cache old results
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // 1. Sanitize Keys
    const channelId = (process.env.SLACK_CHANNEL_ID || '').trim();
    const botToken = (process.env.SLACK_BOT_TOKEN || '').trim();

    if (!channelId || !botToken) {
      return NextResponse.json({ error: 'Missing SLACK_CHANNEL_ID or SLACK_BOT_TOKEN in environment variables.' });
    }

    // 2. Build URL safely
    const oldestTs = (new Date('2026-02-01T00:00:00').getTime() / 1000).toString();
    const slackUrl = new URL('https://slack.com/api/conversations.history');
    slackUrl.searchParams.append('channel', channelId);
    slackUrl.searchParams.append('oldest', oldestTs);
    //slackUrl.searchParams.append('limit', '300'); // Small batch to prevent timeout

    // 3. Fetch History
    const slackRes = await fetch(slackUrl.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${botToken}` },
      cache: 'no-store' // Critical for Vercel
    });

    if (!slackRes.ok) return NextResponse.json({ error: `Slack API Error: ${slackRes.status} ${slackRes.statusText}` });
    
    const slackData = await slackRes.json();
    if (!slackData.ok) return NextResponse.json({ error: `Slack Error: ${slackData.error}` });
    if (!slackData.messages) return NextResponse.json({ count: 0 });

    let addedCount = 0;

    for (const msg of slackData.messages) {
      if (!msg.files) continue;

      // 4. Convert Timestamp to Real Date
      const messageDate = new Date(parseFloat(msg.ts) * 1000).toISOString();

      // Check Duplicates
      const { data: existing } = await supabase.from('slack_messages').select('id').eq('slack_ts', msg.ts).single();
      if (existing) continue;

      // Insert Message
      const { data: msgData, error: msgError } = await supabase
        .from('slack_messages')
        .insert([{ 
          slack_ts: msg.ts, 
          raw_text: msg.text || '', 
          created_at: messageDate 
        }])
        .select('id').single();

      if (msgError) continue;

      // 5. Process Files
      for (const file of msg.files) {
        if (!file.mimetype?.startsWith('image/') || !file.url_private_download) continue;

        try {
          const fileRes = await fetch(file.url_private_download, {
            headers: { Authorization: `Bearer ${botToken}` },
            cache: 'no-store'
          });
          
          if (!fileRes.ok) continue;

          const arrayBuffer = await fileRes.arrayBuffer();
          const fileName = `${msg.ts}-${file.name}`;

          // Upload to Storage
          await supabase.storage.from('execution-images').upload(fileName, arrayBuffer, { contentType: file.mimetype, upsert: true });
          
          const { data: publicUrlData } = supabase.storage.from('execution-images').getPublicUrl(fileName);

          // Insert Photo Record
          await supabase.from('photos').insert([{
            message_id: msgData.id,
            image_url: publicUrlData.publicUrl,
            status: 'pending',
            created_at: messageDate // Ensures date matches the message
          }]);
          
          addedCount++;
        } catch (e) {
          console.error("File processing failed:", e);
        }
      }
    }

    return NextResponse.json({ success: true, count: addedCount });
  } catch (error: any) {
    // Return specific error details
    const reason = error.cause ? JSON.stringify(error.cause) : error.message;
    return NextResponse.json({ error: `Server Crash: ${reason}` }, { status: 500 });
  }
}