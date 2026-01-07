// 2GIS Parser Pro - Background Service Worker v2.0
// Без внешней телеметрии, все данные хранятся локально

importScripts('xlsx.full.min.js');

// =============== CONSTANTS ===============
const STORAGE_KEY = 'uniqueData_2gis_parser_pro_v2';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// =============== CRYPTO PARAMS ===============
let cryptoParams = { h: null, g: null, salt: null };

// =============== HELPER FUNCTIONS ===============

// Форматирование рейтинга
function formatRating(rating) {
  if (!rating) return '';
  return `Рейтинг: ${rating.ratingValue || '-'} (${rating.ratingCount || 0} оценок, ${rating.reviewCount || 0} отзывов)`;
}

// Форматирование контактов
function formatContacts(contacts) {
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) return '';
  return contacts.join(', ');
}

// Форматирование ссылок
function formatLinks(links) {
  if (!links || !Array.isArray(links) || links.length === 0) return '';
  if (typeof links[0] === 'object' && links[0] !== null && 'href' in links[0]) {
    return links.map(link => link.href).join('\n');
  }
  return links.join('\n');
}

// Форматирование расписания
function formatSchedule(schedule) {
  const dayNames = { Mon: 'пн', Tue: 'вт', Wed: 'ср', Thu: 'чт', Fri: 'пт', Sat: 'сб', Sun: 'вс' };
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!schedule) return '';

  const dayTimes = [];
  for (const day of dayOrder) {
    const entry = schedule[day];
    if (!entry || !entry.working_hours || entry.working_hours.length === 0) continue;
    const wh = entry.working_hours[0];
    dayTimes.push(`${wh.from}–${wh.to}`);
  }

  if (dayTimes.length === 0) return '';

  const uniqueTimes = [...new Set(dayTimes)];

  if (uniqueTimes.length === 1 && uniqueTimes[0] === '00:00–24:00') {
    return 'круглосуточно';
  }

  if (uniqueTimes.length === 1) {
    return `ежедневно, ${uniqueTimes[0]}`;
  }

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
    const dayStr = daysGroup.length === 1 ? daysGroup[0] : `${daysGroup[0]}–${daysGroup[daysGroup.length - 1]}`;
    ranges.push(`${dayStr} ${currentTime}`);
    i = j;
  }

  return ranges.join('; ');
}

// Категоризация контактов
function categorizeContacts(contactGroups) {
  const result = { phones: [], website: [], social: [], emails: [] };

  if (!Array.isArray(contactGroups)) return result;

  for (const group of contactGroups) {
    if (!group.contacts) continue;

    for (const item of group.contacts) {
      switch (item.type) {
        case 'phone':
          result.phones.push(item.text || item.value);
          break;
        case 'website':
          result.website.push(item.url || item.value);
          break;
        case 'email':
          result.emails.push(item.value);
          break;
        default:
          if (item.url || item.value || item.text) {
            result.social.push(item.url || item.value || item.text);
          }
          break;
      }
    }
  }

  return result;
}

// Генерация ссылки на 2ГИС карту
function generate2GISMapLink(lat, lon, title) {
  if (!lat || !lon) return '';
  return `https://2gis.ru/geo/${lon}%2C${lat}`;
}

// Генерация ссылки на Яндекс карту
function generateYandexMapLink(lat, lon, title) {
  if (!lat || !lon) return '';
  const encodedTitle = encodeURIComponent(title || 'Точка');
  return `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map&text=${encodedTitle}`;
}

// Обновление бейджа
function updateBadge(count) {
  const text = count ? count.toString() : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#00a651' });
}

// =============== STORAGE FUNCTIONS ===============

async function loadFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const data = result[STORAGE_KEY] || {
        capturedUrls: [],
        uniqueItems: [],
        uniqueItemKeys: []
      };

      resolve({
        capturedUrls: new Set(data.capturedUrls),
        uniqueItems: data.uniqueItems,
        uniqueItemKeys: new Set(data.uniqueItemKeys)
      });
    });
  });
}

async function saveToStorage(capturedUrls, uniqueItems, uniqueItemKeys) {
  const dataToSave = {
    [STORAGE_KEY]: {
      capturedUrls: Array.from(capturedUrls),
      uniqueItems: uniqueItems,
      uniqueItemKeys: Array.from(uniqueItemKeys)
    }
  };

  return new Promise((resolve) => {
    chrome.storage.local.set(dataToSave, () => {
      updateBadge(uniqueItems.length);
      resolve();
    });
  });
}

// =============== FETCH WITH RETRY ===============

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === retries) {
        console.error(`[Background] Fetch failed after ${retries + 1} attempts:`, url, error);
        return null;
      }
      await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)));
    }
  }
  return null;
}

// =============== CRYPTO FUNCTIONS ===============

async function loadCryptoParams() {
  if (cryptoParams.h && cryptoParams.g && cryptoParams.salt) {
    return cryptoParams;
  }

  try {
    const res = await fetch('https://2gis.ru/');
    const html = await res.text();
    const match = html.match(/src="(https:\/\/d-assets\.2gis\.ru\/app\.[a-z0-9]+\.js)"/i);

    if (!match || !match[1]) {
      console.error('[Background] App script URL not found');
      return null;
    }

    const scriptRes = await fetch(match[1]);
    const text = await scriptRes.text();

    // Parse m array
    const mMatch = text.match(/const\s+m\s*=\s*\[([^\]]+)\]/);
    if (mMatch) {
      const m = mMatch[1].split(',').map(n => parseInt(n.trim(), 10));
      if (m.length >= 4) {
        cryptoParams.h = m[0] + m[3];
        cryptoParams.g = m[1] + m[2];
      }
    }

    // Parse salt
    const classRegex = /class\s+\w+\s*{[\s\S]*?constructor\s*\(([^)]*)\)\s*{([\s\S]*?)this\.KEY\s*=\s*t\.webApiKey\s*,\s*this\.a\s*=\s*["'`]([^"'`]+)["'`]/;
    const classMatch = text.match(classRegex);
    if (classMatch) {
      cryptoParams.salt = classMatch[3];
    }

    console.log('[Background] Crypto params loaded:', cryptoParams);
    return cryptoParams;

  } catch (error) {
    console.error('[Background] Error loading crypto params:', error);
    return null;
  }
}

function buildByIdUrl(searchUrl, itemId) {
  const fields = 'items.locale,items.flags,items.search_attributes.detection_type,search_attributes,' +
    'items.search_attributes.relevance,items.adm_div,items.city_alias,items.region_id,' +
    'items.segment_id,items.reviews,items.point,request_type,context_rubrics,query_context,' +
    'items.links,items.name_ex,items.name_back,items.org,items.group,items.dates,items.external_content,' +
    'items.contact_groups,items.comment,items.ads.options,items.email_for_sending.allowed,items.stat,' +
    'items.stop_factors,items.description,items.geometry.centroid,items.geometry.selection,items.geometry.style,' +
    'items.timezone_offset,items.context,items.level_count,items.address,items.is_paid,items.access,' +
    'items.access_comment,items.for_trucks,items.is_incentive,items.paving_type,items.capacity,items.schedule,' +
    'items.schedule_special,items.floors,items.floor_id,items.floor_plans,ad,items.rubrics,items.routes,' +
    'items.platforms,items.directions,items.barrier,items.reply_rate,items.purpose,items.purpose_code,' +
    'items.attribute_groups,items.route_logo,items.has_goods,items.has_apartments_info,' +
    'items.has_pinned_goods,items.has_realty,items.has_otello_stories,items.has_exchange,' +
    'items.has_payments,items.has_dynamic_congestion,items.is_promoted,items.congestion,' +
    'items.delivery,items.order_with_cart,search_type,items.has_discount,items.metarubrics,' +
    'items.detailed_subtype,items.temporary_unavailable_atm_services,items.poi_category,' +
    'items.has_ads_model,items.vacancies,items.structure_info.material,items.structure_info.floor_type,' +
    'items.structure_info.gas_type,items.structure_info.year_of_construction,items.structure_info.elevators_count,' +
    'items.structure_info.is_in_emergency_state,items.structure_info.project_type,items.has_otello_hotels';

  try {
    const { h, g, salt } = cryptoParams;
    if (!h || !g || !salt) return null;

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

    const detailUrl = new URL('/3.0/items/byid', url.origin);
    detailUrl.searchParams.set('id', itemId);
    detailUrl.searchParams.set('key', key);
    detailUrl.searchParams.set('locale', locale);
    detailUrl.searchParams.set('fields', fields);
    detailUrl.searchParams.set('viewpoint1', viewpoint1);
    detailUrl.searchParams.set('viewpoint2', viewpoint2);
    detailUrl.searchParams.set('shv', shv);
    detailUrl.searchParams.set('stat[sid]', stat_sid);
    detailUrl.searchParams.set('stat[user]', stat_user);
    detailUrl.searchParams.set('r', r);

    return detailUrl.toString();

  } catch (err) {
    console.error('[Background] Error building byId URL:', err);
    return null;
  }
}

// =============== DATA PROCESSING ===============

function extractItemData(detailItem) {
  const contacts = categorizeContacts(detailItem.contact_groups);

  // Extract coordinates
  let lat = null, lon = null;
  if (detailItem.point) {
    lat = detailItem.point.lat;
    lon = detailItem.point.lon;
  }

  // Extract rubrics (categories)
  const rubrics = detailItem.rubrics
    ? detailItem.rubrics.map(r => r.name).join(', ')
    : '';

  return {
    title: detailItem.name || '',
    address: detailItem.address_name || '',
    rating: detailItem.reviews ? {
      ratingValue: detailItem.reviews.general_rating || '',
      ratingCount: detailItem.reviews.general_review_count_with_stars || 0,
      reviewCount: detailItem.reviews.general_review_count || 0
    } : null,
    contacts: contacts.phones || [],
    urls: contacts.website || [],
    socialLinks: contacts.social || [],
    emails: contacts.emails || [],
    workingTimeText: formatSchedule(detailItem.schedule) || '',
    rubrics: rubrics,
    // Coordinates
    latitude: lat,
    longitude: lon,
    // Map links
    link2GIS: generate2GISMapLink(lat, lon, detailItem.name),
    linkYandex: generateYandexMapLink(lat, lon, detailItem.name),
    // Additional info
    description: detailItem.description || '',
    orgName: detailItem.org?.name || ''
  };
}

// =============== FILTER FUNCTIONS ===============

function applyFilters(items, filters) {
  if (!filters) return items;

  return items.filter(item => {
    // Min rating filter
    if (filters.minRating > 0) {
      const rating = parseFloat(item.rating?.ratingValue) || 0;
      if (rating < filters.minRating) return false;
    }

    // Phone filter
    if (filters.onlyWithPhone) {
      if (!item.contacts || item.contacts.length === 0) return false;
    }

    // Email filter
    if (filters.onlyWithEmail) {
      if (!item.emails || item.emails.length === 0) return false;
    }

    // Website filter
    if (filters.onlyWithSite) {
      if (!item.urls || item.urls.length === 0) return false;
    }

    return true;
  });
}

// =============== EXPORT FUNCTIONS ===============

function formatItemsForExport(items) {
  return items.map(item => ({
    'Название': item.title,
    'Адрес': item.address,
    'Телефоны': formatContacts(item.contacts),
    'Email': formatLinks(item.emails),
    'Сайты': formatLinks(item.urls),
    'Соцсети': formatLinks(item.socialLinks),
    'Рейтинг': item.rating?.ratingValue || '',
    'Кол-во оценок': item.rating?.ratingCount || '',
    'Кол-во отзывов': item.rating?.reviewCount || '',
    'График работы': item.workingTimeText,
    'Рубрики': item.rubrics || '',
    'Описание': item.description || '',
    'Организация': item.orgName || '',
    'Широта': item.latitude || '',
    'Долгота': item.longitude || '',
    'Открыть в 2ГИС': item.link2GIS || '',
    'Открыть в Яндекс.Картах': item.linkYandex || ''
  }));
}

async function exportToXLSX(items) {
  const formatted = formatItemsForExport(items);
  const ws = XLSX.utils.json_to_sheet(formatted);

  // Set column widths
  ws['!cols'] = [
    { wch: 30 },  // Название
    { wch: 40 },  // Адрес
    { wch: 20 },  // Телефоны
    { wch: 25 },  // Email
    { wch: 30 },  // Сайты
    { wch: 30 },  // Соцсети
    { wch: 8 },   // Рейтинг
    { wch: 12 },  // Кол-во оценок
    { wch: 12 },  // Кол-во отзывов
    { wch: 25 },  // График работы
    { wch: 30 },  // Рубрики
    { wch: 50 },  // Описание
    { wch: 25 },  // Организация
    { wch: 12 },  // Широта
    { wch: 12 },  // Долгота
    { wch: 40 },  // Открыть в 2ГИС
    { wch: 50 }   // Открыть в Яндекс.Картах
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Компании');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function exportToCSV(items) {
  const formatted = formatItemsForExport(items);

  if (formatted.length === 0) return '';

  const headers = Object.keys(formatted[0]);
  const csvRows = [headers.join(';')];

  for (const row of formatted) {
    const values = headers.map(header => {
      const val = row[header] || '';
      // Escape quotes and wrap in quotes
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(';'));
  }

  return csvRows.join('\n');
}

function exportToJSON(items) {
  return JSON.stringify(items, null, 2);
}

// =============== REQUEST INTERCEPTION ===============

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    try {
      const apiRegex = /catalog\.api\.2gis\.(ru|kz|kg|uz|com|by|am|ge|az|md|tj|tm|ae|sa|it)\/3\.0\/items\?/;

      if (!apiRegex.test(details.url)) return;

      const storage = await loadFromStorage();
      let { capturedUrls, uniqueItems, uniqueItemKeys } = storage;

      if (capturedUrls.has(details.url)) return;

      capturedUrls.add(details.url);
      await saveToStorage(capturedUrls, uniqueItems, uniqueItemKeys);

      console.log('[Background] Processing URL:', details.url);

      // Load crypto params if needed
      await loadCryptoParams();

      // Fetch items list
      const items = await fetchWithRetry(details.url);

      if (!items?.result?.items?.length) {
        console.log('[Background] No items in response');
        return;
      }

      console.log(`[Background] Found ${items.result.items.length} items`);

      // Process each item
      for (const item of items.result.items) {
        const key = item.id?.split('_')[0] || `${item.name}|${item.address_name}`;

        if (uniqueItemKeys.has(key)) continue;

        uniqueItemKeys.add(key);

        // Fetch item details
        const detailUrl = buildByIdUrl(details.url, item.id);
        if (!detailUrl) {
          console.error('[Background] Could not build detail URL for:', item.id);
          continue;
        }

        const detail = await fetchWithRetry(detailUrl);

        if (detail?.result?.items?.length) {
          const extracted = extractItemData(detail.result.items[0]);
          uniqueItems.push(extracted);
          await saveToStorage(capturedUrls, uniqueItems, uniqueItemKeys);
          console.log('[Background] Added:', extracted.title);
        } else {
          // Reset crypto params on failure
          cryptoParams = { h: null, g: null, salt: null };
          console.error('[Background] Failed to get details for:', item.id);
        }
      }

    } catch (err) {
      console.error('[Background] Error processing request:', err);
    }
  },
  {
    urls: [
      '*://catalog.api.2gis.ru/3.0/items*',
      '*://catalog.api.2gis.kz/3.0/items*',
      '*://catalog.api.2gis.kg/3.0/items*',
      '*://catalog.api.2gis.uz/3.0/items*',
      '*://catalog.api.2gis.com/3.0/items*',
      '*://catalog.api.2gis.by/3.0/items*',
      '*://catalog.api.2gis.am/3.0/items*',
      '*://catalog.api.2gis.ge/3.0/items*',
      '*://catalog.api.2gis.az/3.0/items*',
      '*://catalog.api.2gis.md/3.0/items*',
      '*://catalog.api.2gis.tj/3.0/items*',
      '*://catalog.api.2gis.tm/3.0/items*',
      '*://catalog.api.2gis.ae/3.0/items*',
      '*://catalog.api.2gis.sa/3.0/items*',
      '*://catalog.api.2gis.it/3.0/items*'
    ]
  }
);

// =============== MESSAGE HANDLERS ===============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sendResponse) {
  const storage = await loadFromStorage();
  let { capturedUrls, uniqueItems, uniqueItemKeys } = storage;

  switch (message.action) {
    case 'download': {
      let filtered = applyFilters(uniqueItems, message.filters);

      if (filtered.length === 0) {
        sendResponse({ status: 'empty', message: 'Нет данных для экспорта' });
        return;
      }

      try {
        let dataUrl, filename, mimeType;
        const format = message.format || 'xlsx';

        switch (format) {
          case 'xlsx':
            dataUrl = await exportToXLSX(filtered);
            filename = `2gis_export_${Date.now()}.xlsx`;
            break;

          case 'csv':
            const csvContent = exportToCSV(filtered);
            const csvBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
            dataUrl = await new Promise(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(csvBlob);
            });
            filename = `2gis_export_${Date.now()}.csv`;
            break;

          case 'json':
            const jsonContent = exportToJSON(filtered);
            const jsonBlob = new Blob([jsonContent], { type: 'application/json' });
            dataUrl = await new Promise(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(jsonBlob);
            });
            filename = `2gis_export_${Date.now()}.json`;
            break;
        }

        chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
          } else {
            sendResponse({ status: 'ok', count: filtered.length });
          }
        });

      } catch (error) {
        sendResponse({ status: 'error', message: error.message });
      }
      break;
    }

    case 'getStats': {
      const withPhones = uniqueItems.filter(i => i.contacts && i.contacts.length > 0).length;
      const withEmails = uniqueItems.filter(i => i.emails && i.emails.length > 0).length;
      const withSites = uniqueItems.filter(i => i.urls && i.urls.length > 0).length;

      sendResponse({
        status: 'ok',
        stats: {
          total: uniqueItems.length,
          withPhones,
          withEmails,
          withSites
        }
      });
      break;
    }

    case 'getFilteredCount': {
      const filtered = applyFilters(uniqueItems, message.filters);
      sendResponse({ status: 'ok', count: filtered.length });
      break;
    }

    case 'getPreview': {
      let filtered = applyFilters(uniqueItems, message.filters);
      const limit = message.limit || 5;
      const preview = filtered.slice(0, limit);

      sendResponse({
        status: 'ok',
        items: preview,
        total: filtered.length
      });
      break;
    }

    case 'clear': {
      capturedUrls.clear();
      uniqueItems = [];
      uniqueItemKeys.clear();
      await saveToStorage(capturedUrls, uniqueItems, uniqueItemKeys);
      sendResponse({ status: 'ok', message: 'Данные очищены' });
      break;
    }

    case 'getCount': {
      sendResponse({ status: 'ok', count: uniqueItems.length });
      break;
    }

    default:
      sendResponse({ status: 'error', message: 'Unknown action' });
  }
}

// =============== INITIALIZATION ===============

chrome.runtime.onInstalled.addListener(async () => {
  const storage = await loadFromStorage();
  updateBadge(storage.uniqueItems.length);
  console.log('[Background] Extension installed/updated');
});

chrome.runtime.onStartup.addListener(async () => {
  const storage = await loadFromStorage();
  updateBadge(storage.uniqueItems.length);
  console.log('[Background] Extension started');
});
