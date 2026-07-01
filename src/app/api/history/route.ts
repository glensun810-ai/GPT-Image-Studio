import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, sessionError } from '@/lib/auth';
import { readHistoryItems, writeHistoryItems } from '@/server/history-store';
import { HistoryItemSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET /api/history — 拉取当前用户的全量历史
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return sessionError();
  }

  try {
    const items = await readHistoryItems(session.username);
    return NextResponse.json({ success: true, data: { items } });
  } catch (err) {
    console.error('[history.GET] failed:', err);
    return NextResponse.json(
      { success: false, error: { message: '读取历史失败' } },
      { status: 500 },
    );
  }
}

const HistoryArraySchema = z.array(HistoryItemSchema).max(2000);

// POST /api/history — 新增一条历史（生成完成时自动调用）
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return sessionError();
  }

  let item;
  try {
    const body = await request.json();
    const parsed = HistoryItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '数据格式不合法', issues: parsed.error.issues } },
        { status: 400 },
      );
    }
    item = parsed.data;
  } catch (err) {
    console.error('[history.POST] parse body failed:', err);
    return NextResponse.json(
      { success: false, error: { message: '请求体解析失败' } },
      { status: 400 },
    );
  }

  try {
    const items = await readHistoryItems(session.username);
    // 同一 taskId 已存在则视为更新
    const idx = items.findIndex((it) => it.taskId === item.taskId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...item, updatedAt: Date.now() };
    } else {
      // 容量限制
      if (items.length >= 2000) {
        return NextResponse.json(
          { success: false, error: { message: '已达历史记录上限（2000 条）' } },
          { status: 413 },
        );
      }
      items.unshift({ ...item, updatedAt: Date.now() });
    }
    await writeHistoryItems(session.username, items);
    return NextResponse.json({ success: true, data: item });
  } catch (err) {
    console.error('[history.POST] write failed:', err);
    return NextResponse.json(
      { success: false, error: { message: '保存失败' } },
      { status: 500 },
    );
  }
}

// PUT /api/history — 整批覆盖（用于一次性 sync）
export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return sessionError();
  }

  try {
    const body = await request.json();
    const parsed = HistoryArraySchema.safeParse(body?.items);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '数据格式不合法', issues: parsed.error.issues } },
        { status: 400 },
      );
    }

    await writeHistoryItems(session.username, parsed.data);
    return NextResponse.json({ success: true, data: { count: parsed.data.length } });
  } catch (err) {
    console.error('[history.PUT] failed:', err);
    return NextResponse.json(
      { success: false, error: { message: '保存历史失败' } },
      { status: 500 },
    );
  }
}

// DELETE /api/history — 清空当前用户历史
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return sessionError();
  }
  try {
    await writeHistoryItems(session.username, []);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[history.DELETE] failed:', err);
    return NextResponse.json(
      { success: false, error: { message: '清空失败' } },
      { status: 500 },
    );
  }
}
