import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { ensureFarmWorkspace } from '../services/farmService';
import type {
  CompletionLog,
  CustomTask,
  Farm,
  FarmMember,
  FishTank,
  PlantSchedule,
} from '../types';

export interface FarmDataState {
  user: User | null;
  authLoading: boolean;
  dataLoading: boolean;
  authError: string | null;
  farm: Farm | null;
  members: FarmMember[];
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  tasks: CustomTask[];
  completions: CompletionLog[];
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

export function useFarmData(): FarmDataState {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);

  const [farm, setFarm] = useState<Farm | null>(null);
  const [members, setMembers] = useState<FarmMember[]>([]);
  const [plants, setPlants] = useState<PlantSchedule[]>([]);
  const [fishTanks, setFishTanks] = useState<FishTank[]>([]);
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
        setFarmId(null);
        setFarm(null);
        setMembers([]);
        setPlants([]);
        setFishTanks([]);
        setTasks([]);
        setCompletions([]);
        setAuthLoading(false);
        setDataLoading(false);
        return;
      }

      setDataLoading(true);
      setAuthLoading(false);
      try {
        const resolvedFarmId = await ensureFarmWorkspace(currentUser);
        setFarmId(resolvedFarmId);
      } catch (err) {
        setDataLoading(false);
        setRuntimeError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !farmId) return;

    const uid = user.uid;
    let settledCount = 0;
    const markSettled = () => {
      settledCount += 1;
      if (settledCount >= 5) {
        setDataLoading(false);
      }
    };

    const farmPath = `farms/${farmId}`;
    const unsubFarm = onSnapshot(
      doc(db, 'farms', farmId),
      (snap) => {
        if (snap.exists()) {
          setFarm({ id: snap.id, ...(snap.data() as Omit<Farm, 'id'>) });
        }
        markSettled();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, farmPath);
        } catch (wrapped) {
          setRuntimeError(wrapped as Error);
        }
      }
    );

    const membersPath = `farms/${farmId}/members`;
    const unsubMembers = onSnapshot(
      query(collection(db, 'farms', farmId, 'members'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<FarmMember, 'id'>) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setMembers(list);
        markSettled();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, membersPath);
        } catch (wrapped) {
          setRuntimeError(wrapped as Error);
        }
      }
    );

    const plantsPath = `farms/${farmId}/plants`;
    const unsubPlants = onSnapshot(
      query(collection(db, 'farms', farmId, 'plants'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PlantSchedule, 'id'>) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setPlants(list);
        markSettled();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, plantsPath);
        } catch (wrapped) {
          setRuntimeError(wrapped as Error);
        }
      }
    );

    const tanksPath = `farms/${farmId}/fishTanks`;
    const unsubTanks = onSnapshot(
      query(collection(db, 'farms', farmId, 'fishTanks'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<FishTank, 'id'>) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setFishTanks(list);
        markSettled();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, tanksPath);
        } catch (wrapped) {
          setRuntimeError(wrapped as Error);
        }
      }
    );

    const tasksPath = `farms/${farmId}/tasks`;
    const unsubTasks = onSnapshot(
      query(collection(db, 'farms', farmId, 'tasks'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<CustomTask, 'id'>) }))
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        setTasks(list);
        markSettled();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, tasksPath);
        } catch (wrapped) {
          setRuntimeError(wrapped as Error);
        }
      }
    );

    const completionsPath = `farms/${farmId}/completions`;
    const unsubCompletions = onSnapshot(
      query(collection(db, 'farms', farmId, 'completions'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<CompletionLog, 'id'>) }))
          .sort((a, b) => {
            const dCmp = b.dateKey.localeCompare(a.dateKey);
            if (dCmp !== 0) return dCmp;
            const aSec = a.createdAt?.seconds ?? 0;
            const bSec = b.createdAt?.seconds ?? 0;
            return bSec - aSec;
          });
        setCompletions(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, completionsPath);
        } catch (wrapped) {
          setRuntimeError(wrapped as Error);
        }
      }
    );

    return () => {
      unsubFarm();
      unsubMembers();
      unsubPlants();
      unsubTanks();
      unsubTasks();
      unsubCompletions();
    };
  }, [user, farmId]);

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

  return {
    user,
    authLoading,
    dataLoading,
    authError,
    farm,
    members,
    plants,
    fishTanks,
    tasks,
    completions,
    signInWithGoogle,
    signOutUser,
  };
}
