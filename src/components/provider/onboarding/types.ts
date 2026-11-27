export interface ServiceOption {
  id: string;
  name: string;
}

export interface ProfileData {
  avatarPath: string | null;
  avatarPreview: string | null; // solo para mostrar, no se envía
  lat: number | null;
  lng: number | null;
  manualAddress: string;
  serviceIds: string[];
}

export interface IdentityData {
  idCardPath: string | null;
  proofOfAddressPath: string | null;
}

export interface PayoutData {
  bankName: string;
  accountNumber: string;
  cardholderName: string;
  clabe: string;
}

export interface OnboardingPayload {
  profile: Omit<ProfileData, "avatarPreview">;
  identity: IdentityData;
  payout: PayoutData;
}

export const EMPTY_PROFILE: ProfileData = {
  avatarPath: null,
  avatarPreview: null,
  lat: null,
  lng: null,
  manualAddress: "",
  serviceIds: [],
};
export const EMPTY_IDENTITY: IdentityData = {
  idCardPath: null,
  proofOfAddressPath: null,
};
export const EMPTY_PAYOUT: PayoutData = {
  bankName: "",
  accountNumber: "",
  cardholderName: "",
  clabe: "",
};

// Cada función devuelve qué campos faltan (true = falta o es inválido)
export function profileMissing(p: ProfileData) {
  return {
    avatar: !p.avatarPath,
    location: !(
      (p.lat !== null && p.lng !== null) ||
      p.manualAddress.trim().length >= 3
    ),
    services: p.serviceIds.length === 0,
  };
}

export function identityMissing(i: IdentityData) {
  return { idCard: !i.idCardPath, proof: !i.proofOfAddressPath };
}

export function payoutMissing(p: PayoutData) {
  return {
    bankName: !p.bankName,
    accountNumber: !/^\d{10,16}$/.test(p.accountNumber),
    cardholderName: !/^[\p{L}\s.'-]{3,}$/u.test(p.cardholderName.trim()),
    clabe: !/^\d{18}$/.test(p.clabe),
  };
}

export const anyMissing = (m: Record<string, boolean>) =>
  Object.values(m).some(Boolean);
