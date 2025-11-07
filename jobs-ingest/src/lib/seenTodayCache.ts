import * as fs from 'fs';
import * as path from 'path';
import { CanonicalJob } from '../types';

interface SeenTodayData {
  date: string;
  keys: string[];
}

export interface SeenTodayCache {
  date: string;
  keys: Set<string>;
  dirty: boolean;
}

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'seen-today.json');

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadSeenTodayCache(): Promise<SeenTodayCache> {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      await fs.promises.mkdir(CACHE_DIR, { recursive: true });
    }

    if (!fs.existsSync(CACHE_FILE)) {
      return { date: todayString(), keys: new Set<string>(), dirty: false };
    }

    const raw = await fs.promises.readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as SeenTodayData;
    if (!parsed.date || parsed.date !== todayString()) {
      return { date: todayString(), keys: new Set<string>(), dirty: false };
    }
    return { date: parsed.date, keys: new Set(parsed.keys || []), dirty: false };
  } catch (error) {
    console.warn('⚠️  Failed to load seen-today cache:', error instanceof Error ? error.message : String(error));
    return { date: todayString(), keys: new Set<string>(), dirty: false };
  }
}

export async function saveSeenTodayCache(cache: SeenTodayCache): Promise<void> {
  if (!cache.dirty) return;
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      await fs.promises.mkdir(CACHE_DIR, { recursive: true });
    }
    const MAX_KEYS = 50000;
    const keysArray = Array.from(cache.keys);
    const trimmedKeys = keysArray.length > MAX_KEYS ? keysArray.slice(keysArray.length - MAX_KEYS) : keysArray;
    const payload: SeenTodayData = {
      date: cache.date,
      keys: trimmedKeys
    };
    await fs.promises.writeFile(CACHE_FILE, JSON.stringify(payload), 'utf8');
  } catch (error) {
    console.warn('⚠️  Failed to save seen-today cache:', error instanceof Error ? error.message : String(error));
  }
}

function buildSeenKey(job: CanonicalJob): string {
  const hash = job.hash || '';
  const apply = (job.applyUrl || '').split('?')[0].toLowerCase();
  const company = (job.company?.name || '').toLowerCase();
  const title = (job.title || '').toLowerCase();
  return [hash, apply, company, title].filter(Boolean).join('|');
}

export function isJobNewToday(job: CanonicalJob, cache: SeenTodayCache): boolean {
  const key = buildSeenKey(job);
  if (!key) return true;
  if (cache.keys.has(key)) {
    return false;
  }
  cache.keys.add(key);
  cache.dirty = true;
  return true;
}

