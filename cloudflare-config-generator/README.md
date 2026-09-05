# Air724UG Cloudflare Config Generator

这是一个可直接部署到 Cloudflare Pages 的纯静态客户配置生成器。

## 这次升级了什么

- `config.bin` 默认导出为 JSON 安全配置
- 设备端支持 `CONFIG_BIN_KEY`
- 设备端优先解析 JSON 白名单字段
- 设备端可通过 `CONFIG_BIN_ALLOW_LEGACY_LUA` 控制是否兼容旧版 Lua 密文
- 生成器补齐了 `NUMBER` 回退号码字段，便于通知头和本机号查询兜底
- 页面增加了客户模板中心和更正式的交付 UI

## 导出逻辑

### 默认模式：JSON 安全配置

生成器会把配置组织成如下结构后再加密：

```json
{
  "schema": "air724ug-config/v1",
  "generatedAt": "2026-04-23T12:00:00.000Z",
  "presetName": "客户A-标准版",
  "customerName": "客户A",
  "generator": "air724ug-cloudflare-config-generator",
  "config": {
    "CONFIG_BIN_KEY": "jocry",
    "CONFIG_BIN_ALLOW_LEGACY_LUA": true,
    "NOTIFY_TYPE": ["bark"]
  }
}
```

设备端会先尝试 JSON 解析，再按白名单把字段写入 `config` 模块。

### 兼容模式：Legacy Lua

如果你还没有更新设备端，也可以切换为旧版 Lua 脚本模式，生成与之前一致的密文内容。

## 加密兼容性

`config.bin` 的加密方式仍与原项目兼容：

1. 对输入密钥执行 `MD5`
2. 取十六进制结果前 16 位并转小写
3. 以这 16 字节 ASCII 文本作为 AES key
4. 使用 `AES-ECB + ZeroPadding`
5. 输出 `Base64` 文本保存为 `config.bin`

## 设备端配套改动

### 录音上传 SOCKS5 配置

在“短信控制与录音”中展开“录音上传 SOCKS5 代理”，填写代理地址、端口及可选用户名/密码。上传 URL 仍填写实际存储地址，启用代理时必须为 `http://`。无认证时用户名和密码均留空。JSON 和 Legacy Lua 两种导出模式均支持这些字段；已有浏览器预设未包含代理配置时默认关闭代理。

设备需要同时升级 `script/lib/socks5.lua`、`script/lib/http.lua`、`script/lib/socket4G.lua`、`script/handler/handler_call.lua`、`script/config.lua` 和 `script/utils/util_config_loader.lua`。代理只用于录音上传，连接失败不会改为直连。SOCKS5 不加密 HTTP 数据。

### 基础配置加载

你需要把以下脚本一起烧录到设备：

- [script/config.lua](../script/config.lua)
- [script/main.lua](../script/main.lua)
- [script/utils/util_config_loader.lua](../script/utils/util_config_loader.lua)

其中：

- `CONFIG_BIN_KEY` 控制解密 `config.bin` 的密钥
- `CONFIG_BIN_ALLOW_LEGACY_LUA = true` 时，JSON 解析失败后会回退旧版 `loadstring`
- `CONFIG_BIN_ALLOW_LEGACY_LUA = false` 时，仅接受 JSON 安全配置

## Cloudflare Pages 部署

如果你把整个项目推到 Git：

- Framework preset: `None`
- Build command: 留空
- Build output directory: `cloudflare-config-generator`

或者直接把 `cloudflare-config-generator` 目录上传到 Cloudflare Pages 也可以。

## Wrangler 部署

如果你更适合用 Wrangler，而不是手动拖拽上传，可以直接使用：

```powershell
wrangler login
powershell -ExecutionPolicy Bypass -File .\cloudflare-config-generator\deploy-pages.ps1 -ProjectName <你的Pages项目名>
```

如果项目还没创建，可以加上 `-CreateProject`：

```powershell
powershell -ExecutionPolicy Bypass -File .\cloudflare-config-generator\deploy-pages.ps1 -ProjectName <你的Pages项目名> -CreateProject
```

这个脚本会自动只上传运行所需的静态文件：

- `index.html`
- `styles.css`
- `app.js`
- `vendor/crypto-js.min.js`

不会把整个仓库、`README.md`、`smoke-test.js` 或 Luatools 大文件一起传上去。

## 本地自检

如果你想在没有设备的情况下先做一次导出兼容性回归，可以运行：

```bash
node cloudflare-config-generator/smoke-test.js
```

这个脚本会验证：

- JSON 安全配置模式可正常导出并按兼容算法解回原文
- Legacy Lua 模式仍可正常导出旧格式脚本
- `NUMBER`、通知类型、自定义 POST body 等关键字段会正确进入载荷

## 交付建议

- 面向最终客户：只交付 `config.bin`
- 面向实施/渠道：交付 Pages 链接和客户模板
- 面向内部运维：保留预设 JSON，便于批量复用
