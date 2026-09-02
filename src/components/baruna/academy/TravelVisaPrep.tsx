import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  FileText,
  Download,
  Plane,
  Car,
  Hotel,
  PlaneTakeoff,
  Shirt,
  HeartPulse,
  Utensils,
  PhoneCall,
  ClipboardCheck,
  CheckCircle2,
  Circle,
  MapPin,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import { DocumentUploadRow } from "@/components/baruna/academy/DocumentUploadRow";
import { downloadPdf, barunaToast } from "@/lib/downloads";
import {
  type Application,
  type TravelPrep,
  getTravel,
  updateTravel,
  prepSteps,
  prepProgress,
  VISA_STATUSES,
  PICKUP_STATUSES,
  ARRIVAL_AIRPORTS,
  SPECIAL_REQUESTS,
  MEDICAL_CONDITIONS,
  DIETARY_PREFERENCES,
  FOOD_ALLERGIES,
  FIT_PREFERENCES,
  type DocumentMeta,
  type VisaStatus,
  type PickupStatus,
} from "@/lib/application";

const EMERGENCY_HOTLINE = "+62 361 000 0000";

const TSHIRT_SIZES = [
  { size: "XS", chest: "86–91 cm", height: "155–165 cm", weight: "45–60 kg" },
  { size: "S", chest: "91–97 cm", height: "165–170 cm", weight: "55–70 kg" },
  { size: "M", chest: "97–102 cm", height: "170–175 cm", weight: "65–80 kg" },
  { size: "L", chest: "102–107 cm", height: "175–180 cm", weight: "75–90 kg" },
  { size: "XL", chest: "107–112 cm", height: "180–185 cm", weight: "85–100 kg" },
  { size: "2XL", chest: "112–122 cm", height: "185–190 cm", weight: "95–115 kg" },
  { size: "3XL", chest: "122–132 cm", height: "190–195 cm", weight: "110–130 kg" },
  { size: "4XL", chest: "132–142 cm", height: "195+ cm", weight: "125–150 kg" },
];

const ENDEK_SIZES = [
  { size: "XS", chest: "86–91 cm", waist: "71–76 cm" },
  { size: "S", chest: "91–97 cm", waist: "76–81 cm" },
  { size: "M", chest: "97–102 cm", waist: "81–86 cm" },
  { size: "L", chest: "102–107 cm", waist: "86–91 cm" },
  { size: "XL", chest: "107–112 cm", waist: "91–97 cm" },
  { size: "2XL", chest: "112–122 cm", waist: "97–107 cm" },
  { size: "3XL", chest: "122–132 cm", waist: "107–117 cm" },
  { size: "4XL", chest: "132–142 cm", waist: "117–127 cm" },
];

const CAP_SIZES = [
  { size: "S", head: "54–56 cm" },
  { size: "M", head: "56–58 cm" },
  { size: "L", head: "58–60 cm" },
  { size: "XL", head: "60–62 cm" },
  { size: "2XL", head: "62–64 cm" },
];

const KIT_ITEMS = [
  "BARUNA Training T-Shirt",
  "BARUNA Endek Shirt",
  "BARUNA Cap",
  "Training Bag",
  "Name Badge",
];

export function TravelVisaPrep({ app, id }: { app: Application; id: string }) {
  const [t, setT] = useState<TravelPrep>(() => getTravel(app));

  // Keep local state in sync if the stored record changes elsewhere.
  useEffect(() => {
    setT(getTravel(app));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id]);

  function commit(next: TravelPrep) {
    setT(next);
    updateTravel(id, next);
  }

  function patch<K extends keyof TravelPrep>(section: K, value: Partial<TravelPrep[K]>) {
    commit({ ...t, [section]: { ...t[section], ...value } });
  }

  const steps = prepSteps({ ...app, travel: t });
  const progress = prepProgress({ ...app, travel: t });

  const downloadVisaSupport = () =>
    downloadPdf("baruna-visa-support-letter.pdf", "Visa Support Letter", [
      "BARUNA Academy",
      "",
      "To the Embassy / Consulate,",
      "",
      `This letter confirms that ${app.personal.fullName} (Passport: ${app.personal.passportNumber || "—"})`,
      `from ${app.professional.country} has been selected to attend:`,
      app.title,
      "",
      "In-Person Training: 21–26 September 2026 · Bali, Indonesia",
      "We kindly request the issuance of an entry visa for the training period.",
      "",
      "BARUNA Academy Program Office",
    ]);

  const downloadInvitation = () =>
    downloadPdf("baruna-invitation-letter.pdf", "Invitation Letter", [
      "BARUNA Academy",
      "",
      `Dear ${app.personal.fullName},`,
      "",
      "On behalf of the BARUNA Academy Program Office, it is our honour to formally",
      "invite you to participate in:",
      app.title,
      "",
      "Venue: Bali, Indonesia · 21–26 September 2026",
      `Application ID: ${app.id}`,
      "",
      "We look forward to welcoming you.",
      "",
      "BARUNA Academy Program Office",
    ]);

  const downloadAcceptance = () =>
    downloadPdf("baruna-acceptance-letter.pdf", "Program Acceptance Letter", [
      "BARUNA Academy",
      "",
      `Dear ${app.personal.fullName},`,
      "",
      "We are pleased to confirm your acceptance into:",
      app.title,
      "",
      `Application ID: ${app.id}`,
      `Organization: ${app.professional.organization}`,
      `Country: ${app.professional.country}`,
      "",
      "Warm regards,",
      "BARUNA Academy Program Office",
    ]);

  const onVisaCopy = (file: File | null) => {
    const meta: DocumentMeta | null = file
      ? { name: file.name, size: file.size, uploadedAt: new Date().toISOString() }
      : null;
    patch("visa", { visaCopy: meta });
  };
  const onETicket = (file: File | null) => {
    const meta: DocumentMeta | null = file
      ? { name: file.name, size: file.size, uploadedAt: new Date().toISOString() }
      : null;
    patch("travel", { eTicket: meta });
  };

  const saveToast = () => barunaToast("Preparation details saved");

  const visaApproved = t.visa.status === "Visa Approved" || t.visa.status === "Visa Received";
  const accommodationConfirmed = t.accommodation.status === "Confirmed";

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold text-navy">Travel, Logistics &amp; Participant Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your travel arrangements, accommodation preferences, airport transfers, health and
          dietary requirements, emergency contacts, and training kit information before your arrival in Bali.
        </p>
      </div>

      {/* 10 — Preparation Dashboard (kept at top for visibility) */}
      <SectionCard icon={ClipboardCheck} step="Dashboard" title="Participant Preparation Dashboard">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm font-semibold text-navy">Preparation Status</p>
          <span className="font-display text-2xl font-extrabold text-marine">{progress}% Complete</span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${progress}%` }} />
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-2.5">
              {s.done ? (
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-badge-training" />
              ) : (
                <Circle className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
              )}
              <span className={`text-sm font-medium ${s.done ? "text-navy" : "text-muted-foreground"}`}>{s.label}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* 1 — Visa Support */}
      <SectionCard icon={Stamp} step="1" title="Visa Support">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground/70">Official Documents</p>
        <div className="mt-3 space-y-2.5">
          <DocLetterRow label="Visa Support Letter" desc="Official letter to support your visa application at the embassy." onDownload={downloadVisaSupport} />
          <DocLetterRow label="Invitation Letter" desc="Formal invitation to attend the training program." onDownload={downloadInvitation} />
          <DocLetterRow label="Program Acceptance Letter" desc="Confirmation of your selection into the program." onDownload={downloadAcceptance} />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Visa Status">
            <Select value={t.visa.status} onChange={(v) => patch("visa", { status: v as VisaStatus })} options={[...VISA_STATUSES]} />
          </Field>
          <Field label="Embassy / Consulate Name">
            <TextInput value={t.visa.embassy} onChange={(v) => patch("visa", { embassy: v })} placeholder="e.g. Embassy of Indonesia, Nairobi" onBlur={saveToast} />
          </Field>
          <Field label="Visa Application Date">
            <TextInput type="date" value={t.visa.applicationDate} onChange={(v) => patch("visa", { applicationDate: v })} />
          </Field>
          <Field label="Visa Approval Date">
            <TextInput type="date" value={t.visa.approvalDate} onChange={(v) => patch("visa", { approvalDate: v })} />
          </Field>
          <Field label="Visa Number (optional)">
            <TextInput value={t.visa.visaNumber} onChange={(v) => patch("visa", { visaNumber: v })} placeholder="Visa reference number" onBlur={saveToast} />
          </Field>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-navy">Upload Visa Copy</p>
          <DocumentUploadRow
            field={{ key: "visaCopy", label: "Visa Copy", accept: ".pdf,.jpg,.jpeg,.png", hint: "PDF or JPG" }}
            meta={t.visa.visaCopy}
            onChange={onVisaCopy}
          />
        </div>
        {visaApproved && (
          <Banner tone="success" icon={ShieldCheck}>Your visa status is confirmed. Safe travels to Bali!</Banner>
        )}
      </SectionCard>

      {/* 2 — Travel Information */}
      <SectionCard icon={Plane} step="2" title="Travel Information">
        <Field label="Arrival Airport">
          <Radio
            name="arrivalAirport"
            value={t.travel.arrivalAirport}
            onChange={(v) => patch("travel", { arrivalAirport: v as TravelPrep["travel"]["arrivalAirport"] })}
            options={ARRIVAL_AIRPORTS.map((a) => ({ value: a.value, label: a.label }))}
          />
        </Field>
        {t.travel.arrivalAirport === "Other" && (
          <div className="mt-3 grid gap-4 rounded-xl border border-dashed border-border bg-background p-4 md:grid-cols-3">
            <Field label="Airport Name">
              <TextInput value={t.travel.otherAirportName} onChange={(v) => patch("travel", { otherAirportName: v })} onBlur={saveToast} />
            </Field>
            <Field label="City">
              <TextInput value={t.travel.otherAirportCity} onChange={(v) => patch("travel", { otherAirportCity: v })} onBlur={saveToast} />
            </Field>
            <Field label="Country">
              <TextInput value={t.travel.otherAirportCountry} onChange={(v) => patch("travel", { otherAirportCountry: v })} onBlur={saveToast} />
            </Field>
          </div>
        )}

        <p className="mt-5 mb-1 text-xs font-bold uppercase tracking-wide text-foreground/70">Arrival Flight Information</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Airline">
            <TextInput value={t.travel.airline} onChange={(v) => patch("travel", { airline: v })} placeholder="e.g. Singapore Airlines" onBlur={saveToast} />
          </Field>
          <Field label="Flight Number">
            <TextInput value={t.travel.flightNumber} onChange={(v) => patch("travel", { flightNumber: v })} placeholder="e.g. SQ938" onBlur={saveToast} />
          </Field>
          <Field label="Arrival Date">
            <TextInput type="date" value={t.travel.arrivalDate} onChange={(v) => patch("travel", { arrivalDate: v })} />
          </Field>
          <Field label="Arrival Time">
            <TextInput type="time" value={t.travel.arrivalTime} onChange={(v) => patch("travel", { arrivalTime: v })} />
          </Field>
        </div>

        <p className="mt-5 mb-1 text-xs font-bold uppercase tracking-wide text-foreground/70">Transit Information (optional)</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Transit Airport">
            <TextInput value={t.travel.transitAirport} onChange={(v) => patch("travel", { transitAirport: v })} onBlur={saveToast} />
          </Field>
          <Field label="Transit Flight Number">
            <TextInput value={t.travel.transitFlightNumber} onChange={(v) => patch("travel", { transitFlightNumber: v })} onBlur={saveToast} />
          </Field>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-navy">Upload E-Ticket</p>
          <DocumentUploadRow
            field={{ key: "eTicket", label: "E-Ticket", accept: ".pdf", hint: "PDF" }}
            meta={t.travel.eTicket}
            onChange={onETicket}
          />
        </div>
      </SectionCard>

      {/* 3 — Airport Transfer */}
      <SectionCard icon={Car} step="3" title="Airport Transfer Arrangement">
        <Field label="Airport Pickup Required?">
          <Radio
            name="pickupRequired"
            value={t.transfer.pickupRequired}
            onChange={(v) => patch("transfer", { pickupRequired: v as TravelPrep["transfer"]["pickupRequired"] })}
            options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]}
          />
        </Field>

        {t.transfer.pickupRequired === "Yes" && (
          <div className="mt-3 space-y-4 rounded-xl border border-dashed border-border bg-background p-4">
            <Field label="Pickup Location">
              <Radio
                name="pickupLocation"
                value={t.transfer.pickupLocation}
                onChange={(v) => patch("transfer", { pickupLocation: v as TravelPrep["transfer"]["pickupLocation"] })}
                options={[
                  { value: "Ngurah Rai Airport", label: "Ngurah Rai Airport" },
                  { value: "Hotel in Bali", label: "Hotel in Bali" },
                  { value: "Other Location", label: "Other Location" },
                ]}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Arrival Date">
                <TextInput type="date" value={t.transfer.arrivalDate} onChange={(v) => patch("transfer", { arrivalDate: v })} />
              </Field>
              <Field label="Arrival Time">
                <TextInput type="time" value={t.transfer.arrivalTime} onChange={(v) => patch("transfer", { arrivalTime: v })} />
              </Field>
              <Field label="Number of Luggage">
                <TextInput type="number" value={t.transfer.luggageCount} onChange={(v) => patch("transfer", { luggageCount: v })} placeholder="e.g. 2" onBlur={saveToast} />
              </Field>
              <Field label="WhatsApp Number">
                <TextInput value={t.transfer.whatsapp} onChange={(v) => patch("transfer", { whatsapp: v })} placeholder="+254 ..." onBlur={saveToast} />
              </Field>
            </div>

            <Field label="Pickup Status">
              <Select value={t.transfer.status} onChange={(v) => patch("transfer", { status: v as PickupStatus })} options={[...PICKUP_STATUSES]} />
            </Field>

            <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
              <p className="col-span-full text-xs font-bold uppercase tracking-wide text-foreground/70">Transfer Assignment</p>
              <DisplayPair label="Driver Name" value={t.transfer.status === "Driver Assigned" || t.transfer.status === "Completed" ? "I Made Wirawan" : "To be assigned"} />
              <DisplayPair label="Vehicle Number" value={t.transfer.status === "Driver Assigned" || t.transfer.status === "Completed" ? "DK 1234 BA" : "To be assigned"} />
              <DisplayPair label="Pickup Time" value={t.transfer.status === "Scheduled" || t.transfer.status === "Driver Assigned" || t.transfer.status === "Completed" ? (t.transfer.arrivalTime || "On arrival") : "Awaiting schedule"} />
              <DisplayPair label="Emergency Hotline" value={EMERGENCY_HOTLINE} />
            </div>
          </div>
        )}
      </SectionCard>

      {/* 4 — Accommodation */}
      <SectionCard icon={Hotel} step="4" title="Accommodation Arrangement">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Accommodation Preference">
            <Radio
              name="roomPref"
              value={t.accommodation.preference}
              onChange={(v) => patch("accommodation", { preference: v as TravelPrep["accommodation"]["preference"] })}
              options={[
                { value: "Single Room", label: "Single Room" },
                { value: "Twin Sharing Room", label: "Twin Sharing Room" },
              ]}
            />
          </Field>
          <Field label="Roommate Preference (optional)">
            <TextInput value={t.accommodation.roommate} onChange={(v) => patch("accommodation", { roommate: v })} placeholder="Name of preferred roommate" onBlur={saveToast} />
          </Field>
        </div>

        <Field label="Special Requests" className="mt-4">
          <CheckGroup
            options={[...SPECIAL_REQUESTS]}
            selected={t.accommodation.specialRequests}
            onChange={(specialRequests) => patch("accommodation", { specialRequests })}
          />
        </Field>

        <Field label="Accommodation Status" className="mt-4">
          <Radio
            name="accStatus"
            value={t.accommodation.status}
            onChange={(v) => patch("accommodation", { status: v as AccommodationInfoStatus })}
            options={[{ value: "Pending", label: "Pending" }, { value: "Confirmed", label: "Confirmed" }]}
          />
        </Field>

        <div className="mt-4 grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
          <p className="col-span-full text-xs font-bold uppercase tracking-wide text-foreground/70">Assigned Accommodation</p>
          <DisplayPair label="Hotel Name" value={accommodationConfirmed ? "The Anvaya Beach Resort Bali" : "To be confirmed"} />
          <DisplayPair label="Room Type" value={accommodationConfirmed ? (t.accommodation.preference || "Single Room") : "To be confirmed"} />
          <DisplayPair label="Check-In Date" value={accommodationConfirmed ? "20 Sep 2026" : "To be confirmed"} />
          <DisplayPair label="Check-Out Date" value={accommodationConfirmed ? "27 Sep 2026" : "To be confirmed"} />
          <DisplayPair label="Hotel Address" value={accommodationConfirmed ? "Jl. Kartika, Tuban, Kuta, Bali 80361" : "To be confirmed"} className="sm:col-span-2" />
          {accommodationConfirmed && (
            <a
              href="https://maps.google.com/?q=The+Anvaya+Beach+Resort+Bali"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine hover:text-navy sm:col-span-2"
            >
              <MapPin className="h-4 w-4" /> Open in Google Maps
            </a>
          )}
        </div>
      </SectionCard>

      {/* 5 — Departure */}
      <SectionCard icon={PlaneTakeoff} step="5" title="Departure Information">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Airline">
            <TextInput value={t.departure.airline} onChange={(v) => patch("departure", { airline: v })} onBlur={saveToast} />
          </Field>
          <Field label="Flight Number">
            <TextInput value={t.departure.flightNumber} onChange={(v) => patch("departure", { flightNumber: v })} onBlur={saveToast} />
          </Field>
          <Field label="Departure Date">
            <TextInput type="date" value={t.departure.departureDate} onChange={(v) => patch("departure", { departureDate: v })} />
          </Field>
          <Field label="Departure Time">
            <TextInput type="time" value={t.departure.departureTime} onChange={(v) => patch("departure", { departureTime: v })} />
          </Field>
          <Field label="Departure Airport">
            <TextInput value={t.departure.departureAirport} onChange={(v) => patch("departure", { departureAirport: v })} placeholder="e.g. Ngurah Rai (DPS)" onBlur={saveToast} />
          </Field>
          <Field label="Airport Transfer Required?">
            <Radio
              name="depTransfer"
              value={t.departure.transferRequired}
              onChange={(v) => patch("departure", { transferRequired: v as TravelPrep["departure"]["transferRequired"] })}
              options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]}
            />
          </Field>
        </div>
        {t.departure.transferRequired === "Yes" && (
          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
            <p className="col-span-full text-xs font-bold uppercase tracking-wide text-foreground/70">Departure Transfer</p>
            <DisplayPair label="Scheduled Pickup Time" value={t.departure.departureTime ? `${t.departure.departureTime} (3h before departure)` : "To be confirmed"} />
            <DisplayPair label="Driver Information" value="Assigned 24h before departure" />
          </div>
        )}
      </SectionCard>

      {/* 6 — Training Kit & Apparel */}
      <SectionCard icon={Shirt} step="6" title="Training Kit & Apparel">
        <p className="text-sm text-muted-foreground">Participants will receive:</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {KIT_ITEMS.map((k) => (
            <li key={k} className="flex items-center gap-2 text-sm font-medium text-navy">
              <CheckCircle2 className="h-4 w-4 text-badge-training" /> {k}
            </li>
          ))}
        </ul>

        <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-foreground/70">T-Shirt Size (International Fit)</p>
        <SizeTable headers={["Size", "Chest", "Height", "Weight"]} rows={TSHIRT_SIZES.map((s) => [s.size, s.chest, s.height, s.weight])} selected={t.kit.tshirtSize} onSelect={(size) => patch("kit", { tshirtSize: size })} />

        <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-foreground/70">Endek Shirt Size</p>
        <SizeTable headers={["Size", "Chest", "Waist"]} rows={ENDEK_SIZES.map((s) => [s.size, s.chest, s.waist])} selected={t.kit.endekSize} onSelect={(size) => patch("kit", { endekSize: size })} />

        <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-foreground/70">Cap Size</p>
        <SizeTable headers={["Size", "Head Circumference"]} rows={CAP_SIZES.map((s) => [s.size, s.head])} selected={t.kit.capSize} onSelect={(size) => patch("kit", { capSize: size })} />

        <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-foreground/70">Additional Body Measurements</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Height (cm)">
            <TextInput type="number" value={t.kit.height} onChange={(v) => patch("kit", { height: v })} onBlur={saveToast} />
          </Field>
          <Field label="Weight (kg)">
            <TextInput type="number" value={t.kit.weight} onChange={(v) => patch("kit", { weight: v })} onBlur={saveToast} />
          </Field>
          <Field label="Chest Circumference (cm)">
            <TextInput type="number" value={t.kit.chest} onChange={(v) => patch("kit", { chest: v })} onBlur={saveToast} />
          </Field>
        </div>
        <Field label="Preferred Fit" className="mt-4">
          <Radio
            name="fit"
            value={t.kit.fit}
            onChange={(v) => patch("kit", { fit: v as TravelPrep["kit"]["fit"] })}
            options={FIT_PREFERENCES.map((f) => ({ value: f, label: f }))}
          />
        </Field>
      </SectionCard>

      {/* 7 — Health & Medical */}
      <SectionCard icon={HeartPulse} step="7" title="Health & Medical Information">
        <Field label="Medical Conditions">
          <CheckGroup
            options={[...MEDICAL_CONDITIONS]}
            selected={t.health.conditions}
            onChange={(conditions) => patch("health", { conditions })}
          />
        </Field>
        {t.health.conditions.includes("Other") && (
          <Field label="Medical Condition Description" className="mt-3">
            <TextInput value={t.health.otherCondition} onChange={(v) => patch("health", { otherCondition: v })} onBlur={saveToast} />
          </Field>
        )}
        <Field label="Medication Requirement" className="mt-4">
          <Radio
            name="medication"
            value={t.health.medication}
            onChange={(v) => patch("health", { medication: v as TravelPrep["health"]["medication"] })}
            options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]}
          />
        </Field>
        {t.health.medication === "Yes" && (
          <Field label="Describe Medication" className="mt-3">
            <TextArea value={t.health.medicationDesc} onChange={(v) => patch("health", { medicationDesc: v })} onBlur={saveToast} />
          </Field>
        )}
        <Field label="Emergency Medical Notes" className="mt-4">
          <TextArea value={t.health.emergencyNotes} onChange={(v) => patch("health", { emergencyNotes: v })} onBlur={saveToast} />
        </Field>
      </SectionCard>

      {/* 8 — Food & Dietary */}
      <SectionCard icon={Utensils} step="8" title="Food & Dietary Information">
        <Field label="Dietary Preference">
          <Radio
            name="dietary"
            value={t.food.dietary}
            onChange={(v) => patch("food", { dietary: v })}
            options={DIETARY_PREFERENCES.map((d) => ({ value: d, label: d }))}
          />
        </Field>
        <Field label="Food Allergies" className="mt-4">
          <CheckGroup
            options={[...FOOD_ALLERGIES]}
            selected={t.food.allergies}
            onChange={(allergies) => patch("food", { allergies })}
          />
        </Field>
        {t.food.allergies.includes("Other") && (
          <Field label="Describe Allergy" className="mt-3">
            <TextInput value={t.food.otherAllergy} onChange={(v) => patch("food", { otherAllergy: v })} onBlur={saveToast} />
          </Field>
        )}
        <Field label="Foods to Avoid" className="mt-4">
          <TextArea value={t.food.avoid} onChange={(v) => patch("food", { avoid: v })} onBlur={saveToast} />
        </Field>
      </SectionCard>

      {/* 9 — Emergency Contact */}
      <SectionCard icon={PhoneCall} step="9" title="Emergency Contact">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Emergency Contact Name">
            <TextInput value={t.emergency.name} onChange={(v) => patch("emergency", { name: v })} onBlur={saveToast} />
          </Field>
          <Field label="Relationship">
            <TextInput value={t.emergency.relationship} onChange={(v) => patch("emergency", { relationship: v })} onBlur={saveToast} />
          </Field>
          <Field label="Phone Number">
            <TextInput value={t.emergency.phone} onChange={(v) => patch("emergency", { phone: v })} onBlur={saveToast} />
          </Field>
          <Field label="Country">
            <TextInput value={t.emergency.country} onChange={(v) => patch("emergency", { country: v })} onBlur={saveToast} />
          </Field>
          <Field label="Email Address">
            <TextInput type="email" value={t.emergency.email} onChange={(v) => patch("emergency", { email: v })} onBlur={saveToast} />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

type AccommodationInfoStatus = "Pending" | "Confirmed";

/* ---------------- Building blocks ---------------- */

function SectionCard({
  icon: Icon,
  step,
  title,
  children,
}: {
  icon: typeof Plane;
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Section {step}</p>
          <h3 className="font-display text-base font-bold text-navy">{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-navy">{label}</span>
      {children}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-navy outline-none transition-colors placeholder:text-muted-foreground focus:border-marine focus:ring-2 focus:ring-marine/20";

function TextInput({
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={inputBase}
    />
  );
}

function TextArea({ value, onChange, onBlur }: { value: string; onChange: (v: string) => void; onBlur?: () => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      rows={3}
      className={`${inputBase} resize-y`}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputBase}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Radio({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
              active ? "border-marine bg-marine/5 text-marine" : "border-border bg-background text-foreground/75 hover:border-marine/40"
            }`}
          >
            <span className={`grid h-4 w-4 place-items-center rounded-full border ${active ? "border-marine" : "border-border"}`}>
              {active && <span className="h-2 w-2 rounded-full bg-marine" />}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CheckGroup({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
              active ? "border-marine bg-marine/5 text-marine" : "border-border bg-background text-foreground/75 hover:border-marine/40"
            }`}
          >
            <span className={`grid h-4 w-4 place-items-center rounded border ${active ? "border-marine bg-marine text-marine-foreground" : "border-border"}`}>
              {active && <CheckCircle2 className="h-3 w-3" />}
            </span>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function SizeTable({
  headers,
  rows,
  selected,
  onSelect,
}: {
  headers: string[];
  rows: string[][];
  selected: string;
  onSelect: (size: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60">
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-foreground/70">Select</th>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-foreground/70">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const size = r[0];
            const active = selected === size;
            return (
              <tr
                key={size}
                onClick={() => onSelect(size)}
                className={`cursor-pointer border-t border-border transition-colors ${active ? "bg-marine/5" : "hover:bg-muted/40"}`}
              >
                <td className="px-3 py-2">
                  <span className={`grid h-4 w-4 place-items-center rounded-full border ${active ? "border-marine" : "border-border"}`}>
                    {active && <span className="h-2 w-2 rounded-full bg-marine" />}
                  </span>
                </td>
                {r.map((cell, i) => (
                  <td key={i} className={`px-3 py-2 ${i === 0 ? "font-bold text-navy" : "text-foreground/80"}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DocLetterRow({ label, desc, onDownload }: { label: string; desc: string; onDownload: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-navy">{label}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      <button
        onClick={onDownload}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-marine bg-card px-3.5 py-2 text-xs font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
      >
        <Download className="h-3.5 w-3.5" /> Download PDF
      </button>
    </div>
  );
}

function DisplayPair({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-navy">{value}</p>
    </div>
  );
}

function Banner({ tone, icon: Icon, children }: { tone: "success"; icon: typeof ShieldCheck; children: ReactNode }) {
  const tones = { success: "border-badge-training/30 bg-badge-training/10 text-navy" };
  return (
    <div className={`mt-4 flex items-center gap-2.5 rounded-xl border p-4 ${tones[tone]}`}>
      <Icon className="h-5 w-5 shrink-0 text-badge-training" />
      <p className="text-sm font-semibold">{children}</p>
    </div>
  );
}
