import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable } from 'react-native';
import { router, Slot } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { StaffNotificationsProvider } from '../../src/context/StaffNotificationsContext';
import { NotificationsBanner, NotificationsBell } from '../../src/components/staff/NotificationsBell';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Icon, SearchIcon } from '@/components/ui/icon';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';

const logo = require('../../assets/logo-le-gole-nero.png');

export default function StaffLayout() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated]);

  const initials = useMemo(() => user?.username?.slice(0, 2).toUpperCase() ?? '??', [user]);

  if (isLoading || !user) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  const handleLogout = async () => {
    setIsAccountSheetOpen(false);
    await logout();
    router.replace('/');
  };

  return (
    <StaffNotificationsProvider>
      <Box className="flex-1 bg-background">
        <Box className="border-b border-border/80 bg-background/70 web:backdrop-blur-md">
          <HStack className="mx-auto w-full max-w-4xl items-center justify-between px-4 py-3 md:px-8 md:py-4">
            <Pressable
              className="flex-row items-center gap-2"
              onPress={() => setIsAccountSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Apri profilo account"
            >
              <Box className="h-9 w-9 items-center justify-center overflow-hidden rounded-full md:h-10 md:w-10">
                <Image
                  source={logo}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityLabel="Logo Le Gole"
                />
              </Box>
              <Heading size="md" className="md:text-xl">
                Le Gole
              </Heading>
            </Pressable>

            <HStack space="md" className="items-center">
              <Pressable
                className="h-9 flex-row items-center gap-1 md:h-10"
                onPress={() => router.push('/staff/clienti')}
                accessibilityRole="button"
                accessibilityLabel="Cerca clienti"
              >
                <Icon as={SearchIcon} size="md" className="text-sky-700" />
                <Text size="sm" className="font-medium text-sky-700 md:text-base">
                  Cerca
                </Text>
              </Pressable>
              <NotificationsBell />
            </HStack>
          </HStack>
        </Box>

        <NotificationsBanner />

        <Box className="mx-auto w-full max-w-4xl flex-1">
          <Slot />
        </Box>

        <Actionsheet isOpen={isAccountSheetOpen} onClose={() => setIsAccountSheetOpen(false)}>
          <ActionsheetBackdrop />
          <ActionsheetContent>
            <ActionsheetDragIndicatorWrapper>
              <ActionsheetDragIndicator />
            </ActionsheetDragIndicatorWrapper>

            <VStack space="sm" className="w-full items-center pb-4 pt-1">
              <Box className="h-16 w-16 items-center justify-center rounded-full bg-primary">
                <Text className="text-xl font-bold text-primary-foreground">{initials}</Text>
              </Box>
              <VStack space="xs" className="items-center">
                <Heading size="md">{user.username}</Heading>
                <Text size="sm" className="text-muted-foreground">
                  {user.email}
                </Text>
              </VStack>
            </VStack>

            <Box className="my-3 h-px w-full bg-border" />

            <ActionsheetItem
              onPress={handleLogout}
              className="mb-5 rounded-lg bg-destructive/10 data-[hover=true]:bg-destructive/20 data-[active=true]:bg-destructive/20"
            >
              <ActionsheetItemText className="w-full text-center font-semibold text-destructive">
                Logout
              </ActionsheetItemText>
            </ActionsheetItem>
          </ActionsheetContent>
        </Actionsheet>
      </Box>
    </StaffNotificationsProvider>
  );
}
