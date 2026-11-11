// Upload one application document from the browser: ask the server for a signed upload
// URL, send the file to the private bucket, then record it on the server so every
// device of the account sees it (migrations 20261111010000 / 20261111020000).
// supported=false means the recording step does not exist yet: the caller keeps the
// file in the open tab and sends it with the application, as before.
import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  createEnrollmentDocumentUpload,
  registerEnrollmentDocument,
} from "@/lib/learning/enrollment-documents.functions";
import { ENROLLMENT_DOCUMENT_BUCKET, enrollmentContentType, enrollmentFileProblem } from "@/lib/learning/enrollment-document-rules";

export type UploadedDocument = { requirement: string; path: string; fileName: string };

export function useEnrollmentDocumentUpload(courseId: string, { allowImages = false, english = false } = {}) {
  const uploadFn = useServerFn(createEnrollmentDocumentUpload);
  const registerFn = useServerFn(registerEnrollmentDocument);
  return useCallback(
    async (requirement: string, file: File): Promise<UploadedDocument & { supported: boolean }> => {
      const problem = enrollmentFileProblem(file, allowImages);
      const type = enrollmentContentType(file, allowImages);
      if (problem || !type) throw new Error(english ? problem?.en : problem?.id);
      const { path, token, contentType } = await uploadFn({ data: { courseId, fileName: file.name, size: file.size, contentType: type } });
      const { error } = await supabase.storage.from(ENROLLMENT_DOCUMENT_BUCKET).uploadToSignedUrl(path, token, file, { contentType });
      if (error) throw new Error(`${english ? "Upload failed" : "Unggah gagal"}: ${error.message}`);
      const { supported } = await registerFn({ data: { courseId, requirement, path, fileName: file.name } });
      return { requirement, path, fileName: file.name, supported };
    },
    [allowImages, courseId, english, registerFn, uploadFn],
  );
}
