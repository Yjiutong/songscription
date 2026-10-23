---
version: "alpha"
name: Songscription
description: 一本摊在朱漆案上的琴谱册——谱页为宣纸，界线与铭题为鎏金，字为松烟墨。
colors:
  board: "#6E1B1A"
  board-deep: "#45100F"
  board-soft: "#8C2622"
  rule: "#DCCFA8"
  sheet: "#F1E4C4"
  paper: "#FBF6E9"
  paper-warm: "#F5E9CE"
  kraft: "#D9B24C"
  kraft-deep: "#8F6620"
  gold-soft: "#E9D08A"
  gold-deep: "#A87B2B"
  graphite: "#241A12"
  graphite-soft: "#574636"
typography:
  display:
    fontFamily: "Literata Variable, Source Han Serif SC, Noto Serif CJK SC, Songti SC, STSong, SimSun, Georgia, serif"
    fontSize: "clamp(1.9rem, 4.4vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "-0.012em"
  headline:
    fontFamily: "Literata Variable, Source Han Serif SC, Noto Serif CJK SC, Songti SC, STSong, SimSun, Georgia, serif"
    fontSize: "clamp(1.5rem, 3vw, 2.1rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.008em"
  title:
    fontFamily: "Literata Variable, Source Han Serif SC, Songti SC, STSong, SimSun, Georgia, serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.2
  section:
    fontFamily: "Literata Variable, Source Han Serif SC, Songti SC, STSong, SimSun, Georgia, serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "Literata Variable, Source Han Serif SC, Songti SC, STSong, SimSun, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.75
  control:
    fontFamily: "Archivo Variable, Source Han Sans SC, Noto Sans CJK SC, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  key:
    fontFamily: "Archivo Variable, Source Han Sans SC, Noto Sans CJK SC, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  caps:
    fontFamily: "Archivo Variable, Source Han Sans SC, Noto Sans CJK SC, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.14em"
  meta:
    fontFamily: "Archivo Variable, Source Han Sans SC, Noto Sans CJK SC, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  fine:
    fontFamily: "Archivo Variable, Source Han Sans SC, Noto Sans CJK SC, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo Variable, Source Han Sans SC, Noto Sans CJK SC, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.1em"
  staff-title:
    fontFamily: "Archivo Variable, Source Han Sans SC, Noto Sans CJK SC, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  paper: "3px"
  dialog: "4px"
  control: "5px"
  mark: "1.5px"
  blank: "2px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  gutter: "24px"
  section: "36px"
  strata: "56px"
  lattice: "24px"
components:
  play-key:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.graphite}"
    typography: "{typography.key}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "52px"
  play-transport:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.graphite}"
    typography: "{typography.key}"
    rounded: "{rounded.control}"
    padding: "0 28px"
    height: "68px"
  frame-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.key}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "52px"
  frame-board:
    backgroundColor: "{colors.board}"
    textColor: "{colors.paper}"
    typography: "{typography.key}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "52px"
  button-reveal:
    backgroundColor: "{colors.board}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  button-reveal-hover:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.graphite}"
  button-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  staff-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.paper}"
    padding: "24px"
  staff-ink:
    textColor: "{colors.graphite}"
  staff-export:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.graphite}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
---

# Design System: Songscription

## Overview

一处案上的陈设，而非一块屏幕。

底色是**朱漆**——器物上的大漆，红得深、哑得稳，不起荧光。它上面摆放的都是**宣纸**物件：谱页、标签、题头。纸与漆之间靠真实的投影分开，从不描边，因为纸没有轮廓。标题、界线与一切需要被看见的分量之处用**鎏金**：不是渐变的奢华，是薄薄一层描上去的金，因而在朱漆上有 5.7:1、在宣纸上有 4.8:1 的对比度，足以承担小字。字是**松烟墨**，而非纯黑；墨写在暖白宣纸上，比纯黑白少一层刺眼。

这套的关系与原先的「橄榄绿桌面 + 牛皮纸」同构，只是把台面从画室挪到了案头。因此**语义令牌名保持不变**（board / paper / kraft / graphite）——它们描述的是角色（底、纸、标、墨），不是某一种具体的颜色。换配色应当只改取值，不动名字。

界面为简体中文，字体必须由中文字栈承担：宋体类（思源宋体 / 宋体）承担标题与正文的汉字，黑体类（思源黑体 / 苹方 / 微软雅黑）承担控件与标签。这些字来自系统而非网络——本应用必须能在完全离线的情况下启动。

## Colors

色彩分三层，各司其职，从不越界。

### Primary（朱漆 / board）

- **朱漆地 `#6E1B1A`** —— 整个应用唯一的「非纸」平面：桌面、侧栏、展开的谱页之外那一层虚空。深到近乎暗石榴红，因为上面要压得住鎏金。
- **阴刻 `#45100F`** —— 卡槽、滚动条轨道、需要凹下去一层的地方。它是朱漆地减去光，而不是叠加黑。
- **漆脊 `#8C2622`** —— 朱漆地上的凸起：选中的行、悬停的色块。它的对比度仍低于纸，所以传达的是「浮起来了」，而不是「亮起来了」。

### Neutral（宣纸 / paper、sheet）

- **宣纸 `#FBF6E9`** —— 所有需要长时间阅读的平面：卡片、对话框、控制面板。偏暖、略带赭，久看不刺眼。
- **二色宣纸 `#F1E4C4`** —— 纸的第二色：表里、已填好的笔记区、次要纸面。色相同一、深一档，用来分出层级而不引入新颜色。
- **暖宣纸 `#F5E9CE`** —— 仅在需要从「纸」再暖半档时使用（悬停、已选中）。

### Tertiary（鎏金 / kraft）

- **鎏金 `#D9B24C`** —— 唯一的强调色，用途严格：主播放键、书签、焦点环、乐章标题上方那一道线，以及「开始练习」这类必须被看见的动作。它不是红色那种警报色；在朱漆上 5.68:1，配墨色文字 8.46:1。
- **描金 `#E9D08A`** —— 鎏金的高光一档，用于朱漆地上的小字或细线（7.55:1）。当鎏金压在深漆上显得发闷时用它。
- **鎏金深处 `#8F6620`** —— 鎏金深一档的版本，且是唯一可以承载文字的深金色（宣纸上 4.76:1）：焦点描边、按下状态、「删除」这类需要强调但不该显得欢快的动作。
- **压印 `#A87B2B`** —— 仅供非文字的装饰（按下时的内阴影、压边）。它对宣纸只有 3.5:1，**不得用于任何文字**。

### Neutral 文字（松烟墨 / graphite）

- **墨 `#241A12`** —— 正文与标题。在宣纸上 15.80:1。
- **淡墨 `#574636`** —— 次级信息、数据的单位说明。在宣纸上 8.34:1，仍然通过 AA。

### Named Rules

- 界行色 `#DCCFA8` 在宣纸上只有 1.44:1——它是**装饰性的界格**，不承担任何语义。凡承载信息的东西，都不得用 rule 作为前景色。
- 朱漆地上不放灰色：暗底的次级信息降透明度，不换色系。
- 一屏之内鎏金的面积上限约为十分之一。再多就是金漆屏风，而不是练琴用的工具。

## Typography

两套字脸，两套分工，都以本地字体文件与系统字交付（离线可用）。

- **宋体类**（Literata Variable + 思源宋体 / 宋体）承担所有被「读」的东西：曲名、乐句标题、建议的句子。它是为长距离阅读设计的字。
- **黑体类**（Archivo Variable + 思源黑体 / 苹方 / 微软雅黑）承担所有被「操作」的东西：标签、按钮、测量值。它的任务是在 12px 也毫不含糊，而不是在 19px 显得好看。

汉字在同一字号下的视觉体量天生比拉丁字母大，因此：中文正文行高取 1.75（拉丁 1.6）；标题字距几乎归零——汉字自带字间距，再叠加正值就散了。启用 `font-feature-settings: "kern"`，汉字之间的排布交由字体自行处理。

## Layout

谱册的网格是 24px 的**界格**。纸上的内容落在格子的交叉点上，而不是让格子去迁就内容。栏宽是纸的属性：谱面所在的主纸最宽（≥720px），右侧的方法笔记窄一档（约 300px），两者之间留一个 gutter（24px）作为中缝。

留白是层级的主要手段：层级之间 36px，层内呼吸 12–16px，同组元素之间 8px。需要分隔的组，给它一张纸；不给它一条线。

## Elevation & Depth

### Shadow Vocabulary

- `--lift-1` 静止的纸（1px 偏移 + 6px 模糊）：所有卡片、行、标签的默认高度。
- `--lift-2` 抬起的纸（2px + 18px 模糊）：悬停的卡片、下拉菜单。
- `--lift-held` 只在模态框与展开的谱页上出现：4px + 40px，把整张纸从案面抬起来。
- `--glued` 反向的浅色内阴影，用于「裱在纸上的控件」——让它看起来是贴上去的，而不是浮起来的。
- `--pressed` 按下时的内阴影：纸被指尖略微压下去。

阴影一律使用偏暖的墨色 `rgba(42, 24, 14, …)`，而不是中性灰：纸上落下的是赭墨的影。

### Named Rules

- 投影永远向下偏移（光从上方来），且永远带透明度衰减。纯黑的 box-shadow 一律不允许。
- 一个元素一次只用一种 lift，不叠加。
- 朱漆地上的元素不用投影——朱漆不是纸，投上去没有意义；要分层就用更深的漆（board-deep）。

## Shapes

纸缘 3px 圆角，对话框 4px，控件 5px。这是纸被裁切后自然塌下来的角，不是胶囊按钮。圆角随控件尺寸增大而增大的规律止于 5px：再大就变塑料。

- 主播放键 / 走带：5px，高 52px / 68px。
- 书签、难度标记：1.5–2px。
- 卡片、谱页：3px。

## Components

### Buttons

纸面上的按钮是「纸压纸」：背景为宣纸，带一道浅色内阴影，仅在悬停时抬起一档（lift-2）。朱漆背景上的按钮反之：底色透明或更深一层漆，悬停时转为鎏金。删除性动作用鎏金深处，而非红色——这里没有警报色。

### Cards / Containers

曲目卡片是宣纸；组之间的「书脊」是一条 2px 的鎏金或界行细线。圆角恒为 3px，阴影恒为 lift-1。

### Inputs / Fields

纸面上的输入框照「写在纸上」的样子做：背景比周围更暖一档（paper-warm），描边用 rule 且仅 1px，聚焦时才换成 2px 的鎏金深处描边。

### Navigation

侧栏与顶栏为朱漆地：标题用纸白，非活跃项用 62% 透明度的纸白，活跃项左侧压一道 2px 鎏金竖线。

### The PLAY key

全场唯一的鎏金块，也是对比度最高的按键：背景鎏金、文字松烟墨、5px 圆角、52px 高。它是触发播放的唯一入口。

### The bookmark

书签是窄窄一条：收藏时用鎏金实心，未收藏时只用界行色的描边。它标示「在练」与「练过」这两种手的状态。

### The keyboard that plays

演奏时琴键跟随音高点亮：白键用纸，黑键用阴刻，刚按下的键转成鎏金并在约 0.8 秒内衰减回去。

### 五线谱（staff-sheet）

新加入的谱面容器，是宣纸上的宣纸：外层 `staff-sheet`（宣纸底、3px 圆角、24px 内边距），内层是矢量 SVG，墨色取 `#241A12`。与印刷谱的习惯保持一致——**谱面只用墨黑，不鎏金**，因为谱上的金色会与音符争夺注意力。导出按钮使用 `staff-export`（鎏金底 + 墨字）。

谱面自身的排版规律：谱号、调号、拍号在最左；一行超过 720px 自动折行并在行首重复调号；双手曲目用大谱表与连谱号；行首空白处用 staff-title 令牌写一小行标题。

**A4 导出**按印刷谱的习惯分页：A4 纵向、四边 14mm 页边距；谱面宽度换算为约 47mm 一小节，与真实印刷谱相当。首页页眉是宋体曲名 + 调号拍号速度的副行 + 一条鎏金界行；后续页页眉收窄为一行小曲名与界行；页脚右下是「第 n / N 页」，首页左下再落一次曲名——散页落在谱架上也能认回来。分页只在小节之间断开，每页能装几行以实测高度为准，超出就把最后一行挪到下一页。

### Blanks (loading)

加载态是「谱页尚未写出来」：保留真实的格子尺寸与留白，而不是转圈的指示器。占位块上有一层低对比、缓慢单向推移的 `@keyframes wash`，让它读作纸而非进度。

### The moving ground

背景 WebGL 把朱漆当作被光扫过的真实平面：缓慢的低频流动，叠一层极轻的噪点（透明度 0.1）。WebGL 不可用时的兜底必须是**纯朱漆色，而不是白色**。

## Do's and Don'ts

### Do:

- **让纸负责阅读，让漆负责陈设。** 长文本永远在宣纸上；朱漆只做背景与铭牌。
- **用留白与色阶（宣纸 / 二色宣纸）表达层级**，而不是更多颜色。
- **鎏金只给「要被按下的东西」和「要被记住的东西」**：主行动键、书签、焦点环、标题线。
- **导出与打印时保持墨黑。** 五线谱必须能直接打印出来照着练。
- **用降低不透明度表达次级信息**（墨色 62%），而不是引入第三种颜色。

### Don't:

- **不要在宣纸上用朱漆做背景块。** 红底黑字在小面积上像磁铁，会把注意力从曲子上吸走。
- **不要叠加两层以上的阴影以求「精致」。** 一层 lift 表示一个意思。
- **不要给纸加描边。** 纸的边界来自投影，加了描边它就成了控件。
- **不要在谱面上使用强调色。** 音符只有墨黑；连线与踏板记号可以有层次，但不得鎏金。
- **不要让中文标题回退到黑体。** 宋体栈必须优先命中，否则标题会显得笨重。
