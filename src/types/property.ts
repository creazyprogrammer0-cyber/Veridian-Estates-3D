export type CompletionStatus = 'Completed' | 'Under Construction' | 'Planning' | 'Unconfirmed';
export type PublicationStatus = 'draft' | 'published' | 'archived';
export type AvailabilityStatus = 'available' | 'reserved' | 'sold' | 'unavailable';
export type PriceStatus = 'published' | 'price_on_request' | 'unconfirmed';

export type TourProviderType = 'threejs_architectural_twin' | 'matterport_embed' | 'custom_webgl';

export type AssetCaptureStatus =
  | 'not_captured'
  | 'capture_scheduled'
  | 'processing'
  | 'ready_for_review'
  | 'approved_for_publication'
  | 'published'
  | 'unavailable';

export type InquiryType = 'general_inquiry' | 'property_details' | 'site_visit_request';

export type InquiryStatus =
  | 'new'
  | 'contacted'
  | 'follow_up_required'
  | 'site_visit_requested'
  | 'site_visit_confirmed'
  | 'closed';

export type AdminRoleType = 'super_admin' | 'content_manager' | 'inquiry_manager';

export type VisualPresetKey =
  | 'hero_pavilion'
  | 'solaris_coastal'
  | 'kensington_courtyard'
  | 'penthouse_interior'
  | 'kitchen_atelier'
  | 'building_elevation';

export interface FloorPlanRoom {
  id: string;
  name: string;
  areaSqm: number;
  dimensionsLabel: string;
  finishSummary: string;
  /** Normalized SVG coordinates (0-100 viewBox) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corresponding 3D camera viewpoint position [x, y, z] and target [tx, ty, tz] */
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  features: string[];
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  location: string;
  addressVerified: boolean;
  coordinatesLabel?: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  completionStatus: CompletionStatus;
  estimatedHandover?: string;
  publicationStatus: PublicationStatus;
  isDemonstration: boolean;
  visualPreset: VisualPresetKey;
  heroImageUrl?: string;
  highlights: string[];
  amenities: string[];
  brochureTitle?: string;
  seoTitle?: string;
  seoDescription?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Building {
  id: string;
  projectId: string;
  name: string;
  code: string;
  overview: string;
  confirmedFloors: number;
  architecturalSpecification: string;
  elevatorCount: number;
  publicationStatus: PublicationStatus;
  visualPreset: VisualPresetKey;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Floor {
  id: string;
  projectId: string;
  buildingId: string;
  floorNumber: number;
  label: string;
  ceilingHeightMeters: number;
  floorPlanSummary: string;
  publicationStatus: PublicationStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Apartment {
  id: string;
  projectId: string;
  buildingId: string;
  floorId: string;
  unitCode: string;
  title: string;
  apartmentType: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  areaConvention: string;
  terraceAreaSqm?: number;
  orientation: string;
  priceStatus: PriceStatus;
  priceAmount: number;
  currency: string;
  availabilityStatus: AvailabilityStatus;
  publicationStatus: PublicationStatus;
  tourAssetId: string;
  isDemonstration: boolean;
  visualPreset: VisualPresetKey;
  imageUrl?: string;
  features: string[];
  materialsAndFinishes: string[];
  rooms: FloorPlanRoom[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TourManifest {
  id: string;
  projectId: string;
  buildingId: string;
  floorId: string;
  apartmentId: string;
  provider: TourProviderType;
  assetType: string;
  captureMethod: string;
  captureStatus: AssetCaptureStatus;
  externalEmbedUrl: string;
  storageReference: string;
  lastVerificationDate: string;
  reviewerNotes: string;
  supportedCapabilities: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Inquiry {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  preferredContactMethod: 'email' | 'phone' | 'either';
  inquiryType: InquiryType;
  projectId: string;
  apartmentId: string;
  preferredDate: string;
  preferredTimeWindow: string;
  message: string;
  status: InquiryStatus;
  internalNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserRecord {
  uid: string;
  email: string;
  role: AdminRoleType;
  createdAt: string;
}

export interface ProjectFilterState {
  search: string;
  location: string;
  completionStatus: string;
  onlyWithAvailableUnits: boolean;
  onlyWithPublished3DTour: boolean;
}

export interface ApartmentFilterState {
  projectId: string;
  buildingId: string;
  floorId: string;
  minBedrooms: number;
  availabilityStatus: string;
  maxPrice: number;
  onlyWith3DTour: boolean;
}
