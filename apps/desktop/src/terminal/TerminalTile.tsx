import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SerializeAddon } from "@xterm/addon-serialize";
import { ImageAddon } from "@xterm/addon-image";
import type { TerminalData, TerminalType } from "../types";
import { useProjectStore } from "../stores/projectStore";
import { useNotificationStore } from "../stores/notificationStore";
import { registerTerminal, unregisterTerminal } from "./terminalRegistry";
import { useThemeStore, XTERM_THEMES } from "../stores/themeStore";
import { usePreferencesStore } from "../stores/preferencesStore";
import { useT } from "../i18n/useT";
import {
  getComposerAdapter,
} from "./cliConfig";
import { buildFontFamily } from "./fontRegistry";
import { getTerminalDisplayTitle } from "../stores/terminalState";
import {
  cancelScheduledTerminalFocus,
  scheduleTerminalFocus,
} from "./focusScheduler";
import {
  acquireWebGL,
  releaseWebGL,
  touch as touchWebGL,
} from "./webglContextPool";
import { buildTerminalCreateRequest } from "./terminalLaunchRequest";
import {
  CREATABLE_TERMINAL_TYPES,
} from "../components/projectBoardOptions";

type TerminalTileMode = "board" | "detail";

interface Props {
  projectId: string;
  worktreeId: string;
  worktreeName: string;
  worktreePath: string;
  terminal: TerminalData;
  mode: TerminalTileMode;
  className?: string;
  boardMinHeight?: number;
  onOpenDetail?: () => void;
  onBack?: () => void;
  onSplitHorizontal?: (type: TerminalType) => void;
  onSplitVertical?: (type: TerminalType) => void;
}

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  shell: { color: "#888", label: "Shell" },
  claude: { color: "#f5a623", label: "Claude" },
  codex: { color: "#7928ca", label: "Codex" },
  copilot: { color: "#5b9ef5", label: "Copilot CLI" },
  kimi: { color: "#0070f3", label: "Kimi" },
  gemini: { color: "#4285f4", label: "Gemini" },
  opencode: { color: "#50e3c2", label: "OpenCode" },
  lazygit: { color: "#e84d31", label: "Lazygit" },
  tmux: { color: "#1bb91f", label: "Tmux" },
};

const SESSION_CAPTURE_TYPES = new Set(["claude", "codex", "kimi"]);

// Split menu button component with dropdown for terminal type selection
function SplitMenuButton({
  direction,
  onSelect,
}: {
  direction: "horizontal" | "vertical";
  onSelect?: (type: TerminalType) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const title = direction === "horizontal" ? "Split Right" : "Split Down";

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="rounded-md p-1 text-[var(--text-faint)] transition-colors duration-150 hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
        title={title}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(!open);
        }}
      >
        {direction === "horizontal" ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <rect x="7" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="10" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <rect x="1" y="7" width="10" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[100px] rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] py-1 shadow-lg">
          {CREATABLE_TERMINAL_TYPES.map((type) => (
            <button
              key={type}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--border)]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onSelect?.(type);
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: TYPE_CONFIG[type]?.color || "#888" }}
              />
              {TYPE_CONFIG[type]?.label || type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

async function pollSessionId(
  ptyId: number,
  cliType: string,
  worktreePath: string,
  onFound: (sid: string) => void,
  shouldCancel: () => boolean,
) {
  const maxAttempts = 45;
  const interval = 2000;

  let cachedPid: number | null = null;
  if (cliType === "claude") {
    cachedPid = (await window.ominiterm.terminal.getPid(ptyId)) ?? null;
  }

  let codexBaseline: string | null = null;
  if (cliType === "codex") {
    codexBaseline = await window.ominiterm.session.getCodexLatest();
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    if (shouldCancel()) {
      return;
    }

    let sid: string | null = null;
    if (cliType === "codex") {
      sid = await window.ominiterm.session.getCodexLatest();
      if (sid && sid === codexBaseline) {
        // Baseline can be stale, but Codex may also continue the same session.
        // Keep filtering it at first and accept as fallback on the final attempt.
        sid = attempt < maxAttempts - 1 ? null : sid;
      }
    } else if (cliType === "claude") {
      const pid =
        cachedPid ??
        (await window.ominiterm.terminal.getPid(ptyId)) ??
        null;
      if (pid) {
        sid = await window.ominiterm.session.getClaudeByPid(pid);
      }
    } else if (cliType === "kimi") {
      sid = await window.ominiterm.session.getKimiLatest(worktreePath);
    }

    if (sid) {
      onFound(sid);
      return;
    }
  }

  return "timeout";
}

export function TerminalTile({
  projectId,
  worktreeId,
  worktreeName,
  worktreePath,
  terminal,
  mode,
  className = "",
  boardMinHeight,
  onOpenDetail,
  onBack,
  onSplitHorizontal,
  onSplitVertical,
}: Props) {
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [isEditingCustomTitle, setIsEditingCustomTitle] = useState(false);
  const [customTitleDraft, setCustomTitleDraft] = useState(
    terminal.customTitle ?? "",
  );
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayTitleRef = useRef(getTerminalDisplayTitle(terminal));
  const containerRef = useRef<HTMLDivElement>(null);
  const customTitleInputRef = useRef<HTMLInputElement>(null);
  const pendingFocusFrameRef = useRef<number | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const sessionCancelRef = useRef<(() => void) | null>(null);

  const {
    removeTerminal,
    toggleTerminalStarred,
    updateTerminalCustomTitle,
    updateTerminalPtyId,
    updateTerminalStatus,
    updateTerminalSessionId,
    updateTerminalScrollback,
    setFocusedTerminal,
  } = useProjectStore();
  const { notify } = useNotificationStore();
  const composerEnabled = usePreferencesStore((state) => state.composerEnabled);
  const t = useT();
  const config = TYPE_CONFIG[terminal.type] ?? {
    color: "#888",
    label: terminal.type,
  };

  useEffect(() => {
    displayTitleRef.current = getTerminalDisplayTitle(terminal);
  }, [terminal.title, terminal.customTitle]);

  useEffect(() => {
    if (!isEditingCustomTitle) {
      setCustomTitleDraft(terminal.customTitle ?? "");
    }
  }, [isEditingCustomTitle, terminal.customTitle]);

  const saveCustomTitleEdit = useCallback(() => {
    updateTerminalCustomTitle(
      projectId,
      worktreeId,
      terminal.id,
      customTitleDraft,
    );
    setIsEditingCustomTitle(false);
  }, [
    customTitleDraft,
    projectId,
    terminal.id,
    updateTerminalCustomTitle,
    worktreeId,
  ]);

  useEffect(() => {
    if (!isEditingCustomTitle) {
      return;
    }
    requestAnimationFrame(() => {
      customTitleInputRef.current?.focus();
      customTitleInputRef.current?.select();
    });
  }, [isEditingCustomTitle]);

  const focusXterm = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  const scheduleXtermFocus = useCallback(() => {
    scheduleTerminalFocus(focusXterm, pendingFocusFrameRef);
  }, [focusXterm]);

  useEffect(() => {
    if (!containerRef.current || !window.ominiterm) {
      return;
    }

    const initialTerminalType = terminal.type;
    const initialSessionId = terminal.sessionId;
    const initialPtyId = terminal.ptyId;
    const initialAutoApprove = terminal.autoApprove;
    const initialPrompt = terminal.initialPrompt;
    const initialScrollback = terminal.scrollback;

    const xterm = new Terminal({
      theme: XTERM_THEMES[useThemeStore.getState().theme],
      fontFamily: buildFontFamily(
        usePreferencesStore.getState().terminalFontFamily,
      ),
      fontSize: usePreferencesStore.getState().terminalFontSize,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,
      scrollback: 5000,
      minimumContrastRatio:
        usePreferencesStore.getState().minimumContrastRatio,
      allowTransparency: false,
    });
    const isWindows = window.ominiterm.app.platform === "win32";
    const fitAddon = new FitAddon();
    const serializeAddon = new SerializeAddon();
    let fitAddonLoaded = false;
    let fitRecoveryAttempts = 0;
    let fitRecoveryActive = false;
    let fitRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
    let fitRecoveryFrame: number | null = null;

    const clearFitRecovery = () => {
      fitRecoveryActive = false;
      if (fitRecoveryTimer) {
        clearTimeout(fitRecoveryTimer);
        fitRecoveryTimer = null;
      }
      if (fitRecoveryFrame) {
        cancelAnimationFrame(fitRecoveryFrame);
        fitRecoveryFrame = null;
      }
    };

    const ensureFitAddonLoaded = (): boolean => {
      if (fitAddonLoaded) {
        return true;
      }
      try {
        xterm.loadAddon(fitAddon);
        fitAddonLoaded = true;
        fitAddonRef.current = fitAddon;
        return true;
      } catch {
        return false;
      }
    };

    const tryFit = (): boolean => {
      if (!ensureFitAddonLoaded()) {
        return false;
      }
      const container = containerRef.current;
      if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) {
        return false;
      }
      let dimensions:
        | { css?: { cell?: { width?: number; height?: number } } }
        | undefined;
      try {
        dimensions = (xterm as any)?._core?._renderService?.dimensions;
      } catch {
        return false;
      }
      if (!dimensions?.css?.cell?.width || !dimensions?.css?.cell?.height) {
        return false;
      }
      try {
        fitAddon.fit();
        return true;
      } catch {
        return false;
      }
    };

    const scheduleFitRecovery = () => {
      if (!isWindows || fitRecoveryActive) {
        return;
      }
      fitRecoveryActive = true;
      fitRecoveryAttempts = 0;

      const step = () => {
        fitRecoveryFrame = null;
        if (!fitRecoveryActive) {
          return;
        }
        fitRecoveryAttempts += 1;

        if (tryFit()) {
          if (xterm.rows > 0) {
            xterm.refresh(0, xterm.rows - 1);
          }
          if (ptyIdRef.current !== null && xterm.cols > 0 && xterm.rows > 0) {
            window.ominiterm.terminal.resize(ptyIdRef.current, xterm.cols, xterm.rows);
          }
          clearFitRecovery();
          return;
        }

        if (fitRecoveryAttempts >= 80) {
          clearFitRecovery();
          return;
        }

        fitRecoveryTimer = setTimeout(() => {
          fitRecoveryTimer = null;
          fitRecoveryFrame = requestAnimationFrame(step);
        }, 100);
      };

      fitRecoveryFrame = requestAnimationFrame(step);
    };

    if (!isWindows) {
      xterm.loadAddon(fitAddon);
      fitAddonLoaded = true;
      fitAddonRef.current = fitAddon;
    }
    xterm.loadAddon(serializeAddon);
    xterm.open(containerRef.current);
    acquireWebGL(terminal.id, xterm);

    try {
      xterm.loadAddon(new ImageAddon());
    } catch {
      // ignore
    }

    const selectionDisposable = xterm.onSelectionChange(() => {
      const text = xterm.getSelection();
      if (!text) {
        return;
      }
      navigator.clipboard.writeText(text);
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      setShowCopiedToast(true);
      copiedTimerRef.current = setTimeout(() => setShowCopiedToast(false), 1500);
    });

    if (initialScrollback) {
      xterm.write(initialScrollback);
    }

    const syncPtySize = () => {
      if (ptyIdRef.current !== null && xterm.cols > 0 && xterm.rows > 0) {
        window.ominiterm.terminal.resize(ptyIdRef.current, xterm.cols, xterm.rows);
      }
    };

    const fitToContainer = (): boolean => {
      if (tryFit()) {
        if (xterm.rows > 0) {
          xterm.refresh(0, xterm.rows - 1);
        }
        syncPtySize();
        return true;
      }
      return false;
    };

    let pendingFitFrame: number | null = null;
    const queueFit = () => {
      if (pendingFitFrame !== null) {
        cancelAnimationFrame(pendingFitFrame);
      }
      pendingFitFrame = requestAnimationFrame(() => {
        pendingFitFrame = null;
        if (!fitToContainer() && isWindows) {
          scheduleFitRecovery();
        }
      });
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => queueFit());
      resizeObserver.observe(containerRef.current);
    }

    const handleWindowResize = () => queueFit();
    window.addEventListener("resize", handleWindowResize);

    queueFit();

    xtermRef.current = xterm;
    if (!isWindows) {
      fitAddonRef.current = fitAddon;
    }
    registerTerminal(terminal.id, xterm, serializeAddon);

    let inputDisposable: { dispose(): void } | null = null;
    let resizeDisposable: { dispose(): void } | null = null;
    let outputCleanup: (() => void) | null = null;
    let exitCleanup: (() => void) | null = null;
    let turnCompleteCleanup: (() => void) | null = null;
    let waitingTimer: ReturnType<typeof setTimeout> | null = null;
    let currentStatus = terminal.status;

    const attachWatch = (sessionId: string | undefined) => {
      if (
        !sessionId ||
        !SESSION_CAPTURE_TYPES.has(initialTerminalType)
      ) {
        return;
      }
      void window.ominiterm.session.watch(initialTerminalType, sessionId, worktreePath);
    };

    const attachPty = (
      ptyId: number,
      options: { shouldCaptureSession: boolean; resumeSessionId?: string },
    ) => {
      let sawOutput = false;
      ptyIdRef.current = ptyId;
      inputDisposable?.dispose();
      resizeDisposable?.dispose();
      outputCleanup?.();
      exitCleanup?.();
      turnCompleteCleanup?.();

      inputDisposable = xterm.onData((data) => {
        window.ominiterm.terminal.input(ptyId, data);
      });
      resizeDisposable = xterm.onResize(({ cols, rows }) => {
        window.ominiterm.terminal.resize(ptyId, cols, rows);
      });
      if (!tryFit() && isWindows) {
        scheduleFitRecovery();
      }
      if (xterm.cols > 0 && xterm.rows > 0) {
        window.ominiterm.terminal.resize(ptyId, xterm.cols, xterm.rows);
      }

      outputCleanup = window.ominiterm.terminal.onOutput((id, data) => {
        if (id !== ptyId) {
          return;
        }
        sawOutput = true;
        xterm.write(data);
        if (currentStatus !== "active") {
          currentStatus = "active";
          updateTerminalStatus(projectId, worktreeId, terminal.id, "active");
        }
        if (waitingTimer) {
          clearTimeout(waitingTimer);
        }
        waitingTimer = setTimeout(() => {
          if (currentStatus === "active") {
            currentStatus = "waiting";
            updateTerminalStatus(projectId, worktreeId, terminal.id, "waiting");
          }
        }, 15000);
      });

      exitCleanup = window.ominiterm.terminal.onExit((id, exitCode) => {
        if (id !== ptyId) {
          return;
        }
        if (waitingTimer) {
          clearTimeout(waitingTimer);
        }
        sessionCancelRef.current?.();
        sessionCancelRef.current = null;
        ptyIdRef.current = null;
        updateTerminalPtyId(projectId, worktreeId, terminal.id, null);
        xterm.write(t.process_exited(exitCode));
        updateTerminalStatus(
          projectId,
          worktreeId,
          terminal.id,
          exitCode === 0 ? "success" : "error",
        );
      });

      turnCompleteCleanup = window.ominiterm.session.onTurnComplete((sessionId) => {
        const state = useProjectStore.getState();
        const project = state.projects.find((candidate) => candidate.id === projectId);
        const worktree = project?.worktrees.find((candidate) => candidate.id === worktreeId);
        const currentTerminal = worktree?.terminals.find(
          (candidate) => candidate.id === terminal.id,
        );
        if (currentTerminal?.sessionId === sessionId) {
          updateTerminalStatus(projectId, worktreeId, terminal.id, "completed");
        }
      });

      attachWatch(options.resumeSessionId);

      if (options.shouldCaptureSession) {
        let cancelled = false;
        sessionCancelRef.current = () => {
          cancelled = true;
        };
        void pollSessionId(
          ptyId,
          initialTerminalType,
          worktreePath,
          (sid) => {
            updateTerminalSessionId(projectId, worktreeId, terminal.id, sid);
            attachWatch(sid);
          },
          () => cancelled,
        ).then((result) => {
          sessionCancelRef.current = null;
          const state = useProjectStore.getState();
          const project = state.projects.find((candidate) => candidate.id === projectId);
          const worktree = project?.worktrees.find((candidate) => candidate.id === worktreeId);
          const currentTerminal = worktree?.terminals.find(
            (candidate) => candidate.id === terminal.id,
          );
          const hasSession = Boolean(currentTerminal?.sessionId);
          const stillAttached = ptyIdRef.current === ptyId;
          if (
            !cancelled &&
            result === "timeout" &&
            stillAttached &&
            sawOutput &&
            !hasSession
          ) {
            notify(
              "warn",
              `Session capture timeout for ${displayTitleRef.current}`,
            );
          }
        });
      }
    };

    if (initialPtyId !== null) {
      attachPty(initialPtyId, {
        shouldCaptureSession: false,
        resumeSessionId: initialSessionId,
      });
    } else {
      const cliOverride =
        usePreferencesStore.getState().cliCommands[initialTerminalType] ?? undefined;
      const options = buildTerminalCreateRequest({
        terminal: {
          ...terminal,
          type: initialTerminalType,
          sessionId: initialSessionId,
          autoApprove: initialAutoApprove,
          initialPrompt,
        },
        worktreePath,
        theme: useThemeStore.getState().theme,
        cliOverride,
      });

      void window.ominiterm.terminal
        .create(options)
        .then((result) => {
          const { ptyId, fallback } = result;
          updateTerminalPtyId(projectId, worktreeId, terminal.id, ptyId);
          updateTerminalStatus(projectId, worktreeId, terminal.id, "running");
          
          // Notify user if we fell back to default shell
          if (fallback) {
            notify(
              "warn",
              `"${fallback.requestedShell}" not found, using ${fallback.actualShell}`,
            );
          }
          
          attachPty(ptyId, {
            shouldCaptureSession:
              !initialSessionId && SESSION_CAPTURE_TYPES.has(initialTerminalType),
            resumeSessionId: initialSessionId,
          });
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          notify("error", t.failed_create_pty(displayTitleRef.current, message));
          updateTerminalStatus(projectId, worktreeId, terminal.id, "error");
        });
    }

    cleanupRef.current = () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      if (waitingTimer) {
        clearTimeout(waitingTimer);
      }
      sessionCancelRef.current?.();
      sessionCancelRef.current = null;
      clearFitRecovery();
      if (pendingFitFrame !== null) {
        cancelAnimationFrame(pendingFitFrame);
        pendingFitFrame = null;
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      updateTerminalScrollback(
        projectId,
        worktreeId,
        terminal.id,
        serializeAddon.serialize() || undefined,
      );
      inputDisposable?.dispose();
      resizeDisposable?.dispose();
      outputCleanup?.();
      exitCleanup?.();
      turnCompleteCleanup?.();
      selectionDisposable.dispose();
      unregisterTerminal(terminal.id);
      releaseWebGL(terminal.id);
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [
    notify,
    projectId,
    terminal.id,
    updateTerminalPtyId,
    updateTerminalScrollback,
    updateTerminalSessionId,
    updateTerminalStatus,
    worktreeId,
    worktreePath,
  ]);

  useEffect(() => {
    if (!xtermRef.current || !fitAddonRef.current) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const xterm = xtermRef.current;
      const fitAddon = fitAddonRef.current;
      const container = containerRef.current;
      if (!xterm || !fitAddon || !container) {
        return;
      }
      if (container.clientWidth <= 0 || container.clientHeight <= 0) {
        return;
      }
      let dimensions:
        | { css?: { cell?: { width?: number; height?: number } } }
        | undefined;
      try {
        dimensions = (xterm as any)?._core?._renderService?.dimensions;
      } catch {
        return;
      }
      if (!dimensions?.css?.cell?.width || !dimensions?.css?.cell?.height) {
        return;
      }
      try {
        fitAddon.fit();
      } catch {
        // Ignore transient fit failures while xterm renderer is initializing.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, className]);

  useEffect(() => {
    const adapter = getComposerAdapter(terminal.type);
    const shouldFocusXterm =
      terminal.focused && (!adapter || !composerEnabled);
    if (terminal.focused) {
      touchWebGL(terminal.id);
    }
    if (shouldFocusXterm) {
      scheduleTerminalFocus(focusXterm, pendingFocusFrameRef);
    } else {
      cancelScheduledTerminalFocus(pendingFocusFrameRef);
    }
  }, [composerEnabled, focusXterm, terminal.focused, terminal.id, terminal.type]);

  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent).detail === terminal.id) {
        scheduleXtermFocus();
      }
    };
    window.addEventListener("ominiterm:focus-xterm", handler);
    return () => window.removeEventListener("ominiterm:focus-xterm", handler);
  }, [scheduleXtermFocus, terminal.id]);

  useEffect(() => {
    const unsubscribe = useThemeStore.subscribe((state) => {
      const xterm = xtermRef.current;
      if (!xterm) {
        return;
      }
      xterm.options.theme = XTERM_THEMES[state.theme];
      xterm.refresh(0, xterm.rows - 1);
      if (ptyIdRef.current !== null) {
        window.ominiterm.terminal.notifyThemeChanged(ptyIdRef.current);
      }
    });
    return unsubscribe;
  }, []);

  const handleFocus = useCallback(() => {
    setFocusedTerminal(terminal.id);
  }, [setFocusedTerminal, terminal.id]);

  const handleClose = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    removeTerminal(projectId, worktreeId, terminal.id);
  }, [projectId, removeTerminal, terminal.id, worktreeId]);

  return (
    <div
      className={`terminal-tile relative flex min-h-0 flex-col overflow-hidden border bg-[var(--surface)] ${
        mode === "detail" ? "h-full rounded-xl" : "h-full rounded-sm"
      } ${
        terminal.focused
          ? "border-[var(--accent)] shadow-[0_0_0_1px_rgba(91,158,245,0.32),0_8px_24px_rgba(0,0,0,0.2)]"
          : "border-[var(--border)] hover:border-[var(--border-hover)]"
      } ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        handleFocus();
      }}
      onWheel={(event) => {
        if (!event.ctrlKey) event.stopPropagation();
      }}
    >
      <div className={`flex items-center gap-1.5 border-b border-[var(--border)] select-none ${mode === "detail" ? "px-3 py-2" : "px-2 py-1"}`}>
        {mode === "detail" ? (
          <button
            className="rounded-md p-1 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
            onClick={(event) => {
              event.stopPropagation();
              onBack?.();
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M7.5 2.5L4 6l3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : terminal.origin !== "agent" ? (
          <div className="h-3 w-[3px] shrink-0 rounded-full bg-amber-500/60" />
        ) : null}

        <span
          className="text-[11px] font-medium"
          style={{ color: config.color, fontFamily: '"Geist Mono", monospace' }}
        >
          {config.label}
        </span>
        <span
          className="shrink-0 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
          style={{ fontFamily: '"Geist Mono", monospace' }}
        >
          {worktreeName}
        </span>
        <span
          className="truncate text-[11px] text-[var(--text-muted)]"
          style={{ fontFamily: '"Geist Mono", monospace' }}
        >
          {terminal.title}
        </span>

        <div
          className={`h-6 min-w-0 flex-1 rounded-md border px-1.5 text-[11px] ${
            terminal.customTitle
              ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
              : "border-dashed border-[var(--border)] bg-[var(--bg)] text-[var(--text-faint)]"
          }`}
          style={{ fontFamily: '"Geist Mono", monospace' }}
          title={terminal.customTitle || t.terminal_custom_title_placeholder}
          onMouseDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.stopPropagation();
            setIsEditingCustomTitle(true);
          }}
        >
          <div className="flex h-full items-center gap-1.5 min-w-0">
            <button
              className={`shrink-0 rounded p-0.5 transition-colors duration-150 ${
                terminal.starred
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-[var(--text-faint)] hover:text-amber-400"
              }`}
              title={terminal.starred ? t.terminal_unstar : t.terminal_star}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                toggleTerminalStarred(projectId, worktreeId, terminal.id);
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M5 1.2l1.05 2.13 2.35.34-1.7 1.66.4 2.35L5 6.58 2.9 7.68l.4-2.35L1.6 3.67l2.35-.34L5 1.2z"
                  fill={terminal.starred ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {isEditingCustomTitle ? (
              <input
                ref={customTitleInputRef}
                className="min-w-0 flex-1 bg-transparent leading-[22px] text-[var(--text-primary)] outline-none"
                value={customTitleDraft}
                placeholder={t.terminal_custom_title_placeholder}
                onChange={(event) => setCustomTitleDraft(event.target.value)}
                onBlur={saveCustomTitleEdit}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveCustomTitleEdit();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setIsEditingCustomTitle(false);
                  }
                }}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate leading-[22px]">
                {terminal.customTitle || t.terminal_custom_title_placeholder}
              </span>
            )}
          </div>
        </div>

        {mode === "board" && (
          <>
            <SplitMenuButton
              direction="horizontal"
              onSelect={onSplitHorizontal}
            />
            <SplitMenuButton
              direction="vertical"
              onSelect={onSplitVertical}
            />
            <button
              className="rounded-md p-1 text-[var(--text-faint)] transition-colors duration-150 hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
              title="Open detail"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                handleFocus();
                onOpenDetail?.();
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path
                  d="M4 2.5h5.5V8M9.5 2.5L2.5 9.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </>
        )}

        <button
          className="rounded-md p-1 text-[var(--text-faint)] transition-colors duration-150 hover:bg-[var(--border)] hover:text-[var(--red)]"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            handleClose();
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div
        ref={containerRef}
        className={`min-h-0 flex-1 ${mode === "detail" ? "p-3" : "p-1"}`}
        onClick={() => {
          handleFocus();
          const adapter = getComposerAdapter(terminal.type);
          if (!adapter || adapter.inputMode === "type" || !composerEnabled) {
            scheduleXtermFocus();
          }
        }}
      />

      {showCopiedToast && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] shadow-lg animate-[fadeIn_0.15s_ease-out]">
          {t.terminal_copied}
        </div>
      )}
    </div>
  );
}

