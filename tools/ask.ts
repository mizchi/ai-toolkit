import { jsonSchema, tool } from "ai";

export const askTool = tool({
  description: "Ask a question to the user. Call this for user input",
  parameters: jsonSchema<{ question: string }>({
    type: "object",
    properties: {
      question: {
        type: "string",
        describe: "The question to ask the user",
      },
    },
    required: ["question"],
  }),
  async execute({ question }) {
    console.log(`\n%c[ask] ${question}`, "color: green");
    const ret = prompt(">");
    if (ret == null || !ret.trim()) {
      return "NO USER INPUT";
    }
    console.log(`\n%c[response] ${ret}`, "color: gray");
    return ret;
  },
});
