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

    // FIX 1: Proper Timezone-Safe Date Boundaries
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of the selected day
      oldest = `&oldest=${Math.floor(start.getTime() / 1000)}`;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Very end of the selected day
      latest = `&latest=${Math.floor(end.getTime() / 1000)}`;
    }

    // Increased limit to ensure we don't miss anything in a busy channel
    const slackUrl = `https://slack.com/api/conversations.history?channel=${CHANNEL_ID}&limit=100${oldest}${latest}`;

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
    let skipCount = 0;
    let errors: string[] = [];

    for (const msg of messages) {
      if (msg.files && msg.files.length > 0) {
        for (const file of msg.files) {
          if (file.mimetype?.startsWith('image/')) {
            
            // FIX 2: Bulletproof File Naming
            // Removing periods from msg.ts to keep the URL clean
            const safeFileName = (file.name || 'img').replace(/[^a-zA-Z0-9.]/g, '');
            const fileName = `slack-${msg.ts.replace('.', '')}-${safeFileName}`;

            // FIX 3: Smarter Duplicate Check
            // We now check if the exact generated file name already exists in the image_url column
            const { data: existing } = await supabase
              .from('photos')
              .select('id')
              .ilike('image_url', `%${fileName}%`)
              .limit(1);

            if (!existing || existing.length === 0) {
              
              // Download the secure image from Slack
              const imgRes = await fetch(file.url_private, {
                headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` }
              });
              const imgBuffer = await imgRes.arrayBuffer();

              // Upload to your public Supabase Storage bucket
              const { error: uploadError } = await supabase.storage.from('execution-images').upload(fileName, imgBuffer, {
                contentType: file.mimetype,
                upsert: true
              });

              if (!uploadError) {
                const { data: publicUrlData } = supabase.storage.from('execution-images').getPublicUrl(fileName);

                const { error: insertError } = await supabase.from('photos').insert([{
                  image_url: publicUrlData.publicUrl,
                  status: 'pending',
                  created_at: new Date(parseFloat(msg.ts) * 1000).toISOString(),
                  raw_text: msg.text || "No text provided"
                }]);

                if (!insertError) {
                  importedCount++;
                } else {
                  errors.push(`DB Insert Error for ${fileName}: ${insertError.message}`);
                }
              } else {
                errors.push(`Storage Upload Error for ${fileName}: ${uploadError.message}`);
              }
            } else {
              skipCount++;
            }
          }
        }
      }
    }

    console.log(`Sync complete: ${importedCount} imported, ${skipCount} skipped as duplicates.`);
    if (errors.length > 0) console.error("Sync Errors:", errors);

    return NextResponse.json({ 
      success: true, 
      count: importedCount, 
      scanned: messages.length,
      skipped: skipCount,
      errors: errors
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}