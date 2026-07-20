import '../global.css';
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';

export default function RootLayout() {
  return (
    
    <GluestackUIProvider mode="light">
      <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
    </GluestackUIProvider>
  
  );
}
