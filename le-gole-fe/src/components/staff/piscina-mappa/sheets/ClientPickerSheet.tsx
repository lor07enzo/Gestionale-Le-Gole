import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { usePiscinaMappaData } from '../../../../context/PiscinaMappaDataContext';
import { usePiscinaSheets } from '../../../../context/PiscinaSheetsContext';
import { formatDisplayDate, remainingForTipo } from '../../../../utils/piscinaMappa';

export function ClientPickerSheet() {
  const { selectedDate, remainingByPrenotazione } = usePiscinaMappaData();
  const { isClientPickerOpen, setIsClientPickerOpen, clientiSelezionabiliPerTarget, targetPostazione, handlePickCliente } =
    usePiscinaSheets();

  if (!targetPostazione) return null;

  return (
    <Actionsheet isOpen={isClientPickerOpen} onClose={() => setIsClientPickerOpen(false)}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[70vh]" aria-label="Seleziona cliente">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          <VStack space="xs" className="w-full pb-4 pt-1">
            <Heading size="sm" className="px-1 pb-2">
              Chi ha prenotato per {formatDisplayDate(selectedDate)}?
            </Heading>
            {clientiSelezionabiliPerTarget.map((p) => {
              const residui = remainingForTipo(remainingByPrenotazione.get(p.id), targetPostazione.tipo);
              const icon = targetPostazione.tipo === 'GAZEBO' ? '⛺' : '⛱️';
              return (
                <ActionsheetItem
                  key={p.id}
                  onPress={() => handlePickCliente(p)}
                  className="rounded-lg data-[hover=true]:bg-sky-100 data-[active=true]:bg-sky-100"
                >
                  <VStack className="flex-1">
                    <ActionsheetItemText className="font-semibold">{p.cliente_nome}</ActionsheetItemText>
                    <Text size="xs" className="text-muted-foreground">
                      {p.cliente_telefono}
                    </Text>
                  </VStack>
                  <Text size="xs" className="text-sky-700">
                    {icon} {residui} da assegnare
                  </Text>
                </ActionsheetItem>
              );
            })}
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
