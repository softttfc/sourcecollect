#!/usr/bin/env python3
"""音源可用性探测脚本。

遍历仓库内各音源的 latest.js，通过三种静态手段提取上游主机名
（明文 URL、十六进制转义字符串解码、头部 SERVER_SCRIPT_CONFIG
配置块），对去重后的主机发起 HTTP GET 探测并按响应分类，最终以
markdown 表格输出。

--update-readme 模式下将表格写回 README.md 的锚点章节，并持久化
滞后判定（连续 2 次不可达才判"失效"）所需的失败计数到
.health-state.json。

约定：
- 仅使用 Python 标准库；
- 不执行任何音源脚本代码（安全边界）；
- 检测时间一律按北京时间（UTC+8）呈现。
"""

import argparse
import json
import re
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib import error as urllib_error
from urllib import request as urllib_request
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
README_PATH = ROOT / 'README.md'
STATE_PATH = ROOT / '.health-state.json'

# 兼容 Windows GBK 控制台，避免状态 emoji 输出导致 UnicodeEncodeError
# （与 CreateLatest.py 保持一致的做法）
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PROBE_TIMEOUT = 10  # 单目标探测超时（秒）
MAX_WORKERS = 8     # 并发探测线程上限
FAIL_THRESHOLD = 2  # 连续失败多少次判定为"失效"
USER_AGENT = 'lx-music-source-health-check/1.0 (+https://github.com/pdone/lx-music-source)'
BEIJING_TZ = timezone(timedelta(hours=8))  # 北京时间（UTC+8）

# 探测状态
STATUS_OK = '可用'
STATUS_WARN = '异常'
STATUS_DEAD = '失效'
STATUS_UNKNOWN = '无法探测'
# 状态圆形标识：绿=可用，黄=异常，红=失效
STATUS_ICON = {
    STATUS_OK: '🟢',
    STATUS_WARN: '🟡',
    STATUS_DEAD: '🔴',
    STATUS_UNKNOWN: '⚪',
}

# README 锚点：脚本只重写两个标记之间的内容
README_START = '<!-- HEALTH-CHECK:START -->'
README_END = '<!-- HEALTH-CHECK:END -->'
README_SECTION_TITLE = '## 音源可用性'

# 主机名（兼容 punycode 域名，如 88.lxmusic.xn--fiqs8s）
RE_HOST = re.compile(r'https?://((?:[A-Za-z0-9-]+\.)+(?:xn--[A-Za-z0-9-]+|[A-Za-z]{2,}))')
# IPv4 字面量（qdy 含裸 IP 链路）
RE_IPV4 = re.compile(r'https?://((?:\d{1,3}\.){3}\d{1,3})')
# 裸 IPv4 字面量（探测时判断是否走 http，不含 scheme）
RE_IPV4_LITERAL = re.compile(r'(?:\d{1,3}\.){3}\d{1,3}')
# 裸主机名（不带 scheme）。仅用于匹配十六进制解码后的字符串文本——
# 混淆阵列里 mirror.com 这类配置域名以裸形式存储，带 scheme 的正则匹配不到。
# 不用于全文扫描，避免把代码里的普通标识符误判为域名。
RE_BARE_HOST = re.compile(r'((?:[A-Za-z0-9-]+\.)+(?:xn--[A-Za-z0-9-]+|[A-Za-z]{2,}))')
# 连续十六进制转义串（字符串阵列混淆，如 flower/grass）。
# 用 chr(92) 构字面反斜杠，避免源码转义层级歧义。
_BS = chr(92)
RE_HEX_RUN = re.compile(r'(?:' + re.escape(_BS) + r'x[0-9a-fA-F]{2}){4,}')
RE_HEX_BYTE = re.compile(re.escape(_BS) + r'x([0-9a-fA-F]{2})')
# 头部服务端下发配置块（lx 音源的 apiUrl 为 JSON 转义斜杠，明文正则匹配不到）
RE_SERVER_CONFIG = re.compile(r"SERVER_SCRIPT_CONFIG'?\]?\s*=\s*(\{[^{}]*\})")

# 明显不属于上游服务的域名黑名单：
#   www.w3.org  —— XML 命名空间噪音；
#   gistry.npm  —— registry.npmjs.org 被混淆阵列拆断后的碎片，非真实主机。
DOMAIN_BLOCKLIST = {'www.w3.org', 'gistry.npm'}


def extract_hosts(text):
    """从音源源码中静态提取上游主机名，不执行脚本代码。"""
    hosts = set()
    for regex in (RE_HOST, RE_IPV4):
        hosts.update(m.lower() for m in regex.findall(text))
    # 十六进制转义字符串解码（flower/grass 的配置域名以此形式存储）
    for run in RE_HEX_RUN.findall(text):
        try:
            decoded = bytes(int(h, 16) for h in RE_HEX_BYTE.findall(run)).decode('ascii')
        except (ValueError, UnicodeDecodeError):
            continue
        # 带 scheme 的完整 URL
        for regex in (RE_HOST, RE_IPV4):
            hosts.update(m.lower() for m in regex.findall(decoded))
        # 裸主机名：仅当整条解码字符串恰好就是一个主机名时才采纳。
        # 混淆阵列会把完整 URL 拆成相邻碎片（如 'js.org/flo' 是
        # registry.npmjs.org 的尾段），带路径的碎片不能作为探测目标。
        if '/' not in decoded and RE_BARE_HOST.fullmatch(decoded):
            hosts.add(decoded.lower())
    # 头部服务端下发配置（lx 音源的 apiUrl 是 JSON 转义斜杠，只能整块解析）
    for raw in RE_SERVER_CONFIG.findall(text):
        try:
            config = json.loads(raw)
        except ValueError:
            continue
        api_url = config.get('apiUrl') or config.get('api_url')
        if api_url:
            host = urlsplit(api_url).hostname
            if host:
                hosts.add(host.lower())
    return sorted(hosts - DOMAIN_BLOCKLIST)


def discover_sources():
    """返回 [(音源名, [上游主机...]), ...]，按目录名排序保证输出稳定。"""
    sources = []
    for latest in sorted(ROOT.glob('*/latest.js')):
        name = latest.parent.name
        text = latest.read_text(encoding='utf-8', errors='ignore')
        sources.append((name, extract_hosts(text)))
    return sources


def _elapsed_ms(start):
    """自 start（time.monotonic）以来的耗时毫秒数。"""
    return int((time.monotonic() - start) * 1000)


def probe_host(host, port=None):
    """对单个上游发起 GET 探测。

    返回 (raw, http_code, elapsed_ms)，raw 取值：
      'ok'     —— 2xx 响应；
      'warn'   —— 获得 HTTP 响应但非 2xx（401/403/429/5xx 等，上游存活）；
      'failed' —— 连接拒绝 / DNS 失败 / TLS 失败 / 超时等不可达情形。

    port 仅供测试注入（本地构造目标），生产调用不传。
    """
    # IPv4 字面量无 TLS 证书，走 http；其余走 https
    scheme = 'http' if RE_IPV4_LITERAL.fullmatch(host) else 'https'
    authority = host if port is None else '{}:{}'.format(host, port)
    url = '{}://{}/'.format(scheme, authority)
    start = time.monotonic()
    try:
        req = urllib_request.Request(url, method='GET', headers={'User-Agent': USER_AGENT})
        with urllib_request.urlopen(req, timeout=PROBE_TIMEOUT) as resp:
            code = resp.status
            raw = 'ok' if 200 <= code < 300 else 'warn'
            return raw, code, _elapsed_ms(start)
    except urllib_error.HTTPError as exc:
        # 能拿到 HTTP 状态码说明上游存活
        return 'warn', exc.code, _elapsed_ms(start)
    except Exception:
        # 其余（连接拒绝/DNS/TLS/超时等）一律视为不可达
        return 'failed', None, _elapsed_ms(start)


def resolve_status(raw, prev_fail_count):
    """结合历史失败计数做滞后判定。

    返回 (状态, 新的连续失败计数)：
      2xx         → 可用，计数清零（单次成功立即恢复）；
      非 2xx HTTP → 异常，计数清零（有响应即证明上游存活）；
      不可达      → 计数 +1，未达阈值显示异常，达到阈值才判失效。
    """
    if raw == 'ok':
        return STATUS_OK, 0
    if raw == 'warn':
        return STATUS_WARN, 0
    fail_count = prev_fail_count + 1
    if fail_count >= FAIL_THRESHOLD:
        return STATUS_DEAD, fail_count
    return STATUS_WARN, fail_count


# 状态聚合优先级：数值越小越优先（用于挑选代表性链路与音源级状态）
# “无法探测”不进入表格（run 层直接跳过），此处给最低档位仅作防御。
STATUS_PRIORITY = {STATUS_OK: 0, STATUS_WARN: 1, STATUS_DEAD: 2, STATUS_UNKNOWN: 3}


def aggregate_by_source(link_rows):
    """把按链路的结果聚合为每个音源一行。

    聚合规则：
      - 任一路线"可用" → 音源"可用"；
      - 否则任一路线"异常" → 音源"异常"；
      - 全部路线"失效" → 音源"失效"。
    输出按可用性排序：状态优先级 可用 → 异常 → 失效，状态相同时按音源名字母升序。
    """
    grouped = {}
    for row in link_rows:
        grouped.setdefault(row['source'], []).append(row)
    aggregated = []
    for source, rows in grouped.items():
        status = min((r['status'] for r in rows), key=lambda s: STATUS_PRIORITY[s])
        aggregated.append({'source': source, 'status': status})
    aggregated.sort(key=lambda r: (STATUS_PRIORITY[r['status']], r['source']))
    return aggregated


def render_table(rows):
    """渲染 markdown 表格（表头 + 数据行，仅音源/状态两列）。

    音源列输出为指向 README"在线导入"章节中该音源小节显式锚点的
    markdown 链接，格式为 [<音源名>](#<音源名>)，锚点名与音源目录名
    一致（如 juhe 对应 <a id="juhe"></a>，而非标题 JuheApi 的自动
    slug）。排序在聚合阶段（aggregate_by_source）基于裸音源名完成，
    链接标记不参与排序。
    """
    lines = [
        '| 音源 | 状态 |',
        '| --- | --- |',
    ]
    for row in rows:
        lines.append('| [{}](#{}) | {} {} |'.format(
            row['source'], row['source'], STATUS_ICON[row['status']], row['status']))
    return '\n'.join(lines)


def render_time_line(checked_at):
    """渲染表格末尾的检测时间行（北京时间，纯文本无引用前缀）。"""
    return '检测时间：{}（北京时间）'.format(checked_at)


# “数据来源”章节标题：音源可用性章节迁移的目标位置
README_DATASOURCE_TITLE = '## 数据来源'


def _remove_section(text):
    """摘除任意位置的既有“音源可用性”章节（标题 + 锚点块及周围空白）。"""
    pattern = re.compile(
        re.escape(README_SECTION_TITLE) + r'\s*'
        + re.escape(README_START) + r'.*?' + re.escape(README_END) + r'\s*',
        re.DOTALL)
    return pattern.sub('', text, count=1)


def _insert_before_datasource(text, section):
    """把章节插入到“数据来源”标题之前；无该标题时追加到文末。"""
    idx = text.find(README_DATASOURCE_TITLE)
    if idx == -1:
        prefix = text if text.endswith('\n') else text + '\n'
        return prefix + '\n' + section + '\n'
    return text[:idx] + section + '\n\n' + text[idx:]


def update_readme(table, time_line):
    """迁移并写回“音源可用性”章节（位于数据来源之前）；内容无变化时返回 False（不落盘）。"""
    original = README_PATH.read_text(encoding='utf-8')
    body = table + '\n\n' + time_line
    section = '\n'.join([README_SECTION_TITLE, '', README_START, body, README_END])
    # 先摘除任意位置的旧章节，再插入到“数据来源”之前，实现章节迁移
    updated = _insert_before_datasource(_remove_section(original), section)
    if updated == original:
        return False
    README_PATH.write_text(updated, encoding='utf-8')
    return True


def load_state():
    """读取连续失败计数状态；文件缺失或损坏时按空状态处理。"""
    try:
        data = json.loads(STATE_PATH.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_state(state):
    """写回状态文件（排序 + 中文不转义，保证 diff 稳定）。"""
    STATE_PATH.write_text(
        json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True) + '\n',
        encoding='utf-8',
    )


def run(update_readme_flag):
    """执行一轮探测；update_readme 为 True 时写回 README 与状态文件。"""
    sources = discover_sources()
    # 同一域名只探测一次（满足频率约束，多音源共享链路时复用结果）
    unique_hosts = sorted({host for _, hosts in sources for host in hosts})
    probe_results = {}
    if unique_hosts:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            for host, result in zip(unique_hosts, pool.map(probe_host, unique_hosts)):
                probe_results[host] = result

    state = load_state()
    checked_at = datetime.now(BEIJING_TZ).strftime('%Y-%m-%d %H:%M')
    link_rows = []
    new_state = {}
    for name, hosts in sources:
        if not hosts:
            # 无法静态提取上游域名的音源：不进入表格（探测与状态持久化也不涉及）
            continue
        for host in hosts:
            raw = probe_results[host][0]
            prev_fail_count = state.get(host, {}).get('consecutive_failures', 0)
            status, fail_count = resolve_status(raw, prev_fail_count)
            new_state[host] = {'consecutive_failures': fail_count, 'last_status': status}
            # 表格仅三列，code/elapsed 不进入行数据（探测结果本身已在 probe_host 内记录）
            link_rows.append({'source': name, 'host': host, 'status': status})

    # 渲染层聚合：每个音源仅一行
    table = render_table(aggregate_by_source(link_rows))
    time_line = render_time_line(checked_at)
    print(table)
    print()
    print(time_line)

    if not update_readme_flag:
        return

    readme_changed = update_readme(table, time_line)
    # 状态仅在内容变化时重写，避免每日空提交噪音
    state_changed = new_state != state or not STATE_PATH.exists()
    if state_changed:
        save_state(new_state)
    print('README {}，状态文件 {}'.format(
        '已更新' if readme_changed else '无变化',
        '已更新' if state_changed else '无变化'), file=sys.stderr)


def parse_args(argv=None):
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(description='音源可用性探测')
    parser.add_argument(
        '--update-readme', action='store_true',
        help='将表格写回 README.md 并更新 .health-state.json（默认只打印表格）')
    return parser.parse_args(argv)


def main(argv=None):
    """入口；脚本自身异常时以非零退出码结束，且不写任何文件。"""
    args = parse_args(argv)
    try:
        run(args.update_readme)
    except Exception:
        traceback.print_exc()
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
