import test from "node:test";
import assert from "node:assert/strict";

import type { AiCliConfig } from "../src/types/ai-config.ts";
import { useAiConfigStore } from "../src/stores/aiConfigStore.ts";

interface AiConfigApiResponse<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface MockAiConfigApi {
  loadAll: () => Promise<AiConfigApiResponse<AiCliConfig[]>>;
  add: (config: AiCliConfig) => Promise<AiConfigApiResponse>;
  update: (configId: string, updates: Partial<AiCliConfig>) => Promise<AiConfigApiResponse>;
  delete: (configId: string) => Promise<AiConfigApiResponse>;
  setDefault: (configId: string) => Promise<AiConfigApiResponse>;
  generateId: (type: string, baseName: string) => Promise<AiConfigApiResponse<string>>;
}

function setAiConfigApi(api: MockAiConfigApi) {
  (globalThis as { window?: unknown }).window = {
    ominiterm: {
      aiConfigApi: api,
    },
  };
}

function resetStore() {
  useAiConfigStore.setState({
    configs: {},
    loading: false,
    error: null,
  });
}

function makeConfig(configId: string, isDefault = false): AiCliConfig {
  const now = Date.now();
  return {
    configId,
    type: "claude",
    name: configId,
    providerName: "Claude Official",
    displayName: `Claude - ${configId}`,
    commonConfig: {
      apiKey: "sk-test",
    },
    toolConfig: {},
    createdAt: now,
    updatedAt: now,
    isDefault,
  };
}

test("loadConfigs populates map and helper getters", async () => {
  resetStore();
  const personal = makeConfig("claude-personal", true);
  const work = makeConfig("claude-work");

  setAiConfigApi({
    loadAll: async () => ({ ok: true, data: [personal, work] }),
    add: async () => ({ ok: true }),
    update: async () => ({ ok: true }),
    delete: async () => ({ ok: true }),
    setDefault: async () => ({ ok: true }),
    generateId: async () => ({ ok: true, data: "claude-generated" }),
  });

  await useAiConfigStore.getState().loadConfigs();

  const state = useAiConfigStore.getState();
  assert.equal(Object.keys(state.configs).length, 2);
  assert.equal(state.getConfig("claude-work")?.name, "claude-work");
  assert.equal(state.getConfigsByType("claude").length, 2);
  assert.equal(state.getDefaultConfig("claude")?.configId, "claude-personal");
});

test("addConfig reloads state from loadAll", async () => {
  resetStore();
  const entries: AiCliConfig[] = [];

  setAiConfigApi({
    loadAll: async () => ({ ok: true, data: entries }),
    add: async (config) => {
      entries.push(config);
      return { ok: true };
    },
    update: async () => ({ ok: true }),
    delete: async () => ({ ok: true }),
    setDefault: async () => ({ ok: true }),
    generateId: async () => ({ ok: true, data: "claude-generated" }),
  });

  await useAiConfigStore.getState().addConfig(makeConfig("claude-added"));

  const state = useAiConfigStore.getState();
  assert.equal(state.getConfig("claude-added")?.configId, "claude-added");
});

test("updateConfig failure sets error and rejects", async () => {
  resetStore();
  const expectedError = "update rejected";

  setAiConfigApi({
    loadAll: async () => ({ ok: true, data: [] }),
    add: async () => ({ ok: true }),
    update: async () => ({ ok: false, error: expectedError }),
    delete: async () => ({ ok: true }),
    setDefault: async () => ({ ok: true }),
    generateId: async () => ({ ok: true, data: "claude-generated" }),
  });

  await assert.rejects(
    () => useAiConfigStore.getState().updateConfig("claude-1", { name: "Updated" }),
    {
      message: expectedError,
    },
  );

  assert.equal(useAiConfigStore.getState().error, expectedError);
});
