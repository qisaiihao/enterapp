"""Local desktop release manager; cloud credentials stay inside the CLI process."""
import json
import queue
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


class VersionManager(tk.Tk):
    def __init__(self, offline=False):
        super().__init__()
        self.title('回车键 · App 版本管理')
        self.geometry('1180x800')
        self.minsize(1060, 720)
        self.configure(bg='#f4f3ef')
        self.rows = {}
        self.current = None
        self.artifact = None
        self.busy = False
        self.jobs = queue.Queue()
        self.actions = []
        self.vars = {key: tk.StringVar() for key in ('version', 'title', 'url', 'min_uni_version', 'max_uni_version')}
        self.vars.update({key: tk.BooleanVar() for key in ('is_mandatory', 'is_silently', 'legacy_migration')})
        self.platform = tk.StringVar(value='Android')
        self.kind = tk.StringVar(value='APK 整包')
        self.status = tk.StringVar(value='就绪')
        self.package_status = tk.StringVar(value='尚未选择安装包')
        self.device_native = tk.StringVar(value='1.7.8')
        self.device_wgt = tk.StringVar(value='1.7.8')
        self.device_mode = tk.StringVar(value='新版 App')
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure('.', font=('Microsoft YaHei UI', 10), background='#f4f3ef')
        style.configure('TButton', padding=(12, 8))
        style.configure('Treeview', rowheight=32, background='white', fieldbackground='white')
        style.configure('Treeview.Heading', font=('Microsoft YaHei UI', 10, 'bold'))
        style.configure('Title.TLabel', font=('Microsoft YaHei UI', 22, 'bold'))
        style.configure('Hint.TLabel', foreground='#60696a')
        self.build_ui()
        self.new()
        self.after(100, self.poll)
        if not offline:
            self.after(200, self.refresh)

    def button(self, parent, text, command):
        button = ttk.Button(parent, text=text, command=command)
        self.actions.append(button)
        return button

    def build_ui(self):
        header = ttk.Frame(self, padding=(24, 18))
        header.pack(fill='x')
        ttk.Label(header, text='App 版本管理', style='Title.TLabel').pack(anchor='w')
        ttk.Label(header, text='腾讯云发布中心  ·  旧 App 保留 uniCloud 升级入口，新 App 直接连接腾讯云', style='Hint.TLabel').pack(anchor='w', pady=(6, 0))
        toolbar = ttk.Frame(self, padding=(24, 0, 24, 12))
        toolbar.pack(fill='x')
        for label, action in [('刷新版本', self.refresh), ('新建版本', self.new), ('导出记录', self.export)]:
            self.button(toolbar, label, action).pack(side='left', padx=(0, 8))
        ttk.Label(toolbar, text='发布前自动校验安装包与下载地址', style='Hint.TLabel').pack(side='right')
        body = ttk.Panedwindow(self, orient='horizontal')
        body.pack(fill='both', expand=True, padx=24)
        left = ttk.Frame(body)
        right = ttk.Frame(body, padding=(20, 0, 0, 0))
        body.add(left, weight=4)
        body.add(right, weight=6)
        self.tree = ttk.Treeview(left, columns=('version', 'type', 'state'), show='headings', selectmode='browse')
        for key, title, width in [('version', '版本', 100), ('type', '平台 / 类型', 125), ('state', '状态', 90)]:
            self.tree.heading(key, text=title)
            self.tree.column(key, width=width, minwidth=70)
        self.tree.pack(side='left', fill='both', expand=True)
        scroll = ttk.Scrollbar(left, orient='vertical', command=self.tree.yview)
        scroll.pack(side='right', fill='y')
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.bind('<<TreeviewSelect>>', self.select)
        form = ttk.Frame(right)
        form.pack(fill='x')
        form.columnconfigure(1, weight=1)
        form.columnconfigure(3, weight=1)
        ttk.Label(form, text='平台').grid(row=0, column=0, sticky='w', padx=(0, 8))
        ttk.Combobox(form, textvariable=self.platform, values=['Android', 'iOS'], state='readonly', width=12).grid(row=0, column=1, sticky='ew')
        ttk.Label(form, text='类型').grid(row=0, column=2, padx=12)
        ttk.Combobox(form, textvariable=self.kind, values=['APK 整包', 'WGT 资源包', 'App Store'], state='readonly', width=14).grid(row=0, column=3, sticky='ew')
        ttk.Label(form, text='版本号').grid(row=1, column=0, sticky='w', pady=10)
        ttk.Entry(form, textvariable=self.vars['version']).grid(row=1, column=1, sticky='ew')
        self.button(form, '选择安装包并上传', self.upload).grid(row=1, column=2, columnspan=2, sticky='ew', padx=(12, 0))
        ttk.Label(right, textvariable=self.package_status, style='Hint.TLabel', wraplength=570).pack(fill='x', pady=(0, 8))
        for key, label in [('title', '更新标题'), ('url', '下载地址 / App Store 地址')]:
            ttk.Label(right, text=label).pack(anchor='w', pady=(5, 3))
            ttk.Entry(right, textvariable=self.vars[key]).pack(fill='x')
        ttk.Label(right, text='更新说明').pack(anchor='w', pady=(10, 3))
        self.contents = tk.Text(right, height=5, wrap='word', font=('Microsoft YaHei UI', 10), relief='solid', bd=1)
        self.contents.pack(fill='both', expand=True)
        compatibility = ttk.Frame(right)
        compatibility.pack(fill='x', pady=(12, 0))
        ttk.Label(compatibility, text='WGT 原生兼容范围').pack(side='left')
        ttk.Entry(compatibility, textvariable=self.vars['min_uni_version'], width=13).pack(side='left', padx=8)
        ttk.Label(compatibility, text='至').pack(side='left')
        ttk.Entry(compatibility, textvariable=self.vars['max_uni_version'], width=13).pack(side='left', padx=8)
        ttk.Label(compatibility, text='最高可留空', style='Hint.TLabel').pack(side='left')
        flags = ttk.Frame(right)
        flags.pack(fill='x', pady=(10, 0))
        for key, label in [('is_mandatory', '强制更新'), ('is_silently', '静默安装 WGT')]:
            ttk.Checkbutton(flags, text=label, variable=self.vars[key]).pack(side='left', padx=(0, 16))
        ttk.Checkbutton(right, text='作为旧版 App 迁移整包（需包含腾讯云更新逻辑）', variable=self.vars['legacy_migration']).pack(anchor='w', pady=(8, 4))
        buttons = ttk.Frame(right)
        buttons.pack(fill='x', pady=8)
        for label, action in [('保存草稿', self.save), ('发布选中版本', lambda: self.change_publication(True)), ('下线选中版本', lambda: self.change_publication(False))]:
            self.button(buttons, label, action).pack(side='left', padx=(0, 8))
        preview = ttk.LabelFrame(self, text='检查用户会收到哪个版本', padding=12)
        preview.pack(fill='x', padx=24, pady=12)
        ttk.Combobox(preview, textvariable=self.device_mode, values=['新版 App', '旧版插件', '旧版 WGT 回退'], state='readonly', width=16).pack(side='left')
        for title, variable in [('原生版本', self.device_native), ('资源版本', self.device_wgt)]:
            ttk.Label(preview, text=title).pack(side='left', padx=(15, 6))
            ttk.Entry(preview, textvariable=variable, width=12).pack(side='left')
        self.button(preview, '预览更新结果', self.preview).pack(side='right')
        ttk.Label(self, textvariable=self.status, style='Hint.TLabel', padding=(24, 0, 24, 14), wraplength=1100).pack(fill='x')

    def call(self, request, callback, label):
        if self.busy:
            return
        self.busy = True
        for button in self.actions:
            button.state(['disabled'])
        self.status.set(label)
        def worker():
            try:
                run = subprocess.run(['node', str(HERE / 'manager.cjs')], cwd=ROOT, input=json.dumps(request),
                                     capture_output=True, text=True, encoding='utf-8', timeout=600,
                                     creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
                lines = [line for line in run.stdout.splitlines() if line.startswith('{')]
                result = json.loads(lines[-1]) if lines else {'success': False, 'error': '工具未返回结果，请检查 Node.js、Python 和 tcb login 登录态'}
            except Exception as error:
                result = {'success': False, 'error': str(error)}
            self.jobs.put((result, callback))
        threading.Thread(target=worker, daemon=True).start()

    def poll(self):
        try:
            result, callback = self.jobs.get_nowait()
            self.busy = False
            for button in self.actions:
                button.state(['!disabled'])
            if result['success']:
                callback(result['data'])
            else:
                self.status.set('操作未完成：' + result['error'])
                messagebox.showerror('操作未完成', result['error'])
        except queue.Empty:
            pass
        self.after(100, self.poll)

    def refresh(self, selected=None):
        def loaded(rows):
            self.rows = {row['_id']: row for row in rows}
            self.tree.delete(*self.tree.get_children())
            for row in rows:
                label = ('Android' if row['uni_platform'] == 'android' else 'iOS') + (' / 整包' if row['type'] == 'native_app' else ' / WGT')
                self.tree.insert('', 'end', iid=row['_id'], values=(row['version'], label, '已发布' if row['stable_publish'] else '草稿 / 下线'))
            self.status.set(f'已读取 {len(rows)} 个版本。上传和保存草稿不会推送更新，点击发布后才对用户生效。')
            if selected in self.rows:
                self.tree.selection_set(selected)
                self.select()
            elif self.current and self.current['_id'] in self.rows:
                self.tree.selection_set(self.current['_id'])
                self.select()
        self.call({'action': 'list'}, loaded, '正在读取腾讯云版本记录…')

    def new(self):
        if self.busy:
            return
        self.current = None
        self.artifact = None
        self.tree.selection_remove(*self.tree.selection())
        self.platform.set('Android')
        self.kind.set('APK 整包')
        for key, variable in self.vars.items():
            variable.set(False if key in ('is_mandatory', 'is_silently', 'legacy_migration') else '')
        self.vars['title'].set('发现新版本')
        self.contents.delete('1.0', 'end')
        self.package_status.set('选择安装包后将自动读取版本并校验签名，上传到腾讯云 CDN。')

    def select(self, event=None):
        if self.busy or not self.tree.selection():
            return
        row = self.rows[self.tree.selection()[0]]
        self.current = row
        self.artifact = row.get('artifact')
        for key, variable in self.vars.items():
            variable.set(row.get(key, False if key in ('is_mandatory', 'is_silently', 'legacy_migration') else ''))
        self.platform.set('Android' if row['uni_platform'] == 'android' else 'iOS')
        self.kind.set('WGT 资源包' if row['type'] == 'wgt' else 'App Store' if row['uni_platform'] == 'ios' else 'APK 整包')
        self.contents.delete('1.0', 'end')
        self.contents.insert('1.0', row.get('contents', ''))
        self.show_artifact()

    def show_artifact(self):
        if self.artifact:
            a = self.artifact
            self.package_status.set(f"{a.get('filename', '')} · {a['size'] / 1024 / 1024:.1f} MB · " + ('已包含腾讯云更新逻辑' if a.get('cloudbase_ready') else '历史包：仍使用 uniCloud 更新'))
        else:
            self.package_status.set('使用 App Store 地址')

    def upload(self):
        if self.current and self.current.get('stable_publish'):
            messagebox.showinfo('版本已发布', '请新建版本，或先下线当前版本再修改。')
            return
        file = filedialog.askopenfilename(title='选择正式安装包', filetypes=[('安装包', '*.apk *.wgt')])
        if not file:
            return
        def done(artifact):
            self.artifact = artifact
            self.vars['version'].set(artifact['version'])
            self.vars['url'].set(artifact['url'])
            self.kind.set('APK 整包' if artifact['type'] == 'native_app' else 'WGT 资源包')
            if artifact['type'] == 'native_app':
                self.platform.set('Android')
            self.show_artifact()
            self.status.set('上传和 CDN 下载校验完成。请填写说明并保存草稿；新文件需等待约 3 分钟后才能发布。')
        self.call({'action': 'upload', 'file': file}, done, '正在检查包版本与签名、上传文件并校验完整下载，请稍候…')

    def record(self):
        return {**{key: variable.get() for key, variable in self.vars.items()},
                'type': 'wgt' if self.kind.get() == 'WGT 资源包' else 'native_app',
                'uni_platform': 'ios' if self.platform.get() == 'iOS' else 'android',
                'contents': self.contents.get('1.0', 'end-1c')}

    def save(self):
        record = self.record()
        same = self.current and all(self.current.get(key) == record.get(key) for key in ('version', 'type', 'uni_platform'))
        self.call({'action': 'save', 'record': record, 'artifact': self.artifact,
                   'revision': self.current['revision'] if same else 0},
                  lambda row: self.refresh(row['_id']), '正在保存草稿…')

    def change_publication(self, publish):
        if not self.current:
            messagebox.showinfo('请选择版本', '请先保存草稿，并在左侧选择版本。')
            return
        record = self.record()
        if publish and any(record[key] != self.current.get(key, '' if not isinstance(value, bool) else False) for key, value in record.items()):
            messagebox.showinfo('先保存修改', '表单还有未保存的修改，请先保存草稿再发布。')
            return
        verb = '发布' if publish else '下线'
        text = f"{verb} {self.current['version']}？\n" + ('发布后符合条件的用户会收到更新；旧 App 仍通过保留的 uniCloud 入口检查。' if publish else '此版本将停止下发，已下载或已安装的版本不会回退；云端文件继续保留。')
        if not messagebox.askyesno(verb + '版本', text):
            return
        self.call({'action': 'publish' if publish else 'withdraw', 'id': self.current['_id'], 'revision': self.current['revision']},
                  lambda row: self.refresh(row['_id']), '正在校验并' + verb + '版本…')

    def preview(self):
        mode = {'新版 App': 'current', '旧版插件': 'legacy', '旧版 WGT 回退': 'legacy-wgt'}[self.device_mode.get()]
        request = {'action': 'preview', 'mode': mode, 'device': {'platform': 'ios' if self.platform.get() == 'iOS' else 'android',
                   'appVersion': self.device_native.get(), 'wgtVersion': self.device_wgt.get()}}
        def done(result):
            text = f"将收到 {result['version']}（{'整包' if result['type'] == 'native_app' else 'WGT'}）" if result.get('hasUpdate') else result.get('message', '无更新')
            self.status.set(text)
            messagebox.showinfo('腾讯云发布结果预览', text + '\n\n' + json.dumps(result, ensure_ascii=False, indent=2))
        self.call(request, done, '正在根据已发布记录计算更新结果…')

    def export(self):
        file = filedialog.asksaveasfilename(title='导出版本记录', defaultextension='.json', initialfile='app-versions.json')
        if file:
            Path(file).write_text(json.dumps(list(self.rows.values()), ensure_ascii=False, indent=2), encoding='utf-8')
            self.status.set('版本记录已导出。安装包保存在腾讯云，导出文件不包含包文件。')


if __name__ == '__main__':
    app = VersionManager(offline='--offline' in sys.argv)
    app.mainloop()
