import { Image, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ServiziClienteSection } from '../../src/components/cliente/ServiziClienteSection';
import { StoricoPrenotazioniSearch } from '../../src/components/cliente/StoricoPrenotazioniSearch';
import { ClienteFooter } from '../../src/components/cliente/ClienteFooter';
import { BackButton } from '../../src/components/cliente/BackButton';

const logo = require('../../assets/logo-le-gole-nero.png');

export default function AreaClienteScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-6 md:px-8 md:py-10"
    >
      <VStack space="lg" className="w-full">
        <Box className="w-full overflow-hidden rounded-3xl border border-sky-200 bg-sky-100 p-6 md:p-8">
          <HStack space="sm" className="items-center">
            <Box className="relative z-0 h-20 w-20 items-center justify-center overflow-hidden rounded-full">
              <Image
                source={logo}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                accessibilityLabel="Logo Le Gole"
              />
            </Box>
            <VStack className="flex-1">
              <Heading size="2xl" className="text-sky-950">
                Benvenuto all'Area Cliente
              </Heading>
              <Text size="sm" className="text-sky-900/70">
                Le Gole
              </Text>
            </VStack>
          </HStack>
          <Text size="sm" className="mt-4 text-sky-900/80">
            Da qui potrai consultare e prenotare i servizi de Le Gole: piscina, ristorante,
            asporto e padel, tutto in un unico posto. Scegli un servizio tra quelli qui sotto — le
            card non ancora attive saranno disponibili a breve.
          </Text>
        </Box>

        {/* I due avvisi restano sopra "I nostri servizi" (un avviso sullo stato del sito va letto
            prima di iniziare a usarlo), ma da tablet in su si affiancano invece di impilarsi: da
            soli occupavano tanta altezza quanto l'intera griglia dei servizi, spingendola fuori
            schermo. Stessa griglia cella+margine negativo usata per i servizi sotto. */}
        <Box className="-m-2 w-full flex-row flex-wrap">
          <Box className="w-full p-2 md:w-1/2">
            <Box className="h-full w-full rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
              <HStack space="sm" className="items-start">
                <Text size="md">🚧</Text>
                <VStack space="xs" className="flex-1">
                  <Text size="xs" className="font-semibold text-amber-900">
                    Piattaforma in fase di sviluppo
                  </Text>
                  <Text size="xs" className="text-amber-800">
                    Stiamo ancora testando questa Area Cliente: potresti incontrare qualche
                    malfunzionamento o rallentamento. Hai trovato un problema o vuoi lasciarci un
                    suggerimento? Trovi il nostro contatto dedicato nella sezione "Assistenza" in
                    fondo alla pagina.
                  </Text>
                </VStack>
              </HStack>
            </Box>
          </Box>

          {/* Nota separata dal banner "in sviluppo" accanto: informazione permanente sul servizio,
              non un avviso temporaneo legato alla fase di test — tono/colore diversi (sky, non
              amber) per non confonderla con quello. */}
          <Box className="w-full p-2 md:w-1/2">
            <Box className="h-full w-full rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <HStack space="sm" className="items-start">
                <Text size="md">🎉</Text>
                <VStack space="xs" className="flex-1">
                  <Text size="xs" className="font-semibold text-sky-900">
                    Organizzi un evento o un compleanno?
                  </Text>
                  <Text size="xs" className="text-sky-900/80">
                    Per eventi privati e compleanni contattaci direttamente al numero di telefono
                    nella sezione "Contatti" in fondo alla pagina: ti aiutiamo a organizzare tutto
                    su misura.
                  </Text>
                </VStack>
              </HStack>
            </Box>
          </Box>
        </Box>

        <VStack space="sm" className="w-full">
          <Heading size="md" className="text-foreground">
            I nostri servizi
          </Heading>
          <ServiziClienteSection />
        </VStack>

        <StoricoPrenotazioniSearch />

        <BackButton fallbackHref="/" />

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
