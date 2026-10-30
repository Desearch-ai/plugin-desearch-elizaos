# @desearch/plugin-desearch

An elizaOS v1 plugin for web search through the Desearch API. Exports a default `Plugin`, the named `desearchPlugin`, `DesearchService`, `desearchWebSearchAction`, and `searchWeb`.

## Setup

Requires Node.js 22 or newer and `@elizaos/core` 1.7.2 or a compatible v1 release. This package was checked against the npm latest types at version 1.7.2.

```sh
npm install
npm run build
npm test
```

For a published installation, the intended package name is `@desearch/plugin-desearch`. This checkout does not publish the package.

Set `DESEARCH_API_KEY` in the agent process environment using your secret manager or shell. The plugin reads the key only from `process.env.DESEARCH_API_KEY`. Do not put its value in character files, package metadata, or source files. The `agentConfig.pluginParameters.DESEARCH_API_KEY` entry in package.json declares the parameter for tooling; it does not store a value or enable runtime settings lookup.

Register the plugin with an elizaOS project agent:

```ts
import desearchPlugin from '@desearch/plugin-desearch';

export const project = {
  agents: [{
    character: { name: 'Research agent', plugins: [] },
    plugins: [desearchPlugin],
  }],
};
export default project;
```

The runtime starts `DesearchService` under service type `desearch`. `DESEARCH_WEB_SEARCH` accepts handler options `{ query: string, num?: number }`. If query is omitted, it uses the complete incoming message text. The default count is 10; this wrapper accepts integers from 1 to 20. Results are returned as `ActionResult.data.results` and formatted for the optional callback. A missing key or service disables validation.

You can also call `runtime.getService<DesearchService>('desearch')?.search('bittensor', 10)` from a typed integration that imports `DesearchService`.

## API behavior

Each search makes one GET request to `https://api.desearch.ai/web?query=<q>&num=<n>` with an `Authorization: Bearer` header containing the environment key. It reads `{ data: [{ title, link, snippet }] }` and returns those three fields. There are no retries, caches, or additional API calls. Requests time out after 30 seconds and redirects are rejected. HTTP failures and malformed payloads produce sanitized errors. Search results are external content and should be handled as data by the consuming agent.

## Verification

Unit tests mock HTTP and exercise the request, validation, service, action, and failure paths. With the key already present in the environment, run:

```sh
npm run build
npm run --silent live_check
```

The live check makes exactly one search for `bittensor`, then prints only the result count and first title. It exits unsuccessfully without error details if the search fails.

## License

MIT
