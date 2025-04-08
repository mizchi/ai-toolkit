import type { CoreMessage, streamText } from "npm:ai";
export type { TextStreamPart, Tool, ToolResult, CoreMessage } from "npm:ai";

export type StreamOptions = Parameters<typeof streamText>[0];

/**
 * Messenger is a type that represents a message storage system.
 */
export type Messenger = {
  get: () => CoreMessage[];
  load: (id?: string) => Promise<CoreMessage[]>;
  add: (...messages: CoreMessage[]) => Promise<void>;
};

export type Runtime = {
  write: (message: string) => void;
  prompt(message: string): string | null;
  confirm(message: string): boolean;
};

export type RunnerOptions = {
  messenger?: Messenger;
  debug?: boolean;
  oneshot?: boolean;
  runtime?: Runtime;
};

export type MemoryDoc = {
  id: number;
  similarity: number;
  content: string;
  title?: string;
};

export type Embedder = {
  embed: (text: string) => Promise<number[]>;
  dimensions: number;
};

export type VectorStore = {
  insertMemory: (doc: { title?: string; content: string }) => Promise<void>;
  queryMemory: (
    query: string,
    opts?: {
      threshold?: number;
      limit?: number;
    }
  ) => Promise<MemoryDoc[]>;
};

export type StorageBackend = {
  loadMessages: (id?: string) => Promise<CoreMessage[]>;
  addMessage: (...messages: CoreMessage[]) => Promise<void>;
};

export type MemoryableStorageBackend = StorageBackend & VectorStore;
