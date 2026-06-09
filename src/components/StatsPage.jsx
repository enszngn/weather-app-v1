import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Import Leaflet CSS styles
import 'leaflet/dist/leaflet.css';

// Define a custom animated SVG map pin icon using the new color palette
const createCustomIcon = (visitCount) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute h-8 w-8 rounded-full bg-[#8fe0ff]/25 animate-ping"></div>
        <div class="relative h-4 w-4 rounded-full bg-[#8fe0ff] border-2 border-[#2b235a] flex items-center justify-center shadow-lg">
          <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
        </div>
        <div class="absolute -top-6 bg-[#31255a]/90 text-[10px] text-[#8fe0ff] px-1.5 py-0.5 rounded-none border border-[#54416d]/50 shadow backdrop-blur-sm whitespace-nowrap font-medium pointer-events-none">
          ${visitCount} Visits
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

export default function StatsPage({ navigate }) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // Check if stats password session token exists on component mount
  useEffect(() => {
    const savedPassword = sessionStorage.getItem('stats_password');
    if (savedPassword) {
      fetchStats(savedPassword);
    }
  }, []);

  const fetchStats = async (authPassword) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authPassword}`
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStats(data);
        setIsAuthenticated(true);
        sessionStorage.setItem('stats_password', authPassword);
      } else {
        setError(data.error || 'Login failed. Please check your password.');
        sessionStorage.removeItem('stats_password');
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError('A server error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Password field cannot be empty.');
      return;
    }
    fetchStats(password);
  };

  // Backfill missing days with 0 to ensure a smooth continuous chart line
  const getCleanedChartData = () => {
    if (!stats || !stats.chartData) return [];

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push(dateStr);
    }

    const dataMap = new Map(stats.chartData.map(item => [item.date, item.count]));

    return days.map(date => ({
      date: date.split('-').slice(1).reverse().join('/'), // Convert to DD/MM formatting
      Visitors: dataMap.get(date) || 0
    }));
  };

  // Calculate KPI statistics from metrics payload
  const totalVisitsCount = stats?.visits?.length || 0;
  const uniqueCitiesCount = stats?.pins?.length || 0;
  const topCityName = stats?.pins?.[0]?.city || 'None';

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#2b235a] p-4 font-sans select-none">
        {/* Blur glow effect background overlay using new light blue color */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#8fe0ff]/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative w-full max-w-md bg-[#31255a]/60 border border-[#54416d]/80 backdrop-blur-xl p-8 rounded-none shadow-2xl animate-fade-in">
          <div className="text-center mb-8">
            <div className="h-12 w-12 rounded-none bg-[#8fe0ff]/10 border border-[#8fe0ff]/20 text-[#8fe0ff] flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white tracking-wide uppercase">Admin Dashboard Login</h1>
            <p className="text-xs text-slate-400 mt-2">Enter the administrator password to access this panel.</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Administrator Password"
                className="w-full bg-[#2b235a]/60 border border-[#54416d]/60 focus:border-[#8fe0ff]/80 text-white rounded-none py-3 px-4 outline-none text-center tracking-widest text-sm transition-all duration-300 placeholder:tracking-normal placeholder:text-slate-500"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/10 py-2.5 px-4 rounded-none text-center">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#8fe0ff] hover:bg-[#75b4e3] text-[#2b235a] font-semibold py-3 rounded-none shadow-lg shadow-[#8fe0ff]/10 hover:shadow-[#75b4e3]/25 active:scale-[0.98] transition-all duration-300 cursor-pointer flex items-center justify-center text-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-[#2b235a] border-t-transparent rounded-full animate-spin"></div>
              ) : 'Login'}
            </button>
          </form>

          <button 
            onClick={() => navigate('/')}
            className="w-full text-slate-400 hover:text-white text-xs text-center mt-6 transition-colors duration-200 cursor-pointer"
          >
            ← Back to Weather
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2b235a] text-slate-200 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Navigation */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#54416d]/40 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#8fe0ff] animate-pulse"></span>
              Visitor Analytics Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1">Real-time traffic and visitor location insights.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                sessionStorage.removeItem('stats_password');
                setIsAuthenticated(false);
                setStats(null);
                setPassword('');
              }}
              className="px-4 py-2 bg-[#31255a]/60 hover:bg-[#54416d]/60 border border-[#54416d]/80 text-xs rounded-none font-medium transition-colors cursor-pointer text-rose-400 hover:text-rose-300"
            >
              Logout
            </button>
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-[#8fe0ff] hover:bg-[#75b4e3] text-[#2b235a] text-xs rounded-none font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-lg shadow-[#8fe0ff]/15"
            >
              ← Weather
            </button>
          </div>
        </header>

        {/* KPI Scorecards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#31255a]/40 border border-[#54416d]/80 p-5 rounded-none backdrop-blur-md">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Visitors</div>
            <div className="text-3xl font-bold text-white mt-2 flex items-baseline gap-2">
              {totalVisitsCount}
              <span className="text-xs font-normal text-[#8fe0ff]">active logs</span>
            </div>
          </div>
          <div className="bg-[#31255a]/40 border border-[#54416d]/80 p-5 rounded-none backdrop-blur-md">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Unique Locations</div>
            <div className="text-3xl font-bold text-white mt-2 flex items-baseline gap-2">
              {uniqueCitiesCount}
              <span className="text-xs font-normal text-[#8fe0ff]">cities</span>
            </div>
          </div>
          <div className="bg-[#31255a]/40 border border-[#54416d]/80 p-5 rounded-none backdrop-blur-md">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Top Location</div>
            <div className="text-3xl font-bold text-white mt-2 truncate pr-2" title={topCityName}>
              {topCityName}
            </div>
          </div>
        </section>

        {/* Charts & Maps Layout */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Traffic Line Chart */}
          <div className="lg:col-span-5 bg-[#31255a]/40 border border-[#54416d]/80 p-6 rounded-none flex flex-col backdrop-blur-md h-[400px]">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#8fe0ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              7-Day Traffic Overview
            </h2>
            <div className="flex-1 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getCleanedChartData()} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#54416d" strokeOpacity={0.3} vertical={false} />
                  <XAxis dataKey="date" stroke="#75b4e3" axisLine={false} tickLine={false} />
                  <YAxis stroke="#75b4e3" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#31255a', borderColor: '#54416d', borderRadius: '0px' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                    itemStyle={{ color: '#8fe0ff' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Visitors" 
                    stroke="#8fe0ff" 
                    strokeWidth={3} 
                    dot={{ fill: '#75b4e3', strokeWidth: 2, r: 4 }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaflet Map */}
          <div className="lg:col-span-7 bg-[#31255a]/40 border border-[#54416d]/80 p-4 rounded-none backdrop-blur-md h-[400px] flex flex-col relative overflow-hidden">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 px-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#8fe0ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Visitor Map
            </h2>
            <div className="flex-1 rounded-none overflow-hidden border border-[#54416d] z-10">
              <MapContainer 
                center={[20, 0]} 
                zoom={1.5} 
                className="h-full w-full"
                scrollWheelZoom={true}
              >
                {/* Render CartoDB dark mode map tiles */}
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                
                {stats?.pins?.map((pin, i) => (
                  <Marker 
                    key={i} 
                    position={[pin.lat, pin.lon]} 
                    icon={createCustomIcon(pin.visits)}
                  >
                    <Popup>
                      <div className="text-slate-900 font-sans p-1">
                        <strong className="text-sm text-slate-800 block mb-0.5">{pin.city}, {pin.country}</strong>
                        <span className="text-xs text-slate-500">Total {pin.visits} Visitors</span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </section>

        {/* Telemetry Table */}
        <section className="bg-[#31255a]/40 border border-[#54416d]/80 rounded-none p-6 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#8fe0ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Last 100 Visitor Details
          </h2>
          <div className="overflow-x-auto rounded-none border border-[#54416d]/60">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#2b235a]/80 text-slate-300 font-medium border-b border-[#54416d]/60">
                  <th className="py-4 px-5">ID</th>
                  <th className="py-4 px-5">IP Address</th>
                  <th className="py-4 px-5">Location</th>
                  <th className="py-4 px-5">Coordinates (Lat, Lon)</th>
                  <th className="py-4 px-5">Visit Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#54416d]/40 bg-[#31255a]/10">
                {stats?.visits && stats.visits.length > 0 ? (
                  stats.visits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-[#54416d]/30 transition-colors duration-200">
                      <td className="py-4 px-5 text-slate-400 font-mono">#{visit.id}</td>
                      <td className="py-4 px-5 font-mono text-[#8fe0ff]/95">{visit.ip}</td>
                      <td className="py-4 px-5 text-white font-medium">
                        {visit.city_name || visit.city || 'Unknown'}
                        {(visit.country) && <span className="text-[10px] text-slate-400 font-normal block mt-0.5">{visit.country}</span>}
                      </td>
                      <td className="py-4 px-5 font-mono text-slate-300">
                        {visit.lat ? visit.lat.toFixed(4) : '0.0000'}, {visit.lon ? visit.lon.toFixed(4) : '0.0000'}
                      </td>
                      <td className="py-4 px-5 text-slate-300 font-mono">
                        {new Date(visit.created_at + ' UTC').toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">No visitor logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
