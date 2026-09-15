import { NextResponse } from 'next/server';
import { getVerifiedToken } from '@/lib/auth-server';

export async function GET() {
  const token = await getVerifiedToken();
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ token });
}