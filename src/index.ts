import { Service, type Action, type IAgentRuntime, type Plugin } from '@elizaos/core';
import { hasApiKey, searchWeb } from './client.js';
export { searchWeb, type SearchResult } from './client.js';

export class DesearchService extends Service {
  static serviceType = 'desearch';
  capabilityDescription = 'Search web pages using Desearch';

  static async start(runtime: IAgentRuntime): Promise<DesearchService> {
    if (!hasApiKey()) throw new Error('DESEARCH_API_KEY is required');
    return new DesearchService(runtime);
  }

  async stop(): Promise<void> {}

  static async stop(runtime: IAgentRuntime): Promise<void> {
    await runtime.getService<DesearchService>(DesearchService.serviceType)?.stop();
  }

  async search(query: string, num = 10) {
    return searchWeb(query, num);
  }
}

export const desearchWebSearchAction: Action = {
  name: 'DESEARCH_WEB_SEARCH',
  similes: ['SEARCH_WEB_DESEARCH'],
  description: 'Search the web with Desearch. Pass options.query and optional options.num (1 to 20, default 10). Without query, the message text is used.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', minLength: 1 },
      num: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
    },
  },
  examples: [[
    { name: '{{name1}}', content: { text: 'Search the web for bittensor' } },
    { name: '{{name2}}', content: { text: 'I will search for bittensor.', actions: ['DESEARCH_WEB_SEARCH'] } },
  ]],
  validate: async (runtime) => hasApiKey() && Boolean(runtime.getService(DesearchService.serviceType)),
  handler: async (runtime, message, _state, options, callback) => {
    const service = runtime.getService<DesearchService>(DesearchService.serviceType);
    if (!service) return { success: false, error: 'Desearch service is unavailable' };
    const query = options?.query ?? message.content.text;
    const num = options?.num ?? 10;
    if (typeof query !== 'string' || typeof num !== 'number') {
      return { success: false, error: 'Expected a string query and numeric num' };
    }
    let results;
    try {
      results = await service.search(query, num);
    } catch {
      return { success: false, error: 'Desearch search failed. Check configuration and request parameters.' };
    }
    const text = results.length
      ? results.map((r) => `${r.title}\n${r.link}\n${r.snippet}`).join('\n\n')
      : 'No search results found.';
    if (callback) await callback({ text, actions: ['DESEARCH_WEB_SEARCH'] });
    return { success: true, text, data: { results } };
  },
};

export const desearchPlugin: Plugin = {
  name: 'desearch',
  description: 'Web search using the Desearch API',
  actions: [desearchWebSearchAction],
  services: [DesearchService],
};
export default desearchPlugin;
