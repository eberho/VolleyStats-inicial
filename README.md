# VolleyStats

App mobile-first para registrar estadísticas de voleibol en vivo desde la banda.
Funciona en modo local (localStorage) sin configurar nada, y opcionalmente sincroniza con Supabase.

## Ejecutar en local

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev
```

Abre la URL que aparece en la terminal (normalmente http://localhost:5173).

## Desplegar en Vercel

1. Sube esta carpeta a un repositorio de GitHub:

   ```bash
   git init
   git add .
   git commit -m "VolleyStats inicial"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/volleystats.git
   git push -u origin main
   ```

2. En vercel.com: **Add New → Project**, importa el repo.
   Vercel detecta Vite automáticamente:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. Pulsa **Deploy**. Cada `git push` posterior redespliega solo.

## Conectar Supabase (opcional)

1. En tu proyecto Supabase, abre el **SQL Editor** y ejecuta el contenido de
   `supabase_schema.sql` para crear las tablas con Row Level Security.
2. Activa el proveedor de Email en *Authentication → Providers*.
3. En la app desplegada, entra a **Ajustes** y pega tu Project URL + anon key.

Sin este paso, la app guarda todo en el dispositivo (modo local).

## Estructura

```
volleystats-app/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── supabase_schema.sql
└── src/
    ├── main.jsx
    ├── App.jsx
    └── VolleyStats.jsx
```
