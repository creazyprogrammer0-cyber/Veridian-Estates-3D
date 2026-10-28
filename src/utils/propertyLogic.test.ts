import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPublicProjects,
  filterPublicApartments,
  formatPriceDisplay,
  validateEntityRelationships,
  validateExternalTourUrl,
  validateInquiryInput,
  computeDashboardMetrics,
} from './propertyLogic';
import {
  DEMO_PROJECTS,
  DEMO_BUILDINGS,
  DEMO_FLOORS,
  DEMO_APARTMENTS,
  DEMO_TOUR_MANIFESTS,
  DEMO_INQUIRIES,
} from '../data/demoSeedData';

test('filterPublicProjects strictly excludes draft/unpublished projects', () => {
  const results = filterPublicProjects(DEMO_PROJECTS, DEMO_APARTMENTS, DEMO_TOUR_MANIFESTS, {
    search: '',
    location: 'all',
    completionStatus: 'all',
    onlyWithAvailableUnits: false,
    onlyWithPublished3DTour: false,
  });

  // DEMO_PROJECTS has 4 projects, 1 of which is 'proj-zurich-draft' (draft)
  assert.equal(results.length, 3);
  assert.equal(
    results.some((p) => p.id === 'proj-zurich-draft'),
    false,
    'Unpublished draft project must never appear in public results'
  );
});

test('filterPublicProjects filters by published 3D tour availability accurately', () => {
  const results = filterPublicProjects(DEMO_PROJECTS, DEMO_APARTMENTS, DEMO_TOUR_MANIFESTS, {
    search: '',
    location: 'all',
    completionStatus: 'all',
    onlyWithAvailableUnits: false,
    onlyWithPublished3DTour: true,
  });

  // Veridian Pavilion and Solaris Terrace have published 3D tours; Kensington Cloister does not
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((r) => r.id),
    ['proj-veridian-pavilion', 'proj-solaris-terrace']
  );
});

test('filterPublicApartments filters by building, bedrooms, and 3D tour status', () => {
  const results = filterPublicApartments(DEMO_APARTMENTS, DEMO_TOUR_MANIFESTS, {
    projectId: 'proj-veridian-pavilion',
    buildingId: 'bldg-north-wing',
    floorId: 'all',
    minBedrooms: 3,
    availabilityStatus: 'available',
    maxPrice: 0,
    onlyWith3DTour: true,
  });

  // N-401 (3 bed) and N-601-PH (4 bed) both match
  assert.equal(results.length, 2);
});

test('formatPriceDisplay never fabricates missing or unconfirmed prices', () => {
  assert.equal(formatPriceDisplay('published', 3450000, 'EUR'), '€3,450,000');
  assert.equal(formatPriceDisplay('price_on_request', 0, 'EUR'), 'Price on Request');
  assert.equal(formatPriceDisplay('unconfirmed', 0, 'GBP'), 'Pricing Unconfirmed');
});

test('validateEntityRelationships verifies seed hierarchy and catches orphaned records', () => {
  const validCheck = validateEntityRelationships({
    projects: DEMO_PROJECTS,
    buildings: DEMO_BUILDINGS,
    floors: DEMO_FLOORS,
    apartments: DEMO_APARTMENTS,
    tourManifests: DEMO_TOUR_MANIFESTS,
  });
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.errors.length, 0);

  // Inject an apartment referencing a nonexistent floor
  const brokenCheck = validateEntityRelationships({
    projects: DEMO_PROJECTS,
    buildings: DEMO_BUILDINGS,
    floors: DEMO_FLOORS,
    apartments: [
      ...DEMO_APARTMENTS,
      {
        ...DEMO_APARTMENTS[0],
        id: 'apt-orphan',
        floorId: 'fl-nonexistent-999',
      },
    ],
    tourManifests: DEMO_TOUR_MANIFESTS,
  });
  assert.equal(brokenCheck.valid, false);
  assert.ok(brokenCheck.errors[0].includes('non-existent floor'));
});

test('validateExternalTourUrl blocks non-HTTPS and unauthorized Matterport hosts', () => {
  assert.equal(validateExternalTourUrl('', 'threejs_architectural_twin').valid, true);
  assert.equal(validateExternalTourUrl('http://my.matterport.com/show/?m=123', 'matterport_embed').valid, false);
  assert.equal(validateExternalTourUrl('https://evil.example.com/show/?m=123', 'matterport_embed').valid, false);
  assert.equal(validateExternalTourUrl('https://my.matterport.com/show/?m=123', 'matterport_embed').valid, true);
});

test('validateInquiryInput enforces required fields, site visit dates, and privacy consent', () => {
  const invalidSiteVisit = validateInquiryInput({
    customerName: 'A',
    customerEmail: 'not-an-email',
    customerPhone: '',
    preferredContactMethod: 'phone',
    inquiryType: 'site_visit_request',
    projectId: 'proj-veridian-pavilion',
    apartmentId: 'apt-n401',
    preferredDate: '',
    preferredTimeWindow: '',
    message: 'Hi',
    privacyConsent: false,
  });

  assert.equal(invalidSiteVisit.valid, false);
  assert.ok(invalidSiteVisit.fieldErrors.customerName);
  assert.ok(invalidSiteVisit.fieldErrors.customerEmail);
  assert.ok(invalidSiteVisit.fieldErrors.customerPhone);
  assert.ok(invalidSiteVisit.fieldErrors.preferredDate);
  assert.ok(invalidSiteVisit.fieldErrors.preferredTimeWindow);
  assert.ok(invalidSiteVisit.fieldErrors.message);
  assert.ok(invalidSiteVisit.fieldErrors.privacyConsent);

  const validSiteVisit = validateInquiryInput({
    customerName: 'Elena Rostova',
    customerEmail: 'elena@rostova.ch',
    customerPhone: '+41 22 819 0000',
    preferredContactMethod: 'email',
    inquiryType: 'site_visit_request',
    projectId: 'proj-veridian-pavilion',
    apartmentId: 'apt-n401',
    preferredDate: '2026-11-15',
    preferredTimeWindow: '14:00 – 16:00 CET',
    message: 'We would like to request a private architectural tour of Residence N-401.',
    privacyConsent: true,
  });

  assert.equal(validSiteVisit.valid, true);
  assert.equal(Object.keys(validSiteVisit.fieldErrors).length, 0);
});

test('computeDashboardMetrics calculates live operational counts from state', () => {
  const metrics = computeDashboardMetrics({
    projects: DEMO_PROJECTS,
    buildings: DEMO_BUILDINGS,
    floors: DEMO_FLOORS,
    apartments: DEMO_APARTMENTS,
    tourManifests: DEMO_TOUR_MANIFESTS,
    inquiries: DEMO_INQUIRIES,
  });

  assert.equal(metrics.totalProjects, 4);
  assert.equal(metrics.publishedProjects, 3);
  assert.equal(metrics.draftProjects, 1);
  assert.equal(metrics.publishedTours, 3);
  assert.equal(metrics.pendingSiteVisits, 1);
});
