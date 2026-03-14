import { useNotificationStore } from "../stores/notificationStore";

const typeStyles = {
  error: "bg-red-900/90 border-red-700 text-red-200",
  warn: "bg-yellow-900/90 border-yellow-700 text-yellow-200",
  info: "bg-zinc-800/90 border-zinc-600 text-zinc-200",
};

const typeLabels = {
  error: "Error",
  warn: "Warning",
  info: "Info",
};

export function NotificationToast() {
  const { notifications, dismiss } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`rounded-lg border px-4 py-3 shadow-lg backdrop-blur text-sm flex items-start gap-2 ${typeStyles[n.type]}`}
        >
          <span className="font-mono text-xs opacity-70 shrink-0 mt-0.5">
            [{typeLabels[n.type]}]
          </span>
          <span className="flex-1 break-words">{n.message}</span>
          <button
            className="shrink-0 opacity-50 hover:opacity-100 text-xs"
            onClick={() => dismiss(n.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
