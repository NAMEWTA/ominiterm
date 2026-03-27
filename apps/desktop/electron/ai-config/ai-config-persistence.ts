import fs from "fs";
import path from "path";
import { OMINITERM_DIR } from "../state-persistence.ts";
import type {
  AiConfigDatabase,
  AiCliConfig,
} from "./ai-config-types.ts";
import {
  EMPTY_AI_CONFIG_DB,
} from "./ai-config-types.ts";

let AI_CONFIG_FILE = path.join(OMINITERM_DIR, "ai-config.json");

function createEmptyDb(): AiConfigDatabase {
  return {
    version: EMPTY_AI_CONFIG_DB.version,
    configs: {},
    metadata: {
      lastUpdated: EMPTY_AI_CONFIG_DB.metadata.lastUpdated,
    },
  };
}

export class AiConfigPersistence {
  /**
   * 仅用于测试：设置自定义配置文件路径
   */
  static _setConfigFileForTesting(filePath: string): void {
    AI_CONFIG_FILE = filePath;
  }

  /**
   * 仅用于测试：重置为默认配置文件路径
   */
  static _resetConfigFilePath(): void {
    AI_CONFIG_FILE = path.join(OMINITERM_DIR, "ai-config.json");
  }
  /**
   * 加载配置数据库
   * @returns 配置数据库，文件不存在时返回空数据库
   */
  static load(): AiConfigDatabase {
    try {
      if (!fs.existsSync(AI_CONFIG_FILE)) {
        return createEmptyDb();
      }

      const data = fs.readFileSync(AI_CONFIG_FILE, "utf-8");
      const db = JSON.parse(data) as AiConfigDatabase;

      // 验证版本号
      if (db.version !== 1) {
        console.warn(
          `[AiConfigPersistence] Unknown version: ${db.version}, initializing new DB`,
        );
        return createEmptyDb();
      }

      return db;
    } catch (err) {
      console.error("[AiConfigPersistence] Failed to load config:", err);
      return createEmptyDb();
    }
  }

  /**
   * 保存配置数据库
   * @param db 要保存的数据库
   */
  static save(db: AiConfigDatabase): void {
    try {
      const dbToSave: AiConfigDatabase = {
        ...db,
        metadata: {
          ...db.metadata,
          lastUpdated: Date.now(),
        },
      };
      const tmp = AI_CONFIG_FILE + ".tmp";
      const content = JSON.stringify(dbToSave, null, 2);
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
      } else {
        console.warn("[AiConfigPersistence] Backup skipped: config file does not exist");
      }
    } catch (err) {
      console.warn("[AiConfigPersistence] Backup failed:", err);
    }
  }
}
