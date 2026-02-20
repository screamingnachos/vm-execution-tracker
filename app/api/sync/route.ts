import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
    const CHANNEL_ID = process.env.SLACK_CHANNEL_ID; 

    if (!SLACK_BOT_TOKEN || !CHANNEL_ID) {
      return NextResponse.json({ success: false, error: "Missing Slack environment variables." });
    }

    const body = await req.json();
    const { startDate, endDate } = body;

    let oldest = '';
    let latest = '';

    // Convert dates to strict Slack UNIX timestamps
    if (startDate) {
      oldest = `&oldest=${Math.floor(new Date(startDate).getTime() / 1000)}`;
    }
    if (endDate) {
      // Add 86399 seconds to push it to the very end of the selected day (23:59:59)
      latest = `&latest=${Math.floor(new Date(endDate).getTime() / 1000) + 86399}`;
    }

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

    for (const msg of messages) {
      if (msg.files && msg.files.length > 0) {
        for (const file of msg.files) {
          if (file.mimetype?.startsWith('image/')) {
            
            const { data: existing } = await supabase
              .from('photos')
              .select('id')
              .eq('image_url', file.url_private)
              .single();

            if (!existing) {
              // Now saving the text DIRECTLY into the photos table
              const { error } = await supabase.from('photos').insert([{
                image_url: file.url_private,
                status: 'pending',
                created_at: new Date(parseFloat(msg.ts) * 1000).toISOString(),
                raw_text: msg.text || "No text provided"
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

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}