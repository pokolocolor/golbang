<script>
  const $ = id => document.getElementById(id);

  const STORAGE = {
    rooms: 'golbang_rooms_v1',
    people: 'golbang_people_v1',
    database: 'golbang_participant_database_v1'
  };

  let participantDB = normalizePeople(readJSON(STORAGE.database));
  let rooms = normalizeRooms(readJSON(STORAGE.rooms));
  let people = normalizePeople(readJSON(STORAGE.people));
  let selectedHandicap = null;
  let deferredInstallPrompt = null;

  let isBusy = false;
  let drawRandomBtnHTML = '';
  let drawHandicapBtnHTML = '';

  function readJSON(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizePeople(list) {
    const map = new Map();
    (Array.isArray(list) ? list : []).forEach(p => {
      if (!p || typeof p !== 'object') return;
      const name = String(p.name || '').trim();
      const handicap = Number(p.handicap);
      if (!name || !Number.isFinite(handicap)) return;
      map.set(name, { name, left: !!p.left, handicap });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }

  function roomNumber(room) {
    return Number.parseInt(String(room?.name ?? '').replace(/\D/g, ''), 10);
  }

  function compareRooms(a, b) {
    const na = roomNumber(a);
    const nb = roomNumber(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'ko', { numeric: true });
  }

  function normalizeRooms(list) {
    const map = new Map();
    (Array.isArray(list) ? list : []).forEach(r => {
      const name = typeof r === 'string'
        ? r.replace(/\D/g, '')
        : String(r?.name || '').replace(/\D/g, '');
      if (!name) return;
      map.set(name, { name, left: !!r?.left });
    });
    return [...map.values()].sort(compareRooms);
  }

  function saveCurrent() {
    rooms = normalizeRooms(rooms);
    people = normalizePeople(people);
    localStorage.setItem(STORAGE.rooms, JSON.stringify(rooms));
    localStorage.setItem(STORAGE.people, JSON.stringify(people));
  }

  function saveDatabaseLocal() {
    participantDB = normalizePeople(participantDB);
    localStorage.setItem(STORAGE.database, JSON.stringify(participantDB));
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(window.__toast);
    window.__toast = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function alertUser(msg) {
    window.alert(msg);
  }

  function esc(s) {
    return String(s).replace(/[&<>'"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c]));
  }

  function leftTag(isLeft) {
    return isLeft ? '<small class="left-tag">좌타</small>' : '';
  }

  function handiTag(h) {
    return `<small class="handi-tag">HDCP ${h}</small>`;
  }

  function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildHandicapGrid() {
    const grid = $('handicapGrid');
    grid.innerHTML = '';
    for (let h = 40; h >= -25; h--) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'handicap-grid-btn';
      btn.textContent = h;
      btn.dataset.value = h;
      btn.addEventListener('click', () => {
        selectedHandicap = h;
        $('personHandicapBtnLabel').textContent = h;
        $('personHandicapBtn').classList.add('selected');
        $('handicapDialog').close();
        highlightHandicapGrid();
      });
      grid.appendChild(btn);
    }
  }

  function highlightHandicapGrid() {
    document.querySelectorAll('.handicap-grid-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) === selectedHandicap);
    });
  }

  function render() {
    rooms = normalizeRooms(rooms);
    people = normalizePeople(people);
    participantDB = normalizePeople(participantDB);

    $('roomCount').textContent = `${rooms.length}개`;
    $('personCount').textContent = `${people.length}명`;
    $('databaseCount').textContent = `${participantDB.length}명`;

    $('roomEmpty').style.display = rooms.length ? 'none' : 'block';
    $('personEmpty').style.display = people.length ? 'none' : 'block';
    $('databaseEmpty').style.display = participantDB.length ? 'none' : 'block';

    $('roomList').innerHTML = rooms.map((r, i) => `
      <div class="chip">
        <span>${esc(r.name)}번 방</span>
        ${leftTag(r.left)}
        <button type="button" onclick="removeRoom(${i})" aria-label="${esc(r.name)}번 방 삭제">×</button>
      </div>
    `).join('');

    $('personList').innerHTML = people.map((p, i) => `
      <div class="chip">
        <span>${esc(p.name)}</span>
        ${handiTag(p.handicap)}
        ${leftTag(p.left)}
        <button type="button" onclick="removePerson(${i})" aria-label="${esc(p.name)} 삭제">×</button>
      </div>
    `).join('');

    const currentNames = new Set(people.map(p => p.name));
    $('databaseList').innerHTML = participantDB.map((p, i) => {
      const selected = currentNames.has(p.name);
      return `
        <div class="db-row">
          <button
            type="button"
            class="db-person-btn ${selected ? 'selected' : ''}"
            onclick="addPersonFromDB(${i})"
            ${selected ? 'disabled' : ''}>
            <span class="db-name">${esc(p.name)}</span>
            ${handiTag(p.handicap)}
            ${leftTag(p.left)}
            <span class="db-action">${selected ? '등록됨' : '+ 등록'}</span>
          </button>
          <button type="button" class="db-delete" onclick="removeFromDB(${i})" aria-label="${esc(p.name)} DB 삭제">×</button>
        </div>
      `;
    }).join('');
  }

  function addRoom() {
    const raw = $('roomInput').value.trim();
    const name = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

    if (!name) {
      alertUser('방 번호를 숫자로 입력해주세요.');
      $('roomInput').focus();
      return;
    }
    if (rooms.some(r => r.name === name)) {
      alertUser(`${name}번 방은 이미 등록되어 있어요.`);
      return;
    }

    rooms.push({ name, left: $('leftRoomToggle').checked });
    rooms = normalizeRooms(rooms);
    $('roomInput').value = '';
    $('leftRoomToggle').checked = false;

    saveCurrent();
    render();
    $('roomInput').focus();
  }

  function addPerson(name, handicapValue) {
    name = String(name || '').trim();
    const left = $('leftPersonToggle').checked;

    if (!name) {
      alertUser('참석자 이름을 입력해주세요.');
      $('personInput').focus();
      return false;
    }
    if (people.some(p => p.name === name)) {
      alertUser(`${name}님은 이미 이번 모임에 등록되어 있어요.`);
      return false;
    }
    if (handicapValue === null || handicapValue === undefined || handicapValue === '') {
      alertUser('핸디를 선택해주세요.');
      $('personHandicapBtn').focus();
      return false;
    }

    const handicap = Number(handicapValue);
    if (!Number.isFinite(handicap)) {
      alertUser('핸디 값이 올바르지 않아요. 다시 선택해주세요.');
      return false;
    }

    people.push({ name, left, handicap });
    participantDB = normalizePeople([...participantDB, { name, left, handicap }]);

    saveCurrent();
    saveDatabaseLocal();
    render();

    toast(`${name}${left ? ' (좌타)' : ''} · 핸디 ${handicap} 등록 완료`);
    return true;
  }

  function addPersonFromInput() {
    const name = $('personInput').value.trim();
    if (addPerson(name, selectedHandicap)) {
      $('personInput').value = '';
      selectedHandicap = null;
      $('personHandicapBtnLabel').textContent = '핸디';
      $('personHandicapBtn').classList.remove('selected');
      $('leftPersonToggle').checked = false;
      $('personInput').focus();
    }
  }

  function addPersonFromDB(index) {
    const entry = participantDB[index];
    if (!entry) return;

    if (people.some(p => p.name === entry.name)) {
      alertUser(`${entry.name}님은 이미 이번 모임에 등록되어 있어요.`);
      return;
    }

    people.push({ name: entry.name, left: entry.left, handicap: entry.handicap });
    saveCurrent();
    render();

    toast(`${entry.name}${entry.left ? ' (좌타)' : ''} · 핸디 ${entry.handicap} 등록 완료`);
  }

  function removeRoom(i) {
    const room = rooms[i];
    if (!room) return;
    if (!window.confirm(`${room.name}번 방을 삭제할까요?`)) return;
    rooms.splice(i, 1);
    saveCurrent();
    render();
  }

  function removePerson(i) {
    const p = people[i];
    if (!p) return;
    if (!window.confirm(`${p.name}님을 이번 모임에서 삭제할까요?\n참가자 DB에서는 삭제되지 않습니다.`)) return;
    people.splice(i, 1);
    saveCurrent();
    render();
  }

  function removeFromDB(i) {
    const p = participantDB[i];
    if (!p) return;
    if (!window.confirm(`${p.name}님을 참가자 DB에서도 삭제할까요?`)) return;
    participantDB.splice(i, 1);
    saveDatabaseLocal();
    render();
  }

  function leftRoomWarningHTML() {
    const hasLeftRoom = rooms.some(r => r.left);
    const hasLeftPeople = people.some(p => p.left);
    if (hasLeftPeople && !hasLeftRoom) {
      return '<div class="result-warning">⚠️ 좌타 참석자가 있지만 좌타방이 등록되어 있지 않아, 좌타 여부와 관계없이 배정되었습니다.</div>';
    }
    return '';
  }

  function getGroupSizes(roomCount, personCount) {
    const min = roomCount * 2;
    const extra = personCount - min;
    const sizes = Array(roomCount).fill(2);
    shuffle(Array.from({ length: roomCount }, (_, i) => i))
      .slice(0, extra)
      .forEach(i => { sizes[i] = 3; });
    return sizes;
  }

  function buildAssignments() {
    const shuffledRooms = shuffle(normalizeRooms(rooms));
    const sizes = getGroupSizes(shuffledRooms.length, people.length);
    const groups = shuffledRooms.map((room, i) => ({ room, capacity: sizes[i], people: [] }));

    const leftPeople = shuffle(people.filter(p => p.left));
    const rightPeople = shuffle(people.filter(p => !p.left));

    const leftRoomGroups = shuffle(groups.filter(g => g.room.left));
    let li = 0;

    leftRoomGroups.forEach(group => {
      while (group.people.length < group.capacity && li < leftPeople.length) {
        group.people.push(leftPeople[li++]);
      }
    });

    const remaining = shuffle([...rightPeople, ...leftPeople.slice(li)]);
    let cursor = 0;

    groups.forEach(group => {
      while (group.people.length < group.capacity) {
        group.people.push(remaining[cursor++]);
      }
    });

    return groups;
  }

  function validateForDraw() {
    const roomCount = rooms.length;
    const personCount = people.length;

    if (!roomCount) {
      alertUser('방이 아직 등록되지 않았어요.\n먼저 방을 등록해주세요.');
      return false;
    }
    if (!personCount) {
      alertUser('참석자가 아직 등록되지 않았어요.\n먼저 참석자를 등록해주세요.');
      return false;
    }

    const minPeople = roomCount * 2;
    const maxPeople = roomCount * 3;

    if (personCount < minPeople) {
      alertUser(`참석자가 부족해요.\n\n현재: ${personCount}명\n필요: 최소 ${minPeople}명\n방 ${roomCount}개 × 최소 2명`);
      return false;
    }
    if (personCount > maxPeople) {
      alertUser(`방이 부족해요.\n\n현재: ${personCount}명\n수용 가능: 최대 ${maxPeople}명\n방 ${roomCount}개 × 최대 3명\n\n방을 추가하거나 참석자를 줄여주세요.`);
      return false;
    }

    return true;
  }

  function setButtonsBusy(activeHTML, which) {
    const r = $('drawRandomBtn');
    const h = $('drawHandicapBtn');

    r.disabled = true;
    h.disabled = true;

    if (which === 'random') {
      r.innerHTML = activeHTML;
      r.classList.add('drawing');
    } else {
      h.innerHTML = activeHTML;
      h.classList.add('drawing');
    }
  }

  function resetButtons() {
    const r = $('drawRandomBtn');
    const h = $('drawHandicapBtn');

    r.disabled = false;
    h.disabled = false;
    r.classList.remove('drawing');
    h.classList.remove('drawing');
    r.innerHTML = drawRandomBtnHTML;
    h.innerHTML = drawHandicapBtnHTML;
  }

  function animateAssignments({
    groups,
    headHTML,
    finishTitle,
    warningHTML = '',
    extraHTML = '',
    previewTitle,
    previewStatus,
    pendingLabel = '🏌️ 대기 중...',
    getPreviewPool,
    renderPreviewChip,
    renderFinalCard,
    finishCountText
  }) {
    const totalRooms = groups.length;

    $('result').innerHTML = `
      <div class="result-card">
        <div class="result-head">
          <strong>${headHTML}</strong>
          <span id="progressLabel">0/${totalRooms}개 방 완료</span>
        </div>
        ${warningHTML}
        ${extraHTML}
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
          <div class="room-result-title"><b>${pendingLabel}</b></div>
        </div>
      `).join('');
    }

    function startRoom() {
      if (roomIndex >= totalRooms) {
        finishAll();
        return;
      }

      const currentGroup = groups[roomIndex];
      const previewPool = getPreviewPool(revealedNames, currentGroup);

      $('currentRoomSlot').innerHTML = `
        <div class="room-result shuffling-room">
          <div class="room-result-title">
            <b>${previewTitle(currentGroup)}</b>
            <span>${previewStatus(currentGroup)}</span>
          </div>
          <div class="result-people" id="shuffleChips"></div>
        </div>
      `;

      renderPending();

      let elapsed = 0;
      const chipsEl = $('shuffleChips');

      function tick() {
        const previewPeople = shuffle(previewPool).slice(0, currentGroup.people.length);
        chipsEl.innerHTML = previewPeople.map(renderPreviewChip).join('');

        elapsed += shuffleInterval;
        if (elapsed >= shuffleDurationPerRoom) {
          clearInterval(timer);
          finalizeRoom(currentGroup);
        }
      }

      tick();
      const timer = setInterval(tick, shuffleInterval);
    }

    function finalizeRoom(currentGroup) {
      currentGroup.people.forEach(p => revealedNames.add(p.name));
      $('currentRoomSlot').innerHTML = '';
      $('revealedList').insertAdjacentHTML('beforeend', renderFinalCard(currentGroup));

      roomIndex++;
      $('progressLabel').textContent = `${roomIndex}/${totalRooms}개 방 완료`;

      setTimeout(startRoom, pauseBetweenRooms);
    }

    function finishAll() {
      $('result').querySelector('.result-head strong').textContent = finishTitle;
      $('progressLabel').textContent = finishCountText();
      resetButtons();
      isBusy = false;
      $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    startRoom();
  }

  function draw() {
    if (isBusy) return;
    if (!validateForDraw()) return;

    const groups = buildAssignments();
    if (!groups.every(g => g.people.length >= 2 && g.people.length <= 3)) {
      alertUser('방배정 조건을 만족하는 결과를 만들지 못했어요. 다시 시도해주세요.');
      return;
    }

    groups.sort((a, b) => compareRooms(a.room, b.room));

    isBusy = true;
    setButtonsBusy('<span class="dice-spin">🎲</span> 골방이 배정 중...', 'random');

    animateAssignments({
      groups,
      headHTML: '🎲 골방이 방배정 중이에요...',
      finishTitle: '🎉 골방 배정 완료',
      warningHTML: leftRoomWarningHTML(),
      extraHTML: '',
      pendingLabel: '🏌️ 대기 중...',
      previewTitle: currentGroup => `🏌️ ${esc(currentGroup.room.name)}번 방`,
      previewStatus: () => '배정 중...',
      getPreviewPool: revealedNames => people.filter(p => !revealedNames.has(p.name)),
      renderPreviewChip: p => `<span class="person shuffle-chip">${esc(p.name)}</span>`,
      renderFinalCard: currentGroup => `
        <div class="room-result reveal-item-done">
          <div class="room-result-title">
            <b>🏌️ ${esc(currentGroup.room.name)}번 방</b>
            <span>${currentGroup.people.length}명${currentGroup.room.left ? ' · 좌타방' : ''}</span>
          </div>
          <div class="result-people">
            ${currentGroup.people.map(p => `
              <span class="person${p.left ? ' left' : ''}">${esc(p.name)}${leftTag(p.left)}</span>
            `).join('')}
          </div>
        </div>
      `,
      finishCountText: () => `${people.length}명 · ${groups.length}개 방`
    });
  }

  function computeRoomCapacities(totalPeople, roomCount) {
    const base = Math.floor(totalPeople / roomCount);
    const remainder = totalPeople % roomCount;
    const capacities = Array(roomCount).fill(base);

    shuffle(Array.from({ length: roomCount }, (_, i) => i))
      .slice(0, remainder)
      .forEach(i => { capacities[i] += 1; });

    return capacities;
  }

  function pickTargetGroup(candidateGroups) {
    const available = candidateGroups.filter(g => g.people.length < g.capacity);
    if (!available.length) return null;

    available.sort((a, b) => {
      if (a.people.length !== b.people.length) return a.people.length - b.people.length;
      const avgA = a.people.length ? a.sum / a.people.length : 0;
      const avgB = b.people.length ? a.sum / b.people.length : 0;
      return avgB - avgA;
    });

    return available[0];
  }

  function assignByHandicap(entries, roomList) {
    const totalPeople = entries.length;
    const roomCount = roomList.length;
    const capacities = computeRoomCapacities(totalPeople, roomCount);

    const groups = shuffle(roomList.map(r => ({ ...r }))).map((room, i) => ({
      room,
      capacity: capacities[i],
      people: [],
      sum: 0
    }));

    const leftGroups = groups.filter(g => g.room.left);
    const hasLeftRoom = leftGroups.length > 0;

    const leftPeopleSorted = shuffle(entries.filter(p => p.left)).sort((a, b) => a.handicap - b.handicap);
    const overflow = [];

    leftPeopleSorted.forEach(person => {
      const target = hasLeftRoom ? pickTargetGroup(leftGroups) : null;
      if (target) {
        target.people.push(person);
        target.sum += person.handicap;
      } else {
        overflow.push(person);
      }
    });

    const rightPeople = entries.filter(p => !p.left);
    const remaining = shuffle([...rightPeople, ...overflow]).sort((a, b) => a.handicap - b.handicap);

    remaining.forEach(person => {
      const target = pickTargetGroup(groups);
      if (!target) return;
      target.people.push(person);
      target.sum += person.handicap;
    });

    const result = groups.map(g => ({
      room: g.room,
      people: g.people,
      sum: g.sum,
      avg: g.people.length ? g.sum / g.people.length : 0
    }));

    result.sort((a, b) => compareRooms(a.room, b.room));
    return result;
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
    const barPct = maxAvg ? (g.avg / maxAvg) * 100 : 0;

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
          <span class="stat-chip ${devClass}">전체 평균과 편차 ${dev >= 0 ? '+' : ''}${dev.toFixed(2)}</span>
        </div>
        <div class="balance-bar-track">
          <div class="balance-bar-fill" style="width:${barPct}%"></div>
        </div>
      </div>
    `;
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
    const { allPeople, totalSum, totalAvg, maxAvg } = summarizeHandicapGroups(groups);

    animateAssignments({
      groups,
      headHTML: '⚖️ 골방이 균형 배정 중이에요...',
      finishTitle: '🎉 골방 균형 배정 완료',
      warningHTML: leftRoomWarningHTML(),
      extraHTML: `
        <div class="handicap-overview">
          <div class="overview-item"><span>전체 참가자</span><b>${allPeople.length}명</b></div>
          <div class="overview-item"><span>전체 총합 핸디</span><b>${totalSum}</b></div>
          <div class="overview-item"><span>전체 평균 핸디</span><b>${totalAvg.toFixed(2)}</b></div>
        </div>
      `,
      pendingLabel: '🏌️ 대기 중...',
      previewTitle: currentGroup => `🏌️ ${esc(currentGroup.room.name)}번 방${currentGroup.room.left ? ' · 좌타방' : ''}`,
      previewStatus: () => '배정 중...',
      getPreviewPool: revealedNames => allPeople.filter(p => !revealedNames.has(p.name)),
      renderPreviewChip: p => `
        <span class="person shuffle-chip">
          ${esc(p.name)}${leftTag(p.left)}
          <small class="handi-badge">핸디 ${p.handicap}</small>
        </span>
      `,
      renderFinalCard: currentGroup => renderHandicapRoomCard(currentGroup, totalAvg, maxAvg),
      finishCountText: () => `${allPeople.length}명 · ${groups.length}개 방`
    });
  }

  function updateInstallButton() {
    $('installBtn').classList.toggle('hidden', !deferredInstallPrompt);
  }

  $('addRoomBtn').addEventListener('click', addRoom);
  $('addPersonBtn').addEventListener('click', addPersonFromInput);
  $('drawRandomBtn').addEventListener('click', draw);
  $('drawHandicapBtn').addEventListener('click', drawHandicap);

  $('roomInput').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '');
  });
  $('roomInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addRoom();
  });

  $('personInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      highlightHandicapGrid();
      $('handicapDialog').showModal();
    }
  });

  $('personHandicapBtn').addEventListener('click', () => {
    highlightHandicapGrid();
    $('handicapDialog').showModal();
  });

  $('closeHandicapDialog').addEventListener('click', () => $('handicapDialog').close());

  $('helpBtn').addEventListener('click', () => $('helpDialog').showModal());
  $('closeHelp').addEventListener('click', () => $('helpDialog').close());

  $('clearDatabaseBtn').addEventListener('click', () => {
    if (!participantDB.length) {
      alertUser('삭제할 참가자 DB가 없어요.');
      return;
    }
    if (!window.confirm('저장된 참가자 DB를 모두 삭제할까요?\n현재 모임 참석자는 삭제되지 않습니다.')) return;

    participantDB = [];
    saveDatabaseLocal();
    render();
  });

  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('현재 모임의 방과 참석자를 초기화할까요?\n참가자 DB는 유지됩니다.')) return;

    rooms = [];
    people = [];
    saveCurrent();
    $('result').innerHTML = '';
    render();

    toast('현재 모임이 초기화되었어요. 참가자 DB는 유지됩니다.');
  });

  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } catch {}
    deferredInstallPrompt = null;
    updateInstallButton();
  });

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallButton();
    toast('골방을 이 기기에 앱으로 설치할 수 있어요.');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButton();
    toast('골방 설치가 완료되었어요.');
  });

  window.addEventListener('online', () => toast('인터넷에 다시 연결되었어요.'));
  window.addEventListener('offline', () => toast('오프라인 상태예요. 저장된 기능은 계속 사용할 수 있어요.'));

  drawRandomBtnHTML = $('drawRandomBtn').innerHTML;
  drawHandicapBtnHTML = $('drawHandicapBtn').innerHTML;

  buildHandicapGrid();
  render();
  updateInstallButton();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.error('Service Worker 등록 실패:', err);
      });
    });
  }

  window.removeRoom = removeRoom;
  window.removePerson = removePerson;
  window.removeFromDB = removeFromDB;
  window.addPersonFromDB = addPersonFromDB;
</script>
