import twilio from "twilio";
import crypto from "crypto";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface SendOtpResult {
  success: boolean;
  actualCode?: string;
  error?: string;
}

export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function sendVerificationSms(
  toPhoneNumber: string,
  fallbackCode: string
): Promise<SendOtpResult> {
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  if (!e164Regex.test(toPhoneNumber)) {
    return {
      success: false,
      error: "Invalid phone number format. Please include country code (e.g. +52...).",
    };
  }

  if (!client || (!messagingServiceSid && !twilioPhoneNumber)) {
    console.error("Missing Twilio environment variables in .env");
    return {
      success: false,
      error: "SMS verification service is unavailable (missing Twilio .env credentials).",
    };
  }

  try {
    // En cuentas Trial, Twilio exige el identificador exacto de la plantilla ("sms_2fa")
    const payload = messagingServiceSid
      ? { body: "sms_2fa", messagingServiceSid, to: toPhoneNumber }
      : { body: "sms_2fa", from: twilioPhoneNumber as string, to: toPhoneNumber };

    const message = await client.messages.create(payload);

    // Esperamos brevemente y consultamos el mensaje para leer el PIN de 6 dígitos que generó Twilio
    let renderedBody = message.body ?? "";
    if (!/\b\d{6}\b/.test(renderedBody)) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const fetched = await client.messages(message.sid).fetch();
      renderedBody = fetched.body ?? "";
    }

    const codeMatch = renderedBody.match(/\b(\d{6})\b/);
    const actualCode = codeMatch ? codeMatch[1] : fallbackCode;

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `\n[Takunex DEV OTP] Phone: ${toPhoneNumber} | Code: ${actualCode} | Body: "${renderedBody}"\n`
      );
    }

    return { success: true, actualCode };
  } catch (error: unknown) {
    console.error("Twilio SMS Error:", error);
    const twilioErr = error as { code?: number; message?: string };

    // Si el número no está en los 2 Verified Caller IDs de Twilio Trial,
    // simulamos el envío usando el PIN que ya guardamos en Prisma
    if (twilioErr.code === 21608|| twilioErr.code === 572002) {
      console.warn(
        `\n[Takunex SIMULATED SMS] Number ${toPhoneNumber} is not registered in Twilio Trial. Use OTP Code: ${fallbackCode}\n`
      );
      return {
        success: true,
        actualCode: fallbackCode,
      };
    }

    if (twilioErr.code === 21408) {
      return {
        success: false,
        error: "Twilio Geo Permissions for Mexico (+52) are disabled in your Twilio Console.",
      };
    }

    return {
      success: false,
      error: `Twilio error (${twilioErr.code ?? "unknown"}): ${
        twilioErr.message ?? "Failed to send verification SMS."
      }`,
    };
  }
}