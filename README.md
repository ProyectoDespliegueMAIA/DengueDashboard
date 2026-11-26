# Dashboard de predicción de dengue

Aplicación web del proyecto de investigación sobre alertas tempranas de dengue. Permite consultar series semanales de Cali, Ibagué y Villavicencio, comparar las notificaciones con el percentil 75 (P75) y explorar las alertas del modelo. También permite descargar una plantilla Excel, validar antecedentes, generar una predicción y descargar el resultado.

## Enlaces relevantes

- [Demostración pública](https://44.209.185.167/)
- [Estado de la API en el despliegue público](https://44.209.185.167/backend/health)
- [Repositorio del dashboard](https://github.com/ProyectoDespliegueMAIA/DengueDashboard)
- [Repositorio del modelo y la API](https://github.com/ProyectoDespliegueMAIA/Model)
- [Documentación del paquete de datos y de la API](https://github.com/ProyectoDespliegueMAIA/Model/blob/main/docs/api_dengue.md)

## Dependencias y entorno de ejecución

| Entorno | Requisitos y servicios |
| --- | --- |
| Desarrollo del frontend | Node.js 22.12 o posterior, pnpm, React y React DOM 19.2.0, Vite 7.2.2. |
| Ejecución local con Docker | Docker Desktop o Docker Engine con Compose v2. Para construir la API se requiere el repositorio Model y su paquete local `data/api_dengue/`. |
| Imagen del frontend | Node.js 24 y pnpm 11.25.0 durante la compilación. Nginx sobre Alpine sirve los archivos estáticos. |
| API | Python 3.12, FastAPI, Uvicorn y las dependencias de `requirements-api.txt` en Model. El Dockerfile incorpora los modelos y datos de `data/api_dengue/`. |
| Despliegue en AWS | EC2 x86_64 con Amazon Linux 2023, Docker Engine, Compose v2 y un Nginx en el host para HTTPS. Las imágenes se descargan de Amazon ECR privado. |

## Ejecución local

### Frontend y API con Docker Compose

El archivo [compose.yaml](compose.yaml) espera que el repositorio del modelo esté en `../ModeloDengue/ModeloDengue` con respecto a este repositorio. Si falta `data/api_dengue/`, genera el paquete siguiendo la [documentación de la API](https://github.com/ProyectoDespliegueMAIA/Model/blob/main/docs/api_dengue.md). Verifica que los puertos locales 8000 y 8080 estén disponibles.

Desde la raíz de este repositorio, con Docker activo:

```powershell
docker compose up -d --build --wait
docker compose ps
Invoke-RestMethod http://127.0.0.1:8080/backend/health
```

Abre el [dashboard local](http://127.0.0.1:8080/) o consulta [Swagger](http://127.0.0.1:8000/docs). Nginx sirve la interfaz y reenvía las solicitudes de `/backend/` a `api:8000` en la red de Docker. Para ver registros o detener los contenedores:

```powershell
docker compose logs --tail 50 frontend api
docker compose stop
```

### Desarrollo con Vite

Si la API no está en ejecución, arráncala desde la raíz del repositorio Model:

```powershell
docker compose -f docker/api/compose.yaml up -d --build --wait
Invoke-RestMethod http://127.0.0.1:8000/health
```

En otra terminal, desde la raíz de DengueDashboard:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Abre [Vite en el puerto 5173](http://127.0.0.1:5173/). Si cambia la dirección de la API, copia `.env.example` como `.env.local`, modifica `VITE_API_URL` y reinicia Vite. Si cambia el origen del frontend, ajusta `DENGUE_CORS_ORIGINS` en la API. Ejecuta `pnpm run build` para verificar la compilación.

## Uso básico y ejemplos

1. **Consultar datos históricos.** Selecciona Cali y aplica un intervalo de 2024. Revisa las gráficas de notificaciones, P75 y probabilidad. Selecciona una semana en la tabla para ver el detalle. Puedes cambiar el umbral de simulación y volver a seleccionar **Umbral del municipio** para restaurar el valor predeterminado.
2. **Generar una predicción con Excel.** En **Nuevas predicciones**, selecciona Cali y la fecha objetivo **1 de septiembre de 2026**. Descarga la plantilla para consultar su estructura o carga el [Excel sintético válido de Cali](https://github.com/ProyectoDespliegueMAIA/Model/blob/main/archivosPrueba/cali_2026-09-01_VALIDO_datos_sinteticos.xlsx). Valida el archivo, genera la predicción y descarga el resultado. Si completas tu propia plantilla, conserva las fechas y encabezados. El archivo debe ser `.xlsx` y pesar como máximo 5 MB.

## Despliegue en AWS

1. **Construir y publicar las imágenes.** Ejecuta la prueba local anterior. En ECR, región `us-east-1`, crea los repositorios privados `dengue-api` y `dengue-frontend`. Autentica Docker con `aws ecr get-login-password` y `docker login --password-stdin`. Etiqueta las imágenes locales con el URI de su repositorio y la versión, y publícalas con `docker push`. Registra sus digests.
2. **Preparar EC2.** Aprovisiona Amazon Linux 2023 x86_64 con Docker y Compose. Asocia una Elastic IP y un rol de instancia con permisos de lectura en ECR y acceso mediante Session Manager.
3. **Configurar Compose.** Copia [compose.aws.yaml](compose.aws.yaml) a `/opt/dengue/compose.yaml` en EC2. En el mismo directorio crea `.env` con las referencias a las imágenes. Estos valores son ejemplos de formato. Sustituye el ID de cuenta y las referencias por los de tu registro. Para fijar una imagen exacta, usa `repositorio@sha256:<digest>`.

   ```dotenv
   DENGUE_API_IMAGE=123456789012.dkr.ecr.us-east-1.amazonaws.com/dengue-api:bb4e354
   DENGUE_FRONTEND_IMAGE=123456789012.dkr.ecr.us-east-1.amazonaws.com/dengue-frontend:d866606
   ```

4. **Descargar y arrancar.** En EC2, inicia sesión en ECR con el rol de la instancia. Sustituye el ID de cuenta del registro antes de ejecutar:

   ```bash
   cd /opt/dengue
   registry=123456789012.dkr.ecr.us-east-1.amazonaws.com
   aws ecr get-login-password --region us-east-1 |
     sudo docker login --username AWS --password-stdin "$registry"
   sudo docker compose pull
   sudo docker logout "$registry"
   sudo docker compose up -d --no-build --pull never --wait
   sudo docker compose ps
   curl -fsS http://127.0.0.1:8080/backend/health
   ```

5. **Publicar y verificar por HTTPS.** Configura el Nginx del host con un certificado para la IP pública y un proxy hacia `127.0.0.1:8080`. La demostración usa Let’s Encrypt y Certbot con renovación automática. Habilita TCP 443 en el grupo de seguridad y conserva TCP 80 para el desafío ACME y la redirección. Mantén los puertos 8080 y 8000 fuera del acceso público. Comprueba la página, `/backend/health` y el flujo de carga y descarga de Excel desde el navegador.

## Credenciales

El dashboard público y el entorno de desarrollo no requieren usuario ni contraseña. Para publicar en ECR, usa una sesión de AWS CLI con permisos de publicación. En EC2, Docker descarga las imágenes con el rol de instancia. Las referencias de ejemplo en `.env` identifican imágenes y no contienen credenciales.
