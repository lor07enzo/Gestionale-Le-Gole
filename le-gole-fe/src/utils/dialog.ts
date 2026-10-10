import { Alert, Platform } from 'react-native';

// `Alert.alert` è un no-op su react-native-web: su web si ripiega sui dialog nativi del browser.

export function mostraErrore(messaggio: string, titolo = 'Errore') {
  if (Platform.OS === 'web') {
    window.alert(messaggio);
  } else {
    Alert.alert(titolo, messaggio);
  }
}

export function chiediConferma(
  titolo: string,
  messaggio: string,
  etichettaConferma: string,
  onConferma: () => void,
) {
  if (Platform.OS === 'web') {
    if (window.confirm(messaggio)) onConferma();
    return;
  }
  Alert.alert(titolo, messaggio, [
    { text: 'No', style: 'cancel' },
    { text: etichettaConferma, style: 'destructive', onPress: onConferma },
  ]);
}
