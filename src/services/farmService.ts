import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AnimalGroup,
  AnimalTask,
  CompletionLog,
  CustomTask,
  Farm,
  FarmInvite,
  FarmMember,
  FishTank,
  MemberRole,
  PlantSchedule,
  SCHEMA_LIMITS,
  ScheduledActivity,
  TankStage,
  VolumeUnit,
} from '../types';
import {
  addDays,
  clampInt,
  clampString,
  generateDocId,
  generateInviteCode,
  getTodayDateKey,
  nextTankStage,
  sanitizeId,
  sanitizeInviteCode,
  stageToLabel,
} from '../utils/schedule';

const LEGACY_PLACEHOLDER_MEMBER_IDS = new Set([
  'member_ada',
  'member_chidi',
  'member_samuel',
]);

export interface WorkspaceSession {
  farmId: string;
  role: MemberRole;
  memberId: string;
  farmName: string;
}

async function cleanupLegacyPlaceholderMembers(farmId: string, uid: string): Promise<void> {
  try {
    const [membersSnap, plantsSnap, tanksSnap, tasksSnap] = await Promise.all([
      getDocs(query(collection(db, 'farms', farmId, 'members'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'farms', farmId, 'plants'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'farms', farmId, 'fishTanks'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'farms', farmId, 'tasks'), where('ownerId', '==', uid))),
    ]);

    const now = serverTimestamp();
    const batch = writeBatch(db);
    let hasChanges = false;

    for (const d of membersSnap.docs) {
      if (LEGACY_PLACEHOLDER_MEMBER_IDS.has(d.id)) {
        batch.delete(d.ref);
        hasChanges = true;
      } else if (typeof d.data().inviteCode !== 'string') {
        batch.update(d.ref, { inviteCode: '', updatedAt: now });
        hasChanges = true;
      }
    }

    for (const pDoc of plantsSnap.docs) {
      const data = pDoc.data();
      const updates: Record<string, unknown> = {};
      if (LEGACY_PLACEHOLDER_MEMBER_IDS.has(String(data.waterAssigneeId || ''))) {
        updates.waterAssigneeId = '';
        updates.waterAssigneeUid = '';
      }
      if (LEGACY_PLACEHOLDER_MEMBER_IDS.has(String(data.mulchAssigneeId || ''))) {
        updates.mulchAssigneeId = '';
        updates.mulchAssigneeUid = '';
      }
      if (LEGACY_PLACEHOLDER_MEMBER_IDS.has(String(data.pruneAssigneeId || ''))) {
        updates.pruneAssigneeId = '';
        updates.pruneAssigneeUid = '';
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now;
        batch.update(pDoc.ref, updates);
        hasChanges = true;
      }
    }

    for (const tDoc of tanksSnap.docs) {
      const data = tDoc.data();
      if (LEGACY_PLACEHOLDER_MEMBER_IDS.has(String(data.assigneeId || ''))) {
        batch.update(tDoc.ref, { assigneeId: '', assigneeUid: '', updatedAt: now });
        hasChanges = true;
      }
    }

    for (const taskDoc of tasksSnap.docs) {
      const data = taskDoc.data();
      if (LEGACY_PLACEHOLDER_MEMBER_IDS.has(String(data.assigneeId || ''))) {
        batch.update(taskDoc.ref, { assigneeId: '', assigneeUid: '', updatedAt: now });
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `farms/${farmId}/members`);
  }
}

export async function ensureFarmWorkspace(user: User): Promise<WorkspaceSession> {
  const userPath = `users/${user.uid}`;
  const defaultFarmId = sanitizeId(`farm_${user.uid}`);
  const displayName =
    clampString(user.displayName || 'Farm Owner', SCHEMA_LIMITS.DISPLAY_NAME_MAX) || 'Farm Owner';

  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      const activeFarmId = typeof data.activeFarmId === 'string' ? data.activeFarmId : '';
      const activeRole: MemberRole = data.activeRole === 'worker' ? 'worker' : 'manager';
      const activeMemberId = typeof data.activeMemberId === 'string' ? data.activeMemberId : '';
      const activeFarmName = typeof data.activeFarmName === 'string' ? data.activeFarmName : 'My Farm';

      // Worker session attached to a manager's farm
      if (activeRole === 'worker' && activeFarmId && activeMemberId) {
        try {
          const memberSnap = await getDoc(
            doc(db, 'farms', activeFarmId, 'members', activeMemberId)
          );
          if (
            memberSnap.exists() &&
            memberSnap.data().linkedUid === user.uid &&
            memberSnap.data().active === true
          ) {
            return {
              farmId: activeFarmId,
              role: 'worker',
              memberId: activeMemberId,
              farmName: activeFarmName || 'Shared Farm',
            };
          }
        } catch {
          // Membership revoked or removed — fall back to manager workspace
        }
      }

      // Manager session
      if (activeFarmId) {
        try {
          const farmSnap = await getDoc(doc(db, 'farms', activeFarmId));
          if (farmSnap.exists()) {
            // Upgrade legacy user profile doc if missing new role fields
            if (!data.activeRole || typeof data.activeFarmName !== 'string') {
              await updateDoc(doc(db, 'users', user.uid), {
                activeRole: 'manager',
                activeMemberId: 'member_owner',
                activeFarmName: clampString(String(farmSnap.data().name || 'My Farm'), SCHEMA_LIMITS.NAME_MAX),
                updatedAt: serverTimestamp(),
              });
            }
            await cleanupLegacyPlaceholderMembers(activeFarmId, user.uid);
            return {
              farmId: activeFarmId,
              role: 'manager',
              memberId: 'member_owner',
              farmName: String(farmSnap.data().name || 'My Farm'),
            };
          }
        } catch {
          // Continue to create own farm if needed
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  // First-time farm bootstrap — only the signed-in owner (zero placeholder people)
  const today = getTodayDateKey();
  try {
    const now = serverTimestamp();

    const rootBatch = writeBatch(db);
    rootBatch.set(doc(db, 'users', user.uid), {
      uid: user.uid,
      displayName,
      activeFarmId: defaultFarmId,
      activeRole: 'manager',
      activeMemberId: 'member_owner',
      activeFarmName: 'My Farm',
      createdAt: now,
      updatedAt: now,
    });
    rootBatch.set(doc(db, 'farms', defaultFarmId), {
      ownerId: user.uid,
      name: 'My Farm',
      location: 'Main Plot',
      volumeUnit: 'L' as VolumeUnit,
      createdAt: now,
      updatedAt: now,
    });
    await rootBatch.commit();

    const seedBatch = writeBatch(db);
    const mOwnerId = 'member_owner';

    seedBatch.set(doc(db, 'farms', defaultFarmId, 'members', mOwnerId), {
      farmId: defaultFarmId,
      ownerId: user.uid,
      name: displayName.slice(0, SCHEMA_LIMITS.NAME_MAX),
      role: 'manager',
      specialty: 'Farm Manager',
      linkedUid: user.uid,
      inviteCode: '',
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    const pTomatoId = 'plant_roma_tomatoes';
    const pPepperId = 'plant_peppers';

    const plantsSeed = [
      {
        id: pTomatoId,
        name: 'Tomatoes — Bed 1',
        zone: 'Vegetable Plot',
        category: 'vegetable',
        waterEnabled: true,
        waterEveryDays: 2,
        lastWateredDate: addDays(today, -2),
        mulchEnabled: true,
        mulchEveryDays: 21,
        lastMulchedDate: addDays(today, -21),
        pruneEnabled: true,
        pruneEveryDays: 14,
        lastPrunedDate: addDays(today, -10),
        receivesFishWater: true,
        notes: 'Uses fish tank water. Pinch lower side shoots when pruning.',
      },
      {
        id: pPepperId,
        name: 'Peppers — Bed 2',
        zone: 'Vegetable Plot',
        category: 'vegetable',
        waterEnabled: true,
        waterEveryDays: 2,
        lastWateredDate: addDays(today, -2),
        mulchEnabled: true,
        mulchEveryDays: 28,
        lastMulchedDate: addDays(today, -18),
        pruneEnabled: true,
        pruneEveryDays: 21,
        lastPrunedDate: addDays(today, -21),
        receivesFishWater: true,
        notes: 'Keep dry grass or straw mulch around roots.',
      },
    ];

    for (const p of plantsSeed) {
      seedBatch.set(doc(db, 'farms', defaultFarmId, 'plants', p.id), {
        farmId: defaultFarmId,
        ownerId: user.uid,
        name: p.name,
        zone: p.zone,
        category: p.category,
        waterEnabled: p.waterEnabled,
        waterEveryDays: p.waterEveryDays,
        lastWateredDate: p.lastWateredDate,
        waterAssigneeId: mOwnerId,
        waterAssigneeUid: user.uid,
        mulchEnabled: p.mulchEnabled,
        mulchEveryDays: p.mulchEveryDays,
        lastMulchedDate: p.lastMulchedDate,
        mulchAssigneeId: mOwnerId,
        mulchAssigneeUid: user.uid,
        pruneEnabled: p.pruneEnabled,
        pruneEveryDays: p.pruneEveryDays,
        lastPrunedDate: p.lastPrunedDate,
        pruneAssigneeId: mOwnerId,
        pruneAssigneeUid: user.uid,
        receivesFishWater: p.receivesFishWater,
        notes: p.notes,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Seed Fish Tank (1/4 -> 2/4 -> 3/4 every 2 days)
    seedBatch.set(doc(db, 'farms', defaultFarmId, 'fishTanks', 'tank_main_1'), {
      farmId: defaultFarmId,
      ownerId: user.uid,
      name: 'Catfish Tank 1',
      species: 'Catfish',
      capacityLiters: 2000,
      intervalDays: 2,
      currentStage: 1,
      nextDrawdownDate: today,
      lastDrawdownDate: addDays(today, -2),
      assigneeId: mOwnerId,
      assigneeUid: user.uid,
      irrigationBedIds: [pTomatoId, pPepperId],
      notes: 'Drain 1/4 after 2 days, 2/4 after 2 more days, 3/4 after 2 more days + refill. Use water for plants.',
      createdAt: now,
      updatedAt: now,
    });

    // Seed starter Animal Groups & Animal Tasks (Fish, Chickens, Ducks)
    seedBatch.set(doc(db, 'farms', defaultFarmId, 'animals', 'animal_catfish'), {
      farmId: defaultFarmId,
      ownerId: user.uid,
      name: 'Catfish Pond',
      animalType: 'fish',
      count: 300,
      housing: 'Tank 1',
      notes: 'Water changes tracked in Fish Tanks section above.',
      createdAt: now,
      updatedAt: now,
    });

    seedBatch.set(doc(db, 'farms', defaultFarmId, 'animals', 'animal_chickens'), {
      farmId: defaultFarmId,
      ownerId: user.uid,
      name: 'Chickens — Coop 1',
      animalType: 'chicken',
      count: 40,
      housing: 'Coop 1',
      notes: 'Daily feeding & fresh drinkers; clean litter every 3 days.',
      createdAt: now,
      updatedAt: now,
    });

    seedBatch.set(doc(db, 'farms', defaultFarmId, 'animals', 'animal_ducks'), {
      farmId: defaultFarmId,
      ownerId: user.uid,
      name: 'Ducks — Pen A',
      animalType: 'duck',
      count: 20,
      housing: 'Duck Pen A',
      notes: 'Keep deep drinking water fresh daily and sleeping bedding dry.',
      createdAt: now,
      updatedAt: now,
    });

    const starterAnimalTasks = [
      {
        id: 'atask_feed_catfish',
        animalId: 'animal_catfish',
        animalName: 'Catfish Pond',
        animalType: 'fish',
        taskKind: 'feeding',
        title: 'Feed catfish pellets',
        everyDays: 1,
        lastDoneDate: addDays(today, -1),
        notes: 'Morning & evening feeding.',
      },
      {
        id: 'atask_feed_chickens',
        animalId: 'animal_chickens',
        animalName: 'Chickens — Coop 1',
        animalType: 'chicken',
        taskKind: 'feeding',
        title: 'Feed chickens & refill water',
        everyDays: 1,
        lastDoneDate: addDays(today, -1),
        notes: 'Check feeders and rinse drinkers.',
      },
      {
        id: 'atask_clean_coop',
        animalId: 'animal_chickens',
        animalName: 'Chickens — Coop 1',
        animalType: 'chicken',
        taskKind: 'cleaning',
        title: 'Clean chicken coop & change litter',
        everyDays: 3,
        lastDoneDate: addDays(today, -3),
        notes: 'Spread dry wood shavings or straw.',
      },
      {
        id: 'atask_feed_ducks',
        animalId: 'animal_ducks',
        animalName: 'Ducks — Pen A',
        animalType: 'duck',
        taskKind: 'feeding',
        title: 'Feed ducks & refresh water',
        everyDays: 1,
        lastDoneDate: addDays(today, -1),
        notes: 'Refill deep water trough and check pen.',
      },
    ];

    for (const at of starterAnimalTasks) {
      seedBatch.set(doc(db, 'farms', defaultFarmId, 'animalTasks', at.id), {
        farmId: defaultFarmId,
        ownerId: user.uid,
        animalId: at.animalId,
        animalName: at.animalName,
        animalType: at.animalType,
        taskKind: at.taskKind,
        title: at.title,
        everyDays: at.everyDays,
        lastDoneDate: at.lastDoneDate,
        assigneeId: mOwnerId,
        assigneeUid: user.uid,
        notes: at.notes,
        createdAt: now,
        updatedAt: now,
      });
    }

    await seedBatch.commit();
    return {
      farmId: defaultFarmId,
      role: 'manager',
      memberId: 'member_owner',
      farmName: 'My Farm',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `farms/${defaultFarmId}`);
  }
}

export async function switchWorkspaceToOwnFarm(user: User): Promise<WorkspaceSession> {
  const defaultFarmId = sanitizeId(`farm_${user.uid}`);
  try {
    const farmSnap = await getDoc(doc(db, 'farms', defaultFarmId));
    if (farmSnap.exists()) {
      const farmName = clampString(String(farmSnap.data().name || 'My Farm'), SCHEMA_LIMITS.NAME_MAX);
      await updateDoc(doc(db, 'users', user.uid), {
        activeFarmId: defaultFarmId,
        activeRole: 'manager',
        activeMemberId: 'member_owner',
        activeFarmName: farmName,
        updatedAt: serverTimestamp(),
      });
      return {
        farmId: defaultFarmId,
        role: 'manager',
        memberId: 'member_owner',
        farmName,
      };
    }
    // Create their own farm from scratch
    await updateDoc(doc(db, 'users', user.uid), {
      activeFarmId: '',
      activeRole: 'manager',
      activeMemberId: '',
      activeFarmName: 'My Farm',
      updatedAt: serverTimestamp(),
    });
    return await ensureFarmWorkspace(user);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
  }
}

// =============================================================================
// Worker Invite Code Generation & Claiming
// =============================================================================

export async function generateMemberInviteCode(params: {
  farm: Farm;
  member: FarmMember;
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
}): Promise<string> {
  const { farm, member, plants, fishTanks, animalTasks, tasks } = params;
  const code = generateInviteCode();
  const now = serverTimestamp();

  const initialPlantIds = plants
    .filter(
      (p) =>
        p.waterAssigneeId === member.id ||
        p.mulchAssigneeId === member.id ||
        p.pruneAssigneeId === member.id
    )
    .map((p) => p.id)
    .slice(0, 10);

  const initialTankIds = fishTanks
    .filter((t) => t.assigneeId === member.id)
    .map((t) => t.id)
    .slice(0, 10);

  const initialAnimalTaskIds = animalTasks
    .filter((a) => a.assigneeId === member.id)
    .map((a) => a.id)
    .slice(0, 10);

  const initialCustomTaskIds = tasks
    .filter((t) => t.assigneeId === member.id)
    .map((t) => t.id)
    .slice(0, 10);

  const batch = writeBatch(db);
  batch.set(doc(db, 'farmInvites', code), {
    code,
    farmId: farm.id,
    farmName: clampString(farm.name, SCHEMA_LIMITS.NAME_MAX) || 'My Farm',
    ownerId: farm.ownerId,
    memberId: member.id,
    memberName: clampString(member.name, SCHEMA_LIMITS.NAME_MAX),
    status: 'open',
    claimedByUid: '',
    initialPlantIds,
    initialTankIds,
    initialAnimalTaskIds,
    initialCustomTaskIds,
    createdAt: now,
    updatedAt: now,
  });

  batch.update(doc(db, 'farms', farm.id, 'members', member.id), {
    inviteCode: code,
    linkedUid: '',
    updatedAt: now,
  });

  try {
    await batch.commit();
    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `farmInvites/${code}`);
  }
}

export async function claimFarmInviteCode(params: {
  user: User;
  rawCode: string;
}): Promise<WorkspaceSession> {
  const { user, rawCode } = params;
  const code = sanitizeInviteCode(rawCode);
  if (code.length < 6) {
    throw new Error('Please enter the 6-character code from your farm manager.');
  }

  let invite: FarmInvite | null = null;
  try {
    const snap = await getDoc(doc(db, 'farmInvites', code));
    if (!snap.exists()) {
      throw new Error('Code not found. Check the spelling with your farm manager.');
    }
    invite = snap.data() as FarmInvite;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Code not found')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, `farmInvites/${code}`);
  }

  if (!invite) {
    throw new Error('Code not found.');
  }
  if (invite.ownerId === user.uid) {
    throw new Error('You are already the manager of this farm.');
  }
  if (invite.status !== 'open') {
    throw new Error('This code has already been used. Ask your manager for a new code.');
  }

  const now = serverTimestamp();

  // Step 1: Atomic invite claim + member UID binding (verified by getAfter in firestore.rules)
  try {
    const claimBatch = writeBatch(db);
    claimBatch.update(doc(db, 'farmInvites', code), {
      status: 'claimed',
      claimedByUid: user.uid,
      updatedAt: now,
    });
    claimBatch.update(doc(db, 'farms', invite.farmId, 'members', invite.memberId), {
      linkedUid: user.uid,
      updatedAt: now,
    });
    await claimBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `farmInvites/${code}`);
  }

  // Step 2: Bind worker's UID onto any pre-assigned tasks snapshotted in the invite
  try {
    const bindBatch = writeBatch(db);
    let hasBinds = false;
    const now2 = serverTimestamp();

    for (const plantId of invite.initialPlantIds || []) {
      const pRef = doc(db, 'farms', invite.farmId, 'plants', plantId);
      // We update via get? No, worker can't read plant before binding!
      // Instead, only tanks, animalTasks, and customTasks have single assigneeUid we can bind cleanly
      void pRef;
    }

    for (const tankId of invite.initialTankIds || []) {
      bindBatch.update(doc(db, 'farms', invite.farmId, 'fishTanks', tankId), {
        assigneeUid: user.uid,
        updatedAt: now2,
      });
      hasBinds = true;
    }

    for (const aTaskId of invite.initialAnimalTaskIds || []) {
      bindBatch.update(doc(db, 'farms', invite.farmId, 'animalTasks', aTaskId), {
        assigneeUid: user.uid,
        updatedAt: now2,
      });
      hasBinds = true;
    }

    for (const cTaskId of invite.initialCustomTaskIds || []) {
      bindBatch.update(doc(db, 'farms', invite.farmId, 'tasks', cTaskId), {
        assigneeUid: user.uid,
        updatedAt: now2,
      });
      hasBinds = true;
    }

    if (hasBinds) {
      await bindBatch.commit();
    }
  } catch {
    // Non-fatal: manager auto-sync also binds all assigned tasks automatically
  }

  // Step 3: Save worker's active farm session in /users/{uid}
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    const displayName =
      clampString(user.displayName || invite.memberName, SCHEMA_LIMITS.DISPLAY_NAME_MAX) ||
      invite.memberName;

    if (userSnap.exists()) {
      await updateDoc(userRef, {
        activeFarmId: invite.farmId,
        activeRole: 'worker',
        activeMemberId: invite.memberId,
        activeFarmName: invite.farmName,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        activeFarmId: invite.farmId,
        activeRole: 'worker',
        activeMemberId: invite.memberId,
        activeFarmName: invite.farmName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }

  return {
    farmId: invite.farmId,
    role: 'worker',
    memberId: invite.memberId,
    farmName: invite.farmName,
  };
}

export async function syncLinkedMemberAssignments(params: {
  farm: Farm;
  members: FarmMember[];
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
}): Promise<void> {
  const { farm, members, plants, fishTanks, animalTasks, tasks } = params;
  const uidByMemberId = new Map<string, string>();
  for (const m of members) {
    uidByMemberId.set(m.id, m.active ? sanitizeId(m.linkedUid || '') : '');
  }

  const batch = writeBatch(db);
  const now = serverTimestamp();
  let changes = 0;

  for (const p of plants) {
    const expectedWater = uidByMemberId.get(p.waterAssigneeId) ?? '';
    const expectedMulch = uidByMemberId.get(p.mulchAssigneeId) ?? '';
    const expectedPrune = uidByMemberId.get(p.pruneAssigneeId) ?? '';
    if (
      p.waterAssigneeUid !== expectedWater ||
      p.mulchAssigneeUid !== expectedMulch ||
      p.pruneAssigneeUid !== expectedPrune
    ) {
      batch.update(doc(db, 'farms', farm.id, 'plants', p.id), {
        waterAssigneeUid: expectedWater,
        mulchAssigneeUid: expectedMulch,
        pruneAssigneeUid: expectedPrune,
        updatedAt: now,
      });
      changes += 1;
    }
  }

  for (const t of fishTanks) {
    const expected = uidByMemberId.get(t.assigneeId) ?? '';
    if (t.assigneeUid !== expected) {
      batch.update(doc(db, 'farms', farm.id, 'fishTanks', t.id), {
        assigneeUid: expected,
        updatedAt: now,
      });
      changes += 1;
    }
  }

  for (const at of animalTasks) {
    const expected = uidByMemberId.get(at.assigneeId) ?? '';
    if (at.assigneeUid !== expected) {
      batch.update(doc(db, 'farms', farm.id, 'animalTasks', at.id), {
        assigneeUid: expected,
        updatedAt: now,
      });
      changes += 1;
    }
  }

  for (const task of tasks) {
    const expected = uidByMemberId.get(task.assigneeId) ?? '';
    if (task.assigneeUid !== expected) {
      batch.update(doc(db, 'farms', farm.id, 'tasks', task.id), {
        assigneeUid: expected,
        updatedAt: now,
      });
      changes += 1;
    }
  }

  if (changes > 0) {
    try {
      await batch.commit();
    } catch {
      // Best-effort background sync
    }
  }
}

// =============================================================================
// Settings, People, Plants, Fish Tanks, Animals, Animal Tasks, Custom Tasks
// =============================================================================

export async function updateFarmSettings(
  farmId: string,
  updates: { name: string; location: string; volumeUnit: VolumeUnit }
): Promise<void> {
  const path = `farms/${farmId}`;
  try {
    await updateDoc(doc(db, 'farms', farmId), {
      name: clampString(updates.name, SCHEMA_LIMITS.NAME_MAX) || 'My Farm',
      location: clampString(updates.location, SCHEMA_LIMITS.LOCATION_MAX),
      volumeUnit: updates.volumeUnit,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveFarmMember(
  farm: Farm,
  payload: {
    id?: string;
    name: string;
    role: MemberRole;
    specialty: string;
    linkedUid?: string;
    inviteCode?: string;
    active: boolean;
  }
): Promise<void> {
  const memberId = payload.id ? sanitizeId(payload.id) : generateDocId('member');
  const path = `farms/${farm.id}/members/${memberId}`;
  const now = serverTimestamp();

  try {
    if (payload.id) {
      await updateDoc(doc(db, 'farms', farm.id, 'members', memberId), {
        name: clampString(payload.name, SCHEMA_LIMITS.NAME_MAX) || 'Farm Worker',
        role: payload.role,
        specialty: clampString(payload.specialty, SCHEMA_LIMITS.SPECIALTY_MAX),
        linkedUid: sanitizeId(payload.linkedUid || ''),
        inviteCode: sanitizeInviteCode(payload.inviteCode || ''),
        active: Boolean(payload.active),
        updatedAt: now,
      });
    } else {
      await setDoc(doc(db, 'farms', farm.id, 'members', memberId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        name: clampString(payload.name, SCHEMA_LIMITS.NAME_MAX) || 'Farm Worker',
        role: payload.role,
        specialty: clampString(payload.specialty, SCHEMA_LIMITS.SPECIALTY_MAX),
        linkedUid: sanitizeId(payload.linkedUid || ''),
        inviteCode: '',
        active: Boolean(payload.active),
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    handleFirestoreError(error, payload.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteFarmMember(farmId: string, memberId: string): Promise<void> {
  const path = `farms/${farmId}/members/${memberId}`;
  try {
    await deleteDoc(doc(db, 'farms', farmId, 'members', memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePlantSchedule(
  farm: Farm,
  members: FarmMember[],
  payload: Omit<
    PlantSchedule,
    'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt' | 'waterAssigneeUid' | 'mulchAssigneeUid' | 'pruneAssigneeUid'
  > & { id?: string }
): Promise<void> {
  const plantId = payload.id ? sanitizeId(payload.id) : generateDocId('plant');
  const path = `farms/${farm.id}/plants/${plantId}`;
  const now = serverTimestamp();

  const resolveUid = (memberId: string) =>
    sanitizeId(members.find((m) => m.id === memberId)?.linkedUid || '');

  const sanitized = {
    name: clampString(payload.name, SCHEMA_LIMITS.NAME_MAX) || 'Unnamed Plant',
    zone: clampString(payload.zone, SCHEMA_LIMITS.ZONE_MAX) || 'Main Plot',
    category: payload.category,
    waterEnabled: Boolean(payload.waterEnabled),
    waterEveryDays: clampInt(payload.waterEveryDays, SCHEMA_LIMITS.WATER_DAYS_MIN, SCHEMA_LIMITS.WATER_DAYS_MAX),
    lastWateredDate: payload.lastWateredDate || '',
    waterAssigneeId: sanitizeId(payload.waterAssigneeId || ''),
    waterAssigneeUid: resolveUid(payload.waterAssigneeId || ''),
    mulchEnabled: Boolean(payload.mulchEnabled),
    mulchEveryDays: clampInt(payload.mulchEveryDays, SCHEMA_LIMITS.CARE_DAYS_MIN, SCHEMA_LIMITS.CARE_DAYS_MAX),
    lastMulchedDate: payload.lastMulchedDate || '',
    mulchAssigneeId: sanitizeId(payload.mulchAssigneeId || ''),
    mulchAssigneeUid: resolveUid(payload.mulchAssigneeId || ''),
    pruneEnabled: Boolean(payload.pruneEnabled),
    pruneEveryDays: clampInt(payload.pruneEveryDays, SCHEMA_LIMITS.CARE_DAYS_MIN, SCHEMA_LIMITS.CARE_DAYS_MAX),
    lastPrunedDate: payload.lastPrunedDate || '',
    pruneAssigneeId: sanitizeId(payload.pruneAssigneeId || ''),
    pruneAssigneeUid: resolveUid(payload.pruneAssigneeId || ''),
    receivesFishWater: Boolean(payload.receivesFishWater),
    notes: clampString(payload.notes || '', SCHEMA_LIMITS.NOTES_MAX),
  };

  try {
    if (payload.id) {
      await updateDoc(doc(db, 'farms', farm.id, 'plants', plantId), {
        ...sanitized,
        updatedAt: now,
      });
    } else {
      await setDoc(doc(db, 'farms', farm.id, 'plants', plantId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        ...sanitized,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    handleFirestoreError(error, payload.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function disablePlantCareSchedule(
  farmId: string,
  plantId: string,
  careType: 'water' | 'mulch' | 'prune'
): Promise<void> {
  const path = `farms/${farmId}/plants/${plantId}`;
  const field =
    careType === 'water'
      ? 'waterEnabled'
      : careType === 'mulch'
        ? 'mulchEnabled'
        : 'pruneEnabled';
  try {
    await updateDoc(doc(db, 'farms', farmId, 'plants', plantId), {
      [field]: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePlantSchedule(farmId: string, plantId: string): Promise<void> {
  const path = `farms/${farmId}/plants/${plantId}`;
  try {
    await deleteDoc(doc(db, 'farms', farmId, 'plants', plantId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveFishTank(
  farm: Farm,
  members: FarmMember[],
  payload: Omit<FishTank, 'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt' | 'assigneeUid'> & {
    id?: string;
  }
): Promise<void> {
  const tankId = payload.id ? sanitizeId(payload.id) : generateDocId('tank');
  const path = `farms/${farm.id}/fishTanks/${tankId}`;
  const now = serverTimestamp();
  const assigneeUid = sanitizeId(members.find((m) => m.id === payload.assigneeId)?.linkedUid || '');

  const cleanBeds = payload.irrigationBedIds
    .map((id) => sanitizeId(id))
    .filter((id) => id.length > 0)
    .slice(0, SCHEMA_LIMITS.MAX_IRRIGATION_BEDS);

  const sanitized = {
    name: clampString(payload.name, SCHEMA_LIMITS.NAME_MAX) || 'Fish Tank',
    species: clampString(payload.species, SCHEMA_LIMITS.NAME_MAX) || 'Catfish',
    capacityLiters: clampInt(payload.capacityLiters, SCHEMA_LIMITS.TANK_CAPACITY_MIN, SCHEMA_LIMITS.TANK_CAPACITY_MAX),
    intervalDays: clampInt(payload.intervalDays, SCHEMA_LIMITS.TANK_INTERVAL_MIN, SCHEMA_LIMITS.TANK_INTERVAL_MAX),
    currentStage: (payload.currentStage === 1 || payload.currentStage === 2 || payload.currentStage === 3
      ? payload.currentStage
      : 1) as TankStage,
    nextDrawdownDate: payload.nextDrawdownDate || getTodayDateKey(),
    lastDrawdownDate: payload.lastDrawdownDate || '',
    assigneeId: sanitizeId(payload.assigneeId || ''),
    assigneeUid,
    irrigationBedIds: cleanBeds,
    notes: clampString(payload.notes || '', SCHEMA_LIMITS.NOTES_MAX),
  };

  try {
    if (payload.id) {
      await updateDoc(doc(db, 'farms', farm.id, 'fishTanks', tankId), {
        ...sanitized,
        updatedAt: now,
      });
    } else {
      await setDoc(doc(db, 'farms', farm.id, 'fishTanks', tankId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        ...sanitized,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    handleFirestoreError(error, payload.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteFishTank(farmId: string, tankId: string): Promise<void> {
  const path = `farms/${farmId}/fishTanks/${tankId}`;
  try {
    await deleteDoc(doc(db, 'farms', farmId, 'fishTanks', tankId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveAnimalGroup(
  farm: Farm,
  payload: Omit<AnimalGroup, 'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  }
): Promise<string> {
  const animalId = payload.id ? sanitizeId(payload.id) : generateDocId('animal');
  const path = `farms/${farm.id}/animals/${animalId}`;
  const now = serverTimestamp();

  const sanitized = {
    name: clampString(payload.name, SCHEMA_LIMITS.NAME_MAX) || 'Animal Group',
    animalType: payload.animalType,
    count: clampInt(payload.count, 0, 1000000),
    housing: clampString(payload.housing || '', SCHEMA_LIMITS.HOUSING_MAX),
    notes: clampString(payload.notes || '', SCHEMA_LIMITS.NOTES_MAX),
  };

  try {
    if (payload.id) {
      await updateDoc(doc(db, 'farms', farm.id, 'animals', animalId), {
        ...sanitized,
        updatedAt: now,
      });
    } else {
      await setDoc(doc(db, 'farms', farm.id, 'animals', animalId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        ...sanitized,
        createdAt: now,
        updatedAt: now,
      });
    }
    return animalId;
  } catch (error) {
    handleFirestoreError(error, payload.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteAnimalGroup(
  farmId: string,
  animalId: string,
  linkedTasks: AnimalTask[]
): Promise<void> {
  const path = `farms/${farmId}/animals/${animalId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'farms', farmId, 'animals', animalId));
    for (const t of linkedTasks) {
      if (t.animalId === animalId) {
        batch.delete(doc(db, 'farms', farmId, 'animalTasks', t.id));
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveAnimalTask(
  farm: Farm,
  members: FarmMember[],
  payload: Omit<AnimalTask, 'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt' | 'assigneeUid'> & {
    id?: string;
  }
): Promise<void> {
  const taskId = payload.id ? sanitizeId(payload.id) : generateDocId('atask');
  const path = `farms/${farm.id}/animalTasks/${taskId}`;
  const now = serverTimestamp();
  const assigneeUid = sanitizeId(members.find((m) => m.id === payload.assigneeId)?.linkedUid || '');

  const sanitized = {
    animalId: sanitizeId(payload.animalId || ''),
    animalName: clampString(payload.animalName, SCHEMA_LIMITS.NAME_MAX) || 'Animals',
    animalType: payload.animalType,
    taskKind: payload.taskKind,
    title: clampString(payload.title, SCHEMA_LIMITS.TITLE_MAX) || 'Animal Care Task',
    everyDays: clampInt(payload.everyDays, SCHEMA_LIMITS.CARE_DAYS_MIN, SCHEMA_LIMITS.CARE_DAYS_MAX),
    lastDoneDate: payload.lastDoneDate || '',
    assigneeId: sanitizeId(payload.assigneeId || ''),
    assigneeUid,
    notes: clampString(payload.notes || '', SCHEMA_LIMITS.NOTES_MAX),
  };

  try {
    if (payload.id) {
      await updateDoc(doc(db, 'farms', farm.id, 'animalTasks', taskId), {
        ...sanitized,
        updatedAt: now,
      });
    } else {
      await setDoc(doc(db, 'farms', farm.id, 'animalTasks', taskId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        ...sanitized,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    handleFirestoreError(error, payload.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteAnimalTask(farmId: string, taskId: string): Promise<void> {
  const path = `farms/${farmId}/animalTasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'farms', farmId, 'animalTasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCustomTask(
  farm: Farm,
  members: FarmMember[],
  payload: Omit<CustomTask, 'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt' | 'assigneeUid'> & {
    id?: string;
  }
): Promise<void> {
  const taskId = payload.id ? sanitizeId(payload.id) : generateDocId('task');
  const path = `farms/${farm.id}/tasks/${taskId}`;
  const now = serverTimestamp();
  const assigneeUid = sanitizeId(members.find((m) => m.id === payload.assigneeId)?.linkedUid || '');

  const sanitized = {
    title: clampString(payload.title, SCHEMA_LIMITS.TITLE_MAX) || 'Farm Task',
    category: payload.category,
    dueDate: payload.dueDate || getTodayDateKey(),
    recurrenceDays: clampInt(payload.recurrenceDays, 0, SCHEMA_LIMITS.RECURRENCE_MAX),
    assigneeId: sanitizeId(payload.assigneeId || ''),
    assigneeUid,
    status: payload.status,
    completedDate: payload.completedDate || '',
    notes: clampString(payload.notes || '', SCHEMA_LIMITS.NOTES_MAX),
  };

  try {
    if (payload.id) {
      await updateDoc(doc(db, 'farms', farm.id, 'tasks', taskId), {
        ...sanitized,
        updatedAt: now,
      });
    } else {
      await setDoc(doc(db, 'farms', farm.id, 'tasks', taskId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        ...sanitized,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    handleFirestoreError(error, payload.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCustomTask(farmId: string, taskId: string): Promise<void> {
  const path = `farms/${farmId}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'farms', farmId, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Daily Task Submission + Mandatory Manager Confirmation Workflow
// =============================================================================

function applyScheduleAdvancementToBatch(params: {
  batch: ReturnType<typeof writeBatch>;
  farm: Farm;
  user: User;
  dateKey: string;
  taskType: CompletionLog['taskType'];
  sourceId: string;
  tankStageLabel?: '' | '1/4' | '2/4' | '3/4';
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
  members: FarmMember[];
  alsoWaterLinkedBeds: boolean;
  confirmedByName: string;
  now: ReturnType<typeof serverTimestamp>;
}) {
  const {
    batch,
    farm,
    user,
    dateKey,
    taskType,
    sourceId,
    tankStageLabel,
    plants,
    fishTanks,
    animalTasks,
    tasks,
    members,
    alsoWaterLinkedBeds,
    confirmedByName,
    now,
  } = params;

  if (taskType === 'water' || taskType === 'mulch' || taskType === 'prune') {
    const fieldName =
      taskType === 'water'
        ? 'lastWateredDate'
        : taskType === 'mulch'
          ? 'lastMulchedDate'
          : 'lastPrunedDate';
    batch.update(doc(db, 'farms', farm.id, 'plants', sourceId), {
      [fieldName]: dateKey,
      updatedAt: now,
    });
  } else if (taskType === 'animal') {
    const existsTask = animalTasks.find((a) => a.id === sourceId);
    if (existsTask) {
      batch.update(doc(db, 'farms', farm.id, 'animalTasks', sourceId), {
        lastDoneDate: dateKey,
        updatedAt: now,
      });
    }
  } else if (taskType === 'fish_tank') {
    const tank = fishTanks.find((t) => t.id === sourceId);
    if (!tank) return;
    const stageDone: TankStage =
      tankStageLabel === '3/4' ? 3 : tankStageLabel === '2/4' ? 2 : tankStageLabel === '1/4' ? 1 : tank.currentStage;
    const stageStr = stageToLabel(stageDone);
    const volumeLiters = Math.round((tank.capacityLiters * stageDone) / 4);
    const upcomingStage = nextTankStage(stageDone);
    const nextDate = addDays(dateKey, tank.intervalDays);

    batch.update(doc(db, 'farms', farm.id, 'fishTanks', tank.id), {
      currentStage: upcomingStage,
      lastDrawdownDate: dateKey,
      nextDrawdownDate: nextDate,
      updatedAt: now,
    });

    if (alsoWaterLinkedBeds) {
      const linkedBeds = plants.filter((p) => tank.irrigationBedIds.includes(p.id));
      const perBedVolume = linkedBeds.length > 0 ? Math.round(volumeLiters / linkedBeds.length) : 0;
      for (const bed of linkedBeds) {
        batch.update(doc(db, 'farms', farm.id, 'plants', bed.id), {
          lastWateredDate: dateKey,
          updatedAt: now,
        });
        const bedAssigneeName =
          members.find((m) => m.id === bed.waterAssigneeId)?.name || confirmedByName;
        const bedCompId = generateDocId('irr');
        batch.set(doc(db, 'farms', farm.id, 'completions', bedCompId), {
          farmId: farm.id,
          ownerId: farm.ownerId,
          dateKey,
          taskType: 'water',
          sourceId: bed.id,
          sourceTitle: clampString(`Water ${bed.name}`, SCHEMA_LIMITS.TITLE_MAX),
          assignedMemberId: sanitizeId(bed.waterAssigneeId || tank.assigneeId || ''),
          assignedMemberName: clampString(bedAssigneeName, SCHEMA_LIMITS.NAME_MAX),
          assignedUid: sanitizeId(bed.waterAssigneeUid || ''),
          completedByUid: user.uid,
          completedByName: confirmedByName,
          status: 'done',
          approvalStatus: 'confirmed',
          confirmedByUid: user.uid,
          confirmedByName,
          waterVolumeLiters: clampInt(perBedVolume, 0, 1000000),
          tankStage: stageStr,
          notes: clampString(
            `Watered with ${stageStr} water from ${tank.name}`,
            SCHEMA_LIMITS.COMPLETION_NOTES_MAX
          ),
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  } else if (taskType === 'custom') {
    const task = tasks.find((t) => t.id === sourceId);
    if (!task) return;
    if (task.recurrenceDays > 0) {
      batch.update(doc(db, 'farms', farm.id, 'tasks', task.id), {
        dueDate: addDays(dateKey, task.recurrenceDays),
        completedDate: dateKey,
        updatedAt: now,
      });
    } else {
      batch.update(doc(db, 'farms', farm.id, 'tasks', task.id), {
        status: 'completed',
        completedDate: dateKey,
        updatedAt: now,
      });
    }
  }
}

export async function completeScheduledActivity(params: {
  farm: Farm;
  user: User;
  userRole: MemberRole;
  activeMemberId: string;
  activity: ScheduledActivity;
  dateKey: string;
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
  members: FarmMember[];
  signOffNote?: string;
  alsoWaterLinkedBeds?: boolean;
  actingMemberName?: string;
  submitForConfirmation?: boolean;
}): Promise<'pending_confirmation' | 'confirmed'> {
  const {
    farm,
    user,
    userRole,
    activeMemberId,
    activity,
    dateKey,
    plants,
    fishTanks,
    animalTasks,
    tasks,
    members,
    signOffNote = '',
    alsoWaterLinkedBeds = true,
    actingMemberName,
    submitForConfirmation,
  } = params;

  const now = serverTimestamp();
  const completionId = generateDocId('done');
  const isWorker = userRole === 'worker';
  const requiresConfirmation = isWorker || Boolean(submitForConfirmation);

  const completedByName =
    clampString(actingMemberName || user.displayName || 'Farm Worker', SCHEMA_LIMITS.NAME_MAX) ||
    'Farm Worker';
  const assignedMemberName =
    clampString(activity.assigneeName || 'Unassigned', SCHEMA_LIMITS.NAME_MAX) || 'Unassigned';

  const stageLabel: '' | '1/4' | '2/4' | '3/4' =
    activity.taskType === 'fish_tank' ? activity.tankStageLabel || '1/4' : '';
  const volumeLiters =
    activity.taskType === 'fish_tank' ? clampInt(activity.waterVolumeLiters || 0, 0, 1000000) : 0;

  const logPath = `farms/${farm.id}/completions/${completionId}`;
  const batch = writeBatch(db);

  try {
    batch.set(doc(db, 'farms', farm.id, 'completions', completionId), {
      farmId: farm.id,
      ownerId: farm.ownerId,
      dateKey,
      taskType: activity.taskType,
      sourceId: activity.sourceId,
      sourceTitle: clampString(activity.title, SCHEMA_LIMITS.TITLE_MAX),
      assignedMemberId: sanitizeId(
        isWorker ? activeMemberId : activity.assigneeId || ''
      ),
      assignedMemberName,
      assignedUid: sanitizeId(isWorker ? user.uid : activity.assigneeUid || ''),
      completedByUid: user.uid,
      completedByName,
      status: 'done',
      approvalStatus: requiresConfirmation ? 'pending_confirmation' : 'confirmed',
      confirmedByUid: requiresConfirmation ? '' : user.uid,
      confirmedByName: requiresConfirmation ? '' : completedByName,
      waterVolumeLiters: volumeLiters,
      tankStage: stageLabel,
      notes: clampString(signOffNote, SCHEMA_LIMITS.COMPLETION_NOTES_MAX),
      createdAt: now,
      updatedAt: now,
    });

    if (!requiresConfirmation) {
      applyScheduleAdvancementToBatch({
        batch,
        farm,
        user,
        dateKey,
        taskType: activity.taskType,
        sourceId: activity.sourceId,
        tankStageLabel: stageLabel,
        plants,
        fishTanks,
        animalTasks,
        tasks,
        members,
        alsoWaterLinkedBeds,
        confirmedByName: completedByName,
        now,
      });
    }

    await batch.commit();
    return requiresConfirmation ? 'pending_confirmation' : 'confirmed';
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, logPath);
  }
}

export async function confirmWorkerCompletion(params: {
  farm: Farm;
  user: User;
  log: CompletionLog;
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
  members: FarmMember[];
  alsoWaterLinkedBeds?: boolean;
}): Promise<void> {
  const {
    farm,
    user,
    log,
    plants,
    fishTanks,
    animalTasks,
    tasks,
    members,
    alsoWaterLinkedBeds = true,
  } = params;

  const now = serverTimestamp();
  const managerName =
    clampString(user.displayName || 'Farm Manager', SCHEMA_LIMITS.NAME_MAX) || 'Farm Manager';
  const batch = writeBatch(db);
  const path = `farms/${farm.id}/completions/${log.id}`;

  try {
    batch.update(doc(db, 'farms', farm.id, 'completions', log.id), {
      approvalStatus: 'confirmed',
      confirmedByUid: user.uid,
      confirmedByName: managerName,
      updatedAt: now,
    });

    applyScheduleAdvancementToBatch({
      batch,
      farm,
      user,
      dateKey: log.dateKey,
      taskType: log.taskType,
      sourceId: log.sourceId,
      tankStageLabel: log.tankStage,
      plants,
      fishTanks,
      animalTasks,
      tasks,
      members,
      alsoWaterLinkedBeds,
      confirmedByName: managerName,
      now,
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function undoCompletionLog(params: {
  farmId: string;
  log: CompletionLog;
  fishTanks: FishTank[];
  tasks: CustomTask[];
  isManager: boolean;
}): Promise<void> {
  const { farmId, log, fishTanks, tasks, isManager } = params;
  const path = `farms/${farmId}/completions/${log.id}`;
  const batch = writeBatch(db);
  const now = serverTimestamp();
  const wasConfirmed = (log.approvalStatus ?? 'confirmed') === 'confirmed';

  try {
    batch.delete(doc(db, 'farms', farmId, 'completions', log.id));

    // Only revert schedule pointers if the completion was already confirmed by the manager
    if (isManager && wasConfirmed) {
      if (log.taskType === 'fish_tank') {
        const tank = fishTanks.find((t) => t.id === log.sourceId);
        if (tank) {
          const prevStage: TankStage =
            log.tankStage === '3/4' ? 3 : log.tankStage === '2/4' ? 2 : 1;
          batch.update(doc(db, 'farms', farmId, 'fishTanks', tank.id), {
            currentStage: prevStage,
            nextDrawdownDate: log.dateKey,
            updatedAt: now,
          });
        }
      } else if (log.taskType === 'custom') {
        const task = tasks.find((t) => t.id === log.sourceId);
        if (task) {
          batch.update(doc(db, 'farms', farmId, 'tasks', task.id), {
            status: 'pending',
            dueDate: log.dateKey,
            completedDate: '',
            updatedAt: now,
          });
        }
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
