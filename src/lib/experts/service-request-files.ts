import { z } from "zod";

/**
 * Attachments of Expert Service Requests (PB-EXP-03 "Ajukan Assignment Expert").
 * Stored in the private, owner-scoped expert-applications bucket under
 * users/<requesterId>/service-requests/ — readable by others only through the
 * access-checked getServiceRequestFileUrl server function.
 */
export const SERVICE_REQUEST_FILE_BUCKET = "expert-applications";
export const SERVICE_REQUEST_FILE_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";

export function serviceRequestFilePrefix(userId: string) {
  return `users/${userId}/service-requests/`;
}

const FileMetaSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().nonnegative().max(50 * 1024 * 1024),
  type: z.string().max(160),
  uploadedAt: z.string().max(40),
  path: z.string().max(512).optional(),
  bucket: z.string().max(80).optional(),
});

export const ServiceRequestPayloadSchema = z.object({
  values: z.record(z.string().max(5000)).refine((v) => Object.keys(v).length <= 60, "too_many_fields").default({}),
  files: z.record(FileMetaSchema).refine((v) => Object.keys(v).length <= 10, "too_many_files").default({}),
});

export type ServiceRequestPayload = z.infer<typeof ServiceRequestPayloadSchema>;

/** Every submitted file must be a real upload owned by the requester. */
export function assertServiceRequestFiles(payload: ServiceRequestPayload, userId: string, submitting: boolean) {
  const prefix = serviceRequestFilePrefix(userId);
  for (const [key, file] of Object.entries(payload.files)) {
    if (!file.path) {
      if (submitting) {
        throw new Error(`Berkas "${file.name}" belum terunggah. Pilih ulang berkas tersebut sebelum mengirim.`);
      }
      continue;
    }
    if (
      (file.bucket ?? SERVICE_REQUEST_FILE_BUCKET) !== SERVICE_REQUEST_FILE_BUCKET ||
      !file.path.startsWith(prefix) ||
      file.path.includes("..")
    ) {
      throw new Error(`Lampiran "${key}" tidak valid: berkas harus diunggah dari akun Anda sendiri.`);
    }
  }
}
