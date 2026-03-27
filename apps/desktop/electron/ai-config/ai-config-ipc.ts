import { ipcMain } from "electron";
import type { TerminalType } from "../../src/types/index";
import { aiConfigManager } from "./ai-config-manager";
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
      console.error("[IPC] ai-config:load-all failed:", err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
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
      console.error("[IPC] ai-config:get-by-type failed:", err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

  /**
   * 添加配置
   */
  ipcMain.handle("ai-config:add", (_event, config: AiCliConfig) => {
    try {
      aiConfigManager.addConfig(config);
      return { ok: true };
    } catch (err) {
      console.error("[IPC] ai-config:add failed:", err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
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
        return { ok: true };
      } catch (err) {
        console.error("[IPC] ai-config:update failed:", err);
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Unknown error",
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
      return { ok: true };
    } catch (err) {
      console.error("[IPC] ai-config:delete failed:", err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

  /**
   * 设置默认配置
   */
  ipcMain.handle("ai-config:set-default", (_event, configId: string) => {
    try {
      aiConfigManager.setDefaultConfig(configId);
      return { ok: true };
    } catch (err) {
      console.error("[IPC] ai-config:set-default failed:", err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
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
        const id = aiConfigManager.generateConfigId(type, baseName);
        return {
          ok: true,
          data: id,
        };
      } catch (err) {
        console.error("[IPC] ai-config:generate-id failed:", err);
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
  );

  console.log("[IPC] AI Config handlers registered");
}
