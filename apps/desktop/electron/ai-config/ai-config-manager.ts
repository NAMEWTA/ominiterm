import type { TerminalType } from "../../src/types/index";
import { AiConfigPersistence } from "./ai-config-persistence.ts";
import type {
  AiCliConfig,
  AiConfigDatabase,
} from "./ai-config-types.ts";

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

  private cloneConfig(config: AiCliConfig): AiCliConfig {
    return JSON.parse(JSON.stringify(config)) as AiCliConfig;
  }

  private cloneConfigs(configs: Record<string, AiCliConfig>): Record<string, AiCliConfig> {
    return JSON.parse(JSON.stringify(configs)) as Record<string, AiCliConfig>;
  }

  private clearDefaultForType(type: TerminalType, excludeConfigId?: string): void {
    Object.values(this.db.configs).forEach((cfg) => {
      if (cfg.type === type && cfg.configId !== excludeConfigId) {
        cfg.isDefault = false;
      }
    });
  }

  private validateConfigIdAndType(configId: string, type: TerminalType): void {
    const prefix = configId.split("-")[0];
    if (prefix !== type) {
      throw new Error(
        `Config ID prefix '${prefix}' does not match type '${type}'. Config ID should start with '${type}-'`,
      );
    }
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): AiCliConfig[] {
    return Object.values(this.db.configs).map((cfg) => this.cloneConfig(cfg));
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
    const config = this.db.configs[configId];
    if (!config) {
      return null;
    }
    return this.cloneConfig(config);
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
    this.validateConfigIdAndType(config.configId, config.type);

    if (this.hasConfig(config.configId)) {
      throw new Error(
        `Configuration with ID '${config.configId}' already exists`,
      );
    }

    const now = Date.now();
    const configToStore = this.cloneConfig({
      ...config,
      createdAt: now,
      updatedAt: now,
    });

    const originalConfigs = this.cloneConfigs(this.db.configs);

    if (configToStore.isDefault) {
      this.clearDefaultForType(configToStore.type, configToStore.configId);
    }

    this.db.configs[config.configId] = configToStore;

    try {
      AiConfigPersistence.save(this.db);
    } catch (err) {
      this.db.configs = originalConfigs;
      throw err;
    }

    console.log(`[AiConfigManager] Config added: ${config.configId}`);
  }

  /**
   * 更新配置
   */
  updateConfig(configId: string, updates: Partial<AiCliConfig>): void {
    const config = this.db.configs[configId];
    if (!config) {
      throw new Error(`Configuration with ID '${configId}' not found`);
    }

    const newType = updates.type ?? config.type;
    this.validateConfigIdAndType(configId, newType);

    const originalConfigs = this.cloneConfigs(this.db.configs);

    const updated: AiCliConfig = this.cloneConfig({
      ...config,
      ...updates,
      configId,
      createdAt: config.createdAt,
      updatedAt: Date.now(),
    });

    if (updated.isDefault) {
      this.clearDefaultForType(updated.type, configId);
    }

    this.db.configs[configId] = updated;

    try {
      AiConfigPersistence.save(this.db);
    } catch (err) {
      this.db.configs = originalConfigs;
      throw err;
    }

    console.log(`[AiConfigManager] Config updated: ${configId}`);
  }

  /**
   * 删除配置
   */
  deleteConfig(configId: string): void {
    if (!this.hasConfig(configId)) {
      throw new Error(`Configuration with ID '${configId}' not found`);
    }

    const originalConfigs = this.cloneConfigs(this.db.configs);

    delete this.db.configs[configId];

    try {
      AiConfigPersistence.save(this.db);
    } catch (err) {
      this.db.configs = originalConfigs;
      throw err;
    }

    console.log(`[AiConfigManager] Config deleted: ${configId}`);
  }

  /**
   * 设置默认配置
   */
  setDefaultConfig(configId: string): void {
    const config = this.db.configs[configId];
    if (!config) {
      throw new Error(`Configuration with ID '${configId}' not found`);
    }

    const originalConfigs = this.cloneConfigs(this.db.configs);
    const type = config.type;

    // 清除同类型的其他默认标记
    this.clearDefaultForType(type, configId);

    config.isDefault = true;

    try {
      AiConfigPersistence.save(this.db);
    } catch (err) {
      this.db.configs = originalConfigs;
      throw err;
    }

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