import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
    const CHANNEL_ID = process.env.SLACK_CHANNEL_ID; 

    if (!SLACK_BOT_TOKEN || !CHANNEL_ID) {
      return NextResponse.json({ success: false, error: "Missing Slack environment variables in .env.local" });
    }

    const body = await req.json();
    const { startDate, endDate } = body;

    let oldest = '';
    let latest = '';

    if (startDate) oldest = `&oldest=${Math.floor(new Date(startDate).getTime() / 1000)}`;
    if (endDate) latest = `&latest=${Math.floor(new Date(endDate).getTime() / 1000) + 86399}`;

    const slackUrl = `https://slack.com/api/conversations.history?channel=${CHANNEL_ID}&limit=200${oldest}${latest}`;

    // --- 1. TEST SLACK FETCH ---
    let slackRes;
    try {
      slackRes = await fetch(slackUrl, {
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (slackError: any) {
      console.error("Slack Network Error:", slackError);
      return NextResponse.json({ success: false, error: `Slack connection failed: ${slackError.message}` });
    }

    const slackData = await slackRes.json();

    if (!slackData.ok) {
      return NextResponse.json({ success: false, error: `Slack API Error: ${slackData.error}` });
    }

    const messages = slackData.messages || [];
    let importedCount = 0;

    // --- 2. TEST SUPABASE FETCH ---
    for (const msg of messages) {
      if (msg.files && msg.files.length > 0) {
        for (const file of msg.files) {
          if (file.mimetype?.startsWith('image/')) {
            
            try {
              const { data: existing, error: selectError } = await supabase
                .from('photos')
                .select('id')
                .eq('image_url', file.url_private)
                .single();

              // Only insert if it doesn't exist
              if (!existing) {
                const { error: insertError } = await supabase.from('photos').insert([{
                  image_url: file.url_private,
                  status: 'pending',
                  created_at: new Date(parseFloat(msg.ts) * 1000).toISOString(),
                  raw_text: msg.text || "No text provided"
                }]);

                if (insertError) throw insertError;
                importedCount++;
              }
            } catch (supaError: any) {
              console.error("Supabase Database Error:", supaError);
              return NextResponse.json({ success: false, error: `Database error: ${supaError.message}` });
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
    console.error("General Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}