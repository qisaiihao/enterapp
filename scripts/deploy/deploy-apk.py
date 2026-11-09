# -*- coding: utf-8 -*-
import datetime
import hashlib
import hmac
import json
import sys
import time
import warnings
from pathlib import Path

import requests

warnings.filterwarnings("ignore")

SCRIPT_DIR = Path(__file__).resolve().parent
BASE = SCRIPT_DIR.parents[1]
CONFIG_PATH = SCRIPT_DIR / "deploy-apk.config.json"


class ProgressReader:
    def __init__(self, file_obj, total):
        self.file_obj = file_obj
        self.total = total
        self.sent = 0
        self.last_pct = -10

    def read(self, size=-1):
        chunk = self.file_obj.read(size)
        self.sent += len(chunk)
        pct = int(self.sent * 100 / self.total) if self.total else 100
        if pct >= self.last_pct + 10 or pct == 100:
            print("  上传进度：%d%%" % pct)
            self.last_pct = pct
        return chunk

    def __len__(self):
        return self.total

    def seek(self, *args):
        return self.file_obj.seek(*args)

    def tell(self):
        return self.file_obj.tell()


def md5(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def signed(cfg):
    now = str(int(time.time()))
    return {
        "request_time": now,
        "request_token": md5(now + md5(cfg["apiKey"])),
    }


def panel_post(cfg, action, data=None, timeout=60):
    payload = {"action": action}
    payload.update(data or {})
    payload.update(signed(cfg))
    url = cfg["panel"].rstrip("/") + "/files"
    resp = requests.post(url, data=payload, timeout=timeout, verify=False)
    resp.raise_for_status()
    try:
        obj = resp.json()
    except ValueError:
        raise RuntimeError("面板返回的不是 JSON：%s" % resp.text[:300])
    if obj.get("status") is False:
        raise RuntimeError(obj.get("msg") or "面板接口返回失败")
    return obj


def list_files(cfg):
    obj = panel_post(cfg, "GetDir", {"path": cfg["remoteDir"], "p": "1"})
    files = {}
    for entry in obj.get("FILES", []):
        parts = entry.split(";")
        if len(parts) >= 2:
            try:
                files[parts[0]] = int(parts[1])
            except ValueError:
                pass
    return files


def resolve_apk(cfg):
    apk_path = Path(cfg.get("apkPath") or "")
    if not apk_path.is_absolute():
        apk_path = BASE / apk_path
    if apk_path.is_file():
        return apk_path

    apk_dir = BASE / "unpackage" / "release" / "apk"
    candidates = sorted(
        apk_dir.glob("*.apk"), key=lambda p: p.stat().st_mtime, reverse=True
    )
    if not candidates:
        raise FileNotFoundError("没有找到 APK：%s" % apk_path)
    return candidates[0]


def wait_for_size(cfg, name, expected, tries=10):
    files = {}
    for _ in range(tries):
        files = list_files(cfg)
        if files.get(name) == expected:
            return True, files
        time.sleep(1)
    return False, files


def purge_edgeone_cache(cfg, url):
    secret_id = cfg.get("tencentSecretId")
    secret_key = cfg.get("tencentSecretKey")
    zone_id = cfg.get("edgeOneZoneId")
    if not (secret_id and secret_key and zone_id and url):
        print("[提示] 未配置 EdgeOne 凭据，跳过 CDN 刷新。")
        return False

    host = "teo.tencentcloudapi.com"
    service = "teo"
    action = "CreatePurgeTask"
    version = "2022-09-01"
    region = cfg.get("tencentRegion") or "ap-guangzhou"
    payload = json.dumps(
        {"ZoneId": zone_id, "Type": "purge_url", "Targets": [url]},
        separators=(",", ":"),
    )
    timestamp = int(time.time())
    date = datetime.datetime.utcfromtimestamp(timestamp).strftime("%Y-%m-%d")
    content_type = "application/json; charset=utf-8"
    signed_headers = "content-type;host;x-tc-action"
    canonical_headers = (
        "content-type:%s\nhost:%s\nx-tc-action:%s\n"
        % (content_type, host, action.lower())
    )
    canonical_request = "\n".join(
        [
            "POST",
            "/",
            "",
            canonical_headers,
            signed_headers,
            hashlib.sha256(payload.encode("utf-8")).hexdigest(),
        ]
    )
    credential_scope = "%s/%s/tc3_request" % (date, service)
    string_to_sign = "\n".join(
        [
            "TC3-HMAC-SHA256",
            str(timestamp),
            credential_scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ]
    )

    def _hmac(key, msg):
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    secret_date = _hmac(("TC3" + secret_key).encode("utf-8"), date)
    secret_service = _hmac(secret_date, service)
    secret_signing = _hmac(secret_service, "tc3_request")
    signature = hmac.new(
        secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    authorization = (
        "TC3-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s"
        % (secret_id, credential_scope, signed_headers, signature)
    )

    headers = {
        "Authorization": authorization,
        "Content-Type": content_type,
        "Host": host,
        "X-TC-Action": action,
        "X-TC-Timestamp": str(timestamp),
        "X-TC-Version": version,
        "X-TC-Region": region,
    }
    try:
        resp = requests.post(
            "https://" + host,
            headers=headers,
            data=payload.encode("utf-8"),
            timeout=30,
        )
        obj = resp.json()
        result = obj.get("Response", {})
        if resp.status_code == 200 and not result.get("Error"):
            print("[信息] EdgeOne 缓存刷新已提交，JobId：%s" % result.get("JobId"))
            return True
        print("[提示] EdgeOne 缓存刷新失败：%s" % (result.get("Error") or resp.text[:300]))
    except Exception as exc:
        print("[提示] EdgeOne 缓存刷新异常：%s" % exc)
    print("[提示] 如仍下载到旧包，请到腾讯云 EdgeOne 控制台手动刷新 %s" % url)
    return False


def check_public(cfg, expected):
    url = cfg.get("publicUrl")
    if not url:
        return
    try:
        probe = url + ("&" if "?" in url else "?") + "deploy=" + str(int(time.time()))
        bypass = requests.head(probe, timeout=30, allow_redirects=True, verify=False)
        bypass_size = bypass.headers.get("Content-Length")
        print("[验证] 绕过 CDN 缓存：HTTP %s，大小 %s" % (bypass.status_code, bypass_size))
        if bypass_size == str(expected):
            print("[验证] 源站已经是新包。")
        else:
            print("[警告] 源站大小与本地不一致，请检查上传结果。")

        normal = requests.head(url, timeout=30, allow_redirects=True, verify=False)
        normal_size = normal.headers.get("Content-Length")
        cache = normal.headers.get("EO-Cache-Status", "-")
        if normal_size == str(expected):
            print("[验证] 正常下载链接已返回新包。")
        else:
            print(
                "[提示] 正常下载链接仍是旧包（大小 %s，缓存 %s）。"
                % (normal_size, cache)
            )
            print(
                "[提示] 请到腾讯云 EdgeOne 控制台刷新 /app-release.apk 的缓存，"
                "否则用户可能还会下载到旧包。"
            )
    except Exception as exc:
        print("[提示] 公网链接检查失败：%s" % exc)


def main():
    if not CONFIG_PATH.is_file():
        print("[错误] 缺少配置文件：%s" % CONFIG_PATH)
        return 1

    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        cfg = json.load(f)

    if not cfg.get("apiKey") or "请" in cfg.get("apiKey", ""):
        print("[错误] 请先在 %s 里填写宝塔 API 密钥。" % CONFIG_PATH)
        return 1

    apk = resolve_apk(cfg)
    total = apk.stat().st_size
    remote_dir = cfg["remoteDir"].rstrip("/")
    remote_name = cfg["remoteName"]
    temp_name = "%s.deploy-%s" % (remote_name, time.strftime("%Y%m%d%H%M%S"))

    print("============================================")
    print("  poementer APK 一键替换（宝塔 API）")
    print("============================================")
    print("[信息] 面板：%s" % cfg["panel"])
    print("[信息] 本地包：%s" % apk)
    print("[信息] 大小：%s 字节" % format(total, ","))
    print("[信息] 目标：%s/%s" % (remote_dir, remote_name))

    before = list_files(cfg)
    if remote_name in before:
        print("[信息] 服务器当前大小：%s 字节" % format(before[remote_name], ","))

    print("[信息] 正在上传，请稍候...")
    with apk.open("rb") as f:
        reader = ProgressReader(f, total)
        resp = requests.post(
            cfg["panel"].rstrip("/") + "/files",
            data={
                "action": "UploadFile",
                "path": remote_dir,
                **signed(cfg),
            },
            files={"zunfile": (temp_name, reader, "application/octet-stream")},
            timeout=(30, 900),
            verify=False,
        )
    resp.raise_for_status()
    result = resp.json()
    if result.get("status") is False:
        print("[错误] 上传失败：%s" % (result.get("msg") or result))
        return 1

    ok, files = wait_for_size(cfg, temp_name, total)
    if not ok:
        print("[错误] 上传后校验失败，临时文件大小不符。")
        print("[信息] 当前文件列表：%s" % files)
        try:
            panel_post(cfg, "DeleteFile", {"path": remote_dir + "/" + temp_name})
        except Exception:
            pass
        return 1

    print("[信息] 上传完成，正在替换旧包...")
    panel_post(
        cfg,
        "MvFile",
        {
            "sfile": remote_dir + "/" + temp_name,
            "dfile": remote_dir + "/" + remote_name,
        },
    )

    ok, files = wait_for_size(cfg, remote_name, total)
    if not ok:
        print("[错误] 替换后校验失败，请登录面板检查。")
        print("[信息] 当前文件列表：%s" % files)
        return 1

    try:
        panel_post(
            cfg,
            "SetFileAccess",
            {
                "user": "www",
                "access": "755",
                "all": "True",
                "filename": remote_dir + "/" + remote_name,
            },
        )
        print("[信息] 已设置文件权限：www:www 755")
    except Exception as exc:
        print("[提示] 设置文件权限失败（不影响下载）：%s" % exc)

    purged = purge_edgeone_cache(cfg, cfg.get("publicUrl", ""))
    if purged:
        print("[信息] 等待 CDN 刷新生效...")
        time.sleep(5)

    print("[成功] 服务器上的 %s 已更新为 %s 字节。" % (remote_name, format(total, ",")))
    check_public(cfg, total)
    print("")
    print("[完成] 下载地址：%s" % cfg.get("publicUrl", ""))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print("")
        print("[错误] %s" % exc)
        sys.exit(1)
