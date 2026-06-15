
// Firefox 版：核心网络拦截规则动态编译器（无 tabIds 依赖）
function compileDynamicNetworkRules(mode) {
  chrome.storage.local.get(['bili_fingerprint'], (res) => {
    const fingerprint = res.bili_fingerprint || '';
    const ruleIdsToRemove = [100];
    if (mode === 'origin') {
      chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIdsToRemove });
      return;
    }
    let ruleAction = {};
    if (mode === 'pure') {
      ruleAction = {
        type: "modifyHeaders",
        requestHeaders: [{ header: "cookie", operation: "remove" }]
      };
    } else {
      // refresh/mixed：设置指纹 Cookie（仅保留 buvid3/4）
      ruleAction = {
        type: "modifyHeaders",
        requestHeaders: [{
          header: "cookie",
          operation: "set",
          value: fingerprint
        }]
      };
    }

    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: ruleIdsToRemove,
      addRules: [{
        id: 100,
        priority: 2,
        action: ruleAction,
        condition: {
          urlFilter: "||api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd"
        }
      }]
    });
  });
}

function syncGlobalModeConfiguration(mode) {
  chrome.declarativeNetRequest.updateEnabledRulesets({
    disableRulesetIds: ["rules"]
  });

  if (mode === 'pure' || mode === 'refresh') {
    compileDynamicNetworkRules(mode);
  } else {
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [100] });
  }
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.bili_mode) {
    syncGlobalModeConfiguration(changes.bili_mode.newValue);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['bili_mode'], (res) => {
    const mode = res.bili_mode || 'pure';
    chrome.storage.local.set({ bili_mode: mode });
    syncGlobalModeConfiguration(mode);
  });
});

// Firefox 版：混合模式在 content-main.js 中本地交替，此处只处理 refresh 模式的 DNR 编译
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "evaluateMixedRequest") {
    chrome.storage.local.get(['bili_mode'], (res) => {
      const mode = res.bili_mode || 'pure';

      if (mode === 'refresh') {
        compileDynamicNetworkRules('refresh');
        sendResponse({ active: true });
      } else {
        sendResponse({ active: false });
      }
    });
    return true;
  }
});
