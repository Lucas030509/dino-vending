# Project Rules & Customizations

## 🛠 Tech Stack & Infrastructure
- **Backend / Database:** [Supabase](https://supabase.com)
  - Auth, Database (PostgreSQL), Storage, Edge Functions.
- **Frontend Hosting:** [Vercel](https://vercel.com)
  - Automatic deployments from `main` branch.
- **Frontend Framework:** React + Vite
- **Local Database (Offline):** Dexie.js (IndexedDB)

## 🎨 UI/UX Design Standards
- **Global Style:** Dark mode with Glassmorphism (`.glass`).
- **Modals:**
  - Wrapper: `.modal-overlay`
  - Content: `.modal-content` (typically with `.glass`)
  - Actions: `.modal-actions`
  - Close Button: Standard top-right close or bottom "Cancelar".
- **Buttons:**
  - Primary: `.btn-primary` (Use proper icons from `lucide-react`)
  - Secondary/Cancel: `.btn-secondary`
  - Action/Icon only: `.action-btn`
- **Inputs:**
  - Standard inputs with dark background and light text.
  - Search bars should use `.search-input-wrapper` pattern.
- **Consistency:**
  - Reuse `Machines.css` or global styles where possible.
  - Ensure all new modules match the existing "Machines" and "Dashboard" aesthetic.
