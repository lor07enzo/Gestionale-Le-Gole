import api from './api';

export type Cliente = {
  id: string;
  nome: string;
  telefono: string;
  note: string;
};

export type CreateClientePayload = Omit<Cliente, 'id'>;

const CLIENTI_PATH = '/v1/users/clienti/';

// POST /v1/users/clienti/
export function createCliente(payload: CreateClientePayload): Promise<Cliente> {
  return api.post<Cliente>(CLIENTI_PATH, payload).then((response) => response.data);
}
