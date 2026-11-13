# -*- coding: utf-8 -*-
"""
稀饭聚合 · TVBox / OK影视 四源聚合 Python 源
================================================================
首页数据 : 稀饭动漫 Next (xifanacg) —— 分类 / 推荐 / 筛选 / 搜索 / 条目元数据
播放线路 : 四源同时挂出，默认按下列优先级
           1. 稀饭动漫   xifanacg        tag=xf
           2. GiriGiri爱 girigirilove   tag=gg
           3. 次元城动画 cycani.org     tag=cy
           4. OmoFun     omofun.in      tag=om
           TVBox 默认取第一条线路播放，故此顺序即默认选线顺序。

线路名 : 「源·原线路名」；选集 id : "<tag>|<base64url(flag + US + 原始id)>"
         playerContent 按 tag 解码后派发回对应源，不依赖壳回传的 flag。

源配置 extend（JSON，全部可选）:
{
  "cyc_username": "次元城账号",
  "cyc_password": "密码",
  "cyc_token": "浏览器复制的 JWT",
  "lines": ["xf", "gg", "cy", "om"],
  "detail_budget": 7,
  "host": "https://next.xifanacg.com",
  "api": "https://api.xifanacg.com",
  "key": "sb_publishable_xxx"
}
说明：次元城播放接口需登录，上面三个 cyc_* 字段至少要给一个；
      否则该源仍能列出选集，但播放会返回空地址（接口 401）。

2026-11-11 线路检修:
  · apn.moedot.net（稀饭新番主线-1）签名直链 400/401 → 整条丢弃
  · play.xfvod.pro:8088（稀饭新番主线-2 / 旧番主线-1）主机不通 → 整条丢弃
  · 只剩「稀饭备用-1」(dl.playxf.top) 实测可播；「网页解析」页内已无 m3u8，移除
  · 次元城需登录，未配 cyc_* 时不再挂出死线路；线路名去掉重复源名前缀

2026-11-04 修复要点（xifanacg「已坏」）:
  站点接口实测全部正常（RPC / 详情 / 取流均 200）。真正的故障是旧脚本
  _rsc_sources() 去请求 Next.js 的 /anime/{id} 页面，单次要 10.6~11s，
  而该页 RSC payload 里已经完全没有 sources 数据 —— 详情页被拖到超时，
  且只能降级出 1 条假线路。本版改为调用 issue-web-playback 拿 candidates
  （含 source_id / source_name），详情页由 ~11.5s 降到 ~1s，并恢复 3 条真实线路。
"""

import sys
import re
import os
import json
import time
import base64
import difflib
import tempfile
import urllib.parse
import urllib.request
import urllib.error

try:
    import threading
except Exception:
    threading = None
try:
    import gzip
except Exception:
    gzip = None
try:
    import zlib
except Exception:
    zlib = None
try:
    import ssl
except Exception:
    ssl = None
try:
    import http.client as http_client
except Exception:
    http_client = None

sys.path.append('..')
try:
    from base.spider import Spider as _SpiderBase
except Exception:
    class _SpiderBase(object):
        pass

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

# ---------------- 2026-11-11 线路体检补丁 ----------------
# 站点 candidates 里仍会下发这两条已经挂掉的主线，命中即整条丢弃：
#   apn.moedot.net   签名直链被 CDN 拒（400/401）
#   play.xfvod.pro   80/443/8088 全部 TCP 超时（主机不可达）
DEAD_HOSTS = ('apn.moedot.net', 'play.xfvod.pro')

# OmoFun 下发的是资源站缩写，翻成中文少占屏幕
OM_CN = {'bfzy': '暴风', 'ikzy': 'ikun', 'lzzy': '量子', 'mdzy': '魔都',
         'ffzy': '非凡', 'gszy': '光速', 'hnzy': '红牛', 'bdzy': '百度',
         'bdzy2': '百度2', 'wujin': '无尽', 'tiankong': '天空'}

LINE_LABEL = {'xf': '稀饭', 'gg': 'GiriGiri', 'cy': '次元城', 'om': 'OmoFun'}
LINE_PREF = ('稀饭动漫', '稀饭', 'GiriGiri', 'girigiri', '次元城',
             'OmoFun', 'omofun', 'CYC')


def pretty_line(tag, raw):
    """线路名统一成「源·线路」，且一行只留一个源名。

    站点下发的名字本身就带源名前缀（稀饭新番主线-1），再拼一次就成了
    「稀饭·稀饭新番主线-1」；主聚合外面还套一层，于是出现三连稀饭。
    这里先剥掉重复前缀、去掉序号前的多余连字符，最后只挂一次源名。
    """
    label = LINE_LABEL.get(tag, tag)
    s = clean_name(raw) or '线路'
    for p in LINE_PREF:
        if s[:len(p)].lower() == p.lower():
            s = s[len(p):].strip(' ·-—_')
            break
    if tag == 'cy':
        s = '主库'
    elif tag == 'om':
        s = OM_CN.get(s.lower(), s)
    if not s or s in ('线路', '动漫'):
        s = '主线'
    s = re.sub(r'[-_—－]+\s*(\d+)$', r'\1', s)
    return clean_name('%s·%s' % (label, s)) or label
VIDEO_EXTS = ('.m3u8', '.mp4', '.mkv', '.flv', '.avi', '.ts', '.mov',
              '.m4v', '.webm', '.wmv', '.rmvb', '.mpd')
EXT_HOSTS = ('v.qq.com', 'qq.com', 'youku.com', 'iqiyi.com', 'bilibili.com',
             'mgtv.com', 'sohu.com', 'pptv.com', 'le.com', 'wasu.cn', '1905.com')
US = chr(31)          # 线路 flag 与原始 id 的内部分隔符
NL = chr(10)


class _DummyLock(object):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


_POOL = {}
_CACHE = {}
_LAST_ERR = ''          # 最近一次 detailContent 异常，便于排查（不影响正常流程）
_POOL_MAX = 5
_POOL_IDLE = 25.0
_CACHE_MAX = 200
_SSL = None
_SSL_READY = False
try:
    _POOL_LOCK = threading.Lock() if threading else _DummyLock()
    _CACHE_LOCK = threading.Lock() if threading else _DummyLock()
except Exception:
    _POOL_LOCK = _CACHE_LOCK = _DummyLock()


# ==================== 全局 HTTP 层（四源共享连接池 / 缓存） ====================
def _ssl_ctx():
    global _SSL, _SSL_READY
    if not _SSL_READY:
        _SSL_READY = True
        try:
            # TVBox 内置 Python 常缺系统根证书；这些是公开采集接口，统一不校验
            _SSL = ssl._create_unverified_context() if ssl else None
        except Exception:
            _SSL = None
    return _SSL


def cache_get(key):
    try:
        with _CACHE_LOCK:
            it = _CACHE.get(key)
            if not it:
                return None
            if it[0] > time.time():
                return it[1]
            _CACHE.pop(key, None)
    except Exception:
        pass
    return None


def cache_put(key, val, ttl):
    try:
        with _CACHE_LOCK:
            if len(_CACHE) >= _CACHE_MAX:
                now = time.time()
                for k in [k for k, v in _CACHE.items() if v[0] <= now]:
                    _CACHE.pop(k, None)
                if len(_CACHE) >= _CACHE_MAX:
                    _CACHE.clear()
            _CACHE[key] = (time.time() + ttl, val)
    except Exception:
        pass


def _new_conn(scheme, netloc, timeout):
    kw = {'timeout': timeout}
    if scheme == 'https':
        ctx = _ssl_ctx()
        if ctx is not None:
            kw['context'] = ctx
        return http_client.HTTPSConnection(netloc, **kw)
    return http_client.HTTPConnection(netloc, **kw)


def _pool_take(netloc):
    try:
        with _POOL_LOCK:
            lst = _POOL.get(netloc)
            now = time.time()
            while lst:
                conn, ts = lst.pop()
                if now - ts < _POOL_IDLE and getattr(conn, 'sock', None) is not None:
                    return conn
                try:
                    conn.close()
                except Exception:
                    pass
    except Exception:
        pass
    return None


def _pool_give(netloc, conn):
    try:
        with _POOL_LOCK:
            lst = _POOL.setdefault(netloc, [])
            if len(lst) < _POOL_MAX:
                lst.append((conn, time.time()))
                return
    except Exception:
        pass
    try:
        conn.close()
    except Exception:
        pass


def pool_clear():
    try:
        with _POOL_LOCK:
            for lst in list(_POOL.values()):
                for conn, _ in lst:
                    try:
                        conn.close()
                    except Exception:
                        pass
            _POOL.clear()
    except Exception:
        pass


def _unzip(data, enc):
    try:
        if not data or not enc:
            return data
        if 'gzip' in enc and gzip:
            return gzip.decompress(data)
        if 'deflate' in enc and zlib:
            try:
                return zlib.decompress(data)
            except Exception:
                return zlib.decompress(data, -zlib.MAX_WBITS)
    except Exception:
        pass
    return data


def _decode(data, ctype):
    cs = 'utf-8'
    try:
        m = re.search(r'charset=([\w-]+)', ctype or '')
        if m:
            cs = m.group(1)
    except Exception:
        pass
    try:
        return data.decode(cs, 'ignore')
    except Exception:
        return data.decode('utf-8', 'ignore')


def _urllib_req(url, method, data, h, timeout):
    try:
        req = urllib.request.Request(url, data=data, headers=h, method=method)
        kw = {'timeout': timeout}
        ctx = _ssl_ctx()
        if ctx is not None:
            kw['context'] = ctx
        with urllib.request.urlopen(req, **kw) as resp:
            raw = resp.read()
            enc = (resp.headers.get('Content-Encoding') or '').lower()
            return resp.status, _decode(_unzip(raw, enc), resp.headers.get('Content-Type'))
    except urllib.error.HTTPError as e:
        try:
            raw = _unzip(e.read(), (e.headers.get('Content-Encoding') or '').lower())
            return e.code, raw.decode('utf-8', 'ignore')
        except Exception:
            return e.code, ''
    except Exception:
        return 0, ''


def request_ex(url, method='GET', body=None, headers=None, timeout=8.0, ttl=0):
    """返回 (status, text)。body 为 dict/list 时自动序列化并置 Content-Type。
    连接池按 netloc 复用；仅 2xx 会回池；短 TTL 缓存只存原始文本。"""
    try:
        p = urllib.parse.urlsplit(str(url or ''))
    except Exception:
        return 0, ''
    netloc = p.netloc
    if not netloc:
        return 0, ''
    scheme = (p.scheme or 'https').lower()
    path = (p.path or '/') + (('?' + p.query) if p.query else '')
    try:
        if any(ord(c) > 127 for c in path):
            path = urllib.parse.quote(path, safe="/?&=%:@+,~$!*'();[]")
    except Exception:
        pass

    h = dict(headers or {})
    data = None
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body, ensure_ascii=False).encode('utf-8')
            h.setdefault('Content-Type', 'application/json')
        elif isinstance(body, str):
            data = body.encode('utf-8')
        else:
            data = body
        if method == 'GET':
            method = 'POST'
    if gzip or zlib:
        h.setdefault('Accept-Encoding', 'gzip, deflate')
    h.setdefault('User-Agent', UA)

    ck = None
    if ttl:
        ck = '%s|%s|%s|%s' % (method, url, (data or b'')[:160],
                              h.get('Authorization', ''))
        hit = cache_get(ck)
        if hit is not None:
            return 200, hit

    st, txt = 0, ''
    if http_client is None:
        st, txt = _urllib_req(url, method, data, h, timeout)
    else:
        for attempt in (0, 1, 2):
            conn = _pool_take(netloc) if attempt < 2 else None
            reused = conn is not None
            if conn is None:
                try:
                    conn = _new_conn(scheme, netloc, timeout)
                except Exception:
                    break
            t0 = time.time()
            try:
                conn.request(method, path, body=data, headers=h)
                resp = conn.getresponse()
                raw = resp.read()
                enc = (resp.getheader('Content-Encoding') or '').lower()
                ctype = resp.getheader('Content-Type') or ''
                st = resp.status or 0
                txt = _decode(_unzip(raw, enc), ctype)
                if 200 <= st < 300:
                    _pool_give(netloc, conn)
                else:
                    try:
                        conn.close()
                    except Exception:
                        pass
                break
            except Exception:
                try:
                    conn.close()
                except Exception:
                    pass
                if reused:
                    continue
                # 真超时不重试，只有 <1.2s 的快速失败才重来
                if attempt == 0 and (time.time() - t0) < 1.2:
                    continue
                break
    if ck and 200 <= st < 300 and txt:
        cache_put(ck, txt, ttl)
    return st, txt


def http_text(url, **kw):
    return request_ex(url, **kw)[1]


def loads(txt):
    """兼容普通 JSON / NDJSON / 前后带噪声的接口响应"""
    if not txt:
        return {}
    s = txt.strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    out = []
    for line in s.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            o = json.loads(line)
        except Exception:
            continue
        if isinstance(o, list):
            out += o
        elif isinstance(o, dict):
            out.append(o)
    if out:
        return out
    m = re.search(r'[\{\[].*[\}\]]', s, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return {}


# ==================== 通用工具 ====================
def is_video(u):
    try:
        x = str(u or '').split('#')[0].split('?')[0].strip().lower()
        return any(x.endswith(e) for e in VIDEO_EXTS)
    except Exception:
        return False


def enc_url(u):
    """路径含中文/空格时百分号编码，保留 query 里的 sign 参数"""
    try:
        s = str(u or '').strip()
        if not s or all(ord(c) < 128 for c in s):
            return s
        p = urllib.parse.urlsplit(s)
        return urllib.parse.urlunsplit((
            p.scheme, p.netloc,
            urllib.parse.quote(p.path, safe="/%:@&=+$,~"),
            urllib.parse.quote(p.query, safe="=&%:/?:@+,~"), ''))
    except Exception:
        return str(u or '')


def abs_url(base, u):
    try:
        s = str(u or '').strip()
        if not s:
            return s
        if s.startswith('//'):
            return enc_url('https:' + s)
        if s.startswith('http'):
            return enc_url(s)
        return enc_url(urllib.parse.urljoin(base, s))
    except Exception:
        return u


def clean_name(s):
    try:
        t = str(s or '').strip()
        t = t.replace('$', ' ').replace('#', ' ').replace('|', ' ')
        t = t.replace('\r', ' ').replace('\n', ' ')
        return re.sub(r'\s+', ' ', t).strip()
    except Exception:
        return ''


def norm_title(s):
    try:
        s = str(s or '').lower()
        return re.sub(r'[\s\u3000\-—–_·:：!！?？,，.。\[\]【】()（）「」『』《》<>／/\\|+~～]', '', s)
    except Exception:
        return ''


def sim(a, b):
    """标题相似度：完全相同 > 包含 > 序列相似"""
    try:
        x, y = norm_title(a), norm_title(b)
        if not x or not y:
            return 0.0
        if x == y:
            return 1.0
        if x in y or y in x:
            r = float(min(len(x), len(y))) / max(len(x), len(y))
            return 0.85 + 0.12 * r if r >= 0.5 else 0.0
        return difflib.SequenceMatcher(None, x, y).ratio()
    except Exception:
        return 0.0


_SEASON_RE = re.compile(
    r'(第[一二三四五六七八九十0-9]+季|season\s*[0-9]+|part\s*[0-9]+|\bs[0-9]{1,2}\b)',
    re.I)


def season_tag(s):
    try:
        m = _SEASON_RE.search(str(s or ''))
        return m.group(0).lower() if m else ''
    except Exception:
        return ''


def search_keywords(title):
    """完整标题 → 去括号/季数的核心词 → 核心词前 6 / 4 字"""
    t = str(title or '').strip()
    out = []

    def add(x):
        x = str(x or '').strip()
        if x and x not in out and len(x) >= 2:
            out.append(x)

    add(t)
    core = re.sub(r'[\[\(（【].*?[\]\)）】]', '', t)
    core = _SEASON_RE.sub('', core)
    core = re.sub(r'\s+', ' ', core).strip()
    add(core)
    for n in (6, 4):
        if len(core) > n:
            add(core[:n])
    return out


def best_match(title, items, threshold=0.70):
    best, score = None, 0.0
    ts = season_tag(title)
    for it in items or []:
        if not isinstance(it, dict):
            continue
        name = it.get('vod_name') or ''
        s = sim(title, name)
        cs = season_tag(name)
        if ts and cs and ts != cs:
            s *= 0.45          # 双方季数标记都存在却不一致，避免错季
        if s > score:
            best, score = it, s
    return best if score >= threshold else None


def search_best(src, title):
    """跨站译名有差异时逐级降级搜索；降级轮只接受近乎精确匹配，
    防止把第一季的线路挂到第二季上。"""
    for i, kw in enumerate(search_keywords(title)):
        try:
            items = src.search(kw)
        except Exception:
            continue
        if not items:
            continue
        pick = best_match(title, items, 0.70 if i == 0 else 0.97)
        if pick:
            return pick
    return None


def enc_pid(tag, flag, pid):
    try:
        raw = ('%s%s%s' % (flag, US, pid)).encode('utf-8')
        return tag + '|' + base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')
    except Exception:
        return ''


def dec_pid(s):
    try:
        tag, b = str(s).split('|', 1)
        b += '=' * ((4 - len(b) % 4) % 4)
        raw = base64.urlsafe_b64decode(b.encode('ascii')).decode('utf-8')
        flag, pid = raw.split(US, 1)
        return tag, flag, pid
    except Exception:
        return '', '', ''


def play_header(host, ref=None):
    return {'User-Agent': UA, 'Referer': ref or (host + '/'),
            'Origin': host, 'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9'}


def is_ext_link(u):
    try:
        net = urllib.parse.urlsplit(str(u or '')).netloc.lower()
        return any(net == k or net.endswith('.' + k) for k in EXT_HOSTS)
    except Exception:
        return False


def ep_label(raw, idx):
    try:
        t = str(raw or '').strip()
        if not t:
            return '第%02d集' % (idx + 1)
        if re.match(r'^[0-9]{1,4}$', t):
            return '第%02d集' % int(t)
        return t
    except Exception:
        return '第%02d集' % (idx + 1)


def as_lines(episodes):
    """把 [(集名, flag, pid)] 规整化"""
    out = []
    for e in episodes or []:
        try:
            if len(e) >= 3 and e[2]:
                out.append((clean_name(e[0]) or '正片', str(e[1] or ''), str(e[2])))
        except Exception:
            pass
    return out


def _epnum(e):
    try:
        return float(e.get('episode_number') or 0)
    except Exception:
        return 0.0


# ==================== 源 1：稀饭动漫 Next（首页数据源 + 线路） ====================
class XifanSpider(object):
    """修复版：移除无效的 RSC 请求，改用 issue-web-playback 的 candidates 建线路。"""
    TAG = 'xf'
    HOST = 'https://next.xifanacg.com'
    API = 'https://api.xifanacg.com'
    KEY = 'sb_publishable_OBIVAWACIX6lPXrO98_z24_HcsmalkA'
    PAGE_SIZE = 24
    MAX_LINES = 4
    FLAG = 'xfline'

    CATEGORIES = [
        {'tid': '1', 'name': '连载新番', 'type_id': 1, 'sort': 'updated_at'},
        {'tid': '2', 'name': '完结旧番', 'type_id': 2, 'sort': 'updated_at'},
        {'tid': '3', 'name': '剧场版', 'type_id': 3, 'sort': 'updated_at'},
        {'tid': '4', 'name': '美漫', 'type_id': 4, 'sort': 'updated_at'},
        {'tid': 'hot', 'name': '热门播放', 'sort': 'view_count'},
        {'tid': 'score', 'name': '高分好评', 'sort': 'bangumi_score'},
        {'tid': 'new', 'name': '最近上新', 'sort': 'created_at'},
        {'tid': 'tv', 'name': 'TV动画', 'fmt': 'tv', 'sort': 'updated_at'},
        {'tid': 'movie', 'name': '剧场动画', 'fmt': 'movie', 'sort': 'updated_at'},
        {'tid': 'ova', 'name': 'OVA', 'fmt': 'ova', 'sort': 'updated_at'},
        {'tid': 'web', 'name': 'WEB动画', 'fmt': 'web', 'sort': 'updated_at'},
        {'tid': 'fin', 'name': '已完结', 'finished': True, 'sort': 'updated_at'},
        {'tid': 'ing', 'name': '连载中', 'finished': False, 'sort': 'updated_at'},
        {'tid': 'y2026', 'name': '2026年', 'year': 2026, 'sort': 'updated_at'},
        {'tid': 'y2025', 'name': '2025年', 'year': 2025, 'sort': 'updated_at'},
        {'tid': 'y2024', 'name': '2024年', 'year': 2024, 'sort': 'updated_at'},
        {'tid': 'y2023', 'name': '2023年', 'year': 2023, 'sort': 'updated_at'},
    ]
    TID_ALIAS = {
        '0': '1', 'all': '1', 'ongoing': '1', 'anime': '1',
        'finished': '2', 'theater': '3', 'western': '4', 'drama': 'tv',
    }

    def __init__(self, cfg=None):
        cfg = cfg or {}
        self.host = str(cfg.get('host') or self.HOST).rstrip('/')
        self.api = str(cfg.get('api') or self.API).rstrip('/')
        self.key = str(cfg.get('key') or self.KEY)
        try:
            self.timeout = float(cfg.get('timeout') or 4)
        except Exception:
            self.timeout = 4.0
        # 健康标记：连续网络层失败就临时下线，别再让首页/分类每次白等超时
        self._fails = 0
        self._cool = 0.0
        self.alive = True

    def _mark(self, ok):
        if ok:
            self._fails = 0
            self.alive = True
            return
        self._fails += 1
        if self._fails >= 1:
            self.alive = False
            self._cool = time.time() + 120

    def health(self):
        """冷却期过后自动试探恢复。"""
        if not self.alive and time.time() > self._cool:
            self.alive = True
            self._fails = 0
        return self.alive

    def hdr(self, ref=None):
        return {
            'User-Agent': UA,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Referer': ref or (self.host + '/'),
            'Origin': self.host,
            'x-platform': 'web',
            'x-requested-with': 'XMLHttpRequest',
            'apikey': self.key,
            'authorization': 'Bearer ' + self.key,
            'x-client-info': 'supabase-ssr/0.10.3 createBrowserClient',
            'content-profile': 'public',
            'Accept-Encoding': 'gzip, deflate',
        }

    def get(self, path, params=None, ttl=0):
        url = self.api + path
        if params:
            url += ('&' if '?' in url else '?') + urllib.parse.urlencode(params)
        st, txt = request_ex(url, 'GET', headers=self.hdr(),
                             timeout=self.timeout, ttl=ttl)
        self._mark(bool(st))
        return loads(txt) if st and st < 400 else {}

    def post(self, path, body, ttl=0):
        st, txt = request_ex(self.api + path, 'POST', body=body,
                             headers=self.hdr(), timeout=self.timeout, ttl=ttl)
        self._mark(bool(st))
        return loads(txt) if st and st < 400 else {}

    def cat(self, tid):
        t = str(tid or '').strip()
        t = self.TID_ALIAS.get(t.lower(), t)
        for c in self.CATEGORIES:
            if c['tid'] == t:
                return c
        return {'tid': t}

    def query(self, tid, pg, ext=None, kw=''):
        c = self.cat(tid)
        ext = ext if isinstance(ext, dict) else {}
        page = int(pg) if str(pg or '').isdigit() and int(pg) > 0 else 1
        q = {'page_number': page, 'items_per_page': self.PAGE_SIZE,
             'sort_by': c.get('sort') or 'updated_at', 'sort_order': 'desc',
             'filter_only_published': True}
        if kw:
            q['search_term'] = str(kw).strip()
        if c.get('type_id'):
            q['filter_type_id'] = c['type_id']
        if c.get('fmt'):
            q['filter_format'] = c['fmt']
        if 'finished' in c:
            q['filter_is_finished'] = c['finished']
        if c.get('year'):
            q['filter_release_year'] = c['year']
        for k, dst in (('sort_by', 'sort_by'), ('sort_order', 'sort_order'),
                       ('year', 'filter_release_year'),
                       ('type_id', 'filter_type_id'), ('format', 'filter_format')):
            if ext.get(k) not in (None, ''):
                q[dst] = ext[k]
        return q

    def rpc(self, tid, pg, ext=None, kw='', ttl=0):
        arr = self.post('/rest/v1/rpc/search_animes',
                        self.query(tid, pg, ext, kw), ttl=ttl)
        if not isinstance(arr, list):
            return [], 0
        total = 0
        try:
            total = int(arr[0].get('total_count') or 0) if arr else 0
        except Exception:
            total = 0
        return arr, total

    def vod(self, it):
        try:
            if not isinstance(it, dict):
                return None
            aid = it.get('id')
            if aid in (None, ''):
                return None
            # img2 走 AWS 新加坡，国内实测超时；img 是 Cloudflare 同路径可直出
            pic = str(it.get('cover_url') or '').replace(
                'img2.xfmanga.top', 'img.xfmanga.top')
            cur = it.get('current_episodes') or 0
            tot = it.get('total_episodes') or 0
            remark = ''
            if it.get('is_finished'):
                remark = ('全%d集' % tot) if tot else '已完结'
            elif cur:
                remark = ('更新至%d集' % cur) + (('/%d' % tot) if tot and tot > cur else '')
            desc = str(it.get('description') or '')
            tags = it.get('meta_tags') or []
            if isinstance(tags, list) and tags:
                desc = (desc + NL + '标签：' + ' / '.join([str(t) for t in tags[:8]])).strip()
            actors = it.get('actors')
            return {
                'vod_id': str(aid),
                'vod_name': str(it.get('title') or it.get('title_original') or ''),
                'vod_pic': pic,
                'vod_remarks': remark,
                'vod_year': str(it.get('release_year') or ''),
                'vod_area': str(it.get('region') or ''),
                'vod_lang': '日语',
                'vod_actor': ('、'.join([str(a) for a in actors[:6]])
                              if isinstance(actors, list) else ''),
                'vod_director': str(it.get('director') or ''),
                'vod_score': str(it.get('bangumi_score') or ''),
                'vod_content': desc,
                'vod_tag': '',
            }
        except Exception:
            return None

    def vod_list(self, arr):
        out = []
        for it in arr or []:
            v = self.vod(it)
            if v:
                out.append(v)
        return out

    def filters(self):
        years = [{'n': '全部', 'v': ''}]
        years += [{'n': str(y), 'v': str(y)} for y in range(2026, 2018, -1)]
        sorts = [{'n': '最近更新', 'v': ''},
                 {'n': '最多播放', 'v': 'view_count'},
                 {'n': '高分好评', 'v': 'bangumi_score'},
                 {'n': '最近上新', 'v': 'created_at'}]
        out = {}
        for c in self.CATEGORIES:
            out[c['tid']] = [{'key': 'sort_by', 'name': '排序', 'value': sorts},
                             {'key': 'year', 'name': '年份', 'value': years}]
        return out

    def homeContent(self, filter):
        classes = [{'type_id': c['tid'], 'type_name': c['name']}
                   for c in self.CATEGORIES]
        try:
            arr, _ = self.rpc('1', 1, None, '', ttl=90)
            vlist = self.vod_list(arr)[:18]
            if len(vlist) < 8:
                more, _ = self.rpc('3', 1, None, '', ttl=90)
                vlist += self.vod_list(more)[:10]
        except Exception:
            vlist = []
        return {'class': classes, 'filters': self.filters() if filter else {},
                'list': vlist}

    def homeVideoContent(self):
        try:
            arr, _ = self.rpc('new', 1, None, '', ttl=90)
            vlist = self.vod_list(arr)
            if not vlist:
                arr, _ = self.rpc('1', 1, None, '', ttl=90)
                vlist = self.vod_list(arr)
            return {'list': vlist}
        except Exception:
            return {'list': []}

    def categoryContent(self, tid, pg, filter, extend):
        ext = {}
        if isinstance(extend, dict):
            ext = extend
        elif isinstance(extend, str) and extend.strip().startswith('{'):
            try:
                ext = json.loads(extend)
            except Exception:
                ext = {}
        try:
            arr, total = self.rpc(tid, pg, ext, '', ttl=60)
            vlist = self.vod_list(arr)
            page = int(pg) if str(pg or '').isdigit() and int(pg) > 0 else 1
            if total:
                pagecount = (total + self.PAGE_SIZE - 1) // self.PAGE_SIZE
            else:
                pagecount = 9999 if vlist else 1
            return {'list': vlist, 'page': page,
                    'pagecount': max(pagecount, page),
                    'limit': self.PAGE_SIZE, 'total': total or len(vlist)}
        except Exception:
            return {'list': [], 'page': 1, 'pagecount': 1,
                    'limit': self.PAGE_SIZE, 'total': 0}

    def searchContent(self, key, quick, pg='1'):
        word = str(key or '').strip()
        if not word:
            return {'list': []}
        try:
            page = 1 if quick else (int(pg) if str(pg or '').isdigit() else 1)
            arr, _ = self.rpc('', page, None, word, ttl=30)
            return {'list': self.vod_list(arr)}
        except Exception:
            return {'list': []}

    def search(self, kw, page=1):
        """统一接口：按标题查本站条目（供诊断 / 跨源匹配使用）"""
        try:
            arr, _ = self.rpc('', page, None, kw, ttl=30)
            return self.vod_list(arr)
        except Exception:
            return []

    def match_lines(self, title):
        # 首页源本身就是元数据来源，详情直接由 detail() 产出线路
        return []

    def anime_eps(self, aid):
        """详情 + 剧集一次取回；嵌套 select 失败时回退成两次单独请求"""
        try:
            arr = self.get('/rest/v1/animes', {
                'id': 'eq.' + str(aid),
                'select': '*,episodes(id,episode_number,title,kind,release_date,duration_seconds)',
                'limit': 1}, ttl=120)
            if isinstance(arr, list) and arr and isinstance(arr[0], dict):
                it = arr[0]
                eps = it.pop('episodes', None) or []
                if isinstance(eps, list) and eps:
                    eps.sort(key=_epnum)
                    return it, [e for e in eps if isinstance(e, dict) and e.get('id')]
        except Exception:
            pass
        plain = self.get('/rest/v1/animes',
                         {'id': 'eq.' + str(aid), 'select': '*', 'limit': 1}, ttl=120)
        it = plain[0] if isinstance(plain, list) and plain and isinstance(plain[0], dict) else {}
        arr = self.get('/rest/v1/episodes', {
            'anime_id': 'eq.' + str(aid),
            'select': 'id,episode_number,title,kind,release_date,duration_seconds',
            'order': 'episode_number.asc', 'limit': 2000}, ttl=300)
        eps = arr if isinstance(arr, list) else []
        return it, [e for e in eps if isinstance(e, dict) and e.get('id')]

    def ep_name(self, ep, idx):
        try:
            num = int(float(ep.get('episode_number') or (idx + 1)))
        except Exception:
            num = idx + 1
        t = str(ep.get('title') or '').strip()
        return clean_name(('第%02d集 %s' % (num, t)) if t else ('第%02d集' % num))

    def source_lines(self, aid, eps):
        """【核心修复】用第一集取流响应的 candidates 枚举真实线路。
        旧版解析 Next.js RSC payload，实测该页已无 sources 数据且耗时 10.6s。"""
        out = []
        eids = [e.get('id') for e in eps if e.get('id')]
        if not eids:
            return out
        try:
            first_eid = int(eids[0])
        except Exception:
            return out
        d = self.post('/functions/v1/issue-web-playback',
                      {'action': 'fallback', 'episode_id': first_eid}, ttl=180)
        cands = d.get('candidates') if isinstance(d, dict) else None
        if not isinstance(cands, list) or not cands:
            # 429 限流或接口抽风时不要硬造一条「稀饭线路」：那条只能回落到
            # 播放页，壳里必黑屏。接口若还给了顶层 url 就沿用它，否则返回空，
            # 让上层用别的源。
            du = str((d or {}).get('url') or '') if isinstance(d, dict) else ''
            if not du:
                return out
            cands = [{'source_id': 0, 'source_name': '稀饭线路', 'url': du}]
        cands = self._live_cands(cands)
        used = {}
        for c in cands[:self.MAX_LINES]:
            if not isinstance(c, dict):
                continue
            try:
                sid = int(c.get('source_id') or 0)
            except Exception:
                sid = 0
            base = clean_name(c.get('source_name') or c.get('source_code') or '稀饭线路') or '稀饭线路'
            name = base
            if name in used:
                used[name] += 1
                name = '%s·%d' % (base, used[name])
            else:
                used[name] = 1
            items = []
            for i, e in enumerate(eps):
                eid = e.get('id')
                if not eid:
                    continue
                items.append((self.ep_name(e, i), self.FLAG,
                              '%s|%s|%s' % (aid, eid, sid)))
            if items:
                out.append({'name': name, 'eps': as_lines(items)})
        return out

    def _live_cands(self, cands):
        """按候选自带地址的主机名过滤失效线路（2026-11-11 实测）

        issue-web-playback 返回的每条 candidate 本身就带 url，直接看主机名
        就够了，不必再逐条试流 —— 站点有 429 限流（实测 retry_after 20~30s），
        多打一次请求会让整片线路直接降级成空。
        命中 DEAD_HOSTS 的整条丢弃；全被丢光就返回空列表，上层还有
        GiriGiri / OmoFun 兜着。
        """
        keep = []
        for c in cands or []:
            if not isinstance(c, dict):
                continue
            try:
                host = urllib.parse.urlsplit(str(c.get('url') or '')).netloc.lower()
            except Exception:
                host = ''
            if host and any(h in host for h in DEAD_HOSTS):
                continue
            keep.append(c)
        return keep

    def detail(self, aid):
        info, eps = self.anime_eps(aid)
        v = self.vod(info) or {'vod_id': aid}
        v['vod_id'] = aid
        if not v.get('vod_name'):
            v['vod_name'] = '稀饭动漫 %s' % aid
        v['vod_pubdate'] = str(info.get('release_date') or '')
        lines = self.source_lines(aid, eps)
        # 2026-11-11：原「网页解析」线路指向 /anime/{id}/play/{eid} 这个 HTML
        # 播放页，实测页内已经没有任何 m3u8/mp4 可供嗅探，壳里 parses 为空时
        # 必然黑屏，故不再下发。
        return v, lines

    def fetch_playable(self, eid, sid):
        """按线路 source_id 取流；不缓存（url 带时效性 sign）"""
        try:
            eid_i = int(eid)
        except Exception:
            return ''
        body = {'action': 'fallback', 'episode_id': eid_i}
        try:
            if str(sid) not in ('', '0', 'None'):
                body['source_id'] = int(sid)
        except Exception:
            pass
        d = self.post('/functions/v1/issue-web-playback', body)
        u = str((d or {}).get('url') or '') if isinstance(d, dict) else ''
        if not u and body.get('source_id'):
            d2 = self.post('/functions/v1/issue-web-playback',
                           {'action': 'fallback', 'episode_id': eid_i})
            u = str((d2 or {}).get('url') or '') if isinstance(d2, dict) else ''
        return enc_url(u)

    def play(self, flag, pid):
        res = {'parse': 0, 'jx': 0, 'url': '', 'header': play_header(self.host)}
        raw = str(pid or '').strip()
        if not raw:
            return res
        if raw.startswith('playpage:'):
            page = raw[len('playpage:'):]
            return {'parse': 1, 'jx': 1, 'url': page,
                    'header': play_header(self.host, page)}
        if raw.startswith('http') or raw.startswith('//'):
            u = ('https:' + raw) if raw.startswith('//') else raw
            res['url'] = enc_url(u) if is_video(u) else u
            return res
        m = re.match(r'^([0-9]+)\|([0-9]+)\|([0-9]+)$', raw)
        if m:
            url = self.fetch_playable(m.group(2), m.group(3))
            if url:
                res['url'] = url
                return res
            page = '%s/anime/%s/play/%s' % (self.host, m.group(1), m.group(2))
            return {'parse': 1, 'jx': 1, 'url': page,
                    'header': play_header(self.host, page)}
        if raw.isdigit():
            url = self.fetch_playable(raw, 0)
            if url:
                res['url'] = url
        return res


# ==================== 源 2：GiriGiri爱（maccms 接口，直链） ====================
class GirigiriSpider(object):
    TAG = 'gg'
    HOST = 'https://ani.girigirilove.com'
    API = 'https://m3u8.girigirilove.com/api.php'
    IMG = 'https://jpg.girigirilove.com'
    PAGE_SIZE = 24
    MAX_LINES = 4
    LINE_NAME = {'cht': '繁中字幕', 'chs': '简中字幕', 'cht,chs': '繁简双字'}

    def __init__(self, cfg=None):
        cfg = cfg or {}
        self.host = str(cfg.get('giri_host') or self.HOST).rstrip('/')
        self.api = str(cfg.get('giri_api') or self.API).rstrip('/')
        try:
            self.timeout = float(cfg.get('timeout') or 6)
        except Exception:
            self.timeout = 6.0

    def hdr(self, ref=None):
        return {'User-Agent': UA, 'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Referer': ref or (self.host + '/'), 'Origin': self.host,
                'x-platform': 'web', 'x-requested-with': 'XMLHttpRequest',
                'Accept-Encoding': 'gzip, deflate'}

    def call(self, path, params=None, ttl=0):
        url = self.api + path
        if params:
            url += ('&' if '?' in url else '?') + urllib.parse.urlencode(params)
        st, txt = request_ex(url, 'GET', headers=self.hdr(),
                             timeout=self.timeout, ttl=ttl)
        return loads(txt) if st and st < 400 else {}

    def pic(self, p):
        try:
            s = str(p or '').strip()
            if not s:
                return ''
            if s.startswith('//'):
                return 'https:' + s
            if s.startswith('http'):
                return s
            return self.IMG + '/' + s.lstrip('/')
        except Exception:
            return ''

    def vod(self, it):
        try:
            if not isinstance(it, dict):
                return None
            vid = it.get('vod_id')
            if vid in (None, ''):
                return None
            desc = str(it.get('vod_blurb') or it.get('vod_content') or '')
            cls = it.get('vod_class') or ''
            if cls and isinstance(cls, str):
                desc = (desc + NL + '类型：' + cls.replace(',', ' / ')).strip()
            return {'vod_id': str(vid),
                    'vod_name': str(it.get('vod_name') or ''),
                    'vod_pic': self.pic(it.get('vod_pic')),
                    'vod_remarks': str(it.get('vod_remarks') or ''),
                    'vod_year': str(it.get('vod_year') or ''),
                    'vod_area': str(it.get('vod_area') or ''),
                    'vod_lang': str(it.get('vod_lang') or ''),
                    'vod_content': desc}
        except Exception:
            return None

    def vod_list(self, arr):
        out = []
        for it in arr or []:
            v = self.vod(it)
            if v:
                out.append(v)
        return out

    def list_params(self, page, kw=''):
        q = {'type_id': 2, 'offset': (max(1, page) - 1) * self.PAGE_SIZE,
             'limit': self.PAGE_SIZE, 'vod_name': '', 'vod_area': '',
             'vod_year': '', 'orderby': '', 'vod_class': '', 'vod_lang': '',
             'vod_version': '', 'vod_state': '', 'vod_weekday': '',
             'vod_letter': '', 'vod_tag': '', 'user_id': ''}
        if kw:
            q['vod_name'] = str(kw).strip()
            q.pop('type_id', None)   # 搜索时带 type_id（哪怕空串）会返回 total=0
        return q

    # ---------- 备用主源（xifanacg 的 Supabase API 挂掉时顶上） ----------
    # 实测该 API 的 /Vod/get_list 支持 type_id + offset 翻页 + orderby 排序，
    # type_id=2 日漫 3147 条、type_id=3 欧美 38 条，orderby 可选 ''/hits/score。
    CATS = [
        {'type_id': 'gg_new', 'type_name': '日漫·最新'},
        {'type_id': 'gg_hot', 'type_name': '日漫·热门'},
        {'type_id': 'gg_score', 'type_name': '日漫·高分'},
        {'type_id': 'gg_us', 'type_name': '欧美动漫'},
    ]
    CAT_RULE = {'gg_new': (2, ''), 'gg_hot': (2, 'hits'),
                'gg_score': (2, 'score'), 'gg_us': (3, '')}

    def _q(self, tid, pg):
        type_id, orderby = self.CAT_RULE.get(str(tid or 'gg_new').strip(), (2, ''))
        page = int(pg) if str(pg or '').isdigit() and int(pg) > 0 else 1
        return {'type_id': type_id, 'offset': (page - 1) * self.PAGE_SIZE,
                'limit': self.PAGE_SIZE, 'vod_name': '', 'vod_area': '',
                'vod_year': '', 'orderby': orderby, 'vod_class': '',
                'vod_lang': '', 'vod_version': '', 'vod_state': '',
                'vod_weekday': '', 'vod_letter': '', 'vod_tag': '', 'user_id': ''}

    def _rows(self, q, ttl=0):
        d = self.call('/Vod/get_list', q, ttl=ttl)
        info = d.get('info') if isinstance(d.get('info'), dict) else {}
        rows = info.get('rows') if isinstance(info.get('rows'), list) else []
        try:
            total = int(info.get('total') or 0)
        except Exception:
            total = 0
        return rows, total

    def homeContent(self, filter=False):
        classes = [{'type_id': c['type_id'], 'type_name': c['type_name']}
                   for c in self.CATS]
        filters = {}
        for c in self.CATS:
            filters[c['type_id']] = [{
                'key': 'orderby', 'name': '排序',
                'value': [{'n': '默认', 'v': ''}, {'n': '最热', 'v': 'hits'},
                          {'n': '评分', 'v': 'score'}]}]
        return {'class': classes, 'filters': filters}

    def homeVideoContent(self):
        rows, _ = self._rows(self._q('gg_new', 1), ttl=120)
        return {'list': self.vod_list(rows)[:30]}

    def categoryContent(self, tid, pg, filter, extend):
        page = int(pg) if str(pg or '').isdigit() and int(pg) > 0 else 1
        q = self._q(tid, page)
        if isinstance(extend, dict) and extend.get('orderby') not in (None, ''):
            q['orderby'] = str(extend['orderby'])
        rows, total = self._rows(q)
        items = self.vod_list(rows)
        pagecount = (max(1, (total + self.PAGE_SIZE - 1) // self.PAGE_SIZE)
                     if total else page)
        return {'list': items, 'total': total or len(items),
                'page': page, 'pagecount': pagecount}

    def searchContent(self, key, quick, pg='1'):
        page = int(pg) if str(pg or '').isdigit() and int(pg) > 0 else 1
        items = self.search(key, page)
        return {'list': items, 'total': len(items), 'page': page,
                'pagecount': page}

    def detail(self, vid):
        """→ (vod, 线路列表)。vod_id 带 'g:' 前缀，门面据此区分来源、避免与 xf 的 id 撞车。"""
        vid = str(vid or '').strip()
        d = self.call('/Vod/get_detail', {'vod_id': vid}, ttl=180)
        info = d.get('info') if isinstance(d.get('info'), dict) else {}
        vod = self.vod(info) if info else None
        if not vod:
            vod = {'vod_id': vid, 'vod_name': vid, 'vod_pic': '', 'vod_remarks': ''}
        vod['vod_id'] = 'g:' + vid
        return vod, self.lines(vid)

    def search(self, kw, page=1):
        d = self.call('/Vod/get_list', self.list_params(page, kw), ttl=30)
        info = d.get('info') if isinstance(d.get('info'), dict) else {}
        rows = info.get('rows') if isinstance(info.get('rows'), list) else []
        return self.vod_list(rows)

    def match_lines(self, title):
        pick = search_best(self, title)
        if not pick:
            return []
        return self.lines(str(pick.get('vod_id')))

    def lines(self, vid):
        d = self.call('/Vod/get_detail', {'vod_id': vid}, ttl=180)
        info = d.get('info') if isinstance(d.get('info'), dict) else {}
        froms = str(info.get('vod_play_from') or '').split('$$$')
        segs = str(info.get('vod_play_url') or '').split('$$$')
        out, used = [], {}
        for i, seg in enumerate(segs):
            code = froms[i] if i < len(froms) else ''
            base = (self.LINE_NAME.get(str(code or '').strip().lower())
                    or clean_name(code) or '线路')
            name = base
            if name in used:
                used[name] += 1
                name = '%s·%d' % (base, used[name])
            else:
                used[name] = 1
            items = []
            for j, part in enumerate(seg.split('#')):
                part = part.strip()
                if not part:
                    continue
                if '$' in part:
                    t, u = part.split('$', 1)
                else:
                    t, u = '', part
                u = u.strip()
                if not u or not is_video(u):
                    continue
                items.append((ep_label(t, j), name, u))
            if items:
                out.append({'name': name, 'eps': as_lines(items)})
            if len(out) >= self.MAX_LINES:
                break
        return out

    def play(self, flag, pid):
        res = {'parse': 0, 'jx': 0, 'url': '', 'header': play_header(self.host)}
        raw = str(pid or '').strip()
        if not raw:
            return res
        if raw.startswith('page:'):
            page = raw[5:]
            return {'parse': 1, 'jx': 1, 'url': page,
                    'header': play_header(self.host, page)}
        if raw.startswith('http') or raw.startswith('//'):
            u = ('https:' + raw) if raw.startswith('//') else raw
            if is_video(u):
                res['url'] = enc_url(u)
            elif is_ext_link(u):
                res.update({'parse': 1, 'jx': 1, 'url': u,
                            'header': play_header(self.host, u)})
            else:
                res['url'] = u
            return res
        if raw.isdigit():
            d = self.call('/Vod/get_detail', {'vod_id': raw}, ttl=180)
            info = d.get('info') if isinstance(d.get('info'), dict) else {}
            for seg in str(info.get('vod_play_url') or '').split('$$$'):
                for part in seg.split('#'):
                    if '$' in part:
                        u = part.split('$', 1)[1].strip()
                        if is_video(u):
                            res['url'] = enc_url(u)
                            return res
        return res


# ==================== 源 3：次元城动画（REST API，播放需登录） ====================
class CycaniSpider(object):
    TAG = 'cy'
    HOST = 'https://www.cycani.org'
    PAGE_SIZE = 18
    MAX_LINES = 3
    APP_NAME = 'cyc_web'
    APP_VERSION = 'cycweb'
    TIME_ZONE = 'Asia/Shanghai'

    def __init__(self, cfg=None):
        cfg = cfg or {}
        self.host = str(cfg.get('cyc_host') or self.HOST).rstrip('/')
        self.api = str(cfg.get('cyc_api') or (self.host + '/api')).rstrip('/')
        try:
            self.timeout = float(cfg.get('timeout') or 8)
        except Exception:
            self.timeout = 8.0
        self.username = str(cfg.get('cyc_username') or '').strip()
        self.password = str(cfg.get('cyc_password') or '').strip()
        # 旧脚本里硬编码的 Token 已于 2026-11-04 过期且无法 refresh，此处不再内置
        self.token = self._norm(str(cfg.get('cyc_token') or '').strip())
        if not self.token:
            self.token = self._load_auth()

    # ---- Token ----
    def _auth_path(self):
        try:
            return os.path.join(tempfile.gettempdir(), '.cyc_auth.json')
        except Exception:
            return ''

    def _load_auth(self):
        try:
            p = self._auth_path()
            if p and os.path.isfile(p):
                with open(p, 'r', encoding='utf-8') as f:
                    d = json.load(f)
                return self._norm(str(d.get('token') or ''))
        except Exception:
            pass
        return ''

    def _save_auth(self):
        try:
            p = self._auth_path()
            if p and self.token:
                with open(p, 'w', encoding='utf-8') as f:
                    json.dump({'token': self.token, 'username': self.username},
                              f, ensure_ascii=False)
        except Exception:
            pass

    @staticmethod
    def _norm(t):
        s = str(t or '').strip()
        if s.lower().startswith('bearer '):
            s = s[7:].strip()
        return s

    @staticmethod
    def _jwt_exp(tok):
        try:
            p = str(tok or '').split('.')[1]
            p += '=' * ((4 - len(p) % 4) % 4)
            d = json.loads(base64.urlsafe_b64decode(p.encode('ascii')).decode('utf-8', 'ignore'))
            return float(d.get('exp') or 0)
        except Exception:
            return 0

    def _token_ok(self):
        if not self.token:
            return False
        exp = self._jwt_exp(self.token)
        return not (exp and exp < time.time() + 60)

    def logged_in(self):
        return self._token_ok()

    def _take_token(self, j):
        d = j.get('data') if isinstance(j, dict) else None
        if isinstance(d, dict):
            return self._norm(str(d.get('token') or ''))
        return self._norm(str((j or {}).get('token') or '')) if isinstance(j, dict) else ''

    def _login(self):
        if not self.username or not self.password:
            return False
        try:
            st, txt = request_ex(
                self.api + '/auth/login', 'POST',
                body={'username': self.username, 'password': self.password},
                headers=self.hdr(), timeout=self.timeout)
            tok = self._take_token(loads(txt))
            if tok:
                self.token = tok
                self._save_auth()
                return True
        except Exception:
            pass
        return False

    def _refresh(self):
        if not self.token:
            return False
        try:
            st, txt = request_ex(self.api + '/auth/refresh', 'POST', body={},
                                 headers=self.hdr(auth=True), timeout=self.timeout)
            tok = self._take_token(loads(txt))
            if tok:
                self.token = tok
                self._save_auth()
                return True
        except Exception:
            pass
        return False

    def _ensure_token(self):
        if self._token_ok():
            exp = self._jwt_exp(self.token)
            if exp and exp - time.time() < 259200:
                self._refresh()
            return True
        if self.token and self._refresh():
            return True
        return self._login()

    # ---- HTTP / API ----
    def hdr(self, auth=False, ref=None):
        h = {'User-Agent': UA, 'Accept': 'application/json',
             'X-App-Name': self.APP_NAME, 'X-App-Version': self.APP_VERSION,
             'X-Time-Zone': self.TIME_ZONE,
             'Referer': ref or (self.host + '/'), 'Origin': self.host,
             'Accept-Encoding': 'gzip, deflate'}
        if auth and self.token:
            h['Authorization'] = 'Bearer ' + self.token
        return h

    def call(self, path, params=None, auth=False, ttl=0):
        url = self.api + path
        if params:
            url += ('&' if '?' in url else '?') + urllib.parse.urlencode(params)
        st, txt = request_ex(url, 'GET', headers=self.hdr(auth),
                             timeout=self.timeout, ttl=ttl)
        if auth and st == 401 and self._ensure_token():
            st, txt = request_ex(url, 'GET', headers=self.hdr(auth),
                                 timeout=self.timeout)
        j = loads(txt)
        if isinstance(j, dict) and 'data' in j:
            d = j.get('data')
            return d if isinstance(d, dict) else {}
        return j if isinstance(j, dict) else {}

    def card(self, it):
        try:
            if not isinstance(it, dict):
                return None
            vid = it.get('video_id') or it.get('id')
            if vid in (None, ''):
                return None
            remark = str(it.get('remarks') or '')
            if not remark:
                total = it.get('total')
                if isinstance(total, int) and total > 1:
                    remark = ('全%d集' % total) if it.get('completed') else ('更新至%d集' % total)
            return {'vod_id': str(vid),
                    'vod_name': str(it.get('title') or ''),
                    'vod_pic': str(it.get('cover_url') or ''),
                    'vod_remarks': remark}
        except Exception:
            return None

    def card_list(self, arr):
        out = []
        for it in arr or []:
            v = self.card(it)
            if v:
                out.append(v)
        return out

    def search(self, kw):
        d = self.call('/videos/search',
                     {'q': str(kw), 'page': 1, 'page_size': self.PAGE_SIZE}, ttl=30)
        items = d.get('list') if isinstance(d, dict) else []
        return self.card_list(items if isinstance(items, list) else [])

    def sections(self, vid, code):
        out, seen = [], set()
        base = '/videos/%s/sections' % urllib.parse.quote(str(vid), safe='')
        for page in range(1, 6):
            d = self.call(base, {'player_code': code, 'page': page, 'page_size': 100},
                         ttl=180)
            arr = d.get('list') if isinstance(d, dict) else []
            if not isinstance(arr, list) or not arr:
                break
            added = 0
            for s in arr:
                if not isinstance(s, dict):
                    continue
                sid = str(s.get('id') or '')
                if not sid or sid in seen:
                    continue
                seen.add(sid)
                out.append({'id': sid, 'title': str(s.get('title') or '')})
                added += 1
            if added == 0 or len(arr) < 100:
                break
        return out

    def match_lines(self, title):
        pick = search_best(self, title)
        if not pick:
            return []
        return self.lines(str(pick.get('vod_id')))

    def lines(self, vid):
        d = self.call('/videos/%s' % urllib.parse.quote(str(vid), safe=''), ttl=120)
        srcs = d.get('play_from') if isinstance(d.get('play_from'), list) else []
        if not srcs:
            srcs = [{'code': 'cychub', 'title': '默认线路'}]
        out = []
        for s in srcs[:self.MAX_LINES]:
            if not isinstance(s, dict):
                continue
            code = str(s.get('code') or '')
            if not code:
                continue
            name = clean_name(s.get('title') or code) or code
            items = []
            for i, sec in enumerate(self.sections(vid, code)):
                t = clean_name(sec.get('title')) or ('第%d集' % (i + 1))
                items.append((t, name, sec['id']))
            if items:
                out.append({'name': name, 'eps': as_lines(items)})
        return out

    def play(self, flag, pid):
        res = {'parse': 0, 'jx': 0, 'url': '', 'header': play_header(self.host)}
        raw = str(pid or '').strip()
        if not raw:
            return res
        if raw.startswith('http') or raw.startswith('//'):
            u = ('https:' + raw) if raw.startswith('//') else raw
            res['url'] = enc_url(u) if is_video(u) else u
            return res
        d = self.call('/v2/sections/%s/play-url' %
                     urllib.parse.quote(raw, safe=''), auth=True)
        u = str((d or {}).get('url') or '') if isinstance(d, dict) else ''
        if not u:
            return res
        if u.startswith('//'):
            u = 'https:' + u
        if is_ext_link(u):
            res.update({'parse': 1, 'jx': 1, 'url': u,
                        'header': play_header(self.host, u)})
        else:
            res['url'] = enc_url(u)
        return res


# ==================== 源 4：OmoFun（HTML + 聚合取流接口） ====================
class OmoFunSpider(object):
    TAG = 'om'
    HOSTS = ['https://omofun.in', 'https://omofun2.com']
    MAX_LINES = 4

    def __init__(self, cfg=None):
        cfg = cfg or {}
        self.host = str(cfg.get('omo_host') or self.HOSTS[0]).rstrip('/')
        try:
            self.timeout = float(cfg.get('timeout') or 7)
        except Exception:
            self.timeout = 7.0
        self._dead = {}

    def hdr(self, ref=None):
        return {'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Referer': ref or (self.host + '/'),
                'x-platform': 'web',
                'x-requested-with': 'XMLHttpRequest',
                'Accept-Encoding': 'gzip, deflate'}

    def get(self, path, ttl=0, valid=None):
        key = 'omo:' + path
        if ttl:
            hit = cache_get(key)
            if hit is not None:
                return hit
        hosts = [self.host] + [h for h in self.HOSTS if h != self.host]
        for h in hosts:
            if self._dead.get(h, 0) > time.time():
                continue
            st, txt = request_ex(h + path, 'GET', headers=self.hdr(h + '/'),
                                 timeout=self.timeout)
            if st and 200 <= st < 300 and txt and (not valid or valid in txt):
                self._dead.pop(h, None)
                if ttl:
                    cache_put(key, txt, ttl)
                return txt
            self._dead[h] = time.time() + 60
        return ''

    def _abs(self, u):
        if not u:
            return ''
        if str(u).startswith('http'):
            return u
        return self.host + str(u)

    def parse_items(self, html):
        out = []
        try:
            blocks = re.findall(
                r'<a href="(/vod/detail/([0-9]+)\.html)"[^>]*title="([^"]*)"[^>]*class="[^"]*module-poster-item[^"]*"[^>]*>(.*?)(?=<a href="/vod/detail/|</div>\s*<div class="module-main|<div class="module-foot|$)',
                html, re.S)
            for href, vid, title, blk in blocks:
                if not title:
                    m = re.search(r'module-poster-item-title">\s*([^<]+)', blk)
                    title = m.group(1).strip() if m else ''
                m = re.search(r'module-item-note">\s*([^<]*)', blk)
                note = m.group(1).strip() if m else ''
                m = re.search(r'data-original="([^"]+)"', blk)
                pic = m.group(1) if m else ''
                out.append({'vod_id': vid, 'vod_name': title.strip(),
                            'vod_pic': self._abs(pic), 'vod_remarks': note})
        except Exception:
            pass
        if not out:
            try:
                blocks = re.findall(
                    r'<div class="module-card-item module-item">(.*?)(?=<div class="module-card-item module-item">|$)',
                    html, re.S)
                for blk in blocks:
                    m = re.search(r'href="/vod/detail/([0-9]+)\.html"', blk)
                    if not m:
                        continue
                    m2 = re.search(r'module-card-item-title">\s*<a[^>]*>\s*<strong>([^<]+)</strong>', blk)
                    title = m2.group(1).strip() if m2 else ''
                    m3 = re.search(r'data-original="([^"]+)"', blk)
                    pic = m3.group(1) if m3 else ''
                    m4 = re.search(r'module-item-note">\s*([^<]*)', blk)
                    note = m4.group(1).strip() if m4 else ''
                    out.append({'vod_id': m.group(1), 'vod_name': title,
                                'vod_pic': self._abs(pic), 'vod_remarks': note})
            except Exception:
                pass
        return out

    def dyn(self, vid, ep):
        e = str(ep or '').strip()
        if not e.startswith('ep'):
            e = 'ep' + e
        return loads(self.get('/_dyn_plays/%s/%s' % (vid, e), ttl=180))

    def search(self, kw):
        path = '/vod/search.html?wd=%s&page=1' % urllib.parse.quote(str(kw))
        return self.parse_items(self.get(path, ttl=30, valid='/vod/'))

    def match_lines(self, title):
        pick = search_best(self, title)
        if not pick:
            return []
        return self.lines(str(pick.get('vod_id')))

    def lines(self, vid):
        html = self.get('/vod/detail/%s.html' % vid, ttl=180, valid='/vod/')
        if not html:
            return []
        eps = re.findall(
            r'<a class="module-play-list-link" href="/vod/play/([0-9]+)/ep([0-9]+)\.html"[^>]*>\s*<span>([^<]+)</span>',
            html)
        if not eps:
            eps = [(v, e, t) for v, e, t in re.findall(
                r'href="/vod/play/([0-9]+)/ep([0-9]+)\.html"[^>]*>\s*(?:<span>)?([^<]+)', html)]
        seen, ep_list = set(), []
        for v, e, t in eps:
            k = (v, e)
            if k in seen:
                continue
            seen.add(k)
            ep_list.append((v, e, clean_name(t) or '正片'))
        if not ep_list:
            ep_list = [(vid, '1', 'HD')]

        plays = self.dyn(vid, ep_list[0][1]).get('video_plays') or []
        sites = []
        for p in plays:
            if not isinstance(p, dict):
                continue
            u = p.get('play_data') or ''
            if u and is_video(u):
                s = clean_name(p.get('src_site') or '线路')
                if s and s not in sites:
                    sites.append(s)
        sites = sorted(sites)[:self.MAX_LINES] or ['OmoFun解析']
        out = []
        for s in sites:
            items = [(t, s, '%s/ep%s' % (v, e)) for v, e, t in ep_list]
            out.append({'name': s, 'eps': as_lines(items)})
        return out

    def play(self, flag, pid):
        res = {'parse': 0, 'jx': 0, 'url': '', 'header': play_header(self.host)}
        raw = str(pid or '').strip().replace('!parse', '')
        if not raw:
            return res
        parts = raw.split('/')
        if len(parts) == 2:
            vid, ep = parts
        elif len(parts) >= 3:
            vid, ep = parts[-2], parts[-1]
        else:
            return res
        plays = self.dyn(vid, ep).get('video_plays') or []
        cands = []
        for p in plays:
            if isinstance(p, dict) and p.get('play_data'):
                cands.append((clean_name(p.get('src_site') or ''), p.get('play_data')))
        pick = ''
        for s, u in cands:
            if s == flag and is_video(u):
                pick = u
                break
        if not pick:
            for s, u in cands:
                if is_video(u):
                    pick = u
                    break
        if not pick and cands:
            pick = cands[0][1]
        if pick and is_video(pick):
            res['url'] = enc_url(pick)
        else:
            res['parse'] = 1
            res['jx'] = 1
            res['url'] = pick or (self.host + '/vod/play/' + raw + '.html')
        return res


# ==================== 门面：TVBox 协议入口 ====================
class Spider(_SpiderBase):
    """首页/分类/搜索 = 稀饭动漫；详情页 = 四源线路聚合。

    线路顺序：xf > gg > cy > om。
    TVBox 默认播放第一条线路，因此该顺序同时是默认选线顺序。
    """

    LINE_ORDER = ('xf', 'gg', 'cy', 'om')      # 稀饭 → GiriGiri → 次元城 → OmoFun
    LABELS = {'xf': '稀饭', 'gg': 'GiriGiri', 'cy': '次元城', 'om': 'OmoFun'}
    MAX_LINES_PER_SRC = 4
    CACHE_TTL = 300

    # 类级兜底：有些壳只调 init() 不调 __init__()
    order = list(LINE_ORDER)
    detail_budget = 7.0
    sources = {}
    xf = None
    cy = None
    cfg = {}

    def __init__(self):
        self.cfg = {}
        self.order = list(self.LINE_ORDER)
        self.detail_budget = 7.0
        self._build({})

    def _build(self, cfg):
        self.xf = XifanSpider(cfg)
        self.cy = CycaniSpider(cfg)
        self.sources = {
            'xf': self.xf,
            'gg': GirigiriSpider(cfg),
            'cy': self.cy,
            'om': OmoFunSpider(cfg),
        }

    def _x(self):
        if self.xf is None:
            self._build({})
        return self.xf

    def init(self, extend=''):
        cfg = {}
        try:
            if isinstance(extend, dict):
                cfg = dict(extend)
            elif isinstance(extend, str) and extend.strip().startswith('{'):
                cfg = json.loads(extend)
        except Exception:
            cfg = {}
        if not isinstance(cfg, dict):
            cfg = {}
        self.cfg = cfg
        self._build(cfg)
        order = cfg.get('lines')
        if isinstance(order, (list, tuple)) and order:
            picked = [str(t).strip() for t in order
                      if str(t).strip() in self.sources]
            self.order = picked or list(self.LINE_ORDER)
        else:
            self.order = list(self.LINE_ORDER)
        try:
            self.detail_budget = max(2.0, min(20.0,
                                              float(cfg.get('detail_budget') or 7)))
        except Exception:
            self.detail_budget = 7.0
        self._probe()
        return None

    def _probe(self):
        """后台探活 xifan：它的 API 会整站超时，不能在首页路径上白等。

        探活完成前先按「不可用」处理（首页直接走 GiriGiri，约 0.8s 出内容），
        探到通了再切回 xifan 的 17 个分类。
        """
        xf = self._x()
        if xf is None:
            return
        try:
            xf.alive = False
            xf._cool = time.time() + 4.0      # 探活期间别被 health() 提前放行
        except Exception:
            return

        def run():
            try:
                # /rest/v1/ 根路径现在被 Supabase 网关挡成 403 RBAC，旧代码
                # 按 <500 判活纯属侥幸；改成真查一次 animes 表，2xx 才算活
                st, _ = request_ex(xf.api + '/rest/v1/animes?select=id&limit=1',
                                   'GET', headers=xf.hdr(), timeout=3)
                xf._mark(bool(st and 200 <= st < 300))
            except Exception:
                pass

        # 2026-11-11：探活改成同步（一次 animes 表查询 0.2s 量级）。原来走
        # 后台线程时，init 之后的第一个 homeContent 还在冷却期内，会误走
        # GiriGiri —— 单独挂「稀饭聚合」时首页分类和推荐全变成别人的。
        run()

    def getName(self):
        return '稀饭聚合'

    def destroy(self):
        pool_clear()
        return None

    def isVideoFormat(self, url):
        return is_video(url)

    def manualVideoCheck(self):
        return False

    # ---------- 首页数据：主源优先 xifan，其 API 挂了自动切 GiriGiri ----------
    def _main(self):
        xf = self._x()
        if xf is not None:
            if getattr(xf, 'alive', True):
                return xf, 'xf'
            # 冷却到期不再当场重试（那会把首页卡住 4s），改用后台探活，
            # 这次仍走 gg，探通了下一轮请求自动切回来
            if time.time() > getattr(xf, '_cool', 0):
                self._probe()
        return self.sources.get('gg') or xf, 'gg'

    def _alive(self, tag):
        """该源当前是否值得发请求（主要是 xifan 会整站超时）。"""
        if tag == 'xf':
            try:
                return bool(self._x() and getattr(self._x(), 'alive', True))
            except Exception:
                return False
        return tag in self.sources

    def _tagged(self, res, tag):
        """主源为 gg 时给列表 id 打 'g:' 前缀，详情页才能知道该回哪个源取数据。"""
        if tag != 'gg' or not isinstance(res, dict):
            return res
        for it in (res.get('list') or []):
            try:
                vid = str(it.get('vod_id') or '')
                if vid and not vid.startswith('g:'):
                    it['vod_id'] = 'g:' + vid
            except Exception:
                pass
        return res

    def homeContent(self, filter):
        src, tag = self._main()
        return src.homeContent(filter)

    def homeVideoContent(self):
        src, tag = self._main()
        return self._tagged(src.homeVideoContent(), tag)

    def categoryContent(self, tid, pg, filter, extend):
        src, tag = self._main()
        return self._tagged(src.categoryContent(tid, pg, filter, extend), tag)

    def searchContent(self, key, quick, pg='1'):
        src, tag = self._main()
        return self._tagged(src.searchContent(key, quick, pg), tag)

    # ---------- 详情：主源取基础信息 + 四源线路聚合 ----------
    def detailContent(self, ids):
        try:
            raw = str(ids[0] if isinstance(ids, (list, tuple)) and ids else (ids or ''))
            raw = raw.strip()
            # 'g:' 前缀 = 来自 GiriGiri（备用主源）；纯数字 = 来自 xifan。
            # 两个站点的 id 空间互不相通，必须靠前缀区分，否则会串片。
            by_gg = raw.startswith('g:')
            aid = re.sub(r'[^0-9]', '', raw)
            if not aid:
                return {'list': []}

            ck = 'agg3:%s:%s:%s' % ('g' if by_gg else 'x', aid, ','.join(self.order))
            hit = cache_get(ck)
            if hit is not None:
                try:
                    return json.loads(hit)
                except Exception:
                    pass

            if by_gg:
                main_tag = 'gg'
                vod, main_lines = self.sources['gg'].detail(aid)
            else:
                if not self._alive('xf'):
                    # xifan 的 API 整站超时中：历史收藏的纯数字 id 已无从解析，
                    # 直接返回空，别让详情页卡几十秒
                    return {'list': []}
                main_tag = 'xf'
                vod, main_lines = self._x().detail(aid)
                if not main_lines:
                    # 瞬时抖动（CDN 换节点 / 秒断）时重试一次；失败响应不进缓存，
                    # 因此第二次是真实重发，不会把等待翻倍到不可接受
                    time.sleep(0.2)
                    vod, main_lines = self._x().detail(aid)
            title = str(vod.get('vod_name') or '')

            # 其余三源并发按标题匹配；慢源超时即跳过，不拖累整体
            boxes = {}
            ths = []
            for tag in self.order:
                if tag == main_tag or not self._alive(tag):
                    continue
                src = self.sources.get(tag)
                if not src:
                    continue

                def work(t=tag, s=src, w=title):
                    try:
                        boxes[t] = s.match_lines(w)
                    except Exception:
                        boxes[t] = []

                if threading:
                    try:
                        th = threading.Thread(target=work)
                        th.daemon = True
                        th.start()
                        ths.append(th)
                    except Exception:
                        work()
                else:
                    work()
            deadline = time.time() + self.detail_budget
            for th in ths:
                try:
                    th.join(max(0.05, deadline - time.time()))
                except Exception:
                    pass

            cy_need_login = ('cy' in self.order and self.cy is not None
                             and not self.cy.logged_in())
            froms, urls, used, tail = [], [], {}, []
            for tag in self.order:
                # 2026-11-11：次元城播放接口强制登录，没配 cyc_* 时挂出来也是
                # 401 全坏，干脆不挂（配了账号才出现）
                if tag == 'cy' and cy_need_login:
                    continue
                lines = main_lines if tag == main_tag else (boxes.get(tag) or [])
                for line in (lines or [])[:self.MAX_LINES_PER_SRC]:
                    if not isinstance(line, dict):
                        continue
                    raw_name = str(line.get('name') or '线路')
                    base = pretty_line(tag, raw_name)
                    name = base
                    if name in used:
                        used[name] += 1
                        name = '%s·%d' % (base, used[name])
                    else:
                        used[name] = 1
                    segs = []
                    for ep in as_lines(line.get('eps')):
                        code = enc_pid(tag, ep[1], ep[2])
                        if code:
                            segs.append('%s$%s' % (ep[0] or '正片', code))
                    if not segs:
                        continue
                    # 需要壳嗅探的「网页解析」兜底线路统一排到最后
                    if '网页解析' in raw_name:
                        tail.append((name, '#'.join(segs)))
                    else:
                        froms.append(name)
                        urls.append('#'.join(segs))
            for name, joined in tail:
                froms.append(name)
                urls.append(joined)

            vod['vod_play_from'] = '$$$'.join(froms)
            vod['vod_play_url'] = '$$$'.join(urls)

            result = {'list': [vod]}
            # 只缓存序列化文本：避免把同一个可变 dict 交给壳后被改写污染缓存
            try:
                cache_put(ck, json.dumps(result, ensure_ascii=False), self.CACHE_TTL)
            except Exception:
                pass
            return result
        except Exception as e:
            global _LAST_ERR
            try:
                _LAST_ERR = '%s: %s' % (type(e).__name__, str(e)[:200])
            except Exception:
                pass
            return {'list': []}

    # ---------- 播放：按线路 tag 派发回原源 ----------
    def playerContent(self, flag, id, vipFlags):
        res = {'parse': 0, 'jx': 0, 'url': '',
               'header': play_header(self._x().host)}
        try:
            raw = str(id or '').strip()
            if not raw:
                return res
            low = raw.upper()
            if '%7C' in low or '%24' in low or '%3A' in low:
                try:
                    raw = urllib.parse.unquote(raw)
                except Exception:
                    pass
            tag, inner_flag, pid = dec_pid(raw)
            src = self.sources.get(tag) if tag else None
            if src and pid:
                return src.play(inner_flag or flag, pid)
            if raw.startswith('http') or raw.startswith('playpage:') or raw.startswith('page:'):
                return self._x().play(flag, raw)
        except Exception:
            pass
        return res

    def localProxy(self, param):
        """m3u8 相对分片改写（四源通用）"""
        try:
            url = ''
            if isinstance(param, dict):
                url = str(param.get('url') or param.get('u') or '')
            elif isinstance(param, str):
                p = param.strip()
                if p.startswith('http'):
                    url = p
                else:
                    qs = urllib.parse.parse_qs(urllib.parse.urlsplit(p).query)
                    url = str((qs.get('url') or qs.get('u') or [''])[0])
            if not url:
                return None
            st, txt = request_ex(
                url, 'GET',
                headers={'User-Agent': UA, 'Accept': '*/*',
                         'Referer': self._x().host + '/'}, timeout=8)
            if not txt or '#EXTM3U' not in txt:
                return None
            base = url.rsplit('/', 1)[0] + '/'
            out = []
            for line in txt.splitlines():
                s = line.strip()
                if not s:
                    out.append('')
                elif s.startswith('#'):
                    m = re.search(r'URI="([^"]+)"', s)
                    if m:
                        s = s.replace(m.group(1), abs_url(base, m.group(1)))
                    out.append(s)
                else:
                    out.append(abs_url(base, s))
            return [200, 'application/vnd.apple.mpegurl', NL.join(out)]
        except Exception:
            return None


# ==================== 云端自更新（发布工具自动注入，请勿手改） ====================
CODE_VERSION = '20261111.231907'
UPDATE_URL = 'https://gitee.com/tao060702/tvbox/raw/master/update_xifan.json'

import os as _upd_os
import json as _upd_json
import re as _upd_re
import time as _upd_time

_UPD_MAX = 4 * 1024 * 1024
_UPD_ONCE = []
_UPD_LAST = {}


def _upd_text(b):
    try:
        return b.decode('utf-8', 'replace') if isinstance(b, (bytes, bytearray)) else str(b or '')
    except Exception:
        return ''


def _upd_get(url, timeout=10):
    try:
        import urllib.request as _ur
        req = _ur.Request(url, headers={'User-Agent': 'tvbox-update/1.0',
                                        'Cache-Control': 'no-cache'})
        with _ur.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except Exception:
        return 0, b''


def _upd_ver(s):
    try:
        return tuple(int(x) for x in _upd_re.findall(r'\d+', str(s or '')))
    except Exception:
        return ()


def _upd_self():
    try:
        p = globals().get('__file__') or ''
        return p if p and _upd_os.path.isfile(p) else ''
    except Exception:
        return ''


def _upd_manifest(url):
    """带时间戳破缓存拉清单，失败回退原始地址（兼容签名 URL）。"""
    sep = '&' if '?' in url else '?'
    for u in ('%s%st=%d' % (url, sep, int(_upd_time.time() * 1000)), url):
        st, body = _upd_get(u, 8)
        if st == 200 and body:
            try:
                got = _upd_json.loads(_upd_text(body))
                return got if isinstance(got, dict) else {}
            except Exception:
                return {}
    return {}


def _upd_check(url=None):
    url = (url or UPDATE_URL or '').strip()
    out = {'ok': False, 'msg': ''}
    if not url:
        out['msg'] = 'no url'
        return out
    try:
        man = _upd_manifest(url)
        far = str(man.get('version') or '')
        if not far:
            out['msg'] = 'bad manifest'
            return out
        out['version'] = far
        if not _upd_ver(far) > _upd_ver(CODE_VERSION):
            out['ok'] = True
            out['msg'] = 'up to date (%s)' % CODE_VERSION
            return out
        target = str(man.get('url') or '').strip()
        base = url.rsplit('/', 1)[0] + '/'
        if not target:
            target = base + _upd_os.path.basename(_upd_self() or 'self.py')
        elif not target.startswith('http'):
            target = base + target.lstrip('/')
        st, blob = _upd_get(target, 30)
        if st != 200 or not blob:
            out['msg'] = 'download http %s' % st
            return out
        if len(blob) > _UPD_MAX:
            out['msg'] = 'too large (%d)' % len(blob)
            return out
        if b'class Spider' not in blob:
            out['msg'] = 'not a spider script'
            return out
        dest = _upd_self()
        if not dest:
            out['msg'] = 'self path unknown'
            return out
        tmp = dest + '.new'
        with open(tmp, 'wb') as f:
            f.write(blob)
        try:
            import shutil as _sh
            _sh.copyfile(dest, dest + '.bak')
        except Exception:
            pass
        _upd_os.replace(tmp, dest)
        out['ok'] = True
        out['updated'] = True
        out['msg'] = 'updated %s -> %s, restart to apply' % (CODE_VERSION, far)
        return out
    except Exception as exc:
        out['msg'] = '%s: %s' % (type(exc).__name__, exc)
        return out


def _upd_async():
    """后台线程查一次；同进程只跑一次，失败静默。"""
    if _UPD_ONCE:
        return
    _UPD_ONCE.append(1)

    def run():
        try:
            _UPD_LAST.update(_upd_check())
        except Exception:
            pass

    try:
        import threading as _th
        t = _th.Thread(target=run)
        t.daemon = True
        t.start()
    except Exception:
        try:
            run()
        except Exception:
            pass


def _upd_hook():
    """壳一般只调 init，个别只调 homeContent，两处都挂上。"""
    try:
        _oi = Spider.init
    except Exception:
        _oi = None
    if _oi is not None and not getattr(_oi, '_upd_hooked', False):
        def _init(self, *a, **kw):
            ret = _oi(self, *a, **kw)
            _upd_async()
            return ret
        _init._upd_hooked = True
        Spider.init = _init
    try:
        _oh = Spider.homeContent
    except Exception:
        _oh = None
    if _oh is not None and not getattr(_oh, '_upd_hooked', False):
        def _home(self, *a, **kw):
            _upd_async()
            return _oh(self, *a, **kw)
        _home._upd_hooked = True
        Spider.homeContent = _home


try:
    _upd_hook()
except Exception:
    pass
