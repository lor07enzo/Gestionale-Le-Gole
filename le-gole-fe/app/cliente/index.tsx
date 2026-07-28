import { Image, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ServiziClienteSection } from '../../src/components/cliente/ServiziClienteSection';
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
            <Box className="h-20 w-20 items-center justify-center overflow-hidden rounded-full">
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
            Da qui potrai consultare e prenotare i servizi de Le Gole: piscina, ristorante e
            asporto, tutto in un unico posto. Scegli un servizio tra quelli qui sotto — le card
            non ancora attive saranno disponibili a breve.
          </Text>
        </Box>

        <VStack space="sm" className="w-full">
          <Heading size="md" className="text-foreground">
            I nostri servizi
          </Heading>
          <ServiziClienteSection />
        </VStack>

        <Box className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <HStack space="sm" className="items-start">
            <Text size="md">💬</Text>
            <Text size="xs" className="flex-1 text-amber-800">
              Hai bisogno di aiuto o informazioni? Qui sotto troverai i nostri contatti e social.
            </Text>
          </HStack>
        </Box>

        <BackButton />

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
