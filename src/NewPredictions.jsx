import React, { useEffect, useState } from 'react';
import PredictionCharts from './PredictionCharts.jsx';

export default function NewPredictions({ api }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
  const [city, setCity] = useState('cali');
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [file, setFile] = useState(null);
  useEffect(() => { setPrediction(null); }, [city, date, file]);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  useEffect(() => { setValidation(null); }, [city, date, file]);
  async function validateFile(event) {
    event.preventDefault();
    if (!file) return;
    const selectedCity=city, selectedDate=date, selectedFile=file;
    setValidating(true);setValidation(null);setError('');
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx') || file.size>5*1024*1024)
        throw new Error('Selecciona un archivo .xlsx de hasta 5 MB.');
      const response=await fetch(api+'/api/v1/ciudades/'+city+'/plantilla/validar?fecha_objetivo='+date,
        {method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
      const data=await response.json();
      if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'No se pudo validar el archivo.');
      setValidation({ ...data, ciudadSeleccionada:selectedCity, fechaSeleccionada:selectedDate, archivoSeleccionado:selectedFile });
    }catch(e){setError(e.message);}finally{setValidating(false);}
  }
  const visibleValidation = validation?.ciudadSeleccionada===city && validation?.fechaSeleccionada===date && validation?.archivoSeleccionado===file ? validation : null;
  useEffect(() => {
    const abort = new AbortController(); setPeriod(null); setError('');
    fetch(api+'/api/v1/plantillas/periodo?fecha_objetivo='+date,{signal:abort.signal})
      .then(async r => {const data=await r.json();if(!r.ok)throw new Error(typeof data.detail==='string'?data.detail:'Revisa la fecha seleccionada.');return data;})
      .then(setPeriod).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    return ()=>abort.abort();
  },[date,api]);
  const visiblePrediction = prediction?.city===city && prediction?.date===date && prediction?.file===file ? prediction.data : null;
  async function predict(downloadResult=false) {
    const snapshot={city,date,file};
    setPredicting(true);setError('');
    try {
      const response=await fetch(api+'/api/v1/ciudades/'+city+'/prediccion-carga?fecha_objetivo='+date+'&descargar='+downloadResult,
        {method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
      if(!response.ok) {
        const body=await response.json();
        throw new Error(typeof body.detail==='string'?body.detail:body.detail?.mensaje??'No se pudo generar la predicción.');
      }
      if(downloadResult) {
        const blob=await response.blob(),url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='prediccion_'+snapshot.city+'_'+snapshot.date+'.xlsx';
        document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      } else setPrediction({...snapshot,data:await response.json()});
    }catch(e){setError(e.message);}finally{setPredicting(false);}
  }
  async function download(event) {
    event.preventDefault(); setBusy(true);setError('');
    try {
      const response=await fetch(api+'/api/v1/ciudades/'+city+'/plantilla?fecha_objetivo='+date);
      if(!response.ok)throw new Error('No se pudo descargar la plantilla. Comprueba la fecha y la conexión con la API.');
      const blob=await response.blob(), url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='plantilla_'+city+'_'+date+'.xlsx';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="panel model-section">
    <h2>Nuevas predicciones</h2>
    <p>Descarga la plantilla de antecedentes para el municipio y la semana que deseas predecir.</p>
    <form className="template-form" onSubmit={download}>
      <label>Municipio de la plantilla<select value={city} onChange={e=>setCity(e.target.value)}>
        <option value="cali">Cali</option><option value="ibague">Ibagué</option><option value="villavicencio">Villavicencio</option>
      </select></label>
      <label>Fecha de la semana objetivo<input required type="date" min="2026-01-01" max={today} value={date} onChange={e=>setDate(e.target.value)}/></label>
      <button className="primary" disabled={!period||busy} type="submit">{busy?'Descargando…':'Descargar plantilla Excel'}</button>
    </form>
    {error&&<p role="alert" className="notice error">{error}</p>}
    {period&&<div className="panel notice">
      <strong>Semana {period.semana_epi} de {period.anio_epi} · {period.inicio} a {period.fin}</strong>
      <p>La hoja «Datos» contiene {period.filas} semanas desde el inicio del año epidemiológico 2026 hasta la semana anterior al objetivo.</p>
      <p>Completa notificaciones, precipitación acumulada (mm), temperatura media (°C) y humedad relativa media (%). Conserva las fechas y los encabezados.</p>
      {period.filas===0&&<p>Para esta primera semana, todos los antecedentes corresponden al histórico hasta 2025.</p>}
    </div>}
    <section className="upload-section" aria-labelledby="cargar-archivo">
      <h3 id="cargar-archivo">Cargar y validar el archivo</h3>
      <p>Completa el Excel descargado y selecciónalo aquí. Se comprobarán los datos para el municipio y la semana objetivo indicados arriba.</p>
      <form className="template-form" onSubmit={validateFile}>
        <label>Archivo de antecedentes (.xlsx)<input type="file" accept=".xlsx" disabled={validating}
          onChange={e=>setFile(e.target.files?.[0] ?? null)} /></label>
        <button className="primary" type="submit" disabled={!file||!period||validating}>{validating?'Validando…':'Validar archivo'}</button>
      </form>
      {visibleValidation && <div className="notice" role="status">
        <strong>{visibleValidation.valido?'Archivo válido':'El archivo requiere correcciones'}</strong>
        <p>{visibleValidation.valido
          ? `Se verificaron ${visibleValidation.filas_validar} semanas de antecedentes para ${visibleValidation.municipio}. Semana objetivo: ${visibleValidation.semana_objetivo.inicio} a ${visibleValidation.semana_objetivo.fin}.`
          : `Se encontraron ${visibleValidation.total_errores} errores. Corrige el Excel y vuelve a cargarlo.`}</p>
        {visibleValidation.valido && <p>Los antecedentes están listos para estimar la semana objetivo.</p>}
        {!visibleValidation.valido && <div className="table-scroll validation-errors"><table>
          <thead><tr><th>Hoja</th><th>Fila</th><th>Columna</th><th>Corrección necesaria</th></tr></thead>
          <tbody>{visibleValidation.errores.map((e,i)=><tr key={i}><td>{e.hoja}</td><td>{e.fila??'—'}</td><td>{e.columna??'—'}</td><td>{e.mensaje}</td></tr>)}</tbody>
        </table></div>}
      </div>}
    </section>
    {visibleValidation?.valido && <section className="upload-section">
      <h3>Presentar y descargar la predicción</h3>
      <button className="primary model-note" disabled={predicting} onClick={()=>predict(false)}>{predicting?'Procesando…':'Generar predicción'}</button>
      {visiblePrediction && <div className="notice" aria-live="polite">
        <h3>{visiblePrediction.nombre} · Semana {visiblePrediction.semana_objetivo.semana_epi} de {visiblePrediction.semana_objetivo.anio_epi}</h3>
        <p>{visiblePrediction.semana_objetivo.inicio} a {visiblePrediction.semana_objetivo.fin}</p>
        <div className="data-summary">
          <div><strong>{(visiblePrediction.probabilidad_exceso*100).toFixed(2)} %</strong><span>Probabilidad estimada de exceso</span></div>
          <div><strong>{(visiblePrediction.umbral_probabilidad*100).toFixed(2)} %</strong><span>Umbral del municipio</span></div>
          <div><strong>{visiblePrediction.alerta?'Alerta activada':'Sin alerta'}</strong><span>La probabilidad debe superar el umbral</span></div>
          <div><strong>{visiblePrediction.p75_casos==null?'No disponible':new Intl.NumberFormat('es-CO').format(visiblePrediction.p75_casos)}</strong><span>P75 histórico de notificaciones</span></div>
        </div>
        <PredictionCharts result={visiblePrediction} />
        {visiblePrediction.aviso_p75&&<p>{visiblePrediction.aviso_p75}</p>}
        <p>Estimación para el total de la semana objetivo, usando observaciones de semanas anteriores. El resultado observado de esa semana se conocerá después.</p>
        <p className="muted">Modelo {visiblePrediction.modelo} · entrenamiento hasta {visiblePrediction.entrenamiento_hasta}.</p>
        <details><summary>Antecedentes y variables utilizadas</summary>
          <p>Inicios de semana: {visiblePrediction.semanas_antecedentes.join(', ')}.</p>
          <div className="table-scroll"><table><thead><tr><th>Variable</th><th>Valor</th></tr></thead><tbody>
            {Object.entries(visiblePrediction.predictores).map(([k,v])=><tr key={k}><td>{k}</td><td>{new Intl.NumberFormat('es-CO',{maximumFractionDigits:4}).format(v)}</td></tr>)}
          </tbody></table></div>
        </details>
        <button className="model-note" disabled={predicting} onClick={()=>predict(true)}>Descargar resultado Excel</button>
      </div>}
    </section>}
  </section>;
}
