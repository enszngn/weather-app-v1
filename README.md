# 🌦️ Weather Insights

A high-performance, minimalist weather application designed to provide instant atmospheric data with zero friction. Built with modern web technologies and deployed on the edge for maximum speed.

**🔗 [Live Demo](weather-insights.eneszengin542.workers.dev)**

---

## 🚀 Overview

Weather Insights focuses on **fast insights**. Unlike traditional weather apps cluttered with ads and heavy animations, this tool provides a streamlined, utility-first interface to get you the information you need in seconds.

---

## 📸 Screenshots

### 📱 3D Cylindrical Timeline Interface

<p align="center">
  <img src="./public/Ankara.png" alt="Ankara" width="100%" />
</p>

<p align="center">
  <img src="./public/California.png" alt="California" width="100%" />
</p>

<p align="center">
  <img src="./public/London.png" alt="London" width="100%" />
</p>

### 📱 Mobile-Tablet UI & System Analytics

| Tablet View | Mobile View |
| :---: | :---: |
| ![Tablet View](./public/tablet.png) | ![Mobile View](./public/phone.png) |

| Analytics Dashboard |
| :---: |
| ![Analytics Dashboard](./public/analytics.png) |

---

## 🛠️ Tech Stack

* **Frontend Framework:** [React](https://reactjs.org/)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **APIs Used:** 
  * [Open-Meteo API](https://open-meteo.com/) (Weather Data)
  * [BigDataCloud API](https://www.bigdatacloud.com/) (Reverse Geocoding)
* **Hosting & Deployment:** [Cloudflare Pages/Workers](https://pages.cloudflare.com/)

---

## 💎 Key Features & Architecture

* **Server-Side IP Geolocation:** The application automatically resolves the user's city and coordinates at the edge using Cloudflare serverless headers, eliminating unnecessary browser popups.
* **Edge-Native Caching:** Implements Cloudflare's hardware-level Cache API (`caches.default`) to store regional weather data for 15 minutes, drastically reducing external API round-trips and improving response times to near-zero.
* **Visitor Insights (D1 SQLite):** Every unique application session triggers an asynchronous logging mechanism that stores analytics data (Client IP, City, Country, and precise Coordinates) directly into a **Cloudflare D1 Serverless SQLite** database database instance.

---

## ⚙️ Installation & Setup

To get a local copy up and running, follow these simple steps:

1. **Clone the repository:**
```bash
   git clone https://github.com/enszngn/weather-app-v1.git
   cd weather-app-v1
```
2. **Install the dependencies:**
```bash
   npm install
```
3. **Start the local development server:**
```bash
   npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ✍️ Contact

Enes Zengin - [GitHub Profile](https://github.com/enszngn)
