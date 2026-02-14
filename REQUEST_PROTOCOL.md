# Protocolo para Solicitar Cambios (DinoPlatform)

Este documento sirve como guía para solicitar cambios o nuevas funcionalidades sin romper la integridad, seguridad y rendimiento de la arquitectura actual.

---

## 1. Arquitectura Actual (La "Verdad Absoluta")
Antes de pedir un cambio, recuerda que la app funciona sobre estos pilares. **No solicites tecnologías que salgan de este stack** a menos que sea estrictamente necesario.

- **Frontend**: React + Vite (SPA).
- **Backend / BDD**: Supabase (PostgreSQL).
- **Offline / Local**: Dexie.js (IndexedDB) <- *Crítico: Todo debe funcionar sin internet.*
- **Estilos**: Vannila CSS con sistema de variables (`index.css`) y Glassmorphism (`.glass`).
- **Hosting**: Vercel.

---

## 2. Reglas de Oro para Nuevas Funcionalidades

### A. Primero la Base de Datos (Supabase)
Si pides un nuevo módulo (ej. "Gestión de Mantenimiento"), siempre especifica:
1.  **Tablas necesarias**: ¿Qué datos guardará?
2.  **Seguridad (RLS)**: ¿Es información privada por Tenant? *Siempre debe tener `tenant_id`.*
3.  **Script de Migración**: Pide siempre el SQL para correrlo en Supabase, no cambios manuales.

### B. Piensa en "Offline" (Dexie.js)
DinoPlatform es "Offline-First". Si agregas datos en Supabase, **debes** preguntar:
> *"¿Cómo sincronizamos esto en Dexie para que funcione sin internet?"*
*   Los cambios deben reflejarse en `src/lib/db.js`.
*   La sincronización en `src/lib/sync.js`.

### C. UI/UX: Consistencia Visual
No pidas "un modal nuevo". Pide **usar los componentes existentes**:
*   **Modales**: Usar estructura `.modal-overlay` / `.modal-content`.
*   **Alertas**: Nunca usar `alert()` o `window.confirm()`. Usar `<Toast />` y `<ConfirmationModal />`.
*   **Estilo**: Pedir siempre estilo "Glassmorphism Dark Mode".

---

## 3. Plantilla para Solicitar Cambios (Prompt Ideal)

Copia y pega esto cuando hables con tu asistente de IA para obtener el mejor resultado:

> **Objetivo**: [Describe qué quieres hacer, ej. Agregar un campo de 'Teléfono' a las Locaciones]
>
> **Restricciones de Arquitectura**:
> 1. **BDD**: Agrega el campo en Supabase (`locations`) y en Dexie (`db.js`).
> 2. **Sincronización**: Asegúrate de que `sync.js` traiga este nuevo dato.
> 3. **UI**: Usa los inputs oscuros existentes y el estilo `.glass`.
> 4. **Seguridad**: Asegura que el RLS permita editar este campo.
>
> **Pregunta de Control**: ¿Este cambio afecta la funcionalidad offline?

---

## 4. Qué EVITAR (Red Flags) 🚩

*   ❌ **"Agrega un backend en Node/Express"**: No. Usamos Supabase Edge Functions si necesitamos lógica de servidor.
*   ❌ **"Usa Bootstrap/Tailwind"**: No. Usamos CSS nativo optimizado.
*   ❌ **"Haz una consulta directa a la BDD en el componente"**: Cuidado. Preferir `Dexie` para lecturas (rápido/offline) y `Supabase` para escrituras/sincronización.
*   ❌ **"Borra la tabla X y hazla de nuevo"**: Peligroso. Siempre pedir migraciones `ALTER TABLE`.

---

## 5. Checklist Antes de Aprobar un Cambio
1.  ¿Funciona si desconecto el internet?
2.  ¿Se ve bien en el celular (Responsive)?
3.  ¿Si recargo la página, los datos siguen ahí?
4.  ¿Un usuario de OTRA cuenta puede ver esto? (Test de Seguridad).
