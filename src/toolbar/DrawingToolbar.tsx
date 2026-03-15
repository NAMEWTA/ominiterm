import { useDrawingStore, type DrawingTool } from "../stores/drawingStore";

const tools: { id: DrawingTool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "pen", label: "Pen", icon: "✎" },
  { id: "text", label: "Text", icon: "T" },
  { id: "rect", label: "Rect", icon: "□" },
  { id: "arrow", label: "Arrow", icon: "→" },
];

const colors = [
  "#ededed",
  "#0070f3",
  "#ee0000",
  "#f5a623",
  "#7928ca",
  "#50e3c2",
];

export function DrawingToolbar() {
  const { tool, color, setTool, setColor, clearAll, elements } =
    useDrawingStore();

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#333] bg-[#0a0a0a]"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {/* Tools */}
      {tools.map((t) => (
        <button
          key={t.id}
          className={`px-2.5 py-1 rounded-md text-[13px] transition-colors ${
            tool === t.id
              ? "bg-[#1a1a1a] text-[#ededed]"
              : "text-[#666] hover:text-[#ededed] hover:bg-[#111]"
          }`}
          onClick={() => setTool(t.id)}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}

      <div className="w-px h-5 bg-[#333] mx-1" />

      {/* Colors */}
      {colors.map((c) => (
        <button
          key={c}
          className="w-5 h-5 rounded-full transition-transform"
          style={{
            backgroundColor: c,
            outline:
              color === c ? "2px solid #ededed" : "2px solid transparent",
            outlineOffset: 1,
            transform: color === c ? "scale(1.1)" : "scale(1)",
          }}
          onClick={() => setColor(c)}
        />
      ))}

      {elements.length > 0 && (
        <>
          <div className="w-px h-5 bg-[#333] mx-1" />
          <button
            className="px-2 py-1 rounded-md text-[11px] text-[#666] hover:text-[#ee0000] hover:bg-[#111] transition-colors"
            onClick={clearAll}
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
