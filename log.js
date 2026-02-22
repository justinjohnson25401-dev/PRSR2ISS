// 2GIS Parser Pro - Bridge Script v2.0
// Мост между MAIN world и расширением

window.dispatchEvent(new CustomEvent('contentScriptReady'));

// Пересылка сообщений из MAIN world в background
window.addEventListener('FROM_MAIN_WORLD', (e) => {
  if (e.detail) {
    chrome.runtime.sendMessage(e.detail);
  }
});
