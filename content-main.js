const nativeFetch = window.fetch;

// Firefox 版：混合模式本地请求交替计数器（无 tabIds 依赖，每个标签页独立）
let __tabulaMixedCounter = 0;

window.fetch = async function(...args) {
  const url = args[0];

  if (typeof url === 'string' && url.includes('/x/web-interface/wbi/index/top/feed/rcmd')) {
    const currentMode = document.documentElement.getAttribute('data-tabula-mode') || 'pure';

    if (currentMode === 'pure' || currentMode === 'origin') {
      return nativeFetch(...args);
    }

    if (currentMode === 'mixed') {
      // 奇数请求去 Cookie（热门流），偶数保留 Cookie（个性化）
      __tabulaMixedCounter++;
      const options = args[1] ? { ...args[1] } : {};
      if (__tabulaMixedCounter % 2 !== 0) {
        options.credentials = 'omit';
      }
      return nativeFetch.call(window, args[0], options);
    }

    // refresh 模式：通过事件桥通知后台编译 DNR 规则
    await prepareNetworkState();
    return nativeFetch(...args);
  }

  return nativeFetch(...args);
};

function prepareNetworkState() {
  return new Promise((resolve) => {
    const eventId = Math.random().toString(36).substring(2);

    function onNetworkReady(e) {
      if (e.detail && e.detail.eventId === eventId) {
        window.removeEventListener('tabula_network_ready', onNetworkReady);
        resolve();
      }
    }

    window.addEventListener('tabula_network_ready', onNetworkReady);
    window.dispatchEvent(new CustomEvent('tabula_request_triggered', { detail: { eventId } }));
  });
}
