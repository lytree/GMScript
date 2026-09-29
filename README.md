# GMScript

个人维护的油猴脚本（Tampermonkey / Violentmonkey）合集。所有脚本均通过仓库 `main` 分支的 raw 地址发布，**装一次即可自动更新**。

---

## 一键安装

> 前置条件：浏览器先装好 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey。
> 打开下面任一地址会弹出脚本管理器的安装页；若页面直接显示源码，说明没装脚本管理器。

### 1. Get Microsoft Rewards（修复/增强版） · v1.0.8

```
https://raw.githubusercontent.com/lytree/GMScript/main/Get%20Microsoft%20Rewards%20%28%E4%BF%AE%E5%A4%8D%E5%A2%9E%E5%BC%BA%E7%89%88%29.user.js
```

👉 [点击安装](https://raw.githubusercontent.com/lytree/GMScript/main/Get%20Microsoft%20Rewards%20%28%E4%BF%AE%E5%A4%8D%E5%A2%9E%E5%BC%BA%E7%89%88%29.user.js)

### 2. Telegram Media Downloader（Optimized & Enhanced） · v1.0.7

```
https://raw.githubusercontent.com/lytree/GMScript/main/telegram-media-downloader.telegram-only.user.js
```

👉 [点击安装](https://raw.githubusercontent.com/lytree/GMScript/main/telegram-media-downloader.telegram-only.user.js)

<sub>以上地址同时是 `@downloadURL` 与 `@updateURL`。脚本管理器会按此地址定期检查版本，**升级无需重新安装**。</sub>

---

## 脚本列表

| 脚本 | 版本 | 说明 |
| --- | --- | --- |
| Get Microsoft Rewards (修复/增强版) | 1.0.8 | 微软 Rewards 自动助手：本地自动搜索、每日活动、自动签到。多区域兼容与卡片过滤逻辑优化 |
| Telegram Media Downloader (Optimized & Enhanced) | 1.0.7 | 从限制下载的 Telegram 频道获取图片 / 视频 / 语音消息。本仓库版本为 **telegram-only** 变体：严格 `@match` + 运行时域名守卫，已剥离第三方推广注入模块 |

---

## 常见问题

**地址打不开 / 返回 404？**
确认文件名与大小写完全一致。含中文和括号的文件名必须做百分号编码，直接复制上面的地址即可，不要手打。

**装完不自动更新？**
在脚本管理器里打开该脚本 → 设置 → 检查更新。若仍无反应，说明当前安装版本的 `@updateURL` 指向失效地址，重新访问上方安装地址覆盖安装一次即可恢复正常。

**我改了 `@name`，为什么老用户变成两个脚本？**
`@name` + `@namespace` 共同构成 Tampermonkey 的脚本身份。发布后改动这两项会被视为新脚本，老用户既收不到更新、又会重复安装。

---

## 命名与更新约定

1. **文件名不带版本号**，版本号只由 header 里的 `@version` 承载 —— 这样 raw 地址恒定，用户无需重装。
2. **`@downloadURL` 与 `@updateURL` 指向同一个 `.user.js`**（不使用独立的 `.meta.js`），维护成本最低。
3. **`@name` + `@namespace` 一旦发布不再改动**，理由见上方常见问题。
4. 含中文 / 括号的文件名在 URL 中必须做百分号编码，例如 `(` → `%28`、`修复增强版` → `%E4%BF%AE%E5%A4%8D%E5%A2%9E%E5%BC%BA%E7%89%88`。

## 发布流程

1. 修改 `.user.js`，递增 `@version`。
2. `git add -A && git commit -m "..." && git push`（或直接在 GitHub 网页上传覆盖同名文件）。
3. **推送后校验 raw 地址返回 200**，确认更新链路通顺：

   ```bash
   curl -sI https://raw.githubusercontent.com/lytree/GMScript/main/telegram-media-downloader.telegram-only.user.js | head -1
   ```

> 注意：重命名文件时，GitHub 上必须同步改名，否则 raw 地址会 404、自动更新失效。

## 许可证

见 [LICENSE](LICENSE)。各脚本另有自身许可证声明（见脚本 header 的 `@license`）。
