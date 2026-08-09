(function() {
	//#region src/domain/charts/chart-view-model.ts
	function filterPoints(points, { start = "", end = "", lot } = {}) {
		return (Array.isArray(points) ? points : []).filter((point) => {
			const date = String(point?.date || "");
			return (!start || date >= start) && (!end || date <= end) && (lot === void 0 || (point?.lot || "") === lot);
		});
	}
	function buildLeveyJennings({ points = [], mean, sd, start = "", end = "", lot } = {}) {
		return {
			points: filterPoints(points, {
				start,
				end,
				lot
			}),
			mean: Number(mean),
			sd: Number(sd)
		};
	}
	function buildCusum({ points = [], series } = {}) {
		return {
			points: Array.isArray(points) ? points : [],
			series: series || {
				cPos: [],
				cNeg: [],
				ma: [],
				flags: []
			}
		};
	}
	function buildMultiLevel({ views = [] } = {}) {
		return (Array.isArray(views) ? views : []).map((view) => ({
			...view,
			pts: Array.isArray(view.pts) ? view.pts : []
		}));
	}
	function sampleIndices({ length = 0, maxPoints = 600, valueAt, preserve = [] } = {}) {
		const n = Math.max(0, Math.floor(Number(length) || 0));
		const limit = Math.max(2, Math.floor(Number(maxPoints) || 600));
		if (!n) return [];
		if (n <= limit) return Array.from({ length: n }, (_, index) => index);
		const kept = /* @__PURE__ */ new Set([0, n - 1]);
		for (const raw of preserve || []) {
			const index = Math.floor(Number(raw));
			if (index >= 0 && index < n) kept.add(index);
		}
		const budget = Math.max(2, limit - kept.size);
		const bucketCount = Math.max(1, Math.floor(budget / 2));
		const bucketSize = n / bucketCount;
		for (let bucket = 0; bucket < bucketCount; bucket++) {
			const start = Math.floor(bucket * bucketSize);
			const end = Math.min(n, Math.floor((bucket + 1) * bucketSize));
			let minIndex = -1;
			let maxIndex = -1;
			let min = Infinity;
			let max = -Infinity;
			for (let index = start; index < end; index++) {
				const value = Number(typeof valueAt === "function" ? valueAt(index) : index);
				if (!Number.isFinite(value)) continue;
				if (value < min) {
					min = value;
					minIndex = index;
				}
				if (value > max) {
					max = value;
					maxIndex = index;
				}
			}
			if (minIndex >= 0) kept.add(minIndex);
			if (maxIndex >= 0) kept.add(maxIndex);
		}
		return [...kept].sort((a, b) => a - b);
	}
	var chartViewModel = Object.freeze({
		filterPoints,
		buildLeveyJennings,
		buildCusum,
		buildMultiLevel,
		sampleIndices
	});
	//#endregion
	//#region src/application/entry/entry-service.ts
	function createEntryService({ cleanText, cleanId, valueDecimals, isPeriodLocked }) {
		function nextRunIdFor(state, testId, date) {
			const prefix = date + "-";
			const nums = (state.data && state.data[testId] || []).filter((point) => !point.voided).map((point) => String(point.runId || "")).filter((value) => value.startsWith(prefix)).map((value) => parseInt(value.slice(prefix.length))).filter(Number.isFinite);
			return prefix + (nums.length ? Math.max(...nums) + 1 : 1);
		}
		function cleanRunId(value) {
			return cleanText(value, 120).trim();
		}
		function pointRunNoFor(point) {
			const match = /(?:^|-)(\d+)$/.exec(String(point && point.runId || ""));
			return match ? Number(match[1]) : 1;
		}
		function buildEntryWindow({ points = [], days = 30, start = "", end = "", today = "" } = {}) {
			const all = Array.isArray(points) ? points.slice() : [];
			const ordered = all.slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || pointRunNoFor(a) - pointRunNoFor(b));
			const safeEnd = end || today || ordered.length && ordered[ordered.length - 1].date || "";
			let safeStart = start;
			if (!safeStart && safeEnd) {
				const date = /* @__PURE__ */ new Date(safeEnd + "T00:00:00Z"), span = Math.max(1, Number(days) || 30) - 1;
				date.setUTCDate(date.getUTCDate() - span);
				safeStart = date.toISOString().slice(0, 10);
			}
			return {
				all,
				pts: ordered.filter((point) => point.date >= safeStart && point.date <= safeEnd),
				start: safeStart,
				end: safeEnd
			};
		}
		function groupByMachine(tests, fallback = "(Chưa gán máy)") {
			const groups = /* @__PURE__ */ new Map();
			(Array.isArray(tests) ? tests : []).forEach((test) => {
				const machine = String(test && test.machine || "").trim() || fallback;
				if (!groups.has(machine)) groups.set(machine, []);
				groups.get(machine)?.push(test);
			});
			return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi")));
		}
		function buildSheetCalendar(month, today) {
			const todayMonth = /^\d{4}-\d{2}-\d{2}$/.test(String(today || "")) ? String(today).slice(0, 7) : "";
			const activeMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || "")) ? String(month) : todayMonth;
			const match = /^(\d{4})-(\d{2})$/.exec(activeMonth);
			if (!match) return {
				activeMonth: "",
				year: 0,
				month: 0,
				start: "",
				end: "",
				days: [],
				yearMin: 0,
				yearMax: 0
			};
			const year = Number(match[1]), monthNo = Number(match[2]);
			const end = new Date(Date.UTC(year, monthNo, 0)).toISOString().slice(0, 10);
			const sheetDays = Array.from({ length: Number(end.slice(-2)) }, (_, index) => `${activeMonth}-${String(index + 1).padStart(2, "0")}`);
			const currentYear = /^\d{4}-\d{2}-\d{2}$/.test(String(today || "")) ? Number(String(today).slice(0, 4)) : year;
			return {
				activeMonth,
				year,
				month: monthNo,
				start: `${activeMonth}-01`,
				end,
				days: sheetDays,
				yearMin: Math.min(year, currentYear - 5),
				yearMax: Math.max(year, currentYear + 5)
			};
		}
		function summarizeRunStatus(levelPoints, verdictById) {
			let worst = "ok", rulesAll = [], warnRules = [], rejRules = [], hasPoint = false;
			const verdict = (point) => {
				return (verdictById && typeof verdictById.get === "function" ? verdictById.get(point.id) : typeof verdictById === "function" ? verdictById(point) : null) || {
					level: "ok",
					rules: []
				};
			};
			(Array.isArray(levelPoints) ? levelPoints : []).forEach((points) => {
				const rows = Array.isArray(points) ? points.filter(Boolean) : [];
				if (!rows.length) return;
				hasPoint = true;
				const accepted = [...rows].reverse().find((point) => verdict(point).level !== "rej") || rows[rows.length - 1];
				const result = verdict(accepted), rules = Array.isArray(result.rules) ? result.rules : [];
				if (result.level === "rej") worst = "rej";
				else if (result.level === "warn" && worst !== "rej") worst = "warn";
				rulesAll = rulesAll.concat(rules);
				rules.forEach((rule) => {
					if (rule === "1-2s" || result.level === "warn") warnRules.push(rule);
					else rejRules.push(rule);
				});
			});
			return {
				hasPoint,
				worst,
				rulesAll,
				warnRules,
				rejRules
			};
		}
		function buildPointView({ point, verdict = {}, mean, sd, previousLot } = {}) {
			const level = verdict && verdict.level || "ok", rules = Array.isArray(verdict && verdict.rules) ? verdict.rules : [];
			const verdictZ = Number(verdict && verdict.z), value = Number(point && point.val), targetMean = Number(mean), targetSd = Number(sd);
			const z = Number.isFinite(verdictZ) ? verdictZ : Number.isFinite(value) && Number.isFinite(targetMean) && Number.isFinite(targetSd) && targetSd !== 0 ? (value - targetMean) / targetSd : NaN;
			const isPrevious = previousLot !== void 0;
			return {
				level,
				rules,
				z,
				isPrevious,
				valueClass: isPrevious ? "prev" : level === "warn" ? "warn" : level === "rej" ? "rej" : "ok"
			};
		}
		function preparePointInput({ tid, level, date, value, valueDecimals: savedValueDecimals, runId, cfg, staff, id } = {}) {
			const errors = [], cleanTid = cleanId(tid), cleanDate = cleanText(date, 20).trim(), numericLevel = Number(level);
			const val = typeof value === "number" ? value : parseFloat(String(value == null ? "" : value).trim());
			const savedDecimals = Number(savedValueDecimals);
			const decimals = Number.isInteger(savedDecimals) && savedDecimals >= 0 ? Math.min(6, savedDecimals) : valueDecimals(value);
			if (!cleanTid) errors.push("missing-test");
			if (!Number.isFinite(numericLevel)) errors.push("invalid-level");
			if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) errors.push("invalid-date");
			if (!Number.isFinite(val)) errors.push("invalid-value");
			if (!cfg || typeof cfg !== "object") errors.push("missing-config");
			if (errors.length) return {
				ok: false,
				errors
			};
			return {
				ok: true,
				point: {
					tid: cleanTid,
					level: numericLevel,
					date: cleanDate,
					val,
					valueDecimals: decimals,
					runId: cleanRunId(runId) || `${cleanDate}-1`,
					cfg,
					staff: staff || {},
					id: id || ""
				}
			};
		}
		function saveDateNote(state, tid, date, value) {
			if (isPeriodLocked(state, date)) return { error: "period-locked" };
			const rows = (state.data && state.data[tid] || []).filter((point) => !point.voided && point.date === date);
			if (!rows.length) return null;
			const note = cleanText(value, 1e3).trim();
			rows.forEach((point) => {
				point.note = note;
			});
			return {
				note,
				rows
			};
		}
		function updateDateNoteCommand(state, { testId, date, value, formatDate } = {}) {
			const tid = cleanId(testId), cleanDate = cleanText(date, 20).trim();
			if (!tid) return {
				ok: false,
				error: "invalid-test"
			};
			if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return {
				ok: false,
				error: "invalid-date"
			};
			const test = (state && state.tests || []).find((item) => item && item.id === tid);
			if (!test) return {
				ok: false,
				error: "test-not-found"
			};
			const result = saveDateNote(state, tid, cleanDate, value);
			if (result && "error" in result) return {
				ok: false,
				error: result.error
			};
			if (!result) return {
				ok: false,
				error: "no-points"
			};
			const shownDate = typeof formatDate === "function" ? formatDate(cleanDate) : cleanDate, note = result.note;
			return {
				ok: true,
				note,
				rows: result.rows,
				messageCode: note ? "note-saved" : "note-removed",
				effects: {
					audit: {
						action: "Ghi chú QC",
						detail: `Ngày ${shownDate}${note ? " · " + note : " · xóa ghi chú"}`,
						target: test.name || ""
					},
					save: {
						clearDerived: false,
						testId: tid
					}
				}
			};
		}
		function addPoint(state, { tid, level, date, val, valueDecimals: decimals, runId, cfg, staff, id }) {
			if (isPeriodLocked(state, date)) return { error: "period-locked" };
			state.data = state.data || {};
			state.data[tid] = state.data[tid] || [];
			const dayNote = ((state.data[tid] || []).find((point) => !point.voided && point.date === date && String(point.note || "").trim()) || {}).note || "";
			const point = {
				id,
				date,
				runId,
				level,
				val,
				valueDecimals: decimals,
				lot: cfg.lot || "",
				qcMean: cfg.mean,
				qcSd: cfg.sd,
				note: dayNote,
				...staff
			};
			state.data[tid].push(point);
			return point;
		}
		function recordPoint(state, input) {
			const prepared = preparePointInput(input || {});
			if (!prepared.ok) return prepared;
			const point = prepared.point;
			const saved = addPoint(state, point);
			if (saved && "error" in saved) return {
				ok: false,
				error: saved.error,
				point
			};
			if (!saved) return {
				ok: false,
				error: "save-failed",
				point
			};
			return {
				ok: true,
				point: saved
			};
		}
		function voidPoint(state, { tid, pointId, reason, kind = "analytical", openNce = true, rule = "Không có luật Westgard", errorType = "—", qcVerdict = "invalid", staff = {}, nowIso, today, id, nceId, dueDate, formatDate, formatNumber }) {
			const point = (state.data && state.data[tid] || []).find((item) => item.id === pointId);
			if (!point || point.voided) return null;
			if (isPeriodLocked(state, point.date)) return { error: "period-locked" };
			const normalizedKind = [
				"data-entry",
				"analytical",
				"other"
			].includes(kind) ? kind : "other";
			const kindLabel = normalizedKind === "analytical" ? "Kết quả QC thực tế không hợp lệ" : normalizedKind === "data-entry" ? "Nhập sai dữ liệu" : "";
			const note = cleanText(reason, 1e3).trim();
			if (!kindLabel && note.length < 5) return { error: "reason-too-short" };
			const clean = kindLabel ? note ? `${kindLabel} — ${note}` : kindLabel : note;
			point.voided = true;
			point.voidReason = clean;
			point.voidKind = normalizedKind;
			point.voidRequiresRerun = !!openNce;
			point.voidedAt = nowIso;
			point.voidedBy = staff.operatorName || staff.operatorUsername || "";
			state.actions = state.actions || [];
			const existing = [...state.actions].reverse().find((action) => action.pointId === point.id && +action.protocolVersion >= 2 && action.recordStatus !== "cancelled" && (action.approvalStatus || "pending") !== "approved");
			let action = existing || null;
			if (openNce && !action) action = {
				id,
				protocolVersion: 3,
				nceId,
				date: point.date || today,
				createdAt: nowIso,
				updatedAt: nowIso,
				openedFromVoid: true,
				createdByUserId: staff.operatorId || "",
				createdByUsername: staff.operatorUsername || "",
				contentEditorUserIds: [staff.operatorId || ""].filter(Boolean),
				contentEditorUsernames: [String(staff.operatorUsername || "").trim().toLowerCase()].filter(Boolean),
				testId: tid,
				level: point.level,
				lot: point.lot || "",
				pointId: point.id,
				rule: cleanText(rule, 200).trim() || "Không có luật Westgard",
				errorType: cleanText(errorType, 120).trim() || "—",
				qcVerdict: [
					"warn",
					"rej",
					"invalid"
				].includes(qcVerdict) ? qcVerdict : "invalid",
				eventSource: "iqc",
				processPhase: "exam",
				correction: `Hủy điểm ngày ${formatDate(point.date)}, lần ${point.runId || "—"}, giá trị ${formatNumber(point.val)}. Lý do: ${clean}`,
				by: point.voidedBy,
				dueDate: dueDate || "",
				containmentStatus: "",
				effectivenessStatus: "pending",
				approvalStatus: "pending",
				recordStatus: "active",
				approvedAt: "",
				approvedBy: "",
				approvalNote: ""
			};
			if (openNce && !existing) state.actions.push(action);
			return {
				point,
				action,
				reason: clean,
				openNce: !!openNce,
				reusedAction: !!existing
			};
		}
		function buildSheetRowsData({ levels, sheetStart, sheetEnd, sheetDays, pointsByLevel, previousPointsByLevel }) {
			const groupsByDate = /* @__PURE__ */ new Map();
			(levels || []).forEach((config) => {
				const level = config && config.key != null ? config.key : config && config.level;
				const previous = previousPointsByLevel && previousPointsByLevel[level] || [], current = pointsByLevel && pointsByLevel[level] || [];
				previous.concat(current).filter((point) => point && point.date >= sheetStart && point.date <= sheetEnd).forEach((point) => {
					const runId = point.runId || `${point.date}-1`, key = point.date + "|" + runId;
					let byRun = groupsByDate.get(point.date);
					if (!byRun) {
						byRun = /* @__PURE__ */ new Map();
						groupsByDate.set(point.date, byRun);
					}
					if (!byRun.has(key)) byRun.set(key, {
						date: point.date,
						runId,
						levels: {}
					});
					byRun.get(key).levels[level] = point;
				});
			});
			return (sheetDays || []).map((day) => {
				const byRun = groupsByDate.get(day);
				if (!byRun) return {
					date: day,
					runs: [{
						date: day,
						runId: "",
						runNo: 1,
						levels: {}
					}]
				};
				const runs = [...byRun.values()].sort((a, b) => String(a.runId || "").localeCompare(String(b.runId || ""), "vi", { numeric: true }));
				const nums = runs.map((group) => String(group.runId || "")).filter((value) => value.startsWith(day + "-")).map((value) => parseInt(value.slice(day.length + 1))).filter(Number.isFinite);
				const maxRun = nums.length ? Math.max(...nums) : runs.length;
				runs.forEach((group, index) => {
					const parsed = String(group.runId || "").startsWith(day + "-") ? parseInt(String(group.runId).slice(day.length + 1)) : index + 1;
					group.runNo = Number.isFinite(parsed) ? parsed : index + 1;
				});
				runs.push({
					date: day,
					runId: day + "-" + (maxRun + 1),
					runNo: maxRun + 1,
					levels: {},
					nextRun: true
				});
				return {
					date: day,
					runs
				};
			});
		}
		function sheetFirstRunNo(dayGroup) {
			const nums = (dayGroup && dayGroup.runs || []).map((run) => run.runNo).filter(Number.isFinite);
			return nums.length ? Math.min(...nums) : 1;
		}
		function sheetLevelRuns(dayGroup, level) {
			return (dayGroup && dayGroup.runs || []).filter((run) => run.levels && run.levels[level]).sort((a, b) => a.runNo - b.runNo);
		}
		return Object.freeze({
			nextRunIdFor,
			cleanRunId,
			preparePointInput,
			saveDateNote,
			updateDateNoteCommand,
			addPoint,
			recordPoint,
			voidPoint,
			buildEntryWindow,
			groupByMachine,
			buildSheetCalendar,
			summarizeRunStatus,
			buildPointView,
			buildSheetRowsData,
			sheetFirstRunNo,
			sheetLevelRuns
		});
	}
	//#endregion
	//#region src/application/backup/backup-service.ts
	var BACKUP_IMPORT_MAX_BYTES = 134217728;
	var BACKUP_IMPORT_WARN_BYTES = 100663296;
	function createBackupService(deps) {
		const serializeBackupData = (value) => JSON.stringify(value);
		const backupTextBytes = (text) => deps.textBytes(String(text));
		const backupSizeMB = (size) => (Number(size || 0) / 1024 / 1024).toFixed(1);
		const backupImportSizeError = (size) => Number(size) > 134217728 ? `File backup vượt quá giới hạn ${BACKUP_IMPORT_MAX_BYTES / 1024 / 1024} MB.` : "";
		const backupSizeWarning = (size) => Number(size) >= 100663296 ? `File backup đã đạt ${backupSizeMB(size)} MB, gần giới hạn ${BACKUP_IMPORT_MAX_BYTES / 1024 / 1024} MB. Nên lưu trữ dữ liệu cũ hoặc giảm kích thước trước kỳ sao lưu tiếp theo.` : "";
		const backupChecksum = async (text) => deps.hash(String(text));
		const createBackupPackage = async (value) => {
			const payload = serializeBackupData(value);
			const checksum = await backupChecksum(payload);
			const header = {
				format: "qclab-backup",
				formatVersion: 1,
				type: "full",
				createdAt: deps.nowIso(),
				appVersion: deps.appVersion(),
				schemaVersion: Number(value && value.schemaVersion || deps.schemaVersion),
				checksum
			};
			const text = JSON.stringify(header).slice(0, -1) + ",\"data\":" + payload + "}";
			return {
				text,
				bytes: backupTextBytes(text),
				meta: header
			};
		};
		const parseBackupPackage = async (text) => {
			const parsed = JSON.parse(String(text));
			if (!parsed || parsed.format !== "qclab-backup" || !parsed.data) return {
				incoming: parsed,
				meta: {
					type: "legacy",
					formatVersion: 0,
					checksumStatus: "legacy"
				}
			};
			if (Number(parsed.formatVersion) !== 1) throw new Error("Phiên bản gói backup chưa được hỗ trợ.");
			const payload = serializeBackupData(parsed.data);
			const actual = parsed.checksum ? await backupChecksum(payload) : "";
			if (parsed.checksum && (!actual || actual !== parsed.checksum)) throw new Error("Checksum SHA-256 không khớp; file có thể đã hỏng hoặc bị thay đổi.");
			return {
				incoming: parsed.data,
				meta: {
					type: parsed.type || "full",
					formatVersion: 1,
					createdAt: parsed.createdAt || "",
					appVersion: parsed.appVersion || "",
					schemaVersion: parsed.schemaVersion,
					year: parsed.year || "",
					checksum: parsed.checksum || "",
					checksumStatus: parsed.checksum ? actual ? "verified" : "unavailable" : "missing"
				}
			};
		};
		const prepareBackupState = (incoming) => {
			const errors = deps.validateBackup(incoming);
			if (errors.length) throw new Error(errors.join("\n"));
			const next = deps.sanitizeBackup(incoming, { owned: true });
			const audit = deps.verifyAuditChain(next.activity || [], next.activityAnchor || "");
			if (!audit.ok) throw new Error(`Chuỗi audit trong backup không hợp lệ tại dòng ${audit.brokenIndex + 1}: ${audit.reason}. Dữ liệu chưa được nhập.`);
			const invariantErrors = deps.validateStateInvariants(next, { sanitized: true });
			if (invariantErrors.length) throw new Error("Backup sau chuẩn hóa không đạt kiểm tra dữ liệu:\n" + invariantErrors.join("\n"));
			return next;
		};
		const prepareBackupImport = async (text) => {
			const parsed = await parseBackupPackage(text);
			if (parsed.meta.type === "year-archive") throw new Error("File này là archive theo năm của bản thử nghiệm cũ, không phải backup đầy đủ — nhập vào sẽ mất dữ liệu các năm khác.");
			return prepareBackupState(parsed.incoming);
		};
		const backupSummary = (next) => {
			let points = 0, minDate = "", maxDate = "";
			Object.values(next && next.data || {}).forEach((rows) => (rows || []).forEach((point) => {
				const date = String(point && point.date || "");
				points += 1;
				if (date && (!minDate || date < minDate)) minDate = date;
				if (date && (!maxDate || date > maxDate)) maxDate = date;
			}));
			return {
				points,
				minDate,
				maxDate,
				configuredTests: (next && next.tests || []).length
			};
		};
		const inspectBackupText = async (text, size = 0) => {
			const parsed = await parseBackupPackage(text);
			if (parsed.meta.type === "year-archive") throw new Error("File này là archive theo năm của bản thử nghiệm cũ, không phải backup đầy đủ và không còn được hỗ trợ.");
			const state = prepareBackupState(parsed.incoming);
			return {
				meta: parsed.meta,
				summary: backupSummary(state),
				state,
				size: Number(size) || backupTextBytes(text)
			};
		};
		return Object.freeze({
			serializeBackupData,
			backupTextBytes,
			backupSizeMB,
			backupImportSizeError,
			backupSizeWarning,
			backupChecksum,
			createBackupPackage,
			parseBackupPackage,
			prepareBackupState,
			prepareBackupImport,
			backupSummary,
			inspectBackupText
		});
	}
	//#endregion
	//#region src/application/manage/manage-config-service.ts
	function createManageConfigService({ cleanText, cleanId }) {
		function textKey(value) {
			return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
		}
		function sameText(first, second) {
			return textKey(first) === textKey(second);
		}
		function clean(value, maximumLength) {
			return cleanText(value, maximumLength).trim();
		}
		function defaultAssayLevels() {
			return [{
				level: 1,
				mean: null,
				sd: null,
				low: null,
				high: null,
				rangeK: 2,
				mfgMean: null,
				mfgSd: null,
				applied: "mfg",
				meanSdHistory: []
			}];
		}
		function prepareInstrument(input = {}) {
			return {
				name: clean(input.name),
				section: clean(input.section),
				manufacturer: clean(input.manufacturer),
				serial: clean(input.serial),
				active: input.active !== false
			};
		}
		function validateInstrument(state, { id = "", data = {} } = {}) {
			const instruments = Array.isArray(state.instruments) ? state.instruments : [], cleaned = prepareInstrument(data);
			if (id && !instruments.some((item) => item.id === id)) return {
				error: "not-found",
				message: "Không tìm thấy máy xét nghiệm cần cập nhật."
			};
			if (!cleaned.name) return {
				error: "missing-name",
				message: "Nhập tên máy."
			};
			if (instruments.some((item) => item.id !== id && sameText(item.name, cleaned.name))) return {
				error: "duplicate-name",
				message: "Tên máy xét nghiệm này đã tồn tại."
			};
			return { data: cleaned };
		}
		function saveInstrument(state, { id = "", newId = "", data = {} } = {}) {
			const checked = validateInstrument(state, {
				id,
				data
			});
			if (checked.error) return checked;
			const old = state.instruments.find((item) => item.id === id) || null;
			const record = old || { id: cleanId(newId) };
			if (!old && !record.id) return {
				error: "missing-id",
				message: "Không thể tạo mã máy xét nghiệm."
			};
			Object.assign(record, checked.data);
			if (!old) state.instruments.push(record);
			if (old) (state.tests || []).filter((test) => test.instrumentId === id).forEach((test) => {
				test.machine = record.name;
			});
			state.machines = [...new Set(state.instruments.map((item) => item.name))];
			return {
				record,
				created: !old
			};
		}
		function instrumentRemoval(state, { id = "" } = {}) {
			const record = (state.instruments || []).find((item) => item.id === id);
			if (!record) return {
				error: "not-found",
				message: "Không tìm thấy máy xét nghiệm."
			};
			if ((state.tests || []).some((test) => test.instrumentId === id)) return {
				error: "used-by-assay",
				record,
				message: "Máy này đang được gắn với xét nghiệm. Hãy chuyển xét nghiệm sang máy khác trước."
			};
			if ((state.qcPanels || []).some((panel) => panel.instrumentId === id)) return {
				error: "used-by-panel",
				record,
				message: "Máy này đang được gắn với Panel QC. Hãy chuyển hoặc xóa Panel QC trước."
			};
			return { record };
		}
		function removeInstrument(state, { id = "" } = {}) {
			const checked = instrumentRemoval(state, { id });
			if (checked.error) return checked;
			state.instruments = state.instruments.filter((item) => item.id !== id);
			state.machines = [...new Set(state.instruments.map((item) => item.name))];
			return { record: checked.record };
		}
		function validateAssay(state, options = {}) {
			const { id = "", data = {} } = options;
			const existing = (state.tests || []).find((item) => item.id === id) || null;
			const instrument = (state.instruments || []).find((item) => item.id === data.instrumentId) || null;
			if (id && !existing) return {
				error: "not-found",
				message: "Không tìm thấy xét nghiệm cần cập nhật."
			};
			if (!clean(data.name) || !instrument) return {
				error: "missing-required",
				message: "Chọn hoặc nhập tên xét nghiệm và chọn máy."
			};
			if ((state.tests || []).some((item) => item.id !== id && item.instrumentId === data.instrumentId && (item.analyteId && data.analyteId && item.analyteId === data.analyteId || sameText(item.name, data.name)))) return {
				error: "duplicate-assay",
				message: "Xét nghiệm này đã tồn tại trên máy đã chọn."
			};
			if (!Number.isFinite(Number(data.tea)) || Number(data.tea) < 0) return {
				error: "invalid-tea",
				message: "TEa không được âm."
			};
			if (!Number.isInteger(Number(data.decimalPlaces)) || Number(data.decimalPlaces) < 0 || Number(data.decimalPlaces) > 6) return {
				error: "invalid-decimals",
				message: "Số chữ số thập phân phải từ 0 đến 6."
			};
			return {
				existing,
				inst: instrument
			};
		}
		function saveAssay(state, { id = "", newId = "", data = {} } = {}) {
			const checked = validateAssay(state, {
				id,
				data
			});
			if (checked.error) return checked;
			const existing = checked.existing;
			const oldInstrumentId = existing && existing.instrumentId;
			const record = existing || { id: cleanId(newId) };
			if (!existing && !record.id) return {
				error: "missing-id",
				message: "Không thể tạo mã xét nghiệm."
			};
			Object.assign(record, data);
			if (!existing) {
				state.tests.push(record);
				state.data = state.data || {};
				state.data[record.id] = [];
			}
			if (existing && oldInstrumentId && oldInstrumentId !== record.instrumentId) (state.qcPanels || []).forEach((panel) => {
				if (panel.instrumentId !== record.instrumentId) panel.testIds = (panel.testIds || []).filter((testId) => testId !== id);
			});
			return {
				record,
				created: !existing,
				inst: checked.inst,
				oldInstrumentId
			};
		}
		function assayRemoval(state, { id = "" } = {}) {
			const record = (state.tests || []).find((item) => item.id === id);
			if (!record) return {
				error: "not-found",
				message: "Không tìm thấy xét nghiệm."
			};
			return {
				record,
				points: state.data && state.data[id] || []
			};
		}
		function removeAssay(state, { id = "" } = {}) {
			const checked = assayRemoval(state, { id });
			if (checked.error) return checked;
			const points = checked.points || [];
			state.tests = state.tests.filter((item) => item.id !== id);
			(state.qcPanels || []).forEach((panel) => {
				panel.testIds = (panel.testIds || []).filter((testId) => testId !== id);
			});
			(state.assayGroups || []).forEach((group) => {
				group.testIds = (group.testIds || []).filter((testId) => testId !== id);
			});
			if (state.data) delete state.data[id];
			if (state.sigmaData) delete state.sigmaData[id];
			return {
				record: checked.record,
				points,
				pointsCount: points.length
			};
		}
		return Object.freeze({
			defaultAssayLevels,
			prepareInstrument,
			validateInstrument,
			saveInstrument,
			instrumentRemoval,
			removeInstrument,
			validateAssay,
			saveAssay,
			assayRemoval,
			removeAssay
		});
	}
	//#endregion
	//#region src/application/period/period-service.ts
	function createPeriodService({ cleanText }) {
		function normalizePeriod(value) {
			const text = cleanText(value, 20).trim();
			const match = /^(\d{4})-(\d{1,2})$/.exec(text);
			if (!match) return "";
			const month = Number(match[2]);
			return month >= 1 && month <= 12 ? match[1] + "-" + String(month).padStart(2, "0") : "";
		}
		function periodForDate(value) {
			const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(value || ""));
			return match ? match[1] + "-" + match[2] : "";
		}
		function findLock(state, yearMonth) {
			const period = normalizePeriod(yearMonth);
			return period ? (state && state.periodLocks || []).find((item) => normalizePeriod(item && item.ym) === period) || null : null;
		}
		function lock(state, { ym, lockedAt, lockedBy, note, id }) {
			const period = normalizePeriod(ym);
			if (!period) return { error: "invalid-period" };
			if (findLock(state, period)) return { error: "already-locked" };
			state.periodLocks = Array.isArray(state.periodLocks) ? state.periodLocks : [];
			const record = {
				id: id || "",
				ym: period,
				lockedAt: lockedAt || "",
				lockedBy: cleanText(lockedBy, 120).trim(),
				note: cleanText(note, 1e3).trim()
			};
			state.periodLocks.push(record);
			return { lock: record };
		}
		function unlock(state, { ym, reason }) {
			const period = normalizePeriod(ym), cleanReason = cleanText(reason, 1e3).trim();
			if (!period) return { error: "invalid-period" };
			if (cleanReason.length < 5) return { error: "reason-too-short" };
			const index = (state && state.periodLocks || []).findIndex((item) => normalizePeriod(item && item.ym) === period);
			if (index < 0) return { error: "not-locked" };
			return {
				lock: state.periodLocks.splice(index, 1)[0],
				reason: cleanReason
			};
		}
		function lockedPoints(state, points) {
			const byPeriod = /* @__PURE__ */ new Map();
			(Array.isArray(points) ? points : []).forEach((point) => {
				const yearMonth = periodForDate(point && point.date);
				if (!yearMonth || !findLock(state, yearMonth)) return;
				byPeriod.set(yearMonth, (byPeriod.get(yearMonth) || 0) + 1);
			});
			const periods = [...byPeriod.keys()].sort();
			return {
				count: periods.reduce((count, yearMonth) => count + (byPeriod.get(yearMonth) || 0), 0),
				periods,
				byPeriod
			};
		}
		return Object.freeze({
			normalizePeriod,
			periodForDate,
			findLock,
			lock,
			unlock,
			lockedPoints
		});
	}
	//#endregion
	//#region src/application/lis/lis-client-service.ts
	var LIS_GATEWAY_STORAGE_KEY = "qclab_lis_gateway";
	var LIS_POLL_MS = 3e5;
	function createLisGatewayRuntime() {
		return {
			status: "idle",
			detail: "Chưa bật",
			lastPull: "",
			pollT: null,
			running: false,
			pending: [],
			unresolved: [],
			lastError: ""
		};
	}
	function createLisClient(deps) {
		const { runtime } = deps;
		const allowedOrigins = ["http://127.0.0.1:8787", "http://localhost:8787"];
		function normalizeGatewayUrl(value) {
			try {
				const url = deps.makeUrl(String(value || "").trim());
				return allowedOrigins.includes(url.origin) ? url.origin : "";
			} catch {
				return "";
			}
		}
		function gatewayConfig() {
			try {
				const saved = JSON.parse(deps.storage.getItem("qclab_lis_gateway") || "null");
				if (saved && typeof saved === "object") return {
					enabled: saved.enabled === true,
					url: normalizeGatewayUrl(saved.url) || "http://127.0.0.1:8787",
					token: String(saved.token || "")
				};
			} catch {}
			return {
				enabled: false,
				url: "http://127.0.0.1:8787",
				token: ""
			};
		}
		function statusText() {
			return ({
				idle: "Chưa kiểm tra",
				off: "Đang tắt",
				syncing: "Đang kiểm tra",
				ok: "Đã kết nối",
				error: "Lỗi kết nối"
			}[runtime.status] || runtime.status) + (runtime.detail ? " · " + runtime.detail : "") + (runtime.lastPull ? " · " + deps.formatDateTime(runtime.lastPull) : "");
		}
		function setStatus(status, detail) {
			runtime.status = status;
			runtime.detail = detail || "";
			deps.renderStatus();
		}
		async function gatewayFetch(path, options = {}) {
			const config = gatewayConfig(), controller = deps.createAbortController();
			const timer = deps.setTimeout(() => controller.abort(), 8e3);
			try {
				const response = await deps.fetch(config.url + path, {
					...options,
					signal: controller.signal,
					headers: {
						"content-type": "application/json",
						...config.token ? { authorization: "Bearer " + config.token } : {},
						...options.headers || {}
					}
				});
				const body = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(response.status === 401 ? "Token không đúng hoặc chưa nhập. Xem token in ra khi chạy npm run lis:gateway." : body.message || `HTTP ${response.status}`);
				return body;
			} finally {
				deps.clearTimeout(timer);
			}
		}
		async function gatewayHealth() {
			const body = await gatewayFetch("/health");
			if (!body || body.ok !== true) throw new Error("Gateway không trả trạng thái hợp lệ.");
			return body;
		}
		async function pull(options = {}) {
			if (!gatewayConfig().enabled) return {
				ok: false,
				skipped: true
			};
			if (runtime.running) return {
				ok: false,
				busy: true
			};
			runtime.running = true;
			setStatus("syncing", "Đang lấy hàng chờ");
			try {
				await gatewayHealth();
				const body = await gatewayFetch("/api/v1/qc-results?status=pending&limit=500");
				const items = Array.isArray(body && body.items) ? body.items : [];
				runtime.pending = items.filter((item) => item && item.resolved && item.resolved.ok);
				runtime.unresolved = items.filter((item) => !(item && item.resolved && item.resolved.ok));
				runtime.lastPull = deps.nowIso();
				runtime.lastError = "";
				setStatus("ok", `${runtime.pending.length} chờ nhận${runtime.unresolved.length ? ` · ${runtime.unresolved.length} chưa khớp cấu hình` : ""}`);
				return {
					ok: true,
					pending: runtime.pending.length,
					unresolved: runtime.unresolved.length
				};
			} catch (error) {
				const caught = error;
				const detail = caught && caught.name === "AbortError" ? "Gateway không phản hồi" : caught && caught.message || "Lỗi không xác định";
				runtime.lastError = detail;
				setStatus("error", detail);
				if (options.manual) await deps.notify("Không lấy được kết quả QC từ Gateway:\n" + detail);
				return {
					ok: false,
					error: detail
				};
			} finally {
				runtime.running = false;
			}
		}
		function resultToPointInput(record) {
			const message = record && record.message || {}, resolved = record && record.resolved || {};
			const measured = new Date(message.measuredAt || "");
			if (!Number.isFinite(measured.getTime())) return null;
			const date = `${measured.getFullYear()}-${String(measured.getMonth() + 1).padStart(2, "0")}-${String(measured.getDate()).padStart(2, "0")}`;
			return {
				tid: resolved.qclabTestId,
				level: resolved.level,
				date,
				value: message.value,
				runId: message.runId || "",
				staff: message.operator || "",
				lot: resolved.lot || ""
			};
		}
		async function importResult(messageId) {
			if (!deps.requireWrite()) return { ok: false };
			const record = (runtime.pending || []).find((item) => item && item.message && item.message.messageId === messageId);
			if (!record) return {
				ok: false,
				error: "not-found"
			};
			const input = resultToPointInput(record);
			if (!input || !input.tid || !input.level) return {
				ok: false,
				error: "invalid-record"
			};
			const state = deps.getState(), test = (state.tests || []).find((item) => item.id === input.tid);
			const saved = deps.recordPoint(state, {
				...input,
				cfg: deps.levelConfig(test, input.level)
			});
			if (!saved.ok) {
				await deps.notify(saved.error === "period-locked" ? "Kỳ này đã chốt, không thể nhận thêm điểm QC." : "Không ghi được điểm QC: " + saved.error);
				return {
					ok: false,
					error: saved.error
				};
			}
			deps.log("Nhận QC từ LIS", `${input.date} · M${input.level} · ${deps.formatNumber(input.value)}${input.runId ? " · " + input.runId : ""}`, test && test.name || "");
			deps.save({ testId: input.tid });
			try {
				await gatewayFetch("/api/v1/qc-results/decide", {
					method: "POST",
					body: JSON.stringify({
						messageId,
						status: "imported",
						by: deps.userName()
					})
				});
			} catch (error) {
				const caught = error;
				await deps.notify("Đã ghi điểm QC nhưng chưa báo được về Gateway:\n" + (caught && caught.message || "") + "\nBản ghi sẽ còn trong hàng chờ, hãy kiểm tra lại trước khi nhận lần nữa.");
			}
			await pull();
			deps.rerender();
			return {
				ok: true,
				point: saved.point
			};
		}
		async function rejectResult(messageId, note) {
			if (!deps.requireWrite()) return { ok: false };
			try {
				await gatewayFetch("/api/v1/qc-results/decide", {
					method: "POST",
					body: JSON.stringify({
						messageId,
						status: "rejected",
						by: deps.userName(),
						note: note || ""
					})
				});
			} catch (error) {
				const caught = error;
				await deps.notify("Không bỏ được bản ghi:\n" + (caught && caught.message || ""));
				return { ok: false };
			}
			deps.log("Bỏ kết quả QC từ LIS", `${messageId}${note ? " · " + note : ""}`, "LIS");
			await pull();
			deps.rerender();
			return { ok: true };
		}
		function start() {
			deps.clearInterval(runtime.pollT);
			runtime.pollT = null;
			if (!gatewayConfig().enabled) {
				setStatus("off", "Chưa bật");
				return;
			}
			pull();
			runtime.pollT = deps.setInterval(() => {
				if (!runtime.running) pull();
			}, LIS_POLL_MS);
		}
		return Object.freeze({
			runtime,
			gatewayConfig,
			normalizeGatewayUrl,
			statusText,
			setStatus,
			gatewayFetch,
			gatewayHealth,
			pull,
			resultToPointInput,
			importResult,
			rejectResult,
			start
		});
	}
	//#endregion
	//#region src/domain/qc/qc-point-warnings.ts
	function createQcPointWarnings({ stats, todayIso, formatDate, formatNumber }) {
		return function qcPointWarnings(points, config, date, runId, value) {
			const issues = [];
			if (!Number.isFinite(+config.sd) || +config.sd <= 0) issues.push("SD đang bằng 0 hoặc chưa hợp lệ, không thể đánh giá Westgard.");
			if (Number.isFinite(+config.mean) && +config.mean >= 0 && value < 0) issues.push("Giá trị âm trong khi Mean mục tiêu không âm.");
			if (Number.isFinite(+config.mean) && Number.isFinite(+config.sd) && +config.sd > 0 && Math.abs((value - +config.mean) / +config.sd) > 5) issues.push("Giá trị lệch quá 5SD so với Mean/SD hiện tại.");
			if (date && date > todayIso()) issues.push("Ngày nhập nằm trong tương lai — kiểm tra lại trước khi lưu.");
			if (config.exp && date > config.exp) issues.push(`Lô ${config.lot || "hiện tại"} đã hết hạn sử dụng từ ${formatDate(config.exp)} — kiểm tra lại lô QC trước khi lưu.`);
			const currentPoints = Array.isArray(points) ? points : [];
			if (currentPoints.find((point) => !point.voided && point.date === date && +point.level === +config.level && (point.runId || "") === runId && (point.lot || "") === (config.lot || ""))) issues.push("Đã có điểm QC cùng ngày, cùng mức, cùng lô và cùng lần chạy.");
			const latest = (config.meanSdHistory || []).slice().reverse().find((history) => history.effectiveFrom) || null;
			const referenceDate = latest && latest.effectiveFrom || "";
			if (referenceDate) {
				const age = Math.floor((new Date(date).getTime() - new Date(referenceDate).getTime()) / 864e5);
				if (Number.isFinite(age) && age > 365) issues.push("Mean/SD đang dùng đã quá 12 tháng, nên rà soát lại dải kiểm soát.");
			}
			const summary = stats(currentPoints.filter((point) => !point.voided && +point.level === +config.level && (point.lot || "") === (config.lot || "")).map((point) => point.val));
			const targetCv = config.mean ? Math.abs(config.sd / config.mean * 100) : 0;
			if (summary && summary.n >= 10 && targetCv > 0 && summary.cv > targetCv * 1.5) issues.push(`CV thực tế đang cao hơn CV mục tiêu (${formatNumber(summary.cv)}% so với ${formatNumber(targetCv)}%).`);
			const otherLot = (config.meanSdHistory || []).find((history) => {
				if (!history || (history.qcLotId ? history.qcLotId === config.qcLotId : (history.lot || "") === (config.lot || ""))) return false;
				if (history.planned) return false;
				if (history.effectiveFrom && date < history.effectiveFrom) return false;
				if (history.effectiveTo && date >= history.effectiveTo) return false;
				return true;
			});
			if (otherLot) issues.push(`Ngày ${formatDate(date)} thuộc giai đoạn lô ${otherLot.lot || "khác"} đang dùng (${otherLot.effectiveFrom ? "từ " + formatDate(otherLot.effectiveFrom) : "trước đó"}${otherLot.effectiveTo ? " đến " + formatDate(otherLot.effectiveTo) : ""}), không phải lô ${config.lot || "hiện tại"}. Kiểm tra lại ngày hoặc lô trước khi lưu.`);
			return issues;
		};
	}
	//#endregion
	//#region src/application/reagent/reagent-comparison-service.ts
	var DEFAULT_SAMPLE_TYPES = Object.freeze([
		"Mẫu bệnh nhân",
		"Mẫu nội kiểm (IQC)",
		"Mẫu ngoại kiểm (EQA)"
	]);
	var META_KEYS = /* @__PURE__ */ new Set([
		"reagent",
		"lotOld",
		"lotNew",
		"date",
		"operator",
		"sampleType",
		"unit",
		"biasTarget",
		"alpha",
		"coverageConfirmed"
	]);
	function createReagentComparisonService({ cleanText, cleanId }) {
		if (typeof cleanText !== "function" || typeof cleanId !== "function") throw new TypeError("ReagentComparisonService cần cleanText và cleanId");
		function blank(id, name = "Hóa chất mới", unit = "") {
			return {
				id: id || "",
				test: {
					reagent: cleanText(name || "Hóa chất mới").trim() || "Hóa chất mới",
					lotOld: "",
					lotNew: "",
					date: "",
					operator: "",
					sampleType: DEFAULT_SAMPLE_TYPES[0],
					unit: cleanText(unit),
					biasTarget: 6,
					alpha: .05,
					coverageConfirmed: false
				},
				rows: [
					["", ""],
					["", ""],
					["", ""],
					["", ""],
					["", ""]
				]
			};
		}
		function comparisons(state) {
			if (!Array.isArray(state.reagentTests)) state.reagentTests = [];
			return state.reagentTests;
		}
		function find(state, id) {
			return comparisons(state).find((item) => item && item.id === id) || null;
		}
		function ensureOne(state, { id } = {}) {
			const items = comparisons(state);
			if (items.length) return {
				created: false,
				comparison: items[0]
			};
			const comparison = blank(id);
			items.push(comparison);
			return {
				created: true,
				comparison
			};
		}
		function create(state, { id, name, unit } = {}) {
			const cleanIdentifier = cleanId(id);
			if (!cleanIdentifier) return { error: "missing-id" };
			if (find(state, cleanIdentifier)) return { error: "duplicate-id" };
			const comparison = blank(cleanIdentifier, name, unit);
			comparisons(state).push(comparison);
			return { comparison };
		}
		function updateMetadata(state, { id, key, value } = {}) {
			const comparison = find(state, id);
			if (!comparison) return { error: "not-found" };
			if (!META_KEYS.has(key)) return { error: "invalid-field" };
			const field = key;
			comparison.test = comparison.test && typeof comparison.test === "object" ? comparison.test : {};
			let clean;
			if (field === "coverageConfirmed") clean = !!value;
			else if (field === "biasTarget" || field === "alpha") {
				const numeric = Number(value);
				clean = value === "" || value == null || !Number.isFinite(numeric) ? comparison.test[field] : numeric;
			} else clean = cleanText(value, field === "date" ? 20 : void 0);
			comparison.test[field] = clean;
			return {
				comparison,
				key: field,
				value: clean
			};
		}
		function updateCell(state, { id, rowIndex, column, value } = {}) {
			const comparison = find(state, id), row = Number(rowIndex), col = Number(column);
			if (!comparison) return { error: "not-found" };
			if (!Number.isInteger(row) || row < 0 || !Array.isArray(comparison.rows) || !comparison.rows[row]) return { error: "invalid-row" };
			if (col !== 0 && col !== 1) return { error: "invalid-column" };
			comparison.rows[row][col] = value;
			return {
				comparison,
				rowIndex: row,
				column: col
			};
		}
		function addRow(state, { id } = {}) {
			const comparison = find(state, id);
			if (!comparison) return { error: "not-found" };
			if (!Array.isArray(comparison.rows)) comparison.rows = [];
			comparison.rows.push(["", ""]);
			return {
				comparison,
				rowIndex: comparison.rows.length - 1
			};
		}
		function removeRow(state, { id, rowIndex } = {}) {
			const comparison = find(state, id), row = Number(rowIndex);
			if (!comparison) return { error: "not-found" };
			if (!Number.isInteger(row) || row < 0 || !Array.isArray(comparison.rows) || row >= comparison.rows.length) return { error: "invalid-row" };
			const removed = comparison.rows.splice(row, 1)[0];
			if (!comparison.rows.length) comparison.rows.push(["", ""]);
			return {
				comparison,
				removed,
				rowIndex: row
			};
		}
		function clearRows(state, { id } = {}) {
			const comparison = find(state, id);
			if (!comparison) return { error: "not-found" };
			comparison.rows = [
				["", ""],
				["", ""],
				["", ""],
				["", ""],
				["", ""]
			];
			return { comparison };
		}
		function remove(state, { id } = {}) {
			const items = comparisons(state), index = items.findIndex((item) => item && item.id === id);
			if (index < 0) return { error: "not-found" };
			if (items.length <= 1) return { error: "last-comparison" };
			return {
				removed: items.splice(index, 1)[0],
				nextId: (items[Math.min(index, items.length - 1)] || null)?.id || ""
			};
		}
		function quickKey(type) {
			return type === "sampleType" ? "reagentSampleTypes" : type === "operator" ? "reagentOperators" : "";
		}
		function ensureQuickList(state, type) {
			const key = quickKey(type);
			if (!key) return { error: "invalid-type" };
			if (!Array.isArray(state[key])) state[key] = type === "sampleType" ? [...DEFAULT_SAMPLE_TYPES] : [];
			if (type === "sampleType" && !state[key].length) state[key] = [...DEFAULT_SAMPLE_TYPES];
			return {
				key,
				items: state[key]
			};
		}
		function searchKey(value) {
			return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
		}
		function addQuick(state, { type, value } = {}) {
			const list = ensureQuickList(state, type);
			if ("error" in list) return list;
			const clean = cleanText(value, 120).trim();
			if (!clean) return { error: "empty-value" };
			const existing = list.items.find((item) => searchKey(item) === searchKey(clean));
			if (existing) return {
				items: list.items,
				value: existing,
				added: false
			};
			list.items.push(clean);
			return {
				items: list.items,
				value: clean,
				added: true
			};
		}
		function removeQuick(state, { type, index } = {}) {
			const list = ensureQuickList(state, type), itemIndex = Number(index);
			if ("error" in list) return list;
			if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= list.items.length) return { error: "invalid-index" };
			return {
				items: list.items,
				removed: list.items.splice(itemIndex, 1)[0]
			};
		}
		function pickQuick(state, { id, type, index } = {}) {
			const list = ensureQuickList(state, type), itemIndex = Number(index);
			if ("error" in list) return list;
			if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= list.items.length) return { error: "invalid-index" };
			return updateMetadata(state, {
				id,
				key: type === "sampleType" ? "sampleType" : "operator",
				value: list.items[itemIndex]
			});
		}
		return Object.freeze({
			blank,
			comparisons,
			find,
			ensureOne,
			create,
			updateMetadata,
			updateCell,
			addRow,
			removeRow,
			clearRows,
			remove,
			quickKey,
			ensureQuickList,
			addQuick,
			removeQuick,
			pickQuick
		});
	}
	//#endregion
	//#region src/domain/sigma/sigma-cohort-service.ts
	function normalizePeriod(value) {
		const match = /^(\d{4})-(\d{1,2})$/.exec(String(value || "").trim());
		if (!match) return "";
		const month = Number(match[2]);
		return month >= 1 && month <= 12 ? `${match[1]}-${String(month).padStart(2, "0")}` : "";
	}
	function normalizeDate(value) {
		const text = String(value || "").trim();
		const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
		if (!match) return "";
		const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
		return date.getUTCFullYear() === +match[1] && date.getUTCMonth() === +match[2] - 1 && date.getUTCDate() === +match[3] ? text : "";
	}
	function pointRunNo(point) {
		const match = /(?:^|-)(\d+)$/.exec(String(point?.runId || ""));
		return match ? Number(match[1]) : 1;
	}
	function pointOrder(a, b) {
		return String(a.point.date || "").localeCompare(String(b.point.date || "")) || pointRunNo(a.point) - pointRunNo(b.point) || a.index - b.index;
	}
	function uniqueFinite(points, key, positive = false) {
		const values = [];
		points.forEach((point) => {
			const raw = point?.[key];
			if (raw == null || String(raw).trim() === "") return;
			const value = Number(raw);
			if (Number.isFinite(value) && (!positive || value > 0) && !values.some((item) => Object.is(item, value))) values.push(value);
		});
		return values;
	}
	function assess(cohort, { minimum = 20, recommended = 30 } = {}) {
		minimum = Math.max(2, Math.floor(Number(minimum) || 20));
		recommended = Math.max(minimum, Math.floor(Number(recommended) || 30));
		const n = Number(cohort?.n) || 0;
		const issues = Array.isArray(cohort?.issues) ? cohort.issues : [];
		if (issues.includes("missing-lot") || issues.includes("mixed-target-mean") || issues.includes("mixed-target-sd")) return {
			status: "unstable",
			classifiable: false,
			qcpEligible: false,
			minimum,
			recommended
		};
		if (n < minimum) return {
			status: "insufficient",
			classifiable: false,
			qcpEligible: false,
			minimum,
			recommended
		};
		if (n < recommended) return {
			status: "provisional",
			classifiable: true,
			qcpEligible: false,
			minimum,
			recommended
		};
		return {
			status: "eligible",
			classifiable: true,
			qcpEligible: true,
			minimum,
			recommended
		};
	}
	function createSigmaCohortService({ stats }) {
		if (typeof stats !== "function") throw new TypeError("SigmaCohortService cần một hàm stats");
		function buildGroup(testId, level, period, lot, rows) {
			const excluded = {
				voided: 0,
				invalidValue: 0
			};
			const eligible = [];
			rows.forEach((row) => {
				const point = row.point || {};
				if (point.voided) {
					excluded.voided++;
					return;
				}
				const raw = point.val;
				if (raw == null || String(raw).trim() === "") {
					excluded.invalidValue++;
					return;
				}
				const value = Number(raw);
				if (!Number.isFinite(value)) {
					excluded.invalidValue++;
					return;
				}
				eligible.push({
					...row,
					value
				});
			});
			eligible.sort(pointOrder);
			const points = eligible.map((row) => row.point);
			const values = eligible.map((row) => row.value);
			const targetMeans = uniqueFinite(points, "qcMean");
			const targetSds = uniqueFinite(points, "qcSd", true);
			const issues = [];
			if (!lot) issues.push("missing-lot");
			if (targetMeans.length > 1) issues.push("mixed-target-mean");
			if (targetSds.length > 1) issues.push("mixed-target-sd");
			return {
				testId,
				level,
				period,
				lot,
				points,
				values,
				stats: stats(values),
				n: values.length,
				start: String(points[0]?.date || ""),
				end: String(points[points.length - 1]?.date || ""),
				targetMean: targetMeans.length === 1 ? targetMeans[0] : null,
				targetSd: targetSds.length === 1 ? targetSds[0] : null,
				targetMeans,
				targetSds,
				excluded,
				issues
			};
		}
		function cohortsForLevelByLot(state, { testId, level, startDate = "", endDate = "" } = {}) {
			const numericLevel = Number(level);
			const start = startDate ? normalizeDate(startDate) : "";
			const end = endDate ? normalizeDate(endDate) : "";
			if (!state || !testId || !Number.isFinite(numericLevel) || startDate && !start || endDate && !end || start && end && start > end) return [];
			const groups = /* @__PURE__ */ new Map();
			(state.data?.[String(testId)] || []).forEach((point, index) => {
				const date = String(point?.date || "");
				if (Number(point?.level) !== numericLevel || !normalizeDate(date) || start && date < start || end && date > end) return;
				const lot = String(point?.lot || "").trim();
				if (!groups.has(lot)) groups.set(lot, []);
				groups.get(lot)?.push({
					point,
					index
				});
			});
			return [...groups.entries()].map(([lot, rows]) => buildGroup(testId, numericLevel, "", lot, rows)).sort((a, b) => String(a.start).localeCompare(String(b.start)) || String(a.lot).localeCompare(String(b.lot), "vi", { numeric: true }));
		}
		return Object.freeze({
			normalizePeriod,
			normalizeDate,
			cohortsForLevelByLot,
			assess
		});
	}
	//#endregion
	//#region src/domain/westgard/westgard-view-model.ts
	function isVerdictMap(value) {
		return !!value && typeof value.get === "function";
	}
	function getVerdict(verdicts, point) {
		if (isVerdictMap(verdicts)) return verdicts.get(point?.id) || {};
		return {};
	}
	function summarizeTestStatus({ views = [], verdicts, today = "" } = {}) {
		const order = {
			none: -1,
			ok: 0,
			warn: 1,
			rej: 2
		};
		let status = "none";
		let todayCount = 0;
		let totalPoints = 0;
		const lastPoints = [];
		const alerts = [];
		(Array.isArray(views) ? views : []).forEach((view) => {
			const levelConfig = view?.l || view?.levelConfig || {};
			const points = Array.isArray(view?.pts) ? view.pts : [];
			if (points.some((point) => point.date === today)) todayCount++;
			totalPoints += points.length;
			points.forEach((point) => lastPoints.push({
				...point,
				_level: levelConfig.level
			}));
			if (!points.length) return;
			const point = points[points.length - 1];
			const verdict = getVerdict(verdicts, point);
			const level = String(verdict.level || "ok");
			if (order[level] > order[status]) status = level;
			if (level !== "ok") alerts.push({
				level,
				point,
				rules: Array.isArray(verdict.rules) ? verdict.rules : [],
				levelConfig
			});
		});
		return {
			status,
			todayCount,
			totalPoints,
			lastPoints,
			alerts
		};
	}
	function buildMultiViews({ levels = [], previousByLevel = {}, openLevels = [] } = {}) {
		const open = new Set(openLevels);
		const getPrevious = (level) => {
			if (previousByLevel instanceof Map) return previousByLevel.get(level) || [];
			return previousByLevel?.[String(level)] || [];
		};
		const views = [];
		(Array.isArray(levels) ? levels : []).forEach((level) => {
			views.push({
				level: level.level,
				lot: level.lot,
				mean: level.mean,
				sd: level.sd,
				pts: Array.isArray(level.pts) ? level.pts : [],
				label: `M${level.level}·${level.lot || "?"}`
			});
			if (open.has(level.level)) getPrevious(level.level).forEach((previous) => views.push({
				level: level.level,
				lot: previous.lot,
				mean: previous.mean,
				sd: previous.sd,
				pts: previous.pts,
				label: `M${level.level}·cũ ${previous.lot}`
			}));
		});
		return views;
	}
	function buildPointRows({ points = [], verdicts, zs = [], mean, sd } = {}) {
		const source = Array.isArray(points) ? points : [];
		const verdictFor = (point, index) => {
			if (isVerdictMap(verdicts)) return verdicts.get(point.id) || {};
			return Array.isArray(verdicts) ? verdicts[index] || {} : {};
		};
		return source.map((point, index) => {
			const verdict = verdictFor(point, index);
			const value = Number(point?.val);
			const targetMean = Number(mean);
			const targetSd = Number(sd);
			const verdictZ = Number(verdict.z);
			const seriesZ = Number(zs[index]);
			const z = Number.isFinite(verdictZ) ? verdictZ : Number.isFinite(seriesZ) ? seriesZ : Number.isFinite(value) && Number.isFinite(targetMean) && Number.isFinite(targetSd) && targetSd !== 0 ? (value - targetMean) / targetSd : NaN;
			const rules = [...new Set(Array.isArray(verdict.rules) ? verdict.rules : [])];
			return {
				index: index + 1,
				id: point?.id,
				date: point?.date,
				value: point?.val,
				z,
				level: verdict.level || "ok",
				rules,
				supportRules: [...new Set(Array.isArray(verdict.supportRules) ? verdict.supportRules : [])].filter((rule) => !rules.includes(rule))
			};
		});
	}
	var westgardViewModel = Object.freeze({
		buildPointRows,
		summarizeTestStatus,
		buildMultiViews
	});
	var nceActionLabels = Object.freeze({
		protocolChecks: Object.freeze([
			["qcMaterialStatus", "Vật liệu QC"],
			["instrumentStatus", "Máy phân tích"],
			["reagentStatus", "Hóa chất / calibrator"],
			["calibrationStatus", "Hiệu chuẩn"],
			["lotToLotStatus", "So sánh lot-to-lot"]
		]),
		riskScale: Object.freeze([
			1,
			2,
			3,
			4,
			5
		]),
		actionLabels: Object.freeze({
			check: {
				ok: "Đạt",
				abnormal: "Bất thường",
				na: "Không áp dụng",
				"not-needed": "Không cần",
				"checked-ok": "Đạt",
				"checked-abnormal": "Bất thường"
			},
			containment: {
				held: "Đã dừng/giữ kết quả liên quan",
				none: "Không có kết quả bệnh nhân liên quan"
			},
			patient: {
				none: "Không có mẫu/kết quả bị ảnh hưởng",
				held: "Đã giữ kết quả để rà soát",
				affected: "Có kết quả cần xử lý lại"
			},
			cause: {
				qc: "Vật liệu QC",
				operator: "Thao tác",
				instrument: "Thiết bị",
				reagent: "Hóa chất / calibrator",
				calibration: "Hiệu chuẩn",
				environment: "Môi trường",
				unknown: "Chưa xác định"
			},
			source: {
				iqc: "Nội kiểm IQC",
				eqa: "Ngoại kiểm EQA",
				instrument: "Cảnh báo thiết bị",
				clinical: "Phản hồi lâm sàng",
				audit: "Đánh giá / audit",
				other: "Nguồn khác"
			},
			phase: {
				pre: "Trước xét nghiệm",
				exam: "Trong xét nghiệm",
				post: "Sau xét nghiệm"
			},
			risk: {
				low: "Thấp",
				medium: "Trung bình",
				high: "Cao",
				critical: "Nghiêm trọng"
			},
			release: { released: "Đã cho phép hoạt động/trả kết quả trở lại" }
		})
	});
	//#endregion
	//#region src/domain/nce/action-basics.ts
	function actionApprovalStatus(action) {
		return action && [
			"pending",
			"approved",
			"returned"
		].includes(action.approvalStatus) ? action.approvalStatus : "pending";
	}
	function actionRecordStatus(action) {
		return action && action.recordStatus === "cancelled" ? "cancelled" : "active";
	}
	function actionCancelled(action) {
		return actionRecordStatus(action) === "cancelled";
	}
	function actionApprovalLabel(action) {
		if (actionCancelled(action)) return "Đã hủy hồ sơ";
		const status = actionApprovalStatus(action);
		return status === "approved" ? "Đã duyệt" : status === "returned" ? "Trả lại" : "Chờ duyệt";
	}
	function actionRecorded(action) {
		return !!(action && !action.autoCreated && String(action.by || "").trim() && (action.protocolVersion >= 2 ? String(action.correction || "").trim().length >= 5 : String(action.action || "").trim().length >= 5));
	}
	function actionRiskScore(action) {
		const values = [
			action?.riskSeverity,
			action?.riskOccurrence,
			action?.riskDetectability
		].map(Number);
		return values.every((value) => Number.isInteger(value) && value >= 1 && value <= 5) ? values.reduce((total, value) => total * value, 1) : 0;
	}
	function actionResidualRiskScore(action) {
		return actionRiskScore({
			riskSeverity: action?.residualSeverity,
			riskOccurrence: action?.residualOccurrence,
			riskDetectability: action?.residualDetectability
		});
	}
	var nceActionBasics = Object.freeze({
		actionApprovalStatus,
		actionRecordStatus,
		actionCancelled,
		actionApprovalLabel,
		actionRecorded,
		actionRiskScore,
		actionResidualRiskScore,
		actionLabels: nceActionLabels.actionLabels
	});
	//#endregion
	//#region src/application/nce/action-identity-service.ts
	function createNceActionIdentityService(deps) {
		const nextNceId = (actions, today) => {
			const day = String(today || "").replace(/-/g, "");
			let value = "";
			do
				value = `NCE-${day}-${String(deps.createId()).replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}`;
			while ((actions || []).some((action) => action.nceId === value));
			return value;
		};
		const dueDate = (days = 7) => {
			const date = deps.now();
			date.setDate(date.getDate() + days);
			return deps.isoDate(date);
		};
		const activeFollowUp = (actions, action) => {
			const id = String(action?.followUpNceId || "").trim();
			return id ? (actions || []).find((candidate) => candidate.nceId === id && !deps.isCancelled(candidate)) || null : null;
		};
		return Object.freeze({
			nextNceId,
			dueDate,
			activeFollowUp
		});
	}
	//#endregion
	//#region src/domain/nce/action-approval-gates.ts
	function createActionApprovalGates(deps) {
		const overdue = (action) => {
			const due = String(action?.dueDate || "").trim();
			if (!due || !action || deps.isCancelled(action) || !deps.isRecorded(action) || deps.workflowComplete(action)) return {
				overdue: false,
				days: 0,
				label: ""
			};
			const today = deps.todayIso();
			if (due >= today) return {
				overdue: false,
				days: 0,
				label: ""
			};
			const days = Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(due + "T00:00:00Z")) / 864e5);
			return {
				overdue: true,
				days,
				label: `Quá hạn ${days} ngày`
			};
		};
		const identityText = (value) => String(value || "").trim().toLocaleLowerCase("vi");
		const canApprove = (action, user) => {
			if (!action || !user || deps.isCancelled(action)) return false;
			const userId = String(user.id || ""), username = identityText(user.username);
			const contributorIds = new Set([action.createdByUserId, ...Array.isArray(action.contentEditorUserIds) ? action.contentEditorUserIds : []].map((value) => String(value || "")).filter(Boolean));
			const contributorNames = new Set([action.createdByUsername, ...Array.isArray(action.contentEditorUsernames) ? action.contentEditorUsernames : []].map(identityText).filter(Boolean));
			if (userId && contributorIds.has(userId)) return false;
			if (username && contributorNames.has(username)) return false;
			if (contributorIds.size || contributorNames.size) return true;
			const creator = identityText(action.by), identities = [user.name, user.username].map(identityText).filter(Boolean);
			return !creator || !identities.includes(creator);
		};
		return Object.freeze({
			overdue,
			canApprove
		});
	}
	//#endregion
	//#region src/domain/nce/action-qc-link.ts
	function createActionQcLink(deps) {
		const eventDate = (action) => {
			const point = action ? deps.pointForAction(action) : null;
			return String(point?.date || action?.date || "");
		};
		const needsRerun = (action) => {
			if (!action) return false;
			const test = deps.findTest(action.testId), point = deps.pointForAction(action);
			if (!test || !point) return false;
			if (point.voided) return point.voidRequiresRerun == null ? point.voidKind !== "data-entry" : !!point.voidRequiresRerun;
			return deps.westgard(test).byPoint.get(point.id)?.level === "rej";
		};
		return Object.freeze({
			eventDate,
			needsRerun
		});
	}
	//#endregion
	//#region src/domain/nce/action-rerun-policy.ts
	function openedFromVoid(action, point) {
		return !!(action && point && point.voided && (action.openedFromVoid === true || point.voidedAt && action.createdAt && point.voidedAt === action.createdAt));
	}
	function rerunGateDate(action, point) {
		const gates = [String(point?.date || "")];
		if (action && Number(action.protocolVersion) >= 3 && action.actionCompletedDate && !openedFromVoid(action, point)) gates.push(String(action.actionCompletedDate));
		if (action?.parentNceId && action.date) gates.push(String(action.date));
		return gates.filter(Boolean).sort().pop() || "";
	}
	var nceActionRerunPolicy = Object.freeze({
		openedFromVoid,
		rerunGateDate
	});
	//#endregion
	//#region src/domain/nce/action-rerun-cache-key.ts
	function actionRerunCacheKey(action, decimalPlaces) {
		const value = action || {};
		return [
			value.id,
			value.testId,
			value.pointId,
			Number(value.protocolVersion) || 0,
			value.actionCompletedDate || "",
			value.parentNceId || "",
			value.date || "",
			value.openedFromVoid ? 1 : 0,
			decimalPlaces != null ? decimalPlaces : "auto"
		].join("|");
	}
	var nceActionRerunCacheKey = Object.freeze({ actionRerunCacheKey });
	//#endregion
	//#region src/domain/nce/action-qc-index.ts
	function actionPointIndex(points) {
		return new Map((points || []).map((point) => [point.id, point]));
	}
	function actionLotPoints(points, level, lot, runNumber) {
		return (points || []).filter((point) => !point.voided && Number(point.level) === Number(level) && (point.lot || "") === (lot || "")).sort((left, right) => String(left.date || "").localeCompare(String(right.date || "")) || runNumber(left) - runNumber(right));
	}
	var nceActionQcIndex = Object.freeze({
		actionPointIndex,
		actionLotPoints
	});
	//#endregion
	//#region src/domain/nce/action-rerun-evaluator.ts
	function evaluateActionRerun(input) {
		if (!input.needed) return {
			needed: false,
			ok: true,
			label: "Không yêu cầu",
			cls: "none",
			point: null
		};
		const point = input.point;
		if (!point) return {
			needed: true,
			ok: false,
			label: "Chờ QC chạy lại được chấp nhận",
			cls: "warn",
			point: null
		};
		if (Number(input.action.protocolVersion) >= 3 && !input.action.actionCompletedDate) return {
			needed: true,
			ok: false,
			label: "Chờ hoàn thành hành động trước khi xác nhận QC chạy lại",
			cls: "warn",
			point: null
		};
		const rerun = input.candidates.find((candidate) => !candidate.voided && candidate.id !== point.id && Number(candidate.level) === Number(point.level) && (candidate.lot || "") === (point.lot || "") && candidate.date >= input.gateDate && (candidate.date > point.date || candidate.date === point.date && input.runNumber(candidate) > input.incidentRunNumber) && input.verdictFor(candidate.id).level !== "rej");
		if (rerun) {
			const warning = input.verdictFor(rerun.id).level === "warn";
			return {
				needed: true,
				ok: true,
				label: `${warning ? "QC chấp nhận lại (cảnh báo)" : "QC đạt lại"}: ${input.formatValue(rerun)} (${rerun.runId || "lần sau"})`,
				cls: warning ? "warn" : "ok",
				point: rerun
			};
		}
		return {
			needed: true,
			ok: false,
			label: `Chờ QC chạy lại được chấp nhận${input.gateDate ? " từ " + input.formatDate(input.gateDate) : ""}`,
			cls: "warn",
			point: null
		};
	}
	var nceActionRerunEvaluator = Object.freeze({ evaluateActionRerun });
	//#endregion
	//#region src/domain/nce/action-workflow-status.ts
	function createActionWorkflowStatus(deps) {
		return (action) => {
			if (!action) return {
				complete: false,
				cls: "rej",
				label: "Chưa ghi khắc phục",
				rerun: {
					needed: false,
					ok: false,
					label: "Chưa ghi khắc phục",
					cls: "rej",
					point: null
				}
			};
			if (deps.isCancelled(action)) return {
				complete: false,
				cancelled: true,
				cls: "none",
				label: "Đã hủy hồ sơ",
				stage: "cancelled",
				rerun: {
					needed: false,
					ok: false,
					label: "Hồ sơ đã hủy",
					cls: "none",
					point: null
				},
				protocol: deps.protocolStatus(action),
				effectiveness: deps.effectivenessStatus(action)
			};
			if (!deps.isRecorded(action)) return {
				complete: false,
				cls: "rej",
				label: "Chưa ghi khắc phục",
				rerun: {
					needed: false,
					ok: false,
					label: "Chưa ghi khắc phục",
					cls: "rej",
					point: null
				}
			};
			const rerun = deps.rerunStatus(action), approval = deps.approvalStatus(action), protocol = deps.protocolStatus(action), effectiveness = deps.effectivenessStatus(action);
			let stage = "investigating", label = "Đang điều tra", cls = "warn";
			if (protocol.complete && rerun.needed && !rerun.ok) {
				stage = "rerun";
				label = rerun.label;
			} else if (protocol.complete && effectiveness.required && !effectiveness.complete) {
				stage = "effectiveness";
				label = effectiveness.label;
				cls = effectiveness.cls;
			} else if (protocol.complete && (!rerun.needed || rerun.ok) && effectiveness.complete && approval === "returned") {
				stage = "returned";
				label = "Trả lại để bổ sung";
				cls = "rej";
			} else if (protocol.complete && (!rerun.needed || rerun.ok) && effectiveness.complete && approval !== "approved") {
				stage = "approval";
				label = "Chờ duyệt";
			} else if (protocol.complete && (!rerun.needed || rerun.ok) && effectiveness.complete && approval === "approved") {
				stage = "closed";
				label = "Đã khép vòng";
				cls = "ok";
			}
			return {
				complete: stage === "closed",
				cls,
				label,
				stage,
				rerun,
				protocol,
				effectiveness
			};
		};
	}
	//#endregion
	//#region src/application/nce/point-workflow-service.ts
	function createPointWorkflowService(deps) {
		const real = (actions) => actions.filter((action) => !deps.isCancelled(action) && deps.isRecorded(action));
		const complete = (actions) => real(actions).some((action) => deps.status(action).complete);
		const summary = (actions) => {
			if (!actions.length || !real(actions).length) return {
				cls: "rej",
				label: "Chưa ghi khắc phục"
			};
			const records = real(actions), done = records.find((action) => deps.status(action).complete);
			return done ? {
				cls: "ok",
				label: deps.status(done).label
			} : deps.status(records[records.length - 1]);
		};
		return Object.freeze({
			real,
			complete,
			summary
		});
	}
	//#endregion
	//#region src/domain/nce/action-draft-status.ts
	function createActionDraftStatus(deps) {
		return (action) => {
			if (!action || Number(action.protocolVersion) < 2) {
				const complete = !!action && deps.isRecorded(action);
				return {
					complete,
					missing: complete ? [] : ["hành động và người thực hiện"],
					missingKeys: complete ? [] : ["action"]
				};
			}
			const missing = [], missingKeys = [], need = (condition, label, key) => {
				if (condition) {
					missing.push(label);
					missingKeys.push(key);
				}
			};
			need(!!action.date && action.date > deps.todayIso(), "ngày ghi nhận sự cố không được ở tương lai", "date");
			need(!nceActionLabels.actionLabels.source[action.eventSource], "nguồn phát hiện", "eventSource");
			need(!nceActionLabels.actionLabels.phase[action.processPhase], "giai đoạn quá trình", "processPhase");
			need(!nceActionLabels.actionLabels.containment[action.containmentStatus], "kiểm soát tức thời (mục 1)", "containmentStatus");
			need(String(action.correction || "").trim().length < 5, "xử lý tức thời đã thực hiện", "correction");
			need(!String(action.by || "").trim(), "người phụ trách", "by");
			need(!String(action.dueDate || "").trim(), "hạn hoàn thành", "dueDate");
			need(action.eventSource === "iqc" && !String(action.pointId || "").trim(), "sự cố nội kiểm IQC phải mở từ dòng vi phạm", "eventSource");
			need(action.eventSource === "iqc" && !!String(action.pointId || "").trim() && !deps.pointForAction(action), "điểm QC liên kết không còn tồn tại hoặc không thuộc đúng xét nghiệm", "eventSource");
			return {
				complete: !missing.length,
				missing,
				missingKeys
			};
		};
	}
	//#endregion
	//#region src/presentation/state/ui-state.ts
	function installUiState(root, namespace, initialState) {
		const target = root;
		const state = initialState;
		Object.keys(initialState).forEach((name) => Object.defineProperty(target, name, {
			configurable: true,
			get() {
				return state[name];
			},
			set(value) {
				state[name] = value;
			}
		}));
		target[namespace] = initialState;
		return initialState;
	}
	function createAnalysisUiState() {
		return {
			selTest: null,
			statusMemo: /* @__PURE__ */ new Map(),
			wgTestQ: "",
			dashTestQ: "",
			dashTestStatus: "all",
			wgPrevOpen: /* @__PURE__ */ new Set(),
			wgExpandedRows: /* @__PURE__ */ new Set(),
			wgViewMode: "current",
			wgArchivedGroupId: "",
			wgArchivedTestId: "",
			wgArchivedTestQ: "",
			wgChartMode: "lj"
		};
	}
	function createAuthUiState(lockout = null) {
		return {
			currentUser: null,
			loginFails: lockout && Number(lockout.fails) || 0,
			loginLockUntil: lockout && Number(lockout.until) || 0
		};
	}
	function createEntryUiState() {
		return {
			entrySel: null,
			entryDays: 30,
			entryStart: null,
			entryEnd: null,
			entrySheetMonth: "",
			entryQ: "",
			entryMachine: "all",
			entryLastMsg: "",
			entryAutoOpenKey: null,
			entryPendingSheetFocus: "",
			entryJumpToday: false,
			entryLjRenderCache: null,
			entryPartialRenderCache: null,
			entryPrevOpen: /* @__PURE__ */ new Map(),
			entryExpandedTables: /* @__PURE__ */ new Set(),
			entryDetailOpen: /* @__PURE__ */ new Set(),
			treeOpen: /* @__PURE__ */ new Set(),
			entryExtraRun: /* @__PURE__ */ new Set(),
			entryTreeCollapsed: null
		};
	}
	function createManageUiState() {
		return {
			manageQ: "",
			manageTab: "instruments",
			manageTargetPanel: "",
			manageTargetGroup: "",
			manageTargetLevel: "",
			manageHistoryTest: "",
			targetSwitchCtx: null,
			configNavScroll: 0
		};
	}
	function createReagentUiState() {
		return {
			rcId: null,
			rcSaveT: null,
			rcModalQ: "",
			rcCreateModalQ: "",
			rcQuickType: "",
			rcMetaBefore: null
		};
	}
	function createSigmaUiState() {
		return {
			sgTest: null,
			sgRefreshT: null,
			sgBiasCtx: null,
			sgMuCtx: null,
			sgAddTestQ: "",
			sgSelectedPeriods: {}
		};
	}
	//#endregion
	//#region src/compat/modular-pilot.global.ts
	var root = globalThis;
	if (!root.QCCore || typeof root.QCCore.stats !== "function" || typeof root.QCCore.cleanText !== "function" || typeof root.QCCore.cleanId !== "function") throw new Error("QCCore phải được nạp đủ dependency trước các module TypeScript");
	var loginLockout = null;
	try {
		loginLockout = JSON.parse(localStorage.getItem("qclab_login_lockout") || "null");
	} catch {
		loginLockout = null;
	}
	installUiState(root, "AnalysisUIState", createAnalysisUiState());
	installUiState(root, "AuthUIState", createAuthUiState(loginLockout));
	installUiState(root, "EntryUIState", createEntryUiState());
	installUiState(root, "ManageUIState", createManageUiState());
	installUiState(root, "ReagentUIState", createReagentUiState());
	installUiState(root, "SigmaUIState", createSigmaUiState());
	root.ChartViewModel = chartViewModel;
	root.NceActionLabels = nceActionLabels;
	root.NceActionBasics = nceActionBasics;
	root.NceActionIdentityService = createNceActionIdentityService({
		createId: () => uid(),
		now: () => /* @__PURE__ */ new Date(),
		isoDate: (value) => isoDate(value),
		isCancelled: (action) => nceActionBasics.actionCancelled(action)
	});
	root.ActionApprovalGates = createActionApprovalGates({
		todayIso: () => isoToday(),
		isCancelled: (action) => nceActionBasics.actionCancelled(action),
		isRecorded: (action) => nceActionBasics.actionRecorded(action),
		workflowComplete: (action) => typeof root.actionWorkflowStatus === "function" && !!root.actionWorkflowStatus(action).complete
	});
	root.ActionQcLink = createActionQcLink({
		pointForAction: (action) => typeof root.actionPoint === "function" ? root.actionPoint(action) : null,
		findTest: (testId) => (state.tests || []).find((test) => test.id === testId),
		westgard: (test) => globalThis.activeWestgard(test)
	});
	root.NceActionRerunPolicy = nceActionRerunPolicy;
	root.NceActionRerunCacheKey = nceActionRerunCacheKey;
	root.NceActionQcIndex = nceActionQcIndex;
	root.NceActionRerunEvaluator = nceActionRerunEvaluator;
	root.ActionWorkflowStatusService = createActionWorkflowStatus({
		isCancelled: (action) => nceActionBasics.actionCancelled(action),
		isRecorded: (action) => nceActionBasics.actionRecorded(action),
		rerunStatus: (action) => root.actionRerunStatus(action),
		approvalStatus: (action) => nceActionBasics.actionApprovalStatus(action),
		protocolStatus: (action) => root.actionProtocolStatus(action),
		effectivenessStatus: (action) => root.actionEffectivenessStatus(action)
	});
	root.PointWorkflowService = createPointWorkflowService({
		isCancelled: (action) => nceActionBasics.actionCancelled(action),
		isRecorded: (action) => nceActionBasics.actionRecorded(action),
		status: (action) => root.actionWorkflowStatus(action)
	});
	root.ActionDraftStatusService = createActionDraftStatus({
		todayIso: () => isoToday(),
		isRecorded: (action) => nceActionBasics.actionRecorded(action),
		pointForAction: (action) => typeof root.actionPoint === "function" ? root.actionPoint(action) : null
	});
	var qcPointWarnings = createQcPointWarnings({
		stats: root.QCCore.stats,
		todayIso: () => isoToday(),
		formatDate: (value) => vnDate(value),
		formatNumber: (value, decimals) => fmt(value, decimals)
	});
	root.qcPointWarnings = (test, config, date, runId, value) => qcPointWarnings(state.data && state.data[test.id] || [], config, date, runId, value);
	root.PeriodService = createPeriodService({ cleanText: root.QCCore.cleanText });
	root.EntryService = createEntryService({
		cleanText: root.QCCore.cleanText,
		cleanId: root.QCCore.cleanId,
		valueDecimals: (value) => {
			if (typeof root.qcValueDecimals !== "function") throw new Error("qcValueDecimals chưa được nạp");
			return root.qcValueDecimals(value);
		},
		isPeriodLocked: (state, date) => {
			const period = root.PeriodService;
			return !!(period && typeof period.findLock === "function" && typeof period.periodForDate === "function" && period.findLock(state, period.periodForDate(date)));
		}
	});
	var backupTextBytes = (text) => {
		if (typeof Blob !== "undefined") return new Blob([text]).size;
		if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
		return unescape(encodeURIComponent(text)).length;
	};
	var backupHash = async (text) => {
		if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
			const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
			return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
		}
		if (typeof auditSha256 === "function" && backupTextBytes(text) <= 16777216) return auditSha256(text);
		return "";
	};
	var backupCore = root.QCCore;
	var backupService = createBackupService({
		validateBackup: backupCore.validateBackup,
		sanitizeBackup: backupCore.sanitizeBackup,
		validateStateInvariants: backupCore.validateStateInvariants,
		verifyAuditChain: backupCore.verifyAuditChain,
		schemaVersion: backupCore.STATE_SCHEMA_VERSION,
		hash: backupHash,
		textBytes: backupTextBytes,
		nowIso: () => (/* @__PURE__ */ new Date()).toISOString(),
		appVersion: () => root.QCLAB_APP?.version || ""
	});
	root.BackupService = backupService;
	root.BACKUP_IMPORT_MAX_BYTES = BACKUP_IMPORT_MAX_BYTES;
	root.BACKUP_IMPORT_WARN_BYTES = BACKUP_IMPORT_WARN_BYTES;
	root.serializeBackupData = backupService.serializeBackupData;
	root.backupTextBytes = backupService.backupTextBytes;
	root.backupSizeMB = backupService.backupSizeMB;
	root.backupImportSizeError = backupService.backupImportSizeError;
	root.backupSizeWarning = backupService.backupSizeWarning;
	root.backupChecksum = backupService.backupChecksum;
	root.createBackupPackage = backupService.createBackupPackage;
	root.parseBackupPackage = backupService.parseBackupPackage;
	root.prepareBackupState = backupService.prepareBackupState;
	root.prepareBackupImport = backupService.prepareBackupImport;
	root.backupSummary = backupService.backupSummary;
	root.inspectBackupText = backupService.inspectBackupText;
	var lisRuntime = createLisGatewayRuntime();
	var lisClient;
	var lisStorage = typeof localStorage !== "undefined" ? localStorage : { getItem: () => null };
	var renderLisStatus = () => {
		const element = typeof document !== "undefined" && document.getElementById("lisGatewayStatus");
		if (!element) return;
		element.className = "alert " + (lisRuntime.status === "ok" ? "ok" : lisRuntime.status === "syncing" ? "warn" : lisRuntime.status === "off" ? "" : "rej");
		element.textContent = lisClient.statusText();
	};
	lisClient = createLisClient({
		runtime: lisRuntime,
		storage: lisStorage,
		fetch: async (url, options) => fetch(url, options),
		makeUrl: (value) => new URL(value),
		createAbortController: () => new AbortController(),
		setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
		clearTimeout: (timer) => clearTimeout(timer),
		setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
		clearInterval: (timer) => clearInterval(timer),
		nowIso: () => (/* @__PURE__ */ new Date()).toISOString(),
		formatDateTime: (value) => formatDateTimeVN(value),
		renderStatus: renderLisStatus,
		notify: (message, options) => infoDialog(message, options),
		requireWrite: () => requireWrite(),
		getState: () => state,
		levelConfig: (test, level) => lvlCfg(test, level),
		recordPoint: (targetState, input) => {
			if (!root.EntryService) throw new Error("EntryService chưa được nạp");
			return root.EntryService.recordPoint(targetState, input);
		},
		log: (action, detail, target) => logAct(action, detail, target),
		save: (options) => save(options),
		userName: () => userName(),
		formatNumber: (value, decimals) => fmt(value, decimals),
		rerender: () => rerender()
	});
	root.LISClientService = lisClient;
	root.lisGatewayRuntime = lisRuntime;
	root.LIS_GATEWAY_STORAGE_KEY = LIS_GATEWAY_STORAGE_KEY;
	root.LIS_POLL_MS = LIS_POLL_MS;
	root.lisGatewayConfig = lisClient.gatewayConfig;
	root.lisNormalizeGatewayUrl = lisClient.normalizeGatewayUrl;
	root.lisGatewaySetStatus = lisClient.setStatus;
	root.lisGatewayStatusText = lisClient.statusText;
	root.lisGatewayFetch = lisClient.gatewayFetch;
	root.lisGatewayHealth = lisClient.gatewayHealth;
	root.lisGatewayPull = lisClient.pull;
	root.lisResultToPointInput = lisClient.resultToPointInput;
	root.lisImportResult = lisClient.importResult;
	root.lisRejectResult = lisClient.rejectResult;
	root.lisGatewayStart = lisClient.start;
	root.ManageConfigService = createManageConfigService({
		cleanText: root.QCCore.cleanText,
		cleanId: root.QCCore.cleanId
	});
	root.ReagentComparisonService = createReagentComparisonService({
		cleanText: root.QCCore.cleanText,
		cleanId: root.QCCore.cleanId
	});
	root.SigmaCohortService = createSigmaCohortService({ stats: root.QCCore.stats });
	root.WestgardViewModel = westgardViewModel;
	//#endregion
})();
