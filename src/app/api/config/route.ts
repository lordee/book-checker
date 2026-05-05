import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'library-config.md');

export async function GET() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return NextResponse.json({ code: '', pin: '', geminiApiKey: '' });
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    const codeMatch = content.match(/Membership Code: (.*)/);
    const pinMatch = content.match(/PIN: (.*)/);
    const geminiMatch = content.match(/Gemini API Key: (.*)/);
    
    return NextResponse.json({
      code: codeMatch ? codeMatch[1].trim() : '',
      pin: pinMatch ? pinMatch[1].trim() : '',
      geminiApiKey: geminiMatch ? geminiMatch[1].trim() : ''
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, pin, geminiApiKey } = await req.json();
    const content = `# Library Credentials\n\nMembership Code: ${code}\nPIN: ${pin}\nGemini API Key: ${geminiApiKey || ''}\n`;
    fs.writeFileSync(CONFIG_FILE, content, 'utf8');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
