import path from "node:path";
import { listAgents } from "./store.ts";

export async function list(args: string[]): Promise<void> {
  const repoIdx = args.indexOf("--repo");
  const repo = repoIdx >= 0 ? path.resolve(args[repoIdx + 1]) : undefined;

  const agents = listAgents(repo);

  if (agents.length === 0) {
    console.log("No agents.");
    return;
  }

  for (const a of agents) {
    const branch = a.branch ?? "(existing worktree)";
    console.log(`${a.id}  ${a.type}  ${branch}  ${a.terminalId}  ${a.task.slice(0, 60)}`);
  }
}
