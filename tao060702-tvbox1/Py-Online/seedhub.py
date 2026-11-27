# coding=utf-8
# SeedHub / Seed4K TVBox Python 爬虫
# 由 csp_SeedHub (com.github.catvod.spider.SeedHub) 转写
#
# 站点配置示例（type=3）：
#   {"key":"seed4k","name":"种子┃4K","type":3,"api":"<本文件地址>","searchable":1,
#    "ext":{"site":["https://sidhub.cc","https://seeduck.cc","https://hubdog.cc","http://104.243.25.80"]}}
#
# ext.site 可传数组，也可传逗号分隔字符串；不传则用上面的默认线路。

import gzip
import http.cookiejar
import json
import re
import ssl
import sys
import urllib.error
import urllib.request
from base64 import b64decode
from html import unescape
from urllib.parse import quote

sys.path.append('..')
try:
    from base.spider import Spider as BaseSpider
except Exception:
    BaseSpider = object

DEFAULT_SITES = [
    'https://sidhub.cc',
    'https://seeduck.cc',
    'https://hubdog.cc',
    'http://104.243.25.80',
]

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

PAN_TYPES = (
    ('pan.quark.cn', '夸克网盘'),
    ('drive.uc.cn', 'UC网盘'),
    ('aliyundrive.com', '阿里云盘'),
    ('alipan.com', '阿里云盘'),
    ('cloud.189.cn', '天翼云盘'),
    ('cloud.189.com', '天翼云盘'),
    ('yun.139', '移动云盘'),
    ('caiyun.139.com', '移动云盘'),
    ('pan.baidu.com', '百度网盘'),
    ('pan.xunlei.com', '迅雷云盘'),
    ('115.com/s/', '115网盘'),
    ('115cdn.com/s/', '115网盘'),
    ('123pan.com', '123网盘'),
    ('123pan.cn', '123网盘'),
    ('123684.com', '123网盘'),
    ('123865.com', '123网盘'),
    ('123912.com', '123网盘'),
    ('123592.com', '123网盘'),
    ('guangyapan.com/s/', '光雅网盘'),
)
PAN_123_RE = re.compile(r'.*123\w{3}\.com/(?:s|123pan)/.*', re.I)

# 与 jar 内 homeContent 的筛选数据一致：电影 / 动漫 / 剧集
FILTERS_JSON = r'''{"1":[{"key":"tags","name":"标签","value":[{"n":"全部","v":""},{"n":"剧情","v":"/types/7"},{"n":"喜剧","v":"/types/8"},{"n":"惊悚","v":"/types/4"},{"n":"动作","v":"/types/1"},{"n":"爱情","v":"/types/10"},{"n":"犯罪","v":"/types/12"},{"n":"恐怖","v":"/types/3"},{"n":"悬疑","v":"/types/13"},{"n":"冒险","v":"/types/6"},{"n":"科幻","v":"/types/2"},{"n":"奇幻","v":"/types/5"},{"n":"纪录片","v":"/types/43"},{"n":"传记","v":"/types/14"},{"n":"家庭","v":"/types/9"},{"n":"战争","v":"/types/16"},{"n":"历史","v":"/types/15"},{"n":"音乐","v":"/types/19"},{"n":"运动","v":"/types/23"},{"n":"同性","v":"/types/11"},{"n":"歌舞","v":"/types/28"},{"n":"西部","v":"/types/24"},{"n":"短片","v":"/types/35"},{"n":"古装","v":"/types/22"},{"n":"灾难","v":"/types/17"},{"n":"武侠","v":"/types/21"},{"n":"英语","v":"/tags/9937"},{"n":"汉语普通话","v":"/tags/64347"},{"n":"法语","v":"/tags/838"},{"n":"日语","v":"/tags/11358"},{"n":"西班牙语","v":"/tags/3222"},{"n":"德语","v":"/tags/2722"},{"n":"粤语","v":"/tags/3194"},{"n":"意大利语","v":"/tags/41930"},{"n":"韩语","v":"/tags/11871"},{"n":"俄语","v":"/tags/8938"},{"n":"2025","v":"/tags/64935"},{"n":"2024","v":"/tags/64427"},{"n":"2023","v":"/tags/64344"},{"n":"2022","v":"/tags/63723"},{"n":"2021","v":"/tags/47104"},{"n":"2020","v":"/tags/2708"},{"n":"2019","v":"/tags/247"},{"n":"2018","v":"/tags/232"},{"n":"2017","v":"/tags/113"},{"n":"2016","v":"/tags/387"},{"n":"2015","v":"/tags/120"},{"n":"2014","v":"/tags/87"},{"n":"2013","v":"/tags/29"},{"n":"2012","v":"/tags/61"},{"n":"2011","v":"/tags/24"},{"n":"2010","v":"/tags/62"},{"n":"2009","v":"/tags/67"},{"n":"2008","v":"/tags/90"},{"n":"2007","v":"/tags/7"},{"n":"2006","v":"/tags/230"},{"n":"2005","v":"/tags/156"},{"n":"2004","v":"/tags/71"},{"n":"2003","v":"/tags/20"},{"n":"2002","v":"/tags/46"},{"n":"2001","v":"/tags/26"},{"n":"2000","v":"/tags/272"}]}],"2":[{"key":"tags","name":"标签","value":[{"n":"全部","v":""},{"n":"动画","v":"/types/25"},{"n":"喜剧","v":"/types/29"},{"n":"奇幻","v":"/types/26"},{"n":"剧情","v":"/types/30"},{"n":"冒险","v":"/types/27"},{"n":"动作","v":"/types/50"},{"n":"科幻","v":"/types/53"},{"n":"爱情","v":"/types/48"},{"n":"家庭","v":"/types/31"},{"n":"悬疑","v":"/types/54"},{"n":"短片","v":"/types/51"},{"n":"惊悚","v":"/types/59"},{"n":"运动","v":"/types/62"},{"n":"音乐","v":"/types/47"},{"n":"犯罪","v":"/types/69"},{"n":"恐怖","v":"/types/67"},{"n":"古装","v":"/types/94"},{"n":"儿童","v":"/types/32"},{"n":"战争","v":"/types/70"},{"n":"武侠","v":"/types/71"},{"n":"歌舞","v":"/types/49"},{"n":"历史","v":"/types/68"},{"n":"同性","v":"/types/90"},{"n":"灾难","v":"/types/105"},{"n":"传记","v":"/types/80"},{"n":"日语","v":"/tags/24476"},{"n":"英语","v":"/tags/64425"},{"n":"汉语普通话","v":"/tags/64433"},{"n":"法语","v":"/tags/22281"},{"n":"西班牙语","v":"/tags/64470"},{"n":"意大利语","v":"/tags/64473"},{"n":"德语","v":"/tags/50478"},{"n":"粤语","v":"/tags/26475"},{"n":"俄语","v":"/tags/64768"},{"n":"葡萄牙语","v":"/tags/64474"},{"n":"2025","v":"/tags/64919"},{"n":"2024","v":"/tags/64424"},{"n":"2023","v":"/tags/64422"},{"n":"2022","v":"/tags/64471"},{"n":"2021","v":"/tags/48778"},{"n":"2020","v":"/tags/12981"},{"n":"2019","v":"/tags/2683"},{"n":"2018","v":"/tags/3071"},{"n":"2017","v":"/tags/4812"},{"n":"2016","v":"/tags/2632"},{"n":"2015","v":"/tags/740"},{"n":"2014","v":"/tags/1482"},{"n":"2013","v":"/tags/2620"},{"n":"2012","v":"/tags/2662"},{"n":"2011","v":"/tags/2676"},{"n":"2010","v":"/tags/5603"},{"n":"2009","v":"/tags/2718"},{"n":"2008","v":"/tags/2316"},{"n":"2007","v":"/tags/2226"},{"n":"2006","v":"/tags/1193"},{"n":"2005","v":"/tags/1247"},{"n":"2004","v":"/tags/2630"},{"n":"2003","v":"/tags/1127"},{"n":"2002","v":"/tags/7092"},{"n":"2001","v":"/tags/6376"},{"n":"2000","v":"/tags/5833"}]}],"3":[{"key":"tags","name":"标签","value":[{"n":"全部","v":""},{"n":"剧情","v":"/types/33"},{"n":"喜剧","v":"/types/39"},{"n":"爱情","v":"/types/58"},{"n":"犯罪","v":"/types/34"},{"n":"悬疑","v":"/types/38"},{"n":"惊悚","v":"/types/37"},{"n":"动作","v":"/types/36"},{"n":"奇幻","v":"/types/41"},{"n":"科幻","v":"/types/55"},{"n":"古装","v":"/types/88"},{"n":"纪录片","v":"/types/63"},{"n":"冒险","v":"/types/42"},{"n":"恐怖","v":"/types/56"},{"n":"历史","v":"/types/60"},{"n":"同性","v":"/types/75"},{"n":"家庭","v":"/types/57"},{"n":"真人秀","v":"/types/66"},{"n":"战争","v":"/types/61"},{"n":"传记","v":"/types/40"},{"n":"运动","v":"/types/87"},{"n":"武侠","v":"/types/99"},{"n":"音乐","v":"/types/65"},{"n":"短片","v":"/types/64"},{"n":"西部","v":"/types/76"},{"n":"歌舞","v":"/types/79"},{"n":"英语","v":"/tags/8783"},{"n":"汉语普通话","v":"/tags/64362"},{"n":"日语","v":"/tags/26544"},{"n":"韩语","v":"/tags/22290"},{"n":"西班牙语","v":"/tags/4962"},{"n":"粤语","v":"/tags/13567"},{"n":"泰语","v":"/tags/45186"},{"n":"法语","v":"/tags/25453"},{"n":"德语","v":"/tags/18156"},{"n":"意大利语","v":"/tags/64464"},{"n":"2025","v":"/tags/64938"},{"n":"2024","v":"/tags/64343"},{"n":"2023","v":"/tags/64419"},{"n":"2022","v":"/tags/64257"},{"n":"2021","v":"/tags/46828"},{"n":"2020","v":"/tags/7176"},{"n":"2019","v":"/tags/3289"},{"n":"2018","v":"/tags/3059"},{"n":"2017","v":"/tags/3364"},{"n":"2016","v":"/tags/2891"},{"n":"2015","v":"/tags/1676"},{"n":"2014","v":"/tags/1673"},{"n":"2013","v":"/tags/1670"},{"n":"2012","v":"/tags/1687"},{"n":"2011","v":"/tags/3182"},{"n":"2010","v":"/tags/3185"},{"n":"2009","v":"/tags/3136"},{"n":"2008","v":"/tags/1694"},{"n":"2007","v":"/tags/6085"},{"n":"2006","v":"/tags/4630"},{"n":"2005","v":"/tags/3483"},{"n":"2004","v":"/tags/2930"},{"n":"2003","v":"/tags/3611"},{"n":"2002","v":"/tags/1680"},{"n":"2001","v":"/tags/4377"},{"n":"2000","v":"/tags/4337"}]}]}'''


class SeedHubItem(object):
    __slots__ = ('id', 'name', 'pic', 'year')

    def __init__(self, vid, name, pic, year):
        self.id = vid
        self.name = name
        self.pic = pic
        self.year = year


class Spider(BaseSpider):
    # 类级兜底：有些壳只调 init() 不调 __init__()
    sites = list(DEFAULT_SITES)
    _site_index = 0
    _base = DEFAULT_SITES[0]
    _opener = None
    _cookie_jar = None

    def __init__(self):
        try:
            super(Spider, self).__init__()
        except Exception:
            pass
        self.sites = list(DEFAULT_SITES)
        self._site_index = 0
        self._base = DEFAULT_SITES[0]
        self._opener = None
        self._cookie_jar = http.cookiejar.CookieJar()
        self.extend = ''

    def init(self, extend=''):
        self.sites = list(DEFAULT_SITES)
        self._site_index = 0
        self._base = DEFAULT_SITES[0]
        self._opener = None
        self._cookie_jar = http.cookiejar.CookieJar()
        self.extend = extend
        text = extend
        if isinstance(extend, dict):
            text = extend.get('site')
        if text:
            try:
                data = json.loads(extend) if isinstance(extend, str) else extend
                if isinstance(data, dict):
                    text = data.get('site')
            except Exception:
                pass
            if isinstance(text, str):
                text = re.split(r'[,\s]+', text.strip()) if text.strip() else []
            if isinstance(text, list):
                sites = [str(x).strip().rstrip('/') for x in text if str(x).strip()]
                if sites:
                    self.sites = sites
                    self._base = sites[0]

    def getName(self):
        return 'SeedHub'

    # ---------- 网络 ----------

    def _ensure(self):
        if not getattr(self, 'sites', None):
            self.sites = list(DEFAULT_SITES)
        if not hasattr(self, '_site_index'):
            self._site_index = 0
        if not getattr(self, '_base', ''):
            self._base = self.sites[0]

    def _site(self):
        self._ensure()
        return self.sites[self._site_index % len(self.sites)]

    def _headers(self, base=None):
        base = base or self._site()
        return {
            'User-Agent': UA,
            'Referer': base + '/',
            'Origin': base,
            'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-TW;q=0.6',
            'Sec-Fetch-Mode': 'cors',
        }

    def _text(self, resp):
        if resp is None:
            return ''
        if isinstance(resp, bytes):
            try:
                return resp.decode('utf-8', 'ignore')
            except Exception:
                return ''
        if isinstance(resp, str):
            return resp
        text = getattr(resp, 'text', None)
        if text is None:
            content = getattr(resp, 'content', b'')
            try:
                text = content.decode('utf-8', 'ignore')
            except Exception:
                text = ''
        return text or ''

    @staticmethod
    def _decode(raw, charset=''):
        if not raw:
            return ''
        if not charset:
            try:
                head = raw[:2048].decode('ascii', 'ignore').lower()
            except Exception:
                head = ''
            m = re.search(r'charset=["\']?([\w-]+)', head)
            charset = m.group(1) if m else 'utf-8'
        try:
            return raw.decode(charset, 'ignore')
        except Exception:
            return raw.decode('utf-8', 'ignore')

    def _get_opener(self):
        if getattr(self, '_opener', None) is None:
            if getattr(self, '_cookie_jar', None) is None:
                self._cookie_jar = http.cookiejar.CookieJar()
            try:
                ctx = ssl._create_unverified_context()
            except Exception:
                ctx = None
            handlers = [urllib.request.HTTPCookieProcessor(self._cookie_jar)]
            if ctx is not None:
                handlers.append(urllib.request.HTTPSHandler(context=ctx))
            self._opener = urllib.request.build_opener(*handlers)
        return self._opener

    def _urlopen(self, url, base=None):
        headers = self._headers(base)
        headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip',
            'Connection': 'keep-alive',
        })
        try:
            req = urllib.request.Request(url, headers=headers)
            with self._get_opener().open(req, timeout=8) as resp:
                raw = resp.read()
                enc = (resp.headers.get('Content-Encoding') or '').lower()
                if 'gzip' in enc:
                    try:
                        raw = gzip.decompress(raw)
                    except Exception:
                        pass
                return self._decode(raw, resp.headers.get_content_charset() or '')
        except urllib.error.HTTPError as e:
            try:
                raw = e.read()
                if 'gzip' in (e.headers.get('Content-Encoding') or '').lower():
                    raw = gzip.decompress(raw)
                return self._decode(raw, '')
            except Exception:
                return ''
        except Exception:
            return ''

    def _fetch(self, url, base=None):
        # 标准库优先（不依赖壳的 base.spider 是否提供 self.fetch）
        text = self._urlopen(url, base)
        if text and not self._is_challenge(text):
            return text
        fetch = getattr(self, 'fetch', None)
        if callable(fetch):
            try:
                alt = self._text(fetch(url, headers=self._headers(base)))
            except Exception:
                alt = ''
            if alt and (not self._is_challenge(alt) or not text):
                return alt
        return text

    @staticmethod
    def _is_challenge(html):
        return ('Just a moment' in html or 'challenge-platform' in html
                or 'cf_chl_opt' in html or '_cf_chl_' in html)

    def _get(self, path):
        self._ensure()
        if not path:
            return ''
        if path.startswith('http://') or path.startswith('https://'):
            return self._fetch(path)
        last = ''
        for i in range(len(self.sites)):
            idx = (self._site_index + i) % len(self.sites)
            base = self.sites[idx]
            html = self._fetch(base + '/' + path.lstrip('/'), base)
            if html and not self._is_challenge(html):
                self._site_index = idx
                self._base = base
                return html
            last = html or last
        return '' if self._is_challenge(last) else last

    def _abs(self, url):
        url = (url or '').strip()
        if not url:
            return ''
        if url.startswith('//'):
            return 'https:' + url
        if url.startswith('http://') or url.startswith('https://'):
            return url
        base = getattr(self, '_base', '') or self._site()
        if url.startswith('/'):
            return base + url
        return base + '/' + url

    # ---------- HTML 工具 ----------

    @staticmethod
    def _clean(text):
        if not text:
            return ''
        text = re.sub(r'<[^>]+>', ' ', text)
        text = unescape(text)
        return re.sub(r'\s+', ' ', text).strip()

    @staticmethod
    def _attrs(tag):
        result = {}
        for m in re.finditer(r'([\w:-]+)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))', tag or ''):
            if m.group(2) is not None:
                val = m.group(2)
            elif m.group(3) is not None:
                val = m.group(3)
            else:
                val = m.group(4) or ''
            result[m.group(1).lower()] = unescape(val)
        return result

    @staticmethod
    def _b64(value):
        try:
            value = (value or '').strip()
            value += '=' * (-len(value) % 4)
            return b64decode(value).decode('utf-8', 'ignore').strip()
        except Exception:
            return ''

    @staticmethod
    def _magnet_clean(value):
        return unescape(value or '').strip()

    # ---------- 列表解析（对应 jar 的 p()/q()） ----------

    def _parse_items(self, html):
        items = []
        by_id = {}
        if not html:
            return items
        anchors = list(re.finditer(
            r'<a\b[^>]*\bhref\s*=\s*["\']([^"\']*?/movies/(\d+)/?[^"\']*)["\'][^>]*>',
            html, re.I))
        total = len(anchors)
        for i, m in enumerate(anchors):
            vid = m.group(2)
            start = m.start()
            if i + 1 < total:
                end = anchors[i + 1].start()
            else:
                end = min(len(html), start + 4000)
            block = html[start:end]
            item = by_id.get(vid)
            if item is None:
                item = SeedHubItem(vid, '', '', '')
                by_id[vid] = item
                items.append(item)

            # 海报 + 标题：img[alt]
            for im in re.finditer(r'<img\b[^>]*>', block, re.I):
                attrs = self._attrs(im.group(0))
                alt = self._clean(attrs.get('alt', ''))
                if alt and not item.name:
                    item.name = alt
                if not item.pic:
                    pic = (attrs.get('src') or attrs.get('data-src')
                           or attrs.get('data-original') or '')
                    if pic:
                        item.pic = self._abs(pic)
                if item.name and item.pic:
                    break

            # 标题回退：h2
            if not item.name:
                h2 = re.search(r'<h2\b[^>]*>([\s\S]*?)</h2>', block, re.I)
                if h2:
                    item.name = self._clean(h2.group(1))

            # 标题回退：a[title]
            if not item.name:
                item.name = self._clean(self._attrs(m.group(0)).get('title', ''))

            # 标题回退：a 标签自身文本
            if not item.name:
                close = html.find('</a>', m.end())
                if 0 <= close - m.end() < 500:
                    inner = self._clean(html[m.end():close])
                    if 0 < len(inner) <= 100:
                        item.name = inner

            # 年份：li 里的 4 位数字
            if not item.year:
                for li in re.finditer(r'<li\b[^>]*>([\s\S]*?)</li>', block, re.I):
                    ym = re.search(r'(?:19|20)\d{2}', self._clean(li.group(1)))
                    if ym:
                        item.year = ym.group(0)
                        break

        return [x for x in items if x.name]

    @staticmethod
    def _to_vod(item):
        return {
            'vod_id': item.id,
            'vod_name': item.name,
            'vod_pic': item.pic,
            'vod_remarks': item.year,
        }

    # ---------- 分页（对应 jar 的 n()） ----------

    @staticmethod
    def _page_count(html, pg):
        try:
            page = max(1, int(pg or 1))
        except Exception:
            page = 1
        count = page
        if not html:
            return count
        # .page-nav .page a 的纯数字文本
        for m in re.finditer(r'<a\b[^>]*>([^<>]{1,10})</a>', html, re.I):
            text = m.group(1).strip()
            if re.fullmatch(r'\d{1,5}', text):
                num = int(text)
                if num > count and ('page=' in m.group(0) or 'page-nav' in html[max(0, m.start() - 400):m.start()]):
                    count = num
        # a[rel=next] / 下一页
        if re.search(r'<a\b[^>]*(?:rel\s*=\s*["\']next["\']|>\s*下一页)', html, re.I):
            count = max(count, page + 1)
        return count

    # ---------- 首页/分类/搜索 ----------

    def homeContent(self, filter=True):
        categories = [
            {'type_id': '1', 'type_name': '电影'},
            {'type_id': '2', 'type_name': '动漫'},
            {'type_id': '3', 'type_name': '剧集'},
        ]
        result = {'class': categories}
        try:
            result['filters'] = json.loads(FILTERS_JSON)
        except Exception:
            pass
        try:
            result['list'] = [self._to_vod(x) for x in self._parse_items(self._get('/'))]
        except Exception:
            result['list'] = []
        return result

    def homeVideoContent(self):
        try:
            return {'list': [self._to_vod(x) for x in self._parse_items(self._get('/'))]}
        except Exception:
            return {'list': []}

    def categoryContent(self, tid, pg, filter, extend):
        pg = str(pg or '1')
        if tid == 'seedhub_setting':
            return {'list': [], 'page': int(pg), 'pagecount': 0, 'limit': 20, 'total': 0}
        tags = ''
        if isinstance(extend, str) and extend.strip().startswith('{'):
            try:
                extend = json.loads(extend)
            except Exception:
                extend = {}
        if isinstance(extend, dict):
            tags = extend.get('tags') or ''
        html = self._get('/categories/%s%s/movies/?page=%s' % (tid, tags, pg))
        items = self._parse_items(html)
        pagecount = self._page_count(html, pg)
        return {
            'list': [self._to_vod(x) for x in items],
            'page': int(pg),
            'pagecount': pagecount,
            'limit': 20,
            'total': pagecount * 20,
        }

    def searchContent(self, key, quick, pg='1'):
        pg = str(pg or '1')
        html = self._get('/s/%s/?page=%s' % (quote(key or '', safe=''), pg))
        items = self._parse_items(html)
        pagecount = self._page_count(html, pg)
        return {
            'list': [self._to_vod(x) for x in items],
            'page': int(pg),
            'pagecount': pagecount,
            'limit': 20,
            'total': pagecount * 20,
        }

    # ---------- 详情（对应 jar 的 detailContent()） ----------

    def _pan_name(self, url):
        low = (url or '').lower()
        for key, name in PAN_TYPES:
            if key in low:
                return name
        if PAN_123_RE.match(low):
            return '123网盘'
        return ''

    def _resolve_pan(self, url):
        url = (url or '').strip()
        if not url:
            return ''
        # 已是可直接识别的网盘链接（对应 jar 的 I0.q0/X0）
        if self._pan_name(url):
            return url
        if not (url.startswith('http://') or url.startswith('https://')):
            target = self._abs(url)
        else:
            target = url
        html = self._fetch(target)
        if not html:
            # 外部链接解析失败时原样保留，避免丢链接
            return url if url.startswith('http') and not url.startswith(getattr(self, '_base', '') or '\0') else ''
        m = re.search(r'(?:panLink|Link)\s*=\s*["\']([^"\']+)["\']', html)
        if m:
            return self._abs(self._clean(m.group(1)))
        m = re.search(r'(?:var|let|const)\s+data\s*=\s*["\']([^"\']+)["\']', html)
        if m:
            data = self._b64(m.group(1))
            if data.startswith('http://') or data.startswith('https://') or data.startswith('/'):
                return self._abs(data)
        return ''

    def _resolve_pans(self, urls):
        if not urls:
            return []
        if len(urls) == 1:
            return [self._resolve_pan(urls[0])]
        # jar 内部用 10 线程并发解析网盘跳转
        try:
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=min(10, len(urls))) as pool:
                return list(pool.map(self._resolve_pan, urls))
        except Exception:
            return [self._resolve_pan(u) for u in urls]

    def _parse_detail(self, vid, html):
        title = ''
        m = re.search(r'<h1\b[^>]*>([\s\S]*?)</h1>', html, re.I)
        if m:
            title = self._clean(m.group(1)).replace('#', '').strip()

        pic = ''
        for im in re.finditer(r'<img\b[^>]*>', html, re.I):
            tag = im.group(0)
            attrs = self._attrs(tag)
            src = attrs.get('src') or attrs.get('data-src') or attrs.get('data-original') or ''
            low = src.lower()
            if not src or 'logo' in low or 'icon' in low:
                continue
            if attrs.get('alt') or 'poster' in tag.lower() or 'cover' in tag.lower():
                pic = self._abs(src)
                break

        director = actor = vtype = year = area = ''
        for li in re.finditer(r'<li\b[^>]*>([\s\S]*?)</li>', html, re.I):
            text = self._clean(li.group(1))
            if not text:
                continue
            if text.startswith('导演:') or text.startswith('导演：'):
                director = text[3:].strip()
            elif text.startswith('主演:') or text.startswith('主演：'):
                actor = text[3:].strip()
            elif text.startswith('类型:') or text.startswith('类型：'):
                vtype = text[3:].strip()
            elif '/' in text:
                for part in text.split('/'):
                    part = part.strip()
                    if re.fullmatch(r'(?:19|20)\d{2}', part):
                        year = part
                    elif any(x in part for x in ('中国', '美国', '韩国', '日本', '英国', '法国',
                                                 '德国', '意大利', '西班牙', '印度', '泰国',
                                                 '香港', '台湾')):
                        area = part

        desc = ''
        for h2 in re.finditer(r'<h2\b[^>]*>([\s\S]*?)</h2>', html, re.I):
            if '简介' in self._clean(h2.group(1)):
                p = re.search(r'<p\b[^>]*>([\s\S]*?)</p>', html[h2.end():], re.I)
                if p:
                    desc = self._clean(p.group(1))
                break
        if not desc:
            m = re.search(
                r'<div\b[^>]*class=["\'][^"\']*(?:intro|desc|description)[^"\']*["\'][^>]*>([\s\S]*?)</div>',
                html, re.I)
            if m:
                desc = self._clean(m.group(1))

        # 网盘链接：.pan-links li a, a[href*=pan_id]
        pan_tags = []
        for m in re.finditer(r'<a\b[^>]*>', html, re.I):
            if 'pan_id' in m.group(0):
                pan_tags.append(m.group(0))
        for c in re.finditer(
                r'<[^>]+class=["\'][^"\']*pan-links[^"\']*["\'][^>]*>([\s\S]*?)(?:</ul>|</div>)',
                html, re.I):
            for a in re.finditer(r'<a\b[^>]*>', c.group(1), re.I):
                pan_tags.append(a.group(0))

        raws = []
        seen_raw = set()
        for tag in pan_tags:
            attrs = self._attrs(tag)
            raw = ''
            for key in ('data-link', 'href', 'title'):
                val = (attrs.get(key) or '').strip()
                if val.startswith(('http://', 'https://', '/')):
                    raw = val
                    break
            if not raw or raw in seen_raw:
                continue
            seen_raw.add(raw)
            raws.append(raw)
            if len(raws) >= 80:
                break

        pans = []
        seen_pan = set()
        for url in self._resolve_pans(raws):
            if url and url not in seen_pan:
                seen_pan.add(url)
                pans.append((self._pan_name(url) or '网盘', url))

        # 磁力：a[href*=seed_id]
        seeds = []
        labels = []
        seen_seed = set()
        for m in re.finditer(r'<a\b([^>]*\bseed_id=(\d+)[^>]*)>([\s\S]*?)</a>', html, re.I):
            sid = m.group(2)
            if sid in seen_seed:
                continue
            seen_seed.add(sid)
            label = self._clean(m.group(3))
            if len(label) > 40:
                label = label[:40] + '...'
            if not label:
                label = '磁力 %d' % (len(seeds) + 1)
            seeds.append(sid)
            labels.append(re.sub(r'[$#]', ' ', label))
            if len(seeds) >= 15:
                break

        froms = []
        urls = []
        if seeds:
            froms.append('磁力')
            urls.append('#'.join('%s$seed_%s' % (labels[i], seeds[i]) for i in range(len(seeds))))

        groups = {}
        order = []
        for name, url in pans:
            if name not in groups:
                groups[name] = []
                order.append(name)
            if len(groups[name]) < 10:  # 每种网盘最多 10 条（同 jar）
                groups[name].append(url)
        for name in order:
            froms.append(name)
            urls.append('#'.join('网盘%d$%s' % (i + 1, u) for i, u in enumerate(groups[name])))

        remarks = year
        if seeds:
            remarks = (remarks + ' ' if remarks else '') + '%d磁力' % len(seeds)
        if pans:
            remarks = (remarks + ' ' if remarks else '') + '%d网盘' % len(pans)

        vod = {
            'vod_id': vid,
            'vod_name': title or vid,
            'vod_pic': pic,
            'vod_director': director,
            'vod_actor': actor,
            'vod_type': vtype,
            'vod_year': year,
            'vod_area': area,
            'vod_content': desc,
            'vod_play_from': '$$$'.join(froms),
            'vod_play_url': '$$$'.join(urls),
            'vod_remarks': remarks,
        }
        return {'list': [vod]}

    def detailContent(self, ids):
        try:
            if isinstance(ids, str):
                vid = ids.strip()
            elif isinstance(ids, (list, tuple)) and ids:
                vid = str(ids[0]).strip()
            else:
                vid = str(ids or '').strip()
        except Exception:
            return {'list': []}
        if not vid:
            return {'list': []}
        if vid.startswith('seedhub_'):  # 兼容外部传入的伪 id
            vid = vid[len('seedhub_'):]
        html = self._get('/movies/%s/' % vid)
        if not html:
            return {'list': []}
        return self._parse_detail(vid, html)

    # ---------- 播放（对应 jar 的 s()/playerContent()） ----------

    def _magnet(self, seed_id):
        html = self._get('/link_start/?seed_id=%s&movie_title=magnet' % seed_id)
        if not html:
            return ''
        patterns = (
            r'(?:var|let|const)\s+data\s*=\s*["\']([^"\']+)["\']',
            r'data\s*=\s*["\']([A-Za-z0-9+/=]+)["\']',
            r'atob\(["\']([A-Za-z0-9+/=]+)["\']\)',
        )
        for pattern in patterns:
            m = re.search(pattern, html)
            if m:
                data = self._b64(m.group(1))
                if data.startswith('magnet:'):
                    return self._magnet_clean(data)
        m = re.search(r'(magnet:\?xt=urn:[^"\'\s<>]+)', html)
        if m:
            return self._magnet_clean(m.group(1))
        m = re.search(r'href=["\'](magnet:[^"\']+)["\']', html)
        if m:
            return self._magnet_clean(m.group(1))
        return ''

    def playerContent(self, flag, id, vipFlags):
        play_id = str(id or '')
        if play_id.startswith('seed_') or flag == '磁力':
            seed_id = play_id[len('seed_'):] if play_id.startswith('seed_') else play_id
            magnet = self._magnet(seed_id)
            if not magnet:
                return {'parse': 0, 'url': '', 'msg': '未找到磁力链接'}
            return {'parse': 0, 'playUrl': '', 'url': magnet}
        # 网盘链接：原样交给播放器/外部处理
        if play_id.startswith('http://') or play_id.startswith('https://'):
            return {'parse': 0, 'url': play_id, 'header': self._headers()}
        return {'parse': 0, 'url': play_id}