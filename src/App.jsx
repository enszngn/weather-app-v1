import { useState } from 'react'
import './App.css'

function App() {
  const cities = [
    { name: 'Istanbul', temp: 18 },
    { name: 'Ankara', temp: 14 },
    { name: 'Izmir', temp: 21 },
    { name: 'Antalya', temp: 24 },
    { name: 'Bursa', temp: 16 },
  ]

  const [selectedCity, setSelectedCity] = useState('Ankara')

  const current = cities.find((item) => item.name === selectedCity)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Weather App</h1>
      </header>
      <main className="hero">
        <label className="city-label">
          <select
            className="city-select"
            value={selectedCity}
            onChange={(event) => setSelectedCity(event.target.value)}
          >
            <option value="">Select a city</option>
            {cities.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="temp">
          {current ? `${current.temp}°C` : '--'}
        </div>
      </main>
    </div>
  );
}

export default App