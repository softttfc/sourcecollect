# coding=utf-8
# TVBox / NewBox Python 爬虫：共和动漫（csp_Dmghg 的 Python 实现）
# 适配说明：
#   1) 本 APP（base.apk，Chaquopy + base/spider.pyc）由 app.py 统一做 json.dumps，
#      因此所有接口方法必须返回 dict / list，不能返回 JSON 字符串（否则会被二次编码）。
#   2) 类名必须为 Spider，构造无需参数；可选实现 getName / init / isVideoFormat 等。
#   3) APP 自带 requests、pycryptodome；本文件优先用 pycryptodome 加速，缺失时回退纯 Python AES。
# 接口来源：wy6 配置里的 共和┃动漫 (api=csp_Dmghg)
# 说明：接口全程加密（请求 AES 鉴权头 / 响应 RSA+AES 混包）。
import base64
import hashlib
import json
import random
import re
import time
import urllib.parse

import requests

try:
    requests.packages.urllib3.disable_warnings()
except Exception:
    pass

try:
    from base.spider import Spider as BaseSpider
except Exception:
    class BaseSpider(object):
        pass

# ---------------------------------------------------------------- 常量
HOST = "https://bkbfdm.cenmo.fun"
PLAY_HOST = "http://jxbfdm.cenmo.fun"

APP_ID = "4150439554430627"
X_VERSION = "2024-09-24"
AUTH_AES_KEY = "ziISjqkXPsGUMRNGyWigxDGtJbfTdcGv"   # 32 -> AES-256
AUTH_AES_IV = "WonrnVkxeIxDcFbv"                   # 16

MD5_AES_KEY = "UY9kxQEtk8Dn08Kr"                   # 17KB->播放参数 AES-128
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


# ---------------------------------------------------------------- AES
# APP 内置 pycryptodome 时用它加速（机顶盒上快很多），否则回退到纯 Python 实现
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
            # ShiftRows（列主序：state[col*4+row]）
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
            # InvShiftRows
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
    if _FAST_AES is not None:
        plain = _FAST_AES.new(key, _FAST_AES.MODE_CBC, iv).decrypt(raw)
    else:
        plain = _AES(key).cbc_decrypt(raw, iv)
    return _pkcs7_unpad(plain)


# ---------------------------------------------------------------- RSA
def rsa_decrypt(cipher_bytes):
    """RSA/ECB/PKCS1Padding 解密，返回 16 字节 AES 会话密钥"""
    c = int.from_bytes(cipher_bytes, "big")
    m = pow(c, RSA_D, RSA_N)
    raw = m.to_bytes(RSA_BYTES, "big")
    # 去掉 00 02 <padding> 00 前缀
    idx = raw.find(b"\x00", 2)
    if idx < 0:
        idx = 2
    return raw[idx + 1:]


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
    if not s:
        return ""
    return re.sub(r"[$#]", " ", str(s)).strip()


def _to_int(v, default=1):
    try:
        return int(v)
    except Exception:
        return default


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
        self._channels = None
        self._channels_ts = 0

    def getName(self):
        return "共和动漫"

    def getDependence(self):
        return []

    def init(self, extend=""):
        # extend 可能是字符串，也可能是依赖列表（本脚本无依赖）
        if isinstance(extend, str) and extend.strip().startswith("http"):
            global HOST
            HOST = extend.strip().rstrip("/")

    def destroy(self):
        try:
            self.session.close()
        except Exception:
            pass

    def isVideoFormat(self, url):
        return bool(re.search(r"\.(m3u8|mp4|flv)", url or "", re.I))

    def manualVideoCheck(self):
        return False

    # ---------------- 基础请求（AES 鉴权头 + 响应解密）
    def _auth_header(self, ts):
        plain = "0.1.0-%s-3-1.0.0-win32" % ts
        inner = base64.b64encode(plain.encode()).decode()
        ct = aes_cbc_encrypt(inner.encode(), AUTH_AES_KEY.encode(), AUTH_AES_IV.encode())
        return base64.b64encode(ct).decode()

    def _decrypt_response(self, text):
        text = (text or "").strip()
        if not text:
            return {}
        if text[0] == "{":
            try:
                return json.loads(text)
            except Exception:
                return {}
        if "." not in text:
            return {}
        p = text.index(".")
        try:
            aes_key = rsa_decrypt(base64.b64decode(text[:p]))
            body = base64.b64decode(text[p + 1:])
            plain = aes_cbc_decrypt(body, aes_key, aes_key[::-1])
            return json.loads(plain.decode("utf-8", "ignore").strip())
        except Exception:
            return {}

    def _api(self, path, params=None):
        ts = str(int(time.time() * 1000))
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-version": X_VERSION,
            "appid": APP_ID,
            "system": "3",
            "requrl": HOST,
            "ts": ts,
            "authentication": self._auth_header(ts),
            "User-Agent": UA,
        }
        try:
            r = self.session.get(HOST + path, params=params or {}, headers=headers,
                                 timeout=15, verify=False, allow_redirects=True)
        except Exception:
            return {}
        obj = self._decrypt_response(r.text)
        if isinstance(obj, dict) and obj.get("code") == 20000:
            return obj.get("data", obj)
        return obj if isinstance(obj, (dict, list)) else {}

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
            lst = data.get("list") or data.get("data") or []
        self._channels = [x for x in lst if isinstance(x, dict)]
        self._channels_ts = now + 1800
        return self._channels

    def homeContent(self, filter):
        classes = []
        filters = {}
        sorts = [("综合排序", "default"), ("最新上线", "addtime"),
                 ("热度最高", "hits"), ("最好评", "gold"), ("最多播放", "weight")]
        try:
            for ch in self._channel_list():
                tid = str(ch.get("id", ""))
                name = str(ch.get("name", ""))
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
                        v = str(v).strip()
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
        params = {"channel": str(tid), "page": str(pg), "limit": str(PAGE_SIZE)}
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
        items = data.get("items") if isinstance(data, dict) else []
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
        total = _to_int(data.get("total"), 0) if isinstance(data, dict) else 0
        pagecount = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE) if total else 1
        return {"list": vod_list, "page": _to_int(pg, 1), "pagecount": pagecount,
                "limit": PAGE_SIZE, "total": total}

    # ---------------- 详情
    def detailContent(self, ids):
        if isinstance(ids, str):
            try:
                ids = json.loads(ids)
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

        from_list, url_list = [], []
        for part in data.get("parts") or []:
            if not isinstance(part, dict):
                continue
            play = part.get("play") or ""
            parts = part.get("part") or []
            if not play or not parts:
                continue
            name = clean_text(part.get("play_zh") or play)
            eps = []
            for ep in parts:
                ep = str(ep).strip()
                if not ep:
                    continue
                payload = {"id": vid, "play": play, "part": ep,
                           "name": clean_text(data.get("name"))}
                token = "dmghg:" + b64url_encode(json.dumps(payload, ensure_ascii=False))
                eps.append("%s$%s" % (clean_text(ep), token))
            if eps:
                from_list.append(name)
                url_list.append("#".join(eps))

        vod["vod_play_from"] = "$$$".join(from_list)
        vod["vod_play_url"] = "$$$".join(url_list)
        if not from_list:
            # 没有任何可播放线路时也给详情，播放区留空
            vod["vod_play_from"] = ""
            vod["vod_play_url"] = ""
        return {"list": [vod]}

    # ---------------- 搜索
    def searchContent(self, key, quick=False, pg="1"):
        params = {"key": str(key).strip(), "page": str(pg), "limit": str(PAGE_SIZE)}
        data = self._api("/pc/video/search", params)
        items = data.get("items") if isinstance(data, dict) else []
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
        total = _to_int(data.get("total"), 0) if isinstance(data, dict) else 0
        pagecount = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE) if total else 1
        return {"list": vod_list, "page": _to_int(pg, 1), "pagecount": pagecount,
                "limit": PAGE_SIZE, "total": total}

    # ---------------- 播放解析
    def _encrypt_md5_id(self, md5_id):
        prefix = "%04d" % random.randint(0, 9999)
        scrambled = md5_id.lower()[::-1]
        guard = md5_hex("%s:%s:%s:%s" % (prefix, scrambled, MD5_AES_KEY, MD5_AES_IV))[:2]
        wrapped = scrambled[:16] + guard + scrambled[16:]
        plain = prefix + "-" + wrapped
        ct = aes_cbc_encrypt(plain.encode(), MD5_AES_KEY.encode(), MD5_AES_IV.encode())
        return base64.b64encode(ct).decode()

    def _gen_auth_param(self, path, expire, key):
        now = int(time.time())
        exp = now + expire
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
        if not value:
            return ""
        try:
            raw = base64.b64decode(value)
            return aes_cbc_decrypt(raw, MD5_AES_IV.encode(), MD5_AES_KEY.encode()).decode("utf-8", "ignore")
        except Exception:
            return ""

    def _rewrite_url(self, url):
        url = url.replace("play.ddmm.hzhcbkj.cn", "m3bkbfdm.hzhcbkj.cn")
        url = url.replace("new.ddmm.hzhcbkj.cn", "m3bkbfdm.hzhcbkj.cn")
        url = url.replace("bdmov.a.yximgs.com", "v4-kling.kechuangai.com")
        if "hwmov6.a.yximgs.com" in url:
            url = url.replace("hwmov6.a.yximgs.com", "v4-kling.kechuangai.com")
        if re.search(r"v[123]-ad\.video\.yximgs\.com", url):
            url = re.sub(r"v[123]-ad\.video\.yximgs\.com",
                         random.choice(["v1-ad.video.yximgs.com", "alimov2.a.yximgs.com",
                                        "v4-kling.kechuangai.com", "h2.static.yximgs.com"]), url)
        if "sns-video-default.xhscdn.com" in url:
            url = url.replace("sns-video-default.xhscdn.com",
                              random.choice(["sns-video-bd.xhscdn.com", "sns-video-hw.xhscdn.com",
                                             "sns-video-hs.xhscdn.com"]))
        return url

    def _resolve_wrap(self, source):
        """把 new-<md5> 形态的播放标识换成真实 m3u8"""
        md5_id = source[4:] if source.startswith("new-") else source
        if not re.match(r"^[a-fA-F0-9]{32}$", md5_id):
            return []
        md5_param = self._encrypt_md5_id(md5_id)
        path = "/"
        auth_param = self._gen_auth_param(path, PLAY_EXPIRE, PLAY_AUTH_KEY)
        h_auth = self._client_header(path, md5_param, auth_param, PLAY_HEADER_KEY, [], PLAY_EXPIRE)
        h_proof = self._client_header(path, md5_param, auth_param, PLAY_EXTRA_KEY, [h_auth])
        h_check = self._client_header(path, md5_param, auth_param, PLAY_CHECK_KEY, [h_auth, h_proof])

        url = PLAY_HOST + "/?md5=" + urllib.parse.quote(md5_param, safe="") + "&" + auth_param
        headers = {
            "Accept": "*/*",
            "Connection": "keep-alive",
            "User-Agent": UA,
            "X-Goepp-Client-Auth": h_auth,
            "X-Goepp-Client-Proof": h_proof,
            "X-Goepp-Client-Probe": PLAY_PROBE_KEY,
            "X-Goepp-Client-Check": h_check,
        }
        try:
            r = self.session.get(url, headers=headers, timeout=15, verify=False)
            obj = json.loads(r.text)
        except Exception:
            return []
        if obj.get("code") != 0:
            return []
        result = []
        for item in (obj.get("data") or {}).get("playAddr") or []:
            if not isinstance(item, dict):
                continue
            addr = self._decrypt_url_field(item.get("addr", ""))
            domain = self._decrypt_url_field(item.get("m3u8FileDomain", ""))
            play_url = (domain or "") + (addr or "")
            if not play_url.startswith("http"):
                continue
            if domain and "anixx.r2" in domain:
                play_url = "https://sns-music.xhscdn.com/104002e031m0qe7o84s0m6saf3o"
            else:
                play_url = self._rewrite_url(play_url)
            name = clean_text(item.get("desc") or item.get("title") or "")
            result.append((name or "默认", play_url))
        return result

    def playerContent(self, flag, id, vipFlags=None):
        try:
            pid = str(id)
            if pid.startswith("dmghg:"):
                pid = pid[6:]
            payload = json.loads(b64url_decode(pid))
        except Exception:
            return {"parse": 0, "jx": 0, "url": ""}

        data = self._api("/pc/video/play", {
            "id": str(payload.get("id", "")),
            "play": str(payload.get("play", "")),
            "part": str(payload.get("part", "")),
        })
        items = data.get("list") if isinstance(data, dict) else data
        if not isinstance(items, list):
            items = []

        names, urls = [], []
        for it in items:
            if not isinstance(it, dict):
                continue
            res_name = clean_text(it.get("res") or "")
            source = str(it.get("url") or "").strip()
            if not source:
                continue
            if source.startswith("http"):
                names.append(res_name or "默认")
                urls.append(source)
            elif "wrap_md5_id" in str(it.get("parse") or "") or source.startswith("new-"):
                for nm, u in self._resolve_wrap(source):
                    names.append(clean_text((res_name + " " + nm).strip()))
                    urls.append(u)

        if not urls:
            return {"parse": 0, "jx": 0, "url": ""}
        if len(urls) == 1:
            return {"parse": 0, "jx": 0, "url": urls[0]}
        mixed = []
        for i in range(len(urls)):
            mixed.append(names[i] or ("线路%d" % (i + 1)))
            mixed.append(urls[i])
        return {"parse": 0, "jx": 0, "url": mixed}
