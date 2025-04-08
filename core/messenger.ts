import { inMemoryBackend } from "./mod.ts";
import type { CoreMessage, Messenger, StorageBackend } from "./types.ts";

export function createMessenger(
  backend: StorageBackend = inMemoryBackend()
): Messenger {
  let _messages: CoreMessage[] = [];
  return {
    get(): CoreMessage[] {
      return Array.from(_messages);
    },
    async load(id): Promise<CoreMessage[]> {
      _messages = await backend.load(id);
      return _messages;
    },
    async add(...messages: CoreMessage[]) {
      _messages.push(...messages);
      await backend.add(...messages);
    },
  };
}
