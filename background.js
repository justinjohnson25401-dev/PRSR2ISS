// Подключаем библиотеку SheetJS (xlsx)
importScripts('xlsx.full.min.js');

// --- Helper функции для форматирования ---
const STORAGE_KEY = 'uniqueData_2gis_extension_725';

// Функция для генерации уникального userId
function generateUserId() {
  return 'xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Функция для получения или генерации userId
function getOrGenerateUserId(callback) {
  chrome.storage.local.get(['userId_2gis_extension_725'], (result) => {
    if (result.userId_2gis_extension_725) {
      console.log('[Background] Используется существующий userId:', result.userId_2gis_extension_725);
      callback(result.userId_2gis_extension_725);
    } else {
      const newUserId = generateUserId();
      chrome.storage.local.set({ userId_2gis_extension_725: newUserId }, () => {
        console.log('[Background] Сгенерирован и сохранён новый userId:', newUserId);
        callback(newUserId);
      });
    }
  });
}

function formatRating(rating) {
  if (!rating) return "";
  return `ratingValue = ${rating.ratingValue}\n` +
      `ratingCount = ${rating.ratingCount}\n` +
      `reviewCount = ${rating.reviewCount}`;
}

function formatContacts(contacts) {
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) return "";
  return contacts.map(c => c).join(", ");
}

function formatLinks(links) {
  if (!links || !Array.isArray(links) || links.length === 0) return "";
  if (typeof links[0] === "object" && links[0] !== null && "href" in links[0]) {
    return links.map(link => link.href).join("\n");
  } else {
    return links.join("\n");
  }
}

function formatSchedule(schedule) {
  const dayNames = {
    Mon: "пн",
    Tue: "вт",
    Wed: "ср",
    Thu: "чт",
    Fri: "пт",
    Sat: "сб",
    Sun: "вс"
  };

  if (!schedule) return "";

  const dayOrder = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dayTimes = [];

  for (const day of dayOrder) {
    const entry = schedule[day];
    if (!entry || !entry.working_hours || entry.working_hours.length === 0) continue;

    const wh = entry.working_hours[0];
    let timeStr = `${wh.from}–${wh.to}`;
    dayTimes.push(timeStr);
  }

  if (dayTimes.length === 0) return "";

  const uniqueTimes = [...new Set(dayTimes)];

  // Все дни круглосуточно
  if (uniqueTimes.length === 1 && uniqueTimes[0] === "00:00–24:00") {
    return "круглосуточно";
  }

  // Все дни имеют одинаковое время
  if (uniqueTimes.length === 1) {
    return `ежедневно, ${uniqueTimes[0]}`;
  }

  // Разные интервалы — группируем по последовательности
  const ranges = [];
  let i = 0;
  while (i < dayOrder.length) {
    const entry = schedule[dayOrder[i]];
    if (!entry || !entry.working_hours || entry.working_hours.length === 0) {
      i++;
      continue;
    }
    const currentTime = `${entry.working_hours[0].from}–${entry.working_hours[0].to}`;
    let j = i + 1;
    while (j < dayOrder.length) {
      const next = schedule[dayOrder[j]];
      if (!next || !next.working_hours || next.working_hours.length === 0) break;
      const nextTime = `${next.working_hours[0].from}–${next.working_hours[0].to}`;
      if (nextTime !== currentTime) break;
      j++;
    }
    const daysGroup = dayOrder.slice(i, j).map(d => dayNames[d]);
    let dayStr = daysGroup.length === 1 ? daysGroup[0] : `${daysGroup[0]}–${daysGroup[daysGroup.length - 1]}`;
    ranges.push(`${dayStr} ${currentTime}`);
    i = j;
  }

  return ranges.join("; ");
}

// --- Глобальные переменные ---
/*const capturedUrls = new Set();
const uniqueItems = [];
const uniqueItemKeys = new Set();*/
let h,g,salt;

function categorizeContacts(contactGroups) {
  const result = {
    phones: [],
    website: [],
    social: [],
    emails: []
  };

  if (!Array.isArray(contactGroups)) return result;

  for (const group of contactGroups) {
    if (!group.contacts) continue;

    for (const item of group.contacts) {
      switch (item.type) {
        case "phone":
          result.phones.push(item.text || item.value);
          break;
        case "website":
          result.website.push(item.url || item.value);
          break;
        case "email":
          result.emails.push(item.value);
          break;
        default:
          // Любые соцсети, которые не phone и website
          result.social.push(item.url || item.value || item.text);
          break;
      }
    }
  }

  return result;
}

function updateBadge(count) {
  const text = count ? count.toString() : "";
  chrome.action.setBadgeText({ text });
  console.log(`[Background] Добавлено уникальных айтемов: ${count}`);
}

function buildByIdFromSearch(searchUrl, itemId) {
  const fields = "items.locale,items.flags,items.search_attributes.detection_type,search_attributes," +
      "items.search_attributes.relevance,items.adm_div,items.city_alias,items.region_id," +
      "items.segment_id,items.reviews,items.point,request_type,context_rubrics,query_context," +
      "items.links,items.name_ex,items.name_back,items.org,items.group,items.dates,items.external_content," +
      "items.contact_groups,items.comment,items.ads.options,items.email_for_sending.allowed,items.stat," +
      "items.stop_factors,items.description,items.geometry.centroid,items.geometry.selection,items.geometry.style," +
      "items.timezone_offset,items.context,items.level_count,items.address,items.is_paid,items.access," +
      "items.access_comment,items.for_trucks,items.is_incentive,items.paving_type,items.capacity,items.schedule," +
      "items.schedule_special,items.floors,items.floor_id,items.floor_plans,ad,items.rubrics,items.routes," +
      "items.platforms,items.directions,items.barrier,items.reply_rate,items.purpose,items.purpose_code," +
      "items.attribute_groups,items.route_logo,items.has_goods,items.has_apartments_info," +
      "items.has_pinned_goods,items.has_realty,items.has_otello_stories,items.has_exchange," +
      "items.has_payments,items.has_dynamic_congestion,items.is_promoted,items.congestion," +
      "items.delivery,items.order_with_cart,search_type,items.has_discount,items.metarubrics," +
      "items.detailed_subtype,items.temporary_unavailable_atm_services,items.poi_category," +
      "items.has_ads_model,items.vacancies,items.structure_info.material,items.structure_info.floor_type," +
      "items.structure_info.gas_type,items.structure_info.year_of_construction,items.structure_info.elevators_count," +
      "items.structure_info.is_in_emergency_state,items.structure_info.project_type,items.has_otello_hotels";
  try {
    const url = new URL(searchUrl);
    const locale = url.searchParams.get('locale');
    const viewpoint1 = url.searchParams.get('viewpoint1');
    const viewpoint2 = url.searchParams.get('viewpoint2');
    const shv = url.searchParams.get('shv');
    const stat_sid = url.searchParams.get('stat[sid]');
    const stat_user = url.searchParams.get('stat[user]');
    const key = url.searchParams.get('key');
    const hashString = `/3.0/items/byid${fields}${itemId}${key}${locale}${shv}${stat_sid}${stat_user}${viewpoint1}${viewpoint2}${salt}`;
    let r = g;
    for (let i = 0; i < hashString.length; i++) {
      r = r * h + hashString.charCodeAt(i);
      r >>>= 0;
    }
    // Создаём URL для деталей
    const detailUrl = new URL("/3.0/items/byid", url.origin);

    // Очищаем параметры
    detailUrl.search = "";

    // Добавляем нужные параметры
    detailUrl.searchParams.set("id", itemId);
    detailUrl.searchParams.set("key", key);
    detailUrl.searchParams.set("locale", locale);
    detailUrl.searchParams.set("fields", fields);
    detailUrl.searchParams.set("viewpoint1", viewpoint1);
    detailUrl.searchParams.set("viewpoint2", viewpoint2);
    detailUrl.searchParams.set("shv", shv);
    detailUrl.searchParams.set("stat[sid]", stat_sid);
    detailUrl.searchParams.set("stat[user]", stat_user);
    detailUrl.searchParams.set("r", r);

    return detailUrl.toString();
  } catch (err) {
    console.error('Ошибка генерации ссылки byid:', err);
    return null;
  }
}

// --- Перехват запросов ---
chrome.webRequest.onCompleted.addListener(
    (details) => {
        try {
          // --- 1) JSON API: /catalog.api.2gis.*/3.0/items? ---
          const apiRegex = /catalog\.api\.2gis\.(ru|kz|kg|uz|com)\/3\.0\/items\?/;
          if (apiRegex.test(details.url)) {
            loadAllFromStorage(async (capturedUrls, uniqueItems, uniqueItemKeys) => {
              if (!capturedUrls.has(details.url)) {
                capturedUrls.add(details.url);
                await saveAllToStorage(capturedUrls, uniqueItems, uniqueItemKeys);
                console.log("[Background] URL сохранён (API):", details.url);

                const items = await fetch(details.url)
                    .then(response => response.json()) // короткая форма
                    .catch(err => {
                      console.error("[Background] Ошибка fetch:", details.url, err);
                      sendLog('intercept_request_fetch_error',`[Background] Ошибка получения данных по ссылке ${details.url} - ${err.message}`);
                      return null; // чтобы items всегда было определено
                    });

                if (items?.result && Array.isArray(items.result.items)) {
                  if (!salt||!h||!g) {
                    const res = await fetch('https://2gis.ru/');
                    const html = await res.text();
                    const match = html.match(/src="(https:\/\/d-assets\.2gis\.ru\/app\.[a-z0-9]+\.js)"/i);
                    if (match[1]) {

                      const text = await fetch(match[1]).then(r => r.ok ? r.text() : Promise.reject(`HTTP error: ${r.status}`));

                      // --- Парсим массив m и вычисляем h, g ---
                      const mMatch = text.match(/const\s+m\s*=\s*\[([^\]]+)\]/);
                      if (mMatch) {
                        const m = mMatch[1].split(',').map(n => parseInt(n.trim(), 10));
                        if (m.length >= 4) {
                          h = m[0] + m[3];
                          g = m[1] + m[2];
                          console.log("[Background] Найден массив m:", m, "h:", h, "g:", g);
                        }
                      }

                      // --- Парсим класс Yw и this.a (динамически) --- поправил критический момент, название класса меняется
                      const classRegex = /class\s+\w+\s*{[\s\S]*?constructor\s*\(([^)]*)\)\s*{([\s\S]*?)this\.KEY\s*=\s*t\.webApiKey\s*,\s*this\.a\s*=\s*["'`]([^"'`]+)["'`]/;
                      const classMatch = text.match(classRegex);

                      if (classMatch) {
                        salt = classMatch[3];
                        console.log("[Background] Значение this.a:", salt);
                      } else {
                        sendLog('intercept_request_error',`[Background] Не удалось получить salt`);
                      }
                    }
                  }

                  for (const item of items.result.items) {
                    const key = item.id.split('_')[0] || (item.name + '|' + item.address_name);
                    if (!uniqueItemKeys.has(key)) {
                      uniqueItemKeys.add(key);
                      await saveAllToStorage(capturedUrls, uniqueItems, uniqueItemKeys);

                      // --- Запрос деталей по ID ---
                      const detailUrl = buildByIdFromSearch(details.url, item.id);
                      const detail = await fetch(detailUrl)
                          .then(r => r.ok ? r.json() : Promise.reject(`HTTP error: ${r.status}`))
                          .catch(e => console.error("[Background] Ошибка при запросе деталей:", detailUrl, e));

                      if (detail?.result?.items?.length) {
                        const detailItem = detail.result.items[0];
                        // --- Сборка объекта айтема ---
                        let contacts = categorizeContacts(detailItem.contact_groups);

                        const extracted = {
                          title: detailItem.name || "",
                          address: detailItem.address_name || "",
                          rating: detailItem.reviews ? {
                            ratingValue: detailItem.reviews?.general_rating || "",
                            ratingCount: detailItem.reviews?.general_review_count_with_stars || "",
                            reviewCount: detailItem.reviews?.general_review_count || ""
                          } : null,
                          contacts: contacts?.phones || [],
                          urls: contacts?.website || [],
                          socialLinks: contacts?.social || [],
                          emails: contacts?.emails || [],
                          workingTimeText: formatSchedule(detailItem.schedule) || ""
                        };

                        uniqueItems.push(extracted);
                        await saveAllToStorage(capturedUrls, uniqueItems, uniqueItemKeys);
                        console.log("[Background] Добавлен уникальный айтем:", extracted.title);
                      } else {
                        sendLog('intercept_request_error',`[Background] Не удалось получить детали по ссылке ${detailUrl}`);
                        h = g = salt = null;
                      }
                    }
                  }
                }
              }
              return; // дальше не идём, чтобы не обрабатывать этот URL как JS
            });

          }
        } catch (err) {
          console.error("[Background] Ошибка обработки URL:", details.url, err);
          sendLog('intercept_request_error',`[Background] Ошибка обработки URL: ${details.url} - ${err.message}`);
        }

    },
    {
      urls: ["*://catalog.api.2gis.ru/3.0/items*"]
    }
);

// --- Обработчик сообщений ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download") {
    loadAllFromStorage((capturedUrls, uniqueItems, uniqueItemKeys) => {
      if (uniqueItems.length === 0) {
        sendResponse({ status: "error", message: "Нет сохранённых айтемов" });
        sendLog("download_click_error",'Нет сохранённых айтемов');
        return;
      }

      const formattedItems = uniqueItems.map(item => ({
        ...item,
        rating: formatRating(item.rating),
        contacts: formatContacts(item.contacts),
        urls: formatLinks(item.urls),
        socialLinks: formatLinks(item.socialLinks),
        emails: formatLinks(item.emails)
      }));

      const itemNames = uniqueItems
          .map(item => item.title || item.name || '')
          .filter(Boolean);

      sendLog("download_click", {
        preparedCount: formattedItems.length,
        names: itemNames
      });

      const ws = XLSX.utils.json_to_sheet(formattedItems);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Items");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const reader = new FileReader();
      reader.onloadend = function () {
        chrome.downloads.download(
            {
              url: reader.result,
              filename: "unique_items_2gis.xlsx",
              saveAs: true
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error("[Background] Ошибка скачивания файла:", chrome.runtime.lastError);
                sendLog("download_click_error",`[Background] Ошибка скачивания файла: ${chrome.runtime.lastError.message}`);
                sendResponse({ status: "error", message: "Ошибка скачивания файла." });
              } else {
                console.log("[Background] Файл успешно скачан!");
                sendLog("download_click","[Background] Файл успешно скачан!");
                sendResponse({ status: "ok" });
              }
            }
        );
      };
      reader.readAsDataURL(blob);
    });
    return true;
  }
  else if (message.action === "getCount") {
    loadAllFromStorage((capturedUrls, uniqueItems, uniqueItemKeys) => {
      sendLog("get_count",`[Background] Запрос количества айтемов, кл-во: ${uniqueItems.length}`);
      sendResponse({ status: "ok", count: uniqueItems.length });
    });
    return true;
  }
  else if (message.action === "clear") {
    sendLog("clear_click",`[Background] Запрос на очистку айтемов`);
    loadAllFromStorage((capturedUrls, uniqueItems, uniqueItemKeys) => {
      capturedUrls.clear();
      uniqueItems = [];
      uniqueItemKeys.clear();
      updateBadge(0);
      console.log("[Background] Данные очищены");
      sendLog("clear_click","[Background] Данные очищены");
      saveAllToStorage(capturedUrls, uniqueItems, uniqueItemKeys).then(()=>{
        sendResponse({ status: "ok", message: "Данные очищены" });
      });
    });
    return true;
  }
  else if (message.action === "sendLog") {
    sendLog(message.eventName, message.eventPayload);
  }
});

// Инициализация бейджа при загрузке background
chrome.runtime.onInstalled.addListener(() => {
  loadAllFromStorage((capturedUrls, uniqueItems, uniqueItemKeys) => {
    updateBadge(uniqueItems.length);
    getOrGenerateUserId((userId) => {
      console.log(`[Background] Запуск расширения, UserId: ${userId}`)
      sendLog("extension_installed", `[Background] Установка расширения, UserId: ${userId}`);
    });
  });
});
chrome.runtime.onStartup.addListener(() => {
  loadAllFromStorage((capturedUrls, uniqueItems, uniqueItemKeys) => {
    updateBadge(uniqueItems.length);
  });
});

chrome.runtime.onInstalled.addListener(() => {
    getOrGenerateUserId((userId) => {
      console.log(`[Background] Запуск расширения, UserId: ${userId}`)
      sendLog("extension_installed", `Установка расширения, UserId: ${userId}`);
    });
});

// 1. Загрузка всех трёх переменных из chrome.storage.local
function loadAllFromStorage(callback) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const data = result[STORAGE_KEY] || {
      capturedUrls: [],
      uniqueItems: [],
      uniqueItemKeys: []
    };

    // Преобразуем массивы обратно в Set где нужно
    const capturedUrls   = new Set(data.capturedUrls);
    const uniqueItemKeys = new Set(data.uniqueItemKeys);
    const uniqueItems    = data.uniqueItems;   // оставляем как массив

    callback(capturedUrls, uniqueItems, uniqueItemKeys);
  });
}

// 2. Сохранение всех трёх переменных в storage
function saveAllToStorage(capturedUrls, uniqueItems, uniqueItemKeys) {
  const dataToSave = {
    [STORAGE_KEY]: {
      capturedUrls:   Array.from(capturedUrls),
      uniqueItems:    uniqueItems,
      uniqueItemKeys: Array.from(uniqueItemKeys)
    }
  };

  return new Promise((resolve) => {
    chrome.storage.local.set(dataToSave, () => {
      updateBadge(uniqueItems.length);
      resolve();  // ← только здесь считается, что сохранение завершено
    });
  });
}

function sendLog(eventName, eventPayload = '') {
  const logData = {
    user_id: '',
    extension_id: "gis-maps-parser", // Или подставь ID расширения
    event_name: eventName,
    event_payload: eventPayload
  };

  chrome.storage.local.get(['userId_2gis_extension_725'], (result) => {
    logData.user_id = result.userId_2gis_extension_725;
    fetch('https://hyper-scraper.com/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
      keepalive: true
    })
        .then(response => response.json())
        .catch(error => {
          console.error('Error sending log:', error);
        });
  });
}

