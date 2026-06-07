import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'chat-settings.json');

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch {}
  return { chat_enabled: true };
}

function writeSettings(data: object) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data), 'utf8');
  } catch {}
}

export async function GET() {
  const settings = readSettings();
  return NextResponse.json({ enabled: settings.chat_enabled !== false });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { enabled } = await request.json();
  const settings = readSettings();
  settings.chat_enabled = Boolean(enabled);
  writeSettings(settings);
  return NextResponse.json({ enabled: settings.chat_enabled });
}
