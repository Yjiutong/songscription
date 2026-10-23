"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getPlatform } from "@/lib/platform";

/**
 * 背景这幅画，以及从它身上取下来的一撮颜色。
 *
 * 顶部那条菜单栏不能自己挑颜色：它的颜色得跟着背景走，不然人换了一张深色
 * 的照片，上面那条还是宣纸白，看着就像没盖好的盖子。所以这里做两件事：把图
 * 片读出来，再从图片顶部取一点平均色，告诉标题栏"你现在是深还是浅"。
 */

export type Tint = {
  red: number;
  green: number;
  blue: number;
  /** 这颜色是浅的，字就得用墨；是深的，字就得用宣纸白。 */
  light: boolean;
};

/** 没人选图时候的那一版：朱漆地。 */
const BOARD: Tint = { red: 110, green: 27, blue: 26, light: false };

type Appearance = {
  /** 背景图，或者 null——那就还是朱漆的棋盘 cover。 */
  image: string | null;
  /** 图片的类型，删掉的时候不用再去问一次。 */
  mime: string | null;
  tint: Tint;
  ready: boolean;
  setImage(bytes: Uint8Array, mime: string): Promise<void>;
  clearImage(): Promise<void>;
};

const Context = createContext<Appearance | null>(null);

export function useAppearance(): Appearance {
  const value = useContext(Context);
  if (!value) throw new Error("useAppearance 要在 AppearanceProvider 里面用");
  return value;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [image, setImageUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [tint, setTint] = useState<Tint>(BOARD);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const platform = await getPlatform();
    const saved = await platform.background.read();
    setImageUrl((previous) => {
      // 旧的那张object URL 要 revoke，不然每换一次背景就漏一块内存。
      if (previous) URL.revokeObjectURL(previous);
      return saved ? URL.createObjectURL(new Blob([saved.bytes.slice().buffer], { type: saved.mime })) : null;
    });
    setMime(saved?.mime ?? null);
    setTint(saved ? await sample(saved.bytes, saved.mime) : BOARD);
    setReady(true);
  }, []);

  useEffect(() => {
    void load().catch(() => setReady(true));
  }, [load]);

  const setImage = useCallback(
    async (bytes: Uint8Array, type: string) => {
      const platform = await getPlatform();
      await platform.background.write(bytes, type);
      setImageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(new Blob([bytes.slice().buffer], { type }));
      });
      setMime(type);
      setTint(await sample(bytes, type));
    },
    [],
  );

  const clearImage = useCallback(async () => {
    const platform = await getPlatform();
    await platform.background.clear();
    setImageUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setMime(null);
    setTint(BOARD);
  }, []);

  const value = useMemo<Appearance>(
    () => ({ image, mime, tint, ready, setImage, clearImage }),
    [image, mime, tint, ready, setImage, clearImage],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * 从一张图上取颜色的办法：缩到 32×32，只看上面那几条。
 *
 * 看上面那几条是因为顶部栏就是压在上面的那一条，而不是整张图的脾气——有人
 * 会用一张天空在上、山体在下的照片，那时候"整图平均"给出来的颜色，跟眼球
 * 在标题栏那一带看到的压根不是一回事。
 */
async function sample(bytes: Uint8Array, type: string): Promise<Tint> {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type }));
  try {
    const element = new Image();
    element.src = url;
    await element.decode();

    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return BOARD;
    ctx.drawImage(element, 0, 0, size, size);

    // 顶部占三分之一：那是菜单栏会压住的一条。
    const rows = Math.max(1, Math.round(size / 3));
    const { data } = ctx.getImageData(0, 0, size, rows);

    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      // 透明像素（某些 PNG 带 alpha）不参与平均，不然平均值会莫名其妙偏黑。
      if (data[index + 3] < 24) continue;
      red += data[index];
      green += data[index + 1];
      blue += data[index + 2];
      count += 1;
    }
    if (count === 0) return BOARD;

    const averaged = {
      red: Math.round(red / count),
      green: Math.round(green / count),
      blue: Math.round(blue / count),
    };
    const luminance =
      0.299 * averaged.red + 0.587 * averaged.green + 0.114 * averaged.blue;

    // 门槛取 150 而不是中值 127：标题栏还会再压一层自己的半透明暗面，偏的一端
    // 更容易踩过去。
    return { ...averaged, light: luminance > 150 };
  } catch {
    return BOARD;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 把一撮颜色推远一点儿：加深或者提亮，用来铺标题栏的那层底。 */
export function shade(tint: Tint, amount: number): string {
  const towards = (channel: number) =>
    Math.round(tint.light ? channel * (1 - amount) : channel + (255 - channel) * amount);
  return `rgb(${towards(tint.red)} ${towards(tint.green)} ${towards(tint.blue)})`;
}

export function rgb(tint: Tint, alpha = 1): string {
  return `rgb(${tint.red} ${tint.green} ${tint.blue} / ${alpha})`;
}
