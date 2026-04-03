export type TerminalType =
  | "shell"
  | "claude"
  | "codex"
  | "copilot"
  | "kimi"
  | "gemini"
  | "opencode"
  | "lazygit"
  | "tmux";

export interface Position {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export type TerminalStatus =
  | "running"
  | "active"
  | "waiting"
  | "completed"
  | "success"
  | "error"
  | "idle";

export type ComposerSupportedTerminalType = TerminalType;

export interface ComposerImageAttachment {
  id: string;
  name: string;
  dataUrl: string;
}

export interface ComposerSubmitRequest {
  terminalId: string;
  ptyId: number;
  terminalType: ComposerSupportedTerminalType;
  worktreePath: string;
  text: string;
  images: ComposerImageAttachment[];
}

export type ComposerSubmitIssueStage =
  | "target"
  | "validate"
  | "read-images"
  | "prepare-images"
  | "paste-image"
  | "paste-text"
  | "submit";

export type ComposerSubmitIssueCode =
  | "target-not-running"
  | "unsupported-terminal"
  | "empty-submit"
  | "images-unsupported"
  | "image-read-failed"
  | "image-stage-failed"
  | "pty-write-failed"
  | "submit-key-failed"
  | "internal-error";

export interface ComposerSubmitResult {
  ok: boolean;
  requestId?: string;
  stagedImagePaths?: string[];
  error?: string;
  detail?: string;
  code?: ComposerSubmitIssueCode;
  stage?: ComposerSubmitIssueStage;
}

export type TerminalOrigin = "user" | "agent";

export interface TerminalData {
  id: string;
  title: string;
  customTitle?: string;
  starred?: boolean;
  type: TerminalType;
  focused: boolean;
  ptyId: number | null;
  status: TerminalStatus;
  minimized?: boolean;
  span?: { cols: number; rows: number };
  origin?: TerminalOrigin;
  parentTerminalId?: string;
  scrollback?: string;
  sessionId?: string;
  initialPrompt?: string;
  autoApprove?: boolean;
}

export interface WorktreeData {
  id: string;
  name: string;
  path: string;
  terminals: TerminalData[];
  position?: Position;
  collapsed?: boolean;
}

// Split pane layout types
export type SplitDirection = "horizontal" | "vertical";

export interface SplitLeafNode {
  type: "leaf";
  terminalId: string;
}

export interface SplitBranchNode {
  type: "split";
  direction: SplitDirection;
  ratio: number; // 0.0 to 1.0, position of divider
  first: SplitNode;
  second: SplitNode;
}

export type SplitNode = SplitLeafNode | SplitBranchNode;

export interface BoardLayout {
  root: SplitNode | null;
}

export interface ProjectData {
  id: string;
  name: string;
  path: string;
  worktrees: WorktreeData[];
  position?: Position;
  collapsed?: boolean;
  zIndex?: number;
  boardLayout?: BoardLayout;
}

export interface CanvasState {
  viewport?: Viewport;
  projects: ProjectData[];
  drawings?: unknown;
  browserCards?: unknown;
}

// Usage statistics types
export interface UsageBucket {
  label: string;
  hourStart: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate5m: number;
  cacheCreate1h: number;
  cost: number;
  calls: number;
}

export interface ProjectUsage {
  path: string;
  name: string;
  cost: number;
  calls: number;
}

export interface ModelUsage {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate5m: number;
  cacheCreate1h: number;
  cost: number;
  calls: number;
}

export interface UsageSummary {
  date: string;
  sessions: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheCreate5m: number;
  totalCacheCreate1h: number;
  totalCost: number;
  buckets: UsageBucket[];
  projects: ProjectUsage[];
  models: ModelUsage[];
}

export interface QuotaData {
  fiveHour: { utilization: number; resetsAt: string };
  sevenDay: { utilization: number; resetsAt: string };
  fetchedAt: number;
}

export type QuotaFetchResult =
  | { ok: true; data: QuotaData }
  | { ok: false; rateLimited: boolean };

export interface DeviceUsage {
  deviceId: string;
  tokens: number;
  cost: number;
  calls: number;
}

export interface CloudUsageSummary extends UsageSummary {
  devices: DeviceUsage[];
}

export interface InsightsProgressEvent {
  jobId: string;
  stage:
    | "validating"
    | "scanning"
    | "extracting_facets"
    | "aggregating"
    | "analyzing"
    | "generating_report";
  current: number;
  total: number;
  message: string;
}

export type InsightsGenerateResult =
  | { ok: true; jobId: string; reportPath: string }
  | {
      ok: false;
      jobId: string;
      error: { code: string; message: string; detail?: string };
    };

export type IpcResponse<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export interface PtyCreateResult {
  ptyId: number;
  /** Set when requested shell was not found and we fell back to default shell */
  fallback?: {
    requestedShell: string;
    actualShell: string;
  };
}

export interface LauncherCommandStep {
  label: string;
  command: string;
  timeoutMs: number;
}

export interface LauncherConfigItem {
  id: string;
  name: string;
  enabled: boolean;
  hostShell: "auto" | "pwsh" | "bash" | "zsh" | "cmd";
  mainCommand: {
    command: string;
    args: string[];
  };
  startupCommands: LauncherCommandStep[];
  runPolicy: {
    runOnNewSessionOnly: true;
    onFailure: "stop";
  };
}

export interface LauncherStartupEvent {
  type: "step-start" | "step-success" | "step-failed";
  terminalId: string;
  launcherId: string;
  stepIndex: number;
  totalSteps: number;
  stepLabel: string;
  command: string;
  exitCode?: number;
  timeoutMs?: number;
  stderrPreview?: string;
  timestamp: number;
}

// Preload API types
export interface OminiTermAPI {
  terminal: {
    create: (options: {
      cwd: string;
      shell?: string;
      args?: string[];
      terminalId?: string;
      theme?: "dark" | "light";
    }) => Promise<PtyCreateResult>;
    destroy: (ptyId: number) => Promise<void>;
    getPid: (ptyId: number) => Promise<number | null>;
    input: (ptyId: number, data: string) => void;
    resize: (ptyId: number, cols: number, rows: number) => void;
    notifyThemeChanged: (ptyId: number) => void;
    onOutput: (callback: (ptyId: number, data: string) => void) => () => void;
    onExit: (callback: (ptyId: number, exitCode: number) => void) => () => void;
    detectCli: (ptyId: number) => Promise<{ cliType: TerminalType; pid?: number; sessionName?: string } | null>;
  };
  launchers: {
    get: (id: string) => Promise<LauncherConfigItem | null>;
    list: () => Promise<LauncherConfigItem[]>;
    save: (launcher: LauncherConfigItem) => Promise<LauncherConfigItem[]>;
    delete: (id: string) => Promise<LauncherConfigItem[]>;
    reorder: (ids: string[]) => Promise<LauncherConfigItem[]>;
    onStartupEvent: (callback: (event: LauncherStartupEvent) => void) => () => void;
  };
  session: {
    getCodexLatest: () => Promise<string | null>;
    getClaudeByPid: (pid: number) => Promise<string | null>;
    getKimiLatest: (cwd: string) => Promise<string | null>;
    watch: (type: string, sessionId: string, cwd: string) => Promise<{ ok: boolean; reason?: string }>;
    unwatch: (sessionId: string) => Promise<void>;
    onTurnComplete: (callback: (sessionId: string) => void) => () => void;
  };
  project: {
    selectDirectory: () => Promise<string | null>;
    scan: (dirPath: string) => Promise<{
      name: string;
      path: string;
      worktrees: { path: string; branch: string; isMain: boolean }[];
    } | null>;
    rescanWorktrees: (
      dirPath: string,
    ) => Promise<{ path: string; branch: string; isMain: boolean }[]>;
    diff: (worktreePath: string) => Promise<{
      diff: string;
      files: {
        name: string;
        additions: number;
        deletions: number;
        binary: boolean;
        isImage: boolean;
        imageOld: string | null;
        imageNew: string | null;
      }[];
    }>;
  };
  git: {
    watch: (worktreePath: string) => Promise<void>;
    unwatch: (worktreePath: string) => Promise<void>;
    onChanged: (callback: (worktreePath: string) => void) => () => void;
  };
  state: {
    load: () => Promise<unknown | null>;
    save: (state: unknown) => Promise<void>;
  };
  workspace: {
    save: (data: string) => Promise<string | null>;
    open: () => Promise<string | null>;
    saveToPath: (filePath: string, data: string) => Promise<void>;
    setTitle: (title: string) => Promise<void>;
  };
  fs: {
    listDir: (dirPath: string) => Promise<{ name: string; isDirectory: boolean }[]>;
    readFile: (filePath: string) => Promise<
      | { type: string; content: string }
      | { error: string; size?: string }
    >;
  };
  fonts: {
    getPath: () => Promise<string>;
    listDownloaded: () => Promise<string[]>;
    check: (fileName: string) => Promise<boolean>;
    download: (url: string, fileName: string) => Promise<{
      ok: boolean;
      path?: string;
      error?: string;
    }>;
  };
  agents: {
    validateCommand: (command: string) => Promise<
      | { ok: true; resolvedPath: string; version: string | null }
      | { ok: false; error: string }
    >;
  };
  composer: {
    submit: (request: ComposerSubmitRequest) => Promise<ComposerSubmitResult>;
  };
  usage: {
    query: (dateStr: string) => Promise<UsageSummary>;
    heatmap: () => Promise<Record<string, { tokens: number; cost: number }>>;
  };
  quota: {
    fetch: () => Promise<QuotaFetchResult>;
  };
  insights: {
    generate: (
      cliTool: "claude" | "codex",
      jobId: string,
    ) => Promise<InsightsGenerateResult>;
    onProgress: (callback: (progress: InsightsProgressEvent) => void) => () => void;
    openReport: (filePath: string) => Promise<void>;
    getLastReport: () => Promise<string | null>;
  };
  app: {
    platform: "darwin" | "win32" | "linux";
    onBeforeClose: (callback: () => void) => () => void;
    confirmClose: () => void;
  };
  updater: {
    check: () => Promise<unknown>;
    install: () => void;
    getVersion: () => Promise<string>;
    onUpdateAvailable: (callback: (info: UpdateEventInfo) => void) => () => void;
    onDownloadProgress: (callback: (progress: { percent: number }) => void) => () => void;
    onUpdateDownloaded: (callback: (info: UpdateEventInfo) => void) => () => void;
    onError: (callback: (error: { message: string }) => void) => () => void;
  };
}

export interface UpdateEventInfo {
  version: string;
  releaseNotes: string;
  releaseDate: string;
}

declare global {
  interface Window {
    ominiterm: OminiTermAPI;
  }
}

