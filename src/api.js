/**
 * GET /api/weather
 *
 * Server-side weather endpoint:
 *  1. Reads visitor location from Cloudflare's request.cf geo metadata (no browser prompt).
 *  2. Builds a cache key from rounded coordinates and checks caches.default (Cloudflare Cache API).
 *  3. On cache HIT  → returns cached weather data immediately (no external API call).
 *  4. On cache MISS → fetches Open-Meteo + BigDataCloud, writes result to cache with 15min TTL.
 *  5. Always logs the visit to the D1 database via ctx.waitUntil (fire-and-forget).
 */
export async function onRequestGetWeather(context) {
    const { request, env } = context;

    // ── 1. Extract location from Cloudflare's automatic geo metadata ─────────────
    const cf = request.cf || {};
    const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
    const city    = cf.city    || 'Istanbul';
    const country = cf.country || 'TR';
    const lat = cf.latitude  ? parseFloat(cf.latitude)  : 41.0082;
    const lon = cf.longitude ? parseFloat(cf.longitude) : 28.9784;

    // ── 2. Build cache key — round to 1 decimal place (~11km grid) ────────────────
    // Nearby users in the same city share the same cache bucket, cutting Open-Meteo
    // traffic significantly without sacrificing meaningful location accuracy.
    const latR = Math.round(lat * 10) / 10;
    const lonR = Math.round(lon * 10) / 10;
    const cacheKeyUrl  = `https://weather-cache.internal/v1?lat=${latR}&lon=${lonR}`;
    const cacheRequest = new Request(cacheKeyUrl);
    const cache        = caches.default;

    // ── 3. Check Cloudflare Cache ─────────────────────────────────────────────────
    let weatherData = null;
    try {
        const cachedResponse = await cache.match(cacheRequest);
        if (cachedResponse) {
            weatherData = await cachedResponse.json();
        }
    } catch (cacheErr) {
        // Cache API unavailable in some local dev setups — proceed to live fetch.
        console.warn('Cache read failed, proceeding with fresh fetch:', cacheErr);
    }

    // ── 4. Cache MISS: fetch live data ────────────────────────────────────────────
    if (!weatherData) {
        const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=uv_index_max&timezone=auto`;

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
            const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
            const geoResponse = await fetch(geoUrl);
            if (geoResponse.ok) {
                const geoData = await geoResponse.json();
                locationName = geoData.city || geoData.locality || geoData.principalSubdivision || city;
            }
        } catch (geoErr) {
            console.warn('Reverse geocoding failed, using Cloudflare city name:', geoErr);
        }

        weatherData = {
            temp:         meteoData.current.temperature_2m,
            humidity:     meteoData.current.relative_humidity_2m,
            windSpeed:    meteoData.current.wind_speed_10m,
            uvIndex:      meteoData.daily.uv_index_max[0],
            weatherCode:  meteoData.current.weather_code,
            locationName,
        };

        // ── 5. Write to cache with a 15-minute TTL ────────────────────────────────
        try {
            const cacheableResponse = new Response(JSON.stringify(weatherData), {
                headers: {
                    'Content-Type':  'application/json',
                    'Cache-Control': 'public, max-age=900',
                },
            });
            // waitUntil: don't block the response on the cache write.
            context.waitUntil(cache.put(cacheRequest, cacheableResponse));
        } catch (cachePutErr) {
            console.warn('Cache write failed:', cachePutErr);
        }
    }

    // ── 6. Log this visit to D1 regardless of cache hit/miss ─────────────────────
    // Uses waitUntil so the D1 write doesn't delay the HTTP response.
    const db = env.weatherApp_db || env.DB;
    if (db) {
        context.waitUntil(
            db.prepare(
                `INSERT INTO visits (city_name, ip, city, country, lat, lon) VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(weatherData.locationName, ip, city, country, lat, lon)
            .run()
            .catch((dbErr) => console.error('D1 visit log failed:', dbErr))
        );
    }

    // ── 7. Return weather payload to the client ───────────────────────────────────
    return new Response(
        JSON.stringify({
            success: true,
            weather: weatherData,
        }),
        {
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

export async function onRequestPost(context) {
    // 'context' parameter contains Cloudflare environment, request metadata, and bindings.
    const { request, env } = context;

    try {
        // 1. Retrieve the client IP address.
        const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

        // 2. Extract geo metadata from request.cf (fallback to defaults for local development).
        const cf = request.cf || {};
        const city = cf.city || "Istanbul";
        const country = cf.country || "Turkey";
        const lat = cf.latitude ? parseFloat(cf.latitude) : 41.0082;
        const lon = cf.longitude ? parseFloat(cf.longitude) : 28.9784;
        const cityName = city;

        // 3. Retrieve the D1 database binding from wrangler.jsonc or fall back to default "DB".
        const db = env.weatherApp_db || env.DB;

        // 4. Ensure D1 database instance is connected.
        if (!db) {
            return new Response(
                JSON.stringify({ error: "Database connection not found (weatherApp_db or DB)." }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // 5. Create a prepared statement to prevent SQL injection.
        const stmt = db.prepare(
            `INSERT INTO visits (city_name, ip, city, country, lat, lon) 
             VALUES (?, ?, ?, ?, ?, ?)`
        );

        // 6. Bind parameters and run the insert statement.
        const result = await stmt.bind(
            cityName,
            ip,
            city,
            country,
            lat,
            lon
        ).run();

        // 7. Return success status and D1 database response as JSON.
        return new Response(
            JSON.stringify({
                success: true,
                message: "Visit logged successfully.",
                result: result
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {
        // 8. Catch and log any API execution error.
        console.error("API Error (details):", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
}

export async function onRequestGet(context) {
    const { request, env } = context;

    try {
        // 1. Authentication Check (requires Authorization: Bearer <password> header).
        const authHeader = request.headers.get("Authorization");
        const password = authHeader ? authHeader.replace("Bearer ", "") : "";
        const expectedPassword = env.STATS_PASSWORD || "admin123";

        if (password !== expectedPassword) {
            return new Response(
                JSON.stringify({ success: false, error: "Unauthorized access (invalid password)" }),
                { 
                    status: 401, 
                    headers: { "Content-Type": "application/json" } 
                }
            );
        }

        // 2. Ensure D1 database instance is connected.
        const db = env.weatherApp_db || env.DB;
        if (!db) {
            return new Response(
                JSON.stringify({ error: "Database connection not found (weatherApp_db or DB)." }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // 3. Line Chart Data: Daily visitor count for the last 7 days.
        const chartDataQuery = await db.prepare(
            `SELECT date(created_at) as date, COUNT(*) as count 
             FROM visits 
             WHERE created_at >= datetime('now', '-7 days')
             GROUP BY date(created_at)
             ORDER BY date(created_at) ASC`
        ).all();

        // 4. Map Pin Data: Distinct visit coordinates and total visits per location.
        const pinsQuery = await db.prepare(
            `SELECT city, country, lat, lon, COUNT(*) as visits 
             FROM visits 
             WHERE lat IS NOT NULL AND lon IS NOT NULL
             GROUP BY city, country, lat, lon
             ORDER BY visits DESC`
        ).all();

        // 5. Table Data: Details of the last 100 visits.
        const tableQuery = await db.prepare(
            `SELECT id, city_name, ip, city, country, lat, lon, created_at 
             FROM visits 
             ORDER BY created_at DESC 
             LIMIT 100`
        ).all();

        // 6. Merge results and return as JSON.
        return new Response(
            JSON.stringify({
                success: true,
                chartData: chartDataQuery.results || [],
                pins: pinsQuery.results || [],
                visits: tableQuery.results || []
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {
        console.error("GET API Error (details):", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
}
