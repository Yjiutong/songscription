"use client";

/**
 * 窗口没有边框的时候，四条边得有人接着。
 *
 * `decorations: false` 拿走了 Windows 贴在窗口上的那一圈：标题栏、阴影、以及
 * 四边上"拖这里可以改大小"的抓手。前两个这一不计较，第三个得自己补——不然一
 * 个人把鼠标放到窗口底边上，光标告诉他这里可以拖，拖了却没反应，那就是在骗
 * 他。
 *
 * 每条把手只有 3px：够抽中，又不至于把内容挤走。四个角错开 12px 是因为角
 * 上本来就该同时能改两个方向。
 */

const EDGES = [
  { direction: "North", className: "left-1.5 right-1.5 top-0 h-[3px] cursor-ns-resize" },
  { direction: "South", className: "left-1.5 right-1.5 bottom-0 h-[3px] cursor-ns-resize" },
  { direction: "West", className: "top-1.5 bottom-1.5 left-0 w-[3px] cursor-ew-resize" },
  { direction: "East", className: "top-1.5 bottom-1.5 right-0 w-[3px] cursor-ew-resize" },
  { direction: "NorthWest", className: "left-0 top-0 h-3 w-3 cursor-nwse-resize" },
  { direction: "NorthEast", className: "right-0 top-0 h-3 w-3 cursor-nesw-resize" },
  { direction: "SouthWest", className: "bottom-0 left-0 h-3 w-3 cursor-nesw-resize" },
  { direction: "SouthEast", className: "bottom-0 right-0 h-3 w-3 cursor-nwse-resize" },
] as const;

export function WindowEdges() {
  if (!isDesktop()) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
      {EDGES.map((edge) => (
        <div
          key={edge.direction}
          className={`pointer-events-auto absolute ${edge.className}`}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            void startResizing(edge.direction);
          }}
        />
      ))}
    </div>
  );
}

async function startResizing(direction: string): Promise<void> {
  if (!isDesktop()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startResizeDragging(direction as never);
  } catch {
    // 拖不动就把这一下丢掉：比起弹一个报错，什么都没发生更像桌面该有的样子。
  }
}

function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
