// wip
import { jsonSchema, tool } from "ai";
import $ from "@david/dax";

export const gitStatusTool = tool({
  description: "Get git status",
  parameters: jsonSchema<{ gitRoot: string }>({
    type: "object",
    properties: {
      gitRoot: {
        type: "string",
        describe: "project root path",
      },
    },
    required: ["filepath"],
  }),
  async execute({ gitRoot }) {
    const out = await $`git status`
      .stdout("piped")
      .stderr("piped")
      .cwd(gitRoot);
    return {
      status: out.stdout.trim(),
      stderr: out.stderr.trim(),
      stdout: out.stdout,
    };
  },
});

export const gitProposeCommitMessageTool = tool({
  description: "Propose git commit message to user and run git commit",
  parameters: jsonSchema<{ message: string; files?: string[] }>({
    type: "object",
    properties: {
      message: {
        type: "string",
        describe: "The commit message to propose",
      },
      files: {
        type: "array",
        describe: "Optional: The files to commit",
        items: {
          type: "string",
          describe: "The files to commit",
        },
      },
    },
    required: ["message"],
  }),
  async execute({ message, files }) {
    const result = confirm(
      `Message \n${message}\nAdd files\n${files?.join("\n")}\n\nCommit?`
    );
    if (!result) return "User denied";
    if (files) {
      await $`git add ${files?.join(" ")}`;
    }
    await $`git commit -m ${message}`;
    return `User accepted commit message`;
  },
});
