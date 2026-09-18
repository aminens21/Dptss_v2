/**
 * WhatsApp Notification Service for Moroccan School Sports (Taourirt Directorate)
 * Formats official notifications for Referees, Teachers (Coaches), and School Principals.
 */

export interface WhatsAppMessageParams {
  tournamentName?: string;
  sportName?: string;
  ageCategory?: string;
  gender?: string;
  stageName?: string;
  team1SchoolName: string;
  team2SchoolName: string;
  dateStr?: string;
  timeStr: string;
  venueName: string;
  venueAddress?: string;
  refereeNames?: string[];
  recipientName?: string;
  schoolName?: string;
  notes?: string;
}

/**
 * Normalizes Moroccan phone numbers into international WhatsApp format (e.g. 0612345678 -> 212612345678)
 */
export const sanitizePhoneNumber = (phone?: string): string => {
  if (!phone) return '';
  // Remove all non-numeric characters except leading '+'
  let clean = phone.replace(/[^\d]/g, '').trim();

  // If starts with 06 or 07 or 05 -> replace leading 0 with 212
  if (/^0[567]\d{8}$/.test(clean)) {
    clean = '212' + clean.substring(1);
  } else if (/^[567]\d{8}$/.test(clean)) {
    clean = '212' + clean;
  }
  return clean;
};

/**
 * Validates if phone number has a valid format for direct WhatsApp dispatch
 */
export const isValidPhoneNumber = (phone?: string): boolean => {
  const sanitized = sanitizePhoneNumber(phone);
  return sanitized.length >= 9 && sanitized.startsWith('212');
};

/**
 * Generates the concise direct reminder message matching exact user specification:
 * "تذكير: المقابلة بين فريق ... وفريق ... على الساعة ... في ..."
 */
export const generateDirectConciseMatchReminder = (params: WhatsAppMessageParams): string => {
  const team1 = params.team1SchoolName || 'الفريق الأول';
  const team2 = params.team2SchoolName || 'الفريق الثاني';
  const time = params.timeStr || '10:00';
  const venue = params.venueName || 'المكان المحدد';
  const datePart = params.dateStr ? `يوم ${params.dateStr} ` : '';

  return `تذكير بموعد اللقاء:
المقابلة بين فريق ${team1} وفريق ${team2} ${datePart}على الساعة ${time} في ${venue}.`;
};

/**
 * Generates official WhatsApp notification message for the Teacher / Coach
 */
export const generateTeacherWhatsAppMessage = (
  params: WhatsAppMessageParams,
  isTeam1: boolean = true
): string => {
  return generateDirectConciseMatchReminder(params);
};

/**
 * Generates official WhatsApp notification message for the Referee
 */
export const generateRefereeWhatsAppMessage = (
  params: WhatsAppMessageParams,
  _refereeRole: string = 'الحكم الرئيسي'
): string => {
  return generateDirectConciseMatchReminder(params);
};

/**
 * Generates official WhatsApp notification message for the School Principal
 */
export const generatePrincipalWhatsAppMessage = (
  params: WhatsAppMessageParams,
  _isTeam1: boolean = true
): string => {
  return generateDirectConciseMatchReminder(params);
};

/**
 * Builds direct WhatsApp URL (web and mobile compatible)
 */
export const getWhatsAppUrl = (phone: string, message: string): string => {
  const sanitized = sanitizePhoneNumber(phone);
  const encoded = encodeURIComponent(message);
  if (sanitized) {
    return `https://api.whatsapp.com/send?phone=${sanitized}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
};

/**
 * Opens WhatsApp directly in new window/tab targeting recipient's phone number
 */
export const openWhatsApp = (phone: string, message: string): void => {
  const url = getWhatsAppUrl(phone, message);
  window.open(url, '_blank', 'noopener,noreferrer');
};

