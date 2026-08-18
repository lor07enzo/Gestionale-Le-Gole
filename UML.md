# Documentazione UML — Gestionale Le Gole

## Indice

1. [Panoramica architetturale](#1-panoramica-architetturale)
2. [Diagramma dei casi d'uso](#2-diagramma-dei-casi-duso)
3. [Diagramma delle classi — dominio applicativo](#3-diagramma-delle-classi--dominio-applicativo)
4. [Diagramma di stato — ciclo di vita `Prenotazione`](#4-diagramma-di-stato--ciclo-di-vita-prenotazione)
5. [Diagrammi di sequenza](#5-diagrammi-di-sequenza)
   - [5.1 Prenotazione self-service (Area Cliente)](#51-prenotazione-self-service-area-cliente)
   - [5.2 Assegnazione postazione dalla mappa staff](#52-assegnazione-postazione-dalla-mappa-staff)
   - [5.3 Invito e attivazione account staff](#53-invito-e-attivazione-account-staff)
   - [5.4 Refresh automatico del token JWT](#54-refresh-automatico-del-token-jwt)
6. [Moduli futuri](#6-moduli-futuri)

---

## 1. Panoramica architetturale

```mermaid
flowchart TB
    subgraph Client["Client"]
        Browser["Browser web"]
    end

    subgraph FE["Frontend — le-gole-fe"]
        direction TB
        ExpoRouter["Expo Router\n(React Native 56 / Expo SDK 56)"]
        UIKit["gluestack-ui v5 + NativeWind v5"]
        AuthCtx["AuthContext + Axios (JWT)"]
    end

    subgraph BE["Backend — le-gole-be (Django 6 + DRF)"]
        direction TB
        AppUsers["app users\nUtente · Cliente"]
        AppStruttura["app struttura\nPiscinaInventario · Postazione"]
        AppPrenotazioni["app prenotazioni\nPrenotazionePiscina · OccupazionePostazione · ..."]
        JWT["simplejwt (access 15gg / refresh 60gg)"]
    end

    DB[("PostgreSQL 17\n(Supabase)")]
    Mail["Resend (django-anymail)"]
    PDF["WeasyPrint"]

    Netlify["Netlify"]
    Render["Render"]

    Browser -->|HTTPS| ExpoRouter
    ExpoRouter --> UIKit
    ExpoRouter --> AuthCtx
    AuthCtx -->|REST/JSON + Bearer JWT| BE

    AppUsers --> JWT
    AppUsers --> Mail
    AppPrenotazioni --> PDF
    BE --> DB

    ExpoRouter -. deploy .-> Netlify
    BE -. deploy .-> Render
```

---

## 2. Diagramma dei casi d'uso

```mermaid
flowchart LR
    Cliente(("🧑 Cliente"))
    Staff(("👤 Staff"))
    Superuser(("👑 Superuser"))

    subgraph AC["Area Cliente"]
        UC1(["Consulta servizi disponibili"])
        UC2(["Prenota piscina self-service"])
        UC3(["Scarica biglietto PDF"])
        UC4(["Consulta privacy policy"])
    end

    subgraph AS["Area Staff"]
        UC5(["Login / Logout"])
        UC6(["Gestisci listino piscina"])
        UC7(["Gestisci mappa postazioni"])
        UC8(["Assegna cliente a postazione"])
        UC9(["Registra walk-in"])
        UC10(["Cerca cliente / consulta storico"])
        UC11(["Gestisci notifiche prenotazioni"])
        UC12(["Modifica / conferma / annulla prenotazione"])
        UC13(["Segna giorno come pieno"])
    end

    subgraph SU["Amministrazione"]
        UC14(["Invita nuovo membro staff"])
        UC15(["Attiva / disattiva account staff"])
        UC16(["Elimina account staff"])
    end

    Cliente --> UC1
    Cliente --> UC2
    Cliente --> UC3
    Cliente --> UC4
    UC2 -. include .-> UC3

    Staff --> UC5
    Staff --> UC6
    Staff --> UC7
    Staff --> UC8
    Staff --> UC9
    Staff --> UC10
    Staff --> UC11
    Staff --> UC12
    Staff --> UC13

    Superuser -. eredita .-> Staff
    Superuser --> UC14
    Superuser --> UC15
    Superuser --> UC16
```

---

## 3. Diagramma delle classi — dominio applicativo

```mermaid
classDiagram
    direction LR

    class StatoPrenotazione {
        <<enumeration>>
        PENDING
        CONFIRMED
        CANCELLED
    }
    class TipoPostazione {
        <<enumeration>>
        OMBRELLONE
        GAZEBO
    }

    class Utente {
        <<AbstractUser>>
        +UUID id
        +string username
        +string email
        +string password
        +bool is_staff
        +bool is_superuser
        +bool is_active
    }

    class Cliente {
        +UUID id
        +string nome
        +string telefono
        +datetime created_at
        +datetime updated_at
    }

    class PiscinaInventario {
        +UUID id
        +string nome
        +string descrizione
        +decimal prezzo_ingresso
        +decimal prezzo_ingresso_ridotto
        +decimal prezzo_ingresso_bambino
        +decimal prezzo_ombrellone
        +decimal prezzo_gazebo
        +decimal prezzo_lettino
        +decimal prezzo_sdraia
        +int totale_ombrelloni
        +int totale_gazebi
        +int totale_lettini
        +int totale_sdraie
        +time orario_apertura
        +time orario_chiusura
        +time orario_inizio_ridotto
        +int eta_minima_bambino
        +int eta_massima_bambino
        +bool isActive
        +datetime created_at
        +datetime updated_at
    }

    class Postazione {
        +UUID id
        +int numero
        +float pos_x
        +float pos_y
        +UUID gruppo
        +datetime deleted_at
        +datetime created_at
        +datetime updated_at
    }

    class Prenotazione {
        <<abstract>>
        +UUID id
        +date data
        +time ora
        +string note
        +datetime created_at
        +datetime updated_at
    }

    class PrenotazionePiscina {
        +int ingressi
        +int ingressi_ridotti
        +int ingressi_bambini
        +int ingressi_gratuiti
        +int ombrellone
        +int gazebo
        +int lettino
        +int sdraia
        +bool creata_da_staff
    }

    class GiornoPienoPiscina {
        +UUID id
        +date data
        +string note
        +datetime created_at
    }

    class OccupazionePostazione {
        +UUID id
        +date data
        +string cliente_nome
        +int numero_lettini
        +int numero_sdraie
        +time orario_arrivo_previsto
        +bool arrivato
        +datetime created_at
        +datetime updated_at
    }

    class PostazionePosizioneStorico {
        +UUID id
        +date data
        +float pos_x
        +float pos_y
        +datetime created_at
    }

    Prenotazione <|-- PrenotazionePiscina

    Postazione ..> TipoPostazione
    PrenotazionePiscina ..> StatoPrenotazione

    Cliente "1" --> "0..*" PrenotazionePiscina : cliente_id (CASCADE)
    PiscinaInventario "1" --> "0..*" Postazione : inventario (CASCADE)
    PiscinaInventario "1" --> "0..*" PrenotazionePiscina : inventario (PROTECT)
    PiscinaInventario "1" --> "0..*" GiornoPienoPiscina : inventario (CASCADE)
    Postazione "1" --> "0..*" OccupazionePostazione : postazione (CASCADE)
    Postazione "1" --> "0..*" PostazionePosizioneStorico : postazione (CASCADE)
    PrenotazionePiscina "0..1" --> "0..*" OccupazionePostazione : prenotazione (SET_NULL)

    classDef users fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
    classDef struttura fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef prenotazioni fill:#fef3c7,stroke:#b45309,color:#78350f
    classDef enumStyle fill:#f3f4f6,stroke:#6b7280,color:#374151

    class Utente:::users
    class Cliente:::users
    class PiscinaInventario:::struttura
    class Postazione:::struttura
    class Prenotazione:::prenotazioni
    class PrenotazionePiscina:::prenotazioni
    class GiornoPienoPiscina:::prenotazioni
    class OccupazionePostazione:::prenotazioni
    class PostazionePosizioneStorico:::prenotazioni
    class StatoPrenotazione:::enumStyle
    class TipoPostazione:::enumStyle
```

| Modello | Vincolo |
|---|---|
| `Postazione` | `UniqueConstraint(inventario, numero)` condizionato a `deleted_at IS NULL` |
| `OccupazionePostazione` | `unique_together(postazione, data)` |
| `GiornoPienoPiscina` | `unique_together(inventario, data)` |
| `PostazionePosizioneStorico` | `unique_together(postazione, data)` |
| `PrenotazionePiscina.inventario` | `on_delete=PROTECT` |
| `Cliente.telefono` | unicità solo applicativa (`get_or_create`) |
| `Utente.email` | unicità solo applicativa (`email__iexact`) |
| `Postazione.gruppo` | `UUIDField` non-FK, chiave di raggruppamento |

---

## 4. Diagramma di stato — ciclo di vita `Prenotazione`

```mermaid
stateDiagram-v2
    [*] --> CONFIRMED : self-service / walk-in staff
    [*] --> PENDING : creazione manuale via API (staff)
    PENDING --> CONFIRMED : staff conferma
    PENDING --> CANCELLED : staff annulla
    CONFIRMED --> CANCELLED : staff annulla
    CANCELLED --> [*]
    CONFIRMED --> [*]
```

---

## 5. Diagrammi di sequenza

### 5.1 Prenotazione self-service (Area Cliente)

```mermaid
sequenceDiagram
    actor Cliente
    participant FE as Frontend (Area Cliente)
    participant API as Backend Django REST
    participant DB as PostgreSQL

    Cliente->>FE: Apre /cliente/piscina/{inventarioId}
    FE->>API: GET /prenotazioni/piscina/disponibilita/?inventario&data
    API->>DB: aggrega prenotazioni non CANCELLED
    DB-->>API: residui per risorsa + flag "pieno"
    API-->>FE: {ombrellone, gazebo, lettino, sdraia, pieno}

    FE->>API: GET /struttura/postazioni/?inventario&data
    FE->>API: GET /occupazioni-postazione/occupate/?inventario&data
    API-->>FE: postazioni libere/occupate

    Cliente->>FE: Compila dati, sceglie data/ora, seleziona postazioni

    FE->>API: POST /users/clienti/ {nome, telefono}
    API->>DB: get_or_create(telefono=...)
    DB-->>API: Cliente (id)
    API-->>FE: 200/201 Cliente

    FE->>API: POST /prenotazioni/piscina/ {cliente_id, data, ora, ...}
    API->>DB: valida anti-overbooking + salva (stato=CONFIRMED)
    DB-->>API: PrenotazionePiscina (id)
    API-->>FE: 201

    loop per ogni postazione selezionata
        FE->>API: POST /occupazioni-postazione/ {postazione, prenotazione, ...}
        API->>DB: salva
    end

    FE-->>Cliente: Conferma + link biglietto
    Cliente->>API: GET /prenotazioni/piscina/{id}/scarica_biglietto/
    API-->>Cliente: PDF
```

### 5.2 Assegnazione postazione dalla mappa staff

```mermaid
sequenceDiagram
    actor Staff
    participant FE as Frontend (Mappa Staff)
    participant API as Backend Django REST
    participant DB as PostgreSQL

    Staff->>FE: Apre /staff/piscina/{inventarioId}
    FE->>API: GET postazioni, prenotazioni, occupazioni, giorno-pieno
    API-->>FE: stato mappa del giorno

    Staff->>FE: Tocca postazione libera
    FE-->>Staff: elenco "Da assegnare"
    Staff->>FE: Seleziona cliente

    FE->>API: POST /occupazioni-postazione/ {postazione, prenotazione, ...}
    API->>DB: verifica unique_together(postazione, data) + salva
    DB-->>API: OccupazionePostazione
    API-->>FE: 201

    FE-->>Staff: marker aggiornato
```

### 5.3 Invito e attivazione account staff

```mermaid
sequenceDiagram
    actor Superuser
    participant FE as Frontend (Gestione Staff)
    participant API as Backend Django REST
    participant Mail as Resend (Anymail)
    actor NuovoStaff as Nuovo membro staff

    Superuser->>FE: Crea nuovo membro {username, email}
    FE->>API: POST /users/staff/
    API->>API: set_unusable_password()
    API->>Mail: send_activation_email(uid, token)
    Mail-->>NuovoStaff: Email con link

    NuovoStaff->>FE: Apre il link, imposta password
    FE->>API: POST /users/staff/activate/ {uid, token, password}
    API->>API: valida token + validate_password()
    API-->>FE: 200

    NuovoStaff->>FE: Login
    FE->>API: POST /users/login/
    API-->>FE: access + refresh JWT
```

### 5.4 Refresh automatico del token JWT

```mermaid
sequenceDiagram
    actor Staff
    participant FE as Frontend (Axios interceptor)
    participant API as Backend Django REST

    Staff->>FE: Azione qualsiasi
    FE->>API: richiesta con Authorization: Bearer <accessToken>
    API-->>FE: 401 (access token scaduto)

    FE->>API: POST /users/login/refresh/ {refreshToken}
    API->>API: ROTATE_REFRESH_TOKENS
    API-->>FE: 200 {access, refresh}
    FE->>API: ripete la richiesta originale
    API-->>FE: 200

    alt refresh token scaduto/in blacklist
        API-->>FE: 401 sul refresh
        FE-->>Staff: redirect a /login
    end
```

---

## 6. Moduli futuri

| App | Modelli pianificati |
|---|---|
| `struttura` | `Sala`, `Tavolo` |
| `prenotazioni` | `Prenotazione_Tavolo`, `Prenotazione_Asporto` |
| `menu` | `Prodotto`, `Voce_Ordine` |
