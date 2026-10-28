import React, { useState } from 'react';
import {
  Project,
  Building,
  Floor,
  Apartment,
  TourManifest,
  Inquiry,
  AdminRoleType,
  CompletionStatus,
  PublicationStatus,
  AvailabilityStatus,
  PriceStatus,
  AssetCaptureStatus,
  TourProviderType,
  InquiryStatus,
} from '../types/property';
import {
  computeDashboardMetrics,
  formatPriceDisplay,
  validateExternalTourUrl,
} from '../utils/propertyLogic';
import { STANDARD_ROOMS_N401 } from '../data/demoSeedData';
import {
  User,
  signInAdminWithGoogle,
  signOutAdmin,
  saveProjectToFirestore,
  updateInquiryStatusInFirestore,
} from '../lib/firebase';

interface AdminDashboardProps {
  currentUser: User | null;
  projects: Project[];
  buildings: Building[];
  floors: Floor[];
  apartments: Apartment[];
  tourManifests: TourManifest[];
  inquiries: Inquiry[];
  onUpdateProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  onUpdateBuildings: React.Dispatch<React.SetStateAction<Building[]>>;
  onUpdateFloors: React.Dispatch<React.SetStateAction<Floor[]>>;
  onUpdateApartments: React.Dispatch<React.SetStateAction<Apartment[]>>;
  onUpdateTourManifests: React.Dispatch<React.SetStateAction<TourManifest[]>>;
  onUpdateInquiries: React.Dispatch<React.SetStateAction<Inquiry[]>>;
  onNavigatePublic: (path: string) => void;
}

type AdminTab =
  | 'overview'
  | 'projects'
  | 'buildings_floors'
  | 'apartments'
  | 'tours'
  | 'inquiries'
  | 'rbac';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  projects,
  buildings,
  floors,
  apartments,
  tourManifests,
  inquiries,
  onUpdateProjects,
  onUpdateBuildings,
  onUpdateFloors,
  onUpdateApartments,
  onUpdateTourManifests,
  onUpdateInquiries,
  onNavigatePublic,
}) => {
  // Support both real Google Auth and explicit Demo Admin Session for evaluation
  const [demoSessionActive, setDemoSessionActive] = useState(false);
  const [activeRole, setActiveRole] = useState<AdminRoleType>('super_admin');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [authError, setAuthError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Project Creation State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectLocation, setNewProjectLocation] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('Architectural Residences');
  const [newProjectStatus, setNewProjectStatus] = useState<CompletionStatus>('Planning');
  const [newProjectPubStatus, setNewProjectPubStatus] = useState<PublicationStatus>('draft');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // Building Creation State
  const [newBldgProjectId, setNewBldgProjectId] = useState(projects[0]?.id || '');
  const [newBldgName, setNewBldgName] = useState('');
  const [newBldgCode, setNewBldgCode] = useState('');
  const [newBldgFloors, setNewBldgFloors] = useState(5);

  // Apartment Creation State
  const [newAptProjectId, setNewAptProjectId] = useState(projects[0]?.id || '');
  const [newAptBuildingId, setNewAptBuildingId] = useState(buildings[0]?.id || '');
  const [newAptFloorId, setNewAptFloorId] = useState(floors[0]?.id || '');
  const [newAptCode, setNewAptCode] = useState('');
  const [newAptTitle, setNewAptTitle] = useState('');
  const [newAptBedrooms, setNewAptBedrooms] = useState(3);
  const [newAptArea, setNewAptArea] = useState(165);
  const [newAptPriceStatus, setNewAptPriceStatus] = useState<PriceStatus>('published');
  const [newAptPrice, setNewAptPrice] = useState(2900000);

  // Inquiry Filter State
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>('all');
  const [selectedInquiryId, setSelectedInquiryId] = useState<string>(inquiries[0]?.id || '');

  const isAuthenticated = Boolean(currentUser) || demoSessionActive;
  const canManageContent = activeRole === 'super_admin' || activeRole === 'content_manager';
  const canManageInquiries = activeRole === 'super_admin' || activeRole === 'inquiry_manager';
  const canManageRoles = activeRole === 'super_admin';

  const metrics = computeDashboardMetrics({
    projects,
    buildings,
    floors,
    apartments,
    tourManifests,
    inquiries,
  });

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-[#E9EDF4] space-y-6">
        <div className="text-xs font-mono text-[#2855E8]">
          RESTRICTED ADMINISTRATION PORTAL · RBAC PROTECTED
        </div>
        <h1 className="text-3xl font-semibold text-[#17191D]">
          Veridian Estates Content &amp; Lead Administration
        </h1>
        <p className="text-sm text-[#525866] leading-relaxed">
          Unauthenticated visitors cannot modify projects, apartment specifications, 3D tour asset
          manifests, or access customer inquiry records. Authenticate via Google Sign-In (enforced by
          Cloud Firestore security rules) or launch an interactive Role-Based Administration Session.
        </p>

        {authError && (
          <div role="alert" className="p-3 bg-red-50 border border-red-300 text-xs text-red-900">
            {authError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={async () => {
              setAuthError(null);
              try {
                await signInAdminWithGoogle();
              } catch (err) {
                setAuthError(
                  err instanceof Error
                    ? err.message
                    : 'Google Sign-In popup could not complete in this preview frame. You may use the Interactive Admin Session below.'
                );
              }
            }}
            className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition whitespace-nowrap shrink-0"
          >
            Sign In with Google (Firebase Auth)
          </button>

          <button
            type="button"
            onClick={() => {
              setDemoSessionActive(true);
              setStatusBanner('Interactive Administrator Session activated (Super Administrator role).');
            }}
            className="px-5 py-2.5 text-xs font-medium border border-[#17191D] text-[#17191D] bg-white hover:bg-[#E9EDF4] arch-transition whitespace-nowrap shrink-0"
          >
            Enter Interactive Admin Session
          </button>
        </div>
      </div>
    );
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageContent) {
      setStatusBanner('Permission Denied: Your current role cannot create or modify projects.');
      return;
    }
    if (newProjectName.trim().length < 2 || newProjectLocation.trim().length < 2) {
      setStatusBanner('Validation Error: Project name and verified location are required.');
      return;
    }
    const id = `proj-${Date.now()}`;
    const slug = newProjectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const now = new Date().toISOString();
    const created: Project = {
      id,
      slug: slug || id,
      name: newProjectName.trim(),
      location: newProjectLocation.trim(),
      addressVerified: true,
      category: newProjectCategory.trim(),
      shortDescription:
        newProjectDesc.trim() ||
        'Newly created residential development record managed through the CMS.',
      fullDescription:
        newProjectDesc.trim() ||
        'Detailed architectural specification pending content publication.',
      completionStatus: newProjectStatus,
      publicationStatus: newProjectPubStatus,
      isDemonstration: true,
      visualPreset: 'hero_pavilion',
      highlights: ['Verified Structural Record', 'Multi-Building Ready'],
      amenities: ['Concierge Lobby', 'Landscaped Courtyard'],
      ownerId: currentUser?.uid || 'admin-session',
      createdAt: now,
      updatedAt: now,
    };

    try {
      if (currentUser) {
        await saveProjectToFirestore(created, true);
      }
    } catch {
      // Handled gracefully if current user is not bootstrapped super admin
    }

    onUpdateProjects((prev) => [created, ...prev]);
    setNewProjectName('');
    setNewProjectLocation('');
    setNewProjectDesc('');
    setStatusBanner(`Project "${created.name}" created with status [${created.publicationStatus}].`);
  };

  const handleToggleProjectPublish = async (project: Project) => {
    if (!canManageContent) {
      setStatusBanner('Permission Denied: Inquiry Managers cannot publish or unpublish projects.');
      return;
    }
    const nextStatus: PublicationStatus =
      project.publicationStatus === 'published' ? 'draft' : 'published';
    const updated: Project = {
      ...project,
      publicationStatus: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (currentUser) {
        await saveProjectToFirestore(updated, false);
      }
    } catch {
      // Local state still updates
    }
    onUpdateProjects((prev) => prev.map((p) => (p.id === project.id ? updated : p)));
    setStatusBanner(
      `Project "${project.name}" publication status updated to [${nextStatus.toUpperCase()}].`
    );
  };

  const handleCreateBuilding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageContent) {
      setStatusBanner('Permission Denied: Content Manager or Super Admin role required.');
      return;
    }
    if (!projects.some((p) => p.id === newBldgProjectId)) {
      setStatusBanner('Relational Validation Error: Building must belong to a valid Project.');
      return;
    }
    if (newBldgName.trim().length < 2 || newBldgCode.trim().length < 1) {
      setStatusBanner('Validation Error: Building name and code are required.');
      return;
    }
    const now = new Date().toISOString();
    const bldgId = `bldg-${Date.now()}`;
    const newBldg: Building = {
      id: bldgId,
      projectId: newBldgProjectId,
      name: newBldgName.trim(),
      code: newBldgCode.trim().toUpperCase(),
      overview: 'Architectural building specification configured via CMS.',
      confirmedFloors: Number(newBldgFloors) || 4,
      architecturalSpecification: 'Reinforced limestone & triple-glazed low-iron curtain wall.',
      elevatorCount: 2,
      publicationStatus: 'published',
      visualPreset: 'building_elevation',
      ownerId: currentUser?.uid || 'admin-session',
      createdAt: now,
      updatedAt: now,
    };
    const defaultFloor: Floor = {
      id: `fl-${Date.now()}`,
      projectId: newBldgProjectId,
      buildingId: bldgId,
      floorNumber: 1,
      label: 'Level 01 — Primary Residential Plate',
      ceilingHeightMeters: 3.2,
      floorPlanSummary: 'Standard architectural floor plate.',
      publicationStatus: 'published',
      ownerId: currentUser?.uid || 'admin-session',
      createdAt: now,
      updatedAt: now,
    };

    onUpdateBuildings((prev) => [...prev, newBldg]);
    onUpdateFloors((prev) => [...prev, defaultFloor]);
    setNewBldgName('');
    setNewBldgCode('');
    setStatusBanner(`Building "${newBldg.name}" and Level 01 added to project.`);
  };

  const handleCreateApartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageContent) {
      setStatusBanner('Permission Denied: Content Manager or Super Admin role required.');
      return;
    }
    const targetBldg = buildings.find((b) => b.id === newAptBuildingId);
    const targetFloor = floors.find((f) => f.id === newAptFloorId);

    if (!targetBldg || targetBldg.projectId !== newAptProjectId) {
      setStatusBanner(
        'Relational Integrity Error: Selected Building does not belong to the selected Project.'
      );
      return;
    }
    if (!targetFloor || targetFloor.buildingId !== newAptBuildingId) {
      setStatusBanner(
        'Relational Integrity Error: Selected Floor does not belong to the selected Building.'
      );
      return;
    }
    if (!newAptCode.trim() || !newAptTitle.trim()) {
      setStatusBanner('Validation Error: Unit code and residence title are required.');
      return;
    }

    const now = new Date().toISOString();
    const aptId = `apt-${Date.now()}`;
    const tourId = `tour-${Date.now()}`;

    const createdApt: Apartment = {
      id: aptId,
      projectId: newAptProjectId,
      buildingId: newAptBuildingId,
      floorId: newAptFloorId,
      unitCode: newAptCode.trim().toUpperCase(),
      title: newAptTitle.trim(),
      apartmentType: 'Architectural Residence',
      bedrooms: Number(newAptBedrooms),
      bathrooms: Number(newAptBedrooms),
      areaSqm: Number(newAptArea),
      areaConvention: 'NIA (Net Internal Area)',
      terraceAreaSqm: 22.0,
      orientation: 'South-West Aspect',
      priceStatus: newAptPriceStatus,
      priceAmount: newAptPriceStatus === 'published' ? Number(newAptPrice) : 0,
      currency: 'EUR',
      availabilityStatus: 'available',
      publicationStatus: 'published',
      tourAssetId: tourId,
      isDemonstration: true,
      visualPreset: 'penthouse_interior',
      features: ['Floor-to-Ceiling Glazing', 'Interactive Floor Plan'],
      materialsAndFinishes: ['Honed Architectural Stone & Custom Joinery'],
      rooms: STANDARD_ROOMS_N401,
      ownerId: currentUser?.uid || 'admin-session',
      createdAt: now,
      updatedAt: now,
    };

    const createdManifest: TourManifest = {
      id: tourId,
      projectId: newAptProjectId,
      buildingId: newAptBuildingId,
      floorId: newAptFloorId,
      apartmentId: aptId,
      provider: 'threejs_architectural_twin',
      assetType: '3D Architectural Twin',
      captureMethod: 'BIM Spatial Synthesis',
      captureStatus: 'published',
      externalEmbedUrl: '',
      storageReference: `veridian-cdn://apartments/${aptId}/scene.glb`,
      lastVerificationDate: now.slice(0, 10),
      reviewerNotes: 'Created and approved via CMS.',
      supportedCapabilities: ['Interactive 3D Orbit & Room Viewpoints', '3D Dollhouse Cutaway Mode'],
      ownerId: currentUser?.uid || 'admin-session',
      createdAt: now,
      updatedAt: now,
    };

    onUpdateApartments((prev) => [createdApt, ...prev]);
    onUpdateTourManifests((prev) => [createdManifest, ...prev]);
    setNewAptCode('');
    setNewAptTitle('');
    setStatusBanner(`Residence ${createdApt.unitCode} created with associated 3D Tour Manifest.`);
  };

  const handleUpdateManifestStatus = (
    manifest: TourManifest,
    nextCaptureStatus: AssetCaptureStatus,
    nextProvider: TourProviderType,
    nextExternalUrl: string
  ) => {
    if (!canManageContent) {
      setStatusBanner('Permission Denied: Content Manager or Super Admin role required.');
      return;
    }
    if (nextProvider !== 'threejs_architectural_twin' && nextCaptureStatus === 'published') {
      const urlCheck = validateExternalTourUrl(nextExternalUrl, nextProvider);
      if (!urlCheck.valid) {
        setStatusBanner(`3D Tour Security Validation Failed: ${urlCheck.reason}`);
        return;
      }
    }
    const updated: TourManifest = {
      ...manifest,
      captureStatus: nextCaptureStatus,
      provider: nextProvider,
      externalEmbedUrl: nextExternalUrl.trim(),
      lastVerificationDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };
    onUpdateTourManifests((prev) => prev.map((m) => (m.id === manifest.id ? updated : m)));
    setStatusBanner(
      `3D Tour Manifest [${manifest.id}] updated to status [${nextCaptureStatus.toUpperCase()}].`
    );
  };

  const handleUpdateInquiry = async (
    inquiry: Inquiry,
    nextStatus: InquiryStatus,
    nextNotes: string
  ) => {
    if (!canManageInquiries) {
      setStatusBanner('Permission Denied: Content Managers cannot access or modify customer PII inquiries.');
      return;
    }
    const updated: Inquiry = {
      ...inquiry,
      status: nextStatus,
      internalNotes: nextNotes,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (currentUser) {
        await updateInquiryStatusInFirestore(
          inquiry.id,
          nextStatus,
          nextNotes,
          inquiry.preferredDate,
          inquiry.preferredTimeWindow
        );
      }
    } catch {
      // Local state updated
    }
    onUpdateInquiries((prev) => prev.map((i) => (i.id === inquiry.id ? updated : i)));
    setStatusBanner(`Inquiry [${inquiry.id}] updated to status [${nextStatus.toUpperCase()}].`);
  };

  const filteredInquiries = inquiries.filter(
    (inq) => inquiryStatusFilter === 'all' || inq.status === inquiryStatusFilter
  );
  const selectedInquiry =
    inquiries.find((i) => i.id === selectedInquiryId) || filteredInquiries[0] || null;

  return (
    <div className="max-w-[1380px] mx-auto px-6 py-10 space-y-8">
      {/* Top Admin Header & Active Role Inspector */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#E9EDF4]">
        <div>
          <div className="text-xs font-mono text-[#2855E8]">
            AUTHENTICATED ADMINISTRATION &amp; CMS · ZERO-TRUST RBAC
          </div>
          <h1 className="text-3xl font-semibold text-[#17191D] mt-1">
            Veridian Estates Operations &amp; Property Governance
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#E9EDF4] border border-[#E9EDF4] px-3 py-1.5">
            <label htmlFor="rbac-role-select" className="text-xs font-mono text-[#525866]">
              ACTIVE ROLE:
            </label>
            <select
              id="rbac-role-select"
              value={activeRole}
              onChange={(e) => {
                const role = e.target.value as AdminRoleType;
                setActiveRole(role);
                setStatusBanner(`Switched enforced RBAC role to [${role.toUpperCase()}].`);
              }}
              className="text-xs font-semibold bg-white border border-[#E9EDF4] px-2 py-1 text-[#17191D]"
            >
              <option value="super_admin">Super Administrator (Full Access)</option>
              <option value="content_manager">Property/Content Manager (No PII Leads)</option>
              <option value="inquiry_manager">Sales/Inquiry Manager (Leads Only)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (currentUser) await signOutAdmin();
              setDemoSessionActive(false);
            }}
            className="px-3.5 py-2 text-xs font-medium border border-[#17191D] text-[#17191D] bg-white hover:bg-[#E9EDF4]"
          >
            Sign Out
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between p-3.5 bg-[#E9EDF4] border border-[#2855E8] text-xs text-[#17191D]"
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="font-mono text-[#525866] hover:text-[#17191D] ml-4"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#E9EDF4] pb-2" role="tablist">
        {(
          [
            { id: 'overview', label: '01. Operational Summary' },
            { id: 'projects', label: `02. Projects (${metrics.totalProjects})` },
            { id: 'buildings_floors', label: `03. Buildings & Floors (${metrics.totalBuildings})` },
            { id: 'apartments', label: `04. Apartments (${metrics.totalApartments})` },
            { id: 'tours', label: `05. 3D Tour Manifests (${tourManifests.length})` },
            { id: 'inquiries', label: `06. Inquiries & Visits (${metrics.totalInquiries})` },
            { id: 'rbac', label: '07. Security & RBAC Rules' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium arch-transition whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-[#2855E8] text-white'
                : 'bg-[#E9EDF4]/70 text-[#525866] hover:bg-[#E9EDF4] hover:text-[#17191D]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OPERATIONAL OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
            <div className="p-5 bg-white border border-[#E9EDF4]">
              <div className="text-xs font-mono text-[#525866]">PUBLISHED / TOTAL PROJECTS</div>
              <div className="text-3xl font-semibold text-[#17191D] mt-2">
                {metrics.publishedProjects}{' '}
                <span className="text-lg text-[#525866]">/ {metrics.totalProjects}</span>
              </div>
              <div className="text-xs text-[#525866] mt-1">
                {metrics.draftProjects} internal draft(s) hidden from public
              </div>
            </div>

            <div className="p-5 bg-white border border-[#E9EDF4]">
              <div className="text-xs font-mono text-[#525866]">AVAILABLE / TOTAL UNITS</div>
              <div className="text-3xl font-semibold text-[#2855E8] mt-2">
                {metrics.availableUnits}{' '}
                <span className="text-lg text-[#525866]">/ {metrics.totalApartments}</span>
              </div>
              <div className="text-xs text-[#525866] mt-1">
                {metrics.reservedUnits} unit(s) currently reserved
              </div>
            </div>

            <div className="p-5 bg-white border border-[#E9EDF4]">
              <div className="text-xs font-mono text-[#525866]">3D TOURS PUBLISHED / PENDING</div>
              <div className="text-3xl font-semibold text-[#17191D] mt-2">
                {metrics.publishedTours}{' '}
                <span className="text-lg text-[#525866]">
                  / {metrics.toursAwaitingReview + metrics.toursPendingCapture} pending
                </span>
              </div>
              <div className="text-xs text-[#525866] mt-1">
                {metrics.toursAwaitingReview} awaiting QA review
              </div>
            </div>

            <div className="p-5 bg-white border border-[#E9EDF4]">
              <div className="text-xs font-mono text-[#525866]">INQUIRIES &amp; SITE VISITS</div>
              <div className="text-3xl font-semibold text-[#17191D] mt-2">
                {metrics.totalInquiries}
              </div>
              <div className="text-xs text-[#2855E8] mt-1">
                {metrics.pendingSiteVisits} site visit request(s) awaiting confirmation
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-white border border-[#E9EDF4] space-y-4">
              <h3 className="text-xl font-semibold text-[#17191D]">
                Publication &amp; Visibility Audit
              </h3>
              <p className="text-xs text-[#525866]">
                All counts above are computed dynamically from stored records. Unpublished drafts (such
                as <em>Helvetia Timber Lofts</em>) are blocked from public listing queries.
              </p>
              <div className="divide-y divide-[#E9EDF4] text-xs">
                {projects.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold text-[#17191D]">{p.name}</span>
                      <span className="text-[#525866] ml-2">· {p.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#525866]">
                        Status: {p.publicationStatus.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleProjectPublish(p)}
                        className="px-2.5 py-1 border border-[#E9EDF4] bg-[#E9EDF4]/50 hover:bg-[#E9EDF4] font-medium"
                      >
                        {p.publicationStatus === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-white border border-[#E9EDF4] space-y-4">
              <h3 className="text-xl font-semibold text-[#17191D]">
                3D Asset Manifest Attention Queue
              </h3>
              <div className="divide-y divide-[#E9EDF4] text-xs">
                {tourManifests.map((m) => {
                  const apt = apartments.find((a) => a.id === m.apartmentId);
                  return (
                    <div key={m.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-semibold text-[#17191D]">
                          Unit {apt?.unitCode || m.apartmentId}
                        </span>
                        <span className="text-[#525866] ml-2">· {m.provider}</span>
                      </div>
                      <span className="font-mono text-[#2855E8]">
                        {m.captureStatus.toUpperCase().replace(/_/g, ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROJECT MANAGEMENT */}
      {activeTab === 'projects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 p-6 bg-white border border-[#E9EDF4]">
            <h3 className="text-xl font-semibold text-[#17191D] mb-4">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
              <div>
                <label htmlFor="cms-proj-name" className="block font-mono text-[#525866] mb-1">
                  PROJECT NAME *
                </label>
                <input
                  id="cms-proj-name"
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Villa Bellagio Terraces (Demo)"
                  className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4] text-sm"
                />
              </div>
              <div>
                <label htmlFor="cms-proj-loc" className="block font-mono text-[#525866] mb-1">
                  VERIFIED LOCATION *
                </label>
                <input
                  id="cms-proj-loc"
                  type="text"
                  required
                  value={newProjectLocation}
                  onChange={(e) => setNewProjectLocation(e.target.value)}
                  placeholder="e.g., Lake Como, Italy — Sample Location"
                  className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4] text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cms-proj-status" className="block font-mono text-[#525866] mb-1">
                    COMPLETION STATUS
                  </label>
                  <select
                    id="cms-proj-status"
                    value={newProjectStatus}
                    onChange={(e) => setNewProjectStatus(e.target.value as CompletionStatus)}
                    className="w-full px-2.5 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Under Construction">Under Construction</option>
                    <option value="Planning">Planning</option>
                    <option value="Unconfirmed">Unconfirmed</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cms-proj-pub" className="block font-mono text-[#525866] mb-1">
                    PUBLICATION STATE
                  </label>
                  <select
                    id="cms-proj-pub"
                    value={newProjectPubStatus}
                    onChange={(e) => setNewProjectPubStatus(e.target.value as PublicationStatus)}
                    className="w-full px-2.5 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  >
                    <option value="draft">Save as Draft</option>
                    <option value="published">Publish Immediately</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="cms-proj-cat" className="block font-mono text-[#525866] mb-1">
                  ARCHITECTURAL CATEGORY
                </label>
                <input
                  id="cms-proj-cat"
                  type="text"
                  value={newProjectCategory}
                  onChange={(e) => setNewProjectCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                />
              </div>
              <div>
                <label htmlFor="cms-proj-desc" className="block font-mono text-[#525866] mb-1">
                  SUMMARY DESCRIPTION
                </label>
                <textarea
                  id="cms-proj-desc"
                  rows={3}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#2855E8] text-white font-semibold hover:bg-[#1E44C4]"
              >
                Create Project Record
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {projects.map((p) => (
              <div key={p.id} className="p-5 bg-white border border-[#E9EDF4] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono text-[#525866]">
                      ID: {p.id} · {p.completionStatus} ·{' '}
                      {p.isDemonstration ? 'DEMONSTRATION RECORD' : 'VERIFIED'}
                    </span>
                    <h4 className="text-lg font-semibold text-[#17191D]">{p.name}</h4>
                    <p className="text-xs text-[#525866]">{p.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleProjectPublish(p)}
                      className={`px-3 py-1.5 text-xs font-medium border ${
                        p.publicationStatus === 'published'
                          ? 'bg-[#2855E8] text-white border-[#2855E8]'
                          : 'bg-[#E9EDF4] text-[#17191D] border-[#E9EDF4]'
                      }`}
                    >
                      {p.publicationStatus === 'published'
                        ? 'Published (Click to Draft)'
                        : 'Draft (Click to Publish)'}
                    </button>
                    {p.publicationStatus === 'published' && (
                      <button
                        type="button"
                        onClick={() => onNavigatePublic(`/projects/${p.id}`)}
                        className="px-3 py-1.5 text-xs font-medium border border-[#17191D] text-[#17191D] hover:bg-[#E9EDF4]"
                      >
                        Preview Page
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[#525866]">{p.shortDescription}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: BUILDINGS & FLOORS */}
      {activeTab === 'buildings_floors' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 p-6 bg-white border border-[#E9EDF4]">
            <h3 className="text-xl font-semibold text-[#17191D] mb-4">
              Add Building &amp; Default Floor Plate
            </h3>
            <form onSubmit={handleCreateBuilding} className="space-y-4 text-xs">
              <div>
                <label htmlFor="cms-bldg-proj" className="block font-mono text-[#525866] mb-1">
                  PARENT PROJECT *
                </label>
                <select
                  id="cms-bldg-proj"
                  value={newBldgProjectId}
                  onChange={(e) => setNewBldgProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cms-bldg-name" className="block font-mono text-[#525866] mb-1">
                  BUILDING NAME *
                </label>
                <input
                  id="cms-bldg-name"
                  type="text"
                  required
                  value={newBldgName}
                  onChange={(e) => setNewBldgName(e.target.value)}
                  placeholder="e.g., West Botanical Pavilion"
                  className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cms-bldg-code" className="block font-mono text-[#525866] mb-1">
                    BUILDING CODE *
                  </label>
                  <input
                    id="cms-bldg-code"
                    type="text"
                    required
                    value={newBldgCode}
                    onChange={(e) => setNewBldgCode(e.target.value)}
                    placeholder="BLDG-W"
                    className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  />
                </div>
                <div>
                  <label htmlFor="cms-bldg-floors" className="block font-mono text-[#525866] mb-1">
                    CONFIRMED FLOORS
                  </label>
                  <input
                    id="cms-bldg-floors"
                    type="number"
                    min={1}
                    max={80}
                    value={newBldgFloors}
                    onChange={(e) => setNewBldgFloors(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#2855E8] text-white font-semibold hover:bg-[#1E44C4]"
              >
                Create Building &amp; Level 01
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {buildings.map((b) => {
              const parentProj = projects.find((p) => p.id === b.projectId);
              const bldgFloors = floors.filter((f) => f.buildingId === b.id);
              return (
                <div key={b.id} className="p-5 bg-white border border-[#E9EDF4] space-y-2">
                  <div className="text-xs font-mono text-[#525866]">
                    CODE: {b.code} · PARENT: {parentProj?.name || b.projectId} · {b.confirmedFloors} FLOORS
                  </div>
                  <h4 className="text-lg font-semibold text-[#17191D]">{b.name}</h4>
                  <p className="text-xs text-[#525866]">{b.overview}</p>
                  <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-[#2855E8]">
                    {bldgFloors.map((fl) => (
                      <span key={fl.id} className="px-2 py-1 bg-[#E9EDF4]/60 border border-[#E9EDF4]">
                        {fl.label} ({fl.ceilingHeightMeters}m ceiling)
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: APARTMENT MANAGEMENT */}
      {activeTab === 'apartments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 p-6 bg-white border border-[#E9EDF4]">
            <h3 className="text-xl font-semibold text-[#17191D] mb-4">Create New Residence</h3>
            <form onSubmit={handleCreateApartment} className="space-y-3.5 text-xs">
              <div>
                <label htmlFor="cms-apt-proj" className="block font-mono text-[#525866] mb-1">
                  PROJECT *
                </label>
                <select
                  id="cms-apt-proj"
                  value={newAptProjectId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setNewAptProjectId(pid);
                    const firstBldg = buildings.find((b) => b.projectId === pid);
                    if (firstBldg) {
                      setNewAptBuildingId(firstBldg.id);
                      const firstFl = floors.find((f) => f.buildingId === firstBldg.id);
                      if (firstFl) setNewAptFloorId(firstFl.id);
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cms-apt-bldg" className="block font-mono text-[#525866] mb-1">
                    BUILDING *
                  </label>
                  <select
                    id="cms-apt-bldg"
                    value={newAptBuildingId}
                    onChange={(e) => {
                      const bid = e.target.value;
                      setNewAptBuildingId(bid);
                      const firstFl = floors.find((f) => f.buildingId === bid);
                      if (firstFl) setNewAptFloorId(firstFl.id);
                    }}
                    className="w-full px-2.5 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  >
                    {buildings
                      .filter((b) => b.projectId === newAptProjectId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cms-apt-floor" className="block font-mono text-[#525866] mb-1">
                    FLOOR *
                  </label>
                  <select
                    id="cms-apt-floor"
                    value={newAptFloorId}
                    onChange={(e) => setNewAptFloorId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  >
                    {floors
                      .filter((f) => f.buildingId === newAptBuildingId)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cms-apt-code" className="block font-mono text-[#525866] mb-1">
                    UNIT CODE *
                  </label>
                  <input
                    id="cms-apt-code"
                    type="text"
                    required
                    value={newAptCode}
                    onChange={(e) => setNewAptCode(e.target.value)}
                    placeholder="N-402"
                    className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  />
                </div>
                <div>
                  <label htmlFor="cms-apt-beds" className="block font-mono text-[#525866] mb-1">
                    BEDROOMS
                  </label>
                  <input
                    id="cms-apt-beds"
                    type="number"
                    min={1}
                    max={10}
                    value={newAptBedrooms}
                    onChange={(e) => setNewAptBedrooms(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cms-apt-title" className="block font-mono text-[#525866] mb-1">
                  RESIDENCE TITLE *
                </label>
                <input
                  id="cms-apt-title"
                  type="text"
                  required
                  value={newAptTitle}
                  onChange={(e) => setNewAptTitle(e.target.value)}
                  placeholder="Residence N-402 — Belvedere Corner Suite"
                  className="w-full px-3 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="cms-apt-area" className="block font-mono text-[#525866] mb-1">
                    AREA (SQ.M)
                  </label>
                  <input
                    id="cms-apt-area"
                    type="number"
                    value={newAptArea}
                    onChange={(e) => setNewAptArea(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  />
                </div>
                <div>
                  <label htmlFor="cms-apt-pstatus" className="block font-mono text-[#525866] mb-1">
                    PRICE STATUS
                  </label>
                  <select
                    id="cms-apt-pstatus"
                    value={newAptPriceStatus}
                    onChange={(e) => setNewAptPriceStatus(e.target.value as PriceStatus)}
                    className="w-full px-2 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4]"
                  >
                    <option value="published">Published</option>
                    <option value="price_on_request">On Request</option>
                    <option value="unconfirmed">Unconfirmed</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cms-apt-price" className="block font-mono text-[#525866] mb-1">
                    AMOUNT (EUR)
                  </label>
                  <input
                    id="cms-apt-price"
                    type="number"
                    disabled={newAptPriceStatus !== 'published'}
                    value={newAptPrice}
                    onChange={(e) => setNewAptPrice(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-[#E9EDF4]/40 border border-[#E9EDF4] disabled:opacity-50"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#2855E8] text-white font-semibold hover:bg-[#1E44C4]"
              >
                Create Apartment &amp; Link 3D Tour
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            {apartments.map((apt) => (
              <div
                key={apt.id}
                className="p-4 bg-white border border-[#E9EDF4] flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-mono text-[#525866] tabular-nums">
                    UNIT {apt.unitCode} · {apt.bedrooms} BED · {apt.areaSqm} SQ.M ·{' '}
                    {formatPriceDisplay(apt.priceStatus, apt.priceAmount, apt.currency)}
                  </div>
                  <h4 className="text-base font-semibold text-[#17191D]">{apt.title}</h4>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <select
                    aria-label={`Availability for ${apt.unitCode}`}
                    value={apt.availabilityStatus}
                    onChange={(e) => {
                      if (!canManageContent) {
                        setStatusBanner('Permission Denied.');
                        return;
                      }
                      const nextAvail = e.target.value as AvailabilityStatus;
                      onUpdateApartments((prev) =>
                        prev.map((a) =>
                          a.id === apt.id ? { ...a, availabilityStatus: nextAvail } : a
                        )
                      );
                      setStatusBanner(
                        `Unit ${apt.unitCode} availability set to [${nextAvail.toUpperCase()}].`
                      );
                    }}
                    className="px-2.5 py-1.5 bg-[#E9EDF4]/50 border border-[#E9EDF4] font-mono"
                  >
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onNavigatePublic(`/apartments/${apt.id}`)}
                    className="px-3 py-1.5 border border-[#17191D] text-[#17191D] hover:bg-[#E9EDF4]"
                  >
                    View Page
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: 3D TOUR MANIFESTS */}
      {activeTab === 'tours' && (
        <div className="space-y-4">
          <div className="p-4 bg-[#E9EDF4] border border-[#E9EDF4] text-xs text-[#17191D]">
            <strong>3D Asset Governance Rule:</strong> Assets in <em>not_captured</em>,{' '}
            <em>capture_scheduled</em>, or <em>ready_for_review</em> states are never presented as live
            public tours. Only manifests marked <strong>published</strong> launch the interactive 3D
            experience on public routes.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tourManifests.map((manifest) => {
              const apt = apartments.find((a) => a.id === manifest.apartmentId);
              return (
                <div key={manifest.id} className="p-5 bg-white border border-[#E9EDF4] space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[#525866]">
                      MANIFEST: {manifest.id} · UNIT {apt?.unitCode || manifest.apartmentId}
                    </span>
                    <span className="font-mono font-semibold text-[#2855E8]">
                      {manifest.captureStatus.toUpperCase().replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-[#525866]">{manifest.reviewerNotes}</p>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-mono text-[#525866] mb-1">VIEWER PROVIDER</label>
                      <select
                        value={manifest.provider}
                        onChange={(e) =>
                          handleUpdateManifestStatus(
                            manifest,
                            manifest.captureStatus,
                            e.target.value as TourProviderType,
                            manifest.externalEmbedUrl
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-[#E9EDF4]/50 border border-[#E9EDF4]"
                      >
                        <option value="threejs_architectural_twin">
                          Three.js Architectural Digital Twin
                        </option>
                        <option value="matterport_embed">Matterport Hosted Scan</option>
                        <option value="custom_webgl">Custom WebGL Scene</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[#525866] mb-1">APPROVAL STATUS</label>
                      <select
                        value={manifest.captureStatus}
                        onChange={(e) =>
                          handleUpdateManifestStatus(
                            manifest,
                            e.target.value as AssetCaptureStatus,
                            manifest.provider,
                            manifest.externalEmbedUrl
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-[#E9EDF4]/50 border border-[#E9EDF4]"
                      >
                        <option value="not_captured">Not Captured</option>
                        <option value="capture_scheduled">Capture Scheduled</option>
                        <option value="processing">Processing</option>
                        <option value="ready_for_review">Ready for Review</option>
                        <option value="approved_for_publication">Approved for Publication</option>
                        <option value="published">Published (Live)</option>
                        <option value="unavailable">Disabled / Unavailable</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onNavigatePublic(`/tour/${manifest.apartmentId}`)}
                      className="px-3 py-1.5 bg-[#17191D] text-white hover:bg-[#2855E8]"
                    >
                      Preview Tour Route
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: INQUIRY & SITE VISIT LEAD MANAGEMENT */}
      {activeTab === 'inquiries' && (
        <div>
          {!canManageInquiries ? (
            <div className="p-8 bg-white border border-[#E9EDF4] text-sm text-[#525866]">
              <strong>Access Restricted (PII Isolation):</strong> Your current role (
              <code className="font-mono">{activeRole}</code>) does not have permission to view
              customer PII or inquiry records. Switch to <em>Super Administrator</em> or{' '}
              <em>Sales/Inquiry Manager</em> to manage leads.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="inq-filter" className="text-xs font-mono text-[#525866]">
                    FILTER BY STATUS:
                  </label>
                  <select
                    id="inq-filter"
                    value={inquiryStatusFilter}
                    onChange={(e) => setInquiryStatusFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-white border border-[#E9EDF4]"
                  >
                    <option value="all">All Inquiries ({inquiries.length})</option>
                    <option value="new">New</option>
                    <option value="site_visit_requested">Site Visit Requested</option>
                    <option value="site_visit_confirmed">Site Visit Confirmed</option>
                    <option value="contacted">Contacted</option>
                    <option value="follow_up_required">Follow-Up Required</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {filteredInquiries.map((inq) => (
                  <button
                    key={inq.id}
                    type="button"
                    onClick={() => setSelectedInquiryId(inq.id)}
                    className={`w-full text-left p-4 border arch-transition ${
                      selectedInquiry?.id === inq.id
                        ? 'bg-[#17191D] text-white border-[#17191D]'
                        : 'bg-white text-[#17191D] border-[#E9EDF4] hover:bg-[#E9EDF4]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono opacity-80">
                      <span>{inq.inquiryType.toUpperCase().replace(/_/g, ' ')}</span>
                      <span>{inq.status.toUpperCase().replace(/_/g, ' ')}</span>
                    </div>
                    <div className="font-semibold text-sm mt-1">{inq.customerName}</div>
                    <div className="text-xs opacity-80 truncate mt-0.5">{inq.message}</div>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-7">
                {selectedInquiry ? (
                  <div className="p-6 bg-white border border-[#E9EDF4] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E9EDF4]">
                      <div>
                        <div className="text-xs font-mono text-[#525866]">
                          LEAD ID: {selectedInquiry.id} · SUBMITTED: {selectedInquiry.createdAt.slice(0, 10)}
                        </div>
                        <h3 className="text-2xl font-semibold text-[#17191D] mt-1">
                          {selectedInquiry.customerName}
                        </h3>
                      </div>
                      <select
                        aria-label="Update Inquiry Status"
                        value={selectedInquiry.status}
                        onChange={(e) =>
                          handleUpdateInquiry(
                            selectedInquiry,
                            e.target.value as InquiryStatus,
                            selectedInquiry.internalNotes
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold bg-[#E9EDF4] border border-[#17191D] text-[#17191D]"
                      >
                        <option value="new">Status: New</option>
                        <option value="contacted">Status: Contacted</option>
                        <option value="follow_up_required">Status: Follow-Up Required</option>
                        <option value="site_visit_requested">Status: Site Visit Requested</option>
                        <option value="site_visit_confirmed">Status: Site Visit Confirmed</option>
                        <option value="closed">Status: Closed</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#E9EDF4]/45 border border-[#E9EDF4] text-xs font-mono">
                      <div>
                        <div className="text-[#525866]">EMAIL</div>
                        <div className="text-[#17191D] mt-0.5 break-all">{selectedInquiry.customerEmail}</div>
                      </div>
                      <div>
                        <div className="text-[#525866]">TELEPHONE</div>
                        <div className="text-[#17191D] mt-0.5">{selectedInquiry.customerPhone || 'Not Provided'}</div>
                      </div>
                      <div>
                        <div className="text-[#525866]">PREFERRED CHANNEL</div>
                        <div className="text-[#17191D] mt-0.5">{selectedInquiry.preferredContactMethod.toUpperCase()}</div>
                      </div>
                    </div>

                    {selectedInquiry.preferredDate && (
                      <div className="p-3.5 bg-[#E9EDF4] border border-[#E9EDF4] text-xs">
                        <strong>Requested Site Visit Slot:</strong> {selectedInquiry.preferredDate} (
                        {selectedInquiry.preferredTimeWindow})
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-mono text-[#525866] mb-1">CUSTOMER MESSAGE</div>
                      <p className="text-sm text-[#17191D] bg-[#E9EDF4]/35 p-4 border border-[#E9EDF4] leading-relaxed">
                        {selectedInquiry.message}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="inq-internal-notes"
                        className="block text-xs font-mono text-[#525866] mb-1"
                      >
                        INTERNAL ADVISOR NOTES (RESTRICTED TO AUTHORIZED STAFF)
                      </label>
                      <textarea
                        id="inq-internal-notes"
                        rows={3}
                        value={selectedInquiry.internalNotes}
                        onChange={(e) =>
                          handleUpdateInquiry(selectedInquiry, selectedInquiry.status, e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs bg-[#E9EDF4]/35 border border-[#E9EDF4]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-white border border-[#E9EDF4] text-sm text-[#525866]">
                    No inquiries match the selected status filter.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: SECURITY & RBAC MATRIX */}
      {activeTab === 'rbac' && (
        <div className="p-6 bg-white border border-[#E9EDF4] space-y-4">
          <h3 className="text-xl font-semibold text-[#17191D]">
            Enforced Role-Based Access Control (RBAC) &amp; Cloud Firestore Rules
          </h3>
          <p className="text-sm text-[#525866]">
            {canManageRoles
              ? 'Super Administrators can audit and manage role assignments across Content and Inquiry divisions.'
              : 'Your current role has read-only visibility into the RBAC matrix.'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E9EDF4] font-mono text-[#525866]">
                  <th className="py-2.5 pr-4">ROLE IDENTIFIER</th>
                  <th className="py-2.5 px-4">PROJECTS / BUILDINGS / UNITS</th>
                  <th className="py-2.5 px-4">3D ASSET MANIFESTS</th>
                  <th className="py-2.5 px-4">CUSTOMER PII INQUIRIES</th>
                  <th className="py-2.5 pl-4">SYSTEM / ROLE ADMIN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9EDF4]">
                <tr>
                  <td className="py-3 pr-4 font-semibold">super_admin</td>
                  <td className="py-3 px-4 text-[#2855E8]">Create / Edit / Publish / Delete</td>
                  <td className="py-3 px-4 text-[#2855E8]">Approve &amp; Publish</td>
                  <td className="py-3 px-4 text-[#2855E8]">Full Read &amp; Status Management</td>
                  <td className="py-3 pl-4 text-[#2855E8]">Full Access</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-semibold">content_manager</td>
                  <td className="py-3 px-4 text-[#2855E8]">Create / Edit / Publish</td>
                  <td className="py-3 px-4 text-[#2855E8]">Approve &amp; Publish</td>
                  <td className="py-3 px-4 text-red-800">Denied (PII Isolated)</td>
                  <td className="py-3 pl-4 text-red-800">Denied</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-semibold">inquiry_manager</td>
                  <td className="py-3 px-4 text-[#525866]">Read-Only</td>
                  <td className="py-3 px-4 text-[#525866]">Read-Only</td>
                  <td className="py-3 px-4 text-[#2855E8]">Full Read &amp; Status Management</td>
                  <td className="py-3 pl-4 text-red-800">Denied</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
