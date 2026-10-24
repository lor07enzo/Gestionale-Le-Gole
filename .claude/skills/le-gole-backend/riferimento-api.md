# Mappa modelli ed endpoint

Prefisso `/api/v1/`. Documentazione viva: `/api/v1/docs/` (Swagger), `/api/v1/redoc/`, `/api/v1/schema/`. In caso di dubbio lo schema generato è la fonte di verità, questo file è un orientamento.

Legenda permessi: **P** pubblico (AllowAny), **S** staff (IsAuthenticated), **SU** superuser, **R** lettura pubblica / scrittura staff.

## users (`users/`)
| Endpoint | Note |
|---|---|
| `login/`, `login/refresh/` | JWT simplejwt |
| `staff/` CRUD (SU) | `create` accetta solo `{username,email}` → password inutilizzabile + email di attivazione. `destroy` 400 se il target è superuser |
| `staff/me/` (S) | profilo corrente |
| `staff/{id}/set-active/` (SU) | 400 se disattivi te stesso |
| `staff/activate/`, `staff/reset-password/request/`, `.../confirm/` (P) | token di Django; request risponde sempre generico |
| `clienti/` | `create` P con upsert per telefono; resto S; `?search=` OR su nome/telefono |
| `dispositivi/` (S) POST upsert per token, `dispositivi/rimuovi/` | token push Expo |

## struttura (`struttura/`)
| Endpoint | Note |
|---|---|
| `inventario-piscina/` (R) | listino piscina; `attivo/`; destroy bloccato se prenotazioni future non cancellate, altrimenti elimina le collegate |
| `postazioni/` (R) | soft delete; `?data=` passata → posizioni ed elenco storici; limite per tipo = `totale_ombrelloni/gazebi` (solo in creazione); campo `gruppo` per blocchi di gazebo |
| `configurazione-padel/` (R, GET/PATCH) | singleton; espone `slot_disponibili` |
| `giorni-chiusi-padel/` (S) + `prossime/` (P) | |
| `racchette-padel/` (R) | catalogo marche con prezzo e pezzi |

## prenotazioni (`prenotazioni/`)
| Endpoint | Note |
|---|---|
| `piscina/` | create P; `disponibilita/` P (residui + `pieno`); `conteggi/` S; `recenti/` S; `storico_telefono/` P **POST** `{telefono}`; `{id}/dettaglio_pubblico/` P; `{id}/scarica_biglietto/` P |
| `occupazioni-postazione/` | create P (forza `arrivato=False` anonimo); `occupate/` P (solo id) |
| `giorni-pieni/` (S) + `calendario/` P | blocco manuale self-service piscina |
| `asporto/` | create P; `recenti/`, `conteggi/` S; `prenotazioni_per_orario/` P; `storico_telefono/` P POST; `{id}/dettaglio_pubblico/` (include `voci`); `{id}/scarica_ricevuta/` P |
| `padel/` | create P; `disponibilita/` P; `conteggi/`, `recenti/` S; `storico_telefono/` P POST; `dettaglio_pubblico`, `scarica_biglietto` P |
| `noleggi-racchetta/` | create P, prezzo snapshot server-side |

## menu (`menu/`)
| Endpoint | Note |
|---|---|
| `categorie/`, `allergeni/` (R) | nome unique; allergene con `icona` emoji |
| `prodotti/` (R) | FK categoria PROTECT, M2M allergeni, `disponibile`, `immagine` (PATCH multipart separata) |
| `voci-ordine/` | create P, prezzo snapshot; filtri `prenotazione`, `prenotazione__cliente_id` |
| `configurazione-asporto/` (R, GET/PATCH) | singleton: `attivo`, due turni (`orario_apertura/chiusura[_2]`), `limite_prenotazioni_orario` |
| `giorni-chiusi-asporto/` (S) + `prossime/` P | |

## Trasversali (`backend/views.py`)
- `servizi-disponibili/` (P) → `{piscina, asporto, padel}` booleani, poche `exists()`.
- `versione-app/` (P) → `{versione_minima, url_android, url_ios}` da env `APP_VERSIONE_MINIMA`, `APP_STORE_URL_ANDROID/IOS`.

## Modelli: campi chiave
- `Prenotazione` (astratta): `cliente_id`, `data`, `ora`, `stato` (PENDING/CONFIRMED/CANCELLED, default PENDING ma il self-service nasce CONFIRMED), `note`.
- `PrenotazionePiscina`: `inventario` (PROTECT), `ingressi`, `ingressi_ridotti`, `ingressi_bambini`, `ingressi_gratuiti`, `ombrellone`, `gazebo`, `lettino`, `sdraia`, `creata_da_staff`.
- `OccupazionePostazione`: `postazione`, `data` (unique insieme), `prenotazione` SET_NULL, `cliente_nome`, `numero_lettini/sdraie`, `orario_arrivo_previsto` (obbligatorio), `arrivato`.
- `PrenotazioneAsporto`: `ora` = ritiro, `creata_da_staff`, `totale` property sulle `voci`.
- `PrenotazionePadel`: `ora` = inizio, `partecipanti`, `palline_noleggiate`, snapshot `durata_minuti`/`prezzo_partita`/`prezzo_palline`, `noleggi` (righe `NoleggioRacchetta`, unique per marca).
