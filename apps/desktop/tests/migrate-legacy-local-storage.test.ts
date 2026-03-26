import test from "node:test";
import assert from "node:assert/strict";
import { migrateLegacyLocalStorage } from "../src/migrateLegacyLocalStorage.ts";

function installLocalStorage(initial: Record<string, string> = {}) {
  const backingStore = new Map(Object.entries(initial));

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return backingStore.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        backingStore.set(key, value);
      },
      removeItem(key: string) {
        backingStore.delete(key);
      },
    },
  });
}

test("migrateLegacyLocalStorage copies legacy keys into ominiterm keys", () => {
  installLocalStorage({
    "termcanvas-preferences": '{"animationBlur":1.5}',
    "termcanvas-locale": "zh",
    "termcanvas-welcome-seen": "1",
  });

  migrateLegacyLocalStorage();

  assert.equal(localStorage.getItem("ominiterm-preferences"), '{"animationBlur":1.5}');
  assert.equal(localStorage.getItem("ominiterm-locale"), "zh");
  assert.equal(localStorage.getItem("ominiterm-welcome-seen"), "1");
  assert.equal(localStorage.getItem("termcanvas-preferences"), null);
  assert.equal(localStorage.getItem("termcanvas-locale"), null);
  assert.equal(localStorage.getItem("termcanvas-welcome-seen"), null);
});

test("migrateLegacyLocalStorage preserves existing ominiterm keys", () => {
  installLocalStorage({
    "termcanvas-locale": "zh",
    "ominiterm-locale": "en",
  });

  migrateLegacyLocalStorage();

  assert.equal(localStorage.getItem("ominiterm-locale"), "en");
  assert.equal(localStorage.getItem("termcanvas-locale"), "zh");
});
