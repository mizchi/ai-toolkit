import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { deepseek } from "@ai-sdk/deepseek";

// getModelByName 関数をここに定義
export function loadModelByName<
  T extends
    | Parameters<typeof anthropic>[0]
    | Parameters<typeof google>[0]
    | Parameters<typeof deepseek>[0]
>(model: T, settings?: any) {
  if (model === "claude") {
    return anthropic("claude-3-7-sonnet-20250219", settings);
  }
  if (model === "gemini") {
    return google("gemini-2.5-pro-exp-03-25", settings);
  }
  if (model === "deepseek") {
    return deepseek("deepseek-chat", settings);
  }
  if (model.startsWith("claude-")) {
    return anthropic(model, settings);
  }
  if (model.startsWith("gemini-")) {
    return google(model, settings);
  }
  if (model.startsWith("deepseek-")) {
    return deepseek(model, settings);
  }
  throw new Error(`Model ${model} not supported`);
}
