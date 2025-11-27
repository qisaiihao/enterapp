/**
 * 日志工具 - 生产环境自动关闭非必要日志
 * 
 * 用法：
 * import { logger } from '@/utils/logger.js';
 * logger.log('普通日志');  // 生产环境不输出
 * logger.error('错误日志'); // 始终输出
 */

// 判断是否为开发环境
const isDev = process.env.NODE_ENV === 'development';

// 保存原始 console 方法
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
};

/**
 * 日志工具对象
 */
export const logger = {
    // 普通日志 - 仅开发环境输出
    log: isDev ? originalConsole.log.bind(console) : () => {},
    
    // 警告日志 - 仅开发环境输出
    warn: isDev ? originalConsole.warn.bind(console) : () => {},
    
    // 错误日志 - 始终输出（生产环境也需要）
    error: originalConsole.error.bind(console),
    
    // 信息日志 - 仅开发环境输出
    info: isDev ? originalConsole.info.bind(console) : () => {},
    
    // 调试日志 - 仅开发环境输出
    debug: isDev ? originalConsole.debug.bind(console) : () => {}
};

/**
 * 在生产环境覆盖全局 console（可选）
 * 调用此方法后，所有 console.log 等都会被静默
 * 只保留 console.error
 */
export function silenceConsoleInProduction() {
    if (!isDev) {
        console.log = () => {};
        console.warn = () => {};
        console.info = () => {};
        console.debug = () => {};
        // console.error 保留，用于捕获真正的错误
    }
}

/**
 * 恢复原始 console（用于调试）
 */
export function restoreConsole() {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
}

export default logger;
