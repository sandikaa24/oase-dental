export type PortalContentType =
  | 'DOCTOR'
  | 'ARTICLE'
  | 'PATIENT_GUIDE'
  | 'FAQ'
  | 'BEFORE_AFTER'
  | 'FACILITY'
  | 'TECHNOLOGY'
  | 'TESTIMONI';

export interface DoctorMetadata {
  name?: string;
  title?: string;
  str?: string;
  specialization?: string;
  bio?: string;
  experience?: string;
  qualifications?: string[];
  scheduleSummary?: string;
}

export interface FaqMetadata {
  serviceId?: string;
  serviceName?: string;
  category?: string;
}

export interface PortalContentItem {
  id: string;
  type: PortalContentType;
  title: string;
  slug: string;
  body: string | null;
  imageUrl: string | null;
  sortOrder: number;
  published: boolean;
  isDemoContent: boolean;
  metadata: Record<string, unknown>;
  patientConsent: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    email: string;
    username: string | null;
  } | null;
}
