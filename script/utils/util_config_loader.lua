module(..., package.seeall)

local LOG_TAG = "util_config_loader"
local DEFAULT_CONFIG_BIN_KEY = "jocry"
local JSON_SCHEMA = "air724ug-config/v1"

local ALLOWED_CONFIG_TYPES = {
    CONFIG_BIN_KEY = "string",
    CONFIG_BIN_ALLOW_LEGACY_LUA = "boolean",
    NOTIFY_TYPE = "table",
    CUSTOM_POST_URL = "string",
    CUSTOM_POST_CONTENT_TYPE = "string",
    CUSTOM_POST_BODY_TABLE = "table",
    TELEGRAM_API = "string",
    TELEGRAM_CHAT_ID = "string",
    PUSHDEER_API = "string",
    PUSHDEER_KEY = "string",
    BARK_API = "string",
    BARK_KEY = "string",
    DINGTALK_WEBHOOK = "string",
    DINGTALK_SECRET = "string",
    FEISHU_WEBHOOK = "string",
    WECOM_WEBHOOK = "string",
    PUSHOVER_API_TOKEN = "string",
    PUSHOVER_USER_KEY = "string",
    INOTIFY_API = "string",
    NEXT_SMTP_PROXY_API = "string",
    NEXT_SMTP_PROXY_USER = "string",
    NEXT_SMTP_PROXY_PASSWORD = "string",
    NEXT_SMTP_PROXY_HOST = "string",
    NEXT_SMTP_PROXY_PORT = "number",
    NEXT_SMTP_PROXY_FORM_NAME = "string",
    NEXT_SMTP_PROXY_TO_EMAIL = "string",
    NEXT_SMTP_PROXY_SUBJECT = "string",
    GOTIFY_API = "string",
    GOTIFY_TITLE = "string",
    GOTIFY_PRIORITY = "number",
    GOTIFY_TOKEN = "string",
    SERVERCHAN_TITLE = "string",
    SERVERCHAN_API = "string",
    QUERY_TRAFFIC_INTERVAL = "number",
    BOOT_NOTIFY = "boolean",
    BOOT_NOTIFY_SUFFIX = "string",
    NOTIFY_APPEND_MORE_INFO = "boolean",
    NOTIFY_HEADER = "string",
    NOTIFY_HEADER_TAIL_LEN = "number",
    NOTIFY_HEADER_FALLBACK = "string",
    NOTIFY_RETRY_MAX = "number",
    UPLOAD_URL = "string",
    UPLOAD_SOCKS5_ENABLE = "boolean",
    UPLOAD_SOCKS5_HOST = "string",
    UPLOAD_SOCKS5_PORT = "number",
    UPLOAD_SOCKS5_USERNAME = "string",
    UPLOAD_SOCKS5_PASSWORD = "string",
    UPLOAD_SOCKS5_TIMEOUT = "number",
    SMS_CONTROL_WHITELIST_NUMBERS = "table",
    SMS_TTS = "number",
    TTS_TEXT = "string",
    CALL_IN_ACTION = "number",
    AUDIO_VOLUME = "number",
    CALL_VOLUME = "number",
    MIC_VOLUME = "number",
    RNDIS_ENABLE = "boolean",
    LED_ENABLE = "boolean",
    PIN_CODE = "string",
    NUMBER = "string",
}

local function trim_binary_text(text)
    if type(text) ~= "string" then return nil end

    if text:sub(1, 3) == "\239\187\191" then
        text = text:sub(4)
    end

    text = text:gsub("%z+$", "")
    return text
end

local function get_runtime_config_bin_key()
    if type(config) == "table" and type(config.CONFIG_BIN_KEY) == "string" and config.CONFIG_BIN_KEY ~= "" then
        return config.CONFIG_BIN_KEY
    end

    return DEFAULT_CONFIG_BIN_KEY
end

local function derive_compat_key(config_bin_key)
    local md5_hex = crypto.md5(config_bin_key, #config_bin_key)
    if type(md5_hex) ~= "string" or md5_hex == "" then
        return nil
    end

    return md5_hex:sub(1, 16):lower()
end

local function decode_json_document(plain_content)
    if not json or not json.decode then
        return nil, "json.decode unavailable"
    end

    local ok, result1, result2, result3 = pcall(json.decode, plain_content)
    if not ok then
        return nil, tostring(result1)
    end

    if result2 == false then
        return nil, tostring(result3 or "json decode failed")
    end

    if type(result1) ~= "table" then
        return nil, "json root is not object"
    end

    return result1
end

local function unwrap_json_config(document)
    if type(document) ~= "table" then
        return nil, "json root is not object"
    end

    if document.schema and document.schema ~= JSON_SCHEMA then
        log.warn(LOG_TAG, "unknown json schema", tostring(document.schema))
    end

    if document.config ~= nil then
        if type(document.config) ~= "table" then
            return nil, "json config field is not object"
        end
        return document.config
    end

    return document
end

local function apply_json_config(config_data)
    local applied = 0
    local skipped = 0

    for key, value in pairs(config_data) do
        local expected_type = ALLOWED_CONFIG_TYPES[key]
        if expected_type and type(value) == expected_type then
            config[key] = value
            applied = applied + 1
        else
            skipped = skipped + 1
            log.warn(LOG_TAG, "skip config item", tostring(key), "type", type(value), "expected", tostring(expected_type))
        end
    end

    return applied, skipped
end

local function apply_legacy_lua(plain_content)
    local chunk, err = loadstring(plain_content)
    if not chunk then
        return nil, "loadstring error: " .. tostring(err)
    end

    local ok, run_err = pcall(chunk, "config")
    if not ok then
        return nil, "config apply error: " .. tostring(run_err)
    end

    return true
end

function decrypt_cipher_content(cipher_content, config_bin_key)
    if type(cipher_content) ~= "string" or cipher_content == "" then
        return nil, "empty config.bin"
    end

    cipher_content = cipher_content:gsub("%s+", "")

    local compat_key = derive_compat_key(config_bin_key or "")
    if not compat_key then
        return nil, "derive key failed"
    end

    local decoded_content = crypto.base64_decode(cipher_content, #cipher_content)
    if not decoded_content then
        return nil, "base64 decode failed"
    end

    local plain_content = crypto.aes_decrypt("ECB", "ZERO", decoded_content, compat_key)
    if not plain_content then
        return nil, "aes decrypt failed"
    end

    plain_content = trim_binary_text(plain_content)
    if type(plain_content) ~= "string" or plain_content == "" then
        return nil, "empty plain content"
    end

    return plain_content, compat_key
end

function load_from_plain_content(plain_content)
    plain_content = trim_binary_text(plain_content or "")
    if type(plain_content) ~= "string" or plain_content == "" then
        return false, "empty plain content"
    end

    local document, json_err = decode_json_document(plain_content)
    if document then
        local config_data, unwrap_err = unwrap_json_config(document)
        if not config_data then
            return false, unwrap_err
        end

        local applied, skipped = apply_json_config(config_data)
        log.info(LOG_TAG, "json config applied", applied, "skipped", skipped)
        return true, "json"
    end

    log.warn(LOG_TAG, "json parse failed", tostring(json_err))

    if config.CONFIG_BIN_ALLOW_LEGACY_LUA == false then
        return false, "legacy lua disabled"
    end

    local ok, legacy_err = apply_legacy_lua(plain_content)
    if not ok then
        return false, legacy_err
    end

    log.info(LOG_TAG, "legacy lua config applied")
    return true, "legacy-lua"
end

function load_from_file(path)
    if type(path) ~= "string" or path == "" then
        return false, "empty path"
    end

    local file = io.open(path, "rb")
    if not file then
        return false, "open config file failed"
    end

    local cipher_content = file:read("*a")
    file:close()

    local config_bin_key = get_runtime_config_bin_key()
    local plain_content, compat_key_or_err = decrypt_cipher_content(cipher_content, config_bin_key)
    if not plain_content then
        return false, compat_key_or_err
    end

    log.info(LOG_TAG, "config decrypted success", "compat_key", compat_key_or_err)

    local ok, mode_or_err = load_from_plain_content(plain_content)
    if not ok then
        return false, mode_or_err
    end

    return true, mode_or_err
end
