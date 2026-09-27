# VeilCast 图标：分片 V

## 当前正式图标：v3

- 用户提供的 v3：左侧斜切的方格、右侧连续的青蓝条带，深蓝圆角底。
- 原图：`veilcast-icon-v3-source.png`（1024×1024 RGBA，圆角外已透明），原样保留。
- 母版：`veilcast-icon.png`，由 `node scripts/prepare-icon-master.mjs` 从原图生成：原图方块内部的 alpha 只有 250–253
  （导出噪声，会微微透出背景），按 255/250 放大后方块完全不透明、抗锯齿边缘不变，颜色不动。
  `userscript/tests/icons.test.mjs` 锁定两者的 SHA-256。
- v1、v2 候选及其提示词保留在下方供对比。
- Tauri：`app/src-tauri/icons/` 下的 PNG、ICO、ICNS 和 Windows Logo 资源。
- 应用标题与 favicon：`app/public/icon.png`（64×64）。
- 油猴管理器：脚本头的 `@icon` / `@icon64` 内嵌 32×32 / 64×64 PNG；分享右侧按钮复用 64×64 图像。
- 图标没有远程 URL，安装油猴脚本后无需额外加载图标资源。

从仓库根目录重新生成：

```text
node scripts/prepare-icon-master.mjs
node scripts/generate-icons.mjs
node scripts/generate-intro-assets.mjs
node userscript/build.mjs
```

`generate-intro-assets.mjs` 生成桌面端片头用的 logo 与“VeilCast”字标（QOI，见 `app/README.md` 的片头一节）。

生成器使用项目已安装的 Tauri CLI，只进行图片尺寸和格式转换；移动平台的中间产物留在忽略目录 `target/branding-icons/`，不生成应用安装包。

## 历史候选 v1

- 文件：`veilcast-icon-concept-v1.png`
- 实际输出：1254×1254 PNG，RGBA，圆角外部透明。
- 状态：保留供对比，正式图标采用下方 v2。
- 风格：深蓝圆角底、青蓝主色、少量紫色，清晰的几何 V。
- 意象：分离的画面方块与完整的折叠条带，呼应切块重排、还原与 VeilCast 名称。
- 来源：内置 ImageGen，新生成的位图；原始生成文件保留，项目副本经过 SHA-256 一致性验证。
- v1 未用于正式图标集。

## v2：左侧打乱，右侧还原

- 文件：`veilcast-icon-concept-v2.png`，保留 v1 供对比。
- 左侧细分为错序的青蓝、紫色色块；右侧保留连续渐变的完整条带。
- 背景改为更亮的蓝色，保持圆角与透明外部。
- 使用内置 ImageGen 编辑，完整提示词见 [icon-v2-prompts.md](icon-v2-prompts.md)。
- 曾是正式图稿，已由 v3 取代。

## v1 完整生成提示词

```text
Use case: logo-brand.
Create one original premium desktop app icon for VeilCast, a video tile-scrambling and restoration project. Deliver a single square 1024x1024 icon, front-facing, not a mockup or contact sheet.
A bold, unmistakable geometric V monogram built from a few large video-tile facets. One arm has two or three clearly separated, slightly offset rectangular facets, while the other forms a clean continuous folded band: fragmented image becoming ordered again. Keep the whole silhouette coherent and immediately readable at 32px. Broad shapes and generous negative space; only a few intentional gaps, no tiny particles.
Style: exceptionally clean, vector-like raster brand design, restrained depth from subtle overlapping facets, precise edges. Luminous cyan and azure as the main colors, a small soft violet accent on one facet. Deep midnight navy rounded-square background tile, with genuinely transparent pixels outside the rounded corners. Tile nearly fills the canvas; the V occupies about 65% of its width. Crisp high contrast, balanced optical centering.
No text or wordmark, no lock, no shield, no eye, no play-button triangle, no QR code, no film perforations, no circuit traces, no sparkles, no glow bloom, no heavy 3D extrusion, no environment, no extra frame, no existing brand logos. This is an app-ready icon concept, not a poster.
```
