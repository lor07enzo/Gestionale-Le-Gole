import { useState } from 'react';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { CheckIcon, DownloadIcon, EditIcon, SlashIcon } from '@/components/ui/icon';
import { getBigliettoPadelUrl, type NoleggioRacchetta, type PrenotazionePadel } from '../../../services/padel';
import {
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  formatDateDDMMYYYY,
} from '../../../utils/piscinaMappa';
import { calcolaTotalePadel, formatFasciaPartita, formatTotaleEuro } from '../../../utils/padel';
import { formatPrezzo } from '../../../utils/prezzi';
import { apriBigliettoPdf } from '../../../utils/biglietto';

function Riga({ etichetta, valore }: Readonly<{ etichetta: string; valore: string }>) {
  return (
    <HStack className="items-center justify-between">
      <Text size="xs" className="text-muted-foreground">
        {etichetta}
      </Text>
      <Text size="xs" className="font-medium text-sky-900">
        {valore}
      </Text>
    </HStack>
  );
}

type PrenotazionePadelCardProps = {
  prenotazione: PrenotazionePadel;
  /** Sorgente di verità per il totale: cambia ad ogni modifica delle righe di noleggio. */
  noleggi: NoleggioRacchetta[];
  editable: boolean;
  isConfirming?: boolean;
  isCancelling?: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  showTelefono?: boolean;
  /** Nascosto nella scheda cliente (sezione 16 di CLAUDE.md): il biglietto lì non è pertinente
      quanto nelle pagine dedicate al padel, dove resta invece disponibile. */
  showBigliettoButton?: boolean;
};

// Riepilogo completo di una partita: fascia oraria, partecipanti, noleggi e totale, più le azioni
// disponibili. Il totale è ricalcolato dalle righe passate, non letto dal campo del backend, che
// resta indietro appena si aggiunge o rimuove una racchetta.
export function PrenotazionePadelCard({
  prenotazione,
  noleggi,
  editable,
  isConfirming = false,
  isCancelling = false,
  onEdit,
  onConfirm,
  onCancel,
  showTelefono = true,
  showBigliettoButton = true,
}: Readonly<PrenotazionePadelCardProps>) {
  const [isDownloading, setIsDownloading] = useState(false);
  const badge = STATO_PRENOTAZIONE_BADGE[prenotazione.stato];
  const isCancellata = prenotazione.stato === 'CANCELLED';
  const totale = calcolaTotalePadel(prenotazione, noleggi);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await apriBigliettoPdf(getBigliettoPadelUrl(prenotazione.id), prenotazione.id, 'padel');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
      <HStack space="sm" className="flex-wrap items-center justify-between">
        <VStack className="flex-1">
          <Text size="md" className="font-bold text-sky-900">
            {formatFasciaPartita(prenotazione.ora, prenotazione.orario_fine)}
          </Text>
          <Text size="xs" className="text-muted-foreground">
            {formatDateDDMMYYYY(prenotazione.data)} · {prenotazione.durata_minuti} minuti
          </Text>
        </VStack>
        <Box className={`rounded-full px-2.5 py-1 ${badge.bg}`}>
          <Text size="2xs" className={`font-bold ${badge.text}`}>
            {STATO_PRENOTAZIONE_LABEL[prenotazione.stato]}
          </Text>
        </Box>
      </HStack>

      {showTelefono ? (
        <Text size="xs" className="text-muted-foreground">
          {prenotazione.cliente_nome} · {prenotazione.cliente_telefono}
        </Text>
      ) : null}

      {prenotazione.note ? (
        <Box className="rounded-xl bg-amber-50 px-3 py-2">
          <Text size="xs" className="italic text-amber-900">
            📝 {prenotazione.note}
          </Text>
        </Box>
      ) : null}

      <Box className="h-px w-full bg-sky-100" />

      <VStack space="xs">
        <Riga etichetta="Partita" valore={`€ ${formatPrezzo(prenotazione.prezzo_partita)}`} />
        <Riga etichetta="Partecipanti" valore={`${prenotazione.partecipanti}`} />
        {prenotazione.palline_noleggiate ? (
          <Riga etichetta="Palline" valore={`€ ${formatPrezzo(prenotazione.prezzo_palline)}`} />
        ) : null}
        {noleggi.map((riga) => (
          <Riga
            key={riga.id}
            etichetta={`${riga.racchetta_nome} ×${riga.quantita}`}
            valore={`€ ${formatPrezzo(riga.subtotale)}`}
          />
        ))}
      </VStack>

      <HStack className="items-center justify-between rounded-xl bg-sky-50 px-3 py-2">
        <Text size="sm" className="font-bold text-sky-900">
          Totale
        </Text>
        <Text size="md" className="font-bold text-sky-900">
          € {formatTotaleEuro(totale)}
        </Text>
      </HStack>

      {/* I pulsanti vanno a capo invece di stringersi: su telefono tre azioni affiancate
          taglierebbero le etichette. */}
      <HStack space="sm" className="flex-wrap items-center">
        {editable && prenotazione.stato === 'PENDING' ? (
          <Button
            size="sm"
            className="min-h-11 bg-emerald-600"
            onPress={onConfirm}
            disabled={isConfirming}
            isDisabled={isConfirming}
          >
            {isConfirming ? <ButtonSpinner /> : <ButtonIcon as={CheckIcon} />}
            <ButtonText>Conferma</ButtonText>
          </Button>
        ) : null}

        {editable && !isCancellata ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 border-2 border-sky-300 bg-white"
              onPress={onEdit}
            >
              <ButtonIcon as={EditIcon} className="text-sky-700" />
              <ButtonText className="text-sky-700">Modifica</ButtonText>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 border-2 border-destructive bg-destructive/10"
              onPress={onCancel}
              disabled={isCancelling}
              isDisabled={isCancelling}
            >
              {isCancelling ? <ButtonSpinner /> : <ButtonIcon as={SlashIcon} className="text-destructive" />}
              <ButtonText className="text-destructive">Annulla</ButtonText>
            </Button>
          </>
        ) : null}

        {showBigliettoButton && !isCancellata ? (
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 border-2 border-sky-300 bg-white"
            onPress={handleDownload}
            disabled={isDownloading}
            isDisabled={isDownloading}
          >
            {isDownloading ? <ButtonSpinner /> : <ButtonIcon as={DownloadIcon} className="text-sky-700" />}
            <ButtonText className="text-sky-700">Biglietto</ButtonText>
          </Button>
        ) : null}
      </HStack>

      {!editable && !isCancellata ? (
        <Text size="2xs" className="text-muted-foreground">
          Partita passata: non più modificabile né annullabile.
        </Text>
      ) : null}
    </VStack>
  );
}
