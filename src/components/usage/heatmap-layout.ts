export const HEATMAP_LAYOUT = {
  cellSize: 10,
  gridGap: 3,
  monthLabelLineHeight: 12,
  monthLabelRowHeight: 16,
  weekdayLabelWidth: 14,
} as const;

export function hasMonthLabelBottomClearance(layout = HEATMAP_LAYOUT): boolean {
  return layout.monthLabelRowHeight - layout.monthLabelLineHeight >= layout.gridGap;
}
