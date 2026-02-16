import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const channelId = (process.env.SLACK_CHANNEL_ID || '').trim();
    const botToken = (process.env.SLACK_BOT_TOKEN || '').trim();

    if (!channelId || !botToken) return NextResponse.json({ error: 'Missing Keys.' });

    const stopDateTs = (new Date('2026-02-01T00:00:00').getTime() / 1000).toString();
    
    let addedCount = 0;
    let scannedCount = 0;
    let hasMore = true;
    let cursor = '';
    let loops = 0;

    while (hasMore && loops < 5) {
      loops++;
      
      const slackUrl = new URL('https://slack.com/api/conversations.history');
      slackUrl.searchParams.append('channel', channelId);
      slackUrl.searchParams.append('limit', '100');
      slackUrl.searchParams.append('oldest', stopDateTs);
      
      if (cursor) slackUrl.searchParams.append('cursor', cursor);

      const slackRes = await fetch(slackUrl.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${botToken}` },
        cache: 'no-store'
      });

      const slackData = await slackRes.json();
      if (!slackData.ok) return NextResponse.json({ error: `Slack Error: ${slackData.error}` });
      if (!slackData.messages || slackData.messages.length === 0) break;

      scannedCount += slackData.messages.length;

      for (const msg of slackData.messages) {
        const messageDate = new Date(parseFloat(msg.ts) * 1000).toISOString();

        const { data: existingMsg } = await supabase.from('slack_messages').select('id').eq('slack_ts', msg.ts).single();
        
        let msgId;
        if (existingMsg) {
          msgId = existingMsg.id;
        } else {
          const { data: msgData, error } = await supabase
            .from('slack_messages')
            .insert([{ slack_ts: msg.ts, raw_text: msg.text || '', created_at: messageDate }])
            .select('id').single();
          if (!error && msgData) msgId = msgData.id;
        }

        if (!msg.files || !msgId) continue;

        for (const file of msg.files) {
          if (!file.mimetype?.startsWith('image/') || !file.url_private_download) continue;

          const fileName = `${msg.ts}-${file.name}`;

          const { data: existingPhoto } = await supabase
            .from('photos')
            .select('id')
            .like('image_url', `%${fileName}%`)
            .single();
            
          if (existingPhoto) continue;

          try {
            const fileRes = await fetch(file.url_private_download, {
              headers: { Authorization: `Bearer ${botToken}` },
              cache: 'no-store'
            });
            
            if (!fileRes.ok) continue;

            const arrayBuffer = await fileRes.arrayBuffer();

            await supabase.storage.from('execution-images').upload(fileName, arrayBuffer, { contentType: file.mimetype, upsert: true });
            const { data: publicUrlData } = supabase.storage.from('execution-images').getPublicUrl(fileName);

            await supabase.from('photos').insert([{
              message_id: msgId,
              image_url: publicUrlData.publicUrl,
              status: 'pending',
              created_at: messageDate 
            }]);
            
            addedCount++;
          } catch (e) {
            console.error("File processing failed:", e);
          }
        }
      }

      if (slackData.response_metadata?.next_cursor) {
        cursor = slackData.response_metadata.next_cursor;
      } else {
        hasMore = false;
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: addedCount, 
      scanned: scannedCount,
      hasMore 
    });
  } catch (error: any) {
    return NextResponse.json({ error: `Server Crash: ${error.message}` }, { status: 500 });
  }
}