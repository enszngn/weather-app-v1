DROP TABLE if EXISTS visits;

CREATE TABLE visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_name TEXT,
    ip TEXT NOT NULL, /* ip gelmezse veri islemedim, simdilik kalsin soracam */
    city TEXT,
    country TEXT,
    lat REAL,
    lon REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);