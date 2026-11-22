# coding: utf-8
"""
MiNO（秒播4K）—— TVBox / FongMi Python 站源

"""

import base64
import hashlib
import hmac
import json
import secrets
import ssl
import struct
import threading
import time
from urllib.parse import quote
from urllib.request import Request, urlopen

try:
    import requests
except Exception:
    requests = None

from base.spider import Spider as BaseSpider

UA = "okhttp/4.12.0"
APP_VERSION = "1.0.13"
VERSION_CODE = "13"
DEVICE_RISK = "5"
APP_VERIFY_SIGN = "9D3F7BAD0E160DD63437A1D3267AE87C426700E376D505809E1055BBA42C15E9"
DEFAULT_HOST = "http://43.248.128.122:578"

# ---------------- P-256 ----------------
_P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff
_A = _P - 3
_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
_GX = 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296
_GY = 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5


def _add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2 and (y1 + y2) % _P == 0:
        return None
    if p1 == p2:
        lam = (3 * x1 * x1 + _A) * pow(2 * y1, _P - 2, _P) % _P
    else:
        lam = (y2 - y1) * pow(x2 - x1, _P - 2, _P) % _P
    x3 = (lam * lam - x1 - x2) % _P
    return x3, (lam * (x1 - x3) - y1) % _P


def _mul(k, pt):
    r = None
    while k:
        if k & 1:
            r = _add(r, pt)
        pt = _add(pt, pt)
        k >>= 1
    return r


def _ec_keypair():
    d = secrets.randbelow(_N - 1) + 1
    x, y = _mul(d, (_GX, _GY))
    return d, b"\x04" + x.to_bytes(32, "big") + y.to_bytes(32, "big")


def _ecdh(d, peer):
    x = int.from_bytes(peer[1:33], "big")
    y = int.from_bytes(peer[33:65], "big")
    sx, _ = _mul(d, (x, y))
    return sx.to_bytes(32, "big")


def _hkdf(ikm, salt, info, n=32):
    prk = hmac.new(salt, ikm, hashlib.sha256).digest()
    out, t, i = b"", b"", 1
    while len(out) < n:
        t = hmac.new(prk, t + info + bytes([i]), hashlib.sha256).digest()
        out += t
        i += 1
    return out[:n]


def _xt(a):
    return ((a << 1) ^ 0x1B) & 0xFF if a & 0x80 else a << 1


def _gmul(a, b):
    r = 0
    for _ in range(8):
        if b & 1:
            r ^= a
        b >>= 1
        a = _xt(a)
    return r


def _gen_sbox():
    exp = [0] * 512
    log = [0] * 256
    x = 1
    for i in range(255):
        exp[i] = x
        log[x] = i
        x ^= _xt(x)
    for i in range(255, 512):
        exp[i] = exp[i - 255]
    sbox = [0x63] * 256
    for i in range(1, 256):
        inv = exp[255 - log[i]]
        s = inv
        for sh in range(1, 5):
            s ^= ((inv << sh) | (inv >> (8 - sh))) & 0xFF
        sbox[i] = s ^ 0x63
    return sbox


_SBOX = _gen_sbox()
_M2 = [_gmul(i, 2) for i in range(256)]
_M3 = [_gmul(i, 3) for i in range(256)]
_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36, 0x6C, 0xD8, 0xAB]


def _aes_expand(key):
    nk = len(key) // 4
    nr = nk + 6
    w = [list(key[4 * i:4 * i + 4]) for i in range(nk)]
    for i in range(nk, 4 * (nr + 1)):
        t = list(w[i - 1])
        if i % nk == 0:
            t = [_SBOX[b] for b in t[1:] + t[:1]]
            t[0] ^= _RCON[i // nk - 1]
        elif nk > 6 and i % nk == 4:
            t = [_SBOX[b] for b in t]
        w.append([w[i - nk][j] ^ t[j] for j in range(4)])
    return w, nr


def _aes_block(sched, block):
    w, nr = sched
    st = list(block)
    for i in range(16):
        st[i] ^= w[i >> 2][i & 3]
    for rnd in range(1, nr + 1):
        for i in range(16):
            st[i] = _SBOX[st[i]]
        t = list(st)
        for r in range(1, 4):
            for c in range(4):
                st[4 * c + r] = t[4 * ((c + r) % 4) + r]
        if rnd != nr:
            for c in range(4):
                b = 4 * c
                a0, a1, a2, a3 = st[b], st[b + 1], st[b + 2], st[b + 3]
                st[b] = _M2[a0] ^ _M3[a1] ^ a2 ^ a3
                st[b + 1] = a0 ^ _M2[a1] ^ _M3[a2] ^ a3
                st[b + 2] = a0 ^ a1 ^ _M2[a2] ^ _M3[a3]
                st[b + 3] = _M3[a0] ^ a1 ^ a2 ^ _M2[a3]
        rk = 4 * rnd
        for i in range(16):
            st[i] ^= w[rk + (i >> 2)][i & 3]
    return bytes(st)


_R128 = 0xE1000000000000000000000000000000


def _gcm_reduce(v, n):
    for _ in range(n):
        v = (v >> 1) ^ _R128 if v & 1 else v >> 1
    return v


def _ghash(h, data):

    m = [0] * 16
    for j in range(1, 16):
        v = 0
        for k in range(4):
            if (j >> k) & 1:
                v ^= _gcm_reduce(h, 3 - k)
        m[j] = v
    f = [_gcm_reduce(j, 4) for j in range(16)]
    y = 0
    for i in range(0, len(data), 16):
        y ^= int.from_bytes(data[i:i + 16], "big")
        acc = 0
        for n in range(31, -1, -1):
            acc = m[(y >> (124 - 4 * n)) & 0xF] ^ (acc >> 4) ^ f[acc & 0xF]
        y = acc
    return y


def _aes_gcm_decrypt(sched, iv, blob):

    h = int.from_bytes(_aes_block(sched, b"\x00" * 16), "big")
    c, tag = blob[:-16], blob[-16:]
    j0 = iv + b"\x00\x00\x00\x01"
    ctr = int.from_bytes(j0, "big")
    out = bytearray()
    for i in range(0, len(c), 16):
        ctr = (ctr & ~0xFFFFFFFF) | ((ctr + 1) & 0xFFFFFFFF)
        ks = _aes_block(sched, ctr.to_bytes(16, "big"))
        out += bytes(a ^ b for a, b in zip(c[i:i + 16], ks))
    pad = c + b"\x00" * ((16 - len(c) % 16) % 16)
    s = _ghash(h, pad + struct.pack(">QQ", 0, len(c) * 8))
    calc = int.from_bytes(_aes_block(sched, j0), "big") ^ s
    if calc != int.from_bytes(tag, "big"):
        return None
    return bytes(out)



class Spider(BaseSpider):
    host = DEFAULT_HOST
    page_size = 20

    _dev = ""
    _sid = ""
    _sk = b""
    _bk = b""
    _sched = None
    _exp = 0.0
    _rotate = 1
    _fallback = 1
    _last_ok = {}
    _search_cache = {}
    _play_cache = {}
    _session = None
    _lock = threading.Lock()

    classes = [
        {"type_id": "1", "type_name": "电影"},
        {"type_id": "2", "type_name": "连续剧"},
        {"type_id": "3", "type_name": "综艺"},
        {"type_id": "4", "type_name": "动漫"},
        {"type_id": "20", "type_name": "短剧"},
        {"type_id": "21", "type_name": "少儿"},
        {"type_id": "22", "type_name": "漫剧"},
        {"type_id": "23", "type_name": "纪录片"},
    ]

    sort_list = [("", "默认"), ("hits", "最热"), ("score", "评分")]
    area_list = [("", "全部"), ("内地", "内地"), ("中国香港", "中国香港"), ("中国台湾", "中国台湾"),
                 ("美国", "美国"), ("韩国", "韩国"), ("日本", "日本"), ("英国", "英国"),
                 ("法国", "法国"), ("泰国", "泰国"), ("印度", "印度")]
    lang_list = [("", "全部"), ("国语", "国语"), ("英语", "英语"), ("日语", "日语"),
                 ("韩语", "韩语"), ("粤语", "粤语")]
    year_list = [("", "全部")] + [(str(y), str(y)) for y in range(2026, 2009, -1)]


    def getName(self):
        return "MiNO秒播4K"

    def getDependence(self):
        return []

    def setExtendInfo(self, extend):
        return None

    def isVideoFormat(self, url):
        u = (url or "").lower()
        return ".m3u8" in u or ".mp4" in u or ".flv" in u or "cmecloud" in u

    def manualVideoCheck(self):
        return False

    def localProxy(self, param):
        return None

    def init(self, extend=""):
        try:
            cfg = {}
            s_ext = extend
            if isinstance(s_ext, dict):
                cfg = s_ext
            elif isinstance(s_ext, str) and s_ext.strip().startswith("{"):
                cfg = json.loads(s_ext)
            base = str(cfg.get("base") or "").strip().rstrip("/")
            if base.startswith("http"):
                self.host = base
            dev = str(cfg.get("device_id") or "").strip()
            if dev:
                Spider._dev = dev
 
            if cfg.get("rotate_device") is not None:
                self._rotate = int(cfg.get("rotate_device") or 0)
            if cfg.get("auto_fallback") is not None:
                self._fallback = int(cfg.get("auto_fallback") or 0)
            self.page_size = max(5, int(cfg.get("page_size") or 20))
        except Exception:
            pass
        if not self._dev:
            Spider._dev = secrets.token_hex(16)

        for _ in range(2):
            try:
                if self._ensure():
                    break
            except Exception:
                pass
            time.sleep(0.5)


    @staticmethod
    def _http(url, method="GET", data=None, headers=None, timeout=20):

        if requests is not None:
            sess = Spider._session
            if sess is None:
                sess = Spider._session = requests.Session()
            try:
                r = sess.request(method, url, data=data, headers=headers, timeout=timeout)
            except requests.exceptions.SSLError:

                r = sess.request(method, url, data=data, headers=headers,
                                 timeout=timeout, verify=False)
            return r.content
        req = Request(url, data=data if method == "POST" else None, method=method)
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            ctx = ssl.create_default_context()
            with urlopen(req, timeout=timeout, context=ctx) as r:
                return r.read()
        except ssl.SSLError:

            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with urlopen(req, timeout=timeout, context=ctx) as r:
                return r.read()

    # ---------- 会话 ----------
    def _ensure(self):
        if self._sid and time.time() < self._exp:
            return True
        with self._lock:
            # double-check：等锁期间可能已有别的线程完成了握手
            if self._sid and time.time() < self._exp:
                return True
            if not self._dev:
                Spider._dev = secrets.token_hex(16)
            d, pub = _ec_keypair()
            body = json.dumps({
                "platform": "android",
                "version": APP_VERSION,
                "device_id": self._dev,
                "client_pub": base64.b64encode(pub).decode(),
                "device_brand": "Xiaomi",
                "device_manufacturer": "Xiaomi",
                "device_model": "MI 8",
                "sig_src": "java",
                "so_version": 13,
            }, separators=(",", ":")).encode("utf-8")
            raw = self._http(self.host + "/api/v1/security/init", "POST", body,
                             {"User-Agent": UA, "Content-Type": "application/json"})
            j = json.loads(raw.decode("utf-8", "ignore"))
            data = j.get("data") or {}
            sid = data.get("session_id") or ""
            pub_s = data.get("server_pub") or ""
            if not sid or not pub_s:
                return False
            peer = base64.b64decode(pub_s)
            if len(peer) != 65 or peer[0] != 4:
                return False
            secret = _ecdh(d, peer)
            Spider._sid = sid
            Spider._sk = _hkdf(secret, sid.encode(), b"bwv/apisec/ecdh-signkey/v1")
            Spider._bk = _hkdf(secret, sid.encode(), b"bwv/apisec/ecdh-bodykey/v1")
            Spider._sched = _aes_expand(Spider._bk)
            ttl = int(data.get("expires_in") or 600)
            Spider._exp = time.time() + max(60, ttl - 60)
            return True


    def _api(self, path, query="", method="GET", body=""):

        key = (method.upper(), path, query or "", body or "")
        cached = Spider._last_ok.get(key) or {}
        fb = int(getattr(self, "_fallback", 1) or 0)
        last = cached
        for attempt in (0, 1):
            if not (self._sid and time.time() < self._exp):
                try:
                    ok = self._ensure()
                except Exception:
                    ok = False
                if not ok:
                    return dict(cached) if (fb and cached) else {}
            ts = str(int(time.time()))
            nonce = secrets.token_hex(16)
            raw = (body or "").encode("utf-8")
            bhash = hashlib.sha256(raw).hexdigest()
            q = ""
            if query:
                parts = [p for p in query.split("&") if p]
                parts.sort(key=lambda s: s.split("=")[0])
                q = "&".join(parts)
            src = "\n".join([method.upper(), path, q, bhash, ts, nonce,
                             self._dev, self._sid, APP_VERSION])
            sign = hmac.new(self._sk, src.encode("utf-8"), hashlib.sha256).hexdigest()
            headers = {
                "User-Agent": UA,
                "X-Session-Id": self._sid,
                "X-Device-Id": self._dev,
                "X-Version-Code": VERSION_CODE,
                "X-Device-Risk": DEVICE_RISK,
                "app-os": "android",
                "app-api-verify-sign": APP_VERIFY_SIGN,
                "X-App-Version": APP_VERSION,
                "X-Timestamp": ts,
                "X-Nonce": nonce,
                "X-Sign": sign,
                "X-Body-Sha256": bhash,
            }
            if raw:
                headers["Content-Type"] = "application/json; charset=utf-8"
            url = self.host + path + (("?" + q) if q else "")
            try:
                txt = self._http(url, method, raw if raw else None, headers).decode("utf-8", "ignore")
                last = json.loads(txt)
                if not isinstance(last, dict):
                    last = {}
            except Exception:

                if attempt == 0:
                    Spider._exp = 0.0
                    continue
                return dict(cached) if (fb and cached) else (last or {})
            code = last.get("code")

            msg = str(last.get("msg") or "")
            if attempt == 0 and ("频繁" in msg or "rate" in msg.lower()):
                time.sleep(1.5)
                continue
            if code in (4600, 4601, 401) and attempt == 0:
                Spider._exp = 0.0
                continue
            if code == 4805 and attempt == 0:

                if int(getattr(self, "_rotate", 1) or 0):
                    Spider._dev = secrets.token_hex(16)
                Spider._exp = 0.0
                continue
            data = last.get("data")
            if isinstance(data, dict) and data.get("enc") == 1 and data.get("payload"):
                try:
                    blob = base64.b64decode(data["payload"])
                    plain = _aes_gcm_decrypt(self._sched, blob[:12], blob[12:])
                    if plain:
                        last["data"] = json.loads(plain.decode("utf-8", "ignore"))
                except Exception:
                    pass

            if last.get("code") in (0, 1) and isinstance(last.get("data"), (dict, list)):
                try:
                    Spider._last_ok[key] = dict(last)
                    while len(Spider._last_ok) > 128:
                        Spider._last_ok.pop(next(iter(Spider._last_ok)))
                except Exception:
                    pass
            return last
        return dict(cached) if (fb and cached) else (last or {})

    @staticmethod
    def _pic(u):
        u = (u or "").strip()
        if u.startswith("//"):
            u = "https:" + u
        return u

    def _vod(self, v):

        if not isinstance(v, dict):
            return None
        vid = str(v.get("vod_id") or "").strip()
        name = (v.get("vod_name") or "").strip()
        if not vid or not name:
            return None
        remarks = (v.get("vod_remarks") or "").strip()
        if not remarks:
            bits = [str(x) for x in (v.get("vod_year"), v.get("vod_area")) if x]
            remarks = "·".join(bits)
        if not remarks and v.get("vod_score"):
            remarks = "评分%s" % v.get("vod_score")
        return {
            "vod_id": vid,
            "vod_name": name,
            "vod_pic": self._pic(v.get("vod_pic")),
            "vod_remarks": remarks,
        }

    def _list(self, videos):
        out = []
        for v in videos or []:
            item = self._vod(v)
            if item:
                out.append(item)
        return out

    def homeContent(self, filter):
        filters = {}
        if filter:
            def opts(pairs):
                return [{"n": n, "v": v} for v, n in pairs]
            for c in self.classes:
                filters[c["type_id"]] = [
                    {"key": "sort", "name": "排序", "value": opts(self.sort_list)},
                    {"key": "area", "name": "地区", "value": opts(self.area_list)},
                    {"key": "year", "name": "年份", "value": opts(self.year_list)},
                    {"key": "lang", "name": "语言", "value": opts(self.lang_list)},
                ]
        return {"class": self.classes, "filters": filters}

    def homeVideoContent(self):
        try:
            j = self._api("/api/v1/category/videos", "page=1&page_size=%d&type_id=2" % self.page_size)
            return {"list": self._list(((j.get("data") or {}).get("videos")) or [])}
        except Exception:
            return {"list": []}

    def categoryContent(self, tid, pg, filter, extend):
        try:
            pg = max(1, int(pg or 1))
        except Exception:
            pg = 1
        query = "type_id=%s&page=%d&page_size=%d" % (quote(str(tid), safe=""), pg, self.page_size)
        if isinstance(extend, dict):
            for k in ("sort", "area", "year", "lang", "class"):
                v = extend.get(k)
                if v and str(v) != "全部":
                    query += "&%s=%s" % (k, quote(str(v), safe=""))
        try:
            j = self._api("/api/v1/category/videos", query)
            data = j.get("data") or {}
            videos = data.get("videos") or []
            pag = data.get("pagination") or {}
            total = int(pag.get("total") or 0)
            pages = int(pag.get("total_pages") or 0)
            if pages <= 0:
                pages = pg + 1 if videos else pg
            return {
                "list": self._list(videos),
                "page": pg,
                "pagecount": pages,
                "limit": self.page_size,
                "total": total,
            }
        except Exception:
            return {"list": [], "page": pg, "pagecount": pg, "limit": self.page_size, "total": 0}

    def detailContent(self, ids):
        try:
            vid = str(ids[0]).strip() if ids else ""
            if not vid:
                return {"list": []}
            j = self._api("/api/v1/video/detail", "id=" + quote(vid, safe=""))
            info = ((j.get("data") or {}).get("vod_info")) or {}
            if not info:
                return {"list": []}
            froms, urls = [], []
            for line in info.get("vod_url_with_player") or []:
                code = (line.get("code") or "").strip()
                name = (line.get("name") or "").strip() or code
                raw = (line.get("url") or "").strip()
                if not raw:
                    continue
                eps, seen = [], set()
                for seg in raw.split("#"):
                    seg = seg.strip()
                    if not seg or "$" not in seg:
                        continue
                    ep, token = seg.split("$", 1)
                    ep, token = ep.strip(), token.strip()
                    if not ep or not token or token in seen:
                        continue
                    seen.add(token)
                    eps.append("%s$%s|%s" % (ep.replace("$", " "), code, token))
                if eps:
                    froms.append(name.replace("$", " ").replace("#", " "))
                    urls.append("#".join(eps))
            if not froms:
                return {"list": []}
            year = str(info.get("vod_year") or "").strip()[:4]
            remarks = (info.get("vod_remarks") or "").strip()
            if not remarks and info.get("vod_score"):
                remarks = "评分%s" % info.get("vod_score")
            vod = {
                "vod_id": str(info.get("vod_id") or vid),
                "vod_name": (info.get("vod_name") or "").strip(),
                "vod_pic": self._pic(info.get("vod_pic")),
                "type_name": (info.get("vod_class") or info.get("type_name") or "").strip(),
                "vod_year": year,
                "vod_area": (info.get("vod_area") or "").strip(),
                "vod_actor": (info.get("vod_actor") or "").strip(),
                "vod_director": (info.get("vod_director") or "").strip(),
                "vod_remarks": remarks,
                "vod_content": (info.get("vod_content") or info.get("vod_blurb") or "").strip(),
                "vod_play_from": "$$$".join(froms),
                "vod_play_url": "$$$".join(urls),
            }
            return {"list": [vod]}
        except Exception:
            return {"list": []}

    def searchContent(self, key, quick, pg="1"):
        """
        搜索
        """
        try:
            page = max(1, int(pg or 1))
        except Exception:
            page = 1
        kw = str(key or "").strip()
        size = 10 if quick else 20
        try:
            ent = Spider._search_cache.get((kw, bool(quick), page))
            if ent and time.time() - ent[0] < 120:
                return dict(ent[1])
            j = self._api("/api/v1/search",
                          "page=%d&page_size=%d&wd=%s" % (page, size, quote(kw, safe="")))
            data = j.get("data") or {}
            if not data:

                raise RuntimeError("empty search response")
            hits = list(data.get("hits") or [])
            if kw:
                low = kw.lower()

                hits.sort(key=lambda h: 0 if isinstance(h, dict)
                          and low in str(h.get("vod_name") or "").lower() else 1)
            if quick:

                matched = [h for h in hits if isinstance(h, dict)
                           and kw.lower() in str(h.get("vod_name") or "").lower()]
                hits = matched if matched else hits[:size]
            if kw and not hits:

                raise RuntimeError("empty hits")
            res = {"list": self._list(hits), "page": page,
                   "limit": int(data.get("limit") or size),
                   "total": int(data.get("total") or len(hits))}
            pages = int(data.get("total_pages") or 0)
            if pages:
                res["pagecount"] = pages
            try:
                cache = Spider._search_cache
                cache[(kw, bool(quick), page)] = (time.time(), res)
                if len(cache) > 100:
                    now = time.time()
                    for ck in [k for k, v in cache.items() if now - v[0] > 300]:
                        cache.pop(ck, None)
                    while len(cache) > 100:
                        cache.pop(next(iter(cache)))
            except Exception:
                pass
            return res
        except Exception:

            cache = getattr(Spider, "_search_cache", {}) or {}
            ent = cache.get((kw, bool(quick), page))
            if not ent:
                same = [(ts, r) for (k, ts, r) in
                        ((k, v[0], v[1]) for k, v in cache.items())
                        if k[0] == kw]
                if same:
                    same.sort(key=lambda x: -x[0])
                    ent = (same[0][0], same[0][1])
            if ent and time.time() - ent[0] < 300:
                out = dict(ent[1])
                out["page"] = page
                return out
            return {"list": [], "page": page, "limit": size}

    # ---------- 播放 ----------
    def _ticket(self, token):
        try:
            body = json.dumps({"token": token}, separators=(",", ":"))
            j = self._api("/api/v1/vod/ticket", "", "POST", body)
            if str(j.get("code")) != "1":
                return ""
            return ((j.get("data") or {}).get("ticket")) or ""
        except Exception:
            return ""

    @staticmethod
    def _b64json(s):
        raw = s.replace("-", "+").replace("_", "/")
        raw += "=" * ((4 - len(raw) % 4) % 4)
        try:
            return json.loads(base64.b64decode(raw).decode("utf-8", "ignore"))
        except Exception:
            return {}

    def _resolve(self, ticket):

        data = (self._b64json(ticket.split(".")[0]) or {}).get("data") or {}
        url = (data.get("url") or "").strip()
        api = (data.get("parse_api") or "").strip()
        api = api.replace("\\u00026", "&").replace("\u0002", "").replace("\\u0002", "")
        if not url:
            return "", ""
        cands = []
        if api:
            if api.startswith("/"):
                api = self.host + api
            if "{md5}" in api:
                cands.append(api.replace("{md5}", hashlib.md5(url.encode()).hexdigest()))
                cands.append(api.replace("{md5}", quote(url, safe="")))
            else:
                cands.append(api + quote(url, safe=""))
        for target in cands:
            for _ in range(2):
                try:

                    txt = self._http(target, "GET", None,
                                     {"User-Agent": UA, "Referer": "https://www.google.com/"},
                                     timeout=10).decode("utf-8", "ignore").strip()
                except Exception:
                    continue
                if not txt:
                    continue
                if txt.startswith("{"):
                    try:
                        obj = json.loads(txt)
                        real = obj.get("url") or (obj.get("data") or {}).get("url") or ""
                        if isinstance(real, dict):
                            real = real.get("url") or ""
                        real = str(real).strip()
                        if real.startswith("http"):
                            return real, target
                    except Exception:
                        pass
                elif txt.startswith("http"):
                    return txt.split("\n")[0].strip(), target
        return "", cands[0] if cands else ""

    def playerContent(self, flag, id, vipFlags):
        pid = (id or "").strip()
        token = pid
        if "|" in pid:
            _, token = pid.split("|", 1)
            token = token.strip()
        if not token:
            return {"parse": 1, "url": "", "header": {"User-Agent": UA}}
        ent = Spider._play_cache.get(token)
        if ent and time.time() - ent[0] < 600 and str(ent[1]).startswith("http"):
            return {"parse": 0, "url": ent[1], "header": {"User-Agent": UA}}
        ticket = self._ticket(token)
        if ticket:
            real, fallback = self._resolve(ticket)
            if real.startswith("http"):
                try:
                    Spider._play_cache[token] = (time.time(), real, fallback)
                    while len(Spider._play_cache) > 200:
                        Spider._play_cache.pop(next(iter(Spider._play_cache)))
                except Exception:
                    pass
                return {"parse": 0, "url": real, "header": {"User-Agent": UA}}
            if fallback.startswith("http"):
                return {"parse": 1, "url": fallback, "header": {"User-Agent": UA}}

        return {"parse": 0, "url": "", "header": {"User-Agent": UA}}