import type { CoreMessage, Messenger } from "./types.ts";

type Backend = {
  load: () => Promise<CoreMessage[]>;
  save: (messages: CoreMessage[]) => Promise<void>;
};

export function inMemoryBackend(): Backend {
  return {
    load: async () => [],
    save: async () => {},
  };
}

export function fsBackend(savePath: string): Backend {
  return {
    load: async () => {
      try {
        const _ = await Deno.stat(savePath);
        const content = await Deno.readTextFile(savePath);
        return JSON.parse(content) as CoreMessage[];
      } catch (_e) {
        return [];
      }
    },
    save: async (messages: CoreMessage[]) => {
      try {
        await Deno.writeTextFile(savePath, JSON.stringify(messages, null, 2));
      } catch (e) {
        console.error("Failed to save messages:", e);
      }
    },
  };
}

export function createMessenger(
  backend: Backend = inMemoryBackend(),
  opts: {
    saveOnChange?: boolean;
  } = {}
): Messenger {
  let _messages: CoreMessage[] = [];
  return {
    get(): CoreMessage[] {
      return Array.from(_messages);
    },
    async load(): Promise<CoreMessage[]> {
      _messages = await backend.load();
      return _messages;
    },
    async reset() {
      _messages.length = 0;
      if (opts.saveOnChange) {
        await backend.save(_messages);
      }
    },
    async add(...messages: CoreMessage[]) {
      _messages.push(...messages);
      if (opts.saveOnChange) {
        await backend.save(_messages);
      }
    },
    async save(): Promise<void> {
      _messages = await backend.load();
    },
  };
}
