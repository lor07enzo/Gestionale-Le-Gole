import { Image, Linking, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Icon, MailIcon, MapPinIcon, MessageCircleIcon, PhoneIcon } from '@/components/ui/icon';
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from './SocialIcons';

// Variante bianca: l'unica leggibile sul footer scuro.
const logo = require('../../../assets/logo-le-gole-bianco.png');

const CONTATTI = {
  telefono: '+39 333 452 8903',
  telefonoHref: 'tel:+393334528903',
  email: 'osterialegole@icloud.com',
  emailHref: 'mailto:osterialegole@icloud.com',
  // Stesso indirizzo di TITOLARE.indirizzo in app/privacy.tsx, duplicato: quella è una route, non un modulo di dominio.
  indirizzo: 'Via Salaria SS4 km 98,865 snc, 02013 Antrodoco (RI)',
};

// Link universale Google Maps, nessuna API key richiesta.
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTATTI.indirizzo)}`;

// Contatto tecnico per bug/feedback sul sito, distinto da CONTATTI.email (la casella del ristorante).
const ASSISTENZA = {
  email: 'seniority55@outlook.it',
  emailHref: 'mailto:seniority55@outlook.it',
};

const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon, url: 'https://instagram.com/osteria_legole' },
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon, url: 'https://facebook.com/Le Gole' },
  { key: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon, url: 'https://wa.me/393334528903' },
];

function openLink(url: string) {
  Linking.openURL(url).catch(() => {});
}

function FooterColumnLabel({ children }: Readonly<{ children: string }>) {
  return (
    <Text size="2xs" className="font-semibold uppercase tracking-widest text-amber-200/50">
      {children}
    </Text>
  );
}

export function ClienteFooter() {
  const anno = new Date().getFullYear();

  return (
    <Box className="-mx-4 -mb-6 mt-2 bg-[#332a18] p-6 md:-mx-8 md:-mb-10 md:p-8">
      <VStack space="lg" className="w-full">
        <VStack space="lg" className="w-full md:flex-row md:items-start md:justify-between">
          <VStack space="xs" className="md:max-w-[40%]">
            <HStack space="sm" className="items-center">
              <Image
                source={logo}
                style={{ width: 28, height: 28 }}
                resizeMode="contain"
                accessibilityLabel="Logo Le Gole"
              />
              <Heading size="sm" className="text-amber-50">
                Le Gole
              </Heading>
            </HStack>
            <Text size="xs" className="text-amber-200/60">
              Piscina, ristorante, asporto e padel: la tua pausa relax, tutta in un unico posto.
            </Text>
          </VStack>

          <VStack space="xs">
            <FooterColumnLabel>Contatti</FooterColumnLabel>
            <Pressable
              onPress={() => openLink(CONTATTI.telefonoHref)}
              accessibilityRole="link"
              accessibilityLabel={`Chiama ${CONTATTI.telefono}`}
            >
              <HStack space="sm" className="items-center">
                <Icon as={PhoneIcon} size="sm" className="text-amber-200/70" />
                <Text size="sm" className="text-amber-100/90">
                  {CONTATTI.telefono}
                </Text>
              </HStack>
            </Pressable>
            <Pressable
              onPress={() => openLink(CONTATTI.emailHref)}
              accessibilityRole="link"
              accessibilityLabel={`Scrivi a ${CONTATTI.email}`}
            >
              <HStack space="sm" className="items-center">
                <Icon as={MailIcon} size="sm" className="text-amber-200/70" />
                <Text size="sm" className="text-amber-100/90">
                  {CONTATTI.email}
                </Text>
              </HStack>
            </Pressable>
            <Pressable
              onPress={() => openLink(MAPS_URL)}
              accessibilityRole="link"
              accessibilityLabel={`Apri l'indirizzo ${CONTATTI.indirizzo} su Google Maps`}
            >
              <HStack space="sm" className="items-start">
                <Icon as={MapPinIcon} size="sm" className="mt-0.5 shrink-0 text-amber-200/70" />
                <Text size="sm" className="flex-1 text-amber-100/90">
                  {CONTATTI.indirizzo}
                </Text>
              </HStack>
            </Pressable>
          </VStack>

          <VStack space="xs">
            <FooterColumnLabel>Social</FooterColumnLabel>
            <HStack space="sm" className="items-center">
              {SOCIAL_LINKS.map(({ key, label, Icon: SocialIcon, url }) => (
                <Pressable
                  key={key}
                  onPress={() => openLink(url)}
                  accessibilityRole="link"
                  accessibilityLabel={label}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                >
                  <SocialIcon size={18} color="#fff" />
                </Pressable>
              ))}
            </HStack>
          </VStack>
        </VStack>

        <Box className="h-px w-full bg-white/10" />

        {/* Sezione dedicata a bug/feedback, distinta dalla colonna "Contatti" sopra. */}
        <Box className="w-full rounded-xl border border-white/10 bg-white/5 p-4">
          <VStack space="xs">
            <HStack space="xs" className="items-center">
              <Icon as={MessageCircleIcon} size="sm" className="text-amber-200/70" />
              <Text size="sm" className="font-semibold text-amber-50">
                Assistenza e feedback
              </Text>
            </HStack>
            <Text size="xs" className="text-amber-200/60">
              Il sito è ancora in fase di sviluppo e test: se riscontri un malfunzionamento o hai
              un suggerimento per migliorarlo, scrivici direttamente.
            </Text>
            <Pressable
              onPress={() => openLink(ASSISTENZA.emailHref)}
              accessibilityRole="link"
              accessibilityLabel={`Scrivi a ${ASSISTENZA.email} per assistenza o feedback`}
            >
              <HStack space="sm" className="items-center">
                <Icon as={MailIcon} size="sm" className="text-amber-200/70" />
                <Text size="sm" className="font-semibold text-amber-100 underline">
                  {ASSISTENZA.email}
                </Text>
              </HStack>
            </Pressable>
          </VStack>
        </Box>

        <Box className="h-px w-full bg-white/10" />

        <HStack space="sm" className="items-center justify-between flex-wrap">
          <Text size="2xs" className="text-amber-200/50">
            © {anno} Le Gole
          </Text>
          <Pressable onPress={() => router.push('/privacy')} accessibilityRole="link">
            <Text size="2xs" className="text-amber-200/50 underline">
              Privacy e Cookie
            </Text>
          </Pressable>
        </HStack>
      </VStack>
    </Box>
  );
}
