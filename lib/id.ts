import crypto from 'node:crypto';

const prefixes = new Map<string, number>();

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  const count = (prefixes.get(prefix) ?? 0) + 1;
  prefixes.set(prefix, count);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${prefix}_${String(count).padStart(3, '0')}_${suffix}`;
}

export function summarize(text: string, max = 180) {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max - 3)}...` : compact;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
