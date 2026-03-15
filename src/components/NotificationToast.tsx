import { useNotificationStore } from "../stores/notificationStore";

const typeConfig = {
  error: { color: "#ee0000", label: "Error" },
  warn: { color: "#f5a623", label: "Warning" },
  info: { color: "#888", label: "Info" },
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
            className="rounded-md border border-[#222] px-4 py-3 bg-[#111] flex items-start gap-3 animate-[slideIn_0.2s_ease-out]"
          >
            <div
              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="text-[11px] font-medium uppercase tracking-wider mb-0.5"
                style={{
                  color: config.color,
                  fontFamily: '"Geist Mono", monospace',
                  opacity: 0.7,
                }}
              >
                {config.label}
              </div>
              <span className="text-[13px] break-words text-[#ededed]">
                {n.message}
              </span>
            </div>
            <button
              className="shrink-0 text-[#333] hover:text-[#ededed] transition-colors duration-150 p-0.5"
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
