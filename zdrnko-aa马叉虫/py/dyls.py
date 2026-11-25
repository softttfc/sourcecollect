import base64
import hashlib
import hmac
import json
import random
import re
import time

try:
    import urllib.request
    _Request = urllib.request.Request
    _urlopen = urllib.request.urlopen
    from urllib.parse import urlencode as _urlencode
except Exception:
    import urllib2 as _u2mod
    urllib.request = _u2mod
    _Request = _u2mod.Request
    _urlopen = _u2mod.urlopen
    from urllib import urlencode as _urlencode

try:
    import ssl as _ssl
except Exception:
    _ssl = None

try:
    from base.spider import Spider as BaseSpider
except ImportError:
    try:
        from base import Spider as BaseSpider
    except ImportError:
        try:
            import base.spider as _bsmod
            BaseSpider = _bsmod.Spider
        except Exception:
            class BaseSpider(object):
                pass

# ================= 常量 =================
RC4_KEY = bytearray(b'IPQMhHPWlq8vBlR3bbqDL9lfiCkRQ5Dn')
HMAC_KEY = b'635a580fcb5dc6e60caa39c31a7bde48'
RSA_N_HEX = (
    'd3617f90f839036357e2a6792529ecf9b8e154c082e896d38932a96e0360'
    '89753e2a4a2b83a0e3efa812ebc801f259616d42825e321dca09c73ebc551'
    'd67f39b38acabd3fd6b09970640a4ef84a4825c762ca1dafe6373f62be0e9'
    '8cd0e69405504592d037e898605756daaf065397302471a7af6859a32c9df'
    '8e7055fb427bbc76d7cd4224a812dd5d235f33d020e6a7510eb242dc2a81e'
    'b9109dc04565736534dc5d274c5bd8b7ab31193dac0f34f7b9c8f61b31922'
    '85cb72baaf1199d12b5a1a93aeff8a17fb8b03c9a9d73eebc65812699dab0'
    'ba73af45d8eaf3d7d03157a59aa7110fd4587b4f2ffb10f11bd0a8f73ee17'
    '17193b14aae331921dbdb8d6b')
RSA_E = 65537
TIMEOUT = 15
UA = 'Android'

CONFIG_URLS = [
    'https://w3gdvrh.dyls.vip/public/drafts/config_v7.txt',
    'https://sougu2vv1.s3.ap-northeast-1.amazonaws.com/public/drafts/config_v7.txt',
]
API_FALLBACK = 'https://rnn57nfgn.qlpru.cn/api'

CLIENT_HEADERS = {
    'User-Agent': 'Android',
    'Accept': 'application/prs.55App.v2+json',
    'X-Client-Setting': '{"pure-mode":0}',
    'X-Client-UUID': '{"device_id":"b1e50847d25f4c4bbba036f0093487f6","type":1,"brand":"Xiaomi","model":"M2102J2SC","system_version":33,"sdk_version":"3.1.2.1"}',
    'X-Client-Version': '3095',
    'X-App-Version': '3095',
    'X-App-Lang': 'zh_CN',
    'Connection': 'keep-alive',
}

CLASS_MAP = [('电影', '1'), ('剧集', '2'), ('综艺', '3'), ('动漫', '4')]

FILTERS = {
    '1': [
        {'key': 'class', 'name': '类型', 'value': [
            {'n': '全部', 'v': ''}, {'n': '动作', 'v': '动作'}, {'n': '喜剧', 'v': '喜剧'},
            {'n': '爱情', 'v': '爱情'}, {'n': '科幻', 'v': '科幻'}, {'n': '悬疑', 'v': '悬疑'},
            {'n': '犯罪', 'v': '犯罪'}, {'n': '冒险', 'v': '冒险'}, {'n': '恐怖', 'v': '恐怖'},
            {'n': '战争', 'v': '战争'}, {'n': '灾难', 'v': '灾难'}, {'n': '奇幻', 'v': '奇幻'}]},
        {'key': 'area', 'name': '地区', 'value': [
            {'n': '全部', 'v': ''}, {'n': '大陆', 'v': '大陆'}, {'n': '美国', 'v': '美国'},
            {'n': '韩国', 'v': '韩国'}, {'n': '日本', 'v': '日本'}, {'n': '中国香港', 'v': '中国香港'},
            {'n': '中国台湾', 'v': '中国台湾'}, {'n': '英国', 'v': '英国'}, {'n': '法国', 'v': '法国'},
            {'n': '泰国', 'v': '泰国'}, {'n': '其他', 'v': '其他'}]},
        {'key': 'year', 'name': '年份', 'value': [
            {'n': '全部', 'v': ''}, {'n': '2026', 'v': '2026'}, {'n': '2025', 'v': '2025'},
            {'n': '2024', 'v': '2024'}, {'n': '2023', 'v': '2023'}, {'n': '2022', 'v': '2022'},
            {'n': '2021', 'v': '2021'}, {'n': '2020', 'v': '2020'}, {'n': '2019', 'v': '2019'},
            {'n': '2018', 'v': '2018'}, {'n': '更早', 'v': '更早'}]},
    ],
}


# ================= 网络工具(自带 urllib 双栈) =================
def _ssl_ctx():
    """忽略证书校验的 SSL 上下文 (Jython 2.7 安全回退)"""
    if _ssl is None:
        return None
    try:
        ctx = _ssl.create_default_context()
    except Exception:
        try:
            ctx = _ssl.SSLContext(_ssl.PROTOCOL_TLS)
        except Exception:
            return None
    try:
        ctx.check_hostname = False
    except Exception:
        pass
    try:
        ctx.verify_mode = _ssl.CERT_NONE
    except Exception:
        pass
    return ctx


def _http_get(url, headers=None, timeout=TIMEOUT, retry=2):
    last = ''
    for i in range(retry + 1):
        try:
            req = _Request(url)
            for k, v in (headers or {}).items():
                try:
                    req.add_header(k, v)
                except Exception:
                    pass
            ctx = _ssl_ctx()
            try:
                resp = _urlopen(req, timeout=timeout, context=ctx)
            except TypeError:
                resp = _urlopen(req, timeout=timeout)
            try:
                data = resp.read()
            finally:
                try:
                    resp.close()
                except Exception:
                    pass
            if isinstance(data, bytes):
                return data.decode('utf-8', 'replace')
            return data
        except Exception as e:
            last = str(e)
            if i < retry:
                time.sleep(0.4)
    raise Exception('HTTP失败: %s' % last[:100])


# ================= 加密工具(纯标准库) =================
def rc4(key, data):
    key = bytearray(key)
    data = bytearray(data)
    S = list(range(256))
    j = 0
    for i in range(256):
        j = (j + S[i] + key[i % len(key)]) & 0xff
        S[i], S[j] = S[j], S[i]
    out = bytearray()
    i = j = 0
    for c in data:
        i = (i + 1) & 0xff
        j = (j + S[i]) & 0xff
        S[i], S[j] = S[j], S[i]
        out.append(c ^ S[(S[i] + S[j]) & 0xff])
    return bytes(out)


def rc4_decrypt_b64(cipher_b64):
    """RC4Decryptor.decrypt 主体: base64url -> RC4 -> utf8"""
    std = cipher_b64.replace('-', '+').replace('_', '/')
    std += '=' * ((4 - len(std) % 4) % 4)
    return rc4(RC4_KEY, base64.b64decode(std)).decode('utf-8', 'replace')


def _bytes2int(bs):
    n = 0
    for c in bytearray(bs):
        n = n << 8 | c
    return n


def _int2bytes(n, length):
    b = bytearray(length)
    for i in range(length - 1, -1, -1):
        b[i] = n & 255
        n >>= 8
    return bytes(b)


def rsa_encrypt(data):
    """RSA2048 PKCS1 v1.5 分段加密 -> urlsafe base64 无padding (纯 Python)"""
    n = int(RSA_N_HEX, 16)
    k = (n.bit_length() + 7) // 8  # 256
    chunk = k - 11                 # 245
    data = bytearray(data)
    out = bytearray()
    for i in range(0, len(data), chunk):
        block = data[i:i + chunk]
        pad_len = k - len(block) - 3
        m = bytearray([0, 2])
        for _ in range(pad_len):
            m.append(random.randint(1, 255))
        m.append(0)
        m += block
        c = pow(_bytes2int(m), RSA_E, n)
        out += bytearray(_int2bytes(c, k))
    return base64.urlsafe_b64encode(bytes(out)).decode('ascii').replace('=', '')


def sign_params(params):
    """BaseViewModel.getRequestMap: 业务参数 JSON -> RSA(pack) + HMAC-MD5(signature)"""
    p = {}
    for k, v in (params or {}).items():
        if v is not None and k not in ('timestamp', 'sign'):
            p[k] = v
    p['timestamp'] = str(int(time.time()))
    # Gson 默认输出 "键: 值"; ensure_ascii 默认 True, py2/py3 下均安全
    js = json.dumps(p, separators=(', ', ': '))
    pack = rsa_encrypt(js.encode('utf-8'))
    sig = hmac.new(HMAC_KEY, pack.encode('ascii'), hashlib.md5).hexdigest()
    return {'pack': pack, 'signature': sig}


class Spider(BaseSpider):

    def __init__(self):
        self.host = ''
        self.ready = False

    # ---------- 生命周期 ----------
    def getName(self):
        return '电影猎手'

    def init(self, extend=''):
        # 不联网! 引导配置在首个接口调用时懒加载 (联网会阻塞源加载)
        pass

    def destroy(self):
        pass

    def isVideoFormat(self, url):
        if not url:
            return False
        u = str(url).lower()
        return u.endswith('.m3u8') or u.endswith('.mp4') or '.m3u8?' in u or '.mp4?' in u

    def isTextFormat(self, url):
        return False

    def manualVideoCheck(self):
        return 0

    def liveContent(self, url):
        return {'list': []}

    def localProxy(self, param):
        return []

    # ---------- 引导(懒加载) ----------
    def _ensure(self):
        if self.ready:
            return
        self.ready = True
        for u in CONFIG_URLS:
            try:
                txt = _http_get(u, {}, timeout=8, retry=0).strip()
                if not txt:
                    continue
                if re.match(r'^[0-9a-fA-F]+$', txt) and len(txt) % 2 == 0:
                    txt = bytearray.fromhex(txt).decode('ascii')
                cfg = json.loads(rc4_decrypt_b64(txt))
                host = (cfg.get('api_service') or '').strip().rstrip('/')
                if host:
                    self.host = host
                    return
            except Exception:
                continue
        self.host = API_FALLBACK

    # ---------- API ----------
    def _api(self, path, params=None):
        self._ensure()
        qs = sign_params(params)
        h = dict(CLIENT_HEADERS)
        h['timestamp'] = str(int(time.time()))
        url = self.host + path + '?' + _urlencode(qs)
        body = _http_get(url, h)
        return json.loads(body)

    @staticmethod
    def _vod_item(d, desc=None):
        return {
            'vod_id': str(d.get('id') or ''),
            'vod_name': d.get('name') or d.get('title') or '',
            'vod_pic': d.get('cover') or '',
            'vod_remarks': desc if desc is not None else (d.get('dynamic') or d.get('label') or d.get('year') or ''),
        }

    @staticmethod
    def _parse_recommend(j):
        """首页推荐数据 -> 去重的 vod 列表"""
        out = []
        for block in (j.get('data') or []):
            if block.get('layout') == 'index_recommend_carousel':
                for it in (block.get('list') or []):
                    if it.get('type') == 1 and it.get('click') and it.get('title'):
                        out.append(Spider._vod_item({'id': it.get('click'), 'name': it.get('title'),
                                                     'cover': it.get('image'), 'year': it.get('label') or ''}))
                continue
            if block.get('layout') != 'base':
                continue
            for it in (block.get('list') or []):
                out.append(Spider._vod_item(it, desc=it.get('dynamic') or it.get('label') or ''))
        seen = set()
        uniq = []
        for v in out:
            if v['vod_id'] and v['vod_id'] not in seen:
                seen.add(v['vod_id'])
                uniq.append(v)
        return uniq

    # ---------- 六接口 ----------
    def homeContent(self, filter=1):
        result = {'class': [], 'list': []}
        for name, tid in CLASS_MAP:
            result['class'].append({'type_id': tid, 'type_name': name})
        if filter:
            result['filters'] = dict(FILTERS)
        return result

    def homeVideoContent(self):
        try:
            j = self._api('/v1/movie/index_recommend')
            return {'list': self._parse_recommend(j)[:60]}
        except Exception:
            return {}

    def categoryContent(self, tid, pg=1, filter=1, extend=None):
        page = 1
        try:
            page = int(pg) if pg else 1
        except Exception:
            page = 1
        ext = extend or {}
        if isinstance(ext, str):
            try:
                ext = json.loads(ext)
            except Exception:
                ext = {}
        if not isinstance(ext, dict):
            ext = {}
        items = []
        pagecount = page
        if str(tid) == 'recommend':
            try:
                j = self._api('/v1/movie/index_recommend')
                items = self._parse_recommend(j)
            except Exception:
                items = []
            pagecount = page + 1 if len(items) >= 20 else page
            return {'list': items, 'page': page, 'pagecount': pagecount,
                    'limit': max(len(items), 1), 'total': len(items),
                    'hasmore': 1 if len(items) >= 20 else 0}
        params = {'type_id': str(tid), 'page': page, 'pageSize': 20}
        for k in ('class', 'area', 'year'):
            v = ext.get(k)
            if v:
                params[k] = v
        try:
            j = self._api('/v1/movie/screen/list', params)
            data = j.get('data') or {}
            lst = data.get('list') or []
            items = [self._vod_item(x, desc=x.get('dynamic') or x.get('label') or '') for x in lst]
            total = 0
            try:
                total = int(data.get('total') or data.get('count') or 0)
            except Exception:
                total = 0
            pagecount = int(total / 20) + (1 if total % 20 else 0) if total > 0 else (page + 1 if len(items) >= 20 else page)
            return {'list': items, 'page': page, 'pagecount': pagecount,
                    'limit': 20, 'total': total or len(items),
                    'hasmore': 1 if len(items) >= 20 else 0}
        except Exception:
            return {'list': [], 'page': page, 'pagecount': page, 'limit': 20,
                    'total': 0, 'hasmore': 0}

    def searchContent(self, key, quick=None, pg=None):
        """TVBox 兼容签名: 1参/2参/3参调用全支持"""
        if not key or not str(key).strip():
            return {'list': []}
        key = str(key).strip()
        page = 1
        try:
            page = int(pg) if pg else 1
        except Exception:
            page = 1
        try:
            j = self._api('/v1/movie/search', {'keyword': key, 'page': page, 'pageSize': 20})
            data = j.get('data') or {}
            lst = data.get('list') or []
            items = [self._vod_item(x, desc=x.get('dynamic') or x.get('year') or '') for x in lst]
            return {'list': items, 'page': page,
                    'pagecount': page + 1 if len(items) >= 20 else page,
                    'limit': 20, 'total': len(items)}
        except Exception:
            return {}

    def searchContentPage(self, key, quick=None, pg=None):
        """部分内核用 searchContentPage 做分页搜索"""
        return self.searchContent(key, quick, pg)

    def detailContent(self, ids=None):
        if not ids:
            return {}
        try:
            mid = str(ids[0]).strip() if isinstance(ids, (list, tuple)) else str(ids).strip()
        except Exception:
            return {}
        try:
            j = self._api('/v1/movie/detail', {'id': mid})
        except Exception:
            return {}
        d = j.get('data') or {}
        if not d:
            return {}
        tags = ''
        for t in (d.get('tags') or []):
            tags += '#' + (t.get('name') or '') + ' '
        actors = ''
        for m in (d.get('members') or []):
            actors += (m.get('name') or '') + ' '
        content = (d.get('content') or '') + (' ' + tags.strip() if tags.strip() else '')
        vod = {
            'vod_id': mid,
            'vod_name': d.get('name') or '',
            'vod_pic': d.get('cover') or '',
            'type_name': d.get('type_name') or '',
            'vod_year': d.get('year') or '',
            'vod_area': d.get('area') or '',
            'vod_remarks': d.get('dynamic') or '',
            'vod_score': d.get('score') or '',
            'vod_actor': actors.strip(),
            'vod_director': '',
            'vod_content': content.strip(),
        }
        # play_from: 每条线路的集数列表; need_parse 线路需经 parse_url 解析
        flags = []
        plays = []
        for pf in (d.get('play_from') or []):
            code = pf.get('code') or ''
            name = pf.get('name') or code
            eps = pf.get('list') or []
            if not eps:
                # addr/list 补集数(部分 need_parse 线路详情里 list 为空)
                try:
                    j2 = self._api('/v1/movie_addr/list', {'movie_id': mid, 'from_code': code})
                    eps = j2.get('data') or []
                except Exception:
                    eps = []
            if not eps:
                continue
            need_parse = bool(pf.get('player_need_to_parse'))
            urls = []
            for ep in eps:
                eid = ep.get('episode_id')
                purl = ep.get('play_url') or ''
                if need_parse or (purl and not re.match(r'^https?://', purl)):
                    eid_str = '%s@@%s@@%s@@%s' % (mid, code, eid, purl)
                else:
                    eid_str = purl
                urls.append('%s$%s' % (ep.get('episode_name') or '正片', eid_str))
            if urls:
                flags.append(name)
                plays.append('#'.join(urls))
        # 线路置顶: 尊享4k > 4K-官方线路C > 4K-MJ > 天堂线路, 其余线路保持原顺序
        if len(flags) > 1:
            def _prio(nm):
                nl = (nm or '').strip().lower()
                if nl == '4k-官方线路c':
                    return 0
                if nl == '尊享4k':
                    return 1
                if nl == '4k-mj':
                    return 2
                if nl == '天堂线路':
                    return 3
                return 4
            try:
                pairs = sorted(zip(flags, plays), key=lambda x: _prio(x[0]))
                flags = [x[0] for x in pairs]
                plays = [x[1] for x in pairs]
            except Exception:
                pass
        vod['vod_play_from'] = '$$$'.join(flags)
        vod['vod_play_url'] = '$$$'.join(plays)
        return {'list': [vod]}

    def playerContent(self, flag, id, vipFlags=None):
        """id 三种形态:
        1. http 直链 -> 直接播
        2. movie_id@@from_code@@episode_id@@parse_token -> parse_url 解析换直链
        3. 兜底 -> 空 url"""
        result = {'parse': 0, 'url': '', 'header': {'User-Agent': 'Lavf/58.29.100'}}
        if not id:
            return result
        pid = str(id)
        try:
            if pid.startswith('http'):
                result['url'] = pid
                return result
            parts = pid.split('@@')
            if len(parts) >= 4:
                mid, code, eid, purl = parts[0], parts[1], parts[2], parts[3]
                if purl.startswith('http'):
                    result['url'] = purl
                    return result
                # VIP/官方线路: play_url 为 parse_<hex> token, 走 parse_url 解析
                j = self._api('/v1/movie_addr/parse_url', {
                    'movie_id': mid, 'episode_id': eid, 'from_code': code,
                    'play_url': purl, 'type': 'play'})
                url = ((j.get('data') or {}).get('play_url')) or ''
                if url:
                    result['url'] = url
                return result
        except Exception:
            pass
        return result


# ================= 模块级函数转发(部分加载器只认模块函数) =================
_S = None


def _ins():
    global _S
    if _S is None:
        _S = Spider()
    return _S


def getName():
    return _ins().getName()


def init(extend=''):
    return _ins().init(extend)


def homeContent(filter=1):
    return _ins().homeContent(filter)


def homeVideoContent():
    return _ins().homeVideoContent()


def categoryContent(tid, pg=1, filter=1, extend=None):
    return _ins().categoryContent(tid, pg, filter, extend)


def searchContent(key, quick=None, pg=None):
    return _ins().searchContent(key, quick, pg)


def searchContentPage(key, quick=None, pg=None):
    return _ins().searchContentPage(key, quick, pg)


def detailContent(ids=None):
    return _ins().detailContent(ids)


def playerContent(flag, id, vipFlags=None):
    return _ins().playerContent(flag, id, vipFlags)


def localProxy(param):
    return _ins().localProxy(param)


def isVideoFormat(url):
    return _ins().isVideoFormat(url)


def isTextFormat(url):
    return _ins().isTextFormat(url)


def manualVideoCheck():
    return _ins().manualVideoCheck()


def destroy():
    return _ins().destroy()
