export async function onRequestPost(context) {
    // 'context' parametresi, Cloudflare Pages fonksiyonunun çalışma ortamını,
    // gelen isteği (request) ve çevre değişkenlerini/veritabanı bağlantılarını (env) içerir.
    const { request, env } = context;

    try {
        // 1. İstemciden (Frontend) gönderilen JSON gövdesini (body) okuyup parse ediyoruz.
        const data = await request.json();

        // 2. İstemciden gelen verileri değişkenlere atıyoruz.
        const { city_name, city, country, lat, lon } = data;

        // 3. Kullanıcının IP adresini alıyoruz.
        // Cloudflare, bağlanan cihazın IP adresini otomatik olarak "CF-Connecting-IP" başlığına ekler.
        // Eğer yerel geliştirme ortamındaysak ve bu başlık yoksa varsayılan olarak "127.0.0.1" kullanıyoruz.
        const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

        // 4. wrangler.jsonc dosyasında "weatherApp_db" olarak adlandırdığımız D1 veritabanı bağlayıcısını alıyoruz.
        const db = env.weatherApp_db;

        // 5. Veritabanı bağlayıcısının mevcut olup olmadığını kontrol ediyoruz.
        if (!db) {
            return new Response(
                JSON.stringify({ error: "Veritabanı bağlantısı bulunamadı (weatherApp_db)." }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // 6. SQL enjeksiyonuna (SQL Injection) karşı güvenli prepared statement oluşturuyoruz.
        // Parametreleri '?' işareti ile işaretliyoruz.
        const stmt = db.prepare(
            `INSERT INTO visits (city_name, ip, city, country, lat, lon) 
       VALUES (?, ?, ?, ?, ?, ?)`
        );

        // 7. Değerleri prepared statement'a bağlıyoruz (bind) ve sorguyu çalıştırıyoruz (run).
        // Boş gönderilen alanların SQL tablosuna NULL olarak yazılabilmesi için '|| null' mantıksal kontrolünü kullanıyoruz.
        const result = await stmt.bind(
            city_name || null,
            ip,
            city || null,
            country || null,
            lat !== undefined ? lat : null,
            lon !== undefined ? lon : null
        ).run();

        // 8. İşlem başarılı ise istemciye başarılı yanıtını ve D1 işlem sonucunu JSON olarak dönüyoruz.
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
        // 9. İstek işlenirken veya SQL sorgusu çalıştırılırken bir hata oluşursa yakalayıp 500 koduyla dönüyoruz.
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
