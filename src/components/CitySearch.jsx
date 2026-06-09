import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin } from 'lucide-react';

/**
 * CitySearch — Standalone city search input with geocoding autocomplete.
 *
 * Props:
 *  onSelect      {function}  – Called with { lat, lon, title } when user picks a city.
 *  currentCityName {string} – Shown as placeholder when input is empty.
 *
 * Fetching:
 *  Uses Open-Meteo Geocoding API (free, no key required):
 *  https://geocoding-api.open-meteo.com/v1/search?name=...&count=5
 *  Results are debounced by 300ms to avoid hammering the API on every keystroke.
 */
export default function CitySearch({ onSelect, currentCityName }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // ── Close dropdown on outside click ──────────────────────────────────────────
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── Debounced geocoding search ────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      clearTimeout(debounceRef.current);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setResults(data.results || []);
        setIsOpen((data.results || []).length > 0);
      } catch {
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // ── Handle city selection ─────────────────────────────────────────────────────
  const handleSelect = (result) => {
    onSelect({
      lat: result.latitude,
      lon: result.longitude,
      title: result.name,
    });
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full max-w-xs">

      {/* ── Search Input ── */}
      <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-3.5 py-2.5 shadow-lg transition-all duration-300 focus-within:border-white/40 focus-within:bg-white/15 focus-within:shadow-white/5">
        {isLoading ? (
          <div className="h-3.5 w-3.5 border-[1.5px] border-white/30 border-t-white/70 rounded-full animate-spin flex-shrink-0" />
        ) : (
          <Search size={14} className="text-white/45 flex-shrink-0" strokeWidth={2} />
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={currentCityName ? `📍 ${currentCityName}` : 'Search city…'}
          className="bg-transparent text-white placeholder:text-white/35 text-sm outline-none w-full min-w-0 tracking-wide"
          autoComplete="off"
          spellCheck={false}
        />

        {query && (
          <button
            onClick={handleClear}
            className="flex-shrink-0 text-white/35 hover:text-white/65 transition-colors duration-200"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* ── Results Dropdown ── */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900/92 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/40 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {results.map((result, i) => {
            const subtitle = [result.admin1, result.country].filter(Boolean).join(', ');
            return (
              <button
                key={`${result.latitude}-${result.longitude}-${i}`}
                onClick={() => handleSelect(result)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 active:bg-white/12 transition-colors duration-150 text-left border-b border-white/5 last:border-0 group"
              >
                <MapPin
                  size={13}
                  className="text-white/30 group-hover:text-white/55 flex-shrink-0 transition-colors duration-150"
                  strokeWidth={2}
                />
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium truncate">{result.name}</div>
                  {subtitle && (
                    <div className="text-white/35 text-[11px] truncate mt-0.5">{subtitle}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
