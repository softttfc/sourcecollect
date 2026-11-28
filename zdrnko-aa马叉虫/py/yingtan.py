# -*- coding: utf-8 -*-
import base64
import json
import os
import re
import time
import urllib.parse

import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

try:
    from base.spider import Spider
except ImportError:
    import sys
    sys.path.append('..')
    from base.spider import Spider

KEY = 'yingtan4k'
HOST = 'http://cms.lyyytv.cn'
CMS_KEY = 'wP5bvxoc3yv7FoBQENFZuAF0EUYr4LTy'
PARSE_API = 'http://fys.lyyytv.cn/api/index?appid=10001&videoUrl='
# PARSE_API = 'http://4kzj.lyyytv.cn/api/index?appid=10001&videoUrl='
# PARSE_API = 'http://jwh.lcytv.cn/api/index?parsesId=2&appid=10001&videoUrl='
PARSE_ID_MIN = 1
PARSE_ID_MAX = 20
CMS_DOMAINS = (HOST,)
PARSE_APIS = (PARSE_API,)
HOST_TRY_LIMIT = 5
HOST_FAIL_THRESHOLD = 2
HOST_COOLDOWN = 300
PARSE_TIMEOUT = 5
PARSE_BUDGET = 18
PARSE_BACKOFF = 0.15
CMS_TIMEOUT = 10
CMS_RETRIES = 2
CMS_BUDGET = 16

HEADERS = {'User-Agent': 'okhttp/4.12.0'}
PARSE_HEADERS = {'User-Agent': 'okhttp/4.12.0', 'Accept-Encoding': 'identity'}
DEC_PREFIX = 'https://baidu.con/'
WEB_TTL = 5
K4_TTL = 180
STREAM_TTL = 10
FALLBACK_TTL = 60
PROBE_TIMEOUT = 3
CACHE_MAX_ENTRIES = 500
CACHE_SAVE_INTERVAL = 10

# ---- 可选：远程热修配置（留空则完全使用本地内置值）----
#   {"parse_api": "http://fys.lyyytv.cn/api/index?appid=10001&videoUrl=",
#    "cms_domains": ["http://cms.lyyytv.cn"],
#    "parse_apis": ["http://fys.lyyytv.cn/api/index?appid=10001&videoUrl="],
#    "pid_min": 1, "pid_max": 20, "web_ttl": 5, "k4_ttl": 180, "parse_timeout": 5}
REMOTE_CONFIG_URL = ''
REMOTE_CONFIG_TTL = 600

PAGE_LIMIT = 20
FILTER_NAMES = {
    'class': '类型', 'area': '地区', 'lang': '语言', 'year': '年份',
    'letter': '字母', 'by': '排序', 'sort': '顺序',
}
HOME_CACHE_TTL = 6 * 3600
LOCAL_INDEX_TTL = 6 * 3600

_BASE64_RE = re.compile(r'(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?')
_LDMAX_RE = re.compile(r'^https?://ldmax\.cooom/', re.I)
_MEDIA_RE = re.compile(r'\.(?:mp4|m3u8?|flv|avi|mkv|ts|mov|wmv|webm|m4v|mpd)$', re.I)
_STREAM_RE = re.compile(r'\.(?:m3u8?|mpd)$', re.I)
_4K_HOST_RE = re.compile(r'(?:^|\.)(?:ym4kjx|hd4kjx|sd4kjx|mm4kjx|mv4kjx|vk4kjx)\.lyyytv\.cn$', re.I)
_PUNCT_RE = re.compile(r'[\s\u3000·・:：,，、。．.！!？?（）()【】\[\]{}<>《》"\'~～—\-_/|]+')
_WORD_RE = re.compile(u'[A-Za-z0-9\u4e00-\u9fff]')

_home_cache = {}
_play_cache = {}
_last_cache_save = 0.0
_local_index = {'exp': 0.0, 'items': []}

def text(value):
    return '' if value is None else str(value).strip()


def page_of(value):
    m = re.match(r'\s*[+-]?\d+', '' if value is None else str(value))
    n = int(m.group(0)) if m else 0
    return max(1, n) if n else 1


def list_of(value):
    return value if isinstance(value, list) else []


def object_of(value):
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except Exception:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def norm_key(value):
    s = text(value)
    if not s:
        return ''
    chars = []
    for ch in s:
        code = ord(ch)
        if code == 0x3000:
            chars.append(' ')
        elif 0xFF01 <= code <= 0xFF5E:
            chars.append(chr(code - 0xFEE0))
        else:
            chars.append(ch)
    s = ''.join(chars).lower()
    return _PUNCT_RE.sub('', s)


def _step_state(updates):
    path = _state_file_path()
    if not path or not updates:
        return
    try:
        data = {}
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = object_of(f.read()) or {}
            except Exception:
                data = {}
        data.update(updates)
        tmp = path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, path)
    except Exception:
        pass


class EndpointHealth(object):
    def __init__(self, endpoints, fail_threshold=2, cooldown=300):
        self.threshold = fail_threshold
        self.cooldown = cooldown
        self._s = {}
        for e in endpoints:
            self._s[e] = {'ok': 0, 'fail': 0, 'open_until': 0.0, 'last_ok': 0.0, 'last_fail': 0.0}

    def _slot(self, pid):
        return self._s.setdefault(
            pid, {'ok': 0, 'fail': 0, 'open_until': 0.0, 'last_ok': 0.0, 'last_fail': 0.0})

    def ok(self, pid, latency=0.0):
        s = self._slot(pid)
        s['ok'] += 1
        s['fail'] = 0
        s['open_until'] = 0.0
        s['last_ok'] = time.time()

    def fail(self, pid, weight=1):
        s = self._slot(pid)
        s['fail'] += max(1, int(weight))
        s['last_fail'] = time.time()
        if s['fail'] >= self.threshold:
            s['open_until'] = time.time() + self.cooldown

    def available(self):
        now = time.time()
        items = [(pid, s) for pid, s in self._s.items() if s['open_until'] <= now]
        items.sort(key=lambda kv: (-kv[1]['ok'], kv[1]['fail'], -kv[1]['last_ok'], kv[0]))
        return [pid for pid, _ in items]

    def cooling(self):
        now = time.time()
        items = [(pid, s) for pid, s in self._s.items() if s['open_until'] > now]
        items.sort(key=lambda kv: kv[1]['open_until'])
        return [pid for pid, _ in items]

    def report(self):
        lines = []
        for pid in sorted(self._s):
            s = self._s[pid]
            state = ('熔断中(%ds)' % int(max(0, s['open_until'] - time.time()))
                     if s['open_until'] > time.time() else '可用')
            lines.append('pid%-2d ok=%d fail=%d %s' % (pid, s['ok'], s['fail'], state))
        return '\n'.join(lines)

    # --- 持久化：热启动不用再从 pid1 扫 ---
    def export(self):
        return dict((str(pid), {'ok': s['ok'], 'fail': s['fail']})
                    for pid, s in self._s.items())

    def load(self, data):
        if not isinstance(data, dict):
            return
        for key, val in data.items():
            try:
                pid = int(key)
            except (TypeError, ValueError):
                continue
            if not isinstance(val, dict):
                continue
            s = self._slot(pid)
            try:
                s['ok'] = max(s['ok'], int(val.get('ok') or 0))
                s['fail'] = max(s['fail'], int(val.get('fail') or 0))
            except (TypeError, ValueError):
                continue


class RemoteConfig(object):
    def __init__(self, url='', defaults=None, ttl=600):
        self.url = text(url)
        self.defaults = dict(defaults or {})
        self.ttl = ttl
        self._cfg = dict(self.defaults)
        self._updated = 0.0

    def refresh(self, force=False):
        if not self.url:
            return False
        now = time.time()
        if not force and now - self._updated < self.ttl:
            return False
        self._updated = now
        try:
            data = requests.get(self.url, timeout=8).json()
            if isinstance(data, dict) and data:
                merged = dict(self.defaults)
                merged.update(data)
                self._cfg = merged
                return True
        except Exception:
            pass
        return False

    def set_local(self, key, value):
        self._cfg[key] = value
        self.defaults[key] = value

    def get(self, key, default=None):
        self.refresh()
        if key in self._cfg and self._cfg[key] is not None:
            return self._cfg[key]
        return self.defaults.get(key, default)


_cfg = RemoteConfig(REMOTE_CONFIG_URL, {
    'parse_api': PARSE_API,
    'pid_min': PARSE_ID_MIN,
    'pid_max': PARSE_ID_MAX,
    'parse_timeout': PARSE_TIMEOUT,
    'web_ttl': WEB_TTL,
    'k4_ttl': K4_TTL,
}, ttl=REMOTE_CONFIG_TTL)


def _int_cfg(key, default, low=None, high=None):
    try:
        value = int(_cfg.get(key, default))
    except (TypeError, ValueError):
        return default
    if low is not None and value < low:
        return default
    if high is not None and value > high:
        return default
    return value


def _pid_pool():
    lo = _int_cfg('pid_min', PARSE_ID_MIN, 1, 99)
    hi = _int_cfg('pid_max', PARSE_ID_MAX, 1, 99)
    if hi < lo:
        lo, hi = hi, lo
    return tuple(range(lo, hi + 1))


_health_web = EndpointHealth(_pid_pool(), 2, 300)
_health_4k = EndpointHealth(_pid_pool(), 2, 300)

class HostPool(object):
    PREFIXES = ('www', 'api', 'cms', 'fys', 'm', 'v')

    def __init__(self, name, urls, cfg_key='', state_file='', allow_derive=True):
        self.name = name
        self.cfg_key = cfg_key
        self.state_file = state_file
        self.allow_derive = allow_derive
        self._urls = [text(u) for u in urls if text(u)]
        self._s = {}
        self._good = ''

    def add(self, urls):
        for u in list_of(urls):
            u = text(u)
            if u and u not in self._urls:
                self._urls.append(u)

    def _slot(self, url):
        return self._s.setdefault(url, {'ok': 0, 'fail': 0, 'last_ok': 0.0, 'bad_until': 0.0})

    def ok(self, url):
        s = self._slot(url)
        s['ok'] += 1
        s['fail'] = 0
        s['bad_until'] = 0.0
        s['last_ok'] = time.time()
        if url != self._good:
            self._good = url
            self._save_state()

    def fail(self, url):
        s = self._slot(url)
        s['fail'] += 1
        if s['fail'] >= HOST_FAIL_THRESHOLD:
            s['bad_until'] = time.time() + HOST_COOLDOWN
            if url == self._good:
                self._good = ''
                self._save_state()

    def good(self):
        return self._good

    def set_good(self, url):
        url = text(url)
        if url.startswith(('http://', 'https://')):
            self._good = url

    def _all(self):
        urls = list(self._urls)
        if self.cfg_key:
            extra = _cfg.get(self.cfg_key, None)
            if isinstance(extra, (list, tuple)):
                for u in extra:
                    u = text(u)
                    if u and u not in urls:
                        urls.append(u)
        return urls

    def _derive(self, sample):
        try:
            parsed = urllib.parse.urlparse(text(sample))
        except Exception:
            return []
        host = parsed.hostname or ''
        parts = host.split('.')
        if len(parts) < 2:
            return []
        root = '.'.join(parts[-2:])
        out = []
        for pre in self.PREFIXES:
            if pre == parts[0]:
                continue
            url = '%s://%s.%s' % (parsed.scheme or 'http', pre, root)
            if parsed.path and parsed.path != '/':
                url += parsed.path
            if parsed.query:
                url += '?' + parsed.query
            out.append(url)
        return out

    def candidates(self, limit=None):
        base = self._all()
        if not base:
            return []
        now = time.time()
        ordered = []
        if self._good:
            ordered.append(self._good)
        rest = [u for u in base if u != self._good]
        rest.sort(key=lambda u: (self._slot(u)['bad_until'] > now,
                                 -self._slot(u)['ok'],
                                 self._slot(u)['fail'],
                                 -self._slot(u)['last_ok']))
        ordered.extend(rest)
        if self.allow_derive:
            for u in self._derive(base[0]):
                if u not in ordered:
                    ordered.append(u)
        limit = HOST_TRY_LIMIT if limit is None else limit
        return ordered[:max(1, limit)]

    def report(self):
        lines = ['%s（上次可用：%s）' % (self.name, self._good or '无')]
        for url in self._all():
            s = self._slot(url)
            state = '冷却中' if s['bad_until'] > time.time() else '可用'
            lines.append('  %s ok=%d fail=%d %s' % (url, s['ok'], s['fail'], state))
        return '\n'.join(lines)

    def _save_state(self):
        _step_state({'%s_good' % self.name: self._good})

    def load_state(self):
        path = self.state_file
        if not path:
            return
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = object_of(f.read()) or {}
            self.set_good(text(data.get('%s_good' % self.name)))
        except Exception:
            pass


def _state_file_path():
    try:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), '.yingtan4k_hosts.json')
    except Exception:
        return ''


_cms_hosts = HostPool('cms', CMS_DOMAINS, 'cms_domains', _state_file_path())
_parse_hosts = HostPool('parse', PARSE_APIS, 'parse_apis', _state_file_path())


def _cms_base(url):
    url = text(url)
    if not url:
        return ''
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url
    return url.rstrip('/')


def _api_base(url):
    url = text(url)
    if not url:
        return ''
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url
    if 'videoUrl=' in url:
        return url
    return url.rstrip('/') + '/api/index?appid=10001&videoUrl='

def _cache_file_path():
    try:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), '.yingtan4k_play_cache.json')
    except Exception:
        return ''


def load_play_cache():
    path = _cache_file_path()
    if not path:
        return
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return
    if not isinstance(data, dict):
        return
    now = time.time()
    for key, item in data.items():
        try:
            if isinstance(item, dict):
                exp, url = float(item.get('exp') or 0), text(item.get('url'))
                pid = item.get('pid') if isinstance(item.get('pid'), int) else None
                kind = text(item.get('kind')) or 'web'
            elif isinstance(item, (list, tuple)) and len(item) >= 2:
                exp, url = float(item[0]), text(item[1])
                pid = item[2] if len(item) >= 3 and isinstance(item[2], int) else None
                kind = 'web'
            else:
                continue
            if exp > now and url:
                _play_cache[text(key)] = {'exp': exp, 'url': url, 'pid': pid, 'kind': kind}
        except Exception:
            continue


def save_play_cache(force=False):
    global _last_cache_save
    now = time.time()
    if not force and now - _last_cache_save < CACHE_SAVE_INTERVAL:
        return
    _last_cache_save = now
    path = _cache_file_path()
    if not path:
        return
    try:
        alive = {}
        for key, item in list(_play_cache.items()):
            if item['exp'] > now and item['url']:
                alive[key] = item
        if len(alive) > CACHE_MAX_ENTRIES:
            ordered = sorted(alive.items(), key=lambda kv: kv[1]['exp'], reverse=True)[:CACHE_MAX_ENTRIES]
            alive = dict(ordered)
        tmp = path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(alive, f, ensure_ascii=False)
        os.replace(tmp, path)
    except Exception:
        pass

    try:
        _step_state({
            'pid_web': _health_web.export(),
            'pid_4k': _health_4k.export(),
        })
    except Exception:
        pass


def probe_alive(url):

    if not is_http_url(url):
        return False
    try:
        rsp = requests.get(url, headers=dict(PARSE_HEADERS, Range='bytes=0-1'),
                           timeout=PROBE_TIMEOUT, allow_redirects=True, stream=True)
        code = rsp.status_code
        alive = code not in (403, 404, 405, 410)
        ctype = text(rsp.headers.get('Content-Type')).lower()
        if alive and 'html' in ctype:
            alive = False
        rsp.close()
        return alive
    except Exception:
        return True


def get_cached(key, kind):
    item = _play_cache.get(key)
    if not item:
        return None
    if item['exp'] <= time.time() or not item['url']:
        _play_cache.pop(key, None)
        return None
    if item['kind'] == '4k' and kind == '4k' and not probe_alive(item['url']):
        print('影探4K：4K 缓存直链已失效，作废缓存并重新换链')
        _play_cache.pop(key, None)
        save_play_cache(force=True)
        return None
    return item['url']


def put_cache(key, url, kind, pid=None, ttl=None):
    if not key or not url:
        return
    if ttl is None:
        ttl = {'web': WEB_TTL, '4k': K4_TTL, 'stream': STREAM_TTL, 'fallback': FALLBACK_TTL}.get(kind, WEB_TTL)
    _play_cache[key] = {'exp': time.time() + ttl, 'url': url, 'pid': pid, 'kind': kind}
    save_play_cache()


def get_json(url, headers=None, timeout=12, retries=CMS_RETRIES):
    headers = HEADERS if headers is None else headers
    last = ''
    for attempt in range(max(1, retries)):
        if attempt:
            time.sleep(0.3 * attempt)
        try:
            rsp = requests.get(url, headers=headers, timeout=max(2, timeout), allow_redirects=True)
            if rsp.status_code >= 500:
                last = 'HTTP %s' % rsp.status_code
                continue
            data = object_of(rsp.text)
            if data:
                return data
            last = 'HTTP %s 空响应' % rsp.status_code
        except Exception as e:
            last = '%s: %s' % (e.__class__.__name__, str(e)[:60])
    raise Exception('影探4K：接口未返回有效 JSON（%s）' % last)


def cms(path, params=None):
    params = params or {}
    query = urllib.parse.urlencode(params)
    last = ''
    deadline = time.time() + CMS_BUDGET
    for base in _cms_hosts.candidates():
        base = _cms_base(base)
        if not base:
            continue
        remain = deadline - time.time()
        if remain <= 1.5:
            last = last or '预算用尽'
            break
        try:
            data = get_json('%s/api.php/app/%s?%s' % (base, path, query),
                            timeout=min(CMS_TIMEOUT, remain), retries=CMS_RETRIES)
        except Exception as e:
            last = '%s → %s' % (base, str(e)[:70])
            _cms_hosts.fail(base)
            continue
        _cms_hosts.ok(base)
        code = data.get('code')
        if code is not None:
            try:
                ok = int(code) in (1, 200)
            except (TypeError, ValueError):
                ok = False
            if not ok:
                raise Exception('影探4K：CMS 请求失败（code=%s）' % code)
        return data
    raise Exception('影探4K：CMS 域名全部不可用（%s）' % last)

def decode_base64(value):
    clean = re.sub(r'\s+', '', text(value))
    if not clean or not _BASE64_RE.fullmatch(clean):
        return None
    try:
        return base64.b64decode(clean)
    except Exception:
        return None


def decrypt_lvdou(value):
    original = text(value)
    if not original.startswith('lvdou+'):
        return original
    if not CMS_KEY:
        return original
    try:
        encrypted = decode_base64(original[6:])
        if not encrypted:
            return original
        key = CMS_KEY[:16].encode('utf-8')
        iv = CMS_KEY[16:32].encode('utf-8') if len(CMS_KEY) >= 32 else key
        cipher = AES.new(key, AES.MODE_CBC, iv)
        plain = unpad(cipher.decrypt(encrypted), AES.block_size)
        result = plain.decode('utf-8', errors='replace').strip()
        if result.startswith('http'):
            return result
    except Exception:
        pass
    return original


def is_http_url(value):
    try:
        parsed = urllib.parse.urlparse(text(value))
        return parsed.scheme in ('http', 'https') and bool(parsed.netloc)
    except Exception:
        return False


def is_ldmax_url(value):
    return bool(_LDMAX_RE.match(text(value)))


def decrypt_ldmax(value, depth=0):
    if depth > 5:
        return ''
    url = text(value)
    decoded = decode_base64(url)
    if decoded:
        url = re.sub(r'\s+', '', decoded.decode('utf-8', errors='replace'))
    if not is_ldmax_url(url):
        return url
    path = _LDMAX_RE.sub('', url)
    if len(path) <= 16:
        return ''
    try:
        key = path[:16][::-1].encode('utf-8')
        encrypted = decode_base64(path[16:])
        if not encrypted or len(encrypted) % 16:
            return ''
        cipher = AES.new(key, AES.MODE_CBC, key)
        plain = bytearray(cipher.decrypt(encrypted))
        pad = plain[-1]
        if 0 < pad <= 16:
            del plain[-pad:]
        result = bytes(plain).decode('utf-8', errors='replace').strip()
        return decrypt_ldmax(result, depth + 1) if is_ldmax_url(result) else result
    except Exception:
        return ''


def find_url(value):
    if not isinstance(value, dict):
        return ''
    for key in ('url', 'playUrl', 'link'):
        v = value.get(key)
        if v:
            return text(v)
    return find_url(value.get('data'))


def resolve_parse(body):

    body = text(body)
    if not body:
        return ''

    candidate = body
    if body.startswith('{'):
        try:
            parsed = json.loads(body)
            found = find_url(parsed)
            if found:
                candidate = found
        except Exception:
            pass
    candidate = candidate.strip().strip('"\'')

    if candidate.startswith(DEC_PREFIX):
        rest = candidate[len(DEC_PREFIX):]
        if len(rest) <= 16:
            return ''
        key = rest[:16].encode('utf-8')
        cipher_b64 = rest[16:]
        try:
            encrypted = base64.b64decode(cipher_b64, validate=False)
            cipher = AES.new(key, AES.MODE_CBC, key)
            plain = unpad(cipher.decrypt(encrypted), AES.block_size)
            result = plain.decode('utf-8', errors='replace').strip()
            if result.startswith('http'):
                return result
        except Exception:
            pass
        try:
            raw = cipher_b64.encode('latin-1', errors='ignore')
            if raw and len(raw) % 16 == 0:
                cipher = AES.new(key, AES.MODE_CBC, key)
                plain = unpad(cipher.decrypt(raw), AES.block_size)
                result = plain.decode('utf-8', errors='replace').strip()
                if result.startswith('http'):
                    return result
        except Exception:
            pass
        return ''

    return candidate


def parse_one(raw, pid, api=None):
    api = _api_base(api) if api else _api_base((_parse_hosts.candidates(1) or [PARSE_API])[0])
    if not api:
        api = PARSE_API
    timeout = _int_cfg('parse_timeout', PARSE_TIMEOUT, 2, 30)
    target = '%s%s&parsesId=%d' % (api, urllib.parse.quote(raw, safe="!'()*"), pid)
    try:
        rsp = requests.get(target, headers=PARSE_HEADERS, timeout=timeout)
    except Exception as e:
        return '', '%s: %s' % (e.__class__.__name__, str(e)[:60]), False
    if rsp.status_code != 200:
        return '', 'HTTP %s' % rsp.status_code, True
    body = text(rsp.text)
    if not body:
        return '', '空响应', True
    try:
        resolved = resolve_parse(body)
    except Exception as e:
        return '', '解码异常 %s' % str(e)[:40], True
    if resolved and resolved.startswith('http'):
        return resolved, '', True
    return '', '响应无效(%s)' % body[:60].replace('\n', ' '), True


def resolve_cascade(raw, kind):
    if not raw:
        return '', []
    health = _health_4k if kind == '4k' else _health_web
    for pid in _pid_pool():
        health._slot(pid)

    reasons = []
    tried = set()
    deadline = time.time() + PARSE_BUDGET
    pid_pool = list(_pid_pool())
    api_alive = [False]

    def attempt(pid, api, tag):
        t0 = time.time()
        resolved, reason, responded = parse_one(raw, pid, api)
        if responded:
            api_alive[0] = True
        if resolved:
            health.ok(pid, time.time() - t0)
            return resolved
        weight = 2 if reason.startswith(('HTTP 5', 'HTTP 4')) else 1
        health.fail(pid, weight)
        reasons.append('%spid%d:%s' % (tag, pid, reason))
        if weight == 1 and PARSE_BACKOFF:
            time.sleep(PARSE_BACKOFF)
        return ''

    apis = _parse_hosts.candidates() or [PARSE_API]
    for index, api in enumerate(apis):
        if time.time() > deadline:
            reasons.append('预算用尽，剩余 %d 个接口域名未试' % (len(apis) - index))
            break
        api = _api_base(api)
        if not api:
            continue
        tag = '' if len(apis) == 1 else '[%s]' % (urllib.parse.urlparse(api).hostname or 'api')
        api_alive[0] = False

        for pid in health.available() or pid_pool:
            if time.time() > deadline:
                reasons.append('预算用尽，pid 扫描中断')
                break
            tried.add(pid)
            resolved = attempt(pid, api, tag)
            if resolved:
                _parse_hosts.ok(api)
                return resolved, reasons
        for pid in [p for p in health.cooling() if p not in tried]:
            if time.time() > deadline:
                reasons.append('预算用尽，熔断源未复测')
                break
            tried.add(pid)
            resolved = attempt(pid, api, tag)
            if resolved:
                _parse_hosts.ok(api)
                return resolved, reasons
        if api_alive[0]:
            _parse_hosts.ok(api)
            break
        _parse_hosts.fail(api)
        tried.clear()

    return '', reasons


def is_media_url(url):
    if not is_http_url(url):
        return False
    return bool(_MEDIA_RE.search(urllib.parse.urlparse(text(url)).path))


def is_stream_url(url):
    if not is_http_url(url):
        return False
    return bool(_STREAM_RE.search(urllib.parse.urlparse(text(url)).path))


def is_4k_source(url):
    if not is_http_url(url):
        return False
    host = (urllib.parse.urlparse(text(url)).hostname or '').lower()
    if host and _4K_HOST_RE.search(host):
        return True
    return is_media_url(url) and not is_stream_url(url)


def single_page(items, page=1):
    lst = list_of(items)
    return {
        'list': lst,
        'page': 1,
        'pagecount': 1,
        'limit': len(lst) if lst else PAGE_LIMIT,
        'total': len(lst),
    }


def _search_items(wd):
    if not wd:
        return []
    data = cms('search', {'text': wd, 'pg': '1'})
    out = []
    for item in list_of(data.get('list')):
        if not isinstance(item, dict) or item.get('vod_id') is None:
            continue
        out.append(dict((k, v) for k, v in item.items() if k != 'type'))
    return out


def _rank_items(items, norm):
    def score(item):
        name = norm_key(item.get('vod_name'))
        if name == norm:
            return 0
        if name.startswith(norm):
            return 1
        if norm and norm in name:
            return 2
        return 3
    try:
        return sorted(items, key=score)
    except Exception:
        return items


def _dedupe(items):
    seen = set()
    out = []
    for item in items:
        vid = text(item.get('vod_id'))
        if not vid or vid in seen:
            continue
        seen.add(vid)
        out.append(item)
    return out


def local_index():
    now = time.time()
    if _local_index['exp'] > now:
        return _local_index['items']
    items = []
    try:
        items.extend(list_of(home_vod().get('list')))
    except Exception:
        pass
    try:
        classes = [c.get('type_id') for c in list_of(home('').get('class'))[:8] if c.get('type_id')]
        for tid in classes:
            try:
                data = cms('video', {'tid': str(tid), 'pg': '1', 'limit': str(PAGE_LIMIT)})
                items.extend(list_of(data.get('list')))
            except Exception:
                continue
    except Exception:
        pass
    cleaned = _dedupe([dict((k, v) for k, v in i.items() if k != 'type')
                       for i in list_of(items) if isinstance(i, dict) and i.get('vod_id') is not None])
    _local_index['items'] = cleaned
    _local_index['exp'] = time.time() + LOCAL_INDEX_TTL
    return cleaned


def search(key, pg):
    wd = text(key)
    page = page_of(pg)
    if not wd:
        return single_page([], page)
    if page > 1:
        return single_page([], page)

    items = []
    try:
        items = _search_items(wd)
    except Exception as e:
        print('影探4K：CMS 搜索异常，转本地索引（%s）' % str(e)[:60])

    norm = norm_key(wd)
    if not items and norm and norm != wd.lower():
        try:
            items = _search_items(norm)
        except Exception:
            items = []

    if not items and len(norm) > 2:
        prefix = norm[:max(2, len(norm) // 2)]
        try:
            wide = _search_items(prefix)
        except Exception:
            wide = []
        items = [i for i in wide if norm in norm_key(i.get('vod_name'))]

    if not items and norm:
        try:
            items = [i for i in local_index() if norm in norm_key(i.get('vod_name'))]
        except Exception:
            items = []

    items = _rank_items(_dedupe(items), norm)
    return single_page(items, page)

def home(extend=''):
    cache_key = '%s_home_%s' % (KEY, text(extend))
    cached = _home_cache.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]
    data = cms('nav', {'token': ''})
    classes = []
    filters = {}
    seen_ids = set()
    for item in list_of(data.get('list')):
        if not isinstance(item, dict):
            continue
        if item.get('type_id') is None or not text(item.get('type_name')):
            continue
        tid = text(item['type_id'])
        if tid in seen_ids:
            continue
        seen_ids.add(tid)
        name = text(item['type_name'])
        if not _WORD_RE.search(name):
            name = '分类%s' % tid
        classes.append({'type_id': tid, 'type_name': name})
        ext = object_of(item.get('type_extend'))
        groups = []
        for key, label in FILTER_NAMES.items():
            values = [v for v in (text(x) for x in text(ext.get(key)).split(',')) if v]
            values = list(dict.fromkeys(values))
            if values:
                groups.append({
                    'key': key,
                    'name': label,
                    'init': '',
                    'value': [{'n': '全部', 'v': ''}] + [{'n': v, 'v': v} for v in values],
                })
        if groups:
            filters[tid] = groups
    result = {'class': classes, 'filters': filters}
    if classes:
        _home_cache[cache_key] = (time.time() + HOME_CACHE_TTL, result)
    return result


def home_vod():
    data = cms('index_video', {'token': ''})
    vlist = []
    for item in list_of(data.get('list')):
        if isinstance(item, dict):
            vlist.extend(list_of(item.get('vlist')))
    return {'list': vlist}


def paginated(data, requested_page):
    lst = list_of(data.get('list'))
    raw_page = data.get('page')
    page = page_of(raw_page if raw_page is not None else requested_page)
    try:
        limit = int(data.get('limit') or 0)
    except (TypeError, ValueError):
        limit = 0
    if limit <= 0:
        limit = PAGE_LIMIT
    try:
        raw_pagecount = int(data.get('pagecount') or 0)
    except (TypeError, ValueError):
        raw_pagecount = 0
    has_pagecount = raw_pagecount > 0
    pagecount = raw_pagecount if has_pagecount else page
    try:
        raw_total = data.get('total')
        has_total = raw_total is not None and int(raw_total) >= 0
    except (TypeError, ValueError):
        has_total = False
    if has_pagecount and has_total:
        total = int(data.get('total'))
    else:
        total = (page - 1) * limit + len(lst)
    data['page'] = page
    data['pagecount'] = pagecount
    data['limit'] = limit
    data['total'] = total
    data['list'] = lst
    return data


def category(tid, pg, extend):
    page = page_of(pg)
    tid = text(tid)
    if not tid:
        return paginated({'list': []}, page)
    extend = extend if isinstance(extend, dict) else {}
    params = {'tid': tid, 'pg': str(page), 'limit': str(PAGE_LIMIT)}
    for key in FILTER_NAMES:
        value = text(extend.get(key))
        if value and value != 'all':
            params[key] = value
    return paginated(cms('video', params), page)


def playlist(value):
    parts = []
    for entry in text(value).split('#'):
        sep = entry.find('$')
        if sep <= 0 or not text(entry[sep + 1:]):
            continue
        parts.append('%s$%s' % (text(entry[:sep]), decrypt_lvdou(entry[sep + 1:])))
    return '#'.join(parts)


def detail(ids):
    if not isinstance(ids, (list, tuple)):
        ids = [ids]
    lst = []
    for vid in ids:
        vid = text(vid)
        if not vid:
            continue
        data = cms('video_detail', {'id': vid}).get('data')
        if not isinstance(data, dict):
            continue
        players = data.get('vod_url_with_player')
        vod = dict((k, v) for k, v in data.items() if k != 'vod_url_with_player')
        names = text(vod.get('vod_play_from')).split('$$$')
        if isinstance(players, list):
            sources = players
        else:
            sources = [
                {'name': names[i] if i < len(names) else '', 'url': u}
                for i, u in enumerate(text(vod.get('vod_play_url')).split('$$$'))
            ]
        froms = []
        urls = []
        for index, source in enumerate(sources):
            if not isinstance(source, dict):
                continue
            url = playlist(source.get('url'))
            if not url:
                continue
            name = text(source.get('name')) or text(source.get('code')) or '线路%d' % (index + 1)
            froms.append(re.sub(r'[$#]', ' ', name))
            urls.append(url)
        vod['vod_play_from'] = '$$$'.join(froms)
        vod['vod_play_url'] = '$$$'.join(urls)
        lst.append(vod)
    return {'list': lst}


def play(play_id):
    original = text(play_id)
    if '$' in original:
        sep = original.find('$')
        tail = original[sep + 1:]
        if 0 < sep < len(original) - 1 and tail.startswith(('http', 'lvdou+')):
            original = tail
    original = decrypt_lvdou(original)
    if not original:
        return {'parse': 0, 'url': '', 'header': dict(PARSE_HEADERS)}

    if is_ldmax_url(original):
        decrypted = decrypt_ldmax(original)
        if decrypted:
            original = decrypted

    kind = '4k' if is_4k_source(original) else ('stream' if is_stream_url(original) else 'web')

    cached_url = get_cached(original, kind)
    if cached_url:
        return {'parse': 0, 'url': cached_url, 'header': dict(PARSE_HEADERS)}

    if kind == 'stream':
        put_cache(original, original, 'stream')
        return {'parse': 0, 'url': original, 'header': dict(PARSE_HEADERS)}

    resolved, reasons = resolve_cascade(original, kind)

    if resolved:
        ttl = _int_cfg('k4_ttl', K4_TTL, 10, 3600) if kind == '4k' else _int_cfg('web_ttl', WEB_TTL, 3, 600)
        put_cache(original, resolved, kind, ttl=ttl)
        if reasons:
            print('影探4K：%s线路解析成功，跳过 %d 个失败源' % (kind, len(reasons)))
        return {'parse': 0, 'url': resolved, 'header': dict(PARSE_HEADERS)}

    if kind == '4k' and is_media_url(original):
        print('影探4K：4K 换链全败，回退原直链 → %s' % '; '.join(reasons[-3:]))
        put_cache(original, original, 'fallback', pid=None, ttl=FALLBACK_TTL)
        return {'parse': 0, 'url': original, 'header': dict(PARSE_HEADERS)}

    if kind == 'web' and is_media_url(original):
        put_cache(original, original, 'fallback', pid=None, ttl=FALLBACK_TTL)
        return {'parse': 0, 'url': original, 'header': dict(PARSE_HEADERS)}

    summary = '; '.join(reasons[:8]) + (' ...共%d源' % len(reasons) if len(reasons) > 8 else '')
    raise Exception('影探4K：%s线路全部解析源不可用 → %s' % (kind, summary))


def health_report():
    return '域名池:\n%s\n\n%s\n\npid 池:\n网页线路:\n%s\n4K线路:\n%s' % (
        _cms_hosts.report(), _parse_hosts.report(),
        _health_web.report(), _health_4k.report())


def _apply_extend(raw):
    raw = text(raw)
    if not raw:
        return
    cfg = {}
    if raw.startswith('{'):
        cfg = object_of(raw)
    elif '://' in raw or raw.startswith(('cms', 'fys', 'api', 'www', 'm.')):
        cfg = {'cms_domains': [raw]}
    if not cfg:
        return
    for key in ('parse_api', 'pid_min', 'pid_max', 'parse_timeout', 'web_ttl', 'k4_ttl'):
        if key in cfg and cfg[key] not in (None, ''):
            _cfg.set_local(key, cfg[key])
    if list_of(cfg.get('cms_domains')):
        _cfg.set_local('cms_domains', cfg['cms_domains'])
        _cms_hosts.add(cfg['cms_domains'])
    if list_of(cfg.get('parse_apis')):
        _cfg.set_local('parse_apis', cfg['parse_apis'])
        _parse_hosts.add(cfg['parse_apis'])
    for pid in _pid_pool():
        _health_web._slot(pid)
        _health_4k._slot(pid)


load_play_cache()
_cms_hosts.load_state()
_parse_hosts.load_state()
try:
    with open(_state_file_path(), 'r', encoding='utf-8') as _f:
        _state = object_of(_f.read()) or {}
    _health_web.load(_state.get('pid_web'))
    _health_4k.load(_state.get('pid_4k'))
except Exception:
    _state = {}


class Spider(Spider):
    def getName(self):
        return '🎬 影探4K'

    def init(self, extend=''):
        self.extend = extend or ''
        _apply_extend(self.extend)

    def isVideoFormat(self, url):
        return is_media_url(url)

    def manualVideoCheck(self):
        return False

    def homeContent(self, filter):
        return home(self.extend)

    def homeVideoContent(self):
        return home_vod()

    def categoryContent(self, tid, pg, filter, extend):
        return category(tid, pg, extend)

    def detailContent(self, ids):
        return detail(ids)

    def searchContent(self, key, quick, pg='1'):
        try:
            return search(key, pg)
        except Exception as e:
            print('影探4K：搜索失败 → %s' % str(e)[:80])
            return single_page([], page_of(pg))

    def playerContent(self, flag, id, vipFlags):
        return play(id)

    def localProxy(self, param):
        return None

    def destroy(self):
        save_play_cache(force=True)
        _cms_hosts._save_state()
        _parse_hosts._save_state()
