import { supabase } from './supabase';

/**
 * OA-Screen NER Authentication & Session Management Module
 * Note: This is an operational client-side mock authentication layer for frontline triage stations.
 * It isolates authentication so it can easily connect to an OAuth2/JWT backend in production.
 */

export const ROLES = {
  screener: {
    id: 'screener',
    label: 'Clinical Screener',
    title: 'Frontline Triage Operator',
    badge: 'Station Screener',
    icon: 'assignment_ind',
    description: 'Patient enrollment, 8s gait capture, and KOOS-NER questionnaire triage.',
    defaultEmail: 'screener@phc.assam.gov.in',
    defaultName: 'S. Terangpi, ANM'
  },
  officer: {
    id: 'officer',
    label: 'Medical Officer',
    title: 'Medical Officer (MO)',
    badge: 'Medical Officer',
    icon: 'medical_services',
    description: 'Diagnostic review, KL-grade radiographic estimates, and teleconsult sign-off.',
    defaultEmail: 'mo.sharma@gmch.gov.in',
    defaultName: 'Dr. R. Sharma, MO'
  },
  admin: {
    id: 'admin',
    label: 'System Administrator',
    title: 'Regional Mesh Administrator',
    badge: 'System Admin',
    icon: 'admin_panel_settings',
    description: 'ESP32 hardware fleet management, offline mesh synchronization, and audit logs.',
    defaultEmail: 'admin.diphu@icmr.gov.in',
    defaultName: 'Eng. K. Das, IT'
  }
};

export const ROLE_PERMISSIONS = {
  screener: {
    allowedTabs: ['overview', 'survey', 'gait', 'report', 'cohort'],
    defaultTab: 'overview',
    canAnalyzeXray: true,
    canManageHardware: false,
    canSignOffTeleconsult: false,
    dataScope: 'station_queue',
    rosterTitle: 'Station Triage Queue',
    rosterSubtitle: 'Frontline patient roster assigned to your screening node for WOMAC/KOOS and gait evaluation.',
  },
  officer: {
    allowedTabs: ['overview', 'survey', 'gait', 'report', 'cohort', 'hardware'],
    defaultTab: 'overview',
    canAnalyzeXray: true,
    canManageHardware: true,
    canSignOffTeleconsult: true,
    dataScope: 'clinical_referral',
    rosterTitle: 'Clinical Review & Referral Roster',
    rosterSubtitle: 'Referred patients and high/moderate risk clinical cases awaiting radiographic staging and teleconsult sign-off.',
  },
  admin: {
    allowedTabs: ['overview', 'survey', 'gait', 'report', 'cohort', 'hardware'],
    defaultTab: 'hardware',
    canAnalyzeXray: true,
    canManageHardware: true,
    canSignOffTeleconsult: true,
    dataScope: 'system_audit',
    rosterTitle: 'System Telemetry & ABDM Audit Registry',
    rosterSubtitle: 'ABDM compliance, de-identified demographic telemetry, offline mesh cache status, and hardware node health.',
  },
};

export function getRoleConfig(roleId) {
  const cleanId = (roleId || 'screener').toLowerCase().trim();
  return ROLE_PERMISSIONS[cleanId] || ROLE_PERMISSIONS.screener;
}

export function isTabAllowedForRole(roleId, tabId) {
  const config = getRoleConfig(roleId);
  return config.allowedTabs.includes(tabId);
}

export async function signupUser({ email, password, name, roleId, station }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role_id: roleId,
        station: station,
      }
    }
  });
  if (error) throw error;
  return data;
}

export async function loginWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

export async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}

export function formatSupabaseUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const roleId = meta.role_id; // Do not default! Let CompleteProfileView catch it
  const roleConfig = getRoleConfig(roleId || 'screener');
  return {
    id: user.id,
    email: user.email,
    name: meta.full_name || user.email,
    roleId: roleId || null,
    role: roleConfig.label,
    roleBadge: roleConfig.badge,
    station: meta.station || null,
    isDemo: false
  };
}

export const DEMO_ACCOUNTS = [
  // --- National Medical Officers & Orthopedic Specialists ---
  {
    role: 'officer',
    email: 'mo.sharma@gmch.gov.in',
    password: 'demo123',
    name: 'Dr. R. Sharma, MO (Orthopedics)',
    station: 'Guwahati Medical College & Hospital (GMCH)',
    staffId: 'NER-MO-8841',
    zone: 'North East'
  },
  {
    role: 'officer',
    email: 'dr.verma@aiims.edu.in',
    password: 'demo123',
    name: 'Dr. A. Verma, Chief Orthopedic Consultant',
    station: 'AIIMS New Delhi - Department of Orthopedics',
    staffId: 'DEL-MO-1092',
    zone: 'Northern Hub'
  },
  {
    role: 'officer',
    email: 'dr.kuldeep@safdarjung.gov.in',
    password: 'demo123',
    name: 'Dr. Kuldeep Singh, Senior Ortho Specialist',
    station: 'Safdarjung Hospital OPD Unit, New Delhi',
    staffId: 'DEL-MO-5421',
    zone: 'Northern Hub'
  },
  {
    role: 'officer',
    email: 'dr.chatterjee@pgimer.edu.in',
    password: 'demo123',
    name: 'Dr. P. Chatterjee, Joint Arthroplasty Consultant',
    station: 'PGIMER Chandigarh Specialty Clinic',
    staffId: 'CHD-MO-3304',
    zone: 'Northern Hub'
  },
  {
    role: 'officer',
    email: 'dr.menon@cmcvellore.ac.in',
    password: 'demo123',
    name: 'Dr. K. Menon, Musculoskeletal Research Lead',
    station: 'CMC Vellore Telemedicine Center',
    staffId: 'VEL-MO-7712',
    zone: 'Southern Hub'
  },

  // --- Clinical Screeners & Triage Field Operators ---
  {
    role: 'screener',
    email: 'screener@phc.assam.gov.in',
    password: 'demo123',
    name: 'S. Terangpi, ANM Triage Lead',
    station: 'Diphu Civil Hospital Hub, Assam',
    staffId: 'NER-SCR-1042',
    zone: 'North East'
  },
  {
    role: 'screener',
    email: 'screener.delhi@safdarjung.gov.in',
    password: 'demo123',
    name: 'Priya Mehra, Community Health Officer',
    station: 'Safdarjung OPD Hub, New Delhi',
    staffId: 'DEL-SCR-2005',
    zone: 'Northern Hub'
  },
  {
    role: 'screener',
    email: 'screener.pune@nhm.gov.in',
    password: 'demo123',
    name: 'Anil Kulkarni, Senior Field Screener',
    station: 'Sub-District Hospital Pune, Maharashtra',
    staffId: 'MH-SCR-3118',
    zone: 'Western Hub'
  },

  // --- Regional & National System Administrators ---
  {
    role: 'admin',
    email: 'admin.diphu@icmr.gov.in',
    password: 'admin123',
    name: 'Eng. K. Das, Regional IT Lead',
    station: 'ICMR Regional RMRC Hub, Dibrugarh',
    staffId: 'NER-ADM-9002',
    zone: 'North East'
  },
  {
    role: 'admin',
    email: 'admin.national@icmr.gov.in',
    password: 'admin123',
    name: 'Dr. S. Nair, National Tele-Triage Network Admin',
    station: 'ICMR Headquarters, New Delhi',
    staffId: 'DEL-ADM-0010',
    zone: 'Central Command'
  }
];

export function loginAsDemo(roleId = 'screener') {
  const account = DEMO_ACCOUNTS.find(a => a.role === roleId) || DEMO_ACCOUNTS[0];
  const roleConfig = getRoleConfig(account.role);
  return {
    id: `demo-${account.role}-${Date.now()}`,
    email: account.email,
    name: account.name,
    roleId: account.role,
    role: roleConfig.label,
    roleBadge: roleConfig.badge,
    station: account.station,
    staffId: account.staffId,
    isDemo: true,
    profileCompleted: true
  };
}

export function getStoredUser() {
  // Check session storage first for demo or completed sessions
  try {
    const sessionKey = 'oa_ner_auth_session';
    const raw = sessionStorage.getItem(sessionKey);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  // Try to load synchronously from localStorage if possible (Supabase stores it in localstorage)
  try {
    const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (sbKey) {
      const sbData = JSON.parse(localStorage.getItem(sbKey));
      if (sbData && sbData.user) {
        return formatSupabaseUser(sbData.user);
      }
    }
  } catch(e) {}
  return null;
}
