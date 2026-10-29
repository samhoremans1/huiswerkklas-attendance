// Three-way merge for the app data.
//
//   base   = the version this device last synced with GitHub (common ancestor)
//   local  = what this device has now
//   remote = what is on GitHub now (may contain changes from other people)
//
// Only the things that changed locally (local vs base) are applied on top of
// remote, so changes made by others on another device are never thrown away.
// When there is no base (first sync after updating the app) we fall back to a
// safe union: nothing from either side is removed.

// Stable stringify (sorted keys) so key order never counts as a change.
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
};
const same = (a, b) => stable(a) === stable(b);

/** Field-level merge of one object: locally changed fields win, others come from remote. */
function mergeFields(base = {}, local = {}, remote = {}) {
  const out = { ...remote };
  new Set([...Object.keys(base), ...Object.keys(local)]).forEach((k) => {
    if (same(local[k], base[k])) return; // not changed locally -> keep remote
    if (local[k] === undefined) delete out[k];
    else out[k] = local[k];
  });
  return out;
}

function mergePeople(baseArr, localArr, remoteArr) {
  const byId = (arr) => new Map((arr || []).map((p) => [p.id, p]));
  const B = baseArr ? byId(baseArr) : null;
  const L = byId(localArr);
  const R = byId(remoteArr);

  const resolve = (id) => {
    const l = L.get(id);
    const r = R.get(id);
    if (!B) return r || l; // no ancestor: keep everyone, prefer the shared version
    const b = B.get(id);
    if (l && r) return mergeFields(b, l, r);
    if (b) return null; // existed before but deleted on one side -> deletion wins
    return l || r; // newly added on one side
  };

  const out = [];
  const seen = new Set();
  [...R.keys(), ...L.keys()].forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const p = resolve(id);
    if (p) out.push(p);
  });
  return out;
}

function mergeAttendance(base, local = {}, remote = {}, removedIds) {
  const out = {};
  const dates = new Set([...Object.keys(remote), ...Object.keys(local), ...Object.keys(base || {})]);
  dates.forEach((date) => {
    const l = local[date] || [];
    const set = new Set(remote[date] || []);
    if (!base) {
      l.forEach((id) => set.add(id)); // union
    } else {
      const b = new Set(base[date] || []);
      const lset = new Set(l);
      l.forEach((id) => !b.has(id) && set.add(id)); // marked present here
      b.forEach((id) => !lset.has(id) && set.delete(id)); // unmarked here
    }
    removedIds.forEach((id) => set.delete(id));
    if (set.size) out[date] = [...set];
  });
  return out;
}

function mergeSettings(base, local = {}, remote = {}) {
  if (base) return mergeFields(base, local, remote);
  const out = { ...local };
  Object.entries(remote).forEach(([k, v]) => {
    if (v) out[k] = v;
  });
  return out;
}

/**
 * Merge three (already normalized) databases. Returns a raw db; run it through
 * normalizeDb afterwards.
 */
export function mergeDb(base, local, remote) {
  const students = mergePeople(base?.students, local.students, remote.students);
  const staff = mergePeople(base?.staff, local.staff, remote.staff);

  // People that were deleted during the merge also lose their attendance.
  const kept = new Set([...students, ...staff].map((p) => p.id));
  const removedIds = new Set();
  [base, local, remote].forEach((db) =>
    [...(db?.students || []), ...(db?.staff || [])].forEach((p) => !kept.has(p.id) && removedIds.add(p.id)),
  );

  return {
    students,
    staff,
    attendance: mergeAttendance(base?.attendance, local.attendance, remote.attendance, removedIds),
    settings: mergeSettings(base?.settings, local.settings, remote.settings),
  };
}
