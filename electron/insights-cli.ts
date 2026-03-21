export function buildCliInvocationArgs(
  specArgs: string[],
  cliTool: "claude" | "codex",
  prompt: string,
): string[] {
  const cliArgs =
    cliTool === "claude"
      ? ["-p", prompt]
      : ["exec", "--skip-git-repo-check", prompt];
  return [...specArgs, ...cliArgs];
}
