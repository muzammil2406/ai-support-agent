import { NextResponse } from 'next/server';
import { getVerifiedToken } from '@/lib/auth-server';
import { jwtVerify } from 'jose';

interface TokenPayload {
  sub?: string;
  email?: string;
  role?: string;
  name?: string;
}

export async function GET() {
  const token = await getVerifiedToken();
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify<TokenPayload>(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET ?? ''),
    );
    return NextResponse.json({
      user: {
        id: payload.sub as string,
        email: payload.email,
        name: payload.name ?? payload.email,
        role: payload.role,
      },
    });
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}