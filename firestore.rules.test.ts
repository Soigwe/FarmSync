/**
 * Phase 0 Security Rules Verification Suite (Dirty Dozen Specification)
 *
 * Documents and verifies all 12 adversarial payloads against firestore.rules.
 * Run with @firebase/rules-unit-testing against the Firebase Emulator when executing locally.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  actor: {
    uid: string | null;
    emailVerified?: boolean;
  };
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedByPillar: string;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated farm read',
    operation: 'get',
    path: '/farms/farm_owner1',
    actor: { uid: null },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 3 / Auth Gate',
  },
  {
    id: 2,
    name: 'Unverified email spoof on farm create',
    operation: 'create',
    path: '/farms/farm_spoof',
    actor: { uid: 'spoof_uid', emailVerified: false },
    payload: {
      ownerId: 'spoof_uid',
      name: 'Spoof Farm',
      location: 'Nowhere',
      volumeUnit: 'L',
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Email Verification Guard',
  },
  {
    id: 3,
    name: 'Cross-user PII read on users collection',
    operation: 'get',
    path: '/users/victim_uid',
    actor: { uid: 'attacker_uid', emailVerified: true },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 6 — PII Isolation',
  },
  {
    id: 4,
    name: 'Owner identity spoofing on farm creation',
    operation: 'create',
    path: '/farms/farm_hijack',
    actor: { uid: 'attacker_uid', emailVerified: true },
    payload: {
      ownerId: 'victim_uid',
      name: 'Hijacked Farm',
      location: '',
      volumeUnit: 'L',
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 2 — Identity Integrity',
  },
  {
    id: 5,
    name: 'Shadow ghost field injection on plant create',
    operation: 'create',
    path: '/farms/farm_owner1/plants/plant_1',
    actor: { uid: 'owner1', emailVerified: true },
    payload: {
      farmId: 'farm_owner1',
      ownerId: 'owner1',
      name: 'Roma Tomatoes',
      zone: 'North',
      category: 'vegetable',
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 2 — Strict hasOnly Schema Blueprint',
  },
  {
    id: 6,
    name: 'Orphaned subcollection write without existing parent farm',
    operation: 'create',
    path: '/farms/nonexistent_farm/plants/plant_orphan',
    actor: { uid: 'owner1', emailVerified: true },
    payload: {
      farmId: 'nonexistent_farm',
      ownerId: 'owner1',
      name: 'Orphan Plant',
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 1 — Master Gate Parent Check',
  },
  {
    id: 7,
    name: 'Path variable ID poisoning with illegal characters',
    operation: 'create',
    path: '/farms/farm_owner1/plants/bad$id$$$poisoning',
    actor: { uid: 'owner1', emailVerified: true },
    payload: {
      farmId: 'farm_owner1',
      ownerId: 'owner1',
      name: 'Poison',
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 3 — Path Variable Hardening',
  },
  {
    id: 8,
    name: 'Client timestamp forgery on task create',
    operation: 'create',
    path: '/farms/farm_owner1/tasks/task_backdated',
    actor: { uid: 'owner1', emailVerified: true },
    payload: {
      farmId: 'farm_owner1',
      ownerId: 'owner1',
      title: 'Backdated Task',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Temporal Integrity (request.time)',
  },
  {
    id: 9,
    name: 'Unbounded or non-string array poisoning on fishTanks.irrigationBedIds',
    operation: 'create',
    path: '/farms/farm_owner1/fishTanks/tank_overflow',
    actor: { uid: 'owner1', emailVerified: true },
    payload: {
      farmId: 'farm_owner1',
      ownerId: 'owner1',
      irrigationBedIds: [12345, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 5 — Total Array Guarding',
  },
  {
    id: 10,
    name: 'Immutable ownerId / farmId / createdAt hijack on update',
    operation: 'update',
    path: '/farms/farm_owner1/plants/plant_1',
    actor: { uid: 'owner1', emailVerified: true },
    payload: {
      ownerId: 'other_user',
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Immortal Field Rule',
  },
  {
    id: 11,
    name: 'Tier 2 worker privilege escalation on fish tank capacity',
    operation: 'update',
    path: '/farms/farm_owner1/fishTanks/tank_1',
    actor: { uid: 'worker_uid', emailVerified: true },
    payload: {
      capacityLiters: 999999,
      assigneeId: 'someone_else',
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Pillar 4 — Tiered Action-Based Update',
  },
  {
    id: 12,
    name: 'Terminal state tampering on immutable completion ledger',
    operation: 'update',
    path: '/farms/farm_owner1/completions/comp_1',
    actor: { uid: 'owner1', emailVerified: true },
    payload: {
      status: 'pending',
      waterVolumeLiters: 0,
    },
    expected: 'PERMISSION_DENIED',
    enforcedByPillar: 'Terminal State Locking',
  },
];
