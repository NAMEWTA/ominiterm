# OminiTerm AI CLI 动态配置管理 - 实现计划

> **面向 AI 代理的工作者：** 必需子技能：[@subagent-driven-development](#) 或 [@executing-plans](#) 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现完整的 AI CLI 账号/配置管理系统，支持用户在创建终端时选择和管理多个 Claude、Codex、Gemini、OpenCode 账号。

**架构：** 
- Electron Main 进程：配置数据库管理 + 文件持久化 + IPC 暴露
- Renderer：Zustand Store + React Modal UI 集成
- 配置文件：`~/.ominiterm/ai-config.json` 作为单一数据源
- 启动时：IPC 调用自动写入目标工具的配置（`~/.claude`、`~/.codex` 等）

**技术栈：** Electron IPC、Zustand、React 19、TypeScript、Node.js fs 模块

---

## 📋 文件结构（创建/修改）

### Electron Main 进程（Core 层）

```
apps/desktop/electron/ai-config/
├── ai-config-types.ts          # TypeScript 类型定义（新建）
├── ai-config-manager.ts        # 配置管理 API（新建）
├── ai-config-persistence.ts    # 文件读写（新建）
├── ai-config-ipc.ts            # IPC 处理器（新建）
└── ai-config-utils.ts          # 工具函数（新建）

修改：
├── ../pty-launch.ts            # 扩展：配置注入功能
└── ../main.ts                  # 注册 IPC 处理器
```

### Renderer 进程（UI + Store 层）

```
apps/desktop/src/

Types:
└── types/ai-config.ts          # TypeScript 定义（新建）

Store:
└── stores/aiConfigStore.ts     # Zustand Store（新建）

Config/Presets:
└── config/aiCliPresets.ts      # CLI 预设定义（新建）

Components:
├── components/
│   ├── CreateTerminalModal.tsx # 修改：集成账号选择
│   └── ai-config/
│       ├── AccountSelector.tsx      # 新建：下拉选择器
│       ├── AccountEditor.tsx        # 新建：配置编辑器
│       ├── AdvancedJsonEditor.tsx   # 新建：JSON 编辑器
│       └── NewAccountDialog.tsx     # 新建：新增账号对话框
```

### 测试

```
apps/desktop/tests/
├── ai-config-manager.test.ts           # 新建
├── ai-config-persistence.test.ts       # 新建
├── ai-config-ipc.test.ts               # 新建
└── ai-config-store.test.ts             # 新建
```

---

## 🎯 任务清单（按执行顺序）

### Phase 1：核心数据模型和管理 API

#### 任务 1：AI 配置类型定义

**文件：**
- 创建：`apps/desktop/electron/ai-config/ai-config-types.ts`

- [ ] **步骤 1：创建配置类型定义文件**

创建 `apps/desktop/electron/ai-config/ai-config-types.ts`，内容如下：

```typescript
import type { TerminalType } from "../../src/types/index";

export interface CommonAiConfig {
  apiKey: string;              // 必填：API Key
  baseUrl?: string;            // 可选：服务端点
  model?: string;              // 可选：模型名称
}

export interface AiCliConfig {
  configId: string;             // 唯一标识，如 "claude-1", "codex-work"
  type: TerminalType;           // AI CLI 类型
  name: string;                 // 用户友好名称（如 "Personal", "Work"）
  providerName: string;         // 提供商名称（如 "Claude Official"）
  displayName: string;          // 完整显示名称（AI CLI - 账号名）
  description?: string;         // 可选描述
  
  commonConfig: CommonAiConfig; // 通用配置
  toolConfig: Record<string, any>; // 工具特定配置（Codex 等）
  
  createdAt: number;            // 创建时间戳
  updatedAt: number;            // 修改时间戳
  isDefault?: boolean;          // 是否为该类型默认配置
}

export interface AiConfigDatabase {
  version: 1;                   // 版本号
  configs: Record<string, AiCliConfig>;
  metadata: {
    lastUpdated: number;
  };
}

export const EMPTY_AI_CONFIG_DB: AiConfigDatabase = {
  version: 1,
  configs: {},
  metadata: {
    lastUpdated: Date.now(),
  },
};
```

- [ ] **步骤 2：运行类型检查确保语法正确**

运行：`pnpm --filter ominiterm typecheck`

预期：✓ 无类型错误

- [ ] **步骤 3：Commit**

```bash
git add apps/desktop/electron/ai-config/ai-config-types.ts
git commit -m "feat(ai-config): add core type definitions"
```

---

#### 任务 2：配置文件持久化 API

**文件：**
- 创建：`apps/desktop/electron/ai-config/ai-config-persistence.ts`

**依赖：** 任务 1

- [ ] **步骤 1：创建持久化模块**

创建 `apps/desktop/electron/ai-config/ai-config-persistence.ts`：

```typescript
import fs from "fs";
import path from "path";
import { OMINITERM_DIR } from "../state-persistence";
import type {
  AiConfigDatabase,
  AiCliConfig,
} from "./ai-config-types";
import {
  EMPTY_AI_CONFIG_DB,
} from "./ai-config-types";

const AI_CONFIG_FILE = path.join(OMINITERM_DIR, "ai-config.json");

export class AiConfigPersistence {
  /**
   * 加载配置数据库
   * @returns 配置数据库，文件不存在时返回空数据库
   */
  static load(): AiConfigDatabase {
    try {
      if (!fs.existsSync(AI_CONFIG_FILE)) {
        return EMPTY_AI_CONFIG_DB;
      }

      const data = fs.readFileSync(AI_CONFIG_FILE, "utf-8");
      const db = JSON.parse(data) as AiConfigDatabase;

      // 验证版本号
      if (db.version !== 1) {
        console.warn(
          `[AiConfigPersistence] Unknown version: ${db.version}, initializing new DB`,
        );
        return EMPTY_AI_CONFIG_DB;
      }

      return db;
    } catch (err) {
      console.error("[AiConfigPersistence] Failed to load config:", err);
      return EMPTY_AI_CONFIG_DB;
    }
  }

  /**
   * 保存配置数据库
   * @param db 要保存的数据库
   */
  static save(db: AiConfigDatabase): void {
    try {
      db.metadata.lastUpdated = Date.now();
      const tmp = AI_CONFIG_FILE + ".tmp";
      const content = JSON.stringify(db, null, 2);
      fs.writeFileSync(tmp, content, "utf-8");
      fs.renameSync(tmp, AI_CONFIG_FILE);
      console.log("[AiConfigPersistence] Config saved successfully");
    } catch (err) {
      console.error("[AiConfigPersistence] Failed to save config:", err);
      throw err;
    }
  }

  /**
   * 获取配置文件路径（用于调试/手动编辑）
   */
  static getConfigFilePath(): string {
    return AI_CONFIG_FILE;
  }

  /**
   * 备份配置（在重大变更前）
   */
  static backup(): void {
    try {
      if (fs.existsSync(AI_CONFIG_FILE)) {
        const timestamp = Date.now();
        const backupFile = `${AI_CONFIG_FILE}.${timestamp}.backup`;
        fs.copyFileSync(AI_CONFIG_FILE, backupFile);
        console.log(`[AiConfigPersistence] Backup created: ${backupFile}`);
      }
    } catch (err) {
      console.warn("[AiConfigPersistence] Backup failed:", err);
    }
  }
}
```

- [ ] **步骤 2：编写持久化测试**

创建 `apps/desktop/tests/ai-config-persistence.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { AiConfigPersistence } from "../electron/ai-config/ai-config-persistence";
import type { AiConfigDatabase } from "../electron/ai-config/ai-config-types";

describe("AiConfigPersistence", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-"));
    // 模拟 OMINITERM_DIR
    process.env.TEST_OMINITERM_DIR = testDir;
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it("should return empty DB if file does not exist", () => {
    const db = AiConfigPersistence.load();
    expect(db.version).toBe(1);
    expect(db.configs).toEqual({});
  });

  it("should save and load config correctly", () => {
    const testDb: AiConfigDatabase = {
      version: 1,
      configs: {
        "claude-1": {
          configId: "claude-1",
          type: "claude",
          name: "Personal",
          providerName: "Claude Official",
          displayName: "Claude - Personal",
          commonConfig: {
            apiKey: "sk-test-123",
            baseUrl: "https://api.anthropic.com",
          },
          toolConfig: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDefault: true,
        },
      },
      metadata: {
        lastUpdated: Date.now(),
      },
    };

    // Save
    AiConfigPersistence.save(testDb);
    expect(fs.existsSync(path.join(testDir, "ai-config.json"))).toBe(true);

    // Load
    const loaded = AiConfigPersistence.load();
    expect(loaded.configs["claude-1"]).toBeDefined();
    expect(loaded.configs["claude-1"].name).toBe("Personal");
  });

  it("should handle corrupted file gracefully", () => {
    const configFile = path.join(testDir, "ai-config.json");
    fs.writeFileSync(configFile, "invalid json {{{", "utf-8");

    const db = AiConfigPersistence.load();
    expect(db.configs).toEqual({});
  });
});
```

- [ ] **步骤 3：运行持久化测试**

运行：`pnpm --filter ominiterm test ai-config-persistence.test.ts`

预期：✓ All tests pass

- [ ] **步骤 4：Commit**

```bash
git add apps/desktop/electron/ai-config/ai-config-persistence.ts
git add apps/desktop/tests/ai-config-persistence.test.ts
git commit -m "feat(ai-config): implement persistence layer"
```

---

#### 任务 3：配置管理 API（Manager）

**文件：**
- 创建：`apps/desktop/electron/ai-config/ai-config-manager.ts`

**依赖：** 任务 1、2

- [ ] **步骤 1：创建 Manager 类**

创建 `apps/desktop/electron/ai-config/ai-config-manager.ts`：

```typescript
import type { TerminalType } from "../../src/types/index";
import { AiConfigPersistence } from "./ai-config-persistence";
import type {
  AiCliConfig,
  AiConfigDatabase,
} from "./ai-config-types";

export class AiConfigManager {
  private db: AiConfigDatabase;

  constructor() {
    this.db = AiConfigPersistence.load();
  }

  /**
   * 重新加载配置数据库
   */
  reload(): void {
    this.db = AiConfigPersistence.load();
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): AiCliConfig[] {
    return Object.values(this.db.configs);
  }

  /**
   * 按类型获取配置列表
   */
  getConfigsByType(type: TerminalType): AiCliConfig[] {
    return this.getAllConfigs().filter((cfg) => cfg.type === type);
  }

  /**
   * 按 ID 获取单个配置
   */
  getConfig(configId: string): AiCliConfig | null {
    return this.db.configs[configId] || null;
  }

  /**
   * 获取指定类型的默认配置
   */
  getDefaultConfig(type: TerminalType): AiCliConfig | null {
    const configs = this.getConfigsByType(type);
    const defaultConfig = configs.find((cfg) => cfg.isDefault);
    return defaultConfig || null;
  }

  /**
   * 检查配置 ID 是否存在
   */
  hasConfig(configId: string): boolean {
    return configId in this.db.configs;
  }

  /**
   * 新增配置
   */
  addConfig(config: AiCliConfig): void {
    if (this.hasConfig(config.configId)) {
      throw new Error(
        `Configuration with ID '${config.configId}' already exists`,
      );
    }

    config.createdAt = Date.now();
    config.updatedAt = Date.now();

    this.db.configs[config.configId] = config;
    AiConfigPersistence.save(this.db);

    console.log(`[AiConfigManager] Config added: ${config.configId}`);
  }

  /**
   * 更新配置
   */
  updateConfig(configId: string, updates: Partial<AiCliConfig>): void {
    const config = this.getConfig(configId);
    if (!config) {
      throw new Error(`Configuration with ID '${configId}' not found`);
    }

    const updated = {
      ...config,
      ...updates,
      configId: config.configId, // 防止 ID 被修改
      createdAt: config.createdAt, // 防止创建时间被修改
      updatedAt: Date.now(),
    };

    this.db.configs[configId] = updated;
    AiConfigPersistence.save(this.db);

    console.log(`[AiConfigManager] Config updated: ${configId}`);
  }

  /**
   * 删除配置
   */
  deleteConfig(configId: string): void {
    if (!this.hasConfig(configId)) {
      throw new Error(`Configuration with ID '${configId}' not found`);
    }

    delete this.db.configs[configId];
    AiConfigPersistence.save(this.db);

    console.log(`[AiConfigManager] Config deleted: ${configId}`);
  }

  /**
   * 设置默认配置
   */
  setDefaultConfig(configId: string): void {
    const config = this.getConfig(configId);
    if (!config) {
      throw new Error(`Configuration with ID '${configId}' not found`);
    }

    const type = config.type;

    // 清除同类型的其他默认标记
    this.getConfigsByType(type).forEach((cfg) => {
      if (cfg.configId !== configId) {
        cfg.isDefault = false;
      }
    });

    config.isDefault = true;
    AiConfigPersistence.save(this.db);

    console.log(
      `[AiConfigManager] Default config set for ${type}: ${configId}`,
    );
  }

  /**
   * 生成唯一的配置 ID
   * @param type - AI CLI 类型
   * @param baseName - 基础名称（如 "personal"、"work"）
   */
  generateConfigId(type: TerminalType, baseName: string): string {
    const base = `${type}-${baseName.toLowerCase().replace(/\s+/g, "-")}`;
    let id = base;
    let counter = 1;

    while (this.hasConfig(id)) {
      id = `${base}-${counter}`;
      counter++;
    }

    return id;
  }
}

// 全局实例
export const aiConfigManager = new AiConfigManager();
```

- [ ] **步骤 2：编写 Manager 单元测试**

创建 `apps/desktop/tests/ai-config-manager.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AiConfigManager } from "../electron/ai-config/ai-config-manager";
import type { AiCliConfig } from "../electron/ai-config/ai-config-types";

describe("AiConfigManager", () => {
  let manager: AiConfigManager;

  beforeEach(() => {
    manager = new AiConfigManager();
  });

  const mockConfig: AiCliConfig = {
    configId: "claude-personal-1",
    type: "claude",
    name: "Personal",
    providerName: "Claude Official",
    displayName: "Claude - Personal",
    commonConfig: {
      apiKey: "sk-test-123",
    },
    toolConfig: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it("should add config", () => {
    manager.addConfig(mockConfig);
    expect(manager.getConfig("claude-personal-1")).toEqual(
      expect.objectContaining(mockConfig),
    );
  });

  it("should not add duplicate config", () => {
    manager.addConfig(mockConfig);
    expect(() => manager.addConfig(mockConfig)).toThrow();
  });

  it("should get configs by type", () => {
    manager.addConfig(mockConfig);
    const configs = manager.getConfigsByType("claude");
    expect(configs.length).toBe(1);
    expect(configs[0].configId).toBe("claude-personal-1");
  });

  it("should update config", () => {
    manager.addConfig(mockConfig);
    manager.updateConfig("claude-personal-1", {
      name: "Updated Personal",
    });

    const updated = manager.getConfig("claude-personal-1");
    expect(updated?.name).toBe("Updated Personal");
    expect(updated?.createdAt).toBe(mockConfig.createdAt);
  });

  it("should delete config", () => {
    manager.addConfig(mockConfig);
    manager.deleteConfig("claude-personal-1");
    expect(manager.getConfig("claude-personal-1")).toBeNull();
  });

  it("should set default config", () => {
    manager.addConfig(mockConfig);
    manager.setDefaultConfig("claude-personal-1");
    expect(manager.getDefaultConfig("claude")).toEqual(
      expect.objectContaining(mockConfig),
    );
  });

  it("should generate unique config ID", () => {
    const id1 = manager.generateConfigId("claude", "personal");
    manager.addConfig({ ...mockConfig, configId: id1 });

    const id2 = manager.generateConfigId("claude", "personal");
    expect(id1).not.toBe(id2);
  });
});
```

- [ ] **步骤 3：运行 Manager 测试**

运行：`pnpm --filter ominiterm test ai-config-manager.test.ts`

预期：✓ All tests pass

- [ ] **步骤 4：Commit**

```bash
git add apps/desktop/electron/ai-config/ai-config-manager.ts
git add apps/desktop/tests/ai-config-manager.test.ts
git commit -m "feat(ai-config): implement management API"
```

---

### Phase 2：Electron IPC 暴露

#### 任务 4：IPC 处理器注册

**文件：**
- 创建：`apps/desktop/electron/ai-config/ai-config-ipc.ts`
- 修改：`apps/desktop/electron/main.ts`

**依赖：** 任务 3

- [ ] **步骤 1：创建 IPC 处理器模块**

创建 `apps/desktop/electron/ai-config/ai-config-ipc.ts`：

```typescript
import { ipcMain } from "electron";
import { aiConfigManager } from "./ai-config-manager";
import type { TerminalType } from "../../src/types/index";
import type { AiCliConfig } from "./ai-config-types";

/**
 * 注册所有 AI 配置相关的 IPC 处理器
 */
export function registerAiConfigIpc(): void {
  /**
   * 加载所有配置
   */
  ipcMain.handle("ai-config:load-all", () => {
    try {
      return {
        ok: true,
        data: aiConfigManager.getAllConfigs(),
      };
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
      };
    }
  });

  /**
   * 按类型获取配置
   */
  ipcMain.handle("ai-config:get-by-type", (_event, type: TerminalType) => {
    try {
      return {
        ok: true,
        data: aiConfigManager.getConfigsByType(type),
      };
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
      };
    }
  });

  /**
   * 添加配置
   */
  ipcMain.handle("ai-config:add", (_event, config: AiCliConfig) => {
    try {
      aiConfigManager.addConfig(config);
      return {
        ok: true,
      };
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
      };
    }
  });

  /**
   * 更新配置
   */
  ipcMain.handle(
    "ai-config:update",
    (_event, configId: string, updates: Partial<AiCliConfig>) => {
      try {
        aiConfigManager.updateConfig(configId, updates);
        return {
          ok: true,
        };
      } catch (err) {
        return {
          ok: false,
          error: (err as Error).message,
        };
      }
    },
  );

  /**
   * 删除配置
   */
  ipcMain.handle("ai-config:delete", (_event, configId: string) => {
    try {
      aiConfigManager.deleteConfig(configId);
      return {
        ok: true,
      };
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
      };
    }
  });

  /**
   * 设置默认配置
   */
  ipcMain.handle("ai-config:set-default", (_event, configId: string) => {
    try {
      aiConfigManager.setDefaultConfig(configId);
      return {
        ok: true,
      };
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
      };
    }
  });

  /**
   * 生成唯一配置 ID
   */
  ipcMain.handle(
    "ai-config:generate-id",
    (_event, type: TerminalType, baseName: string) => {
      try {
        return {
          ok: true,
          id: aiConfigManager.generateConfigId(type, baseName),
        };
      } catch (err) {
        return {
          ok: false,
          error: (err as Error).message,
        };
      }
    },
  );

  console.log("[IPC] AI Config handlers registered");
}
```

- [ ] **步骤 2：在 main.ts 中注册 IPC**

修改 `apps/desktop/electron/main.ts`，在适当位置（如其他 IPC 注册之后）添加：

```typescript
import { registerAiConfigIpc } from "./ai-config/ai-config-ipc";

// 在初始化函数或窗口创建后调用
registerAiConfigIpc();
```

- [ ] **步骤 3：为 preload 扩展 window.ominiterm**

修改 `apps/desktop/electron/preload.ts`，添加 AI Config API 到 window.ominiterm：

```typescript
export const aiConfigApi = {
  loadAll: () => ipcRenderer.invoke("ai-config:load-all"),
  getByType: (type: TerminalType) =>
    ipcRenderer.invoke("ai-config:get-by-type", type),
  add: (config: AiCliConfig) =>
    ipcRenderer.invoke("ai-config:add", config),
  update: (configId: string, updates: Partial<AiCliConfig>) =>
    ipcRenderer.invoke("ai-config:update", configId, updates),
  delete: (configId: string) =>
    ipcRenderer.invoke("ai-config:delete", configId),
  setDefault: (configId: string) =>
    ipcRenderer.invoke("ai-config:set-default", configId),
  generateId: (type: TerminalType, baseName: string) =>
    ipcRenderer.invoke("ai-config:generate-id", type, baseName),
};

// 暴露到 window.ominiterm
if (window.ominiterm) {
  window.ominiterm.aiConfig = aiConfigApi;
}
```

- [ ] **步骤 4：Commit**

```bash
git add apps/desktop/electron/ai-config/ai-config-ipc.ts
git add apps/desktop/electron/main.ts
git add apps/desktop/electron/preload.ts
git commit -m "feat(ai-config): register IPC handlers"
```

---

### Phase 3：Renderer 端（Store + UI）

#### 任务 5：Zustand Store

**文件：**
- 创建：`apps/desktop/src/stores/aiConfigStore.ts`
- 创建：`apps/desktop/src/types/ai-config.ts`

**依赖：** 任务 4

- [ ] **步骤 1：创建 Renderer 类型定义**

创建 `apps/desktop/src/types/ai-config.ts`：

```typescript
/**
 * Renderer 端的 AI 配置类型（从 Electron 类型导出）
 */

export type TerminalTypeStr = "claude" | "codex" | "gemini" | "opencode";

export interface CommonAiConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface AiCliConfig {
  configId: string;
  type: TerminalTypeStr;
  name: string;
  providerName: string;
  displayName: string;
  description?: string;
  commonConfig: CommonAiConfig;
  toolConfig: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}
```

- [ ] **步骤 2：创建 Zustand Store**

创建 `apps/desktop/src/stores/aiConfigStore.ts`：

```typescript
import { create } from "zustand";
import type { TerminalType } from "../types/index";
import type { AiCliConfig } from "../types/ai-config";

interface AiConfigState {
  configs: Record<string, AiCliConfig>;
  loading: boolean;
  error: string | null;

  // 操作
  loadConfigs: () => Promise<void>;
  addConfig: (config: AiCliConfig) => Promise<void>;
  updateConfig: (configId: string, updates: Partial<AiCliConfig>) => Promise<void>;
  deleteConfig: (configId: string) => Promise<void>;
  setDefaultConfig: (configId: string) => Promise<void>;

  // 工具方法
  getConfigsByType: (type: TerminalType) => AiCliConfig[];
  getDefaultConfig: (type: TerminalType) => AiCliConfig | null;
  getConfig: (configId: string) => AiCliConfig | null;
  generateConfigId: (type: TerminalType, baseName: string) => Promise<string>;
}

export const useAiConfigStore = create<AiConfigState>((set, get) => ({
  configs: {},
  loading: false,
  error: null,

  loadConfigs: async () => {
    set({ loading: true, error: null });
    try {
      const result = await window.ominiterm.aiConfig.loadAll();
      if (result.ok) {
        const configMap = result.data.reduce(
          (acc: Record<string, AiCliConfig>, cfg: AiCliConfig) => {
            acc[cfg.configId] = cfg;
            return acc;
          },
          {},
        );
        set({ configs: configMap, loading: false });
      } else {
        set({ error: result.error || "Failed to load configs", loading: false });
      }
    } catch (err) {
      set({
        error: (err as Error).message,
        loading: false,
      });
    }
  },

  addConfig: async (config) => {
    set({ error: null });
    try {
      const result = await window.ominiterm.aiConfig.add(config);
      if (result.ok) {
        set((state) => ({
          configs: {
            ...state.configs,
            [config.configId]: config,
          },
        }));
      } else {
        set({ error: result.error || "Failed to add config" });
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateConfig: async (configId, updates) => {
    set({ error: null });
    try {
      const result = await window.ominiterm.aiConfig.update(configId, updates);
      if (result.ok) {
        set((state) => ({
          configs: {
            ...state.configs,
            [configId]: {
              ...state.configs[configId],
              ...updates,
              updatedAt: Date.now(),
            },
          },
        }));
      } else {
        set({ error: result.error || "Failed to update config" });
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteConfig: async (configId) => {
    set({ error: null });
    try {
      const result = await window.ominiterm.aiConfig.delete(configId);
      if (result.ok) {
        set((state) => {
          const newConfigs = { ...state.configs };
          delete newConfigs[configId];
          return { configs: newConfigs };
        });
      } else {
        set({ error: result.error || "Failed to delete config" });
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setDefaultConfig: async (configId) => {
    set({ error: null });
    try {
      const result = await window.ominiterm.aiConfig.setDefault(configId);
      if (result.ok) {
        set((state) => {
          const { type } = state.configs[configId];
          return {
            configs: {
              ...state.configs,
              ...Object.entries(state.configs).reduce(
                (acc, [id, cfg]) => {
                  acc[id] = {
                    ...cfg,
                    isDefault: id === configId && cfg.type === type,
                  };
                  return acc;
                },
                {} as Record<string, AiCliConfig>,
              ),
            },
          };
        });
      } else {
        set({ error: result.error || "Failed to set default config" });
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  getConfigsByType: (type) => {
    return Object.values(get().configs).filter((cfg) => cfg.type === type);
  },

  getDefaultConfig: (type) => {
    const configs = get().getConfigsByType(type);
    return configs.find((cfg) => cfg.isDefault) || null;
  },

  getConfig: (configId) => {
    return get().configs[configId] || null;
  },

  generateConfigId: async (type, baseName) => {
    try {
      const result = await window.ominiterm.aiConfig.generateId(type, baseName);
      if (result.ok) {
        return result.id;
      } else {
        throw new Error(result.error || "Failed to generate ID");
      }
    } catch (err) {
      throw err;
    }
  },
}));
```

- [ ] **步骤 3：编写 Store 测试**

创建 `apps/desktop/tests/ai-config-store.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAiConfigStore } from "../src/stores/aiConfigStore";
import type { AiCliConfig } from "../src/types/ai-config";

// Mock IPC
vi.mock("../src/types/ominiterm", () => ({
  default: {
    aiConfig: {
      loadAll: vi.fn(() =>
        Promise.resolve({
          ok: true,
          data: [],
        }),
      ),
      add: vi.fn(() =>
        Promise.resolve({
          ok: true,
        }),
      ),
    },
  },
}));

describe("useAiConfigStore", () => {
  beforeEach(() => {
    useAiConfigStore.setState({
      configs: {},
      loading: false,
      error: null,
    });
  });

  const mockConfig: AiCliConfig = {
    configId: "claude-1",
    type: "claude",
    name: "Test",
    providerName: "Claude Official",
    displayName: "Claude - Test",
    commonConfig: { apiKey: "sk-test" },
    toolConfig: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it("should get configs by type", () => {
    const { result } = renderHook(() => useAiConfigStore());

    act(() => {
      useAiConfigStore.setState((state) => ({
        configs: {
          ...state.configs,
          "claude-1": mockConfig,
        },
      }));
    });

    const configs = result.current.getConfigsByType("claude");
    expect(configs).toHaveLength(1);
    expect(configs[0].configId).toBe("claude-1");
  });

  it("should get default config", () => {
    const { result } = renderHook(() => useAiConfigStore());

    const configWithDefault = {
      ...mockConfig,
      isDefault: true,
    };

    act(() => {
      useAiConfigStore.setState((state) => ({
        configs: {
          ...state.configs,
          "claude-1": configWithDefault,
        },
      }));
    });

    const cfg = result.current.getDefaultConfig("claude");
    expect(cfg?.configId).toBe("claude-1");
    expect(cfg?.isDefault).toBe(true);
  });
});
```

- [ ] **步骤 4：运行 Store 测试**

运行：`pnpm --filter ominiterm test ai-config-store.test.ts`

预期：✓ Tests pass

- [ ] **步骤 5：Commit**

```bash
git add apps/desktop/src/types/ai-config.ts
git add apps/desktop/src/stores/aiConfigStore.ts
git add apps/desktop/tests/ai-config-store.test.ts
git commit -m "feat(ai-config): implement zustand store"
```

---

#### 任务 6：AI CLI 预设定义

**文件：**
- 创建：`apps/desktop/src/config/aiCliPresets.ts`

**依赖：** 任务 5

- [ ] **步骤 1：创建预设定义**

创建 `apps/desktop/src/config/aiCliPresets.ts`：

```typescript
import type { TerminalType } from "../types/index";

export interface CliFieldPreset {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url";
  required: boolean;
  hint?: string;
}

export interface CliPreset {
  type: TerminalType;
  displayName: string;
  commonFields: CliFieldPreset[];
  docUrl?: string;
}

export const CLI_PRESETS: Record<TerminalType, CliPreset> = {
  claude: {
    type: "claude",
    displayName: "Claude",
    docUrl: "https://console.anthropic.com",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-ant-...",
        type: "password",
        required: true,
        hint: "Get from https://console.anthropic.com/account/keys",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        placeholder: "https://api.anthropic.com",
        type: "url",
        required: false,
        hint: "Optional: for custom endpoints or proxies",
      },
      {
        key: "model",
        label: "Model",
        placeholder: "claude-3-5-sonnet-20241022",
        type: "text",
        required: false,
        hint: "Default model for requests",
      },
    ],
  },

  codex: {
    type: "codex",
    displayName: "Codex",
    docUrl: "https://chatgpt.com/codex",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-proj-...",
        type: "password",
        required: true,
        hint: "Get from https://platform.openai.com/api-keys",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        placeholder: "https://api.openai.com/v1",
        type: "url",
        required: false,
        hint: "Optional: for custom endpoints",
      },
      {
        key: "model",
        label: "Model",
        placeholder: "gpt-5.4",
        type: "text",
        required: false,
      },
    ],
  },

  gemini: {
    type: "gemini",
    displayName: "Gemini",
    docUrl: "https://aistudio.google.com",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "AIzaSy...",
        type: "password",
        required: true,
        hint: "Get from https://aistudio.google.com/apikey",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        placeholder: "https://generativelanguage.googleapis.com",
        type: "url",
        required: false,
      },
      {
        key: "model",
        label: "Model",
        placeholder: "gemini-3.1-pro",
        type: "text",
        required: false,
      },
    ],
  },

  opencode: {
    type: "opencode",
    displayName: "OpenCode",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "oc-...",
        type: "password",
        required: true,
      },
      {
        key: "baseUrl",
        label: "Base URL",
        placeholder: "https://api.opencode.ai",
        type: "url",
        required: false,
      },
    ],
  },

  copilot: {
    type: "copilot",
    displayName: "Copilot",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "github_pat_...",
        type: "password",
        required: true,
      },
    ],
  },

  kimi: {
    type: "kimi",
    displayName: "Kimi",
    docUrl: "https://platform.moonshot.cn/console",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-...",
        type: "password",
        required: true,
      },
    ],
  },

  lazygit: {
    type: "lazygit",
    displayName: "Lazygit",
    commonFields: [],
  },

  shell: {
    type: "shell",
    displayName: "Shell",
    commonFields: [],
  },

  tmux: {
    type: "tmux",
    displayName: "Tmux",
    commonFields: [],
  },
};

/**
 * 获取指定类型的预设
 */
export function getCliPreset(type: TerminalType): CliPreset {
  return CLI_PRESETS[type] || { type, displayName: type, commonFields: [] };
}

/**
 * 获取可配置账号的 AI CLI 类型
 */
export function getConfigurableCliTypes(): TerminalType[] {
  return [
    "claude",
    "codex",
    "gemini",
    "opencode",
    "copilot",
    "kimi",
  ] as TerminalType[];
}
```

- [ ] **步骤 2：Commit**

```bash
git add apps/desktop/src/config/aiCliPresets.ts
git commit -m "feat(ai-config): add CLI preset definitions"
```

---

### Phase 4：UI 组件（Modal + Editors）

#### 任务 7：AI Config UI 组件库

**文件：**
- 创建：`apps/desktop/src/components/ai-config/AccountSelector.tsx`
- 创建：`apps/desktop/src/components/ai-config/AccountEditor.tsx`
- 创建：`apps/desktop/src/components/ai-config/AdvancedJsonEditor.tsx`
- 创建：`apps/desktop/src/components/ai-config/NewAccountDialog.tsx`

**依赖：** 任务 5、6

本任务建议由专门的 UI 开发者实现。为节省空间，这里基于规格的 UI 需求给出骨架代码。

- [ ] **步骤 1：创建 AccountSelector 组件**

创建 `apps/desktop/src/components/ai-config/AccountSelector.tsx`：

```typescript
import { useMemo } from "react";
import type { TerminalType } from "../../types/index";
import { useAiConfigStore } from "../../stores/aiConfigStore";
import type { AiCliConfig } from "../../types/ai-config";

interface AccountSelectorProps {
  type: TerminalType;
  value: string | null;
  onChange: (configId: string) => void;
  onNewAccount: () => void;
}

export function AccountSelector({
  type,
  value,
  onChange,
  onNewAccount,
}: AccountSelectorProps) {
  const configs = useAiConfigStore((state) =>
    state.getConfigsByType(type),
  );

  const options = useMemo(
    () => configs.map((cfg) => ({ id: cfg.configId, label: cfg.displayName })),
    [configs],
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Account</label>
      <div className="flex gap-2">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border rounded"
        >
          <option value="">Select account...</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={onNewAccount}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          + New
        </button>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：创建 AccountEditor 组件**

创建 `apps/desktop/src/components/ai-config/AccountEditor.tsx`：

```typescript
import { useEffect, useState } from "react";
import { getCliPreset } from "../../config/aiCliPresets";
import type { TerminalType } from "../../types/index";
import type { AiCliConfig, CommonAiConfig } from "../../types/ai-config";

interface AccountEditorProps {
  config: AiCliConfig;
  onUpdate: (updates: Partial<AiCliConfig>) => void;
  readOnly?: boolean;
}

export function AccountEditor({
  config,
  onUpdate,
  readOnly = false,
}: AccountEditorProps) {
  const preset = getCliPreset(config.type as TerminalType);
  const [localConfig, setLocalConfig] = useState<CommonAiConfig>(
    config.commonConfig,
  );

  useEffect(() => {
    setLocalConfig(config.commonConfig);
  }, [config.commonConfig]);

  const handleFieldChange = (key: string, value: string) => {
    const updated = { ...localConfig, [key]: value };
    setLocalConfig(updated);
    onUpdate({ commonConfig: updated });
  };

  return (
    <div className="space-y-4 p-4 border rounded bg-gray-50">
      <h3 className="font-semibold">{config.displayName}</h3>

      {preset.commonFields.map((field) => (
        <div key={field.key} className="space-y-1">
          <label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type={field.type}
            placeholder={field.placeholder}
            value={(localConfig as any)[field.key] || ""}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={readOnly}
            className="w-full px-3 py-2 border rounded"
          />
          {field.hint && (
            <p className="text-xs text-gray-500">{field.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **步骤 3：创建 AdvancedJsonEditor 组件**

创建 `apps/desktop/src/components/ai-config/AdvancedJsonEditor.tsx`：

```typescript
import { useState } from "react";
import type { AiCliConfig } from "../../types/ai-config";

interface AdvancedJsonEditorProps {
  config: AiCliConfig;
  onUpdate: (updates: Partial<AiCliConfig>) => void;
}

export function AdvancedJsonEditor({
  config,
  onUpdate,
}: AdvancedJsonEditorProps) {
  const [jsonText, setJsonText] = useState(
    JSON.stringify(config.commonConfig, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      onUpdate({ commonConfig: parsed });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Advanced Config (JSON)</label>
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        className="w-full h-40 px-3 py-2 border rounded font-mono text-sm"
        placeholder='{"apiKey": "..."}'
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={handleApply}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Apply
      </button>
    </div>
  );
}
```

- [ ] **步骤 4：创建 NewAccountDialog 组件**

创建 `apps/desktop/src/components/ai-config/NewAccountDialog.tsx`：

```typescript
import { useState } from "react";
import type { TerminalType } from "../../types/index";
import { useAiConfigStore } from "../../stores/aiConfigStore";
import { getCliPreset } from "../../config/aiCliPresets";
import type { AiCliConfig } from "../../types/ai-config";

interface NewAccountDialogProps {
  type: TerminalType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (config: AiCliConfig) => Promise<void>;
}

export function NewAccountDialog({
  type,
  open,
  onOpenChange,
  onSubmit,
}: NewAccountDialogProps) {
  const preset = getCliPreset(type);
  const generateId = useAiConfigStore((state) => state.generateConfigId);

  const [accountName, setAccountName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!accountName.trim()) {
      setError("Account name is required");
      return;
    }

    const requiredFields = preset.commonFields.filter((f) => f.required);
    for (const field of requiredFields) {
      if (!fields[field.key]) {
        setError(`${field.label} is required`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const configId = await generateId(type, accountName);
      const newConfig: AiCliConfig = {
        configId,
        type,
        name: accountName,
        providerName: preset.displayName,
        displayName: `${preset.displayName} - ${accountName}`,
        commonConfig: {
          apiKey: fields.apiKey || "",
          baseUrl: fields.baseUrl,
          model: fields.model,
        },
        toolConfig: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await onSubmit(newConfig);
      onOpenChange(false);
      setAccountName("");
      setFields({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
        <h2 className="text-xl font-bold">New {preset.displayName} Account</h2>

        <div>
          <label className="text-sm font-medium">Account Name</label>
          <input
            type="text"
            placeholder="e.g., Personal, Work"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full px-3 py-2 border rounded mt-1"
          />
        </div>

        {preset.commonFields.map((field) => (
          <div key={field.key}>
            <label className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type={field.type}
              placeholder={field.placeholder}
              value={fields[field.key] || ""}
              onChange={(e) =>
                setFields({ ...fields, [field.key]: e.target.value })
              }
              className="w-full px-3 py-2 border rounded mt-1"
            />
          </div>
        ))}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 5：Commit**

```bash
git add apps/desktop/src/components/ai-config/
git commit -m "feat(ai-config): implement UI components"
```

---

#### 任务 8：集成 CreateTerminalModal

**文件：**
- 修改：`apps/desktop/src/components/ProjectBoard.tsx`

**依赖：** 任务 7

- [ ] **步骤 1：查看现有 Modal 结构**

阅读 `apps/desktop/src/components/ProjectBoard.tsx` 中的终端创建逻辑。

- [ ] **步骤 2：扩展 Modal State**

在创建终端时，添加以下字段到相关状态或组件 props：

```typescript
interface CreateTerminalState {
  // 现有字段
  selectedType: TerminalType;
  
  // 新增字段
  selectedConfigId: string | null;
  showAdvancedMode: boolean;
  showNewAccountDialog: boolean;
}
```

- [ ] **步骤 3：集成 UI 组件**

在 Modal 中按以下流程集成：

```typescript
// 当用户选择 AI CLI 类型时
- 加载该类型的账号列表
- 尝试选择默认账号
- 显示 AccountSelector（带 "+ New Account" 按钮）

// 当用户点击 "+ New Account" 时
- 打开 NewAccountDialog
- 保存后自动选中新账号

// 编辑配置
- 显示 AccountEditor（预定义字段）
- 提供 "高级模式" 切换，显示 AdvancedJsonEditor

// 创建终端前
- 验证必填字段
- 调用 IPC 写入配置（见任务 9）
```

- [ ] **步骤 4：Commit**

```bash
git add apps/desktop/src/components/ProjectBoard.tsx
git commit -m "feat(ai-config): integrate account selection into CreateTerminalModal"
```

---

### Phase 5：启动集成

#### 任务 9：配置写入逻辑（pty-launch.ts 扩展）

**文件：**
- 修改：`apps/desktop/electron/pty-launch.ts`
- 创建：`apps/desktop/electron/ai-config/ai-config-writer.ts`

**依赖：** 任务 3

- [ ] **步骤 1：创建配置写入模块**

创建 `apps/desktop/electron/ai-config/ai-config-writer.ts`：

```typescript
import fs from "fs";
import path from "path";
import os from "os";
import type { TerminalType } from "../../src/types/index";
import type { AiCliConfig } from "./ai-config-types";
import { aiConfigManager } from "./ai-config-manager";

export class AiConfigWriter {
  /**
   * 写入配置到目标工具
   */
  static writeConfigToTool(
    configId: string,
    workingDir?: string,
  ): {
    env: Record<string, string>;
    errors: string[];
  } {
    const config = aiConfigManager.getConfig(configId);
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`);
    }

    const env: Record<string, string> = {};
    const errors: string[] = [];

    try {
      switch (config.type) {
        case "claude":
          this.writeClaudeConfig(config, env, errors);
          break;
        case "codex":
          this.writeCodexConfig(config, env, errors, workingDir);
          break;
        case "gemini":
          this.writeGeminiConfig(config, env, errors);
          break;
        case "opencode":
          this.writeOpenCodeConfig(config, env, errors);
          break;
        default:
          errors.push(`Unsupported CLI type: ${config.type}`);
      }
    } catch (err) {
      errors.push((err as Error).message);
    }

    return { env, errors };
  }

  private static writeClaudeConfig(
    config: AiCliConfig,
    env: Record<string, string>,
    errors: string[],
  ): void {
    const { commonConfig } = config;

    if (!commonConfig.apiKey) {
      errors.push("API Key is required for Claude");
      return;
    }

    // 写入环境变量
    env.ANTHROPIC_API_KEY = commonConfig.apiKey;

    if (commonConfig.baseUrl) {
      env.ANTHROPIC_BASE_URL = commonConfig.baseUrl;
    }

    if (commonConfig.model) {
      env.ANTHROPIC_MODEL = commonConfig.model;
    }

    // 写入 ~/.claude 配置文件
    const claudeDir = path.join(os.homedir(), ".claude");
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    const claudeConfigFile = path.join(claudeDir, "config.json");
    const claudeConfig = {
      apiKey: commonConfig.apiKey,
      ...(commonConfig.baseUrl && { baseUrl: commonConfig.baseUrl }),
      ...(commonConfig.model && { model: commonConfig.model }),
    };

    fs.writeFileSync(claudeConfigFile, JSON.stringify(claudeConfig, null, 2));
    console.log(
      `[AiConfigWriter] Claude config written to ${claudeConfigFile}`,
    );
  }

  private static writeCodexConfig(
    config: AiCliConfig,
    env: Record<string, string>,
    errors: string[],
    workingDir?: string,
  ): void {
    const { commonConfig } = config;

    if (!commonConfig.apiKey) {
      errors.push("API Key is required for Codex");
      return;
    }

    // 写入环境变量
    env.OPENAI_API_KEY = commonConfig.apiKey;

    if (commonConfig.baseUrl) {
      env.OPENAI_BASE_URL = commonConfig.baseUrl;
    }

    // 写入 ~/.codex 配置
    const codexDir = path.join(os.homedir(), ".codex");
    if (!fs.existsSync(codexDir)) {
      fs.mkdirSync(codexDir, { recursive: true });
    }

    // auth.json
    const authFile = path.join(codexDir, "auth.json");
    const authConfig = {
      OPENAI_API_KEY: commonConfig.apiKey,
    };
    fs.writeFileSync(authFile, JSON.stringify(authConfig, null, 2));
    console.log(`[AiConfigWriter] Codex auth written to ${authFile}`);

    // config.toml（简化版）
    const configFile = path.join(codexDir, "config.toml");
    const tomlContent = `[model]
api_key = "${commonConfig.apiKey}"
${commonConfig.baseUrl ? `base_url = "${commonConfig.baseUrl}"` : ""}
${commonConfig.model ? `model = "${commonConfig.model}"` : ""}
`;
    fs.writeFileSync(configFile, tomlContent);
    console.log(`[AiConfigWriter] Codex config written to ${configFile}`);
  }

  private static writeGeminiConfig(
    config: AiCliConfig,
    env: Record<string, string>,
    errors: string[],
  ): void {
    const { commonConfig } = config;

    if (!commonConfig.apiKey) {
      errors.push("API Key is required for Gemini");
      return;
    }

    env.GOOGLE_API_KEY = commonConfig.apiKey;
    env.GOOGLE_GEMINI_API_KEY = commonConfig.apiKey;

    if (commonConfig.baseUrl) {
      env.GOOGLE_GEMINI_BASE_URL = commonConfig.baseUrl;
    }

    if (commonConfig.model) {
      env.GEMINI_MODEL = commonConfig.model;
    }

    // 写入 ~/.gemini 配置
    const geminiDir = path.join(os.homedir(), ".gemini");
    if (!fs.existsSync(geminiDir)) {
      fs.mkdirSync(geminiDir, { recursive: true });
    }

    const geminiConfigFile = path.join(geminiDir, "config.json");
    const geminiConfig = {
      apiKey: commonConfig.apiKey,
      ...(commonConfig.baseUrl && { baseUrl: commonConfig.baseUrl }),
      ...(commonConfig.model && { model: commonConfig.model }),
    };

    fs.writeFileSync(geminiConfigFile, JSON.stringify(geminiConfig, null, 2));
    console.log(
      `[AiConfigWriter] Gemini config written to ${geminiConfigFile}`,
    );
  }

  private static writeOpenCodeConfig(
    config: AiCliConfig,
    env: Record<string, string>,
    errors: string[],
  ): void {
    const { commonConfig } = config;

    if (!commonConfig.apiKey) {
      errors.push("API Key is required for OpenCode");
      return;
    }

    env.OPENCODE_API_KEY = commonConfig.apiKey;

    if (commonConfig.baseUrl) {
      env.OPENCODE_BASE_URL = commonConfig.baseUrl;
    }
  }
}
```

- [ ] **步骤 2：扩展 pty-launch.ts**

修改 `apps/desktop/electron/pty-launch.ts`，在 `buildLaunchSpec` 或相关函数中添加配置注入逻辑：

```typescript
// 在导入中添加
import { AiConfigWriter } from "./ai-config/ai-config-writer";

// 在 buildLaunchSpec 或创建 PTY 前调用
export function injectAiCliConfig(
  env: Record<string, string>,
  configId?: string,
  workingDir?: string,
): void {
  if (!configId) return;

  try {
    const { env: configEnv, errors } = AiConfigWriter.writeConfigToTool(
      configId,
      workingDir,
    );

    // 合并环境变量
    Object.assign(env, configEnv);

    if (errors.length > 0) {
      console.warn("[pty-launch] Config write warnings:", errors);
    }
  } catch (err) {
    console.error("[pty-launch] Failed to write AI config:", err);
  }
}
```

- [ ] **步骤 3：编写 Writer 测试**

创建 `apps/desktop/tests/ai-config-writer.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { AiConfigWriter } from "../electron/ai-config/ai-config-writer";
import { aiConfigManager } from "../electron/ai-config/ai-config-manager";
import type { AiCliConfig } from "../electron/ai-config/ai-config-types";

describe("AiConfigWriter", () => {
  const mockClaudeConfig: AiCliConfig = {
    configId: "claude-test",
    type: "claude",
    name: "Test",
    providerName: "Claude Official",
    displayName: "Claude - Test",
    commonConfig: {
      apiKey: "sk-test-api-key",
      baseUrl: "https://api.anthropic.com",
      model: "claude-3-5-sonnet",
    },
    toolConfig: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    // 添加测试配置到 manager
    aiConfigManager.addConfig(mockClaudeConfig);
  });

  it("should write Claude config to environment", () => {
    const { env, errors } = AiConfigWriter.writeConfigToTool(
      mockClaudeConfig.configId,
    );

    expect(errors).toHaveLength(0);
    expect(env.ANTHROPIC_API_KEY).toBe("sk-test-api-key");
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.anthropic.com");
    expect(env.ANTHROPIC_MODEL).toBe("claude-3-5-sonnet");
  });

  it("should handle missing config", () => {
    expect(() =>
      AiConfigWriter.writeConfigToTool("non-existent"),
    ).toThrow();
  });
});
```

- [ ] **步骤 4：运行 Writer 测试**

运行：`pnpm --filter omniterm test ai-config-writer.test.ts`

预期：✓ Tests pass

- [ ] **步骤 5：Commit**

```bash
git add apps/desktop/electron/ai-config/ai-config-writer.ts
git add apps/desktop/electron/pty-launch.ts
git add apps/desktop/tests/ai-config-writer.test.ts
git commit -m "feat(ai-config): implement config writing to tools"
```

---

### Phase 6：集成测试 + 验证

#### 任务 10：端到端集成测试

**文件：**
- 创建：`apps/desktop/tests/ai-config-integration.test.ts`

**依赖：** 所有前序任务

- [ ] **步骤 1：编写完整集成测试**

创建 `apps/desktop/tests/ai-config-integration.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { aiConfigManager } from "../electron/ai-config/ai-config-manager";
import { AiConfigWriter } from "../electron/ai-config/ai-config-writer";
import type { AiCliConfig } from "../electron/ai-config/ai-config-types";

describe("AI Config Integration", () => {
  beforeEach(() => {
    // 清理测试数据
  });

  it("should complete full workflow: add -> select -> write", () => {
    // 1. 添加配置
    const config: AiCliConfig = {
      configId: "test-claude-workflow",
      type: "claude",
      name: "Workflow Test",
      providerName: "Claude Official",
      displayName: "Claude - Workflow Test",
      commonConfig: {
        apiKey: "sk-workflow-test",
      },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    aiConfigManager.addConfig(config);

    // 2. 选择配置
    const retrieved = aiConfigManager.getConfig("test-claude-workflow");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("Workflow Test");

    // 3. 写入配置
    const { env } = AiConfigWriter.writeConfigToTool("test-claude-workflow");
    expect(env.ANTHROPIC_API_KEY).toBe("sk-workflow-test");

    // 4. 验证默认配置
    aiConfigManager.setDefaultConfig("test-claude-workflow");
    const defaultConfig = aiConfigManager.getDefaultConfig("claude");
    expect(defaultConfig?.configId).toBe("test-claude-workflow");
  });

  it("should handle multi-account scenario", () => {
    const config1: AiCliConfig = {
      configId: "claude-personal",
      type: "claude",
      name: "Personal",
      providerName: "Claude Official",
      displayName: "Claude - Personal",
      commonConfig: { apiKey: "sk-personal" },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const config2: AiCliConfig = {
      configId: "claude-work",
      type: "claude",
      name: "Work",
      providerName: "Claude Official",
      displayName: "Claude - Work",
      commonConfig: { apiKey: "sk-work" },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    aiConfigManager.addConfig(config1);
    aiConfigManager.addConfig(config2);

    const claudeConfigs = aiConfigManager.getConfigsByType("claude");
    expect(claudeConfigs).toHaveLength(2);

    // 切换默认账号
    aiConfigManager.setDefaultConfig("claude-work");
    expect(aiConfigManager.getDefaultConfig("claude")?.configId).toBe(
      "claude-work",
    );
  });
});
```

- [ ] **步骤 2：运行集成测试**

运行：`pnpm --filter ominiterm test ai-config-integration.test.ts`

预期：✓ All tests pass

- [ ] **步骤 3：运行完整测试套件**

运行：`pnpm --filter ominiterm test`

预期：✓ 所有测试通过，包括现有测试

- [ ] **步骤 4：类型检查**

运行：`pnpm --filter ominiterm typecheck`

预期：✓ No TypeScript errors

- [ ] **步骤 5：Commit**

```bash
git add apps/desktop/tests/ai-config-integration.test.ts
git commit -m "test(ai-config): add integration tests"
```

---

#### 任务 11：手动验证 + 文档

**文件：**
- 创建：`docs/features/ai-cli-config-management.md`（用户文档）

- [ ] **步骤 1：编写用户文档**

创建 `docs/features/ai-cli-config-management.md`，包括：
- 功能概述
- 快速开始指南
- 每个 AI CLI 的配置步骤
- 常见问题

- [ ] **步骤 2：手动测试工作流**

1. 启动 OminiTerm：`pnpm dev`
2. 创建全新终端
3. 选择 "Claude" 类型
4. 点击 "+ New Account"
5. 填入账号名称和 API Key
6. 创建终端
7. 验证 `~/.claude/config.json` 已创建
8. 验证终端启动成功

- [ ] **步骤 3：测试多账号切换**

1. 添加第二个 Claude 账号
2. 创建终端时选择第二个账号
3. 验证对应配置文件已更新

- [ ] **步骤 4：测试其他 AI CLI（Codex、Gemini）**

1. 重复工作流，验证 Codex 和 Gemini 的配置写入正常

- [ ] **步骤 5：Commit 文档**

```bash
git add docs/features/ai-cli-config-management.md
git commit -m "docs(ai-config): add user documentation"
```

---

## 📊 完整任务清单

- [ ] **任务 1**: AI 配置类型定义 (Phase 1)
- [ ] **任务 2**: 配置文件持久化 API (Phase 1)
- [ ] **任务 3**: 配置管理 API (Phase 1)
- [ ] **任务 4**: IPC 处理器注册 (Phase 2)
- [ ] **任务 5**: Zustand Store (Phase 3)
- [ ] **任务 6**: AI CLI 预设定义 (Phase 3)
- [ ] **任务 7**: AI Config UI 组件库 (Phase 4)
- [ ] **任务 8**: 集成 CreateTerminalModal (Phase 4)
- [ ] **任务 9**: 配置写入逻辑 (Phase 5)
- [ ] **任务 10**: 端到端集成测试 (Phase 6)
- [ ] **任务 11**: 手动验证 + 文档 (Phase 6)

---

## 🔄 依赖关系图

```
Task 1 (Types)
    ↓
Task 2 (Persistence) → Task 3 (Manager)
                          ↓
                      Task 4 (IPC)
                          ↓
Tasks 5-6 (Store + Presets)
    ↓
Task 7-8 (UI Components)
    ↓
Task 9 (Config Writer)
    ↓
Task 10-11 (Integration + Docs)
```

---

## ⚙️ 技术检查清单

- [ ] 所有新文件遵循 2-space 缩进
- [ ] TypeScript 类型完整，无 `any`
- [ ] IPC 调用返回 `{ ok, data|error }` 标准格式
- [ ] 配置文件操作使用原子写入（.tmp 重命名）
- [ ] 文件路径跨平台兼容（Windows/macOS/Linux）
- [ ] 错误处理完整，有日志输出
- [ ] 单元测试覆盖核心逻辑
- [ ] 集成测试覆盖完整工作流

---

## 📝 验收标准（完成时检查）

- [ ] ✅ 用户可创建多个 Claude 账号
- [ ] ✅ 创建终端时能正确选择账号
- [ ] ✅ 配置正确写入 `~/.claude` 等位置
- [ ] ✅ 启动的 CLI 能正确使用配置
- [ ] ✅ 配置持久化到 `~/.ominiterm/ai-config.json`
- [ ] ✅ 支持 JSON 高级编辑模式
- [ ] ✅ 代码遵循 OminiTerm 规范
- [ ] ✅ 所有测试通过
- [ ] ✅ 无 TypeScript 错误
- [ ] ✅ 文档完整

