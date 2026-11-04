# third-party —— 上游脚本的本地只读镜像

根 README 的「关联脚本（上游，非本仓库维护）」一节列出的第三方脚本，在这里各存一份**原样副本**。

存在的原因很简单：上游随时可能删仓库、改名、被墙，而 README 里那些说明（版本号、`@namespace`、`@updateURL` 指向哪里）需要有据可查。有了副本，这些判断可以随时本地复核，而不是靠记忆。

## 这不是安装源

- **不要**从本目录安装脚本，也不要把它当 `@updateURL` 用。安装地址见根 README，升级由上游推送。
- **不要**在这里改代码。镜像一旦本地修改，下次 `sync` 就会被覆盖，而且你会在"这脚本到底是谁的行为"上彻底失去判断。
- 本目录**不随本仓库的 MIT 许可证发布**，各文件仍归各自作者，许可证见下表与文件内 header。

## 清单

| 本地文件 | 脚本 | 上游仓库 | 版本 | 许可证 |
| --- | --- | --- | --- | --- |
| [`github-enhanced.user.js`](userscripts/github-enhanced.user.js) | Github 增强 · 高速下载 | [XIU2/UserScript](https://github.com/XIU2/UserScript) | 2.6.41 | GPL-3.0 |
| [`zhihu-beautification.user.js`](userscripts/zhihu-beautification.user.js) | 知乎美化 | [XIU2/UserScript](https://github.com/XIU2/UserScript) | 1.5.24 | GPL-3.0 |
| [`zhihu-enhanced.user.js`](userscripts/zhihu-enhanced.user.js) | 知乎增强 | [XIU2/UserScript](https://github.com/XIU2/UserScript) | 2.3.32 | GPL-3.0 |
| [`ferrylink.user.js`](userscripts/ferrylink.user.js) | 网盘直链下载助手（FerryLink） | [Wjavan/FerryLink](https://github.com/Wjavan/FerryLink) | 1.6.1 | GPL-3.0 |
| [`douyin-dl.user.js`](userscripts/douyin-dl.user.js) | 抖音下载 | [zhzLuke96/douyin-dl-user-js](https://github.com/zhzLuke96/douyin-dl-user-js) | 1.5.15 | MIT |
| [`betterx.user.js`](userscripts/betterx.user.js) | 更好的 X（BetterX） | [Iskongkongyo/BetterX](https://github.com/Iskongkongyo/BetterX) | 4.0.0 | MIT |

完整来源（原始文件名、下载地址、备用镜像、大小、sha256）在 [`manifest.json`](manifest.json)。本地文件名统一用 ASCII，是因为上游有的名字带中文（`网盘直链下载助手.user.js`）或带版本号（`BetterX-v4.0.0.js`），直接沿用会让每次升级都多一个文件。

## 同步

```bash
# 下载并更新镜像 + manifest（sha256 / 大小 / 日期会一并刷新）
node third-party/sync.mjs

# 只比对，不写盘；有差异退出码为 1，适合放进 CI 做版本巡检
node third-party/sync.mjs --check

# 只同步指定的几个
node third-party/sync.mjs --only=betterx --only=douyin-dl
```

纯 Node 18+，无第三方依赖。下载顺序是 `url` → `alternates`：Release 资产的真实域名是 `objects.githubusercontent.com`，部分网络直连不通，所以清单里给了 `gh-proxy.com` 镜像，靠大小与 `@version` 兜底比对，不会悄悄换掉内容。

**信任模型**：首次同步时记下的 `sha256` 是后续比对的锚点。上游正常发版时哈希必然变化，`--check` 会如实报"有更新"；如果版本号没动而哈希变了，那值得停下来看一眼 —— 那意味着对方重写了同版本的文件。

## 更新镜像的节奏

不追版本。只在两种情况跑一次：

1. 根 README 的关联脚本表需要更新时（顺手把版本号和判断依据一起校准）；
2. 想复核某个脚本的实际行为时（比如确认它到底往哪儿发请求、`@updateURL` 指向哪）。
