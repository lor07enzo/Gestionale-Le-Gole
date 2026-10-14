import { useCallback, useEffect, useState } from 'react';
import { AppState, Image, Linking, Modal, Platform } from 'react-native';
import Constants from 'expo-constants';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { getVersioneApp } from '../../services/servizi';
import { richiedeAggiornamento } from '../../utils/versione';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logo = require('../../../assets/logo-le-gole-nero.png');

const VERSIONE_INSTALLATA = Constants.expoConfig?.version ?? '0.0.0';

// Colori letterali e non classi: bg-background/bg-card non sono affidabili su nativo (sezione 4).
const SFONDO = '#eae0c8';
const CARD = '#ffffff';
const BORDO = '#e5e5e5';

type Blocco = { versioneMinima: string; url: string };

// Schermata bloccante "aggiorna l'app": controllata all'avvio e a ogni ritorno in primo piano.
// Solo app native (sul web Netlify serve sempre l'ultima build). Non blocca mai se la richiesta
// fallisce o se manca il link allo store della piattaforma: meglio un'app vecchia che inutilizzabile.
export function AggiornamentoObbligatorio() {
  const [blocco, setBlocco] = useState<Blocco | null>(null);

  const controlla = useCallback(async () => {
    try {
      const dati = await getVersioneApp();
      const url = Platform.OS === 'ios' ? dati.url_ios : dati.url_android;
      setBlocco(
        url && richiedeAggiornamento(VERSIONE_INSTALLATA, dati.versione_minima)
          ? { versioneMinima: dati.versione_minima, url }
          : null
      );
    } catch {
      // Rete assente o backend irraggiungibile: si lascia lo stato com'è.
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void controlla();
    const sottoscrizione = AppState.addEventListener('change', (stato) => {
      if (stato === 'active') void controlla();
    });
    return () => sottoscrizione.remove();
  }, [controlla]);

  if (!blocco) return null;

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      // Il tasto indietro di Android non deve chiudere la schermata.
      onRequestClose={() => {}}
    >
      <Box
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: SFONDO }}
      >
        <VStack
          space="lg"
          className="w-full max-w-md items-center rounded-3xl p-6"
          style={{ backgroundColor: CARD, borderWidth: 1, borderColor: BORDO }}
        >
          <Image source={logo} style={{ width: 80, height: 80 }} resizeMode="contain" />
          <Heading size="xl" className="text-center text-foreground">
            Aggiornamento richiesto
          </Heading>
          <Text className="text-center text-muted-foreground">
            È disponibile una nuova versione di Le Gole. Per continuare a usare l'app è
            necessario aggiornarla.
          </Text>
          <Button className="min-h-12 w-full" onPress={() => void Linking.openURL(blocco.url)}>
            <ButtonText>
              {Platform.OS === 'ios' ? "Aggiorna dall'App Store" : 'Aggiorna da Google Play'}
            </ButtonText>
          </Button>
          <Text size="xs" className="text-center text-muted-foreground">
            Versione installata {VERSIONE_INSTALLATA} · richiesta {blocco.versioneMinima}
          </Text>
        </VStack>
      </Box>
    </Modal>
  );
}
