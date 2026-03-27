import type { TerminalType } from "../../src/types/index";

// ToolConfig 类型定义，避免使用 any
export type ToolConfigValue = string | number | boolean | object | null;
export type ToolConfig = Record<string, ToolConfigValue>;

export interface CommonAiConfig {
  apiKey: string;              // 必填：API Key
  baseUrl?: string;            // 可选：服务端点
  model?: string;              // 可选：模型名称
}

/**
 * Electron Main 进程中 AI CLI 配置的核心数据模型
 * 用于管理多个 AI 服务账户（Claude、Codex、Gemini 等）
 */
export interface AiCliConfig {
  /**
   * 配置的唯一标识符，格式推荐为 "{type}-{baseName}"
   * @example "claude-personal-1", "codex-work"
   */
  configId: string;
  
  /**
   * AI CLI 类型，必须与 configId 中的类型部分一致
   * @remarks configId 和 type 应保持同步；Manager 层负责验证
   */
  type: TerminalType;
  name: string;                 // 用户友好名称（如 "Personal", "Work"）
  providerName: string;         // 提供商名称（如 "Claude Official"）
  displayName: string;          // 完整显示名称（AI CLI - 账号名）
  description?: string;         // 可选描述

  commonConfig: CommonAiConfig; // 通用配置
  toolConfig: ToolConfig; // 工具特定配置，如 Codex 的 endpoint、headers 等

  createdAt: number;            // 创建时间戳
  updatedAt: number;            // 修改时间戳
  isDefault?: boolean;          // 是否为该类型默认配置
}

export interface AiConfigDatabase {
  version: 1;                   // 版本号
  configs: Record<string, AiCliConfig>;
  metadata: {
    lastUpdated: number;
    // 为未来版本迁移预留空间
  };
}

export const EMPTY_AI_CONFIG_DB: Readonly<AiConfigDatabase> = {
  version: 1,
  configs: {},
  metadata: {
    lastUpdated: 0, // 改为 0，由 Persistence 层设置实际时间
  },
};
