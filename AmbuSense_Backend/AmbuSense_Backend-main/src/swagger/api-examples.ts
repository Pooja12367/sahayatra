import {
  AmbulanceStatus,
  EmergencyRequestStatus,
  HospitalAssignmentTechnique,
  UserRole,
} from '../constants/enums';

export const objectIdExample = '65f1a6f2c3b7a91d2e4f5678';

export const authExamples = {
  user: {
    id: objectIdExample,
    fullName: 'Aarav Sharma',
    email: 'aarav.patient@example.com',
    phone: '+9779800000001',
    role: UserRole.PATIENT,
    isActive: true,
    lastLoginAt: '2026-05-01T04:30:00.000Z',
  },
  profile: {
    id: '65f1a6f2c3b7a91d2e4f5679',
    user: objectIdExample,
  },
};

export const ambulanceExample = {
  id: '65f1a6f2c3b7a91d2e4f5680',
  ambulanceCode: 'AMB-102',
  driverName: 'Nabin KC',
  phone: '+9779800000102',
  status: AmbulanceStatus.AVAILABLE,
  currentLocation: {
    type: 'Point',
    coordinates: [85.324, 27.7172],
  },
  isActive: true,
  assignedRequest: null,
  assignedAt: null,
  completedAt: null,
  createdAt: '2026-05-01T04:00:00.000Z',
  updatedAt: '2026-05-01T04:10:00.000Z',
};

export const hospitalExample = {
  id: '65f1a6f2c3b7a91d2e4f5681',
  name: 'City Care Hospital',
  phone: '+977014411111',
  address: 'New Baneshwor, Kathmandu',
  status: 'available',
  capacity: 120,
  availableBeds: 18,
  specialization: ['Trauma', 'Emergency'],
  location: {
    type: 'Point',
    coordinates: [85.3431, 27.6908],
  },
  createdAt: '2026-05-01T04:00:00.000Z',
  updatedAt: '2026-05-01T04:10:00.000Z',
};

export const emergencyRequestExample = {
  id: '65f1a6f2c3b7a91d2e4f5682',
  patientName: 'Sita Tamang',
  patientPhone: '+9779800000202',
  location: {
    type: 'Point',
    coordinates: [85.324, 27.7172],
  },
  status: EmergencyRequestStatus.ASSIGNED,
  assignedAmbulance: ambulanceExample,
  assignedHospital: hospitalExample,
  hospitalAssignmentTechnique: HospitalAssignmentTechnique.SYSTEM_AUTO,
  patient: objectIdExample,
  notes: 'Patient has chest pain',
  cancellationReason: '',
  createdAt: '2026-05-01T04:15:00.000Z',
  updatedAt: '2026-05-01T04:18:00.000Z',
};

export const routeLegExample = {
  distanceInMeters: 2450,
  durationInSeconds: 430,
  geometry: {
    type: 'LineString',
    coordinates: [
      [85.324, 27.7172],
      [85.3431, 27.6908],
    ],
  },
};

export const mediaExample = {
  id: '65f1a6f2c3b7a91d2e4f5683',
  originalName: 'license.png',
  fileName: '1714540800000-0f3d2b71-license.png',
  mimeType: 'image/png',
  size: 204800,
  path: 'uploads/documents/1714540800000-0f3d2b71-license.png',
  url: '/api/uploads/documents/1714540800000-0f3d2b71-license.png',
  uploadedBy: objectIdExample,
};

export const driverProfileExample = {
  id: '65f1a6f2c3b7a91d2e4f5684',
  user: objectIdExample,
  documentType: 'Driving License',
  documentImageId: mediaExample.id,
  isVerified: false,
  verificationNote: null,
};

export const messageExample = {
  message: 'Deleted successfully',
};
