import { prisma } from '../config/database.js';

export function normalizeArrayInputs(val: any): { ids: string[]; names: string[]; rawStr: string } {
  if (val == null) return { ids: [], names: [], rawStr: '' };

  let items: any[] = [];
  if (Array.isArray(val)) {
    items = val;
  } else if (typeof val === 'string') {
    items = val.split(',').map(s => s.trim()).filter(Boolean);
  } else if (typeof val === 'object') {
    items = [val];
  }

  const ids: string[] = [];
  const names: string[] = [];

  for (const item of items) {
    if (typeof item === 'object' && item !== null) {
      const id = item.id || item.value || item.name || item.label;
      const name = item.label || item.name || item.value || item.id;
      if (id) ids.push(String(id).trim());
      if (name) names.push(String(name).trim());
    } else if (typeof item === 'string' || typeof item === 'number') {
      const str = String(item).trim();
      if (str) {
        ids.push(str);
        names.push(str);
      }
    }
  }

  const uniqueIds = [...new Set(ids)];
  const uniqueNames = [...new Set(names)];

  return {
    ids: uniqueIds,
    names: uniqueNames,
    rawStr: uniqueIds.join(',')
  };
}

export async function resolveSkillsInput(inputVal: any): Promise<{
  skillIds: string[];
  skills: string;
  skillsArray: string[];
  skillsList: Array<{ id: string; name: string }>;
}> {
  if (inputVal == null) {
    return { skillIds: [], skills: '', skillsArray: [], skillsList: [] };
  }

  const parsed = normalizeArrayInputs(inputVal);
  if (parsed.ids.length === 0) {
    return { skillIds: [], skills: '', skillsArray: [], skillsList: [] };
  }

  let dbSkills: Array<{ id: string; name: string }> = [];
  try {
    dbSkills = await prisma.skill.findMany({
      where: {
        OR: [
          { id: { in: parsed.ids } },
          { name: { in: parsed.names } }
        ]
      },
      select: { id: true, name: true }
    });
  } catch {
    dbSkills = [];
  }

  const skillMap = new Map<string, string>();
  dbSkills.forEach(s => {
    skillMap.set(s.id, s.name);
    skillMap.set(s.name.toLowerCase(), s.name);
  });

  const finalIds: string[] = [];
  const finalNames: string[] = [];
  const finalObjects: Array<{ id: string; name: string }> = [];

  for (const rawVal of parsed.ids) {
    const foundSkill = dbSkills.find(s => s.id === rawVal || s.name.toLowerCase() === rawVal.toLowerCase());
    const idToUse = foundSkill ? foundSkill.id : rawVal;
    const nameToUse = foundSkill ? foundSkill.name : (skillMap.get(rawVal) || rawVal);

    if (!finalIds.includes(idToUse)) finalIds.push(idToUse);
    if (!finalNames.includes(nameToUse)) finalNames.push(nameToUse);
    if (!finalObjects.some(o => o.id === idToUse)) {
      finalObjects.push({ id: idToUse, name: nameToUse });
    }
  }

  return {
    skillIds: finalIds,
    skills: finalNames.join(', '),
    skillsArray: finalNames,
    skillsList: finalObjects
  };
}

export async function resolveMasterOptionsInput(inputVal: any, type?: string): Promise<{
  ids: string[];
  labels: string[];
  joinedStr: string;
  list: Array<{ id: string; label: string; value: string }>;
}> {
  if (inputVal == null) {
    return { ids: [], labels: [], joinedStr: '', list: [] };
  }

  const parsed = normalizeArrayInputs(inputVal);
  if (parsed.ids.length === 0) {
    return { ids: [], labels: [], joinedStr: '', list: [] };
  }

  let dbOptions: Array<{ id: string; label: string; value: string }> = [];
  if (type) {
    try {
      dbOptions = await (prisma as any).masterOption.findMany({
        where: {
          type,
          OR: [
            { id: { in: parsed.ids } },
            { value: { in: parsed.names } },
            { label: { in: parsed.names } }
          ]
        },
        select: { id: true, label: true, value: true }
      });
    } catch {
      dbOptions = [];
    }
  }

  const optionMap = new Map<string, { id: string; label: string; value: string }>();
  dbOptions.forEach(o => {
    optionMap.set(o.id, o);
    optionMap.set(o.value.toLowerCase(), o);
    optionMap.set(o.label.toLowerCase(), o);
  });

  const finalIds: string[] = [];
  const finalLabels: string[] = [];
  const finalList: Array<{ id: string; label: string; value: string }> = [];

  for (const rawVal of parsed.ids) {
    const found = optionMap.get(rawVal) || optionMap.get(rawVal.toLowerCase());
    const idToUse = found ? found.id : rawVal;
    const labelToUse = found ? found.label : rawVal;
    const valueToUse = found ? found.value : rawVal;

    if (!finalIds.includes(idToUse)) finalIds.push(idToUse);
    if (!finalLabels.includes(labelToUse)) finalLabels.push(labelToUse);
    if (!finalList.some(o => o.id === idToUse)) {
      finalList.push({ id: idToUse, label: labelToUse, value: valueToUse });
    }
  }

  return {
    ids: finalIds,
    labels: finalLabels,
    joinedStr: finalLabels.join(', '),
    list: finalList
  };
}

export async function resolveLabelOrName(val: any): Promise<string> {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed) return '';

  const isUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuidPattern && !trimmed.startsWith('opt_') && !trimmed.startsWith('stg_') && !trimmed.startsWith('ind_')) {
    return trimmed;
  }

  try {
    // 1. Check industry
    const ind = await prisma.industry.findFirst({
      where: { OR: [{ id: trimmed }, { name: trimmed }] },
      select: { name: true }
    }).catch(() => null);
    if (ind?.name) return ind.name;

    // 2. Check startupStage
    const stg = await prisma.startupStage.findFirst({
      where: { OR: [{ id: trimmed }, { name: trimmed }] },
      select: { name: true }
    }).catch(() => null);
    if (stg?.name) return stg.name;

    // 3. Check masterOption
    const opt = await (prisma as any).masterOption?.findFirst({
      where: { OR: [{ id: trimmed }, { value: trimmed }, { label: trimmed }] },
      select: { label: true, value: true }
    }).catch(() => null);
    if (opt?.label) return opt.label;
    if (opt?.value) return opt.value;

    // 4. Check skillCategory
    const cat = await (prisma as any).skillCategory?.findFirst({
      where: { OR: [{ id: trimmed }, { name: trimmed }] },
      select: { name: true }
    }).catch(() => null);
    if (cat?.name) return cat.name;
  } catch {}

  return trimmed;
}

