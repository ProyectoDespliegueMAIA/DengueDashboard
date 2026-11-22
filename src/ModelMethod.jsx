import React from 'react';
import logisticImage from './assets/arquitectura-logistica.png';
import mlp8Image from './assets/arquitectura-mlp-8.png';
import mlp16Image from './assets/arquitectura-mlp-16.png';

const diagrams = [
  { title: 'Regresión logística', image: logisticImage,
    alt: 'Entradas escaladas, suma ponderada de las variables y salida sigmoide.',
    caption: 'La API usa este modelo. Asigna un peso a cada entrada y convierte la suma ponderada en una probabilidad mediante la función sigmoide.' },
  { title: 'Perceptrón multicapa · 8 neuronas', image: mlp8Image,
    alt: 'Entradas escaladas, una capa oculta con ocho neuronas ReLU y salida sigmoide.',
    caption: 'Configuración seleccionada para el MLP de Cali y Villavicencio. Las ocho neuronas forman una sola capa oculta.' },
  { title: 'Perceptrón multicapa · 16 neuronas', image: mlp16Image,
    alt: 'Entradas escaladas, una capa oculta con dieciséis neuronas ReLU y salida sigmoide.',
    caption: 'Configuración seleccionada para el MLP de Ibagué. Las dieciséis neuronas forman una sola capa oculta.' },
];

export default function ModelMethod({ mlp }) {
  return <>
    <section className="panel model-section model-decision" aria-labelledby="variables-modelo">
      <h2 id="variables-modelo">Selección y construcción de variables</h2>
      <p>Elegimos las diez variables originales por criterio técnico para representar los conteos recientes y la época del año. Fijamos sus rezagos y ventanas antes de entrenar. Después incorporamos precipitación, temperatura y humedad, y comparamos distintas ventanas climáticas mediante validación temporal. Cada modelo y municipio conservó la configuración climática con mejor precisión promedio (AP) entre las que convergieron.</p>
      <p>Se unieron las dos fuentes por municipio y semana epidemiológica, de domingo a sábado. La semana <strong>t</strong> es la que queremos anticipar. El clima observado y los conteos usados como entradas provienen de semanas anteriores a <strong>t</strong>.</p>
      <div className="table-scroll"><table className="method-table">
        <thead><tr><th>Grupo y fuente</th><th>Variables</th><th>Qué representan y cómo se agrupan</th></tr></thead>
        <tbody>
          <tr><th scope="row">Notificaciones · SIVIGILA</th><td>Rezagos 1, 2, 3, 4, 8 y 12</td><td>Se agrupan las notificaciones de dengue por municipio y fecha de inicio de síntomas. Cada rezago toma el conteo de una semana específica. Por ejemplo, el rezago 1 para la semana 20 es el conteo de la semana 19.</td></tr>
          <tr><th scope="row">Notificaciones · SIVIGILA</th><td>Media y desviación estándar de cuatro semanas</td><td>La media representa el nivel reciente y la desviación indica cuánto variaron los conteos. Para predecir la semana 20, ambas usan las semanas 16 a 19.</td></tr>
          <tr><th scope="row">Calendario epidemiológico</th><td>Seno y coseno de la semana objetivo</td><td>Dos coordenadas que ubican la semana objetivo en el ciclo del año, de 52 o 53 semanas. Así, la última semana del año y la primera del siguiente quedan cerca.</td></tr>
          <tr><th scope="row">Clima · Google Earth Engine</th><td>Precipitación (mm), temperatura (°C) y humedad relativa (%)</td><td>Se suman los siete valores diarios de lluvia y se promedian los de temperatura y humedad. Para las ventanas de cuatro semanas se suman las lluvias semanales y se promedian las temperaturas y humedades semanales.</td></tr>
        </tbody>
      </table></div>
      <p>Probamos cuatro conjuntos climáticos: la semana anterior, la semana anterior junto con el resumen de las últimas cuatro semanas, y ventanas de cuatro semanas que terminan dos o tres semanas antes de la semana objetivo. La ventana elegida para cada modelo aparece en su tarjeta.</p>
      <p><strong>Etiqueta que aprende el modelo.</strong> Para cada municipio y semana, comparamos el conteo observado con el P75 de esa misma semana en los cinco años anteriores. Si el conteo lo supera, la etiqueta es <strong>1</strong> (exceso). Si es igual o menor, es <strong>0</strong>. Con antecedentes insuficientes, la etiqueta queda sin calcular. El umbral de probabilidad que dispara la alerta se elige en una etapa posterior.</p>
    </section>
    <section className="panel model-section model-decision" aria-labelledby="proceso-modelo">
      <h2 id="proceso-modelo">Entrenamiento, validación, calibración y prueba</h2>
      <p>Ajustamos una regresión logística y un perceptrón multicapa (MLP) por municipio. Los dos aprendieron a estimar la probabilidad de exceso a una semana.</p>
      <ol className="method-stages">
        <li><strong>Antecedentes históricos, 2007–2011.</strong> Los conteos de estos años aportaron las primeras cinco referencias anuales para calcular el P75 de 2012. Las semanas de 2007–2011 todavía no tenían cinco años previos dentro de la serie, así que no entraron como ejemplos etiquetados para entrenar.</li>
        <li><strong>Primer bloque de entrenamiento, 2012–2016.</strong> Las semanas elegibles de estos años se usaron para ajustar los modelos del primer corte, que se validó en 2017. Para validar 2018, se añadieron las semanas elegibles de 2017 al entrenamiento, y así sucesivamente.</li>
        <li><strong>Validación temporal y búsqueda de hiperparámetros.</strong> Para cada año de validación de 2017 a 2021, entrenamos con semanas de años anteriores. En logística probamos la regularización <code>C</code> y pesos de clase uniformes o balanceados. En el MLP probamos una capa oculta de 8 o 16 neuronas y la regularización <code>alpha</code>. Comparamos las configuraciones mediante AP, una medida de qué tan bien se ordenan las semanas con exceso por encima de las demás.</li>
        <li><strong>Ajuste fino y entrenamiento definitivo.</strong> Después de la búsqueda inicial exploramos valores cercanos a los mejores y ampliamos el rango de regularización cuando el ganador quedó en un extremo. Comparamos también las ventanas climáticas. Con la configuración elegida, volvimos a entrenar la regresión logística y el MLP de cada municipio con todas las semanas elegibles de 2012 a 2021. El escalado de cada corte se ajustó solo con sus filas de entrenamiento.</li>
        <li><strong>Calibración del umbral de alerta, 2022–2023.</strong> Con los modelos ya entrenados, elegimos por municipio el umbral que más excesos detectaba sin superar las falsas alertas de la persistencia en ese período. La semana genera alerta si su probabilidad supera ese umbral.</li>
        <li><strong>Pruebas retrospectivas, 2024 y 2025.</strong> Aplicamos los modelos y umbrales fijados a cada año y contamos aciertos, omisiones y falsas alertas. Estos años ya se habían examinado en la primera ronda, por lo que los resultados de la segunda ronda describen el desempeño retrospectivo.</li>
      </ol>
      <h3>Configuración y semillas del MLP</h3>
      <p>Para el municipio seleccionado, ganó una capa oculta de <strong>{mlp.mejor.ajuste} neuronas</strong> con <code>alpha = {Number(mlp.mejor.valor.toPrecision(4))}</code>. Se eligió la combinación completa de tamaño de capa, regularización y ventana de clima porque obtuvo la mayor AP ({(mlp.mejor.ap * 100).toFixed(1).replace('.', ',')} %) entre las configuraciones que convergieron en los cortes de 2017–2021.</p>
      <p>La semilla define el punto de partida de los pesos de la red. Fijamos la <strong>42</strong> antes de buscar y la mantuvimos en el modelo reportado. También repetimos el entrenamiento con las semillas <strong>7</strong> y <strong>13</strong> para ver cuánto cambiaba el resultado. En 2022–2023, la AP fue {Object.entries(mlp.estabilidad_mlp).map(([semilla, resultado]) => `${(resultado.ap * 100).toFixed(1).replace('.', ',')} % con la semilla ${semilla}`).join(', ')}. Estas repeticiones fueron una comprobación de estabilidad.</p>
      <h3 className="architecture-title">Qué significan las variables climáticas</h3>
      <p><strong>Precipitación (mm).</strong> Es la cantidad de agua de lluvia acumulada. Un milímetro equivale a un litro por metro cuadrado. En el gráfico, se suman las lluvias diarias de cada semana, después de calcular la media espacial municipal.</p>
      <p><strong>Temperatura (°C).</strong> Describe qué tan caliente o frío está el aire. El dato utilizado representa la temperatura a dos metros del suelo y el gráfico muestra su media semanal.</p>
      <p><strong>Humedad relativa (%).</strong> Expresa qué tan cerca está el aire de la saturación de vapor de agua a su temperatura actual. Un valor de 80 % indica un 80 % de esa saturación. El gráfico muestra el promedio semanal.</p>
      <h3 className="architecture-title">Extracción de los datos climáticos</h3>
      <p>El algoritmo entregado está escrito en <strong>JavaScript</strong> y utiliza la API de <strong>Google Earth Engine</strong>. Construye una imagen por día desde el 1 de enero de 2007 hasta el 31 de diciembre de 2025 y realiza una <strong>reducción espacial por polígono municipal</strong> con <code>reduceRegions</code> y <code>ee.Reducer.mean()</code>. El promedio incluye el área total del polígono seleccionado. Se usa una escala nominal de 5.566 metros y se exporta una tabla CSV por municipio mediante <code>Export.table.toDrive</code>.</p>
      <p>La lluvia procede de <code>UCSB-CHG/CHIRPS/DAILY</code>, banda <code>precipitation</code>. La temperatura procede de <code>ECMWF/ERA5_LAND/DAILY_AGGR</code>, banda <code>temperature_2m</code>, convertida de kelvin a °C restando 273,15. La humedad se deriva con Magnus–Tetens a partir de la temperatura y del punto de rocío, banda <code>dewpoint_temperature_2m</code>. Se calcula por píxel antes de obtener la media municipal.</p>
      <p>El script referencia los límites <code>FAO/GAUL_SIMPLIFIED_500m/2025/level2</code> y filtra los nombres de los municipios. La escala de cálculo común no aumenta la resolución original de ERA5-Land, aproximadamente 11 km. La humedad calculada a partir de promedios diarios es una aproximación a la humedad diaria. Los polígonos corresponden a FAO GAUL 2025 simplificado a 500 metros, nivel administrativo 2, según el recurso indicado en el algoritmo.</p>
      <p><a href="https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY" target="_blank" rel="noreferrer">CHIRPS diario</a> · <a href="https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_DAILY_AGGR" target="_blank" rel="noreferrer">ERA5-Land diario</a> · <a href="https://developers.google.com/earth-engine/apidocs/ee-image-reduceregions" target="_blank" rel="noreferrer">Reducción espacial</a></p>
      <h3 className="architecture-title">Arquitectura de los clasificadores</h3>
      <p>Ambos tipos de clasificador reciben variables escaladas y producen una probabilidad de exceso. En el MLP, las neuronas intermedias combinan las entradas y aplican ReLU, una función que deja pasar los valores positivos y convierte los negativos en cero. La comparación histórica aplicó una regla de alerta a los dos clasificadores. El servicio de predicción usa la regresión logística.</p>
      <div className="architecture-grid">{diagrams.map(({ title, image, alt, caption }) =>
        <figure key={title}><strong>{title}</strong><img src={image} alt={alt} loading="lazy" />
          <figcaption>{caption}</figcaption></figure>
      )}</div>
      <h3>Qué significa persistencia</h3>
      <p>Es una regla de referencia que usa el último conteo semanal como estimación de la próxima semana. Si la semana anterior registró 45 notificaciones y el P75 de la próxima es 40, la regla alerta porque <strong>45 supera 40</strong>. Sirve para comprobar si los clasificadores ofrecen una ventaja frente a una decisión posible con el último conteo y el P75.</p>
    </section>
  </>;
}
