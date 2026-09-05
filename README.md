# Air724UG Local

Air724UG 短信转发、来电通知、语音信箱项目的干净源码仓库。

这个仓库当前主要包含两部分：

- `script/`
  Air724UG 设备端 Lua 脚本，支持从 `config.bin` 加载配置。
- `cloudflare-config-generator/`
  可部署到 Cloudflare Pages 的静态配置生成器，用于生成可直接下发到设备的 `config.bin`。
- `driver/`
  Windows USB 驱动文件，方便设备首次接入时安装串口和相关驱动。

## 当前状态

- 设备端已支持 `CONFIG_BIN_KEY`
- 设备端优先解析 JSON 安全配置
- 设备端保留 Legacy Lua 密文回退能力
- Cloudflare 配置生成器已完成本地和实机联调
- 页面生成的 `config.bin` 已在 Air724UG 设备上验证可正常生效

## 目录说明

```text
script/
  audio/                 音频资源
  handler/               来电、短信、按键处理
  lib/                   LuatOS 依赖库
  utils/                 项目工具函数
  config.lua             默认配置
  main.lua               启动入口
  usbmsc.lua             U 盘挂载与写入逻辑

cloudflare-config-generator/
  index.html             页面结构
  styles.css             页面样式
  app.js                 生成器逻辑
  vendor/crypto-js.min.js
  deploy-pages.ps1       Wrangler 部署脚本
  smoke-test.js          本地导出兼容性自检

driver/
  DriversForWin10/       Windows 10 驱动
  DriversForWin78/       Windows 7/8 驱动
  DriverUninstall32.exe  32 位卸载工具
  DriverUninstall64.exe  64 位卸载工具
```

## 快速开始

### 设备端

把 `script/` 下脚本烧录到 Air724UG 设备。

如果需要通过 U 盘配置设备，把生成好的 `config.bin` 放到设备暴露出来的存储根目录即可。

### 驱动

如果电脑首次连接 Air724UG 设备没有正确识别串口，可以先安装 `driver/` 目录中的驱动。

### SOCKS5 + HTTP 录音上传

支持通过 SOCKS5 代理上传录音，包括无认证和用户名/密码认证。代理只用于录音上传，通知等其他请求仍使用原来的连接方式。默认关闭代理。

在 `script/config.lua` 中填写，或在配置生成器的“短信控制与录音 → 录音上传 SOCKS5 代理”中配置后导出 `config.bin`：

```lua
UPLOAD_URL = "http://storage.example.com/voice" -- 实际上传目标，保留原来的存储目录
UPLOAD_SOCKS5_ENABLE = true
UPLOAD_SOCKS5_HOST = "proxy.example.com"        -- 域名或 IPv4，不含协议、端口和路径
UPLOAD_SOCKS5_PORT = 1080
UPLOAD_SOCKS5_USERNAME = "" -- 无认证时用户名和密码都留空
UPLOAD_SOCKS5_PASSWORD = "" -- 有认证时两项均填写，各为 1-255 字节
UPLOAD_SOCKS5_TIMEOUT = 15000 -- 连接代理和协议握手的总超时，毫秒
```

设备先连接代理，再请求代理连接实际上传目标；目标域名由代理解析。文件仍通过 `PUT` 上传到 `{UPLOAD_URL}/record/{本机号码}/{日期}/{来电号码}_{时间戳}.wav`，通知中的录音链接也是这个目标地址。存储服务的上传权限和下载权限仍需配置，SOCKS5 不替代存储鉴权。

- 仅支持 `http://` 上传；启用代理时遇到 HTTPS 或代理失败会报告上传失败，不会回退直连。
- SOCKS5 不加密 HTTP 文件数据，用户名/密码认证本身也不提供加密。
- 代理连接和握手超时允许设置 1-300000 毫秒；上传阶段沿用原 HTTP 超时配置。
- 上传成功接受 HTTP 2xx 状态，包括 200、201、204。
- 上传开关、目标地址和代理配置在使用时读取，因此开机从 `config.bin` 加载的配置能生效。

升级时需一起烧录本次更新的 `script/` 脚本，包含新增的 `lib/socks5.lua`。只替换 `config.bin` 不会给旧版脚本增加代理能力。

### 配置生成器

本地直接打开：

```text
cloudflare-config-generator/index.html
```

或者部署到 Cloudflare Pages。

详细说明见：

- [cloudflare-config-generator/README.md](./cloudflare-config-generator/README.md)

## Cloudflare Pages 部署

### 手动上传

只上传 `cloudflare-config-generator/` 目录里的静态文件，不要上传整个仓库。

### Wrangler

```powershell
wrangler login
powershell -ExecutionPolicy Bypass -File .\cloudflare-config-generator\deploy-pages.ps1 -ProjectName <你的Pages项目名>
```

如果项目还没创建：

```powershell
powershell -ExecutionPolicy Bypass -File .\cloudflare-config-generator\deploy-pages.ps1 -ProjectName <你的Pages项目名> -CreateProject
```

## Releases 下载

当前发布版本：

- [v2026.04.24](https://github.com/Huiaini/Air724ug_Local/releases/tag/v2026.04.24)

直接下载：

- [cloudflare-config-generator.zip](https://github.com/Huiaini/Air724ug_Local/releases/download/v2026.04.24/cloudflare-config-generator.zip)
- [script.zip](https://github.com/Huiaini/Air724ug_Local/releases/download/v2026.04.24/script.zip)
- [driver.zip](https://github.com/Huiaini/Air724ug_Local/releases/download/v2026.04.24/driver.zip)

## 本地自检

```bash
node cloudflare-config-generator/smoke-test.js
```

这个脚本会验证：

- JSON 模式 `config.bin` 生成与回读
- Legacy Lua 模式兼容性
- 关键字段是否正确进入导出载荷
- SOCKS5 配置在 JSON / Legacy Lua 模式下的导出和输入校验

设备端 SOCKS5 和 HTTP 上传回归测试：

```bash
python3 -m venv /tmp/air724ug-tests
/tmp/air724ug-tests/bin/pip install -r tests/requirements.txt
/tmp/air724ug-tests/bin/python -m unittest discover -s tests -v
```

测试通过 Lupa 的 Lua 5.1 运行设备代码，使用本机 TCP SOCKS5 服务和 HTTP 接收服务验证认证、代理端域名解析、响应分片、拒绝及超时处理、文件内容一致性、直连兼容性，以及配置后加载时的完整来电录音上传流程。硬件音频和蜂窝网络仍需实机验证。

## 鸣谢

感谢 [TheHot](https://github.com/TheHot/) 公开了相关思路和脚本，本仓库的整理、适配与扩展工作是在这些公开资料的基础上继续推进的。

## 说明

- 本仓库已移除本地 Luatools、大日志、临时构建目录等非源码内容
- `script/config.lua` 中的通知密钥默认为空，使用前请自行填写，或通过 `config.bin` 覆盖
