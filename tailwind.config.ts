import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// 取值为字面量而非 var() 间接引用：Tailwind 无法向整色自定义属性注入
// 透明通道，`bg-graphite/70` 这种写法在令牌是 var() 时会静默失效。
// 同一组值在 index.css 里镜像为 CSS 变量，供 SVG 与原生 CSS 使用。
//
// 令牌名描述的是「角色」而非颜色本身，因此沿用旧名、只替换取值：
//   board    朱漆地（案面）   paper / sheet  宣纸（阅读面）
//   kraft    鎏金（强调）     graphite       松烟墨（文字）
const board = "#6E1B1A"; // 朱漆地
const boardDeep = "#45100F"; // 阴刻
const boardSoft = "#8C2622"; // 漆脊
const rule = "#DCCFA8"; // 界行（装饰性细线，不承载文字）
const sheet = "#F1E4C4"; // 二色宣纸
const paper = "#FBF6E9"; // 宣纸
const paperWarm = "#F5E9CE"; // 暖宣纸
const kraft = "#D9B24C"; // 鎏金
const kraftDeep = "#8F6620"; // 鎏金深处（唯一可用于文字的深金）
const graphite = "#241A12"; // 松烟墨
const graphiteSoft = "#574636"; // 淡墨

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // 名字刻意避开 Tailwind 的工具类前缀：一个叫 `base` 的令牌曾与
        // 内置的 `text-base` 字号相撞。
        board: { DEFAULT: board, deep: boardDeep, soft: boardSoft },
        rule: rule,
        sheet: sheet,
        paper: { DEFAULT: paper, warm: paperWarm },
        kraft: { DEFAULT: kraft, deep: kraftDeep },
        graphite: { DEFAULT: graphite, soft: graphiteSoft },
        // 鎏金的两档辅助：描金用于深漆上的小字，压印只用于非文字装饰。
        gold: { soft: "#E9D08A", deep: "#A87B2B" },

        // The semantic names the pulled-in components speak.
        background: paper,
        foreground: graphite,
        border: rule,
        input: rule,
        ring: kraftDeep,
        primary: { DEFAULT: kraft, foreground: graphite },
        secondary: { DEFAULT: paper, foreground: graphite },
        muted: { DEFAULT: sheet, foreground: graphiteSoft },
        accent: { DEFAULT: paperWarm, foreground: graphite },
        destructive: { DEFAULT: kraftDeep, foreground: paper },
        popover: { DEFAULT: paper, foreground: graphite },
        card: { DEFAULT: paper, foreground: graphite },
      },
      fontFamily: {
        // 书刻字脸 + 汉字宋体：标题与正文的中文部分交给思源宋体/宋体承担。
        book: [
          "var(--font-book)",
          "Source Han Serif SC",
          "Noto Serif CJK SC",
          "Songti SC",
          "STSong",
          "SimSun",
          "Georgia",
          "serif",
        ],
        // 控件字脸 + 汉字黑体：标签、按钮、测量值。
        label: [
          "var(--font-label)",
          "Source Han Sans SC",
          "Noto Sans CJK SC",
          "PingFang SC",
          "Microsoft YaHei",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        lift: "var(--lift-1)",
        "lift-2": "var(--lift-2)",
      },
      keyframes: {
        "sheet-in": {
          from: {
            opacity: "0",
            transform: "translate(-50%, -43%) scale(0.955)",
            filter: "blur(7px)",
          },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)", filter: "blur(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "sheet-in": "sheet-in 340ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 200ms ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
