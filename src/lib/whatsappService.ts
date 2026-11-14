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
 * Generates a detailed formal WhatsApp notification specifically for a Referee assigned to a match
 */
export const generateRefereeMatchNotificationMessage = (
  params: WhatsAppMessageParams & { refereeName?: string }
): string => {
  const refGreeting = params.refereeName ? `السلام عليكم الأستاذ(ة) *${params.refereeName}*،` : 'السلام عليكم،';
  const sportLine = params.sportName ? `\n🏆 الرياضة: *${params.sportName}*` : '';
  const categoryParts = [params.ageCategory, params.gender].filter(Boolean).join(' • ');
  const stageLine = params.stageName || categoryParts
    ? `\n🏷️ الفئة والدور: ${[categoryParts, params.stageName].filter(Boolean).join(' — ')}`
    : '';
  const team1 = params.team1SchoolName || 'الفريق الأول';
  const team2 = params.team2SchoolName || 'الفريق الثاني';
  const datePart = params.dateStr || 'غير محدد';
  const timePart = params.timeStr || '10:00';
  const venuePart = params.venueName || 'المكان المحدد';

  return `${refGreeting}
نخبركم بتكليفكم ضمن طاقم التحكيم للمقابلة الرياضية المدرسية التالية:${sportLine}${stageLine}
🆚 المواجهة: *${team1}* ضد *${team2}*
📅 التاريخ: *${datePart}*
⏰ التوقيت: *${timePart}*
📍 مكان الإجراء: *${venuePart}*

المرجو الحضور قبل موعد انطلاق المباراة بوقت كافٍ. بالتوفيق!`;
};

const normalizeArabicForLookup = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/^(ذ\.|ذ\/|الأستاذ|الأستاذة|أ\.)\s*/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

/**
 * Resolves a referee name or ID against the Referees and Teachers lists to retrieve full name and phone number
 */
export const findRefereeContact = (
  nameOrId: string,
  refereesList: Array<{ id?: string; fullName?: string; phone?: string }> = [],
  teachersList: Array<{ id?: string; fullName?: string; phone?: string }> = []
): { name: string; phone: string } => {
  const cleanInput = (nameOrId || '').trim();
  if (!cleanInput) return { name: '', phone: '' };

  const normInput = normalizeArabicForLookup(cleanInput);
  const combined = [...refereesList, ...teachersList];

  // 1. Exact ID match
  const byId = combined.find(item => item.id && item.id === cleanInput);
  if (byId) {
    return { name: byId.fullName || cleanInput, phone: byId.phone || '' };
  }

  // 2. Exact normalized fullName match
  const byExactName = combined.find(
    item => item.fullName && normalizeArabicForLookup(item.fullName) === normInput
  );
  if (byExactName) {
    return { name: byExactName.fullName || cleanInput, phone: byExactName.phone || '' };
  }

  // 3. Partial includes match
  if (normInput.length >= 3) {
    const byPartial = combined.find(item => {
      const normItem = normalizeArabicForLookup(item.fullName);
      return normItem && (normItem.includes(normInput) || normInput.includes(normItem));
    });
    if (byPartial) {
      return { name: byPartial.fullName || cleanInput, phone: byPartial.phone || '' };
    }
  }

  return { name: cleanInput, phone: '' };
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
 * Generates official WhatsApp notification specifically for the Host School Director
 * when their school is selected as the venue/center for a scheduled match.
 */
export const generateHostPrincipalMatchNotificationMessage = (
  params: WhatsAppMessageParams & { hostSchoolName?: string }
): string => {
  const hostName = params.hostSchoolName || params.venueName || 'مؤسستكم المحترمة';
  const sportLine = params.sportName ? `\n🏆 الرياضة: *${params.sportName}*` : '';
  const categoryParts = [params.ageCategory, params.gender].filter(Boolean).join(' • ');
  const stageLine = params.stageName || categoryParts
    ? `\n🏷️ الفئة والدور: ${[categoryParts, params.stageName].filter(Boolean).join(' — ')}`
    : '';
  const team1 = params.team1SchoolName || 'الفريق الأول';
  const team2 = params.team2SchoolName || 'الفريق الثاني';
  const datePart = params.dateStr || 'غير محدد';
  const timePart = params.timeStr || '10:00';

  return `السلام عليكم السيد(ة) مدير(ة) *${hostName}*،
نخبركم باختيار مؤسستكم المحترمة كمركز لاحتضان المقابلة الرياضية المدرسية التالية:${sportLine}${stageLine}
🆚 الطرفان المتباريان: *${team1}* ضد *${team2}*
📅 التاريخ: *${datePart}*
⏰ التوقيت: *${timePart}*

نشكر لكم حسن تعاونكم وتسهيل ظروف احتضان وإجراء هذه التظاهرة الرياضية المدرسية.`;
};

/**
 * Generates official WhatsApp notification for each participating school's Director
 */
export const generateTeamPrincipalMatchNotificationMessage = (
  params: WhatsAppMessageParams & { schoolName?: string; opponentName?: string }
): string => {
  const schoolName = params.schoolName || params.team1SchoolName || 'مؤسستكم';
  const opponent = params.opponentName || params.team2SchoolName || 'الفريق المنافس';
  const sportLine = params.sportName ? `\n🏆 الرياضة: *${params.sportName}*` : '';
  const categoryParts = [params.ageCategory, params.gender].filter(Boolean).join(' • ');
  const stageLine = params.stageName || categoryParts
    ? `\n🏷️ الفئة والدور: ${[categoryParts, params.stageName].filter(Boolean).join(' — ')}`
    : '';
  const datePart = params.dateStr || 'غير محدد';
  const timePart = params.timeStr || '10:00';
  const venuePart = params.venueName || 'المكان المحدد';

  return `السلام عليكم السيد(ة) مدير(ة) *${schoolName}*،
نخبركم ببرمجة مشاركة فريق مؤسستكم في المقابلة الرياضية المدرسية التالية:${sportLine}${stageLine}
🆚 ضد مؤسسة: *${opponent}*
📅 التاريخ: *${datePart}*
⏰ التوقيت: *${timePart}*
📍 مكان الإجراء: *${venuePart}*

المرجو التفضل بتسهيل مشاركة التلميذات والتلاميذ والأستاذ(ة) المؤطر(ة). بالتوفيق!`;
};

/**
 * Resolves the host School object for a match when its venue is an existing School in the app
 */
export const resolveHostSchoolForMatch = <
  T extends { id: string; name: string; principalName?: string; principalPhone?: string; phone?: string }
>(
  matchVenue: { hostSchoolId?: string; venueId?: string; venueName?: string },
  schools: T[] = []
): T | undefined => {
  if (!schools || schools.length === 0) return undefined;

  if (matchVenue.hostSchoolId) {
    const byHostId = schools.find(s => s.id === matchVenue.hostSchoolId);
    if (byHostId) return byHostId;
  }

  if (matchVenue.venueId) {
    const cleanVenueId = matchVenue.venueId.replace(/^school:/, '');
    const byVenueId = schools.find(s => s.id === cleanVenueId || s.id === matchVenue.venueId);
    if (byVenueId) return byVenueId;
  }

  if (matchVenue.venueName) {
    const normVenue = normalizeArabicForLookup(matchVenue.venueName);
    if (normVenue) {
      const byExactName = schools.find(s => normalizeArabicForLookup(s.name) === normVenue);
      if (byExactName) return byExactName;
    }
  }

  return undefined;
};

/**
 * Returns normalized director name & phone for a school
 */
export const getSchoolDirectorContact = (school?: {
  name?: string;
  principalName?: string;
  principalPhone?: string;
  phone?: string;
}): { directorName: string; phone: string } => {
  if (!school) return { directorName: 'مدير المؤسسة', phone: '' };
  return {
    directorName: school.principalName?.trim() || `مدير ${school.name || 'المؤسسة'}`,
    phone: (school.principalPhone || school.phone || '').trim()
  };
};

/**
 * Builds direct WhatsApp URL (web and mobile compatible)
 */
export const getWhatsAppUrl = (phone: string, message: string): string => {
  const sanitized = sanitizePhoneNumber(phone);
  const encoded = encodeURIComponent(message);
  if (sanitized) {
    return `https://wa.me/${sanitized}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
};

/**
 * Opens WhatsApp directly in new window/tab targeting recipient's phone number
 */
export const openWhatsApp = (phone: string, message: string): void => {
  const url = getWhatsAppUrl(phone, message);
  window.open(url, '_blank', 'noopener,noreferrer');
};

export interface MatchDiffusionStakeholder {
  id: string;
  name: string;
  roleLabel: string;
  roleCategory:
    | 'referee'
    | 'host_principal'
    | 'team_principal'
    | 'coach'
    | 'school1_teacher'
    | 'school2_teacher';
  phone: string;
  userId?: string;
  schoolId?: string;
  schoolName?: string;
  refereeId?: string;
}

/**
 * Generates a unified official broadcast message ("Nouvelle diffusion") for all match stakeholders
 * containing Date, Time, Venue, Sport/Category, and the two competing teams.
 */
export const generateUnifiedMatchDiffusionMessage = (params: WhatsAppMessageParams): string => {
  const sportPart = params.sportName ? `\n🏆 البطولة: *${params.sportName}*` : '';
  const metaParts = [params.ageCategory, params.gender, params.stageName].filter(Boolean).join(' • ');
  const metaLine = metaParts ? ` (${metaParts})` : '';
  const team1 = params.team1SchoolName || 'الفريق الأول';
  const team2 = params.team2SchoolName || 'الفريق الثاني';
  const datePart = params.dateStr || 'حسب البرنامج';
  const timePart = params.timeStr || '10:00';
  const venuePart = params.venueName || 'الفضاء الرياضي المحدد';
  const notesLine = params.notes?.trim() ? `\n📝 ملاحظة: ${params.notes.trim()}` : '';

  return `📢 *إشعار رسمي ببرمجة مقابلة رياضية مدرسية*${sportPart}${metaLine}
🆚 الفريقان المتنافسان: *${team1}* ضد *${team2}*
📅 التاريخ: *${datePart}*
⏰ الساعة: *${timePart}*
📍 مكان الإجراء: *${venuePart}*${notesLine}

المرجو من كافة المعنيين بالمباراة اتخاذ الترتيبات اللازمة في الموعد المحدد. بالتوفيق للجميع!`;
};

/**
 * Generates an official broadcast message ("Nouvelle diffusion") for homologated/approved match results
 */
export const generateApprovedResultDiffusionMessage = (
  params: WhatsAppMessageParams & {
    score1?: number;
    score2?: number;
    penalty1?: number;
    penalty2?: number;
    scorers?: string;
    approvedByName?: string;
  }
): string => {
  const sportPart = params.sportName ? `\n🏆 البطولة: *${params.sportName}*` : '';
  const metaParts = [params.ageCategory, params.gender, params.stageName].filter(Boolean).join(' • ');
  const metaLine = metaParts ? ` (${metaParts})` : '';
  const team1 = params.team1SchoolName || 'الفريق الأول';
  const team2 = params.team2SchoolName || 'الفريق الثاني';
  const s1 = params.score1 ?? 0;
  const s2 = params.score2 ?? 0;
  const hasPen = params.penalty1 !== undefined && params.penalty2 !== undefined;
  const penLine = hasPen ? ` (ركلات الترجيح: ${params.penalty1} - ${params.penalty2})` : '';

  let winnerLine = '';
  if (s1 > s2 || (s1 === s2 && hasPen && (params.penalty1 ?? 0) > (params.penalty2 ?? 0))) {
    winnerLine = `\n🥇 المؤسسة الفائزة: *${team1}*`;
  } else if (s2 > s1 || (s1 === s2 && hasPen && (params.penalty2 ?? 0) > (params.penalty1 ?? 0))) {
    winnerLine = `\n🥇 المؤسسة الفائزة: *${team2}*`;
  }

  const venuePart = params.venueName ? `\n📍 مكان الإجراء: ${params.venueName}` : '';
  const datePart = params.dateStr ? `\n📅 التاريخ: ${params.dateStr}` : '';
  const approverLine = params.approvedByName
    ? `\n🛡️ المصادقة الرسمية: *${params.approvedByName}*`
    : '\n🛡️ نتيجة رسمية مصادق عليها من طرف اللجنة التقنية المختصة';

  return `✅ *إخبار رسمي بالنتيجة النهائية المصادق عليها*${sportPart}${metaLine}
🆚 المقابلة: *${team1}* ضد *${team2}*
🔢 النتيجة النهائية: *${team1} (${s1}) — (${s2}) ${team2}*${penLine}${winnerLine}${datePart}${venuePart}${approverLine}

هنيئاً للمؤسسة المتأهلة وحظاً أوفر لباقي الفرق المشاركة في الاستحقاقات المقبلة!`;
};

/**
 * Automatically compiles the deduplicated stakeholder broadcast list ("Nouvelle diffusion") for match scheduling:
 * Referees + Host School Director (if venue is a school) + Team 1 & Team 2 School Directors + Team 1 & Team 2 Coaches
 */
export const buildMatchDiffusionStakeholders = (input: {
  matchId?: string;
  sportId?: string;
  team1Id?: string;
  team2Id?: string;
  team1Name: string;
  team2Name: string;
  hostSchoolId?: string;
  venueId?: string;
  venueName?: string;
  referees?: string[];
  schools?: Array<{
    id: string;
    name: string;
    principalName?: string;
    principalPhone?: string;
    phone?: string;
    teacherName?: string;
    teacherPhone?: string;
  }>;
  refereesList?: Array<{ id?: string; fullName?: string; phone?: string }>;
  teachersList?: Array<{
    id?: string;
    fullName?: string;
    phone?: string;
    schoolId?: string;
    schoolName?: string;
    workLocation?: string;
  }>;
  studentsList?: Array<{
    sportId?: string;
    schoolId?: string;
    schoolName?: string;
    coachName?: string;
    coachPhone?: string;
  }>;
}): MatchDiffusionStakeholder[] => {
  const schools = input.schools || [];
  const refereesList = input.refereesList || [];
  const teachersList = input.teachersList || [];
  const studentsList = input.studentsList || [];

  const result: MatchDiffusionStakeholder[] = [];
  const seenPhones = new Set<string>();

  const pushStakeholder = (item: MatchDiffusionStakeholder) => {
    const cleanPhone = sanitizePhoneNumber(item.phone);
    if (cleanPhone && seenPhones.has(cleanPhone)) {
      const existing = result.find(r => sanitizePhoneNumber(r.phone) === cleanPhone);
      if (existing && !existing.roleLabel.includes(item.roleLabel)) {
        existing.roleLabel = `${existing.roleLabel} + ${item.roleLabel}`;
      }
      return;
    }
    if (cleanPhone) seenPhones.add(cleanPhone);
    result.push(item);
  };

  const findSchool = (id?: string, name?: string) => {
    if (id) {
      const byId = schools.find(s => s.id === id);
      if (byId) return byId;
    }
    if (name) {
      const norm = normalizeArabicForLookup(name);
      return schools.find(s => normalizeArabicForLookup(s.name) === norm);
    }
    return undefined;
  };

  const findCoachForSchool = (schoolId?: string, schoolName?: string) => {
    const normSch = normalizeArabicForLookup(schoolName);
    const matchingStudent = studentsList.find(st => {
      if (input.sportId && st.sportId && st.sportId !== input.sportId) return false;
      const sameId = schoolId && st.schoolId && st.schoolId === schoolId;
      const sameName = normSch && normalizeArabicForLookup(st.schoolName) === normSch;
      return (sameId || sameName) && (st.coachName || st.coachPhone);
    });
    if (matchingStudent && (matchingStudent.coachName || matchingStudent.coachPhone)) {
      const matchedTeacher = teachersList.find(
        t => normalizeArabicForLookup(t.fullName) === normalizeArabicForLookup(matchingStudent.coachName)
      );
      return {
        name: matchingStudent.coachName || matchedTeacher?.fullName || `مؤطر ${schoolName || ''}`,
        phone: matchingStudent.coachPhone || matchedTeacher?.phone || '',
        userId: matchedTeacher?.id
      };
    }

    const teacherBySchool = teachersList.find(t => {
      if (schoolId && t.schoolId && t.schoolId === schoolId) return true;
      const loc = normalizeArabicForLookup(t.workLocation || t.schoolName);
      return Boolean(normSch && loc && (loc === normSch || loc.includes(normSch) || normSch.includes(loc)));
    });
    if (teacherBySchool) {
      return {
        name: teacherBySchool.fullName || `مؤطر ${schoolName || ''}`,
        phone: teacherBySchool.phone || '',
        userId: teacherBySchool.id
      };
    }

    const sch = findSchool(schoolId, schoolName);
    if (sch && (sch.teacherName || sch.teacherPhone || sch.phone)) {
      return {
        name: sch.teacherName || `مؤطر ${sch.name}`,
        phone: sch.teacherPhone || sch.phone || '',
        userId: undefined
      };
    }

    return null;
  };

  // 1. Assigned Referees
  const cleanRefs = (input.referees || []).map(r => r?.trim()).filter(Boolean) as string[];
  cleanRefs.forEach((refEntry, idx) => {
    const contact = findRefereeContact(refEntry, refereesList, teachersList);
    const refObj = refereesList.find(
      r => r.id === refEntry || normalizeArabicForLookup(r.fullName) === normalizeArabicForLookup(contact.name || refEntry)
    );
    const teacherObj = teachersList.find(
      t => t.id === refEntry || normalizeArabicForLookup(t.fullName) === normalizeArabicForLookup(contact.name || refEntry)
    );
    pushStakeholder({
      id: `ref-${idx}-${refEntry}`,
      name: contact.name || refEntry,
      roleLabel: cleanRefs.length > 1 ? `حكم المباراة (${idx + 1})` : 'حكم المباراة',
      roleCategory: 'referee',
      phone: contact.phone || '',
      userId: teacherObj?.id,
      refereeId: refObj?.id
    });
  });

  // 2. Host School Director (when venue is a school)
  const hostSchool = resolveHostSchoolForMatch(
    { hostSchoolId: input.hostSchoolId, venueId: input.venueId, venueName: input.venueName },
    schools
  );
  if (hostSchool) {
    const hostDir = getSchoolDirectorContact(hostSchool);
    pushStakeholder({
      id: `host-dir-${hostSchool.id}`,
      name: hostDir.directorName,
      roleLabel: `مدير المؤسسة المحتضنة (${hostSchool.name})`,
      roleCategory: 'host_principal',
      phone: hostDir.phone,
      schoolId: hostSchool.id,
      schoolName: hostSchool.name
    });
  }

  // 3. Team 1 & Team 2 Directors
  const school1 = findSchool(input.team1Id, input.team1Name);
  const dir1 = getSchoolDirectorContact(school1 || { name: input.team1Name });
  pushStakeholder({
    id: `dir1-${school1?.id || input.team1Name}`,
    name: dir1.directorName,
    roleLabel: `مدير ${input.team1Name}`,
    roleCategory: 'team_principal',
    phone: dir1.phone,
    schoolId: school1?.id,
    schoolName: input.team1Name
  });

  const school2 = findSchool(input.team2Id, input.team2Name);
  const dir2 = getSchoolDirectorContact(school2 || { name: input.team2Name });
  pushStakeholder({
    id: `dir2-${school2?.id || input.team2Name}`,
    name: dir2.directorName,
    roleLabel: `مدير ${input.team2Name}`,
    roleCategory: 'team_principal',
    phone: dir2.phone,
    schoolId: school2?.id,
    schoolName: input.team2Name
  });

  // 4. Team 1 & Team 2 Coaches (Teachers)
  const coach1 = findCoachForSchool(school1?.id || input.team1Id, input.team1Name);
  pushStakeholder({
    id: `coach1-${school1?.id || input.team1Name}`,
    name: coach1?.name || `مؤطر ${input.team1Name}`,
    roleLabel: `مؤطر ${input.team1Name}`,
    roleCategory: 'coach',
    phone: coach1?.phone || '',
    userId: coach1?.userId,
    schoolId: school1?.id,
    schoolName: input.team1Name
  });

  const coach2 = findCoachForSchool(school2?.id || input.team2Id, input.team2Name);
  pushStakeholder({
    id: `coach2-${school2?.id || input.team2Name}`,
    name: coach2?.name || `مؤطر ${input.team2Name}`,
    roleLabel: `مؤطر ${input.team2Name}`,
    roleCategory: 'coach',
    phone: coach2?.phone || '',
    userId: coach2?.userId,
    schoolId: school2?.id,
    schoolName: input.team2Name
  });

  return result;
};

/**
 * Compiles the 6 official post-approval result stakeholders requested for homologated results:
 * 1. المؤطر فريق 1
 * 2. المؤطر فريق 2
 * 3. مدير مؤسسة الفريق 1
 * 4. مدير مؤسسة الفريق 2
 * 5. أساتذة المؤسسة فريق 1
 * 6. أساتذة المؤسسة فريق 2
 */
export const buildMatchResultApprovalStakeholders = (input: {
  matchId?: string;
  sportId?: string;
  team1Id?: string;
  team2Id?: string;
  team1Name: string;
  team2Name: string;
  schools?: Array<{
    id: string;
    name: string;
    principalName?: string;
    principalPhone?: string;
    phone?: string;
    teacherName?: string;
    coordinatorName?: string;
    teacherPhone?: string;
  }>;
  teachersList?: Array<{
    id?: string;
    fullName?: string;
    phone?: string;
    schoolId?: string;
    schoolName?: string;
    workLocation?: string;
  }>;
  studentsList?: Array<{
    sportId?: string;
    schoolId?: string;
    schoolName?: string;
    coachName?: string;
    coachPhone?: string;
  }>;
}): MatchDiffusionStakeholder[] => {
  const schools = input.schools || [];
  const teachersList = input.teachersList || [];
  const studentsList = input.studentsList || [];

  const result: MatchDiffusionStakeholder[] = [];
  const seenPhones = new Set<string>();

  const pushStakeholder = (item: MatchDiffusionStakeholder) => {
    const cleanPhone = sanitizePhoneNumber(item.phone);
    if (cleanPhone && seenPhones.has(cleanPhone)) {
      const existing = result.find(r => sanitizePhoneNumber(r.phone) === cleanPhone);
      if (existing && !existing.roleLabel.includes(item.roleLabel)) {
        existing.roleLabel = `${existing.roleLabel} + ${item.roleLabel}`;
      }
      return;
    }
    if (cleanPhone) seenPhones.add(cleanPhone);
    result.push(item);
  };

  const findSchool = (id?: string, name?: string) => {
    if (id) {
      const byId = schools.find(s => s.id === id);
      if (byId) return byId;
    }
    if (name) {
      const norm = normalizeArabicForLookup(name);
      return schools.find(s => normalizeArabicForLookup(s.name) === norm);
    }
    return undefined;
  };

  const findAllTeachersForSchool = (schoolId?: string, schoolName?: string) => {
    const normSch = normalizeArabicForLookup(schoolName);
    return teachersList.filter(t => {
      if (schoolId && t.schoolId && t.schoolId === schoolId) return true;
      const loc = normalizeArabicForLookup(t.workLocation || t.schoolName);
      return Boolean(normSch && loc && (loc === normSch || loc.includes(normSch) || normSch.includes(loc)));
    });
  };

  const findCoachForSchool = (
    schoolObj: { id: string; name: string; teacherName?: string; coordinatorName?: string; phone?: string; teacherPhone?: string } | undefined,
    fallbackId?: string,
    fallbackName?: string
  ) => {
    const schoolId = schoolObj?.id || fallbackId;
    const schoolName = schoolObj?.name || fallbackName || '';
    const normSch = normalizeArabicForLookup(schoolName);

    const matchingStudent = studentsList.find(st => {
      if (input.sportId && st.sportId && st.sportId !== input.sportId) return false;
      const sameId = schoolId && st.schoolId && st.schoolId === schoolId;
      const sameName = normSch && normalizeArabicForLookup(st.schoolName) === normSch;
      return (sameId || sameName) && (st.coachName || st.coachPhone);
    });
    if (matchingStudent && (matchingStudent.coachName || matchingStudent.coachPhone)) {
      const matchedTeacher = teachersList.find(
        t => normalizeArabicForLookup(t.fullName) === normalizeArabicForLookup(matchingStudent.coachName)
      );
      return {
        name: matchingStudent.coachName || matchedTeacher?.fullName || `مؤطر ${schoolName}`,
        phone: matchingStudent.coachPhone || matchedTeacher?.phone || '',
        userId: matchedTeacher?.id
      };
    }

    const schoolTeachers = findAllTeachersForSchool(schoolId, schoolName);
    if (schoolTeachers.length > 0) {
      return {
        name: schoolTeachers[0].fullName || `مؤطر ${schoolName}`,
        phone: schoolTeachers[0].phone || '',
        userId: schoolTeachers[0].id
      };
    }

    if (schoolObj && (schoolObj.coordinatorName || schoolObj.teacherName || schoolObj.teacherPhone || schoolObj.phone)) {
      return {
        name: schoolObj.coordinatorName || schoolObj.teacherName || `مؤطر ${schoolName}`,
        phone: schoolObj.teacherPhone || schoolObj.phone || '',
        userId: undefined
      };
    }

    return {
      name: `مؤطر ${schoolName}`,
      phone: '',
      userId: undefined
    };
  };

  const school1 = findSchool(input.team1Id, input.team1Name);
  const school2 = findSchool(input.team2Id, input.team2Name);

  // 1. المؤطر فريق 1
  const coach1 = findCoachForSchool(school1, input.team1Id, input.team1Name);
  pushStakeholder({
    id: `res-coach1-${school1?.id || input.team1Name}`,
    name: coach1.name,
    roleLabel: `المؤطر فريق 1 (${input.team1Name})`,
    roleCategory: 'coach',
    phone: coach1.phone,
    userId: coach1.userId,
    schoolId: school1?.id,
    schoolName: input.team1Name
  });

  // 2. المؤطر فريق 2
  const coach2 = findCoachForSchool(school2, input.team2Id, input.team2Name);
  pushStakeholder({
    id: `res-coach2-${school2?.id || input.team2Name}`,
    name: coach2.name,
    roleLabel: `المؤطر فريق 2 (${input.team2Name})`,
    roleCategory: 'coach',
    phone: coach2.phone,
    userId: coach2.userId,
    schoolId: school2?.id,
    schoolName: input.team2Name
  });

  // 3. مدير مؤسسة الفريق 1
  const dir1 = getSchoolDirectorContact(school1 || { name: input.team1Name });
  pushStakeholder({
    id: `res-dir1-${school1?.id || input.team1Name}`,
    name: dir1.directorName,
    roleLabel: `مدير مؤسسة الفريق 1 (${input.team1Name})`,
    roleCategory: 'team_principal',
    phone: dir1.phone,
    schoolId: school1?.id,
    schoolName: input.team1Name
  });

  // 4. مدير مؤسسة الفريق 2
  const dir2 = getSchoolDirectorContact(school2 || { name: input.team2Name });
  pushStakeholder({
    id: `res-dir2-${school2?.id || input.team2Name}`,
    name: dir2.directorName,
    roleLabel: `مدير مؤسسة الفريق 2 (${input.team2Name})`,
    roleCategory: 'team_principal',
    phone: dir2.phone,
    schoolId: school2?.id,
    schoolName: input.team2Name
  });

  // 5. أساتذة المؤسسة فريق 1
  const school1Teachers = findAllTeachersForSchool(school1?.id || input.team1Id, input.team1Name);
  if (school1Teachers.length > 0) {
    school1Teachers.forEach((t, idx) => {
      // Skip if exact same user without phone already added as coach1, or merge label if phone exists
      if (!t.phone && coach1.userId && t.id === coach1.userId) {
        const existingCoach = result.find(r => r.id.startsWith('res-coach1-'));
        if (existingCoach && !existingCoach.roleLabel.includes('أساتذة المؤسسة')) {
          existingCoach.roleLabel = `${existingCoach.roleLabel} + أستاذ المؤسسة`;
        }
        return;
      }
      pushStakeholder({
        id: `res-sch1-teacher-${t.id || idx}`,
        name: t.fullName || `أستاذ(ة) ${input.team1Name}`,
        roleLabel: `أساتذة المؤسسة فريق 1 (${input.team1Name})`,
        roleCategory: 'school1_teacher',
        phone: t.phone || '',
        userId: t.id,
        schoolId: school1?.id,
        schoolName: input.team1Name
      });
    });
  } else {
    pushStakeholder({
      id: `res-sch1-teachers-placeholder`,
      name: school1?.teacherName || `أساتذة ${input.team1Name}`,
      roleLabel: `أساتذة المؤسسة فريق 1 (${input.team1Name})`,
      roleCategory: 'school1_teacher',
      phone: school1?.phone || '',
      schoolId: school1?.id,
      schoolName: input.team1Name
    });
  }

  // 6. أساتذة المؤسسة فريق 2
  const school2Teachers = findAllTeachersForSchool(school2?.id || input.team2Id, input.team2Name);
  if (school2Teachers.length > 0) {
    school2Teachers.forEach((t, idx) => {
      if (!t.phone && coach2.userId && t.id === coach2.userId) {
        const existingCoach = result.find(r => r.id.startsWith('res-coach2-'));
        if (existingCoach && !existingCoach.roleLabel.includes('أساتذة المؤسسة')) {
          existingCoach.roleLabel = `${existingCoach.roleLabel} + أستاذ المؤسسة`;
        }
        return;
      }
      pushStakeholder({
        id: `res-sch2-teacher-${t.id || idx}`,
        name: t.fullName || `أستاذ(ة) ${input.team2Name}`,
        roleLabel: `أساتذة المؤسسة فريق 2 (${input.team2Name})`,
        roleCategory: 'school2_teacher',
        phone: t.phone || '',
        userId: t.id,
        schoolId: school2?.id,
        schoolName: input.team2Name
      });
    });
  } else {
    pushStakeholder({
      id: `res-sch2-teachers-placeholder`,
      name: school2?.teacherName || `أساتذة ${input.team2Name}`,
      roleLabel: `أساتذة المؤسسة فريق 2 (${input.team2Name})`,
      roleCategory: 'school2_teacher',
      phone: school2?.phone || '',
      schoolId: school2?.id,
      schoolName: input.team2Name
    });
  }

  return result;
};

/**
 * Generates a .vcf (vCard 3.0) file content for all stakeholders with phone numbers
 * so the user can import the match's "Nouvelle diffusion" contacts into their phonebook in 1 tap.
 */
export const generateDiffusionVCardContent = (
  stakeholders: MatchDiffusionStakeholder[],
  matchLabel: string
): string => {
  const valid = stakeholders.filter(s => sanitizePhoneNumber(s.phone).length >= 9);
  return valid
    .map(s => {
      const intl = '+' + sanitizePhoneNumber(s.phone);
      const displayName = `${s.name} (${s.roleLabel})`;
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${displayName}`,
        `N:${s.name};;;;`,
        `ORG:${matchLabel}`,
        `TITLE:${s.roleLabel}`,
        `TEL;TYPE=CELL,VOICE:${intl}`,
        'END:VCARD'
      ].join('\r\n');
    })
    .join('\r\n');
};


