# Diagramma ER — Gestionale Le Gole

```mermaid
erDiagram
    UTENTE {
        uuid id PK
        string username UK
        string email
        string password
        boolean is_staff
        boolean is_superuser
        boolean is_active
    }

    CLIENTE {
        uuid id PK
        string nome
        string telefono
        datetime created_at
        datetime updated_at
    }

    PISCINA_INVENTARIO {
        uuid id PK
        string nome
        string descrizione
        decimal prezzo_ingresso
        decimal prezzo_ingresso_ridotto
        decimal prezzo_ingresso_bambino
        decimal prezzo_ombrellone
        decimal prezzo_gazebo
        decimal prezzo_lettino
        decimal prezzo_sdraia
        int totale_ombrelloni
        int totale_gazebi
        int totale_lettini
        int totale_sdraie
        time orario_apertura
        time orario_chiusura
        time orario_inizio_ridotto
        int eta_minima_bambino
        int eta_massima_bambino
        boolean isActive
        datetime created_at
        datetime updated_at
    }

    POSTAZIONE {
        uuid id PK
        uuid inventario_id FK
        string tipo
        int numero
        float pos_x
        float pos_y
        uuid gruppo
        datetime deleted_at
        datetime created_at
        datetime updated_at
    }

    PRENOTAZIONE_PISCINA {
        uuid id PK
        uuid cliente_id FK
        uuid inventario_id FK
        date data
        time ora
        string stato
        string note
        int ingressi
        int ingressi_ridotti
        int ingressi_bambini
        int ingressi_gratuiti
        int ombrellone
        int gazebo
        int lettino
        int sdraia
        boolean creata_da_staff
        datetime created_at
        datetime updated_at
    }

    GIORNO_PIENO_PISCINA {
        uuid id PK
        uuid inventario_id FK
        date data
        string note
        datetime created_at
    }

    OCCUPAZIONE_POSTAZIONE {
        uuid id PK
        uuid postazione_id FK
        uuid prenotazione_id FK
        date data
        string cliente_nome
        int numero_lettini
        int numero_sdraie
        time orario_arrivo_previsto
        boolean arrivato
        datetime created_at
        datetime updated_at
    }

    POSTAZIONE_POSIZIONE_STORICO {
        uuid id PK
        uuid postazione_id FK
        date data
        float pos_x
        float pos_y
        datetime created_at
    }

    CLIENTE ||--o{ PRENOTAZIONE_PISCINA : "effettua (CASCADE)"
    PISCINA_INVENTARIO ||--o{ POSTAZIONE : "contiene (CASCADE)"
    PISCINA_INVENTARIO ||--o{ PRENOTAZIONE_PISCINA : "riguarda (PROTECT)"
    PISCINA_INVENTARIO ||--o{ GIORNO_PIENO_PISCINA : "marca pieno (CASCADE)"
    POSTAZIONE ||--o{ OCCUPAZIONE_POSTAZIONE : "occupata in (CASCADE)"
    POSTAZIONE ||--o{ POSTAZIONE_POSIZIONE_STORICO : "storicizza (CASCADE)"
    PRENOTAZIONE_PISCINA |o--o{ OCCUPAZIONE_POSTAZIONE : "collegata a (SET_NULL)"
```

## Vincoli composti

| Tabella | Vincolo |
|---|---|
| `POSTAZIONE` | `UNIQUE(inventario_id, numero) WHERE deleted_at IS NULL` |
| `OCCUPAZIONE_POSTAZIONE` | `UNIQUE(postazione_id, data)` |
| `GIORNO_PIENO_PISCINA` | `UNIQUE(inventario_id, data)` |
| `POSTAZIONE_POSIZIONE_STORICO` | `UNIQUE(postazione_id, data)` |
| `CLIENTE.telefono` | solo applicativo (`get_or_create`) |
| `UTENTE.email` | solo applicativo (`email__iexact`) |

## Comportamento `ON DELETE`

| Foreign key | `on_delete` |
|---|---|
| `POSTAZIONE.inventario_id` → `PISCINA_INVENTARIO.id` | `CASCADE` |
| `PRENOTAZIONE_PISCINA.inventario_id` → `PISCINA_INVENTARIO.id` | `PROTECT` |
| `PRENOTAZIONE_PISCINA.cliente_id` → `CLIENTE.id` | `CASCADE` |
| `GIORNO_PIENO_PISCINA.inventario_id` → `PISCINA_INVENTARIO.id` | `CASCADE` |
| `OCCUPAZIONE_POSTAZIONE.postazione_id` → `POSTAZIONE.id` | `CASCADE` |
| `OCCUPAZIONE_POSTAZIONE.prenotazione_id` → `PRENOTAZIONE_PISCINA.id` | `SET_NULL` |
| `POSTAZIONE_POSIZIONE_STORICO.postazione_id` → `POSTAZIONE.id` | `CASCADE` |
