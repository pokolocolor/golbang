(() => {
  "use strict";

  const STORAGE_KEYS = {
    rooms: "golbang_rooms_v1",
    attendees: "golbang_attendees_v1"
  };

  let rooms = [];
  let attendees = [];
  let deferredPrompt = null;
  let refs = {};

  /* =========================
   * 유틸
   * ========================= */
  function $(...selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function uid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function toBool(value) {
    return value === true || value === "true" || value === 1 || value === "1";
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function normalizeRoom(room) {
    return {
      id: room?.id || uid(),
      name: String(room?.name ?? "").trim(),
      capacity: Math.max(1, parseInt(room?.capacity, 10) || 1),
      lefty: toBool(room?.lefty ?? room?.isLefty ?? room?.leftHanded ?? false)
    };
  }

  function normalizeAttendee(person) {
    return {
      id: person?.id || uid(),
      name: String(person?.name ?? "").trim(),
      handicap: toNumber(person?.handicap ?? person?.handi ?? person?.score ?? 0, 0),
      lefty: toBool(person?.lefty ?? person?.isLefty ?? person?.leftHanded ?? false)
    };
  }

  function updateWindowState() {
    window.rooms = rooms;
    window.attendees = attendees;
  }

  /* =========================
   * DOM
   * ========================= */
  function cacheRefs() {
    refs = {
      roomForm: $("#roomForm", "[data-room-form]"),
      roomNameInput: $("#roomName", "#roomNameInput", 'input[name="roomName"]'),
      roomCapacityInput: $("#roomCapacity", "#roomCapacityInput", 'input[name="roomCapacity"]'),
      roomLeftyInput: $("#roomLefty", "#roomIsLefty", "#leftyRoom", 'input[name="roomLefty"]'),
      addRoomBtn: $("#addRoomBtn", "#roomAddBtn", "[data-add-room]"),
      clearRoomsBtn: $("#clearRoomsBtn", "[data-clear-rooms]"),
      roomList: $("#roomList", ".room-list", "[data-room-list]"),
      roomCount: $("#roomCount", "[data-room-count]"),
      totalCapacity: $("#totalCapacity", "[data-total-capacity]"),
      leftyRoomCount: $("#leftyRoomCount", "[data-lefty-room-count]"),

      attendeeForm: $("#attendeeForm", "[data-attendee-form]"),
      attendeeNameInput: $("#attendeeName", "#attendeeNameInput", 'input[name="attendeeName"]'),
      attendeeHandicapInput: $("#attendeeHandicap", "#attendeeHandicapInput", 'input[name="attendeeHandicap"]'),
      attendeeLeftyInput: $("#attendeeLefty", "#participantLefty", "#leftyAttendee", 'input[name="attendeeLefty"]'),
      addAttendeeBtn: $("#addAttendeeBtn", "#participantAddBtn", "[data-add-attendee]"),
      clearAttendeesBtn: $("#clearAttendeesBtn", "[data-clear-attendees]"),
      attendeeList: $("#attendeeList", ".attendee-list", "[data-attendee-list]"),
      attendeeCount: $("#attendeeCount", "[data-attendee-count]"),
      leftyAttendeeCount: $("#leftyAttendeeCount", "[data-lefty-attendee-count]"),

      bulkTextarea: $("#bulkAttendees", "#attendeeBulk", "textarea[data-bulk-attendees]"),
      bulkAddBtn: $("#addBulkAttendeesBtn", "[data-add-bulk-attendees]"),

      randomDrawBtn: $("#randomDrawBtn", "#drawRandomBtn", "[data-draw-random]"),
      handicapDrawBtn: $("#handicapDrawBtn", "#drawHandicapBtn", "[data-draw-handicap]"),
      clearAllBtn: $("#clearAllBtn", "#resetBtn", "[data-clear-all]"),

      resultSection: $("#resultSection", ".result-section", "[data-result-section]"),
      resultSummary: $("#resultSummary", ".result-summary", "[data-result-summary]"),
      resultCards: $("#resultCards", ".result-cards", "[data-result-cards]"),

      installBtn: $("#installBtn", "[data-install-app]")
    };
  }

  /* =========================
   * 저장
   * ========================= */
  function saveState() {
    localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(rooms));
    localStorage.setItem(STORAGE_KEYS.attendees, JSON.stringify(attendees));
    updateWindowState();
  }

  function loadState() {
    try {
      const savedRooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.rooms) || "[]");
      const savedAttendees = JSON.parse(localStorage.getItem(STORAGE_KEYS.attendees) || "[]");

      rooms = Array.isArray(savedRooms) ? savedRooms.map(normalizeRoom) : [];
      attendees = Array.isArray(savedAttendees) ? savedAttendees.map(normalizeAttendee) : [];
    } catch (e) {
      console.error("데이터 로드 실패:", e);
      rooms = [];
      attendees = [];
    }
    updateWindowState();
  }

  /* =========================
   * 렌더링
   * ========================= */
  function clearResults() {
    if (refs.resultCards) refs.resultCards.innerHTML = "";
    if (refs.resultSummary) refs.resultSummary.textContent = "";
    if (refs.resultSection) refs.resultSection.hidden = true;
  }

  function updateStats() {
    const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    const leftyRoomCount = rooms.filter(room => room.lefty).length;
    const leftyAttendeeCount = attendees.filter(person => person.lefty).length;

    if (refs.roomCount) refs.roomCount.textContent = String(rooms.length);
    if (refs.totalCapacity) refs.totalCapacity.textContent = String(totalCapacity);
    if (refs.leftyRoomCount) refs.leftyRoomCount.textContent = String(leftyRoomCount);
    if (refs.attendeeCount) refs.attendeeCount.textContent = String(attendees.length);
    if (refs.leftyAttendeeCount) refs.leftyAttendeeCount.textContent = String(leftyAttendeeCount);
  }

  function renderRooms() {
    if (!refs.roomList) return;

    if (!rooms.length) {
      refs.roomList.innerHTML = `<div class="empty-state">등록된 방이 없습니다.</div>`;
      updateStats();
      return;
    }

    refs.roomList.innerHTML = rooms.map((room, index) => `
      <div class="manage-card room-card" data-room-id="${escapeHtml(room.id)}">
        <div class="manage-card-head">
          <strong>${escapeHtml(room.name || `방 ${index + 1}`)}</strong>
          <div class="manage-badges">
            <span class="badge">${room.capacity}명</span>
            ${room.lefty ? '<span class="badge lefty">좌타 우선</span>' : ""}
          </div>
        </div>
        <div class="manage-card-actions">
          <button type="button" class="danger-btn" data-remove-room="${escapeHtml(room.id)}">삭제</button>
        </div>
      </div>
    `).join("");

    updateStats();
  }

  function renderAttendees() {
    if (!refs.attendeeList) return;

    if (!attendees.length) {
      refs.attendeeList.innerHTML = `<div class="empty-state">등록된 참석자가 없습니다.</div>`;
      updateStats();
      return;
    }

    refs.attendeeList.innerHTML = attendees.map((person, index) => `
      <div class="manage-card attendee-card" data-attendee-id="${escapeHtml(person.id)}">
        <div class="manage-card-head">
          <strong>${escapeHtml(person.name || `참석자 ${index + 1}`)}</strong>
          <div class="manage-badges">
            <span class="badge handi-badge">핸디 ${person.handicap}</span>
            ${person.lefty ? '<span class="badge lefty">좌타</span>' : ""}
          </div>
        </div>
        <div class="manage-card-actions">
          <button type="button" class="danger-btn" data-remove-attendee="${escapeHtml(person.id)}">삭제</button>
        </div>
      </div>
    `).join("");

    updateStats();
  }

  function refreshAll() {
    renderRooms();
    renderAttendees();
    updateStats();
    saveState();
  }

  /* =========================
   * 등록 / 삭제
   * ========================= */
  function addRoom() {
    const name = refs.roomNameInput?.value?.trim() || "";
    const capacity = parseInt(refs.roomCapacityInput?.value, 10);
    const lefty = !!refs.roomLeftyInput?.checked;

    if (!name) {
      alert("방 이름을 입력해 주세요.");
      refs.roomNameInput?.focus();
      return;
    }

    if (!Number.isInteger(capacity) || capacity <= 0) {
      alert("방 인원을 올바르게 입력해 주세요.");
      refs.roomCapacityInput?.focus();
      return;
    }

    rooms.push(normalizeRoom({
      id: uid(),
      name,
      capacity,
      lefty
    }));

    if (refs.roomNameInput) refs.roomNameInput.value = "";
    if (refs.roomCapacityInput) refs.roomCapacityInput.value = "";
    if (refs.roomLeftyInput) refs.roomLeftyInput.checked = false;

    clearResults();
    refreshAll();
    refs.roomNameInput?.focus();
  }

  function removeRoom(roomId) {
    rooms = rooms.filter(room => room.id !== roomId);
    clearResults();
    refreshAll();
  }

  function clearRooms() {
    if (!rooms.length) return;
    if (!confirm("등록된 방을 모두 삭제할까요?")) return;
    rooms = [];
    clearResults();
    refreshAll();
  }

  function addAttendee() {
    const name = refs.attendeeNameInput?.value?.trim() || "";
    const handicap = toNumber(refs.attendeeHandicapInput?.value?.trim() || 0, 0);
    const lefty = !!refs.attendeeLeftyInput?.checked;

    if (!name) {
      alert("참석자 이름을 입력해 주세요.");
      refs.attendeeNameInput?.focus();
      return;
    }

    attendees.push(normalizeAttendee({
      id: uid(),
      name,
      handicap,
      lefty
    }));

    if (refs.attendeeNameInput) refs.attendeeNameInput.value = "";
    if (refs.attendeeHandicapInput) refs.attendeeHandicapInput.value = "";
    if (refs.attendeeLeftyInput) refs.attendeeLeftyInput.checked = false;

    clearResults();
    refreshAll();
    refs.attendeeNameInput?.focus();
  }

  function removeAttendee(attendeeId) {
    attendees = attendees.filter(person => person.id !== attendeeId);
    clearResults();
    refreshAll();
  }

  function clearAttendees() {
    if (!attendees.length) return;
    if (!confirm("등록된 참석자를 모두 삭제할까요?")) return;
    attendees = [];
    clearResults();
    refreshAll();
  }

  function clearAll() {
    if (!rooms.length && !attendees.length) return;
    if (!confirm("방과 참석자 데이터를 모두 삭제할까요?")) return;
    rooms = [];
    attendees = [];
    clearResults();
    refreshAll();
  }

  function addBulkAttendees() {
    const text = refs.bulkTextarea?.value?.trim() || "";
    if (!text) {
      alert("일괄 입력 내용을 입력해 주세요.");
      refs.bulkTextarea?.focus();
      return;
    }

    const lines = text.split("\n").map(v => v.trim()).filter(Boolean);
    const created = [];

    for (const line of lines) {
      const parts = line.split(/[,\t/|]/).map(v => v.trim());
      const name = parts[0] || "";
      const handicap = toNumber(parts[1] ?? 0, 0);
      const leftyText = String(parts[2] || "").toLowerCase();
      const lefty = ["좌", "좌타", "left", "lefty", "l", "1", "true", "y", "yes"].includes(leftyText);

      if (!name) continue;

      created.push(normalizeAttendee({
        id: uid(),
        name,
        handicap,
        lefty
      }));
    }

    if (!created.length) {
      alert("형식을 확인해 주세요. 예: 홍길동, 12, 좌타");
      return;
    }

    attendees.push(...created);
    if (refs.bulkTextarea) refs.bulkTextarea.value = "";

    clearResults();
    refreshAll();
  }

  /* =========================
   * 배정 공통
   * ========================= */
  function ensureDrawReady() {
    if (!rooms.length) {
      alert("먼저 방을 등록해 주세요.");
      return false;
    }

    if (!attendees.length) {
      alert("먼저 참석자를 등록해 주세요.");
      return false;
    }

    const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    if (attendees.length > totalCapacity) {
      alert("참석자가 방 수용 인원을 초과했습니다.");
      return false;
    }

    return true;
  }

  function createAssignmentShell() {
    return rooms.map((room, index) => ({
      roomId: room.id,
      roomName: room.name || `방 ${index + 1}`,
      capacity: room.capacity,
      lefty: !!room.lefty,
      members: []
    }));
  }

  function remainingSeats(group) {
    return group.capacity - group.members.length;
  }

  function totalHandicap(group) {
    return group.members.reduce((sum, p) => sum + toNumber(p.handicap, 0), 0);
  }

  function avgHandicap(group) {
    return group.members.length ? totalHandicap(group) / group.members.length : 0;
  }

  function availableGroups(groups, person) {
    let list = groups.filter(group => remainingSeats(group) > 0);
    if (!list.length) return [];

    if (person.lefty) {
      const leftyRooms = list.filter(group => group.lefty);
      if (leftyRooms.length) list = leftyRooms;
    }

    return list;
  }

  /* =========================
   * 랜덤 배정
   * ========================= */
  function assignRandom() {
    const groups = createAssignmentShell();
    const people = shuffle(attendees);

    for (const person of people) {
      let candidates = availableGroups(groups, person);
      if (!candidates.length) throw new Error("배정 가능한 방이 없습니다.");

      const minFill = Math.min(...candidates.map(group => group.members.length / group.capacity));
      candidates = candidates.filter(group => (group.members.length / group.capacity) === minFill);
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];

      chosen.members.push(person);
    }

    return groups;
  }

  /* =========================
   * 핸디 균형 배정
   * ========================= */
  function assignByHandicap() {
    const groups = createAssignmentShell();

    const people = [...attendees].sort((a, b) => {
      const diff = toNumber(b.handicap, 0) - toNumber(a.handicap, 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "ko");
    });

    for (const person of people) {
      let candidates = availableGroups(groups, person);
      if (!candidates.length) throw new Error("배정 가능한 방이 없습니다.");

      candidates = shuffle(candidates).sort((a, b) => {
        const fillA = a.members.length / a.capacity;
        const fillB = b.members.length / b.capacity;
        if (fillA !== fillB) return fillA - fillB;

        const totalA = totalHandicap(a);
        const totalB = totalHandicap(b);
        if (totalA !== totalB) return totalA - totalB;

        const avgA = avgHandicap(a);
        const avgB = avgHandicap(b);
        if (avgA !== avgB) return avgA - avgB;

        return 0;
      });

      candidates[0].members.push(person);
    }

    return groups;
  }

  /* =========================
   * 결과 요약
   * ========================= */
  function summarizeRandom(groups) {
    return groups
      .map((group, i) => `${group.roomName || `방 ${i + 1}`}: ${group.members.length}명`)
      .join(" / ");
  }

  function summarizeHandicap(groups) {
    return groups
      .map((group, i) => {
        const list = group.members.map(m => toNumber(m.handicap, 0));
        const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
        return `${group.roomName || `방 ${i + 1}`}: ${group.members.length}명 · 평균 핸디 ${avg.toFixed(1)}`;
      })
      .join(" / ");
  }

  /* =========================
   * 결과 카드 렌더
   * ========================= */
  function renderRoomCard(group, revealed, shufflePool, mode) {
    const members = Array.isArray(group.members) ? group.members : [];

    const fakeMembers = Array.from({ length: Math.max(1, members.length || 4) }, () => {
      const picked = shufflePool[Math.floor(Math.random() * shufflePool.length)];
      return picked || { name: "배정 중...", handicap: "", lefty: false };
    });

    const viewMembers = revealed ? members : fakeMembers;

    const handiValues = members.map(m => toNumber(m.handicap, 0));
    const avg = handiValues.length
      ? (handiValues.reduce((a, b) => a + b, 0) / handiValues.length).toFixed(1)
      : "0.0";

    return `
      <div class="result-room-card ${revealed ? "revealed" : "shuffling"}">
        <div class="result-room-head">
          <strong>${escapeHtml(group.roomName)}</strong>
          <span>
            ${
              revealed
                ? (mode === "handicap" ? `평균 핸디 ${avg}` : `${members.length}명`)
                : "셔플 중..."
            }
          </span>
        </div>

        <div class="result-member-list">
          ${viewMembers.map(member => {
            const name = member?.name || "이름없음";
            const handicap = revealed ? (member?.handicap ?? "") : "…";
            const lefty = revealed && !!member?.lefty;

            return `
              <div class="result-member-item">
                <span class="name">${escapeHtml(name)}</span>
                <span class="meta">
                  ${revealed && handicap !== "" ? `<span class="handi-badge">${escapeHtml(handicap)}</span>` : ""}
                  ${lefty ? `<span class="lefty-badge">좌타</span>` : ""}
                </span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderShuffleFrame(groups, shufflePool, mode, revealCount) {
    if (!refs.resultCards) return;

    refs.resultCards.innerHTML = groups.map((group, idx) => {
      const revealed = idx < revealCount;
      return renderRoomCard(group, revealed, shufflePool, mode);
    }).join("");
  }

  async function animateDraw(groups, mode) {
    if (!refs.resultCards) return;

    const shufflePool = groups.flatMap(group => group.members).map(member => ({
      name: member.name || "이름없음",
      handicap: member.handicap ?? "",
      lefty: !!member.lefty
    }));

    if (refs.resultSection) {
      refs.resultSection.hidden = false;
      refs.resultSection.style.display = "";
    }

    if (refs.resultSummary) {
      refs.resultSummary.textContent = mode === "handicap"
        ? "핸디 균형 배정 중..."
        : "랜덤 방배정 중...";
    }

    /* 
      핵심:
      - 1) 2초 동안 전체 카드가 계속 셔플 상태로 갱신
      - 2) 그 후 같은 함수 안에서 순차 공개
      - 즉, 랜덤/핸디가 완전히 같은 경로를 사용
    */

    const shuffleDuration = 2000;
    const shuffleTick = 100;
    const shuffleFrames = Math.max(1, Math.floor(shuffleDuration / shuffleTick));

    for (let i = 0; i < shuffleFrames; i += 1) {
      renderShuffleFrame(groups, shufflePool, mode, 0);
      await sleep(shuffleTick);
    }

    for (let reveal = 1; reveal <= groups.length; reveal += 1) {
      renderShuffleFrame(groups, shufflePool, mode, reveal);
      await sleep(180);
    }

    if (refs.resultSummary) {
      refs.resultSummary.textContent = mode === "handicap"
        ? summarizeHandicap(groups)
        : summarizeRandom(groups);
    }
  }

  /* =========================
   * 실행
   * ========================= */
  async function runDraw(mode) {
    if (!ensureDrawReady()) return;

    try {
      clearResults();

      const groups = mode === "handicap"
        ? assignByHandicap()
        : assignRandom();

      await animateDraw(groups, mode);
    } catch (e) {
      console.error(e);
      alert(mode === "handicap"
        ? "핸디 균형 배정 중 오류가 발생했습니다."
        : "랜덤 방배정 중 오류가 발생했습니다.");
    }
  }

  async function drawRandom() {
    await runDraw("random");
  }

  async function drawHandicap() {
    await runDraw("handicap");
  }

  /* =========================
   * 이벤트
   * ========================= */
  function bindEvents() {
    refs.addRoomBtn?.addEventListener("click", addRoom);
    refs.addAttendeeBtn?.addEventListener("click", addAttendee);
    refs.bulkAddBtn?.addEventListener("click", addBulkAttendees);

    refs.randomDrawBtn?.addEventListener("click", drawRandom);
    refs.handicapDrawBtn?.addEventListener("click", drawHandicap);

    refs.clearRoomsBtn?.addEventListener("click", clearRooms);
    refs.clearAttendeesBtn?.addEventListener("click", clearAttendees);
    refs.clearAllBtn?.addEventListener("click", clearAll);

    refs.roomForm?.addEventListener("submit", e => {
      e.preventDefault();
      addRoom();
    });

    refs.attendeeForm?.addEventListener("submit", e => {
      e.preventDefault();
      addAttendee();
    });

    refs.roomList?.addEventListener("click", e => {
      const btn = e.target.closest("[data-remove-room]");
      if (!btn) return;
      removeRoom(btn.getAttribute("data-remove-room"));
    });

    refs.attendeeList?.addEventListener("click", e => {
      const btn = e.target.closest("[data-remove-attendee]");
      if (!btn) return;
      removeAttendee(btn.getAttribute("data-remove-attendee"));
    });

    refs.roomNameInput?.addEventListener("input", clearResults);
    refs.roomCapacityInput?.addEventListener("input", clearResults);
    refs.attendeeNameInput?.addEventListener("input", clearResults);
    refs.attendeeHandicapInput?.addEventListener("input", clearResults);
    refs.bulkTextarea?.addEventListener("input", clearResults);
  }

  /* =========================
   * PWA
   * ========================= */
  function setupPwaInstall() {
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      deferredPrompt = e;
      if (refs.installBtn) refs.installBtn.hidden = false;
    });

    refs.installBtn?.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (refs.installBtn) refs.installBtn.hidden = true;
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      if (refs.installBtn) refs.installBtn.hidden = true;
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(err => {
        console.error("SW 등록 실패:", err);
      });
    });
  }

  /* =========================
   * 전역 노출
   * ========================= */
  function exposeGlobals() {
    window.addRoom = addRoom;
    window.addAttendee = addAttendee;
    window.addBulkAttendees = addBulkAttendees;
    window.drawRandom = drawRandom;
    window.drawHandicap = drawHandicap;
    window.clearRooms = clearRooms;
    window.clearAttendees = clearAttendees;
    window.clearAll = clearAll;
    window.removeRoom = removeRoom;
    window.removeAttendee = removeAttendee;
  }

  /* =========================
   * 초기화
   * ========================= */
  function init() {
    cacheRefs();
    loadState();
    bindEvents();
    renderRooms();
    renderAttendees();
    updateStats();
    clearResults();
    setupPwaInstall();
    registerServiceWorker();
    exposeGlobals();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
