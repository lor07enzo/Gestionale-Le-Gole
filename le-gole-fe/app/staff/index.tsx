import { ScrollView } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { PiscinaInventarioSection } from '../../src/components/staff/PiscinaInventarioSection';
import { MenuAsportoLinkCard } from '../../src/components/staff/MenuAsportoLinkCard';
import { StaffManagementSection } from '../../src/components/staff/StaffManagementSection';

function saluto(): string {
  const ora = new Date().getHours();
  if (ora < 6) return 'Buonanotte';
  if (ora < 13) return 'Buongiorno';
  if (ora < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export default function StaffHomeScreen() {
  const { user } = useAuth();

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
          <Heading size="xl">
            {saluto()}, {user.username}
          </Heading>
          <Text size="sm" className="text-muted-foreground">
            Gestisci qui i listini piscina, le postazioni giornaliere e il menu asporto.
          </Text>
        </VStack>

        <PiscinaInventarioSection />
        <MenuAsportoLinkCard />
        <StaffManagementSection />
      </VStack>
    </ScrollView>
  );
}
