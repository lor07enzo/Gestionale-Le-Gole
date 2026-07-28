import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
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
  return (
    <HStack space="sm" className="items-start rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
      <Box className="h-9 w-9 items-center justify-center rounded-full bg-white/70">
        <Text size="md">{member.is_superuser ? '👑' : '👤'}</Text>
      </Box>
      <VStack space="xs" className="flex-1">
        <HStack space="xs" className="items-center flex-wrap">
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
                Disattivo
              </Text>
            </Box>
          ) : null}
        </HStack>
        <Text size="xs" className="text-sky-900/70">
          {member.email || '—'}
        </Text>

        <HStack space="xs" className="flex-wrap pt-1">
          <Button size="sm" variant="outline" className="border-sky-300" onPress={onEdit}>
            <ButtonText size="sm">Modifica</ButtonText>
          </Button>
          {/* Un superuser non può disattivare/eliminare il proprio account da qui: eviterebbe un
              lockout (nessun altro modo per ripristinarlo se non da manage.py createsuperuser).
              Il cambio password è nel menu account (vedi app/staff/_layout.tsx), non qui. */}
          {!isSelf ? (
            <>
              <Button size="sm" variant="outline" className="border-amber-400" onPress={onToggleActive}>
                <ButtonText size="sm" className="text-amber-700">
                  {member.is_active ? 'Disattiva' : 'Riattiva'}
                </ButtonText>
              </Button>
              <Button size="sm" variant="outline" className="border-destructive/40" onPress={onDelete}>
                <ButtonText size="sm" className="text-destructive">
                  Elimina
                </ButtonText>
              </Button>
            </>
          ) : null}
        </HStack>
      </VStack>
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
