import React, { useEffect, useRef } from 'react';
import geography from './colombia-geometry.json';

const frame = { west: -82.7, east: -64.7, south: -5.2, north: 14.5 };
const cities = [
  { id: 'cali', name: 'Cali', lon: -76.53, lat: 3.45, label: 'left' },
  { id: 'ibague', name: 'Ibagué', lon: -75.24, lat: 4.44, label: 'above' },
  { id: 'villavicencio', name: 'Villavicencio', lon: -73.64, lat: 4.15, label: 'right' },
];
const project = (lon, lat) => [
  (lon - frame.west) / (frame.east - frame.west),
  (frame.north - lat) / (frame.north - frame.south),
];

export default function ColombiaMap({ active, onSelect }) {
  const canvas = useRef(null);
  useEffect(() => {
    const surface = canvas.current;
    const context = surface.getContext('2d');
    const polygons = geography.type === 'Polygon' ? [geography.coordinates] : geography.coordinates;
    context.clearRect(0, 0, surface.width, surface.height);
    context.lineJoin = 'round';
    context.lineWidth = 2;
    context.strokeStyle = '#648c9e';
    context.fillStyle = '#d4e9e8';
    for (const polygon of polygons) {
      context.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lon, lat], index) => {
          const [x, y] = project(lon, lat);
          const coords = [x * surface.width, y * surface.height];
          if (index === 0) context.moveTo(...coords);
          else context.lineTo(...coords);
        });
        context.closePath();
      }
      context.fill('evenodd');
      context.stroke();
    }
  }, []);

  return <section className="panel geography" aria-label="Mapa de Colombia">
    <h2>Municipios del tablero</h2>
    <p className="muted">Selecciona una ciudad en el mapa.</p>
    <div className="map-frame">
      <canvas ref={canvas} width="540" height="591" aria-hidden="true" />
      {cities.map(({ id, name, lon, lat, label }) => {
        const [x, y] = project(lon, lat);
        return <button type="button" className={`map-marker ${label}`} key={id} aria-label={name}
          aria-pressed={id === active} style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          onClick={() => onSelect(id)}>
          <span className="map-label" aria-hidden="true">{name}</span>
        </button>;
      })}
    </div>
    <a className="map-source" href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Contorno: Natural Earth</a>
  </section>;
}
