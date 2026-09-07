import type { Href } from 'expo-router';
import { StaffPageHeader } from '../StaffPageHeader';

export function MappaHeader({ nome }: Readonly<{ nome: string | undefined }>) {
  return (
    <StaffPageHeader
      title={nome ?? 'Mappa Piscina'}
      subtitle="Postazioni ombrelloni e gazebi"
      fallbackHref={'/staff/piscina' as Href}
    />
  );
}
