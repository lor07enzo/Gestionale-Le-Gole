import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useAuth } from '../../src/context/AuthContext';
import { ServizioStaffCard } from '../../src/components/staff/ServizioStaffCard';
import { listPiscinaInventari } from '../../src/services/struttura';
import { listStaff } from '../../src/services/staff';

function saluto(): string {
  const ora = new Date().getHours();
  if (ora < 6) return 'Buonanotte';
  if (ora < 13) return 'Buongiorno';
  if (ora < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function statPiscina(totale: number, attivi: number): string {
  if (totale === 0) return 'Nessun listino creato';
  const listini = `${totale} listino${totale === 1 ? '' : 'i'}`;
  return `${listini} · ${attivi} attiv${attivi === 1 ? 'o' : 'i'}`;
}

export default function StaffHomeScreen() {
  const { user } = useAuth();
  const isSuperuser = Boolean(user?.is_superuser);
  const [piscinaStat, setPiscinaStat] = useState<string | null>(null);
  const [staffStat, setStaffStat] = useState<string | null>(null);

  // Riepiloghi puramente accessori: `allSettled` perché il fallimento di una richiesta non deve
  // togliere dalla dashboard anche l'altra tessera — una card senza riga di stato resta comunque
  // pienamente utilizzabile come punto d'ingresso.
  useEffect(() => {
    let annullato = false;

    const caricaPiscina = listPiscinaInventari().then((items) => {
      if (!annullato) setPiscinaStat(statPiscina(items.length, items.filter((i) => i.isActive).length));
    });
    // listStaff() è riservata ai superuser (IsSuperUser lato backend): per gli altri darebbe 403.
    const caricaStaff = isSuperuser
      ? listStaff().then((members) => {
          if (!annullato) setStaffStat(`${members.length} account`);
        })
      : Promise.resolve();

    Promise.allSettled([caricaPiscina, caricaStaff]).catch(() => {});

    return () => {
      annullato = true;
    };
  }, [isSuperuser]);

  if (!user) {
    return null;
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-6 md:px-8 md:py-10"
    >
      <VStack space="lg" className="w-full">
        <VStack space="xs">
          <Heading size="xl" className="md:text-2xl">
            {saluto()}, {user.username}
          </Heading>
          <Text size="sm" className="text-muted-foreground">
            Scegli un servizio da gestire.
          </Text>
        </VStack>

        {/* Griglia a tessere: 1 colonna su telefono, 2 da tablet in su. Il margine negativo del
            contenitore compensa il padding delle celle, così i bordi esterni restano allineati al
            resto della pagina (stesso trucco già usato da ClienteFooter per il full-bleed). */}
        <Box className="-m-2 w-full flex-row flex-wrap">
          <Box className="w-full p-2 md:w-1/2">
            <ServizioStaffCard
              icon="🏊"
              title="Piscina"
              descrizione="Listini, mappa postazioni e prenotazioni del giorno"
              stat={piscinaStat}
              ctaLabel="Apri i listini piscina"
              href={'/staff/piscina' as Href}
            />
          </Box>

          <Box className="w-full p-2 md:w-1/2">
            <ServizioStaffCard
              icon="🥡"
              title="Asporto"
              descrizione="Catalogo prodotti, orario di ritiro e storico ordini"
              ctaLabel="Apri il menu asporto"
              href={'/staff/asporto' as Href}
            />
          </Box>

          <Box className="w-full p-2 md:w-1/2">
            <ServizioStaffCard
              icon="🎾"
              title="Padel"
              descrizione="Configurazione campo, racchette e prenotazioni partite"
              ctaLabel="Apri il padel"
              href={'/staff/padel' as Href}
            />
          </Box>

          {isSuperuser ? (
            <Box className="w-full p-2 md:w-1/2">
              <ServizioStaffCard
                icon="👥"
                title="Gestione Staff"
                descrizione="Account che accedono alla dashboard"
                stat={staffStat}
                ctaLabel="Gestisci gli account"
                href={'/staff/utenti' as Href}
              />
            </Box>
          ) : null}
        </Box>
      </VStack>
    </ScrollView>
  );
}
