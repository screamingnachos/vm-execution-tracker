import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. BULLETPROOF SLACK VERIFICATION
    if (body.type === 'url_verification') {
      // Returning plain text instead of JSON guarantees Slack accepts it
      return new NextResponse(body.challenge, { status: 200 });
    }

    // 2. Ignore messages without files, or messages sent by bots
    if (
      body.event?.type !== 'message' ||
      !body.event?.files ||
      body.event?.bot_id
    ) {
      return NextResponse.json({ ok: true });
    }

    const { text, ts, files } = body.event;

    // 3. Save the main message text to Supabase
    const { data: msgData, error: msgError } = await supabase
      .from('slack_messages')
      .insert([{ slack_ts: ts, raw_text: text || 'No text attached' }])
      .select('id')
      .single();

    if (msgError) throw msgError;

    // 4. Process and download each attached image
    for (const file of files) {
      if (!file.mimetype?.startsWith('image/')) continue;

      const slackImgRes = await fetch(file.url_private_download, {
        headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      });

      const arrayBuffer = await slackImgRes.arrayBuffer();
      const fileName = `${ts}-${file.name}`;

      await supabase.storage
        .from('execution-images')
        .upload(fileName, arrayBuffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      const { data: publicUrlData } = supabase.storage
        .from('execution-images')
        .getPublicUrl(fileName);

      await supabase.from('photos').insert([
        {
          message_id: msgData.id,
          image_url: publicUrlData.publicUrl,
          status: 'pending',
        },
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
