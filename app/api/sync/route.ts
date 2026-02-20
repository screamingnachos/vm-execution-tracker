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

    if (startDate) oldest = `&oldest=${Math.floor(new Date(startDate).getTime() / 1000)}`;
    if (endDate) latest = `&latest=${Math.floor(new Date(endDate).getTime() / 1000) + 86399}`;

    const slackUrl = `https://slack.com/api/conversations.history?channel=${CHANNEL_ID}&limit=50${oldest}${latest}`;

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
            
            // 1. Check if we already synced this exact message timestamp to prevent duplicates
            const msgDate = new Date(parseFloat(msg.ts) * 1000).toISOString();
            const { data: existing } = await supabase
              .from('photos')
              .select('id')
              .eq('created_at', msgDate)
              .limit(1);

            if (!existing || existing.length === 0) {
              
              // 2. Download the secure image from Slack
              const imgRes = await fetch(file.url_private, {
                headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` }
              });
              const imgBuffer = await imgRes.arrayBuffer();

              // 3. Upload to your public Supabase Storage bucket
              const fileName = `slack-${msg.ts}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
              const { error: uploadError } = await supabase.storage.from('execution-images').upload(fileName, imgBuffer, {
                contentType: file.mimetype,
                upsert: true
              });

              if (!uploadError) {
                // 4. Get the permanent public URL
                const { data: publicUrlData } = supabase.storage.from('execution-images').getPublicUrl(fileName);

                // 5. Save the public URL and raw text to the database
                const { error: insertError } = await supabase.from('photos').insert([{
                  image_url: publicUrlData.publicUrl,
                  status: 'pending',
                  created_at: msgDate,
                  raw_text: msg.text || "No text provided"
                }]);

                if (!insertError) importedCount++;
              } else {
                console.error("Supabase Upload Error:", uploadError);
              }
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