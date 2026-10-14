import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { toFriendlyServiceError } from "./service-request-errors";
import {
  TrainerApplicationSchema,
  assertTrainerApplicationFile,
  type MyTrainerApplicationState,
} from "./trainer-application";

export const getMyTrainerApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyTrainerApplicationState> => {
    const { data, error } = await context.supabase.rpc("trainer_application_my");
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return data as unknown as MyTrainerApplicationState;
  });

export const submitTrainerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => TrainerApplicationSchema.parse(input))
  .handler(async ({ context, data }) => {
    assertTrainerApplicationFile(data, context.userId);
    const { data: result, error } = await context.supabase.rpc("trainer_application_submit", {
      _payload: data as unknown as Json,
    });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return result as { id: string; status: string; duplicate: boolean };
  });

export const withdrawTrainerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ applicationId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("trainer_application_withdraw", {
      _application_id: data.applicationId,
    });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return result as { id: string; status: string };
  });
