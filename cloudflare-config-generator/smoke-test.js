const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CryptoJS = require("./vendor/crypto-js.min.js");

const FORM_IDS = [
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

const PREVIEW_IDS = [
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

const NOTIFY_TYPES = [
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

function makeElement(id) {
  const textareaIds = new Set([
    "luaPreview",
    "payloadPreview",
    "statusOutput",
    "smsWhitelist",
    "uploadUrl",
    "customPostBodyTable",
  ]);
  const checkboxIds = new Set([
    "allowLegacyLua",
    "uploadSocks5Enable",
    "rndisEnable",
    "ledEnable",
    "notifyAppendMoreInfo",
  ]);
  const selectIds = new Set([
    "bootNotify",
    "bootNotifySuffix",
    "exportFormat",
    "callInAction",
    "smsTts",
    "customPostContentType",
  ]);

  return {
    id,
    value: "",
    checked: false,
    innerHTML: "",
    textContent: "",
    tagName: textareaIds.has(id) ? "TEXTAREA" : "INPUT",
    type: checkboxIds.has(id) ? "checkbox" : (selectIds.has(id) ? "select-one" : "text"),
    dataset: {},
    files: null,
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    click() {},
    closest() {
      return null;
    },
  };
}

function createHarness() {
  const elements = Object.fromEntries(
    [...FORM_IDS, ...PREVIEW_IDS].map((id) => [id, makeElement(id)])
  );

  const notifyInputs = NOTIFY_TYPES.map((value) => ({
    value,
    checked: value === "bark",
    addEventListener() {},
    closest() {
      return null;
    },
  }));

  elements.bootNotify.value = "true";
  elements.bootNotifySuffix.value = "reason_zh";
  elements.exportFormat.value = "json";
  elements.callInAction.value = "4";
  elements.smsTts.value = "0";
  elements.customPostContentType.value = "";

  const documentStub = {
    body: { appendChild() {} },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === '#notifyTypes input[type="checkbox"]') return notifyInputs;
      if (selector === '#notifyTypes input[type="checkbox"]:checked') {
        return notifyInputs.filter((item) => item.checked);
      }
      return [];
    },
    createElement() {
      return {
        href: "",
        download: "",
        click() {},
        remove() {},
      };
    },
  };

  const context = {
    console,
    CryptoJS,
    document: documentStub,
    localStorage: {
      _data: {},
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null;
      },
      setItem(key, value) {
        this._data[key] = String(value);
      },
      removeItem(key) {
        delete this._data[key];
      },
    },
    Blob: global.Blob,
    URL: {
      createObjectURL() {
        return "blob:smoke-test";
      },
      revokeObjectURL() {},
    },
    FileReader: function FileReader() {},
    Date,
    JSON,
    Number,
    String,
    Array,
    Object,
    Math,
    Set,
    RegExp,
    Error,
  };
  context.globalThis = context;

  const appSource = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  const expose = "\n" +
    "globalThis.__smoke = { renderPreview, createConfigBin, applyTemplate, el };";
  vm.createContext(context);
  vm.runInContext(appSource + expose, context, { filename: "app.js" });

  return {
    elements,
    notifyInputs,
    api: context.__smoke,
  };
}

function setNotifyTypes(notifyInputs, values) {
  const selected = new Set(values);
  for (const input of notifyInputs) {
    input.checked = selected.has(input.value);
  }
}

function decryptConfigBin(base64, compatKey) {
  const key = Buffer.from(compatKey, "utf8");
  const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
  decipher.setAutoPadding(false);

  const raw = Buffer.concat([
    decipher.update(Buffer.from(base64, "base64")),
    decipher.final(),
  ]);

  return raw.toString("utf8").replace(/\x00+$/g, "");
}

function runJsonModeTest() {
  const { api, elements, notifyInputs } = createHarness();

  elements.customerName.value = "customer-json";
  elements.presetName.value = "preset-json";
  elements.configKey.value = "jocry";
  elements.barkKey.value = "demo-bark-key";
  elements.number.value = "13800138000";
  elements.notifyHeader.value = "#{tail} ";
  elements.notifyHeaderTailLen.value = "4";
  elements.notifyHeaderFallback.value = "#0000 ";
  elements.notifyRetryMax.value = "10";
  elements.queryTrafficInterval.value = "0";
  elements.audioVolume.value = "1";
  elements.callVolume.value = "0";
  elements.micVolume.value = "7";
  elements.smsWhitelist.value = "13800138000\n13900139000";
  elements.uploadUrl.value = "https://example.com/upload";
  elements.customPostBodyTable.value = '{"title":"Air724UG","desp":"{msg}"}';
  setNotifyTypes(notifyInputs, ["bark", "custom_post"]);

  const preview = api.renderPreview();
  const encrypted = api.createConfigBin(preview.payloadText, preview.state.configKey);
  const plain = decryptConfigBin(encrypted.base64, encrypted.compatKey);
  const payload = JSON.parse(plain);

  assert.equal(preview.payloadMode, "JSON 安全配置");
  assert.equal(plain, preview.payloadText);
  assert.equal(payload.schema, "air724ug-config/v1");
  assert.equal(payload.customerName, "customer-json");
  assert.equal(payload.config.BARK_KEY, "demo-bark-key");
  assert.deepEqual(payload.config.NOTIFY_TYPE, ["bark", "custom_post"]);
  assert.equal(payload.config.NUMBER, "13800138000");
  assert.equal(payload.config.SMS_CONTROL_WHITELIST_NUMBERS.length, 2);
  assert.equal(typeof payload.config.CUSTOM_POST_BODY_TABLE, "object");

  return {
    mode: preview.payloadMode,
    compatKey: encrypted.compatKey,
    number: payload.config.NUMBER,
  };
}

function runLegacyModeTest() {
  const { api, elements, notifyInputs } = createHarness();

  elements.exportFormat.value = "legacy-lua";
  elements.configKey.value = "jocry";
  elements.bootNotify.value = "true";
  elements.bootNotifySuffix.value = "reason_zh";
  elements.audioVolume.value = "1";
  elements.callVolume.value = "0";
  elements.micVolume.value = "7";
  elements.callInAction.value = "4";
  elements.smsTts.value = "0";
  elements.queryTrafficInterval.value = "0";
  elements.notifyHeader.value = "#{tail} ";
  elements.notifyHeaderTailLen.value = "4";
  elements.notifyHeaderFallback.value = "#0000 ";
  elements.notifyRetryMax.value = "10";
  elements.barkApi.value = "https://api.day.app";
  elements.barkKey.value = "legacy-bark-key";
  elements.number.value = "13900139000";
  elements.extraLua.value = "EXTRA_TEST = true";
  setNotifyTypes(notifyInputs, ["bark"]);

  const preview = api.renderPreview();
  const encrypted = api.createConfigBin(preview.payloadText, "jocry");
  const plain = decryptConfigBin(encrypted.base64, encrypted.compatKey);

  assert.equal(preview.payloadMode, "旧版 Lua 脚本兼容");
  assert.ok(plain.includes('module(...)'));
  assert.ok(plain.includes('BARK_KEY = "legacy-bark-key"'));
  assert.ok(plain.includes('NUMBER = "13900139000"'));
  assert.ok(plain.includes("EXTRA_TEST = true"));

  return {
    mode: preview.payloadMode,
    compatKey: encrypted.compatKey,
  };
}

const jsonResult = runJsonModeTest();
const legacyResult = runLegacyModeTest();

function runSocks5Test() {
  const { api, elements } = createHarness();
  let preview = api.renderPreview();
  assert.equal(JSON.parse(preview.payloadText).config.UPLOAD_SOCKS5_ENABLE, false);
  elements.uploadSocks5Enable.checked = true;
  elements.uploadUrl.value = "http://upload.example.com/base";
  elements.uploadSocks5Host.value = "proxy.example.com";
  elements.uploadSocks5Port.value = "1081";
  elements.uploadSocks5Timeout.value = "12000";
  elements.uploadSocks5Username.value = " test-user ";
  elements.uploadSocks5Password.value = 'test-pass\\"密';
  preview = api.renderPreview();
  const encrypted = api.createConfigBin(preview.payloadText, preview.state.configKey);
  const payload = JSON.parse(decryptConfigBin(encrypted.base64, encrypted.compatKey));
  assert.equal(payload.config.UPLOAD_SOCKS5_ENABLE, true);
  assert.equal(payload.config.UPLOAD_SOCKS5_HOST, "proxy.example.com");
  assert.equal(payload.config.UPLOAD_SOCKS5_PORT, 1081);
  assert.equal(payload.config.UPLOAD_SOCKS5_TIMEOUT, 12000);
  assert.equal(payload.config.UPLOAD_SOCKS5_USERNAME, " test-user ");
  assert.equal(payload.config.UPLOAD_SOCKS5_PASSWORD, 'test-pass\\"密');
  elements.exportFormat.value = "legacy-lua";
  preview = api.renderPreview();
  const legacy = api.createConfigBin(preview.payloadText, preview.state.configKey);
  const lua = decryptConfigBin(legacy.base64, legacy.compatKey);
  assert.ok(lua.includes("UPLOAD_SOCKS5_ENABLE = true"));
  assert.ok(lua.includes('UPLOAD_SOCKS5_USERNAME = " test-user "'));
  assert.ok(lua.includes('UPLOAD_SOCKS5_PASSWORD = "test-pass\\\\\\"密"'));
  for (const [id, value] of [
    ["uploadUrl", "https://upload.example.com"],
    ["uploadSocks5Host", "socks5://proxy.example.com"],
    ["uploadSocks5Port", "0"],
    ["uploadSocks5Port", "65536"],
    ["uploadSocks5Timeout", "0"],
    ["uploadSocks5Password", ""],
    ["uploadSocks5Password", "密".repeat(86)],
  ]) {
    const old = elements[id].value;
    elements[id].value = value;
    assert.throws(() => api.renderPreview(), /SOCKS5/);
    elements[id].value = old;
  }
  elements.uploadSocks5Username.value = "";
  elements.uploadSocks5Password.value = "";
  assert.doesNotThrow(() => api.renderPreview());
  return { ok: true, modes: ["json", "legacy-lua"], validation: true };
}

const socks5Result = runSocks5Test();

console.log(
  JSON.stringify(
    {
      ok: true,
      json: jsonResult,
      legacy: legacyResult,
      socks5: socks5Result,
    },
    null,
    2
  )
);
