-- SOCKS5 TCP CONNECT: 无认证 / RFC 1929 用户名密码认证。
-- 不提供 TLS；调用者必须在 HTTP 等明文 TCP 协议下使用。
require "socket"
module(..., package.seeall)

local function validPort(value)
    return type(value) == "number" and value >= 1 and value <= 65535 and value == math.floor(value)
end

local function validHost(value)
    return type(value) == "string" and #value > 0 and #value <= 255 and not value:find("[%z%s/:@]")
end

local function encodeAddress(host)
    local a, b, c, d = host:match("^(%d+)%.(%d+)%.(%d+)%.(%d+)$")
    if a then
        a, b, c, d = tonumber(a), tonumber(b), tonumber(c), tonumber(d)
        if a <= 255 and b <= 255 and c <= 255 and d <= 255 then
            return string.char(1, a, b, c, d)
        end
    end
    -- 域名交给代理解析，不在设备端解析目标域名。
    return string.char(3, #host) .. host
end

-- 返回具有 send / recv / close 接口的 TCP 隧道，失败返回 nil, error。
function connect(proxy, host, port, timeout, coreOptions)
    if type(proxy) ~= "table" or not validHost(proxy.host) or not validPort(proxy.port) then
        return nil, "SOCKS5 invalid proxy host or port"
    end
    port = tonumber(port)
    if not validHost(host) or not validPort(port) then
        return nil, "SOCKS5 invalid target host or port"
    end
    local username, password = proxy.username or "", proxy.password or ""
    if type(username) ~= "string" or type(password) ~= "string" then
        return nil, "SOCKS5 invalid credentials"
    end
    local authenticated = username ~= "" or password ~= ""
    if authenticated and (#username < 1 or #username > 255 or #password < 1 or #password > 255) then
        return nil, "SOCKS5 username and password must both be 1-255 bytes"
    end
    timeout = proxy.timeout or timeout or 15000
    if type(timeout) ~= "number" or timeout < 1 or timeout > 300000 or timeout ~= math.floor(timeout) then
        return nil, "SOCKS5 invalid handshake timeout"
    end

    local client = socket.tcp(false, nil, coreOptions)
    if not client then return nil, "SOCKS5 create socket failed" end
    local deadline = rtos.tick() * 5 + timeout
    local buffer = ""
    local function remaining()
        return deadline - rtos.tick() * 5
    end
    local function fail(reason)
        client:close()
        return nil, reason
    end
    local function send(data)
        local ms = remaining()
        if ms <= 0 then return nil, "SOCKS5 handshake timeout" end
        -- 第三个参数禁止底层调试日志打印认证数据。
        if not client:send(data, ms / 1000, true) then
            return nil, "SOCKS5 handshake send failed"
        end
        return true
    end
    local function readExact(size)
        while #buffer < size do
            local ms = remaining()
            if ms <= 0 then return nil, "SOCKS5 handshake timeout" end
            local ok, data = client:recv(ms)
            if not ok or type(data) ~= "string" or #data == 0 then
                return nil, "SOCKS5 handshake receive failed or timed out"
            end
            buffer = buffer .. data
        end
        local data = buffer:sub(1, size)
        buffer = buffer:sub(size + 1)
        return data
    end

    if not client:connect(proxy.host, proxy.port, remaining() / 1000) then
        return fail("SOCKS5 proxy connection failed")
    end
    -- 配置了凭据时仅允许用户名密码认证，不降级到无认证。
    local method = authenticated and 2 or 0
    local ok, err = send(string.char(5, 1, method))
    if not ok then return fail(err) end
    local reply
    reply, err = readExact(2)
    if not reply then return fail(err) end
    if reply:byte(1) ~= 5 or reply:byte(2) ~= method then
        return fail("SOCKS5 unsupported authentication method")
    end

    if authenticated then
        ok, err = send(string.char(1, #username) .. username .. string.char(#password) .. password)
        if not ok then return fail(err) end
        reply, err = readExact(2)
        if not reply then return fail(err) end
        if reply:byte(1) ~= 1 or reply:byte(2) ~= 0 then
            return fail("SOCKS5 authentication failed")
        end
    end

    ok, err = send(string.char(5, 1, 0) .. encodeAddress(host) .. string.char(math.floor(port / 256), port % 256))
    if not ok then return fail(err) end
    reply, err = readExact(4)
    if not reply then return fail(err) end
    if reply:byte(1) ~= 5 or reply:byte(3) ~= 0 then
        return fail("SOCKS5 invalid CONNECT reply")
    end
    if reply:byte(2) ~= 0 then
        return fail("SOCKS5 CONNECT rejected, code " .. reply:byte(2))
    end
    local addressType = reply:byte(4)
    local addressLength
    if addressType == 1 then
        addressLength = 4
    elseif addressType == 4 then
        addressLength = 16
    elseif addressType == 3 then
        reply, err = readExact(1)
        if not reply then return fail(err) end
        addressLength = reply:byte(1)
        if addressLength == 0 then return fail("SOCKS5 empty bound address") end
    else
        return fail("SOCKS5 invalid bound address type")
    end
    reply, err = readExact(addressLength + 2)
    if not reply then return fail(err) end

    -- 保留与 CONNECT 响应一起收到的业务数据。
    return {
        send = function(_, data, sendTimeout) return client:send(data, sendTimeout) end,
        recv = function(_, recvTimeout)
            if #buffer > 0 then
                local data = buffer
                buffer = ""
                return true, data
            end
            return client:recv(recvTimeout)
        end,
        close = function() return client:close() end,
    }
end
