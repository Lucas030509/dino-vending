# Plan Maestro: DinoVending Offline-First 🦖📶

Este plan detalla la transformación de la aplicación web actual a una **Progressive Web App (PWA)** totalmente funcional sin conexión a internet.

## 🎯 Objetivo
Permitir que los operarios realicen rutas, rellenos y recolectas en zonas sin señal (sótanos, carreteras), sincronizando los datos automáticamente cuando recuperen la conexión.

---

## 🏗 Fase 1: Transformación a PWA (Infraestructura)
El primer paso es asegurar que la aplicación pueda "instalarse" y cargar sus archivos base (HTML/CSS/JS) sin red.

1.  **Instalación de Dependencias**:
    *   `vite-plugin-pwa`: Para generar el Service Worker y el manifiesto automágicamente.
2.  **Configuración de Vite**:
    *   Inyectar el plugin en `vite.config.js`.
    *   Configurar estrategias de caché (`stale-while-revalidate` para recursos estáticos).
3.  **Web App Manifest**:
    *   Definir iconos, nombre corto ("DinoApp"), colores de tema y `display: standalone`.
4.  **Entry Point Update**:
    *   Registrar el Service Worker en `main.jsx` para permitir actualizaciones automáticas.

**Resultado:** La app se puede instalar en Android/iOS y abre sin internet (aunque muestre datos vacíos o viejos por ahora).

---

## 💾 Fase 2: Base de Datos Local (IndexedDB)
Necesitamos un espejo local de los datos de Supabase. Usaremos **Dexie.js** (IndexedDB) por su rendimiento y facilidad de uso.

1.  **Tecnología**: `dexie` + `dexie-react-hooks`.
2.  **Esquema Local (`db.js`)**:
    *   `machines`: id, name, zone, address, latitude, longitude, last_stock...
    *   `routes`: id, date, status, stops (array).
    *   `products`: id, name, price.
    *   `sync_queue`: id, action_type, payload, timestamp, status ('pending', 'failed').
3.  **Estrategia de Sincronización de Lectura (Pull)**:
    *   Al abrir la app (con internet), descargar "Todo" de Supabase y volcarlo a Dexie.
    *   La UI dejará de leer de Supabase directamente y leerá de Dexie. Esto hace la app **instantánea**.

---

## 🔄 Fase 3: Sincronización de Escritura (El "Queue System")
Aquí está la clave. Cuando el usuario hace un cambio, no llamamos a Supabase directamente de forma bloqueante.

1.  **Interceptar Acciones**:
    *   Crear un `OfflineMutationHook`.
2.  **Flujo "Offline-First"**:
    *   El usuario guarda un relleno.
    *   **Paso 1:** Guardar el cambio inmediatamente en Dexie (`machines`) para que la UI se actualice al instante.
    *   **Paso 2:** Crear un registro en la tabla `sync_queue` con los datos del envío.
    *   **Paso 3:** El `SyncManager` detecta el nuevo item en la cola.
        *   Si hay internet -> Intenta enviar a Supabase. Si éxito -> Borra de la cola.
        *   Si no hay internet -> Espera al evento `window.online`.
3.  **Manejo de Conflictos**:
    *   Estrategia "Last Write Wins" (El último cambio gana) para la mayoría de campos simples.

---

## 🎨 Fase 4: Experiencia de Usuario (UI/UX)
El usuario debe saber qué está pasando.

1.  **Indicadores de Estado**:
    *   🟢 Online (Todo sincronizado).
    *   🟠 Syncing (Subiendo cambios...).
    *   🔴 Offline (Trabajando en local).
2.  **Banner de Notificación**:
    *   "Estás sin conexión. Los cambios se guardarán localmente."
3.  **Página de Estado de Sincronización**:
    *   Ver cuántos elementos están pendientes de subir (por si el usuario quiere cerrar sesión).

---

## 📅 Plan de Ejecución Inmediato

### Paso 1: Configurar PWA (Hoy)
Instalar plugin, configurar vite y validar que la app es instalable.

### Paso 2: Implementar Dexie.js (Mañana)
Crear la DB local y mover la lectura de "Máquinas" a local.

### Paso 3: Implementar Cola (Siguiente)
Hacer que los rellenos funcionen offline.
