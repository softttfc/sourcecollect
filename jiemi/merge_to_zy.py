import os
import json  # 强制使用标准库 json 写入，确保输出 100% 标准
import json5  # 用 json5 读取，以兼容你原本带注释的源文件
import chardet

TVBOX_FILE = "tvbox_config.json"
RIHOU_FILE = "rihou.json"
XIAOYU_FILE = "xiaoyu.json"
OUTPUT_FILE = "zy.json"

def detect_encoding(file_path):
    if not os.path.exists(file_path):
        return "utf-8"
    with open(file_path, 'rb') as f:
        raw_data = f.read(10000)
        result = chardet.detect(raw_data)
        return result['encoding'] or "utf-8"

def read_json_file(file_path):
    if not os.path.exists(file_path):
        print(f"[-] 未找到文件: {file_path}")
        return None
    encoding = detect_encoding(file_path)
    try:
        with open(file_path, 'r', encoding=encoding) as f:
            return json5.load(f)
    except Exception as e:
        print(f"[-] 读取 {file_path} 失败: {e}")
        return None

def write_standard_json(file_path, data, reference_file, tvbox_count, rihou_count, xiaoyu_count):
    encoding = detect_encoding(reference_file)
    try:
        # 1. 先导出标准的格式化 JSON 字符串
        json_str = json.dumps(data, ensure_ascii=False, indent=2)

        # 2. 精准定位：只在三个配置源的“第一个对象 {”上方插入注释
        lines = json_str.split("\n")
        new_lines = []
        object_index = 0

        # 计算 TVBOX、RIHOU、XIAOYU 对应第一个对象的序号 (索引从 0 开始)
        tvbox_start = 0 if tvbox_count > 0 else -1
        rihou_start = tvbox_count if rihou_count > 0 else -1
        xiaoyu_start = (tvbox_count + rihou_count) if xiaoyu_count > 0 else -1

        for line in lines:
            # indent=2 时，sites 列表里的对象开头缩进刚好是 4 个空格 "    {"
            if line == "    {":
                if object_index == tvbox_start:
                    new_lines.append("    // tvbox_config.json")
                elif object_index == rihou_start:
                    new_lines.append("    // rihou.json")
                elif object_index == xiaoyu_start:
                    new_lines.append("    // xiaoyu.json")
                object_index += 1
            
            new_lines.append(line)

        final_json_str = "\n".join(new_lines)

        # 3. 写入文件
        with open(file_path, 'w', encoding=encoding) as f:
            f.write(final_json_str)
        print(f"[+] 成功生成/更新标准文件: {file_path}")
    except Exception as e:
        print(f"[-] 写入 {file_path} 失败: {e}")

def merge_sites():
    print("[*] 开始读取文件并准备合并...")
    tvbox_data = read_json_file(TVBOX_FILE)
    rihou_data = read_json_file(RIHOU_FILE)
    xiaoyu_data = read_json_file(XIAOYU_FILE)

    if tvbox_data is None or rihou_data is None or xiaoyu_data is None:
        print("[-] 合并中止：源文件读取失败。")
        exit(1)

    # 提取 sites 列表
    tvbox_sites = tvbox_data.get("sites", [])
    rihou_sites = rihou_data.get("sites", [])
    xiaoyu_sites = xiaoyu_data.get("sites", [])

    if not isinstance(tvbox_sites, list) or not isinstance(rihou_sites, list) or not isinstance(xiaoyu_sites, list):
        print("[-] 错误: 'sites' 字段不是列表格式！")
        exit(1)

    # 按顺序合并 sites
    merged_sites = tvbox_sites + rihou_sites + xiaoyu_sites

    output_data = {
        "sites": merged_sites
    }

    # 传入三组源数据的实际节点数量，准确控制插入点
    write_standard_json(
        OUTPUT_FILE, 
        output_data, 
        TVBOX_FILE, 
        len(tvbox_sites), 
        len(rihou_sites), 
        len(xiaoyu_sites)
    )
    print("[*] 合并完成！")

if __name__ == "__main__":
    merge_sites()
