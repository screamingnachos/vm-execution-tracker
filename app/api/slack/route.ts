import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {// 1. Safely load environment variables inside the function
    const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
    const CHANNEL_ID = process.env.SLACK_CHANNEL_ID; 

    // Safety check so the app doesn't crash if the .env file is missing
    if (!SLACK_BOT_TOKEN || !CHANNEL_ID) {
      return NextResponse.json({ success: false, error: "Missing Slack environment variables in .env.local file." });
    }

    // 2. Read the date filters from the frontend
    const body = await req.json();
    const { startDate, endDate } = body;

    let oldest = '';
    let latest = '';

    // Convert dates to Slack's UNIX timestamp format (seconds)
    if (startDate) {
      oldest = `&oldest=${(new Date(startDate).getTime() / 1000).toString()}`;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      latest = `&latest=${(end.getTime() / 1000).toString()}`;
    }

    // 3. Build the Slack API URL with the date filters
    const slackUrl = `https://slack.com/api/conversations.history?channel=${CHANNEL_ID}&limit=200${oldest}${latest}`;

    const slackRes = await fetch(slackUrl, {
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const slackData = await slackRes.json();

    if (!slackData.ok) {
      return NextResponse.json({ success: false, error: slackData.error });
    }

    const messages = slackData.messages || [];
    let importedCount = 0;

    // 4. Process messages and save to Supabase
    for (const msg of messages) {
      if (msg.files && msg.files.length > 0) {
        for (const file of msg.files) {
          if (file.mimetype?.startsWith('image/')) {
            
            // Check if it already exists to prevent duplicates
            const { data: existing } = await supabase
              .from('photos')
              .select('id')
              .eq('image_url', file.url_private)
              .single();

            if (!existing) {
              const { error } = await supabase.from('photos').insert([{
                image_url: file.url_private,
                status: 'pending',
                created_at: new Date(parseFloat(msg.ts) * 1000).toISOString(),
              }]);

              if (!error) importedCount++;
            }
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: importedCount, 
      scanned: messages.length,
      hasMore: slackData.has_more 
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}