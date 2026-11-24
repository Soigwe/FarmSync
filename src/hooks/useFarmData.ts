import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  claimFarmInviteCode,
  ensureFarmWorkspace,
  switchWorkspaceToOwnFarm,
  syncLinkedMemberAssignments,
  type WorkspaceSession,
} from '../services/farmService';
import type {
  AnimalGroup,
  AnimalTask,
  CompletionLog,
  CustomTask,
  Farm,
  FarmMember,
  FishTank,
  MemberRole,
  PlantSchedule,
} from '../types';

export interface FarmDataState {
  user: User | null;
  authLoading: boolean;
  dataLoading: boolean;
  authError: string | null;
  userRole: MemberRole;
  activeMemberId: string;
  farm: Farm | null;
  members: FarmMember[];
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animals: AnimalGroup[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
  completions: CompletionLog[];
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  joinFarmByCode: (code: string) => Promise<void>;
  switchToOwnFarm: () => Promise<void>;
}

export function useFarmData(): FarmDataState {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<WorkspaceSession | null>(null);

  const [farm, setFarm] = useState<Farm | null>(null);
  const [members, setMembers] = useState<FarmMember[]>([]);
  const [plants, setPlants] = useState<PlantSchedule[]>([]);
  const [fishTanks, setFishTanks] = useState<FishTank[]>([]);
  const [animals, setAnimals] = useState<AnimalGroup[]>([]);
  const [animalTasks, setAnimalTasks] = useState<AnimalTask[]>([]);
  const [tasks, setTasks] = useState<CustomTask[]>([]);
  const [completions, setCompletions] = useState<CompletionLog[]>([]);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);

  if (runtimeError) {
    throw runtimeError;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);
      if (!currentUser) {
        setSession(null);
        setFarm(null);
        setMembers([]);
        setPlants([]);
        setFishTanks([]);
        setAnimals([]);
        setAnimalTasks([]);
        setTasks([]);
        setCompletions([]);
        setAuthLoading(false);
        setDataLoading(false);
        return;
      }

      setDataLoading(true);
      setAuthLoading(false);
      try {
        const resolved = await ensureFarmWorkspace(currentUser);
        setSession(resolved);
      } catch (err) {
        setDataLoading(false);
        setRuntimeError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !session) return;

    const uid = user.uid;
    const { farmId, role, memberId, farmName } = session;
    setDataLoading(true);

    const wrapError = (op: OperationType, path: string) => (err: unknown) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        setRuntimeError(wrapped as Error);
      }
    };

    const unsubs: Array<() => void> = [];

    if (role === 'manager') {
      let settled = 0;
      const markSettled = () => {
        settled += 1;
        if (settled >= 6) setDataLoading(false);
      };

      unsubs.push(
        onSnapshot(
          doc(db, 'farms', farmId),
          (snap) => {
            if (snap.exists()) {
              setFarm({ id: snap.id, ...(snap.data() as Omit<Farm, 'id'>) });
            }
            markSettled();
          },
          wrapError(OperationType.GET, `farms/${farmId}`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'members'), where('ownerId', '==', uid)),
          (snap) => {
            setMembers(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<FarmMember, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            markSettled();
          },
          wrapError(OperationType.LIST, `farms/${farmId}/members`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'plants'), where('ownerId', '==', uid)),
          (snap) => {
            setPlants(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<PlantSchedule, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            markSettled();
          },
          wrapError(OperationType.LIST, `farms/${farmId}/plants`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'fishTanks'), where('ownerId', '==', uid)),
          (snap) => {
            setFishTanks(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<FishTank, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            markSettled();
          },
          wrapError(OperationType.LIST, `farms/${farmId}/fishTanks`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'animals'), where('ownerId', '==', uid)),
          (snap) => {
            setAnimals(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<AnimalGroup, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            markSettled();
          },
          wrapError(OperationType.LIST, `farms/${farmId}/animals`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'animalTasks'), where('ownerId', '==', uid)),
          (snap) => {
            setAnimalTasks(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<AnimalTask, 'id'>) }))
                .sort((a, b) => a.title.localeCompare(b.title))
            );
            markSettled();
          },
          wrapError(OperationType.LIST, `farms/${farmId}/animalTasks`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'tasks'), where('ownerId', '==', uid)),
          (snap) => {
            setTasks(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<CustomTask, 'id'>) }))
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            );
          },
          wrapError(OperationType.LIST, `farms/${farmId}/tasks`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'completions'), where('ownerId', '==', uid)),
          (snap) => {
            setCompletions(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<CompletionLog, 'id'>) }))
                .sort((a, b) => {
                  const dCmp = b.dateKey.localeCompare(a.dateKey);
                  if (dCmp !== 0) return dCmp;
                  return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
                })
            );
          },
          wrapError(OperationType.LIST, `farms/${farmId}/completions`)
        )
      );
    } else {
      // Worker mode: read ONLY records assigned to this worker's UID
      setAnimals([]);
      let ownerIdFromMember = '';

      unsubs.push(
        onSnapshot(
          doc(db, 'farms', farmId, 'members', memberId),
          (snap) => {
            if (snap.exists()) {
              const m = { id: snap.id, ...(snap.data() as Omit<FarmMember, 'id'>) };
              ownerIdFromMember = m.ownerId;
              setMembers([m]);
              setFarm({
                id: farmId,
                ownerId: m.ownerId,
                name: farmName || 'Shared Farm',
                location: 'Worker View',
                volumeUnit: 'L',
              });
            }
            setDataLoading(false);
          },
          wrapError(OperationType.GET, `farms/${farmId}/members/${memberId}`)
        )
      );

      const plantMap = new Map<string, PlantSchedule>();
      const updatePlantsFromMap = () => {
        setPlants(Array.from(plantMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      };

      for (const field of ['waterAssigneeUid', 'mulchAssigneeUid', 'pruneAssigneeUid'] as const) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'farms', farmId, 'plants'), where(field, '==', uid)),
            (snap) => {
              // Remove old entries for this query? Merge cleanly by doc ID
              for (const d of snap.docs) {
                plantMap.set(d.id, { id: d.id, ...(d.data() as Omit<PlantSchedule, 'id'>) });
              }
              updatePlantsFromMap();
            },
            wrapError(OperationType.LIST, `farms/${farmId}/plants`)
          )
        );
      }

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'fishTanks'), where('assigneeUid', '==', uid)),
          (snap) => {
            setFishTanks(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FishTank, 'id'>) }))
            );
          },
          wrapError(OperationType.LIST, `farms/${farmId}/fishTanks`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'animalTasks'), where('assigneeUid', '==', uid)),
          (snap) => {
            setAnimalTasks(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AnimalTask, 'id'>) }))
            );
          },
          wrapError(OperationType.LIST, `farms/${farmId}/animalTasks`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'tasks'), where('assigneeUid', '==', uid)),
          (snap) => {
            setTasks(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomTask, 'id'>) }))
            );
          },
          wrapError(OperationType.LIST, `farms/${farmId}/tasks`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'farms', farmId, 'completions'), where('assignedUid', '==', uid)),
          (snap) => {
            setCompletions(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<CompletionLog, 'id'>) }))
                .sort((a, b) => {
                  const dCmp = b.dateKey.localeCompare(a.dateKey);
                  if (dCmp !== 0) return dCmp;
                  return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
                })
            );
          },
          wrapError(OperationType.LIST, `farms/${farmId}/completions`)
        )
      );

      void ownerIdFromMember;
    }

    return () => {
      for (const fn of unsubs) fn();
    };
  }, [user, session]);

  // Manager auto-sync: whenever a worker claims an invite code and gets a linkedUid,
  // automatically stamp their UID onto all plants, fish tanks, animal tasks, and custom tasks assigned to them.
  useEffect(() => {
    if (!farm || session?.role !== 'manager' || members.length === 0) return;
    void syncLinkedMemberAssignments({
      farm,
      members,
      plants,
      fishTanks,
      animalTasks,
      tasks,
    });
  }, [farm, session?.role, members, plants, fishTanks, animalTasks, tasks]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const joinFarmByCode = async (code: string) => {
    if (!user) throw new Error('Sign in with Google first.');
    const nextSession = await claimFarmInviteCode({ user, rawCode: code });
    setSession(nextSession);
  };

  const switchToOwnFarm = async () => {
    if (!user) return;
    const nextSession = await switchWorkspaceToOwnFarm(user);
    setSession(nextSession);
  };

  return {
    user,
    authLoading,
    dataLoading,
    authError,
    userRole: session?.role || 'manager',
    activeMemberId: session?.memberId || '',
    farm,
    members,
    plants,
    fishTanks,
    animals,
    animalTasks,
    tasks,
    completions,
    signInWithGoogle,
    signOutUser,
    joinFarmByCode,
    switchToOwnFarm,
  };
}
