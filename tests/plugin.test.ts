import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IAgentRuntime, Memory } from '@elizaos/core';
import plugin, { DesearchService, desearchWebSearchAction as action, searchWeb } from '../src/index.js';

const result = { title: 'Bittensor', link: 'https://example.org', snippet: 'A network' };
const fetchMock = vi.fn();
let service: DesearchService;
let runtime: IAgentRuntime;
const message = { content: { text: 'bittensor' } } as Memory;
beforeEach(() => {
  vi.stubEnv('DESEARCH_API_KEY', 'unit-test-placeholder');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: [result] })));
  service = new DesearchService();
  runtime = { getService: vi.fn(() => service) } as unknown as IAgentRuntime;
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Desearch client', () => {
  it('sends one encoded GET and returns the declared fields', async () => {
    expect(await searchWeb('a & b', 3)).toEqual([result]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.origin + url.pathname).toBe('https://api.desearch.ai/web');
    expect(url.searchParams.get('query')).toBe('a & b');
    expect(url.searchParams.get('num')).toBe('3');
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Authorization: 'Bearer unit-test-placeholder' });
    expect(init.redirect).toBe('error');
  });
  it.each([1, 20])('accepts boundary num %s', async num => {
    expect(await searchWeb('x', num)).toEqual([result]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].searchParams.get('num')).toBe(String(num));
  });
  it('accepts empty results', async () => {
    fetchMock.mockResolvedValue(new Response('{"data":[]}'));
    expect(await searchWeb('x')).toEqual([]);
  });
  it('requires the environment key before making a request', async () => {
    vi.stubEnv('DESEARCH_API_KEY', '');
    await expect(searchWeb('x')).rejects.toThrow('DESEARCH_API_KEY is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, 21, 50, 100, 101, NaN, Infinity])('rejects invalid num %s', async num => {
    await expect(searchWeb('x', num)).rejects.toThrow('num');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects an empty query', async () => {
    await expect(searchWeb('  ')).rejects.toThrow('Query');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not include an HTTP error body in errors or retry', async () => {
    fetchMock.mockResolvedValue(new Response('sensitive body', { status: 401 }));
    await expect(searchWeb('x')).rejects.toThrow(/^Desearch HTTP 401$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('sanitizes network errors', async () => {
    fetchMock.mockRejectedValue(new Error('sensitive transport details'));
    await expect(searchWeb('x')).rejects.toThrow(/^Desearch request failed$/);
  });
  it.each(['no json', '{}', '{"data":[{"title":7}]}'])('rejects malformed response %s', async body => {
    fetchMock.mockResolvedValue(new Response(body));
    await expect(searchWeb('x')).rejects.toThrow('Invalid Desearch');
  });
});

describe('elizaOS integration', () => {
  it('registers the action and service', () => {
    expect(plugin.services).toContain(DesearchService);
    expect(plugin.actions).toContain(action);
    expect(action.name).toBe('DESEARCH_WEB_SEARCH');
  });
  it('declares the supported count in its parameter schema', () => {
    expect(action.parameters).toMatchObject({
      properties: { num: { type: 'integer', minimum: 1, maximum: 20, default: 10 } },
    });
  });
  it.each([21, 50, 100])('rejects unsupported action num %s without a request', async num => {
    expect(await action.handler(runtime, message, undefined, { num })).toMatchObject({ success: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('passes the maximum count through the service', async () => {
    expect(await service.search('x', 20)).toEqual([result]);
    expect(fetchMock.mock.calls[0][0].searchParams.get('num')).toBe('20');
  });
  it('starts and stops the service', async () => {
    expect(await DesearchService.start(runtime)).toBeInstanceOf(DesearchService);
    const stop = vi.spyOn(service, 'stop');
    await DesearchService.stop(runtime);
    expect(stop).toHaveBeenCalledOnce();
    vi.stubEnv('DESEARCH_API_KEY', '');
    await expect(DesearchService.start(runtime)).rejects.toThrow('DESEARCH_API_KEY');
  });
  it('validates readiness using only the environment', async () => {
    expect(await action.validate(runtime, message)).toBe(true);
    vi.stubEnv('DESEARCH_API_KEY', '');
    expect(await action.validate(runtime, message)).toBe(false);
  });
  it('returns structured results and calls the callback', async () => {
    const callback = vi.fn().mockResolvedValue([]);
    const response = await action.handler(runtime, message, undefined, { query: 'custom', num: 2 }, callback);
    expect(response).toMatchObject({ success: true, data: { results: [result] } });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining(result.link) }));
    expect(fetchMock.mock.calls[0][0].searchParams.get('query')).toBe('custom');
  });
  it('falls back to message text and default count', async () => {
    await action.handler(runtime, message);
    expect(fetchMock.mock.calls[0][0].searchParams.get('query')).toBe('bittensor');
    expect(fetchMock.mock.calls[0][0].searchParams.get('num')).toBe('10');
  });
  it('handles missing service and bad parameters', async () => {
    expect(await action.handler(runtime, message, undefined, { num: '2' })).toMatchObject({ success: false });
    runtime.getService = vi.fn(() => null);
    expect(await action.handler(runtime, message)).toMatchObject({ success: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('returns a safe failure on request errors', async () => {
    fetchMock.mockRejectedValue(new Error('private details'));
    expect(await action.handler(runtime, message)).toEqual({ success: false, error: 'Desearch search failed. Check configuration and request parameters.' });
  });
});
