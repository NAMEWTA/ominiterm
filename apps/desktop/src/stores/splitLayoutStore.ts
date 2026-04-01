import { create } from "zustand";
import type { BoardLayout, SplitNode, SplitDirection, SplitLeafNode, SplitBranchNode } from "../types";

interface SplitLayoutState {
  layouts: Record<string, BoardLayout>;
  getLayout: (projectId: string) => BoardLayout;
  setLayout: (projectId: string, layout: BoardLayout) => void;
  addTerminal: (projectId: string, terminalId: string, focusedTerminalId?: string | null) => void;
  removeTerminal: (projectId: string, terminalId: string) => void;
  splitPane: (projectId: string, terminalId: string, direction: SplitDirection, newTerminalId: string) => void;
  updateRatio: (projectId: string, path: number[], ratio: number) => void;
  syncWithTerminals: (projectId: string, terminalIds: string[]) => void;
}

const DEFAULT_LAYOUT: BoardLayout = { root: null };
const DEFAULT_RATIO = 0.5;

/**
 * Find a leaf node by terminal ID in the tree
 */
function findLeafPath(node: SplitNode, terminalId: string, path: number[] = []): number[] | null {
  if (node.type === "leaf") {
    return node.terminalId === terminalId ? path : null;
  }
  
  const firstPath = findLeafPath(node.first, terminalId, [...path, 0]);
  if (firstPath) return firstPath;
  
  return findLeafPath(node.second, terminalId, [...path, 1]);
}

/**
 * Get all terminal IDs from the layout tree
 */
function getAllTerminalIds(node: SplitNode | null): string[] {
  if (!node) return [];
  if (node.type === "leaf") return [node.terminalId];
  return [...getAllTerminalIds(node.first), ...getAllTerminalIds(node.second)];
}

/**
 * Get a node at a specific path in the tree
 */
function getNodeAtPath(node: SplitNode, path: number[]): SplitNode | null {
  if (path.length === 0) return node;
  
  if (node.type === "leaf") return null;
  
  const [head, ...rest] = path;
  const child = head === 0 ? node.first : node.second;
  return getNodeAtPath(child, rest);
}

/**
 * Update a node at a specific path in the tree
 */
function updateNodeAtPath(
  root: SplitNode,
  path: number[],
  updater: (node: SplitNode) => SplitNode,
): SplitNode {
  if (path.length === 0) {
    return updater(root);
  }
  
  if (root.type === "leaf") {
    return root;
  }
  
  const [head, ...rest] = path;
  if (head === 0) {
    return {
      ...root,
      first: updateNodeAtPath(root.first, rest, updater),
    };
  } else {
    return {
      ...root,
      second: updateNodeAtPath(root.second, rest, updater),
    };
  }
}

/**
 * Remove a leaf node and collapse its parent
 */
function removeLeafNode(root: SplitNode, terminalId: string): SplitNode | null {
  if (root.type === "leaf") {
    return root.terminalId === terminalId ? null : root;
  }
  
  // Check if target is direct child
  if (root.first.type === "leaf" && root.first.terminalId === terminalId) {
    return root.second;
  }
  if (root.second.type === "leaf" && root.second.terminalId === terminalId) {
    return root.first;
  }
  
  // Recursively search in children
  const newFirst = removeLeafNode(root.first, terminalId);
  if (newFirst !== root.first) {
    return newFirst ? { ...root, first: newFirst } : root.second;
  }
  
  const newSecond = removeLeafNode(root.second, terminalId);
  if (newSecond !== root.second) {
    return newSecond ? { ...root, second: newSecond } : root.first;
  }
  
  return root;
}

/**
 * Split a leaf node into two panes
 */
function splitLeafNode(
  root: SplitNode,
  terminalId: string,
  direction: SplitDirection,
  newTerminalId: string,
): SplitNode {
  if (root.type === "leaf") {
    if (root.terminalId === terminalId) {
      return {
        type: "split",
        direction,
        ratio: DEFAULT_RATIO,
        first: { type: "leaf", terminalId },
        second: { type: "leaf", terminalId: newTerminalId },
      };
    }
    return root;
  }
  
  return {
    ...root,
    first: splitLeafNode(root.first, terminalId, direction, newTerminalId),
    second: splitLeafNode(root.second, terminalId, direction, newTerminalId),
  };
}

/**
 * Find the last (rightmost/bottommost) leaf node
 */
function findLastLeaf(node: SplitNode): SplitLeafNode {
  if (node.type === "leaf") return node;
  return findLastLeaf(node.second);
}

export const useSplitLayoutStore = create<SplitLayoutState>((set, get) => ({
  layouts: {},

  getLayout: (projectId: string) => {
    return get().layouts[projectId] ?? DEFAULT_LAYOUT;
  },

  setLayout: (projectId: string, layout: BoardLayout) => {
    set((state) => ({
      layouts: { ...state.layouts, [projectId]: layout },
    }));
  },

  addTerminal: (projectId: string, terminalId: string, focusedTerminalId?: string | null) => {
    const layout = get().getLayout(projectId);
    
    // If no root, create first leaf
    if (!layout.root) {
      get().setLayout(projectId, {
        root: { type: "leaf", terminalId },
      });
      return;
    }
    
    // Find the terminal to split (focused or last)
    const existingIds = getAllTerminalIds(layout.root);
    const targetId = focusedTerminalId && existingIds.includes(focusedTerminalId)
      ? focusedTerminalId
      : findLastLeaf(layout.root).terminalId;
    
    // Split the target terminal horizontally
    const newRoot = splitLeafNode(layout.root, targetId, "horizontal", terminalId);
    get().setLayout(projectId, { root: newRoot });
  },

  removeTerminal: (projectId: string, terminalId: string) => {
    const layout = get().getLayout(projectId);
    if (!layout.root) return;
    
    const newRoot = removeLeafNode(layout.root, terminalId);
    get().setLayout(projectId, { root: newRoot });
  },

  splitPane: (projectId: string, terminalId: string, direction: SplitDirection, newTerminalId: string) => {
    const layout = get().getLayout(projectId);
    if (!layout.root) return;
    
    const newRoot = splitLeafNode(layout.root, terminalId, direction, newTerminalId);
    get().setLayout(projectId, { root: newRoot });
  },

  updateRatio: (projectId: string, path: number[], ratio: number) => {
    const layout = get().getLayout(projectId);
    if (!layout.root || layout.root.type === "leaf") return;
    
    if (path.length === 0) {
      // Update root ratio
      get().setLayout(projectId, {
        root: { ...layout.root, ratio },
      });
      return;
    }
    
    const newRoot = updateNodeAtPath(layout.root, path, (node) => {
      if (node.type === "split") {
        return { ...node, ratio };
      }
      return node;
    });
    
    get().setLayout(projectId, { root: newRoot });
  },

  syncWithTerminals: (projectId: string, terminalIds: string[]) => {
    const layout = get().getLayout(projectId);
    const existingIds = getAllTerminalIds(layout.root);
    
    // Handle empty terminal list
    if (terminalIds.length === 0) {
      if (layout.root !== null) {
        get().setLayout(projectId, { root: null });
      }
      return;
    }
    
    // Find terminals to add and remove
    const toAdd = terminalIds.filter((id) => !existingIds.includes(id));
    const toRemove = existingIds.filter((id) => !terminalIds.includes(id));
    
    let currentRoot = layout.root;
    
    // Remove terminals that no longer exist
    for (const id of toRemove) {
      if (currentRoot) {
        currentRoot = removeLeafNode(currentRoot, id);
      }
    }
    
    // Add new terminals
    for (const id of toAdd) {
      if (!currentRoot) {
        currentRoot = { type: "leaf", terminalId: id };
      } else {
        const lastLeaf = findLastLeaf(currentRoot);
        currentRoot = splitLeafNode(currentRoot, lastLeaf.terminalId, "horizontal", id);
      }
    }
    
    get().setLayout(projectId, { root: currentRoot });
  },
}));
