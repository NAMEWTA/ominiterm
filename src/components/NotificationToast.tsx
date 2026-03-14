import { useNotificationStore } from "../stores/notificationStore";

const typeConfig = {
  error: {
    border: "border-[#ee0000]/30",
    text: "text-[#ff4444]",
    label: "Error",
    dot: "bg-[#ee0000]",
  },
  warn: {
    border: "border-[#f5a623]/30",
    text: "text-[#f5a623]",
    label: "Warning",
    dot: "bg-[#f5a623]",
  },
  info: {
    border: "border-[#333]",
    text: "text-[#888]",
    label: "Info",
    dot: "bg-[#666]",
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
            className={`rounded-lg border px-4 py-3 bg-[#111] shadow-lg text-sm flex items-start gap-3 animate-[slideIn_0.2s_ease-out] ${config.border}`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${config.dot}`}
            />
            <div className="flex-1 min-w-0">
              <div
                className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 opacity-70 ${config.text}`}
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                {config.label}
              </div>
              <span className="text-[13px] break-words text-[#ededed]">
                {n.message}
              </span>
            </div>
            <button
              className="shrink-0 text-[#444] hover:text-[#ededed] transition-colors p-0.5"
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
