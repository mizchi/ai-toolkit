import { jsonSchema, tool } from "npm:ai";
import { extract, toMarkdown } from "npm:@mizchi/readability@0.5.0";

export const readUrlTool = tool({
  description: "Read a URL and extract the text content",
  parameters: jsonSchema<{ url: string }>({
    type: "object",
    properties: {
      url: {
        type: "string",
        describe: "The URL to read",
      },
    },
    required: ["url"],
  }),
  async execute({ url }) {
    const res = await fetch(url).then((res) => res.text());
    const extracted = extract(res);
    return toMarkdown(extracted.root);
  },
});
