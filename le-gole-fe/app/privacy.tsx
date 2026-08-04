import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { BackButton } from '../src/components/cliente/BackButton';

// Campi ancora segnaposto: vanno sostituiti con i dati reali prima del rilascio in produzione.
const TITOLARE = {
  ragioneSociale: 'AME S.n.c.',
  nomeCommerciale: 'Osteria Le Gole',
  piva: '[P.IVA / CODICE FISCALE]',
  indirizzo: '[INDIRIZZO SEDE LEGALE]',
  emailPrivacy: '[EMAIL DI CONTATTO PER RICHIESTE PRIVACY]',
};

const ULTIMO_AGGIORNAMENTO = '3 agosto 2026';

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

export default function PrivacyScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full max-w-2xl self-center">
        <VStack space="xs">
          <Heading size="2xl" className="text-foreground">
            Informativa sulla Privacy e Cookie Policy
          </Heading>
          <Text size="xs" className="text-muted-foreground">
            Ultimo aggiornamento: {ULTIMO_AGGIORNAMENTO}
          </Text>
        </VStack>

        <Box className="w-full rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <Text size="xs" className="text-amber-900">
            ⚠️ Bozza con segnaposto: i campi tra parentesi quadre (P.IVA/CF, indirizzo, email di
            contatto per la privacy) vanno sostituiti con i dati reali prima di pubblicare questa
            pagina in produzione.
          </Text>
        </Box>

        <VStack space="xs">
          <SectionHeading>1. Titolare del trattamento</SectionHeading>
          <Paragraph>
            Il Titolare del trattamento dei dati raccolti tramite questo sito e l'app Le Gole è{' '}
            {TITOLARE.ragioneSociale} (nome commerciale "{TITOLARE.nomeCommerciale}"), P.IVA/CF{' '}
            {TITOLARE.piva}, con sede in {TITOLARE.indirizzo}. Per qualsiasi richiesta relativa al
            trattamento dei tuoi dati personali puoi scrivere a {TITOLARE.emailPrivacy}.
          </Paragraph>
        </VStack>

        <VStack space="xs">
          <SectionHeading>2. Quali dati raccogliamo</SectionHeading>
          <Paragraph>
            Raccogliamo solo i dati necessari a fornirti i servizi richiesti, in particolare la
            prenotazione della piscina dall'Area Cliente:
          </Paragraph>
          <ListItem>
            <Text size="sm" className="font-semibold text-foreground">Clienti:</Text> nome e numero
            di telefono, inseriti al momento della prenotazione; la data, l'orario e le risorse
            richieste (ingressi, ombrelloni, gazebi, lettini, sdraie); eventuali note facoltative
            che scegli di aggiungere alla prenotazione (ad es. richieste particolari o allergie —
            se scrivi informazioni di questo tipo, le trattiamo come categoria particolare di dati
            ex art. 9 GDPR, sulla base del tuo inserimento volontario e consapevole).
          </ListItem>
          <ListItem>
            <Text size="sm" className="font-semibold text-foreground">Personale (staff):</Text>{' '}
            nome utente ed email usati per accedere al gestionale interno; la password non è mai
            conservata in chiaro.
          </ListItem>
          <ListItem>
            <Text size="sm" className="font-semibold text-foreground">Dati tecnici:</Text> nessun
            dato di navigazione o cookie di tracciamento — vedi la sezione Cookie Policy più sotto.
          </ListItem>
        </VStack>

        <VStack space="xs">
          <SectionHeading>3. Perché trattiamo i tuoi dati (finalità e base giuridica)</SectionHeading>
          <ListItem>
            Gestire la tua prenotazione e fornirti il servizio richiesto (esecuzione di un
            contratto o di misure precontrattuali su tua richiesta, art. 6.1.b GDPR).
          </ListItem>
          <ListItem>
            Riconoscerti come cliente già registrato quando prenoti di nuovo con lo stesso numero
            di telefono, per non doverti richiedere gli stessi dati ogni volta.
          </ListItem>
          <ListItem>
            Inviarti, se richiesto, comunicazioni tecniche relative alla prenotazione (es. il
            biglietto d'ingresso in PDF).
          </ListItem>
          <ListItem>
            Per il personale: gestire l'accesso al gestionale interno e le comunicazioni
            relative all'account (attivazione, reimpostazione password).
          </ListItem>
          <Paragraph>
            Non utilizziamo i tuoi dati per finalità di marketing, profilazione o pubblicità, e non
            li vendiamo né li cediamo a terzi per scopi commerciali.
          </Paragraph>
        </VStack>

        <VStack space="xs">
          <SectionHeading>4. Con chi condividiamo i dati</SectionHeading>
          <Paragraph>
            I dati sono trattati tramite alcuni fornitori tecnici di cui ci avvaliamo per far
            funzionare il servizio, che agiscono come responsabili del trattamento su nostre
            istruzioni:
          </Paragraph>
          <ListItem>Hosting del database e del backend applicativo (infrastruttura cloud).</ListItem>
          <ListItem>Hosting del sito/app web.</ListItem>
          <ListItem>
            Servizio di invio email per le comunicazioni transazionali (attivazione account,
            reimpostazione password dello staff).
          </ListItem>
          <Paragraph>
            Alcuni di questi fornitori possono trattare i dati anche al di fuori dello Spazio
            Economico Europeo; in tal caso il trasferimento avviene sulla base delle clausole
            contrattuali standard approvate dalla Commissione Europea o di altre garanzie adeguate
            previste dal GDPR.
          </Paragraph>
        </VStack>

        <VStack space="xs">
          <SectionHeading>5. Per quanto tempo conserviamo i dati</SectionHeading>
          <Paragraph>
            Conserviamo i dati delle prenotazioni per il tempo necessario a gestire il servizio e,
            successivamente, per il periodo richiesto da eventuali obblighi contabili o fiscali. I
            dati del personale sono conservati per la durata del rapporto di collaborazione e per
            il periodo previsto dagli obblighi di legge applicabili. Puoi richiedere la
            cancellazione anticipata dei tuoi dati secondo quanto descritto nella sezione
            successiva.
          </Paragraph>
        </VStack>

        <VStack space="xs">
          <SectionHeading>6. I tuoi diritti</SectionHeading>
          <Paragraph>
            In qualsiasi momento puoi richiedere al Titolare, scrivendo a {TITOLARE.emailPrivacy}:
          </Paragraph>
          <ListItem>l'accesso ai dati che abbiamo su di te;</ListItem>
          <ListItem>la correzione di dati inesatti o incompleti;</ListItem>
          <ListItem>la cancellazione dei tuoi dati, quando non sussistano obblighi di conservazione;</ListItem>
          <ListItem>la limitazione o l'opposizione al trattamento;</ListItem>
          <ListItem>la portabilità dei dati che ci hai fornito.</ListItem>
          <Paragraph>
            Hai inoltre il diritto di proporre reclamo all'Autorità Garante per la protezione dei
            dati personali (www.garanteprivacy.it) se ritieni che il trattamento violi la
            normativa applicabile.
          </Paragraph>
        </VStack>

        <VStack space="xs">
          <SectionHeading>7. Minori</SectionHeading>
          <Paragraph>
            Il servizio di prenotazione è pensato per essere utilizzato da un adulto (genitore o
            accompagnatore). Per gli ingressi riservati ai bambini raccogliamo solo un conteggio
            numerico ai fini della tariffa applicabile, non dati personali specifici del minore.
          </Paragraph>
        </VStack>

        <VStack space="xs">
          <SectionHeading>8. Sicurezza dei dati</SectionHeading>
          <Paragraph>
            Adottiamo misure tecniche adeguate a proteggere i tuoi dati: le comunicazioni con il
            sito avvengono tramite connessione cifrata (HTTPS), le password sono conservate in
            forma cifrata e mai in chiaro, e l'accesso ai dati amministrativi è riservato al solo
            personale autorizzato tramite credenziali personali.
          </Paragraph>
        </VStack>

        <VStack space="xs">
          <SectionHeading>9. Cookie Policy</SectionHeading>
          <Paragraph>
            Questo sito non utilizza cookie di profilazione, pubblicitari o di terze parti, e non
            effettua alcun tipo di tracciamento a fini statistici o di marketing.
          </Paragraph>
          <Paragraph>
            Per far funzionare l'accesso dello staff al gestionale, il sito salva alcune
            informazioni tecniche nella memoria locale del browser (`localStorage`), equiparabile
            ai cookie ai fini di questa informativa:
          </Paragraph>
          <ListItem>
            un token di autenticazione, necessario per mantenere la sessione di accesso dello
            staff senza richiedere il login ad ogni pagina;
          </ListItem>
          <ListItem>
            una preferenza interna (l'orario dell'ultima consultazione delle notifiche di nuove
            prenotazioni), utile solo al personale durante l'uso del gestionale.
          </ListItem>
          <Paragraph>
            Si tratta di informazioni tecniche strettamente necessarie al funzionamento del
            servizio: per queste, la normativa non richiede un consenso preventivo, ma le
            dichiariamo comunque per trasparenza. Se in futuro il sito dovesse introdurre strumenti
            di analisi statistica o marketing, questa pagina sarà aggiornata e verrà richiesto il
            consenso dove necessario.
          </Paragraph>
        </VStack>

        <VStack space="xs">
          <SectionHeading>10. Modifiche a questa informativa</SectionHeading>
          <Paragraph>
            Questa informativa può essere aggiornata nel tempo, ad esempio in caso di modifiche al
            servizio o alla normativa applicabile. La data di ultimo aggiornamento è indicata in
            cima a questa pagina.
          </Paragraph>
        </VStack>

        <BackButton className="mt-2" />
      </VStack>
    </ScrollView>
  );
}
