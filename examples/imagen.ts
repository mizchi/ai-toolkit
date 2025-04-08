/**
 * Usage
 * $ deno run imagen.ts --prompt "Santa Claus driving a Cadillac"
 * $ deno run imagen.ts --file prompt.txt
 * $ deno run imagen.ts --file prompt.txt --out out.png
 */
import { experimental_generateImage as generateImage, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { printImageFromBase64 } from "@mizchi/imgcat";
import { parseArgs } from "node:util";
import path from "node:path";

const helpText = `
Usage: deno run imagen.ts --prompt "Santa Claus driving a Cadillac"

Options:
  -f, --file <file>       The file containing the prompt
  -p, --prompt <prompt>   The prompt to generate the image
  -o, --out <out>         The output file path
      --aspect-ratio <aspectRatio>
      --seed <seed>       The seed for random generation
Examples:
  $ deno run imagen.ts --prompt "Santa Claus driving a Cadillac"
  $ deno run imagen.ts --file prompt.txt
  $ deno run imagen.ts --file prompt.txt --out out.png

`.trim();

async function run() {
  const parsed = parseArgs({
    allowPositionals: true,
    options: {
      help: {
        type: "boolean",
        short: "h",
      },
      file: {
        type: "string",
        short: "f",
      },
      prompt: {
        type: "string",
        short: "p",
      },
      aspectRatio: {
        type: "string",
      },
      // size: {
      //   type: "string",
      // },
      seed: {
        type: "string",
      },
      out: {
        type: "string",
        short: "o",
      },
    },
  });
  if (parsed.values.help || Deno.args.length === 0) {
    console.log(helpText);
    Deno.exit(0);
  }

  let prompt = parsed.values.prompt;
  if (parsed.values.file) {
    const file = path.join(Deno.cwd(), parsed.values.file);
    prompt = await Deno.readTextFile(file);
  }
  if (!prompt) {
    console.error("Please specify a prompt");
    Deno.exit(1);
  }

  const { image } = await generateImage({
    model: openai.image("dall-e-3"),
    prompt: prompt,
    // not supported?
    // size: parsed.values.size as `${number}x${number}` | undefined,
    aspectRatio: parsed.values.aspectRatio as `${number}:${number}` | undefined,
    seed: parsed.values.seed ? Number(parsed.values.seed) : undefined,
  });
  if (parsed.values.out) {
    const out = path.join(Deno.cwd(), parsed.values.out);
    if (image.mimeType === "image/png") {
      const pngBinary = new Uint8Array(image.uint8Array);
      await Deno.writeFile(out, pngBinary, { create: true });
      console.log(`Saved to ${out}`);
    } else {
      console.error("Unsupported mime type", image.mimeType);
    }
  }
  printImageFromBase64(image.base64);
}
await run();
