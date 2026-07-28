import api from './api';

export type Cliente = {
  id: string;
  nome: string;
  telefono: string;
};

export type CreateClientePayload = Omit<Cliente, 'id'>;

const CLIENTI_PATH = '/v1/users/clienti/';

// POST /v1/users/clienti/
export function createCliente(payload: CreateClientePayload): Promise<Cliente> {
  return api.post<Cliente>(CLIENTI_PATH, payload).then((response) => response.data);
}

// GET /v1/users/clienti/?search=... (staff, IsAuthenticated) — un'unica query testuale che
// matcha sia nome sia telefono (icontains, case-insensitive) lato backend.
export function searchClienti(query: string): Promise<Cliente[]> {
  return api.get<Cliente[]>(CLIENTI_PATH, { params: { search: query } }).then((response) => response.data);
}

// GET /v1/users/clienti/{id}/ (staff, IsAuthenticated)
export function getCliente(id: string): Promise<Cliente> {
  return api.get<Cliente>(`${CLIENTI_PATH}${id}/`).then((response) => response.data);
}
