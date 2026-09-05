const STORAGE_KEY = "air724ug-config-generator-presets-v2";
const JSON_SCHEMA = "air724ug-config/v1";

const notifyTypeOptions = [
  "bark",
  "custom_post",
  "telegram",
  "pushdeer",
  "dingtalk",
  "feishu",
  "wecom",
  "pushover",
  "inotify",
  "next-smtp-proxy",
  "gotify",
  "serverchan",
];

const formIds = [
  "presetName",
  "customerName",
  "exportFormat",
  "configKey",
  "allowLegacyLua",
  "bootNotify",
  "bootNotifySuffix",
  "audioVolume",
  "callVolume",
  "micVolume",
  "callInAction",
  "smsTts",
  "queryTrafficInterval",
  "rndisEnable",
  "ledEnable",
  "pinCode",
  "number",
  "ttsText",
  "notifyHeader",
  "notifyHeaderTailLen",
  "notifyHeaderFallback",
  "notifyAppendMoreInfo",
  "notifyRetryMax",
  "barkApi",
  "barkKey",
  "customPostUrl",
  "customPostContentType",
  "customPostBodyTable",
  "telegramApi",
  "telegramChatId",
  "pushdeerApi",
  "pushdeerKey",
  "dingtalkWebhook",
  "dingtalkSecret",
  "feishuWebhook",
  "wecomWebhook",
  "pushoverApiToken",
  "pushoverUserKey",
  "inotifyApi",
  "nextSmtpProxyApi",
  "nextSmtpProxyUser",
  "nextSmtpProxyPassword",
  "nextSmtpProxyHost",
  "nextSmtpProxyPort",
  "nextSmtpProxyFormName",
  "nextSmtpProxyToEmail",
  "nextSmtpProxySubject",
  "gotifyApi",
  "gotifyToken",
  "gotifyTitle",
  "gotifyPriority",
  "serverchanApi",
  "serverchanTitle",
  "smsWhitelist",
  "uploadUrl",
  "uploadSocks5Enable",
  "uploadSocks5Host",
  "uploadSocks5Port",
  "uploadSocks5Username",
  "uploadSocks5Password",
  "uploadSocks5Timeout",
  "extraLua",
];

const previewIds = [
  "luaPreview",
  "payloadPreview",
  "statusOutput",
  "presetPicker",
  "templateList",
  "renderBtn",
  "downloadLuaBtn",
  "downloadBinBtn",
  "savePresetBtn",
  "loadPresetBtn",
  "deletePresetBtn",
  "exportPresetBtn",
  "importPresetInput",
  "derivedKeyPreview",
  "summaryExportMode",
  "summaryPayloadMode",
  "summaryCustomer",
];

const el = Object.fromEntries(
  [...formIds, ...previewIds].map((id) => [id, document.getElementById(id)])
);

const defaultState = {
  presetName: "",
  customerName: "",
  exportFormat: "json",
  configKey: "jocry",
  allowLegacyLua: true,
  bootNotify: true,
  bootNotifySuffix: "reason_zh",
  audioVolume: 1,
  callVolume: 0,
  micVolume: 7,
  callInAction: 4,
  smsTts: 0,
  queryTrafficInterval: 0,
  rndisEnable: false,
  ledEnable: true,
  pinCode: "",
  number: "",
  ttsText: "",
  notifyHeader: "#{tail} ",
  notifyHeaderTailLen: 4,
  notifyHeaderFallback: "#0000 ",
  notifyAppendMoreInfo: true,
  notifyRetryMax: 10,
  notifyTypes: ["bark"],
  barkApi: "https://api.day.app",
  barkKey: "",
  customPostUrl: "",
  customPostContentType: "",
  customPostBodyTable: "",
  telegramApi: "",
  telegramChatId: "",
  pushdeerApi: "",
  pushdeerKey: "",
  dingtalkWebhook: "",
  dingtalkSecret: "",
  feishuWebhook: "",
  wecomWebhook: "",
  pushoverApiToken: "",
  pushoverUserKey: "",
  inotifyApi: "",
  nextSmtpProxyApi: "",
  nextSmtpProxyUser: "",
  nextSmtpProxyPassword: "",
  nextSmtpProxyHost: "",
  nextSmtpProxyPort: 587,
  nextSmtpProxyFormName: "Air724UG",
  nextSmtpProxyToEmail: "",
  nextSmtpProxySubject: "来自 Air724UG 的通知",
  gotifyApi: "",
  gotifyToken: "",
  gotifyTitle: "Air724UG",
  gotifyPriority: 8,
  serverchanApi: "",
  serverchanTitle: "来自 Air724UG 的通知",
  smsWhitelist: [],
  uploadUrl: "",
  uploadSocks5Enable: false,
  uploadSocks5Host: "",
  uploadSocks5Port: 1080,
  uploadSocks5Username: "",
  uploadSocks5Password: "",
  uploadSocks5Timeout: 15000,
  extraLua: "",
};

const templateLibrary = [
  {
    id: "bark-standard",
    name: "Bark 标准交付",
    tag: "iPhone 通知",
    description: "保持默认行为，适合只使用 Bark 推送的个人客户。",
    patch: {
      presetName: "Bark 标准交付",
      notifyTypes: ["bark"],
      bootNotify: true,
      rndisEnable: false,
      ledEnable: true,
      audioVolume: 1,
      callInAction: 4,
    },
  },
  {
    id: "enterprise-im",
    name: "企业 IM 联动",
    tag: "飞书 / 企微",
    description: "开启更多设备信息，适合运维群或企业机器人通知。",
    patch: {
      presetName: "企业 IM 联动",
      notifyTypes: ["wecom", "feishu"],
      notifyAppendMoreInfo: true,
      bootNotify: true,
      notifyRetryMax: 8,
    },
  },
  {
    id: "silent-rndis",
    name: "静默网卡模式",
    tag: "现场驻留",
    description: "关闭提示音和状态灯，开启 RNDIS，适合驻场网关。",
    patch: {
      presetName: "静默网卡模式",
      rndisEnable: true,
      ledEnable: false,
      bootNotify: false,
      audioVolume: 0,
      callVolume: 0,
      micVolume: 0,
    },
  },
  {
    id: "record-upload",
    name: "录音回传模板",
    tag: "留言录音",
    description: "保留接听动作和 TTS 引导，填入上传 URL 后可交付录音场景。",
    patch: {
      presetName: "录音回传模板",
      notifyTypes: ["bark"],
      callInAction: 1,
      ttsText: "您好，请在提示音后留言，结束请挂机。",
      uploadUrl: "https://example.com/record",
    },
  },
];

const configKeyOrder = [
  "CONFIG_BIN_KEY",
  "CONFIG_BIN_ALLOW_LEGACY_LUA",
  "NOTIFY_TYPE",
  "QUERY_TRAFFIC_INTERVAL",
  "BOOT_NOTIFY",
  "BOOT_NOTIFY_SUFFIX",
  "NOTIFY_APPEND_MORE_INFO",
  "NOTIFY_HEADER",
  "NOTIFY_HEADER_TAIL_LEN",
  "NOTIFY_HEADER_FALLBACK",
  "NOTIFY_RETRY_MAX",
  "CUSTOM_POST_URL",
  "CUSTOM_POST_CONTENT_TYPE",
  "CUSTOM_POST_BODY_TABLE",
  "TELEGRAM_API",
  "TELEGRAM_CHAT_ID",
  "PUSHDEER_API",
  "PUSHDEER_KEY",
  "BARK_API",
  "BARK_KEY",
  "DINGTALK_WEBHOOK",
  "DINGTALK_SECRET",
  "FEISHU_WEBHOOK",
  "WECOM_WEBHOOK",
  "PUSHOVER_API_TOKEN",
  "PUSHOVER_USER_KEY",
  "INOTIFY_API",
  "NEXT_SMTP_PROXY_API",
  "NEXT_SMTP_PROXY_USER",
  "NEXT_SMTP_PROXY_PASSWORD",
  "NEXT_SMTP_PROXY_HOST",
  "NEXT_SMTP_PROXY_PORT",
  "NEXT_SMTP_PROXY_FORM_NAME",
  "NEXT_SMTP_PROXY_TO_EMAIL",
  "NEXT_SMTP_PROXY_SUBJECT",
  "GOTIFY_API",
  "GOTIFY_TITLE",
  "GOTIFY_PRIORITY",
  "GOTIFY_TOKEN",
  "SERVERCHAN_TITLE",
  "SERVERCHAN_API",
  "UPLOAD_URL",
  "UPLOAD_SOCKS5_ENABLE",
  "UPLOAD_SOCKS5_HOST",
  "UPLOAD_SOCKS5_PORT",
  "UPLOAD_SOCKS5_USERNAME",
  "UPLOAD_SOCKS5_PASSWORD",
  "UPLOAD_SOCKS5_TIMEOUT",
  "SMS_CONTROL_WHITELIST_NUMBERS",
  "SMS_TTS",
  "TTS_TEXT",
  "CALL_IN_ACTION",
  "AUDIO_VOLUME",
  "CALL_VOLUME",
  "MIC_VOLUME",
  "RNDIS_ENABLE",
  "LED_ENABLE",
  "PIN_CODE",
  "NUMBER",
];

function setStatus(message) {
  const stamp = new Date().toLocaleString("zh-CN", { hour12: false });
  el.statusOutput.value = `[${stamp}] ${message}\n` + el.statusOutput.value;
}

function normalizeNumber(raw, fallback) {
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function splitList(raw) {
  return String(raw || "")
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonObject(raw, fieldName) {
  const text = String(raw || "").trim();
  if (!text) return null;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${fieldName} 不是合法 JSON：${error.message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fieldName} 必须是 JSON 对象`);
  }

  return parsed;
}

function collectNotifyTypes() {
  const selected = Array.from(
    document.querySelectorAll('#notifyTypes input[type="checkbox"]:checked')
  ).map((input) => input.value);

  return selected.length ? selected : ["bark"];
}

function readFormState() {
  return {
    presetName: el.presetName.value.trim(),
    customerName: el.customerName.value.trim(),
    exportFormat: el.exportFormat.value,
    configKey: (el.configKey.value || "jocry").trim() || "jocry",
    allowLegacyLua: el.allowLegacyLua.checked,
    bootNotify: el.bootNotify.value === "true",
    bootNotifySuffix: el.bootNotifySuffix.value,
    audioVolume: normalizeNumber(el.audioVolume.value, 1),
    callVolume: normalizeNumber(el.callVolume.value, 0),
    micVolume: normalizeNumber(el.micVolume.value, 7),
    callInAction: normalizeNumber(el.callInAction.value, 4),
    smsTts: normalizeNumber(el.smsTts.value, 0),
    queryTrafficInterval: normalizeNumber(el.queryTrafficInterval.value, 0),
    rndisEnable: el.rndisEnable.checked,
    ledEnable: el.ledEnable.checked,
    pinCode: el.pinCode.value.trim(),
    number: el.number.value.trim(),
    ttsText: el.ttsText.value,
    notifyHeader: el.notifyHeader.value,
    notifyHeaderTailLen: normalizeNumber(el.notifyHeaderTailLen.value, 4),
    notifyHeaderFallback: el.notifyHeaderFallback.value,
    notifyAppendMoreInfo: el.notifyAppendMoreInfo.checked,
    notifyRetryMax: normalizeNumber(el.notifyRetryMax.value, 10),
    notifyTypes: collectNotifyTypes(),
    barkApi: el.barkApi.value.trim(),
    barkKey: el.barkKey.value.trim(),
    customPostUrl: el.customPostUrl.value.trim(),
    customPostContentType: el.customPostContentType.value.trim(),
    customPostBodyTable: el.customPostBodyTable.value,
    telegramApi: el.telegramApi.value.trim(),
    telegramChatId: el.telegramChatId.value.trim(),
    pushdeerApi: el.pushdeerApi.value.trim(),
    pushdeerKey: el.pushdeerKey.value.trim(),
    dingtalkWebhook: el.dingtalkWebhook.value.trim(),
    dingtalkSecret: el.dingtalkSecret.value.trim(),
    feishuWebhook: el.feishuWebhook.value.trim(),
    wecomWebhook: el.wecomWebhook.value.trim(),
    pushoverApiToken: el.pushoverApiToken.value.trim(),
    pushoverUserKey: el.pushoverUserKey.value.trim(),
    inotifyApi: el.inotifyApi.value.trim(),
    nextSmtpProxyApi: el.nextSmtpProxyApi.value.trim(),
    nextSmtpProxyUser: el.nextSmtpProxyUser.value.trim(),
    nextSmtpProxyPassword: el.nextSmtpProxyPassword.value.trim(),
    nextSmtpProxyHost: el.nextSmtpProxyHost.value.trim(),
    nextSmtpProxyPort: normalizeNumber(el.nextSmtpProxyPort.value, 587),
    nextSmtpProxyFormName: el.nextSmtpProxyFormName.value.trim(),
    nextSmtpProxyToEmail: el.nextSmtpProxyToEmail.value.trim(),
    nextSmtpProxySubject: el.nextSmtpProxySubject.value.trim(),
    gotifyApi: el.gotifyApi.value.trim(),
    gotifyToken: el.gotifyToken.value.trim(),
    gotifyTitle: el.gotifyTitle.value.trim(),
    gotifyPriority: normalizeNumber(el.gotifyPriority.value, 8),
    serverchanApi: el.serverchanApi.value.trim(),
    serverchanTitle: el.serverchanTitle.value.trim(),
    smsWhitelist: splitList(el.smsWhitelist.value),
    uploadUrl: el.uploadUrl.value.trim(),
    uploadSocks5Enable: el.uploadSocks5Enable.checked,
    uploadSocks5Host: el.uploadSocks5Host.value.trim(),
    uploadSocks5Port: Number(el.uploadSocks5Port.value),
    uploadSocks5Username: el.uploadSocks5Username.value,
    uploadSocks5Password: el.uploadSocks5Password.value,
    uploadSocks5Timeout: Number(el.uploadSocks5Timeout.value),
    extraLua: el.extraLua.value.trim(),
  };
}

function normalizeState(state) {
  const merged = { ...defaultState, ...(state || {}) };
  if (!Array.isArray(merged.notifyTypes)) merged.notifyTypes = [...defaultState.notifyTypes];
  if (!Array.isArray(merged.smsWhitelist)) merged.smsWhitelist = splitList(merged.smsWhitelist);
  if (!notifyTypeOptions.some((item) => merged.notifyTypes.includes(item))) {
    merged.notifyTypes = [...defaultState.notifyTypes];
  }
  return merged;
}

function applyFormState(state) {
  const merged = normalizeState(state);

  for (const id of formIds) {
    const node = el[id];
    if (!node || !(id in merged)) continue;

    if (node.type === "checkbox") {
      node.checked = Boolean(merged[id]);
    } else if (id === "smsWhitelist") {
      node.value = Array.isArray(merged[id]) ? merged[id].join("\n") : String(merged[id] || "");
    } else if (id === "customPostBodyTable" && typeof merged[id] === "object" && merged[id] !== null) {
      node.value = JSON.stringify(merged[id], null, 2);
    } else {
      node.value = merged[id] ?? "";
    }
  }

  for (const input of document.querySelectorAll('#notifyTypes input[type="checkbox"]')) {
    input.checked = merged.notifyTypes.includes(input.value);
  }

  updateSummary(merged);
}

function escapeLuaString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function luaSerialize(value) {
  if (Array.isArray(value)) {
    return `{ ${value.map((item) => luaSerialize(item)).join(", ")} }`;
  }

  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "string") return `"${escapeLuaString(value)}"`;

  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(
      ([key, item]) => `["${escapeLuaString(key)}"] = ${luaSerialize(item)}`
    );
    return `{ ${entries.join(", ")} }`;
  }

  return `""`;
}

function maybeSet(configObject, key, value) {
  if (typeof value === "string") {
    if (value.trim()) configObject[key] = value;
    return;
  }

  if (Array.isArray(value)) {
    if (value.length) configObject[key] = value;
    return;
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) configObject[key] = value;
    return;
  }

  if (typeof value === "boolean") {
    configObject[key] = value;
    return;
  }

  if (value && typeof value === "object") {
    configObject[key] = value;
  }
}

function buildConfigObject(state) {
  if (state.uploadSocks5Enable) {
    if (!/^http:\/\/[^/?#\s]+(?:[/?#]|$)/.test(state.uploadUrl)) {
      throw new Error("启用 SOCKS5 时，录音上传 URL 必须填写 http:// 地址");
    }
    const hostBytes = CryptoJS.enc.Utf8.parse(state.uploadSocks5Host).sigBytes;
    if (!hostBytes || hostBytes > 255 || /[\s\x00/:@]/.test(state.uploadSocks5Host)) {
      throw new Error("SOCKS5 地址请填写域名或 IPv4，不含协议、端口和路径");
    }
    if (!Number.isInteger(state.uploadSocks5Port) || state.uploadSocks5Port < 1 || state.uploadSocks5Port > 65535) {
      throw new Error("SOCKS5 端口必须是 1-65535 的整数");
    }
    if (!Number.isInteger(state.uploadSocks5Timeout) || state.uploadSocks5Timeout < 1 || state.uploadSocks5Timeout > 300000) {
      throw new Error("SOCKS5 握手超时必须是 1-300000 毫秒的整数");
    }
    if (state.uploadSocks5Username || state.uploadSocks5Password) {
      const usernameBytes = CryptoJS.enc.Utf8.parse(state.uploadSocks5Username).sigBytes;
      const passwordBytes = CryptoJS.enc.Utf8.parse(state.uploadSocks5Password).sigBytes;
      if (usernameBytes < 1 || usernameBytes > 255 || passwordBytes < 1 || passwordBytes > 255) {
        throw new Error("SOCKS5 用户名和密码必须同时填写，各为 1-255 字节；无认证时均留空");
      }
    }
  }
  const configObject = {
    CONFIG_BIN_KEY: state.configKey,
    CONFIG_BIN_ALLOW_LEGACY_LUA: Boolean(state.allowLegacyLua),
    NOTIFY_TYPE: state.notifyTypes.length ? state.notifyTypes : ["bark"],
    QUERY_TRAFFIC_INTERVAL: state.queryTrafficInterval,
    BOOT_NOTIFY: state.bootNotify,
    BOOT_NOTIFY_SUFFIX: state.bootNotifySuffix,
    NOTIFY_APPEND_MORE_INFO: state.notifyAppendMoreInfo,
    NOTIFY_HEADER: state.notifyHeader,
    NOTIFY_HEADER_TAIL_LEN: state.notifyHeaderTailLen,
    NOTIFY_HEADER_FALLBACK: state.notifyHeaderFallback,
    NOTIFY_RETRY_MAX: state.notifyRetryMax,
    SMS_CONTROL_WHITELIST_NUMBERS: state.smsWhitelist,
    SMS_TTS: state.smsTts,
    CALL_IN_ACTION: state.callInAction,
    AUDIO_VOLUME: state.audioVolume,
    CALL_VOLUME: state.callVolume,
    MIC_VOLUME: state.micVolume,
    RNDIS_ENABLE: state.rndisEnable,
    LED_ENABLE: state.ledEnable,
    PIN_CODE: state.pinCode,
    NUMBER: state.number,
    UPLOAD_SOCKS5_ENABLE: state.uploadSocks5Enable,
    UPLOAD_SOCKS5_HOST: state.uploadSocks5Host,
    UPLOAD_SOCKS5_PORT: state.uploadSocks5Port,
    UPLOAD_SOCKS5_USERNAME: state.uploadSocks5Username,
    UPLOAD_SOCKS5_PASSWORD: state.uploadSocks5Password,
    UPLOAD_SOCKS5_TIMEOUT: state.uploadSocks5Timeout,
  };

  maybeSet(configObject, "TTS_TEXT", state.ttsText.trim());
  maybeSet(configObject, "UPLOAD_URL", state.uploadUrl);
  maybeSet(configObject, "BARK_API", state.barkApi);
  maybeSet(configObject, "BARK_KEY", state.barkKey);
  maybeSet(configObject, "CUSTOM_POST_URL", state.customPostUrl);
  maybeSet(configObject, "CUSTOM_POST_CONTENT_TYPE", state.customPostContentType);

  const customPostTable = parseJsonObject(state.customPostBodyTable, "CUSTOM_POST_BODY_TABLE");
  if (customPostTable) maybeSet(configObject, "CUSTOM_POST_BODY_TABLE", customPostTable);

  maybeSet(configObject, "TELEGRAM_API", state.telegramApi);
  maybeSet(configObject, "TELEGRAM_CHAT_ID", state.telegramChatId);
  maybeSet(configObject, "PUSHDEER_API", state.pushdeerApi);
  maybeSet(configObject, "PUSHDEER_KEY", state.pushdeerKey);
  maybeSet(configObject, "DINGTALK_WEBHOOK", state.dingtalkWebhook);
  maybeSet(configObject, "DINGTALK_SECRET", state.dingtalkSecret);
  maybeSet(configObject, "FEISHU_WEBHOOK", state.feishuWebhook);
  maybeSet(configObject, "WECOM_WEBHOOK", state.wecomWebhook);
  maybeSet(configObject, "PUSHOVER_API_TOKEN", state.pushoverApiToken);
  maybeSet(configObject, "PUSHOVER_USER_KEY", state.pushoverUserKey);
  maybeSet(configObject, "INOTIFY_API", state.inotifyApi);
  maybeSet(configObject, "NEXT_SMTP_PROXY_API", state.nextSmtpProxyApi);
  maybeSet(configObject, "NEXT_SMTP_PROXY_USER", state.nextSmtpProxyUser);
  maybeSet(configObject, "NEXT_SMTP_PROXY_PASSWORD", state.nextSmtpProxyPassword);
  maybeSet(configObject, "NEXT_SMTP_PROXY_HOST", state.nextSmtpProxyHost);
  maybeSet(configObject, "NEXT_SMTP_PROXY_PORT", state.nextSmtpProxyPort);
  maybeSet(configObject, "NEXT_SMTP_PROXY_FORM_NAME", state.nextSmtpProxyFormName);
  maybeSet(configObject, "NEXT_SMTP_PROXY_TO_EMAIL", state.nextSmtpProxyToEmail);
  maybeSet(configObject, "NEXT_SMTP_PROXY_SUBJECT", state.nextSmtpProxySubject);
  maybeSet(configObject, "GOTIFY_API", state.gotifyApi);
  maybeSet(configObject, "GOTIFY_TITLE", state.gotifyTitle);
  maybeSet(configObject, "GOTIFY_PRIORITY", state.gotifyPriority);
  maybeSet(configObject, "GOTIFY_TOKEN", state.gotifyToken);
  maybeSet(configObject, "SERVERCHAN_TITLE", state.serverchanTitle);
  maybeSet(configObject, "SERVERCHAN_API", state.serverchanApi);

  return configObject;
}

function orderedConfigEntries(configObject) {
  const seen = new Set();
  const ordered = [];

  for (const key of configKeyOrder) {
    if (key in configObject) {
      ordered.push([key, configObject[key]]);
      seen.add(key);
    }
  }

  for (const key of Object.keys(configObject).sort()) {
    if (!seen.has(key)) ordered.push([key, configObject[key]]);
  }

  return ordered;
}

function buildLuaConfig(state) {
  const configObject = buildConfigObject(state);
  const lines = [
    "module(...)",
    "",
    "-- Generated by Air724UG Cloudflare Config Generator",
  ];

  for (const [key, value] of orderedConfigEntries(configObject)) {
    lines.push(`${key} = ${luaSerialize(value)}`);
  }

  if (state.extraLua && state.exportFormat === "legacy-lua") {
    lines.push("", "-- Legacy extra lua", state.extraLua);
  }

  return `${lines.join("\n")}\n`;
}

function buildJsonPayload(state) {
  const payload = {
    schema: JSON_SCHEMA,
    generatedAt: new Date().toISOString(),
    presetName: state.presetName || "",
    customerName: state.customerName || "",
    generator: "air724ug-cloudflare-config-generator",
    config: buildConfigObject(state),
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

function buildPayload(state) {
  if (state.exportFormat === "legacy-lua") {
    return {
      modeLabel: "旧版 Lua 脚本兼容",
      text: buildLuaConfig(state),
    };
  }

  return {
    modeLabel: "JSON 安全配置",
    text: buildJsonPayload(state),
  };
}

function deriveCompatKey(configKey) {
  const md5Hex = CryptoJS.MD5(configKey).toString(CryptoJS.enc.Hex).toLowerCase();
  return md5Hex.slice(0, 16);
}

function createConfigBin(plainText, configKey) {
  const compatKey = deriveCompatKey(configKey);
  const keyWordArray = CryptoJS.enc.Utf8.parse(compatKey);
  const plainWordArray = CryptoJS.enc.Utf8.parse(plainText);
  const encrypted = CryptoJS.AES.encrypt(plainWordArray, keyWordArray, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.ZeroPadding,
  });

  return {
    compatKey,
    base64: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
  };
}

function downloadTextFile(fileName, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildPresetFileName(state) {
  const rawName = state.presetName || state.customerName || "air724ug-preset";
  return `${rawName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim() || "air724ug-preset"}.json`;
}

function updateSummary(state) {
  const modeLabel = state.exportFormat === "legacy-lua" ? "旧版 Lua 兼容" : "JSON 安全载荷";
  el.derivedKeyPreview.textContent = deriveCompatKey(state.configKey || "jocry");
  el.summaryExportMode.textContent = modeLabel;
  el.summaryPayloadMode.textContent = modeLabel;
  el.summaryCustomer.textContent = state.customerName || state.presetName || "未命名客户";
}

function renderPreview() {
  const state = readFormState();
  const luaText = buildLuaConfig(state);
  const payload = buildPayload(state);

  el.luaPreview.value = luaText;
  el.payloadPreview.value = payload.text;
  updateSummary(state);

  return { state, luaText, payloadText: payload.text, payloadMode: payload.modeLabel };
}

function readPresets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writePresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets, null, 2));
}

function refreshPresetPicker() {
  const presets = readPresets();
  const names = Object.keys(presets).sort();
  el.presetPicker.innerHTML = "";

  if (!names.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "暂无预设";
    el.presetPicker.appendChild(option);
    return;
  }

  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    el.presetPicker.appendChild(option);
  }
}

function savePreset() {
  const state = normalizeState(readFormState());
  const name =
    state.presetName ||
    state.customerName ||
    `preset-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`;
  state.presetName = name;

  const presets = readPresets();
  presets[name] = state;
  writePresets(presets);
  applyFormState(state);
  refreshPresetPicker();
  el.presetPicker.value = name;
  setStatus(`已保存浏览器预设：${name}`);
}

function loadPreset() {
  const name = el.presetPicker.value;
  const presets = readPresets();

  if (!name || !presets[name]) {
    setStatus("没有可载入的预设。");
    return;
  }

  applyFormState(presets[name]);
  renderPreview();
  setStatus(`已载入预设：${name}`);
}

function deletePreset() {
  const name = el.presetPicker.value;
  const presets = readPresets();

  if (!name || !presets[name]) {
    setStatus("没有可删除的预设。");
    return;
  }

  delete presets[name];
  writePresets(presets);
  refreshPresetPicker();
  setStatus(`已删除预设：${name}`);
}

function exportPreset() {
  const state = normalizeState(readFormState());
  const fileName = buildPresetFileName(state);
  downloadTextFile(fileName, JSON.stringify(state, null, 2), "application/json;charset=utf-8");
  setStatus(`已导出预设 JSON：${fileName}`);
}

function importPreset(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const state = JSON.parse(String(reader.result));
      applyFormState(state);
      renderPreview();
      setStatus(`已导入预设：${state.presetName || state.customerName || "未命名预设"}`);
    } catch (error) {
      setStatus(`导入失败：${error.message}`);
    }
  };
  reader.readAsText(file, "utf-8");
}

function renderTemplateCards() {
  el.templateList.innerHTML = templateLibrary
    .map(
      (item) => `
        <article class="template-card">
          <span class="section-kicker">${item.tag}</span>
          <h4>${item.name}</h4>
          <p>${item.description}</p>
          <button class="btn btn-small" type="button" data-template="${item.id}">套用模板</button>
        </article>
      `
    )
    .join("");
}

function applyTemplate(templateId) {
  const template = templateLibrary.find((item) => item.id === templateId);
  if (!template) return;

  const current = readFormState();
  const merged = normalizeState({
    ...current,
    ...template.patch,
    configKey: current.configKey,
    customerName: current.customerName,
  });

  applyFormState(merged);
  renderPreview();
  setStatus(`已套用模板：${template.name}`);
}

function bindEvents() {
  el.renderBtn.addEventListener("click", () => {
    try {
      const { payloadMode } = renderPreview();
      setStatus(`预览已更新：${payloadMode}`);
    } catch (error) {
      setStatus(`生成失败：${error.message}`);
    }
  });

  el.downloadLuaBtn.addEventListener("click", () => {
    try {
      const { luaText } = renderPreview();
      downloadTextFile("config.lua", luaText);
      setStatus("已导出 config.lua。");
    } catch (error) {
      setStatus(`导出失败：${error.message}`);
    }
  });

  el.downloadBinBtn.addEventListener("click", () => {
    try {
      const { state, payloadText, payloadMode } = renderPreview();
      const { compatKey, base64 } = createConfigBin(payloadText, state.configKey);
      downloadTextFile("config.bin", base64, "application/octet-stream");
      setStatus(`已导出 config.bin：${payloadMode}，兼容派生 key=${compatKey}`);
    } catch (error) {
      setStatus(`导出失败：${error.message}`);
    }
  });

  el.savePresetBtn.addEventListener("click", savePreset);
  el.loadPresetBtn.addEventListener("click", loadPreset);
  el.deletePresetBtn.addEventListener("click", deletePreset);
  el.exportPresetBtn.addEventListener("click", exportPreset);

  el.importPresetInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) importPreset(file);
    event.target.value = "";
  });

  el.templateList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-template]");
    if (button) applyTemplate(button.dataset.template);
  });

  for (const id of formIds) {
    const node = el[id];
    if (!node) continue;

    const eventName = node.tagName === "TEXTAREA" || node.type === "text" ? "input" : "change";
    node.addEventListener(eventName, () => {
      updateSummary(readFormState());
    });
  }

  for (const input of document.querySelectorAll('#notifyTypes input[type="checkbox"]')) {
    input.addEventListener("change", () => {
      updateSummary(readFormState());
    });
  }
}

function init() {
  renderTemplateCards();
  applyFormState(defaultState);
  refreshPresetPicker();
  bindEvents();
  renderPreview();
  setStatus("生成器已就绪，可直接部署到 Cloudflare Pages。");
}

init();
