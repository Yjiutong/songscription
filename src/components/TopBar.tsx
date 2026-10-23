"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Minus, Search, SlidersHorizontal, Square, X } from "lucide-react";
import { rgb, useAppearance } from "@/lib/appearance";

/**
 * 顶上那一条。
 *
 * 窗口已经不要系统的装饰了（tauri.conf.json 里 `decorations: false`），这条
 * 得自己当标题栏：能拖动、右边有最小化和关闭、中间是一排菜单。它长成什么样没
 * 有关系，有关系的是它跟着背景走——背景是深的那一条就深，那个人把背景换成
 * 一张雪景，这一条就翻成浅的，字也跟着换成墨色。
 */

type Item = { label: string; hint?: string; run(): void; disabled?: boolean };

export type TopBarProps = {
  /** 左边那三个图标。它们管的是主界面自己的开关，所以动作从外面进来。 */
  onToggleSearch(): void;
  onToggleFilter(): void;
  onToggleAside(): void;
  /** 菜单里的那些动作。 */
  onAdd(): void;
  onOpenSettings(): void;
  onOpenCatalogue(): void;
  onOpenOutput(): void;
  onReload(): void;
  onShortcuts(): void;
  onAbout(): void;
  /** 三个图标的"开/关"状态，用来给它们上色。 */
  searchOpen: boolean;
  filterOpen: boolean;
  asideOpen: boolean;
};

export function TopBar(props: TopBarProps) {
  const { tint } = useAppearance();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  const ink = tint.light ? "#241A12" : "#FBF6E9";

  // Alt+E / Alt+W / Alt+H / Alt+A 是 Windows 上菜单栏的老规矩。Alt 按下的一瞬
  // 焦点会跑到菜单栏上，这也是老规矩。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      const hit = MENUS.find((menu) => menu.key === key);
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      setOpenMenu((current) => (current === hit.id ? null : hit.id));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 点到别处就收起来。用 pointerdown 而不是 click：按下的一瞬间就该收，晚了会
  // 在菜单和目标之间闪一下。
  useEffect(() => {
    if (!openMenu) return;
    const down = (event: PointerEvent) => {
      if (!bar.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", escape);
    };
  }, [openMenu]);

  const menus: { id: string; label: string; hint: string; items: Item[] }[] = [
    {
      id: "edit",
      label: "编辑",
      hint: "E",
      items: [
        { label: "添加曲目…", run: props.onAdd },
        { label: "设置…", run: props.onOpenSettings, hint: "Ctrl ," },
      ],
    },
    {
      id: "window",
      label: "窗口",
      hint: "W",
      items: [
        { label: "最小化", run: () => void shellWindow.minimize() },
        { label: "缩放", run: () => void shellWindow.toggleMaximize() },
        { label: "重新加载", run: props.onReload, hint: "Ctrl R" },
      ],
    },
    {
      id: "help",
      label: "帮助",
      hint: "H",
      items: [
        { label: "快捷键", run: props.onShortcuts, hint: "?" },
        { label: "打开曲目册文件夹", run: props.onOpenCatalogue },
        { label: "打开输出文件夹", run: props.onOpenOutput },
      ],
    },
    {
      id: "about",
      label: "关于",
      hint: "A",
      items: [{ label: "关于 Songscription", run: props.onAbout }],
    },
  ];

  return (
    <div
      ref={bar}
      // data-tauri-drag-region：这一条及其以外的空白都可以拖着窗口走。
      data-tauri-drag-region
      className="relative z-40 flex h-[34px] shrink-0 select-none items-center gap-1 px-1.5 backdrop-blur-md"
      style={{
        backgroundColor: rgb(tint, 0.72),
        color: ink,
        boxShadow: `inset 0 -1px 0 0 ${rgb(tint, tint.light ? 0.22 : 0.36)}`,
      }}
    >
      <IconButton label="侧栏" active={props.asideOpen} onClick={props.onToggleAside} ink={ink}>
        <Menu className="h-4 w-4" strokeWidth={1.75} />
      </IconButton>
      <IconButton label="搜索" active={props.searchOpen} onClick={props.onToggleSearch} ink={ink}>
        <Search className="h-[15px] w-[15px]" strokeWidth={1.75} />
      </IconButton>
      <IconButton label="筛选" active={props.filterOpen} onClick={props.onToggleFilter} ink={ink}>
        <SlidersHorizontal className="h-[15px] w-[15px]" strokeWidth={1.75} />
      </IconButton>

      <div className="ml-1 flex items-center">
        {menus.map((menu) => (
          <div key={menu.id} className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu((current) => (current === menu.id ? null : menu.id))}
              onPointerEnter={() => openMenu && setOpenMenu(menu.id)}
              className="rounded-[3px] px-2 py-1 text-[12.5px] leading-none transition-colors"
              style={{
                backgroundColor: openMenu === menu.id ? rgb(tint, 0.9) : "transparent",
              }}
            >
              {menu.label}
              <span className="opacity-45">({menu.hint})</span>
            </button>

            {openMenu === menu.id && (
              <div
                className="absolute left-0 top-[30px] min-w-[184px] rounded-[4px] border py-1 shadow-[0_10px_28px_-8px_rgba(20,12,6,0.55)] backdrop-blur-md"
                style={{
                  backgroundColor: rgb(tint, 0.94),
                  borderColor: rgb(tint, tint.light ? 0.28 : 0.4),
                }}
              >
                {menu.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      item.run();
                    }}
                    className="flex w-full items-center gap-6 whitespace-nowrap px-3 py-[5px] text-left text-[12.5px] leading-none transition-colors"
                    style={{ color: ink }}
                    onPointerEnter={(event) => {
                      event.currentTarget.style.backgroundColor = rgb(tint, tint.light ? 0.3 : 0.5);
                    }}
                    onPointerLeave={(event) => {
                      event.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span>{item.label}</span>
                    {item.hint && (
                      <span className="ml-auto text-[11px] opacity-45">{item.hint}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {isDesktop() && (
        <div className="ml-auto flex items-center">
          <WindowButton label="最小化" ink={ink} onClick={() => void shellWindow.minimize()}>
            <Minus className="h-4 w-4" strokeWidth={1.5} />
          </WindowButton>
          <WindowButton label="缩放" ink={ink} onClick={() => void shellWindow.toggleMaximize()}>
            <Square className="h-[11px] w-[11px]" strokeWidth={1.5} />
          </WindowButton>
          <WindowButton
            label="关闭"
            ink={ink}
            danger
            onClick={() => void shellWindow.close()}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </WindowButton>
        </div>
      )}
    </div>
  );
}

const MENUS = [
  { id: "edit", key: "e" },
  { id: "window", key: "w" },
  { id: "help", key: "h" },
  { id: "about", key: "a" },
];

function IconButton({
  label,
  active,
  onClick,
  ink,
  children,
}: {
  label: string;
  active: boolean;
  onClick(): void;
  ink: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-[3px] transition-colors"
      style={{
        color: ink,
        backgroundColor: active ? "rgb(217 178 76 / 0.85)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function WindowButton({
  label,
  onClick,
  ink,
  danger,
  children,
}: {
  label: string;
  onClick(): void;
  ink: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-[26px] w-[34px] items-center justify-center rounded-[3px] transition-colors hover:bg-[#8C2622]"
      style={{ color: ink }}
      onPointerEnter={(event) => {
        if (danger) event.currentTarget.style.backgroundColor = "#C0392B";
      }}
      onPointerLeave={(event) => {
        if (danger) event.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

/** Tauri 才有的东西。浏览器里这条返回 false，窗口按钮也就不渲染。 */
function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// --- 窗口控制 ---------------------------------------------------------------
//
// 无边框窗口没有了系统给它的一圈抓手，最小化、关闭和缩放都得自己喊。延迟加
// 载：这一段只在真的按下去时才 download，不该压在启动路径上。

type WindowHandle = {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
};

async function withWindow(
  use: (handle: WindowHandle) => void,
): Promise<void> {
  if (!isDesktop()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    use(getCurrentWindow() as WindowHandle);
  } catch {
    // 浏览器里没有窗口可言，什么都不做就是对的。
  }
}

const shellWindow: WindowHandle = {
  minimize: () => withWindow((handle) => handle.minimize()),
  toggleMaximize: () => withWindow((handle) => handle.toggleMaximize()),
  close: () => withWindow((handle) => handle.close()),
};
