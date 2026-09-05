"""Run real device Lua 5.1 code with a host TCP adapter; no modem is required.

python -m pip install -r tests/requirements.txt
python -m unittest discover -s tests -v
"""

import collections
import json
from pathlib import Path
import socket
import struct
import tempfile
import threading
import time
import unittest

from lupa.lua51 import LuaRuntime


ROOT = Path(__file__).resolve().parents[1]


def read_exact(conn, size):
    data = b""
    while len(data) < size:
        part = conn.recv(size - len(data))
        if not part:
            raise EOFError("unexpected end of TCP stream")
        data += part
    return data


def read_http(conn):
    data = b""
    while b"\r\n\r\n" not in data:
        data += read_exact(conn, 1)
    header, body = data.split(b"\r\n\r\n", 1)
    lines = header.split(b"\r\n")
    headers = dict(line.split(b": ", 1) for line in lines[1:])
    body += read_exact(conn, int(headers.get(b"Content-Length", b"0")) - len(body))
    return lines[0], headers, body, header + b"\r\n\r\n" + body


class OneShotServer:
    def __init__(self, handler):
        self.listener = socket.socket()
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen()
        self.listener.settimeout(5)
        self.port = self.listener.getsockname()[1]
        self.error = None

        def serve():
            try:
                with self.listener.accept()[0] as conn:
                    conn.settimeout(5)
                    handler(conn)
            except Exception as exc:
                self.error = exc
            finally:
                self.listener.close()

        self.thread = threading.Thread(target=serve, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, exc_type, *_):
        self.thread.join(6)
        if not exc_type:
            if self.thread.is_alive():
                raise AssertionError("test server did not finish")
            if self.error:
                raise self.error


class TCPAdapter:
    def __init__(self):
        self.conn = None
        self.closed = False
        self.sent = []
        self.destination = None

    def connect(self, host, port, timeout):
        self.destination = (host, int(port))
        try:
            self.conn = socket.create_connection((host.decode(), int(port)), timeout)
            return True
        except OSError:
            return False

    def send(self, data, timeout=None, sensitive=None):
        self.sent.append((data, sensitive))
        try:
            self.conn.settimeout(timeout or 5)
            self.conn.sendall(data)
            return True
        except OSError:
            return False

    def recv(self, timeout):
        try:
            self.conn.settimeout(timeout / 1000)
            data = self.conn.recv(65536)
            return (True, data) if data else (False, b"CLOSED")
        except OSError:
            return False, b"timeout"

    def close(self):
        self.closed = True
        if self.conn:
            self.conn.close()


class FakeSocket(TCPAdapter):
    def __init__(self, chunks, connect_ok=True, send_ok=True, on_recv=None):
        super().__init__()
        self.chunks = collections.deque(chunks)
        self.connect_ok, self.send_ok = connect_ok, send_ok
        self.on_recv = on_recv

    def connect(self, host, port, timeout):
        self.destination = (host, port)
        return self.connect_ok

    def send(self, data, timeout=None, sensitive=None):
        self.sent.append((data, sensitive))
        return self.send_ok

    def recv(self, timeout):
        if self.on_recv:
            self.on_recv()
        return (True, self.chunks.popleft()) if self.chunks else (False, b"timeout")


class Harness:
    def __init__(self, factory=TCPAdapter):
        self.lua = LuaRuntime(encoding=None, unpack_returned_tuples=True)
        self.clients = []
        g = self.lua.globals()
        g.package.path = str(ROOT / "script/lib/?.lua").encode() + b";" + str(ROOT / "script/utils/?.lua").encode() + b";" + str(ROOT / "script/?.lua").encode()
        self.lua.execute(b"""
            log = setmetatable({}, {__index = function() return function() end end})
            sys = {taskInit = function(fn, ...) return fn(...) end}
            package.loaded.utils = {}
        """)
        wrap = self.lua.eval(b"""function(conn, send, recv, close)
            return {
                connect = function(_, ...) return conn(...) end,
                send = function(_, ...) return send(...) end,
                recv = function(_, ...) return recv(...) end,
                close = function(_) return close() end
            }
        end""")

        def tcp(ssl=False, *_):
            if ssl:
                raise AssertionError("unexpected TLS socket in HTTP test")
            client = factory()
            self.clients.append(client)
            return wrap(client.connect, client.send, client.recv, client.close)

        g.socket = self.lua.table_from({b"tcp": tcp, b"isReady": lambda: True})
        g.package.loaded.socket = g.socket
        g.rtos = self.lua.table_from({b"tick": lambda: int(time.monotonic() * 200)})
        g.io.fileSize = lambda path: Path(path.decode()).stat().st_size
        self.lua.execute(b'require "http"')

    def table(self, value):
        if isinstance(value, dict):
            return self.lua.table_from({k.encode() if isinstance(k, str) else k: self.table(v) for k, v in value.items()})
        if isinstance(value, list):
            return self.lua.table_from([self.table(v) for v in value])
        return value.encode() if isinstance(value, str) else value

    def tunnel(self, proxy=None, host=b"uploads.invalid", port=80, timeout=15000):
        proxy = proxy if proxy is not None else {"host": "proxy.invalid", "port": 1080}
        return self.lua.globals().socks5.connect(self.table(proxy), host, port, timeout)

    def upload(self, path, url, proxy=None):
        result = []
        self.lua.globals().http.request(
            b"PUT", url, None, self.table({"Content-Type": "audio/wav"}),
            self.table([{ "file": str(path)}]), 2000,
            lambda *args: result.append(args), None, None, self.table(proxy),
        )
        return result


class Socks5HandshakeTests(unittest.TestCase):
    def test_fragmented_replies_and_preserved_tunnel_data(self):
        replies = [
            b"\x05\x00\x00\x01" + b"\x00" * 6,
            b"\x05\x00\x00\x03\x03abc" + b"\x00" * 2,
            b"\x05\x00\x00\x04" + b"\x00" * 18,
        ]
        for reply in replies:
            with self.subTest(address_type=reply[3]):
                chunks = [bytes([byte]) for byte in b"\x05\x00" + reply[:-1]] + [reply[-1:] + b"payload"]
                client = FakeSocket(chunks)
                h = Harness(lambda: client)
                tunnel = h.tunnel()
                self.assertEqual(tunnel.recv(tunnel, 100), (True, b"payload"))
                self.assertEqual(client.sent[0][0], b"\x05\x01\x00")
                self.assertEqual(client.sent[1][0], b"\x05\x01\x00\x03\x0fuploads.invalid\x00\x50")
                tunnel.close(tunnel)
                self.assertTrue(client.closed)

    def test_username_password_and_ipv4(self):
        client = FakeSocket([b"\x05\x02", b"\x01\x00", b"\x05\x00\x00\x01" + b"\x00" * 6])
        h = Harness(lambda: client)
        tunnel = h.tunnel({"host": "proxy.invalid", "port": 1080, "username": "user", "password": "pass"}, b"192.0.2.1", 8080)
        self.assertEqual(client.sent[0], (b"\x05\x01\x02", True))
        self.assertEqual(client.sent[1], (b"\x01\x04user\x04pass", True))
        self.assertEqual(client.sent[2][0], b"\x05\x01\x00\x01\xc0\x00\x02\x01\x1f\x90")
        tunnel.close(tunnel)

    def test_rejections_close_connection_and_do_not_send_http(self):
        cases = [
            ([b"\x05\xff"], False),
            ([b"\x04\x00"], False),
            ([b"\x05\x00"], True),  # no silent authentication downgrade
            ([b"\x05\x02", b"\x01\x01"], True),
            ([b"\x05\x00", b"\x05\x05\x00\x01"], False),
            ([b"\x05\x00", b"\x04\x00\x00\x01"], False),
            ([b"\x05\x00", b"\x05\x00\x01\x01"], False),
            ([b"\x05\x00", b"\x05\x00\x00\x09"], False),
            ([b"\x05\x00", b"\x05\x00\x00\x03\x00"], False),
            ([b"\x05\x00", b"\x05\x00\x00\x01\x00"], False),
            ([], False),
        ]
        for chunks, auth in cases:
            with self.subTest(chunks=chunks, auth=auth):
                client = FakeSocket(chunks)
                h = Harness(lambda: client)
                proxy = {"host": "proxy.invalid", "port": 1080}
                if auth:
                    proxy.update(username="user", password="pass")
                result = h.upload(Path(__file__), b"http://uploads.invalid/file.wav", proxy)
                self.assertEqual(len(result), 1)
                self.assertFalse(result[0][0])
                self.assertIn(b"SOCKS5", result[0][1])
                self.assertTrue(client.closed)
                self.assertEqual(len(h.clients), 1)
                self.assertFalse(any(b"PUT " in data for data, _ in client.sent))

    def test_connect_and_send_errors(self):
        for options in ({"connect_ok": False}, {"send_ok": False}):
            client = FakeSocket([], **options)
            h = Harness(lambda: client)
            result, error = h.tunnel()
            self.assertIsNone(result)
            self.assertIn(b"SOCKS5", error)
            self.assertTrue(client.closed)

    def test_handshake_uses_one_deadline(self):
        tick = [0]
        client = FakeSocket([b"\x05", b"\x00"], on_recv=lambda: tick.__setitem__(0, tick[0] + 3))
        h = Harness(lambda: client)
        h.lua.globals().rtos.tick = lambda: tick[0]
        result, error = h.tunnel(timeout=10)
        self.assertIsNone(result)
        self.assertIn(b"timeout", error)
        self.assertTrue(client.closed)

    def test_invalid_configuration_and_https_never_connect(self):
        h = Harness()
        base = {"host": "proxy.invalid", "port": 1080}
        for patch in ({"host": ""}, {"host": "socks5://host"}, {"port": 0}, {"port": 65536}, {"port": 1.5}, {"username": "user"}, {"password": "pass"}, {"username": "u" * 256, "password": "p"}, {"timeout": 0}):
            with self.subTest(patch=patch):
                result, _ = h.tunnel(base | patch)
                self.assertIsNone(result)
        result = h.upload(Path(__file__), b"https://uploads.invalid/file.wav", base)
        self.assertFalse(result[0][0])
        self.assertIn(b"HTTP only", result[0][1])
        self.assertEqual(h.clients, [])


class UploadIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "record.wav"
        # A valid PCM WAV larger than several of the firmware's 11,200-byte chunks.
        samples = bytes(range(256)) * 400
        self.wav = b"RIFF" + struct.pack("<I", 36 + len(samples)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, 8000, 16000, 2, 16) + b"data" + struct.pack("<I", len(samples)) + samples
        self.path.write_bytes(self.wav)

    def make_target(self, captured, code):
        def target(conn):
            captured.append(read_http(conn))
            # 204 intentionally has no Content-Length and leaves connection open
            # until the client closes: it must not wait for an HTTP response body.
            header = b"" if code == 204 else b"Content-Length: 0\r\n"
            conn.sendall(b"HTTP/1.1 " + str(code).encode() + b" OK\r\n" + header + b"\r\n")
            if code == 204:
                self.assertEqual(conn.recv(1), b"")
        return target

    def make_proxy(self, captured, auth):
        def proxy(conn):
            self.assertEqual(read_exact(conn, 3), b"\x05\x01" + (b"\x02" if auth else b"\x00"))
            conn.sendall(b"\x05")
            time.sleep(0.005)
            conn.sendall(b"\x02" if auth else b"\x00")
            if auth:
                self.assertEqual(read_exact(conn, 1), b"\x01")
                username = read_exact(conn, read_exact(conn, 1)[0])
                password = read_exact(conn, read_exact(conn, 1)[0])
                self.assertEqual((username, password), (b"test-user", b"test-pass"))
                conn.sendall(b"\x01\x00")
            self.assertEqual(read_exact(conn, 4), b"\x05\x01\x00\x03")
            host = read_exact(conn, read_exact(conn, 1)[0])
            port = struct.unpack("!H", read_exact(conn, 2))[0]
            captured.append((host, port))
            self.assertEqual(host, b"uploads.invalid")
            with socket.create_connection(("127.0.0.1", port), 5) as target:
                reply = b"\x05\x00\x00\x04" + b"\x00" * 18
                for byte in reply:
                    conn.sendall(bytes([byte]))
                _, _, _, request = read_http(conn)
                target.sendall(request)
                response = b""
                while b"\r\n\r\n" not in response:
                    response += read_exact(target, 1)
                conn.sendall(response)
                self.assertEqual(conn.recv(1), b"")
        return proxy

    def test_file_put_through_real_socks5_with_and_without_authentication(self):
        for auth, code in ((False, 200), (True, 201), (False, 204)):
            with self.subTest(auth=auth, code=code):
                target_requests, proxy_requests = [], []
                with OneShotServer(self.make_target(target_requests, code)) as target:
                    with OneShotServer(self.make_proxy(proxy_requests, auth)) as proxy:
                        h = Harness()
                        config = {"host": "127.0.0.1", "port": proxy.port, "timeout": 2000}
                        if auth:
                            config.update(username="test-user", password="test-pass")
                        result = h.upload(self.path, f"http://uploads.invalid:{target.port}/record/test.wav".encode(), config)
                        self.assertEqual(result[0][0:2], (True, str(code).encode()))
                self.assertEqual(proxy_requests, [(b"uploads.invalid", target.port)])
                request_line, headers, body, _ = target_requests[0]
                self.assertEqual(request_line, b"PUT /record/test.wav HTTP/1.1")
                self.assertEqual(headers[b"Host"], f"uploads.invalid:{target.port}".encode())
                self.assertEqual(headers[b"Content-Type"], b"audio/wav")
                self.assertEqual(body, self.wav)
                self.assertNotIn(b"test-pass", target_requests[0][3])
                self.assertEqual(h.clients[0].destination, (b"127.0.0.1", proxy.port))
                self.assertTrue(h.clients[0].closed)

    def test_direct_upload_still_works_when_proxy_is_disabled(self):
        captured = []
        with OneShotServer(self.make_target(captured, 200)) as target:
            h = Harness()
            result = h.upload(self.path, f"http://127.0.0.1:{target.port}/direct.wav".encode())
            self.assertTrue(result[0][0])
        self.assertEqual(captured[0][2], self.wav)

    def prepare_call_handler(self, h):
        g = h.lua.globals()
        g.test_record_path = str(self.path).encode()
        h.lua.execute(b"""
            require 'config'
            callbacks, timers, notices = {}, {}, {}
            sys.subscribe = function(event, fn) callbacks[event] = fn end
            sys.timerStart = function(fn, delay, ...) table.insert(timers, {fn=fn, delay=delay, args={...}}) end
            sys.timerStopAll = function() end
            runTimer = function(delay)
                for i, timer in ipairs(timers) do
                    if timer.delay == delay then
                        table.remove(timers, i)
                        return timer.fn(unpack(timer.args))
                    end
                end
                error('timer not found')
            end
            cc = {anyCallExist=function() return true end, accept=function() end, hangUp=function() end}
            ril = {regUrc=function() end}
            record = {getFilePath=function() return test_record_path end,
                start=function(seconds, cb) record.seconds=seconds; record.complete=cb end}
            audio = setmetatable({play=function(_, _, _, _, cb) cb(true) end},
                {__index=function() return function() return 1 end end})
            util_notify = {add=function(msg) table.insert(notices, msg) end}
            sim = {getNumber=function() return '13800138000' end}
            AUDIO_OUTPUT_CHANNEL_NORMAL, AUDIO_INPUT_CHANNEL_NORMAL = 2, 0
            AUDIO_OUTPUT_CHANNEL_MUTE, AUDIO_INPUT_CHANNEL_MUTE = 0, 1
            local taskInit = sys.taskInit
            sys.taskInit = function() end -- don't run the modem LED loop
            dofile(TEST_HANDLER_PATH)
            sys.taskInit = taskInit
        """.replace(b"TEST_HANDLER_PATH", json.dumps(str(ROOT / "script/handler/handler_call.lua")).encode()))
        return g

    def test_call_recording_uses_config_loaded_after_handler_initialization(self):
        captured, routed = [], []
        with OneShotServer(self.make_target(captured, 201)) as target:
            with OneShotServer(self.make_proxy(routed, True)) as proxy:
                h = Harness()
                g = self.prepare_call_handler(h)
                self.assertIsNone(g.config.UPLOAD_URL)
                config = {
                    "UPLOAD_URL": f"http://uploads.invalid:{target.port}/base",
                    "UPLOAD_SOCKS5_ENABLE": True, "UPLOAD_SOCKS5_HOST": "127.0.0.1",
                    "UPLOAD_SOCKS5_PORT": proxy.port, "UPLOAD_SOCKS5_USERNAME": "test-user",
                    "UPLOAD_SOCKS5_PASSWORD": "test-pass", "UPLOAD_SOCKS5_TIMEOUT": 2000,
                    "CALL_IN_ACTION": 1, "TTS_TEXT": "Please leave a message",
                }
                g.json = h.table({"decode": lambda raw: h.table(json.loads(raw))})
                h.lua.execute(b"require 'util_config_loader'")
                self.assertEqual(g.util_config_loader.load_from_plain_content(json.dumps({"config": config}).encode()), (True, b"json"))
                for key, value in config.items():
                    self.assertEqual(g.config[key.encode()], h.table(value))
                g.callbacks[b"CALL_INCOMING"](b"10086")
                self.assertEqual(g.notices[1][2].decode(), "来电动作: 自动接听")
                g.callbacks[b"CALL_CONNECTED"](b"10086")
                g.runTimer(1000)
                g.runTimer(300)
                self.assertEqual(g.record.seconds, 50)
                g.record.complete(True, len(self.wav))
                notice = [value.decode() for _, value in g.notices[len(g.notices)].items()]
                self.assertTrue(any("录音结果: 成功" in line for line in notice))
                self.assertTrue(any(f"http://uploads.invalid:{target.port}/base/record/13800138000/" in line for line in notice))
        self.assertEqual(captured[0][2], self.wav)
        self.assertIn(b"/base/record/13800138000/", captured[0][0])

    def test_recording_upload_rejects_console_and_storage_error_responses(self):
        cases = [
            # Actual failure mode: the Console serves its HTML app with HTTP 200.
            (200, {"Server": "MinIO Console", "Content-Type": "text/html"},
             b"<!doctype html><html><title>MinIO Console</title></html>", "MinIO 控制台"),
            # A proxy can remove/change Server or the Content-Type header casing.
            (200, {"content-type": "Text/HTML; charset=utf-8"}, b"Login page", "HTML 网页"),
            (200, {}, b"\xef\xbb\xbf \n<!DOCTYPE html><html>Login</html>", "HTML 网页"),
            (200, {"Content-Type": "application/xhtml+xml"}, b"<html/>", "HTML 网页"),
            # Preserve the real S3 error instead of reporting HTTP 200 as success.
            (200, {"Content-Type": "application/xml"},
             b'<?xml version="1.0"?><Error><Code>AccessDenied</Code></Error>', "AccessDenied"),
            (403, {"x-minio-error-code": "AccessDenied"}, b"", "AccessDenied"),
            (403, {"Content-Type": "application/xml"},
             b"<Error><Code>NoSuchBucket</Code></Error>", "NoSuchBucket"),
            (500, {}, b"", "500"),
            # Retain normal S3 and generic HTTP upload success behavior.
            (200, {"Server": "MinIO", "ETag": '"test-object-etag"'}, b"", None),
            (201, {"Content-Type": "application/json"}, b'{"created":true}', None),
            (204, {}, b"", None),
        ]
        for status, headers, body, error in cases:
            with self.subTest(status=status, headers=headers, error=error):
                response = f"HTTP/1.1 {status} Response\r\nContent-Length: {len(body)}\r\n".encode()
                response += b"".join(f"{key}: {value}\r\n".encode() for key, value in headers.items())
                response += b"\r\n" + body
                client = FakeSocket([b"\x05\x00", b"\x05\x00\x00\x01" + b"\x00" * 6, response])
                h = Harness(lambda: client)
                g = self.prepare_call_handler(h)
                g.config.UPLOAD_URL = b"http://uploads.invalid:9001/voice"
                g.config.UPLOAD_SOCKS5_ENABLE = True
                g.config.UPLOAD_SOCKS5_HOST = b"proxy.invalid"
                g.config.CALL_IN_ACTION = 1
                g.config.TTS_TEXT = b"Please leave a message"
                g.callbacks[b"CALL_INCOMING"](b"10086")
                g.callbacks[b"CALL_CONNECTED"](b"10086")
                g.runTimer(1000)
                g.runTimer(300)
                g.record.complete(True, len(self.wav))
                notice = "\n".join(value.decode() for _, value in g.notices[len(g.notices)].items())
                if error:
                    self.assertIn("录音结果: 失败", notice)
                    self.assertIn(error, notice)
                    self.assertNotIn("录音文件:", notice)
                else:
                    self.assertIn("录音结果: 成功", notice)
                    self.assertIn("录音文件:", notice)
                self.assertTrue(client.closed)


if __name__ == "__main__":
    unittest.main()
