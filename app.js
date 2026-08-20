const STORAGE = {
  rooms: 'golbang_rooms_v1',
  people: 'golbang_people_v1'
};

let rooms = load(STORAGE.rooms, []);
let people = load(STORAGE.people, []);
let isBusy = false;

function $(id) {
  return document.getElementById(id);
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function leftTag(left) {
  return left ? ' <small class="left-badge">좌타</small>' : '';
}

function alertUser(message) {
  window.alert(message);
}

function resetButtons() {
  const randomBtn = $('drawRandomBtn');
  const handicapBtn = $('drawHandicapBtn');

  if (randomBtn) {
    randomBtn.disabled = false;
    randomBtn.innerHTML = '🎲 랜덤 방배정';
  }
  if (handicapBtn) {
    handicapBtn.disabled = false;
    handicapBtn.innerHTML = '⚖️ 핸디 균형 배정';
  }
}

function setButtonsBusy(label, mode) {
  const randomBtn = $('drawRandomBtn');
  const handicapBtn = $('drawHandicapBtn');

  if (randomBtn) {
    randomBtn.disabled = true;
    randomBtn.innerHTML = mode === 'random' ? label : '🎲 랜덤 방배정';
  }
  if (handicapBtn) {
    handicapBtn.disabled = true;
    handicapBtn.innerHTML = mode === 'handicap' ? label : '⚖️ 핸디 균형 배정';
  }
}

function roomCapacityPlan(totalPeople, totalRooms) {
  const base = Math.floor(totalPeople / totalRooms);
  const extra = totalPeople % totalRooms;
  return Array.from({ length: totalRooms }, (_, i) => base + (i < extra ? 1 : 0));
}

function leftRoomWarningHTML() {
  const leftRooms = rooms.filter(r => r.left).length;
  const leftPeople = people.filter(p => p.left).length;

  if (!leftRooms && leftPeople) {
    return `
      <div class="warning-box">
        현재 좌타 참석자 <b>${leftPeople}명</b>이 있지만 좌타방이 등록되지 않았어요.
        일반 방으로 함께 배정됩니다.
      </div>
    `;
  }

  if (leftRooms && !leftPeople) {
    return `
      <div class="warning-box">
        좌타방 <b>${leftRooms}개</b>가 등록되어 있지만 좌타 참석자가 없어요.
        좌타방도 일반 방처럼 사용됩니다.
      </div>
    `;
  }

  if (leftRooms && leftPeople > leftRooms) {
    return `
      <div class="warning-box">
        좌타 참석자 <b>${leftPeople}명</b>, 좌타방 <b>${leftRooms}개</b>예요.
        좌타방에 우선 배정 후 나머지는 일반 배정됩니다.
      </div>
    `;
  }

  return '';
}

function updateStats() {
  const roomCount = $('roomCount');
  const peopleCount = $('peopleCount');

  if (roomCount) roomCount.textContent = rooms.length;
  if (peopleCount) peopleCount.textContent = people.length;
}

function renderRooms() {
  const el = $('roomList');
  if (!el) return;

  if (!rooms.length) {
    el.innerHTML = `<div class="empty">아직 등록된 방이 없습니다.</div>`;
    updateStats();
    return;
  }

  el.innerHTML = rooms.map((room, idx) => `
    <div class="item-card">
      <div class="item-main">
        <div class="item-title">
          <b>${esc(room.name)}번 방</b>
          ${room.left ? '<span class="tag left-room">좌타방</span>' : '<span class="tag">일반</span>'}
        </div>
      </div>
      <button class="delete-btn" data-room-index="${idx}" type="button">삭제</button>
    </div>
  `).join('');

  el.querySelectorAll('[data-room-index]').forEach(btn => {
    btn.addEventListener('click', () => removeRoom(Number(btn.dataset.roomIndex)));
  });

  updateStats();
}

function renderPeople() {
  const el = $('peopleList');
  if (!el) return;

  if (!people.length) {
    el.innerHTML = `<div class="empty">아직 등록된 참석자가 없습니다.</div>`;
    updateStats();
    return;
  }

  el.innerHTML = people.map((person, idx) => `
    <div class="item-card">
      <div class="item-main">
        <div class="item-title">
          <b>${esc(person.name)}</b>
          ${person.left ? '<span class="tag left-room">좌타</span>' : ''}
        </div>
        <div class="item-sub">핸디 ${person.handicap}</div>
      </div>
      <button class="delete-btn" data-person-index="${idx}" type="button">삭제</button>
    </div>
  `).join('');

  el.querySelectorAll('[data-person-index]').forEach(btn => {
    btn.addEventListener('click', () => removePerson(Number(btn.dataset.personIndex)));
  });

  updateStats();
}

function addRoom() {
  if (isBusy) return;

  const nameEl = $('roomName');
  const leftEl = $('roomLeft');

  if (!nameEl) return;

  const name = nameEl.value.trim();
  const left = !!(leftEl && leftEl.checked);

  if (!name) {
    alertUser('방 이름 또는 번호를 입력해주세요.');
    nameEl.focus();
    return;
  }

  rooms.push({ name, left });
  save(STORAGE.rooms, rooms);

  nameEl.value = '';
  if (leftEl) leftEl.checked = false;

  renderRooms();
}

function removeRoom(index) {
  if (isBusy) return;
  rooms.splice(index, 1);
  save(STORAGE.rooms, rooms);
  renderRooms();
}

function addPerson() {
  if (isBusy) return;

  const nameEl = $('personName');
  const handicapEl = $('personHandicap');
  const leftEl = $('personLeft');

  if (!nameEl || !handicapEl) return;

  const name = nameEl.value.trim();
  const handicap = Number(handicapEl.value);
  const left = !!(leftEl && leftEl.checked);

  if (!name) {
    alertUser('참석자 이름을 입력해주세요.');
    nameEl.focus();
    return;
  }

  if (handicapEl.value === '' || Number.isNaN(handicap)) {
    alertUser('핸디를 입력해주세요.');
    handicapEl.focus();
    return;
  }

  people.push({ name, handicap, left });
  save(STORAGE.people, people);

  nameEl.value = '';
  handicapEl.value = '';
  if (leftEl) leftEl.checked = false;

  renderPeople();
}

function removePerson(index) {
  if (isBusy) return;
  people.splice(index, 1);
  save(STORAGE.people, people);
  renderPeople();
}

function clearAllData() {
  if (isBusy) return;

  const ok = confirm('등록된 방과 참석자 정보를 모두 삭제할까요?');
  if (!ok) return;

  rooms = [];
  people = [];
  save(STORAGE.rooms, rooms);
  save(STORAGE.people, people);

  const result = $('result');
  if (result) result.innerHTML = '';

  renderRooms();
  renderPeople();
}

function drawRandom() {
  if (isBusy) return;

  if (!rooms.length) {
    alertUser('방이 아직 등록되지 않았어요.\n먼저 방을 등록해주세요.');
    return;
  }
  if (!people.length) {
    alertUser('참석자가 아직 등록되지 않았어요.\n먼저 참석자를 등록해주세요.');
    return;
  }
  if (people.length < rooms.length) {
    alertUser(`참석자 수가 부족해요.\n\n현재: ${people.length}명\n필요: 최소 ${rooms.length}명 (방 1개당 최소 1명 이상 필요)`);
    return;
  }

  isBusy = true;
  setButtonsBusy('<span class="calc-spin">🎲</span> 골방이 셔플 중...', 'random');

  const shuffledRooms = shuffle(rooms).map(r => ({ ...r }));
  const shuffledPeople = shuffle(people).map(p => ({ ...p }));
  const capacities = roomCapacityPlan(shuffledPeople.length, shuffledRooms.length);

  const groups = shuffledRooms.map((room, idx) => ({
    room,
    people: shuffledPeople.splice(0, capacities[idx])
  }));

  animateRandomAssignments(groups);
}

function animateRandomAssignments(groups) {
  const allPeople = groups.flatMap(g => g.people);
  const totalRooms = groups.length;
  const warningHTML = leftRoomWarningHTML();

  $('result').innerHTML = `
    <div class="result-card">
      <div class="result-head">
        <strong><span class="calc-spin">🎲</span> 골방이 랜덤 배정 중이에요...</strong>
        <span id="progressLabel">0/${totalRooms}개 방 완료</span>
      </div>

      ${warningHTML}

      <div class="assignment" id="assignmentArea">
        <div id="revealedList"></div>
        <div id="currentRoomSlot"></div>
        <div id="pendingList"></div>
      </div>
    </div>
  `;

  $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });

  const shuffleDurationPerRoom = 2000;
  const shuffleInterval = 100;
  const pauseBetweenRooms = 300;

  let roomIndex = 0;
  const revealedNames = new Set();

  function renderPending() {
    const pendingCount = Math.max(0, totalRooms - roomIndex - 1);
    $('pendingList').innerHTML = Array.from({ length: pendingCount }).map(() => `
      <div class="room-result pending-room">
        <div class="room-result-title"><b>🎲 대기 중...</b></div>
      </div>
    `).join('');
  }

  function startRoom() {
    if (roomIndex >= totalRooms) {
      finishAll();
      return;
    }

    const currentGroup = groups[roomIndex];
    const pool = allPeople.filter(p => !revealedNames.has(p.name));

    $('currentRoomSlot').innerHTML = `
      <div class="room-result shuffling-room">
        <div class="room-result-title">
          <b>🏌️ ${esc(currentGroup.room.name)}번 방${currentGroup.room.left ? ' · 좌타방' : ''}</b>
          <span>랜덤 셔플 중...</span>
        </div>
        <div class="result-people" id="shuffleChips"></div>
      </div>
    `;

    renderPending();

    let elapsed = 0;
    const chipsEl = $('shuffleChips');

    function tick() {
      const previewPeople = shuffle(pool).slice(0, currentGroup.people.length);
      chipsEl.innerHTML = previewPeople.map(p => `
        <span class="person shuffle-chip">
          ${esc(p.name)}${leftTag(p.left)}
          <small class="handi-badge">핸디 ${p.handicap}</small>
        </span>
      `).join('');

      elapsed += shuffleInterval;

      if (elapsed >= shuffleDurationPerRoom) {
        clearInterval(timer);
        finalizeRoom(currentGroup);
      }
    }

    tick();
    var timer = setInterval(tick, shuffleInterval);
  }

  function finalizeRoom(currentGroup) {
    currentGroup.people.forEach(p => revealedNames.add(p.name));

    $('currentRoomSlot').innerHTML = '';
    $('revealedList').insertAdjacentHTML('beforeend', `
      <div class="room-result reveal-item-done">
        <div class="room-result-title">
          <b>🏌️ ${esc(currentGroup.room.name)}번 방${currentGroup.room.left ? ' · 좌타방' : ''}</b>
          <span>${currentGroup.people.length}명</span>
        </div>
        <div class="result-people">
          ${currentGroup.people.map(p => `
            <span class="person${p.left ? ' left' : ''}">
              ${esc(p.name)}${leftTag(p.left)}
              <small class="handi-badge">핸디 ${p.handicap}</small>
            </span>
          `).join('')}
        </div>
      </div>
    `);

    roomIndex++;
    $('progressLabel').textContent = `${roomIndex}/${totalRooms}개 방 완료`;
    setTimeout(startRoom, pauseBetweenRooms);
  }

  function finishAll() {
    $('result').querySelector('.result-head strong').textContent = '🎉 골방 랜덤 배정 완료';
    $('progressLabel').textContent = `${allPeople.length}명 · ${totalRooms}개 방`;
    resetButtons();
    isBusy = false;
    $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  startRoom();
}

function assignByHandicap(entries, roomList) {
  const targetSizes = roomCapacityPlan(entries.length, roomList.length);

  const groups = roomList.map((room, idx) => ({
    room,
    people: [],
    sum: 0,
    avg: 0,
    targetSize: targetSizes[idx]
  }));

  const leftPeople = entries
    .filter(p => p.left)
    .sort((a, b) => b.handicap - a.handicap);

  const normalPeople = entries
    .filter(p => !p.left)
    .sort((a, b) => b.handicap - a.handicap);

  const leftRoomGroups = groups.filter(g => g.room.left);
  const normalRoomGroups = groups.filter(g => !g.room.left);

  function sortGroupsForInsert(list) {
    return [...list].sort((a, b) => {
      const remainA = a.targetSize - a.people.length;
      const remainB = b.targetSize - b.people.length;

      if (remainA !== remainB) return remainB - remainA;
      if (a.avg !== b.avg) return a.avg - b.avg;
      if (a.sum !== b.sum) return a.sum - b.sum;
      return a.people.length - b.people.length;
    });
  }

  function insertPerson(group, person) {
    group.people.push(person);
    group.sum += person.handicap;
    group.avg = group.people.length ? group.sum / group.people.length : 0;
  }

  function fillPool(pool, preferredGroups, fallbackGroups) {
    for (const person of pool) {
      let candidates = sortGroupsForInsert(
        preferredGroups.filter(g => g.people.length < g.targetSize)
      );

      if (!candidates.length) {
        candidates = sortGroupsForInsert(
          fallbackGroups.filter(g => g.people.length < g.targetSize)
        );
      }

      if (!candidates.length) continue;
      insertPerson(candidates[0], person);
    }
  }

  fillPool(leftPeople, leftRoomGroups, groups);
  fillPool(normalPeople, normalRoomGroups.length ? normalRoomGroups : groups, groups);

  const unfilled = groups.filter(g => g.people.length < g.targetSize);
  if (unfilled.length) {
    const assignedNames = new Set(groups.flatMap(g => g.people.map(p => p.name)));
    const leftovers = entries.filter(p => !assignedNames.has(p.name));
    fillPool(leftovers, groups, groups);
  }

  groups.forEach(g => {
    g.sum = g.people.reduce((s, p) => s + p.handicap, 0);
    g.avg = g.people.length ? g.sum / g.people.length : 0;
  });

  return groups;
}

function summarizeHandicapGroups(groups) {
  const allPeople = groups.flatMap(g => g.people);
  const totalSum = allPeople.reduce((sum, p) => sum + p.handicap, 0);
  const totalAvg = allPeople.length ? totalSum / allPeople.length : 0;
  const maxAvg = Math.max(1, ...groups.map(g => g.avg));
  return { allPeople, totalSum, totalAvg, maxAvg };
}

function renderHandicapRoomCard(g, totalAvg, maxAvg) {
  const dev = g.avg - totalAvg;
  const devAbs = Math.abs(dev);
  const devClass = devAbs < 0.5 ? 'dev-good' : (devAbs < 1.5 ? 'dev-ok' : 'dev-warn');
  const barPct = maxAvg ? Math.max(0, (g.avg / maxAvg) * 100) : 0;

  return `
    <div class="room-result reveal-item-done handicap-room">
      <div class="room-result-title">
        <b>🏌️ ${esc(g.room.name)}번 방${g.room.left ? ' · 좌타방' : ''}</b>
        <span>${g.people.length}명</span>
      </div>
      <div class="result-people">
        ${g.people.map(p => `
          <span class="person${p.left ? ' left' : ''}">
            ${esc(p.name)}${leftTag(p.left)}
            <small class="handi-badge">핸디 ${p.handicap}</small>
          </span>
        `).join('')}
      </div>
      <div class="handicap-stats">
        <span class="stat-chip">총합 핸디 <b>${g.sum}</b></span>
        <span class="stat-chip">평균 핸디 <b>${g.avg.toFixed(2)}</b></span>
        <span class="stat-chip ${devClass}">
          전체 평균과 편차 ${dev >= 0 ? '+' : ''}${dev.toFixed(2)}
        </span>
      </div>
      <div class="balance-bar-track">
        <div class="balance-bar-fill" style="width:${barPct}%"></div>
      </div>
    </div>
  `;
}

function animateHandicapAssignments(groups) {
  const { allPeople, totalSum, totalAvg, maxAvg } = summarizeHandicapGroups(groups);
  const totalRooms = groups.length;
  const warningHTML = leftRoomWarningHTML();

  $('result').innerHTML = `
    <div class="result-card">
      <div class="result-head">
        <strong><span class="calc-spin">⚖️</span> 골방이 균형 배정 중이에요...</strong>
        <span id="progressLabel">0/${totalRooms}개 방 완료</span>
      </div>

      ${warningHTML}

      <div class="handicap-overview">
        <div class="overview-item"><span>전체 참가자</span><b>${allPeople.length}명</b></div>
        <div class="overview-item"><span>전체 총합 핸디</span><b>${totalSum}</b></div>
        <div class="overview-item"><span>전체 평균 핸디</span><b>${totalAvg.toFixed(2)}</b></div>
      </div>

      <div class="assignment" id="assignmentArea">
        <div id="revealedList"></div>
        <div id="currentRoomSlot"></div>
        <div id="pendingList"></div>
      </div>
    </div>
  `;

  $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });

  const shuffleDurationPerRoom = 2000;
  const shuffleInterval = 100;
  const pauseBetweenRooms = 300;

  let roomIndex = 0;
  const revealedNames = new Set();

  function renderPending() {
    const pendingCount = Math.max(0, totalRooms - roomIndex - 1);
    $('pendingList').innerHTML = Array.from({ length: pendingCount }).map(() => `
      <div class="room-result pending-room">
        <div class="room-result-title"><b>⚖️ 대기 중...</b></div>
      </div>
    `).join('');
  }

  function startRoom() {
    if (roomIndex >= totalRooms) {
      finishAll();
      return;
    }

    const currentGroup = groups[roomIndex];
    const pool = allPeople.filter(p => !revealedNames.has(p.name));

    $('currentRoomSlot').innerHTML = `
      <div class="room-result shuffling-room">
        <div class="room-result-title">
          <b>🏌️ ${esc(currentGroup.room.name)}번 방${currentGroup.room.left ? ' · 좌타방' : ''}</b>
          <span>균형 계산 반영 중...</span>
        </div>
        <div class="result-people" id="shuffleChips"></div>
      </div>
    `;

    renderPending();

    let elapsed = 0;
    const chipsEl = $('shuffleChips');

    function tick() {
      const previewPeople = shuffle(pool).slice(0, currentGroup.people.length);
      chipsEl.innerHTML = previewPeople.map(p => `
        <span class="person shuffle-chip">
          ${esc(p.name)}${leftTag(p.left)}
          <small class="handi-badge">핸디 ${p.handicap}</small>
        </span>
      `).join('');

      elapsed += shuffleInterval;

      if (elapsed >= shuffleDurationPerRoom) {
        clearInterval(timer);
        finalizeRoom(currentGroup);
      }
    }

    tick();
    var timer = setInterval(tick, shuffleInterval);
  }

  function finalizeRoom(currentGroup) {
    currentGroup.people.forEach(p => revealedNames.add(p.name));
    $('currentRoomSlot').innerHTML = '';

    $('revealedList').insertAdjacentHTML(
      'beforeend',
      renderHandicapRoomCard(currentGroup, totalAvg, maxAvg)
    );

    roomIndex++;
    $('progressLabel').textContent = `${roomIndex}/${totalRooms}개 방 완료`;
    setTimeout(startRoom, pauseBetweenRooms);
  }

  function finishAll() {
    $('result').querySelector('.result-head strong').textContent = '🎉 골방 균형 배정 완료';
    $('progressLabel').textContent = `${allPeople.length}명 · ${totalRooms}개 방`;
    resetButtons();
    isBusy = false;
    $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  startRoom();
}

function drawHandicap() {
  if (isBusy) return;

  if (!rooms.length) {
    alertUser('방이 아직 등록되지 않았어요.\n먼저 방을 등록해주세요.');
    return;
  }
  if (!people.length) {
    alertUser('참석자가 아직 등록되지 않았어요.\n먼저 참석자를 등록해주세요.');
    return;
  }
  if (people.length < rooms.length) {
    alertUser(`참석자 수가 부족해요.\n\n현재: ${people.length}명\n필요: 최소 ${rooms.length}명 (방 1개당 최소 1명 이상 필요)`);
    return;
  }

  isBusy = true;
  setButtonsBusy('<span class="calc-spin">⚖️</span> 골방이 계산 중...', 'handicap');

  const entries = people.map(p => ({
    name: p.name,
    handicap: p.handicap,
    left: p.left
  }));

  const groups = assignByHandicap(entries, rooms);
  animateHandicapAssignments(groups);
}

function bindEvents() {
  $('addRoomBtn')?.addEventListener('click', addRoom);
  $('addPersonBtn')?.addEventListener('click', addPerson);
  $('drawRandomBtn')?.addEventListener('click', drawRandom);
  $('drawHandicapBtn')?.addEventListener('click', drawHandicap);
  $('resetBtn')?.addEventListener('click', clearAllData);

  $('roomName')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addRoom();
  });

  $('personName')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addPerson();
  });

  $('personHandicap')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addPerson();
  });
}

function init() {
  renderRooms();
  renderPeople();
  bindEvents();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
