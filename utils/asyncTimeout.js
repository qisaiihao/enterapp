// 超时后拒绝本次等待；原异步任务的迟到结果不会重新结算。
export function withTimeout(promise, timeoutMs, message = '请求超时') {
  if (!(timeoutMs > 0)) return Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(message);
      error.code = 'TIMEOUT';
      reject(error);
    }, timeoutMs);
    Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
