import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { ChevronRightIcon, Icon } from '@/components/ui/icon';
import { listPiscinaInventari, type PiscinaInventario } from '../../src/services/struttura';
import { ClienteFooter } from '../../src/components/cliente/ClienteFooter';
import { BackButton } from '../../src/components/cliente/BackButton';
import { PREZZO_ITEMS, formatPrezzo } from '../../src/utils/prezzi';

function PrezziGrid({ piscina }: Readonly<{ piscina: PiscinaInventario }>) {
  const items = PREZZO_ITEMS.filter((item) => {
    if (item.totaleKey) return (piscina[item.totaleKey] as number) > 0;
    if (item.hideIfZero) return Number.parseFloat(piscina[item.prezzoKey] as string) > 0;
    return true;
  });

  const haBambini = Number.parseFloat(piscina.prezzo_ingresso_bambino) > 0;

  return (
    <VStack space="xs">
      <Box className="flex-row flex-wrap rounded-xl bg-white/60 p-1">
        {items.map((item) => (
          <HStack key={item.prezzoKey} space="xs" className="w-1/2 items-center px-2 py-1.5">
            <Text size="md">{item.icon}</Text>
            <Text size="xs" className="text-sky-900/70">
              {item.label}
            </Text>
            <Text size="sm" className="font-semibold text-sky-900">
              €{formatPrezzo(piscina[item.prezzoKey] as string)}
            </Text>
          </HStack>
        ))}
      </Box>
      {haBambini ? (
        <Text size="2xs" className="px-1 text-sky-900/60">
          🧒 Tariffa bambini valida da {piscina.eta_minima_bambino} a {piscina.eta_massima_bambino}{' '}
          anni · 🆓 ingresso gratuito sotto i {piscina.eta_minima_bambino} anni
        </Text>
      ) : null}
    </VStack>
  );
}

export default function ClientePiscinaScreen() {
  const [piscine, setPiscine] = useState<PiscinaInventario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listPiscinaInventari()
      .then((items) => setPiscine(items.filter((item) => item.isActive)))
      .catch(() => setPiscine([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-6 md:px-8 md:py-10"
    >
      <VStack space="lg" className="w-full">
        <VStack space="xs">
          <Heading size="xl">Piscina</Heading>
          <Text size="sm" className="text-muted-foreground">
            Scegli la piscina per cui vuoi prenotare ingressi, ombrelloni e gazebi.
          </Text>
        </VStack>

        {isLoading ? (
          <HStack space="sm" className="items-center py-4">
            <Spinner size="small" />
            <Text size="sm" className="text-muted-foreground">
              Caricamento piscine disponibili...
            </Text>
          </HStack>
        ) : null}

        {!isLoading && piscine.length === 0 ? (
          <VStack
            space="sm"
            className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8"
          >
            <Text size="lg">🏊</Text>
            <Text size="sm" className="text-center text-muted-foreground">
              Al momento non ci sono piscine disponibili.{'\n'}Riprova più tardi.
            </Text>
          </VStack>
        ) : null}

        <VStack space="md" className="w-full">
          {piscine.map((piscina) => (
            <Pressable
              key={piscina.id}
              onPress={() => router.push(`/cliente/piscina/${piscina.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`Piscina ${piscina.nome} — tocca per prenotare`}
              className="active:opacity-80"
            >
              <Box className="w-full overflow-hidden rounded-2xl border-2 border-sky-300 bg-sky-100 shadow-sm">
                <VStack space="sm" className="p-5">
                  <HStack space="sm" className="items-center">
                    <Box className="h-12 w-12 items-center justify-center rounded-full bg-white/70">
                      <Text size="xl">🏊</Text>
                    </Box>
                    <VStack className="flex-1">
                      <Heading size="md">{piscina.nome}</Heading>
                      {piscina.descrizione ? (
                        <Text size="xs" className="text-sky-900/70" isTruncated>
                          {piscina.descrizione}
                        </Text>
                      ) : null}
                      <Text size="xs" className="text-sky-900/70">
                        {piscina.orario_apertura.slice(0, 5)} - {piscina.orario_chiusura.slice(0, 5)}
                      </Text>
                    </VStack>
                  </HStack>

                  <PrezziGrid piscina={piscina} />
                </VStack>

                {/* Barra CTA evidenziata: senza, la card non dava alcun indizio di essere
                    cliccabile oltre al cursore del mouse su web (assente su touch) — stesso
                    principio già usato per "Gestisci mappa postazioni →" lato staff
                    (PiscinaInventarioSection.tsx) e per il chevron di NotificaCard. */}
                <HStack className="items-center justify-between bg-sky-500/20 px-5 py-3">
                  <Text size="sm" className="font-semibold text-sky-800">
                    Prenota ora
                  </Text>
                  <Icon as={ChevronRightIcon} size="md" className="text-sky-700" />
                </HStack>
              </Box>
            </Pressable>
          ))}
        </VStack>

        <BackButton fallbackHref="/cliente" />

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
