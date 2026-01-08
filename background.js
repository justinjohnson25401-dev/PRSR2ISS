// 2GIS Parser Pro - Background Service Worker v2.4.0
// Без внешней телеметрии, все данные хранятся локально

// xlsx-js-style for styled Excel export
importScripts('xlsx-js-style.min.js');

// =============== CONSTANTS ===============
const STORAGE_KEY = 'uniqueData_2gis_parser_pro_v2';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Центры городов (lat, lon)
const CITY_CENTERS = {
  'Москва': { lat: 55.7558, lon: 37.6173 },
  'Санкт-Петербург': { lat: 59.9343, lon: 30.3351 },
  'Новосибирск': { lat: 55.0084, lon: 82.9357 },
  'Екатеринбург': { lat: 56.8389, lon: 60.6057 },
  'Казань': { lat: 55.7879, lon: 49.1233 },
  'Нижний Новгород': { lat: 56.2965, lon: 43.9361 },
  'Челябинск': { lat: 55.1644, lon: 61.4368 },
  'Самара': { lat: 53.1959, lon: 50.1002 },
  'Омск': { lat: 54.9885, lon: 73.3242 },
  'Ростов-на-Дону': { lat: 47.2357, lon: 39.7015 },
  'Уфа': { lat: 54.7388, lon: 55.9721 },
  'Красноярск': { lat: 56.0153, lon: 92.8932 },
  'Воронеж': { lat: 51.6720, lon: 39.1843 },
  'Пермь': { lat: 58.0105, lon: 56.2502 },
  'Волгоград': { lat: 48.7080, lon: 44.5133 }
};

// Городские коды (служебные номера)
const CITY_CODES = ['495', '499', '343', '383', '381', '812', '863', '846', '831', '843', '473', '861', '351', '342', '391', '347', '862'];

// =============== CRYPTO PARAMS ===============
let cryptoParams = { h: null, g: null, salt: null };

// =============== DISTANCE CALCULATION ===============

// Формула Haversine для расчета расстояния между двумя точками
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;

  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Округляем до 0.1 км
}

// Определение зоны по расстоянию
function getDistanceZone(distanceKm) {
  if (distanceKm === null) return '';
  if (distanceKm <= 5) return 'Центр';
  if (distanceKm <= 15) return 'Срединная зона';
  if (distanceKm <= 30) return 'Спальный район';
  return 'Окраина';
}

// =============== PHONE NORMALIZATION ===============

function normalizePhone(phone) {
  if (!phone) return '';

  // Убираем все кроме цифр
  let digits = phone.replace(/\D/g, '');

  // Если начинается с 8 и 11 цифр - заменяем на 7
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  }

  // Если 10 цифр - добавляем 7
  if (digits.length === 10) {
    digits = '7' + digits;
  }

  // Возвращаем в формате +7XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith('7')) {
    return '+' + digits;
  }

  return phone; // Возвращаем оригинал если не получилось
}

function isMobilePhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized.startsWith('+7')) return false;

  const digits = normalized.replace(/\D/g, '');
  if (digits.length !== 11) return false;

  // Проверяем что это не городской номер
  const code = digits.slice(1, 4); // Берём 3 цифры после 7

  // Мобильные коды начинаются с 9
  return code.startsWith('9');
}

function formatPhonesNormalized(phones) {
  if (!phones || !Array.isArray(phones) || phones.length === 0) return '';
  return phones.map(normalizePhone).join(', ');
}

function getMobilePhones(phones) {
  if (!phones || !Array.isArray(phones)) return [];
  return phones.filter(isMobilePhone).map(normalizePhone);
}

// =============== SOCIAL LINKS PARSING ===============

function parseSocialLinks(socialLinks) {
  const result = {
    telegram: '',
    telegramUsername: '',
    vk: '',
    whatsapp: '',
    other: []
  };

  if (!socialLinks || !Array.isArray(socialLinks)) return result;

  for (const link of socialLinks) {
    const url = String(link).toLowerCase();

    if (url.includes('t.me/') || url.includes('telegram.')) {
      result.telegram = link;
      // Извлекаем username
      const match = link.match(/t\.me\/([^\/\?]+)/i);
      if (match) {
        result.telegramUsername = '@' + match[1];
      }
    } else if (url.includes('vk.com/') || url.includes('vkontakte.')) {
      result.vk = link;
    } else if (url.includes('wa.me/') || url.includes('whatsapp.') || url.includes('api.whatsapp.')) {
      result.whatsapp = link;
    } else {
      result.other.push(link);
    }
  }

  return result;
}

// =============== NAME PARSING ===============

function parseCompanyName(fullName, rubrics) {
  // fullName может быть "Сияй, Парикмахерская, Сложное окрашивание"
  // или просто "Сияй"
  // rubrics содержит категории из API

  const result = {
    name: '',
    category: '',
    specialization: ''
  };

  if (!fullName) return result;

  // Разбиваем по запятой
  const parts = fullName.split(',').map(p => p.trim());

  if (parts.length >= 1) {
    result.name = parts[0];
  }

  if (parts.length >= 2) {
    result.category = parts[1];
  }

  if (parts.length >= 3) {
    result.specialization = parts.slice(2).join(', ');
  }

  // Если категория пустая, берём из рубрик
  if (!result.category && rubrics) {
    const rubricList = rubrics.split(',').map(r => r.trim());
    if (rubricList.length > 0) {
      result.category = rubricList[0];
    }
    if (rubricList.length > 1 && !result.specialization) {
      result.specialization = rubricList.slice(1).join(', ');
    }
  }

  return result;
}

// =============== HELPER FUNCTIONS ===============

function formatLinks(links) {
  if (!links || !Array.isArray(links) || links.length === 0) return '';
  if (typeof links[0] === 'object' && links[0] !== null && 'href' in links[0]) {
    return links.map(link => link.href).join('\n');
  }
  return links.join('\n');
}

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

function generate2GISMapLink(lat, lon) {
  if (!lat || !lon) return '';
  return `https://2gis.ru/geo/${lon}%2C${lat}`;
}

function generateYandexMapLink(lat, lon, title) {
  if (!lat || !lon) return '';
  const encodedTitle = encodeURIComponent(title || 'Точка');
  return `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map&text=${encodedTitle}`;
}

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

    const mMatch = text.match(/const\s+m\s*=\s*\[([^\]]+)\]/);
    if (mMatch) {
      const m = mMatch[1].split(',').map(n => parseInt(n.trim(), 10));
      if (m.length >= 4) {
        cryptoParams.h = m[0] + m[3];
        cryptoParams.g = m[1] + m[2];
      }
    }

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
  const socialParsed = parseSocialLinks(contacts.social);

  // Extract coordinates
  let lat = null, lon = null;
  if (detailItem.point) {
    lat = detailItem.point.lat;
    lon = detailItem.point.lon;
  }

  // Extract rubrics
  const rubrics = detailItem.rubrics
    ? detailItem.rubrics.map(r => r.name).join(', ')
    : '';

  // Parse company name
  const nameParsed = parseCompanyName(detailItem.name, rubrics);

  return {
    // Parsed name parts
    name: nameParsed.name,
    category: nameParsed.category,
    specialization: nameParsed.specialization,

    // Original full name for compatibility
    fullName: detailItem.name || '',

    address: detailItem.address_name || '',

    // Rating
    rating: detailItem.reviews ? {
      ratingValue: detailItem.reviews.general_rating || '',
      ratingCount: detailItem.reviews.general_review_count_with_stars || 0,
      reviewCount: detailItem.reviews.general_review_count || 0
    } : null,

    // Contacts - raw phones
    contacts: contacts.phones || [],
    // Normalized phones
    phonesNormalized: contacts.phones ? contacts.phones.map(normalizePhone) : [],
    // Only mobile phones
    mobilePhones: getMobilePhones(contacts.phones),

    // URLs
    urls: contacts.website || [],
    emails: contacts.emails || [],

    // Social links parsed
    telegram: socialParsed.telegram,
    telegramUsername: socialParsed.telegramUsername,
    vk: socialParsed.vk,
    whatsapp: socialParsed.whatsapp,
    otherSocial: socialParsed.other,

    // Schedule
    workingTimeText: formatSchedule(detailItem.schedule) || '',

    // Rubrics
    rubrics: rubrics,

    // Coordinates
    latitude: lat,
    longitude: lon,

    // Map links
    link2GIS: generate2GISMapLink(lat, lon),
    linkYandex: generateYandexMapLink(lat, lon, nameParsed.name),

    // Organization
    orgName: detailItem.org?.name || ''
  };
}

// =============== DUPLICATE REMOVAL ===============

// Remove duplicates by phone OR telegram (if same phone OR same telegram - it's duplicate)
function removeDuplicates(items) {
  const seenPhones = new Set();
  const seenTelegrams = new Set();
  const uniqueItems = [];

  for (const item of items) {
    let isDuplicate = false;

    // Check phone duplicates
    const phones = item.phonesNormalized || [];
    for (const phone of phones) {
      if (phone && seenPhones.has(phone)) {
        isDuplicate = true;
        break;
      }
    }

    // Check telegram duplicate (if not already duplicate by phone)
    if (!isDuplicate && item.telegramUsername) {
      const tgUsername = item.telegramUsername.toLowerCase();
      if (seenTelegrams.has(tgUsername)) {
        isDuplicate = true;
      }
    }

    if (!isDuplicate) {
      // Add to seen sets
      for (const phone of phones) {
        if (phone) seenPhones.add(phone);
      }
      if (item.telegramUsername) {
        seenTelegrams.add(item.telegramUsername.toLowerCase());
      }
      uniqueItems.push(item);
    }
  }

  console.log(`[Background] Duplicate removal: ${items.length} -> ${uniqueItems.length} items`);
  return uniqueItems;
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

    // Only mobile phones filter
    if (filters.onlyMobilePhones) {
      if (!item.mobilePhones || item.mobilePhones.length === 0) return false;
    }

    // Email filter
    if (filters.onlyWithEmail) {
      if (!item.emails || item.emails.length === 0) return false;
    }

    // Website filter
    if (filters.onlyWithSite) {
      if (!item.urls || item.urls.length === 0) return false;
    }

    // Telegram filter
    if (filters.onlyWithTelegram) {
      if (!item.telegram) return false;
    }

    return true;
  });
}

// =============== EXPORT FUNCTIONS ===============

function formatItemsForExport(items, useMobileOnly = false, selectedCity = 'Москва') {
  // Получаем координаты центра выбранного города
  const cityCenter = CITY_CENTERS[selectedCity] || CITY_CENTERS['Москва'];

  // Текущая дата для столбца "Дата сбора"
  const collectDate = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return items.map(item => {
    // Выбираем какие телефоны использовать
    const phones = useMobileOnly && item.mobilePhones?.length > 0
      ? item.mobilePhones
      : item.phonesNormalized || [];

    // Рассчитываем расстояние от центра города
    const distance = calculateDistance(
      item.latitude,
      item.longitude,
      cityCenter.lat,
      cityCenter.lon
    );
    const zone = getDistanceZone(distance);

    // Добавляем город к адресу если его нет
    let fullAddress = item.address || '';
    if (fullAddress && !fullAddress.includes(selectedCity)) {
      fullAddress = `${selectedCity}, ${fullAddress}`;
    }

    return {
      'Название': item.name || '',
      'Категория': item.category || '',
      'Специализация': item.specialization || '',
      'Адрес': fullAddress,
      'Телефоны': phones.join(', '),
      'Email': (item.emails || []).join(', '),
      'Сайт': (item.urls || []).join(', '),
      'График работы': item.workingTimeText || '',
      'Telegram': item.telegram || '',
      'Telegram username': item.telegramUsername || '',
      'VK': item.vk || '',
      'WhatsApp': item.whatsapp || '',
      'Открыть в 2ГИС': item.link2GIS || '',
      'Открыть в Яндекс': item.linkYandex || '',
      'Прочие соцсети': (item.otherSocial || []).join(', '),
      'Рейтинг': item.rating?.ratingValue || '',
      'Оценок': item.rating?.ratingCount || '',
      'Отзывов': item.rating?.reviewCount || '',
      'Расст. от центра (км)': distance !== null ? distance : '',
      'Зона': zone,
      'Широта': item.latitude || '',
      'Долгота': item.longitude || '',
      'Дата сбора': collectDate
    };
  });
}

// Calculate zone statistics for a set of formatted items
function calculateZoneStats(formattedItems) {
  const stats = {
    'Центр': 0,
    'Срединная зона': 0,
    'Спальный район': 0,
    'Окраина': 0,
    'Неизвестно': 0
  };

  for (const item of formattedItems) {
    const zone = item['Зона'] || 'Неизвестно';
    if (stats.hasOwnProperty(zone)) {
      stats[zone]++;
    } else {
      stats['Неизвестно']++;
    }
  }

  return stats;
}

// Zone colors matching demo_table.py
const ZONE_COLORS = {
  'Центр': 'E8F4F8',         // Light blue
  'Срединная зона': 'F0F8E8', // Light green
  'Спальный район': 'FFF8E8', // Light orange
  'Окраина': 'FFEBEB'         // Light red
};

// =============== STYLE DEFINITIONS ===============

// Common border style - thin gray borders
const BORDER_STYLE = {
  top: { style: 'thin', color: { rgb: 'B0B0B0' } },
  bottom: { style: 'thin', color: { rgb: 'B0B0B0' } },
  left: { style: 'thin', color: { rgb: 'B0B0B0' } },
  right: { style: 'thin', color: { rgb: 'B0B0B0' } }
};

// Style for statistics row (row 1) - info banner
const STATS_STYLE = {
  font: { bold: true, sz: 11, color: { rgb: '1F4E79' } },
  fill: { fgColor: { rgb: 'DEEAF6' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: {
    bottom: { style: 'medium', color: { rgb: '5B9BD5' } }
  }
};

// Style for header row (row 2) - dark blue professional header
const HEADER_STYLE = {
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '4472C4' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '2F5496' } },
    bottom: { style: 'thin', color: { rgb: '2F5496' } },
    left: { style: 'thin', color: { rgb: '2F5496' } },
    right: { style: 'thin', color: { rgb: '2F5496' } }
  }
};

// Base style for data cells - clean white with borders
const DATA_STYLE_BASE = {
  font: { sz: 10, name: 'Calibri' },
  fill: { fgColor: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: BORDER_STYLE
};

// Alternating row style (light blue tint)
const DATA_STYLE_ALT = {
  font: { sz: 10, name: 'Calibri' },
  fill: { fgColor: { rgb: 'D6DCE5' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: BORDER_STYLE
};

// Style for numeric cells (right aligned)
const DATA_STYLE_NUMBER = {
  font: { sz: 10, name: 'Calibri' },
  fill: { fgColor: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_STYLE
};

// Style for numeric cells (alternating)
const DATA_STYLE_NUMBER_ALT = {
  font: { sz: 10, name: 'Calibri' },
  fill: { fgColor: { rgb: 'D6DCE5' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_STYLE
};

// Zone-specific styles - vibrant but professional colors
const ZONE_STYLES = {
  'Центр': {
    font: { sz: 10, bold: true, color: { rgb: '1F4E79' } },
    fill: { fgColor: { rgb: 'BDD7EE' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER_STYLE
  },
  'Срединная зона': {
    font: { sz: 10, bold: true, color: { rgb: '375623' } },
    fill: { fgColor: { rgb: 'C6EFCE' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER_STYLE
  },
  'Спальный район': {
    font: { sz: 10, bold: true, color: { rgb: '7F6000' } },
    fill: { fgColor: { rgb: 'FFE699' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER_STYLE
  },
  'Окраина': {
    font: { sz: 10, bold: true, color: { rgb: '9C0006' } },
    fill: { fgColor: { rgb: 'FFC7CE' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER_STYLE
  }
};

// Link style (blue, centered for emoji)
const LINK_STYLE = {
  font: { sz: 12, color: { rgb: '0563C1' } },
  fill: { fgColor: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_STYLE
};

// Link style for alternating rows
const LINK_STYLE_ALT = {
  font: { sz: 12, color: { rgb: '0563C1' } },
  fill: { fgColor: { rgb: 'D6DCE5' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_STYLE
};

async function exportToXLSX(items, useMobileOnly = false, selectedCity = 'Москва') {
  const formatted = formatItemsForExport(items, useMobileOnly, selectedCity);

  if (formatted.length === 0) {
    return null;
  }

  // Calculate zone statistics
  const zoneStats = calculateZoneStats(formatted);
  const statsText = `Статистика по зонам: Центр: ${zoneStats['Центр']} | Срединная зона: ${zoneStats['Срединная зона']} | Спальный район: ${zoneStats['Спальный район']} | Окраина: ${zoneStats['Окраина']}`;

  // Get headers
  const headers = Object.keys(formatted[0]);

  // Create worksheet data
  const wsData = [];

  // Row 1: Statistics
  const statsRow = [statsText];
  for (let i = 1; i < headers.length; i++) {
    statsRow.push('');
  }
  wsData.push(statsRow);

  // Row 2: Headers
  wsData.push(headers);

  // Data rows
  for (const item of formatted) {
    const row = headers.map(h => item[h] || '');
    wsData.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Find column indexes
  const colIndexes = {};
  headers.forEach((h, idx) => {
    colIndexes[h] = idx;
  });

  // Numeric columns (right aligned)
  const numericCols = ['Расст. от центра (км)', 'Рейтинг', 'Оценок', 'Отзывов', 'Широта', 'Долгота'];

  // Link columns with emoji icons (clickable)
  const linkColumns = {
    'Открыть в 2ГИС': '🗺️',      // Map icon for 2GIS
    'Открыть в Яндекс': '🔍',     // Search icon for Yandex
    'Telegram': '✈️',             // Paper plane for Telegram
    'VK': '💙',                   // Blue heart for VK
    'WhatsApp': '💬',             // Speech bubble for WhatsApp
    'Сайт': '🌐'                  // Globe for website
  };

  const zoneColIdx = colIndexes['Зона'];

  // Apply styles to all cells
  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });

      if (!ws[cellAddress]) {
        ws[cellAddress] = { t: 's', v: '' };
      }

      // Row 0: Statistics row
      if (R === 0) {
        ws[cellAddress].s = STATS_STYLE;
      }
      // Row 1: Header row
      else if (R === 1) {
        ws[cellAddress].s = HEADER_STYLE;
      }
      // Data rows (with alternating colors)
      else {
        const colName = headers[C];
        const cellValue = ws[cellAddress].v;
        const isAltRow = (R % 2 === 0); // Alternating rows (0-indexed, so even rows after header)

        // Check if it's zone column - apply zone color (always stands out)
        if (C === zoneColIdx && cellValue && ZONE_STYLES[cellValue]) {
          ws[cellAddress].s = ZONE_STYLES[cellValue];
        }
        // Check if it's a link column with URL
        else if (linkColumns.hasOwnProperty(colName) && cellValue && typeof cellValue === 'string' && cellValue.startsWith('http')) {
          const url = cellValue;
          const displayText = linkColumns[colName] || url;
          ws[cellAddress] = {
            t: 's',
            v: displayText,
            l: { Target: url },
            s: isAltRow ? LINK_STYLE_ALT : LINK_STYLE
          };
        }
        // Numeric columns (centered)
        else if (numericCols.includes(colName)) {
          ws[cellAddress].s = isAltRow ? DATA_STYLE_NUMBER_ALT : DATA_STYLE_NUMBER;
        }
        // Default data style
        else {
          ws[cellAddress].s = isAltRow ? DATA_STYLE_ALT : DATA_STYLE_BASE;
        }
      }
    }
  }

  // Merge cells for statistics row
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }
  ];

  // Add autofilter to header row (row 1) - enables sorting by any column
  // When user sorts, entire row moves together (not just one column)
  const lastCol = XLSX.utils.encode_col(headers.length - 1);
  const lastRow = formatted.length + 2; // +1 for stats row, +1 for header row
  ws['!autofilter'] = { ref: `A2:${lastCol}${lastRow}` };

  // Set column widths (matching new column order)
  ws['!cols'] = [
    { wch: 28 },  // Название
    { wch: 18 },  // Категория
    { wch: 22 },  // Специализация
    { wch: 35 },  // Адрес
    { wch: 16 },  // Телефоны
    { wch: 22 },  // Email
    { wch: 8 },   // Сайт (emoji)
    { wch: 18 },  // График работы
    { wch: 8 },   // Telegram (emoji)
    { wch: 18 },  // Telegram username
    { wch: 8 },   // VK (emoji)
    { wch: 8 },   // WhatsApp (emoji)
    { wch: 6 },   // Открыть в 2ГИС (emoji)
    { wch: 6 },   // Открыть в Яндекс (emoji)
    { wch: 18 },  // Прочие соцсети
    { wch: 8 },   // Рейтинг
    { wch: 8 },   // Оценок
    { wch: 8 },   // Отзывов
    { wch: 10 },  // Расст. от центра (км)
    { wch: 14 },  // Зона
    { wch: 11 },  // Широта
    { wch: 11 },  // Долгота
    { wch: 11 }   // Дата сбора
  ];

  // Set row heights
  ws['!rows'] = [
    { hpt: 20 },  // Stats row
    { hpt: 30 }   // Header row (taller for wrapped text)
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

// Split items into chunks of packSize
function splitIntoChunks(items, packSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += packSize) {
    chunks.push(items.slice(i, i + packSize));
  }
  return chunks;
}

// Generate filename with category, city, packet number, and date
function generateFilename(category, city, packetNum, totalPackets, date) {
  // Clean up category and city for filename
  const cleanCategory = (category || 'export').replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '').trim() || 'export';
  const cleanCity = (city || 'city').replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '').trim() || 'city';

  // Format: Category_City_PacketN_Date.xlsx or Category_City_Date.xlsx (if single file)
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

  if (totalPackets > 1) {
    return `${cleanCategory}_${cleanCity}_Пакет${packetNum}_${dateStr}.xlsx`;
  } else {
    return `${cleanCategory}_${cleanCity}_${dateStr}.xlsx`;
  }
}

function exportToCSV(items, useMobileOnly = false) {
  const formatted = formatItemsForExport(items, useMobileOnly);

  if (formatted.length === 0) return '';

  const headers = Object.keys(formatted[0]);
  const csvRows = [headers.join(';')];

  for (const row of formatted) {
    const values = headers.map(header => {
      const val = row[header] || '';
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

      await loadCryptoParams();

      const items = await fetchWithRetry(details.url);

      if (!items?.result?.items?.length) {
        console.log('[Background] No items in response');
        return;
      }

      console.log(`[Background] Found ${items.result.items.length} items`);

      for (const item of items.result.items) {
        const key = item.id?.split('_')[0] || `${item.name}|${item.address_name}`;

        if (uniqueItemKeys.has(key)) continue;

        uniqueItemKeys.add(key);

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
          console.log('[Background] Added:', extracted.name);
        } else {
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
  return true;
});

async function handleMessage(message, sendResponse) {
  const storage = await loadFromStorage();
  let { capturedUrls, uniqueItems, uniqueItemKeys } = storage;

  switch (message.action) {
    case 'download': {
      // Apply filters first
      let filtered = applyFilters(uniqueItems, message.filters);

      if (filtered.length === 0) {
        sendResponse({ status: 'empty', message: 'Нет данных для экспорта' });
        return;
      }

      // Remove duplicates by phone OR telegram
      filtered = removeDuplicates(filtered);

      if (filtered.length === 0) {
        sendResponse({ status: 'empty', message: 'После удаления дубликатов нет данных' });
        return;
      }

      try {
        const format = message.format || 'xlsx';
        const useMobileOnly = message.filters?.onlyMobilePhones || false;
        const selectedCity = message.city || 'Москва';
        const category = message.category || '';
        const packSize = message.packSize || 1000;
        const exportDate = new Date();

        // Handle XLSX with file splitting
        if (format === 'xlsx') {
          // Split into chunks based on packSize
          const chunks = splitIntoChunks(filtered, packSize);
          const totalChunks = chunks.length;

          console.log(`[Background] Exporting ${filtered.length} items in ${totalChunks} file(s)`);

          let downloadedCount = 0;
          let lastError = null;

          // Download each chunk
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const dataUrl = await exportToXLSX(chunk, useMobileOnly, selectedCity);

            if (!dataUrl) {
              lastError = 'Ошибка создания файла';
              continue;
            }

            const filename = generateFilename(category, selectedCity, i + 1, totalChunks, exportDate);

            await new Promise((resolve) => {
              chrome.downloads.download({
                url: dataUrl,
                filename: filename,
                saveAs: totalChunks === 1 // Only show save dialog for single file
              }, (downloadId) => {
                if (!chrome.runtime.lastError) {
                  downloadedCount++;
                } else {
                  lastError = chrome.runtime.lastError.message;
                }
                resolve();
              });
            });

            // Small delay between downloads to avoid issues
            if (i < chunks.length - 1) {
              await new Promise(r => setTimeout(r, 500));
            }
          }

          if (downloadedCount > 0) {
            const filesText = totalChunks > 1 ? ` в ${downloadedCount} файл(ов)` : '';
            sendResponse({
              status: 'ok',
              count: filtered.length,
              files: downloadedCount,
              message: `Экспортировано ${filtered.length} компаний${filesText}`
            });
          } else {
            sendResponse({ status: 'error', message: lastError || 'Ошибка экспорта' });
          }
          return;
        }

        // CSV and JSON (no splitting)
        let dataUrl, filename;

        switch (format) {
          case 'csv':
            const csvContent = exportToCSV(filtered, useMobileOnly);
            const csvBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
            dataUrl = await new Promise(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(csvBlob);
            });
            filename = generateFilename(category, selectedCity, 1, 1, exportDate).replace('.xlsx', '.csv');
            break;

          case 'json':
            const jsonContent = exportToJSON(filtered);
            const jsonBlob = new Blob([jsonContent], { type: 'application/json' });
            dataUrl = await new Promise(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(jsonBlob);
            });
            filename = generateFilename(category, selectedCity, 1, 1, exportDate).replace('.xlsx', '.json');
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
        console.error('[Background] Export error:', error);
        sendResponse({ status: 'error', message: error.message });
      }
      break;
    }

    case 'getStats': {
      const withPhones = uniqueItems.filter(i => i.contacts && i.contacts.length > 0).length;
      const withMobilePhones = uniqueItems.filter(i => i.mobilePhones && i.mobilePhones.length > 0).length;
      const withEmails = uniqueItems.filter(i => i.emails && i.emails.length > 0).length;
      const withSites = uniqueItems.filter(i => i.urls && i.urls.length > 0).length;
      const withTelegram = uniqueItems.filter(i => i.telegram).length;
      const withVK = uniqueItems.filter(i => i.vk).length;
      const withWhatsApp = uniqueItems.filter(i => i.whatsapp).length;

      sendResponse({
        status: 'ok',
        stats: {
          total: uniqueItems.length,
          withPhones,
          withMobilePhones,
          withEmails,
          withSites,
          withTelegram,
          withVK,
          withWhatsApp
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
