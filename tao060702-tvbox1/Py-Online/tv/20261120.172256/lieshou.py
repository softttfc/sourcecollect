# coding=utf-8
# !/usr/bin/python
# by嗷呜(finally)
import sys
sys.path.append("..")
import re
import hashlib
import hmac
import random
import string
from Crypto.Util.Padding import unpad
from concurrent.futures import ThreadPoolExecutor
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5, AES
from base64 import b64encode, b64decode
import json
import time
from base.spider import Spider

class Spider(Spider):

    def getName(self):
        return "电影猎手"

    def init(self, extend=""):
        self.device = self.device_id()
        self.host = self.gethost()
        pass

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def action(self, action):
        pass

    def destroy(self):
        pass

    t = str(int(time.time()))

    # 线路优先级: 尊享4k 打头, 其后为 4K-官方线路C 与优酷等平台聚合线
    # (腾讯/咪咕同类), 再官方线; 极速线路与官方线路-C 被CDN限速
    # (实测9~78KB/s)排最后, 仅作兜底
    _LINE_ORDER = ['尊享4k', '4K-官方线路C', '优酷视频', '腾讯视频', '咪咕视频',
                   '1080P-官方Y', '1080P-官方线路R', '高清-官方线路B',
                   '暴风线路', '量子线路', '非凡线路', '如意线路',
                   '无水印线路', '速播线路', '新浪线路', '天堂线路', '索尼线路',
                   '西瓜线路', '魔都线路', '极速线路', '官方线路-C']

    def homeContent(self, filter):
        result = {}
        filters = {}
        classes = []
        bba = self.url()
        data = self.fetch(f"{self.host}/api/v1/app/config?pack={bba[0]}&signature={bba[1]}", headers=self.header()).text
        data1 = self.aes(data)
        dy = {"class":"类型","area":"地区","lang":"语言","year":"年份","letter":"字母","by":"排序","sort":"排序"}
        data1['data']['movie_screen']['sort'].pop(0)
        for item in data1['data']['movie_screen']['sort']:
            item['n'] = item.pop('name')
            item['v'] = item.pop('value')
        for item in data1['data']['movie_screen']['filter']:
            has_non_empty_field = False
            classes.append({"type_name": item["name"], "type_id": str(item["id"])})
            for key in dy:
                if key in item and item[key]:
                    has_non_empty_field = True
                    break
            if has_non_empty_field:
                filters[str(item["id"])] = []
                filters[str(item["id"])].append(
                    {"key": 'sort', "name": '排序', "value": data1['data']['movie_screen']['sort']})
                for dkey in item:
                    if dkey in dy and item[dkey]:
                        item[dkey].pop(0)
                        value_array = [
                            {"n": value.strip(), "v": value.strip()}
                            for value in item[dkey]
                            if value.strip() != ""
                        ]
                        filters[str(item["id"])].append(
                            {"key": dkey, "name": dy[dkey], "value": value_array}
                        )
        result["class"] = classes
        result["filters"] = filters
        return result

    def homeVideoContent(self):
        bba = self.url()
        url = f'{self.host}/api/v1/movie/index_recommend?pack={bba[0]}&signature={bba[1]}'
        data = self.fetch(url, headers=self.header()).json()
        videos = []
        for item in data['data']:
            if len(item['list']) > 0:
                for it in item['list']:
                    try:
                        videos.append(self.voides(it))
                    except Exception:
                        continue
        result = {"list": videos}
        return result

    def categoryContent(self, tid, pg, filter, extend):
        body = {"type_id": tid, "sort": extend.get("sort", "by_default"), "class": extend.get("class", "类型"),
                "area": extend.get("area", "地区"), "year": extend.get("year", "年份"), "page": str(pg),
                "pageSize": "21"}
        result = {}
        list = []
        bba = self.url(body)
        url = f"{self.host}/api/v1/movie/screen/list?pack={bba[0]}&signature={bba[1]}"
        data = self.fetch(url, headers=self.header()).json()['data']['list']
        for item in data:
            list.append(self.voides(item))
        result["list"] = list
        result["page"] = pg
        result["pagecount"] = 9999
        result["limit"] = 90
        result["total"] = 999999
        return result

    def detailContent(self, ids):
        body = {"id": ids[0]}
        bba = self.url(body)
        url = f'{self.host}/api/v1/movie/detail?pack={bba[0]}&signature={bba[1]}'
        data = self.fetch(url, headers=self.header()).json()['data']
        video = {'vod_name': data.get('name'),'type_name': data.get('type_name'),'vod_year': data.get('year'),'vod_area': data.get('area'),'vod_remarks': data.get('dynami'),'vod_content': data.get('content')}
        # 供播放兜底使用: 记录影片id与线路名->code映射
        self._vid = ids[0]
        self._line_code = {}
        # 线路按优先级排序(未列出的保持原顺序在后)
        order = self._LINE_ORDER
        lines = sorted(data["play_from"], key=lambda l: order.index(l['name']) if l['name'] in order else len(order))
        entries = []  # [名称, 集数串]
        tasks = []
        for itt in lines:
            self._line_code[itt["name"]] = itt["code"]
            if len(itt["list"]) > 0:
                entries.append([itt["name"], self.playeach(itt['list'])])
            else:
                tasks.append(itt)
        if tasks:
            # 注意: API服务器限制并发, 线程数过高会导致列表返回空
            with ThreadPoolExecutor(max_workers=min(3, len(tasks))) as executor:
                for name, result_ in zip(tasks, executor.map(self._playlist_by_line, tasks)):
                    if result_:  # 无地址的死线路直接隐藏, 不再显示空线路
                        entries.append([name["name"], result_])
        pri = {n: i for i, n in enumerate(order)}
        entries.sort(key=lambda e: pri.get(e[0], len(order)))  # 最终统一按优先级排序
        names = [e[0] for e in entries]
        play = [e[1] for e in entries]
        video["vod_play_from"] = "$$$".join(names)
        video["vod_play_url"] = "$$$".join(play)
        result = {"list": [video]}
        return result

    def searchContent(self, key, quick, pg=1):
        body = {"keyword": key, "sort": "", "type_id": "0", "page": str(pg), "pageSize": "10",
                "res_type": "by_movie_name"}
        bba = self.url(body)
        url = f"{self.host}/api/v1/movie/search?pack={bba[0]}&signature={bba[1]}"
        data = self.fetch(url, headers=self.header()).json()['data'].get('list')
        videos = []
        for it in data:
            try:
                videos.append(self.voides(it))
            except Exception:
                continue
        result = {"list": videos, "page": pg}
        return result

    def playerContent(self, flag, id, vipFlags):
        # 不自动换线: 点哪条线路就播哪条, 直出该线路解析结果
        url = ''
        if "m3u8" in id or "mp4" in id:
            url = id
        else:
            try:
                add = id.split('|||')
                url = self._resolve_one(add[0], add[1], add[2])
            except Exception:
                url = ''
        if url and ('.jpg' in url or '.jpeg' in url or '.png' in url):
            url = self.getProxyUrl() + "&url=" + b64encode(url.encode('utf-8')).decode('utf-8') + "&type=m3u8"
        result = {}
        result["parse"] = 0
        result["url"] = url
        # 播放地址不带UA头(海阔JS引擎实测): 本源CDN均不挑UA, 带头反而部分线路异常
        result["header"] = {}
        return result

    def localProxy(self, param):
        url = b64decode(param["url"]).decode('utf-8')
        durl = url[:url.rfind('/')]
        data = self.fetch(url, headers=self.header()).content.decode("utf-8")
        lines = data.strip().split('\n')
        for index, string in enumerate(lines):
            if '#EXT' not in string and 'http' not in string:
                lines[index] = durl + ('' if string.startswith('/') else '/') + string
        data = '\n'.join(lines)
        return [200, "application/vnd.apple.mpegurl", data]

    def _playlist_by_line(self, itt):
        try:
            body = {"movie_id": self._vid, "from_code": itt["code"]}
            data = []
            for attempt in range(2):
                bba = self.url(body)
                data = self.fetch(f'{self.host}/api/v1/movie_addr/list?pack={bba[0]}&signature={bba[1]}',
                                  headers=self.header()).json().get('data') or []
                if data:
                    break
                if attempt == 0:
                    time.sleep(0.8)  # 限流退避后重试一次
            return self.playeach(data)
        except Exception:
            return []

    def _resolve_one(self, from_code, play_url, episode_id):
        # 二次解析(parse_url), 返回最终播放地址; 失败返回 ''
        ckey = (from_code, play_url, str(episode_id))
        hit = self._res_cache.get(ckey)
        if hit:
            return hit  # 同一集已解析过, 直接复用省一次请求
        # 服务端对请求突发限流(返回空data), 失败时退避重试一次
        for attempt in range(2):
            try:
                data = {"from_code": from_code, "play_url": play_url, "episode_id": episode_id, "type": "play"}
                bba = self.url(data)
                data2 = self.fetch(f"{self.host}/api/v1/movie_addr/parse_url?pack={bba[0]}&signature={bba[1]}",
                                   headers=self.header()).json()['data']
                url = data2.get('play_url') or data2.get('download_url') or ''
                if url:
                    try:
                        url1 = self.fetch(url, headers=self.header(), allow_redirects=False).headers.get('Location')
                        if url1 and "http" in url1:
                            url = url1
                    except Exception:
                        pass
                    self._res_cache[ckey] = url
                    return url
            except Exception:
                pass
            if attempt == 0:
                time.sleep(1.2)  # 限流退避后重试
        return ''

    _res_cache = {}    # (线路code, play_url, episode_id) -> 已解析地址: 二次解析结果复用

    def device_id(self):
        characters = string.ascii_lowercase + string.digits
        random_string = ''.join(random.choices(characters, k=32))
        return random_string

    def gethost(self):
        headers = {
            'User-Agent': 'okhttp/4.9.2',
            'Connection': 'Keep-Alive',
        }
        response = self.fetch('https://app-site.ecoliving168.com/domain_v5.json', headers=headers).json()
        url = response['api_service'].replace('/api/', '')
        return url

    def header(self):
        # 时间戳随请求刷新, 避免进程长时间运行后签名时间过期导致接口失败
        self.t = str(int(time.time()))
        headers = {
            'User-Agent': 'Android',
            'Accept': 'application/prs.55App.v2+json',
            'timestamp': self.t,
            'x-client-setting': '{"pure-mode":1}',
            'x-client-uuid': '{"device_id":' + self.device + '}, "type":1,"brand":"Redmi", "model":"M2012K10C", "system_version":30, "sdk_version":"3.1.0.7"}',
            'x-client-version': '3096 '
        }
        return headers

    def url(self, id=None):
        if not id:
            id = {}
        id["timestamp"] = self.t
        public_key = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA02F/kPg5A2NX4qZ5JSns+bjhVMCC6JbTiTKpbgNgiXU+Kkorg6Dj76gS68gB8llhbUKCXjIdygnHPrxVHWfzmzisq9P9awmXBkCk74Skglx2LKHa/mNz9ivg6YzQ5pQFUEWS0DfomGBXVtqvBlOXMCRxp69oWaMsnfjnBV+0J7vHbXzUIkqBLdXSNfM9Ag5qdRDrJC3CqB65EJ3ARWVzZTTcXSdMW9i3qzEZPawPNPe5yPYbMZIoXLcrqvEZnRK1oak67/ihf7iwPJqdc+68ZYEmmdqwunOvRdjq89fQMVelmqcRD9RYe08v+xDxG9Co9z7hcXGTsUquMxkh29uNawIDAQAB'
        encrypted_text = json.dumps(id)
        public_key = RSA.import_key(b64decode(public_key))
        cipher = PKCS1_v1_5.new(public_key)
        # 修复: 尊享4k(lv5)等线路的 parse 令牌长达280+字符, 请求体超过
        # RSA-2048 单块上限(245字节)会抛 "Plaintext is too long",
        # playerContent 里 except 吞掉后播不了。改为超长时分段加密拼接(与App行为一致)。
        plain = encrypted_text.encode('utf-8')
        max_len = 245  # 256 - 11(PKCS1_v1_5 padding 开销)
        if len(plain) <= max_len:
            encrypted_message = cipher.encrypt(plain)
        else:
            encrypted_message = b''.join(
                cipher.encrypt(plain[i:i + max_len])
                for i in range(0, len(plain), max_len)
            )
        encrypted_message_base64 = b64encode(encrypted_message).decode('utf-8')
        result = encrypted_message_base64.replace('+', '-').replace('/', '_').replace('=', '')
        key = '635a580fcb5dc6e60caa39c31a7bde48'
        sign = hmac.new(key.encode(), result.encode(), hashlib.md5).hexdigest()
        return result, sign

    def playeach(self,data):
        play_urls = []
        for it in data:
            if re.search(r"mp4|m3u8", it["play_url"]):
                play_urls.append(f"{it['episode_name']}${it['play_url']}")
            else:
                play_urls.append(
                    f"{it['episode_name']}${it['from_code']}|||{it['play_url']}|||{it['episode_id']}"
                )
        return '#'.join(play_urls)

    def voides(self, item):
        if item['name'] or item['title']:
            voide = {
                "vod_id": item.get('id') or item.get('click'),
                'vod_name': item.get('name') or item.get('title'),
                'vod_pic': item.get('cover') or item.get('image'),
                'vod_year': item.get('year') or item.get('label'),
                'vod_remarks': item.get('dynamic') or item.get('sub_title')
            }
            return voide

    def aes(self, text):
        text = text.replace('-', '+').replace('_', '/') + '=='
        key = b"e6d5de5fcc51f53d"
        iv = b"2f13eef7dfc6c613"
        cipher = AES.new(key, AES.MODE_CBC, iv)
        pt = unpad(cipher.decrypt(b64decode(text)), AES.block_size).decode("utf-8")
        return json.loads(pt)
