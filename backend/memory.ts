import type { CoreMessage, StorageBackend } from "../core/types.ts";

export function inMemoryBackend(): StorageBackend {
  let _messages: CoreMessage[] = [];
  return {
    async loadMessages() {
      _messages = [];
      return _messages;
    },
    async addMessage(...messages) {
      _messages.push(...messages);
    },
  };
}
