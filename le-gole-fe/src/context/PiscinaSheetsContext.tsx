import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { createCliente } from '../services/clienti';
import type { Postazione, TipoPostazione } from '../services/struttura';
import type { PrenotazionePiscina } from '../services/prenotazioni';
import {
  EMPTY_EDIT_PRENOTAZIONE_FORM,
  EMPTY_FORM,
  EMPTY_NEW_CLIENTE_FORM,
  type EditPrenotazioneFormState,
  type NewClienteFormState,
  type SheetMode,
  type SimpleFormState,
} from '../types/piscinaMappa';
import {
  computeDefaultOrario,
  formatTime,
  minutesToHHMM,
  parseHHMMToMinutes,
  remainingForTipo,
  toISODate,
  validateOrarioArrivo,
  validateOrarioIngressoIntero,
  validateOrarioIngressoRidotto,
} from '../utils/piscinaMappa';
import { usePiscinaMappaData } from './PiscinaMappaDataContext';
import { usePiscinaSelection } from './PiscinaSelectionContext';

// Esportato perché i tre form annidati dentro PostazioneSheet (AddPostazioneForm,
// AssignPostazioneForm, OccupantForm) NON possono chiamare usePiscinaSheets() da sé: sono
// figli di <Actionsheet>, che gluestack-ui monta tramite un OverlayProvider "teleportato" vicino
// alla radice dell'app (vedi GluestackUIProvider), fuori dall'albero di PiscinaSheetsProvider.
// PostazioneSheet stesso resta nella posizione corretta e passa questo valore come prop.
export type PiscinaSheetsValue = {
  // Giorno passato: assegnazione/modifica/liberazione postazione disattivate (vedi
  // PiscinaMappaDataContext.isPastDate), i form la leggono per disabilitare i controlli.
  isPastDate: boolean;

  // Foglio principale: nuova postazione / assegnazione / occupante esistente.
  sheetMode: SheetMode;
  targetPostazione: Postazione | null;
  sheetForm: SimpleFormState;
  sheetError: string | null;
  isSubmittingSheet: boolean;
  updateSheetForm: (patch: Partial<SimpleFormState>) => void;
  // Massimo di lettini/sdraie assegnabili a QUESTA postazione per il cliente in lavorazione —
  // null quando non c'è alcun limite (postazione occupata manualmente, senza una prenotazione
  // reale collegata). Tiene conto di quanto già assegnato altrove per la stessa prenotazione
  // (assign) o già presente su questa stessa occupazione (occupant, si riaggiunge il suo valore
  // attuale perché remainingByPrenotazione lo conta già come "usato").
  maxLettini: number | null;
  maxSdraie: number | null;
  newTipo: TipoPostazione;
  setNewTipo: (tipo: TipoPostazione) => void;
  newNumero: string;
  setNewNumero: (value: string) => void;
  clientiSelezionabiliPerTarget: PrenotazionePiscina[];
  sheetAriaLabel: string;
  openAddPostazioneSheet: () => void;
  closeSheet: () => void;
  handleMarkerPress: (postazione: Postazione) => void;
  confirmAddPostazione: () => Promise<void>;
  confirmAssign: () => Promise<void>;
  confirmOccupantEdit: () => Promise<void>;
  liberaPostazione: () => Promise<void>;
  handleDeletePostazione: (postazione: Postazione) => void;

  // Picker cliente (dentro il foglio "assign").
  isClientPickerOpen: boolean;
  setIsClientPickerOpen: (open: boolean) => void;
  handlePickCliente: (pren: PrenotazionePiscina) => void;

  // Foglio "Clienti del giorno".
  isClientListOpen: boolean;
  setIsClientListOpen: (open: boolean) => void;

  // Foglio "Nuovo cliente": crea l'anagrafica Cliente insieme a una Prenotazione_Piscina reale.
  isNewClienteSheetOpen: boolean;
  newClienteForm: NewClienteFormState;
  newClienteError: string | null;
  isSubmittingNewCliente: boolean;
  updateNewClienteForm: (patch: Partial<NewClienteFormState>) => void;
  openNewClienteSheet: () => void;
  closeNewClienteSheet: () => void;
  confirmCreateCliente: () => Promise<void>;

  // Foglio "Modifica prenotazione".
  editingPrenotazione: PrenotazionePiscina | null;
  editForm: EditPrenotazioneFormState;
  editError: string | null;
  isSubmittingEdit: boolean;
  updateEditForm: (patch: Partial<EditPrenotazioneFormState>) => void;
  openEditPrenotazione: (p: PrenotazionePiscina) => void;
  closeEditPrenotazione: () => void;
  confirmEditPrenotazione: () => Promise<void>;
  handleDeletePrenotazione: (p: PrenotazionePiscina) => void;

  // Conferma una prenotazione self-service 'PENDING' (nessun altro punto del flusso staff la
  // conferma automaticamente — vedi commento su confirmPrenotazione).
  confirmingPrenotazioneId: string | null;
  confirmPrenotazione: (p: PrenotazionePiscina) => Promise<void>;
};

const PiscinaSheetsContext = createContext<PiscinaSheetsValue | undefined>(undefined);

export function PiscinaSheetsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const {
    inventarioId,
    inventario,
    selectedDate,
    isPastDate,
    occupazioneByPostazione,
    remainingByPrenotazione,
    daAssegnare,
    addPostazione,
    removePostazione,
    assignOccupazione,
    updateOccupazioneEntry,
    removeOccupazione,
    addPrenotazione,
    editPrenotazione,
    removePrenotazione,
  } = usePiscinaMappaData();
  const { selectedPrenotazioneId, selectPrenotazioneCandidate } = usePiscinaSelection();

  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [targetPostazione, setTargetPostazione] = useState<Postazione | null>(null);
  const [sheetForm, setSheetForm] = useState<SimpleFormState>(EMPTY_FORM);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isSubmittingSheet, setIsSubmittingSheet] = useState(false);
  const [newTipo, setNewTipo] = useState<TipoPostazione>('OMBRELLONE');
  const [newNumero, setNewNumero] = useState('');
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [isClientListOpen, setIsClientListOpen] = useState(false);

  const [isNewClienteSheetOpen, setIsNewClienteSheetOpen] = useState(false);
  const [newClienteForm, setNewClienteForm] = useState<NewClienteFormState>(EMPTY_NEW_CLIENTE_FORM);
  const [newClienteError, setNewClienteError] = useState<string | null>(null);
  const [isSubmittingNewCliente, setIsSubmittingNewCliente] = useState(false);

  const [editingPrenotazione, setEditingPrenotazione] = useState<PrenotazionePiscina | null>(null);
  const [editForm, setEditForm] = useState<EditPrenotazioneFormState>(EMPTY_EDIT_PRENOTAZIONE_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [confirmingPrenotazioneId, setConfirmingPrenotazioneId] = useState<string | null>(null);

  const updateSheetForm = (patch: Partial<SimpleFormState>) =>
    setSheetForm((f) => ({ ...f, ...patch }));
  const updateNewClienteForm = (patch: Partial<NewClienteFormState>) =>
    setNewClienteForm((f) => ({ ...f, ...patch }));
  const updateEditForm = (patch: Partial<EditPrenotazioneFormState>) =>
    setEditForm((f) => ({ ...f, ...patch }));

  // Solo i clienti con almeno un'unità residua del tipo della postazione target (es. hanno
  // ancora un gazebo da piazzare se si è aperta una postazione gazebo).
  const clientiSelezionabiliPerTarget = targetPostazione
    ? daAssegnare.filter(
        (p) => remainingForTipo(remainingByPrenotazione.get(p.id), targetPostazione.tipo) > 0
      )
    : [];

  // Prenotazione di riferimento per il limite lettini/sdraie del foglio aperto: quella
  // selezionata in "assign" (non ancora un'occupazione reale), quella collegata all'occupazione
  // esistente in "occupant". Se l'occupazione non è collegata a nessuna prenotazione (assegnata
  // manualmente), non c'è alcun limite da applicare.
  const occupazioneCorrente = targetPostazione ? occupazioneByPostazione.get(targetPostazione.id) : undefined;
  const prenotazioneRiferimentoId =
    sheetMode === 'assign'
      ? selectedPrenotazioneId
      : sheetMode === 'occupant'
        ? occupazioneCorrente?.prenotazione ?? null
        : null;
  const residuoRiferimento = prenotazioneRiferimentoId
    ? remainingByPrenotazione.get(prenotazioneRiferimentoId)
    : undefined;
  const maxLettini = residuoRiferimento
    ? residuoRiferimento.lettino + (sheetMode === 'occupant' ? occupazioneCorrente?.numero_lettini ?? 0 : 0)
    : null;
  const maxSdraie = residuoRiferimento
    ? residuoRiferimento.sdraia + (sheetMode === 'occupant' ? occupazioneCorrente?.numero_sdraie ?? 0 : 0)
    : null;

  const closeSheet = () => {
    setSheetMode(null);
    setSheetError(null);
    setTargetPostazione(null);
    setIsClientPickerOpen(false);
  };

  const openAddPostazioneSheet = () => {
    setNewTipo('OMBRELLONE');
    setNewNumero('');
    setSheetError(null);
    setSheetMode('add-postazione');
  };

  const handlePickCliente = (pren: PrenotazionePiscina) => {
    selectPrenotazioneCandidate(pren.id);
    // Precompila con i RESIDUI (non i totali prenotati): se il cliente ha già una postazione
    // assegnata con alcuni lettini/sdraie, il resto va proposto qui, altrimenti si potrebbe
    // assegnare più del prenotato sommando i due fogli.
    const residuo = remainingByPrenotazione.get(pren.id);
    updateSheetForm({
      clienteNome: pren.cliente_nome,
      clienteTelefono: pren.cliente_telefono,
      lettini: String(residuo?.lettino ?? pren.lettino),
      sdraie: String(residuo?.sdraia ?? pren.sdraia),
      // Il campo orario nel foglio di assegnazione è di sola visualizzazione (AssignPostazioneForm):
      // rispecchia sempre esattamente Prenotazione.ora, senza ricadere su "adesso" se quell'orario
      // è già passato — altrimenti la postazione mostrerebbe un orario diverso da quello della
      // prenotazione (es. prenotato per le 14:30, assegnato alle 14:35: prima diventava "14:35" qui
      // ma restava "14:30" nella lista clienti). L'orario è già garantito valido (campo obbligatorio
      // sia lato self-service che staff, con la soglia del ridotto pomeridiano già verificata alla
      // creazione/modifica della prenotazione), quindi non serve ricalcolarlo né clampare qui.
      orarioArrivo: formatTime(pren.ora),
    });
    setIsClientPickerOpen(false);
  };

  const openNewClienteSheet = () => {
    setNewClienteForm({ ...EMPTY_NEW_CLIENTE_FORM, orarioArrivo: computeDefaultOrario(null, selectedDate) });
    setNewClienteError(null);
    setIsNewClienteSheetOpen(true);
  };

  const closeNewClienteSheet = () => {
    setIsNewClienteSheetOpen(false);
    setNewClienteError(null);
  };

  const confirmCreateCliente = async () => {
    if (isPastDate) {
      setNewClienteError('Non è possibile creare un cliente per un giorno passato.');
      return;
    }
    if (!newClienteForm.nome.trim() || !newClienteForm.telefono.trim()) {
      setNewClienteError('Inserisci nome e telefono del cliente.');
      return;
    }
    const orarioCheck = validateOrarioArrivo(newClienteForm.orarioArrivo, selectedDate);
    if (!orarioCheck.valid) {
      setNewClienteError(orarioCheck.error);
      return;
    }
    if (inventario) {
      const ridottoError = validateOrarioIngressoRidotto(
        minutesToHHMM(orarioCheck.minutes),
        Number.parseInt(newClienteForm.ingressiRidotti, 10) || 0,
        inventario.orario_inizio_ridotto
      );
      if (ridottoError) {
        setNewClienteError(ridottoError);
        return;
      }
      if (Number.parseFloat(inventario.prezzo_ingresso_ridotto) > 0) {
        const interoError = validateOrarioIngressoIntero(
          minutesToHHMM(orarioCheck.minutes),
          Number.parseInt(newClienteForm.ingressi, 10) || 0,
          inventario.orario_inizio_ridotto
        );
        if (interoError) {
          setNewClienteError(interoError);
          return;
        }
      }
    }
    setIsSubmittingNewCliente(true);
    setNewClienteError(null);
    try {
      const cliente = await createCliente({
        nome: newClienteForm.nome.trim(),
        telefono: newClienteForm.telefono.trim(),
      });
      const created = await addPrenotazione({
        cliente_id: cliente.id,
        data: toISODate(selectedDate),
        ora: minutesToHHMM(orarioCheck.minutes),
        // Creata direttamente dallo staff (non self-service): nasce già confermata a prescindere
        // dall'orario di arrivo scelto, che può essere "adesso" per un walk-in fisicamente
        // presente oppure un orario successivo dello stesso giorno.
        stato: 'CONFIRMED',
        inventario: inventarioId,
        note: newClienteForm.note.trim(),
        ingressi: Number.parseInt(newClienteForm.ingressi, 10) || 0,
        ingressi_ridotti: Number.parseInt(newClienteForm.ingressiRidotti, 10) || 0,
        ingressi_bambini: Number.parseInt(newClienteForm.ingressiBambini, 10) || 0,
        ingressi_gratuiti: Number.parseInt(newClienteForm.ingressiGratuiti, 10) || 0,
        ombrellone: Number.parseInt(newClienteForm.ombrellone, 10) || 0,
        gazebo: Number.parseInt(newClienteForm.gazebo, 10) || 0,
        lettino: Number.parseInt(newClienteForm.lettino, 10) || 0,
        sdraia: Number.parseInt(newClienteForm.sdraia, 10) || 0,
      });
      // Selezionata subito come candidata solo se ha unità ombrellone/gazebo da piazzare sulla
      // mappa: una prenotazione "solo ingresso" non ha nulla da assegnare (finirebbe comunque
      // esclusa da ogni postazione, vedi remainingForTipo).
      if (created.ombrellone > 0 || created.gazebo > 0) {
        selectPrenotazioneCandidate(created.id);
      }
      setIsNewClienteSheetOpen(false);
    } catch (err: any) {
      const detail = err?.response?.data;
      const message =
        detail && typeof detail === 'object'
          ? Object.values(detail).flat().join(' ')
          : 'Impossibile creare il cliente e la prenotazione.';
      setNewClienteError(message || 'Impossibile creare il cliente e la prenotazione.');
    } finally {
      setIsSubmittingNewCliente(false);
    }
  };

  const handleMarkerPress = (postazione: Postazione) => {
    const occ = occupazioneByPostazione.get(postazione.id);
    setTargetPostazione(postazione);
    setSheetError(null);

    if (occ) {
      setSheetForm({
        clienteNome: occ.cliente_nome,
        clienteTelefono: '',
        lettini: String(occ.numero_lettini),
        sdraie: String(occ.numero_sdraie),
        orarioArrivo: formatTime(occ.orario_arrivo_previsto),
      });
      setSheetMode('occupant');
      return;
    }

    // Il cliente pre-selezionato dal pannello "Da assegnare" vale solo se ha ancora unità
    // residue del tipo corrispondente a QUESTA postazione (es. selezionato per errore su un
    // gazebo mentre ha solo ombrelloni residui non viene precompilato).
    const pren = selectedPrenotazioneId
      ? daAssegnare.find(
          (p) =>
            p.id === selectedPrenotazioneId &&
            remainingForTipo(remainingByPrenotazione.get(p.id), postazione.tipo) > 0
        )
      : undefined;

    if (pren) {
      // Stesso motivo di handlePickCliente: precompila con i residui, non i totali prenotati.
      // Orario: stesso motivo di handlePickCliente, rispecchia sempre Prenotazione.ora esattamente
      // (il campo è di sola visualizzazione in AssignPostazioneForm, non serve clampare/ricalcolare).
      const residuo = remainingByPrenotazione.get(pren.id);
      setSheetForm({
        clienteNome: pren.cliente_nome,
        clienteTelefono: pren.cliente_telefono,
        lettini: String(residuo?.lettino ?? pren.lettino),
        sdraie: String(residuo?.sdraia ?? pren.sdraia),
        orarioArrivo: formatTime(pren.ora),
      });
    } else {
      setSheetForm({ ...EMPTY_FORM, orarioArrivo: computeDefaultOrario(null, selectedDate) });
    }
    setSheetMode('assign');
  };

  const confirmAssign = async () => {
    if (!targetPostazione) return;
    if (isPastDate) {
      setSheetError('Non è possibile assegnare postazioni per un giorno passato.');
      return;
    }

    if (!selectedPrenotazioneId) {
      setSheetError('Seleziona un cliente tra quelli in attesa, oppure crea un nuovo cliente con "+ Nuovo cliente".');
      return;
    }
    // Il campo orario è di sola visualizzazione qui (AssignPostazioneForm): rispecchia sempre
    // Prenotazione.ora, quindi NON va rifiutato se già "nel passato" rispetto ad adesso — è
    // normalissimo assegnare una postazione qualche minuto dopo l'orario dichiarato dal cliente,
    // e in quel caso l'orario deve restare quello della prenotazione, non essere respinto (a
    // differenza del foglio "occupant", dove l'orario è scelto manualmente in tempo reale e
    // validateOrarioArrivo resta corretto). Basta verificare che sia un formato HH:MM valido.
    const arrivoMinuti = parseHHMMToMinutes(sheetForm.orarioArrivo);
    if (arrivoMinuti === null) {
      setSheetError('Orario di arrivo non valido.');
      return;
    }
    const lettiniRichiesti = Number.parseInt(sheetForm.lettini, 10) || 0;
    const sdraieRichieste = Number.parseInt(sheetForm.sdraie, 10) || 0;
    if (maxLettini !== null && lettiniRichiesti > maxLettini) {
      setSheetError(`Lettini superiori a quelli ancora da assegnare per questo cliente (massimo ${maxLettini}).`);
      return;
    }
    if (maxSdraie !== null && sdraieRichieste > maxSdraie) {
      setSheetError(`Sdraie superiori a quelle ancora da assegnare per questo cliente (massimo ${maxSdraie}).`);
      return;
    }

    setIsSubmittingSheet(true);
    setSheetError(null);
    try {
      await assignOccupazione({
        postazione: targetPostazione.id,
        data: toISODate(selectedDate),
        prenotazione: selectedPrenotazioneId,
        cliente_nome: sheetForm.clienteNome.trim(),
        numero_lettini: lettiniRichiesti,
        numero_sdraie: sdraieRichieste,
        orario_arrivo_previsto: minutesToHHMM(arrivoMinuti),
      });

      // Se questo cliente aveva prenotato più unità dello stesso tipo (es. 2 ombrelloni), resta
      // selezionato dopo l'assegnazione così lo staff può subito toccare la prossima postazione
      // libera per lui, senza doverlo riselezionare dal pannello "Da assegnare".
      const residuiPrimaDiQuestaAssegnazione = remainingForTipo(
        remainingByPrenotazione.get(selectedPrenotazioneId),
        targetPostazione.tipo
      );
      if (residuiPrimaDiQuestaAssegnazione <= 1) {
        selectPrenotazioneCandidate(null);
      }
      closeSheet();
    } catch {
      setSheetError('Impossibile assegnare la postazione.');
    } finally {
      setIsSubmittingSheet(false);
    }
  };

  const confirmOccupantEdit = async () => {
    if (!targetPostazione) return;
    const occ = occupazioneByPostazione.get(targetPostazione.id);
    if (!occ) return;
    if (isPastDate) {
      setSheetError('Non è possibile modificare l\'assegnazione di un giorno passato.');
      return;
    }
    const orarioCheck = validateOrarioArrivo(sheetForm.orarioArrivo, selectedDate);
    if (!orarioCheck.valid) {
      setSheetError(orarioCheck.error);
      return;
    }
    const lettiniRichiesti = Number.parseInt(sheetForm.lettini, 10) || 0;
    const sdraieRichieste = Number.parseInt(sheetForm.sdraie, 10) || 0;
    if (maxLettini !== null && lettiniRichiesti > maxLettini) {
      setSheetError(`Lettini superiori a quelli ancora da assegnare per questo cliente (massimo ${maxLettini}).`);
      return;
    }
    if (maxSdraie !== null && sdraieRichieste > maxSdraie) {
      setSheetError(`Sdraie superiori a quelle ancora da assegnare per questo cliente (massimo ${maxSdraie}).`);
      return;
    }
    setIsSubmittingSheet(true);
    setSheetError(null);
    try {
      await updateOccupazioneEntry(occ.id, {
        cliente_nome: sheetForm.clienteNome.trim(),
        numero_lettini: lettiniRichiesti,
        numero_sdraie: sdraieRichieste,
        orario_arrivo_previsto: minutesToHHMM(orarioCheck.minutes),
      });
      closeSheet();
    } catch {
      setSheetError('Impossibile salvare le modifiche.');
    } finally {
      setIsSubmittingSheet(false);
    }
  };

  const liberaPostazione = async () => {
    if (!targetPostazione) return;
    const occ = occupazioneByPostazione.get(targetPostazione.id);
    if (!occ) return;
    if (isPastDate) {
      setSheetError('Non è possibile liberare una postazione di un giorno passato.');
      return;
    }
    setIsSubmittingSheet(true);
    try {
      await removeOccupazione(occ.id);
      closeSheet();
    } catch {
      setSheetError('Impossibile liberare la postazione.');
    } finally {
      setIsSubmittingSheet(false);
    }
  };

  const confirmDeletePostazione = async (postazione: Postazione) => {
    try {
      await removePostazione(postazione.id);
      closeSheet();
    } catch {
      setSheetError('Impossibile eliminare la postazione (potrebbe essere occupata).');
    }
  };

  const handleDeletePostazione = (postazione: Postazione) => {
    if (isPastDate) {
      setSheetError('Non è possibile eliminare una postazione da un giorno passato.');
      return;
    }
    const message = `La postazione #${postazione.numero} verrà eliminata definitivamente.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        confirmDeletePostazione(postazione);
      }
      return;
    }
    Alert.alert('Eliminare postazione?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => confirmDeletePostazione(postazione) },
    ]);
  };

  const confirmAddPostazione = async () => {
    if (isPastDate) {
      setSheetError('Non è possibile aggiungere postazioni per un giorno passato.');
      return;
    }
    const numero = Number.parseInt(newNumero, 10);
    if (!numero || numero <= 0) {
      setSheetError('Inserisci un numero di postazione valido.');
      return;
    }
    setIsSubmittingSheet(true);
    setSheetError(null);
    try {
      await addPostazione({ tipo: newTipo, numero, pos_x: 50, pos_y: 50 });
      setNewNumero('');
      closeSheet();
    } catch {
      setSheetError('Numero già in uso o dati non validi.');
    } finally {
      setIsSubmittingSheet(false);
    }
  };

  const openEditPrenotazione = (p: PrenotazionePiscina) => {
    setIsClientListOpen(false);
    setEditingPrenotazione(p);
    setEditForm({
      ora: formatTime(p.ora),
      ingressi: String(p.ingressi),
      ingressiRidotti: String(p.ingressi_ridotti),
      ingressiBambini: String(p.ingressi_bambini),
      ingressiGratuiti: String(p.ingressi_gratuiti),
      ombrellone: String(p.ombrellone),
      gazebo: String(p.gazebo),
      lettino: String(p.lettino),
      sdraia: String(p.sdraia),
      note: p.note,
    });
    setEditError(null);
  };

  const closeEditPrenotazione = () => {
    setEditingPrenotazione(null);
    setEditError(null);
  };

  const confirmEditPrenotazione = async () => {
    if (!editingPrenotazione) return;
    if (isPastDate) {
      setEditError('Non è possibile modificare una prenotazione di un giorno passato.');
      return;
    }
    if (!editForm.ora.trim()) {
      setEditError('Inserisci un orario valido.');
      return;
    }
    if (inventario) {
      const ridottoError = validateOrarioIngressoRidotto(
        editForm.ora,
        Number.parseInt(editForm.ingressiRidotti, 10) || 0,
        inventario.orario_inizio_ridotto
      );
      if (ridottoError) {
        setEditError(ridottoError);
        return;
      }
      if (Number.parseFloat(inventario.prezzo_ingresso_ridotto) > 0) {
        const interoError = validateOrarioIngressoIntero(
          editForm.ora,
          Number.parseInt(editForm.ingressi, 10) || 0,
          inventario.orario_inizio_ridotto
        );
        if (interoError) {
          setEditError(interoError);
          return;
        }
      }
    }
    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await editPrenotazione(editingPrenotazione.id, {
        ora: editForm.ora.trim(),
        note: editForm.note.trim(),
        ingressi: Number.parseInt(editForm.ingressi, 10) || 0,
        ingressi_ridotti: Number.parseInt(editForm.ingressiRidotti, 10) || 0,
        ingressi_bambini: Number.parseInt(editForm.ingressiBambini, 10) || 0,
        ingressi_gratuiti: Number.parseInt(editForm.ingressiGratuiti, 10) || 0,
        ombrellone: Number.parseInt(editForm.ombrellone, 10) || 0,
        gazebo: Number.parseInt(editForm.gazebo, 10) || 0,
        lettino: Number.parseInt(editForm.lettino, 10) || 0,
        sdraia: Number.parseInt(editForm.sdraia, 10) || 0,
      });
      closeEditPrenotazione();
    } catch (err: any) {
      const detail = err?.response?.data;
      const message =
        detail && typeof detail === 'object'
          ? Object.values(detail).flat().join(' ')
          : 'Impossibile salvare le modifiche alla prenotazione.';
      setEditError(message || 'Impossibile salvare le modifiche alla prenotazione.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Le prenotazioni self-service (Area Cliente) nascono 'PENDING' (sezione 7 CLAUDE.md): senza
  // un'azione esplicita per confermarle restano in attesa a tempo indeterminato, dato che nessun
  // altro punto del flusso staff cambia lo stato automaticamente (assegnare una postazione o
  // modificare la prenotazione non la conferma).
  const confirmPrenotazione = async (p: PrenotazionePiscina) => {
    if (isPastDate || p.stato !== 'PENDING') return;
    setConfirmingPrenotazioneId(p.id);
    try {
      await editPrenotazione(p.id, { stato: 'CONFIRMED' });
    } catch {
      Alert.alert('Errore', 'Impossibile confermare la prenotazione.');
    } finally {
      setConfirmingPrenotazioneId(null);
    }
  };

  const confirmDeletePrenotazione = async (p: PrenotazionePiscina) => {
    try {
      await removePrenotazione(p.id);
      if (selectedPrenotazioneId === p.id) {
        selectPrenotazioneCandidate(null);
      }
    } catch {
      Alert.alert('Errore', 'Impossibile eliminare la prenotazione.');
    }
  };

  const handleDeletePrenotazione = (p: PrenotazionePiscina) => {
    if (isPastDate) return;
    const message = `La prenotazione di ${p.cliente_nome} verrà eliminata definitivamente insieme alle postazioni già assegnate, che torneranno libere sulla mappa.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        confirmDeletePrenotazione(p);
      }
      return;
    }
    Alert.alert('Eliminare prenotazione?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => confirmDeletePrenotazione(p) },
    ]);
  };

  // react-aria (usato internamente dall'Actionsheet di gluestack-ui) richiede un titolo per ogni
  // dialog a scopo di accessibilità. Il rilevamento automatico via heading interno è soggetto a
  // una race condition con l'animazione di apertura del foglio (il warning in console appariva ad
  // ogni apertura anche se un <Heading> era presente): un aria-label esplicito lo evita del tutto.
  const sheetAriaLabel =
    sheetMode === 'add-postazione'
      ? 'Nuova postazione'
      : sheetMode === 'assign'
        ? `Assegna postazione${targetPostazione ? ` numero ${targetPostazione.numero}` : ''}`
        : sheetMode === 'occupant'
          ? `Postazione${targetPostazione ? ` numero ${targetPostazione.numero}` : ''}`
          : 'Gestione postazione';

  const value: PiscinaSheetsValue = {
    isPastDate,
    sheetMode,
    targetPostazione,
    sheetForm,
    sheetError,
    isSubmittingSheet,
    updateSheetForm,
    maxLettini,
    maxSdraie,
    newTipo,
    setNewTipo,
    newNumero,
    setNewNumero,
    clientiSelezionabiliPerTarget,
    sheetAriaLabel,
    openAddPostazioneSheet,
    closeSheet,
    handleMarkerPress,
    confirmAddPostazione,
    confirmAssign,
    confirmOccupantEdit,
    liberaPostazione,
    handleDeletePostazione,
    isClientPickerOpen,
    setIsClientPickerOpen,
    handlePickCliente,
    isClientListOpen,
    setIsClientListOpen,
    isNewClienteSheetOpen,
    newClienteForm,
    newClienteError,
    isSubmittingNewCliente,
    updateNewClienteForm,
    openNewClienteSheet,
    closeNewClienteSheet,
    confirmCreateCliente,
    editingPrenotazione,
    editForm,
    editError,
    isSubmittingEdit,
    updateEditForm,
    openEditPrenotazione,
    closeEditPrenotazione,
    confirmEditPrenotazione,
    handleDeletePrenotazione,
    confirmingPrenotazioneId,
    confirmPrenotazione,
  };

  return <PiscinaSheetsContext.Provider value={value}>{children}</PiscinaSheetsContext.Provider>;
}

export function usePiscinaSheets(): PiscinaSheetsValue {
  const context = useContext(PiscinaSheetsContext);
  if (!context) {
    throw new Error('usePiscinaSheets deve essere usato all\'interno di un PiscinaSheetsProvider.');
  }
  return context;
}
