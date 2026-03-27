# OminiTerm AI CLI 动态配置管理系统

**版本**: 1.0  
**日期**: 2026-03-27  
**作者**: Design Phase  
**状态**: 待规格审查

---

## 1. 概述

**目标**: 为 OminiTerm 增强 AI CLI 账号/配置管理能力，支持用户为同一 AI CLI 配置多个账号（如多个 Claude API Key），在创建终端时灵活选择和管理配置。

**范围**: 
- Claude Code、Codex、Gemini、OpenCode 等 AI CLI 的配置管理
- 全局级别配置数据库（`~/.ominiterm/ai-config.json`）
- UI：在新建终端 Modal 中集成账号选择和配置编辑
- Electron IPC 层处理配置持久化
- 启动时自动向对应 AI CLI 工具写入配置文件（`.claude`、`.codex`、`.gemini` 等）

---

## 2. 功能需求

### 2.1 配置管理

| 需求 | 描述 |
|------|------|
| **多账号支持** | 单个 AI CLI 类型支持配置多个账号，每个配置独立存储 |
| **配置持久化** | 配置存储在 `~/.ominiterm/ai-config.json` |
| **账号命名** | 用户可为账号自定义名称（如"个人账号"、"工作账号"） |
| **预设模板** | 提供各 AI CLI 类型的预设配置模板，降低用户配置成本 |
| **配置验证** | 支持基础字段验证，确保必填项（如 API Key）不为空 |

### 2.2 UI 交互

| 需求 | 描述 |
|------|------|
| **新建终端 Modal** | 在现有的终端创建面板中增加 AI CLI 类型和账号选择 |
| **账号下拉列表** | 根据选中的 AI CLI 类型，显示该类型的所有已保存账号 |
| **配置编辑** | 支持在 Modal 中查看和编辑当前选中账号的核心字段 |
| **快速新建账号** | "+ New Account" 按钮，快速添加新账号 |
| **高级模式** | JSON 编辑器模式，供高级用户添加自定义环境变量 |

### 2.3 启动集成

| 需求 | 描述 |
|------|------|
| **自动配置写入** | 创建终端时，自动将配置写入对应工具的配置文件 |
| **Claude** | API Key 作为环境变量传入 PTY |
| **Codex** | 生成 `~/.codex/auth.json` 和 `~/.codex/config.toml`，Codex 启动时读取 |
| **Gemini** | API Key 作为环境变量传入 PTY |
| **OpenCode** | 根据实际工具的配置方式支持 |

---

## 3. 数据模型

### 3.1 全局配置文件结构

**文件路径**: `~/.ominiterm/ai-config.json` (Windows: `%USERPROFILE%\.ominiterm\ai-config.json`)

```typescript
// TypeScript 定义
interface AiCliConfig {
  configId: string;          // 唯一标识，如 "claude-1", "codex-work-1"
  type: TerminalType;        // "claude" | "codex" | "gemini" | "opencode"
  name: string;              // 用户自定义名称，如 "Personal", "Work"
  providerName: string;      // 预设提供者名称，如 "Claude Official", "DeepSeek"
  displayName: string;       // 显示名称，如 "Claude - Personal"
  description?: string;      // 可选：配置描述
  
  // 通用字段（所有 AI CLI 共用）
  commonConfig: {
    apiKey: string;          // API Key（核心字段）
    baseUrl?: string;        // 服务端点 URL（可选）
    model?: string;          // 模型名称（可选）
  };
  
  // 工具特定配置
  toolConfig: Record<string, any>;  // Codex 专用配置等
  
  // 元数据
  createdAt: number;         // 创建时间戳
  updatedAt: number;         // 最后修改时间戳
  isDefault?: boolean;       // 是否为该类型的默认配置
}

interface AiConfigDatabase {
  version: 1;                // 版本号，支持将来迁移
  configs: Record<string, AiCliConfig>; // 按 configId 索引
  metadata: {
    lastUpdated: number;
  };
}

// 示例
{
  "version": 1,
  "configs": {
    "claude-personal-1": {
      "configId": "claude-personal-1",
      "type": "claude",
      "name": "Personal",
      "displayName": "Claude - Personal",
      "providerName": "Claude Official",
      "commonConfig": {
        "apiKey": "sk-ant-...",
        "baseUrl": "https://api.anthropic.com",
        "model": "claude-3-5-sonnet"
      },
      "toolConfig": {},
      "createdAt": 1711526400000,
      "updatedAt": 1711526400000,
      "isDefault": true
    },
    "codex-work-1": {
      "configId": "codex-work-1",
      "type": "codex",
      "name": "Work",
      "displayName": "Codex - Work",
      "providerName": "OpenAI Official",
      "commonConfig": {
        "apiKey": "sk-project-..."
      },
      "toolConfig": {
        // Codex 特定字段，如 OPENAI_ORG_ID 等
      },
      "createdAt": 1711526400000,
      "updatedAt": 1711526400000
    }
  },
  "metadata": {
    "lastUpdated": 1711526400000
  }
}
```

### 3.2 扩展点

```typescript
// 为各 AI CLI 定义的预设字段
interface CliPresetSchema {
  type: TerminalType;
  commonFields: Array<{
    key: string;
    label: string;
    placeholder: string;
    type: "text" | "password" | "url";
    required: boolean;
    hint?: string;
  }>;
  toolSpecificFields?: Record<string, any>;
  docUrl?: string;           // 配置说明链接
  examples?: Record<string, any>;  // 配置示例
}

// 预设列表（可在 config/aiCliPresets.ts 维护）
export const CliPresets: Record<TerminalType, CliPresetSchema> = {
  "claude": {
    type: "claude",
    commonFields: [
      { key: "apiKey", label: "API Key", placeholder: "sk-ant-...", type: "password", required: true },
      { key: "baseUrl", label: "Base URL", placeholder: "https://api.anthropic.com", type: "url", required: false },
      { key: "model", label: "Model", placeholder: "claude-3-5-sonnet", type: "text", required: false },
    ],
  },
  "codex": { /* ... */ },
  "gemini": { /* ... */ },
  // ...
};
```

---

## 4. 交互流程

### 4.1 新建终端流程

```mermaid
graph TD
    A["用户点击 新建终端"] --> B["打开 CreateTerminalModal"]
    B --> C["选择 AI CLI 类型"]
    C --> D["加载该类型的所有账号"]
    D --> E["显示账号下拉列表"]
    E --> F{"选择已有账号?"}
    F -->|是| G["显示该账号的配置（可编辑）"]
    F -->|否| H["点击 + New Account"]
    H --> I["打开新增账号对话框"]
    I --> J["填写账号信息']
    J --> K["保存账号到数据库"]
    K --> G
    G --> L["点击 Create Terminal"]
    L --> M["验证配置字段"]
    M --> N{"验证通过?"}
    N -->|否| O["显示错误提示"]
    O --> G
    N -->|是| P["调用 IPC 写入配置"]
    P --> Q["启动对应 AI CLI"]
    Q --> R["创建终端"]
```

### 4.2 账号管理流程

```
主菜单 / 设置
    ↓
AI CLI 多账号管理面板
    ├─ Claude 多账号列表
    │  ├─ 账号1 [Edit] [Delete] [SetDefault]
    │  ├─ 账号2 [Edit] [Delete]
    │  └─ [+ New Account]
    ├─ Codex 多账号列表
    ├─ Gemini 多账号列表
    └─ OpenCode 多账号列表
```

---

## 5. 技术实现

### 5.1 文件结构

```
apps/desktop/
├── electron/
│   ├── ai-config/
│   │   ├── ai-config-manager.ts       # 配置管理 API
│   │   ├── ai-config-persistence.ts   # 配置持久化
│   │   └── ai-config-ipc.ts           # IPC 处理器
│   └── pty-launch.ts                  # 扩展：支持配置注入
├── src/
│   ├── stores/
│   │   └── aiConfigStore.ts           # Zustand 配置 store
│   ├── components/
│   │   ├── CreateTerminalModal.tsx    # 扩展现有 Modal
│   │   └── AiCliConfigPanel.tsx       # 配置管理面板（可选）
│   ├── config/
│   │   └── aiCliPresets.ts            # AI CLI 预设定义
│   └── types/
│       └── ai-config.ts               # 配置类型定义
└── tests/
    └── ai-config-*.test.ts            # 单元测试
```

### 5.2 Electron IPC API

```typescript
// Renderer → Main
ipcRenderer.invoke('ai-config:load')                    // 加载所有配置
ipcRenderer.invoke('ai-config:save', config)           // 保存配置
ipcRenderer.invoke('ai-config:delete', configId)       // 删除配置
ipcRenderer.invoke('ai-config:get-by-type', type)      // 获取指定类型配置列表
ipcRenderer.invoke('ai-config:write-to-tool', {        // 写入工具配置文件
  configId,
  terminalType,
  workingDir?
})
```

### 5.3 配置写入策略

| AI CLI | 写入方式 | 写入位置 |
|--------|---------|---------|
| **Claude** | 环境变量 + 文件 | `%USERPROFILE%\.claude` (Windows) / `~/.claude` (Unix) |
| **Codex** | 专用文件 | `%LOCALAPPDATA%\OpenAI\Codex` (Windows) / `~/.codex` (Unix) |
| **Gemini** | 环境变量 + 文件 | `~/.gemini` |
| **OpenCode** | 根据工具定义 | TBD |

---

## 6. 核心组件设计

### 6.1 CreateTerminalModal 扩展

```typescript
interface CreateTerminalModalProps {
  open: boolean;
  projectId: string;
  worktreeId: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (terminalData: TerminalData) => void;
}

// 新增字段
interface CreateTerminalModalState {
  selectedCliType: TerminalType;
  selectedConfigId: string;
  configOverrides?: Record<string, any>;  // 临时编辑
  advancedMode: boolean;                  // 是否显示高级 JSON 编辑器
  terminalTitle: string;
}
```

### 6.2 AI Config Store

```typescript
interface AiConfigStore {
  // 状态
  configs: Record<string, AiCliConfig>;
  loading: boolean;
  error: string | null;
  
  // 操作
  loadConfigs: () => Promise<void>;
  addConfig: (config: AiCliConfig) => Promise<void>;
  updateConfig: (configId: string, updates: Partial<AiCliConfig>) => Promise<void>;
  deleteConfig: (configId: string) => Promise<void>;
  getConfigsByType: (type: TerminalType) => AiCliConfig[];
  getDefaultConfig: (type: TerminalType) => AiCliConfig | null;
  setDefaultConfig: (configId: string) => Promise<void>;
}
```

### 6.3 配置管理 API（Electron Main）

```typescript
export class AiConfigManager {
  load(): AiConfigDatabase { /* 从文件加载 */ }
  save(db: AiConfigDatabase): void { /* 保存到文件 */ }
  
  addConfig(config: AiCliConfig): void { /* 新增 */ }
  updateConfig(configId: string, updates: Partial<AiCliConfig>): void { /* 更新 */ }
  deleteConfig(configId: string): void { /* 删除 */ }
  
  getConfigsByType(type: TerminalType): AiCliConfig[] { /* 按类型查询 */ }
  getConfig(configId: string): AiCliConfig | null { /* 按 ID 查询 */ }
  
  writeConfigToTool(configId: string, toolType: TerminalType, workDir?: string): Promise<void>
  { /* 写入工具配置 */ }
}
```

---

## 7. 扩展性设计

### 7.1 添加新 AI CLI 工具

1. **扩展 TerminalType**：在 `types/index.ts` 中添加新类型
2. **定义预设**：在 `config/aiCliPresets.ts` 中添加字段定义
3. **实现配置写入**：在 `ai-config-manager.ts` 中添加 `switch` 分支
4. **更新 UI**：组件会自动展示新类型

### 7.2 支持自定义供应商

通过高级模式（JSON 编辑器），用户可添加任意环境变量，支持：
- 第三方 Claude API 代理（DeepSeek、Kimi 等）
- 企业私有部署
- 自定义端点

### 7.3 备用配置链

预留 `toolConfig` 字段，支持未来的 failover、endpoint rotation 等高级特性。

---

## 8. 错误处理

| 场景 | 处理策略 |
|------|---------|
| **配置文件损坏** | 备份原文件，初始化新配置 DB |
| **缺少必填字段** | 显示表单级验证错误，阻止创建 |
| **写入配置失败** | 显示 Toast 错误，允许重试 |
| **权限不足** | 提示用户权限问题，建议诊断方向 |

---

## 9. 测试策略

### 9.1 单元测试

- [ ] `ai-config-manager.test.ts`: 增删改查操作
- [ ] `ai-config-persistence.test.ts`: 文件读写
- [ ] 配置验证逻辑

### 9.2 集成测试

- [ ] 完整的新建终端流程
- [ ] 配置写入到不同工具的流程
- [ ] 账号切换时的配置更新

### 9.3 端到端测试

- [ ] Modal 交互
- [ ] 保存后能否正确启动 AI CLI
- [ ] 跨启动的配置持久化

---

## 10. 向后兼容性

- 旧版本（未启用此功能）的终端创建逻辑保持不变
- 配置数据库采用版本号，支持将来迁移
- 现有 `projectStore` 中的 TerminalData 结构通过可选字段扩展，不破坏现有使用

---

## 11. 后续工作

- [ ] **第2阶段**: 账号故障转移、端点轮询（Codex/Gemini）
- [ ] **第3阶段**: 项目级别配置覆盖（`.ominiterm.json` in git repo）
- [ ] **第4阶段**: 配置版本管理 / 导入导出

---

## 12. 验收标准

- [ ] 用户可在 Modal 中创建多个 Claude 账号
- [ ] 创建终端时能正确选择账号
- [ ] 配置正确写入 `~/.claude` 等位置
- [ ] 启动的 Claude CLI 能使用配置
- [ ] 配置持久化到 `~/.ominiterm/ai-config.json`
- [ ] 支持 JSON 高级编辑模式
- [ ] 代码遵循 OminiTerm 的技术规范（Zustand、Electron IPC、2-space 缩进等）

