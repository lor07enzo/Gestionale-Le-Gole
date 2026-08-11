import { useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EditIcon, SlashIcon, ThreeDotsIcon, TrashIcon } from '@/components/ui/icon';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetIcon,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { useAuth } from '../../context/AuthContext';
import { StaffManagementProvider, useStaffManagement } from '../../context/StaffManagementContext';
import type { StaffMember } from '../../services/staff';
import { StaffFormSheet } from './StaffFormSheet';

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
    }
  }
  return fallback;
}

type StaffRowProps = {
  member: StaffMember;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
};

function StaffRow({ member, isSelf, onEdit, onDelete, onToggleActive }: Readonly<StaffRowProps>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const runAction = (action: () => void) => {
    setIsMenuOpen(false);
    action();
  };

  return (
    <HStack space="sm" className="items-start rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
      <Box className="h-9 w-9 items-center justify-center rounded-full bg-white/70">
        <Text size="md">{member.is_superuser ? '👑' : '👤'}</Text>
      </Box>
      <VStack space="xs" className="flex-1">
        <HStack className="items-start justify-between">
          <HStack space="xs" className="flex-1 flex-wrap items-center">
            <Text size="sm" className="font-semibold text-sky-900">
              {member.username}
            </Text>
            {isSelf ? (
              <Box className="rounded-full bg-sky-500/15 px-2 py-0.5">
                <Text size="2xs" className="font-medium text-sky-700">
                  Tu
                </Text>
              </Box>
            ) : null}
            {member.is_superuser ? (
              <Box className="rounded-full bg-amber-100 px-2 py-0.5">
                <Text size="2xs" className="font-medium text-amber-700">
                  Superuser
                </Text>
              </Box>
            ) : null}
            {!member.is_active ? (
              <Box className="rounded-full bg-rose-100 px-2 py-0.5">
                <Text size="2xs" className="font-medium text-rose-700">
                  Disattivato
                </Text>
              </Box>
            ) : null}
          </HStack>

          {/* Menù a tendina: Modifica/Disattiva-Riattiva/Elimina vivevano prima come pulsanti
              testuali affiancati, ingombranti su una riga già densa di badge — accorpati dietro
              i tre puntini, stesso pattern "Actionsheet come menu" già usato altrove nel progetto
              (es. il selettore tipo inventario in PiscinaInventarioSection.tsx) invece di
              introdurre un vero popover ancorato, non presente nel kit di componenti. */}
          <Pressable
            onPress={() => setIsMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Azioni per ${member.username}`}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-sky-200/60"
          >
            <ActionsheetIcon as={ThreeDotsIcon} className="text-sky-700" />
          </Pressable>
        </HStack>
        <Text size="xs" className="text-sky-900/70">
          {member.email || '—'}
        </Text>
      </VStack>

      <Actionsheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent aria-label={`Azioni per ${member.username}`}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack space="xs" className="w-full pb-4 pt-1">
            <Heading size="sm" className="px-1 pb-2">
              {member.username}
            </Heading>

            <ActionsheetItem onPress={() => runAction(onEdit)}>
              <ActionsheetIcon as={EditIcon} className="text-sky-700" />
              <ActionsheetItemText>Modifica</ActionsheetItemText>
            </ActionsheetItem>

            {/* Un superuser non può disattivare il proprio account da qui: eviterebbe un lockout
                (nessun altro modo per ripristinarlo se non da manage.py createsuperuser). Il
                cambio password è nel menu account (app/staff/_layout.tsx), non qui. */}
            {!isSelf ? (
              <ActionsheetItem onPress={() => runAction(onToggleActive)}>
                <ActionsheetIcon as={SlashIcon} className="text-amber-700" />
                <ActionsheetItemText className="text-amber-700">
                  {member.is_active ? 'Disattiva' : 'Riattiva'}
                </ActionsheetItemText>
              </ActionsheetItem>
            ) : null}

            {/* Un superuser non è mai eliminabile (solo disattivabile) — è l'unico tipo di
                account che gestisce gli altri, perderlo per errore non avrebbe rimedio se non da
                manage.py createsuperuser. Stesso guardrail applicato lato backend
                (UtenteViewSet.destroy), qui solo per non mostrare un'azione che il server
                rifiuterebbe comunque. */}
            {!isSelf && !member.is_superuser ? (
              <ActionsheetItem onPress={() => runAction(onDelete)}>
                <ActionsheetIcon as={TrashIcon} className="text-destructive" />
                <ActionsheetItemText className="text-destructive">
                  Elimina
                </ActionsheetItemText>
              </ActionsheetItem>
            ) : null}
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </HStack>
  );
}

function StaffManagementSectionInner() {
  const { user } = useAuth();
  const { staff, isLoading, error, removeStaff, toggleStaffActive } = useStaffManagement();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  const openCreateForm = () => {
    setEditingStaff(null);
    setIsFormOpen(true);
  };

  const openEditForm = (member: StaffMember) => {
    setEditingStaff(member);
    setIsFormOpen(true);
  };

  const confirmDelete = async (member: StaffMember) => {
    try {
      await removeStaff(member.id);
    } catch (err) {
      const message = extractApiErrorMessage(err, "Impossibile eliminare l'account staff.");
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Impossibile eliminare', message);
      }
    }
  };

  const handleDelete = (member: StaffMember) => {
    const message = `L'account "${member.username}" verrà eliminato definitivamente.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        confirmDelete(member);
      }
      return;
    }
    Alert.alert('Eliminare account staff?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => confirmDelete(member) },
    ]);
  };

  const handleToggleActive = async (member: StaffMember) => {
    try {
      await toggleStaffActive(member.id, !member.is_active);
    } catch (err) {
      const message = extractApiErrorMessage(err, "Impossibile aggiornare lo stato dell'account.");
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Impossibile aggiornare', message);
      }
    }
  };

  return (
    <VStack space="md" className="w-full">
      <HStack className="items-center justify-between">
        <VStack>
          <Heading size="md">Gestione Staff</Heading>
          <Text size="xs" className="text-muted-foreground">
            Visualizza e gestisci gli account che accedono alla dashboard.
          </Text>
        </VStack>
        <Button size="sm" onPress={openCreateForm}>
          <ButtonText>+ Nuovo staff</ButtonText>
        </Button>
      </HStack>

      {isLoading ? (
        <HStack space="sm" className="items-center py-4">
          <Spinner size="small" />
          <Text size="sm" className="text-muted-foreground">
            Caricamento staff...
          </Text>
        </HStack>
      ) : null}

      {error ? (
        <Text size="sm" className="text-destructive">
          {error}
        </Text>
      ) : null}

      {!isLoading && staff.length === 0 ? (
        <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
          <Text size="lg">👤</Text>
          <Text size="sm" className="text-center text-muted-foreground">
            Nessun account staff creato ancora.
          </Text>
        </VStack>
      ) : (
        <VStack space="sm">
          {staff.map((member) => (
            <StaffRow
              key={member.id}
              member={member}
              isSelf={member.id === user?.id}
              onEdit={() => openEditForm(member)}
              onDelete={() => handleDelete(member)}
              onToggleActive={() => handleToggleActive(member)}
            />
          ))}
        </VStack>
      )}

      <StaffFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editingStaff={editingStaff}
      />
    </VStack>
  );
}

// Visibile solo ai superuser (creati via `python manage.py createsuperuser`, non tramite API):
// gestire l'elenco/gli account altrui è riservato a IsSuperUser anche lato backend
// (users/permissions.py), questo gate è solo la controparte UI dello stesso vincolo.
export function StaffManagementSection() {
  const { user } = useAuth();
  if (!user?.is_superuser) {
    return null;
  }

  return (
    <StaffManagementProvider>
      <StaffManagementSectionInner />
    </StaffManagementProvider>
  );
}
