import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Icon, MailIcon } from '@/components/ui/icon';
import { BackButton } from '../src/components/cliente/BackButton';

// Pagina richiesta da Google Play (sezione "Sicurezza dei dati": URL di eliminazione account e
// dati associati). Deve restare pubblica e raggiungibile senza login: un rimando alla sola
// informativa generica non soddisfa il requisito, che chiede cosa viene eliminato, cosa resta e
// come si richiede. Dati e formulazioni allineati ad app/privacy.tsx (stesso Titolare, stessa
// casella, stesse regole di conservazione) per non avere due pagine che si contraddicono.
const TITOLARE = {
  nomeCommerciale: 'Osteria Le Gole',
  ragioneSociale: 'AME S.r.l.',
  emailPrivacy: 'osterialegole@icloud.com',
};

const OGGETTO_EMAIL = 'Richiesta di eliminazione dei dati';
const MAILTO = `mailto:${TITOLARE.emailPrivacy}?subject=${encodeURIComponent(OGGETTO_EMAIL)}`;

const ULTIMO_AGGIORNAMENTO = '21 settembre 2026';

function SectionHeading({ children }: Readonly<{ children: string }>) {
  return (
    <Heading size="md" className="mt-2 text-foreground">
      {children}
    </Heading>
  );
}

function Paragraph({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Text size="sm" className="leading-6 text-muted-foreground">
      {children}
    </Text>
  );
}

function ListItem({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Text size="sm" className="leading-6 text-muted-foreground">
      •  {children}
    </Text>
  );
}

function Bold({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Text size="sm" className="font-semibold text-foreground">
      {children}
    </Text>
  );
}

export default function EliminazioneDatiScreen() {
  // Rotta di primo livello (app/eliminazione-dati.tsx, non app/cliente/...): non eredita il
  // paddingTop dell'inset condiviso da app/cliente/_layout.tsx, va riservato qui — stessa causa
  // e stesso rimedio già applicati ad app/privacy.tsx (sezione 7 di CLAUDE.md).
  const insets = useSafeAreaInsets();
  return (
    <Box className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
        <VStack space="lg" className="w-full max-w-2xl self-center">
          <VStack space="xs">
            <Heading size="2xl" className="text-foreground">
              Eliminazione dei dati
            </Heading>
            <Text size="xs" className="text-muted-foreground">
              Ultimo aggiornamento: {ULTIMO_AGGIORNAMENTO}
            </Text>
          </VStack>

          <Box className="w-full rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <VStack space="sm">
              <Heading size="sm" className="text-foreground">
                In breve
              </Heading>
              <Paragraph>
                Per prenotare su {TITOLARE.nomeCommerciale} non serve registrarsi: non esiste un
                account cliente da eliminare. Le tue prenotazioni sono però collegate al nome e al
                numero di telefono che hai indicato, e puoi chiederne la cancellazione in qualsiasi
                momento scrivendo all&apos;indirizzo qui sotto.
              </Paragraph>
              <Pressable
                onPress={() => Linking.openURL(MAILTO).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel={`Scrivi a ${TITOLARE.emailPrivacy} per richiedere l'eliminazione dei dati`}
                className="min-h-11 w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3"
              >
                <HStack space="xs" className="items-center">
                  <Icon as={MailIcon} size="sm" className="text-white" />
                  <Text size="sm" className="font-semibold text-white">
                    {TITOLARE.emailPrivacy}
                  </Text>
                </HStack>
              </Pressable>
            </VStack>
          </Box>

          <VStack space="xs">
            <SectionHeading>1. Nessun account cliente</SectionHeading>
            <Paragraph>
              L&apos;app non prevede alcuna registrazione per i clienti: si prenota indicando nome e
              numero di telefono, senza creare credenziali e senza password. Non esiste quindi un
              account da chiudere, ma solo dei dati collegati al tuo numero, che puoi far eliminare.
            </Paragraph>
            <Paragraph>
              Gli account presenti nell&apos;app riguardano esclusivamente il personale del locale e
              non sono creabili dagli utenti: li crea su invito un amministratore (vedi il punto 5).
            </Paragraph>
          </VStack>

          <VStack space="xs">
            <SectionHeading>2. Quali dati sono collegati a te</SectionHeading>
            <ListItem>nome e numero di telefono indicati al momento della prenotazione;</ListItem>
            <ListItem>
              data, orario e contenuto delle tue prenotazioni (piscina, asporto, campo da padel),
              comprese le eventuali note facoltative che hai scritto tu;
            </ListItem>
            <ListItem>
              nessun dato di navigazione, nessun cookie di profilazione e nessuna posizione: le
              statistiche del sito sono anonime e aggregate (vedi la Cookie Policy
              nell&apos;informativa privacy).
            </ListItem>
          </VStack>

          <VStack space="xs">
            <SectionHeading>3. Come richiedere l&apos;eliminazione</SectionHeading>
            <Paragraph>
              Scrivi a {TITOLARE.emailPrivacy} indicando il <Bold>nome</Bold> e il{' '}
              <Bold>numero di telefono</Bold> che hai usato per prenotare: sono i due dati con cui
              ritroviamo le prenotazioni collegate a te. Puoi usare come oggetto
              &quot;{OGGETTO_EMAIL}&quot;.
            </Paragraph>
            <Paragraph>
              Se dalla richiesta non riusciamo a risalire con certezza alle prenotazioni, potremmo
              chiederti un ulteriore riferimento (ad esempio la data di una prenotazione recente)
              prima di procedere: serve a non cancellare i dati della persona sbagliata.
            </Paragraph>
          </VStack>

          <VStack space="xs">
            <SectionHeading>4. Cosa viene eliminato e cosa possiamo dover conservare</SectionHeading>
            <Paragraph>
              Eliminiamo la tua anagrafica (nome e numero di telefono) e le prenotazioni collegate,
              note comprese.
            </Paragraph>
            <Paragraph>
              Restano conservati solo i dati per i quali esiste un obbligo di legge, in particolare
              quelli contenuti in documenti contabili o fiscali già emessi, per il periodo previsto
              dalla normativa: in quei casi ti indichiamo cosa non possiamo eliminare e perché.
              Trascorso quel periodo, anche quei dati vengono eliminati.
            </Paragraph>
          </VStack>

          <VStack space="xs">
            <SectionHeading>5. Account del personale</SectionHeading>
            <Paragraph>
              Gli account dello staff sono creati su invito da un amministratore del locale e non
              sono registrabili autonomamente. Per chiedere la disattivazione o l&apos;eliminazione
              di un account e dei dati associati (nome utente ed email) si scrive allo stesso
              indirizzo, oppure ci si rivolge direttamente all&apos;amministratore.
            </Paragraph>
          </VStack>

          <VStack space="xs">
            <SectionHeading>6. Tempi di risposta</SectionHeading>
            <Paragraph>
              Rispondiamo entro 30 giorni dalla richiesta, come previsto dall&apos;art. 12 del GDPR.
              Se la richiesta risulta particolarmente complessa il termine può essere prorogato, ma
              te lo comunichiamo entro gli stessi 30 giorni spiegandone il motivo.
            </Paragraph>
            <Paragraph>
              Oltre alla cancellazione puoi esercitare tutti gli altri diritti previsti dal GDPR
              (accesso, rettifica, limitazione, opposizione, portabilità) e proporre reclamo al
              Garante per la protezione dei dati personali (www.garanteprivacy.it). Il dettaglio è
              nell&apos;informativa privacy.
            </Paragraph>
          </VStack>

          <Box className="w-full rounded-2xl border border-border bg-card p-5">
            <VStack space="xs">
              <Text
                size="2xs"
                className="font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Titolare del trattamento
              </Text>
              <Text size="sm" className="font-semibold text-foreground">
                {TITOLARE.ragioneSociale} (&quot;{TITOLARE.nomeCommerciale}&quot;)
              </Text>
              <Paragraph>
                I dati identificativi completi (P.IVA e sede legale) sono
                nell&apos;informativa privacy.
              </Paragraph>
            </VStack>
          </Box>

          <BackButton className="mt-2" fallbackHref="/cliente" />
        </VStack>
      </ScrollView>
    </Box>
  );
}
