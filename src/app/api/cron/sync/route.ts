import { NextResponse } from 'next/server';
import { handleSync } from './handler';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Route GET /api/cron/sync
 */
export async function GET(request: Request): Promise<NextResponse> {
  return handleSync(request);
}

/**
 * Route POST /api/cron/sync
 */
export async function POST(request: Request): Promise<NextResponse> {
  return handleSync(request);
}
