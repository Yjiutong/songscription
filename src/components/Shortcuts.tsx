"use client";

import { X } from "lucide-react";

/**
 * 快捷键那一张。
 *
 * 这一页不是给人读的说明书，是按了不管用的时候回头来找的那个地方。所以只列
 * 真正存在、真正做了事的键——写上去却按不动，比不写更糟。
 */

const SHORTCUTS: { keys: string[]; what: string }[] = [
  { keys: ["Ctrl", "F"], what: "跳到搜索框" },
  { keys: ["/"], what: "同上" },
  { keys: ["Ctrl", ","], what: "打开设置" },
  { keys: ["←", "→"], what: "翻桌面上的谱子" },
  { keys: ["Alt", "E"], what: "打开「编辑」菜单" },
  { keys: ["Alt", "W"], what: "打开「窗口」菜单" },
  { keys: ["Alt", "H"], what: "打开「帮助」菜单" },
  { keys: ["Alt", "A"], what: "打开「关于」菜单" },
  { keys: ["Esc"], what: "关掉正浮在上面的东西" },
];

export function Shortcuts({ onClose }: { onClose(): void }) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-graphite/35 px-4 pt-16 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet sheet-raised w-full max-w-md px-6 py-5">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="flex-1 font-book text-[19px] font-semibold text-graphite">快捷键</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关掉"
            className="text-graphite-soft transition-colors hover:text-graphite"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <ul className="divide-y divide-rule border-y border-rule">
          {SHORTCUTS.map((row) => (
            <li key={row.what} className="flex items-center gap-4 py-2">
              <span className="flex shrink-0 items-center gap-1">
                {row.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded-[3px] border border-rule bg-paper px-1.5 py-px font-label text-[11.5px] font-medium text-graphite"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="text-[13px] text-graphite-soft">{row.what}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
