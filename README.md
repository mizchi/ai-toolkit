# @mizchi/ai-toolkit

`chat` CLI for my dev.

```bash
# for embedding
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
export GOOGLE_GENERATIVE_AI_API_KEY=...
$ deno install -Afg jsr:@mizchi/ai-toolkit/cli --name chat
```

## Builtin Tools

- `readFile`
- `writeFile`
- `readUrl`: fetch url and read summary by `@mizchi/readability`
- `storeMemory`: Store document with embedding
- `searchMemory`: Search document in vector store
- `bash`: Run command with user permission

## Usage

```bash
$ chat
Select model
> claude-3-7-sonnet-20250219
  gemini-2.5-pro-exp-03-25
  deepseek-chat
> ...

$ chat -m "deepseek-chat" --oneshot "Hello"
Hello! How can I assist you today? 😊
```

## TODO

- [x] pglite backend
- [x] vector search (by pgvector)
- [ ] Host MCP
- [ ] `node:sqlite` backend
- [ ] memory backend with vector search
- [ ] `cloudflare` backend
- [ ] diff apply tools
- [ ] i18n
- [ ] image generation with `@mizchi/imgcat`
- [ ] Tauri Wrapper

## LICENSE

MIT