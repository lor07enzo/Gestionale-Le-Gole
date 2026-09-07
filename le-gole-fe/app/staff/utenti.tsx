import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { useAuth } from '../../src/context/AuthContext';
import { StaffPageHeader } from '../../src/components/staff/StaffPageHeader';
import { StaffManagementSection } from '../../src/components/staff/StaffManagementSection';

// Pagina dedicata agli account staff, scorporata dalla home. `StaffManagementSection` renderizza
// già `null` per un non-superuser (controparte UI del gate IsSuperUser lato backend): qui serve
// però anche dire perché la pagina è vuota, dato che ora è una rotta raggiungibile per URL.
export default function StaffUtentiScreen() {
  const { user } = useAuth();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <StaffPageHeader
          title="Gestione Staff"
          subtitle="Visualizza e gestisci gli account che accedono alla dashboard."
          fallbackHref="/staff"
        />

        {user?.is_superuser ? (
          <StaffManagementSection />
        ) : (
          <Box className="w-full rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-5 py-8">
            <Text size="sm" className="text-center text-amber-800">
              Questa sezione è riservata agli account amministratore.
            </Text>
          </Box>
        )}
      </VStack>
    </ScrollView>
  );
}
