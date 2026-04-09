<p align="center">
  <img src="./app/icon.svg" width="80" height="80" alt="Lab Alta Logo" />
</p>

# Lab Alta: Sistema de Inteligencia Operativa

> **Base de Control Avanzada** construida sobre el ecosistema de Next.js, diseñada para la gestión cinemática de datos de laboratorio, análisis de muestras y seguridad de grado militar.

[![Stack: Next.js](https://img.shields.io/badge/Framework-Next.js%2015-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Auth: Firebase](https://img.shields.io/badge/Security-Firebase%20Auth-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Style: Tailwind](https://img.shields.io/badge/Design-Tailwind%20CSS-blue?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Animation: GSAP](https://img.shields.io/badge/Motion-GSAP-green?style=for-the-badge&logo=greensock)](https://gsap.com/)

---

## 🛠️ Módulos de Operación

La plataforma se despliega en tres frentes críticos de análisis:

* **🛡️ Control de Defectos:** Monitoreo y trazabilidad de fallos en procesos.
* **📥 Gestión de Descargas:** Flujo logístico y recepción de insumos.
* **🔬 Análisis de Muestras:** Núcleo de datos científicos y resultados de laboratorio.

---

## ⚡ Instalación y Arranque Rápido

Sigue esta secuencia para inicializar el entorno local:

1.  **Clonar el repositorio y entrar al directorio:**
    ```bash
    git clone [https://github.com/tu-usuario/lab-alta.git](https://github.com/tu-usuario/lab-alta.git)
    cd lab-alta
    ```

2.  **Instalar dependencias de combate:**
    ```bash
    npm install
    ```

3.  **Configurar las coordenadas (Variables de Entorno):**
    Copia el archivo de ejemplo y completa tus credenciales.
    ```bash
    cp .env.local.example .env.local
    ```

4.  **Iniciar el motor de desarrollo:**
    ```bash
    npm run dev
    ```
    🌐 Acceso local en: `http://localhost:3000`

---

## 🔐 Arquitectura de Seguridad (Zero-Trust)

El sistema implementa un protocolo de seguridad híbrido para garantizar la integridad de los datos:

### 1. Validación Humana (Cloudflare Turnstile)
Cada intento de login es analizado por el widget de **Turnstile** para bloquear bots de forma invisible, manteniendo la estética fluida.

### 2. Capas de Acceso (Auth Flow)
* **Operadores Autorizados (Email/Pass):** Acceso total a la base de datos según UID y Allowlist.
* **Usuarios Invitados (Google OAuth):** Modo "Sights-Only" (Solo lectura de UI, acceso bloqueado a Firestore vía `firestore.rules`).

### 3. Blindaje de Base de Datos
Las reglas de Firestore están configuradas para rechazar cualquier petición que no provenga de un UID autorizado, independientemente del estado de autenticación de Google.

---

## 📂 Estructura del Sistema

```text
.
├── app/                # El núcleo: Layouts cinemáticos y estilos globales
├── components/
│   ├── auth/           # Protocolos de acceso y Turnstile
│   ├── dashboard/      # El HUD (Heads-Up Display) principal
│   └── modules/        # Unidades funcionales (Defectos, Muestras, Descargas)
├── lib/                # Servicios de Firebase, Firestore y Lógica de Negocio
├── registros/          # Almacenamiento local de datos operativos
├── types/              # Definiciones de dominio y modelos de datos
└── apphosting.yaml     # Configuración de despliegue en Google Cloud
```
## 📋 Variables de Configuración

* **(.env)NEXT_PUBLIC_FIREBASE_:** Credenciales públicas de conexión con el SDK de Firebase.
* **NEXT_PUBLIC_TURNSTILE_SITE_KEYClave:** pública para el widget de Cloudflare.
* **TURNSTILE_SECRET_KEYValidación:** en servidor para el token de Turnstile.
* **FIREBASE_ADMIN_:** Claves de acceso privado (Solo para operaciones de servidor).

# 🚀 Próximos Pasos (Hoja de Ruta)[ ] 
* [ ] **Fase 1:** Migrar todos los mocks de datos a peticiones reales de Firestore.
* [ ] **Fase 2:** Implementar el exportador dinámico a PDF con jsPDF para reportes de muestras.
* [ ] **Fase 3:** Refinar las animaciones de entrada de GSAP para los módulos de análisis.
* [ ] **Fase 4:** Auditoría final de reglas de seguridad en producción.
---
<p align="center">
Hecho con ❤️ para la excelencia operativa de ALTA S.A </p> 
<p align="center"> <b>Juan Jesus Perez</b> (https://github.com/juanjesusgrvch)
</p>
