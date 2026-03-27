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
