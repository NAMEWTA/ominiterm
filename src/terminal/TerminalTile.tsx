import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { TerminalData } from "../types";
import { useProjectStore } from "../stores/projectStore";
import { useNotificationStore } from "../stores/notificationStore";

interface Props {
  projectId: string;
  worktreeId: string;
  worktreePath: string;
  terminal: TerminalData;
}

export function TerminalTile({
  projectId,
  worktreeId,
  worktreePath,
  terminal,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const {
    removeTerminal,
    toggleTerminalMinimize,
    updateTerminalPtyId,
    setFocusedTerminal,
  } = useProjectStore();

  const { notify } = useNotificationStore();

  // Initialize xterm and PTY
  useEffect(() => {
    if (!containerRef.current || terminal.minimized) return;

    if (!window.termcanvas) {
      notify("error", "Terminal API not available. Not running in Electron.");
      return;
    }

    const xterm = new Terminal({
      theme: {
        background: "#09090b",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
      },
      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
      fontSize: 13,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef.current);

    requestAnimationFrame(() => fitAddon.fit());

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    let ptyId: number | null = null;

    window.termcanvas.terminal
      .create({ cwd: worktreePath })
      .then((id) => {
        ptyId = id;
        updateTerminalPtyId(projectId, worktreeId, terminal.id, id);

        xterm.onData((data) => {
          window.termcanvas.terminal.input(id, data);
        });

        xterm.onResize(({ cols, rows }) => {
          window.termcanvas.terminal.resize(id, cols, rows);
        });
      })
      .catch((err) => {
        notify("error", `Failed to create PTY for "${terminal.title}": ${err}`);
        xterm.write(
          `\r\n\x1b[31m[Error] Failed to create terminal: ${err}\x1b[0m\r\n`,
        );
      });

    const removeOutput = window.termcanvas.terminal.onOutput(
      (id: number, data: string) => {
        if (id === ptyId) {
          xterm.write(data);
        }
      },
    );

    const removeExit = window.termcanvas.terminal.onExit(
      (id: number, exitCode: number) => {
        if (id === ptyId) {
          xterm.write(
            `\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\r\n`,
          );
          notify(
            exitCode === 0 ? "info" : "warn",
            `Terminal "${terminal.title}" exited with code ${exitCode}.`,
          );
        }
      },
    );

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    cleanupRef.current = () => {
      resizeObserver.disconnect();
      removeOutput();
      removeExit();
      xterm.dispose();
      if (ptyId !== null) {
        window.termcanvas.terminal.destroy(ptyId).catch((err) => {
          console.error(`[TermCanvas] Failed to destroy PTY ${ptyId}:`, err);
        });
      }
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [
    terminal.id,
    terminal.title,
    terminal.minimized,
    projectId,
    worktreeId,
    worktreePath,
    updateTerminalPtyId,
    notify,
  ]);

  const handleClose = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    removeTerminal(projectId, worktreeId, terminal.id);
  }, [projectId, worktreeId, terminal.id, removeTerminal]);

  const typeColor =
    terminal.type === "claude"
      ? "text-orange-400"
      : terminal.type === "codex"
        ? "text-purple-400"
        : "text-zinc-400";

  return (
    <div
      className="rounded border border-zinc-600 bg-zinc-950 overflow-hidden flex flex-col"
      style={{
        width: terminal.size.w,
        height: terminal.minimized ? "auto" : terminal.size.h,
      }}
      onClick={() => setFocusedTerminal(terminal.id)}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-2 py-1 bg-zinc-800 select-none shrink-0">
        <span className={`text-xs font-mono ${typeColor}`}>
          {terminal.type === "shell"
            ? "▸"
            : terminal.type === "claude"
              ? "◆"
              : "◈"}
        </span>
        <span className="text-xs text-zinc-400 truncate flex-1">
          {terminal.title}
        </span>
        <button
          className="text-zinc-500 hover:text-zinc-300 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            toggleTerminalMinimize(projectId, worktreeId, terminal.id);
          }}
        >
          {terminal.minimized ? "□" : "–"}
        </button>
        <button
          className="text-zinc-500 hover:text-red-400 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
        >
          ×
        </button>
      </div>

      {/* Terminal content */}
      {!terminal.minimized && (
        <div ref={containerRef} className="flex-1 min-h-0" />
      )}
    </div>
  );
}
