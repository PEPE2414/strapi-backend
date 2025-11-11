type XHREntry = {
  url: string;
  contentType?: string;
  lastSeen: string;
};

const xhrCache: Map<string, XHREntry[]> = new Map();

export function recordXHREndpoint(boardKey: string, url: string, contentType?: string): void {
  if (!url || !url.startsWith('http')) return;
  const key = boardKey.toLowerCase();
  const existing = xhrCache.get(key) || [];
  const normalisedUrl = url.split('#')[0];

  if (existing.some(entry => entry.url === normalisedUrl)) {
    const entry = existing.find(item => item.url === normalisedUrl)!;
    entry.lastSeen = new Date().toISOString();
    if (contentType && !entry.contentType) {
      entry.contentType = contentType;
    }
    xhrCache.set(key, existing);
    return;
  }

  if (existing.length >= 20) {
    existing.sort((a, b) => a.lastSeen.localeCompare(b.lastSeen));
    existing.shift();
  }

  existing.push({
    url: normalisedUrl,
    contentType,
    lastSeen: new Date().toISOString()
  });

  xhrCache.set(key, existing);
}

export function getXHREndpoints(boardKey: string): string[] {
  const key = boardKey.toLowerCase();
  const entries = xhrCache.get(key) || [];
  return entries
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .map(entry => entry.url);
}


