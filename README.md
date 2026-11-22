# Dashboard local de dengue

Frontend React con Vite. Consulta el modelo municipal en Docker y presenta notificaciones, P75, probabilidad y resultados de alerta. Incluye filtros de ciudad, período y umbral, selección de semanas en gráficos y una tabla paginada.

## Arranque en Windows

1. Abre Docker Desktop y ejecuta en PowerShell:

```powershell
cd 'C:\Users\aicra\OneDrive\UNIANDES\Despliegue\Codigo\Repos\ModeloDengue\ModeloDengue'
docker compose -f docker/api/compose.yaml up -d --build --wait
Invoke-RestMethod http://127.0.0.1:8000/health
```

La construcción usa el paquete local data/api_dengue. Si falta, instala requirements-api.txt y ejecuta scripts/exportar_api_dengue.py según la documentación de la API. El puerto 8000 debe estar libre antes de arrancar Docker. Si Uvicorn ya se ejecuta directamente, detenlo en su terminal.

2. En otra PowerShell, con Node.js 22.12+ y pnpm disponible:

```powershell
cd 'C:\Users\aicra\OneDrive\UNIANDES\Despliegue\Codigo\Repos\FrontEndLocal'
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

En este equipo, si PowerShell no reconoce pnpm.cmd y node_modules ya está instalado, puedes arrancar Vite directamente con el Node incluido en Codex:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173 --strictPort
```

Si el dashboard ya está abierto en el puerto 5173, reutiliza esa instancia.

3. Abre [el dashboard](http://127.0.0.1:5173). Debe aparecer Cali en 2024. Elige Villavicencio, aplica los filtros y comprueba que cambian las tarjetas y gráficos. Selecciona 100 % en el umbral de simulación y vuelve a aplicar. El total de alertas debe pasar a cero. Selecciona Umbral del municipio y aplica para restaurar su valor predeterminado. Selecciona una semana de la tabla para ver su detalle.

Swagger está en [la documentación de la API](http://127.0.0.1:8000/docs). Para verificar el empaquetado de React, ejecuta pnpm.cmd run build. Si cambia la URL del backend, copia .env.example como .env.local, adapta VITE_API_URL y reinicia Vite. Configura DENGUE_CORS_ORIGINS en Docker si cambia el origen del frontend.

Para detener un frontend arrancado en la terminal usa Ctrl+C. Para detener la API, desde el repositorio del modelo ejecuta docker compose -f docker/api/compose.yaml stop.

## Frontend y API en Docker

Con Docker Desktop activo, desde FrontEndLocal:

```powershell
docker compose up -d --build --wait
docker compose ps
```

Abre http://127.0.0.1:8080. La API continúa disponible en http://127.0.0.1:8000/docs. Esta configuración utiliza el proyecto Compose dengue-api existente y añade el servicio frontend. La carpeta del modelo debe conservar su ubicación relativa ../ModeloDengue/ModeloDengue y su paquete data/api_dengue debe existir para construir la API.

La imagen del frontend compila React con Node y sirve los archivos estáticos con Nginx. Las consultas usan /backend en el mismo origen del dashboard y Nginx las reenvía al servicio api:8000. El navegador no necesita resolver nombres internos de Docker. Las cargas Excel y las descargas pasan por esa misma ruta.

```powershell
# Reconstruir después de cambios
docker compose up -d --build --wait

# Ver registros
docker compose logs --tail 50 frontend api

# Detener ambos servicios
docker compose stop

# Iniciar ambos servicios ya construidos
docker compose up -d --wait
```

El frontend en Docker usa el puerto 8080. El servidor de desarrollo Vite puede seguir usando el 5173. La configuración de AWS y la publicación de imágenes se definirán en el siguiente paso.
