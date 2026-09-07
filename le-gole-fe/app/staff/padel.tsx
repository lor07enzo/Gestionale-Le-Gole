import { useCallback } from 'react';
import { Platform, ScrollView } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { StaffPageHeader } from '../../src/components/staff/StaffPageHeader';
import { SezioneLinkCard } from '../../src/components/staff/SezioneLinkCard';
import { GiorniChiusuraCalendarCard } from '../../src/components/shared/GiorniChiusuraCalendarCard';
import { StatoServizioPadelCard } from '../../src/components/staff/padel/StatoServizioPadelCard';
import { ConfigurazionePadelCard } from '../../src/components/staff/padel/ConfigurazionePadelCard';
import { RacchetteSection } from '../../src/components/staff/padel/RacchetteSection';
import {
  createGiornoChiusoPadel,
  deleteGiornoChiusoPadel,
  listGiorniChiusiPadel,
} from '../../src/services/padel';

// Solo web: senza, la scrollbar verticale (visibile solo quando il contenuto trabocca) si
// "mangia" un po' del padding destro dello ScrollView, facendolo apparire più stretto di quello
// sinistro. Riservare sempre lo spazio della scrollbar mantiene i due lati simmetrici a prescindere
// dal fatto che il contenuto trabocchi o meno.
const scrollViewStyle =
  Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as unknown as ViewStyle) : undefined;

export default function PadelScreen() {
  // Memoizzate: GiorniChiusuraCalendarCard le riceve come prop e non deve rifare il fetch a ogni
  // render del genitore.
  const loadChiusure = useCallback(() => listGiorniChiusiPadel(), []);
  const createChiusura = useCallback((iso: string) => createGiornoChiusoPadel(iso), []);
  const removeChiusura = useCallback((id: string) => deleteGiornoChiusoPadel(id), []);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-6 md:px-8 md:py-10"
      style={scrollViewStyle}
    >
      <VStack space="lg" className="w-full">
        <StaffPageHeader
          title="Padel"
          subtitle="Configurazione del campo, racchette a noleggio e prenotazioni."
          fallbackHref="/staff"
        />

        {/* Le due azioni della pagina: una colonna su telefono, affiancate da tablet. */}
        <Box className="-m-2 w-full flex-row flex-wrap">
          <Box className="w-full p-2 md:w-1/2">
            <SezioneLinkCard
              icon="➕"
              title="Nuova partita"
              descrizione="Registra una prenotazione al banco o al telefono"
              href={'/staff/padel/prenotazioni/nuova' as Href}
              tone="emerald"
            />
          </Box>
          <Box className="w-full p-2 md:w-1/2">
            <SezioneLinkCard
              icon="📅"
              title="Prenotazioni"
              descrizione="Partite del giorno, con orari liberi e occupati"
              href={'/staff/padel/prenotazioni' as Href}
            />
          </Box>
        </Box>

        <StatoServizioPadelCard />

        {/* Su desktop la configurazione (alta) sta accanto alle chiusure (bassa): sotto lg
            restano impilate, come su telefono e tablet in verticale. */}
        <Box className="-m-2 w-full flex-row flex-wrap">
          <Box className="w-full p-2 lg:w-1/2">
            <ConfigurazionePadelCard />
          </Box>
          <Box className="w-full p-2 lg:w-1/2">
            <GiorniChiusuraCalendarCard
              titolo="Giorni di chiusura"
              descrizione="Segna i giorni in cui il campo non è prenotabile (es. manutenzione, eventi)."
              istruzioni="Tocca un giorno per chiuderlo — toccalo di nuovo per riaprirlo."
              ariaLabel="Giorni di chiusura padel"
              load={loadChiusure}
              create={createChiusura}
              remove={removeChiusura}
            />
          </Box>
        </Box>

        <Box className="h-px w-full bg-sky-200" />

        <RacchetteSection />
      </VStack>
    </ScrollView>
  );
}
