
window.onload = function() {
};

function createUrlByParams(apiUrl,params,salt,g,h) {
    const hashString = `/3.0/items${params.allow_deleted}${params.fields}${params.key}${params.locale}${params.page}${params.page_size}${params.q}${params.search_device_type}${params.search_user_hash}${params.shv}${params['stat[sid]']}${params['stat[user]']}${params.type}${params.viewpoint1}${params.viewpoint2}${salt}`;
    let r = g;
    for (let i = 0; i < hashString.length; i++) {
        r = r * h + hashString.charCodeAt(i);
        r >>>= 0;
    }
    params.r = r;
    const link = new URL("/3.0/items", apiUrl);
    link.search = new URLSearchParams(params).toString();

    return link.toString();
}

(function() {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        try {
            if (url.includes("/3.0/markers/clustered")) {
                const u = new URL(url);

                // Меняем endpoint
                u.pathname = u.pathname.replace('/markers/clustered', '/items');

                // Поля для /items
                const itemsFields = "items.locale,items.flags,items.search_attributes.detection_type,search_attributes,items.search_attributes.best_keyword,items.search_attributes.relevance,items.adm_div,items.city_alias,items.region_id,items.segment_id,items.reviews,items.point,request_type,context_rubrics,query_context,items.links,items.name_ex,items.name_back,items.org,items.group,items.external_content,items.comment,items.ads.options,items.email_for_sending.allowed,items.stat,items.description,items.geometry.centroid,items.geometry.selection,items.geometry.style,items.timezone_offset,items.context,items.address,items.is_paid,items.access,items.access_comment,items.for_trucks,items.is_incentive,items.paving_type,items.capacity,items.schedule,items.schedule_special,items.floors,items.floor_id,items.floor_plans,dym,ad,items.rubrics,items.routes,items.reply_rate,items.purpose,items.purpose_code,items.attribute_groups,items.route_logo,items.has_goods,items.has_apartments_info,items.has_pinned_goods,items.has_realty,items.has_payments,items.is_promoted,items.delivery,items.order_with_cart,search_type,items.has_discount,items.metarubrics,items.detailed_subtype,items.temporary_unavailable_atm_services,items.poi_category,items.has_ads_model,items.vacancies,items.search_attributes.external_source,items.summary";

                // Удаляем параметры, которые не нужны в /items
                const removeParams = [
                    "map_width",
                    "map_height",
                    "is_viewport_change",
                    "fields" // будет заменён
                ];

                removeParams.forEach(p => u.searchParams.delete(p));

                // Добавляем обязательные параметры items
                u.searchParams.set("fields", itemsFields);
                u.searchParams.set("page_size", "12");
                u.searchParams.set("page", "1");
                console.log("[Content] Контент-скрипт перехватил XHR:", Object.fromEntries(u.searchParams));
                const script = document.querySelector(
                    'script[src^="https://d-assets.2gis.ru/app."]'
                );
                if (script) {
                    const url = script.src;
                    let h, g, salt;
                    console.log("[Content] Найденный скрипт:", url);

                    // Загружаем через fetch
                    fetch(url)
                        .then(r => {
                            if (!r.ok) {
                                throw new Error(`Ошибка загрузки скрипта: ${r.status}`);
                            }
                            return r.text();
                        })
                        .then(code => {
                            const mMatch = code.match(/const\s+m\s*=\s*\[([^\]]+)\]/);
                            if (mMatch) {
                                const m = mMatch[1].split(',').map(n => parseInt(n.trim(), 10));
                                if (m.length >= 4) {
                                    h = m[0] + m[3];
                                    g = m[1] + m[2];
                                    console.log("[Content] Найден массив m:", m, "h:", h, "g:", g);
                                }
                            }

                            // --- Парсим класс Yw и this.a (динамически) ---
                            const classRegex = /class\s+\w+\s*{[\s\S]*?constructor\s*\(([^)]*)\)\s*{([\s\S]*?)this\.KEY\s*=\s*t\.webApiKey\s*,\s*this\.a\s*=\s*["'`]([^"'`]+)["'`]/;
                            const classMatch = code.match(classRegex);

                            if (classMatch) {
                                salt = classMatch[3];
                                console.log("[Content] Значение this.a:", salt);
                                const link = createUrlByParams(u.origin, Object.fromEntries(u.searchParams), salt, g, h);
                                fetch(link)
                                    .then(response => {
                                        if (response.ok) {
                                        } else {
                                            sendLog('error_load_content',`Ошибка при запросе данных: ${response.status}`);
                                            throw new Error(`[Content] Ошибка при запросе данных: ${response.status}`);
                                        }
                                    })
                                    .catch(err => {
                                        console.error('[Content] Ошибка запроса:', err);
                                        sendLog('error_load_content',`Ошибка запроса: ${err.message}`);
                                    });
                            } else {
                                console.log("[Content] Salt не найден");
                                sendLog('error_load_content','Salt не найден');
                            }
                        })
                        .catch(err => {
                            console.error('[Content] Ошибка загрузки или парсинга скрипта:', err);
                            sendLog('error_load_content',`Ошибка загрузки или парсинга скрипта: ${err.message}`);
                        });
                } else {
                    console.log("[Content] Скрипт не найден");
                    sendLog('error_load_content','Скрипт не найден');
                }
            }
        } catch (error) {
            console.error('[Content] Ошибка в перехвате XMLHttpRequest:', error);
            sendLog('error_load_content',`Ошибка в перехвате XMLHttpRequest: ${error.message}`);
        } finally {
            // В любом случае вызываем оригинальный open
            return origOpen.call(this, method, url, ...rest);
        }
    };
})();
function sendLog(eventName, eventPayload) {
    window.dispatchEvent(new CustomEvent('FROM_MAIN_WORLD', {detail:{ action: "sendLog", eventName: eventName, eventPayload:`[scraper] ${eventPayload}` }}));
}
sendLog('load_scraper','Контент-скрипт загружен и готов к работе.');

