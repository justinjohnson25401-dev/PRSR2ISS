window.dispatchEvent(new CustomEvent('contentScriptReady'));
// Ловим события из MAIN world
window.addEventListener('FROM_MAIN_WORLD', (e) => {
    console.log('Получено из MAIN:', e.detail);
    // Пересылаем в background
    chrome.runtime.sendMessage(e.detail);
});