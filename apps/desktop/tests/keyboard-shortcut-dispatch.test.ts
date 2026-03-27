import test from "node:test";
import assert from "node:assert/strict";

import {
  registerWindowKeydownListener,
  registerWindowKeyupListener,
} from "../src/shortcuts/listeners.ts";

type KeyListener = (event: FakeKeyboardEvent) => void;

class FakeKeyboardEvent {
  cancelBubble = false;

  stopPropagation() {
    this.cancelBubble = true;
  }
}

class FakeWindowTarget {
  private readonly listeners = new Map<string, { capture: boolean; listener: KeyListener }[]>();

  addEventListener(
    type: string,
    listener: KeyListener,
    options?: boolean | AddEventListenerOptions,
  ) {
    const capture =
      options === true ||
      (typeof options === "object" && options?.capture === true);
    const current = this.listeners.get(type) ?? [];
    current.push({ capture, listener });
    this.listeners.set(type, current);
  }

  removeEventListener(
    type: string,
    listener: KeyListener,
    options?: boolean | EventListenerOptions,
  ) {
    const capture =
      options === true ||
      (typeof options === "object" && options?.capture === true);
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      current.filter(
        (entry) => entry.capture !== capture || entry.listener !== listener,
      ),
    );
  }

  dispatch(type: string, event: FakeKeyboardEvent) {
    const current = this.listeners.get(type) ?? [];
    for (const entry of current.filter((item) => item.capture)) {
      entry.listener(event);
    }
    if (event.cancelBubble) {
      return;
    }
    for (const entry of current.filter((item) => !item.capture)) {
      entry.listener(event);
      if (event.cancelBubble) {
        return;
      }
    }
  }
}

test("keydown shortcut listeners run before terminal bubble handlers stop propagation", () => {
  const fakeWindow = new FakeWindowTarget();
  const calls: string[] = [];
  const dispose = registerWindowKeydownListener(
    fakeWindow as unknown as Window,
    () => {
      calls.push("app");
    },
  );

  fakeWindow.addEventListener("keydown", (event) => {
    calls.push("terminal");
    event.stopPropagation();
  });

  fakeWindow.dispatch("keydown", new FakeKeyboardEvent());
  dispose();

  assert.deepEqual(calls, ["app", "terminal"]);
});

test("keyup shortcut listeners also register in capture phase", () => {
  const fakeWindow = new FakeWindowTarget();
  const calls: string[] = [];
  const dispose = registerWindowKeyupListener(
    fakeWindow as unknown as Window,
    () => {
      calls.push("app");
    },
  );

  fakeWindow.addEventListener("keyup", (event) => {
    calls.push("terminal");
    event.stopPropagation();
  });

  fakeWindow.dispatch("keyup", new FakeKeyboardEvent());
  dispose();

  assert.deepEqual(calls, ["app", "terminal"]);
});
