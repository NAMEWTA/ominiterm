import { useCallback, useEffect, useRef, useState } from "react";
import type { SplitNode } from "../types";

interface SplitPaneProps {
  node: SplitNode;
  path?: number[];
  onUpdateRatio: (path: number[], ratio: number) => void;
  renderTerminal: (terminalId: string) => React.ReactNode;
}

const MIN_PANE_SIZE = 100; // Minimum pane size in pixels
const DIVIDER_SIZE = 4; // Divider width/height in pixels

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface DividerProps {
  direction: "horizontal" | "vertical";
  ratio: number;
  path: number[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onUpdateRatio: (path: number[], ratio: number) => void;
}

function Divider({
  direction,
  ratio,
  path,
  containerRef,
  onUpdateRatio,
}: DividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const startRatioRef = useRef(ratio);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      startPosRef.current = direction === "horizontal" ? e.clientX : e.clientY;
      startRatioRef.current = ratio;
    },
    [direction, ratio],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const containerSize = direction === "horizontal" ? rect.width : rect.height;
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      
      // Calculate new ratio, ensuring minimum pane sizes
      const minRatio = MIN_PANE_SIZE / containerSize;
      const maxRatio = 1 - MIN_PANE_SIZE / containerSize;
      const newRatio = clamp(startRatioRef.current + delta / containerSize, minRatio, maxRatio);
      
      onUpdateRatio(path, newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Add cursor style to body during drag
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, direction, path, onUpdateRatio, containerRef]);

  return (
    <div
      className={`flex-shrink-0 ${
        direction === "horizontal"
          ? "w-1 cursor-col-resize"
          : "h-1 cursor-row-resize"
      } ${
        isDragging
          ? "bg-[var(--accent)]"
          : "bg-[var(--border)] hover:bg-[var(--accent)]/50"
      } transition-colors duration-100`}
      style={{
        [direction === "horizontal" ? "width" : "height"]: `${DIVIDER_SIZE}px`,
      }}
      onMouseDown={handleMouseDown}
    />
  );
}

export function SplitPane({
  node,
  path = [],
  onUpdateRatio,
  renderTerminal,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Leaf node - render the terminal
  if (node.type === "leaf") {
    return (
      <div className="h-full w-full min-h-0 min-w-0">
        {renderTerminal(node.terminalId)}
      </div>
    );
  }

  // Branch node - render two children with a divider
  const { direction, ratio, first, second } = node;
  const isHorizontal = direction === "horizontal";

  // Calculate flex basis for each pane
  const firstBasis = `calc(${ratio * 100}% - ${DIVIDER_SIZE / 2}px)`;
  const secondBasis = `calc(${(1 - ratio) * 100}% - ${DIVIDER_SIZE / 2}px)`;

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full min-h-0 min-w-0 ${
        isHorizontal ? "flex-row" : "flex-col"
      }`}
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ flexBasis: firstBasis, flexGrow: 0, flexShrink: 0 }}
      >
        <SplitPane
          node={first}
          path={[...path, 0]}
          onUpdateRatio={onUpdateRatio}
          renderTerminal={renderTerminal}
        />
      </div>

      <Divider
        direction={direction}
        ratio={ratio}
        path={path}
        containerRef={containerRef}
        onUpdateRatio={onUpdateRatio}
      />

      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ flexBasis: secondBasis, flexGrow: 0, flexShrink: 0 }}
      >
        <SplitPane
          node={second}
          path={[...path, 1]}
          onUpdateRatio={onUpdateRatio}
          renderTerminal={renderTerminal}
        />
      </div>
    </div>
  );
}
