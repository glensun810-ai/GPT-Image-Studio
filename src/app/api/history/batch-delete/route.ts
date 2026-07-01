import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, sessionError } from '@/lib/auth';
import { readHistoryItems, writeHistoryItems } from '@/server/history-store';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1).max(200),
});

// POST /api/history/batch-delete — 批量删除
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return sessionError();
  }
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '参数不合法' } },
        { status: 400 },
      );
    }
    const { taskIds } = parsed.data;
    const set = new Set(taskIds);
    const items = await readHistoryItems(session.username);
    const next = items.filter((it) => !set.has(it.taskId));
    await writeHistoryItems(session.username, next);
    return NextResponse.json({ success: true, data: { removed: items.length - next.length } });
  } catch (err) {
    console.error('[history.batch-delete] failed:', err);
    return NextResponse.json(
      { success: false, error: { message: '批量删除失败' } },
      { status: 500 },
    );
  }
}
