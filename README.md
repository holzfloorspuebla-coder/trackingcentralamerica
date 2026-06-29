# RegionMap — Guía de instalación con Supabase + Render

## Arquitectura
- **Base de datos**: Supabase (PostgreSQL gratuito)
- **Servidor**: Render (Node.js gratuito)
- **Acceso**: desde cualquier computadora con usuario y contraseña

---

## PARTE 1 — Configurar Supabase (base de datos)

### 1. Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Clic en **New project**
3. Elige un nombre (ej. `regionmap`) y una contraseña segura para la BD
4. Selecciona la región más cercana (us-east-1 o eu-west-1)
5. Espera ~2 minutos a que termine de crear

### 2. Crear las tablas
1. En tu proyecto Supabase → menú izquierdo → **SQL Editor**
2. Clic en **New query**
3. Copia y pega todo el contenido del archivo `schema.sql`
4. Clic en **Run** (▶)
5. Deberías ver: "Success. No rows returned"

### 3. Obtener la cadena de conexión
1. En Supabase → **Settings** (ícono engranaje) → **Database**
2. Baja hasta **Connection string** → elige **URI**
3. Copia la cadena — se ve así:
   ```
   postgresql://postgres:[TU-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
4. Reemplaza `[TU-PASSWORD]` con la contraseña que elegiste al crear el proyecto
5. Guarda esta cadena — la necesitas en el siguiente paso

---

## PARTE 2 — Subir el código a GitHub

### 1. Crear cuenta en GitHub
Ve a [github.com](https://github.com) y regístrate si no tienes cuenta.

### 2. Crear repositorio
1. Clic en el ícono **+** → **New repository**
2. Nombre: `regionmap`
3. Visibilidad: **Private** (recomendado)
4. Clic en **Create repository**

### 3. Subir los archivos
En la página del repositorio vacío:
1. Clic en **uploading an existing file**
2. Descomprime el ZIP `regionmap-supabase.zip`
3. Arrastra TODOS los archivos y carpetas al navegador
   - ⚠️ No subas la carpeta `node_modules` si existe
   - ⚠️ No subas el archivo `.env`
4. Clic en **Commit changes**

---

## PARTE 3 — Desplegar en Render

### 1. Crear cuenta en Render
Ve a [render.com](https://render.com) y regístrate con tu cuenta de GitHub.

### 2. Crear el servicio web
1. Dashboard → **New** → **Web Service**
2. Conecta tu cuenta de GitHub si se pide
3. Selecciona el repositorio `regionmap`
4. Render detecta Node.js automáticamente. Configura:
   - **Name**: `regionmap`
   - **Region**: la más cercana a ti
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance type**: Free

### 3. Agregar las variables de entorno
En la misma pantalla, baja hasta **Environment Variables** y agrega:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | La cadena de conexión de Supabase (del paso 1.3) |
| `JWT_SECRET` | Una cadena larga y aleatoria (ej. 40+ caracteres mezclados) |

Para generar un JWT_SECRET seguro puedes usar: [randomkeygen.com](https://randomkeygen.com)

### 4. Desplegar
1. Clic en **Create Web Service**
2. Render empieza a instalar y arrancar — tarda 2-3 minutos
3. Cuando veas `==> Your service is live 🎉` ya está

### 5. Obtener tu URL
Render te da una URL como: `https://regionmap-xxxx.onrender.com`

Esa es la URL de tu aplicación — puedes acceder desde cualquier computadora.

---

## Acceso inicial

| Pantalla | URL |
|----------|-----|
| Mapa | `https://tu-app.onrender.com` |
| Configurador | `https://tu-app.onrender.com/admin` |

**Usuarios por defecto:**

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `admin1234` | Admin completo |
| `viewer` | `viewer123` | Solo lectura |

⚠️ **Cambia las contraseñas inmediatamente** — entra al configurador → Usuarios

---

## Nota sobre el plan gratuito de Render

En el plan gratuito, el servidor "duerme" después de 15 minutos de inactividad.
La primera visita tras un período de inactividad puede tardar 30-50 segundos en cargar.

Para evitar esto, opciones:
- **Plan Starter de Render** (~$7/mes) — siempre activo
- **Railway** (~$5/mes) — alternativa, siempre activo
- Usar un servicio de "ping" gratuito como [UptimeRobot](https://uptimerobot.com) que hace una petición a tu URL cada 10 min para mantenerlo despierto (funciona con el plan gratuito)

---

## Estructura del proyecto

```
regionmap-supabase/
├── server.js              # Servidor Express
├── db.js                  # Pool de conexión PostgreSQL
├── schema.sql             # ← Ejecutar en Supabase SQL Editor
├── package.json
├── .env.example           # Plantilla de variables
├── .gitignore
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js            # Login, usuarios, JWT
│   ├── countries.js       # Datos país, segmentos, competidores
│   ├── clients.js         # Clientes + historial
│   └── projects.js        # Proyectos + historial de fases
└── public/
    ├── index.html         # Mapa interactivo
    └── admin.html         # Configurador completo
```

---

## Backup de la base de datos

Supabase hace backups automáticos diarios (plan gratuito: 7 días de retención).

Para exportar manualmente:
- Supabase → **Database** → **Backups** → Download
