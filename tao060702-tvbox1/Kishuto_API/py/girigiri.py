# -*- coding: utf-8 -*-
"""
GiriGiri爱 · 单站 TVBox / 影视仓 Python 源（自包含，仅标准库）
================================================================
站点   : ani.girigirilove.com（门面）+ m3u8.girigirilove.com（maccms 接口）
来源   : 从用户上传的「4K解析源2.py」四源聚合里按站点拆出，只保留 GiriGiri 这一路。
         不再跨站聚合，公共请求层 / 连接池 / 缓存 / 异常降级全部内联在本文件。

线路   : 站点下发 vod_play_from（cht 繁中 / chs 简中），vod_play_url 里是
         m3u8 / mp4 直链，直接交给播放器，无需二次解析。
分类   : 日漫·最新 / 日漫·热门 / 日漫·高分 / 欧美动漫（type_id 2 / 3 + orderby）
契约   : from base.spider import Spider as BaseSpider
         init / homeContent / homeVideoContent / categoryContent /
         searchContent / detailContent / playerContent

extend（JSON，全部可选）:
{
  "giri_host": "https://ani.girigirilove.com",
  "giri_api": "https://m3u8.girigirilove.com/api.php",
  "timeout": 6
}

实测（2026-11-13）: 首页 200 / 分类 24 条、total 3149 / 搜索命中 /
详情《冰剑的魔术师将要统一世界 第二季》cht 线路 22 集 / 播放取到
playlist.m3u8 直链，HTTP 200 application/vnd.apple.mpegurl。
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
            # 2026-11-13 实测：本接口的关键词参数是 wd，塞 vod_name 一律 total=0；
            # 搜索时带 type_id（哪怕空串）同样会返回 total=0，必须去掉。
            q['wd'] = str(kw).strip()
            q['vod_name'] = ''
            q.pop('type_id', None)
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


# ==================== 门面：单站 TVBox 协议入口 ====================
class Spider(_SpiderBase):
    """只跑 GiriGiri爱 一个站。

    vod_id 统一加 'g:' 前缀（与四源聚合源保持一致，纯数字 id 也照样认），
    这样以前在聚合源里收藏的条目换到本文件后详情仍能打开。
    """

    NAME = 'GiriGiri爱'
    MAX_LINES = 4
    CACHE_TTL = 180

    cfg = {}
    site = None

    def __init__(self):
        self.cfg = {}
        self._build({})

    def _build(self, cfg):
        self.site = GirigiriSpider(cfg or {})

    def _s(self):
        if self.site is None:
            self._build(self.cfg or {})
        return self.site

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
        return None

    def getName(self):
        return self.NAME

    def destroy(self):
        pool_clear()
        return None

    def isVideoFormat(self, url):
        return is_video(url)

    def manualVideoCheck(self):
        return False

    # ---------- 列表三条链路 ----------
    def homeContent(self, filter=False):
        try:
            return self._s().homeContent(filter)
        except Exception:
            return {'class': [], 'filters': {}}

    def homeVideoContent(self):
        try:
            return self._s().homeVideoContent()
        except Exception:
            return {'list': []}

    def categoryContent(self, tid, pg, filter, extend):
        try:
            return self._s().categoryContent(tid, pg, filter, extend)
        except Exception:
            return {'list': [], 'page': 1, 'pagecount': 1, 'total': 0}

    def searchContent(self, key, quick, pg='1'):
        try:
            return self._s().searchContent(key, quick, pg)
        except Exception:
            return {'list': [], 'page': 1, 'pagecount': 1, 'total': 0}

    # ---------- 详情：站点自带 maccms 直链 ----------
    def detailContent(self, ids):
        global _LAST_ERR
        try:
            raw = ids[0] if isinstance(ids, (list, tuple)) and ids else ids
            raw = str(raw or '').strip()
            aid = re.sub(r'[^0-9]', '', raw)
            if not aid:
                return {'list': []}

            ck = 'gg1:%s' % aid
            hit = cache_get(ck)
            if hit is not None:
                try:
                    return json.loads(hit)
                except Exception:
                    pass

            vod, lines = self._s().detail(aid)
            froms, urls, used = [], [], {}
            for line in (lines or [])[:self.MAX_LINES]:
                if not isinstance(line, dict):
                    continue
                base = clean_name(line.get('name') or '线路') or '线路'
                name = base
                if name in used:
                    used[name] += 1
                    name = '%s·%d' % (base, used[name])
                else:
                    used[name] = 1
                segs = []
                for ep in as_lines(line.get('eps')):
                    if ep[2]:
                        segs.append('%s$%s' % (ep[0] or '正片', ep[2]))
                if segs:
                    froms.append(name)
                    urls.append('#'.join(segs))

            vod['vod_play_from'] = '$$$'.join(froms)
            vod['vod_play_url'] = '$$$'.join(urls)
            result = {'list': [vod]}
            try:
                cache_put(ck, json.dumps(result, ensure_ascii=False), self.CACHE_TTL)
            except Exception:
                pass
            return result
        except Exception as e:
            try:
                _LAST_ERR = '%s: %s' % (type(e).__name__, str(e)[:200])
            except Exception:
                pass
            return {'list': []}

    # ---------- 播放 ----------
    def playerContent(self, flag, id, vipFlags):
        res = {'parse': 0, 'jx': 0, 'url': '',
               'header': play_header(self._s().host)}
        try:
            raw = str(id or '').strip()
            if not raw:
                return res
            low = raw.upper()
            if '%7C' in low or '%24' in low or '%3A' in low or '%25' in low:
                try:
                    raw = urllib.parse.unquote(raw)
                except Exception:
                    pass
            return self._s().play(flag, raw) or res
        except Exception:
            return res

    def localProxy(self, param):
        """m3u8 相对分片改写，片源分片是相对路径时用得上。"""
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
                         'Referer': self._s().host + '/'}, timeout=8)
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
