import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  // 1. Check Environment Variables
  const envCheck = {
    hasSlackToken: !!process.env.SLACK_BOT_TOKEN,
    hasChannelId: !!process.env.SLACK_CHANNEL_ID,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  if (!envCheck.hasSlackToken || !envCheck.hasChannelId || !envCheck.hasSupabaseUrl || !envCheck.hasSupabaseKey) {
    return NextResponse.json({ error: "Missing Environment Variables", details: envCheck });
  }

  // 2. Test Slack Connection
  let slackData;
  try {
    const channelId = process.env.SLACK_CHANNEL_ID;
    const oldestTs = (new Date('2026-02-01T00:00:00').getTime() / 1000).toString();
    const slackUrl = `https://slack.com/api/conversations.history?channel=${channelId}&oldest=${oldestTs}&limit=10`;
    
    const slackRes = await fetch(slackUrl, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    });
    slackData = await slackRes.json();
  } catch (e: any) {
    return NextResponse.json({ error: "Slack Network Request Failed", message: e.message });
  }

  // 3. Test Supabase Connection
  try {
    const { error: sbError } = await supabase.from('stores').select('id').limit(1);
    if (sbError) return NextResponse.json({ error: "Supabase Database Failed", message: sbError.message });
  } catch (e: any) {
    return NextResponse.json({ error: "Supabase Network Request Failed", message: e.message });
  }

  // 4. Success State
  return NextResponse.json({ 
    success: true, 
    message: "Network is working!", 
    slackConnected: slackData.ok,
    slackErrorIfAny: slackData.error || "none"
  });
}