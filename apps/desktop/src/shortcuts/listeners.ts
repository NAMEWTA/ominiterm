export const SHORTCUT_LISTENER_CAPTURE = true;

type KeyboardListener = (event: KeyboardEvent) => void;
type ListenerTarget = Pick<Window, "addEventListener" | "removeEventListener">;

export function registerWindowKeydownListener(
  target: ListenerTarget,
  listener: KeyboardListener,
) {
  target.addEventListener("keydown", listener, SHORTCUT_LISTENER_CAPTURE);
  return () => {
    target.removeEventListener("keydown", listener, SHORTCUT_LISTENER_CAPTURE);
  };
}

export function registerWindowKeyupListener(
  target: ListenerTarget,
  listener: KeyboardListener,
) {
  target.addEventListener("keyup", listener, SHORTCUT_LISTENER_CAPTURE);
  return () => {
    target.removeEventListener("keyup", listener, SHORTCUT_LISTENER_CAPTURE);
  };
}
