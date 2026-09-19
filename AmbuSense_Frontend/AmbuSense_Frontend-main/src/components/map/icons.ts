import L from "leaflet";

function createCircleIcon(svgContent: string, backgroundColor: string, borderColor: string, customClass = "") {
  return L.divIcon({
    className: customClass,
    html: `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:36px;
        height:36px;
        background:${backgroundColor};
        border:3px solid ${borderColor};
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          ${svgContent}
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

export function createAmbulanceIcon() {
  return createCircleIcon(
    `<path d="M10 17H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h12v6"/><path d="M14 8h6l3 4v3h-2"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M6 11h4M8 9v4"/>`,
    "#059669", // emerald-600
    "#047857", // emerald-700
    "ambulance-icon"
  );
}

export function createHospitalIcon() {
  return createCircleIcon(
    `<path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>`,
    "#dc2626", // red-600
    "#b91c1c",  // red-700
    "hospital-icon"
  );
}

export function createPatientIcon() {
  return createCircleIcon(
    `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
    "#7e22ce", // purple-700
    "#6b21a8", // purple-800
    "patient-icon"
  );
}
