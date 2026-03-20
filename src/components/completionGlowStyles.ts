export type CompletionGlowSide = "left" | "right";

export function getCompletionGlowStyle(side: CompletionGlowSide) {
  return {
    background: `linear-gradient(to ${side === "left" ? "right" : "left"}, var(--completion-glow), transparent)`,
    borderLeft: side === "left" ? "1px solid var(--completion-glow-edge)" : undefined,
    borderRight: side === "right" ? "1px solid var(--completion-glow-edge)" : undefined,
    boxSizing: "border-box" as const,
  };
}
