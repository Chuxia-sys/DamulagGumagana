import { initializeApp, getApps } from 'firebase/app';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore/lite';
import { v4 as uuidv4 } from 'uuid';

type ModelName =
  | 'user'
  | 'department'
  | 'subject'
  | 'room'
  | 'section'
  | 'schedule'
  | 'scheduleResponse'
  | 'facultyPreference'
  | 'notification'
  | 'scheduleLog'
  | 'conflict'
  | 'auditLog'
  | 'systemSetting';

type OrderDirection = 'asc' | 'desc';

type QueryOptions = {
  where?: Record<string, any>;
  include?: Record<string, any>;
  select?: Record<string, any>;
  orderBy?: Record<string, OrderDirection> | Array<Record<string, OrderDirection>>;
};

type MutationOptions = QueryOptions & {
  data?: Record<string, any>;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

const collectionMap: Record<ModelName, string> = {
  user: 'users',
  department: 'departments',
  subject: 'subjects',
  room: 'rooms',
  section: 'sections',
  schedule: 'schedules',
  scheduleResponse: 'scheduleResponses',
  facultyPreference: 'facultyPreferences',
  notification: 'notifications',
  scheduleLog: 'scheduleLogs',
  conflict: 'conflicts',
  auditLog: 'auditLogs',
  systemSetting: 'systemSettings',
};

type RelationConfig = {
  model: ModelName;
  type: 'one' | 'many';
  foreignKey?: string; // field on source
  foreignField?: string; // field on target
  sourceKey?: string; // defaults to id
};

const relationMap: Record<ModelName, Record<string, RelationConfig>> = {
  user: {
    department: { model: 'department', type: 'one', foreignKey: 'departmentId' },
    schedules: { model: 'schedule', type: 'many', foreignField: 'facultyId' },
    preferences: { model: 'facultyPreference', type: 'one', foreignField: 'facultyId' },
    notifications: { model: 'notification', type: 'many', foreignField: 'userId' },
    scheduleLogs: { model: 'scheduleLog', type: 'many', foreignField: 'modifiedBy' },
    auditLogs: { model: 'auditLog', type: 'many', foreignField: 'userId' },
    scheduleResponses: { model: 'scheduleResponse', type: 'many', foreignField: 'facultyId' },
  },
  department: {
    users: { model: 'user', type: 'many', foreignField: 'departmentId' },
    subjects: { model: 'subject', type: 'many', foreignField: 'departmentId' },
    sections: { model: 'section', type: 'many', foreignField: 'departmentId' },
  },
  subject: {
    department: { model: 'department', type: 'one', foreignKey: 'departmentId' },
    schedules: { model: 'schedule', type: 'many', foreignField: 'subjectId' },
  },
  room: {
    schedules: { model: 'schedule', type: 'many', foreignField: 'roomId' },
  },
  section: {
    department: { model: 'department', type: 'one', foreignKey: 'departmentId' },
    schedules: { model: 'schedule', type: 'many', foreignField: 'sectionId' },
  },
  schedule: {
    subject: { model: 'subject', type: 'one', foreignKey: 'subjectId' },
    faculty: { model: 'user', type: 'one', foreignKey: 'facultyId' },
    section: { model: 'section', type: 'one', foreignKey: 'sectionId' },
    room: { model: 'room', type: 'one', foreignKey: 'roomId' },
    logs: { model: 'scheduleLog', type: 'many', foreignField: 'scheduleId' },
    response: { model: 'scheduleResponse', type: 'one', foreignField: 'scheduleId' },
  },
  scheduleResponse: {
    schedule: { model: 'schedule', type: 'one', foreignKey: 'scheduleId' },
    faculty: { model: 'user', type: 'one', foreignKey: 'facultyId' },
  },
  facultyPreference: {
    faculty: { model: 'user', type: 'one', foreignKey: 'facultyId' },
  },
  notification: {
    user: { model: 'user', type: 'one', foreignKey: 'userId' },
  },
  scheduleLog: {
    schedule: { model: 'schedule', type: 'one', foreignKey: 'scheduleId' },
    user: { model: 'user', type: 'one', foreignKey: 'modifiedBy' },
  },
  conflict: {},
  auditLog: {
    user: { model: 'user', type: 'one', foreignKey: 'userId' },
  },
  systemSetting: {},
};

const toComparable = (value: unknown) => {
  if (value instanceof Date) return value.getTime();
  return value as any;
};

const normalizeValue = (value: any): any => {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    const normalized: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      normalized[key] = normalizeValue(val);
    }
    return normalized;
  }
  return value;
};

const normalizeDoc = (data: Record<string, any>) => normalizeValue(data);

const getCollectionDocs = async (model: ModelName) => {
  const snap = await getDocs(collection(firestore, collectionMap[model]));
  return snap.docs.map((docSnap) =>
    normalizeDoc({ id: docSnap.id, ...docSnap.data() })
  );
};

const getDocById = async (model: ModelName, id: string) => {
  const docRef = doc(firestore, collectionMap[model], id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return normalizeDoc({ id: docSnap.id, ...docSnap.data() });
};

const getRelationData = async (model: ModelName, record: Record<string, any>, key: string) => {
  const relation = relationMap[model]?.[key];
  if (!relation) return null;

  if (relation.type === 'one') {
    if (relation.foreignKey) {
      const relationId = record[relation.foreignKey];
      if (!relationId) return null;
      return getDocById(relation.model, relationId);
    }

    if (relation.foreignField) {
      const sourceKey = relation.sourceKey ?? 'id';
      const relatedDocs = await getCollectionDocs(relation.model);
      return relatedDocs.find((doc) => doc[relation.foreignField] === record[sourceKey]) ?? null;
    }
  }

  if (relation.type === 'many' && relation.foreignField) {
    const sourceKey = relation.sourceKey ?? 'id';
    const relatedDocs = await getCollectionDocs(relation.model);
    return relatedDocs.filter((doc) => doc[relation.foreignField] === record[sourceKey]);
  }

  return null;
};

const applySelectForModel = async (
  model: ModelName,
  record: Record<string, any> | null,
  select: Record<string, any>
) => {
  if (!record) return record;
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(select)) {
    if (value === true) {
      result[key] = record[key];
      continue;
    }

    if (key === '_count' && value && typeof value === 'object') {
      result._count = await getCountsForModel(model, record, value.select || {});
      continue;
    }

    if (value && typeof value === 'object') {
      const relation = relationMap[model]?.[key];
      if (!relation) continue;
      const relationData = await getRelationData(model, record, key);
      if (Array.isArray(relationData)) {
        result[key] = await Promise.all(
          relationData.map(async (item) => applySelectOrInclude(relation.model, item, value))
        );
      } else {
        result[key] = await applySelectOrInclude(relation.model, relationData, value);
      }
    }
  }

  return result;
};

const applyIncludeForModel = async (
  model: ModelName,
  record: Record<string, any>,
  include: Record<string, any>
) => {
  const result: Record<string, any> = { ...record };

  for (const [key, value] of Object.entries(include)) {
    if (key === '_count') {
      result._count = await getCountsForModel(model, record, value?.select || {});
      continue;
    }

    const relation = relationMap[model]?.[key];
    if (!relation) continue;

    const relationData = await getRelationData(model, record, key);
    if (value === true) {
      result[key] = relationData;
      continue;
    }

    if (Array.isArray(relationData)) {
      result[key] = await Promise.all(
        relationData.map(async (item) => applySelectOrInclude(relation.model, item, value))
      );
    } else {
      result[key] = await applySelectOrInclude(relation.model, relationData, value);
    }
  }

  return result;
};

const applySelectOrInclude = async (
  model: ModelName,
  record: Record<string, any> | null,
  options: Record<string, any>
) => {
  if (!record) return record;
  if (options?.select) {
    return applySelectForModel(model, record, options.select);
  }
  if (options?.include) {
    return applyIncludeForModel(model, record, options.include);
  }
  return record;
};

const getCountsForModel = async (
  model: ModelName,
  record: Record<string, any>,
  select: Record<string, boolean>
) => {
  const counts: Record<string, number> = {};

  for (const key of Object.keys(select)) {
    if (!select[key]) continue;
    const relation = relationMap[model]?.[key];
    if (!relation) continue;
    const relationData = await getRelationData(model, record, key);
    if (Array.isArray(relationData)) {
      counts[key] = relationData.length;
    } else {
      counts[key] = relationData ? 1 : 0;
    }
  }

  return counts;
};

const normalizeOrderBy = (
  orderBy?: Record<string, OrderDirection> | Array<Record<string, OrderDirection>>
) => {
  if (!orderBy) return [] as Array<{ field: string; direction: OrderDirection }>;
  if (Array.isArray(orderBy)) {
    return orderBy.map((item) => {
      const [field, direction] = Object.entries(item)[0];
      return { field, direction };
    });
  }

  const [field, direction] = Object.entries(orderBy)[0];
  return [{ field, direction }];
};

const matchWhere = async (
  model: ModelName,
  record: Record<string, any>,
  where?: Record<string, any>
): Promise<boolean> => {
  if (!where) return true;

  if (Array.isArray(where.OR)) {
    for (const condition of where.OR) {
      if (await matchWhere(model, record, condition)) return true;
    }
    return false;
  }

  if (Array.isArray(where.AND)) {
    for (const condition of where.AND) {
      if (!(await matchWhere(model, record, condition))) return false;
    }
    return true;
  }

  for (const [key, value] of Object.entries(where)) {
    if (key === 'OR' || key === 'AND') continue;
    if (value === undefined) continue;

    const relation = relationMap[model]?.[key];
    if (relation && value && typeof value === 'object' && !Array.isArray(value)) {
      const relationData = await getRelationData(model, record, key);
      if (!relationData) return false;
      if (Array.isArray(relationData)) {
        const matched = await Promise.all(
          relationData.map(async (item) => matchWhere(relation.model, item, value))
        );
        if (!matched.some(Boolean)) return false;
      } else {
        if (!(await matchWhere(relation.model, relationData, value))) return false;
      }
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      if ('in' in value) {
        if (!value.in?.includes(record[key])) return false;
        continue;
      }
      if ('not' in value) {
        if (record[key] === value.not) return false;
        continue;
      }
      if ('gt' in value) {
        if (!(toComparable(record[key]) > toComparable(value.gt))) return false;
        continue;
      }
      if ('gte' in value) {
        if (!(toComparable(record[key]) >= toComparable(value.gte))) return false;
        continue;
      }
      if ('lt' in value) {
        if (!(toComparable(record[key]) < toComparable(value.lt))) return false;
        continue;
      }
      if ('lte' in value) {
        if (!(toComparable(record[key]) <= toComparable(value.lte))) return false;
        continue;
      }
      if ('equals' in value) {
        if (record[key] !== value.equals) return false;
        continue;
      }
    }

    if (record[key] !== value) return false;
  }

  return true;
};

const applyOrderBy = (records: Record<string, any>[], orderBy?: QueryOptions['orderBy']) => {
  const orderEntries = normalizeOrderBy(orderBy);
  if (orderEntries.length === 0) return records;

  return [...records].sort((a, b) => {
    for (const { field, direction } of orderEntries) {
      const aValue = toComparable(a[field]);
      const bValue = toComparable(b[field]);
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

const findUnique = async (model: ModelName, options: QueryOptions & { where: Record<string, any> }) => {
  const where = options.where;
  if (where.id) {
    const record = await getDocById(model, where.id);
    if (!record) return null;
    if (options.select) return applySelectForModel(model, record, options.select);
    if (options.include) return applyIncludeForModel(model, record, options.include);
    return record;
  }

  const all = await getCollectionDocs(model);
  for (const record of all) {
    if (await matchWhere(model, record, where)) {
      if (options.select) return applySelectForModel(model, record, options.select);
      if (options.include) return applyIncludeForModel(model, record, options.include);
      return record;
    }
  }

  return null;
};

const findFirst = async (model: ModelName, options: QueryOptions) => {
  const results = await findMany(model, options);
  return results[0] ?? null;
};

const findMany = async (model: ModelName, options: QueryOptions = {}) => {
  const all = await getCollectionDocs(model);
  const filtered: Record<string, any>[] = [];
  for (const record of all) {
    if (await matchWhere(model, record, options.where)) {
      filtered.push(record);
    }
  }

  const ordered = applyOrderBy(filtered, options.orderBy);

  if (options.select) {
    return Promise.all(ordered.map((record) => applySelectForModel(model, record, options.select!)));
  }

  if (options.include) {
    return Promise.all(ordered.map((record) => applyIncludeForModel(model, record, options.include!)));
  }

  return ordered;
};

const count = async (model: ModelName, options: QueryOptions = {}) => {
  const results = await findMany(model, options);
  return results.length;
};

const create = async (model: ModelName, options: MutationOptions) => {
  const data = options.data ?? {};
  const now = new Date();
  const id = data.id ?? uuidv4();
  const record = {
    ...data,
    id,
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  };

  await setDoc(doc(firestore, collectionMap[model], id), record);

  if (options.select) return applySelectForModel(model, record, options.select);
  if (options.include) return applyIncludeForModel(model, record, options.include);
  return record;
};

const update = async (model: ModelName, options: MutationOptions & { where: Record<string, any> }) => {
  const existing = await findUnique(model, { where: options.where });
  if (!existing) {
    throw new Error(`Record not found for update in ${model}`);
  }

  const now = new Date();
  const updated = {
    ...existing,
    ...options.data,
    updatedAt: now,
  };

  await setDoc(doc(firestore, collectionMap[model], updated.id), updated);

  if (options.select) return applySelectForModel(model, updated, options.select);
  if (options.include) return applyIncludeForModel(model, updated, options.include);
  return updated;
};

const upsert = async (
  model: ModelName,
  options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions
) => {
  const existing = await findUnique(model, { where: options.where });
  if (existing) {
    return update(model, { where: { id: existing.id }, data: options.update, include: options.include, select: options.select });
  }
  return create(model, { data: options.create, include: options.include, select: options.select });
};

const remove = async (model: ModelName, options: { where: Record<string, any> }) => {
  const existing = await findUnique(model, { where: options.where });
  if (!existing) {
    throw new Error(`Record not found for delete in ${model}`);
  }
  await deleteDoc(doc(firestore, collectionMap[model], existing.id));
  return existing;
};

const createMany = async (model: ModelName, options: { data: Array<Record<string, any>> }) => {
  const results: Record<string, any>[] = [];
  for (const item of options.data) {
    results.push(await create(model, { data: item }));
  }
  return { count: results.length };
};

const updateMany = async (
  model: ModelName,
  options: { where: Record<string, any>; data: Record<string, any> }
) => {
  const records = await findMany(model, { where: options.where });
  let countUpdated = 0;
  for (const record of records) {
    await update(model, { where: { id: record.id }, data: options.data });
    countUpdated += 1;
  }
  return { count: countUpdated };
};

const deleteMany = async (model: ModelName, options: { where?: Record<string, any> }) => {
  const records = await findMany(model, { where: options.where });
  for (const record of records) {
    await deleteDoc(doc(firestore, collectionMap[model], record.id));
  }
  return { count: records.length };
};

export const db = {
  user: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('user', options),
    findMany: (options?: QueryOptions) => findMany('user', options),
    findFirst: (options: QueryOptions) => findFirst('user', options),
    create: (options: MutationOptions) => create('user', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('user', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('user', options),
    delete: (options: { where: Record<string, any> }) => remove('user', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('user', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('user', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('user', options),
    count: (options?: QueryOptions) => count('user', options),
  },
  department: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('department', options),
    findMany: (options?: QueryOptions) => findMany('department', options),
    findFirst: (options: QueryOptions) => findFirst('department', options),
    create: (options: MutationOptions) => create('department', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('department', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('department', options),
    delete: (options: { where: Record<string, any> }) => remove('department', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('department', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('department', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('department', options),
    count: (options?: QueryOptions) => count('department', options),
  },
  subject: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('subject', options),
    findMany: (options?: QueryOptions) => findMany('subject', options),
    findFirst: (options: QueryOptions) => findFirst('subject', options),
    create: (options: MutationOptions) => create('subject', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('subject', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('subject', options),
    delete: (options: { where: Record<string, any> }) => remove('subject', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('subject', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('subject', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('subject', options),
    count: (options?: QueryOptions) => count('subject', options),
  },
  room: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('room', options),
    findMany: (options?: QueryOptions) => findMany('room', options),
    findFirst: (options: QueryOptions) => findFirst('room', options),
    create: (options: MutationOptions) => create('room', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('room', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('room', options),
    delete: (options: { where: Record<string, any> }) => remove('room', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('room', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('room', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('room', options),
    count: (options?: QueryOptions) => count('room', options),
  },
  section: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('section', options),
    findMany: (options?: QueryOptions) => findMany('section', options),
    findFirst: (options: QueryOptions) => findFirst('section', options),
    create: (options: MutationOptions) => create('section', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('section', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('section', options),
    delete: (options: { where: Record<string, any> }) => remove('section', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('section', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('section', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('section', options),
    count: (options?: QueryOptions) => count('section', options),
  },
  schedule: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('schedule', options),
    findMany: (options?: QueryOptions) => findMany('schedule', options),
    findFirst: (options: QueryOptions) => findFirst('schedule', options),
    create: (options: MutationOptions) => create('schedule', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('schedule', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('schedule', options),
    delete: (options: { where: Record<string, any> }) => remove('schedule', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('schedule', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('schedule', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('schedule', options),
    count: (options?: QueryOptions) => count('schedule', options),
  },
  scheduleResponse: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('scheduleResponse', options),
    findMany: (options?: QueryOptions) => findMany('scheduleResponse', options),
    findFirst: (options: QueryOptions) => findFirst('scheduleResponse', options),
    create: (options: MutationOptions) => create('scheduleResponse', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('scheduleResponse', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('scheduleResponse', options),
    delete: (options: { where: Record<string, any> }) => remove('scheduleResponse', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('scheduleResponse', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('scheduleResponse', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('scheduleResponse', options),
    count: (options?: QueryOptions) => count('scheduleResponse', options),
  },
  facultyPreference: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('facultyPreference', options),
    findMany: (options?: QueryOptions) => findMany('facultyPreference', options),
    findFirst: (options: QueryOptions) => findFirst('facultyPreference', options),
    create: (options: MutationOptions) => create('facultyPreference', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('facultyPreference', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('facultyPreference', options),
    delete: (options: { where: Record<string, any> }) => remove('facultyPreference', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('facultyPreference', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('facultyPreference', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('facultyPreference', options),
    count: (options?: QueryOptions) => count('facultyPreference', options),
  },
  notification: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('notification', options),
    findMany: (options?: QueryOptions) => findMany('notification', options),
    findFirst: (options: QueryOptions) => findFirst('notification', options),
    create: (options: MutationOptions) => create('notification', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('notification', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('notification', options),
    delete: (options: { where: Record<string, any> }) => remove('notification', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('notification', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('notification', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('notification', options),
    count: (options?: QueryOptions) => count('notification', options),
  },
  scheduleLog: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('scheduleLog', options),
    findMany: (options?: QueryOptions) => findMany('scheduleLog', options),
    findFirst: (options: QueryOptions) => findFirst('scheduleLog', options),
    create: (options: MutationOptions) => create('scheduleLog', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('scheduleLog', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('scheduleLog', options),
    delete: (options: { where: Record<string, any> }) => remove('scheduleLog', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('scheduleLog', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('scheduleLog', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('scheduleLog', options),
    count: (options?: QueryOptions) => count('scheduleLog', options),
  },
  conflict: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('conflict', options),
    findMany: (options?: QueryOptions) => findMany('conflict', options),
    findFirst: (options: QueryOptions) => findFirst('conflict', options),
    create: (options: MutationOptions) => create('conflict', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('conflict', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('conflict', options),
    delete: (options: { where: Record<string, any> }) => remove('conflict', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('conflict', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('conflict', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('conflict', options),
    count: (options?: QueryOptions) => count('conflict', options),
  },
  auditLog: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('auditLog', options),
    findMany: (options?: QueryOptions) => findMany('auditLog', options),
    findFirst: (options: QueryOptions) => findFirst('auditLog', options),
    create: (options: MutationOptions) => create('auditLog', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('auditLog', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('auditLog', options),
    delete: (options: { where: Record<string, any> }) => remove('auditLog', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('auditLog', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('auditLog', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('auditLog', options),
    count: (options?: QueryOptions) => count('auditLog', options),
  },
  systemSetting: {
    findUnique: (options: QueryOptions & { where: Record<string, any> }) => findUnique('systemSetting', options),
    findMany: (options?: QueryOptions) => findMany('systemSetting', options),
    findFirst: (options: QueryOptions) => findFirst('systemSetting', options),
    create: (options: MutationOptions) => create('systemSetting', options),
    update: (options: MutationOptions & { where: Record<string, any> }) => update('systemSetting', options),
    upsert: (options: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any> } & QueryOptions) =>
      upsert('systemSetting', options),
    delete: (options: { where: Record<string, any> }) => remove('systemSetting', options),
    createMany: (options: { data: Array<Record<string, any>> }) => createMany('systemSetting', options),
    updateMany: (options: { where: Record<string, any>; data: Record<string, any> }) => updateMany('systemSetting', options),
    deleteMany: (options: { where?: Record<string, any> }) => deleteMany('systemSetting', options),
    count: (options?: QueryOptions) => count('systemSetting', options),
  },
};