import type { User } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CompletionLog,
  CustomTask,
  Farm,
  FarmMember,
  FishTank,
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
  getTodayDateKey,
  nextTankStage,
  sanitizeId,
  stageToLabel,
} from '../utils/schedule';

export async function ensureFarmWorkspace(user: User): Promise<string> {
  const userPath = `users/${user.uid}`;
  const defaultFarmId = sanitizeId(`farm_${user.uid}`);

  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (typeof data.activeFarmId === 'string' && data.activeFarmId.length > 0) {
        const farmSnap = await getDoc(doc(db, 'farms', data.activeFarmId));
        if (farmSnap.exists()) {
          return data.activeFarmId;
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  // First-time farm bootstrap — seed realistic farm beds, crew, and fish tank 1/4 -> 2/4 -> 3/4 cycle
  const today = getTodayDateKey();
  const displayName = clampString(user.displayName || 'Farm Manager', SCHEMA_LIMITS.DISPLAY_NAME_MAX) || 'Farm Manager';

  try {
    const now = serverTimestamp();

    // Create user profile & root farm first so subcollection security rules see parent farm exists
    const rootBatch = writeBatch(db);
    rootBatch.set(doc(db, 'users', user.uid), {
      uid: user.uid,
      displayName,
      activeFarmId: defaultFarmId,
      createdAt: now,
      updatedAt: now,
    });
    rootBatch.set(doc(db, 'farms', defaultFarmId), {
      ownerId: user.uid,
      name: 'Greenridge Integrated Farm',
      location: 'Main Homestead Plot',
      volumeUnit: 'L' as VolumeUnit,
      createdAt: now,
      updatedAt: now,
    });
    await rootBatch.commit();

    // Seed initial crew, plants, fish tanks, and custom tasks
    const seedBatch = writeBatch(db);

    const mOwnerId = 'member_owner';
    const mAdaId = 'member_ada';
    const mChidiId = 'member_chidi';
    const mSamuelId = 'member_samuel';

    const membersSeed = [
      {
        id: mOwnerId,
        name: displayName.slice(0, SCHEMA_LIMITS.NAME_MAX),
        role: 'manager',
        specialty: 'Farm Operations & Oversight',
        linkedUid: user.uid,
      },
      {
        id: mAdaId,
        name: 'Ada Okafor',
        role: 'worker',
        specialty: 'Fish Tanks & Effluent Irrigation',
        linkedUid: '',
      },
      {
        id: mChidiId,
        name: 'Chidi Eze',
        role: 'worker',
        specialty: 'Vegetable Beds & Pruning',
        linkedUid: '',
      },
      {
        id: mSamuelId,
        name: 'Samuel Bello',
        role: 'worker',
        specialty: 'Mulching & Orchard Care',
        linkedUid: '',
      },
    ];

    for (const m of membersSeed) {
      seedBatch.set(doc(db, 'farms', defaultFarmId, 'members', m.id), {
        farmId: defaultFarmId,
        ownerId: user.uid,
        name: m.name,
        role: m.role,
        specialty: m.specialty,
        linkedUid: m.linkedUid,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const pTomatoId = 'plant_roma_tomatoes';
    const pPepperId = 'plant_peppers';
    const pUguId = 'plant_fluted_pumpkin';
    const pBasilId = 'plant_basil_mint';
    const pCitrusId = 'plant_citrus_orchard';

    const plantsSeed = [
      {
        id: pTomatoId,
        name: 'Roma Tomatoes — Bed A1',
        zone: 'North Raised Beds',
        category: 'vegetable',
        waterEnabled: true,
        waterEveryDays: 2,
        lastWateredDate: addDays(today, -2), // Due today
        waterAssigneeId: mAdaId,
        mulchEnabled: true,
        mulchEveryDays: 21,
        lastMulchedDate: addDays(today, -21), // Due today
        mulchAssigneeId: mSamuelId,
        pruneEnabled: true,
        pruneEveryDays: 14,
        lastPrunedDate: addDays(today, -10), // Due in 4 days
        pruneAssigneeId: mChidiId,
        receivesFishWater: true,
        notes: 'Stake indeterminate stems and pinch lower suckers; responds well to fish tank effluent.',
      },
      {
        id: pPepperId,
        name: 'Scotch Bonnet Peppers — Bed A2',
        zone: 'North Raised Beds',
        category: 'vegetable',
        waterEnabled: true,
        waterEveryDays: 2,
        lastWateredDate: addDays(today, -2), // Due today
        waterAssigneeId: mAdaId,
        mulchEnabled: true,
        mulchEveryDays: 28,
        lastMulchedDate: addDays(today, -18),
        mulchAssigneeId: mSamuelId,
        pruneEnabled: true,
        pruneEveryDays: 21,
        lastPrunedDate: addDays(today, -22), // 1 day overdue
        pruneAssigneeId: mChidiId,
        receivesFishWater: true,
        notes: 'Keep 5 cm straw mulch ring away from crown to prevent stem rot.',
      },
      {
        id: pUguId,
        name: 'Fluted Pumpkin (Ugu) — Bed B1',
        zone: 'East Trellis Plot',
        category: 'vegetable',
        waterEnabled: true,
        waterEveryDays: 1,
        lastWateredDate: addDays(today, -1), // Due today
        waterAssigneeId: mChidiId,
        mulchEnabled: true,
        mulchEveryDays: 30,
        lastMulchedDate: addDays(today, -12),
        mulchAssigneeId: mSamuelId,
        pruneEnabled: true,
        pruneEveryDays: 10,
        lastPrunedDate: addDays(today, -10), // Due today
        pruneAssigneeId: mChidiId,
        receivesFishWater: true,
        notes: 'Harvest tender shoots regularly to stimulate lateral vine growth.',
      },
      {
        id: pBasilId,
        name: 'Sweet Basil & Mint — Herb Strip',
        zone: 'Courtyard Beds',
        category: 'herb',
        waterEnabled: true,
        waterEveryDays: 1,
        lastWateredDate: addDays(today, -1), // Due today
        waterAssigneeId: mChidiId,
        mulchEnabled: false,
        mulchEveryDays: 30,
        lastMulchedDate: '',
        mulchAssigneeId: '',
        pruneEnabled: true,
        pruneEveryDays: 7,
        lastPrunedDate: addDays(today, -5),
        pruneAssigneeId: mChidiId,
        receivesFishWater: false,
        notes: 'Pinch flower buds weekly to keep leaves sweet; water with clean water at root level.',
      },
      {
        id: pCitrusId,
        name: 'Dwarf Citrus & Guava — South Row',
        zone: 'South Orchard',
        category: 'orchard',
        waterEnabled: true,
        waterEveryDays: 4,
        lastWateredDate: addDays(today, -2),
        waterAssigneeId: mSamuelId,
        mulchEnabled: true,
        mulchEveryDays: 45,
        lastMulchedDate: addDays(today, -47), // 2 days overdue
        mulchAssigneeId: mSamuelId,
        pruneEnabled: true,
        pruneEveryDays: 30,
        lastPrunedDate: addDays(today, -15),
        pruneAssigneeId: mOwnerId,
        receivesFishWater: false,
        notes: 'Maintain wide wood-chip mulch basin around drip line.',
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
        waterAssigneeId: p.waterAssigneeId,
        waterAssigneeUid: p.waterAssigneeId === mOwnerId ? user.uid : '',
        mulchEnabled: p.mulchEnabled,
        mulchEveryDays: p.mulchEveryDays,
        lastMulchedDate: p.lastMulchedDate,
        mulchAssigneeId: p.mulchAssigneeId,
        mulchAssigneeUid: p.mulchAssigneeId === mOwnerId ? user.uid : '',
        pruneEnabled: p.pruneEnabled,
        pruneEveryDays: p.pruneEveryDays,
        lastPrunedDate: p.lastPrunedDate,
        pruneAssigneeId: p.pruneAssigneeId,
        pruneAssigneeUid: p.pruneAssigneeId === mOwnerId ? user.uid : '',
        receivesFishWater: p.receivesFishWater,
        notes: p.notes,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Seed 2 Fish Tanks on the exact 1/4 -> 2/4 -> 3/4 every-2-days drawdown cycle
    seedBatch.set(doc(db, 'farms', defaultFarmId, 'fishTanks', 'tank_catfish_1'), {
      farmId: defaultFarmId,
      ownerId: user.uid,
      name: 'Main Catfish Tank 1',
      species: 'African Catfish',
      capacityLiters: 2000,
      intervalDays: 2,
      currentStage: 1, // 1/4 drawdown due today!
      nextDrawdownDate: today,
      lastDrawdownDate: addDays(today, -2),
      assigneeId: mAdaId,
      assigneeUid: '',
      irrigationBedIds: [pTomatoId, pPepperId, pUguId],
      notes: 'Open bottom gravity valve to manifold A. Route nutrient-rich discharge directly to Beds A1, A2, and B1.',
      createdAt: now,
      updatedAt: now,
    });

    seedBatch.set(doc(db, 'farms', defaultFarmId, 'fishTanks', 'tank_tilapia_2'), {
      farmId: defaultFarmId,
      ownerId: user.uid,
      name: 'Tilapia Grow-Out Tank 2',
      species: 'Nile Tilapia',
      capacityLiters: 1600,
      intervalDays: 2,
      currentStage: 2, // 2/4 drawdown due tomorrow
      nextDrawdownDate: addDays(today, 1),
      lastDrawdownDate: addDays(today, -1),
      assigneeId: mAdaId,
      assigneeUid: '',
      irrigationBedIds: [pTomatoId, pUguId],
      notes: 'Flush sediment trap before routing effluent to drip header; refill with dechlorinated borehole water after 3/4 stage.',
      createdAt: now,
      updatedAt: now,
    });

    // Seed 2 Custom Tasks
    seedBatch.set(doc(db, 'farms', defaultFarmId, 'tasks', 'task_pond_ph'), {
      farmId: defaultFarmId,
      ownerId: user.uid,
      title: 'Test fish tank pH, ammonia & aeration stone pressure',
      category: 'maintenance',
      dueDate: today,
      recurrenceDays: 3,
      assigneeId: mAdaId,
      assigneeUid: '',
      status: 'pending',
      completedDate: '',
      notes: 'Target pH 6.8–7.4; clean intake mesh if flow slows.',
      createdAt: now,
      updatedAt: now,
    });

    seedBatch.set(doc(db, 'farms', defaultFarmId, 'tasks', 'task_compost_turn'), {
      farmId: defaultFarmId,
      ownerId: user.uid,
      title: 'Turn compost bay 2 & stage fresh straw mulch bales',
      category: 'mulch',
      dueDate: addDays(today, 2),
      recurrenceDays: 7,
      assigneeId: mSamuelId,
      assigneeUid: '',
      status: 'pending',
      completedDate: '',
      notes: 'Keep moisture evenly damp before applying to orchard rows.',
      createdAt: now,
      updatedAt: now,
    });

    await seedBatch.commit();
    return defaultFarmId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `farms/${defaultFarmId}`);
  }
}

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
    role: 'manager' | 'worker';
    specialty: string;
    linkedUid?: string;
    active: boolean;
  }
): Promise<void> {
  const memberId = payload.id ? sanitizeId(payload.id) : generateDocId('member');
  const path = `farms/${farm.id}/members/${memberId}`;
  const now = serverTimestamp();

  try {
    if (payload.id) {
      await updateDoc(doc(db, 'farms', farm.id, 'members', memberId), {
        name: clampString(payload.name, SCHEMA_LIMITS.NAME_MAX) || 'Crew Member',
        role: payload.role,
        specialty: clampString(payload.specialty, SCHEMA_LIMITS.SPECIALTY_MAX),
        linkedUid: sanitizeId(payload.linkedUid || ''),
        active: Boolean(payload.active),
        updatedAt: now,
      });
    } else {
      await setDoc(doc(db, 'farms', farm.id, 'members', memberId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        name: clampString(payload.name, SCHEMA_LIMITS.NAME_MAX) || 'Crew Member',
        role: payload.role,
        specialty: clampString(payload.specialty, SCHEMA_LIMITS.SPECIALTY_MAX),
        linkedUid: sanitizeId(payload.linkedUid || ''),
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
  payload: Omit<PlantSchedule, 'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt' | 'waterAssigneeUid' | 'mulchAssigneeUid' | 'pruneAssigneeUid'> & {
    id?: string;
  }
): Promise<void> {
  const plantId = payload.id ? sanitizeId(payload.id) : generateDocId('plant');
  const path = `farms/${farm.id}/plants/${plantId}`;
  const now = serverTimestamp();

  const resolveUid = (memberId: string) =>
    sanitizeId(members.find((m) => m.id === memberId)?.linkedUid || '');

  const sanitized = {
    name: clampString(payload.name, SCHEMA_LIMITS.NAME_MAX) || 'Unnamed Crop Bed',
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
    species: clampString(payload.species, SCHEMA_LIMITS.NAME_MAX) || 'Tilapia',
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
    title: clampString(payload.title, SCHEMA_LIMITS.TITLE_MAX) || 'Farm Activity',
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

export async function completeScheduledActivity(params: {
  farm: Farm;
  user: User;
  activity: ScheduledActivity;
  dateKey: string;
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  tasks: CustomTask[];
  members: FarmMember[];
  signOffNote?: string;
  alsoWaterLinkedBeds?: boolean;
  actingMemberName?: string;
}): Promise<void> {
  const {
    farm,
    user,
    activity,
    dateKey,
    plants,
    fishTanks,
    tasks,
    members,
    signOffNote = '',
    alsoWaterLinkedBeds = true,
    actingMemberName,
  } = params;

  const now = serverTimestamp();
  const completionId = generateDocId('done');
  const completedByName =
    clampString(actingMemberName || user.displayName || 'Farm Operator', SCHEMA_LIMITS.NAME_MAX) ||
    'Farm Operator';
  const assignedMemberName =
    clampString(activity.assigneeName || 'Unassigned', SCHEMA_LIMITS.NAME_MAX) || 'Unassigned';

  const batch = writeBatch(db);
  const logPath = `farms/${farm.id}/completions/${completionId}`;

  try {
    if (activity.taskType === 'water' || activity.taskType === 'mulch' || activity.taskType === 'prune') {
      const plantRef = doc(db, 'farms', farm.id, 'plants', activity.sourceId);
      const fieldName =
        activity.taskType === 'water'
          ? 'lastWateredDate'
          : activity.taskType === 'mulch'
            ? 'lastMulchedDate'
            : 'lastPrunedDate';
      batch.update(plantRef, {
        [fieldName]: dateKey,
        updatedAt: now,
      });

      batch.set(doc(db, 'farms', farm.id, 'completions', completionId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        dateKey,
        taskType: activity.taskType,
        sourceId: activity.sourceId,
        sourceTitle: clampString(activity.title, SCHEMA_LIMITS.TITLE_MAX),
        assignedMemberId: sanitizeId(activity.assigneeId || ''),
        assignedMemberName,
        assignedUid: sanitizeId(activity.assigneeUid || ''),
        completedByUid: user.uid,
        completedByName,
        status: 'done',
        waterVolumeLiters: 0,
        tankStage: '',
        notes: clampString(signOffNote, SCHEMA_LIMITS.COMPLETION_NOTES_MAX),
        createdAt: now,
      });
    } else if (activity.taskType === 'fish_tank') {
      const tank = fishTanks.find((t) => t.id === activity.sourceId);
      if (!tank) return;

      const stageDone = activity.tankStage || tank.currentStage;
      const stageLabel = stageToLabel(stageDone);
      const volumeLiters = Math.round((tank.capacityLiters * stageDone) / 4);
      const upcomingStage = nextTankStage(stageDone);
      const nextDate = addDays(dateKey, tank.intervalDays);

      batch.update(doc(db, 'farms', farm.id, 'fishTanks', tank.id), {
        currentStage: upcomingStage,
        lastDrawdownDate: dateKey,
        nextDrawdownDate: nextDate,
        updatedAt: now,
      });

      const linkedBeds = plants.filter((p) => tank.irrigationBedIds.includes(p.id));
      const irrigatedNames = linkedBeds.map((p) => p.name).join(', ');
      const autoNote =
        signOffNote.trim() ||
        (stageDone === 3
          ? `3/4 deep drawdown (${volumeLiters} L) routed to ${irrigatedNames || 'crop beds'} + fresh tank refill.`
          : `${stageLabel} drawdown (${volumeLiters} L) routed to ${irrigatedNames || 'crop beds'}.`);

      batch.set(doc(db, 'farms', farm.id, 'completions', completionId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        dateKey,
        taskType: 'fish_tank',
        sourceId: tank.id,
        sourceTitle: clampString(`${tank.name} (${stageLabel} drawdown)`, SCHEMA_LIMITS.TITLE_MAX),
        assignedMemberId: sanitizeId(tank.assigneeId || ''),
        assignedMemberName,
        assignedUid: sanitizeId(tank.assigneeUid || ''),
        completedByUid: user.uid,
        completedByName,
        status: 'done',
        waterVolumeLiters: clampInt(volumeLiters, 0, 1000000),
        tankStage: stageLabel,
        notes: clampString(autoNote, SCHEMA_LIMITS.COMPLETION_NOTES_MAX),
        createdAt: now,
      });

      // Automatically mark linked crop beds as watered using the discharged fish tank water
      if (alsoWaterLinkedBeds && linkedBeds.length > 0) {
        const perBedVolume = Math.round(volumeLiters / linkedBeds.length);
        for (const bed of linkedBeds) {
          batch.update(doc(db, 'farms', farm.id, 'plants', bed.id), {
            lastWateredDate: dateKey,
            updatedAt: now,
          });
          const bedAssigneeName =
            members.find((m) => m.id === bed.waterAssigneeId)?.name || assignedMemberName;
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
            completedByName,
            status: 'done',
            waterVolumeLiters: clampInt(perBedVolume, 0, 1000000),
            tankStage: stageLabel,
            notes: clampString(
              `Irrigated with ${stageLabel} effluent from ${tank.name}`,
              SCHEMA_LIMITS.COMPLETION_NOTES_MAX
            ),
            createdAt: now,
          });
        }
      }
    } else if (activity.taskType === 'custom') {
      const task = tasks.find((t) => t.id === activity.sourceId);
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

      batch.set(doc(db, 'farms', farm.id, 'completions', completionId), {
        farmId: farm.id,
        ownerId: farm.ownerId,
        dateKey,
        taskType: 'custom',
        sourceId: task.id,
        sourceTitle: clampString(task.title, SCHEMA_LIMITS.TITLE_MAX),
        assignedMemberId: sanitizeId(task.assigneeId || ''),
        assignedMemberName,
        assignedUid: sanitizeId(task.assigneeUid || ''),
        completedByUid: user.uid,
        completedByName,
        status: 'done',
        waterVolumeLiters: 0,
        tankStage: '',
        notes: clampString(signOffNote, SCHEMA_LIMITS.COMPLETION_NOTES_MAX),
        createdAt: now,
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, logPath);
  }
}

export async function undoCompletionLog(params: {
  farmId: string;
  log: CompletionLog;
  fishTanks: FishTank[];
  tasks: CustomTask[];
}): Promise<void> {
  const { farmId, log, fishTanks, tasks } = params;
  const path = `farms/${farmId}/completions/${log.id}`;
  const batch = writeBatch(db);
  const now = serverTimestamp();

  try {
    batch.delete(doc(db, 'farms', farmId, 'completions', log.id));

    if (log.taskType === 'fish_tank') {
      const tank = fishTanks.find((t) => t.id === log.sourceId);
      if (tank) {
        const prevStage: TankStage = log.tankStage === '3/4' ? 3 : log.tankStage === '2/4' ? 2 : 1;
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

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
