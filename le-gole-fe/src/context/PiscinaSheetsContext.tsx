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
  computeBulkPositions,
  computeDefaultOrario,
  generateGruppoId,
  formatTime,
  minutesToHHMM,
  nextAvailableNumeri,
  parseHHMMToMinutes,
  remainingForTipo,
  toISODate,
  validateOrarioArrivo,
  validateOrarioIngressoIntero,
  validateOrarioIngressoRidotto,
  type OrientamentoGriglia,
} from '../utils/piscinaMappa';
import { usePiscinaMappaData } from './PiscinaMappaDataContext';
import { usePiscinaSelection } from './PiscinaSelectionContext';

export type OrdineNumeri = 'crescente' | 'decrescente';

// Esportato perché i form annidati in PostazioneSheet (fuori dall'albero del provider) ricevono
// questo valore come prop invece di chiamare usePiscinaSheets() da sé.
export type PiscinaSheetsValue = {
  // Giorno passato: assegnazione/modifica/liberazione postazione disattivate.
  isPastDate: boolean;

  // Foglio principale: nuova postazione / assegnazione / occupante esistente.
  sheetMode: SheetMode;
  targetPostazione: Postazione | null;
  sheetForm: SimpleFormState;
  sheetError: string | null;
  isSubmittingSheet: boolean;
  updateSheetForm: (patch: Partial<SimpleFormState>) => void;
  // null se nessun limite (occupazione manuale senza prenotazione collegata).
  maxLettini: number | null;
  maxSdraie: number | null;
  newTipo: TipoPostazione;
  setNewTipo: (tipo: TipoPostazione) => void;
  newNumero: string;
  // Creazione in blocco: solo per i gazebi, gli ombrelloni restano sempre singoli.
  newQuantita: string;
  setNewQuantita: (value: string) => void;
  newOrientamento: OrientamentoGriglia;
  setNewOrientamento: (value: OrientamentoGriglia) => void;
  // Quale estremo della striscia riceve il numero più basso riservato.
  newOrdineNumeri: OrdineNumeri;
  setNewOrdineNumeri: (value: OrdineNumeri) => void;
  // Numeri riservati in anticipo (non collidono tra loro), già riordinati secondo newOrdineNumeri.
  newNumeriPreview: number[];
  // Usato da AddPostazioneForm per "X/Y posizionati" e per disabilitare "Aggiungi" al limite.
  capacitaOmbrelloni: { usati: number; totale: number };
  capacitaGazebi: { usati: number; totale: number };
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

  // Per singola postazione, non per prenotazione: un cliente con 3 gazebi va segnato su ciascuno.
  arrivato: boolean;
  isTogglingArrivato: boolean;
  toggleArrivato: () => Promise<void>;

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
  // Annulla (stato -> CANCELLED, non un'eliminazione reale): il backend libera da sé le postazioni già assegnate.
  handleCancelPrenotazione: (p: PrenotazionePiscina) => void;

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
    postazioni,
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
    cancelPrenotazione,
  } = usePiscinaMappaData();
  const { selectedPrenotazioneId, selectPrenotazioneCandidate } = usePiscinaSelection();

  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [targetPostazione, setTargetPostazione] = useState<Postazione | null>(null);
  const [sheetForm, setSheetForm] = useState<SimpleFormState>(EMPTY_FORM);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isSubmittingSheet, setIsSubmittingSheet] = useState(false);
  const [newTipo, setNewTipo] = useState<TipoPostazione>('OMBRELLONE');
  const [newQuantita, setNewQuantita] = useState('1');
  const [newOrientamento, setNewOrientamento] = useState<OrientamentoGriglia>('verticale');
  const [newOrdineNumeri, setNewOrdineNumeri] = useState<OrdineNumeri>('crescente');
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
  const [isTogglingArrivato, setIsTogglingArrivato] = useState(false);

  const updateSheetForm = (patch: Partial<SimpleFormState>) =>
    setSheetForm((f) => ({ ...f, ...patch }));
  const updateNewClienteForm = (patch: Partial<NewClienteFormState>) =>
    setNewClienteForm((f) => ({ ...f, ...patch }));
  const updateEditForm = (patch: Partial<EditPrenotazioneFormState>) =>
    setEditForm((f) => ({ ...f, ...patch }));

  // Solo i clienti con almeno un'unità residua del tipo della postazione target.
  const clientiSelezionabiliPerTarget = targetPostazione
    ? daAssegnare.filter(
        (p) => remainingForTipo(remainingByPrenotazione.get(p.id), targetPostazione.tipo) > 0
      )
    : [];

  // Prenotazione di riferimento per il limite lettini/sdraie: selezionata in "assign", collegata
  // all'occupazione in "occupant" (nessun limite se assegnata manualmente).
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
  const arrivato = occupazioneCorrente?.arrivato ?? false;

  const capacitaOmbrelloni = {
    usati: postazioni.filter((p) => p.tipo === 'OMBRELLONE').length,
    totale: inventario?.totale_ombrelloni ?? 0,
  };
  const capacitaGazebi = {
    usati: postazioni.filter((p) => p.tipo === 'GAZEBO').length,
    totale: inventario?.totale_gazebi ?? 0,
  };

  // La creazione in blocco è solo per i gazebi: la quantità resta sempre 1 per l'ombrellone.
  const quantitaRichiesta =
    newTipo === 'GAZEBO' ? Math.max(Number.parseInt(newQuantita, 10) || 1, 1) : 1;
  const newNumeriPreview = useMemo(() => {
    const base = nextAvailableNumeri(postazioni, quantitaRichiesta);
    return newOrdineNumeri === 'decrescente' ? [...base].reverse() : base;
  }, [postazioni, quantitaRichiesta, newOrdineNumeri]);
  const newNumero = String(newNumeriPreview[0] ?? '');

  const closeSheet = () => {
    setSheetMode(null);
    setSheetError(null);
    setTargetPostazione(null);
    setIsClientPickerOpen(false);
  };

  const openAddPostazioneSheet = () => {
    setNewTipo('OMBRELLONE');
    setNewQuantita('1');
    setNewOrientamento('verticale');
    setNewOrdineNumeri('crescente');
    setSheetError(null);
    setSheetMode('add-postazione');
  };

  const handlePickCliente = (pren: PrenotazionePiscina) => {
    selectPrenotazioneCandidate(pren.id);
    // Precompila con i residui, non i totali prenotati: evita di assegnare più del prenotato
    // sommando più postazioni.
    const residuo = remainingByPrenotazione.get(pren.id);
    updateSheetForm({
      clienteNome: pren.cliente_nome,
      clienteTelefono: pren.cliente_telefono,
      lettini: String(residuo?.lettino ?? pren.lettino),
      sdraie: String(residuo?.sdraia ?? pren.sdraia),
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
        // Creata direttamente dallo staff: nasce già confermata.
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
      // Selezionata come candidata solo se ha unità ombrellone/gazebo da piazzare.
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

    // Vale solo se ha ancora unità residue del tipo corrispondente a questa postazione.
    const pren = selectedPrenotazioneId
      ? daAssegnare.find(
          (p) =>
            p.id === selectedPrenotazioneId &&
            remainingForTipo(remainingByPrenotazione.get(p.id), postazione.tipo) > 0
        )
      : undefined;

    if (pren) {
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
    // Sola visualizzazione qui, rispecchia Prenotazione.ora: basta verificare il formato HH:MM.
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
        arrivato: false,
      });

      // Se resta unità dello stesso tipo, il cliente rimane selezionato per l'assegnazione successiva.
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

  // Azione rapida separata da confirmOccupantEdit: non richiede "Salva modifiche".
  const toggleArrivato = async () => {
    if (!targetPostazione) return;
    const occ = occupazioneByPostazione.get(targetPostazione.id);
    if (!occ) return;
    if (isPastDate) {
      setSheetError('Non è possibile modificare lo stato di arrivo di un giorno passato.');
      return;
    }
    setIsTogglingArrivato(true);
    setSheetError(null);
    try {
      await updateOccupazioneEntry(occ.id, { arrivato: !occ.arrivato });
    } catch {
      setSheetError('Impossibile aggiornare lo stato di arrivo.');
    } finally {
      setIsTogglingArrivato(false);
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
    if (newNumeriPreview.length < quantitaRichiesta) {
      setSheetError('Impossibile calcolare i prossimi numeri disponibili. Chiudi e riprova.');
      return;
    }
    // Backstop: lo stesso limite è comunque applicato lato backend (fonte di verità).
    const capacita = newTipo === 'OMBRELLONE' ? capacitaOmbrelloni : capacitaGazebi;
    const postiResidui = capacita.totale - capacita.usati;
    const etichettaTipo = newTipo === 'OMBRELLONE' ? 'ombrelloni' : 'gazebi';
    if (postiResidui <= 0) {
      setSheetError(`Limite raggiunto: il listino prevede al massimo ${capacita.totale} ${etichettaTipo}.`);
      return;
    }
    if (quantitaRichiesta > postiResidui) {
      setSheetError(
        `Il listino prevede al massimo ${capacita.totale} ${etichettaTipo}: ne restano da posizionare solo ${postiResidui}.`
      );
      return;
    }
    setIsSubmittingSheet(true);
    setSheetError(null);
    try {
      const posizioni = computeBulkPositions(newTipo, quantitaRichiesta, newOrientamento);
      // Un blocco di più gazebo condivide un unico `gruppo`: da qui si sposta sempre insieme.
      const gruppo = newTipo === 'GAZEBO' && quantitaRichiesta > 1 ? generateGruppoId() : null;
      // In sequenza (non Promise.all) solo per non sommergere il backend di richieste simultanee.
      for (let i = 0; i < quantitaRichiesta; i++) {
        await addPostazione({
          tipo: newTipo,
          numero: newNumeriPreview[i],
          pos_x: posizioni[i].pos_x,
          pos_y: posizioni[i].pos_y,
          gruppo,
        });
      }
      closeSheet();
    } catch (err: any) {
      const detail = err?.response?.data;
      const message =
        detail && typeof detail === 'object'
          ? Object.values(detail).flat().join(' ')
          : 'Numero non più disponibile: chiudi e riapri il foglio per ricalcolarlo.';
      setSheetError(message);
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

  // Le prenotazioni self-service nascono 'PENDING': nessun altro punto le conferma automaticamente.
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

  const confirmCancelPrenotazione = async (p: PrenotazionePiscina) => {
    try {
      await cancelPrenotazione(p.id);
      if (selectedPrenotazioneId === p.id) {
        selectPrenotazioneCandidate(null);
      }
    } catch {
      Alert.alert('Errore', 'Impossibile annullare la prenotazione.');
    }
  };

  const handleCancelPrenotazione = (p: PrenotazionePiscina) => {
    if (isPastDate) return;
    const message = `La prenotazione di ${p.cliente_nome} verrà annullata. Le postazioni già assegnate torneranno libere sulla mappa; la prenotazione resterà comunque visibile nello storico del cliente come cancellata.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        confirmCancelPrenotazione(p);
      }
      return;
    }
    Alert.alert('Annullare prenotazione?', message, [
      { text: 'No', style: 'cancel' },
      { text: 'Annulla prenotazione', style: 'destructive', onPress: () => confirmCancelPrenotazione(p) },
    ]);
  };

  // aria-label esplicito: il rilevamento automatico del titolo da parte di react-aria ha una
  // race condition con l'animazione di apertura del foglio (warning in console anche con Heading).
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
    newQuantita,
    setNewQuantita,
    newOrientamento,
    setNewOrientamento,
    newOrdineNumeri,
    setNewOrdineNumeri,
    newNumeriPreview,
    capacitaOmbrelloni,
    capacitaGazebi,
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
    arrivato,
    isTogglingArrivato,
    toggleArrivato,
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
    handleCancelPrenotazione,
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
