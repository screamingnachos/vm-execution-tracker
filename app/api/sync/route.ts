import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  // 1. Get the latest timestamp from your DB
  const { data: lastMsg } = await supabase
    .from('slack_messages')
    .select('slack_ts')
    .order('slack_ts', { ascending: false })
    .limit(1)
    .single();

  const oldestTs = lastMsg ? lastMsg.slack_ts : '0';
  const channelId = process.env.SLACK_CHANNEL_ID!; // Add this to your .env

  // 2. Fetch new messages from Slack
  const slackRes = await fetch(
    `https://slack.com/api/conversations.history?channel=${channelId}&oldest=${oldestTs}`,
    {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    }
  );

  const slackData = await slackRes.json();
  if (!slackData.messages)
    return NextResponse.json({ success: true, count: 0 });

  let addedCount = 0;

  // 3. Process new messages with files
  for (const msg of slackData.messages) {
    if (msg.files) {
      // Insert message to DB
      const { data: newMsg } = await supabase
        .from('slack_messages')
        .insert([{ slack_ts: msg.ts, raw_text: msg.text }])
        .select('id')
        .single();

      // Process and upload images (using the same logic from the webhook step)
      for (const file of msg.files) {
        if (!file.mimetype?.startsWith('image/')) continue;

        // ... (Download from Slack and Upload to Supabase Storage logic goes here) ...

        // Insert into photos table
        await supabase.from('photos').insert([
          {
            message_id: newMsg!.id,
            image_url: 'YOUR_NEW_PUBLIC_URL', // Replace with uploaded URL
            status: 'pending',
          },
        ]);
      }
      addedCount++;
    }
  }

  return NextResponse.json({ success: true, count: addedCount });
}
