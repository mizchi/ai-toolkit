import { streamText } from "npm:ai";
import { createMessenger } from "./messenger.ts";
import type { Runtime, RunnerOptions, StreamOptions } from "./types.ts";
import { handleStreamTextPart } from "../cli/output.ts";

const denoRuntime: Runtime = {
  write: (text: string) => {
    Deno.stdout.write(new TextEncoder().encode(text));
  },
  confirm: confirm,
  prompt: prompt,
};

export async function runTools(
  opts: StreamOptions,
  {
    messenger = createMessenger(),
    debug = false,
    runtime = denoRuntime,
    oneshot = false,
  }: RunnerOptions = {}
): Promise<void> {
  // Set signal handler
  Deno.addSignalListener("SIGINT", async () => {
    try {
      // await messenger.save();
    } finally {
      Deno.exit(0);
    }
  });
  while (true) {
    if (messenger.get().length > 0) {
      const stream = streamText({
        ...opts,
        messages: messenger.get(),
      });
      for await (const part of stream.fullStream) {
        handleStreamTextPart(part, runtime, debug);
      }
      const response = await stream.response;
      await messenger.add(...response.messages);
      runtime.write("\n\n");
    }
    if (oneshot) {
      Deno.exit(0);
    }
    // Next input
    const nextInput = runtime.prompt(">");
    if (nextInput == null || nextInput.trim() === "" || nextInput === "exit") {
      Deno.exit(0);
    }
    messenger.add({
      role: "user",
      content: nextInput,
    });
  }
}
