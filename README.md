# GMScript

个人维护的油猴脚本（Tampermonkey / Violentmonkey）合集。所有脚本均通过仓库 main 分支的 raw 地址发布与自动更新。

## 脚本列表

| 脚本 | 版本 | 说明 | 安装 / 更新地址 |
| --- | --- | --- | --- |
| Get Microsoft Rewards (修复/增强版) | 1.0.8 | 微软 Rewards 自动助手：本地自动搜索、每日活动、自动签到。多区域兼容与卡片过滤逻辑优化 | [安装](https://raw.githubusercontent.com/lytree/GMScript/main/Get%20Microsoft%20Rewards%20%28%E4%BF%AE%E5%A4%8D%E5%A2%9E%E5%BC%BA%E7%89%88%29.user.js) |
| Telegram Media Downloader (Optimized & Enhanced) | 1.0.7 | 从限制下载的 Telegram 频道获取图片 / 视频 / 语音消息。本仓库版本为 **telegram-only** 变体：严格 `@match` + 运行时域名守卫，已剥离第三方推广注入模块 | [安装](https://raw.githubusercontent.com/lytree/GMScript/main/telegram-media-downloader.telegram-only.user.js) |

## 命名与更新约定

1. **文件名不带版本号**，版本号只由 header 里的 `@version` 承载 —— 这样 raw 地址恒定，用户无需重装。
2. **`@downloadURL` 与 `@updateURL` 指向同一个 `.user.js`**（不使用独立的 `.meta.js`），维护成本最低。
3. **`@name` + `@namespace` 一旦发布不再改动** —— 这两项共同构成 Tampermonkey 的脚本身份，改动会让老用户变成"重复安装"且收不到更新。
4. 含中文 / 括号的文件名在 URL 中必须做百分号编码，例如 `(` → `%28`、`修复增强版` → `%E4%BF%AE%E5%A4%8D%E5%A2%9E%E5%BC%BA%E7%89%88`。

## 发布流程

1. 修改 `.user.js`，递增 `@version`。
2. `git add -A && git commit -m "..." && git push`（或直接在 GitHub 网页上传覆盖同名文件）。
3. **推送后可用 `curl -I` 校验 raw 地址返回 200**，确认更新链路通顺。

> 注意：重命名文件时，GitHub 上必须同步改名，否则 raw 地址会 404、自动更新失效。

## 许可证

见 [LICENSE](LICENSE)。各脚本另有自身许可证声明（见脚本 header 的 `@license`）。
