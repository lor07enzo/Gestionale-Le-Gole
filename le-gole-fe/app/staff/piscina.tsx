import { ScrollView } from 'react-native';
import { VStack } from '@/components/ui/vstack';
import { StaffPageHeader } from '../../src/components/staff/StaffPageHeader';
import { PiscinaInventarioSection } from '../../src/components/staff/PiscinaInventarioSection';

// Pagina dedicata ai listini piscina, scorporata dalla home (diventata una dashboard di soli punti
// d'ingresso). Coesiste con la rotta dinamica app/staff/piscina/[inventarioId].tsx — stesso schema
// "file piatto + sottocartella omonima" già usato da clienti.tsx / clienti/[clienteId].tsx.
export default function StaffPiscinaScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <StaffPageHeader
          title="Inventario Piscina"
          subtitle="Tocca un listino per gestire la mappa delle postazioni del giorno."
          fallbackHref="/staff"
        />
        <PiscinaInventarioSection />
      </VStack>
    </ScrollView>
  );
}
