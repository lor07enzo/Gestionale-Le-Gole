import { useEffect, useMemo, useState } from 'react';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Icon, SettingsIcon } from '@/components/ui/icon';
import {
  getConfigurazionePadel,
  updateConfigurazionePadel,
  type ConfigurazionePadel,
} from '../../../services/padel';
import { formatOrarioInput, formatTime, parseHHMMToMinutes } from '../../../utils/piscinaMappa';
import { formatDurata } from '../../../utils/padel';
import { extractErrorMessage } from '../../../utils/errors';

type CampoProps = {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  keyboardType?: 'numeric' | 'decimal-pad';
  maxLength?: number;
};

function Campo({ label, hint, value, onChangeText, placeholder, keyboardType, maxLength }: Readonly<CampoProps>) {
  return (
    <VStack space="xs" className="w-full">
      <Text size="sm" className="font-medium">
        {label}
      </Text>
      <Input>
        <InputField
          placeholder={placeholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          value={value}
          onChangeText={onChangeText}
        />
      </Input>
      {hint ? (
        <Text size="2xs" className="text-muted-foreground">
          {hint}
        </Text>
      ) : null}
    </VStack>
  );
}

// "12,50" -> "12.50" per il backend; accetta sia virgola sia punto in input.
function toDecimalPayload(value: string): string {
  return value.replace(',', '.');
}

function soloCifre(value: string): string {
  return value.replace(/\D/g, '');
}

function soloDecimale(value: string): string {
  return value.replace(/[^0-9.,]/g, '');
}

type Form = {
  apertura: string;
  chiusura: string;
  durata: string;
  prezzoPartita: string;
  maxPartecipanti: string;
  prezzoPalline: string;
};

function formDaConfig(config: ConfigurazionePadel): Form {
  return {
    apertura: formatTime(config.orario_apertura),
    chiusura: formatTime(config.orario_chiusura),
    durata: String(config.durata_partita_minuti),
    prezzoPartita: config.prezzo_partita.replace('.', ','),
    maxPartecipanti: String(config.max_partecipanti),
    prezzoPalline: config.prezzo_noleggio_palline.replace('.', ','),
  };
}

// Durata, prezzi e orari del campo: un'unica riga di configurazione condivisa (non esiste un
// concetto di "listino" per il padel, la struttura ha un solo campo). L'interruttore online vive
// invece in una card a sé, con salvataggio immediato.
export function ConfigurazionePadelCard() {
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    getConfigurazionePadel()
      .then((config) => {
        setForm(formDaConfig(config));
        setSaved(formDaConfig(config));
        setSlots(config.slot_disponibili);
      })
      .catch(() => setError('Impossibile caricare la configurazione del campo.'))
      .finally(() => setIsLoading(false));
  }, []);

  const isDirty = useMemo(() => {
    if (!form || !saved) return false;
    return (Object.keys(form) as Array<keyof Form>).some((chiave) => form[chiave] !== saved[chiave]);
  }, [form, saved]);

  const aggiorna = (patch: Partial<Form>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setJustSaved(false);
  };

  const handleCancel = () => {
    setForm(saved);
    setError(null);
    setJustSaved(false);
  };

  const validate = (valori: Form): string | null => {
    const minutiApertura = parseHHMMToMinutes(valori.apertura);
    const minutiChiusura = parseHHMMToMinutes(valori.chiusura);
    if (minutiApertura === null || minutiChiusura === null) return 'Inserisci due orari validi (HH:MM).';
    if (minutiApertura >= minutiChiusura) return "L'orario di chiusura deve essere successivo a quello di apertura.";

    const durata = Number.parseInt(valori.durata, 10);
    if (!Number.isFinite(durata) || durata < 1) return 'La durata di una partita deve essere di almeno 1 minuto.';
    if (durata > minutiChiusura - minutiApertura) {
      return "La durata di una partita supera l'orario di apertura: nessun orario risulterebbe prenotabile.";
    }

    const partecipanti = Number.parseInt(valori.maxPartecipanti, 10);
    if (!Number.isFinite(partecipanti) || partecipanti < 1) return 'Serve almeno un partecipante ammesso.';

    const prezzoPartita = Number.parseFloat(toDecimalPayload(valori.prezzoPartita));
    const prezzoPalline = Number.parseFloat(toDecimalPayload(valori.prezzoPalline));
    if (!Number.isFinite(prezzoPartita) || prezzoPartita < 0) return 'Inserisci un prezzo partita valido.';
    if (!Number.isFinite(prezzoPalline) || prezzoPalline < 0) return 'Inserisci un prezzo palline valido.';

    return null;
  };

  const handleSave = async () => {
    if (!form) return;
    setJustSaved(false);

    const messaggio = validate(form);
    if (messaggio) {
      setError(messaggio);
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const updated = await updateConfigurazionePadel({
        orario_apertura: form.apertura,
        orario_chiusura: form.chiusura,
        durata_partita_minuti: Number.parseInt(form.durata, 10),
        prezzo_partita: toDecimalPayload(form.prezzoPartita),
        max_partecipanti: Number.parseInt(form.maxPartecipanti, 10),
        prezzo_noleggio_palline: toDecimalPayload(form.prezzoPalline),
      });
      setForm(formDaConfig(updated));
      setSaved(formDaConfig(updated));
      setSlots(updated.slot_disponibili);
      setJustSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile salvare la configurazione.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
      <HStack space="xs" className="items-center">
        <Icon as={SettingsIcon} size="sm" className="text-sky-700" />
        <Heading size="sm">Configurazione del campo</Heading>
      </HStack>
      <Text size="xs" className="text-muted-foreground">
        Orario, durata e costo di una partita. Gli orari prenotabili vengono generati da qui, uno
        ogni {form ? formatDurata(Number.parseInt(form.durata, 10) || 0) : 'partita'}.
      </Text>

      {isLoading || !form ? (
        <HStack className="items-center py-2">
          <Spinner size="small" />
        </HStack>
      ) : (
        <>
          {/* Una colonna su telefono, due da tablet: il margine negativo del contenitore compensa
              il padding delle celle, così i campi restano allineati ai bordi della card. */}
          <Box className="-m-1.5 w-full flex-row flex-wrap">
            <Box className="w-full p-1.5 md:w-1/2">
              <Campo
                label="Apertura"
                value={form.apertura}
                placeholder="Es. 09:00"
                keyboardType="numeric"
                maxLength={5}
                onChangeText={(next) => aggiorna({ apertura: formatOrarioInput(form.apertura, next) })}
              />
            </Box>
            <Box className="w-full p-1.5 md:w-1/2">
              <Campo
                label="Chiusura"
                value={form.chiusura}
                placeholder="Es. 22:00"
                keyboardType="numeric"
                maxLength={5}
                onChangeText={(next) => aggiorna({ chiusura: formatOrarioInput(form.chiusura, next) })}
              />
            </Box>
            <Box className="w-full p-1.5 md:w-1/2">
              <Campo
                label="Durata partita (minuti)"
                value={form.durata}
                placeholder="Es. 90"
                keyboardType="numeric"
                maxLength={3}
                onChangeText={(next) => aggiorna({ durata: soloCifre(next) })}
              />
            </Box>
            <Box className="w-full p-1.5 md:w-1/2">
              <Campo
                label="Partecipanti massimi"
                value={form.maxPartecipanti}
                placeholder="Es. 4"
                keyboardType="numeric"
                maxLength={2}
                onChangeText={(next) => aggiorna({ maxPartecipanti: soloCifre(next) })}
              />
            </Box>
            <Box className="w-full p-1.5 md:w-1/2">
              <Campo
                label="Prezzo partita (€)"
                value={form.prezzoPartita}
                placeholder="Es. 30,00"
                keyboardType="decimal-pad"
                onChangeText={(next) => aggiorna({ prezzoPartita: soloDecimale(next) })}
              />
            </Box>
            <Box className="w-full p-1.5 md:w-1/2">
              <Campo
                label="Noleggio palline (€)"
                hint="Costo di un set di palline, se il cliente lo richiede."
                value={form.prezzoPalline}
                placeholder="Es. 5,00"
                keyboardType="decimal-pad"
                onChangeText={(next) => aggiorna({ prezzoPalline: soloDecimale(next) })}
              />
            </Box>
          </Box>

          <Box className="rounded-xl border border-sky-100 bg-sky-50 p-3">
            <Text size="xs" className="font-semibold text-sky-900">
              Orari prenotabili ({slots.length})
            </Text>
            <Text size="xs" className="text-sky-900/70">
              {slots.length > 0 ? slots.join(' · ') : 'Nessuno: controlla orario e durata.'}
            </Text>
          </Box>

          {error ? (
            <Text size="xs" className="text-destructive">
              {error}
            </Text>
          ) : null}
          {justSaved && !error ? (
            <Text size="xs" className="text-emerald-700">
              Configurazione aggiornata.
            </Text>
          ) : null}

          <HStack space="sm" className="items-center">
            <Button
              size="sm"
              onPress={handleSave}
              disabled={isSaving || !isDirty}
              isDisabled={isSaving || !isDirty}
              className="self-start"
            >
              {isSaving ? <ButtonSpinner /> : <ButtonText>Salva configurazione</ButtonText>}
            </Button>
            {isDirty ? (
              <Button
                size="sm"
                variant="outline"
                onPress={handleCancel}
                disabled={isSaving}
                isDisabled={isSaving}
                className="self-start border-2 border-sky-300 bg-white"
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
