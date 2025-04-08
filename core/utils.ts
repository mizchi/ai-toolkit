/// utils
export function trimLines(str: string) {
  return str
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}
export function truncate(input: unknown, length: number = 100) {
  const str =
    typeof input === "string" ? input : JSON.stringify(input, null, 2);
  return str.length > length ? str.slice(0, length) + "..." : str;
}
