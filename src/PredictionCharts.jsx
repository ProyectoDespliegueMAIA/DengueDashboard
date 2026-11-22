import React, { useState } from 'react';

const pct = value => new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 2 }).format(value);
const number = value => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);

export default function PredictionCharts({ result }) {
  const [variable, setVariable] = useState('precipitacion_mm');
  const [selected, setSelected] = useState(null);
  const climates = {
    precipitacion_mm: {label:'Precipitación (mm)', color:'#427fa8'},
    temperatura_C: {label:'Temperatura (°C)', color:'#bd5725'},
    humedad_relativa: {label:'Humedad relativa (%)', color:'#00857e'},
  };
  const climate = climates[variable];
  const rows = result.notificaciones_recientes ?? [];
  const left = 63, right = 605, top = 30, bottom = 196;
  const x = i => left + i * (right - left) / 12;
  const maximum = Math.max(1, result.p75_casos ?? 0, ...rows.map(p => p.notificaciones ?? 0)) * 1.15;
  const y = v => bottom - v / maximum * (bottom - top);
  const values = rows.map(p=>p[variable]).filter(v=>v!=null);
  const min = variable==='precipitacion_mm' || !values.length ? 0 : Math.max(0,Math.min(...values)-1);
  const max = values.length ? Math.max(min+1,Math.max(...values)+1) : 1;
  const cy = v => bottom-(v-min)/(max-min)*(bottom-top);
  let climateConnected=false;
  const climatePath=rows.map((p,i)=>{
    if(p[variable]==null){climateConnected=false;return '';}
    const command=climateConnected?'L':'M';climateConnected=true;
    return `${command}${x(i)},${cy(p[variable])}`;
  }).join(' ');
  const active=rows.find(p=>p.inicio_semana===selected);
  let connected = false;
  const path = rows.map((p, i) => {
    if (p.notificaciones == null) { connected = false; return ''; }
    const command = connected ? 'L' : 'M'; connected = true;
    return `${command}${x(i)},${y(p.notificaciones)}`;
  }).join(' ');

  return <div className="graphs prediction-charts">
    <section className="panel chart-panel">
      <h3>Probabilidad frente al umbral</h3>
      <p className="muted">La alerta se activa si la probabilidad supera el umbral del municipio.</p>
      <div className="probability-meter" role="img" aria-label={`Probabilidad ${pct(result.probabilidad_exceso)}, umbral ${pct(result.umbral_probabilidad)}. ${result.alerta ? 'Alerta activada' : 'Sin alerta'}.`}>
        <div className="probability-scale"><span>0 %</span><span>50 %</span><span>100 %</span></div>
        <div className="probability-track"><div style={{ width: `${result.probabilidad_exceso * 100}%` }} />
          <span className="probability-threshold" style={{ left: `${result.umbral_probabilidad * 100}%` }} />
        </div>
      </div>
      <div className="legend"><span><i style={{background:'#00857e'}} />Probabilidad {pct(result.probabilidad_exceso)}</span>
        <span><i style={{background:'#ad4609'}} />Umbral {pct(result.umbral_probabilidad)}</span></div>
      <p className="model-note"><strong>{result.alerta ? 'Alerta activada' : 'Sin alerta'}</strong> para la semana del {result.semana_objetivo.inicio} al {result.semana_objetivo.fin}.</p>
    </section>
    <section className="panel chart-panel">
      <h3>Notificaciones recientes, clima y referencia objetivo</h3>
      <label className="model-note">Antecedente climático<select value={variable} onChange={e=>setVariable(e.target.value)}>
        {Object.entries(climates).map(([key,c])=><option key={key} value={key}>{c.label}</option>)}
      </select></label>
      <p className="muted">Los valores climáticos se muestran en su semana de observación. La franja verde inferior identifica las semanas de clima utilizadas por el modelo.</p>
      <p className="muted">La línea fucsia corresponde al P75 de la semana objetivo y sirve de referencia para los conteos previos.</p>
      {rows.length ? <svg viewBox="0 0 680 290" role="img" aria-label="Conteos de las doce semanas anteriores y P75 de la semana objetivo">
        <text x={left} y="16">Notificaciones</text><text x={right+62} y="16" textAnchor="end">{climate.label}</text>
        <rect x={right-15} y={top} width="30" height={bottom-top} fill="#edf2f7"/>
        {[0,.5,1].map(f=><g key={f}><line className="gridline" x1={left} x2={right} y1={y(f*maximum)} y2={y(f*maximum)} />
          <text x={left-8} y={y(f*maximum)+4} textAnchor="end">{number(f*maximum)}</text></g>)}
        {[0,.5,1].map(f=><text key={f} x={right+9} y={y(f*maximum)+4}>{number(min+f*(max-min))}</text>)}
        {variable==='precipitacion_mm'
          ? rows.map((p,i)=>p[variable]==null?null:<rect key={p.inicio_semana} x={x(i)-10} width="20" y={cy(p[variable])} height={bottom-cy(p[variable])} fill={climate.color} opacity=".3"/>)
          : <path d={climatePath} fill="none" stroke={climate.color} strokeWidth="2"/>}
        {rows.map((p,i)=><g key={p.inicio_semana}>
          <rect x={x(i)-10} y="226" width="20" height="7" fill={p.clima_utilizado?'#00857e':'#e2e8ed'}/>
          <rect x={x(i)-14} y={top} width="28" height={bottom-top} fill="transparent" onClick={()=>setSelected(p.inicio_semana)}>
            <title>{p.inicio_semana} · {climate.label}: {p[variable]==null?'Sin dato':number(p[variable])}</title>
          </rect>
        </g>)}
        {result.p75_casos!=null && <line x1={left} x2={right} y1={y(result.p75_casos)} y2={y(result.p75_casos)} stroke="#c026a0" strokeWidth="2" strokeDasharray="6 4"/>}
        <path d={path} fill="none" stroke="#1668a8" strokeWidth="2.5"/>
        {rows.map((p,i)=>p.notificaciones==null?null:<circle key={p.inicio_semana} cx={x(i)} cy={y(p.notificaciones)} r="3.5" fill="#1668a8">
          <title>{p.inicio_semana} · {number(p.notificaciones)} notificaciones</title></circle>)}
        {[0,5,11].map(i=><text key={i} x={x(i)} y="218" textAnchor={i===0?'start':'middle'}>{rows[i]?.inicio_semana}</text>)}
        <text x={right} y="243" textAnchor="end">Objetivo {result.semana_objetivo.inicio}</text>
        <text x={right} y="261" textAnchor="end">Conteo por observar</text>
      </svg>:<p>Los antecedentes gráficos requieren regenerar la predicción con la API actualizada.</p>}
      <div className="legend"><span><i style={{background:climate.color}}/>{climate.label} · eje derecho</span><span><i style={{background:'#00857e'}}/>Clima utilizado</span><span><i style={{background:'#1668a8'}}/>Notificaciones observadas · eje izquierdo</span>
        <span><i style={{background:'#c026a0'}}/>P75 objetivo {result.p75_casos==null?'no disponible':number(result.p75_casos)}</span></div>
      {active && <div className="chart-detail">
        <strong>Semana del {active.inicio_semana}</strong>
        <span>Notificaciones: {active.notificaciones==null?'—':number(active.notificaciones)}</span>
        <span>{climate.label}: {active[variable]==null?'—':number(active[variable])}</span>
        <span>{active.clima_utilizado?'Clima utilizado por el modelo':'Semana de contexto climático'}</span>
      </div>}
    </section>
  </div>;
}
