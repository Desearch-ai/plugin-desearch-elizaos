export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.DESEARCH_API_KEY?.trim());
}

/** One API request, with no retries or response-body logging. */
export async function searchWeb(query: string, num = 10): Promise<SearchResult[]> {
  const key = process.env.DESEARCH_API_KEY?.trim();
  if (!key) throw new Error('DESEARCH_API_KEY is required');
  if (typeof query !== 'string' || !query.trim()) throw new Error('Query must be a nonempty string');
  if (!Number.isSafeInteger(num) || num < 1 || num > 20) {
    throw new Error('num must be an integer between 1 and 20');
  }
  const url = new URL('https://api.desearch.ai/web');
  url.searchParams.set('query', query.trim());
  url.searchParams.set('num', String(num));
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
  } catch {
    throw new Error('Desearch request failed');
  }
  if (!response.ok) throw new Error(`Desearch HTTP ${response.status}`);
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error('Invalid Desearch response'); }
  if (!body || typeof body !== 'object' || !('data' in body) || !Array.isArray(body.data)) {
    throw new Error('Invalid Desearch response');
  }
  return body.data.map((item: unknown) => {
    if (!item || typeof item !== 'object' ||
        !('title' in item) || typeof item.title !== 'string' ||
        !('link' in item) || typeof item.link !== 'string' ||
        !('snippet' in item) || typeof item.snippet !== 'string') {
      throw new Error('Invalid Desearch result');
    }
    return { title: item.title, link: item.link, snippet: item.snippet };
  });
}
