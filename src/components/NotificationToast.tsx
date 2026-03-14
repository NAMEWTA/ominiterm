import { useNotificationStore } from "../stores/notificationStore";

const typeConfig = {
  error: {
    bg: "bg-red-950/80 border-red-500/20",
    text: "text-red-300",
    label: "Error",
    dot: "bg-red-400",
  },
  warn: {
    bg: "bg-amber-950/80 border-amber-500/20",
    text: "text-amber-300",
    label: "Warning",
    dot: "bg-amber-400",
  },
  info: {
    bg: "bg-zinc-900/80 border-zinc-500/20",
    text: "text-zinc-300",
    label: "Info",
    dot: "bg-zinc-400",
  },
};

export function NotificationToast() {
  const { notifications, dismiss } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => {
        const config = typeConfig[n.type];
        return (
          <div
            key={n.id}
            className={`rounded-xl border px-4 py-3 backdrop-blur-xl shadow-2xl text-sm flex items-start gap-3 animate-[slideIn_0.2s_ease-out] ${config.bg}`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${config.dot}`}
            />
            <div className="flex-1 min-w-0">
              <div
                className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 opacity-70 ${config.text}`}
              >
                {config.label}
              </div>
              <span className={`text-[13px] break-words ${config.text}`}>
                {n.message}
              </span>
            </div>
            <button
              className="shrink-0 opacity-40 hover:opacity-100 transition-opacity text-zinc-300 p-0.5"
              onClick={() => dismiss(n.id)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M3 3L9 9M9 3L3 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
