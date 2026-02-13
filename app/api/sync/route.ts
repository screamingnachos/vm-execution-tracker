import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST() {
  try {
    const channelId = process.env.SLACK_CHANNEL_ID;
    const oldestTs = (new Date('2026-02-01T00:00:00').getTime() / 1000).toString();

    const slackRes = await fetch(
      `https://slack.com/api/conversations.history?channel=${channelId}&oldest=${oldestTs}&limit=100`,
      { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } }
    );
    const slackData = await slackRes.json();

    if (!slackData.messages) return NextResponse.json({ count: 0 });

    let addedCount = 0;

    for (const msg of slackData.messages) {
      if (!msg.files) continue;

      // Prevent duplicates
      const { data: existing } = await supabase.from('slack_messages').select('id').eq('slack_ts', msg.ts).single();
      if (existing) continue;

      // Insert text message
      const { data: msgData, error: msgError } = await supabase
        .from('slack_messages')
        .insert([{ slack_ts: msg.ts, raw_text: msg.text || 'No text attached' }])
        .select('id').single();

      if (msgError) continue;

      // Process and upload images
      for (const file of msg.files) {
        if (!file.mimetype?.startsWith('image/') || !file.url_private_download) continue;

        const fileRes = await fetch(file.url_private_download, {
          headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
        });
        if (!fileRes.ok) continue;

        const arrayBuffer = await fileRes.arrayBuffer();
        const fileName = `${msg.ts}-${file.name}`;

        await supabase.storage
          .from('execution-images')
          .upload(fileName, arrayBuffer, { contentType: file.mimetype, upsert: true });

        const { data: publicUrlData } = supabase.storage
          .from('execution-images')
          .getPublicUrl(fileName);

        await supabase.from('photos').insert([{
          message_id: msgData.id,
          image_url: publicUrlData.publicUrl,
          status: 'pending'
        }]);
        
        addedCount++;
      }
    }
    return NextResponse.json({ success: true, count: addedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}