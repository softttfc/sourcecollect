#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
爱盼.py —— 单站免扫线路（站点：爱盼，类型：aipan）

本文件完全自包含，只抓「爱盼」这一个站；不需要其他 pan_*.py。
放进 TVBox 的 py/ 目录，线路配置：

{
  "key": "爱盼",
  "name": "爱盼",
  "type": 3,
  "api": "./py/爱盼.py",
  "searchable": 1,
  "quickSearch": 1,
  "filterable": 0,
  "changeable": 1,
  "ext": {
    "uc_cookie": "",
    "quark_cookie": "",
    "accel": "1",
    "accel_thread": "96"
  }
}

详情页里的 UC / 夸克 / 123 分享会走免登直链播放；
百度/迅雷/天翼/阿里/移动等需要登录转存的网盘不会出线路。
首页/分类数据：站点有可用 JSON API 时优先走 API，取不到或分类对不上自动回退网页；
播放层始终走网盘官方匿名接口，和列表用 API 还是网页无关。
"""

import json
import os
import re
import sys
import hashlib
import threading
import queue as _queue
import time
from urllib.parse import quote, unquote, urlencode
from concurrent.futures import ThreadPoolExecutor, wait, as_completed

import requests
try:
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except Exception:
    HTTPAdapter = None
    Retry = None

sys.path.append('..')
try:
    from base.spider import Spider
except ImportError:
    class Spider(object):
        def init(self, extend=""):
            pass

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

MOBILE_UA = ("Mozilla/5.0 (Linux; Android 11; M2007J3SC Build/RKQ1.200826.002; wv) "
             "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/77.0.3865.120 "
             "MQQBrowser/6.2 TBS/045714 Mobile Safari/537.36")
PC_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
         "uc-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 "
         "Safari/537.36 Channel/pckk_other_ch")
TV_UA = ("Mozilla/5.0 (Linux; U; Android 12; zh-cn; V2238A Build/V417IR) "
         "AppleWebKit/533.1 (KHTML, like Gecko) Mobile Safari/533.1")
DART_UA = "Dart/2.19(dart:io)"

VIDEO_EXT = ('.mp4', '.mkv', '.ts', '.iso', '.rmvb', '.avi', '.mov', '.mpeg', '.mpg',
             '.wmv', '.3gp', '.asf', '.m4v', '.flv', '.vob', '.strm', '.tp', '.f4v',
             '.webm', '.m2ts', '.ogv')

# ---------------------------------------------------------------------------
# 网盘链接正则（详情页通用提取）
# ---------------------------------------------------------------------------
PAN_RES = [
    ("UC",   re.compile(r"https?://drive\.uc\.cn/s/[0-9a-zA-Z]+(?:\?pwd=\w+)?")),
    ("夸克",  re.compile(r"https?://pan\.quark\.cn/s/[0-9a-zA-Z]+(?:\?pwd=\w+)?")),
    ("百度",  re.compile(r"https?://pan\.baidu\.com/s/[0-9a-zA-Z_\-]+(?:\?pwd=\w+)?")),
    ("123",  re.compile(r"https?://(?:www\.)?(?:123pan|123684|123865|123912|123592)\.(?:com|cn)/s/[\w\-]+(?:\?[^\"'<>\s]*)?")),
    ("迅雷",  re.compile(r"https?://pan\.xunlei\.com/s/[\w\-]+")),
    ("天翼",  re.compile(r"https?://cloud\.189\.cn/(?:t/|web/share\?code=)[\w]+")),
    ("阿里",  re.compile(r"https?://(?:www\.)?(?:aliyundrive|alipan)\.com/s/[\w]+")),
    ("移动",  re.compile(r"https?://caiyun\.139\.com/[\w/]+")),
]


SITE = {'id': '爱盼', 'name': '爱盼', 'type': 'aipan', 'site': ['https://www.aipan.me']}

def make_session(ua=MOBILE_UA):
    s = requests.Session()
    s.headers.update({"User-Agent": ua})
    if HTTPAdapter is not None and Retry is not None:
        try:
            retry = Retry(total=1, backoff_factor=0.2, status_forcelist=[429, 500, 502, 503])
            adapter = HTTPAdapter(max_retries=retry, pool_connections=8, pool_maxsize=32)
            s.mount("https://", adapter)
            s.mount("http://", adapter)
        except Exception:
            pass
    return s


def _ensure_url(site):
    """懒探测镜像：首次用到该站时才 HEAD 探测（3s 超时），加载期零网络"""
    if site.get("_url_ok"):
        return
    ok = False
    for u in site["site"]:
        try:
            site["session"].head(u, timeout=1.5, allow_redirects=True)
            site["url"] = u
            ok = True
            break
        except Exception:
            continue
    site["_url_ok"] = True
    if not ok:
        # 全部镜像都连不上：熔断 5 分钟，之后每次加载/搜索直接跳过不再白等
        site["_dead_until"] = time.time() + 300


def http_get(session, url, timeout=8, headers=None, binary=False):
    r = session.get(url, timeout=timeout, headers=headers or {})
    r.encoding = 'utf-8'
    return r.content if binary else r.text


def _abs(base, href):
    if not href:
        return ""
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return base + href
    if href.startswith("http"):
        return href
    return base + "/" + href


PLAY2DETAIL_RE = re.compile(r"/(?:index\.php/)?vod/play/id/(\d+)[^\"']*")


def _to_detail_url(url):
    """苹果CMS 播放页链接 → 详情页链接"""
    m = PLAY2DETAIL_RE.search(url or "")
    if not m:
        return url
    base = url.split("/index.php")[0].split("/vod/")[0]
    return f"{base}/index.php/vod/detail/id/{m.group(1)}.html"


def _extract_pans(text):
    """从任意 HTML/JSON 文本里提取网盘链接 → {pan名: [url,...]}"""
    found = {}
    for name, rx in PAN_RES:
        for m in rx.finditer(text or ""):
            u = m.group(0).rstrip("\\\"'.,;)")
            if u not in found.setdefault(name, []):
                found[name].append(u)
    return found


# ---------------------------------------------------------------------------
# UC 网盘解析（共用一份，来自原 网盘搜索.py）
# ---------------------------------------------------------------------------
class UCDrive:
    PC_API = "https://pc-api.uc.cn/1/clouddrive"
    OPEN_API = "https://open-api-drive.uc.cn"
    SHARE_RE = re.compile(r"https?://drive\.uc\.cn/s/([0-9a-zA-Z]+)(?:\?pwd=(\w+))?")

    def __init__(self, cookie=""):
        self.cookie = cookie
        self._stoken_cache = {}
        self._machine_code = None

    # ---------- 公共 ----------
    def _headers_common(self):
        return {"Referer": "https://drive.uc.cn", "Cookie": self.cookie or "", "User-Agent": PC_UA}

    def _headers_anon(self):
        return {"User-Agent": PC_UA, "Accept-Encoding": "identity", "Referer": "https://drive.uc.cn"}

    def _post_json(self, url, body, headers=None, timeout=20):
        hdrs = {"User-Agent": PC_UA, "Content-Type": "application/json; charset=utf-8"}
        if headers:
            hdrs.update(headers)
        resp = requests.post(url, json=body, headers=hdrs, timeout=timeout)
        resp.encoding = "utf-8"
        return resp.text

    def share_token(self, pwd_id, passcode=""):
        url = f"{self.PC_API}/share/sharepage/token?__t={int(time.time() * 1000)}"
        body = {"pwd_id": pwd_id, "passcode": passcode or ""}
        text = self._post_json(url, body, self._headers_common())
        data = json.loads(text)
        stoken = (data.get("data") or {}).get("stoken", "")
        if stoken:
            self._stoken_cache[pwd_id] = stoken
        return data, stoken

    def _get_stoken(self, pwd_id, passcode=""):
        if pwd_id in self._stoken_cache:
            return self._stoken_cache[pwd_id]
        _, stoken = self.share_token(pwd_id, passcode)
        return stoken

    def list_videos(self, share_url, passcode="", limit=0):
        """返回 [{'fid','file_name','size','share_fid_token','pwd_id','stoken'}]
        limit>0 时找到 limit 个视频即停（验证场景免整树遍历）"""
        m = self.SHARE_RE.search(share_url or "")
        if not m:
            return []
        pwd_id, url_pwd = m.group(1), m.group(2)
        pc = passcode or url_pwd or ""
        try:
            stoken = self._get_stoken(pwd_id, pc)
        except Exception:
            return []
        if not stoken:
            return []
        out = []
        self._walk(pwd_id, stoken, "0", out, depth=0, limit=limit)
        return out

    def _walk(self, pwd_id, stoken, pdir_fid, out, depth, limit=0):
        if depth > 12 or (limit and len(out) >= limit):
            return
        page = 1
        while True:
            url = (f"{self.PC_API}/share/sharepage/detail?pr=UCBrowser&fr=pc"
                   f"&pwd_id={pwd_id}&stoken={quote(stoken)}&pdir_fid={pdir_fid}"
                   f"&force=0&_page={page}&_size=50&_sort=file_type:asc,file_name:asc")
            r = requests.get(url, headers=self._headers_common(), timeout=10)
            r.encoding = "utf-8"
            data = r.json()
            items = (data.get("data") or {}).get("list") or []
            if not items:
                break
            for it in items:
                if it.get("dir"):
                    self._walk(pwd_id, stoken, it.get("fid", "0"), out, depth + 1, limit)
                elif it.get("file") and it.get("category") in (1, 2):
                    out.append({"fid": it.get("fid", ""),
                                "file_name": it.get("file_name", "未命名"),
                                "size": it.get("size", 0),
                                "share_fid_token": it.get("share_fid_token", ""),
                                "pwd_id": pwd_id, "stoken": stoken})
                if limit and len(out) >= limit:
                    return
            if len(items) < 50:
                break
            page += 1

    # ---------- 播放链 1：匿名直链（无限） ----------
    def download_url_anon(self, pwd_id, fid, fid_token):
        """就是 jar 的 ff()：匿名免登拿 download_url，失败返回空串"""
        try:
            stoken = self._get_stoken(pwd_id) or ""
        except Exception:
            stoken = ""
        body = {"fids": [fid], "fids_token": [fid_token], "pwd_id": pwd_id,
                "stoken": stoken, "speedup_session": ""}
        url = f"{self.PC_API}/file/download?pr=UCBrowser&fr=pc"
        text = self._post_json(url, body, self._headers_anon())
        data = json.loads(text)
        arr = data.get("data") or []
        if not arr:
            return ""
        return arr[0].get("download_url", "") or ""

    def play_anonymous(self, pwd_id, fid, fid_token):
        """jar 的 q() 无限分支：裸直链 + f() 头，关键是 Referer = download_url + '\\'（CDN 回调鉴权认它）"""
        dl = self.download_url_anon(pwd_id, fid, fid_token)
        if not dl:
            return {"parse": 0, "url": "", "header": self._headers_anon()}
        return {"parse": 0, "url": dl,
                "header": {"User-Agent": PC_UA, "Accept-Encoding": "identity", "Referer": dl + "\\"}}

    def stream_alive(self, dl, timeout=6):
        """探测 CDN 直链是否真能流出字节（Range 0-0 头探测，与播放同请求头）。
        脚本就跑在播放设备上：这里连不上/被拒，播放器一样缓冲死 → 判不可播"""
        if not dl:
            return False
        try:
            r = requests.get(dl, headers={"User-Agent": PC_UA, "Accept-Encoding": "identity",
                                          "Referer": dl + "\\", "Range": "bytes=0-0"},
                             stream=True, timeout=timeout)
            ok = r.status_code in (200, 206)
            r.close()
            return ok
        except Exception:
            return False


# ---------------------------------------------------------------------------
# 夸克网盘解析（免登直链）
#
# 与 UC 完全对称的一套机制：分享未过期 → 匿名展开出视频 → 匿名直链可取 → CDN 头探测可连
# ★ 关键突破：游客下载 50MiB 限制只挂在 pr=ucpro 这一条通道上，
#   同一个 file/download 端点换成 pr=pc（mobile/web 同理）就放行，
#   20GB 的大文件照样出直链（官网自己的 JS 遇到 23018 也只是弹"下载文件过大"）。
# ★ 夸克 CDN 认的是【会话 cookie】（服务端在匿名流程 token→detail→download 里陆续下发
#   __sdid / __pugs），所以这里全程用一个常驻 Session 串起来，播放时把 cookie 一起给播放器。
#   （UC 那边靠 Referer=直链+"\\" 过 CDN 鉴权，夸克这边靠 cookie，两边机制不同。）
# ---------------------------------------------------------------------------
class QuarkDrive:
    PC_API = "https://drive-pc.quark.cn/1/clouddrive"
    SHARE_RE = re.compile(r"https?://pan\.quark\.cn/s/([0-9a-zA-Z]+)(?:\?pwd=(\w+))?")
    # 免登直链用 pr=pc（ucpro 会被按游客限制卡 50MiB）
    DL_PR = "pc"

    def __init__(self, cookie=""):
        self.cookie = cookie
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": PC_UA})
        self._stoken_cache = {}

    # ---------- 公共 ----------
    def _headers(self):
        h = {"Referer": "https://pan.quark.cn", "User-Agent": PC_UA}
        if self.cookie:
            h["Cookie"] = self.cookie
        return h

    def cookie_header(self):
        """当前会话里的 cookie（CDN 拉流必须带）——兼容 CookieJar 与 dict 两种形态"""
        parts = []
        ck = getattr(self.session, "cookies", None)
        try:
            if isinstance(ck, dict):
                parts += ["%s=%s" % (k, v) for k, v in ck.items()]
            else:
                for c in ck:
                    parts.append("%s=%s" % (c.name, c.value))
        except Exception:
            pass
        if self.cookie:
            parts.append(self.cookie)
        return "; ".join(parts)

    def _post_json(self, url, body, headers=None, timeout=20):
        hdrs = {"User-Agent": PC_UA, "Content-Type": "application/json; charset=utf-8"}
        if headers:
            hdrs.update(headers)
        resp = self.session.post(url, json=body, headers=hdrs, timeout=timeout)
        resp.encoding = "utf-8"
        return resp.text

    # ---------- 匿名：分享 token / 列目录 ----------
    def share_token(self, pwd_id, passcode=""):
        url = f"{self.PC_API}/share/sharepage/token?__t={int(time.time() * 1000)}"
        body = {"pwd_id": pwd_id, "passcode": passcode or ""}
        try:
            text = self._post_json(url, body, self._headers())
            data = json.loads(text)
        except Exception:
            return {}, ""
        stoken = (data.get("data") or {}).get("stoken", "")
        if stoken:
            self._stoken_cache[pwd_id] = stoken
        return data, stoken

    def _get_stoken(self, pwd_id, passcode=""):
        if pwd_id in self._stoken_cache:
            return self._stoken_cache[pwd_id]
        _, stoken = self.share_token(pwd_id, passcode)
        return stoken

    def list_videos(self, share_url, passcode="", limit=0):
        """免登列出分享里的视频：[{'fid','file_name','size','share_fid_token','pwd_id','stoken'}]"""
        m = self.SHARE_RE.search(share_url or "")
        if not m:
            return []
        pwd_id, url_pwd = m.group(1), m.group(2)
        pc = passcode or url_pwd or ""
        try:
            stoken = self._get_stoken(pwd_id, pc)
        except Exception:
            return []
        if not stoken:
            return []
        out = []
        self._walk(pwd_id, stoken, "0", out, depth=0, limit=limit)
        return out

    def _walk(self, pwd_id, stoken, pdir_fid, out, depth, limit=0):
        if depth > 12 or (limit and len(out) >= limit):
            return
        page = 1
        while True:
            url = (f"{self.PC_API}/share/sharepage/detail?pr=ucpro&fr=pc"
                   f"&pwd_id={pwd_id}&stoken={quote(stoken)}&pdir_fid={pdir_fid}"
                   f"&force=0&_page={page}&_size=50&_sort=file_type:asc,file_name:asc")
            try:
                r = self.session.get(url, headers=self._headers(), timeout=10)
                r.encoding = "utf-8"
                data = r.json()
            except Exception:
                break
            items = (data.get("data") or {}).get("list") or []
            if not items:
                break
            for it in items:
                if it.get("dir"):
                    self._walk(pwd_id, stoken, it.get("fid", "0"), out, depth + 1, limit)
                elif it.get("file") and it.get("category") in (1, 2):
                    out.append({"fid": it.get("fid", ""),
                                "file_name": it.get("file_name", "未命名"),
                                "size": it.get("size", 0),
                                "share_fid_token": it.get("share_fid_token", ""),
                                "pwd_id": pwd_id, "stoken": stoken})
                if limit and len(out) >= limit:
                    return
            if len(items) < 50:
                break
            page += 1

    # ---------- 播放链：匿名直链（免登） ----------
    def _warm_session(self, pwd_id, stoken):
        """匿名会话要 __sdid + __pugs 两个 cookie 才认 file/download；
        没列过目录时先列一次把会话跑热（否则 download 返回空）"""
        names = set()
        ck = getattr(self.session, "cookies", None)
        try:
            if isinstance(ck, dict):
                names = set(ck.keys())
            else:
                names = {c.name for c in ck}
        except Exception:
            pass
        if "__pugs" in names:
            return
        try:
            self._walk(pwd_id, stoken, "0", [], depth=0, limit=1)
        except Exception:
            pass

    def download_info(self, pwd_id, fid, fid_token):
        """匿名免登拿直链信息：{"url","size","name"}（pr=pc 绕开 50MiB 游客限制）"""
        try:
            stoken = self._get_stoken(pwd_id) or ""
        except Exception:
            stoken = ""
        self._warm_session(pwd_id, stoken)
        body = {"fids": [fid], "fids_token": [fid_token], "pwd_id": pwd_id, "stoken": stoken}
        url = f"{self.PC_API}/file/download?pr={self.DL_PR}&fr=pc"
        try:
            text = self._post_json(url, body, self._headers())
            data = json.loads(text)
        except Exception:
            return {}
        arr = data.get("data") or []
        if not arr:
            return {}
        it = arr[0]
        return {"url": it.get("download_url", "") or "",
                "size": int(it.get("size") or 0),
                "name": it.get("file_name", "")}

    def download_url_anon(self, pwd_id, fid, fid_token):
        """匿名免登拿 download_url（pr=pc 绕开 50MiB 游客限制）"""
        return self.download_info(pwd_id, fid, fid_token).get("url", "") or ""

    def play_anonymous(self, pwd_id, fid, fid_token):
        """裸直链 + 会话 cookie（夸克 CDN 认 cookie；不带会被 412）"""
        dl = self.download_url_anon(pwd_id, fid, fid_token)
        if not dl:
            return {"parse": 0, "url": "", "header": self._headers()}
        h = {"User-Agent": PC_UA, "Accept-Encoding": "identity", "Referer": "https://pan.quark.cn"}
        ck = self.cookie_header()
        if ck:
            h["Cookie"] = ck
        return {"parse": 0, "url": dl, "header": h}

    def stream_alive(self, dl, timeout=6):
        """探测 CDN 直链是否真能流出字节（Range 0-0 头探测，与播放同请求头）"""
        if not dl:
            return False
        h = {"User-Agent": PC_UA, "Accept-Encoding": "identity",
             "Referer": "https://pan.quark.cn", "Range": "bytes=0-0"}
        ck = self.cookie_header()
        if ck:
            h["Cookie"] = ck
        try:
            try:
                r = self.session.get(dl, headers=h, stream=True, timeout=timeout)
            except TypeError:
                # 环境不支持 stream 参数时退回普通 GET（只看状态码）
                r = self.session.get(dl, headers=h, timeout=timeout)
            ok = r.status_code in (200, 206)
            try:
                r.close()
            except Exception:
                pass
            return ok
        except Exception:
            return False


# ---------------------------------------------------------------------------
# 本地并发流代理（夸克/UC 游客直链"单连接限速"的正解）
#
# ★ 实测：游客直链单连接恒定 ~0.10MB/s（换 UA / 换 host / 加 Range 都一样），
#   64 路并发 ≈ 5.4MB/s，128 路 ≈ 10MB/s，160 路 ≈ 12.7MB/s（触顶）。
# ★ 传输层用标准库 http.client 而不是 requests：同样 48 路拉 24MB，
#   requests 要 16.3s CPU、http.client 只要 0.3s，吞吐高 1.8 倍（盒子上差距更大）。
# ★ 播放器访问 http://127.0.0.1:<port>/s/<sid>；前 16MB 用 64KB 块保证起播快，
#   中段 128KB、64MB 后 256KB 降请求开销；play 之后后台预热 4MB，
#   已下块留在内存（每路 24MB），回拖/小 seek 不重下。
# ★ 上游支持 PNG 伪装头（shift）、会话失效 refresh、probe 自检。
# ---------------------------------------------------------------------------
import http.client as _lsp_http
import ssl as _lsp_ssl
from urllib.parse import urlsplit as _lsp_urlsplit

_LSP_TL = threading.local()


class LocalStreamProxy:
    _inst = None
    _tls_ctx = None
    _tls_lock = threading.Lock()

    @classmethod
    def instance(cls):
        if cls._inst is None:
            cls._inst = cls()
        return cls._inst

    def __init__(self):
        self._srv = None
        self._port = 0
        self._items = {}
        self._seq = 0
        self._lock = threading.Lock()
        self.thread = 128          # 播放窗口并发连接数
        self.block = 256 << 10     # 稳态块大小
        self.preload = 4 << 20     # 起播预热字节数（0 = 关）
        self.cache_max = 24 << 20  # 每路内存缓存
        self._pool = ThreadPoolExecutor(max_workers=192)
        self._warm_pool = ThreadPoolExecutor(max_workers=16)

    # ---------- 服务端 ----------
    def _ensure_server(self):
        if self._srv is not None:
            return True
        try:
            import http.server as _hs
            import socketserver as _ss
            outer = self

            class _Handler(_hs.BaseHTTPRequestHandler):
                protocol_version = "HTTP/1.1"
                timeout = 30

                def log_message(self, *a):
                    pass

                def do_HEAD(self):
                    self.do_GET()

                def do_GET(self):
                    outer._handle(self)

            class _Server(_ss.ThreadingMixIn, _hs.HTTPServer):
                daemon_threads = True
                allow_reuse_address = True

                def handle_error(self, request, client_address):
                    pass          # 播放器掐断连接是常态，别刷日志

            self._srv = _Server(("127.0.0.1", 0), _Handler)
            self._port = self._srv.server_address[1]
            threading.Thread(target=self._srv.serve_forever,
                             kwargs={"poll_interval": 0.3}, daemon=True).start()
            return True
        except Exception:
            self._srv = None
            return False

    def base_url(self):
        return "http://127.0.0.1:%d" % self._port

    def register(self, url, headers=None, size=0, refresh=None):
        """refresh：可选回调 () -> (new_url, new_headers)；匿名会话 cookie 会过期（CDN 412），
        拉块失败时靠它换一条新直链续命"""
        if not url or not self._ensure_server():
            return ""
        it = {"url": url, "headers": dict(headers or {}), "size": int(size or 0),
              "refresh": refresh, "cache": {}, "corder": [], "csize": 0, "busy": {}}
        with self._lock:
            self._seq += 1
            sid = "%08x" % ((self._seq * 2654435761) & 0xFFFFFFFF)
            self._items[sid] = it
            if len(self._items) > 96:      # 只保留最近的，防长时间运行内存涨
                for k in list(self._items.keys())[:48]:
                    self._items.pop(k, None)
        self._start_warm(it)
        return sid

    # ---------- 连接（线程内复用，keep-alive） ----------
    @staticmethod
    def _tls():
        if LocalStreamProxy._tls_ctx is None:
            with LocalStreamProxy._tls_lock:
                if LocalStreamProxy._tls_ctx is None:
                    try:
                        LocalStreamProxy._tls_ctx = _lsp_ssl._create_unverified_context()
                    except Exception:
                        ctx = _lsp_ssl.create_default_context()
                        ctx.check_hostname = False
                        ctx.verify_mode = _lsp_ssl.CERT_NONE
                        LocalStreamProxy._tls_ctx = ctx
        return LocalStreamProxy._tls_ctx

    @staticmethod
    def _split(url):
        u = _lsp_urlsplit(url)
        scheme = (u.scheme or "https").lower()
        host = u.hostname or ""
        port = u.port or (443 if scheme == "https" else 80)
        path = u.path or "/"
        if u.query:
            path += "?" + u.query
        return scheme, host, port, path

    def _conn(self, url):
        scheme, host, port, _p = self._split(url)
        key = (scheme, host, port)
        c = getattr(_LSP_TL, "c", None)
        if c is not None and getattr(_LSP_TL, "k", None) == key:
            return c
        if c is not None:
            try:
                c.close()
            except Exception:
                pass
        if scheme == "https":
            c = _lsp_http.HTTPSConnection(host, port, timeout=30, context=self._tls())
        else:
            c = _lsp_http.HTTPConnection(host, port, timeout=30)
        _LSP_TL.c = c
        _LSP_TL.k = key
        return c

    @staticmethod
    def _drop():
        c = getattr(_LSP_TL, "c", None)
        if c is not None:
            try:
                c.close()
            except Exception:
                pass
        _LSP_TL.c = None
        _LSP_TL.k = None

    # ---------- 上游 ----------
    def _maybe_refresh(self, it):
        """直链/cookie 失效时调用 refresh 回调换新的。并发拉块线程共用一把锁：
        一个线程刷新期间其余线程等它刷完直接用新链，避免上百个线程同时回源刷新"""
        if not it.get("refresh"):
            return False
        lock = it.setdefault("_rlock", threading.Lock())
        with lock:
            if time.time() - it.get("_refreshed_at", 0) < 15:   # 刚刷新过（或别的线程刚试过）
                return bool(it.get("url"))
            it["_refreshed_at"] = time.time()
            try:
                url, headers = it["refresh"]() or ("", {})
                if url:
                    it["url"] = url
                    it["headers"] = dict(headers or {})
                    return True
            except Exception:
                pass
            return False

    def _fetch_block(self, it, start, end):
        """用【长连接】按 Range 拉一块。必须恰好取满 want 字节：短读/断流直接写出去会让
        后续块全部错位损坏；多写会超过响应 Content-Length、污染 keep-alive 上的下一个响应。
        ★ 403/410/412 = 匿名会话 cookie 过期：先刷新直链再试，别把错误页当数据写出去"""
        sh = int(it.get("shift") or 0)      # PNG 伪装头：上游取流整体右移 sh 字节
        want = end - start + 1
        if want <= 0:
            return b""
        for attempt in range(3):
            url = it.get("url") or ""
            if not url:
                return b""
            h = dict(it.get("headers") or {})
            h["Range"] = "bytes=%d-%d" % (start + sh, end + sh)
            h["Accept-Encoding"] = "identity"
            h.setdefault("User-Agent", "Mozilla/5.0")
            try:
                _scheme, _host, _port, path = self._split(url)
                c = self._conn(url)
                c.request("GET", path, headers=h)
                r = c.getresponse()
                if r.status not in (200, 206):
                    try:
                        r.read(8192)
                    except Exception:
                        pass
                    self._drop()
                    if self._maybe_refresh(it):
                        continue
                    return b""
                buf, got = [], 0
                while got < want:
                    d = r.read(min(131072, want - got))
                    if not d:
                        break
                    buf.append(d)
                    got += len(d)
                if got >= want:
                    return b"".join(buf)[:want]
                self._drop()          # 短读，连接已脏
            except Exception:
                self._drop()
                if attempt < 2 and self._maybe_refresh(it):
                    continue
        return b""

    def _total_size(self, it):
        """上游总长：从 Range: bytes=sh-sh 的 Content-Range 里取（含伪装头）"""
        if it.get("size"):
            return it["size"]
        lock = it.setdefault("_slock", threading.Lock())
        with lock:
            if it.get("size"):
                return it["size"]
            sh = int(it.get("shift") or 0)
            url = it.get("url") or ""
            try:
                h = dict(it.get("headers") or {})
                h["Range"] = "bytes=%d-%d" % (sh, sh)
                h["Accept-Encoding"] = "identity"
                h.setdefault("User-Agent", "Mozilla/5.0")
                _scheme, _host, _port, path = self._split(url)
                c = self._conn(url)
                c.request("GET", path, headers=h)
                r = c.getresponse()
                m = re.search(r"/(\d+)\s*$", r.getheader("Content-Range") or "")
                if m:
                    it["size"] = int(m.group(1))
                ct = r.getheader("Content-Type")
                if ct:
                    it["ctype"] = ct
                try:
                    r.read(4096)
                except Exception:
                    pass
                self._drop()
            except Exception:
                self._drop()
        return it.get("size") or 0

    @staticmethod
    def _parse_range(hdr, total):
        start, end = 0, (total - 1 if total else 0)
        if hdr:
            m = re.search(r"bytes=(\d*)-(\d*)", hdr)
            if m:
                s, e = m.group(1), m.group(2)
                if s == "" and e:
                    n = int(e)
                    start = max(0, total - n)
                    end = total - 1
                else:
                    start = int(s or 0)
                    end = int(e) if e else (total - 1 if total else start)
        if total and end >= total:
            end = total - 1
        if end < start:
            end = start
        return start, end

    def _sniff(self, it):
        """拉文件头 512 字节嗅探【真实】格式，结果缓存进 item。
        ★ 分享文件扩展名完全不可信（实测一个 29 集分享里同时存在：
          .mkv→MP4、.mp4/.mp3→MKV，以及 PNG 伪装头+MP4 和 PNG 伪装头+MKV 两种防和谐文件）；
          伪装头不剥掉，播放器按错位字节解封装，51 分钟的视频只显示 15 秒。
        产出 it["shift"]（上游取流右移字节数）和 it["ctype"]（真实 Content-Type）"""
        lock = it.setdefault("_slock", threading.Lock())
        with lock:
            if "_sniffed" in it:
                return
            it["_sniffed"] = True
            head = b""
            try:
                head = self._fetch_range(it, 0, 511) or b""
            except Exception:
                pass
            it["shift"], it["ctype"] = self._sniff_head(head, it.get("url") or "")

    @staticmethod
    def _sniff_head(head, url):
        """在文件头前 48 字节内定位真实容器签名（伪装头会顶掉 offset 0），
        返回 (shift, ctype)：shift = 伪装头长度；靠前出现的签名优先"""
        shift, ctype = 0, ""
        if head:
            i = head.find(b"\x1a\x45\xdf\xa3", 0, 48)          # EBML → MKV
            j = head.find(b"ftyp", 0, 48)                     # MP4 box 类型（前 4 字节是 box size）
            if j >= 4 and not (8 <= int.from_bytes(head[j - 4:j], "big") <= 64):
                j = -1                                        # 伪 ftyp（box size 不合理）
            if i >= 0 and (j < 4 or i <= j - 4):
                shift, ctype = i, "video/x-matroska"
            elif j >= 4:
                shift = j - 4
                ctype = "video/quicktime" if head[j + 4:j + 6] == b"qt" else "video/mp4"
            elif head[:3] == b"FLV":
                ctype = "video/x-flv"
            elif len(head) >= 377 and head[0] == 0x47 and head[188] == 0x47 and head[376] == 0x47:
                ctype = "video/mp2t"
            elif head[:3] == b"ID3" or head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
                ctype = "audio/mpeg"
        if not ctype:
            ctype = LocalStreamProxy._ext_mime(url)
        return shift, ctype

    @staticmethod
    def _ext_mime(url):
        """扩展名兜底（仅在 magic 嗅不出来时用）"""
        ext = os.path.splitext((url or "").split("?")[0].lower())[1]
        return {".mp4": "video/mp4", ".mkv": "video/x-matroska", ".flv": "video/x-flv",
                ".ts": "video/mp2t", ".m3u8": "application/vnd.apple.mpegurl",
                ".avi": "video/x-msvideo", ".mov": "video/quicktime"}.get(ext, "video/mp4")

    def _fetch_range(self, it, start, end):
        """单连接拉一段（探测用）"""
        return self._fetch_block(it, start, end)

    # ---------- 分块 / 缓存 / 预取 ----------
    def _chunk(self, off):
        """前 16MB 用小块（起播快、首屏不等人），中段 128KB，64MB 后 256KB"""
        if off < (16 << 20):
            return 64 << 10
        if off < (64 << 20):
            return 128 << 10
        return max(65536, int(self.block or (256 << 10)))

    def _cache_put(self, it, p, d):
        cache = it.get("cache")
        if cache is None or p in cache:
            return
        cache[p] = d
        it["csize"] = it.get("csize", 0) + len(d)
        order = it.setdefault("corder", [])
        order.append(p)
        cap = max(4 << 20, int(self.cache_max or (24 << 20)))
        while it["csize"] > cap and order:
            k = order.pop(0)
            old = cache.pop(k, None)
            if old is not None:
                it["csize"] -= len(old)

    def _queue_block(self, it, p, b, pool=None):
        """提交一块到线程池并登记在途请求，供播放窗口与预热共享（不重复下载）"""
        hit = it.get("cache", {}).get(p)
        if hit is not None and len(hit) == b - p + 1:
            return None
        busy = it.setdefault("busy", {})
        cur = busy.get(p)
        if cur is not None and cur[0] == b:
            return cur[1]
        f = (pool or self._pool).submit(self._fetch_block, it, p, b)
        busy[p] = (b, f)

        def _done(ff, p=p, b=b):
            try:
                d = ff.result()
            except Exception:
                d = b""
            if d and len(d) == b - p + 1:
                self._cache_put(it, p, d)
            cur2 = busy.get(p)
            if cur2 is not None and cur2[1] is ff:
                busy.pop(p, None)

        f.add_done_callback(_done)
        return f

    def _start_warm(self, it):
        """play 之后在后台把片头拉进缓存：播放器连上时基本是现成的"""
        if it.get("warm") or self.preload <= 0:
            return
        it["warm"] = True

        def run():
            try:
                self._sniff(it)
                total = self._total_size(it) - int(it.get("shift") or 0)
                if total <= 0:
                    return
                top = min(total, self.preload)
                jobs, p = [], 0
                while p < top:
                    b = min(top - 1, p + self._chunk(p) - 1)
                    jobs.append((p, b))
                    p = b + 1
                for a, b in jobs:
                    self._queue_block(it, a, b, pool=self._warm_pool)
            except Exception:
                pass

        try:
            threading.Thread(target=run, daemon=True).start()
        except Exception:
            pass

    # ---------- 传输 ----------
    def _pump(self, it, handler, start, end):
        """把 [start,end] 按阶梯切块，W 路并发拉、按块序写出 ⇒ 聚合带宽 ≈ W × 0.1MB/s。
        ★ 不能用"先取完第 1 段再取第 2 段"，那样只有一条连接在干活；
          窗口 + 有序写才能把并发真正叠起来（实测 128 路 ≈ 10MB/s）。"""
        total = end - start + 1
        if total <= 0:
            return True
        wfile = handler.wfile
        bounds, pos = [], start
        while pos <= end:
            b = min(end, pos + self._chunk(pos - start) - 1)
            bounds.append((pos, b))
            pos = b + 1
        n = len(bounds)
        W = max(1, int(self.thread or 128))
        look = min(n, W * 2)
        cache = it.setdefault("cache", {})
        pending = {}
        idx = 0

        def push(i):
            p, b = bounds[i]
            hit = cache.get(p)
            if hit is not None and len(hit) == b - p + 1:
                pending[p] = hit
                return
            pending[p] = self._queue_block(it, p, b)

        while idx < look:
            push(idx)
            idx += 1

        ok = True
        for k in range(n):
            p, b = bounds[k]
            v = pending.pop(p, None)
            if v is None:
                hit = cache.get(p)
                if hit is not None and len(hit) == b - p + 1:
                    v = hit
                else:
                    v = self._queue_block(it, p, b) or self._pool.submit(self._fetch_block, it, p, b)
            if isinstance(v, bytes):
                d = v
            else:
                try:
                    d = v.result(timeout=90)
                except Exception:
                    d = b""
            if not d:
                ok = False
                break
            try:
                wfile.write(d)
                wfile.flush()
            except Exception:
                ok = False
                break
            while idx < n and len(pending) < look:
                push(idx)
                idx += 1
        return ok

    @staticmethod
    def _empty(handler, code):
        try:
            handler.send_response(code)
            handler.send_header("Content-Length", "0")
            handler.end_headers()
        except Exception:
            pass

    # ---------- 请求处理 ----------
    def _handle(self, handler):
        try:
            path = handler.path.split("?")[0].strip("/")
            parts = path.split("/")
            if len(parts) != 2 or parts[0] not in ("s", "probe"):
                self._empty(handler, 404)
                return
            mode, sid = parts
            with self._lock:
                it = self._items.get(sid)
            if not it:
                self._empty(handler, 404)
                return
            if mode == "probe":      # 连通性自检（只拉 256B，验证上游+代理都通；大了白等起播）
                body = self._fetch_range(it, 0, 255)
                handler.send_response(200 if body else 502)
                handler.send_header("Content-Type", "application/octet-stream")
                handler.send_header("Content-Length", str(len(body)))
                handler.end_headers()
                if body:
                    handler.wfile.write(body)
                return
            self._sniff(it)      # 真实格式 + PNG 伪装头偏移（扩展名不可信）
            total = self._total_size(it) - int(it.get("shift") or 0)
            if total <= 0:
                self._empty(handler, 502)
                return
            raw = handler.headers.get("Range") or ""
            first = re.search(r"bytes=(\d+)", raw)
            if first and total and int(first.group(1)) >= total:
                handler.send_response(416)
                handler.send_header("Content-Range", "bytes */%d" % total)
                handler.send_header("Content-Length", "0")
                handler.end_headers()
                return
            start, end = self._parse_range(raw, total)
            length = end - start + 1
            has_range = bool(handler.headers.get("Range"))
            handler.send_response(206 if has_range else 200)
            handler.send_header("Content-Type", it.get("ctype") or self._ext_mime(it.get("url") or ""))
            handler.send_header("Accept-Ranges", "bytes")
            handler.send_header("Content-Length", str(length))
            if has_range:
                handler.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, total))
            handler.end_headers()
            if handler.command == "HEAD":
                return
            if not self._pump(it, handler, start, end):
                handler.close_connection = True
        except Exception:
            try:
                handler.send_response(500)
                handler.send_header("Content-Length", "0")
                handler.end_headers()
            except Exception:
                pass

# ---------------------------------------------------------------------------
# 123 云盘解析（免登直链，来自 jar merge/b/m.java 移植）
# ---------------------------------------------------------------------------
class Pan123:
    SHARE_RE = re.compile(r"https?://(?:www\.)?(?:123pan|123684|123865|123912|123592)\.(?:com|cn)/s/([\w\-]+)")

    def _headers(self):
        return {"referer": "https://www.123pan.com", "origin": "https://www.123pan.com",
                "platform": "open_platform", "user-agent": DART_UA, "app-version": "3"}

    def _parse(self, share_url):
        m = self.SHARE_RE.search(share_url or "")
        if not m:
            return "", ""
        key = m.group(1)
        if key.endswith(".html"):
            key = key[:-5]
        pwd = ""
        pm = re.search(r"[?&](?:pwd|SharePwd)=(\w+)", share_url or "")
        if pm:
            pwd = pm.group(1)
        return key, pwd

    def list_videos(self, share_url):
        """递归拿分享内视频：返回 [{'file_id','file_name','size','etag','s3key','download_url'}]"""
        key, pwd = self._parse(share_url)
        if not key:
            return []
        out = []
        self._walk(key, pwd, 0, out, depth=0)
        return out

    def _walk(self, key, pwd, parent_id, out, depth):
        if depth > 12:
            return
        page = 1
        while True:
            url = (f"https://www.123pan.cn/b/api/share/get?limit=100&Page={page}&next=-1"
                   f"&orderBy=file_name&orderDirection=asc&parentFileId={parent_id}"
                   f"&shareKey={key}&SharePwd={pwd}")
            r = requests.get(url, headers=self._headers(), timeout=15)
            r.encoding = "utf-8"
            try:
                data = r.json()
            except Exception:
                break
            items = ((data.get("data") or {}).get("InfoList")) or []
            if not items:
                break
            for it in items:
                cat = it.get("Category", -1)
                name = it.get("FileName", "")
                if cat == 2 or name.lower().endswith(VIDEO_EXT):
                    out.append({"file_id": it.get("FileId", ""),
                                "file_name": name or "未命名",
                                "size": it.get("Size", 0),
                                "etag": it.get("Etag", ""),
                                "s3key": it.get("S3KeyFlag", ""),
                                "download_url": it.get("DownloadUrl", "")})
                elif it.get("Type") == 1 or it.get("Type") == 0 and not it.get("DownloadUrl"):
                    self._walk(key, pwd, it.get("FileId", 0), out, depth + 1)
            if len(items) < 100:
                break
            page += 1

    @staticmethod
    def play_direct(download_url):
        u = (download_url or "").replace("_24_24", "")
        u = u.replace("&cache_type=1&w=24&h=24&trade_key=123pan-thumbnail&type=video", "")
        return {"parse": 0, "url": u,
                "header": {"referer": "https://www.123pan.com", "origin": "https://www.123pan.com",
                           "platform": "android", "user-agent": DART_UA, "app-version": "3"}}


# ----- 爱盼（aipan API） -----
def aipan_search(site, key, pg):
    data = json.loads(http_get(site["session"], f"{site['url']}/api/movies/search?q={quote(key)}"))
    return [{"vod_id": f"ap:{m.get('id')}",
             "vod_name": m.get("title", ""),
             "vod_pic": m.get("cover", ""),
             "vod_remarks": m.get("subtitle", "") or str(m.get("rate", ""))}
            for m in (data.get("movies") or [])]


def aipan_category(site, tid, pg, extend):
    genre = (extend or {}).get("genre") or (extend or {}).get("cateId") or ""
    url = f"{site['url']}/api/movies/list?page={pg}&pageSize=30"
    if genre:
        url += "&genre=" + quote(genre)
    data = json.loads(http_get(site["session"], url))
    items = data.get("movies") or (data.get("data") or {}).get("movies") or []
    return [{"vod_id": f"ap:{m.get('id')}",
             "vod_name": m.get("title", ""),
             "vod_pic": m.get("cover", ""),
             "vod_remarks": str(m.get("rate", ""))}
            for m in items]


def aipan_detail(site, real_id):
    rid = real_id.split(":", 1)[-1]
    data = json.loads(http_get(site["session"], f"{site['url']}/api/movies/detail/{rid}"))
    pans = {}
    for pl in (data.get("panLinks") or []):
        u = pl.get("url") or pl.get("link") or ""
        if u:
            for name, rx in PAN_RES:
                if rx.search(u):
                    pans.setdefault(name, [])
                    if u not in pans[name]:
                        pans[name].append(u)
    if not pans:
        pans = _extract_pans(json.dumps(data, ensure_ascii=False))
    return pans, data.get("synopsis", "")


AIPAN_GENRES = ["动作", "喜剧", "爱情", "科幻", "悬疑", "剧情", "动画", "冒险", "犯罪", "恐怖"]


# ---------------------------------------------------------------------------
# 单站 Spider
# ---------------------------------------------------------------------------
class Spider(Spider):
    def __init__(self):
        self.site = None
        self.uc = None
        self.quark = None
        self.pan123 = None
        self.proxy = None
        self.accel_on = True
        self.fast_filter = True
        self._play_cache = {}
        self._slow_cache = {}
        self._link_cache = {}
        self._proxy_ok_at = 0

    def getDependence(self):
        return []

    def init(self, extend=""):
        try:
            ext = json.loads(extend) if isinstance(extend, str) and extend else (extend or {})
        except Exception:
            ext = {}
        site = dict(SITE)
        site["session"] = make_session()
        site["url"] = site["site"][0]
        ck = ext.get(SITE["id"] + "cookie", "")
        if SITE["type"] == "bbs" and ck:
            site["extra_headers"] = {"Cookie": ck}
        self.site = site
        self.uc = UCDrive(ext.get("uc_cookie", "") or ext.get("cookie", ""))
        self.quark = QuarkDrive(ext.get("quark_cookie", "") or ext.get("cookie", ""))
        self.pan123 = Pan123()
        self.proxy = LocalStreamProxy.instance()
        self.accel_on = str(ext.get("accel", "1")).strip().lower() not in ("0", "false", "no", "off")
        try:
            self.proxy.thread = max(1, min(128, int(ext.get("accel_thread", "96") or 96)))
        except Exception:
            self.proxy.thread = 96
        self.fast_filter = str(ext.get("fast", "1")) == "1"
        self._play_cache = {}
        self._slow_cache = {}
        self._link_cache = {}
        self._proxy_ok_at = 0

    def getName(self):
        return SITE["name"]

    def homeContent(self, filter):
        classes = [{"type_id": g, "type_name": g} for g in AIPAN_GENRES]
        res = {"class": classes}
        if filter:
            pass
        return res

    def homeVideoContent(self):
        return {"list": []}

    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg or 1)
        _ensure_url(self.site)
        ext = dict(extend or {})
        if str(tid) != str(SITE["id"]) and not ext.get("cateId"):
            ext["cateId"] = tid
        try:
            vods = aipan_category(self.site, tid, pg, ext)
        except Exception:
            vods = []
        
        for v in vods:
            v["vod_id"] = SITE["id"] + "@" + str(v["vod_id"])
        return {"list": vods, "page": pg, "pagecount": 999, "limit": 90, "total": 999999}

    def searchContent(self, key, quick, pg="1"):
        pg = int(pg or 1)
        _ensure_url(self.site)
        try:
            vods = aipan_search(self.site, key, pg)
        except Exception:
            vods = []
        for v in vods:
            v["vod_id"] = SITE["id"] + "@" + str(v["vod_id"])
        return {"list": vods}

    def detailContent(self, array):
        if not array:
            return {"list": []}
        vod_id = array[0]
        if "@" not in vod_id:
            pans = {}
            for name, rx in PAN_RES:
                if rx.search(vod_id):
                    pans[name] = [vod_id]
            if not pans:
                return {"list": [{"vod_id": vod_id, "vod_name": vod_id, "vod_pic": "",
                                  "vod_play_from": "直连$$$嗅探$$$解析",
                                  "vod_play_url": "播放$%s$$$播放$%s$$$播放$%s" % (vod_id, vod_id, vod_id)}]}
            return {"list": [self._build_vod(vod_id, vod_id, "", "", pans)]}
        sid, real_id = vod_id.split("@", 1)
        _ensure_url(self.site)
        try:
            pans, content = aipan_detail(self.site, real_id)
            title, pic = "", ""
            if not pans:
                return {"list": [{"vod_id": vod_id, "vod_name": title or SITE["id"],
                                  "vod_play_from": "提示",
                                  "vod_play_url": "未找到网盘链接$none"}]}
            return {"list": [self._build_vod(vod_id, title, pic, content, pans)]}
        except Exception:
            return {"list": []}

    def _vod_pan_links(self, real_id):
        ent = self._link_cache.get(real_id)
        if ent and time.time() - ent[1] < 1800:
            return ent[0]
        try:
            pans, _ = aipan_detail(self.site, real_id)
            links = {"UC": pans.get("UC") or [], "夸克": pans.get("夸克") or []}
        except Exception:
            links = {"UC": [], "夸克": []}
        self._link_cache[real_id] = (links, time.time())
        return links

    def _uc_playable(self, url):
        """强检测：分享未过期 + 能匿名展开出视频 + 匿名直链可取 + CDN 头探测可连。
        可播缓存 6h；不可播只缓存 10 分钟（防网络抖动误杀后长期消失）"""
        ent = self._play_cache.get(url)
        if ent and time.time() - ent[1] < (ent[2] if len(ent) > 2 else 6 * 3600):
            return ent[0]
        ok = False
        try:
            items = self.uc.list_videos(url, limit=1)
            if items:
                it = items[0]
                dl = self.uc.download_url_anon(it["pwd_id"], it["fid"], it["share_fid_token"])
                ok = bool(dl) and self.uc.stream_alive(dl)
        except Exception:
            ok = False
        self._play_cache[url] = (ok, time.time(), 6 * 3600 if ok else 600)
        return ok

    def _quark_playable(self, url):
        """夸克强检测（与 UC 完全对称）：分享未过期 + 匿名展开出视频 + 匿名直链可取 + CDN 头探测可连。
        可播缓存 6h；不可播只缓存 10 分钟（防网络抖动误杀后长期消失）"""
        ent = self._play_cache.get(url)
        if ent and time.time() - ent[1] < (ent[2] if len(ent) > 2 else 6 * 3600):
            return ent[0]
        ok = False
        try:
            items = self.quark.list_videos(url, limit=1)
            if items:
                it = items[0]
                dl = self.quark.download_url_anon(it["pwd_id"], it["fid"], it["share_fid_token"])
                # 不再多跑一次 CDN 头探测：播放时代理有 412 自愈刷新兜底，这里省 ~0.5-1s/候选
                ok = bool(dl)
        except Exception:
            ok = False
        self._play_cache[url] = (ok, time.time(), 6 * 3600 if ok else 600)
        return ok

    def _playable(self, url, kind):
        """按网盘类型走对应的强检测"""
        return self._quark_playable(url) if kind == "夸克" else self._uc_playable(url)


    def _verify_pan(self, vods, check_play=True, kinds=("UC",)):
        """只留带（UC/夸克）免登链接的条目；check_play 时进一步验证分享未过期能播"""
        def work(v):
            all_links = self._vod_pan_links(v["vod_id"])
            links = []
            for k in kinds:
                links += all_links.get(k) or []
            if not links:
                return False
            if not check_play:
                return True
            for k in kinds:
                for u in (all_links.get(k) or [])[:2]:
                    if self._playable(u, k):
                        return True
            return False
        with ThreadPoolExecutor(max_workers=16) as ex:
            keep = list(ex.map(work, vods))
        return [v for v, k in zip(vods, keep) if k]


    def isVideoFormat(self, url):
        return url.lower().endswith(VIDEO_EXT)

    def manualVideoCheck(self):
        return False

    def localProxy(self, params):
        return []


    # ---------- 选集显示名：跟随剧名 + 集数 + 清晰度 + 文件大小 ----------
    @staticmethod
    def _fmt_size(sz):
        try:
            sz = int(sz or 0)
        except Exception:
            sz = 0
        if sz >= 1073741824:
            return f"{sz / 1073741824:.1f}G"
        if sz > 0:
            return f"{sz / 1048576:.0f}M"
        return ""

    _EP_NUM_RES = [
        re.compile(r"[Ss]\d{1,2}[Ee](\d{1,3})"),      # S01E06
        re.compile(r"\b[Ee][Pp]?(\d{1,3})\b"),        # E06 / EP06
        re.compile(r"第\s*(\d{1,3})\s*[集期话回]"),     # 第6集
        re.compile(r"^(\d{1,3})[ ._\-]"),             # 01 4K / 06.xxx
        re.compile(r"\[(\d{1,3})\]"),                 # [06]
    ]

    def _ep_suffix(self, fname, size=0, name=""):
        """剧集显示名后缀：清晰度 + 体积（" 1080p · 1.2G"）；名字里已有清晰度就不重复加"""
        base = re.sub(r"\.[a-zA-Z0-9]{2,4}$", "", fname or "").strip() or ""
        mq = re.search(r"4320p|2160p|1080p|720p|[48][Kk]", base)
        q = ""
        if mq:
            q = {"2160P": "4K", "4320P": "8K"}.get(mq.group(0).upper(), mq.group(0))
        sfx = (" " + q) if (q and q not in (name or "")) else ""
        sz = self._fmt_size(size)
        if sz:
            sfx += f" · {sz}"
        me = re.search(r"\.([a-zA-Z0-9]{2,4})$", (fname or "").strip())
        if me:
            sfx += f" · {me.group(1).upper()}"     # 文件格式上屏（MKV/MP4…）
        return sfx

    def _ep_display(self, title, fname, idx, size=0, num=None):
        """选集上屏名 = 网盘原名 + 文件体积 + 格式（如 "xxx 01 · 1.2G · MP4"）。
        ★ 按用户要求展示网盘原名，同时带上大小和格式；num 参数保留兼容调用方。"""
        raw = (fname or "").strip()
        m = re.search(r"\.(mp4|mkv|avi|ts|m2ts|flv|wmv|mov|rmvb|rm|webm|m4v|mpg|mpeg|iso|m3u8)$", raw, re.I)
        ext = m.group(1).upper() if m else ""
        base = raw[:m.start()] if m else raw
        sz = self._fmt_size(size)
        parts = [base or str(idx)]
        if sz:
            parts.append(sz)
        if ext:
            parts.append(ext)
        return " · ".join(parts)

    def _ep_num(self, fname, idx):
        """从文件名认集数；认不出按序号（统一"第NN集"）"""
        base = re.sub(r"\.[a-zA-Z0-9]{2,4}$", "", fname or "").strip() or ""
        for rx in self._EP_NUM_RES:
            m = rx.search(base)
            if m:
                return int(m.group(1))
        return idx

    def _build_vod(self, vod_id, title, pic, content, pans):
        uc_lines, quark_lines, p123_lines = [], [], []
        uc_ref = []          # 主 UC 线路的【集号】序列（夸克线路按它对齐显示）
        # UC 展开（全部链接，后面按集数排序，剧情更全的排最前）
        for link in pans.get("UC", []):
            try:
                items = self.uc.list_videos(link, limit=500)
            except Exception:
                items = []
            if items:
                eps = [f"{self._ep_display(title, it['file_name'], i + 1, it.get('size'))}$"
                       f"{it['file_name']}__{it['fid']}+{it['pwd_id']}+{it['share_fid_token']}"
                       for i, it in enumerate(items)]
                uc_lines.append((len(eps), "#".join(eps)))
                nums = [self._ep_num(it["file_name"], i + 1) for i, it in enumerate(items)]
                if len(nums) > len(uc_ref):
                    uc_ref = nums
        # 夸克展开（免登直链，与 UC 同构）
        # ★ 显示名跟 UC 主线路【逐集对齐】：集号用 UC 的（"第01集"这种），
        #   清晰度/体积用夸克自己文件的（两条线路在 App 里看起来一模一样，只差体积）
        for link in pans.get("夸克", []):
            try:
                items = self.quark.list_videos(link, limit=500)
            except Exception:
                items = []
            if items:
                eps = []
                for i, it in enumerate(items):
                    num = uc_ref[i] if i < len(uc_ref) else self._ep_num(it["file_name"], i + 1)
                    lb = self._ep_display(title, it["file_name"], i + 1, it.get("size"), num=num)
                    eps.append(f"{lb}$Q~{it['file_name']}__{it['fid']}+{it['pwd_id']}"
                               f"+{it['share_fid_token']}")
                quark_lines.append((len(eps), "#".join(eps)))
        # 123 展开（免登直链）
        for link in pans.get("123", []):
            try:
                items = self.pan123.list_videos(link)
            except Exception:
                items = []
            if items:
                eps = []
                for i, it in enumerate(items):
                    pid = (f"{it['file_name']}__{it['file_id']}+{it['etag']}+{it['s3key']}"
                           f"+{it['size']}+{quote(it['download_url'], safe='')}")
                    eps.append(f"{self._ep_display(title, it['file_name'], i + 1, it.get('size'))}${pid}")
                p123_lines.append((len(eps), "#".join(eps)))
        play_from, play_url = [], []
        # 集数多的线路排前面（剧情更全），线路名带集数
        for i, (cnt, urls) in enumerate(sorted(uc_lines, key=lambda x: -x[0])):
            play_from.append(f"UC无限{cnt}集#{i + 1}")
            play_url.append(urls)
        for i, (cnt, urls) in enumerate(sorted(quark_lines, key=lambda x: -x[0])):
            play_from.append(f"夸克无限{cnt}集#{i + 1}")
            play_url.append(urls)
        for i, (cnt, urls) in enumerate(sorted(p123_lines, key=lambda x: -x[0])):
            play_from.append(f"123云盘{cnt}集#{i + 1}")
            play_url.append(urls)
        # 百度/迅雷/天翼/阿里/移动 均需登录转存，不支持免登直链，直接不出线路
        if not play_from:
            play_from, play_url = ["提示"], ["UC/夸克/123分享已失效（或仅有百度等需登录网盘），请返回换一条$none"]
        return {"vod_id": vod_id, "vod_name": title, "vod_pic": pic, "vod_content": content,
                "vod_play_from": "$$$".join(play_from), "vod_play_url": "$$$".join(play_url)}

    # ---------- 播放：夸克（直链 + 单连接限速加速） ----------
    def _slow_link(self, url, headers, probe=98304, budget=0.35):
        """探这条直链是不是被限速：96KB 用时 > 0.35s 即视为慢（游客直链约 1s）
        ★ 判定结果缓存 30 分钟：否则 CDN 缓存命中会让第二次探测变快、误判成"不慢"，
          于是播放器又拿到裸直链（还是 0.1MB/s），等于加速时有时无。"""
        ent = self._slow_cache.get(url)
        if ent and time.time() - ent[1] < 1800:
            return ent[0]
        slow = True   # 默认按"慢"处理：探测失败/异常状态时走代理更稳，裸直链 0.1MB/s 必卡死
        try:
            h = dict(headers)
            h["Range"] = "bytes=0-%d" % (probe - 1)
            t0 = time.time()
            r = requests.get(url, headers=h, stream=True, timeout=(6, 10))
            if r.status_code not in (200, 206):
                # 403/412 等错误页会瞬间"下载"完；不判状态码会被误当成快链，把坏裸链给播放器
                try:
                    r.close()
                except Exception:
                    pass
            else:
                got = 0
                for c in r.iter_content(32768):
                    if not c:
                        continue
                    got += len(c)
                    if got >= probe:
                        break
                try:
                    r.close()
                except Exception:
                    pass
                slow = got > 0 and (time.time() - t0) > budget
        except Exception:
            pass
        self._slow_cache[url] = (slow, time.time())
        return slow

    def _proxy_alive(self, sid, timeout=5):
        """本地代理自检：走一遍 /probe/<sid>，不通就不把代理地址给播放器。
        代理是本机无状态服务，自检通过后 5 分钟内直接信任——否则每换一集都白等一次回源探测"""
        if time.time() - getattr(self, "_proxy_ok_at", 0) < 300:
            return True
        try:
            url = "%s/probe/%s" % (self.proxy.base_url(), sid)
            s = requests.Session()
            s.trust_env = False          # 别走系统代理
            r = s.get(url, timeout=timeout, stream=True)
            ok = r.status_code == 200
            try:
                r.close()
            except Exception:
                pass
            if ok:
                self._proxy_ok_at = time.time()
            return ok
        except Exception:
            return False

    def _uc_fresh_link(self, pwd_id, fid, fid_token=""):
        """拿一条当前匿名会话有效的 UC 直链 + 请求头 => (url, headers)。
        fid_token 与匿名会话绑定，失效时重新列一次分享换新的"""
        rst = {}
        try:
            rst = self.uc.play_anonymous(pwd_id, fid, fid_token) or {}
        except Exception:
            rst = {}
        url = rst.get("url") or ""
        if not url:
            try:
                for it in self.uc.list_videos("https://drive.uc.cn/s/%s" % pwd_id, limit=300):
                    if it.get("fid") == fid:
                        rst = self.uc.play_anonymous(pwd_id, fid, it.get("share_fid_token") or "") or {}
                        break
            except Exception:
                rst = {}
            url = rst.get("url") or ""
        return url, (rst.get("header") or {})

    def _uc_play(self, pwd_id, fid, fid_token=""):
        """UC 免登播放：裸直链同样被限在 ~0.1MB/s，慢就改走本地并发代理。
        ★ 匿名会话会过期（CDN 412），给代理挂刷新回调自动换新直链续播"""
        url, headers = self._uc_fresh_link(pwd_id, fid, fid_token)
        if not url:
            return {"parse": 0, "url": "", "header": self._headers()}
        direct = {"parse": 0, "url": url, "header": headers}
        if not self.accel_on:
            return direct
        try:
            if self.uc.cookie and not self._slow_link(url, headers):
                return direct              # 本来就快，别多绕一层
            refresh = lambda: self._uc_fresh_link(pwd_id, fid)
            sid = self.proxy.register(url, headers, 0, refresh=refresh)
            if not sid:
                return direct
            if not self._proxy_alive(sid):
                return direct
            return {"parse": 0, "url": "%s/s/%s" % (self.proxy.base_url(), sid),
                    "header": {"User-Agent": PC_UA}}
        except Exception:
            return direct

    def _quark_fresh_link(self, pwd_id, fid, fid_token=None):
        """拿一条【当前匿名会话有效】的夸克直链 + 对应请求头 => (url, headers, size)。
        不给 fid_token（或已失效）时自动重列分享换新 token——实测分享 token 与匿名会话绑定，
        会话轮换后旧 token 必 403(41020)，重列是唯一可靠的刷新方式"""
        info = self.quark.download_info(pwd_id, fid, fid_token) if fid_token else {}
        if not info:
            try:
                for it in self.quark.list_videos("https://pan.quark.cn/s/%s" % pwd_id, limit=300):
                    if it.get("fid") == fid:
                        info = self.quark.download_info(pwd_id, fid, it["share_fid_token"])
                        break
            except Exception:
                pass
        dl = (info or {}).get("url") or ""
        if not dl:
            return "", {}, 0
        h = {"User-Agent": PC_UA, "Accept-Encoding": "identity",
             "Referer": "https://pan.quark.cn"}
        ck = self.quark.cookie_header()
        if ck:
            h["Cookie"] = ck
        return dl, h, int((info or {}).get("size") or 0)

    def _quark_play(self, pwd_id, fid, fid_token):
        """夸克免登播放：拿直链 → 判是否被限速 → 慢则改走本地并发代理（多连接叠加限速）
        ★ 夸克游客直链实测单连接恒定 0.10MB/s，12 连接 ≈ 1.2MB/s（对齐 jar 的 thread/chunksize 方案）
        ★ share_fid_token 与匿名会话绑定：会话换了/过期了会 403(41020)，
           这里自动重新列一次分享拿新的 token 再试
        ★ 任何异常或代理自检不过都回退裸直链，保证至少能播"""
        dl, headers, size = self._quark_fresh_link(pwd_id, fid, fid_token)
        if not dl:
            return {"parse": 0, "msg": "夸克直链获取失败，请重试或换集"}
        direct = {"parse": 0, "url": dl, "header": headers}
        if not self.accel_on:
            return direct
        try:
            # 游客直链实测恒定 0.10MB/s：无 cookie 时不必每集再探（省 ~1s），直接走并发代理；
            # 配了 quark_cookie（会员）链接快慢不一，才需要探测决定走不走代理
            if self.quark.cookie and not self._slow_link(dl, headers):
                return direct              # 本来就快，别多绕一层
            # ★ 匿名会话 cookie 会过期（CDN 412）：给代理挂刷新回调，
            #   拉块 403/412 时自动重列分享换新直链+新 cookie 续播（否则播放器永远 1Kb/s 转圈）
            refresh = lambda: self._quark_fresh_link(pwd_id, fid)[:2]
            sid = self.proxy.register(dl, headers, size, refresh=refresh)
            if not sid:
                return direct
            if not self._proxy_alive(sid):
                return direct
            return {"parse": 0, "url": "%s/s/%s" % (self.proxy.base_url(), sid),
                    "header": {"User-Agent": PC_UA}}
        except Exception:
            return direct

    # ---------- 播放：UC 三级回退 + 123 直链 ----------
    def playerContent(self, flag, play_id, vipFlags):
        # 推送直链的三条线路（对齐 jar Push 站）
        if flag == "直连":
            return {"parse": 0, "url": play_id}
        if flag == "嗅探":
            return {"parse": 1, "url": play_id}
        if flag == "解析":
            return {"parse": 2, "jx": 1, "url": play_id}
        if play_id.startswith("http"):
            # 推送的裸分享链接：UC/123 自己展开直接播，其余提示需登录
            if re.search(r"https?://drive\.uc\.cn/s/", play_id):
                try:
                    items = self.uc.list_videos(play_id)
                except Exception:
                    items = []
                if items:
                    it = items[0]
                    return self._uc_play(it["pwd_id"], it["fid"], it["share_fid_token"])
                return {"parse": 0, "msg": "UC分享解析失败，请重试"}
            if re.search(r"https?://pan\.quark\.cn/s/", play_id):
                try:
                    items = self.quark.list_videos(play_id)
                except Exception:
                    items = []
                if items:
                    it = items[0]
                    return self._quark_play(it["pwd_id"], it["fid"], it["share_fid_token"])
                return {"parse": 0, "msg": "夸克分享解析失败，请重试"}
            if Pan123.SHARE_RE.search(play_id):
                try:
                    items = self.pan123.list_videos(play_id)
                    if items and items[0].get("download_url"):
                        return self.pan123.play_direct(items[0]["download_url"])
                except Exception:
                    pass
                return {"parse": 0, "msg": "123分享解析失败，请重试"}
            return {"parse": 0, "msg": "该网盘需登录，暂不支持免登播放"}
        if play_id.endswith(".htm") or "分享$" in flag + play_id or play_id == "none":
            return {"parse": 0, "msg": "该分享解析失败或为需登录网盘，请重试或换线路"}
        if play_id.startswith("Q~"):
            # 夸克免登：Q~name__fid+pwd_id+fid_token（与 UC 同构，仅前缀区分）
            try:
                rest = play_id[2:]
                head, pwd_id, fid_token = rest.rsplit("+", 2)
                fid = head.split("__", 1)[-1] if "__" in head else head
                rst = self._quark_play(pwd_id, fid, fid_token)
                if rst.get("url"):
                    return rst
                return {"parse": 0, "msg": "夸克无限线路获取失败，请重试或换集"}
            except Exception as e:
                return {"parse": 0, "msg": f"夸克解析失败: {e}"}
        parts = play_id.rsplit("+", 4)
        try:
            if len(parts) == 5:  # 123 云盘：name__fileId+etag+s3key+size+download_url
                dl = unquote(parts[4])
                rst = self.pan123.play_direct(dl)
                if rst.get("url"):
                    return rst
                return {"parse": 0, "msg": "123直链获取失败"}
            if len(parts) >= 3:  # UC：name__fid+pwd_id+fid_token —— 无限免登裸直链（同 jar 的 q() 无限分支）
                head, pwd_id, fid_token = parts[0], parts[1], parts[2]
                fid = head.split("__", 1)[-1] if "__" in head else head
                rst = self._uc_play(pwd_id, fid, fid_token)
                if rst.get("url"):
                    return rst
                return {"parse": 0, "msg": "UC无限线路获取失败，请重试或换集"}
        except Exception as e:
            return {"parse": 0, "msg": f"解析失败: {e}"}
        return {"parse": 0, "msg": "无法识别的播放地址"}

