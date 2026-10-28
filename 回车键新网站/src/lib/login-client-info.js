// 浏览器仅提供基础环境信息，不读取设备指纹或高熵 User-Agent Client Hints。
function text(value, limit) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, limit)
    : "";
}

export function collectBrowserLoginClientInfo() {
  const info = {
    platform: "h5",
    os: "",
    osVersion: "",
    deviceModel: "",
    deviceBrand: "",
    appVersion: "",
    appVersionCode: "",
    sdkVersion: "",
    userAgent: "",
  };
  try {
    const userAgent = text(typeof navigator !== "undefined" ? navigator.userAgent : "", 512);
    info.userAgent = userAgent;
    const systems = [
      ["android", /Android\s+([\d.]+)/i],
      ["ios", /(?:CPU(?: iPhone)? OS|iPhone OS)\s+([\d_]+)/i],
      ["windows", /Windows NT\s+([\d.]+)/i],
      ["macos", /Mac OS X\s+([\d_]+)/i],
      ["chromeos", /CrOS\s+\S+\s+([\d.]+)/i],
    ];
    for (const [os, pattern] of systems) {
      const match = userAgent.match(pattern);
      if (!match) continue;
      info.os = os;
      info.osVersion = text(match[1].replace(/_/g, "."), 64);
      break;
    }
    if (!info.os && /Linux/i.test(userAgent)) info.os = "linux";
  } catch (error) {
    // 隐私模式或不可访问的宿主属性不影响登录。
  }
  return info;
}
