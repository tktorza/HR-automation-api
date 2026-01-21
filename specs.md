# 🚀 HR-Automation - Cahier des Charges Complet

**Version:** 1.0  
**Date:** 20 janvier 2026  
**Client:** Léo Wolkowicz  
**Développeur:** Tom Ktorza  
**Contact:** tom@klack.io

---

## 📋 Table des matières

1. [Vision Produit](#vision-produit)
2. [Architecture Technique](#architecture-technique)
3. [Stack Technologique](#stack-technologique)
4. [Schéma Base de Données](#schéma-base-de-données)
5. [API Backend - Endpoints](#api-backend-endpoints)
6. [Frontend - Spécifications](#frontend-spécifications)
7. [Système de Scraping LinkedIn](#système-de-scraping-linkedin)
8. [Intelligence Artificielle - LLM](#intelligence-artificielle-llm)
9. [Authentification & Sécurité](#authentification-sécurité)
10. [Multi-tenant](#multi-tenant)
11. [Notifications & Emails](#notifications-emails)
12. [Déploiement Docker/Kubernetes](#déploiement-dockerkubernetes)
13. [Monitoring & Logs](#monitoring-logs)
14. [Roadmap de Développement](#roadmap-de-développement)
15. [Budget & Infrastructure](#budget-infrastructure)
16. [Règles Antigravity](#règles-antigravity)
17. [Plan de Tests](#plan-de-tests)
18. [Annexes](#annexes)

---

## 1. Vision Produit

### 1.1 Problématique

Léo Wolkowicz, recruteur spécialisé dans les niches Tech (IA, Web3, LLM Engineers), gère un volume important de conversations LinkedIn (15-20 entretiens/semaine). Actuellement assisté par un VA philippin pour trier/répondre aux messages, il souhaite **automatiser complètement** ce processus avec un agent IA fiable et rapide.

### 1.2 Solution

**HR-Automation** est une plateforme SaaS permettant de :
- **Scraper automatiquement** les messages LinkedIn entrants
- **Analyser** les conversations avec un LLM (Claude Sonnet 4.5)
- **Répondre automatiquement** selon le style/règles du recruteur
- **Proposer des rendez-vous** via lien calendrier Google
- **Escalader** à l'humain en cas d'incertitude
- **Gérer** plusieurs recruteurs (multi-tenant)

### 1.3 Valeur Ajoutée

- ⚡ **Réactivité 24/7** : Réponses instantanées aux candidats
- 🎯 **Cohérence** : Respect du ton/style du recruteur
- 📊 **Traçabilité** : Historique complet, logs LLM
- 💰 **Économies** : Remplace assistant humain à 80%
- 🚀 **Scalabilité** : Gère plusieurs comptes simultanément

### 1.4 Périmètre V1 (PoC - Phase 1)

**Fonctionnalités prioritaires :**
- ✅ Scraping LinkedIn (messages non-lus + historique)
- ✅ Détection nouveaux messages
- ✅ Analyse LLM + réponse automatique
- ✅ Envoi lien calendrier Google
- ✅ Escalade si incertitude (email notification)
- ✅ Dashboard liste conversations actives
- ✅ Config credentials LinkedIn/Google/Claude
- ✅ Onboarding questionnaire (détection style auto)
- ✅ Notifications email (erreurs, escalades, succès)

**Hors scope V1 :**
- ❌ Intégration Notion CRM (Phase 2)
- ❌ WhatsApp (Phase 3)
- ❌ Analytics avancées (Phase 3)
- ❌ Multi-langues (seulement EN/FR en V1)

---

## 2. Architecture Technique

### 2.1 Diagramme d'Architecture Globale

```mermaid
graph TB
    subgraph "Client Side"
        A[Browser - Frontend React]
    end
    
    subgraph "Backend Services - Hostinger VPS KVM 8"
        B[NestJS API Gateway]
        C[Bull Queue Worker]
        D[Puppeteer Scraper]
        E[PostgreSQL Database]
    end
    
    subgraph "External Services"
        F[LinkedIn]
        G[Claude API - Anthropic]
        H[Google Calendar API]
        I[SMTP Server]
    end
    
    A -->|HTTPS/WSS| B
    B --> C
    C --> D
    D -->|Scrape Messages| F
    B -->|LLM Calls| G
    B -->|Create Events| H
    B -->|Send Notifications| I
    B <--> E
    C <--> E
    
    style A fill:#4A90E2
    style B fill:#50E3C2
    style C fill:#F5A623
    style D fill:#D0021B
    style E fill:#7ED321
```

### 2.2 Flux de Données Principal

```mermaid
sequenceDiagram
    participant Worker as Bull Worker
    participant LinkedIn as LinkedIn
    participant DB as PostgreSQL
    participant LLM as Claude API
    participant User as Léo (Email)
    participant Calendar as Google Calendar
    
    Note over Worker: Toutes les X minutes (configurable)
    
    Worker->>LinkedIn: Scrape nouveaux messages
    LinkedIn-->>Worker: Messages JSON
    Worker->>DB: Check si message existe
    DB-->>Worker: Nouveau message détecté
    Worker->>DB: Récupère contexte conversation
    Worker->>LLM: Prompt système + historique + nouveau message
    
    alt LLM confiant (>70%)
        LLM-->>Worker: Action: "reply" + texte
        Worker->>LinkedIn: Envoie réponse
        Worker->>DB: Log action (replied)
    else LLM incertain (<70%)
        LLM-->>Worker: Action: "escalate"
        Worker->>User: Email notification + lien conversation
        Worker->>DB: Log action (escalated)
    else Action: meeting_proposed
        LLM-->>Worker: Action: "send_calendar_link"
        Worker->>LinkedIn: Envoie lien calendrier
        Worker->>DB: Log action (meeting_proposed)
    end
    
    Worker->>DB: Update statut conversation
```

### 2.3 Architecture des Services

**Service 1 - Frontend (React + Vite)**
- Port: 3000 (dev), production via Nginx
- Communique via REST API + WebSocket (notifications temps réel)
- Build statique déployé dans conteneur Nginx

**Service 2 - Backend API (NestJS)**
- Port: 4000
- Expose REST API + WebSocket Gateway
- Gère auth, CRUD, orchestration

**Service 3 - Worker Scraping (Intégré NestJS via Bull)**
- Pas de port exposé (job queue interne)
- Consomme jobs de la queue Redis (ou In-Memory si budget tight)
- Exécute Puppeteer en mode headless

**Service 4 - PostgreSQL**
- Port: 5432 (localhost uniquement)
- Connexion directe depuis NestJS
- Pas de conteneur Docker (installé sur host VPS)

---

## 3. Stack Technologique

### 3.1 Frontend

| Technologie | Version | Rôle |
|------------|---------|------|
| **React** | 18.3+ | Framework UI |
| **TypeScript** | 5.3+ | Langage (règles souples) |
| **Vite** | 6.0+ | Build tool ultra-rapide |
| **React Router** | 7.x | Routing SPA |
| **Tailwind CSS** | 4.0 | Styling utility-first |
| **shadcn/ui** | Latest | Composants UI pré-construits |
| **React Query** | 5.x | Gestion état serveur/cache |
| **Zustand** | 4.x | State management global léger |
| **Axios** | 1.6+ | Client HTTP |
| **Socket.IO Client** | 4.7+ | WebSocket temps réel |

**Justification Vite vs Next.js :**
- Backoffice/SaaS interne (pas de SEO requis)
- Plus léger, build plus rapide
- Pas besoin SSR/SSG

### 3.2 Backend

| Technologie | Version | Rôle |
|------------|---------|------|
| **NestJS** | 10.x | Framework API (TypeScript) |
| **Prisma** | 5.x | ORM type-safe |
| **PostgreSQL** | 16+ | Base de données relationnelle |
| **Bull** | 4.x | Job queue (scraping asynchrone) |
| **Passport.js** | 0.7+ | Authentification JWT |
| **Puppeteer** | 22.x | Scraping LinkedIn headless browser |
| **Nodemailer** | 6.9+ | Envoi emails SMTP |
| **class-validator** | 0.14+ | Validation DTO |
| **bcrypt** | 5.1+ | Hash passwords |
| **crypto (Node.js)** | Built-in | Chiffrement AES-256-GCM credentials |

### 3.3 Services Externes

| Service | Utilisation | Coût |
|---------|-------------|------|
| **Anthropic Claude API** | LLM (Sonnet 4.5) | User fournit sa clé |
| **Google Calendar API** | Création événements | Gratuit |
| **SMTP Gmail/Outlook** | Notifications emails | Gratuit (limites/jour) |
| **LinkedIn** | Source de données | Gratuit (scraping) |

### 3.4 DevOps & Infrastructure

| Outil | Utilisation |
|-------|-------------|
| **Docker** | Containerisation Frontend + Backend |
| **Kubernetes** | Orchestration (cluster Hostinger existant) |
| **Git (2 repos)** | hr-automation-frontend / hr-automation-backend |
| **Winston** | Logging structuré |
| **Sentry** (Optionnel V2) | Error tracking |

---

## 4. Schéma Base de Données

### 4.1 Schéma PostgreSQL Complet

```sql
-- ============================================
-- TABLE: tenants (multi-tenant support)
-- ============================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- ex: "leo-wolkowicz"
    settings JSONB DEFAULT '{}', -- Config globale
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Index
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- ============================================
-- TABLE: users (utilisateurs de l'app)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt
    role VARCHAR(50) DEFAULT 'admin', -- admin, viewer
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Index
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- TABLE: linkedin_accounts (credentials chiffrés)
-- ============================================
CREATE TABLE linkedin_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email_encrypted TEXT NOT NULL, -- AES-256-GCM
    password_encrypted TEXT NOT NULL, -- AES-256-GCM
    session_cookies TEXT, -- JSON chiffré des cookies
    last_scrape_at TIMESTAMPTZ,
    session_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    scrape_frequency_minutes INT DEFAULT 10, -- Configurable par tenant
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_linkedin_tenant ON linkedin_accounts(tenant_id);

-- ============================================
-- TABLE: contacts (candidats/clients)
-- ============================================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    linkedin_profile_url TEXT UNIQUE NOT NULL,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255),
    type VARCHAR(50) DEFAULT 'candidate', -- candidate, client
    source VARCHAR(50) DEFAULT 'linkedin_standard', -- linkedin_recruiter, linkedin_standard, telegram, email
    status VARCHAR(50) DEFAULT 'new', -- new, replied, meeting_proposed, meeting_booked, escalated, closed
    job_title VARCHAR(255),
    company VARCHAR(255),
    metadata JSONB DEFAULT '{}', -- Champs additionnels flexibles
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_status ON contacts(tenant_id, status);
CREATE INDEX idx_contacts_type ON contacts(tenant_id, type);
CREATE INDEX idx_contacts_linkedin_url ON contacts(linkedin_profile_url);

-- ============================================
-- TABLE: conversations (historique messages)
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    messages JSONB DEFAULT '[]', -- Array de messages [{sender, text, timestamp}]
    last_message_at TIMESTAMPTZ,
    last_scraped_at TIMESTAMPTZ,
    unread_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_last_message ON conversations(tenant_id, last_message_at DESC);

-- ============================================
-- TABLE: llm_actions (logs des actions LLM)
-- ============================================
CREATE TABLE llm_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- reply, escalate, send_calendar_link, meeting_booked
    confidence_score DECIMAL(5,2), -- 0.00 - 100.00
    prompt TEXT, -- Prompt envoyé au LLM
    llm_response JSONB, -- Réponse complète du LLM (JSON)
    final_message TEXT, -- Message envoyé au candidat (si reply)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_llm_actions_conversation ON llm_actions(conversation_id);
CREATE INDEX idx_llm_actions_tenant ON llm_actions(tenant_id);
CREATE INDEX idx_llm_actions_type ON llm_actions(tenant_id, action_type);
CREATE INDEX idx_llm_actions_created ON llm_actions(tenant_id, created_at DESC);

-- ============================================
-- TABLE: notifications (emails/alerts)
-- ============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- escalate, error_scraping, error_technical, meeting_booked
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    message TEXT,
    metadata JSONB DEFAULT '{}', -- Liens, contexte additionnel
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_type ON notifications(tenant_id, type);
CREATE INDEX idx_notifications_sent ON notifications(tenant_id, sent_at DESC);

-- ============================================
-- TABLE: llm_quotas (gestion budgets Claude)
-- ============================================
CREATE TABLE llm_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- Format: "2026-01"
    tokens_consumed BIGINT DEFAULT 0,
    estimated_cost_usd DECIMAL(10,2) DEFAULT 0.00,
    monthly_limit_usd DECIMAL(10,2) DEFAULT 50.00, -- Configurable
    is_limit_reached BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, month_year)
);

-- Index
CREATE INDEX idx_llm_quotas_tenant ON llm_quotas(tenant_id);

-- ============================================
-- TABLE: onboarding_configs (questionnaire)
-- ============================================
CREATE TABLE onboarding_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    detected_style JSONB, -- Auto-détecté depuis convos scrapées
    user_adjustments JSONB, -- Modifications manuelles user
    business_info JSONB, -- Nom entreprise, secteur, profils recherchés
    response_rules JSONB, -- Règles de quand proposer meeting, infos à demander, sujets interdits
    calendar_link TEXT, -- https://calendar.app.google/...
    confidence_threshold INT DEFAULT 70, -- Seuil escalade (0-100)
    notification_emails TEXT[], -- Array d'emails pour notifs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Index
CREATE INDEX idx_onboarding_tenant ON onboarding_configs(tenant_id);
```

### 4.2 Relations et Cardinalités

```
tenants (1) ──< (N) users
tenants (1) ──< (N) linkedin_accounts
tenants (1) ──< (N) contacts
tenants (1) ──< (N) conversations
tenants (1) ──< (N) llm_actions
tenants (1) ──< (N) notifications
tenants (1) ──< (N) llm_quotas
tenants (1) ──< (1) onboarding_configs

contacts (1) ──< (N) conversations
conversations (1) ──< (N) llm_actions
```

### 4.3 Stratégie d'Indexation

**Optimisations critiques :**
- Index composés sur `(tenant_id, status)` pour filtres dashboard
- Index JSONB GIN sur `messages` pour recherche full-text (Phase 2)
- Partitionnement table `llm_actions` par mois si >1M lignes (Phase 3)

---

## 5. API Backend - Endpoints

### 5.1 Authentification

```
POST   /api/auth/register
Body: { email, password, tenant_name }
Response: { user, access_token }

POST   /api/auth/login
Body: { email, password }
Response: { user, access_token }

POST   /api/auth/logout
Headers: Authorization: Bearer {token}
Response: { message: "Logged out" }

GET    /api/auth/me
Headers: Authorization: Bearer {token}
Response: { user }
```

### 5.2 Tenants & Settings

```
GET    /api/tenants/:id
Headers: Authorization: Bearer {token}
Response: { tenant }

PATCH  /api/tenants/:id/settings
Body: { settings: {...} }
Response: { tenant }

GET    /api/tenants/:id/onboarding
Response: { onboarding_config }

POST   /api/tenants/:id/onboarding
Body: { detected_style, user_adjustments, business_info, ... }
Response: { onboarding_config }
```

### 5.3 LinkedIn Integration

```
POST   /api/linkedin/connect
Body: { email_encrypted, password_encrypted }
Response: { linkedin_account }

GET    /api/linkedin/status
Response: { is_active, last_scrape_at, session_expires_at }

POST   /api/linkedin/scrape-now
Response: { job_id, status: "queued" }

DELETE /api/linkedin/disconnect
Response: { message: "Disconnected" }
```

### 5.4 Conversations

```
GET    /api/conversations
Query: ?status=new&page=1&limit=20
Response: { conversations[], total, page, limit }

GET    /api/conversations/:id
Response: { conversation, contact, llm_actions[] }

POST   /api/conversations/:id/override
Body: { message_text }
Response: { conversation, llm_action }

PATCH  /api/conversations/:id/status
Body: { status: "closed" }
Response: { conversation }
```

### 5.5 Contacts

```
GET    /api/contacts
Query: ?type=candidate&source=linkedin_recruiter
Response: { contacts[], total }

GET    /api/contacts/:id
Response: { contact, conversations[] }

PATCH  /api/contacts/:id
Body: { email, status, metadata }
Response: { contact }

DELETE /api/contacts/:id
Response: { message: "Contact deleted" }
```

### 5.6 Analytics & Dashboard

```
GET    /api/analytics/dashboard
Response: {
  total_messages_processed,
  total_meetings_created,
  llm_success_rate,
  current_month_cost,
  quota_remaining
}

GET    /api/analytics/llm-actions
Query: ?from=2026-01-01&to=2026-01-31
Response: { llm_actions[], stats }
```

### 5.7 Notifications

```
GET    /api/notifications
Query: ?type=escalate&unread=true
Response: { notifications[], total }

PATCH  /api/notifications/:id/read
Response: { notification }
```

### 5.8 LLM Quotas

```
GET    /api/quotas/current
Response: {
  month_year: "2026-01",
  tokens_consumed,
  estimated_cost_usd,
  monthly_limit_usd,
  is_limit_reached
}

PATCH  /api/quotas/limit
Body: { monthly_limit_usd: 100 }
Response: { quota }
```

---

## 6. Frontend - Spécifications

### 6.1 Structure des Pages

```
/
├── /login                    # Auth
├── /register                 # Auth
├── /dashboard                # Vue principale
│   ├── /conversations        # Liste conversations
│   │   └── /:id              # Détail conversation
│   ├── /contacts             # Gestion contacts
│   ├── /analytics            # Stats & métriques
│   ├── /settings             # Configuration
│   │   ├── /linkedin         # Credentials LinkedIn
│   │   ├── /claude           # API Key Claude
│   │   ├── /onboarding       # Questionnaire style
│   │   ├── /notifications    # Emails & alertes
│   │   └── /quotas           # Gestion budget LLM
│   └── /logs                 # Logs actions LLM (debug)
```

### 6.2 Composants Clés

**Dashboard.tsx**
- Stats cards (messages traités, meetings, taux succès)
- Graphiques Recharts (évolution temps)
- Alertes quota LLM

**ConversationsList.tsx**
- Table triable/filtrable (shadcn/ui DataTable)
- Colonnes: Contact, Status, Dernier message, Action LLM, Date
- Pagination
- Filtres: Status, Type contact, Source

**ConversationDetail.tsx**
- Historique messages (chat UI)
- Timeline actions LLM (badges colorés par type)
- Bouton "Override" (modal textarea pour réponse manuelle)
- Infos contact (sidebar)

**OnboardingWizard.tsx**
- Étape 1: Analyse auto conversations scrapées (loader)
- Étape 2: Validation style détecté (formulaire pré-rempli)
- Étape 3: Infos business
- Étape 4: Règles réponse
- Étape 5: Calendrier & seuil confiance
- Progress bar

**SettingsLinkedIn.tsx**
- Formulaire email/password LinkedIn (inputs password)
- Status connexion (badge vert/rouge)
- Bouton "Test connexion"
- Fréquence scraping (slider 5-60min)

**SettingsClaude.tsx**
- Input API Key (type password)
- Test de connexion (appel API sanity check)
- Sélection modèle (dropdown: Sonnet 4.5, Haiku 4.5 - pré-config backend)

### 6.3 State Management

**Zustand stores :**
```typescript
// authStore.ts
interface AuthState {
  user: User | null;
  token: string | null;
  login: (email, password) => Promise<void>;
  logout: () => void;
}

// conversationsStore.ts
interface ConversationsState {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  fetchConversations: (filters) => Promise<void>;
  setSelectedConversation: (id) => void;
}

// notificationsStore.ts
interface NotificationsState {
  unreadCount: number;
  notifications: Notification[];
  markAsRead: (id) => Promise<void>;
}
```

### 6.4 Règles TypeScript Frontend

**tsconfig.json** (identique à PROJECT_RULES doc) :
```json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### 6.5 Conventions Code Frontend

- Path alias: `@/` pour imports depuis `src/`
- Composants: PascalCase (`ConversationsList.tsx`)
- Hooks: camelCase avec `use` (`useConversations.tsx`)
- Tailwind classes ordre: layout > spacing > typography > colors
- Dark mode support: `bg-white dark:bg-gray-900`

---

## 7. Système de Scraping LinkedIn

### 7.1 Stratégie Anti-Detection

**Puppeteer Configuration :**
```typescript
const browser = await puppeteer.launch({
  headless: false, // Moins suspect
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    `--window-size=${randomWidth()},${randomHeight()}`
  ],
  defaultViewport: null
});

// User-Agent rotation
const userAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  // ... 10+ variants
];
page.setUserAgent(randomUserAgent());

// Delays aléatoires human-like
await page.waitForTimeout(randomDelay(2000, 5000));
```

**Limites de sécurité :**
- Max 50 messages par scrape session
- Pause 30s entre chaque action (scroll, click)
- Rotation User-Agent à chaque scrape
- Résolution écran aléatoire
- **Pas de scraping parallèle** (1 compte à la fois)

### 7.2 Workflow Scraping Initial (Setup)

```mermaid
graph TD
    A[User connecte LinkedIn] --> B[Stocke email/password chiffré AES-256]
    B --> C[Lance premier scrape]
    C --> D[Puppeteer login LinkedIn]
    D --> E[Sauvegarde cookies session]
    E --> F[Navigation vers Messages]
    F --> G[Scrape 500 dernières conversations]
    G --> H{Plus de conversations?}
    H -->|Oui| I[Scroll down + attente 5s]
    I --> G
    H -->|Non| J[Parse messages JSON]
    J --> K[Stocke dans BDD contacts + conversations]
    K --> L[Analyse avec Claude pour détecter style]
    L --> M[Pré-remplit questionnaire onboarding]
    M --> N[FIN - Scraping régulier démarre]
```

**Temps estimé :** 10-30 minutes selon nb conversations (pas pressé, anti-ban)

### 7.3 Workflow Scraping Régulier (Polling)

```typescript
// Cron job Bull Queue (toutes les X minutes configurables)
@Cron('*/10 * * * *') // Défaut: 10 min
async handleScrapingJob() {
  const tenants = await this.getAllActiveTenants();
  
  for (const tenant of tenants) {
    const linkedinAccount = await this.getLinkedInAccount(tenant.id);
    
    // Check si session encore valide
    if (await this.isSessionExpired(linkedinAccount)) {
      await this.reloginLinkedIn(linkedinAccount);
    }
    
    // Scrape nouveaux messages uniquement
    const newMessages = await this.scrapeNewMessages(linkedinAccount);
    
    // Process chaque nouveau message
    for (const msg of newMessages) {
      await this.processMessage(msg, tenant);
    }
  }
}
```

### 7.4 Gestion Sessions & Re-login

**Stockage cookies :**
```typescript
// Après login réussi
const cookies = await page.cookies();
await this.saveCookies(linkedinAccount.id, encrypt(JSON.stringify(cookies)));

// Réutilisation session
const cookies = JSON.parse(decrypt(linkedinAccount.session_cookies));
await page.setCookie(...cookies);
```

**Détection expiration :**
```typescript
async isSessionExpired(page: Page): Promise<boolean> {
  try {
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'networkidle0' });
    const currentUrl = page.url();
    return currentUrl.includes('/login') || currentUrl.includes('/checkpoint');
  } catch {
    return true;
  }
}

<parameter name="command">create</parameter>
<parameter name="id">hr_automation_specs_part2</parameter>
<parameter name="title">HR-Automation CDC - Partie 2 (LLM, Sécurité, Déploiement)</parameter>
<parameter name="type">application/vnd.ant.code</parameter>
<parameter name="language">markdown</parameter>
<parameter name="content"># HR-Automation - Cahier des Charges Partie 2

## 8. Intelligence Artificielle - LLM

### 8.1 Architecture LLM Hybride (Implémenté)

**Modèle principal : Gemini 2.0 Flash**
- 70% des réponses (simples)
- 0.075$ / 1M input, 0.30$ / 1M output
- Utilisé par défaut pour les messages courts et non critiques.

**Modèle fallback : Claude Haiku 4.5 / Sonnet**
- 25% des réponses (complexes, escalades)
- 0.25$ / 1M input, 1.25$ / 1M output
- Activé si confiance < 75%, mots-clés sensibles (salaire, litige), ou sentiment négatif.

**Escalade humaine : 5%**
- Cas critiques non résolus.
- Notification email.

**Coût moyen estimé : ~0.30$ / 1000 réponses**
(Contre 2$ avec Claude Sonnet seul).

### 8.2 Architecture Prompt Système

**Template prompt (stocké en BDD `onboarding_configs`) :**

```
Tu es l'assistant IA de {business_name}, recruteur spécialisé dans {sectors}.

## TON & STYLE
{detected_style}
- Tutoiement/Vouvoiement: {formality}
- Longueur réponses: {length_preference}
- Ton général: {tone}

## CONTEXTE ENTREPRISE
Secteurs: {sectors}
Profils recherchés: {target_profiles}

## EXEMPLES DE BONNES RÉPONSES
{few_shot_examples}

## RÈGLES STRICTES
1. **Quand proposer un meeting:**
   {meeting_rules}

2. **Informations à TOUJOURS demander avant meeting:**
   {required_info}

3. **Sujets à NE JAMAIS aborder:**
   {forbidden_topics}

4. **Lien calendrier:** {calendar_link}

## FORMAT DE RÉPONSE
Tu DOIS répondre UNIQUEMENT avec un JSON valide suivant ce schéma:

{
  "action": "reply" | "escalate" | "send_calendar_link" | "ignore",
  "confidence_score": 0-100,
  "message": "Texte de la réponse à envoyer (si action = reply ou send_calendar_link)",
  "reasoning": "Explication courte de ta décision",
  "metadata": {
    "detected_intent": "job_inquiry" | "meeting_request" | "follow_up" | "spam" | "unknown",
    "candidate_quality": "high" | "medium" | "low" | "unknown",
    "missing_info": ["email", "cv", ...] // Si des infos manquent
  }
}

## RÈGLES DE CONFIDENCE
- Si confidence_score < {confidence_threshold}%, action DOIT être "escalate"
- Si message spam évident, action = "ignore"
- Si candidat demande meeting explicitement, action = "send_calendar_link"
- Sinon, action = "reply"

## CONVERSATION ACTUELLE
{conversation_history}

NOUVEAU MESSAGE:
{new_message}

Ta réponse JSON:
```

### 8.3 Gestion Quotas & Budgets

**Système de monitoring :**

```typescript
async callClaudeAPI(prompt: string, tenantId: string): Promise<any> {
  // Check quota avant appel
  const quota = await this.getQuota(tenantId);
  if (quota.is_limit_reached) {
    throw new Error('Monthly LLM budget limit reached');
  }

  // Appel Claude API
  const response = await this.anthropicClient.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  // Calcul coût
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const cost = (inputTokens * 0.003 / 1000) + (outputTokens * 0.015 / 1000);

  // Update quota
  await this.updateQuota(tenantId, inputTokens + outputTokens, cost);

  // Alert si > 80%
  if (quota.estimated_cost_usd + cost >= quota.monthly_limit_usd * 0.8) {
    await this.sendQuotaWarning(tenantId);
  }

  // Stop si > 100%
  if (quota.estimated_cost_usd + cost >= quota.monthly_limit_usd) {
    await this.markQuotaReached(tenantId);
  }

  return response;
}
```

**Limites par défaut :**
- Budget mensuel : 50 USD/tenant
- Alerte à 80% (40 USD)
- Stop automatique à 100%
- Reset le 1er de chaque mois

### 8.4 Détection Style Auto (Onboarding)

**Analyse des 500 conversations scrapées :**

```typescript
async analyzeConversationStyle(messages: Message[]): Promise<DetectedStyle> {
  const analysisPrompt = `
Analyse ces conversations LinkedIn d'un recruteur et détecte son style:

${JSON.stringify(messages.slice(0, 50))} // Échantillon

Retourne un JSON avec:
{
  "formality": "tu" | "vous",
  "tone": "professional" | "friendly" | "casual",
  "average_length": "short" | "medium" | "long",
  "common_phrases": ["phrase1", "phrase2", ...],
  "signature": "Texte signature typique",
  "meeting_trigger_words": ["disponible", "call", "rendez-vous", ...]
}
`;

  const response = await this.callClaudeAPI(analysisPrompt, tenantId);
  return JSON.parse(response.content);
}
```

### 8.5 Few-Shot Examples Extraction

**Sélection des meilleurs exemples :**

```typescript
async extractFewShotExamples(conversations: Conversation[]): Promise<Example[]> {
  // Filtre conversations réussies (status = meeting_booked)
  const successfulConvos = conversations.filter(c => 
    c.contact.status === 'meeting_booked'
  );

  // Extract pairs (message_candidat, réponse_recruteur)
  const examples = successfulConvos.map(convo => ({
    candidate_message: convo.messages.find(m => m.sender === 'candidate').text,
    recruiter_response: convo.messages.find(m => m.sender === 'recruiter').text
  }));

  // Limite à 3-5 meilleurs exemples (diversité)
  return examples.slice(0, 5);
}
```

---

## 9. Authentification & Sécurité

### 9.1 Authentification JWT

**Flow :**
```
1. User POST /auth/login { email, password }
2. Backend vérifie bcrypt password_hash
3. Génère JWT (payload: { userId, tenantId, role })
4. Retourne { access_token, refresh_token }
5. Frontend stocke token dans localStorage
6. Toutes requêtes incluent header: Authorization: Bearer {token}
```

**Configuration JWT :**
```typescript
// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET, // Strong random 64 chars
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    return { 
      userId: payload.sub, 
      tenantId: payload.tenantId,
      role: payload.role 
    };
  }
}
```

**Durée tokens :**
- Access token : 1 heure
- Refresh token : 7 jours

### 9.2 Chiffrement Credentials

**AES-256-GCM pour LinkedIn/Google credentials :**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.ENCRYPTION_KEY; // 32 bytes hex

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(MASTER_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const decipher = createDecipheriv(
    ALGORITHM, 
    Buffer.from(MASTER_KEY, 'hex'), 
    Buffer.from(ivHex, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**Variables d'environnement :**
```env
# Backend .env
JWT_SECRET=<64-char-random-hex>
ENCRYPTION_KEY=<32-byte-hex-for-aes256>
REFRESH_TOKEN_SECRET=<64-char-random-hex>
```

### 9.3 Gestion RGPD

**Suppression données (email à tom@klack.io) :**

```typescript
// Endpoint admin (manuel pour V1)
@Delete('contacts/:id/gdpr')
async deleteContactGDPR(@Param('id') contactId: string) {
  // Supprime contact + conversations + llm_actions liées
  await this.contactsService.deleteWithCascade(contactId);
  
  // Log RGPD
  await this.auditLog.create({
    action: 'GDPR_DELETE',
    contact_id: contactId,
    requested_by: 'tom@klack.io',
    timestamp: new Date()
  });
  
  return { message: 'Contact and all related data deleted' };
}
```

**Retention policy :**
- Conversations : Infinies (sauf demande RGPD)
- Logs LLM : Infinies (analytics)
- Notifications : 90 jours puis auto-delete

### 9.4 Rate Limiting

**Protection API :**

```typescript
// Global rate limiter (NestJS Throttler)
@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // 60 secondes
      limit: 100, // 100 requêtes par IP
    }),
  ],
})

// Per-tenant rate limit (custom guard)
@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user.tenantId;
    
    const count = await this.redis.incr(`rate:${tenantId}:${today}`);
    if (count > 1000) { // 1000 req/jour par tenant
      throw new TooManyRequestsException();
    }
    
    return true;
  }
}
```

---

## 10. Multi-tenant

### 10.1 Architecture Multi-tenant

**Approche : Shared Database avec `tenant_id`**

**Avantages :**
- ✅ Simple à implémenter
- ✅ Facile à scaler horizontalement
- ✅ Coûts infra réduits (1 seule BDD)

**Inconvénients :**
- ⚠️ Isolation données moins forte (risque leaks si bugs)
- ⚠️ Un tenant lourd peut ralentir les autres

**Mitigation risques :**
- Row-Level Security (RLS) PostgreSQL
- Validation systématique `tenantId` dans tous les queries
- Indexes sur `tenant_id` partout

### 10.2 Row-Level Security (RLS)

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_actions ENABLE ROW LEVEL SECURITY;

-- Policy : user ne voit que ses données tenant
CREATE POLICY tenant_isolation_policy ON contacts
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_policy ON conversations
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Dans NestJS (Prisma) :**

```typescript
// Middleware global qui set tenant_id en session
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: Function) {
    const tenantId = req.user?.tenantId; // Extrait du JWT
    if (tenantId) {
      req['tenantId'] = tenantId;
    }
    next();
  }
}

// Guard qui valide tenant_id sur chaque query
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;
    
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID missing');
    }
    
    // Inject dans Prisma client
    request.prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`;
    
    return true;
  }
}
```

### 10.3 Onboarding Nouveau Tenant

**Flow :**
```
1. POST /auth/register { email, password, tenant_name }
2. Backend crée:
   - Tenant (slug auto-généré)
   - User (admin, lié au tenant)
   - onboarding_configs (vide, à remplir)
3. Retourne access_token
4. Frontend redirige vers /onboarding
5. User connecte LinkedIn
6. Scraping initial 500 convos (10-30min)
7. Analyse style auto
8. Questionnaire pré-rempli
9. User valide/ajuste
10. Scraping régulier démarre
```

### 10.4 Isolation LinkedIn Scraping

**1 worker global avec queue :**

```typescript
// Bull Queue job pour chaque tenant
@Process('scrape-linkedin')
async handleScrapeTenant(job: Job<{ tenantId: string }>) {
  const { tenantId } = job.data;
  
  // Lock pour éviter scraping parallèle même tenant
  const lock = await this.redis.lock(`scrape:${tenantId}`, 600000); // 10min
  
  try {
    await this.scrapeLinkedInForTenant(tenantId);
  } finally {
    await lock.unlock();
  }
}

// Cron qui enqueue jobs pour tous tenants actifs
@Cron('*/10 * * * *')
async enqueueScrapeJobs() {
  const tenants = await this.tenantsService.getAllActive();
  
  for (const tenant of tenants) {
    await this.scrapeQueue.add('scrape-linkedin', { tenantId: tenant.id });
  }
}
```

**Fréquence adaptative par tenant :**
```typescript
// Chaque tenant peut configurer sa fréquence
const linkedinAccount = await this.getLinkedInAccount(tenantId);
const frequencyMinutes = linkedinAccount.scrape_frequency_minutes || 10;

// Dynamic cron expression
const cronExpression = `*/${frequencyMinutes} * * * *`;
```

---

## 11. Notifications & Emails

### 11.1 Types de Notifications

| Type | Déclencheur | Destinataires |
|------|-------------|---------------|
| **escalate** | LLM confidence < threshold | Emails configurés dans onboarding_configs |
| **error_scraping** | Session LinkedIn expirée, ban détecté | tom@klack.io + tenant emails |
| **error_technical** | Crash worker, BDD down, erreur API | tom@klack.io |
| **meeting_booked** | Candidat a booké un créneau | Tenant emails |
| **quota_warning** | Budget LLM > 80% | Tenant emails |
| **quota_reached** | Budget LLM = 100% | Tenant emails |

### 11.2 SMTP Configuration

**Nodemailer avec Gmail/Outlook :**

```typescript
import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD, // App password si 2FA
  },
});

async sendNotification(
  to: string[], 
  subject: string, 
  html: string
): Promise<void> {
  await transporter.sendMail({
    from: '"HR-Automation" <noreply@hr-automation.com>',
    to: to.join(', '),
    subject,
    html,
  });
}
```

**Templates emails :**

```html
<!-- Escalade LLM -->
<h2>🤔 L'IA a besoin de votre aide</h2>
<p>Une conversation nécessite votre attention :</p>
<ul>
  <li><strong>Contact:</strong> {contact_name}</li>
  <li><strong>Message:</strong> {last_message}</li>
  <li><strong>Raison:</strong> {reasoning}</li>
</ul>
<a href="{dashboard_url}/conversations/{conversation_id}">Répondre maintenant</a>

<!-- Quota warning -->
<h2>⚠️ Alerte Budget LLM</h2>
<p>Vous avez consommé {percentage}% de votre budget mensuel ({cost_usd}$ / {limit_usd}$).</p>
<a href="{dashboard_url}/settings/quotas">Ajuster le budget</a>

<!-- Erreur scraping -->
<h2>🚨 Erreur LinkedIn</h2>
<p>Le scraping LinkedIn a échoué :</p>
<pre>{error_message}</pre>
<p>Veuillez vous reconnecter : <a href="{dashboard_url}/settings/linkedin">Reconnexion</a></p>
```

### 11.3 Notifications Temps Réel (WebSocket)

**Socket.IO Gateway :**

```typescript
@WebSocketGateway({ cors: true })
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  // Emit notification à un tenant spécifique
  emitToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  @SubscribeMessage('join')
  handleJoinTenant(client: Socket, tenantId: string) {
    client.join(`tenant:${tenantId}`);
  }
}

// Usage dans service
async processNewMessage(message: Message, tenantId: string) {
  // ... logique LLM ...
  
  // Emit notification temps réel
  this.notificationsGateway.emitToTenant(tenantId, 'new_action', {
    type: 'llm_replied',
    conversation_id: message.conversation_id,
    message: 'Nouveau message traité'
  });
}
```

---

## 12. Déploiement Docker/Kubernetes

### 12.1 Dockerfiles

**Frontend Dockerfile :**

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Backend Dockerfile :**

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Install Puppeteer dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/main.js"]
```

### 12.2 Kubernetes Manifests

**Namespace :**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hr-automation
```

**ConfigMap (env variables non-sensibles) :**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hr-automation-config
  namespace: hr-automation
data:
  DATABASE_HOST: "localhost"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "hr_automation"
  NODE_ENV: "production"
  FRONTEND_URL: "https://hr-automation.yourdomain.com"
```

**Secret (credentials sensibles) :**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: hr-automation-secrets
  namespace: hr-automation
type: Opaque
stringData:
  DATABASE_URL: "postgresql://postgres:Tomtom25@localhost:5432/hr_automation"
  JWT_SECRET: "<64-char-hex>"
  ENCRYPTION_KEY: "<32-byte-hex>"
  SMTP_USER: "your-email@gmail.com"
  SMTP_PASSWORD: "your-app-password"
```

**Deployment Backend :**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hr-automation-backend
  namespace: hr-automation
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hr-automation-backend
  template:
    metadata:
      labels:
        app: hr-automation-backend
    spec:
      containers:
      - name: backend
        image: your-registry/hr-automation-backend:latest
        ports:
        - containerPort: 4000
        envFrom:
        - configMapRef:
            name: hr-automation-config
        - secretRef:
            name: hr-automation-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

**Service Backend :**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hr-automation-backend-service
  namespace: hr-automation
spec:
  selector:
    app: hr-automation-backend
  ports:
  - protocol: TCP
    port: 4000
    targetPort: 4000
  type: ClusterIP
```

**Deployment Frontend :**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hr-automation-frontend
  namespace: hr-automation
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hr-automation-frontend
  template:
    metadata:
      labels:
        app: hr-automation-frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/hr-automation-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

**Service Frontend :**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hr-automation-frontend-service
  namespace: hr-automation
spec:
  selector:
    app: hr-automation-frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP
```

**Ingress (Nginx Ingress Controller) :**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hr-automation-ingress
  namespace: hr-automation
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - hr-automation.yourdomain.com
    secretName: hr-automation-tls
  rules:
  - host: hr-automation.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: hr-automation-backend-service
            port:
              number: 4000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: hr-automation-frontend-service
            port:
              number: 80
```

### 12.3 Déploiement Step-by-Step

**Pré-requis :**
- Cluster K8s opérationnel sur Hostinger VPS
- kubectl configuré
- PostgreSQL installé sur host (pas en pod)
- Domaine DNS pointé vers VPS

**Steps :**

```bash
# 1. Build images Docker
cd hr-automation-backend
docker build -t your-registry/hr-automation-backend:v1.0 .
docker push your-registry/hr-automation-backend:v1.0

cd ../hr-automation-frontend
docker build -t your-registry/hr-automation-frontend:v1.0 .
docker push your-registry/hr-automation-frontend:v1.0

# 2. Créer namespace
kubectl apply -f k8s/namespace.yaml

# 3. Créer secrets
kubectl apply -f k8s/secrets.yaml

# 4. Créer configmap
kubectl apply -f k8s/configmap.yaml

# 5. Déployer backend
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# 6. Déployer frontend
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# 7. Configurer Ingress
kubectl apply -f k8s/ingress.yaml

# 8. Vérifier
kubectl get pods -n hr-automation
kubectl logs -n hr-automation <backend-pod-name>
```

### 12.4 Migrations Base de Données

**Prisma migrations :**

```bash
# Générer migration
npx prisma migrate dev --name init

# Appliquer en production (depuis pod ou CI/CD)
npx prisma migrate deploy
```

**Script seed initial :**

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Créer tenant démo
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Tenant',
      slug: 'demo',
      settings: {},
    },
  });

  // Créer user admin
  await prisma.user.create({
    data: {
      tenant_id: tenant.id,
      email: 'admin@demo.com',
      password_hash: await bcrypt.hash('password123', 10),
      role: 'admin',
    },
  });
}

main();
```

---

## 13. Monitoring & Logs

### 13.1 Logging avec Winston

**Configuration :**

```typescript
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});
```

**Usage :**

```typescript
logger.info('LinkedIn scraping started', { tenantId, messagesCount: 10 });
logger.error('LLM API call failed', { error: err.message, tenantId });
logger.warn('Quota threshold reached', { tenantId, percentage: 85 });
```

### 13.2 Métriques Clés à Monitorer

**Application metrics :**
- Nb messages scrapés/heure par tenant
- Taux succès LLM (confidence > threshold)
- Taux escalade humaine
- Latence moyenne appels Claude API
- Nb erreurs scraping LinkedIn

**Infrastructure metrics :**
- CPU/RAM usage pods
- Requêtes/seconde API
- Latence base de données
- Disk usage PostgreSQL

### 13.3 Alertes Critiques

**À configurer (Prometheus/Grafana en Phase 2) :**

| Alerte | Condition | Action |
|--------|-----------|--------|
| LinkedIn ban détecté | Error rate scraping > 50% | Email tom@klack.io |
| BDD connexion perdue | Health check fail 3x | Restart pod |
| Quota LLM dépassé | Budget > 100% | Email tenant |
| Worker queue bloqué | Jobs pending > 100 pendant 30min | Restart worker |

---

## 14. Roadmap de Développement

### Phase 1 - PoC Fonctionnel (3 semaines)

**Semaine 1 : Backend Core**
- [ ] Setup NestJS + Prisma + PostgreSQL
- [ ] Auth JWT (register/login)
- [ ] Endpoints CRUD tenants/users/contacts
- [ ] Chiffrement credentials AES-256

**Semaine 2 : Scraping & LLM**
- [ ] Module Puppeteer scraping LinkedIn
- [ ] Worker Bull Queue
- [ ] Intégration Claude API
- [ ] Système prompt templates
- [ ] Gestion quotas LLM

**Semaine 3 : Frontend & Finalisation**
- [ ] Setup Vite + React + Tailwind
- [ ] Pages auth, dashboard, conversations
- [ ] Onboarding wizard
- [ ] Notifications email Nodemailer
- [ ] Déploiement K8s initial

### Phase 2 - MVP Complet (2 semaines)

**Semaine 4 : Features Avancées**
- [ ] Multi-tenant complet avec RLS
- [ ] Dashboard analytics (stats, graphs)
- [ ] Logs LLM détaillés (debug)
- [ ] Override manuel conversations
- [ ] WebSocket notifications temps réel

**Semaine 5 : Optimis& Polish**

 Tests E2E (Playwright)
 Optimisation scraping (anti-ban)
 Documentation API (Swagger)
 Guide utilisateur
 Tests charge (K6)

Phase 3 - Scaling (3 semaines)
Semaine 6-7 : Intégrations

 API Notion CRM
 WhatsApp Business API
 Multi-langues (ES, DE)
 Export CSV conversations

Semaine 8 : Infra Production

 Prometheus + Grafana monitoring
 Sentry error tracking
 Backup automatisés BDD
 CI/CD GitHub Actions
 Load balancer + auto-scaling


15. Budget & Infrastructure
15.1 Coûts Infrastructure (Estimés)
RessourceCoût MensuelVPS Hostinger KVM 8Déjà payé (inclus apps existantes)PostgreSQL0€ (sur VPS)Docker Registry0€ (Docker Hub gratuit ou self-hosted)Domaine SSL~10€/an (Let's Encrypt gratuit)SMTP Gmail0€ (gratuit jusqu'à 500 emails/jour)Total Base~1€/mois
Coûts variables (par tenant) :

Claude API : Utilisateur fournit sa clé (0€ pour toi)
Google Calendar API : Gratuit
LinkedIn : Gratuit (scraping)

15.2 Dimensionnement VPS
VPS KVM 8 Hostinger (estimé) :

8 vCPU
16-32 GB RAM
200-400 GB SSD

Répartition ressources estimée :
PostgreSQL : 4 GB RAM, 50 GB SSD
Backend pods (x2) : 2 GB RAM each = 4 GB
Frontend pods (x2) : 256 MB each = 512 MB
Worker scraping : 2 GB RAM
Kubernetes overhead : 2 GB RAM
Autres apps existantes : Reste

Total HR-Automation : ~12 GB RAM, ~60 GB SSD
Capacité estimée :

10-20 tenants actifs simultanément
500-1000 messages scrapés/heure (tous tenants)
100-200 appels Claude API/heure

15.3 Optimisations Coûts

✅ Pas de cloud provider (AWS/GCP) → économie 100-500€/mois
✅ PostgreSQL sur host (pas managed DB) → économie 50-200€/mois
✅ User apporte sa clé Claude → économie variable
✅ SMTP direct (pas SendGrid) → économie 15€/mois


16. Règles Antigravity
16.1 Fichier .antigravity-rules
À copier à la racine des 2 repos :
markdown# HR-Automation - Règles de Développement pour Antigravity

## Contexte Projet
Tu développes **HR-Automation**, une plateforme SaaS pour automatiser les réponses LinkedIn de recruteurs via IA (Claude).

## Stack Obligatoire
- **Frontend** : React 18.3 + TypeScript + Vite 6 + Tailwind 4 + shadcn/ui
- **Backend** : NestJS 10 + TypeScript + Prisma + PostgreSQL 16 + Bull Queue
- **Scraping** : Puppeteer 22
- **LLM** : Anthropic Claude API (Sonnet 4.5)

## Règles TypeScript STRICTES
```json
{
  "strict": false,
  "noImplicitAny": false,
  "noUnusedLocals": false,
  "noUnusedParameters": false
}
```
**IMPORTANT** : Respecter ces règles souples. Pas de typage ultra-strict.

## Architecture Multi-tenant
- **TOUJOURS** inclure `tenant_id` dans queries/mutations
- **TOUJOURS** valider tenantId depuis JWT
- **JAMAIS** de données cross-tenant

## Sécurité CRITIQUES
- **Credentials LinkedIn/Google** : Chiffrer avec AES-256-GCM avant stockage
- **Passwords users** : Hasher avec bcrypt (10 rounds)
- **JWT** : Expiration 1h (access), 7j (refresh)
- **Rate limiting** : 100 req/min par IP, 1000 req/jour par tenant

## Scraping LinkedIn - Anti-Detection
- **Headless** : false (fenêtre visible moins suspect)
- **User-Agent** : Rotation aléatoire (10+ variants)
- **Delays** : Aléatoires 2-5s entre actions
- **Limites** : Max 50 messages par scrape session
- **Fréquence** : Configurable par tenant (défaut 10min)
- **Pas de scraping parallèle** : 1 compte à la fois

## LLM - Claude API
- **Modèle** : claude-sonnet-4-20250514
- **Max tokens** : 1000 par réponse
- **Prompt système** : Template stocké en BDD (onboarding_configs)
- **Format réponse** : JSON strict avec { action, confidence_score, message, reasoning, metadata }
- **Gestion quotas** : Tracking tokens + coût, alerte à 80%, stop à 100%

## Base de Données
- **ORM** : Prisma uniquement (pas de raw SQL sauf migrations)
- **Indexes** : Obligatoires sur tenant_id, foreign keys, champs filtres
- **JSONB** : Pour metadata flexibles (pas de colonnes multiples)
- **Timestamps** : created_at, updated_at partout

## Frontend
- **Path alias** : `@/` pour imports depuis `src/`
- **Composants** : PascalCase (`ConversationsList.tsx`)
- **Hooks** : camelCase avec `use` (`useConversations.tsx`)
- **Tailwind** : Ordre classes layout > spacing > typography > colors
- **shadcn/ui** : Utiliser composants pré-construits (Button, Table, Modal, etc.)

## API Endpoints
- **REST** : Naming cohérent `/api/ressource/:id`
- **Validation** : DTO avec class-validator sur tous les endpoints
- **Errors** : HTTP status codes standards (400, 401, 403, 404, 500)
- **Pagination** : Query params `?page=1&limit=20`

## Logging
- **Winston** : JSON format, timestamps, severity levels
- **Contexte** : Toujours inclure tenantId, userId dans logs
- **Secrets** : JAMAIS logger credentials, tokens, API keys

## Tests (Phase 2)
- **Unit tests** : Jest pour services/utils critiques
- **E2E tests** : Playwright pour workflows complets
- **Coverage** : Minimum 70% sur backend core

## Déploiement
- **Docker** : Multi-stage builds (builder + production)
- **K8s** : Manifests fournis, pas d'Helm
- **Env vars** : ConfigMap (non-sensible) + Secret (sensible)
- **Health checks** : `/health` endpoint (liveness + readiness)

## Performance
- **Prisma** : Utiliser `select` pour limiter champs
- **Caching** : Pas de cache pour V1 (simple is better)
- **N+1 queries** : Utiliser `include` Prisma
- **Indexes** : Vérifier EXPLAIN ANALYZE sur queries lentes

## Git Workflow
- **2 repos séparés** : hr-automation-frontend / hr-automation-backend
- **Commits** : Messages clairs et descriptifs
- **Branches** : feature/*, bugfix/*, hotfix/*
- **Pas de CI/CD** : Déploiement manuel via kubectl

## Points d'Attention CRITIQUES
1. **JAMAIS** scraper LinkedIn en parallèle (risque ban)
2. **TOUJOURS** chiffrer credentials avant stockage
3. **TOUJOURS** valider tenantId dans guards
4. **JAMAIS** exposer clés API dans frontend
5. **TOUJOURS** gérer quotas LLM (éviter factures explosées)

## Priorité Fonctionnalités
1. Scraping LinkedIn + détection nouveaux messages
2. Analyse LLM + réponse auto
3. Escalade humaine si incertitude
4. Dashboard conversations
5. Onboarding questionnaire
6. Notifications email

## Questions ? Vérifie
- Cahier des charges complet (40 pages)
- Schéma BDD PostgreSQL
- Exemples endpoints API
- Architecture diagrams
```

### 16.2 Instructions Antigravity Initiales

**Prompt à donner à Antigravity au démarrage :**
```
Je veux que tu développes HR-Automation, une plateforme SaaS pour automatiser les réponses LinkedIn de recruteurs via IA.

**Contexte complet :**
- Cahier des charges : [Upload fichier complet]
- Règles strictes : [Upload .antigravity-rules]

**Phase actuelle : Phase 1 - Backend Core (Semaine 1)**

**Tasks prioritaires :**
1. Initialiser projet NestJS avec structure modules
2. Setup Prisma + schéma PostgreSQL complet
3. Implémenter auth JWT (register/login/logout)
4. Créer endpoints CRUD tenants/users
5. Module chiffrement credentials AES-256-GCM

**Contraintes :**
- Respecter règles TypeScript souples (.antigravity-rules)
- Multi-tenant dès le début (tenant_id partout)
- Tests unitaires pour crypto module

**Livrables attendus :**
- Code fonctionnel, testé localement
- README.md avec instructions setup
- Exemples requêtes API (cURL ou Postman)

Commence par créer l'architecture NestJS de base avec les modules suivants :
- AuthModule
- TenantsModule
- UsersModule
- PrismaModule
- CryptoModule

GO !

17. Plan de Tests
17.1 Tests Unitaires (Backend)
Modules critiques à tester :
typescript// crypto.service.spec.ts
describe('CryptoService', () => {
  it('should encrypt and decrypt correctly', () => {
    const original = 'my-linkedin-password';
    const encrypted = cryptoService.encrypt(original);
    const decrypted = cryptoService.decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertexts for same input', () => {
    const text = 'test';
    const enc1 = cryptoService.encrypt(text);
    const enc2 = cryptoService.encrypt(text);
    expect(enc1).not.toBe(enc2); // IV différent
  });
});

// llm.service.spec.ts
describe('LLMService', () => {
  it('should return valid JSON response', async () => {
    const response = await llmService.analyzeMessage(mockMessage, mockContext);
    expect(response).toHaveProperty('action');
    expect(response).toHaveProperty('confidence_score');
    expect(response.confidence_score).toBeGreaterThanOrEqual(0);
    expect(response.confidence_score).toBeLessThanOrEqual(100);
  });

  it('should escalate when confidence low', async () => {
    // Mock Claude response avec confidence = 50
    const response = await llmService.analyzeMessage(ambiguousMessage, mockContext);
    expect(response.action).toBe('escalate');
  });
});

// scraping.service.spec.ts (mocks Puppeteer)
describe('ScrapingService', () => {
  it('should extract messages from LinkedIn HTML', () => {
    const html = mockLinkedInMessagesHTML;
    const messages = scrapingService.parseMessages(html);
    expect(messages).toHaveLength(5);
    expect(messages[0]).toHaveProperty('sender');
    expect(messages[0]).toHaveProperty('text');
  });
});
17.2 Tests E2E (Playwright)
Scénarios critiques :
typescript// e2e/auth.spec.ts
test('User can register and login', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'Password123!');
  await page.fill('[name="tenant_name"]', 'Test Company');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});

// e2e/linkedin.spec.ts
test('User can connect LinkedIn account', async ({ page }) => {
  await loginAsUser(page);
  await page.goto('/settings/linkedin');
  await page.fill('[name="email"]', 'linkedin@example.com');
  await page.fill('[name="password"]', 'LinkedInPass123');
  await page.click('button:text("Connect")');
  
  await expect(page.locator('.status-badge')).toContainText('Connected');
});

// e2e/conversations.spec.ts
test('User sees new conversations in dashboard', async ({ page, context }) => {
  // Mock API response
  await context.route('**/api/conversations*', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ conversations: mockConversations })
    });
  });

  await loginAsUser(page);
  await page.goto('/dashboard/conversations');
  
  await expect(page.locator('table tbody tr')).toHaveCount(5);
});
17.3 Tests de Charge (K6)
Scénario : Scraping simultané 10 tenants :
javascriptimport http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp-up à 10 VUs
    { duration: '5m', target: 10 }, // Hold 10 VUs
    { duration: '2m', target: 0 },  // Ramp-down
  ],
};

export default function () {
  const token = __ENV.AUTH_TOKEN;
  
  const res = http.post('https://api.hr-automation.com/linkedin/scrape-now', null, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(60); // Attendre 1min avant prochaine requête
}

18. Annexes
18.1 Glossaire
TermeDéfinitionTenantOrganisation/compte client (ex: Leo Wolkowicz Recruitment)LLMLarge Language Model (IA générative, ex: Claude)ScrapingExtraction automatisée de données depuis site webEscaladeTransfert décision IA → humainRLSRow-Level Security (PostgreSQL)JWTJSON Web Token (authentification)BullBibliothèque job queue Node.jsPuppeteerOutil automation navigateur (headless Chrome)
18.2 Ressources Utiles
Documentation officielle :

NestJS : https://docs.nestjs.com
Prisma : https://www.prisma.io/docs
Puppeteer : https://pptr.dev
Claude API : https://docs.anthropic.com
Tailwind CSS : https://tailwindcss.com/docs
shadcn/ui : https://ui.shadcn.com

Guides spécifiques :

LinkedIn Scraping : https://github.com/joeyism/linkedin_scraper
Multi-tenant NestJS : https://blog.logrocket.com/building-multi-tenant-app-nestjs
Kubernetes : https://kubernetes.io/docs

18.3 Contacts & Support
Développeur : Tom Ktorza (tom@klack.io)
Client : Léo Wolkowicz
Projet : HR-Automation v1.0
Date début : 20 janvier 2026
Deadline PoC : 10 février 2026 (3 semaines)

🎯 Résumé Exécutif
HR-Automation est une plateforme SaaS qui automatise 80% des réponses LinkedIn pour recruteurs via IA (Claude Sonnet 4.5).
Techniquement :

Frontend : React + Vite + Tailwind + shadcn/ui
Backend : NestJS + Prisma + PostgreSQL + Bull Queue
Scraping : Puppeteer (anti-detection optimisé)
LLM : Claude API avec quotas, escalade, templates personnalisés
Infra : Docker + Kubernetes (Hostinger VPS KVM 8)

Périmètre V1 (3 semaines) :

Scraping LinkedIn automatique
Réponses IA personnalisées
Envoi lien calendrier Google
Dashboard conversations
Notifications email
Multi-tenant ready

Budget infra : ~1€/mois (utilisateur apporte clé Claude)
Prochaines étapes :

Copier .antigravity-rules dans les 2 repos
Lancer Antigravity avec prompt initial
Développer Phase 1 (Backend Core)
Itérer selon roadmap


FIN DU CAHIER DES CHARGES - v1.0</parameter>

