import type { ReactNode } from 'react';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Icon, PhoneIcon } from '@/components/ui/icon';

export function EtichettaCampo({
  icona,
  children,
  obbligatorio = false,
}: Readonly<{ icona: ReactNode; children: string; obbligatorio?: boolean }>) {
  return (
    <HStack space="xs" className="items-center">
      {icona}
      <Text size="sm" className="font-medium">
        {children}
      </Text>
      {obbligatorio ? (
        <Text size="xs" className="text-destructive">
          *
        </Text>
      ) : (
        <Text size="xs" className="text-muted-foreground">
          (opzionale)
        </Text>
      )}
    </HStack>
  );
}

type DatiClienteCardProps = {
  nome: string;
  telefono: string;
  note: string;
  onChangeNome: (value: string) => void;
  onChangeTelefono: (value: string) => void;
  onChangeNote: (value: string) => void;
  /** Campi aggiuntivi in coda (es. l'orario di arrivo della piscina). */
  children?: ReactNode;
};

// Riquadro "I tuoi dati" dei flussi di prenotazione self-service: nome, telefono (la chiave con cui
// il cliente ritrova poi le proprie prenotazioni) e note facoltative della singola prenotazione.
export function DatiClienteCard({
  nome,
  telefono,
  note,
  onChangeNome,
  onChangeTelefono,
  onChangeNote,
  children,
}: Readonly<DatiClienteCardProps>) {
  return (
    <VStack space="md" className="w-full rounded-2xl border border-sky-200 bg-sky-100 p-5">
      <Heading size="sm">I tuoi dati</Heading>

      <VStack space="xs">
        <EtichettaCampo icona={<Text size="sm">👤</Text>} obbligatorio>
          Nome e cognome
        </EtichettaCampo>
        <Input>
          <InputField placeholder="Es. Mario Rossi" value={nome} onChangeText={onChangeNome} />
        </Input>
      </VStack>

      <VStack space="xs">
        <EtichettaCampo icona={<Icon as={PhoneIcon} size="sm" className="text-sky-700" />} obbligatorio>
          Telefono
        </EtichettaCampo>
        <Input>
          <InputField keyboardType="phone-pad" placeholder="Es. 333 1234567" value={telefono} onChangeText={onChangeTelefono} />
        </Input>
        <Text size="2xs" className="text-sky-900/60">
          📌 Usa sempre lo stesso numero: ti aiuta a ritrovare prenotazioni e preferenze.
        </Text>
      </VStack>

      <VStack space="xs">
        <EtichettaCampo icona={<Text size="sm">📝</Text>}>Note</EtichettaCampo>
        <Input>
          <InputField placeholder="Es. allergie, richieste particolari..." value={note} onChangeText={onChangeNote} />
        </Input>
      </VStack>

      {children}
    </VStack>
  );
}
