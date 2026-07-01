import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, sessionError } from '@/lib/auth';
import { readHistoryItems, writeHistoryItems } from '@/server/history-store';
import { HistoryItemSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';

// 部分字段更新：favorited / tags / title 都是可选
const PatchFieldsSchema = z
  .object({
    favorited: z.boolean().optional(),
    tags: z.array(z.string().min(1).max(32)).max(20).optional(),
    title: z.string().max(100).optional(),
  })
  .strict();

type PatchFields = z.infer<typeof PatchFieldsSchema>;

// PATCH /api/history/[taskId] — 增量更新单条（收藏/标签/标题）
// Body: { favorited?, tags?, title? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await getSession(req);
  if (!session) {
    return sessionError();
  }

  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json(
      { success: false, error: { message: '缺少 taskId' } },
      { status: 400 },
    );
  }

  let patch: PatchFields;
  try {
    const body = await req.json();
    const parsed = PatchFieldsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '数据格式不合法', issues: parsed.error.issues } },
        { status: 400 },
      );
    }
    patch = parsed.data;
  } catch (err) {
    console.error('[history.PATCH] parse body failed:', err);
    return NextResponse.json(
      { success: false, error: { message: '请求体解析失败' } },
      { status: 400 },
    );
  }

  try {
    const items = await readHistoryItems(session.username);
    const idx = items.findIndex((it) => it.taskId === taskId);
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: { message: '记录不存在' } },
        { status: 404 },
      );
    }
    const next = { ...items[idx], ...patch, updatedAt: Date.now() };
    items[idx] = next;
    await writeHistoryItems(session.username, items);
    return NextResponse.json({ success: true, data: next });
  } catch (err) {
    console.error('[history.PATCH] write failed:', err);
    return NextResponse.json(
      { success: false, error: { message: '更新失败' } },
      { status: 500 },
    );
  }
}

// DELETE /api/history/[taskId] — 删除单条
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await getSession(req);
  if (!session) {
    return sessionError();
  }

  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json(
      { success: false, error: { message: '缺少 taskId' } },
      { status: 400 },
    );
  }

  try {
    const items = await readHistoryItems(session.username);
    const next = items.filter((it) => it.taskId !== taskId);
    if (next.length === items.length) {
      return NextResponse.json(
        { success: false, error: { message: '记录不存在' } },
        { status: 404 },
      );
    }
    await writeHistoryItems(session.username, next);
    return NextResponse.json({ success: true, data: { taskId } });
  } catch (err) {
    console.error('[history.DELETE] failed:', err);
    return NextResponse.json(
      { success: false, error: { message: '删除失败' } },
      { status: 500 },
    );
  }
}
