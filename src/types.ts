export type ContactType = 'whatsapp' | 'telegram' | 'email';

export interface UserProfile {
  uid: string;
  name: string;
  city?: string;
  photoURL?: string;
  contactType: ContactType;
  contactValue: string;
  createdAt: any;
}

export interface Thought {
  id: string;
  uid: string;
  authorName: string;
  authorCity?: string;
  authorPhotoURL?: string;
  text: string;
  imageURL?: string;        // base64 — foto do momento (opcional)
  imageCaption?: string;    // legenda da foto (opcional, max 180 chars)
  contactType: ContactType;
  contactValue: string;
  createdAt: any;
}
