import twilio from "twilio";
import crypto from "crypto";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;


const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface SendOtpResult {
  success: boolean;
  error?: string;
}

/**
 * Genera un código OTP numérico seguro de 6 dígitos (entre 100000 y 999999).
 */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Envía el código de verificación OTP por SMS mediante Twilio.
 * Detecta automáticamente si tu .env usa MessagingServiceSid (MG...) o un número (+1...).
 *
 * @param toPhoneNumber Número destino en formato internacional E.164 (ej. "+523312345678")
 * @param code Código OTP de 6 dígitos
 */
export async function sendVerificationSms(
  toPhoneNumber: string,
  code: string
): Promise<SendOtpResult> {
  // 1. Validamos formato internacional E.164 (+ seguido de código de país y número)
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  if (!e164Regex.test(toPhoneNumber)) {
    return {
      success: false,
      error: "Invalid phone number format. Please include country code (e.g. +52...).",
    };
  }

  // 2. Verificamos que existan las credenciales y al menos un remitente configurado
  if (!client || (!messagingServiceSid && !twilioPhoneNumber)) {
    console.error("Missing Twilio environment variables in .env");
    return {
      success: false,
      error: "SMS verification service is currently unavailable.",
    };
  }

  try {
    const messageBody = `Your Takunex verification code is: ${code}. Valid for 10 minutes.`;

    const payload = messagingServiceSid
      ? { body: messageBody, messagingServiceSid, to: toPhoneNumber }
      : { body: messageBody, from: twilioPhoneNumber as string, to: toPhoneNumber };

    await client.messages.create(payload);

    return { success: true };
  } catch (error: unknown) {
    console.error("Twilio SMS Error:", error);

    return {
      success: false,
      error:
        "Failed to send verification SMS. Make sure the phone number is verified in Twilio.",
    };
  }
}