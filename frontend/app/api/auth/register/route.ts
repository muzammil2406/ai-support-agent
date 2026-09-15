import { NextResponse } from 'next/server';
import { backendUrl, setAuthCookie } from '@/lib/auth-server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { message: 'Email and password are required.' },
      { status: 400 },
    );
  }

  const res = await fetch(`${backendUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      name: body.name ?? null,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return NextResponse.json(
      { message: msg ?? 'Registration failed.' },
      { status: res.status },
    );
  }

  setAuthCookie(data.accessToken);
  return NextResponse.json({ user: data.user });
}