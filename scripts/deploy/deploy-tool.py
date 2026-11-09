# -*- coding: utf-8 -*-
import os
import queue
import shutil
import subprocess
import sys
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

SCRIPT_DIR = Path(__file__).resolve().parent
BASE = SCRIPT_DIR.parents[1]
APK_DIR = BASE / "unpackage" / "release" / "apk"
APK_TARGET = APK_DIR / "app-release.apk"
APK_SCRIPT = SCRIPT_DIR / "deploy-apk.py"
WEB_SCRIPT = SCRIPT_DIR / "deploy-web.ps1"
MP_POST_SCRIPT = BASE / "scripts" / "post-build-mp-weixin.js"

CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

PYTHON_EXE = Path(sys.executable)
if PYTHON_EXE.name.lower() == "pythonw.exe":
    console_python = PYTHON_EXE.with_name("python.exe")
    if console_python.exists():
        PYTHON_EXE = console_python


def format_size(num):
    value = float(num)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            if unit == "B":
                return "%d B" % int(value)
            return "%.1f %s" % (value, unit)
        value /= 1024
    return "%d B" % num


class DeployTool:
    def __init__(self, root):
        self.root = root
        self.queue = queue.Queue()
        self.busy = False

        root.title("poementer 部署工具")
        root.geometry("940x640")
        root.minsize(780, 500)

        self.status = tk.StringVar(value="就绪")
        self.apk_info = tk.StringVar(value="正在扫描 APK...")

        self._build_ui()
        self.refresh_apk_info()
        self.root.after(100, self._poll_queue)

    def _build_ui(self):
        main = ttk.Frame(self.root, padding=14)
        main.pack(fill="both", expand=True)

        title = ttk.Label(
            main, text="poementer 部署工具", font=("Microsoft YaHei UI", 17, "bold")
        )
        title.pack(anchor="w")

        info = ttk.Label(main, textvariable=self.apk_info, foreground="#555555")
        info.pack(anchor="w", pady=(4, 12))

        style = ttk.Style()
        try:
            style.configure("Action.TButton", padding=(12, 9))
        except tk.TclError:
            pass

        actions = ttk.Frame(main)
        actions.pack(fill="x", pady=(0, 12))

        self.btn_apk = ttk.Button(
            actions,
            text="准备并上传 APK",
            style="Action.TButton",
            command=self.on_upload_apk,
        )
        self.btn_web = ttk.Button(
            actions,
            text="部署网页版",
            style="Action.TButton",
            command=self.on_deploy_web,
        )
        self.btn_mp = ttk.Button(
            actions,
            text="构建小程序",
            style="Action.TButton",
            command=self.on_build_mp,
        )
        self.btn_mp_post = ttk.Button(
            actions,
            text="仅小程序后处理",
            style="Action.TButton",
            command=self.on_mp_post,
        )

        self.btn_apk.pack(side="left", padx=(0, 8))
        self.btn_web.pack(side="left", padx=(0, 8))
        self.btn_mp.pack(side="left", padx=(0, 8))
        self.btn_mp_post.pack(side="left")

        log_frame = ttk.LabelFrame(main, text="运行日志", padding=6)
        log_frame.pack(fill="both", expand=True)

        self.log_text = tk.Text(
            log_frame,
            wrap="word",
            state="disabled",
            font=("Microsoft YaHei UI", 9),
            background="#1e1e1e",
            foreground="#d4d4d4",
            insertbackground="#d4d4d4",
            relief="flat",
            padx=8,
            pady=8,
        )
        scroll = ttk.Scrollbar(log_frame, orient="vertical", command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scroll.set)
        self.log_text.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

        bottom = ttk.Frame(main)
        bottom.pack(fill="x", pady=(10, 0))
        ttk.Label(bottom, textvariable=self.status).pack(side="left")
        ttk.Button(bottom, text="打开项目目录", command=self.open_project).pack(
            side="right", padx=(8, 0)
        )
        ttk.Button(bottom, text="清空日志", command=self.clear_log).pack(side="right")

        self.action_buttons = [
            self.btn_apk,
            self.btn_web,
            self.btn_mp,
            self.btn_mp_post,
        ]

    def append_log(self, text):
        self.log_text.configure(state="normal")
        self.log_text.insert("end", text)
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def set_busy(self, busy):
        self.busy = busy
        state = "disabled" if busy else "normal"
        for button in self.action_buttons:
            button.configure(state=state)

    def refresh_apk_info(self):
        try:
            source, target = self.find_latest_apk()
            stat = source.stat()
            mtime = time.strftime("%Y-%m-%d %H:%M", time.localtime(stat.st_mtime))
            text = "最新 APK：%s（%s，%s）" % (
                source.name,
                format_size(stat.st_size),
                mtime,
            )
            if source != target:
                text += "  →  将重命名为 app-release.apk"
            self.apk_info.set(text)
        except Exception as exc:
            self.apk_info.set("最新 APK：未找到（%s）" % exc)

    def find_latest_apk(self):
        if not APK_DIR.is_dir():
            raise FileNotFoundError("目录不存在：%s" % APK_DIR)

        candidates = [
            p
            for p in APK_DIR.glob("*.apk")
            if p.is_file() and p.name.lower() != "app-release.apk"
        ]
        newest = max(candidates, key=lambda p: p.stat().st_mtime, default=None)

        if newest is None:
            if APK_TARGET.is_file():
                return APK_TARGET, APK_TARGET
            raise FileNotFoundError("没有找到 .apk 文件")

        if APK_TARGET.is_file():
            if newest.stat().st_mtime > APK_TARGET.stat().st_mtime:
                return newest, APK_TARGET
            return APK_TARGET, APK_TARGET
        return newest, APK_TARGET

    def _which(self, name):
        path = shutil.which(name)
        if not path:
            raise FileNotFoundError("找不到命令：%s，请确认已安装并在 PATH 中。" % name)
        return path

    def _decode(self, raw):
        raw = raw.rstrip(b"\r\n")
        for encoding in ("utf-8", "gbk"):
            try:
                return raw.decode(encoding) + "\n"
            except UnicodeDecodeError:
                continue
        return raw.decode("utf-8", "replace") + "\n"

    def _exec(self, cmd, cwd=BASE, env_extra=None):
        self.queue.put("\n$ %s\n" % " ".join(str(part) for part in cmd))
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        if env_extra:
            env.update(env_extra)

        process = subprocess.Popen(
            [str(part) for part in cmd],
            cwd=str(cwd),
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=CREATE_NO_WINDOW,
        )
        if process.stdout is not None:
            for raw in iter(process.stdout.readline, b""):
                self.queue.put(self._decode(raw))
        code = process.wait()
        self.queue.put("\n[退出码] %d\n" % code)
        return code

    def _start_worker(self, label, worker):
        self.set_busy(True)
        self.status.set("正在执行：%s" % label)
        self.append_log("\n" + "=" * 72 + "\n[任务] %s\n" % label + "=" * 72 + "\n")

        def run():
            try:
                worker()
            except Exception as exc:
                self.queue.put("\n[错误] %s\n" % exc)
                self.queue.put(("done", 1, label))

        threading.Thread(target=run, daemon=True).start()

    def _poll_queue(self):
        while True:
            try:
                item = self.queue.get_nowait()
            except queue.Empty:
                break

            if isinstance(item, tuple) and item and item[0] == "done":
                code = item[1]
                label = item[2] if len(item) > 2 else "任务"
                self.set_busy(False)
                self.refresh_apk_info()
                if code == 0:
                    self.status.set("%s 完成" % label)
                    self.append_log("\n[完成] %s\n" % label)
                    messagebox.showinfo("完成", "%s 已完成。" % label)
                else:
                    self.status.set("%s 失败（退出码 %s）" % (label, code))
                    self.append_log("\n[失败] %s，退出码 %s\n" % (label, code))
                    messagebox.showerror(
                        "失败", "%s 失败，退出码 %s。请查看日志。" % (label, code)
                    )
            else:
                self.append_log(item)

        self.root.after(100, self._poll_queue)

    def on_upload_apk(self):
        if self.busy:
            return
        if not APK_SCRIPT.is_file():
            messagebox.showerror("错误", "找不到 deploy-apk.py")
            return

        try:
            source, target = self.find_latest_apk()
        except Exception as exc:
            messagebox.showerror("错误", str(exc))
            return

        stat = source.stat()
        mtime = time.strftime("%Y-%m-%d %H:%M", time.localtime(stat.st_mtime))
        if source == target:
            detail = "将上传当前 app-release.apk（%s，%s）。" % (
                format_size(stat.st_size),
                mtime,
            )
        else:
            detail = (
                "将把最新包 %s（%s，%s）重命名为 app-release.apk 并上传。\n\n"
                "原 app-release.apk 会被覆盖。"
                % (source.name, format_size(stat.st_size), mtime)
            )
        if not messagebox.askyesno("确认上传 APK", detail + "\n\n继续吗？"):
            return

        def worker():
            if source != target:
                os.replace(str(source), str(target))
                self.queue.put("已将 %s 重命名为 app-release.apk\n" % source.name)
            code = self._exec([PYTHON_EXE, APK_SCRIPT])
            self.queue.put(("done", code, "APK 上传"))

        self._start_worker("准备并上传 APK", worker)

    def on_deploy_web(self):
        if self.busy:
            return
        if not WEB_SCRIPT.is_file():
            messagebox.showerror("错误", "找不到 deploy-web.ps1")
            return
        if not messagebox.askyesno(
            "确认部署网页版",
            "将把 unpackage\\dist\\build\\web 部署到腾讯云 CloudBase。\n\n继续吗？",
        ):
            return

        def worker():
            powershell = self._which("powershell.exe")
            code = self._exec(
                [
                    powershell,
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    WEB_SCRIPT,
                ],
                env_extra={"DEPLOY_NO_OPEN": "1", "DEPLOY_NO_PAUSE": "1"},
            )
            self.queue.put(("done", code, "网页版部署"))

        self._start_worker("部署网页版", worker)

    def on_build_mp(self):
        if self.busy:
            return
        if not MP_POST_SCRIPT.is_file():
            messagebox.showerror("错误", "找不到 scripts/post-build-mp-weixin.js")
            return

        def worker():
            npm = self._which("npm.cmd")
            node = self._which("node.exe")
            code = self._exec([npm, "run", "build:mp-weixin"])
            if code == 0:
                code = self._exec([node, MP_POST_SCRIPT])
            self.queue.put(("done", code, "小程序构建"))

        self._start_worker("构建小程序（编译 + 后处理）", worker)

    def on_mp_post(self):
        if self.busy:
            return
        if not MP_POST_SCRIPT.is_file():
            messagebox.showerror("错误", "找不到 scripts/post-build-mp-weixin.js")
            return

        def worker():
            node = self._which("node.exe")
            code = self._exec([node, MP_POST_SCRIPT])
            self.queue.put(("done", code, "小程序后处理"))

        self._start_worker("小程序后处理", worker)

    def clear_log(self):
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")

    def open_project(self):
        try:
            os.startfile(str(BASE))
        except Exception as exc:
            messagebox.showerror("错误", "无法打开目录：%s" % exc)


def main():
    try:
        from ctypes import windll

        windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

    root = tk.Tk()
    app = DeployTool(root)

    if "--self-test" in sys.argv:
        root.withdraw()
        root.update()
        print("APK_INFO:", app.apk_info.get())
        print("SELF_TEST_OK")
        root.destroy()
        return

    root.mainloop()


if __name__ == "__main__":
    main()
