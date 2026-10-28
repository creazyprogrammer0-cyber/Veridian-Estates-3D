import {
  Project,
  Building,
  Floor,
  Apartment,
  TourManifest,
  Inquiry,
  ProjectFilterState,
  ApartmentFilterState,
  PriceStatus,
  TourProviderType,
} from '../types/property';

const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEntityId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_PATTERN.test(id);
}

/**
 * Filters projects for public discovery.
 * Strictly excludes any project whose publicationStatus is not 'published'.
 */
export function filterPublicProjects(
  projects: Project[],
  apartments: Apartment[],
  tourManifests: TourManifest[],
  filters: ProjectFilterState
): Project[] {
  const publishedProjects = projects.filter((p) => p.publicationStatus === 'published');

  return publishedProjects.filter((project) => {
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      const matchesName = project.name.toLowerCase().includes(q);
      const matchesLocation = project.location.toLowerCase().includes(q);
      const matchesCategory = project.category.toLowerCase().includes(q);
      const matchesDesc = project.shortDescription.toLowerCase().includes(q);
      if (!matchesName && !matchesLocation && !matchesCategory && !matchesDesc) {
        return false;
      }
    }

    if (filters.location && filters.location !== 'all') {
      if (!project.location.toLowerCase().includes(filters.location.toLowerCase())) {
        return false;
      }
    }

    if (filters.completionStatus && filters.completionStatus !== 'all') {
      if (project.completionStatus !== filters.completionStatus) {
        return false;
      }
    }

    const projectApts = apartments.filter(
      (a) => a.projectId === project.id && a.publicationStatus === 'published'
    );

    if (filters.onlyWithAvailableUnits) {
      const availableCount = projectApts.filter((a) => a.availabilityStatus === 'available').length;
      if (availableCount === 0) return false;
    }

    if (filters.onlyWithPublished3DTour) {
      const hasPublishedTour = projectApts.some((apt) => {
        const manifest = tourManifests.find((m) => m.id === apt.tourAssetId || m.apartmentId === apt.id);
        return manifest?.captureStatus === 'published';
      });
      if (!hasPublishedTour) return false;
    }

    return true;
  });
}

/**
 * Filters apartments for public discovery.
 * Strictly excludes any apartment whose publicationStatus is not 'published'.
 */
export function filterPublicApartments(
  apartments: Apartment[],
  tourManifests: TourManifest[],
  filters: ApartmentFilterState
): Apartment[] {
  return apartments
    .filter((apt) => apt.publicationStatus === 'published')
    .filter((apt) => {
      if (filters.projectId && filters.projectId !== 'all' && apt.projectId !== filters.projectId) {
        return false;
      }
      if (filters.buildingId && filters.buildingId !== 'all' && apt.buildingId !== filters.buildingId) {
        return false;
      }
      if (filters.floorId && filters.floorId !== 'all' && apt.floorId !== filters.floorId) {
        return false;
      }
      if (filters.minBedrooms > 0 && apt.bedrooms < filters.minBedrooms) {
        return false;
      }
      if (
        filters.availabilityStatus &&
        filters.availabilityStatus !== 'all' &&
        apt.availabilityStatus !== filters.availabilityStatus
      ) {
        return false;
      }
      if (filters.maxPrice > 0) {
        if (apt.priceStatus !== 'published' || apt.priceAmount > filters.maxPrice) {
          return false;
        }
      }
      if (filters.onlyWith3DTour) {
        const manifest = tourManifests.find((m) => m.id === apt.tourAssetId || m.apartmentId === apt.id);
        if (!manifest || manifest.captureStatus !== 'published') {
          return false;
        }
      }
      return true;
    });
}

/**
 * Formats apartment pricing honestly without inventing missing numbers.
 */
export function formatPriceDisplay(
  priceStatus: PriceStatus,
  priceAmount: number,
  currency: string = 'EUR'
): string {
  if (priceStatus === 'price_on_request') {
    return 'Price on Request';
  }
  if (priceStatus === 'unconfirmed' || !priceAmount || priceAmount <= 0) {
    return 'Pricing Unconfirmed';
  }
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(priceAmount);
  return formatted;
}

/**
 * Validates relational integrity across Projects -> Buildings -> Floors -> Apartments -> TourManifests.
 */
export interface RelationalValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEntityRelationships(data: {
  projects: Project[];
  buildings: Building[];
  floors: Floor[];
  apartments: Apartment[];
  tourManifests: TourManifest[];
}): RelationalValidationResult {
  const errors: string[] = [];
  const projectIds = new Set(data.projects.map((p) => p.id));
  const buildingMap = new Map(data.buildings.map((b) => [b.id, b]));
  const floorMap = new Map(data.floors.map((f) => [f.id, f]));
  const apartmentMap = new Map(data.apartments.map((a) => [a.id, a]));

  for (const b of data.buildings) {
    if (!projectIds.has(b.projectId)) {
      errors.push(`Building ${b.id} references non-existent project ${b.projectId}`);
    }
  }

  for (const f of data.floors) {
    const parentBuilding = buildingMap.get(f.buildingId);
    if (!parentBuilding) {
      errors.push(`Floor ${f.id} references non-existent building ${f.buildingId}`);
    } else if (parentBuilding.projectId !== f.projectId) {
      errors.push(
        `Floor ${f.id} projectId (${f.projectId}) does not match building ${parentBuilding.id} projectId (${parentBuilding.projectId})`
      );
    }
  }

  for (const apt of data.apartments) {
    if (!projectIds.has(apt.projectId)) {
      errors.push(`Apartment ${apt.id} references non-existent project ${apt.projectId}`);
    }
    const parentBuilding = buildingMap.get(apt.buildingId);
    if (!parentBuilding) {
      errors.push(`Apartment ${apt.id} references non-existent building ${apt.buildingId}`);
    } else if (parentBuilding.projectId !== apt.projectId) {
      errors.push(`Apartment ${apt.id} building ${apt.buildingId} belongs to a different project`);
    }
    const parentFloor = floorMap.get(apt.floorId);
    if (!parentFloor) {
      errors.push(`Apartment ${apt.id} references non-existent floor ${apt.floorId}`);
    } else if (parentFloor.buildingId !== apt.buildingId) {
      errors.push(`Apartment ${apt.id} floor ${apt.floorId} belongs to a different building`);
    }
  }

  for (const manifest of data.tourManifests) {
    const parentApt = apartmentMap.get(manifest.apartmentId);
    if (!parentApt) {
      errors.push(`TourManifest ${manifest.id} references non-existent apartment ${manifest.apartmentId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates external 3D tour URLs to prevent XSS/injection and ensure only approved HTTPS providers are linked.
 */
export function validateExternalTourUrl(
  url: string,
  provider: TourProviderType
): { valid: boolean; reason?: string } {
  const trimmed = url.trim();
  if (provider === 'threejs_architectural_twin') {
    // Built-in Three.js digital twin does not require an external iframe URL
    if (!trimmed) return { valid: true };
  }
  if (!trimmed) {
    return { valid: false, reason: 'External embed URL is required when using an external scan provider.' };
  }
  if (trimmed.length > 500) {
    return { valid: false, reason: 'URL exceeds maximum length of 500 characters.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Malformed URL format.' };
  }
  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'External 3D tour URLs must use HTTPS protocol.' };
  }
  if (provider === 'matterport_embed') {
    const allowedHosts = ['my.matterport.com', 'matterport.com'];
    if (!allowedHosts.includes(parsed.hostname)) {
      return {
        valid: false,
        reason: 'Matterport provider requires a verified my.matterport.com HTTPS URL.',
      };
    }
  }
  return { valid: true };
}

export interface InquiryFormInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  preferredContactMethod: 'email' | 'phone' | 'either';
  inquiryType: 'general_inquiry' | 'property_details' | 'site_visit_request';
  projectId: string;
  apartmentId: string;
  preferredDate: string;
  preferredTimeWindow: string;
  message: string;
  privacyConsent: boolean;
}

export interface InquiryValidationResult {
  valid: boolean;
  fieldErrors: Partial<Record<keyof InquiryFormInput, string>>;
}

export function validateInquiryInput(input: InquiryFormInput): InquiryValidationResult {
  const fieldErrors: Partial<Record<keyof InquiryFormInput, string>> = {};

  const name = input.customerName.trim();
  if (name.length < 2 || name.length > 120) {
    fieldErrors.customerName = 'Please enter your full name (2 to 120 characters).';
  }

  const email = input.customerEmail.trim();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    fieldErrors.customerEmail = 'Please enter a valid email address.';
  }

  const phone = input.customerPhone.trim();
  if (input.preferredContactMethod === 'phone' && phone.length < 6) {
    fieldErrors.customerPhone = 'A telephone number is required when phone is selected as your preferred contact method.';
  } else if (phone.length > 40) {
    fieldErrors.customerPhone = 'Phone number must be under 40 characters.';
  }

  if (input.inquiryType === 'site_visit_request') {
    if (!input.preferredDate.trim()) {
      fieldErrors.preferredDate = 'Please select a preferred date for your requested site visit.';
    }
    if (!input.preferredTimeWindow.trim()) {
      fieldErrors.preferredTimeWindow = 'Please select a preferred time window.';
    }
  }

  const msg = input.message.trim();
  if (msg.length < 5 || msg.length > 2000) {
    fieldErrors.message = 'Please provide an inquiry message between 5 and 2,000 characters.';
  }

  if (!input.privacyConsent) {
    fieldErrors.privacyConsent = 'Please acknowledge the privacy notice to submit your inquiry.';
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export interface OperationalMetrics {
  totalProjects: number;
  publishedProjects: number;
  draftProjects: number;
  totalBuildings: number;
  totalFloors: number;
  totalApartments: number;
  availableUnits: number;
  reservedUnits: number;
  publishedTours: number;
  toursAwaitingReview: number;
  toursPendingCapture: number;
  totalInquiries: number;
  newInquiries: number;
  pendingSiteVisits: number;
}

export function computeDashboardMetrics(data: {
  projects: Project[];
  buildings: Building[];
  floors: Floor[];
  apartments: Apartment[];
  tourManifests: TourManifest[];
  inquiries: Inquiry[];
}): OperationalMetrics {
  return {
    totalProjects: data.projects.length,
    publishedProjects: data.projects.filter((p) => p.publicationStatus === 'published').length,
    draftProjects: data.projects.filter((p) => p.publicationStatus === 'draft').length,
    totalBuildings: data.buildings.length,
    totalFloors: data.floors.length,
    totalApartments: data.apartments.length,
    availableUnits: data.apartments.filter((a) => a.availabilityStatus === 'available').length,
    reservedUnits: data.apartments.filter((a) => a.availabilityStatus === 'reserved').length,
    publishedTours: data.tourManifests.filter((t) => t.captureStatus === 'published').length,
    toursAwaitingReview: data.tourManifests.filter(
      (t) => t.captureStatus === 'ready_for_review' || t.captureStatus === 'approved_for_publication'
    ).length,
    toursPendingCapture: data.tourManifests.filter(
      (t) => t.captureStatus === 'not_captured' || t.captureStatus === 'capture_scheduled'
    ).length,
    totalInquiries: data.inquiries.length,
    newInquiries: data.inquiries.filter((i) => i.status === 'new').length,
    pendingSiteVisits: data.inquiries.filter((i) => i.status === 'site_visit_requested').length,
  };
}
