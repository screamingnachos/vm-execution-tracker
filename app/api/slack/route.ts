import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. URL Verification Challenge
    if (body.type === 'url_verification') {
      return new NextResponse(body.challenge, { status: 200 });
    }

    // 2. Validate Event
    if (body.event?.type !== 'message' || !body.event?.files || body.event?.bot_id) {
      return NextResponse.json({ ok: true });
    }

    const { text, ts, files } = body.event;
    const botToken = (process.env.SLACK_BOT_TOKEN || '').trim();
    const messageDate = new Date(parseFloat(ts) * 1000).toISOString();

    // 3. Insert Message
    const { data: msgData, error: msgError } = await supabase
      .from('slack_messages')
      .insert([{ 
        slack_ts: ts, 
        raw_text: text || 'No text attached',
        created_at: messageDate 
      }])
      .select('id').single();

    if (msgError) throw msgError;

    // 4. Process Files
    for (const file of files) {
      if (!file.mimetype?.startsWith('image/')) continue;

      const fileRes = await fetch(file.url_private_download, {
        headers: { Authorization: `Bearer ${botToken}` },
      });

      if (!fileRes.ok) continue;

      const arrayBuffer = await fileRes.arrayBuffer();
      const fileName = `${ts}-${file.name}`;

      await supabase.storage
        .from('execution-images')
        .upload(fileName, arrayBuffer, { contentType: file.mimetype, upsert: true });

      const { data: publicUrlData } = supabase.storage
        .from('execution-images')
        .getPublicUrl(fileName);

      await supabase.from('photos').insert([{
        message_id: msgData.id,
        image_url: publicUrlData.publicUrl,
        status: 'pending',
        created_at: messageDate
      }]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}