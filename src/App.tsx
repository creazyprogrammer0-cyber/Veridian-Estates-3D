/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Project,
  Building,
  Floor,
  Apartment,
  TourManifest,
  Inquiry,
  ProjectFilterState,
  ApartmentFilterState,
  InquiryType,
  FloorPlanRoom,
} from './types/property';
import {
  DEMO_PROJECTS,
  DEMO_BUILDINGS,
  DEMO_FLOORS,
  DEMO_APARTMENTS,
  DEMO_TOUR_MANIFESTS,
  DEMO_INQUIRIES,
} from './data/demoSeedData';
import {
  filterPublicProjects,
  filterPublicApartments,
  formatPriceDisplay,
} from './utils/propertyLogic';
import {
  auth,
  onAuthStateChanged,
  testFirestoreConnection,
  User,
} from './lib/firebase';
import {
  ArchitecturalVisual,
  ArchitecturalGallery,
  InteractiveFloorPlan,
  GalleryItem,
} from './components/ArchitecturalVisual';
import { VirtualTour3D } from './components/VirtualTour3D';
import { InquiryFormSection } from './components/InquiryModal';
import { AdminDashboard } from './components/AdminDashboard';

function getInitialPath(): string {
  const params = new URLSearchParams(window.location.search);
  const routeParam = params.get('route');
  if (routeParam) return routeParam;
  if (window.location.hash.startsWith('#/')) {
    return window.location.hash.slice(1);
  }
  return window.location.pathname || '/';
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Core Persistent + Seeded State
  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [buildings, setBuildings] = useState<Building[]>(DEMO_BUILDINGS);
  const [floors, setFloors] = useState<Floor[]>(DEMO_FLOORS);
  const [apartments, setApartments] = useState<Apartment[]>(DEMO_APARTMENTS);
  const [tourManifests, setTourManifests] = useState<TourManifest[]>(DEMO_TOUR_MANIFESTS);
  const [inquiries, setInquiries] = useState<Inquiry[]>(DEMO_INQUIRIES);

  // Public Project Filter State
  const [projectFilters, setProjectFilters] = useState<ProjectFilterState>({
    search: '',
    location: 'all',
    completionStatus: 'all',
    onlyWithAvailableUnits: false,
    onlyWithPublished3DTour: false,
  });

  // Public Apartment Filter State
  const [aptFilters, setAptFilters] = useState<ApartmentFilterState>({
    projectId: 'all',
    buildingId: 'all',
    floorId: 'all',
    minBedrooms: 0,
    availabilityStatus: 'all',
    maxPrice: 0,
    onlyWith3DTour: false,
  });

  // Selected Floor, Room, and Initial 3D Tour Room State
  const [selectedBuildingFloorId, setSelectedBuildingFloorId] = useState<string>('');
  const [selectedAptRoom, setSelectedAptRoom] = useState<FloorPlanRoom | null>(null);
  const [tourInitialRoomId, setTourInitialRoomId] = useState<string | undefined>(undefined);

  // Inquiry Modal State
  const [inquiryModal, setInquiryModal] = useState<{
    open: boolean;
    projectId: string;
    apartmentId: string;
    inquiryType: InquiryType;
  }>({
    open: false,
    projectId: '',
    apartmentId: '',
    inquiryType: 'property_details',
  });

  // Brochure Preview Notice State
  const [brochureNotice, setBrochureNotice] = useState<string | null>(null);

  // Boot Firestore connection check & Auth listener
  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  // Sync browser history navigation
  const navigate = useCallback((path: string, initialRoomId?: string) => {
    setTourInitialRoomId(initialRoomId);
    setCurrentPath(path);
    try {
      window.history.pushState({}, '', path);
    } catch {
      window.location.hash = `#${path}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Dynamic SEO Title & Description per route
  useEffect(() => {
    if (currentPath === '/') {
      document.title = 'Veridian Estates — Architectural Residences & 3D Digital Showroom';
    } else if (currentPath === '/projects') {
      document.title = 'Residential Developments Directory | Veridian Estates';
    } else if (currentPath.startsWith('/projects/')) {
      const parts = currentPath.split('/').filter(Boolean);
      const proj = projects.find((p) => p.id === parts[1] || p.slug === parts[1]);
      if (proj) {
        document.title = proj.seoTitle || `${proj.name} | Veridian Estates`;
      }
    } else if (currentPath.startsWith('/apartments/')) {
      const aptId = currentPath.split('/')[2];
      const apt = apartments.find((a) => a.id === aptId);
      if (apt) {
        document.title = `${apt.title} | Veridian Estates`;
      }
    } else if (currentPath.startsWith('/tour/')) {
      const aptId = currentPath.split('/')[2];
      const apt = apartments.find((a) => a.id === aptId);
      if (apt) {
        document.title = `3D Virtual Tour — Unit ${apt.unitCode} | Veridian Estates`;
      }
    } else if (currentPath === '/admin') {
      document.title = 'Administration & CMS | Veridian Estates';
    }
  }, [currentPath, projects, apartments]);

  const filteredProjects = useMemo(
    () => filterPublicProjects(projects, apartments, tourManifests, projectFilters),
    [projects, apartments, tourManifests, projectFilters]
  );

  const openInquiryModal = useCallback(
    (projectId = '', apartmentId = '', inquiryType: InquiryType = 'property_details') => {
      setInquiryModal({ open: true, projectId, apartmentId, inquiryType });
    },
    []
  );

  const handleInquiryCreated = useCallback((newInq: Inquiry) => {
    setInquiries((prev) => [newInq, ...prev]);
  }, []);

  // Dedicated Full-Viewport Route for 3D Virtual Tour (`/tour/:apartmentId`)
  if (currentPath.startsWith('/tour/')) {
    const aptId = currentPath.split('/')[2];
    const apt = apartments.find((a) => a.id === aptId && a.publicationStatus === 'published');
    if (!apt) {
      return (
        <div className="min-h-screen bg-white text-[#17191D] flex flex-col items-center justify-center p-8">
          <div className="max-w-lg border border-[#E9EDF4] bg-white p-8 space-y-4">
            <div className="text-xs font-mono text-[#2855E8]">404 · TOUR ASSET NOT FOUND</div>
            <h1 className="text-2xl font-semibold">Requested Residence or 3D Tour Unavailable</h1>
            <p className="text-sm text-[#525866]">
              The requested apartment tour route does not match a published property record.
            </p>
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="px-4 py-2 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4]"
            >
              Return to Projects Directory
            </button>
          </div>
        </div>
      );
    }

    const proj = projects.find((p) => p.id === apt.projectId) || projects[0];
    const bldg = buildings.find((b) => b.id === apt.buildingId) || buildings[0];
    const fl = floors.find((f) => f.id === apt.floorId) || floors[0];
    const manifest = tourManifests.find((m) => m.id === apt.tourAssetId || m.apartmentId === apt.id);

    return (
      <>
        <VirtualTour3D
          project={proj}
          building={bldg}
          floor={fl}
          apartment={apt}
          manifest={manifest}
          initialRoomId={tourInitialRoomId}
          onExitTour={() => navigate(`/apartments/${apt.id}`)}
          onOpenInquiry={(mode) => openInquiryModal(proj.id, apt.id, mode)}
        />
        {inquiryModal.open && (
          <div
            className="fixed inset-0 z-50 bg-[#17191D]/80 flex items-center justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="max-w-2xl w-full bg-white border border-[#E9EDF4] p-6 lg:p-8 shadow-2xl my-8">
              <InquiryFormSection
                projects={projects}
                apartments={apartments}
                initialProjectId={inquiryModal.projectId}
                initialApartmentId={inquiryModal.apartmentId}
                initialInquiryType={inquiryModal.inquiryType}
                onInquiryCreated={handleInquiryCreated}
                onClose={() => setInquiryModal((prev) => ({ ...prev, open: false }))}
                isModal={true}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Helper to resolve current route view
  const renderMainContent = () => {
    // =========================================================================
    // 1. CONTEMPORARY LUXURY REAL ESTATE HOMEPAGE (`/`)
    // =========================================================================
    if (currentPath === '/' || currentPath === '') {
      const publishedProjects = projects.filter((p) => p.publicationStatus === 'published');
      const flagshipProject = publishedProjects[0] || projects[0];
      const secondaryProjects = publishedProjects.slice(1);
      const featuredTourApt = apartments.find((a) => a.id === 'apt-n401') || apartments[0];
      const activeHomeRoom = selectedAptRoom || featuredTourApt.rooms[0];

      return (
        <div className="arch-reveal">
          {/* Subtle Provenance & Verification Strip on Cool Grey (#E9EDF4) */}
          <div className="bg-[#E9EDF4]/65 border-b border-[#E9EDF4] px-6 py-2.5 text-xs text-[#525866]">
            <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-medium text-[#17191D]">MONOGRAPH EDITION 2026</span>
                <span aria-hidden="true">·</span>
                <span>
                  Sample properties are clearly labeled as <em>Demonstration Records</em>{' '}
                  until final production photography and on-site LiDAR scans are published in the CMS.
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/about')}
                className="font-mono text-[#2855E8] underline hover:text-[#17191D] whitespace-nowrap shrink-0"
              >
                Verification &amp; Spatial Standards →
              </button>
            </div>
          </div>

          {/* SECTION 1: CONTEMPORARY LUXURY ARCHITECTURAL HERO */}
          <section className="bg-white max-w-[1380px] mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              {/* Left 5 Columns: Editorial Typography & Primary Actions */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#2855E8]">
                    <span>GENEVA</span>
                    <span aria-hidden="true">·</span>
                    <span>PORTO CERVO</span>
                    <span aria-hidden="true">·</span>
                    <span>LONDON</span>
                  </div>

                  <h1
                    className="font-semibold text-[#17191D] tracking-tight leading-[1.04]"
                    style={{ fontSize: 'clamp(2.5rem, 4.3vw, 4rem)' }}
                  >
                    Contemporary Architecture &amp; Spatial Precision.
                  </h1>

                  <p className="text-base text-[#525866] leading-relaxed">
                    Veridian Estates develops low-density residential architecture across premier
                    European locations. Explore each building’s structural envelope, compare floor
                    plates, and walk through our interactive 3D digital twins remotely before
                    scheduling a private viewing.
                  </p>
                </div>

                <div className="space-y-8">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => navigate('/projects')}
                      className="px-6 py-3.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition whitespace-nowrap shrink-0"
                    >
                      Explore Properties
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/tour/${featuredTourApt.id}`)}
                      className="px-6 py-3.5 text-xs font-medium bg-white border border-[#17191D] text-[#17191D] hover:bg-[#E9EDF4] arch-transition whitespace-nowrap shrink-0"
                    >
                      Discover 3D Tour · Unit {featuredTourApt.unitCode}
                    </button>
                  </div>

                  {/* Architectural Portfolio Ledger */}
                  <div className="pt-6 border-t border-[#E9EDF4] grid grid-cols-3 gap-4 text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-2xl font-display font-semibold text-[#17191D]">
                        0{publishedProjects.length}
                      </div>
                      <div className="text-[#525866] mt-0.5">PUBLISHED ESTATES</div>
                    </div>
                    <div>
                      <div className="text-2xl font-display font-semibold text-[#17191D]">
                        0{apartments.filter((a) => a.availabilityStatus === 'available').length}
                      </div>
                      <div className="text-[#525866] mt-0.5">AVAILABLE UNITS</div>
                    </div>
                    <div>
                      <div className="text-2xl font-display font-semibold text-[#2855E8]">
                        0{tourManifests.filter((m) => m.captureStatus === 'published').length}
                      </div>
                      <div className="text-[#525866] mt-0.5">LIVE 3D TWINS</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 7 Columns: Dominant Architectural Plate with Layered Spec Callout */}
              <div className="lg:col-span-7 relative min-h-[420px] lg:min-h-[550px] border border-[#E9EDF4] bg-[#17191D]">
                <ArchitecturalVisual
                  preset="hero_pavilion"
                  alt="The Veridian Pavilion Contemporary Architectural Elevation"
                  className="w-full h-full"
                />

                {/* Layered Overlapping Architectural Plate Card (Bottom-Left) */}
                <div className="hidden sm:block absolute bottom-6 left-6 right-6 lg:right-auto lg:max-w-md bg-white/95 backdrop-blur-sm border border-[#E9EDF4] p-5 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between gap-4 text-xs font-mono text-[#525866] tabular-nums">
                    <span>FEATURED COMMISSION · PLATE 01</span>
                    <span className="text-[#2855E8] font-semibold">3D TWIN LIVE</span>
                  </div>
                  <div className="text-xl font-display font-semibold text-[#17191D]">
                    {flagshipProject.name} — {flagshipProject.location}
                  </div>
                  <p className="text-xs text-[#525866] leading-relaxed">
                    Cantilevered architectural stone slabs, triple-glazed low-iron curtain walls,
                    and private reflection gardens.
                  </p>
                  <div className="pt-2 flex items-center gap-5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${flagshipProject.id}`)}
                      className="text-[#17191D] underline hover:text-[#2855E8]"
                    >
                      Inspect Project Dossier →
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/tour/${featuredTourApt.id}`)}
                      className="text-[#2855E8] font-medium underline hover:text-[#17191D]"
                    >
                      Enter Unit N-401 in 3D →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Integrated Property Discovery Bar on Cool Grey (#E9EDF4) */}
            <div className="mt-12 bg-[#E9EDF4]/55 border border-[#E9EDF4] p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
                <div className="md:col-span-4">
                  <label
                    htmlFor="home-search"
                    className="block text-xs font-mono text-[#525866] mb-1.5"
                  >
                    SEARCH DEVELOPMENTS OR LOCATIONS
                  </label>
                  <input
                    id="home-search"
                    type="text"
                    value={projectFilters.search}
                    onChange={(e) =>
                      setProjectFilters((prev) => ({ ...prev, search: e.target.value }))
                    }
                    placeholder="Geneva, Porto Cervo, London, Penthouse..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E9EDF4] text-[#17191D]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label
                    htmlFor="home-status"
                    className="block text-xs font-mono text-[#525866] mb-1.5"
                  >
                    CONSTRUCTION STAGE
                  </label>
                  <select
                    id="home-status"
                    value={projectFilters.completionStatus}
                    onChange={(e) =>
                      setProjectFilters((prev) => ({ ...prev, completionStatus: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 text-sm bg-white border border-[#E9EDF4] text-[#17191D]"
                  >
                    <option value="all">All Development Stages</option>
                    <option value="Completed">Completed</option>
                    <option value="Under Construction">Under Construction</option>
                    <option value="Planning">Planning Stage</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="flex items-center gap-2.5 text-xs text-[#17191D] py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={projectFilters.onlyWithPublished3DTour}
                      onChange={(e) =>
                        setProjectFilters((prev) => ({
                          ...prev,
                          onlyWithPublished3DTour: e.target.checked,
                        }))
                      }
                      className="accent-[#2855E8]"
                    />
                    <span>Only Estates with Published 3D Twin</span>
                  </label>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => navigate('/projects')}
                    className="w-full px-4 py-2.5 text-xs font-semibold bg-[#17191D] text-white hover:bg-[#2855E8] arch-transition whitespace-nowrap shrink-0"
                  >
                    View Portfolio ({filteredProjects.length})
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: FEATURED PROPERTIES (ASYMMETRIC IMAGE-LED SHOWCASE) */}
          <section className="bg-[#E9EDF4]/35 border-t border-[#E9EDF4] py-20">
            <div className="max-w-[1380px] mx-auto px-6 space-y-14">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="max-w-2xl">
                  <p className="text-xs font-mono text-[#2855E8]">
                    01. FEATURED ARCHITECTURAL PROPERTIES
                  </p>
                  <h2 className="text-3xl lg:text-5xl font-semibold text-[#17191D] mt-1">
                    Curated Residential Commissions
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="px-5 py-2.5 text-xs font-medium bg-white border border-[#17191D] text-[#17191D] hover:bg-[#17191D] hover:text-white arch-transition whitespace-nowrap shrink-0"
                >
                  Inspect Complete Directory ({publishedProjects.length}) →
                </button>
              </div>

              {/* Tier 1: Flagship Marquee Project (12-Column Asymmetric Split) */}
              {flagshipProject && (() => {
                const flagApts = apartments.filter(
                  (a) => a.projectId === flagshipProject.id && a.publicationStatus === 'published'
                );
                const flagBuildings = buildings.filter(
                  (b) => b.projectId === flagshipProject.id && b.publicationStatus === 'published'
                );
                const flagAvail = flagApts.filter((a) => a.availabilityStatus === 'available').length;
                const flagTourApt = flagApts.find((a) => {
                  const m = tourManifests.find((tm) => tm.id === a.tourAssetId);
                  return m?.captureStatus === 'published';
                });

                return (
                  <article className="bg-white border border-[#E9EDF4] grid grid-cols-1 lg:grid-cols-12 items-stretch">
                    <div className="lg:col-span-7 min-h-[360px] lg:min-h-[450px] border-b lg:border-b-0 lg:border-r border-[#E9EDF4]">
                      <ArchitecturalVisual
                        preset={flagshipProject.visualPreset}
                        imageUrl={flagshipProject.heroImageUrl}
                        alt={flagshipProject.name}
                        caption={`Commission 01 · ${flagshipProject.name} — ${flagshipProject.location}`}
                        className="w-full h-full"
                        onExpandClick={() => navigate(`/projects/${flagshipProject.id}`)}
                      />
                    </div>

                    <div className="lg:col-span-5 p-8 lg:p-10 flex flex-col justify-between space-y-6">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#525866] tabular-nums">
                          <span className="text-[#2855E8] font-semibold">FLAGSHIP COMMISSION</span>
                          <span aria-hidden="true">·</span>
                          <span>{flagshipProject.completionStatus}</span>
                          <span aria-hidden="true">·</span>
                          <span>{flagBuildings.length} Buildings</span>
                          <span aria-hidden="true">·</span>
                          <span>{flagAvail} Available Units</span>
                        </div>

                        <h3 className="text-3xl lg:text-4xl font-semibold text-[#17191D]">
                          {flagshipProject.name}
                        </h3>
                        <p className="text-xs font-mono text-[#525866]">
                          {flagshipProject.location} · {flagshipProject.coordinatesLabel}
                        </p>
                        <p className="text-sm text-[#525866] leading-relaxed">
                          {flagshipProject.fullDescription}
                        </p>

                        {/* Mini Residence Schedule Preview */}
                        <div className="pt-3 border-t border-[#E9EDF4] space-y-2">
                          <div className="text-xs font-mono text-[#525866]">
                            SELECT RESIDENCES IN THIS COMMISSION
                          </div>
                          <div className="space-y-1.5">
                            {flagApts.slice(0, 3).map((apt) => (
                              <div
                                key={apt.id}
                                onClick={() => navigate(`/apartments/${apt.id}`)}
                                className="cursor-pointer p-2.5 bg-[#E9EDF4]/40 hover:bg-[#E9EDF4] border border-[#E9EDF4] flex items-center justify-between text-xs tabular-nums arch-transition"
                              >
                                <div>
                                  <span className="font-semibold text-[#17191D]">
                                    Unit {apt.unitCode}
                                  </span>
                                  <span className="text-[#525866] ml-2">
                                    · {apt.bedrooms} Bed · {apt.areaSqm} m²
                                  </span>
                                </div>
                                <span className="font-mono font-medium text-[#2855E8]">
                                  {formatPriceDisplay(apt.priceStatus, apt.priceAmount, apt.currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-[#E9EDF4] flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${flagshipProject.id}`)}
                          className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition whitespace-nowrap shrink-0"
                        >
                          Explore Project &amp; Floor Plates
                        </button>
                        {flagTourApt && (
                          <button
                            type="button"
                            onClick={() => navigate(`/tour/${flagTourApt.id}`)}
                            className="px-5 py-2.5 text-xs font-medium bg-[#17191D] text-white hover:bg-[#2855E8] arch-transition whitespace-nowrap shrink-0"
                          >
                            Launch 3D Twin (Unit {flagTourApt.unitCode})
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })()}

              {/* Tier 2: Asymmetric Offset Pair for Secondary Developments (7 Cols + 5 Cols) */}
              {secondaryProjects.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {secondaryProjects.map((proj, idx) => {
                    const projApts = apartments.filter(
                      (a) => a.projectId === proj.id && a.publicationStatus === 'published'
                    );
                    const availCount = projApts.filter(
                      (a) => a.availabilityStatus === 'available'
                    ).length;
                    const tourApt = projApts.find((a) => {
                      const m = tourManifests.find((tm) => tm.id === a.tourAssetId);
                      return m?.captureStatus === 'published';
                    });
                    const colSpanClass = idx === 0 ? 'lg:col-span-7' : 'lg:col-span-5 lg:mt-10';
                    const imgHeightClass = idx === 0 ? 'h-80' : 'h-72';

                    return (
                      <article
                        key={proj.id}
                        className={`${colSpanClass} bg-white border border-[#E9EDF4] flex flex-col justify-between`}
                      >
                        <div>
                          <div className={`${imgHeightClass} border-b border-[#E9EDF4]`}>
                            <ArchitecturalVisual
                              preset={proj.visualPreset}
                              imageUrl={proj.heroImageUrl}
                              alt={proj.name}
                              caption={`Commission 0${idx + 2} · ${proj.location}`}
                              className="w-full h-full"
                              onExpandClick={() => navigate(`/projects/${proj.id}`)}
                            />
                          </div>
                          <div className="p-7 space-y-3.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#525866] tabular-nums">
                              <span className="text-[#17191D] font-medium">
                                {proj.completionStatus}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{availCount} Available Residence(s)</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {proj.isDemonstration ? 'Demonstration Record' : 'Verified Record'}
                              </span>
                            </div>

                            <h3 className="text-3xl font-semibold text-[#17191D]">{proj.name}</h3>
                            <p className="text-xs font-mono text-[#2855E8]">{proj.location}</p>
                            <p className="text-sm text-[#525866] leading-relaxed">
                              {proj.shortDescription}
                            </p>

                            <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#525866]">
                              {proj.highlights.slice(0, 3).map((h) => (
                                <span key={h}>— {h}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="px-7 py-4 bg-[#E9EDF4]/45 border-t border-[#E9EDF4] flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/projects/${proj.id}`)}
                            className="px-4 py-2 text-xs font-semibold bg-[#17191D] text-white hover:bg-[#2855E8] arch-transition whitespace-nowrap shrink-0"
                          >
                            Explore Commission
                          </button>
                          {tourApt ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/tour/${tourApt.id}`)}
                              className="px-4 py-2 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition whitespace-nowrap shrink-0"
                            >
                              Launch 3D Tour (Unit {tourApt.unitCode})
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openInquiryModal(proj.id, '', 'property_details')}
                              className="text-xs font-mono text-[#525866] underline hover:text-[#17191D]"
                            >
                              2D CAD Plates Available · Request Dossier
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 3: 3D EXPERIENCE INTRODUCTION (HIGH-CONTRAST NEAR BLACK #17191D) */}
          <section className="bg-[#17191D] text-white py-20">
            <div className="max-w-[1380px] mx-auto px-6 space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end border-b border-white/15 pb-10">
                <div className="lg:col-span-7 space-y-3">
                  <p className="text-xs font-mono text-[#E9EDF4]">
                    02. IMMERSIVE 3D DIGITAL TWIN EXPERIENCE
                  </p>
                  <h2 className="text-3xl lg:text-5xl font-semibold text-white leading-tight">
                    Evaluate Spatial Volume, Daylight &amp; Proportions Remotely Before Visiting in Person.
                  </h2>
                </div>
                <div className="lg:col-span-5 space-y-4">
                  <p className="text-sm text-[#9BA3B4] leading-relaxed">
                    Our interactive 3D tour engine unites first-person room viewpoints, an
                    axonometric 3D Dollhouse cutaway, and a synchronized 2D architectural floor
                    plate. Select any room below to inspect its verified dimensions or launch
                    directly into that space in 3D.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/tour/${featuredTourApt.id}`, activeHomeRoom.id)}
                      className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition whitespace-nowrap shrink-0"
                    >
                      Enter {activeHomeRoom.name} in 3D →
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/apartments/${featuredTourApt.id}`)}
                      className="px-5 py-2.5 text-xs font-medium bg-transparent border border-white/25 text-white hover:bg-white/10 arch-transition whitespace-nowrap shrink-0"
                    >
                      Inspect Unit {featuredTourApt.unitCode} Dossier
                    </button>
                  </div>
                </div>
              </div>

              {/* Synchronized Dark-Mode CAD Floor Plate & 3D Room Launcher */}
              <InteractiveFloorPlan
                rooms={featuredTourApt.rooms}
                selectedRoomId={activeHomeRoom.id}
                onSelectRoom={(rm) => setSelectedAptRoom(rm)}
                unitCode={featuredTourApt.unitCode}
                areaSqm={featuredTourApt.areaSqm}
                areaConvention={featuredTourApt.areaConvention}
                variant="dark"
                onLaunch3DRoom={(rm) => navigate(`/tour/${featuredTourApt.id}`, rm.id)}
              />
            </div>
          </section>

          {/* SECTION 4: ARCHITECTURAL PHILOSOPHY & MATERIAL TECTONICS (PURE WHITE) */}
          <section className="bg-white max-w-[1380px] mx-auto px-6 py-20 border-b border-[#E9EDF4]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <div className="lg:col-span-5 space-y-6">
                <p className="text-xs font-mono text-[#2855E8]">
                  03. ARCHITECTURAL THESIS &amp; PROVENANCE
                </p>
                <blockquote className="text-2xl lg:text-3xl font-display italic text-[#17191D] leading-snug py-4 border-y border-[#E9EDF4]">
                  “Architecture endures when structural geometry, natural stone, and daylight are
                  treated as a single indivisible instrument.”
                </blockquote>
                <p className="text-sm text-[#525866] leading-relaxed editorial-dropcap">
                  Every Veridian Estates commission begins with geological and solar site analysis.
                  Rather than applying superficial ornament, we articulate load-bearing natural
                  stone, low-iron structural glazing, and precision joinery with millimeter
                  accuracy.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-6 bg-[#E9EDF4]/35 border border-[#E9EDF4] flex flex-col justify-between space-y-6">
                  <div className="text-xs font-mono text-[#2855E8]">01 / ENVELOPE</div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-[#17191D]">
                      Monolithic Stone &amp; Glass
                    </h3>
                    <p className="text-xs text-[#525866] leading-relaxed">
                      Ventilated natural stone facades paired with thermally broken architectural
                      mullions and triple-glazed solar glass (Ug = 0.5 W/m²K).
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-[#525866] pt-3 border-t border-[#E9EDF4]">
                    ACOUSTIC RATING: STC 62+
                  </div>
                </div>

                <div className="p-6 bg-[#E9EDF4]/35 border border-[#E9EDF4] flex flex-col justify-between space-y-6">
                  <div className="text-xs font-mono text-[#2855E8]">02 / DIGITAL TWIN</div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-[#17191D]">
                      Verified Spatial Accuracy
                    </h3>
                    <p className="text-xs text-[#525866] leading-relaxed">
                      Every published 3D tour is governed by a verified asset manifest linking
                      project, building, floor, and unit records without fabricated claims.
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-[#525866] pt-3 border-t border-[#E9EDF4]">
                    CAD &amp; BIM SYNCHRONIZED
                  </div>
                </div>

                <div className="p-6 bg-[#E9EDF4]/35 border border-[#E9EDF4] flex flex-col justify-between space-y-6">
                  <div className="text-xs font-mono text-[#2855E8]">03 / SUSTAINABILITY</div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-[#17191D]">
                      Geothermal &amp; Minergie-P
                    </h3>
                    <p className="text-xs text-[#525866] leading-relaxed">
                      Closed-loop vertical geothermal heat pumps, radiant stone floor conditioning,
                      and whisper-quiet heat-recovery ventilation.
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-[#525866] pt-3 border-t border-[#E9EDF4]">
                    MINERGIE-P TARGET SPEC
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: PRIVATE ADVISORY & SITE VIEWING DESK */}
          <section className="bg-white max-w-[1380px] mx-auto px-6 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <div className="lg:col-span-5 space-y-6">
                <p className="text-xs font-mono text-[#2855E8]">04. PRIVATE ADVISORY DESK</p>
                <h2 className="text-3xl lg:text-4xl font-semibold text-[#17191D]">
                  Request an Architectural Dossier or Private Site Viewing.
                </h2>
                <p className="text-sm text-[#525866] leading-relaxed">
                  Every inquiry is validated and routed to our project advisory queue under strict
                  Cloud Firestore PII isolation rules. Select a development and residence to request
                  CAD floor plates, material schedules, or an accompanied viewing.
                </p>

                <div className="p-6 bg-[#E9EDF4]/50 border border-[#E9EDF4] space-y-4 text-xs">
                  <div>
                    <div className="font-mono text-[#525866]">GENEVA HEADQUARTERS</div>
                    <div className="font-semibold text-[#17191D] mt-0.5">
                      Rue du Rhône 42, 1204 Genève, Switzerland
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[#E9EDF4]">
                    <div className="font-mono text-[#525866]">MEDITERRANEAN &amp; LONDON GALLERIES</div>
                    <div className="font-semibold text-[#17191D] mt-0.5">
                      Via Aga Khan 18, Porto Cervo · 14 Kensington Gore, London
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[#E9EDF4]">
                    <div className="font-mono text-[#525866]">DIRECT ADVISORY LINE</div>
                    <div className="font-semibold text-[#17191D] mt-0.5 tabular-nums">
                      +41 22 819 40 00 · advisory@veridian-estates.example
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white border border-[#E9EDF4] p-8 lg:p-10">
                <InquiryFormSection
                  projects={projects}
                  apartments={apartments}
                  onInquiryCreated={handleInquiryCreated}
                />
              </div>
            </div>
          </section>
        </div>
      );
    }

    // =========================================================================
    // 2. PROJECTS LISTING PAGE (`/projects`)
    // =========================================================================
    if (currentPath === '/projects') {
      return (
        <div className="max-w-[1380px] mx-auto px-6 py-12 space-y-10 arch-reveal">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end border-b border-[#E9EDF4] pb-8">
            <div className="lg:col-span-8 space-y-2">
              <p className="text-xs font-mono text-[#2855E8]">ARCHITECTURAL PORTFOLIO INDEX</p>
              <h1 className="text-4xl lg:text-5xl font-semibold text-[#17191D]">
                Residential Developments &amp; Estates
              </h1>
            </div>
            <p className="lg:col-span-4 text-sm text-[#525866] leading-relaxed">
              Filter published commissions by city, construction stage, unit availability, and live
              3D digital twin readiness. Unpublished drafts remain isolated to the Admin CMS.
            </p>
          </div>

          {/* Filter Controls Bar */}
          <div className="p-6 bg-[#E9EDF4]/45 border border-[#E9EDF4] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="dir-search" className="block text-xs font-mono text-[#525866] mb-1">
                  KEYWORD SEARCH
                </label>
                <input
                  id="dir-search"
                  type="text"
                  value={projectFilters.search}
                  onChange={(e) =>
                    setProjectFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Project name, stone, city..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E9EDF4]"
                />
              </div>

              <div>
                <label
                  htmlFor="dir-location"
                  className="block text-xs font-mono text-[#525866] mb-1"
                >
                  LOCATION
                </label>
                <select
                  id="dir-location"
                  value={projectFilters.location}
                  onChange={(e) =>
                    setProjectFilters((prev) => ({ ...prev, location: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E9EDF4]"
                >
                  <option value="all">All Locations</option>
                  <option value="Geneva">Geneva, Switzerland</option>
                  <option value="Porto Cervo">Porto Cervo, Italy</option>
                  <option value="London">London, United Kingdom</option>
                </select>
              </div>

              <div>
                <label htmlFor="dir-status" className="block text-xs font-mono text-[#525866] mb-1">
                  PROJECT STATUS
                </label>
                <select
                  id="dir-status"
                  value={projectFilters.completionStatus}
                  onChange={(e) =>
                    setProjectFilters((prev) => ({ ...prev, completionStatus: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E9EDF4]"
                >
                  <option value="all">All Stages</option>
                  <option value="Completed">Completed</option>
                  <option value="Under Construction">Under Construction</option>
                  <option value="Planning">Planning</option>
                </select>
              </div>

              <div className="flex flex-col justify-end space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={projectFilters.onlyWithAvailableUnits}
                    onChange={(e) =>
                      setProjectFilters((prev) => ({
                        ...prev,
                        onlyWithAvailableUnits: e.target.checked,
                      }))
                    }
                    className="accent-[#2855E8]"
                  />
                  <span>Only With Available Apartments</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={projectFilters.onlyWithPublished3DTour}
                    onChange={(e) =>
                      setProjectFilters((prev) => ({
                        ...prev,
                        onlyWithPublished3DTour: e.target.checked,
                      }))
                    }
                    className="accent-[#2855E8]"
                  />
                  <span>Only With Published 3D Tour</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E9EDF4] text-xs">
              <span className="font-mono text-[#525866] tabular-nums">
                SHOWING {filteredProjects.length} PUBLISHED PROJECT(S)
              </span>
              <button
                type="button"
                onClick={() =>
                  setProjectFilters({
                    search: '',
                    location: 'all',
                    completionStatus: 'all',
                    onlyWithAvailableUnits: false,
                    onlyWithPublished3DTour: false,
                  })
                }
                className="font-mono text-[#2855E8] underline hover:text-[#17191D]"
              >
                Reset All Filters
              </button>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="p-12 bg-white border border-[#E9EDF4] text-center space-y-4">
              <p className="text-xs font-mono text-[#2855E8]">EMPTY FILTER RESULT</p>
              <h2 className="text-2xl font-semibold text-[#17191D]">
                No Published Projects Match Your Current Filter Criteria
              </h2>
              <p className="text-sm text-[#525866] max-w-md mx-auto">
                Reset the active location, status, or 3D tour filters to view all published
                developments.
              </p>
              <button
                type="button"
                onClick={() =>
                  setProjectFilters({
                    search: '',
                    location: 'all',
                    completionStatus: 'all',
                    onlyWithAvailableUnits: false,
                    onlyWithPublished3DTour: false,
                  })
                }
                className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {filteredProjects.map((proj, index) => {
                const projBuildings = buildings.filter(
                  (b) => b.projectId === proj.id && b.publicationStatus === 'published'
                );
                const projApts = apartments.filter(
                  (a) => a.projectId === proj.id && a.publicationStatus === 'published'
                );
                const availUnits = projApts.filter((a) => a.availabilityStatus === 'available');
                const tourApt = projApts.find((a) => {
                  const m = tourManifests.find((tm) => tm.id === a.tourAssetId);
                  return m?.captureStatus === 'published';
                });

                return (
                  <article
                    key={proj.id}
                    className="bg-white border border-[#E9EDF4] grid grid-cols-1 lg:grid-cols-12 items-stretch"
                  >
                    <div className="lg:col-span-6 min-h-[320px] lg:min-h-[380px] border-b lg:border-b-0 lg:border-r border-[#E9EDF4]">
                      <ArchitecturalVisual
                        preset={proj.visualPreset}
                        imageUrl={proj.heroImageUrl}
                        alt={proj.name}
                        caption={`0${index + 1} · ${proj.name} (${proj.location})`}
                        className="w-full h-full"
                        onExpandClick={() => navigate(`/projects/${proj.id}`)}
                      />
                    </div>
                    <div className="lg:col-span-6 p-8 lg:p-10 flex flex-col justify-between space-y-6">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#525866] tabular-nums">
                          <span>{proj.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>Status: {proj.completionStatus}</span>
                          <span aria-hidden="true">·</span>
                          <span>{projBuildings.length} Building(s)</span>
                          <span aria-hidden="true">·</span>
                          <span>{availUnits.length} Available Unit(s)</span>
                        </div>

                        <h2 className="text-3xl lg:text-4xl font-semibold text-[#17191D]">
                          {proj.name}
                        </h2>
                        <p className="text-xs font-mono text-[#2855E8]">{proj.location}</p>
                        <p className="text-sm text-[#525866] leading-relaxed">
                          {proj.shortDescription}
                        </p>

                        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#17191D]">
                          {proj.highlights.map((h) => (
                            <div key={h}>— {h}</div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-5 border-t border-[#E9EDF4] flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/projects/${proj.id}`)}
                            className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition"
                          >
                            Explore Project &amp; Units
                          </button>
                          {tourApt && (
                            <button
                              type="button"
                              onClick={() => navigate(`/tour/${tourApt.id}`)}
                              className="px-5 py-2.5 text-xs font-medium bg-[#17191D] text-white hover:bg-[#2855E8] arch-transition"
                            >
                              Launch 3D Tour (Unit {tourApt.unitCode})
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openInquiryModal(proj.id, '', 'property_details')}
                          className="text-xs font-mono text-[#17191D] underline hover:text-[#2855E8]"
                        >
                          Request Project Dossier
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // =========================================================================
    // 3. BUILDING DETAIL PAGE (`/projects/:projectId/buildings/:buildingId`)
    // =========================================================================
    if (
      currentPath.startsWith('/projects/') &&
      currentPath.split('/').filter(Boolean).length === 4 &&
      currentPath.split('/').filter(Boolean)[2] === 'buildings'
    ) {
      const parts = currentPath.split('/').filter(Boolean);
      const projId = parts[1];
      const bldgId = parts[3];
      const project = projects.find(
        (p) => (p.id === projId || p.slug === projId) && p.publicationStatus === 'published'
      );
      const building = buildings.find(
        (b) => b.id === bldgId && b.projectId === project?.id && b.publicationStatus === 'published'
      );

      if (!project || !building) {
        return (
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="p-8 bg-white border border-[#E9EDF4] space-y-4">
              <h1 className="text-2xl font-semibold">Building Record Unavailable</h1>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="px-4 py-2 text-xs bg-[#2855E8] text-white"
              >
                Back to Projects
              </button>
            </div>
          </div>
        );
      }

      const bldgFloors = floors
        .filter((f) => f.buildingId === building.id && f.publicationStatus === 'published')
        .sort((a, b) => b.floorNumber - a.floorNumber);
      const activeFloor =
        bldgFloors.find((f) => f.id === selectedBuildingFloorId) || bldgFloors[0];
      const bldgApartments = apartments.filter(
        (a) => a.buildingId === building.id && a.publicationStatus === 'published'
      );

      return (
        <div className="max-w-[1380px] mx-auto px-6 py-10 space-y-12 arch-reveal">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="text-xs font-mono text-[#525866] flex flex-wrap gap-2"
          >
            <button type="button" onClick={() => navigate('/projects')} className="hover:underline">
              Projects
            </button>
            <span aria-hidden="true">→</span>
            <button
              type="button"
              onClick={() => navigate(`/projects/${project.id}`)}
              className="hover:underline"
            >
              {project.name}
            </button>
            <span aria-hidden="true">→</span>
            <strong className="text-[#17191D]">{building.name}</strong>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 bg-white border border-[#E9EDF4] p-8 lg:p-10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="text-xs font-mono text-[#2855E8] tabular-nums">
                  BUILDING IDENTIFIER: {building.code} · {building.confirmedFloors} CONFIRMED FLOORS ·{' '}
                  {building.elevatorCount} PRIVATE LIFTS
                </div>
                <h1 className="text-3xl lg:text-5xl font-semibold text-[#17191D]">
                  {building.name}
                </h1>
                <p className="text-sm text-[#525866] leading-relaxed">{building.overview}</p>
                <div className="p-5 bg-[#E9EDF4]/45 border border-[#E9EDF4] text-xs space-y-1.5">
                  <div className="font-mono text-[#525866]">
                    STRUCTURAL &amp; ENVELOPE SPECIFICATION
                  </div>
                  <p className="text-[#17191D] leading-relaxed">
                    {building.architecturalSpecification}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-4 border-t border-[#E9EDF4]">
                <button
                  type="button"
                  onClick={() => openInquiryModal(project.id, '', 'site_visit_request')}
                  className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4]"
                >
                  Schedule Building Walkthrough
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="px-5 py-2.5 text-xs font-medium border border-[#17191D] text-[#17191D] hover:bg-[#E9EDF4]"
                >
                  Return to Project Overview
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 min-h-[360px] border border-[#E9EDF4]">
              <ArchitecturalVisual
                preset={building.visualPreset}
                alt={building.name}
                className="w-full h-full"
                caption={`${building.name} (${building.code}) · ${building.confirmedFloors} Stories`}
              />
            </div>
          </div>

          {/* Interactive Vertical Floor Stack & Residence Explorer */}
          <section className="bg-white border border-[#E9EDF4] p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 5 Cols: Vertical Architectural Floor Stack Selector */}
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <p className="text-xs font-mono text-[#2855E8]">VERTICAL FLOOR STACK</p>
                  <h2 className="text-2xl font-semibold text-[#17191D] mt-1">
                    Select Floor Plate in {building.name}
                  </h2>
                </div>
                <div className="space-y-2">
                  {bldgFloors.map((fl) => {
                    const isSelected = activeFloor?.id === fl.id;
                    const floorUnitCount = bldgApartments.filter((a) => a.floorId === fl.id).length;
                    return (
                      <button
                        key={fl.id}
                        type="button"
                        onClick={() => setSelectedBuildingFloorId(fl.id)}
                        className={`w-full p-4 text-left border arch-transition flex items-center justify-between gap-4 ${
                          isSelected
                            ? 'bg-[#2855E8] text-white border-[#2855E8]'
                            : 'bg-[#E9EDF4]/45 text-[#17191D] border-[#E9EDF4] hover:bg-[#E9EDF4]'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-mono opacity-80">
                            LEVEL 0{fl.floorNumber} · CEILING {fl.ceilingHeightMeters}M
                          </div>
                          <div className="text-sm font-semibold mt-0.5">{fl.label}</div>
                        </div>
                        <span className="text-xs font-mono tabular-nums shrink-0">
                          {floorUnitCount} Unit(s)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right 7 Cols: Active Floor Plate Specs & Residences */}
              <div className="lg:col-span-7 space-y-6">
                {activeFloor && (
                  <div className="p-5 bg-[#E9EDF4]/50 border border-[#E9EDF4] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#525866]">
                      <span>ACTIVE LEVEL SPECIFICATION</span>
                      <span>CLEAR CEILING HEIGHT: {activeFloor.ceilingHeightMeters}M</span>
                    </div>
                    <h3 className="text-xl font-semibold text-[#17191D]">{activeFloor.label}</h3>
                    <p className="text-xs text-[#525866]">{activeFloor.floorPlanSummary}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-xs font-mono text-[#525866]">
                    PUBLISHED RESIDENCES IN {building.name.toUpperCase()} ({bldgApartments.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bldgApartments.map((apt) => {
                      const fl = floors.find((f) => f.id === apt.floorId);
                      const manifest = tourManifests.find(
                        (m) => m.id === apt.tourAssetId || m.apartmentId === apt.id
                      );
                      const hasLiveTour = manifest?.captureStatus === 'published';

                      return (
                        <div
                          key={apt.id}
                          className="p-5 bg-[#E9EDF4]/35 border border-[#E9EDF4] flex flex-col justify-between space-y-4"
                        >
                          <div>
                            <div className="text-xs font-mono text-[#525866] tabular-nums">
                              UNIT {apt.unitCode} · {fl?.label || `Floor ${apt.floorId}`} ·{' '}
                              {apt.availabilityStatus.toUpperCase()}
                            </div>
                            <h4 className="text-xl font-semibold text-[#17191D] mt-1">
                              {apt.title}
                            </h4>
                            <div className="text-xs font-mono text-[#2855E8] mt-1 tabular-nums">
                              {apt.bedrooms} Bedrooms · {apt.bathrooms} Bathrooms · {apt.areaSqm}{' '}
                              sq.m ·{' '}
                              {formatPriceDisplay(apt.priceStatus, apt.priceAmount, apt.currency)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/apartments/${apt.id}`)}
                              className="px-4 py-2 text-xs font-medium bg-[#17191D] text-white hover:bg-[#2855E8]"
                            >
                              View Apartment Details
                            </button>
                            {hasLiveTour && (
                              <button
                                type="button"
                                onClick={() => navigate(`/tour/${apt.id}`)}
                                className="px-4 py-2 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4]"
                              >
                                Launch 3D Tour
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      );
    }

    // =========================================================================
    // 4. INDIVIDUAL PROJECT DETAIL PAGE (`/projects/:projectId`)
    // =========================================================================
    if (currentPath.startsWith('/projects/')) {
      const projKey = currentPath.split('/')[2];
      const project = projects.find(
        (p) => (p.id === projKey || p.slug === projKey) && p.publicationStatus === 'published'
      );

      if (!project) {
        return (
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="p-8 bg-white border border-[#E9EDF4] space-y-4">
              <div className="text-xs font-mono text-[#2855E8]">404 · PROJECT UNAVAILABLE</div>
              <h1 className="text-2xl font-semibold">
                Requested Project Is Not Published or Does Not Exist
              </h1>
              <p className="text-sm text-[#525866]">
                Unpublished draft projects are restricted to authorized administrators.
              </p>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="px-4 py-2 text-xs font-semibold bg-[#2855E8] text-white"
              >
                Return to Published Projects
              </button>
            </div>
          </div>
        );
      }

      const projBuildings = buildings.filter(
        (b) => b.projectId === project.id && b.publicationStatus === 'published'
      );
      const projApartments = filterPublicApartments(apartments, tourManifests, {
        ...aptFilters,
        projectId: project.id,
      });
      const primaryTourApt = apartments.find((a) => {
        if (a.projectId !== project.id || a.publicationStatus !== 'published') return false;
        const m = tourManifests.find((tm) => tm.id === a.tourAssetId || tm.apartmentId === a.id);
        return m?.captureStatus === 'published';
      });

      const projectGalleryItems: GalleryItem[] = [
        {
          id: `${project.id}-gal-1`,
          preset: project.visualPreset,
          imageUrl: project.heroImageUrl,
          title: `${project.name} — Primary Architectural Elevation`,
          caption: `${project.location} · ${project.coordinatesLabel || 'Verified Site Plan'}`,
          aspectLabel: '16:10 EXTERIOR ELEVATION PLATE',
        },
        {
          id: `${project.id}-gal-2`,
          preset: 'penthouse_interior',
          title: 'Living Salon & Panoramic Curtain Wall Study',
          caption: 'Honed Architectural Stone Slabs · 3.20m–3.80m Clear Ceiling Height',
          aspectLabel: '4:3 INTERIOR PERSPECTIVE STUDY',
        },
        {
          id: `${project.id}-gal-3`,
          preset: 'kitchen_atelier',
          title: 'Monolithic Kitchen Atelier & Custom Joinery',
          caption: 'Precision Architectural Joinery & Honed Stone Waterfall Island',
          aspectLabel: '4:3 MATERIAL & JOINERY PLATE',
        },
      ];

      return (
        <div className="max-w-[1380px] mx-auto px-6 py-10 space-y-16 arch-reveal">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="text-xs font-mono text-[#525866] flex items-center gap-2"
          >
            <button type="button" onClick={() => navigate('/projects')} className="hover:underline">
              Projects Directory
            </button>
            <span aria-hidden="true">→</span>
            <strong className="text-[#17191D]">{project.name}</strong>
          </nav>

          {/* 1. Asymmetric Project Introduction & Essential Facts Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-5 bg-white border border-[#E9EDF4] p-8 lg:p-10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#525866]">
                  <span>{project.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>Status: {project.completionStatus}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {project.isDemonstration ? 'Demonstration Project' : 'Verified Record'}
                  </span>
                </div>

                <h1 className="text-3xl lg:text-5xl font-semibold text-[#17191D] leading-tight">
                  {project.name}
                </h1>
                <p className="text-xs font-mono text-[#2855E8]">
                  {project.location} · {project.coordinatesLabel}
                </p>
                <p className="text-sm text-[#525866] leading-relaxed">{project.fullDescription}</p>

                {/* Essential Facts Grid */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-[#E9EDF4]/45 border border-[#E9EDF4] text-xs font-mono tabular-nums">
                  <div>
                    <div className="text-[#525866]">HANDOVER SCHEDULE</div>
                    <div className="text-sm font-semibold text-[#17191D] mt-0.5">
                      {project.estimatedHandover || 'Schedule Unconfirmed'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#525866]">PUBLISHED INVENTORY</div>
                    <div className="text-sm font-semibold text-[#17191D] mt-0.5">
                      {projBuildings.length} Bldg · {projApartments.length} Residences
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-4 border-t border-[#E9EDF4]">
                {primaryTourApt && (
                  <button
                    type="button"
                    onClick={() => navigate(`/tour/${primaryTourApt.id}`)}
                    className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4]"
                  >
                    Launch 3D Digital Twin (Unit {primaryTourApt.unitCode})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openInquiryModal(project.id, '', 'site_visit_request')}
                  className="px-5 py-2.5 text-xs font-medium bg-[#17191D] text-white hover:bg-[#2855E8]"
                >
                  Schedule Site Visit
                </button>
                {project.brochureTitle && (
                  <button
                    type="button"
                    onClick={() =>
                      setBrochureNotice(
                        `Architectural Dossier "${project.brochureTitle}" prepared. Request the full high-resolution CAD & specification package via the Inquiry desk or inspect the live unit tables below.`
                      )
                    }
                    className="px-4 py-2.5 text-xs font-medium border border-[#17191D] text-[#17191D] hover:bg-[#E9EDF4]"
                  >
                    Brochure &amp; Spec Sheet
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 min-h-[380px] lg:min-h-[480px] border border-[#E9EDF4]">
              <ArchitecturalVisual
                preset={project.visualPreset}
                imageUrl={project.heroImageUrl}
                alt={project.name}
                className="w-full h-full"
                caption={`${project.name} · ${project.location}`}
              />
            </div>
          </div>

          {brochureNotice && (
            <div
              role="status"
              className="p-4 bg-[#E9EDF4] border border-[#2855E8] text-xs text-[#17191D] flex items-center justify-between"
            >
              <span>{brochureNotice}</span>
              <button
                type="button"
                onClick={() => setBrochureNotice(null)}
                className="font-mono underline ml-4"
              >
                Close
              </button>
            </div>
          )}

          {/* 2. Multi-Ratio Architectural Gallery with Fullscreen Lightbox */}
          <ArchitecturalGallery
            items={projectGalleryItems}
            sectionLabel="01. ARCHITECTURAL MONOGRAPH GALLERY"
            heading={`Exterior Massing & Interior Studies — ${project.name}`}
          />

          {/* 3. Buildings & Estate Amenities Asymmetric Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-4 border-t border-[#E9EDF4]">
            <div className="lg:col-span-7 space-y-5">
              <div>
                <p className="text-xs font-mono text-[#2855E8]">02. ARCHITECTURAL BUILDINGS</p>
                <h2 className="text-2xl lg:text-3xl font-semibold text-[#17191D] mt-1">
                  Buildings Within {project.name}
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {projBuildings.map((bldg) => (
                  <div
                    key={bldg.id}
                    className="p-6 bg-white border border-[#E9EDF4] flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-[#2855E8] tabular-nums">
                        CODE: {bldg.code} · {bldg.confirmedFloors} FLOORS · {bldg.elevatorCount}{' '}
                        LIFTS
                      </div>
                      <h3 className="text-2xl font-semibold text-[#17191D]">{bldg.name}</h3>
                      <p className="text-xs text-[#525866] leading-relaxed">{bldg.overview}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${project.id}/buildings/${bldg.id}`)}
                      className="px-4 py-2 text-xs font-semibold bg-[#17191D] text-white hover:bg-[#2855E8] self-start arch-transition"
                    >
                      Explore Building &amp; Floors →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-5">
              <div>
                <p className="text-xs font-mono text-[#2855E8]">03. ESTATE INFRASTRUCTURE</p>
                <h2 className="text-2xl lg:text-3xl font-semibold text-[#17191D] mt-1">
                  Verified Amenities &amp; Site Context
                </h2>
              </div>
              <div className="p-7 bg-[#E9EDF4]/35 border border-[#E9EDF4] space-y-5">
                <ul className="space-y-3 text-sm text-[#17191D]">
                  {project.amenities.map((am) => (
                    <li key={am} className="flex items-start gap-2.5">
                      <span className="text-[#2855E8]">—</span>
                      <span>{am}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-[#E9EDF4] text-xs font-mono text-[#525866]">
                  LOCATION VERIFICATION:{' '}
                  {project.addressVerified
                    ? `Confirmed (${project.coordinatesLabel})`
                    : 'Preliminary Planning Zone (Exact Street Number Pending Municipal Approval)'}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Apartments & Unit Availability Schedule */}
          <section className="bg-white border border-[#E9EDF4] p-8 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E9EDF4] pb-5">
              <div>
                <p className="text-xs font-mono text-[#2855E8]">04. RESIDENCE SCHEDULE</p>
                <h2 className="text-2xl lg:text-3xl font-semibold text-[#17191D] mt-1">
                  Apartments &amp; Availability Ledger
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <select
                  aria-label="Filter by Building"
                  value={aptFilters.buildingId}
                  onChange={(e) =>
                    setAptFilters((prev) => ({ ...prev, buildingId: e.target.value }))
                  }
                  className="px-3.5 py-2 bg-[#E9EDF4]/50 border border-[#E9EDF4]"
                >
                  <option value="all">All Buildings</option>
                  {projBuildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Availability"
                  value={aptFilters.availabilityStatus}
                  onChange={(e) =>
                    setAptFilters((prev) => ({ ...prev, availabilityStatus: e.target.value }))
                  }
                  className="px-3.5 py-2 bg-[#E9EDF4]/50 border border-[#E9EDF4]"
                >
                  <option value="all">All Availability States</option>
                  <option value="available">Available Only</option>
                  <option value="reserved">Reserved</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-[#E9EDF4] font-mono text-[#525866]">
                    <th className="py-3.5 pr-4">UNIT CODE</th>
                    <th className="py-3.5 px-4">BUILDING &amp; FLOOR</th>
                    <th className="py-3.5 px-4">BED / BATH</th>
                    <th className="py-3.5 px-4">VERIFIED AREA</th>
                    <th className="py-3.5 px-4">PRICE</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4">3D DIGITAL TWIN</th>
                    <th className="py-3.5 pl-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9EDF4]">
                  {projApartments.map((apt) => {
                    const bldg = buildings.find((b) => b.id === apt.buildingId);
                    const fl = floors.find((f) => f.id === apt.floorId);
                    const manifest = tourManifests.find(
                      (m) => m.id === apt.tourAssetId || m.apartmentId === apt.id
                    );
                    const hasTour = manifest?.captureStatus === 'published';

                    return (
                      <tr key={apt.id} className="hover:bg-[#E9EDF4]/35 arch-transition">
                        <td className="py-4 pr-4 font-semibold text-sm text-[#17191D]">
                          {apt.unitCode}
                        </td>
                        <td className="py-4 px-4 text-[#525866]">
                          {bldg?.name} · Floor {fl?.floorNumber ?? '—'}
                        </td>
                        <td className="py-4 px-4">
                          {apt.bedrooms} Bed · {apt.bathrooms} Bath
                        </td>
                        <td className="py-4 px-4">{apt.areaSqm} sq.m</td>
                        <td className="py-4 px-4 font-medium">
                          {formatPriceDisplay(apt.priceStatus, apt.priceAmount, apt.currency)}
                        </td>
                        <td className="py-4 px-4 font-mono">
                          {apt.availabilityStatus.toUpperCase()}
                        </td>
                        <td className="py-4 px-4 font-mono">
                          {hasTour ? (
                            <span className="text-[#2855E8] font-semibold">Published</span>
                          ) : (
                            <span className="text-[#525866]">
                              {(manifest?.captureStatus || 'not_captured').replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>
                        <td className="py-4 pl-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => navigate(`/apartments/${apt.id}`)}
                            className="px-3.5 py-1.5 bg-[#17191D] text-white hover:bg-[#2855E8]"
                          >
                            View Unit
                          </button>
                          {hasTour && (
                            <button
                              type="button"
                              onClick={() => navigate(`/tour/${apt.id}`)}
                              className="px-3.5 py-1.5 bg-[#2855E8] text-white hover:bg-[#1E44C4]"
                            >
                              3D Tour
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      );
    }

    // =========================================================================
    // 5. APARTMENT DETAIL PAGE (`/apartments/:apartmentId`)
    //    Asymmetric 2-Column Layout with Persistent Sticky Residence Dossier
    // =========================================================================
    if (currentPath.startsWith('/apartments/')) {
      const aptId = currentPath.split('/')[2];
      const apartment = apartments.find(
        (a) => a.id === aptId && a.publicationStatus === 'published'
      );

      if (!apartment) {
        return (
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="p-8 bg-white border border-[#E9EDF4] space-y-4">
              <h1 className="text-2xl font-semibold">Apartment Record Unavailable</h1>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="px-4 py-2 text-xs bg-[#2855E8] text-white"
              >
                Return to Projects Directory
              </button>
            </div>
          </div>
        );
      }

      const project = projects.find((p) => p.id === apartment.projectId) || projects[0];
      const building = buildings.find((b) => b.id === apartment.buildingId) || buildings[0];
      const floor = floors.find((f) => f.id === apartment.floorId) || floors[0];
      const manifest = tourManifests.find(
        (m) => m.id === apartment.tourAssetId || m.apartmentId === apartment.id
      );
      const isTourLive = manifest?.captureStatus === 'published';
      const currentRoom = selectedAptRoom || apartment.rooms[0];
      const relatedApartments = apartments
        .filter((a) => a.projectId === project.id && a.id !== apartment.id && a.publicationStatus === 'published')
        .slice(0, 3);

      const aptGalleryItems: GalleryItem[] = [
        {
          id: `${apartment.id}-g1`,
          preset: apartment.visualPreset,
          imageUrl: apartment.imageUrl,
          title: `Residence ${apartment.unitCode} — Primary Living Salon`,
          caption: `${apartment.areaSqm} sq.m (${apartment.areaConvention}) · ${apartment.orientation}`,
          aspectLabel: '16:10 PRIMARY INTERIOR PERSPECTIVE',
        },
        {
          id: `${apartment.id}-g2`,
          preset: 'kitchen_atelier',
          title: 'Kitchen & Dining Atelier Study',
          caption: 'Custom Architectural Joinery & Honed Stone Countertops',
          aspectLabel: '4:3 ATELIER JOINERY STUDY',
        },
        {
          id: `${apartment.id}-g3`,
          preset: project.visualPreset,
          title: `${building.name} — Exterior Facade & Loggia Context`,
          caption: `${floor.label} · Ceiling Height ${floor.ceilingHeightMeters}m`,
          aspectLabel: '4:3 EXTERIOR BUILDING CONTEXT',
        },
      ];

      return (
        <div className="max-w-[1380px] mx-auto px-6 py-10 space-y-12 arch-reveal">
          {/* Persistent Hierarchical Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="text-xs font-mono text-[#525866] flex flex-wrap gap-2"
          >
            <button type="button" onClick={() => navigate('/projects')} className="hover:underline">
              Projects
            </button>
            <span aria-hidden="true">→</span>
            <button
              type="button"
              onClick={() => navigate(`/projects/${project.id}`)}
              className="hover:underline"
            >
              {project.name}
            </button>
            <span aria-hidden="true">→</span>
            <button
              type="button"
              onClick={() => navigate(`/projects/${project.id}/buildings/${building.id}`)}
              className="hover:underline"
            >
              {building.name}
            </button>
            <span aria-hidden="true">→</span>
            <span>{floor.label}</span>
            <span aria-hidden="true">→</span>
            <strong className="text-[#17191D]">Unit {apartment.unitCode}</strong>
          </nav>

          {/* Asymmetric 8:4 Split with Persistent Sticky Dossier Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left 8 Columns: Spatial Visuals, 2D Floor Plate, and Material Schedules */}
            <div className="lg:col-span-8 space-y-12">
              {/* Primary Hero Visual Plate with Instant 3D Launch Overlay */}
              <div className="relative min-h-[380px] lg:min-h-[460px] border border-[#E9EDF4] bg-[#17191D]">
                <ArchitecturalVisual
                  preset={apartment.visualPreset}
                  imageUrl={apartment.imageUrl}
                  alt={apartment.title}
                  className="w-full h-full"
                  caption={`${apartment.title} · ${apartment.areaSqm} sq.m · ${apartment.orientation}`}
                />
                <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                  <span className="px-3 py-1 text-xs font-mono bg-[#17191D]/90 text-white border border-white/15">
                    RESIDENCE {apartment.unitCode} · {floor.label.toUpperCase()}
                  </span>
                  {isTourLive && (
                    <button
                      type="button"
                      onClick={() => navigate(`/tour/${apartment.id}`)}
                      className="pointer-events-auto px-4 py-1.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] shadow-lg"
                    >
                      Enter Interactive 3D Tour →
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive 2D CAD Floor Plan & Room Dimension Inspector */}
              <InteractiveFloorPlan
                rooms={apartment.rooms}
                selectedRoomId={currentRoom?.id || apartment.rooms[0].id}
                onSelectRoom={(rm) => setSelectedAptRoom(rm)}
                unitCode={apartment.unitCode}
                areaSqm={apartment.areaSqm}
                areaConvention={apartment.areaConvention}
                onLaunch3DRoom={(rm) => navigate(`/tour/${apartment.id}`, rm.id)}
              />

              {/* Multi-Ratio Residence Gallery */}
              <ArchitecturalGallery
                items={aptGalleryItems}
                sectionLabel="ARCHITECTURAL & MATERIAL PLATES"
                heading={`Interior Perspectives — Unit ${apartment.unitCode}`}
              />

              {/* Materials & Asset Provenance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-7 bg-white border border-[#E9EDF4] space-y-4">
                  <div className="text-xs font-mono text-[#2855E8]">SPECIFICATION SCHEDULE</div>
                  <h2 className="text-2xl font-semibold text-[#17191D]">
                    Materials, Joinery &amp; Building Systems
                  </h2>
                  <ul className="space-y-2.5 text-sm text-[#17191D]">
                    {apartment.materialsAndFinishes.map((m) => (
                      <li key={m} className="flex items-start gap-2">
                        <span className="text-[#2855E8]">—</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-7 bg-white border border-[#E9EDF4] space-y-4">
                  <div className="text-xs font-mono text-[#2855E8]">3D DIGITAL TWIN MANIFEST</div>
                  <h2 className="text-2xl font-semibold text-[#17191D]">
                    Virtual Property Asset Status
                  </h2>
                  {manifest ? (
                    <div className="space-y-2.5 text-xs text-[#17191D]">
                      <div className="font-mono text-[#2855E8]">
                        PROVIDER: {manifest.provider.toUpperCase()} · STATUS:{' '}
                        {manifest.captureStatus.toUpperCase().replace(/_/g, ' ')}
                      </div>
                      <p className="leading-relaxed text-[#525866]">{manifest.reviewerNotes}</p>
                      <div className="font-mono text-[#525866] pt-2 border-t border-[#E9EDF4]">
                        STORAGE REF: {manifest.storageReference} · VERIFIED:{' '}
                        {manifest.lastVerificationDate}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#525866]">
                      No 3D tour asset manifest is currently linked to this residence.
                    </p>
                  )}
                </div>
              </div>

              {/* Related Residences within the Project */}
              {relatedApartments.length > 0 && (
                <div className="pt-4 border-t border-[#E9EDF4] space-y-4">
                  <div className="text-xs font-mono text-[#2855E8]">
                    RELATED RESIDENCES IN {project.name.toUpperCase()}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {relatedApartments.map((rel) => (
                      <div
                        key={rel.id}
                        onClick={() => navigate(`/apartments/${rel.id}`)}
                        className="cursor-pointer p-5 bg-[#E9EDF4]/35 hover:bg-[#E9EDF4] border border-[#E9EDF4] space-y-2 arch-transition"
                      >
                        <div className="text-xs font-mono text-[#525866] tabular-nums">
                          UNIT {rel.unitCode} · {rel.availabilityStatus.toUpperCase()}
                        </div>
                        <div className="text-lg font-display font-semibold text-[#17191D]">
                          {rel.title}
                        </div>
                        <div className="text-xs font-mono text-[#2855E8] tabular-nums">
                          {rel.bedrooms} Bed · {rel.areaSqm} m² ·{' '}
                          {formatPriceDisplay(rel.priceStatus, rel.priceAmount, rel.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right 4 Columns: Persistent Sticky Residence Dossier & Conversion Panel */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 bg-white border border-[#E9EDF4] p-7 lg:p-8 space-y-6">
              <div className="space-y-2 border-b border-[#E9EDF4] pb-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#525866]">
                  <span>UNIT {apartment.unitCode}</span>
                  <span aria-hidden="true">·</span>
                  <span>{apartment.apartmentType}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#2855E8] font-semibold">
                    {apartment.availabilityStatus.toUpperCase()}
                  </span>
                </div>
                <h1 className="text-3xl font-semibold text-[#17191D] leading-tight">
                  {apartment.title}
                </h1>
                <p className="text-xs font-mono text-[#525866]">
                  {project.name} · {building.name} · {floor.label}
                </p>
              </div>

              {/* Verified Price & Metric Matrix */}
              <div className="space-y-4">
                <div className="p-4 bg-[#E9EDF4]/55 border border-[#E9EDF4] flex items-baseline justify-between">
                  <span className="text-xs font-mono text-[#525866]">VERIFIED PRICE</span>
                  <span className="text-2xl font-display font-semibold text-[#17191D] tabular-nums">
                    {formatPriceDisplay(
                      apartment.priceStatus,
                      apartment.priceAmount,
                      apartment.currency
                    )}
                  </span>
                </div>

                <dl className="divide-y divide-[#E9EDF4] text-xs tabular-nums">
                  <div className="py-2.5 flex justify-between">
                    <dt className="font-mono text-[#525866]">VERIFIED INTERNAL AREA</dt>
                    <dd className="font-semibold text-[#17191D]">
                      {apartment.areaSqm} sq.m ({apartment.areaConvention})
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="font-mono text-[#525866]">EXTERIOR LOGGIA / TERRACE</dt>
                    <dd className="font-semibold text-[#17191D]">
                      {apartment.terraceAreaSqm ? `${apartment.terraceAreaSqm} sq.m` : 'None'}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="font-mono text-[#525866]">ACCOMMODATION</dt>
                    <dd className="font-semibold text-[#17191D]">
                      {apartment.bedrooms} Bedrooms · {apartment.bathrooms} Bathrooms
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="font-mono text-[#525866]">CLEAR CEILING HEIGHT</dt>
                    <dd className="font-semibold text-[#17191D]">{floor.ceilingHeightMeters}m</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="font-mono text-[#525866]">SOLAR ORIENTATION</dt>
                    <dd className="font-semibold text-[#17191D]">{apartment.orientation}</dd>
                  </div>
                </dl>
              </div>

              {/* Architectural Highlights */}
              <div className="space-y-2 pt-2 border-t border-[#E9EDF4]">
                <div className="text-xs font-mono text-[#525866]">KEY RESIDENCE SPECIFICATIONS</div>
                <ul className="space-y-1.5 text-xs text-[#17191D]">
                  {apartment.features.map((f) => (
                    <li key={f}>— {f}</li>
                  ))}
                </ul>
              </div>

              {/* Primary CTAs */}
              <div className="pt-4 border-t border-[#E9EDF4] space-y-2.5">
                {isTourLive ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/tour/${apartment.id}`)}
                    className="w-full px-5 py-3.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition whitespace-nowrap"
                  >
                    Launch Interactive 3D Virtual Tour
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/tour/${apartment.id}`)}
                    className="w-full px-4 py-3 text-xs font-medium bg-[#E9EDF4] border border-[#E9EDF4] text-[#17191D] hover:bg-[#DCE2EC]"
                  >
                    3D Tour Status:{' '}
                    {(manifest?.captureStatus || 'not_captured').replace(/_/g, ' ')} (View 2D Mode)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    openInquiryModal(project.id, apartment.id, 'site_visit_request')
                  }
                  className="w-full px-5 py-3 text-xs font-medium bg-[#17191D] text-white hover:bg-[#2855E8] arch-transition whitespace-nowrap"
                >
                  Schedule Private Site Visit
                </button>

                <button
                  type="button"
                  onClick={() => openInquiryModal(project.id, apartment.id, 'property_details')}
                  className="w-full px-4 py-3 text-xs font-medium border border-[#17191D] text-[#17191D] bg-white hover:bg-[#E9EDF4] arch-transition whitespace-nowrap"
                >
                  Inquire About Unit {apartment.unitCode}
                </button>
              </div>
            </aside>
          </div>
        </div>
      );
    }

    // =========================================================================
    // 6. ABOUT THE COMPANY & ARCHITECTURAL GOVERNANCE (`/about`)
    // =========================================================================
    if (currentPath === '/about') {
      return (
        <div className="max-w-[1380px] mx-auto px-6 py-14 space-y-14 arch-reveal">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end border-b border-[#E9EDF4] pb-10">
            <div className="lg:col-span-7 space-y-3">
              <p className="text-xs font-mono text-[#2855E8]">
                CORPORATE MONOGRAPH &amp; TECHNICAL ARCHITECTURE
              </p>
              <h1 className="text-4xl lg:text-5xl font-semibold text-[#17191D] leading-tight">
                Veridian Estates — Architectural Philosophy &amp; Platform Transparency
              </h1>
            </div>
            <p className="lg:col-span-5 text-sm text-[#525866] leading-relaxed">
              Veridian Estates develops low-density residential architecture across European urban
              and coastal sites. Our digital showroom is engineered around strict data provenance:
              we never present unverified measurements, fabricated testimonials, or unapproved 3D
              assets as factual property records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-[#E9EDF4]/35 border border-[#E9EDF4] space-y-3">
              <div className="text-xs font-mono text-[#2855E8]">01. ARCHITECTURAL INTEGRITY</div>
              <h2 className="text-2xl font-semibold text-[#17191D]">
                Material &amp; Acoustic Permanence
              </h2>
              <p className="text-sm text-[#525866] leading-relaxed">
                Every development prioritizes load-bearing natural stone, cross-laminated timber,
                geothermal climate regulation, and verified Net/Gross Internal Area measurements.
              </p>
            </div>
            <div className="p-8 bg-[#E9EDF4]/35 border border-[#E9EDF4] space-y-3">
              <div className="text-xs font-mono text-[#2855E8]">02. HYBRID 3D ARCHITECTURE</div>
              <h2 className="text-2xl font-semibold text-[#17191D]">
                Three.js Spatial Twin + Hosted Scan Adapter
              </h2>
              <p className="text-sm text-[#525866] leading-relaxed">
                Our modular 3D engine supports both procedural CAD/BIM Three.js residences with
                synchronized floor plans and external LiDAR digital twins (Matterport HTTPS embeds)
                governed by an approval manifest.
              </p>
            </div>
            <div className="p-8 bg-[#E9EDF4]/35 border border-[#E9EDF4] space-y-3">
              <div className="text-xs font-mono text-[#2855E8]">03. ZERO-TRUST SECURITY</div>
              <h2 className="text-2xl font-semibold text-[#17191D]">
                Cloud Firestore RBAC &amp; PII Isolation
              </h2>
              <p className="text-sm text-[#525866] leading-relaxed">
                Public visitors can only read published records and submit validated inquiries.
                Customer PII is strictly isolated to verified administrators via server-enforced
                Firestore security rules.
              </p>
            </div>
          </div>

          {/* Production Readiness & External Dependencies Matrix */}
          <div className="p-8 bg-white border border-[#E9EDF4] space-y-5">
            <h2 className="text-2xl font-semibold text-[#17191D]">
              Platform Implementation Status &amp; Production Dependencies
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E9EDF4] font-mono text-[#525866]">
                    <th className="py-3 pr-4">SYSTEM MODULE</th>
                    <th className="py-3 px-4">CURRENT IMPLEMENTATION STATE</th>
                    <th className="py-3 pl-4">REQUIRED FOR PRODUCTION CUTOVER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9EDF4]">
                  <tr>
                    <td className="py-3.5 pr-4 font-semibold">Database &amp; Security Rules</td>
                    <td className="py-3.5 px-4 text-[#2855E8]">
                      Live Cloud Firestore Provisioned &amp; Hardened Rules Deployed
                    </td>
                    <td className="py-3.5 pl-4 text-[#525866]">
                      Assign production staff UIDs in `/admins` collection
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 pr-4 font-semibold">3D Virtual Property Viewer</td>
                    <td className="py-3.5 px-4 text-[#2855E8]">
                      Live Three.js Multi-Room &amp; Dollhouse Engine + Hosted Scan Adapter
                    </td>
                    <td className="py-3.5 pl-4 text-[#525866]">
                      On-site Matterport Pro3 / LiDAR capture &amp; CDN GLB hosting for real units
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 pr-4 font-semibold">Property Records</td>
                    <td className="py-3.5 px-4 text-[#17191D]">
                      Clearly Labeled Demonstration Projects, Buildings, Floors &amp; Units
                    </td>
                    <td className="py-3.5 pl-4 text-[#525866]">
                      Replace demonstration records with verified surveyor schedules &amp; legal
                      pricing
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 pr-4 font-semibold">
                      Inquiry &amp; Site Visit Lead Workflow
                    </td>
                    <td className="py-3.5 px-4 text-[#2855E8]">
                      End-to-End Form Validation, Firestore Persistence &amp; Admin Lead Queue
                    </td>
                    <td className="py-3.5 pl-4 text-[#525866]">
                      Configure transactional email SMTP/API key for automated email alerts
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    // =========================================================================
    // 7. CONTACT & CONSULTATION PAGE (`/contact`)
    // =========================================================================
    if (currentPath === '/contact') {
      return (
        <div className="max-w-[1380px] mx-auto px-6 py-14 arch-reveal">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5 space-y-6">
              <p className="text-xs font-mono text-[#2855E8]">DIRECT CONSULTATION DESK</p>
              <h1 className="text-4xl lg:text-5xl font-semibold text-[#17191D] leading-tight">
                Inquire or Schedule an Architectural Viewing
              </h1>
              <p className="text-sm text-[#525866] leading-relaxed">
                Speak with our development advisors regarding available residences, bespoke
                floor-plate configurations, or private on-site appointments.
              </p>

              <div className="p-7 bg-[#E9EDF4]/45 border border-[#E9EDF4] space-y-4 text-xs">
                <div>
                  <div className="font-mono text-[#525866]">GENEVA GALLERY &amp; HEADQUARTERS</div>
                  <div className="font-semibold text-[#17191D] mt-0.5">
                    Rue du Rhône 42, 1204 Genève, Switzerland
                  </div>
                </div>
                <div className="pt-3 border-t border-[#E9EDF4]">
                  <div className="font-mono text-[#525866]">ADVISORY HOURS</div>
                  <div className="font-semibold text-[#17191D] mt-0.5">
                    Monday – Saturday · 09:00 – 18:30 CET (By Appointment)
                  </div>
                </div>
                <div className="pt-3 border-t border-[#E9EDF4]">
                  <div className="font-mono text-[#525866]">TELEPHONE &amp; DIRECT DESK</div>
                  <div className="font-semibold text-[#17191D] mt-0.5 tabular-nums">
                    +41 22 819 40 00 · advisory@veridian-estates.example
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-[#E9EDF4] p-8 lg:p-10">
              <InquiryFormSection
                projects={projects}
                apartments={apartments}
                onInquiryCreated={handleInquiryCreated}
              />
            </div>
          </div>
        </div>
      );
    }

    // =========================================================================
    // 8. ADMIN DASHBOARD (`/admin`)
    // =========================================================================
    if (currentPath === '/admin') {
      return (
        <AdminDashboard
          currentUser={currentUser}
          projects={projects}
          buildings={buildings}
          floors={floors}
          apartments={apartments}
          tourManifests={tourManifests}
          inquiries={inquiries}
          onUpdateProjects={setProjects}
          onUpdateBuildings={setBuildings}
          onUpdateFloors={setFloors}
          onUpdateApartments={setApartments}
          onUpdateTourManifests={setTourManifests}
          onUpdateInquiries={setInquiries}
          onNavigatePublic={navigate}
        />
      );
    }

    // =========================================================================
    // 9. SUPPORTING LEGAL PAGES (`/privacy`, `/terms`, `/cookies`)
    // =========================================================================
    if (currentPath === '/privacy' || currentPath === '/terms' || currentPath === '/cookies') {
      return (
        <div className="max-w-4xl mx-auto px-6 py-14 space-y-6 arch-reveal">
          <div className="p-8 bg-white border border-[#E9EDF4] space-y-4">
            <div className="text-xs font-mono text-[#2855E8]">
              LEGAL &amp; PRIVACY DOCUMENTATION (REQUIRES COUNSEL REVIEW PRIOR TO PRODUCTION)
            </div>
            <h1 className="text-3xl font-semibold text-[#17191D]">
              {currentPath === '/privacy' && 'Privacy Policy & Customer Inquiry Data Protection'}
              {currentPath === '/terms' && 'Terms & Conditions of Digital Showroom Use'}
              {currentPath === '/cookies' && 'Cookie & Local Storage Preferences'}
            </h1>
            <p className="text-sm text-[#525866] leading-relaxed">
              Veridian Estates collects only the personal contact information explicitly submitted
              through our Property Inquiry and Site Visit Request forms (`customerName`,
              `customerEmail`, `customerPhone`, and inquiry message). Submitted records are stored
              in Cloud Firestore under strict PII isolation rules (`allow get, list: if isAdmin()`)
              so that public visitors can never read or enumerate customer inquiries.
            </p>
            <p className="text-sm text-[#525866] leading-relaxed">
              All architectural floor plans, 3D digital twins, and prices labeled as Demonstration
              Records are illustrative and do not constitute a binding contractual offer. Final
              legal text must be reviewed by qualified real estate counsel in the applicable
              jurisdiction prior to commercial launch.
            </p>
          </div>
        </div>
      );
    }

    // =========================================================================
    // 10. CUSTOM 404 PAGE
    // =========================================================================
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-5">
        <div className="text-xs font-mono text-[#2855E8]">HTTP 404 · ROUTE NOT FOUND</div>
        <h1 className="text-4xl font-semibold text-[#17191D]">
          The Requested Architectural Page Could Not Be Located
        </h1>
        <p className="text-sm text-[#525866]">
          Verify the URL or return to the published residential developments directory.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 text-xs font-semibold bg-[#2855E8] text-white"
          >
            Return to Homepage
          </button>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="px-5 py-2.5 text-xs font-medium border border-[#17191D] text-[#17191D]"
          >
            Browse Projects
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#17191D]">
      {/* Strict 3-Zone Top Bar Contract on Pure White (#FFFFFF) with Cool Grey (#E9EDF4) border */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-4 bg-white/95 backdrop-blur-md border-b border-[#E9EDF4]">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="text-2xl font-bold tracking-tight text-[#17191D] font-display whitespace-nowrap shrink-0"
        >
          Veridian Estates
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-[#525866]"
        >
          <a
            href="/projects"
            onClick={(e) => {
              e.preventDefault();
              navigate('/projects');
            }}
            className={`hover:text-[#17191D] arch-transition whitespace-nowrap shrink-0 ${
              currentPath.startsWith('/projects')
                ? 'text-[#2855E8] underline underline-offset-4'
                : ''
            }`}
          >
            Projects
          </a>
          <a
            href="/tour/apt-n401"
            onClick={(e) => {
              e.preventDefault();
              navigate('/tour/apt-n401');
            }}
            className="hover:text-[#17191D] arch-transition whitespace-nowrap shrink-0"
          >
            3D Showroom
          </a>
          <a
            href="/about"
            onClick={(e) => {
              e.preventDefault();
              navigate('/about');
            }}
            className={`hover:text-[#17191D] arch-transition whitespace-nowrap shrink-0 ${
              currentPath === '/about' ? 'text-[#2855E8] underline underline-offset-4' : ''
            }`}
          >
            About
          </a>
          <a
            href="/contact"
            onClick={(e) => {
              e.preventDefault();
              navigate('/contact');
            }}
            className={`hover:text-[#17191D] arch-transition whitespace-nowrap shrink-0 ${
              currentPath === '/contact' ? 'text-[#2855E8] underline underline-offset-4' : ''
            }`}
          >
            Contact
          </a>
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              navigate('/admin');
            }}
            className={`hover:text-[#17191D] arch-transition whitespace-nowrap shrink-0 ${
              currentPath === '/admin' ? 'text-[#2855E8] underline underline-offset-4' : ''
            }`}
          >
            Admin CMS
          </a>
        </nav>

        {/* Zone 3: 1 primary action in Cobalt Blue (#2855E8) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() =>
              openInquiryModal('proj-veridian-pavilion', 'apt-n401', 'site_visit_request')
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-[#2855E8] hover:bg-[#1E44C4] arch-transition whitespace-nowrap shrink-0"
          >
            Schedule Viewing
          </button>
        </div>
      </header>

      {/* Compact Mobile Navigation Row */}
      <nav
        aria-label="Mobile Navigation"
        className="flex md:hidden items-center justify-around px-4 py-2 bg-[#E9EDF4]/65 border-b border-[#E9EDF4] text-xs font-medium overflow-x-auto"
      >
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="px-2 py-1 whitespace-nowrap"
        >
          Projects
        </button>
        <button
          type="button"
          onClick={() => navigate('/tour/apt-n401')}
          className="px-2 py-1 whitespace-nowrap"
        >
          3D Tour
        </button>
        <button
          type="button"
          onClick={() => navigate('/about')}
          className="px-2 py-1 whitespace-nowrap"
        >
          About
        </button>
        <button
          type="button"
          onClick={() => navigate('/contact')}
          className="px-2 py-1 whitespace-nowrap"
        >
          Contact
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="px-2 py-1 whitespace-nowrap"
        >
          Admin
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1">{renderMainContent()}</main>

      {/* Inquiry / Site Visit Modal */}
      {inquiryModal.open && (
        <div
          className="fixed inset-0 z-50 bg-[#17191D]/75 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-2xl w-full bg-white border border-[#E9EDF4] p-6 lg:p-8 shadow-2xl my-8">
            <InquiryFormSection
              projects={projects}
              apartments={apartments}
              initialProjectId={inquiryModal.projectId}
              initialApartmentId={inquiryModal.apartmentId}
              initialInquiryType={inquiryModal.inquiryType}
              onInquiryCreated={handleInquiryCreated}
              onClose={() => setInquiryModal((prev) => ({ ...prev, open: false }))}
              isModal={true}
            />
          </div>
        </div>
      )}

      {/* High-Contrast Contemporary Luxury Footer in Near Black (#17191D) */}
      <footer className="bg-[#17191D] text-[#9BA3B4] border-t border-white/10 mt-16">
        <div className="max-w-[1380px] mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-4 gap-10 text-xs">
          <div className="space-y-3">
            <div className="text-2xl font-bold text-white font-display">Veridian Estates</div>
            <p className="leading-relaxed">
              Contemporary luxury real estate development &amp; interactive 3D digital showroom
              across Geneva, Porto Cervo, and London.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="font-mono text-white">PORTFOLIO NAVIGATION</div>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="hover:text-white arch-transition"
                >
                  Published Projects Directory
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/projects/proj-veridian-pavilion')}
                  className="hover:text-white arch-transition"
                >
                  The Veridian Pavilion (Geneva)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/apartments/apt-n401')}
                  className="hover:text-white arch-transition"
                >
                  Residence N-401 Dossier
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/tour/apt-n401')}
                  className="hover:text-white arch-transition"
                >
                  Interactive 3D Virtual Tour
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <div className="font-mono text-white">CORPORATE &amp; GOVERNANCE</div>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/about')}
                  className="hover:text-white arch-transition"
                >
                  About Veridian Estates
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/contact')}
                  className="hover:text-white arch-transition"
                >
                  Contact &amp; Site Visits
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="hover:text-white arch-transition"
                >
                  Administration &amp; CMS
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <div className="font-mono text-white">LEGAL &amp; COMPLIANCE</div>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/privacy')}
                  className="hover:text-white arch-transition"
                >
                  Privacy Notice
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/terms')}
                  className="hover:text-white arch-transition"
                >
                  Terms &amp; Conditions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/cookies')}
                  className="hover:text-white arch-transition"
                >
                  Cookie Preferences
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-4 text-xs font-mono text-[#9BA3B4]">
          <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <span>© 2026 Veridian Estates Development Group. All rights reserved.</span>
            <span>Demonstration Records Clearly Labeled · Verified Cloud Firestore Security</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
