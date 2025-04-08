import type { CoreMessage, streamText } from "npm:ai";
export type { TextStreamPart, Tool, ToolResult, CoreMessage } from "npm:ai";

export type StreamOptions = Parameters<typeof streamText>[0];

/**
 * Messenger is a type that represents a message storage system.
 */
export type Messenger = {
  get: () => CoreMessage[];
  load: () => Promise<CoreMessage[]>;
  reset: () => Promise<void>;
  add: (...messages: CoreMessage[]) => Promise<void>;
  save: () => Promise<void>;
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

export type VectorStore = {
  insert(data: { title?: string; content: string }): Promise<number>;
  query: (
    query: string,
    opts?: {
      threshold?: number;
      limit?: number;
    }
  ) => Promise<MemoryDoc[]>;
};

export type Embedder = {
  embed: (text: string) => Promise<number[]>;
  dimensions: number;
};
