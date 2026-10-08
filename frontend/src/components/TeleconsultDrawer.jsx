import React, { useState } from 'react';

export default function TeleconsultDrawer({ isOpen, onClose, activePatient, screeningData }) {
  const [filter, setFilter] = useState('All');
  const [sentCenter, setSentCenter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const centers = [
    // --- DELHI HOSPITALS ---
    {
      id: 'aiims-delhi',
      name: 'AIIMS New Delhi (Apex)',
      hospital: 'Prof. Rajesh Malhotra · Dept of Orthopedics & Joint Reconstruction',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Govt',
      dist: 'Ansari Nagar, New Delhi',
      specialty: 'Arthroplasty',
      status: 'Online · ABDM Apex Tele-Triage Node',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Transmit ABHA Dossier',
      actionType: 'primary'
    },
    {
      id: 'safdarjung-delhi',
      name: 'Safdarjung Hospital & VMMC',
      hospital: 'Dr. Ramesh Kumar · Sports Injury Centre (SIC) & Ortho Trauma',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Govt',
      dist: 'Ring Road, New Delhi',
      specialty: 'Rehab & PT',
      status: 'Sports Injury Centre Active',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Send Dossier',
      actionType: 'primary'
    },
    {
      id: 'rml-delhi',
      name: 'Dr. RML Hospital & ABVIMS',
      hospital: 'Dept of Orthopedics & Arthroscopic Joint Surgery',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Govt',
      dist: 'Connaught Place, New Delhi',
      specialty: 'Arthroplasty',
      status: 'Online for Tele-OPD',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Queue Referral',
      actionType: 'primary'
    },
    {
      id: 'gangaram-delhi',
      name: 'Sir Ganga Ram Hospital',
      hospital: 'Institute of Joint Replacement & Orthopedics',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Private',
      dist: 'Old Rajinder Nagar, Delhi',
      specialty: 'Arthroplasty',
      status: 'Robotic Joint Clinic Live',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Instant Tele-Review',
      actionType: 'tertiary'
    },
    {
      id: 'max-saket-delhi',
      name: 'Max Super Speciality Hospital',
      hospital: 'Max Institute of Musculoskeletal Sciences',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Private',
      dist: 'Saket, South Delhi',
      specialty: 'Arthroplasty',
      status: 'Priority Tele-Consult Open',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Send Dossier',
      actionType: 'primary'
    },
    {
      id: 'apollo-delhi',
      name: 'Indraprastha Apollo Hospital',
      hospital: 'Apollo Institute of Orthopedics & Knee Care',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Private',
      dist: 'Sarita Vihar, South-East Delhi',
      specialty: 'Arthroplasty',
      status: 'Specialist On-Call',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Queue Referral',
      actionType: 'primary'
    },
    {
      id: 'fortis-delhi',
      name: 'Fortis Escorts Bone & Joint',
      hospital: 'Department of Joint Replacement & Cartilage Regeneration',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Private',
      dist: 'Okhla Road, New Delhi',
      specialty: 'Rehab & PT',
      status: 'Tele-Clinic Active Today',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Send Dossier',
      actionType: 'primary'
    },
    {
      id: 'blk-max-delhi',
      name: 'BLK-Max Super Speciality',
      hospital: 'Centre for Orthopedics & Joint Reconstruction',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Private',
      dist: 'Pusa Road, Central Delhi',
      specialty: 'Arthroplasty',
      status: 'Online for Review',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Instant Review',
      actionType: 'tertiary'
    },
    {
      id: 'lnjp-mamc-delhi',
      name: 'Lok Nayak (LNJP) & MAMC',
      hospital: 'Maulana Azad Medical College · Ortho Division',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Govt',
      dist: 'Delhi Gate, Central Delhi',
      specialty: 'Rehab & PT',
      status: 'Public Referral Line Open',
      statusColor: 'text-on-surface-variant',
      dotColor: 'bg-secondary',
      actionLabel: 'Queue Referral',
      actionType: 'secondary'
    },
    {
      id: 'gtb-ucms-delhi',
      name: 'GTB Hospital & UCMS',
      hospital: 'University College of Medical Sciences · Dept of Orthopedics',
      city: 'Delhi',
      zone: 'Delhi NCR',
      ownership: 'Govt',
      dist: 'Dilshad Garden, East Delhi',
      specialty: 'Rehab & PT',
      status: 'Scheduled Tele-OPD: 1:30 PM',
      statusColor: 'text-on-surface-variant',
      dotColor: 'bg-secondary',
      actionLabel: 'Schedule Review',
      actionType: 'secondary'
    },

    // --- NOIDA & GREATER NOIDA HOSPITALS ---
    {
      id: 'dist-noida-39',
      name: 'District Hospital Noida (Sec 39)',
      hospital: 'Chief Medical Officer Ortho Unit · PM-JAY Ayushman Centre',
      city: 'Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Govt',
      dist: 'Sector 39, Noida',
      specialty: 'Rehab & PT',
      status: 'Online · Ayushman Desk Active',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Transmit ABHA Dossier',
      actionType: 'primary'
    },
    {
      id: 'gims-kasna',
      name: 'GIMS Greater Noida (Kasna)',
      hospital: 'Government Institute of Medical Sciences · Dept of Ortho',
      city: 'Greater Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Govt',
      dist: 'Kasna, Greater Noida',
      specialty: 'Arthroplasty',
      status: 'Tele-Clinic Live Now',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Send Dossier',
      actionType: 'primary'
    },
    {
      id: 'fortis-noida-62',
      name: 'Fortis Hospital Noida',
      hospital: 'Department of Robotic Knee Replacement & Orthopedics',
      city: 'Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Private',
      dist: 'Sector 62, Noida',
      specialty: 'Arthroplasty',
      status: 'Online for Tele-Triage',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Instant Tele-Review',
      actionType: 'tertiary'
    },
    {
      id: 'jaypee-noida-128',
      name: 'Jaypee Hospital Noida',
      hospital: 'Institute of Spine & Orthopedic Joint Replacement',
      city: 'Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Private',
      dist: 'Sector 128 Expressway, Noida',
      specialty: 'Arthroplasty',
      status: 'Specialist On-Duty',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Send Dossier',
      actionType: 'primary'
    },
    {
      id: 'kailash-noida-27',
      name: 'Kailash Hospital & Heart Institute',
      hospital: 'Department of Orthopedics & Joint Care Center',
      city: 'Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Private',
      dist: 'Sector 27, Noida',
      specialty: 'Rehab & PT',
      status: 'Available for Review',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Queue Referral',
      actionType: 'primary'
    },
    {
      id: 'yatharth-noida-110',
      name: 'Yatharth Super Speciality Hospital',
      hospital: 'Centre for Advanced Joint Replacement & Sports Medicine',
      city: 'Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Private',
      dist: 'Sector 110, Noida',
      specialty: 'Arthroplasty',
      status: 'Tele-OPD Ready',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Send Dossier',
      actionType: 'primary'
    },
    {
      id: 'sharda-gr-noida',
      name: 'Sharda Hospital (Medical College)',
      hospital: 'School of Medical Sciences & Research · Orthopedics Wing',
      city: 'Greater Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Govt',
      dist: 'Knowledge Park III, Gr. Noida',
      specialty: 'Rehab & PT',
      status: 'Active Tele-Triage',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Send Dossier',
      actionType: 'primary'
    },
    {
      id: 'felix-noida-137',
      name: 'Felix Hospital Noida',
      hospital: 'Advanced Joint Care & Orthopedic Rehab Clinic',
      city: 'Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Private',
      dist: 'Sector 137 Expressway, Noida',
      specialty: 'Rehab & PT',
      status: 'Online for Consultation',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Instant Review',
      actionType: 'tertiary'
    },
    {
      id: 'metro-noida-11',
      name: 'Metro Multispeciality Hospital',
      hospital: 'Bone & Joint Replacement Division',
      city: 'Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Private',
      dist: 'Sector 11, Noida',
      specialty: 'Arthroplasty',
      status: 'Queueing open today',
      statusColor: 'text-on-surface-variant',
      dotColor: 'bg-secondary',
      actionLabel: 'Queue Referral',
      actionType: 'secondary'
    },
    {
      id: 'esic-noida-24',
      name: 'ESIC Model Hospital Noida',
      hospital: 'Occupational Musculoskeletal & Ortho Clinic',
      city: 'Noida',
      zone: 'Noida / Gr. Noida',
      ownership: 'Govt',
      dist: 'Sector 24, Noida',
      specialty: 'Rehab & PT',
      status: 'Available for Tele-Referral',
      statusColor: 'text-on-surface-variant',
      dotColor: 'bg-secondary',
      actionLabel: 'Send Dossier',
      actionType: 'secondary'
    },

    // --- NATIONAL APEX REFERRAL CENTERS ---
    {
      id: 'pgimer-chd',
      name: 'PGIMER Chandigarh',
      hospital: 'Dept of Orthopedic Surgery & Sports Rehabilitation',
      city: 'Chandigarh',
      zone: 'National Apex',
      ownership: 'Govt',
      dist: 'North Zone Hub',
      specialty: 'Arthroplasty',
      status: 'Online for Tele-Review',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Send Dossier',
      actionType: 'primary'
    },
    {
      id: 'cmc-vellore',
      name: 'CMC Vellore Ortho Center',
      hospital: 'Dept of Orthopedics & Arthroplasty Clinic',
      city: 'Vellore',
      zone: 'National Apex',
      ownership: 'Private',
      dist: 'South Zone Hub',
      specialty: 'Arthroplasty',
      status: 'Tele-Clinic active now',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Instant Tele-Review',
      actionType: 'tertiary'
    },
    {
      id: 'kem-mumbai',
      name: 'KEM Hospital & Seth GSMC',
      hospital: 'Joint Replacement & Arthroscopy Division',
      city: 'Mumbai',
      zone: 'National Apex',
      ownership: 'Govt',
      dist: 'West Zone Hub',
      specialty: 'Arthroplasty',
      status: 'Queueing open for today',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Queue Referral',
      actionType: 'primary'
    },
    {
      id: 'gmch-guwahati',
      name: 'GMCH Guwahati · Joint Care',
      hospital: 'Dr. B. K. Sarma, MS Ortho · Regional Joint Center',
      city: 'Guwahati',
      zone: 'National Apex',
      ownership: 'Govt',
      dist: 'East / NER Zone Hub',
      specialty: 'Arthroplasty',
      status: 'Online for Tele-Triage',
      statusColor: 'text-tertiary',
      dotColor: 'bg-tertiary',
      actionLabel: 'Send Dossier',
      actionType: 'primary'
    },
    {
      id: 'nims-hyd',
      name: 'NIMS Hyderabad',
      hospital: 'Dept of Physical Medicine & Joint Rehabilitation',
      city: 'Hyderabad',
      zone: 'National Apex',
      ownership: 'Govt',
      dist: 'South Zone Hub',
      specialty: 'Rehab & PT',
      status: 'Scheduled Tele-OPD: 2:00 PM',
      statusColor: 'text-on-surface-variant',
      dotColor: 'bg-secondary',
      actionLabel: 'Schedule Review',
      actionType: 'secondary'
    }
  ];

  const handleSendDossier = (centerId) => {
    setSentCenter(centerId);
    setTimeout(() => {
      setSentCenter(null);
    }, 4000);
  };

  const filteredCenters = centers.filter((c) => {
    if (filter !== 'All') {
      if (filter === 'Delhi NCR' && c.zone !== 'Delhi NCR') return false;
      if (filter === 'Noida / Gr. Noida' && c.zone !== 'Noida / Gr. Noida') return false;
      if (filter === 'Govt / Apex' && c.ownership !== 'Govt') return false;
      if (filter === 'Private / NABH' && c.ownership !== 'Private') return false;
      if (filter === 'National Apex' && c.zone !== 'National Apex') return false;
      if (filter === 'Arthroplasty' && c.specialty !== 'Arthroplasty') return false;
      if (filter === 'Rehab & PT' && c.specialty !== 'Rehab & PT') return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchHosp = c.hospital.toLowerCase().includes(q);
      const matchDist = c.dist.toLowerCase().includes(q);
      const matchCity = c.city.toLowerCase().includes(q);
      if (!matchName && !matchHosp && !matchDist && !matchCity) {
        return false;
      }
    }
    return true;
  });

  return (
    <aside
      aria-label="Teleconsult & Referral Network Desk"
      className="fixed bottom-4 right-4 z-50 w-[460px] max-w-[calc(100vw-1.5rem)] bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/40 flex flex-col overflow-hidden transition-all duration-300 max-h-[85vh]"
    >
      {/* Top Banner */}
      <div className="bg-inverse-surface text-inverse-on-surface px-md py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-xs">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[18px]">local_hospital</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-headline-sm text-sm font-bold block leading-tight text-surface-container-lowest">
                Hospital Referral Network
              </span>
              <span className="px-1.5 py-0.2 rounded bg-primary text-on-primary font-data-mono text-[9px] font-bold uppercase">
                Delhi · Noida · All India
              </span>
            </div>
            <span className="font-label-sm text-[10px] text-tertiary-fixed block mt-0.5">
              ABDM-Empanelled Public & Tertiary Referral Centers
            </span>
          </div>
        </div>
        <div className="flex items-center gap-xs">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-highest/20 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-data-mono text-[10px] text-surface-dim font-bold">{centers.length} Centers</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-surface-dim hover:text-white hover:bg-white/10 transition"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Patient Dossier Strip */}
      {activePatient && (
        <div className="px-md py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="material-symbols-outlined text-primary text-[15px]">badge</span>
            <span className="text-on-surface font-semibold truncate">
              {activePatient.name} ({activePatient.id})
            </span>
            {activePatient.abhaId && (
              <span className="text-primary font-data-mono text-[10px] font-bold">
                · {activePatient.abhaId}
              </span>
            )}
          </div>
          <span className="font-data-mono font-bold text-primary text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/15 shrink-0">
            {screeningData?.category ? `${screeningData.category} Risk` : 'Ready to Transmit'}
          </span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-sm bg-surface-container-low border-b border-outline-variant/20 flex flex-col gap-xs shrink-0">
        <div className="flex items-center justify-between gap-xs">
          <div className="relative grow">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[15px] text-on-surface-variant">
              search
            </span>
            <input
              className="w-full bg-surface-container-lowest text-on-surface rounded-xl text-xs pl-7 pr-2.5 py-1.5 border border-outline-variant/30 focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="Search AIIMS, Safdarjung, Fortis, Jaypee, Noida Sec 39, GIMS..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <span className="text-[11px] font-data-mono font-bold text-primary px-2 py-1 rounded bg-surface-container shrink-0">
            {filteredCenters.length} found
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
          {[
            'All',
            'Delhi NCR',
            'Noida / Gr. Noida',
            'Govt / Apex',
            'Private / NABH',
            'National Apex',
            'Arthroplasty',
            'Rehab & PT'
          ].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-2.5 py-1 rounded-full font-label-sm text-[10px] font-bold transition shrink-0 border ${
                filter === t
                  ? 'bg-primary text-on-primary border-primary shadow-xs'
                  : 'bg-surface-container text-on-surface-variant border-transparent hover:text-on-surface'
              }`}
              type="button"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Hospital Cards List (Scrollable) */}
      <div className="p-sm space-y-2 overflow-y-auto flex-1">
        {filteredCenters.map((c) => {
          const isSent = sentCenter === c.id;
          return (
            <div
              key={c.id}
              className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1.5 hover:border-primary transition-all shadow-xs"
            >
              <div className="flex items-start justify-between gap-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`w-2 h-2 rounded-full ${c.dotColor} shrink-0`}></span>
                    <span className="font-label-sm text-[12px] text-on-surface font-bold truncate">
                      {c.name}
                    </span>
                    <span
                      className={`text-[9px] font-data-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                        c.ownership === 'Govt'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                      }`}
                    >
                      {c.ownership}
                    </span>
                  </div>
                  <p className="font-body-sm text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                    {c.hospital}
                  </p>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary font-data-mono text-[9px] font-bold shrink-0 whitespace-nowrap">
                  {c.dist}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/15 text-xs">
                <span className={`font-label-sm text-[10px] ${c.statusColor} font-semibold flex items-center gap-1 truncate`}>
                  <span className="material-symbols-outlined text-[13px] shrink-0">check_circle</span>
                  <span className="truncate">{c.status}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleSendDossier(c.id)}
                    disabled={isSent}
                    className={`px-2.5 py-1 rounded-lg font-label-sm text-[10px] font-bold flex items-center gap-1 transition-all shadow-xs ${
                      isSent
                        ? 'bg-tertiary-fixed text-on-tertiary-fixed font-bold'
                        : c.actionType === 'primary'
                        ? 'bg-primary text-on-primary hover:bg-primary-container'
                        : 'bg-tertiary text-on-tertiary hover:bg-tertiary-container'
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {isSent ? 'done_all' : 'send'}
                    </span>
                    <span>{isSent ? 'Dossier Transmitted!' : c.actionLabel}</span>
                  </button>
                  <a
                    href="tel:104"
                    className="p-1 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition border border-outline-variant/20"
                    title={`Call ${c.name} Tele-Desk`}
                  >
                    <span className="material-symbols-outlined text-[14px]">call</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2 px-md bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between shrink-0 text-xs">
        <span className="font-label-sm text-[10px] text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-primary">call</span>
          Delhi / Noida Triage Helpline: 104 / 102
        </span>
        <span className="font-label-sm text-[10px] text-primary font-bold">
          ABDM / PM-JAY Empanelled Facility
        </span>
      </div>
    </aside>
  );
}
