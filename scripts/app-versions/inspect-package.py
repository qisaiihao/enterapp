"""Read packages without extracting or executing their contents."""
import hashlib
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path


def inspect_package(filename, config):
    file = Path(filename).resolve(strict=True)
    if file.suffix.lower() not in ('.apk', '.wgt'):
        raise ValueError('请选择 APK 或 WGT 文件')
    if not 0 < file.stat().st_size <= 1024 * 1024 * 1024:
        raise ValueError('安装包为空或超过 1 GB')
    native = file.suffix.lower() == '.apk'
    with zipfile.ZipFile(file) as archive:
        manifests = [name for name in archive.namelist() if
                     (re.fullmatch(r'assets/apps/[^/]+/www/manifest.json', name) if native else name == 'manifest.json')]
        if len(manifests) != 1:
            raise ValueError('安装包中未找到唯一的应用 manifest.json')
        entry = archive.getinfo(manifests[0])
        if entry.file_size > 1024 * 1024:
            raise ValueError('应用清单过大')
        manifest = json.loads(archive.read(entry).decode('utf-8-sig'))
        appid = manifest.get('id') or manifest.get('appid')
        version = manifest.get('version', {})
        version = version.get('name') if isinstance(version, dict) else version
        version = version or manifest.get('versionName')
        if appid != config['appid']:
            raise ValueError('AppID 不匹配，请选择回车键正式应用安装包')
        prefix = manifests[0][:-len('manifest.json')]
        services = [entry for entry in archive.infolist() if entry.filename.startswith(prefix) and
                    entry.filename.endswith('app-service.js') and entry.file_size <= 30 * 1024 * 1024]
        ready = any(b'appUpdate.v3.cloudbase.latest' in archive.read(entry) for entry in services)
    result = dict(appid=appid, version=version, type='native_app' if native else 'wgt',
                  cloudbase_ready=ready, size=file.stat().st_size, filename=file.name)
    if native:
        hx = Path(config['hbuilderx'])
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        def command(args):
            run = subprocess.run([str(arg) for arg in args], capture_output=True, text=True,
                                 encoding='utf-8', errors='replace', timeout=120, creationflags=flags)
            if run.returncode:
                raise ValueError('APK 校验失败，请检查包签名和 HBuilderX 工具安装')
            return run.stdout
        badging = command([hx / 'plugins/uts-development-android/static/win/aapt2.exe', 'dump', 'badging', file])
        package = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging)
        if not package or package[1] != config['packageName'] or package[3] != version:
            raise ValueError('APK 包名或原生/资源版本不一致')
        certificates = command([hx / 'plugins/amazon-corretto/bin/java.exe', '-jar',
                                hx / 'plugins/app-safe-pack/apksigner.jar', 'verify', '--print-certs', file])
        digests = re.findall(r'Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]+)', certificates)
        if digests != [config['certificateSha256']]:
            raise ValueError('APK 签名与现有正式包不一致，不能覆盖安装')
        result.update(versionCode=int(package[2]), packageName=package[1], certificateSha256=digests[0])
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    result['sha256'] = digest.hexdigest()
    return result


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        config = json.loads(Path(__file__).with_name('config.json').read_text(encoding='utf-8'))
        print(json.dumps(inspect_package(sys.argv[1], config), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
