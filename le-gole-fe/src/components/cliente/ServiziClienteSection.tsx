import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { listPiscinaInventari } from '../../services/struttura';
import { listProdotti } from '../../services/menu';

type ServizioCliente = {
  key: string;
  icon: string;
  label: string;
  descrizione: string;
  disponibile: boolean;
  badgeLabel: string;
  messaggioNonDisponibile: string;
  route?: Href;
};

function buildServizi(isPiscinaDisponibile: boolean, isAsportoDisponibile: boolean): ServizioCliente[] {
  return [
    {
      key: 'PISCINA',
      icon: '🏊',
      label: 'Piscina',
      descrizione: 'Prenota ombrelloni, gazebi e ingressi giornalieri',
      disponibile: isPiscinaDisponibile,
      badgeLabel: 'Non disponibile',
      messaggioNonDisponibile:
        'Al momento non ci sono piscine con un listino attivo. Riprova più tardi.',
      route: '/cliente/piscina',
    },
    {
      key: 'RISTORANTE',
      icon: '🍽️',
      label: 'Ristorante',
      descrizione: 'Prenotazione tavoli',
      disponibile: false,
      badgeLabel: 'In arrivo',
      messaggioNonDisponibile: "Ristorante sarà disponibile a breve in quest'area.",
    },
    {
      key: 'ASPORTO',
      icon: '🥡',
      label: 'Asporto',
      descrizione: 'Ordina da asporto',
      disponibile: isAsportoDisponibile,
      badgeLabel: 'Non disponibile',
      messaggioNonDisponibile:
        'Al momento non ci sono prodotti disponibili per l\'asporto. Riprova più tardi.',
      route: '/cliente/asporto',
    },
    {
      key: 'PADEL',
      icon: '🎾',
      label: 'Padel',
      descrizione: 'Prenotazione campo da padel',
      disponibile: false,
      badgeLabel: 'In arrivo',
      messaggioNonDisponibile: "Il campo da padel sarà disponibile a breve in quest'area.",
    },
  ];
}

function ServizioCard({ servizio }: Readonly<{ servizio: ServizioCliente }>) {
  const handlePress = () => {
    if (servizio.disponibile && servizio.route) {
      router.push(servizio.route);
      return;
    }
    if (Platform.OS === 'web') {
      window.alert(servizio.messaggioNonDisponibile);
    } else {
      Alert.alert('Prossimamente', servizio.messaggioNonDisponibile);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${servizio.label}${servizio.disponibile ? '' : ' (non disponibile)'}`}
      className="w-full md:flex-1"
    >
      <Box
        className={
          servizio.disponibile
            ? 'w-full rounded-2xl border border-sky-200 bg-sky-100 p-5'
            : 'w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5'
        }
      >
        <HStack space="sm" className="items-center">
          <Box
            className={
              servizio.disponibile
                ? 'h-12 w-12 items-center justify-center rounded-full bg-white/70'
                : 'h-12 w-12 items-center justify-center rounded-full bg-slate-200/70'
            }
          >
            <Text size="xl" className={servizio.disponibile ? '' : 'opacity-40'}>
              {servizio.icon}
            </Text>
          </Box>
          <VStack className="flex-1">
            <Heading size="md" className={servizio.disponibile ? '' : 'text-slate-500'}>
              {servizio.label}
            </Heading>
            <Text
              size="xs"
              className={servizio.disponibile ? 'text-sky-900/70' : 'text-slate-400'}
            >
              {servizio.descrizione}
            </Text>
          </VStack>
          {servizio.disponibile ? (
            <Text size="lg" className="font-semibold text-sky-700">
              →
            </Text>
          ) : null}
        </HStack>

        {!servizio.disponibile ? (
          <Box
            className={
              servizio.badgeLabel === 'Presto'
                ? 'ml-15 mt-3 self-start rounded-full bg-amber-100 px-2 py-0.5'
                : 'ml-15 mt-3 self-start rounded-full bg-slate-200 px-2 py-0.5'
            }
          >
            <Text
              size="2xs"
              className={
                servizio.badgeLabel === 'In arrivo'
                  ? 'font-medium text-amber-700'
                  : 'font-medium text-slate-600'
              }
            >
              {servizio.badgeLabel}
            </Text>
          </Box>
        ) : null}
      </Box>
    </Pressable>
  );
}

export function ServiziClienteSection() {
  const [isPiscinaDisponibile, setIsPiscinaDisponibile] = useState(false);
  const [isAsportoDisponibile, setIsAsportoDisponibile] = useState(false);

  useEffect(() => {
    listPiscinaInventari()
      .then((items) => setIsPiscinaDisponibile(items.some((item) => item.isActive)))
      .catch(() => setIsPiscinaDisponibile(false));
    listProdotti()
      .then((items) => setIsAsportoDisponibile(items.some((item) => item.disponibile)))
      .catch(() => setIsAsportoDisponibile(false));
  }, []);

  const servizi = buildServizi(isPiscinaDisponibile, isAsportoDisponibile);

  return (
    <VStack space="md" className="w-full md:flex-row md:flex-wrap">
      {servizi.map((servizio) => (
        <ServizioCard key={servizio.key} servizio={servizio} />
      ))}
    </VStack>
  );
}
