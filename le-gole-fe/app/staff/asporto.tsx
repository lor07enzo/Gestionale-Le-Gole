import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { AlertCircleIcon, ClockIcon, Icon } from '@/components/ui/icon';
import { StaffPageHeader } from '../../src/components/staff/StaffPageHeader';
import { SezioneLinkCard } from '../../src/components/staff/SezioneLinkCard';
import { GiorniChiusuraCalendarCard } from '../../src/components/shared/GiorniChiusuraCalendarCard';
import { MenuAsportoSection } from '../../src/components/staff/MenuAsportoSection';
import { StatoServizioAsportoCard } from '../../src/components/staff/asporto/StatoServizioAsportoCard';
import {
  createGiornoChiusoAsporto,
  deleteGiornoChiusoAsporto,
  getConfigurazioneAsporto,
  listGiorniChiusiAsporto,
  updateConfigurazioneAsporto,
  type ConfigurazioneAsporto,
} from '../../src/services/menu';
import { formatOrarioInput, formatTime, parseHHMMToMinutes } from '../../src/utils/piscinaMappa';
import { extractErrorMessage } from '../../src/utils/errors';

// Orario di inizio/fine disponibilità del servizio asporto — una sola impostazione condivisa
// (nessun concetto di "listino/inventario" per l'asporto, sezione 1 di CLAUDE.md), letta/scritta
// sulla riga singleton `ConfigurazioneAsporto` lato backend. Il secondo turno (sotto, opzionale —
// es. pranzo/cena) è una seconda sezione dentro la stessa card, non una card a sé: concettualmente
// è lo stesso "orario di disponibilità", solo con una seconda fascia — un solo Salva per l'intera
// configurazione evita due stati di dirty/salvataggio separati per impostazioni correlate.
function OrarioDisponibilitaCard() {
  const [apertura, setApertura] = useState('');
  const [chiusura, setChiusura] = useState('');
  // Secondo turno: `secondoTurnoAttivo` decide se i campi sotto sono mostrati/inviati, i valori
  // restano comunque in stato locale anche da disattivato (riattivarlo senza aver salvato non
  // perde quanto digitato).
  const [secondoTurnoAttivo, setSecondoTurnoAttivo] = useState(false);
  const [apertura2, setApertura2] = useState('');
  const [chiusura2, setChiusura2] = useState('');
  // Ultimi valori confermati dal backend (al caricamento o dopo un salvataggio riuscito) — il
  // confronto con i valori correnti decide se c'è davvero qualcosa da salvare.
  const [savedApertura, setSavedApertura] = useState('');
  const [savedChiusura, setSavedChiusura] = useState('');
  const [savedSecondoTurnoAttivo, setSavedSecondoTurnoAttivo] = useState(false);
  const [savedApertura2, setSavedApertura2] = useState('');
  const [savedChiusura2, setSavedChiusura2] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    getConfigurazioneAsporto()
      .then((config: ConfigurazioneAsporto) => {
        const oraApertura = formatTime(config.orario_apertura);
        const oraChiusura = formatTime(config.orario_chiusura);
        const attivo2 = Boolean(config.orario_apertura_2 && config.orario_chiusura_2);
        const oraApertura2 = config.orario_apertura_2 ? formatTime(config.orario_apertura_2) : '';
        const oraChiusura2 = config.orario_chiusura_2 ? formatTime(config.orario_chiusura_2) : '';
        setApertura(oraApertura);
        setChiusura(oraChiusura);
        setSavedApertura(oraApertura);
        setSavedChiusura(oraChiusura);
        setSecondoTurnoAttivo(attivo2);
        setSavedSecondoTurnoAttivo(attivo2);
        setApertura2(oraApertura2);
        setChiusura2(oraChiusura2);
        setSavedApertura2(oraApertura2);
        setSavedChiusura2(oraChiusura2);
      })
      .catch(() => setError("Impossibile caricare l'orario del servizio."))
      .finally(() => setIsLoading(false));
  }, []);

  const isDirty =
    apertura !== savedApertura ||
    chiusura !== savedChiusura ||
    secondoTurnoAttivo !== savedSecondoTurnoAttivo ||
    (secondoTurnoAttivo && (apertura2 !== savedApertura2 || chiusura2 !== savedChiusura2));

  const handleChangeApertura = (next: string) => {
    setApertura(formatOrarioInput(apertura, next));
    setJustSaved(false);
  };

  const handleChangeChiusura = (next: string) => {
    setChiusura(formatOrarioInput(chiusura, next));
    setJustSaved(false);
  };

  const handleChangeApertura2 = (next: string) => {
    setApertura2(formatOrarioInput(apertura2, next));
    setJustSaved(false);
  };

  const handleChangeChiusura2 = (next: string) => {
    setChiusura2(formatOrarioInput(chiusura2, next));
    setJustSaved(false);
  };

  const handleToggleSecondoTurno = (next: boolean) => {
    setSecondoTurnoAttivo(next);
    setError(null);
    setJustSaved(false);
  };

  // Riporta i campi agli ultimi valori confermati dal backend — compare solo quando c'è
  // effettivamente qualcosa da scartare (`isDirty`, sotto), stesso principio del pulsante "Salva".
  const handleCancel = () => {
    setApertura(savedApertura);
    setChiusura(savedChiusura);
    setSecondoTurnoAttivo(savedSecondoTurnoAttivo);
    setApertura2(savedApertura2);
    setChiusura2(savedChiusura2);
    setError(null);
    setJustSaved(false);
  };

  const handleSave = async () => {
    setJustSaved(false);
    const minutiApertura = parseHHMMToMinutes(apertura);
    const minutiChiusura = parseHHMMToMinutes(chiusura);
    if (minutiApertura === null || minutiChiusura === null) {
      setError('Inserisci due orari validi (HH:MM).');
      return;
    }
    if (minutiApertura >= minutiChiusura) {
      setError("L'orario di fine deve essere successivo a quello di inizio.");
      return;
    }

    let payloadApertura2: string | null = null;
    let payloadChiusura2: string | null = null;
    if (secondoTurnoAttivo) {
      const minutiApertura2 = parseHHMMToMinutes(apertura2);
      const minutiChiusura2 = parseHHMMToMinutes(chiusura2);
      if (minutiApertura2 === null || minutiChiusura2 === null) {
        setError('Inserisci due orari validi per il secondo turno (HH:MM).');
        return;
      }
      if (minutiApertura2 >= minutiChiusura2) {
        setError("L'orario di fine del secondo turno deve essere successivo a quello di inizio.");
        return;
      }
      if (minutiApertura2 < minutiChiusura) {
        setError('Il secondo turno deve iniziare non prima della chiusura del primo.');
        return;
      }
      payloadApertura2 = apertura2;
      payloadChiusura2 = chiusura2;
    }

    setError(null);
    setIsSaving(true);
    try {
      const updated = await updateConfigurazioneAsporto({
        orario_apertura: apertura,
        orario_chiusura: chiusura,
        orario_apertura_2: payloadApertura2,
        orario_chiusura_2: payloadChiusura2,
      });
      const oraApertura = formatTime(updated.orario_apertura);
      const oraChiusura = formatTime(updated.orario_chiusura);
      const attivo2 = Boolean(updated.orario_apertura_2 && updated.orario_chiusura_2);
      const oraApertura2 = updated.orario_apertura_2 ? formatTime(updated.orario_apertura_2) : '';
      const oraChiusura2 = updated.orario_chiusura_2 ? formatTime(updated.orario_chiusura_2) : '';
      setApertura(oraApertura);
      setChiusura(oraChiusura);
      setSavedApertura(oraApertura);
      setSavedChiusura(oraChiusura);
      setSecondoTurnoAttivo(attivo2);
      setSavedSecondoTurnoAttivo(attivo2);
      setApertura2(oraApertura2);
      setChiusura2(oraChiusura2);
      setSavedApertura2(oraApertura2);
      setSavedChiusura2(oraChiusura2);
      setJustSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, "Impossibile salvare l'orario."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
      <HStack space="xs" className="items-center">
        <Icon as={ClockIcon} size="sm" className="text-sky-700" />
        <Heading size="sm">Orario di disponibilità del servizio</Heading>
      </HStack>
      <Text size="xs" className="text-muted-foreground">
        L'intervallo in cui il servizio asporto è disponibile.
      </Text>

      {isLoading ? (
        <HStack space="sm" className="items-center py-2">
          <Spinner size="small" />
        </HStack>
      ) : (
        <>
          <HStack space="md" className="items-start">
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium">
                Dalle
              </Text>
              <Input>
                <InputField
                  placeholder="Es. 11:00"
                  keyboardType="numeric"
                  maxLength={5}
                  value={apertura}
                  onChangeText={handleChangeApertura}
                />
              </Input>
            </VStack>
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium">
                Alle
              </Text>
              <Input>
                <InputField
                  placeholder="Es. 22:00"
                  keyboardType="numeric"
                  maxLength={5}
                  value={chiusura}
                  onChangeText={handleChangeChiusura}
                />
              </Input>
            </VStack>
          </HStack>

          {/* Seconda sezione — secondo turno opzionale (es. pranzo/cena): il servizio può essere
              disponibile in due fasce separate nella stessa giornata invece di un unico
              intervallo continuo. Il divisore sopra e l'etichetta sotto la rendono una sezione
              distinta pur restando nella stessa card/stesso Salva del primo turno. */}
          <Box className="h-px w-full bg-sky-100" />
          <HStack space="sm" className="items-center justify-between">
            <VStack className="flex-1">
              <Text size="sm" className="font-medium">
                Secondo turno
              </Text>
              <Text size="xs" className="text-muted-foreground">
                Es. pranzo e cena, con una pausa nel mezzo — opzionale.
              </Text>
            </VStack>
            <Switch value={secondoTurnoAttivo} onValueChange={handleToggleSecondoTurno} />
          </HStack>

          {secondoTurnoAttivo ? (
            <HStack space="md" className="items-start">
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Dalle
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. 19:00"
                    keyboardType="numeric"
                    maxLength={5}
                    value={apertura2}
                    onChangeText={handleChangeApertura2}
                  />
                </Input>
              </VStack>
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Alle
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. 22:30"
                    keyboardType="numeric"
                    maxLength={5}
                    value={chiusura2}
                    onChangeText={handleChangeChiusura2}
                  />
                </Input>
              </VStack>
            </HStack>
          ) : null}

          {error ? (
            <Text size="xs" className="text-destructive">
              {error}
            </Text>
          ) : null}
          {justSaved && !error ? (
            <Text size="xs" className="text-emerald-700">
              Orario aggiornato.
            </Text>
          ) : null}

          <HStack space="sm" className="items-center">
            <Button
              size="sm"
              onPress={handleSave}
              disabled={isSaving || !isDirty}
              isDisabled={isSaving || !isDirty}
              className="min-h-11 self-start"
            >
              {isSaving ? <ButtonSpinner /> : <ButtonText>Salva orario</ButtonText>}
            </Button>
            {isDirty ? (
              <Button
                size="sm"
                variant="outline"
                onPress={handleCancel}
                disabled={isSaving}
                isDisabled={isSaving}
                className="min-h-11 self-start border-2 border-sky-300 bg-white"
              >
                <ButtonText className="text-sky-700">Annulla</ButtonText>
              </Button>
            ) : null}
          </HStack>
        </>
      )}
    </VStack>
  );
}

// Numero massimo di PRENOTAZIONI (ordini distinti, a prescindere da quanti prodotti contengono)
// accettate a un qualunque orario di ritiro — un UNICO valore globale
// (`ConfigurazioneAsporto.limite_prenotazioni_orario`), applicato automaticamente a ogni orario:
// lo staff imposta solo la quantità, non deve scegliere l'ora (su richiesta esplicita
// dell'utente, che ha corretto una prima versione per-orario proprio per questo). Rinominato da
// "Limite prodotti per orario" il 2026-08-28, su ulteriore richiesta esplicita dell'utente: non
// conta più la somma delle quantità ordinate, ma quanti ordini distinti la cucina/lo staff può
// gestire nella stessa finestra — un singolo grande ordine e tanti piccoli ordini pesano ora allo
// stesso modo (1 prenotazione), non più in proporzione a quanti prodotti contengono. Se ci sono
// già 2 prenotazioni per un orario con limite 3 e ne arriva una terza, quell'orario diventa "non
// più disponibile" per un quarto cliente (sezioni 7/15 dei picker orario cliente/staff). Stesso
// pattern "campo + Salva/Annulla" di `OrarioDisponibilitaCard` sopra, entrambe leggono/scrivono
// la stessa riga singleton.
function LimitePrenotazioniOrarioCard() {
  const [limite, setLimite] = useState('');
  // Ultimo valore confermato dal backend (null = nessun limite) — il confronto con `limite`
  // decide se c'è davvero qualcosa da salvare, stesso principio di `isDirty` sopra.
  const [savedLimite, setSavedLimite] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    getConfigurazioneAsporto()
      .then((config: ConfigurazioneAsporto) => {
        setSavedLimite(config.limite_prenotazioni_orario);
        setLimite(config.limite_prenotazioni_orario != null ? String(config.limite_prenotazioni_orario) : '');
      })
      .catch(() => setError('Impossibile caricare il limite.'))
      .finally(() => setIsLoading(false));
  }, []);

  const limiteNumero = limite.trim() === '' ? null : Number.parseInt(limite, 10);
  const isDirty = limiteNumero !== savedLimite;

  const handleChangeLimite = (next: string) => {
    // Solo cifre: un campo numerico puro, non mascherato come gli orari.
    setLimite(next.replace(/\D/g, ''));
    setJustSaved(false);
  };

  const handleCancel = () => {
    setLimite(savedLimite != null ? String(savedLimite) : '');
    setError(null);
    setJustSaved(false);
  };

  const handleSave = async () => {
    setJustSaved(false);
    if (limite.trim() !== '' && (!Number.isFinite(limiteNumero) || (limiteNumero as number) < 1)) {
      setError('Inserisci un numero valido (almeno 1), oppure lascia vuoto per nessun limite.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const updated = await updateConfigurazioneAsporto({ limite_prenotazioni_orario: limiteNumero });
      setSavedLimite(updated.limite_prenotazioni_orario);
      setLimite(updated.limite_prenotazioni_orario != null ? String(updated.limite_prenotazioni_orario) : '');
      setJustSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile salvare il limite.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
      <HStack space="xs" className="items-center">
        <Icon as={AlertCircleIcon} size="sm" className="text-sky-700" />
        <Heading size="sm">Limite prenotazioni per orario</Heading>
      </HStack>
      <Text size="xs" className="text-muted-foreground">
        Numero massimo di prenotazioni accettate a
        ciascun orario di ritiro — si applica automaticamente a tutti gli orari, non solo a uno
        specifico. Lascia vuoto per nessun limite.
      </Text>

      {isLoading ? (
        <HStack space="sm" className="items-center py-2">
          <Spinner size="small" />
        </HStack>
      ) : (
        <>
          <VStack space="xs" className="max-w-40">
            <Text size="sm" className="font-medium">
              Max prenotazioni
            </Text>
            <Input>
              <InputField
                placeholder="Nessun limite"
                keyboardType="numeric"
                value={limite}
                onChangeText={handleChangeLimite}
              />
            </Input>
          </VStack>

          {error ? (
            <Text size="xs" className="text-destructive">
              {error}
            </Text>
          ) : null}
          {justSaved && !error ? (
            <Text size="xs" className="text-emerald-700">
              {limiteNumero != null ? 'Limite aggiornato.' : 'Limite rimosso.'}
            </Text>
          ) : null}

          <HStack space="sm" className="items-center">
            <Button
              size="sm"
              onPress={handleSave}
              disabled={isSaving || !isDirty}
              isDisabled={isSaving || !isDirty}
              className="min-h-11 self-start"
            >
              {isSaving ? <ButtonSpinner /> : <ButtonText>Salva limite</ButtonText>}
            </Button>
            {isDirty ? (
              <Button
                size="sm"
                variant="outline"
                onPress={handleCancel}
                disabled={isSaving}
                isDisabled={isSaving}
                className="min-h-11 self-start border-2 border-sky-300 bg-white"
              >
                <ButtonText className="text-sky-700">Annulla</ButtonText>
              </Button>
            ) : null}
          </HStack>
        </>
      )}
    </VStack>
  );
}

export default function AsportoScreen() {
  // Memoizzate: GiorniChiusuraCalendarCard (2026-09-04, condivisa con la pagina Padel) le riceve
  // come prop e non deve rifare il fetch a ogni render del genitore.
  const loadChiusure = useCallback(() => listGiorniChiusiAsporto(), []);
  const createChiusura = useCallback((iso: string) => createGiornoChiusoAsporto({ data: iso }), []);
  const removeChiusura = useCallback((id: string) => deleteGiornoChiusoAsporto(id), []);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <StaffPageHeader
          title="Menu Asporto"
          subtitle="Catalogo prodotti e orario di disponibilità del servizio."
          fallbackHref="/staff"
        />

        {/* Le due azioni della pagina: una colonna su telefono, affiancate da tablet — stesso
            schema già usato per le due tessere della pagina Padel. */}
        <Box className="-m-2 w-full flex-row flex-wrap">
          <Box className="w-full p-2 md:w-1/2">
            <SezioneLinkCard
              icon="➕"
              title="Nuovo ordine"
              descrizione="Registra un ordine al banco o per telefono, già confermato"
              href={'/staff/asporto/ordini/nuovo' as Href}
              tone="emerald"
            />
          </Box>
          <Box className="w-full p-2 md:w-1/2">
            <SezioneLinkCard
              icon="📋"
              title="Storico Ordini"
              descrizione="Ordini di oggi modificabili/annullabili, quelli passati in sola consultazione"
              href="/staff/asporto/ordini"
            />
          </Box>
        </Box>

        <StatoServizioAsportoCard />

        {/* Orario e limite/chiusure affiancati da tablet landscape in su (lg): la card orario è
            la più alta (secondo turno opzionale), le altre due più corte stanno bene impilate
            nella stessa colonna accanto — stesso principio "configurazione alta accanto a card
            più corte" già usato dalla pagina Padel. Sotto lg restano tutte impilate, come su
            telefono. */}
        <Box className="-m-2 w-full flex-row flex-wrap">
          <Box className="w-full p-2 lg:w-1/2">
            <OrarioDisponibilitaCard />
          </Box>
          <Box className="w-full p-2 lg:w-1/2">
            <VStack space="lg">
              <LimitePrenotazioniOrarioCard />
              <GiorniChiusuraCalendarCard
                titolo="Giorni di chiusura"
                descrizione="Segna i giorni in cui il ritiro asporto non è disponibile (es. festività). I clienti vengono avvisati in anticipo se il giorno successivo è chiuso."
                istruzioni="Tocca un giorno per chiuderlo al ritiro asporto — toccalo di nuovo per riaprirlo."
                ariaLabel="Giorni di chiusura asporto"
                load={loadChiusure}
                create={createChiusura}
                remove={removeChiusura}
              />
            </VStack>
          </Box>
        </Box>

        <Box className="h-px w-full bg-sky-200" />
        <MenuAsportoSection />
      </VStack>
    </ScrollView>
  );
}
