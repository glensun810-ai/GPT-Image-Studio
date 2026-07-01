import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Server-side history storage (file-based JSON store).
 *
 * Designed as a single-user local-first store. If you later want multi-user,
 * replace this with a database (e.g. Supabase) keyed on user_id.
 *
 * File layout:
 *   .data/history/{username}.json   →  { version, items: HistoryItem[] }
 *
 * Writes are atomic (write to .tmp then rename).
 */

import type { HistoryItem } from '@/lib/types';

/**
 * 文件结构：{ version, items: HistoryItem[] }
 * 这个类型在文件内部使用，与客户端的 HistoryServerShape 区分。
 */
interface HistoryFileShape {
  version: number;
  items: HistoryItem[];
}

const STORE_DIR = path.resolve(process.cwd(), '.data', 'history');
const STORE_VERSION = 1;

async function ensureStoreDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

function pathFor(username: string): string {
  // 防止路径穿越：只允许 [a-zA-Z0-9_-]
  const safe = username.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(STORE_DIR, `${safe}.json`);
}

async function readRaw(username: string): Promise<HistoryFileShape> {
  await ensureStoreDir();
  const file = pathFor(username);
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as HistoryFileShape;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      return { version: STORE_VERSION, items: [] };
    }
    return { version: STORE_VERSION, items: parsed.items };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { version: STORE_VERSION, items: [] };
    }
    throw err;
  }
}

async function writeRaw(username: string, data: HistoryFileShape): Promise<void> {
  await ensureStoreDir();
  const file = pathFor(username);
  const tmp = `${file}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(tmp, json, 'utf-8');
  await fs.rename(tmp, file);
}

export async function readHistoryItems(username: string): Promise<HistoryItem[]> {
  const raw = await readRaw(username);
  return raw.items;
}

export async function writeHistoryItems(
  username: string,
  items: HistoryItem[],
): Promise<void> {
  await writeRaw(username, { version: STORE_VERSION, items });
}
