import api from './api';

export type StaffMember = {
  id: string;
  username: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
};

export type CreateStaffPayload = {
  username: string;
  email: string;
};

// Niente password qui: la creazione lascia l'account senza password utilizzabile
// (UtenteCreateSerializer.create -> set_unusable_password) finché lo staff non la imposta
// da solo tramite il link di attivazione ricevuto via email (vedi activateAccount).
export type UpdateStaffPayload = Partial<CreateStaffPayload>;

export type SetPasswordPayload = { uid: string; token: string; password: string };

const STAFF_PATH = '/v1/users/staff/';

// GET /v1/users/staff/ (riservato ai superuser, vedi permissions.IsSuperUser)
export function listStaff(): Promise<StaffMember[]> {
  return api.get<StaffMember[]>(STAFF_PATH).then((response) => response.data);
}

// POST /v1/users/staff/ — crea is_staff=True, is_superuser=False, senza password
// (UtenteCreateSerializer) e invia un'email di attivazione (users/utils.send_activation_email).
export function createStaff(payload: CreateStaffPayload): Promise<StaffMember> {
  return api.post<StaffMember>(STAFF_PATH, payload).then((response) => response.data);
}

// PATCH /v1/users/staff/{id}/ — solo username/email (UtenteSerializer non espone più password).
export function updateStaff(id: string, payload: UpdateStaffPayload): Promise<StaffMember> {
  return api.patch<StaffMember>(`${STAFF_PATH}${id}/`, payload).then((response) => response.data);
}

// DELETE /v1/users/staff/{id}/
export function deleteStaff(id: string): Promise<void> {
  return api.delete(`${STAFF_PATH}${id}/`).then(() => undefined);
}

// PATCH /v1/users/staff/{id}/set-active/ — riservato ai superuser; il backend rifiuta con 400
// il tentativo di disattivare il proprio stesso account (UtenteViewSet.set_active).
export function setStaffActive(id: string, is_active: boolean): Promise<StaffMember> {
  return api
    .patch<StaffMember>(`${STAFF_PATH}${id}/set-active/`, { is_active })
    .then((response) => response.data);
}

// POST /v1/users/staff/activate/ — pubblico (AllowAny): imposta la prima password
// tramite uid/token ricevuti via email, attivando l'account creato da un superuser.
export function activateAccount(payload: SetPasswordPayload): Promise<{ detail: string }> {
  return api.post<{ detail: string }>(`${STAFF_PATH}activate/`, payload).then((response) => response.data);
}

// POST /v1/users/staff/reset-password/request/ — pubblico: invia sempre lo stesso messaggio
// generico (non rivela se l'email è registrata).
export function requestPasswordReset(email: string): Promise<{ detail: string }> {
  return api
    .post<{ detail: string }>(`${STAFF_PATH}reset-password/request/`, { email })
    .then((response) => response.data);
}

// POST /v1/users/staff/reset-password/confirm/ — pubblico: imposta una nuova password
// tramite uid/token ricevuti via email.
export function confirmPasswordReset(payload: SetPasswordPayload): Promise<{ detail: string }> {
  return api
    .post<{ detail: string }>(`${STAFF_PATH}reset-password/confirm/`, payload)
    .then((response) => response.data);
}
