import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
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
  remainingForTipo,
  toISODate,
  validateOrarioArrivo,
} from '../utils/piscinaMappa';
import { usePiscinaMappaData } from './PiscinaMappaDataContext';
import { usePiscinaSelection } from './PiscinaSelectionContext';

type PiscinaSheetsValue = {
  // Foglio principale: nuova postazione / assegnazione / occupante esistente.
  sheetMode: SheetMode;
  targetPostazione: Postazione | null;
  sheetForm: SimpleFormState;
  sheetError: string | null;
  isSubmittingSheet: boolean;
  updateSheetForm: (patch: Partial<SimpleFormState>) => void;
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

  // Foglio "Nuovo cliente" (walk-in).
  isNewClienteSheetOpen: boolean;
  newClienteForm: NewClienteFormState;
  newClienteError: string | null;
  isSubmittingNewCliente: boolean;
  updateNewClienteForm: (patch: Partial<NewClienteFormState>) => void;
  openNewClienteSheet: () => void;
  closeNewClienteSheet: () => void;
  confirmCreateWalkInCliente: () => Promise<void>;

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
};

const PiscinaSheetsContext = createContext<PiscinaSheetsValue | undefined>(undefined);

export function PiscinaSheetsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const {
    selectedDate,
    occupazioneByPostazione,
    remainingByPrenotazione,
    daAssegnare,
    addPostazione,
    removePostazione,
    assignOccupazione,
    updateOccupazioneEntry,
    removeOccupazione,
    editPrenotazione,
    removePrenotazione,
  } = usePiscinaMappaData();
  const {
    selectedPrenotazioneId,
    selectedWalkInCliente,
    selectPrenotazioneCandidate,
    selectWalkInCliente,
    createWalkInCliente,
  } = usePiscinaSelection();

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
    updateSheetForm({
      clienteNome: pren.cliente_nome,
      clienteTelefono: pren.cliente_telefono,
      lettini: String(pren.lettino),
      sdraie: String(pren.sdraia),
      orarioArrivo: computeDefaultOrario(pren.ora, selectedDate),
    });
    setIsClientPickerOpen(false);
  };

  const openNewClienteSheet = () => {
    setNewClienteForm(EMPTY_NEW_CLIENTE_FORM);
    setNewClienteError(null);
    setIsNewClienteSheetOpen(true);
  };

  const closeNewClienteSheet = () => {
    setIsNewClienteSheetOpen(false);
    setNewClienteError(null);
  };

  const confirmCreateWalkInCliente = async () => {
    if (!newClienteForm.nome.trim() || !newClienteForm.telefono.trim()) {
      setNewClienteError('Inserisci nome e telefono del cliente.');
      return;
    }
    setIsSubmittingNewCliente(true);
    setNewClienteError(null);
    try {
      await createWalkInCliente({
        nome: newClienteForm.nome.trim(),
        telefono: newClienteForm.telefono.trim(),
        note: newClienteForm.note.trim(),
      });
      setIsNewClienteSheetOpen(false);
    } catch {
      setNewClienteError('Impossibile creare il cliente.');
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

    // Un cliente walk-in appena creato (vedi "+ Nuovo cliente") non ha vincoli di tipo
    // ombrellone/gazebo (nessuna prenotazione da rispettare): va bene su qualunque postazione libera.
    if (selectedWalkInCliente) {
      setSheetForm({
        clienteNome: selectedWalkInCliente.nome,
        clienteTelefono: selectedWalkInCliente.telefono,
        lettini: '0',
        sdraie: '0',
        orarioArrivo: computeDefaultOrario(null, selectedDate),
      });
      setSheetMode('assign');
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
      setSheetForm({
        clienteNome: pren.cliente_nome,
        clienteTelefono: pren.cliente_telefono,
        lettini: String(pren.lettino),
        sdraie: String(pren.sdraia),
        orarioArrivo: computeDefaultOrario(pren.ora, selectedDate),
      });
    } else {
      setSheetForm({ ...EMPTY_FORM, orarioArrivo: computeDefaultOrario(null, selectedDate) });
    }
    setSheetMode('assign');
  };

  const confirmAssign = async () => {
    if (!targetPostazione) return;

    if (!selectedWalkInCliente && !selectedPrenotazioneId) {
      setSheetError('Seleziona un cliente tra quelli in attesa, oppure crea un nuovo cliente con "+ Nuovo cliente".');
      return;
    }
    const orarioCheck = validateOrarioArrivo(sheetForm.orarioArrivo, selectedDate);
    if (!orarioCheck.valid) {
      setSheetError(orarioCheck.error);
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
        numero_lettini: Number.parseInt(sheetForm.lettini, 10) || 0,
        numero_sdraie: Number.parseInt(sheetForm.sdraie, 10) || 0,
        orario_arrivo_previsto: minutesToHHMM(orarioCheck.minutes),
      });

      if (selectedWalkInCliente) {
        // Un walk-in non ha "unità residue": una volta assegnato a una postazione, la selezione
        // si chiude da sola (per un'altra unità basta creare un nuovo cliente, o già ce n'è
        // un'altra istanza reale se il gruppo ha più persone).
        selectWalkInCliente(null);
      } else if (selectedPrenotazioneId) {
        // Se questo cliente aveva prenotato più unità dello stesso tipo (es. 2 ombrelloni),
        // resta selezionato dopo l'assegnazione così lo staff può subito toccare la prossima
        // postazione libera per lui, senza doverlo riselezionare dal pannello "Da assegnare".
        const residuiPrimaDiQuestaAssegnazione = remainingForTipo(
          remainingByPrenotazione.get(selectedPrenotazioneId),
          targetPostazione.tipo
        );
        if (residuiPrimaDiQuestaAssegnazione <= 1) {
          selectPrenotazioneCandidate(null);
        }
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
    const orarioCheck = validateOrarioArrivo(sheetForm.orarioArrivo, selectedDate);
    if (!orarioCheck.valid) {
      setSheetError(orarioCheck.error);
      return;
    }
    setIsSubmittingSheet(true);
    setSheetError(null);
    try {
      await updateOccupazioneEntry(occ.id, {
        cliente_nome: sheetForm.clienteNome.trim(),
        numero_lettini: Number.parseInt(sheetForm.lettini, 10) || 0,
        numero_sdraie: Number.parseInt(sheetForm.sdraie, 10) || 0,
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
      ombrellone: String(p.ombrellone),
      gazebo: String(p.gazebo),
      lettino: String(p.lettino),
      sdraia: String(p.sdraia),
    });
    setEditError(null);
  };

  const closeEditPrenotazione = () => {
    setEditingPrenotazione(null);
    setEditError(null);
  };

  const confirmEditPrenotazione = async () => {
    if (!editingPrenotazione) return;
    if (!editForm.ora.trim()) {
      setEditError('Inserisci un orario valido.');
      return;
    }
    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await editPrenotazione(editingPrenotazione.id, {
        ora: editForm.ora.trim(),
        ingressi: Number.parseInt(editForm.ingressi, 10) || 0,
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
    sheetMode,
    targetPostazione,
    sheetForm,
    sheetError,
    isSubmittingSheet,
    updateSheetForm,
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
    confirmCreateWalkInCliente,
    editingPrenotazione,
    editForm,
    editError,
    isSubmittingEdit,
    updateEditForm,
    openEditPrenotazione,
    closeEditPrenotazione,
    confirmEditPrenotazione,
    handleDeletePrenotazione,
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
