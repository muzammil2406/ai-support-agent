import { NextRequest, NextResponse } from 'next/server';
import { backendUrl, getVerifiedToken } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const PASS_THROUGH_HEADERS = ['content-type', 'accept', 'accept-language'];

async function proxy(req: NextRequest, path: string[]) {
  const token = await getVerifiedToken();
  const target = `${backendUrl()}/api/${path.join('/')}${req.nextUrl.search}`;

  const headers: Record<string, string> = {};
  for (const [key, value] of Array.from(req.headers.entries() as IterableIterator<[string, string]>)) {
    if (PASS_THROUGH_HEADERS.includes(key.toLowerCase())) headers[key] = value;
  }
  if (token) headers['authorization'] = `Bearer ${token}`;

  const noBody = req.method === 'GET' || req.method === 'HEAD';
  const res = await fetch(target, {
    method: req.method,
    headers,
    body: noBody ? undefined : req.body,
  });

  const body = await res.arrayBuffer();
  const outHeaders: Record<string, string> = {};
  const contentType = res.headers.get('content-type');
  if (contentType) outHeaders['content-type'] = contentType;

  return new NextResponse(body, { status: res.status, headers: outHeaders });
}

export const GET = (req: NextRequest, ctx: { params: { path: string[] } }) =>
  proxy(req, ctx.params.path);
export const POST = (req: NextRequest, ctx: { params: { path: string[] } }) =>
  proxy(req, ctx.params.path);
export const PUT = (req: NextRequest, ctx: { params: { path: string[] } }) =>
  proxy(req, ctx.params.path);
export const DELETE = (req: NextRequest, ctx: { params: { path: string[] } }) =>
  proxy(req, ctx.params.path);
export const PATCH = (req: NextRequest, ctx: { params: { path: string[] } }) =>
  proxy(req, ctx.params.path);