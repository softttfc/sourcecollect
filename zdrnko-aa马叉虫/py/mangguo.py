# -*- coding: utf-8 -*-

import json
import re
import base64
import gzip
import ssl
import urllib.parse
import urllib.request

try:
    from base.spider import Spider as _BaseSpider
except Exception:
    class _BaseSpider:
        pass

_CTX = ssl._create_unverified_context()
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
_HEADERS = {'User-Agent': UA, 'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9'}

_HOST = 'https://www.mgtv.com'
_LIST_API = 'https://pianku.api.mgtv.com/rider/list/pcweb/v3'
_EPISODE_API = 'https://pcweb.api.mgtv.com/episode/list'
_SEARCH_API = 'https://mobileso.bz.mgtv.com/msite/search/v2'
_PLAYER_VIDEO = 'https://pcweb.api.mgtv.com/player/video'
_PLAYER_SOURCE = 'https://pcweb.api.mgtv.com/player/getSource'


_DID = 'f11dee65-4e0d-4d25-bfce-719ad9dc991d'

_CLIT = 1794480
_CK = {'Cookie': 'PM_CHKID=1'}
_REF = {'User-Agent': UA, 'Referer': 'https://www.mgtv.com/'}

_SUF_UA = 'okhttp/3.14.9'


CHANNELS = [
    ('2', '电视剧'), ('3', '电影'), ('1', '综艺'),
    ('50', '动漫'), ('10', '少儿'), ('51', '纪实'),
]

_META = {}

_PLAY = {'parse': 0, 'jx': 1, 'direct': 1, 'quality': 0,
         'atref': 1, 'hdrstr': 0}
_SEARCH_MODE = 'auto'


def _fetch(url, ref=None, timeout=6, extra=None):
    try:
        h = dict(_HEADERS)
        if ref:
            h['Referer'] = ref
        if extra:
            h.update(extra)
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
            raw = r.read()
            if r.headers.get('Content-Encoding') == 'gzip':
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    pass
            return raw.decode('utf-8', 'replace')
    except Exception:
        return ''


def _https(u):
    u = (u or '').strip()
    if u.startswith('//'):
        return 'https:' + u
    if u.startswith('http://'):
        return 'https://' + u[7:]
    return u


def _q(s):
    return urllib.parse.quote(str(s), safe='')


def _tk2(s):
    return base64.urlsafe_b64encode(s.encode('utf-8')).decode('ascii').rstrip('=')[::-1]


def _url_of(v):
    s = str(v or '').strip()
    if s.startswith('http'):
        return s
    try:
        return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4)).decode('utf-8')
    except Exception:
        return ''


def _vid_of(u):
    try:
        return base64.urlsafe_b64encode(u.encode('utf-8')).decode('ascii').rstrip('=')
    except Exception:
        return u


def _fallback_card():
    return {'vod_id': 'web' + _vid_of('https://so.mgtv.com/so?k='),
            'vod_name': '芒果TV接口暂不可达·点此打开官网',
            'vod_pic': '', 'vod_remarks': '检查网络后下拉刷新'}


def _resolve_m3u8(page):

    try:
        m = re.search(r'/(\d+)\.html', page)
        if not m:
            return ''
        vid = m.group(1)
        clit = _CLIT
        tk2 = _tk2('did=%s|pno=1030|ver=5.5.1|clit=%d' % (_DID, clit))

        # 1) player/video -> pm2
        txt = _fetch('%s?video_id=%s&tk2=%s' % (_PLAYER_VIDEO, vid, _q(tk2)),
                     page, extra=_CK)
        if not txt or txt.lstrip()[:1] != '{':
            return ''
        pm2 = (((json.loads(txt).get('data') or {}).get('atc') or {})
               .get('pm2') or '')
        if not pm2:
            return ''

        tk2b = _tk2('clit=%d' % clit)
        su = ('%s?video_id=%s&tk2=%s&pm2=%s'
              '&did=%s&suuid=&cxid=&type=pch5&_support=10000000'
              '&auth_mode=1&allowedRC=1&abroad=0'
              % (_PLAYER_SOURCE, vid, _q(tk2b), _q(pm2), _DID))
        stxt = _fetch(su, page, extra=_CK)
        if not stxt or stxt.lstrip()[:1] != '{':
            return ''
        d = json.loads(stxt).get('data') or {}

        doms = [x for x in (d.get('stream_domain') or []) if x][:3]
        streams = [s for s in (d.get('stream') or []) if s.get('url')]
        if not doms or not streams:
            return ''
        doms = [('https://' + x[7:] if x.startswith('http://') else x)
                for x in doms]

        want = str(_PLAY.get('quality') or '')
        if want:
            first = [s for s in streams if str(s.get('def') or '') == want]
            rest = [s for s in streams if str(s.get('def') or '') != want]

            pick = first + sorted(rest, key=lambda s: int(s.get('def') or 0),
                                  reverse=True)
        else:
            pick = sorted(streams, key=lambda s: int(s.get('def') or 0), reverse=True)


        for s in pick[:3]:
            for dom in doms:
                z = _fetch(dom + str(s['url']), page, extra=_CK, timeout=5)
                if not z or z.lstrip()[:1] != '{':
                    continue
                try:
                    info = str(json.loads(z).get('info') or '')
                except Exception:
                    continue
                if info.startswith('http') and '.m3u8' in info:
                    return info
        return ''
    except Exception:
        return ''


def _put_meta(cid, name, pic, remark, content, part_id=''):
    _META[str(cid)] = {'vod_name': name, 'vod_pic': pic,
                       'vod_remarks': remark, 'vod_content': content,
                       'part_id': str(part_id or '')}


def _card(cid, name, pic, remark, content, part_id=''):
    _put_meta(cid, name, pic, remark, content, part_id)
    return {'vod_id': str(cid), 'vod_name': name,
            'vod_pic': pic, 'vod_remarks': remark}


def _list_docs(cid, pg):

    u = '%s?pn=%s&pc=20&channelId=%s&sort=c2' % (_LIST_API, pg, _q(cid))
    txt = _fetch(u, _HOST + '/')
    if not txt or txt.lstrip()[:1] != '{':
        return []
    try:
        j = json.loads(txt)
        if str(j.get('code')) != '200':
            return []
        return ((j.get('data') or {}).get('hitDocs') or [])
    except Exception:
        return []


def _category_list(cid, pg):
    out = []
    for it in _list_docs(cid, pg):
        c = str(it.get('clipId') or '')
        name = re.sub(r'<[^>]+>', '', str(it.get('title') or '')).strip()
        if not c or not name:
            continue
        pic = _https(it.get('img') or it.get('imgUrlH') or '')
        remark = str(it.get('updateInfo') or it.get('subtitle') or '').strip()
        content = str(it.get('story') or '').strip()
        out.append(_card(c, name, pic, remark, content, it.get('playPartId') or ''))
    return out


def _official_search(kw):

    u = ('%s?q=%s&pc=30&pn=1&sort=-99&ty=0&du=0&pt=0&corr=1'
         '&abroad=0&_support=10000000000000000') % (_SEARCH_API, _q(kw))
    txt = _fetch(u, 'https://m.mgtv.com/', timeout=6)
    if not txt or txt.lstrip()[:1] != '{':
        return []
    out = []
    try:
        j = json.loads(txt)
        for block in (((j.get('data') or {}).get('contents')) or []):
            if block.get('type') != 'media':
                continue
            for it in (block.get('data') or []):
                if not isinstance(it, dict):
                    continue

                if str(it.get('source') or 'imgo') != 'imgo':
                    continue
                url = str(it.get('url') or '')
                m = re.search(r'/b/(\d+)', url)
                if not m:
                    continue
                cid = m.group(1)
                name = re.sub(r'<[^>]+>', '', str(it.get('title') or '')).strip()
                if not name:
                    continue
                pic = _https(it.get('img') or '')
                desc = it.get('desc') or []
                remark = ''
                if isinstance(desc, list) and desc:
                    remark = str(desc[0]).replace('类型:', '').split('/')[0].strip()
                out.append(_card(cid, name, pic, remark, remark))
    except Exception:
        pass
    return out


def _local_search(kw):

    pool, seen = [], set()
    for cid, _ in CHANNELS:
        for pg in (1, 2):
            for it in _list_docs(cid, pg):
                c = str(it.get('clipId') or '')
                if not c or c in seen:
                    continue
                seen.add(c)
                pool.append(it)
    out = []
    for it in pool:
        name = re.sub(r'<[^>]+>', '', str(it.get('title') or '')).strip()
        if not name or kw not in name:
            continue
        c = str(it.get('clipId') or '')
        pic = _https(it.get('img') or it.get('imgUrlH') or '')
        remark = str(it.get('updateInfo') or it.get('subtitle') or '').strip()
        out.append(_card(c, name, pic, remark, str(it.get('story') or '').strip(),
                         it.get('playPartId') or ''))
    return out


class Spider(_BaseSpider):

    def getName(self):
        return '芒果TV'

    def init(self, extend=""):
        global _SEARCH_MODE
        try:

            _PLAY.update({'parse': 0, 'jx': 1, 'direct': 1, 'quality': 0,
                          'atref': 1, 'hdrstr': 0})
            _SEARCH_MODE = 'auto'
            ext = (extend or '').strip()
            if ext.startswith('{'):
                c = json.loads(ext)
                if 'parse' in c:
                    _PLAY['parse'] = 1 if str(c.get('parse')) == '1' else 0
                if 'jx' in c:
                    _PLAY['jx'] = 1 if str(c.get('jx')) == '1' else 0
                if 'direct' in c:
                    _PLAY['direct'] = 0 if str(c.get('direct')) == '0' else 1
                if 'atref' in c:
                    _PLAY['atref'] = 1 if str(c.get('atref')) == '1' else 0
                if 'hdr' in c:
                    _PLAY['hdrstr'] = 1 if str(c.get('hdr')) == 'str' else 0
                if c.get('quality'):
                    try:
                        _PLAY['quality'] = int(c.get('quality'))
                    except Exception:
                        pass
                if c.get('search'):
                    _SEARCH_MODE = str(c.get('search'))
        except Exception:
            pass
        return None

    def _classes(self):
        return [{'type_id': cid, 'type_name': cname} for cid, cname in CHANNELS]

    def homeContent(self, filter=False):
        try:
            lst = _category_list('2', 1)
        except Exception:
            lst = []
        if not lst:
            lst = [_fallback_card()]
        return {'class': self._classes(), 'list': lst}

    def homeVideoContent(self):
        return self.homeContent()

    def categoryContent(self, tid='2', pg='1', filter=False, extend=None):
        try:
            p = int(pg or 1)
        except Exception:
            p = 1
        cid = str(tid or '2')
        if cid not in [x[0] for x in CHANNELS]:
            cid = '2'
        try:
            lst = _category_list(cid, p)
        except Exception:
            lst = []
        if not lst:
            lst = [_fallback_card()]
        return {'list': lst, 'page': p, 'pagecount': 99999,
                'limit': 20, 'total': 999999}

    def detailContent(self, ids):
        cid = str(ids[0]) if isinstance(ids, (list, tuple)) and ids else str(ids)

        if cid.startswith('web'):
            page = _url_of(cid[3:])
            if not page.startswith('http'):
                page = 'https://www.mgtv.com/'
            return {'list': [{
                'vod_id': cid, 'vod_name': '芒果TV搜索', 'vod_pic': '',
                'vod_content': '芒果TV官网搜索页，由壳解析播放',
                'vod_remarks': '', 'type_name': '',
                'vod_play_from': '壳解析',
                'vod_play_url': '打开搜索页$' + _vid_of(page),
            }]}
        cid = re.sub(r'[^0-9A-Za-z]', '', cid)
        if not cid:
            return {'list': []}
        txt = _fetch('%s?collection_id=%s&page=1&size=50' % (_EPISODE_API, _q(cid)),
                     _HOST + '/')
        eps = []
        info = {}
        if txt and txt.lstrip()[:1] == '{':
            try:
                j = json.loads(txt)
                d = j.get('data') or {}
                info = d.get('info') or {}

                bucket, order = {}, []
                for it in (d.get('list') or []):
                    t1 = str(it.get('t1') or '').strip()
                    if t1 and not t1.isdigit():
                        continue
                    u = str(it.get('url') or '')
                    if u.startswith('/'):
                        u = _HOST + u
                    if not u.startswith('http'):
                        v = str(it.get('video_id') or '')
                        if not v:
                            continue
                        u = '%s/b/%s/%s.html' % (_HOST, cid, v)
                    title = (str(it.get('t4') or '') or str(it.get('t3') or '')
                             or ('第%s集' % t1 if t1 else '')
                             or str(it.get('t2') or '') or '正片').strip() or '正片'
                    key = t1 or str(it.get('video_id') or '') or title
                    clean = 0 if re.search(r'看点|花絮|预告|竖屏|彩蛋|特辑',
                                           str(it.get('t3') or '')) else 1
                    if key not in bucket:
                        order.append(key)
                        bucket[key] = (title, u, clean)
                    elif clean and not bucket[key][2]:
                        bucket[key] = (title, u, clean)
                eps = [bucket[k][:2] for k in order]
            except Exception:
                pass

        if not eps:
            pid = (_META.get(cid, {}) or {}).get('part_id') or cid
            eps = [('正片', '%s/b/%s/%s.html' % (_HOST, cid, pid))]
        m = _META.get(cid, {})
        name = m.get('vod_name') or (info.get('title') if isinstance(info, dict) else '') or '芒果TV'
        pic = m.get('vod_pic') or ''
        content = (m.get('vod_content')
                   or (info.get('desc') if isinstance(info, dict) else '')
                   or '芒果TV官网播放页，由壳解析播放')

        seg = '#'.join('%s$%s' % (t, _vid_of(u)) for t, u in eps)
        return {'list': [{
            'vod_id': cid,
            'vod_name': name,
            'vod_pic': pic,
            'vod_content': content,
            'vod_remarks': m.get('vod_remarks') or '',
            'type_name': '',
            'vod_play_from': '直连$$$直连·请求头$$$壳解析',
            'vod_play_url': seg + '$$$' + seg + '$$$' + seg,
        }]}

    def searchContent(self, key='', quick=False, pg='1'):
        try:
            p = int(pg or 1)
        except Exception:
            p = 1
        kw = str(key or '').strip()
        out = []
        if kw:
            if _SEARCH_MODE != 'local':
                out = _official_search(kw)
            if not out:
                out = _local_search(kw)
        if not out and kw:
            u = 'https://so.mgtv.com/so?k=' + _q(kw)
            out = [_card(kw, kw + ' (芒果TV搜索)', '', '芒果TV', '在芒果TV搜索「%s」' % kw)]
            out[0]['vod_id'] = 'web' + _vid_of(u)
        return {'list': out, 'page': p, 'pagecount': 1,
                'limit': len(out), 'total': len(out)}

    def playerContent(self, flag='', id='', vipFlags=None):
        try:
            page = _url_of(id)
            if not page.startswith('http'):
                return {'parse': 0, 'url': '', 'jx': 0}
            f = str(flag or '')

            def jx():
                mp = page.replace('https://www.mgtv.com/b/',
                                  'https://m.mgtv.com/b/')
                return {'parse': _PLAY['parse'], 'jx': _PLAY['jx'], 'url': mp,
                        'header': {'User-Agent': UA,
                                   'Referer': 'https://m.mgtv.com/'}}

            if ('壳解析' in f) or not _PLAY.get('direct'):
                return jx()

            m3 = _resolve_m3u8(page)
            if not m3:
                return jx()

            hdr = dict(_REF)
            hv = json.dumps(hdr) if _PLAY.get('hdrstr') else hdr

            if ('请求头' not in f) and _PLAY.get('atref', 1):
                url = (m3 + '@Referer=' + _HOST + '/'
                       + '@User-Agent=' + _SUF_UA)
            else:
                # 线路「直连·请求头」/ ext atref:0：纯净 m3u8 + header 字典
                url = m3
            return {'parse': 0, 'jx': 0, 'url': url,
                    'header': hv, 'headers': hdr}
        except Exception:
            return {'parse': 0, 'url': '', 'jx': 0}

    def manualVideoCheck(self):
        return None

    def isVideoFormat(self, url):
        return False

    def destroy(self):
        return None

    def close(self):
        return None

    def getDependence(self):
        return []

    def proxy(self, param):
        return None

    def localProxy(self, param):
        return None