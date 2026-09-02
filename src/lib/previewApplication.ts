// ============================================================================
// BARUNA — Executive Preview application (in-memory, read-only)
// ----------------------------------------------------------------------------
// Builds a fully-completed sample Application used by the Executive Preview Mode
// so leadership and stakeholders can explore the complete participant journey
// without creating an application or completing any training requirement.
//
// IMPORTANT: This object lives only in memory. It is NEVER persisted to
// localStorage and never touches the real applications store, so it cannot
// affect actual users, applications, learning records, certificates or
// workflows. It exists purely for demonstrations and executive presentations.
// ============================================================================

import { LMS_MODULES, LMS_ASSIGNMENTS } from "@/data/lms";
import {
  type Application,
  type DocumentMeta,
  type ModuleProgress,
  type QuizRecord,
  DOCUMENT_FIELDS,
  LEARNING_SECTIONS,
  TRAINING_DAYS,
} from "@/lib/application";

/** Stable slug + id for the executive preview experience. */
export const PREVIEW_SLUG = "international-training-fisheries-african-countries";
export const PREVIEW_ID = "BARUNA-AFRICA-2026-PREVIEW";

function doc(name: string): DocumentMeta {
  return { name, size: 482_000, uploadedAt: "2026-07-12T09:30:00.000Z" };
}

function completeModule(): ModuleProgress {
  return { video: true, pdf: true, ppt: true, reading: true, quiz: true };
}

function passedQuiz(score: number): QuizRecord {
  return {
    attempts: [
      {
        attempt: 1,
        correct: Math.round((score / 100) * 10),
        total: 10,
        score,
        passed: true,
        takenAt: "2026-08-18T14:00:00.000Z",
      },
    ],
    passed: true,
    bestScore: score,
  };
}

/**
 * Returns a deep, fully-completed sample application for Executive Preview Mode.
 * Every phase is finished so all tabs render rich, realistic content.
 */
export function buildPreviewApplication(): Application {
  const moduleScores = [92, 88, 95, 90, 86, 94, 89, 91, 87, 96, 93, 90, 88];

  const quizzes: Record<string, QuizRecord> = {
    preTest: passedQuiz(64),
    postTest: passedQuiz(90),
    finalExam: passedQuiz(88),
  };
  LMS_MODULES.forEach((m, i) => {
    quizzes[m.id] = passedQuiz(moduleScores[i] ?? 90);
  });

  return {
    id: PREVIEW_ID,
    slug: PREVIEW_SLUG,
    title: "International Training on Fisheries for African Countries",
    createdAt: "2026-07-12T09:30:00.000Z",
    status: "Accepted",
    personal: {
      fullName: "Amara Okafor",
      gender: "Female",
      nationality: "Nigerian",
      dob: "1989-04-17",
      passportNumber: "A04829176",
      email: "amara.okafor@fisheries.gov.ng",
      phone: "+234 803 555 0142",
    },
    professional: {
      organization: "Federal Department of Fisheries, Nigeria",
      position: "Senior Aquaculture Officer",
      country: "Nigeria",
      experience: "9 years",
      sector: "Government / Public Sector",
    },
    english: "Advanced",
    motivation:
      "To bring proven biofloc and value-added processing techniques back to smallholder farmers across West Africa.",
    documents: Object.fromEntries(
      DOCUMENT_FIELDS.map((d) => [d.key, doc(`amara-okafor-${d.key}.pdf`)]),
    ) as Record<string, DocumentMeta | null>,
    participationConfirmed: true,
    learning: Object.fromEntries(LEARNING_SECTIONS.map((s) => [s.key, true])),
    postCourse: Object.fromEntries(
      LMS_ASSIGNMENTS.map((a) => [a.key, doc(`amara-okafor-${a.key}.pdf`)]),
    ) as Record<string, DocumentMeta | null>,
    lms: {
      preTest: true,
      postTest: true,
      finalExam: true,
      modules: Object.fromEntries(LMS_MODULES.map((m) => [m.id, completeModule()])),
      assignments: Object.fromEntries(
        LMS_ASSIGNMENTS.map((a) => [a.key, doc(`amara-okafor-${a.key}.pdf`)]),
      ),
      quizzes,
      actionPlan: { meta: doc("amara-okafor-action-plan.pdf"), status: "Approved" },
      reflection: {
        text: "This program transformed how I approach low-cost, high-yield aquaculture. The biofloc and maggot-feed modules are directly applicable to the cooperatives I support, and the in-person practice in Bali gave me the confidence to train others when I return home.",
        status: "Submitted",
        submittedAt: "2026-09-29T10:00:00.000Z",
      },
      knowledgeSharing: {
        meta: doc("amara-okafor-knowledge-sharing-report.pdf"),
        status: "Approved",
      },
    },
    travel: {
      visa: {
        status: "Visa Received",
        embassy: "Embassy of Indonesia, Abuja",
        applicationDate: "2026-08-01",
        approvalDate: "2026-08-20",
        visaNumber: "ID-VS-2026-44871",
        visaCopy: doc("amara-okafor-visa.pdf"),
      },
      travel: {
        arrivalAirport: "DPS",
        otherAirportName: "",
        otherAirportCity: "",
        otherAirportCountry: "",
        airline: "Singapore Airlines",
        flightNumber: "SQ938",
        arrivalDate: "2026-09-20",
        arrivalTime: "13:45",
        transitAirport: "Singapore Changi (SIN)",
        transitFlightNumber: "SQ405",
        eTicket: doc("amara-okafor-eticket.pdf"),
      },
      transfer: {
        pickupRequired: "Yes",
        pickupLocation: "Ngurah Rai Airport",
        arrivalDate: "2026-09-20",
        arrivalTime: "13:45",
        luggageCount: "2",
        whatsapp: "+234 803 555 0142",
        status: "Driver Assigned",
      },
      accommodation: {
        preference: "Single Room",
        roommate: "",
        specialRequests: ["Non-Smoking Room", "Quiet Room"],
        status: "Confirmed",
      },
      departure: {
        airline: "Singapore Airlines",
        flightNumber: "SQ939",
        departureDate: "2026-09-27",
        departureTime: "14:20",
        departureAirport: "Ngurah Rai International Airport (DPS)",
        transferRequired: "Yes",
      },
      kit: {
        tshirtSize: "M",
        endekSize: "M",
        capSize: "M",
        height: "168",
        weight: "64",
        chest: "98",
        fit: "Regular Fit",
      },
      health: {
        conditions: [],
        otherCondition: "",
        medication: "No",
        medicationDesc: "",
        emergencyNotes: "No known medical conditions.",
      },
      food: {
        dietary: "Halal",
        allergies: ["Peanut"],
        otherAllergy: "",
        avoid: "Pork and pork-derived products.",
      },
      emergency: {
        name: "Chidi Okafor",
        relationship: "Spouse",
        phone: "+234 803 555 0199",
        country: "Nigeria",
        email: "chidi.okafor@example.com",
      },
    },
    inPerson: {
      attendanceConfirmed: "Confirmed",
      attendance: Object.fromEntries(TRAINING_DAYS.map((d) => [`day${d.day}`, "Present" as const])),
      actionPlan: { meta: doc("amara-okafor-in-person-action-plan.pdf"), status: "Approved" },
      evaluations: { course: 5, instructor: 5, venue: 4 },
    },
  };
}
