import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AddIcon, AlertCircleIcon, CloseIcon, Icon, ImageIcon, RemoveIcon, SearchIcon } from '@/components/ui/icon';
import { BackButton } from '../../../src/components/cliente/BackButton';
import { useCarrelloAsporto } from '../../../src/context/CarrelloAsportoContext';
import { goBackOr } from '../../../src/utils/navigation';
import { formatPrezzo } from '../../../src/utils/prezzi';

// Pagina di dettaglio prodotto (non uno sheet): raggiunta toccando una riga del menu asporto
// (app/cliente/asporto/index.tsx). Il catalogo/carrello vive nel context condiviso dal _layout
// del gruppo `asporto/`, quindi non c'è alcun fetch qui — solo la ricerca del prodotto per id.
export default function ClienteAsportoDettaglioScreen() {
  const { prodottoId } = useLocalSearchParams<{ prodottoId: string }>();
  const { prodotti, allergeneById, quantities, setQuantita, isLoading, loadError } = useCarrelloAsporto();
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);

  // Quantità "in scelta", non ancora scritta nel carrello — commessa solo al tap su "Aggiungi
  // per €X" (sotto), che poi riporta subito alla lista prodotti. Riparte da quella già nel
  // carrello per questo prodotto (se il cliente ci era già passato) o da 1 come minimo di scelta,
  // mai da 0: aprire la pagina di un prodotto non deve aggiungerlo da solo al carrello. Risincronizzata
  // su `prodottoId` (non su un semplice useState iniziale) perché Expo Router non rimonta questo
  // componente passando da un prodotto all'altro con lo stesso pattern di rotta.
  const [localQuantita, setLocalQuantita] = useState(1);
  useEffect(() => {
    setLocalQuantita(Math.max(quantities[prodottoId ?? ''] ?? 0, 1));
  }, [prodottoId, quantities]);

  if (isLoading) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  const prodotto = prodotti.find((p) => p.id === prodottoId);

  if (loadError || !prodotto) {
    return (
      <Box className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Icon as={AlertCircleIcon} size="xl" className="text-sky-300" />
        <Text size="sm" className="text-center text-destructive">
          {loadError ?? 'Prodotto non trovato.'}
        </Text>
        <BackButton className="self-center" fallbackHref="/cliente/asporto" />
      </Box>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full max-w-2xl self-center">
        <BackButton fallbackHref="/cliente/asporto" />

        {prodotto.immagine ? (
          // Box relative con due Pressable SORELLE (non annidate): l'immagine intera resta
          // tappabile come prima, più un pulsante-icona in overlay che rende visibile
          // l'affordance di ingrandimento (prima l'unico indizio era il cursore su web, nessuno
          // su touch) — stesso principio "sorelle, non annidate" già usato nel quick-add della
          // lista prodotti, per evitare un <button> HTML dentro un altro <button>.
          <Box className="relative">
            <Pressable
              onPress={() => setIsImageFullscreen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Ingrandisci la foto di ${prodotto.nome}`}
            >
              <Image source={{ uri: prodotto.immagine }} className="h-56 w-full rounded-2xl md:h-72" resizeMode="cover" />
            </Pressable>
            <Pressable
              onPress={() => setIsImageFullscreen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Ingrandisci la foto di ${prodotto.nome}`}
              className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-slate-200/90 active:bg-slate-300"
            >
              <Icon as={SearchIcon} size="md" className="text-sky-700" />
            </Pressable>
          </Box>
        ) : (
          <Box className="h-56 w-full items-center justify-center rounded-2xl bg-sky-50 md:h-72">
            <Icon as={ImageIcon} size="xl" className="text-sky-300" />
          </Box>
        )}

        <VStack space="xs">
          <Heading size="xl" className="text-sky-900">
            {prodotto.nome}
          </Heading>
          <Text size="lg" className="font-bold text-sky-900">
            €{formatPrezzo(prodotto.prezzo)}
          </Text>
        </VStack>

        {prodotto.descrizione ? (
          <Text size="sm" className="text-sky-900/70">
            {prodotto.descrizione}
          </Text>
        ) : null}

        {!prodotto.disponibile ? (
          <Box className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <Text size="sm" className="text-rose-800">
              Questo prodotto non è al momento disponibile.
            </Text>
          </Box>
        ) : null}

        {prodotto.allergeni.length > 0 ? (
          <VStack space="xs">
            <Text size="sm" className="font-medium text-sky-900">
              Allergeni
            </Text>
            <HStack space="xs" className="flex-wrap items-center">
              {prodotto.allergeni.map((id) => {
                const allergene = allergeneById.get(id);
                return (
                  <Box key={id} className="flex-row items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5">
                    {allergene?.icona ? <Text size="sm">{allergene.icona}</Text> : null}
                    <Text size="xs" className="font-medium text-amber-700">
                      {allergene?.nome ?? '—'}
                    </Text>
                  </Box>
                );
              })}
            </HStack>
          </VStack>
        ) : null}

        {prodotto.disponibile ? (
          <VStack space="md" className="w-full items-center">
            {/* Replica fedele di un mockup fornito dall'utente: niente più card/riquadro attorno
                allo stepper (le due versioni precedenti — pillola piena, poi riga con etichetta —
                sono state entrambe respinte) — solo un divisore orizzontale sopra, poi i due
                pulsanti circolari a solo bordo (nessun riempimento) spinti ai bordi da
                `justify-between` con il numero, grande e in grassetto, che risulta così centrato
                tra i due (stessa larghezza per entrambi i pulsanti). Colori invariati rispetto
                alle revisioni precedenti (sky-*, già confermati validi dall'utente). Il "－" si
                ferma a 1 (mai 0): aprire questa pagina non deve azzerare/rimuovere un prodotto
                già nel carrello prima che il cliente abbia confermato una scelta. */}
            <Box className="h-px w-full bg-sky-100" />
            <HStack space="2xl" className="items-center justify-center py-3">
              <Pressable
                onPress={() => setLocalQuantita((q) => Math.max(1, q - 1))}
                disabled={localQuantita <= 1}
                accessibilityRole="button"
                accessibilityLabel={`Diminuisci quantità di ${prodotto.nome}`}
                className={`h-9 w-9 items-center justify-center rounded-full border-2 border-sky-300 active:bg-sky-50 ${
                  localQuantita <= 1 ? 'opacity-40' : ''
                }`}
              >
                <Icon as={RemoveIcon} size="sm" className="text-sky-600" />
              </Pressable>
              <Text size="2xl" className="font-extrabold text-sky-900">
                {localQuantita}
              </Text>
              <Pressable
                onPress={() => setLocalQuantita((q) => q + 1)}
                accessibilityRole="button"
                accessibilityLabel={`Aumenta quantità di ${prodotto.nome}`}
                className="h-9 w-9 items-center justify-center rounded-full border-2 border-sky-300 active:bg-sky-50"
              >
                <Icon as={AddIcon} size="sm" className="text-sky-600" />
              </Pressable>
            </HStack>
            <Button
              size="lg"
              className="w-full"
              onPress={() => {
                setQuantita(prodotto.id, localQuantita);
                goBackOr('/cliente/asporto');
              }}
              accessibilityLabel={`Aggiungi ${localQuantita} ${prodotto.nome} al carrello e torna al menu`}
            >
              <ButtonIcon as={AddIcon} className="text-white" />
              <ButtonText>
                Aggiungi per €{formatPrezzo(String((Number.parseFloat(prodotto.prezzo) || 0) * localQuantita))}
              </ButtonText>
            </Button>
          </VStack>
        ) : null}
      </VStack>

      {prodotto.immagine ? (
        <Modal
          visible={isImageFullscreen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsImageFullscreen(false)}
        >
          {/* Box (un <div>) come contenitore, non un secondo Pressable: il pulsante di chiusura
              deve restare un fratello del backdrop, non un suo discendente — due `Pressable` con
              `accessibilityRole="button"` renderizzano ciascuno un vero `<button>` HTML su web, e
              annidarli produrrebbe un `<button>` dentro un altro `<button>` (non valido, warning
              di idratazione React), stesso principio già applicato al quick-add della lista. */}
          <Box className="flex-1 items-center justify-center bg-black">
            <Pressable
              onPress={() => setIsImageFullscreen(false)}
              accessibilityRole="button"
              accessibilityLabel="Chiudi immagine a schermo intero"
              className="absolute inset-0 items-center justify-center"
            >
              <Image source={{ uri: prodotto.immagine }} className="h-full w-full" resizeMode="contain" />
            </Pressable>
            <Pressable
              onPress={() => setIsImageFullscreen(false)}
              accessibilityRole="button"
              accessibilityLabel="Chiudi"
              className="absolute right-4 top-4 h-10 w-10 items-center justify-center rounded-full bg-white/20 active:bg-white/30"
            >
              <Icon as={CloseIcon} size="md" className="text-white" />
            </Pressable>
          </Box>
        </Modal>
      ) : null}
    </ScrollView>
  );
}
