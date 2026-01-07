document.getElementById("downloadBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "download" }, (response) => {
    if (!response) {
      document.getElementById("status").textContent = chrome.i18n.getMessage('error_status');
      document.getElementById("status").style.color = "red";
      return;
    }
    if (response.status === "ok") {
      document.getElementById("status").textContent = chrome.i18n.getMessage('success_status');
      document.getElementById("status").style.color = "green";
    } else {
      document.getElementById("status").textContent = response.message || chrome.i18n.getMessage('error');
      document.getElementById("status").style.color = "red";
    }
  });
});

document.getElementById("clearBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "clear" }, (response) => {
    if (response.status === "ok") {
      document.getElementById("status").textContent = chrome.i18n.getMessage('success_clear_data_status');
      document.getElementById("status").style.color = "green";
    } else {
      document.getElementById("status").textContent = chrome.i18n.getMessage('error_clear_data_status');
      document.getElementById("status").style.color = "red";
    }
  });
});

// Кнопка поддержки – открывает Telegram
document.getElementById("supportBtn").addEventListener("click", () => {
  sendLog('click_support','[Popup] Клик по кнопке "Поддержка"');
  chrome.tabs.create({ url: "https://t.me/aza_support" });
});

// Кнопка инструкции – открывает страницу с инструкцией из расширения
document.getElementById("instructionBtn").addEventListener("click", () => {
  sendLog('click_instruction','[Popup] Клик по кнопке "Инструкция"');
  // Определяем язык
  const lang = chrome.i18n.getUILanguage().startsWith('ru') ? 'ru' : 'en';
// Загружаем страницу или тексты на нужном языке
  const instructionPage = `instruction/${lang}.html`;
  chrome.tabs.create({ url: instructionPage });
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.innerText = chrome.i18n.getMessage(el.getAttribute("data-i18n"));
  });
});

function sendLog(eventName, eventPayload = '') {
  const logData = {
    user_id: 0,
    extension_id: "gis-maps-parser", // Или подставь ID расширения
    event_name: eventName,
    event_payload: eventPayload
  };

  chrome.storage.local.get(['userId_2gis_extension_725'], (result) => {
    logData.user_id = result.userId_2gis_extension_725;
    console.log('[Popup] Отправлен лог через api/log ендпоинт',logData);
    fetch('https://hyper-scraper.com/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
      keepalive: true
    })
        .then(response => response.json())
        .then(data => console.log('Log sent successfully:', data))
        .catch(error => console.error('Error sending log:', error));
  });
}

sendLog('load_popup','[Popup] Открыт popup');
