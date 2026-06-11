/**
 * Shared API handlers for the Cloudflare Worker.
 *
 * Routes:
 *  GET  /api/weather — IP-based geolocation + Cloudflare Cache + Open-Meteo + D1 logging.
 *  POST /api         — Legacy standalone visit log endpoint (backwards compatibility).
 *  GET  /api         — Password-protected stats dashboard data.
 */

// ── Private Helpers ────────────────────────────────────────────────────────────

/**
 * Builds and runs a D1 INSERT for visit logging.
 * Fire-and-forget; errors are caught and logged, never thrown.
 */
async function _logVisit(db, { locationName, ip, city, country, lat, lon }) {
    try {
        await db
            .prepare(`INSERT INTO visits (city_name, ip, city, country, lat, lon) VALUES (?, ?, ?, ?, ?, ?)`)
            .bind(locationName, ip, city, country, lat, lon)
            .run();
    } catch (dbErr) {
        console.error('D1 visit log failed:', dbErr);
    }
}

/**
 * Extracts geo metadata from a Cloudflare request, with Istanbul fallbacks
 * for local development where request.cf is unavailable.
 */
function _extractGeo(request) {
    const cf      = request.cf || {};
    const ip      = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
    const city    = cf.city    || 'Istanbul';
    const country = cf.country || 'TR';
    const lat     = cf.latitude  ? parseFloat(cf.latitude)  : 41.0082;
    const lon     = cf.longitude ? parseFloat(cf.longitude) : 28.9784;
    return { ip, city, country, lat, lon };
}

// ── Route Handlers ─────────────────────────────────────────────────────────────

/**
 * GET /api/weather
 *
 *  1. Reads visitor location from Cloudflare's request.cf geo metadata (no browser prompt).
 *  2. Builds a cache key from rounded coordinates and checks caches.default (Cloudflare Cache API).
 *  3. On cache HIT  → returns cached weather data immediately (no external API call).
 *  4. On cache MISS → fetches Open-Meteo + BigDataCloud, writes result to cache with 15min TTL.
 *  5. Always logs the visit to the D1 database via ctx.waitUntil (fire-and-forget).
 */
export async function onRequestGetWeather(context) {
    const { request, env } = context;

    // Check if coordinates are passed in the URL query string
    const url = new URL(request.url);
    const queryLat = url.searchParams.get('lat');
    const queryLon = url.searchParams.get('lon');

    let ip, city, country, lat, lon;
    const geo = _extractGeo(request);
    ip = geo.ip;
    city = geo.city;
    country = geo.country;

    if (queryLat && queryLon) {
        lat = parseFloat(queryLat);
        lon = parseFloat(queryLon);
    } else {
        lat = geo.lat;
        lon = geo.lon;
    }

    // ── Build cache key — round to 1 decimal place (~11km grid) ────────────────
    // Nearby users in the same city share the same cache bucket, cutting Open-Meteo
    // traffic significantly without sacrificing meaningful location accuracy.
    const latR         = Math.round(lat * 10) / 10;
    const lonR         = Math.round(lon * 10) / 10;
    const cacheKeyUrl  = `https://weather-cache.internal/v1?lat=${latR}&lon=${lonR}`;
    const cacheRequest = new Request(cacheKeyUrl);
    const cache        = caches.default;

    // ── Check Cloudflare Cache ────────────────────────────────────────────────
    let weatherData = null;
    try {
        const cachedResponse = await cache.match(cacheRequest);
        if (cachedResponse) {
            const data = await cachedResponse.json();
            if (data && Array.isArray(data.forecast)) {
                weatherData = data;
            } else {
                console.warn('Cache hit contains old schema format (missing forecast array). Forcing cache miss.');
            }
        }
    } catch (cacheErr) {
        // Cache API unavailable in some local dev setups — proceed to live fetch.
        console.warn('Cache read failed, proceeding with fresh fetch:', cacheErr);
    }

    // ── Cache MISS: fetch live data ───────────────────────────────────────────
    if (!weatherData) {
        const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=uv_index_max&timezone=auto&forecast_days=8`;

        let meteoData;
        try {
            const meteoResponse = await fetch(meteoUrl);
            if (!meteoResponse.ok) throw new Error(`Open-Meteo returned HTTP ${meteoResponse.status}`);
            meteoData = await meteoResponse.json();
        } catch (fetchErr) {
            console.error('Open-Meteo fetch failed:', fetchErr);
            return new Response(
                JSON.stringify({ success: false, error: 'Weather API unavailable. Please try again later.' }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Reverse-geocode to get a human-readable city name.
        // Falls back to the Cloudflare-provided city name on any failure.
        let locationName = city;
        try {
            const geoUrl      = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
            const geoResponse = await fetch(geoUrl);
            if (geoResponse.ok) {
                const geoData = await geoResponse.json();
                locationName  = geoData.city || geoData.locality || geoData.principalSubdivision || city;
            }
        } catch (geoErr) {
            console.warn('Reverse geocoding failed, using Cloudflare city name:', geoErr);
        }

        const currentHour = new Date().getHours();
        const forecast = [];

        for (let idx = 0; idx < 8; idx++) {
            const dateStr = meteoData.daily.time[idx];
            const isToday = idx === 0;

            const uvIndex = meteoData.daily.uv_index_max?.[idx] ?? 0;

            // Generate 24 hourly objects for this day
            const hourly = [];
            for (let h = 0; h < 24; h++) {
                const hourlyIdx = idx * 24 + h;
                const timeRaw = meteoData.hourly.time[hourlyIdx];
                const timeStr = timeRaw ? timeRaw.split('T')[1] : `${String(h).padStart(2, '0')}:00`;

                hourly.push({
                    time: timeStr,
                    temp: meteoData.hourly.temperature_2m[hourlyIdx],
                    humidity: meteoData.hourly.relative_humidity_2m?.[hourlyIdx] ?? 50,
                    windSpeed: meteoData.hourly.wind_speed_10m?.[hourlyIdx] ?? 10,
                    weatherCode: meteoData.hourly.weather_code[hourlyIdx] ?? 0,
                });
            }

            // Calculate current-like values for this day:
            const temp = isToday ? meteoData.current.temperature_2m : (meteoData.hourly.temperature_2m[idx * 24 + currentHour] ?? 15);
            const humidity = isToday ? meteoData.current.relative_humidity_2m : (meteoData.hourly.relative_humidity_2m?.[idx * 24 + currentHour] ?? 50);
            const windSpeed = isToday ? meteoData.current.wind_speed_10m : (meteoData.hourly.wind_speed_10m?.[idx * 24 + currentHour] ?? 10);
            const weatherCode = isToday ? meteoData.current.weather_code : (meteoData.hourly.weather_code[idx * 24 + currentHour] ?? 0);

            forecast.push({
                date: dateStr,
                temp,
                humidity,
                windSpeed,
                uvIndex,
                weatherCode,
                hourly,
            });
        }

        weatherData = {
            locationName,
            lat,
            lon,
            forecast,
        };

        // Write to cache with a 4-hour TTL (non-blocking).
        try {
            const cacheableResponse = new Response(JSON.stringify(weatherData), {
                headers: {
                    'Content-Type':  'application/json',
                    'Cache-Control': 'public, max-age=14400',
                },
            });
            context.waitUntil(cache.put(cacheRequest, cacheableResponse));
        } catch (cachePutErr) {
            console.warn('Cache write failed:', cachePutErr);
        }
    }

    // ── Log visit to D1 (non-blocking) ───────────────────────────────────────
    const db = env.weatherApp_db || env.DB;
    if (db) {
        context.waitUntil(_logVisit(db, { locationName: weatherData.locationName, ip, city, country, lat, lon }));
    }

    return new Response(
        JSON.stringify({ success: true, weather: weatherData }),
        { headers: { 'Content-Type': 'application/json' } }
    );
}

/**
 * POST /api
 * Legacy standalone visit log endpoint (kept for backwards compatibility).
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    const db = env.weatherApp_db || env.DB;
    if (!db) {
        return new Response(
            JSON.stringify({ error: 'Database connection not found (weatherApp_db or DB).' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const { ip, city, country, lat, lon } = _extractGeo(request);
        await _logVisit(db, { locationName: city, ip, city, country, lat, lon });

        return new Response(
            JSON.stringify({ success: true, message: 'Visit logged successfully.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('API Error (details):', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

/** Helper to parse a cookie by name from the request headers */
function _getCookie(request, name) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (let cookie of cookies) {
        const parts = cookie.trim().split('=');
        const k = parts[0];
        const v = parts.slice(1).join('=');
        if (k === name) return decodeURIComponent(v || '');
    }
    return null;
}

/**
 * POST /api/login
 * Validates password and sets an HTTP-only session cookie.
 */
export async function onRequestLogin(context) {
    const { request, env } = context;
    try {
        const { password } = await request.json();
        const expectedPassword = env.STATS_PASSWORD || 'admin123';

        if (password === expectedPassword) {
            const url = new URL(request.url);
            const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
            const secureFlag = isLocalhost ? '' : 'Secure;';

            const headers = new Headers({
                'Content-Type': 'application/json',
                'Set-Cookie': `stats_session=${encodeURIComponent(password)}; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=14400`,
            });
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        } else {
            return new Response(
                JSON.stringify({ success: false, error: 'Unauthorized access (invalid password)' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }
    } catch (err) {
        return new Response(
            JSON.stringify({ success: false, error: 'Malformed request body' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * POST /api/logout
 * Clears the HTTP-only session cookie.
 */
export async function onRequestLogout(context) {
    const { request } = context;
    const url = new URL(request.url);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const secureFlag = isLocalhost ? '' : 'Secure;';

    const headers = new Headers({
        'Content-Type': 'application/json',
        'Set-Cookie': `stats_session=; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=0`,
    });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}

/**
 * GET /api
 * Password-protected stats dashboard data.
 */
export async function onRequestGet(context) {
    const { request, env } = context;

    const expectedPassword = env.STATS_PASSWORD || 'admin123';

    // 1. Check Cookie first (primary auth method)
    let password = _getCookie(request, 'stats_session');

    // 2. Fallback to Authorization Header (backward compatibility / testing)
    if (!password) {
        const authHeader = request.headers.get('Authorization');
        password = authHeader ? authHeader.replace('Bearer ', '') : '';
    }

    if (password !== expectedPassword) {
        return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized access (invalid password)' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const db = env.weatherApp_db || env.DB;
    if (!db) {
        return new Response(
            JSON.stringify({ error: 'Database connection not found (weatherApp_db or DB).' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        // Daily visitor count for the last 7 days (line chart).
        const chartDataQuery = await db.prepare(
            `SELECT date(created_at) as date, COUNT(*) as count 
             FROM visits 
             WHERE created_at >= datetime('now', '-7 days')
             GROUP BY date(created_at)
             ORDER BY date(created_at) ASC`
        ).all();

        // Distinct visit coordinates and total visits per location (map pins).
        const pinsQuery = await db.prepare(
            `SELECT city, country, lat, lon, COUNT(*) as visits 
             FROM visits 
             WHERE lat IS NOT NULL AND lon IS NOT NULL
             GROUP BY city, country, lat, lon
             ORDER BY visits DESC`
        ).all();

        // Details of the last 100 visits (table).
        const tableQuery = await db.prepare(
            `SELECT id, city_name, ip, city, country, lat, lon, created_at 
             FROM visits 
             ORDER BY created_at DESC 
             LIMIT 100`
        ).all();

        return new Response(
            JSON.stringify({
                success:   true,
                chartData: chartDataQuery.results || [],
                pins:      pinsQuery.results || [],
                visits:    tableQuery.results || [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('GET API Error (details):', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
