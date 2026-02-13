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

    if (!slackData.messages) return NextResponse.json({ error: 'No messages found.' });

    let errors: string[] = [];
    let addedCount = 0;

    for (const msg of slackData.messages) {
      if (!msg.files) continue;

      // 1. Insert message
      const { data: msgData, error: msgError } = await supabase
        .from('slack_messages')
        .insert([{ slack_ts: msg.ts, raw_text: msg.text || 'No text attached' }])
        .select('id').single();

      if (msgError) {
        // If it's a duplicate, we just skip it
        if (msgError.code !== '23505') errors.push(`DB Error: ${msgError.message}`);
        continue;
      }

      // 2. Process files
      for (const file of msg.files) {
        try {
          if (!file.mimetype?.startsWith('image/')) {
            errors.push(`Skipped ${file.name}: Not an image (mimetype: ${file.mimetype})`);
            continue;
          }

          if (!file.url_private_download) {
            errors.push(`Skipped ${file.name}: Slack did not provide a download URL.`);
            continue;
          }

          // Fetch from Slack
          const fileRes = await fetch(file.url_private_download, {
            headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
          });

          if (!fileRes.ok) {
            errors.push(`Slack Download Error for ${file.name}: ${fileRes.status} ${fileRes.statusText}`);
            continue;
          }

          const arrayBuffer = await fileRes.arrayBuffer();
          const fileName = `${msg.ts}-${file.name}`;

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('execution-images')
            .upload(fileName, arrayBuffer, { contentType: file.mimetype, upsert: true });

          if (uploadError) {
            errors.push(`Supabase Storage Error for ${file.name}: ${uploadError.message}`);
            continue;
          }

          const { data: publicUrlData } = supabase.storage
            .from('execution-images')
            .getPublicUrl(fileName);

          // Insert into Photos table
          const { error: photoError } = await supabase.from('photos').insert([{
            message_id: msgData.id,
            image_url: publicUrlData.publicUrl,
            status: 'pending'
          }]);

          if (photoError) {
            errors.push(`Photo DB Error: ${photoError.message}`);
          } else {
            addedCount++;
          }
        } catch (err: any) {
          errors.push(`Crash on ${file.name}: ${err.message}`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: `Processed ${addedCount} photos. Errors encountered:\n${errors.join('\n')}` });
    }

    return NextResponse.json({ success: true, count: addedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}