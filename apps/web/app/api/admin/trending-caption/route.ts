import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSetting, upsertSetting } from '@/lib/db/ai-config';

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (session.user.role !== 'admin') return new NextResponse('Forbidden', { status: 403 });

  try {
    const setting = await getSetting('trending_caption');
    return NextResponse.json(setting || null);
  } catch (error) {
    console.error('Error fetching trending caption:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (session.user.role !== 'admin') return new NextResponse('Forbidden', { status: 403 });

  try {
    const { value } = await req.json();
    if (typeof value !== 'string') {
      return new NextResponse('Invalid body: expected string value', { status: 400 });
    }

    const updated = await upsertSetting('trending_caption', value, session.user.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating trending caption:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
