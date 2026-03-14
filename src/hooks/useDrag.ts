import { useRef, useCallback } from "react";

interface DragState {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export function useDrag(
  x: number,
  y: number,
  onMove: (x: number, y: number) => void,
) {
  const dragRef = useRef<DragState | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: x,
        origY: y,
      };

      const handleMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        onMove(
          dragRef.current.origX + ev.clientX - dragRef.current.startX,
          dragRef.current.origY + ev.clientY - dragRef.current.startY,
        );
      };

      const handleUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [x, y, onMove],
  );

  return handleMouseDown;
}
