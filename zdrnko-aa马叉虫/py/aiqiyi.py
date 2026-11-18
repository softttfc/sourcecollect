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

_HOST = 'https://www.iqiyi.com'
_API = 'https://pcw-api.iqiyi.com/search/recommend/list'
_SUGGEST = 'https://suggest.video.iqiyi.com/?key='

CHANNELS = [
    ('1', '电视剧'), ('2', '电影'), ('6', '综艺'), ('4', '动漫'),
    ('15', '少儿'), ('16', '纪录片'), ('3', '短剧'), ('5', '娱乐'),
]

_META = {}
_PLAY = {'parse': 0, 'jx': 1}


def _fetch(url, ref=None, timeout=6):
    try:
        h = dict(_HEADERS)
        if ref:
            h['Referer'] = ref
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


def _clean_page(u):
    u = (u or '').strip().split('?')[0].split('#')[0]
    u = _https(u)
    return u if u.startswith('http') else ''


def _vid_of(u):
    try:
        return base64.urlsafe_b64encode(u.encode('utf-8')).decode('ascii').rstrip('=')
    except Exception:
        return u


def _url_of(v):
    s = str(v or '').strip()
    if s.startswith('http'):
        return _clean_page(s)
    try:
        return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4)).decode('utf-8')
    except Exception:
        return ''


def _cards(ch, pg):
    api = '%s?channel_id=%s&data_type=1&mode=11&page_id=%s&ret_num=30' % (_API, ch, pg)
    txt = _fetch(api, _HOST + '/')
    out = []
    try:
        j = json.loads(txt)
        if j.get('code') != 'A00000':
            return out
        for it in ((j.get('data') or {}).get('list') or []):
            purl = _clean_page(it.get('playUrl') or '')
            name = str(it.get('name') or '').strip()
            if not purl or not name:
                continue
            pic = _https(it.get('imageUrl') or '')
            vc = it.get('videoCount') or 0
            lo = it.get('latestOrder') or 0
            if lo:
                remark = '更新至%s' % lo
            elif vc and vc > 1:
                remark = '%s集' % vc
            else:
                remark = '正片'
            _META[purl] = {
                'vod_name': name,
                'vod_pic': pic,
                'vod_remarks': remark,
                'vod_content': str(it.get('description') or '').strip(),
            }
            out.append({
                'vod_id': _vid_of(purl),
                'vod_name': name,
                'vod_pic': pic,
                'vod_remarks': remark,
            })
    except Exception:
        pass
    return out


class Spider(_BaseSpider):

    def getName(self):
        return '爱奇艺'

    def init(self, extend=""):
        try:
            ext = (extend or '').strip()
            if ext.startswith('{'):
                c = json.loads(ext)
                if 'parse' in c:
                    _PLAY['parse'] = 1 if str(c.get('parse')) == '1' else 0
                if 'jx' in c:
                    _PLAY['jx'] = 1 if str(c.get('jx')) == '1' else 0
        except Exception:
            pass
        return None

    def _classes(self):
        return [{'type_id': cid, 'type_name': cname} for cid, cname in CHANNELS]

    def homeContent(self, filter=False):
        try:
            return {'class': self._classes(), 'list': _cards('1', 1)}
        except Exception:
            return {'class': self._classes(), 'list': []}

    def homeVideoContent(self):
        return self.homeContent()

    def categoryContent(self, tid='1', pg='1', filter=False, extend=None):
        try:
            p = int(pg or 1)
        except Exception:
            p = 1
        ch = str(tid or '1')
        if not ch.isdigit():
            ch = '1'
        lst = _cards(ch, p)
        return {'list': lst, 'page': p, 'pagecount': 99999,
                'limit': 30, 'total': 999999}

    def detailContent(self, ids):
        vid = str(ids[0]) if isinstance(ids, (list, tuple)) and ids else str(ids)
        purl = _url_of(vid)
        if not purl.startswith('http'):
            return {'list': []}
        m = _META.get(purl, {})
        name = m.get('vod_name') or ''
        pic = m.get('vod_pic') or ''
        desc = m.get('vod_content') or ''
        if not name:
            h = _fetch(purl, _HOST + '/')
            t = re.search(r'<title>([^<]+)</title>', h or '')
            if t:
                name = re.sub(r'[_\-].*$', '', t.group(1)).replace('爱奇艺', '').strip()
        return {'list': [{
            'vod_id': vid,
            'vod_name': name or '爱奇艺',
            'vod_pic': pic,
            'vod_content': desc or '爱奇艺官网播放页，由壳解析播放',
            'vod_remarks': m.get('vod_remarks') or '',
            'type_name': '',
            'vod_play_from': '爱奇艺',
            'vod_play_url': '正片$' + _vid_of(purl),
        }]}

    def searchContent(self, key='', quick=False, pg='1'):
        try:
            p = int(pg or 1)
        except Exception:
            p = 1
        kw = str(key or '').strip()
        out = []
        if kw:
            txt = _fetch(_SUGGEST + urllib.parse.quote(kw), 'https://so.iqiyi.com/')
            try:
                j = json.loads(txt)
                seen = set()
                for it in (j.get('data') or []):
                    nm = str(it.get('name') or '').strip()
                    if not nm or nm in seen:
                        continue
                    seen.add(nm)
                    si = str(it.get('str_suggest_info') or '')
                    mm = re.match(r'^\d+_(\d+)_', si)
                    qid = mm.group(1) if mm else ''
                    purl = ('https://www.iqiyi.com/v_%s.html' % qid) if qid else \
                           ('https://so.iqiyi.com/so/q_' + urllib.parse.quote(nm))
                    desc = ' '.join(x for x in [str(it.get('cname') or ''),
                                                str(it.get('year') or '')] if x)
                    _META[purl] = {
                        'vod_name': nm,
                        'vod_pic': _https(it.get('picture_url') or ''),
                        'vod_remarks': desc,
                        'vod_content': desc,
                    }
                    out.append({
                        'vod_id': _vid_of(purl),
                        'vod_name': nm,
                        'vod_pic': _https(it.get('picture_url') or ''),
                        'vod_remarks': desc,
                    })
            except Exception:
                pass
        if not out and kw:
            purl = 'https://so.iqiyi.com/so/q_' + urllib.parse.quote(kw)
            out.append({'vod_id': _vid_of(purl),
                        'vod_name': kw + ' (爱奇艺搜索)',
                        'vod_pic': '', 'vod_remarks': '爱奇艺'})
        return {'list': out, 'page': p, 'pagecount': 1,
                'limit': len(out), 'total': len(out)}

    def playerContent(self, flag='', id='', vipFlags=None):
        try:
            purl = _url_of(id)
            if not purl.startswith('http'):
                return {'parse': 0, 'url': '', 'jx': 0}
            r = {'parse': _PLAY['parse'], 'jx': _PLAY['jx'], 'url': purl,
                 'header': {'User-Agent': UA, 'Referer': _HOST + '/'}}
            return r
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