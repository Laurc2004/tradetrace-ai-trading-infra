const SECRET_PATTERNS = [
  /QWEN_API_KEY\s*=\s*[^\s]+/gi,
  /PLAYBOOK_API_KEY\s*=\s*[^\s]+/gi,
  /BITGET_API_KEY\s*=\s*[^\s]+/gi,
  /BITGET_SECRET_KEY\s*=\s*[^\s]+/gi,
  /BITGET_PASSPHRASE\s*=\s*[^\s]+/gi,
  /TELEGRAM_BOT_TOKEN\s*=\s*[^\s]+/gi,
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
];

const SECRET_KEYS = new Set([
  'api_key',
  'apikey',
  'apiKey',
  'secret',
  'secretKey',
  'passphrase',
  'token',
  'authorization',
]);

export function redactText(value: string) {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), value);
}

export function redactObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEYS.has(key) ? '[REDACTED]' : redactObject(item),
      ]),
    ) as T;
  }

  if (typeof value === 'string') {
    return redactText(value) as T;
  }

  return value;
}
