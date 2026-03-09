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
  contactType: ContactType;
  contactValue: string;
  createdAt: any;
}
