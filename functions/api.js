export async function onRequestPost(context) {
    // 'context' parametresi, Cloudflare Pages fonksiyonunun çalışma ortamını,
    // gelen isteği (request) ve çevre değişkenlerini/veritabanı bağlantılarını (env) içerir.
    const { request, env } = context;

    try {
        // 1. Kullanıcının IP adresini alıyoruz.
        const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

        // 2. Cloudflare'in sunduğu request.cf nesnesinden coğrafi bilgileri alıyoruz.
        // Yerel ortamda bu bilgi eksik veya kısıtlı olabileceği için varsayılan değerler tanımlıyoruz.
        const cf = request.cf || {};
        const city = cf.city || "Istanbul";
        const country = cf.country || "Turkey";
        const lat = cf.latitude ? parseFloat(cf.latitude) : 41.0082;
        const lon = cf.longitude ? parseFloat(cf.longitude) : 28.9784;
        const cityName = city;

        // 3. wrangler.jsonc dosyasındaki "weatherApp_db" veya paneldeki varsayılan "DB" bağlantısını alıyoruz.
        const db = env.weatherApp_db || env.DB;

        // 4. Veritabanı bağlayıcısının mevcut olup olmadığını kontrol ediyoruz.
        if (!db) {
            return new Response(
                JSON.stringify({ error: "Veritabanı bağlantısı bulunamadı (weatherApp_db veya DB)." }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // 5. SQL enjeksiyonuna (SQL Injection) karşı güvenli prepared statement oluşturuyoruz.
        const stmt = db.prepare(
            `INSERT INTO visits (city_name, ip, city, country, lat, lon) 
             VALUES (?, ?, ?, ?, ?, ?)`
        );

        // 6. Değerleri prepared statement'a bağlıyoruz ve sorguyu çalıştırıyoruz.
        const result = await stmt.bind(
            cityName,
            ip,
            city,
            country,
            lat,
            lon
        ).run();

        // 7. İşlem başarılı ise istemciye başarılı yanıtını ve D1 işlem sonucunu JSON olarak dönüyoruz.
        return new Response(
            JSON.stringify({
                success: true,
                message: "Ziyaret verisi başarıyla kaydedildi.",
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
        // 8. İstek işlenirken veya SQL sorgusu çalıştırılırken bir hata oluşursa yakalayıp 500 koduyla dönüyoruz.
        console.error("API Hatası (Döküm):", error);
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
