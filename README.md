# GMScript

个人维护的脚本合集。仓库分两块，内容互不干扰：

| 目录 | 内容 | 面向 |
| --- | --- | --- |
| [`userscripts/`](userscripts/) | Tampermonkey / Violentmonkey 油猴脚本 | 浏览器 |
| [`win-scripts/`](win-scripts/) | Windows 环境搭建 / 配置脚本（PowerShell、batch） | 命令行 |

---

## 一、油猴脚本（[`userscripts/`](userscripts/)）

个人维护的油猴脚本（Tampermonkey / Violentmonkey）合集。所有脚本均通过仓库 `main` 分支的 raw 地址发布，**装一次即可自动更新**。

### 一键安装

> 前置条件：浏览器先装好 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey。
> 打开下面任一地址会弹出脚本管理器的安装页；若页面直接显示源码，说明没装脚本管理器。
>
> **同一功能的脚本只装一个。** Telegram 系只有一个脚本（#2 合并版）；旧版 `telegram-only` 已从仓库移除，若你此前装过，请先停用/删除旧版再装 #2，否则媒体查看器里会出现重复按钮。

#### 1. Get Microsoft Rewards (修复/增强版) · v1.0.8

```
https://raw.githubusercontent.com/lytree/GMScript/main/userscripts/get-microsoft-rewards.user.js
```

👉 [点击安装](https://raw.githubusercontent.com/lytree/GMScript/main/userscripts/get-microsoft-rewards.user.js)

#### 2. Telegram Media Downloader (Merged) · v1.2.0 · 推荐

```
https://raw.githubusercontent.com/lytree/GMScript/main/userscripts/telegram-media-downloader-merged.user.js
```

👉 [点击安装](https://raw.githubusercontent.com/lytree/GMScript/main/userscripts/telegram-media-downloader-merged.user.js)

<sub>由三份上游实现（Nestor Qin / yoshiko.wisoky / copyMister）与旧 `telegram-only` 变体合并而成的单一实现：受限频道下载、WebA(webz) + WebK(webk) 双端挂载、原生 `downloadToDisc` 通道优先、任务面板（标题栏可拖动、位置记忆、双击复位、取消 / 重试 / 续传 / 4 MB 分片）、右键菜单与选择栏批量下载、整组下载（相册 + 评论区）、受保护消息 `.no-forwards` 文字复制解锁、五语 i18n；不含任何推广 / 邀请 / 统计外链。**注意：这是新的脚本身份**，旧版 `telegram-only`（v1.0.7）已下线，请先停用/卸载旧版再装本脚本，否则媒体查看器会出现重复按钮。</sub>

<sub>以上地址同时是 `@downloadURL` 与 `@updateURL`。脚本管理器会按此地址定期检查版本，**升级无需重新安装**。</sub>

### 脚本列表

| 文件名 | 版本 | 说明 |
| --- | --- | --- |
| [`get-microsoft-rewards.user.js`](userscripts/get-microsoft-rewards.user.js) | 1.0.8 | 微软 Rewards 自动助手：本地自动搜索、每日活动、自动签到。多区域兼容与卡片过滤逻辑优化。<br>显示名：`Get Microsoft Rewards (修复/增强版)` |
| [`telegram-media-downloader-merged.user.js`](userscripts/telegram-media-downloader-merged.user.js) | 1.2.0 | 从限制下载的 Telegram 频道获取图片 / 视频 / 语音 / 文件。**旧 `telegram-only` 与 `Telegram-Media-Downloader-Pro` 的合并版**：WebA(webz) + WebK(webk) 双端挂载、原生 `downloadToDisc` 通道优先；**默认不弹目录选择框，文件直接落系统下载目录**（可选指定归档目录）、任务面板（标题栏可拖动、位置记忆、双击复位、取消 / 重试 / 续传 / 4 MB 分片）、右键菜单下载、选择栏批量下载（面板显示 `n/N` 条目进度与当前文件名、可取消）、整组下载（相册 + 评论区）、受保护消息 `.no-forwards` 文字复制解锁、五语 i18n。<br>仓库侧加固：`@match` 严格限定 + 运行时域名守卫，无任何推广 / 邀请 / 统计外链。Telegram 下载脚本**只装这一个**。<br>显示名：`Telegram Media Downloader (Merged)` |

### 常见问题

**地址打不开 / 返回 404？**
确认文件名与大小写完全一致 —— raw 地址是**区分大小写**的。直接复制上面的地址，不要手打。

**装完不自动更新？**
在脚本管理器里打开该脚本 → 设置 → 检查更新。若仍无反应，说明当前安装版本的 `@updateURL` 指向失效地址，重新访问上方安装地址覆盖安装一次即可恢复正常。

**媒体查看器里出现两个下载按钮 / 面板重复？**
说明同时启用了多个 Telegram 下载脚本（仓库内的 `merged`、从别处装的 `Pro`，或你此前装的旧版 `telegram-only`）。在脚本管理器里只保留 `merged`，其余停用或删除并刷新页面。旧版 `telegram-only` 已从仓库移除，其更新地址会返回 404，建议直接卸载。

**我改了 `@name`，为什么老用户变成两个脚本？**
`@name` + `@namespace` 共同构成 Tampermonkey 的脚本身份。发布后改动这两项会被视为新脚本，老用户既收不到更新、又会重复安装。

> ⚠️ **2026-11 下线 WPS 脚本**：`wps-auto-signin.user.js`（WPS Auto Sign-in 自动签到，v1.0.0）已从仓库移除，
> 连同 `userscripts/tests/` 下的两份测试。该脚本的 raw 地址现已 404，**不会再收到自动更新**。
> 装过的用户请在脚本管理器里直接停用 / 卸载；仓库不再维护此功能。

> ⚠️ **2026-10 结构变更**：原有脚本从仓库根目录移入了 `userscripts/` 子目录，raw 地址随之改变。
> 脚本内的 `@updateURL` / `@downloadURL` 已同步改为新地址，**但你本机已安装的副本仍指向旧地址**。
> 老用户需从上方新地址**重新安装一次**，之后即可恢复自动更新。旧地址（根目录）已失效，会返回 404。
>
> 同一时间，旧版 `telegram-media-downloader.telegram-only.user.js` **已从仓库删除**（功能并入合并版），
> 已安装该旧版的用户请先卸载旧版，再安装上面的合并版。

> ⚠️ **2026-10 TDL 合并**：`telegram-media-downloader.telegram-only.user.js`（v1.0.7）已从仓库移除，
> 由合并版 `telegram-media-downloader-merged.user.js`（v1.2.0，显示名 `Telegram Media Downloader (Merged)`）取代。
> 两者 `@name` / `@namespace` 不同，脚本管理器视为两个独立脚本 —— **必须先卸载旧版**，再装新版，
> 否则两个面板会同时出现。旧地址现已 404，装过旧版的用户不会收到自动更新，需手动迁移一次。

### 命名与更新约定

1. **文件名全用 ASCII 英文，kebab-case** —— 不含中文、空格、括号。这样 URL 无需百分号编码，地址短且不会因编码写错而 404。
2. **文件名不带版本号**，版本号只由 header 里的 `@version` 承载 —— 这样 raw 地址恒定，用户无需重装。
3. **`@downloadURL` 与 `@updateURL` 指向同一个 `.user.js`**（不使用独立的 `.meta.js`），维护成本最低。
4. **`@name` + `@namespace` 一旦发布不再改动**，理由见上方常见问题。
5. **脚本显示名可以保留中文**（如 `@name:zh-CN`），它与文件名各自独立，互不影响。
6. **移动 / 重命名文件必须同步改 `@updateURL` 与 `@downloadURL`**，并预先告知用户重新安装 —— 否则自动更新链路会静默断掉。

### 发布流程

1. 修改 `userscripts/*.user.js`，递增 `@version`。
2. `git add -A && git commit -m "..." && git push`（或直接在 GitHub 网页上传覆盖同名文件）。
3. **推送后校验 raw 地址返回 200**，确认更新链路通顺：

   ```bash
   curl -sI https://raw.githubusercontent.com/lytree/GMScript/main/userscripts/get-microsoft-rewards.user.js | head -1
   ```

> 注意：重命名或移动文件时，GitHub 上必须同步操作，且脚本内的 `@updateURL` / `@downloadURL` 要一并更新，
> 否则 raw 地址会 404、自动更新失效。

### 本地测试

当前仓库内的脚本均不附带测试；若后续为某个脚本补上测试，统一放在 `userscripts/tests/`，用纯 Node 运行，
被测脚本按 `import.meta.url` 相对定位，clone 到任意目录都能跑。

---

## 二、Windows 环境脚本（[`win-scripts/`](win-scripts/)）

一组 Windows 环境搭建 / 配置脚本，**全部为命令行工具，不影响上面的油猴脚本**。

```powershell
# 一键配置全部系统级环境变量（自动提权）
.\win-scripts\run-as-admin.cmd

# 装 FFmpeg（自动探测本机代理）
.\win-scripts\install-ffmpeg.bat

# 给图片关联 IrfanView
.\win-scripts\irfanview-assoc.bat
```

涵盖：系统级环境变量（uv / Python / Java / Maven / Node / vcpkg）、PowerShell 7 与 Git 安装、gsudo 安装、FFmpeg 安装、IrfanView 图片文件关联。

**约定**：`.ps1` 承载全部逻辑，`.bat` / `.cmd` 只做调用入口（定位 pwsh → 转发参数 → 透传退出码）。
需要管理员权限的用 `.cmd` 入口（自动弹 UAC），不需要的用 `.bat`。

📖 详见 **[`win-scripts/README.md`](win-scripts/README.md)** —— 含完整脚本清单、参数说明、本机现状与踩坑记录。

---

## 许可证

见 [LICENSE](LICENSE)。各脚本另有自身许可证声明（见脚本 header 的 `@license`）。
