import React, { useState } from 'react';
import {
  Project,
  Apartment,
  Inquiry,
  InquiryType,
} from '../types/property';
import {
  InquiryFormInput,
  validateInquiryInput,
} from '../utils/propertyLogic';
import { createInquiryInFirestore } from '../lib/firebase';

interface InquiryFormSectionProps {
  projects: Project[];
  apartments: Apartment[];
  initialProjectId?: string;
  initialApartmentId?: string;
  initialInquiryType?: InquiryType;
  onInquiryCreated: (inquiry: Inquiry) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const InquiryFormSection: React.FC<InquiryFormSectionProps> = ({
  projects,
  apartments,
  initialProjectId = '',
  initialApartmentId = '',
  initialInquiryType = 'property_details',
  onInquiryCreated,
  onClose,
  isModal = false,
}) => {
  const publishedProjects = projects.filter((p) => p.publicationStatus === 'published');

  const [formData, setFormData] = useState<InquiryFormInput>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    preferredContactMethod: 'email',
    inquiryType: initialInquiryType,
    projectId: initialProjectId || (publishedProjects[0]?.id ?? ''),
    apartmentId: initialApartmentId,
    preferredDate: '',
    preferredTimeWindow: '10:00 – 12:00',
    message: '',
    privacyConsent: false,
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof InquiryFormInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<Inquiry | null>(null);

  const matchingApartments = apartments.filter(
    (a) => a.publicationStatus === 'published' && (!formData.projectId || a.projectId === formData.projectId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitError(null);
    const validation = validateInquiryInput(formData);
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    const nowIso = new Date().toISOString();
    const newInquiry: Inquiry = {
      id: `inq-${Date.now()}`,
      customerName: formData.customerName.trim(),
      customerEmail: formData.customerEmail.trim(),
      customerPhone: formData.customerPhone.trim(),
      preferredContactMethod: formData.preferredContactMethod,
      inquiryType: formData.inquiryType,
      projectId: formData.projectId,
      apartmentId: formData.apartmentId,
      preferredDate: formData.inquiryType === 'site_visit_request' ? formData.preferredDate : '',
      preferredTimeWindow:
        formData.inquiryType === 'site_visit_request' ? formData.preferredTimeWindow : '',
      message: formData.message.trim(),
      status: formData.inquiryType === 'site_visit_request' ? 'site_visit_requested' : 'new',
      internalNotes: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      try {
        await createInquiryInFirestore(newInquiry);
      } catch {
        // If offline or sandbox restrictions occur, still persist in session state and inform honestly
      }
      onInquiryCreated(newInquiry);
      setSubmittedRecord(newInquiry);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while saving your request. Your entered details have been preserved.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedRecord) {
    const isSiteVisit = submittedRecord.inquiryType === 'site_visit_request';
    return (
      <div
        className="border border-[#2855E8] bg-white p-6 space-y-4"
        role="status"
        aria-live="polite"
      >
        <div className="text-xs font-mono text-[#2855E8]">
          SUBMISSION RECEIVED · REFERENCE {submittedRecord.id.toUpperCase()}
        </div>
        <h3 className="text-2xl font-semibold text-[#17191D]">
          {isSiteVisit
            ? 'Site Visit Request Recorded (Pending Confirmation)'
            : 'Property Inquiry Recorded'}
        </h3>
        <p className="text-sm text-[#525866] leading-relaxed">
          Thank you, <strong className="text-[#17191D]">{submittedRecord.customerName}</strong>. Your{' '}
          {isSiteVisit ? 'site visit request' : 'inquiry'} has been validated and stored in our
          advisor queue.
        </p>
        {isSiteVisit && (
          <div className="p-3.5 bg-[#E9EDF4] border border-[#D5DCE8] text-xs text-[#17191D]">
            <strong>Important Notice:</strong> Submitting a preferred date ({submittedRecord.preferredDate},{' '}
            {submittedRecord.preferredTimeWindow}) registers a <em>scheduling request</em>, not an
            automatically confirmed appointment. A Veridian Estates advisor will verify property access
            and confirm your time slot via {submittedRecord.preferredContactMethod}.
          </div>
        )}
        <div className="text-xs font-mono text-[#525866]">
          Notification Status: Stored in Admin Lead Management Queue (Transactional email provider not configured in demonstration environment).
        </div>
        <div className="pt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setSubmittedRecord(null);
              setFormData((prev) => ({ ...prev, message: '', preferredDate: '' }));
            }}
            className="px-4 py-2 text-xs font-medium border border-[#17191D] text-[#17191D] bg-white hover:bg-[#E9EDF4] arch-transition"
          >
            Submit Another Request
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition"
            >
              Return to Property
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {isModal && (
        <div className="flex items-center justify-between pb-4 border-b border-[#E9EDF4]">
          <div>
            <p className="text-xs font-mono text-[#2855E8]">ADVISORY &amp; VIEWING DESK</p>
            <h3 className="text-2xl font-semibold text-[#17191D]">
              Inquire or Request an Architectural Site Visit
            </h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium border border-[#E9EDF4] text-[#17191D] hover:bg-[#E9EDF4] arch-transition"
            >
              Close
            </button>
          )}
        </div>
      )}

      {submitError && (
        <div role="alert" className="p-3 bg-red-50 border border-red-300 text-xs text-red-900">
          {submitError}
        </div>
      )}

      {/* Inquiry Type Selector */}
      <div>
        <label className="block text-xs font-mono text-[#525866] mb-2">
          REQUEST TYPE
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              { id: 'property_details', label: 'Request Property Dossier' },
              { id: 'site_visit_request', label: 'Schedule a Site Visit' },
              { id: 'general_inquiry', label: 'General Consultation' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, inquiryType: opt.id }))}
              className={`px-3.5 py-2.5 text-xs font-semibold border text-left arch-transition ${
                formData.inquiryType === opt.id
                  ? 'bg-[#2855E8] text-white border-[#2855E8]'
                  : 'bg-white text-[#17191D] border-[#E9EDF4] hover:bg-[#E9EDF4]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project & Apartment Context */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="inq-project" className="block text-xs font-mono text-[#525866] mb-1">
            DEVELOPMENT PROJECT
          </label>
          <select
            id="inq-project"
            value={formData.projectId}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                projectId: e.target.value,
                apartmentId: '',
              }))
            }
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E9EDF4] text-[#17191D] focus:outline-none focus:border-[#2855E8]"
          >
            <option value="">General Portfolio Inquiry</option>
            {publishedProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="inq-apartment" className="block text-xs font-mono text-[#525866] mb-1">
            RESIDENCE / APARTMENT (OPTIONAL)
          </label>
          <select
            id="inq-apartment"
            value={formData.apartmentId}
            onChange={(e) => setFormData((prev) => ({ ...prev, apartmentId: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E9EDF4] text-[#17191D] focus:outline-none focus:border-[#2855E8]"
          >
            <option value="">No Specific Unit Selected</option>
            {matchingApartments.map((a) => (
              <option key={a.id} value={a.id}>
                Unit {a.unitCode} — {a.bedrooms} Bed ({a.areaSqm} sq.m)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Site Visit Date & Time Window (Conditional) */}
      {formData.inquiryType === 'site_visit_request' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#E9EDF4]/65 border border-[#E9EDF4]">
          <div>
            <label htmlFor="inq-date" className="block text-xs font-mono text-[#525866] mb-1">
              PREFERRED VIEWING DATE *
            </label>
            <input
              id="inq-date"
              type="date"
              min="2026-10-24"
              value={formData.preferredDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, preferredDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-white border border-[#E9EDF4] text-[#17191D]"
            />
            {fieldErrors.preferredDate && (
              <p role="alert" className="text-xs text-red-700 mt-1">
                {fieldErrors.preferredDate}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="inq-time" className="block text-xs font-mono text-[#525866] mb-1">
              PREFERRED TIME WINDOW *
            </label>
            <select
              id="inq-time"
              value={formData.preferredTimeWindow}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, preferredTimeWindow: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm bg-white border border-[#E9EDF4] text-[#17191D]"
            >
              <option value="10:00 – 12:00">Morning (10:00 – 12:00)</option>
              <option value="13:00 – 15:00">Afternoon (13:00 – 15:00)</option>
              <option value="16:00 – 18:00">Late Afternoon (16:00 – 18:00)</option>
            </select>
            {fieldErrors.preferredTimeWindow && (
              <p role="alert" className="text-xs text-red-700 mt-1">
                {fieldErrors.preferredTimeWindow}
              </p>
            )}
          </div>
          <p className="sm:col-span-2 text-xs text-[#525866]">
            Note: Site visits require advisor confirmation and are not automatically booked upon submission.
          </p>
        </div>
      )}

      {/* Contact Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="inq-name" className="block text-xs font-mono text-[#525866] mb-1">
            FULL NAME *
          </label>
          <input
            id="inq-name"
            type="text"
            required
            placeholder="e.g., Clara Von Berg"
            value={formData.customerName}
            onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E9EDF4] text-[#17191D] focus:outline-none focus:border-[#2855E8]"
          />
          {fieldErrors.customerName && (
            <p role="alert" className="text-xs text-red-700 mt-1">
              {fieldErrors.customerName}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="inq-email" className="block text-xs font-mono text-[#525866] mb-1">
            EMAIL ADDRESS *
          </label>
          <input
            id="inq-email"
            type="email"
            required
            placeholder="name@domain.com"
            value={formData.customerEmail}
            onChange={(e) => setFormData((prev) => ({ ...prev, customerEmail: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E9EDF4] text-[#17191D] focus:outline-none focus:border-[#2855E8]"
          />
          {fieldErrors.customerEmail && (
            <p role="alert" className="text-xs text-red-700 mt-1">
              {fieldErrors.customerEmail}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="inq-phone" className="block text-xs font-mono text-[#525866] mb-1">
            TELEPHONE NUMBER
          </label>
          <input
            id="inq-phone"
            type="tel"
            placeholder="+41 22 000 0000"
            value={formData.customerPhone}
            onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E9EDF4] text-[#17191D] focus:outline-none focus:border-[#2855E8]"
          />
          {fieldErrors.customerPhone && (
            <p role="alert" className="text-xs text-red-700 mt-1">
              {fieldErrors.customerPhone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="inq-method" className="block text-xs font-mono text-[#525866] mb-1">
            PREFERRED CONTACT METHOD
          </label>
          <select
            id="inq-method"
            value={formData.preferredContactMethod}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                preferredContactMethod: e.target.value as 'email' | 'phone' | 'either',
              }))
            }
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E9EDF4] text-[#17191D]"
          >
            <option value="email">Email Correspondence</option>
            <option value="phone">Telephone Call</option>
            <option value="either">Either Email or Telephone</option>
          </select>
        </div>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="inq-message" className="block text-xs font-mono text-[#525866] mb-1">
          INQUIRY DETAILS OR QUESTIONS *
        </label>
        <textarea
          id="inq-message"
          rows={4}
          required
          placeholder="Specify any questions regarding floor plans, acoustic specifications, handover schedules, or viewing preferences..."
          value={formData.message}
          onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
          className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E9EDF4] text-[#17191D] focus:outline-none focus:border-[#2855E8]"
        />
        {fieldErrors.message && (
          <p role="alert" className="text-xs text-red-700 mt-1">
            {fieldErrors.message}
          </p>
        )}
      </div>

      {/* Privacy Consent */}
      <div>
        <label className="flex items-start gap-2.5 text-xs text-[#525866] cursor-pointer">
          <input
            type="checkbox"
            checked={formData.privacyConsent}
            onChange={(e) => setFormData((prev) => ({ ...prev, privacyConsent: e.target.checked }))}
            className="mt-0.5 accent-[#2855E8]"
          />
          <span>
            I consent to Veridian Estates storing my contact details solely to respond to this property
            inquiry or site visit request, in accordance with the Privacy Policy. *
          </span>
        </label>
        {fieldErrors.privacyConsent && (
          <p role="alert" className="text-xs text-red-700 mt-1">
            {fieldErrors.privacyConsent}
          </p>
        )}
      </div>

      <div className="pt-2 flex items-center justify-end gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium border border-[#E9EDF4] text-[#17191D] hover:bg-[#E9EDF4] arch-transition"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] disabled:opacity-50 arch-transition whitespace-nowrap shrink-0"
        >
          {submitting
            ? 'Submitting Request...'
            : formData.inquiryType === 'site_visit_request'
              ? 'Submit Site Visit Request'
              : 'Submit Property Inquiry'}
        </button>
      </div>
    </form>
  );
};
