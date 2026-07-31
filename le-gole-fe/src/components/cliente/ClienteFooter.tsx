import { Image, Linking, Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Icon, MailIcon, PhoneIcon } from '@/components/ui/icon';
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from './SocialIcons';

// Variante bianca del logo (sfondo trasparente): l'unica leggibile sul footer scuro, a
// differenza della variante nera usata ovunque altrove nell'app (sfondi chiari).
const logo = require('../../../assets/logo-le-gole-bianco.png');

// TODO: sostituire con i recapiti e i link social reali de Le Gole prima del rilascio.
const CONTATTI = {
  telefono: '+39 333 452 8903',
  telefonoHref: 'tel:+393334528903',
  email: 'osterialegole@icloud.com',
  emailHref: 'mailto:osterialegole@icloud.com',
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
              Piscina, ristorante e asporto: la tua pausa relax, tutta in un unico posto.
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

        <Text size="2xs" className="text-amber-200/50">
          © {anno} Le Gole
        </Text>
      </VStack>
    </Box>
  );
}
