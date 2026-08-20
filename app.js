(() => {
  "use strict";

  /* =========================
   * 골방 app.js 최종본
   * - 방 등록 / 참석자 등록
   * - 랜덤 방배정
   * - 핸디 균형 배정
   * - 2초 셔플 애니메이션 + 순차 공개
   * - localStorage 저장
   * - PWA 설치 버튼 / SW 등록
   * ========================= */

  const STORAGE_KEYS = {
    rooms: "golbang_rooms_v1",
    attendees: "golbang_attendees_v1"
  };

  let rooms = [];
  let attendees = [];
  let deferredPrompt = null;

  let refs = {};

  /* =========================
   * 공통 유틸
   * ========================= */

  function pick(...selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function pickAll(...selectors) {
    for (const selector of selectors) {
      const els = document.querySelectorAll(selector);
      if (els && els.length) return Array.from(els);
    }
    return [];
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
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function toBool(value) {
    return value === true || value === "true" || value === 1 || value === "1";
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
   * DOM 참조 캐싱
   * ========================= */

  function cacheRefs() {
    refs = {
      roomForm: pick("#roomForm", "[data-room-form]"),
      roomNameInput: pick("#roomName", "#roomNameInput", 'input[name="roomName"]'),
      roomCapacityInput: pick("#roomCapacity", "#roomCapacityInput", 'input[name="roomCapacity"]'),
      roomLeftyInput: pick("#roomLefty", "#roomIsLefty", "#leftyRoom", 'input[name="roomLefty"]'),
      addRoomBtn: pick("#addRoomBtn", "#roomAddBtn", "[data-add-room]"),
      clearRoomsBtn: pick("#clearRoomsBtn", "[data-clear-rooms]"),
      roomList: pick("#roomList", ".room-list", "[data-room-list]"),
      roomCount: pick("#roomCount", "[data-room-count]"),
      totalCapacity: pick("#totalCapacity", "[data-total-capacity]"),
      leftyRoomCount: pick("#leftyRoomCount", "[data-lefty-room-count]"),

      attendeeForm: pick("#attendeeForm", "[data-attendee-form]"),
      attendeeNameInput: pick("#attendeeName", "#attendeeNameInput", 'input[name="attendeeName"]'),
      attendeeHandicapInput: pick("#attendeeHandicap", "#attendeeHandicapInput", 'input[name="attendeeHandicap"]'),
      attendeeLeftyInput: pick("#attendeeLefty", "#participantLefty", "#leftyAttendee", 'input[name="attendeeLefty"]'),
      addAttendeeBtn: pick("#addAttendeeBtn", "#participantAddBtn", "[data-add-attendee]"),
      clearAttendeesBtn: pick("#clearAttendeesBtn", "[data-clear-attendees]"),
      attendeeList: pick("#attendeeList", ".attendee-list", "[data-attendee-list]"),
      attendeeCount: pick("#attendeeCount", "[data-attendee-count]"),
      leftyAttendeeCount: pick("#leftyAttendeeCount", "[data-lefty-attendee-count]"),

      bulkTextarea: pick("#bulkAttendees", "#attendeeBulk", "textarea[data-bulk-attendees]"),
      bulkAddBtn: pick("#addBulkAttendeesBtn", "[data-add-bulk-attendees]"),

      randomDrawBtn: pick("#randomDrawBtn", "#drawRandomBtn", "[data-draw-random]"),
      handicapDrawBtn: pick("#handicapDrawBtn", "#drawHandicapBtn", "[data-draw-handicap]"),
      clearAllBtn: pick("#clearAllBtn", "#resetBtn", "[data-clear-all]"),

      resultSection: pick("#resultSection", ".result-section", "[data-result-section]"),
      resultSummary: pick("#resultSummary", ".result-summary", "[data-result-summary]"),
      resultCards: pick("#resultCards", ".result-cards", "[data-result-cards]"),

      installBtn: pick("#installBtn", "[data-install-app]")
    };
  }

  /* =========================
   * 저장 / 불러오기
   * ========================= */

  function saveState() {
    localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(rooms));
    localStorage.setItem(STORAGE_KEYS.attendees, JSON.stringify(attendees));
    updateWindowState();
  }

  function loadState() {
    try {
      const storedRooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.rooms) || "[]");
      const storedAttendees = JSON.parse(localStorage.getItem(STORAGE_KEYS.attendees) || "[]");

      rooms = Array.isArray(storedRooms) ? storedRooms.map(normalizeRoom) : [];
      attendees = Array.isArray(storedAttendees) ? storedAttendees.map(normalizeAttendee) : [];
    } catch (err) {
      console.error("저장 데이터 로드 실패:", err);
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
      refs.roomList.innerHTML = `
        <div class="empty-state">
          등록된 방이 없습니다.
        </div>
      `;
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
      refs.attendeeList.innerHTML = `
        <div class="empty-state">
          등록된 참석자가 없습니다.
        </div>
      `;
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
      alert("방 인원은 1명 이상으로 입력해 주세요.");
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
    const handicapRaw = refs.attendeeHandicapInput?.value?.trim() || "0";
    const handicap = toNumber(handicapRaw, 0);
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
    const text = refs.bulkTextarea?.value?.trim();
    if (!text) {
      alert("일괄 입력할 참석자 목록을 입력해 주세요.");
      refs.bulkTextarea?.focus();
      return;
    }

    const lines = text
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      alert("추가할 데이터가 없습니다.");
      return;
    }

    const created = [];

    for (const line of lines) {
      const parts = line.split(/[,\t/|]/).map(v => v.trim()).filter(Boolean);
      const name = parts[0] || "";
      const handicap = toNumber(parts[1] ?? 0, 0);
      const leftyText = (parts[2] || "").toLowerCase();
      const lefty = ["좌", "좌타", "left", "lefty", "l", "yes", "y", "1", "true"].includes(leftyText);

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
   * 배정 계산 유틸
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

  function currentTotalHandicap(group) {
    return group.members.reduce((sum, person) => sum + toNumber(person.handicap, 0), 0);
  }

  function currentAvgHandicap(group) {
    return group.members.length ? currentTotalHandicap(group) / group.members.length : 0;
  }

  function candidateRoomsForPerson(groups, person) {
    let available = groups.filter(group => remainingSeats(group) > 0);
    if (!available.length) return [];

    if (person.lefty) {
      const leftyRooms = available.filter(group => group.lefty);
      if (leftyRooms.length) {
        available = leftyRooms;
      }
    }

    return available;
  }

  function pickRandomRoom(groups, person) {
    let candidates = candidateRoomsForPerson(groups, person);
    if (!candidates.length) return null;

    const minFillRatio = Math.min(...candidates.map(group => group.members.length / group.capacity));
    candidates = candidates.filter(group => (group.members.length / group.capacity) === minFillRatio);

    return candidates[Math.floor(Math.random() * candidates.length)] || null;
  }

  function pickBalancedRoom(groups, person) {
    let candidates = candidateRoomsForPerson(groups, person);
    if (!candidates.length) return null;

    const randomized = shuffle(candidates);

    randomized.sort((a, b) => {
      const fillA = a.members.length / a.capacity;
      const fillB = b.members.length / b.capacity;
      if (fillA !== fillB) return fillA - fillB;

      const totalA = currentTotalHandicap(a);
      const totalB = currentTotalHandicap(b);
      if (totalA !== totalB) return totalA - totalB;

      const avgA = currentAvgHandicap(a);
      const avgB = currentAvgHandicap(b);
      if (avgA !== avgB) return avgA - avgB;

      return 0;
    });

    return randomized[0] || null;
  }

  /* =========================
   * 랜덤 방배정
   * ========================= */

  function assignRandom() {
    const groups = createAssignmentShell();
    const randomPeople = shuffle(attendees);

    for (const person of randomPeople) {
      const room = pickRandomRoom(groups, person);
      if (!room) {
        throw new Error("배정 가능한 방이 없습니다.");
      }
      room.members.push(person);
    }

    return groups;
  }

  /* =========================
   * 핸디 균형 배정
   * ========================= */

  function assignByHandicap() {
    const groups = createAssignmentShell();

    const sortedPeople = [...attendees].sort((a, b) => {
      const handiDiff = toNumber(b.handicap, 0) - toNumber(a.handicap, 0);
      if (handiDiff !== 0) return handiDiff;
      return a.name.localeCompare(b.name, "ko");
    });

    for (const person of sortedPeople) {
      const room = pickBalancedRoom(groups, person);
      if (!room) {
        throw new Error("배정 가능한 방이 없습니다.");
      }
      room.members.push(person);
    }

    return groups;
  }

  /* =========================
   * 결과 요약
   * ========================= */

  function summarizeRandomGroups(groups) {
    return groups
      .map((group, index) => `${group.roomName || `방 ${index + 1}`}: ${group.members.length}명`)
      .join(" / ");
  }

  function summarizeHandicapGroups(groups) {
    return groups
      .map((group, index) => {
        const handicaps = group.members
          .map(m => toNumber(m.handicap, 0))
          .filter(v => Number.isFinite(v));

        const sum = handicaps.reduce((a, b) => a + b, 0);
        const avg = handicaps.length ? (sum / handicaps.length) : 0;

        return `${group.roomName || `방 ${index + 1}`}: ${group.members.length}명 · 평균 핸디 ${avg.toFixed(1)}`;
      })
      .join(" / ");
  }

  /* =========================
   * 결과 렌더링
   * ========================= */

  function renderResultRoomCard(roomName, members, revealed, shufflePool, mode) {
    const safeMembers = Array.isArray(members) ? members : [];
    const countForShuffle = Math.max(1, safeMembers.length || 4);

    const shownMembers = revealed
      ? safeMembers
      : Array.from({ length: countForShuffle }, () => {
          const picked = shufflePool[Math.floor(Math.random() * shufflePool.length)];
          return picked || { name: "배정 중...", handicap: "" };
        });

    const handicaps = safeMembers
      .map(m => toNumber(m.handicap ?? m.handi ?? m.score ?? 0, 0))
      .filter(v => Number.isFinite(v));

    const avg = handicaps.length
      ? (handicaps.reduce((a, b) => a + b, 0) / handicaps.length).toFixed(1)
      : "0.0";

    return `
      <div class="result-room-card ${revealed ? "revealed" : "shuffling"}">
        <div class="result-room-head">
          <strong>${escapeHtml(roomName)}</strong>
          <span>${revealed ? (mode === "handicap" ? `평균 핸디 ${avg}` : `${safeMembers.length}명`) : "셔플 중..."}</span>
        </div>

        <div class="result-member-list">
          ${shownMembers.map(member => {
            const name = typeof member === "string"
              ? member
              : (member.name || "이름없음");

            const handicap = revealed
              ? (typeof member === "object" ? (member.handicap ?? member.handi ?? member.score ?? "") : "")
              : "…";

            const lefty = typeof member === "object" && member.lefty;

            return `
              <div class="result-member-item">
                <span class="name">${escapeHtml(name)}</span>
                <span class="meta">
                  ${revealed && handicap !== "" ? `<span class="handi-badge">${escapeHtml(handicap)}</span>` : ""}
                  ${revealed && lefty ? `<span class="lefty-badge">좌타</span>` : ""}
                </span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  async function animateAssignments(assignments, mode = "random") {
    if (!refs.resultCards) return;

    const normalized = assignments.map((group, index) => ({
      roomName: group.roomName || group.name || `방 ${index + 1}`,
      members: Array.isArray(group.members) ? group.members : []
    }));

    const shufflePool = normalized
      .flatMap(group => group.members)
      .map(member => ({
        name: member.name || "이름없음",
        handicap: member.handicap ?? member.handi ?? member.score ?? "",
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

    const totalDuration = 2000;
    const tick = 90;
    const revealStep = normalized.length ? totalDuration / normalized.length : totalDuration;
    const startedAt = Date.now();

    await new Promise(resolve => {
      const timer = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const revealCount = Math.min(
          normalized.length,
          Math.floor(elapsed / revealStep)
        );

        refs.resultCards.innerHTML = normalized.map((group, idx) => {
          return renderResultRoomCard(
            group.roomName,
            group.members,
            idx < revealCount,
            shufflePool,
            mode
          );
        }).join("");

        if (elapsed >= totalDuration) {
          clearInterval(timer);

          refs.resultCards.innerHTML = normalized.map(group => {
            return renderResultRoomCard(
              group.roomName,
              group.members,
              true,
              shufflePool,
              mode
            );
          }).join("");

          if (refs.resultSummary) {
            refs.resultSummary.textContent = mode === "handicap"
              ? summarizeHandicapGroups(assignments)
              : summarizeRandomGroups(assignments);
          }

          resolve();
        }
      }, tick);
    });
  }

  /* =========================
   * 실행 함수
   * ========================= */

  async function drawRandom() {
    if (!ensureDrawReady()) return;

    try {
      const assignments = assignRandom();
      await animateAssignments(assignments, "random");
    } catch (err) {
      console.error(err);
      alert("랜덤 방배정 중 오류가 발생했습니다.");
    }
  }

  async function drawHandicap() {
    if (!ensureDrawReady()) return;

    try {
      const assignments = assignByHandicap();
      await animateAssignments(assignments, "handicap");
    } catch (err) {
      console.error(err);
      alert("핸디 균형 배정 중 오류가 발생했습니다.");
    }
  }

  /* =========================
   * 이벤트 바인딩
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

    refs.roomForm?.addEventListener("submit", event => {
      event.preventDefault();
      addRoom();
    });

    refs.attendeeForm?.addEventListener("submit", event => {
      event.preventDefault();
      addAttendee();
    });

    refs.roomList?.addEventListener("click", event => {
      const btn = event.target.closest("[data-remove-room]");
      if (!btn) return;
      const roomId = btn.getAttribute("data-remove-room");
      if (!roomId) return;
      removeRoom(roomId);
    });

    refs.attendeeList?.addEventListener("click", event => {
      const btn = event.target.closest("[data-remove-attendee]");
      if (!btn) return;
      const attendeeId = btn.getAttribute("data-remove-attendee");
      if (!attendeeId) return;
      removeAttendee(attendeeId);
    });

    refs.roomNameInput?.addEventListener("input", clearResults);
    refs.roomCapacityInput?.addEventListener("input", clearResults);
    refs.attendeeNameInput?.addEventListener("input", clearResults);
    refs.attendeeHandicapInput?.addEventListener("input", clearResults);
    refs.bulkTextarea?.addEventListener("input", clearResults);
  }

  /* =========================
   * PWA / 설치 / SW
   * ========================= */

  function setupPwaInstall() {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredPrompt = event;
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
   * 초기화
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
