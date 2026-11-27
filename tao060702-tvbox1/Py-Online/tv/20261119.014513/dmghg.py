# coding=utf-8
# TVBox / NewBox Python 爬虫：共和动漫（4K 线路稳定版）
#
# v4 说明（解决 4K 线路问题）：
#   1) 4K 线路只在真实探测到 4K 时出现，不虚构：详情页对首/中/末三集并发探测，
#      取并集判断这部片有没有 4K（4K 可能只在部分集，如 181867 只有第 82 集）。
#      没有 4K 的片子只显示语言线路，不会再出现"4K线路点开是 1080P"。
#   2) 4K 线路点击后严格按 rank>=4000 选源（优先 H264 4K），实测 181631 为
#      3840x2160 HEVC、180194 第 1 集为 3840x2160 H264。
#   3) 播放时才解析 new-<md5>，带 3 次重试 + HTTP/HTTPS 双解析站 + 空结果立即重试。
#   4) addr / m3u8FileDomain 解密失败时回退原值，不再返回空字符串丢源。
#   5) 域名改写保留"原始 URL + 所有可用改写 + HTTPS 升级"多候选，逐个轻量探测，
#      全部失败也返回原始候选，宁可不改也不丢 4K。
#   6) 返回单 URL + header + contentType，兼容不支持多 URL 列表的 TVBox。
#   7) 线路名/集名净化并去重，vod_play_from / vod_play_url 严格 1:1。
#   8) 不解析、不执行上游 play 响应里的 parse 字段（该字段可能是脚本/提示注入）。
#
# 说明：本脚本按你提供的原脚本协议重写，仅用于你已获授权的客户端/自用调试；
#       请自行确认目标站点服务条款与内容版权。
import base64
import hashlib
import json
import random
import re
import threading
import time
import urllib.parse

try:
    from concurrent.futures import ThreadPoolExecutor
except Exception:
    ThreadPoolExecutor = None

import requests

try:
    requests.packages.urllib3.disable_warnings()
except Exception:
    pass

try:
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except Exception:
    HTTPAdapter = None
    Retry = None

try:
    from base.spider import Spider as BaseSpider
except Exception:
    class BaseSpider(object):
        pass

# ---------------------------------------------------------------- 常量
HOST = "https://bkbfdm.cenmo.fun"
PLAY_HOSTS = ("http://jxbfdm.cenmo.fun", "https://jxbfdm.cenmo.fun")

APP_ID = "4150439554430627"
X_VERSION = "2024-09-24"
AUTH_AES_KEY = "ziISjqkXPsGUMRNGyWigxDGtJbfTdcGv"   # 32 -> AES-256
AUTH_AES_IV = "WonrnVkxeIxDcFbv"                   # 16

MD5_AES_KEY = "UY9kxQEtk8Dn08Kr"                   # 播放参数 AES-128
MD5_AES_IV = "J5jQnzGVRfCe4CUk"

PLAY_AUTH_KEY = "EV330AVbUcpZz5csLp6k8g4XYAqlbWG"
PLAY_HEADER_KEY = "T8qW2mN6rY4pLc9V"
PLAY_EXTRA_KEY = "C6rX9mQ2tV7pLs4N"
PLAY_CHECK_KEY = "522828731F1A016B"
PLAY_PROBE_KEY = "522828731F1A016B"
PLAY_EXPIRE = 600

PAGE_SIZE = 24

UA = "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"

# RSA-2048 私钥（服务端把 AES 会话密钥用这把私钥的对应公钥包起来）
RSA_N = 23946753643437448996239823079969962944683996343309754151031598024028071884582070922167274523288816507155697876106753330517537469299247060316572098110251505230839642583608034451723983404983162880997911062605335008489522843673495320704289842688269691872439630786262021283379251467376680768247147703137642211573867021069692010451930701239927939984808713325181463940245689161876022507371372197144447121461614205340636499035121331005293806122747516682822560479551102413146820511650377066453956547641984506110102230164302842790073142505167663391732514810976183581811882575525160960155069812595619444819771013889788854040861
RSA_D = 2234012111875376705723641276087345368933548280253838852547525677386936104831389621406697231112010377721744004371831024654534447522706204537521122539116494544781628313108313206857812144865756105015811346823458782701450213867277269188184202789204279965639194693489265577102716686322856191419550193890222995888745534830517935243287912812370674752317461908971028126474909813456167912880515956561543352309076004090053778499458243490091574892210160321852468705333829388604736979368363080648275356771074225774747675890997773882200127065838815470362846759978034199728427869061185087691563416409829670545155074647865527681657
RSA_E = 65537
RSA_BYTES = 256

# 网络参数
API_TIMEOUT = (6, 18)
PLAY_TIMEOUT = (5, 15)
FAST_TIMEOUT = (2.2, 6)
PROBE_TIMEOUT = (3, 5)
MAX_RETRY = 3
MAX_CANDIDATES = 12

# 缓存（秒）
CHANNEL_TTL = 1800
PLAY_API_TTL = 120
ADDR_TTL = 240
RESOLVE_TTL = 180

# 清晰度探测：只在详情页做，用来判断该片到底有没有 4K。
# 4K 只在少数片源存在，而且可能只出现在部分集（例如 181867 只有第 82 集是 4K），
# 因此取首/中/末三集并发探测取并集；探测不到就不显示 4K 线路，绝不虚构。
DISCOVER_QUALITIES = True
QUALITY_TTL = 600
DISCOVER_WAIT = 3.5


# ---------------------------------------------------------------- AES
try:
    from Crypto.Cipher import AES as _FAST_AES
except Exception:
    _FAST_AES = None

_SBOX = (
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
)
_INV_SBOX = [0] * 256
for _i, _v in enumerate(_SBOX):
    _INV_SBOX[_v] = _i
_RCON = (0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d)


def _xtime(a):
    a <<= 1
    if a & 0x100:
        a ^= 0x11b
    return a & 0xff


class _AES(object):
    """AES-128/192/256 单分组实现 + CBC 模式（PKCS7 填充）"""

    def __init__(self, key):
        nk = len(key) // 4
        self.nr = nk + 6
        w = [list(key[4 * i:4 * i + 4]) for i in range(nk)]
        for i in range(nk, 4 * (self.nr + 1)):
            t = list(w[i - 1])
            if i % nk == 0:
                t = t[1:] + t[:1]
                t = [_SBOX[b] for b in t]
                t[0] ^= _RCON[i // nk - 1]
            elif nk > 6 and i % nk == 4:
                t = [_SBOX[b] for b in t]
            w.append([w[i - nk][j] ^ t[j] for j in range(4)])
        self.rk = [sum(w[4 * r:4 * r + 4], []) for r in range(self.nr + 1)]

    def _add_rk(self, s, r):
        rk = self.rk[r]
        return [s[i] ^ rk[i] for i in range(16)]

    def encrypt_block(self, block):
        s = self._add_rk(list(block), 0)
        for rnd in range(1, self.nr + 1):
            s = [_SBOX[b] for b in s]
            s = [s[0], s[5], s[10], s[15],
                 s[4], s[9], s[14], s[3],
                 s[8], s[13], s[2], s[7],
                 s[12], s[1], s[6], s[11]]
            if rnd != self.nr:
                t = []
                for c in range(4):
                    a0, a1, a2, a3 = s[4 * c:4 * c + 4]
                    t += [
                        _xtime(a0) ^ _xtime(a1) ^ a1 ^ a2 ^ a3,
                        a0 ^ _xtime(a1) ^ _xtime(a2) ^ a2 ^ a3,
                        a0 ^ a1 ^ _xtime(a2) ^ _xtime(a3) ^ a3,
                        _xtime(a0) ^ a0 ^ a1 ^ a2 ^ _xtime(a3),
                    ]
                s = t
            s = self._add_rk(s, rnd)
        return bytes(s)

    def decrypt_block(self, block):
        s = self._add_rk(list(block), self.nr)
        for rnd in range(self.nr - 1, -1, -1):
            s = [s[0], s[13], s[10], s[7],
                 s[4], s[1], s[14], s[11],
                 s[8], s[5], s[2], s[15],
                 s[12], s[9], s[6], s[3]]
            s = [_INV_SBOX[b] for b in s]
            s = self._add_rk(s, rnd)
            if rnd != 0:
                t = []
                for c in range(4):
                    a0, a1, a2, a3 = s[4 * c:4 * c + 4]
                    t += [
                        _gmul(a0, 14) ^ _gmul(a1, 11) ^ _gmul(a2, 13) ^ _gmul(a3, 9),
                        _gmul(a0, 9) ^ _gmul(a1, 14) ^ _gmul(a2, 11) ^ _gmul(a3, 13),
                        _gmul(a0, 13) ^ _gmul(a1, 9) ^ _gmul(a2, 14) ^ _gmul(a3, 11),
                        _gmul(a0, 11) ^ _gmul(a1, 13) ^ _gmul(a2, 9) ^ _gmul(a3, 14),
                    ]
                s = t
        return bytes(s)

    def cbc_encrypt(self, data, iv):
        out = []
        prev = list(iv)
        for i in range(0, len(data), 16):
            blk = [(data[i + j] ^ prev[j]) for j in range(16)]
            ct = self.encrypt_block(blk)
            out.append(ct)
            prev = list(ct)
        return b"".join(out)

    def cbc_decrypt(self, data, iv):
        out = []
        prev = list(iv)
        for i in range(0, len(data), 16):
            blk = data[i:i + 16]
            if len(blk) < 16:
                break
            pt = self.decrypt_block(blk)
            out.append(bytes(pt[j] ^ prev[j] for j in range(16)))
            prev = list(blk)
        return b"".join(out)


def _gmul(a, b):
    p = 0
    for _ in range(8):
        if b & 1:
            p ^= a
        hi = a & 0x80
        a = (a << 1) & 0xff
        if hi:
            a ^= 0x1b
        b >>= 1
    return p


def _pkcs7_pad(data):
    n = 16 - len(data) % 16
    return data + bytes([n]) * n


def _pkcs7_unpad(data):
    if not data:
        return data
    n = data[-1]
    if 1 <= n <= 16 and data[-n:] == bytes([n]) * n:
        return data[:-n]
    return data


def aes_cbc_encrypt(raw, key, iv):
    padded = _pkcs7_pad(raw)
    if _FAST_AES is not None:
        return _FAST_AES.new(key, _FAST_AES.MODE_CBC, iv).encrypt(padded)
    return _AES(key).cbc_encrypt(padded, iv)


def aes_cbc_decrypt(raw, key, iv):
    if not raw:
        return b""
    if len(raw) % 16:
        raw = raw[:len(raw) - (len(raw) % 16)]
    if not raw:
        return b""
    if _FAST_AES is not None:
        plain = _FAST_AES.new(key, _FAST_AES.MODE_CBC, iv).decrypt(raw)
    else:
        plain = _AES(key).cbc_decrypt(raw, iv)
    return _pkcs7_unpad(plain)


# ---------------------------------------------------------------- RSA
def rsa_decrypt(cipher_bytes):
    """RSA/ECB/PKCS1Padding 解密，返回 16 字节 AES 会话密钥。"""
    c = int.from_bytes(cipher_bytes, "big")
    m = pow(c, RSA_D, RSA_N)
    raw = m.to_bytes(RSA_BYTES, "big")
    if raw[:2] in (b"\x00\x02", b"\x00\x01"):
        idx = raw.find(b"\x00", 2)
        if idx > 0:
            key = raw[idx + 1:]
            if len(key) in (16, 24, 32):
                return key
            if len(key) > 16:
                return key[:16]
    # 容错：PKCS1 头解析异常时，会话密钥通常是最后 16 字节
    return raw[-16:]


# ---------------------------------------------------------------- 工具
def md5_hex(s):
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def rand_str(n):
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(random.choice(chars) for _ in range(n))


def b64url_encode(s):
    return base64.urlsafe_b64encode(s.encode("utf-8")).decode().rstrip("=")


def b64url_decode(s):
    s = s.replace("-", "+").replace("_", "/")
    s += "=" * (-len(s) % 4)
    return base64.b64decode(s).decode("utf-8", "ignore")


def clean_text(s):
    """净化线路名/集名，去掉 TVBox 的 $$$ / # / $ 分隔符。"""
    if s is None:
        return ""
    s = str(s)
    s = re.sub(r"[\x00-\x1f\x7f]+", " ", s)
    s = s.replace("$", "＄").replace("#", "＃")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _safe_int(v, default=0):
    try:
        return int(v)
    except Exception:
        return default


def quality_rank(desc, height=0):
    t = str(desc or "").upper()
    h = _safe_int(height, 0)
    if "4K" in t or "2160" in t or "UHD" in t or h >= 2000:
        return 4000
    if "1080" in t or "FHD" in t or h >= 1000:
        return 1080
    if "720" in t or h >= 700:
        return 720
    if "480" in t or h >= 400:
        return 480
    if "蓝光" in t or "超清" in t:
        return 1080
    if "高清" in t:
        return 720
    if "标清" in t:
        return 480
    return 0


def quality_label(desc, rank):
    if rank >= 4000:
        return "4K"
    if rank >= 1080:
        return "1080P"
    if rank >= 720:
        return "720P"
    if rank >= 480:
        return "480P"
    return "默认"


def guess_content_type(url):
    low = (url or "").lower()
    if ".m3u8" in low or "mpegurl" in low:
        return "application/vnd.apple.mpegurl"
    if ".mp4" in low or ".m4v" in low:
        return "video/mp4"
    if ".flv" in low:
        return "video/x-flv"
    if ".mkv" in low:
        return "video/x-matroska"
    return ""


# ---------------------------------------------------------------- 站点接口
class Spider(BaseSpider):

    def __init__(self, *args, **kwargs):
        try:
            super(Spider, self).__init__(*args, **kwargs)
        except Exception:
            pass
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({"User-Agent": UA})
        if HTTPAdapter is not None and Retry is not None:
            try:
                retry = Retry(
                    total=1, connect=1, read=1, backoff_factor=0.25,
                    status_forcelist=(500, 502, 503, 504),
                    allowed_methods=frozenset(["GET"]),
                    raise_on_status=False,
                )
            except TypeError:
                retry = Retry(total=1, connect=1, read=1, backoff_factor=0.25,
                              status_forcelist=(500, 502, 503, 504))
            adapter = HTTPAdapter(max_retries=retry, pool_connections=8, pool_maxsize=8)
            self.session.mount("http://", adapter)
            self.session.mount("https://", adapter)
        self._lock = threading.RLock()
        self._cache_lock = threading.RLock()
        self.host = HOST
        self._channels = None
        self._channels_ts = 0.0
        self._quality_cache = {}
        self._play_api_cache = {}
        self._addr_cache = {}
        self._resolve_cache = {}

    # ---------------- 生命周期
    def getName(self):
        return "共和动漫"

    def getDependence(self):
        return []

    def init(self, extend=""):
        if isinstance(extend, dict):
            h = extend.get("host") or extend.get("api")
            if h:
                self.host = str(h).strip().rstrip("/")
        elif isinstance(extend, str) and extend.strip().startswith("http"):
            self.host = extend.strip().rstrip("/")

    def destroy(self):
        try:
            self.session.close()
        except Exception:
            pass

    def isVideoFormat(self, url):
        return bool(re.search(r"\.(m3u8|mp4|flv|mkv)", url or "", re.I))

    def manualVideoCheck(self):
        return False

    # ---------------- 缓存
    def _cache_get(self, store, key):
        now = time.time()
        with self._cache_lock:
            item = store.get(key)
            if not item:
                return None
            ts, value = item
            if now - ts > (value[0] if isinstance(value, tuple) else 0):
                store.pop(key, None)
                return None
        return value[1] if isinstance(value, tuple) and len(value) == 2 else value

    def _cache_put(self, store, key, value, ttl):
        with self._cache_lock:
            store[key] = (time.time(), (ttl, value))

    # ---------------- 基础请求
    def _get(self, url, headers=None, timeout=None, retries=None, **kwargs):
        """带重试的 GET；返回 Response 或 None。"""
        last = None
        total = retries if retries is not None else MAX_RETRY
        for attempt in range(max(1, total)):
            try:
                # 不加全局锁：详情页首/中/末集清晰度探测需要并发请求
                r = self.session.get(
                    url, headers=headers, timeout=timeout or API_TIMEOUT,
                    verify=False, allow_redirects=True, **kwargs
                )
                if r.status_code >= 500:
                    last = r
                    time.sleep(0.25 * (attempt + 1) + random.random() * 0.15)
                    continue
                return r
            except Exception as e:
                last = e
                time.sleep(0.3 * (attempt + 1) + random.random() * 0.2)
        return last if isinstance(last, requests.Response) else None

    def _auth_header(self, ts):
        plain = "0.1.0-%s-3-1.0.0-win32" % ts
        inner = base64.b64encode(plain.encode()).decode()
        ct = aes_cbc_encrypt(inner.encode(), AUTH_AES_KEY.encode(), AUTH_AES_IV.encode())
        return base64.b64encode(ct).decode()

    def _decrypt_response(self, text):
        text = (text or "").strip()
        if not text:
            return {}
        if text[0] in "{[":
            try:
                return json.loads(text)
            except Exception:
                pass
        if "." not in text:
            return {}
        p = text.index(".")
        try:
            rsa_blob = base64.b64decode(text[:p] + "=" * (-len(text[:p]) % 4))
            aes_key = rsa_decrypt(rsa_blob)
            if len(aes_key) not in (16, 24, 32):
                for cand in (aes_key[:16], aes_key[-16:], aes_key[:32], aes_key[-32:]):
                    if len(cand) in (16, 24, 32):
                        aes_key = cand
                        break
            if len(aes_key) not in (16, 24, 32):
                return {}
            body = base64.b64decode(text[p + 1:].strip() + "=" * (-len(text[p + 1:].strip()) % 4))
            plain = aes_cbc_decrypt(body, aes_key, aes_key[::-1])
            return json.loads(plain.decode("utf-8", "ignore").strip())
        except Exception:
            return {}

    def _api(self, path, params=None, timeout=None, retries=None):
        """主站 API：AES 鉴权头 + 响应解密 + 重试。"""
        total = retries if retries is not None else MAX_RETRY
        for attempt in range(max(1, total)):
            ts = str(int(time.time() * 1000))
            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "x-version": X_VERSION,
                "appid": APP_ID,
                "system": "3",
                "requrl": self.host,
                "ts": ts,
                "authentication": self._auth_header(ts),
                "User-Agent": UA,
            }
            r = self._get(self.host + path, headers=headers, params=params or {},
                          timeout=timeout or API_TIMEOUT, retries=total)
            if r is None:
                time.sleep(0.25 * (attempt + 1))
                continue
            obj = self._decrypt_response(r.text)
            if isinstance(obj, dict) and obj.get("code") == 20000:
                return obj.get("data", obj)
            if isinstance(obj, list):
                return obj
            if isinstance(obj, dict) and obj.get("code") in (None, 20000):
                return obj
            time.sleep(0.3 * (attempt + 1))
        return {}

    # ---------------- 分类
    def _channel_list(self):
        now = time.time()
        if self._channels is not None and now < self._channels_ts:
            return self._channels
        data = self._api("/pc/channel", {"top-level": "true"})
        lst = []
        if isinstance(data, list):
            lst = data
        elif isinstance(data, dict):
            lst = data.get("list") or data.get("items") or data.get("data") or []
        self._channels = [x for x in lst if isinstance(x, dict)]
        self._channels_ts = now + (CHANNEL_TTL if self._channels else 60)
        return self._channels

    def homeContent(self, filter):
        classes = []
        filters = {}
        sorts = [("综合排序", "default"), ("最新上线", "addtime"),
                 ("热度最高", "hits"), ("最好评", "gold"), ("最多播放", "weight")]
        try:
            for ch in self._channel_list():
                tid = str(ch.get("id", ""))
                name = clean_text(ch.get("name", ""))
                if not tid:
                    continue
                classes.append({"type_id": tid, "type_name": name})
                f = []
                for key, field, label in (("type", "types", "类型"),
                                          ("area", "areas", "地区"),
                                          ("year", "years", "年份")):
                    vals = ch.get(field) or []
                    options = [{"n": "全部", "v": ""}]
                    seen = set()
                    for v in vals:
                        if isinstance(v, dict):
                            v = v.get("name") or v.get("value") or v.get("id") or ""
                        v = clean_text(v)
                        if v and v not in seen:
                            seen.add(v)
                            options.append({"n": v, "v": v})
                    if len(options) > 1:
                        f.append({"key": key, "name": label, "value": options})
                f.append({"key": "sort", "name": "排序",
                          "value": [{"n": n, "v": v} for n, v in sorts]})
                filters[tid] = f
        except Exception:
            pass
        return {"class": classes, "filters": filters}

    def homeVideoContent(self):
        return {"list": []}

    def categoryContent(self, tid, pg, filter, extend):
        page = _safe_int(pg, 1)
        if page < 1:
            page = 1
        params = {"channel": str(tid), "page": str(page), "limit": str(PAGE_SIZE)}
        ext = extend or {}
        if isinstance(ext, str):
            try:
                ext = json.loads(ext)
            except Exception:
                ext = {}
        if not isinstance(ext, dict):
            ext = {}
        for k in ("type", "class"):
            if ext.get(k):
                params["type"] = ext[k]
                break
        if ext.get("area"):
            params["area"] = ext["area"]
        if ext.get("year"):
            params["year"] = ext["year"]
        params["sort"] = ext.get("sort") or "default"

        data = self._api("/pc/video/list", params)
        items = []
        total = 0
        if isinstance(data, dict):
            items = data.get("items") or data.get("list") or data.get("data") or []
            total = _safe_int(data.get("total"), 0)
        elif isinstance(data, list):
            items = data
            total = len(items)
        vod_list = []
        for it in items or []:
            if not isinstance(it, dict):
                continue
            vod_list.append({
                "vod_id": str(it.get("id", "")),
                "vod_name": clean_text(it.get("name")),
                "vod_pic": it.get("pic") or "",
                "vod_remarks": clean_text(it.get("continu")),
            })
        pagecount = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE) if total else 1
        return {"list": vod_list, "page": page, "pagecount": pagecount,
                "limit": PAGE_SIZE, "total": total}

    # ---------------- 详情
    def _normalize_episodes(self, raw):
        out = []
        if isinstance(raw, dict):
            raw = [{"name": k, "part": v} for k, v in raw.items()]
        if isinstance(raw, str):
            raw = [raw]
        if not isinstance(raw, list):
            return out
        for i, ep in enumerate(raw):
            label = ""
            part = ""
            direct = ""
            if isinstance(ep, dict):
                label = clean_text(ep.get("name") or ep.get("title") or
                                   ep.get("part") or ep.get("ep") or "")
                u = str(ep.get("url") or ep.get("play_url") or "").strip()
                if u.startswith("http"):
                    direct = u
                part = str(ep.get("part") or ep.get("id") or ep.get("eid") or "").strip()
                if not part and not direct:
                    part = label
            else:
                val = str(ep).strip()
                label = clean_text(val)
                part = val
                if val.startswith("http"):
                    direct = val
                    label = ""
            if not label:
                label = "第%d集" % (i + 1)
            if not part and not direct:
                part = label
            out.append((label, part, direct))
        return out

    def _make_token(self, vid, play, part, quality="", direct=""):
        payload = {"i": vid, "p": play, "e": part}
        if quality:
            payload["q"] = quality
        if direct:
            payload["u"] = direct
        return "dmghg:" + b64url_encode(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))

    def _probe_episode_quality(self, vid, play, part):
        """探测单集真实清晰度，返回 [rank]；任何失败都返回 []。"""
        ranks = []
        if not part:
            return ranks
        try:
            items = self._get_play_api(vid, play, part, fast=True)
        except Exception:
            items = []
        for it in items:
            if not isinstance(it, dict):
                continue
            src = str(it.get("url") or "").strip()
            if not src or src.startswith("http"):
                continue
            headers = it.get("lua_header") if isinstance(it.get("lua_header"), dict) else None
            try:
                entries = self._normalize_entries(self._fetch_play_addr(src, fast=True), headers)
            except Exception:
                entries = []
            for e in entries:
                r = e.get("rank", 0)
                if r not in ranks:
                    ranks.append(r)
        return ranks

    def _discover_qualities(self, vid, line):
        """首/中/末三集并发探测清晰度，返回 {"q": [...], "partial4k": bool}。

        只用于详情页判断"这部片到底有没有 4K"，不会试播、不影响原线路。
        """
        empty = {"q": [], "partial4k": False}
        eps = line.get("eps") or []
        if not eps:
            return empty
        play = line.get("play") or ""
        cache_key = (vid, play)
        cached = self._cache_get(self._quality_cache, cache_key)
        if cached is not None:
            return cached

        idxs = []
        for i in (0, len(eps) // 2, len(eps) - 1):
            if 0 <= i < len(eps) and i not in idxs:
                idxs.append(i)
        parts = [eps[i][1] for i in idxs if eps[i][1]]

        results = []
        if ThreadPoolExecutor and len(parts) > 1:
            pool = ThreadPoolExecutor(max_workers=min(3, len(parts)))
            try:
                futs = [pool.submit(self._probe_episode_quality, vid, play, p) for p in parts]
                deadline = time.time() + DISCOVER_WAIT
                for f in futs:
                    remain = deadline - time.time()
                    if remain <= 0:
                        break
                    try:
                        results.append(f.result(timeout=remain))
                    except Exception:
                        pass
            finally:
                try:
                    pool.shutdown(wait=False)
                except Exception:
                    pass
        else:
            for p in parts:
                try:
                    results.append(self._probe_episode_quality(vid, play, p))
                except Exception:
                    pass

        qualities = []
        for r in sorted({x for res in results for x in res}, reverse=True):
            label = quality_label("", r)
            if label not in qualities:
                qualities.append(label)

        known = [res for res in results if res]
        has4k = [any(r >= 4000 for r in res) for res in known]
        partial4k = bool(has4k) and not all(has4k)
        info = {"q": qualities, "partial4k": partial4k}
        self._cache_put(self._quality_cache, cache_key, info,
                        QUALITY_TTL if qualities else 30)
        return info

    def detailContent(self, ids):
        if isinstance(ids, str):
            try:
                parsed = json.loads(ids)
                ids = parsed if isinstance(parsed, list) else [ids]
            except Exception:
                ids = [ids]
        vid = str(ids[0]) if ids else ""
        if not vid:
            return {"list": []}
        data = self._api("/pc/video/detail", {"id": vid})
        if not isinstance(data, dict) or not data:
            return {"list": []}

        vod = {
            "vod_id": vid,
            "vod_name": clean_text(data.get("name")),
            "vod_pic": data.get("pic") or "",
            "vod_year": str(data.get("year") or ""),
            "vod_area": str(data.get("area") or ""),
            "vod_actor": clean_text(data.get("actor")),
            "vod_director": clean_text(data.get("director")),
            "vod_content": clean_text(data.get("content")),
            "vod_remarks": clean_text(data.get("continu")),
        }

        raw_parts = data.get("parts") or data.get("play_sources") or []
        if isinstance(raw_parts, dict):
            raw_parts = [raw_parts]
        if not isinstance(raw_parts, list):
            raw_parts = []

        base_lines = []
        used_line_names = set()
        for idx, part in enumerate(raw_parts):
            if not isinstance(part, dict):
                continue
            play = str(part.get("play") or part.get("player") or "").strip()
            line_name = clean_text(part.get("play_zh") or part.get("name") or
                                   part.get("title") or play or ("线路%d" % (idx + 1)))
            eps = self._normalize_episodes(part.get("part") or part.get("parts") or
                                           part.get("episodes") or [])
            if not play and not eps:
                continue
            if not eps:
                # 有些影片只有一条线路但 part 为空；保留线路，给一个"正片"占位
                eps = [("正片", "", "")]
            if not line_name:
                line_name = "线路%d" % (idx + 1)
            line_name = self._unique_name(line_name, used_line_names)
            base_lines.append({
                "name": line_name,
                "play": play,
                "eps": eps,
            })

        # 只在真正探测到 4K 时才生成 4K 线路，绝不虚构。
        # 4K 可能只存在于部分集（181867 只有第 82 集），所以首/中/末三集并发取并集。
        if DISCOVER_QUALITIES:
            for line in base_lines:
                try:
                    info = self._discover_qualities(vid, line)
                except Exception:
                    info = {"q": [], "partial4k": False}
                line["qualities"] = info.get("q") or []
                line["partial4k"] = bool(info.get("partial4k"))
        else:
            for line in base_lines:
                line["qualities"] = []
                line["partial4k"] = False

        all_quals = []
        for line in base_lines:
            for q in line.get("qualities") or []:
                if q not in all_quals:
                    all_quals.append(q)
        all_quals.sort(key=lambda q: -quality_rank(q))

        quality_lines = []
        used_line_names = set(line["name"] for line in base_lines)
        for line in base_lines:
            line_quals = line.get("qualities") or []
            for q in all_quals:
                if q not in line_quals:
                    continue
                # 4K 一定单独成线；其他清晰度只有在同一条线路存在多种时才有意义
                if quality_rank(q) < 4000 and len(line_quals) <= 1:
                    continue
                if q == line["name"]:
                    continue
                qname = "%s线路" % q if len(base_lines) == 1 else "%s-%s" % (line["name"], q)
                if q == "4K" and line.get("partial4k"):
                    qname += "(部分集)"
                qname = self._unique_name(qname, used_line_names)
                quality_lines.append({
                    "name": qname,
                    "play": line["play"],
                    "eps": line["eps"],
                    "quality": q,
                    "order": self._line_order(base_lines, line),
                })

        # 4K 排最前，其余按清晰度从高到低；同清晰度保持原语言顺序
        quality_lines.sort(key=lambda x: (-quality_rank(x["quality"]), x["order"]))
        ordered = quality_lines + [{
            "name": line["name"], "play": line["play"],
            "eps": line["eps"], "quality": "",
        } for line in base_lines]

        from_list, url_list = [], []
        for line in ordered:
            eps = []
            used_ep_names = set()
            for label, part, direct in line["eps"]:
                ep_name = self._unique_name(label, used_ep_names)
                token = self._make_token(vid, line["play"], part, line.get("quality", ""), direct)
                eps.append("%s$%s" % (ep_name, token))
            if not eps:
                continue
            from_list.append(line["name"])
            url_list.append("#".join(eps))

        vod["vod_play_from"] = "$$$".join(from_list)
        vod["vod_play_url"] = "$$$".join(url_list)
        return {"list": [vod]}

    @staticmethod
    def _line_order(lines, target):
        for i, line in enumerate(lines):
            if line is target:
                return i
        return 999

    @staticmethod
    def _unique_name(name, used):
        name = clean_text(name) or "线路"
        if name not in used:
            used.add(name)
            return name
        i = 2
        while ("%s·%d" % (name, i)) in used:
            i += 1
        out = "%s·%d" % (name, i)
        used.add(out)
        return out

    # ---------------- 搜索
    def searchContent(self, key, quick=False, pg="1"):
        page = _safe_int(pg, 1)
        if page < 1:
            page = 1
        params = {"key": str(key).strip(), "page": str(page), "limit": str(PAGE_SIZE)}
        data = self._api("/pc/video/search", params)
        items = []
        total = 0
        if isinstance(data, dict):
            items = data.get("items") or data.get("list") or data.get("data") or []
            total = _safe_int(data.get("total"), 0)
        elif isinstance(data, list):
            items = data
            total = len(items)
        vod_list = []
        for it in items or []:
            if not isinstance(it, dict):
                continue
            vod_list.append({
                "vod_id": str(it.get("id", "")),
                "vod_name": clean_text(it.get("name")),
                "vod_pic": it.get("pic") or "",
                "vod_remarks": clean_text(it.get("continu")),
            })
        pagecount = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE) if total else 1
        return {"list": vod_list, "page": page, "pagecount": pagecount,
                "limit": PAGE_SIZE, "total": total}

    # ---------------- 播放参数加密
    def _encrypt_md5_id(self, md5_id):
        prefix = "%04d" % random.randint(0, 9999)
        scrambled = md5_id.lower()[::-1]
        guard = md5_hex("%s:%s:%s:%s" % (prefix, scrambled, MD5_AES_KEY, MD5_AES_IV))[:2]
        wrapped = scrambled[:16] + guard + scrambled[16:]
        plain = prefix + "-" + wrapped
        ct = aes_cbc_encrypt(plain.encode(), MD5_AES_KEY.encode(), MD5_AES_IV.encode())
        return base64.b64encode(ct).decode()

    def _gen_auth_param(self, path, expire, key):
        exp = int(time.time()) + expire
        rnd = rand_str(16)
        sign = md5_hex("%s-%d-%s-0-%s" % (path, exp, rnd, key))
        return "sign=%d-%s-0-%s" % (exp, rnd, sign)

    def _client_header(self, path, md5_param, auth_param, key, binds=None, expire=None):
        nonce = rand_str(20)
        seed = [path, md5_param, auth_param]
        exp = None
        if expire:
            exp = int(time.time()) + expire
            seed.append(str(exp))
        seed += (binds or [])
        seed.append(nonce)
        seed.append(key)
        h = md5_hex("|".join(seed))
        if exp:
            return "v1:%d:%s:%s" % (exp, nonce, h)
        return "v1:%s:%s" % (nonce, h)

    def _decrypt_url_field(self, value):
        """addr / m3u8FileDomain 解密；失败回退原值（这是不丢 4K 的关键之一）。"""
        if value is None:
            return ""
        s = str(value).strip()
        if not s:
            return ""
        # 已经是明文 URL / 路径
        if s.startswith(("http://", "https://", "/")):
            return s
        for decoder in (base64.b64decode, base64.urlsafe_b64decode):
            try:
                raw = decoder(s + "=" * (-len(s) % 4))
                if not raw:
                    continue
                for key, iv in ((MD5_AES_IV, MD5_AES_KEY), (MD5_AES_KEY, MD5_AES_IV)):
                    try:
                        pt = aes_cbc_decrypt(raw, key.encode(), iv.encode())
                        text = pt.decode("utf-8", "ignore").strip()
                        if text:
                            return text
                    except Exception:
                        pass
            except Exception:
                pass
        # 解密失败：返回原始值，交给后面的候选生成/探测决定
        return s

    def _candidate_urls(self, url):
        """为一个原始 URL 生成多候选：原始、域名改写、HTTPS 升级。"""
        url = (url or "").strip()
        if not url.startswith("http"):
            return []
        if "anixx.r2" in url:
            return ["https://sns-music.xhscdn.com/104002e031m0qe7o84s0m6saf3o"]

        dead = ("play.ddmm.hzhcbkj.cn" in url or "new.ddmm.hzhcbkj.cn" in url)
        rewrites = []

        r = url.replace("play.ddmm.hzhcbkj.cn", "m3bkbfdm.hzhcbkj.cn")
        r = r.replace("new.ddmm.hzhcbkj.cn", "m3bkbfdm.hzhcbkj.cn")
        if r != url:
            rewrites.append(r)

        if "bdmov.a.yximgs.com" in url:
            rewrites.append(url.replace("bdmov.a.yximgs.com", "v4-kling.kechuangai.com"))
            rewrites.append(url.replace("bdmov.a.yximgs.com", "static.yximgs.com"))

        if "hwmov6.a.yximgs.com" in url:
            rewrites.append(url.replace("hwmov6.a.yximgs.com", "v4-kling.kechuangai.com"))

        if re.search(r"v[123]-ad\.video\.yximgs\.com", url):
            for target in ("v1-ad.video.yximgs.com", "v2-ad.video.yximgs.com",
                           "v3-ad.video.yximgs.com", "alimov2.a.yximgs.com",
                           "v4-kling.kechuangai.com", "h2.static.yximgs.com"):
                rewrites.append(re.sub(r"v[123]-ad\.video\.yximgs\.com", target, url))

        if "sns-video-default.xhscdn.com" in url:
            for target in ("sns-video-bd.xhscdn.com", "sns-video-hw.xhscdn.com",
                           "sns-video-hs.xhscdn.com"):
                rewrites.append(url.replace("sns-video-default.xhscdn.com", target))

        extra = []
        for u in [url] + rewrites:
            if u.startswith("http://m3bkbfdm.hzhcbkj.cn/"):
                extra.append("https://" + u[7:])

        order = rewrites + [url] if dead else [url] + rewrites
        out = []

        def add(u):
            u = (u or "").strip()
            if u.startswith("http") and u not in out:
                out.append(u)

        for u in order + extra:
            add(u)
        return out[:MAX_CANDIDATES]

    def _probe_media(self, url, headers=None):
        """轻量探测 m3u8/mp4 是否可读；失败只影响候选排序，不会丢线路。"""
        h = {"User-Agent": UA}
        if isinstance(headers, dict):
            for k, v in headers.items():
                if v:
                    h[str(k)] = str(v)
        try:
            with self._lock:
                r = self.session.get(url, headers=h, timeout=PROBE_TIMEOUT,
                                     verify=False, stream=True, allow_redirects=True)
            try:
                if r.status_code not in (200, 206):
                    return False
                ctype = (r.headers.get("Content-Type") or "").lower()
                chunk = b""
                for part in r.iter_content(256):
                    chunk = part or b""
                    break
            finally:
                r.close()
            low = url.lower()
            if ".m3u8" in low or "mpegurl" in ctype:
                return b"#EXTM3U" in chunk
            if ".mp4" in low:
                return (not ctype) or ("video" in ctype) or (b"ftyp" in chunk) or len(chunk) == 0
            return True
        except Exception:
            return False

    def _pick_playable(self, candidates, headers=None):
        if not candidates:
            return ""
        if len(candidates) == 1:
            return candidates[0]
        for u in candidates:
            if self._probe_media(u, headers):
                return u
        # 探测全部失败（网络抖动/防盗链误判）：仍然返回非死域名的原始候选
        for u in candidates:
            if "play.ddmm.hzhcbkj.cn" not in u and "new.ddmm.hzhcbkj.cn" not in u:
                return u
        return candidates[0]

    def _fetch_play_addr(self, source, fast=False):
        """请求解析站，返回 data.playAddr 原始列表；带缓存+重试+双协议。

        fast=True：单次请求、短超时，供详情页清晰度探测使用。
        """
        source = (source or "").strip()
        cache_key = ("fast", source) if fast else source
        cached = self._cache_get(self._addr_cache, cache_key)
        if cached is not None:
            return cached

        md5_id = source[4:] if source.startswith("new-") else source
        if not re.match(r"^[a-fA-F0-9]{32}$", md5_id):
            return []
        hosts = PLAY_HOSTS[:1] if fast else PLAY_HOSTS
        attempts = 1 if fast else MAX_RETRY
        timeout = FAST_TIMEOUT if fast else PLAY_TIMEOUT
        result = []
        for host in hosts:
            for attempt in range(attempts):
                try:
                    md5_param = self._encrypt_md5_id(md5_id)
                    path = "/"
                    auth_param = self._gen_auth_param(path, PLAY_EXPIRE, PLAY_AUTH_KEY)
                    h_auth = self._client_header(path, md5_param, auth_param,
                                                 PLAY_HEADER_KEY, [], PLAY_EXPIRE)
                    h_proof = self._client_header(path, md5_param, auth_param,
                                                  PLAY_EXTRA_KEY, [h_auth])
                    h_check = self._client_header(path, md5_param, auth_param,
                                                  PLAY_CHECK_KEY, [h_auth, h_proof])
                    url = host + "/?md5=" + urllib.parse.quote(md5_param, safe="") + "&" + auth_param
                    headers = {
                        "Accept": "*/*",
                        "Connection": "keep-alive",
                        "User-Agent": UA,
                        "X-Goepp-Client-Auth": h_auth,
                        "X-Goepp-Client-Proof": h_proof,
                        "X-Goepp-Client-Probe": PLAY_PROBE_KEY,
                        "X-Goepp-Client-Check": h_check,
                    }
                    r = self._get(url, headers=headers, timeout=timeout, retries=attempts)
                    if r is None:
                        continue
                    text = (r.text or "").strip()
                    if not text:
                        continue
                    obj = json.loads(text)
                    if obj.get("code") == 0:
                        play_addr = (obj.get("data") or {}).get("playAddr") or []
                        if isinstance(play_addr, list):
                            result = play_addr
                        break
                except Exception:
                    pass
                time.sleep(0.25 * (attempt + 1) + random.random() * 0.15)
            if result:
                break
        self._cache_put(self._addr_cache, cache_key, result,
                        ADDR_TTL if result else 10)
        if fast and result:
            self._cache_put(self._addr_cache, source, result, ADDR_TTL)
        return result

    def _normalize_entries(self, play_addr_list, item_headers=None):
        """把 playAddr 原始项统一成候选结构；任何一项失败都不影响其他项。"""
        entries = []
        if not isinstance(play_addr_list, list):
            return entries
        for pa in play_addr_list:
            if not isinstance(pa, dict):
                continue
            try:
                addr = self._decrypt_url_field(pa.get("addr"))
                dom = self._decrypt_url_field(pa.get("m3u8FileDomain"))
                # 兼容：addr 直接是完整 URL；或 domain + path；或原始明文
                full = ""
                if addr.startswith("http"):
                    full = addr
                elif dom.startswith("http") and addr.startswith("/"):
                    full = dom + addr
                elif dom.startswith("http") and addr.startswith("http"):
                    full = addr
                else:
                    full = (dom if dom.startswith("http") else "") + (addr or "")
                if not full.startswith("http"):
                    raw_addr = str(pa.get("addr") or "").strip()
                    raw_dom = str(pa.get("m3u8FileDomain") or "").strip()
                    if raw_addr.startswith("http"):
                        full = raw_addr
                    elif raw_dom.startswith("http") and raw_addr.startswith("/"):
                        full = raw_dom + raw_addr
                if not full.startswith("http"):
                    continue
                candidates = self._candidate_urls(full)
                if not candidates:
                    continue
                desc = clean_text(pa.get("desc") or pa.get("title") or "")
                title = clean_text(pa.get("title") or "")
                name = " ".join([x for x in (desc, title) if x]) or "默认"
                rank = quality_rank(desc + " " + title, pa.get("height"))
                entries.append({
                    "url": full,
                    "candidates": candidates,
                    "desc": desc,
                    "title": title,
                    "name": name,
                    "rank": rank,
                    "vcodec": str(pa.get("vcodec") or "").upper(),
                    "headers": item_headers if isinstance(item_headers, dict) else {"User-Agent": UA},
                })
            except Exception:
                continue
        return entries

    def _choose_entry(self, entries, desired=""):
        if not entries:
            return None
        desired_rank = quality_rank(desired) if desired else 0
        pool = entries
        if desired_rank:
            if desired_rank >= 4000:
                matched = [e for e in entries if e.get("rank", 0) >= 4000]
            else:
                matched = [e for e in entries if e.get("rank", 0) == desired_rank]
                if not matched:
                    matched = [e for e in entries if e.get("rank", 0) >= desired_rank]
            if not matched:
                d = clean_text(desired).lower()
                matched = [e for e in entries
                           if d and d in (e.get("desc", "") + " " + e.get("title", "")).lower()]
            if matched:
                pool = matched

        def sort_key(e):
            codec = e.get("vcodec", "")
            codec_pref = 0 if (codec.startswith("H264") or codec in ("AVC", "")) else 1
            return (-e.get("rank", 0), codec_pref)

        pool = sorted(pool, key=sort_key)
        for e in pool:
            url = self._pick_playable(e.get("candidates") or [], e.get("headers"))
            if url:
                return {
                    "url": url,
                    "name": e.get("name") or "默认",
                    "rank": e.get("rank", 0),
                    "vcodec": e.get("vcodec", ""),
                    "headers": e.get("headers") if isinstance(e.get("headers"), dict) else {"User-Agent": UA},
                }
        return None

    def _get_play_api(self, vid, play, part, fast=False, force=False):
        """调用 /pc/video/play，带缓存；返回 list。force=True 跳过缓存。"""
        key = ("fast" if fast else "play", str(vid), str(play), str(part))
        if not force:
            cached = self._cache_get(self._play_api_cache, key)
            if cached is not None:
                return cached
        if fast:
            data = self._api("/pc/video/play", {
                "id": str(vid), "play": str(play), "part": str(part),
            }, timeout=FAST_TIMEOUT, retries=1)
        else:
            data = self._api("/pc/video/play", {
                "id": str(vid), "play": str(play), "part": str(part),
            })
        items = []
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("list") or data.get("items") or data.get("data") or []
        items = [x for x in items if isinstance(x, dict)] if isinstance(items, list) else []
        self._cache_put(self._play_api_cache, key, items,
                        PLAY_API_TTL if items else 10)
        if fast and items:
            self._cache_put(self._play_api_cache,
                            ("play", str(vid), str(play), str(part)),
                            items, PLAY_API_TTL)
        return items

    def _resolve_source(self, source, desired="", item_headers=None):
        """解析 new-<md5> -> 最终可播 URL；带缓存，失败返回 None。"""
        source = (source or "").strip()
        if not source:
            return None
        if source.startswith("http"):
            return {
                "url": source,
                "name": "直链",
                "rank": 0,
                "vcodec": "",
                "headers": item_headers if isinstance(item_headers, dict) else {"User-Agent": UA},
            }
        cache_key = (source, desired or "", json.dumps(item_headers or {}, sort_keys=True))
        cached = self._cache_get(self._resolve_cache, cache_key)
        if cached is not None:
            return cached
        entries = self._normalize_entries(self._fetch_play_addr(source), item_headers)
        chosen = self._choose_entry(entries, desired)
        if chosen:
            self._cache_put(self._resolve_cache, cache_key, chosen, RESOLVE_TTL)
        return chosen

    def _parse_token(self, token):
        pid = str(token or "").strip()
        if pid.startswith("dmghg:"):
            pid = pid[6:]
        try:
            payload = json.loads(b64url_decode(pid))
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    def _play_result(self, chosen):
        if not chosen or not chosen.get("url"):
            return {"parse": 0, "jx": 0, "url": ""}
        url = chosen["url"]
        headers = chosen.get("headers") if isinstance(chosen.get("headers"), dict) else {}
        if not headers:
            headers = {"User-Agent": UA}
        out = {
            "parse": 0,
            "jx": 0,
            "url": url,
            "header": headers,
        }
        ctype = guess_content_type(url)
        if ctype:
            out["contentType"] = ctype
        return out

    def playerContent(self, flag, id, vipFlags=None):
        try:
            raw_id = str(id or "").strip()
            if raw_id.startswith("http"):
                return self._play_result({"url": raw_id, "headers": {"User-Agent": UA}})
            payload = self._parse_token(id)
            if not payload:
                return {"parse": 0, "jx": 0, "url": ""}

            vid = str(payload.get("i") or payload.get("id") or "")
            play = str(payload.get("p") or payload.get("play") or "")
            part = str(payload.get("e") or payload.get("part") or "")
            desired = clean_text(payload.get("q") or "")
            if not desired:
                # 旧 token 没有 q 字段时，从线路名反推（App 缓存的旧详情也能用）
                f = str(flag or "").upper()
                if "4K" in f or "2160" in f:
                    desired = "4K"
                elif "1080" in f:
                    desired = "1080P"
                elif "720" in f:
                    desired = "720P"
            direct = str(payload.get("u") or "").strip()
            if direct.startswith("http"):
                return self._play_result({"url": direct, "headers": {"User-Agent": UA}})

            items = self._get_play_api(vid, play, part)
            if not items:
                # 空结果可能是瞬时抖动：绕开 10 秒空缓存立刻再试一次
                time.sleep(0.3)
                items = self._get_play_api(vid, play, part, force=True)
            chosen_list = []
            fallback_list = []

            for it in items:
                if not isinstance(it, dict):
                    continue
                item_headers = it.get("lua_header") if isinstance(it.get("lua_header"), dict) else None
                src = str(it.get("url") or "").strip()
                if not src:
                    continue
                if src.startswith("http"):
                    chosen_list.append({
                        "url": src,
                        "name": clean_text(it.get("res") or "直链"),
                        "rank": 0,
                        "vcodec": "",
                        "headers": item_headers if isinstance(item_headers, dict) else {"User-Agent": UA},
                    })
                    continue
                # 注意：不读取、不执行 it["parse"]（上游可能返回 Lua 脚本/提示注入）
                chosen = self._resolve_source(src, desired, item_headers)
                if chosen:
                    chosen_list.append(chosen)
                else:
                    fallback = self._resolve_source(src, "", item_headers)
                    if fallback:
                        fallback_list.append(fallback)

            if not chosen_list:
                chosen_list = fallback_list

            if chosen_list:
                if desired:
                    ranked = [c for c in chosen_list if c.get("rank", 0) >= 4000] \
                        if quality_rank(desired) >= 4000 else \
                        [c for c in chosen_list if c.get("rank", 0) == quality_rank(desired)]
                    if not ranked:
                        ranked = chosen_list
                else:
                    ranked = chosen_list
                ranked = sorted(ranked, key=lambda c: -c.get("rank", 0))
                return self._play_result(ranked[0])

            # 最后兜底：有些集数的 play 接口直接返回 http 直链，但上面 items 可能为空
            return {"parse": 0, "jx": 0, "url": ""}
        except Exception:
            return {"parse": 0, "jx": 0, "url": ""}
