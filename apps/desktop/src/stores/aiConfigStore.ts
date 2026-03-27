import { create } from "zustand";

import type { TerminalType } from "../types/index";
import type { AiCliConfig } from "../types/ai-config";

interface AiConfigState {
  configs: Record<string, AiCliConfig>;
  loading: boolean;
  error: string | null;

  loadConfigs: () => Promise<void>;
  addConfig: (config: AiCliConfig) => Promise<void>;
  updateConfig: (configId: string, updates: Partial<AiCliConfig>) => Promise<void>;
  deleteConfig: (configId: string) => Promise<void>;
  setDefaultConfig: (configId: string) => Promise<void>;

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
      const result = await window.ominiterm.aiConfigApi.loadAll();
      if (!result.ok) {
        set({ error: result.error || "Failed to load configs", loading: false });
        return;
      }

      const configs: Record<string, AiCliConfig> = {};
      (result.data || []).forEach((cfg) => {
        configs[cfg.configId] = cfg;
      });
      set({ configs, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Unknown error",
        loading: false,
      });
    }
  },

  addConfig: async (config) => {
    set({ error: null });
    try {
      const result = await window.ominiterm.aiConfigApi.add(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      await get().loadConfigs();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to add config" });
      throw err;
    }
  },

  updateConfig: async (configId, updates) => {
    set({ error: null });
    try {
      const result = await window.ominiterm.aiConfigApi.update(configId, updates);
      if (!result.ok) {
        throw new Error(result.error);
      }
      await get().loadConfigs();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update config" });
      throw err;
    }
  },

  deleteConfig: async (configId) => {
    set({ error: null });
    try {
      const result = await window.ominiterm.aiConfigApi.delete(configId);
      if (!result.ok) {
        throw new Error(result.error);
      }
      await get().loadConfigs();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete config" });
      throw err;
    }
  },

  setDefaultConfig: async (configId) => {
    set({ error: null });
    try {
      const result = await window.ominiterm.aiConfigApi.setDefault(configId);
      if (!result.ok) {
        throw new Error(result.error);
      }
      await get().loadConfigs();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to set default config" });
      throw err;
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
    const result = await window.ominiterm.aiConfigApi.generateId(type, baseName);
    if (!result.ok) {
      throw new Error(result.error || "Failed to generate ID");
    }

    if (result.data) {
      return result.data;
    }

    throw new Error("Failed to generate ID");
  },
}));
