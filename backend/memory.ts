import type { CoreMessage, StorageBackend } from "../core/types.ts";

export function inMemoryBackend(): StorageBackend {
  let _messages: CoreMessage[] = [];
  return {
    async load() {
      _messages = [];
      return _messages;
    },
    async add(...messages) {
      _messages.push(...messages);
    },
  };
}
