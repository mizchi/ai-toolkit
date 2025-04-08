/// utils
export function trimLines(str: string) {
  return str
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}
export function truncate(input: unknown, maxLength: number = 100) {
  if (input == null) {
    return "";
  }
  const str =
    typeof input === "string" ? input : JSON.stringify(input, null, 2);
  return str.length > maxLength ? str.slice(0, maxLength) + "..." : str;
}
