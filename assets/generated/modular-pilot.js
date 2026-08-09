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
	function createManageConfigService({ cleanText, cleanId, targetFromLimits, limitsFromTarget }) {
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
		function preparePanel(input = {}) {
			return {
				name: clean(input.name),
				instrumentId: clean(input.instrumentId),
				testIds: Array.isArray(input.testIds) ? [...new Set(input.testIds)] : [],
				note: cleanText(input.note, 5e3),
				active: input.active !== false
			};
		}
		function validatePanel(state, { id = "", data = {} } = {}) {
			const panels = state.qcPanels || [], cleaned = preparePanel(data);
			if (id && !panels.some((panel) => panel.id === id)) return {
				error: "not-found",
				message: "Không tìm thấy Panel QC cần cập nhật."
			};
			if (!cleaned.name) return {
				error: "missing-name",
				message: "Nhập tên Panel QC."
			};
			if (!cleaned.instrumentId) return {
				error: "missing-instrument",
				message: "Chọn máy xét nghiệm."
			};
			if (!cleaned.testIds.length) return {
				error: "missing-tests",
				message: "Chọn ít nhất một xét nghiệm."
			};
			if (cleaned.testIds.some((testId) => (state.tests || []).find((test) => test.id === testId)?.instrumentId !== cleaned.instrumentId)) return {
				error: "wrong-instrument",
				message: "Panel QC chỉ được chứa xét nghiệm thuộc máy đã chọn."
			};
			if (panels.some((panel) => panel.id !== id && panel.instrumentId === cleaned.instrumentId && sameText(panel.name, cleaned.name))) return {
				error: "duplicate-panel",
				message: "Panel QC này đã tồn tại trên máy đã chọn."
			};
			return { data: cleaned };
		}
		function savePanel(state, { id = "", newId = "", data = {} } = {}) {
			const checked = validatePanel(state, {
				id,
				data
			});
			if (checked.error) return checked;
			const existing = (state.qcPanels || []).find((panel) => panel.id === id) || null;
			const record = existing || { id: cleanId(newId) };
			if (!existing && !record.id) return {
				error: "missing-id",
				message: "Không thể tạo mã Panel QC."
			};
			Object.assign(record, checked.data);
			if (!existing) {
				state.qcPanels = state.qcPanels || [];
				state.qcPanels.push(record);
			}
			return {
				record,
				created: !existing
			};
		}
		function panelRemoval(state, { id = "" } = {}) {
			const record = (state.qcPanels || []).find((panel) => panel.id === id);
			if (!record) return { error: "not-found" };
			if ((state.lotTransitions || []).some((transition) => transition.panelId === id)) return {
				error: "used-by-transition",
				message: "Panel này đang có lịch sử chuyển tiếp lô. Hãy xóa/chuyển các dòng chuyển tiếp trước."
			};
			return { record };
		}
		function removePanel(state, { id = "" } = {}) {
			const checked = panelRemoval(state, { id });
			if (checked.error) return checked;
			state.qcPanels = (state.qcPanels || []).filter((panel) => panel.id !== id);
			return { record: checked.record };
		}
		function sameIdSet(first, second) {
			const left = [...new Set(Array.isArray(first) ? first : [])].sort(), right = [...new Set(Array.isArray(second) ? second : [])].sort();
			return left.length === right.length && left.every((id, index) => id === right[index]);
		}
		function prepareLotGroup(state, input = {}) {
			const lotIds = [...new Set(Array.isArray(input.lotIds) ? input.lotIds : [])];
			const fallbackName = lotIds.map((id) => (state.qcLots || []).find((lot) => lot.id === id)?.lotNo).filter(Boolean).join("/");
			return {
				name: clean(input.name) || fallbackName,
				lotIds,
				note: cleanText(input.note, 5e3),
				active: true
			};
		}
		function validateLotGroup(state, { id = "", data = {} } = {}) {
			const groups = state.lotGroups || [], cleaned = prepareLotGroup(state, data);
			if (id && !groups.some((group) => group.id === id)) return {
				error: "not-found",
				message: "Không tìm thấy nhóm lô cần cập nhật."
			};
			if (cleaned.lotIds.length < 2) return {
				error: "too-few-lots",
				message: "Một nhóm lô cần chọn ít nhất 2 lô QC."
			};
			if (!cleaned.name) return {
				error: "missing-name",
				message: "Nhập tên nhóm lô."
			};
			if (groups.some((group) => group.id !== id && (sameText(group.name, cleaned.name) || sameIdSet(group.lotIds, cleaned.lotIds)))) return {
				error: "duplicate-group",
				message: "Nhóm lô này đã tồn tại hoặc trùng danh sách lô."
			};
			return { data: cleaned };
		}
		function saveLotGroup(state, { id = "", newId = "", data = {} } = {}) {
			const checked = validateLotGroup(state, {
				id,
				data
			});
			if (checked.error) return checked;
			const existing = (state.lotGroups || []).find((group) => group.id === id) || null;
			const record = existing || { id: cleanId(newId) };
			if (!existing && !record.id) return {
				error: "missing-id",
				message: "Không thể tạo mã nhóm lô."
			};
			Object.assign(record, checked.data);
			if (!existing) {
				state.lotGroups = state.lotGroups || [];
				state.lotGroups.push(record);
			}
			return {
				record,
				created: !existing
			};
		}
		function lotGroupRemoval(state, { id = "" } = {}) {
			const record = (state.lotGroups || []).find((group) => group.id === id);
			if (!record) return { error: "not-found" };
			if ((state.tests || []).some((test) => (test.levels || []).some((level) => level.qcLotId && (record.lotIds || []).includes(level.qcLotId)))) return {
				error: "used-by-assay",
				message: "Nhóm lô này đang được gán Mean/SD cho xét nghiệm. Hãy đổi nhóm/lô ở thẻ Mean/SD trước khi xóa nhóm."
			};
			return { record };
		}
		function removeLotGroup(state, { id = "" } = {}) {
			const checked = lotGroupRemoval(state, { id });
			if (checked.error) return checked;
			state.lotGroups = (state.lotGroups || []).filter((group) => group.id !== id);
			return { record: checked.record };
		}
		function stopLotGroup(state, { id = "", stoppedAt = "" } = {}) {
			const record = (state.lotGroups || []).find((group) => group.id === id);
			if (!record) return { error: "not-found" };
			if (record.active === false || record.status === "stopped" || record.status === "planned") return {
				error: "not-stoppable",
				record
			};
			record.status = "stopped";
			record.stoppedAt = stoppedAt;
			return { record };
		}
		function validateLotTransition(state, options = {}) {
			const { id = "", panelId = "", fromLotId = "", toLotId = "", status = "", switchesLot = () => false } = options;
			const old = (state.lotTransitions || []).find((transition) => transition.id === id) || null;
			if (!panelId) return {
				error: "missing-panel",
				message: "Chọn Panel QC."
			};
			if (!fromLotId || !toLotId || fromLotId === toLotId) return {
				error: "invalid-lots",
				message: "Chọn lô cũ và lô mới khác nhau từ danh sách."
			};
			const fromLot = (state.qcLots || []).find((lot) => lot.id === fromLotId), toLot = (state.qcLots || []).find((lot) => lot.id === toLotId);
			if (!fromLot || !toLot) return {
				error: "missing-lot",
				message: "Không tìm thấy lô QC đã chọn."
			};
			if (+fromLot.level !== +toLot.level) return {
				error: "different-levels",
				message: "Lô cũ và lô mới phải cùng mức QC để chuyển tiếp."
			};
			if ((state.lotTransitions || []).some((transition) => transition.id !== id && transition.panelId === panelId && transition.fromLotId === fromLotId && transition.toLotId === toLotId)) return {
				error: "duplicate-transition",
				message: "Chuyển tiếp lô này đã tồn tại."
			};
			if (old && switchesLot(old) && status !== "accepted") return {
				error: "accepted-immutable",
				message: "Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không thể đổi ngược trạng thái."
			};
			return {
				old,
				fromLot,
				toLot,
				finalChanged: ["accepted", "rejected"].includes(status) && (!old || old.status !== status)
			};
		}
		function saveLotTransition(state, { id = "", newId = "", data = {} } = {}) {
			const existing = (state.lotTransitions || []).find((transition) => transition.id === id) || null;
			const record = existing || { id: cleanId(newId) };
			if (!existing && !record.id) return {
				error: "missing-id",
				message: "Không thể tạo mã hồ sơ chuyển tiếp lô."
			};
			Object.assign(record, data);
			if (!existing) {
				state.lotTransitions = state.lotTransitions || [];
				state.lotTransitions.push(record);
			}
			return {
				record,
				created: !existing
			};
		}
		function prepareLotTransitionData(options = {}) {
			const { old = null, panelId = "", fromLotId = "", toLotId = "", startDate = "", status = "", finalChanged = false, today = "", approvedBy = "", approvedAt = "" } = options;
			return {
				panelId,
				fromLotId,
				toLotId,
				startDate: startDate || today,
				status,
				criteria: old?.criteria || "",
				conclusion: old?.conclusion || "",
				approvedBy: finalChanged ? approvedBy : old?.approvedBy || "",
				approvedAt: finalChanged ? approvedAt : old?.approvedAt || "",
				note: old?.note || ""
			};
		}
		function inspectAcceptedLotTransition(state, transition = {}) {
			const from = (state.qcLots || []).find((lot) => lot.id === transition.fromLotId);
			const to = (state.qcLots || []).find((lot) => lot.id === transition.toLotId);
			const panel = (state.qcPanels || []).find((item) => item.id === transition.panelId);
			if (!transition.fromLotId || !transition.toLotId || transition.status !== "accepted" || !from || !to || !panel || +from.level !== +to.level) return {
				from,
				to,
				panel,
				rows: [],
				missing: [],
				valid: false
			};
			const rows = (panel.testIds || []).map((id) => (state.tests || []).find((test) => test.id === id)).filter(Boolean).map((test) => ({
				test,
				config: (test.levels || []).find((level) => level.qcLotId === from.id)
			})).filter((row) => row.config).map((row) => ({
				...row,
				nextHistory: (row.config.meanSdHistory || []).slice().reverse().find((entry) => (entry.qcLotId === to.id || !entry.qcLotId && (entry.lot || "") === to.lotNo) && Number.isFinite(+entry.mean) && Number.isFinite(+entry.sd) && +entry.sd > 0)
			}));
			return {
				from,
				to,
				panel,
				rows,
				missing: rows.filter((row) => !row.nextHistory),
				valid: true
			};
		}
		function transitionSwitchesLot(transition = {}) {
			return !!(transition.fromLotId && transition.toLotId && transition.status === "accepted");
		}
		function syncLotDepletion(state) {
			const retired = new Set((state.lotTransitions || []).filter(transitionSwitchesLot).map((transition) => transition.fromLotId));
			(state.qcLots || []).forEach((lot) => {
				lot.depleted = retired.has(lot.id);
			});
			return retired;
		}
		function normalizeLotGroups(state, onMergeGroup = () => {}) {
			const seen = /* @__PURE__ */ new Map(), drop = /* @__PURE__ */ new Set();
			state.lotGroups = state.lotGroups || [];
			state.lotGroups.forEach((group) => {
				group.lotIds = [...new Set(group.lotIds || [])].filter((id) => (state.qcLots || []).some((lot) => lot.id === id));
				if (!group.lotIds.length) return;
				const name = group.lotIds.map((id) => (state.qcLots || []).find((lot) => lot.id === id)?.lotNo).filter(Boolean).join("/");
				if (name && group.active !== false && !group.name) group.name = name;
				const key = (group.active === false ? "stopped" : "active") + "|" + [...group.lotIds].sort().join("|");
				const keptGroupId = seen.get(key);
				if (keptGroupId) {
					onMergeGroup(group, keptGroupId);
					drop.add(group.id);
				} else seen.set(key, group.id);
			});
			if (drop.size) state.lotGroups = state.lotGroups.filter((group) => !drop.has(group.id));
			return drop;
		}
		function applyAcceptedLotTransition(options) {
			const { state, transition, uid, today, normalizeLotGroups, upsertHistory, onMergeGroup = () => {} } = options;
			const check = inspectAcceptedLotTransition(state, transition), { rows, missing } = check;
			const from = check.from, to = check.to;
			if (!check.valid || !from || !to || !rows.length || missing.length) return 0;
			state.lotGroups = state.lotGroups || [];
			const groupKey = (ids) => [...new Set(ids || [])].filter((id) => (state.qcLots || []).some((lot) => lot.id === id)).sort().join("|");
			const groupName = (ids) => (ids || []).map((id) => (state.qcLots || []).find((lot) => lot.id === id)?.lotNo).filter(Boolean).join("/");
			const removeGroups = /* @__PURE__ */ new Set();
			state.lotGroups.forEach((group) => {
				if (group.active === false || !(group.lotIds || []).includes(from.id)) return;
				const oldIds = [...new Set(group.lotIds || [])], nextIds = [...new Set((group.lotIds || []).map((id) => id === from.id ? to.id : id))];
				const oldKey = groupKey(oldIds), autoNamed = !group.name || group.name === groupName(oldIds);
				if (!(state.lotGroups.find((item) => item.id !== group.id && item.active === false && item.stoppedByTransitionId === transition.id) || state.lotGroups.find((item) => item.active === false && groupKey(item.lotIds) === oldKey))) state.lotGroups.push({
					id: uid(),
					name: group.name || groupName(oldIds),
					lotIds: oldIds,
					note: `Đã dừng khi chuyển tiếp lô ${from.lotNo} sang ${to.lotNo}`,
					active: false,
					status: "stopped",
					stoppedAt: transition.startDate || today(),
					stoppedByTransitionId: transition.id
				});
				const nextKey = groupKey(nextIds), existing = state.lotGroups.find((item) => item.id !== group.id && item.active !== false && groupKey(item.lotIds) === nextKey);
				if (existing) {
					removeGroups.add(group.id);
					onMergeGroup(group, existing);
				} else {
					group.lotIds = nextIds;
					if (autoNamed) group.name = groupName(nextIds) || group.name;
				}
			});
			if (removeGroups.size) state.lotGroups = state.lotGroups.filter((group) => !removeGroups.has(group.id));
			normalizeLotGroups();
			(state.qcLots || []).forEach((lot) => {
				const group = (state.lotGroups || []).find((item) => (item.lotIds || []).includes(lot.id));
				lot.groupId = group ? group.id : "";
			});
			let count = 0;
			rows.forEach((row) => {
				const { config, nextHistory } = row;
				if (Number.isFinite(+config.mean) && Number.isFinite(+config.sd) && +config.sd > 0) upsertHistory(config, from, {
					mean: +config.mean,
					sd: +config.sd,
					low: config.low == null ? null : +config.low,
					high: config.high == null ? null : +config.high,
					effectiveFrom: (config.meanSdHistory || []).find((entry) => entry.qcLotId === from.id)?.effectiveFrom || "",
					effectiveTo: transition.startDate || from.exp || "",
					source: config.applied || "mfg",
					planned: false,
					note: "Trước chuyển tiếp lô"
				});
				const next = upsertHistory(config, to, {
					mean: +nextHistory.mean,
					sd: +nextHistory.sd,
					low: nextHistory.low == null ? null : +nextHistory.low,
					high: nextHistory.high == null ? null : +nextHistory.high,
					effectiveFrom: transition.startDate || today(),
					effectiveTo: to.exp || "",
					source: nextHistory.source || "mfg",
					planned: false,
					note: nextHistory.note || `Chuyển tiếp từ lô ${from.lotNo}`
				});
				Object.assign(config, {
					level: to.level,
					qcLotId: to.id,
					lot: to.lotNo,
					exp: to.exp,
					mean: +next.mean,
					sd: +next.sd,
					low: next.low == null ? null : +next.low,
					high: next.high == null ? null : +next.high,
					rangeK: 2,
					mfgMean: +next.mean,
					mfgSd: +next.sd,
					applied: next.source || "mfg"
				});
				count++;
			});
			return count;
		}
		function lotTransitionRemoval(state, { id = "", switchesLot = () => false } = {}) {
			const record = (state.lotTransitions || []).find((transition) => transition.id === id);
			if (!record) return { error: "not-found" };
			if (switchesLot(record)) return {
				error: "accepted-applied",
				record,
				message: "Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không nên xóa trực tiếp. Nếu nhập sai, hãy tạo hồ sơ chuyển tiếp mới hoặc chỉnh nhóm lô/Mean-SD thủ công."
			};
			return { record };
		}
		function removeLotTransition(state, options = {}) {
			const checked = lotTransitionRemoval(state, options);
			if (checked.error) return checked;
			state.lotTransitions = (state.lotTransitions || []).filter((transition) => transition.id !== options.id);
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
		function lotGroupActivationCandidates(tests, lots, targetSnapshot) {
			const candidates = [];
			(tests || []).forEach((test) => {
				(lots || []).forEach((lot) => {
					const target = (test.levels || []).find((level) => +level.level === +lot.level);
					if (!target || target.qcLotId === lot.id) return;
					const snapshot = targetSnapshot(test, lot.level, lot.id, lot.lotNo);
					if (!snapshot || !Number.isFinite(+snapshot.mean) || !Number.isFinite(+snapshot.sd) || +snapshot.sd <= 0) return;
					candidates.push({
						t: test,
						lot,
						pick: {
							use: true,
							mean: snapshot.mean,
							low: snapshot.low,
							high: snapshot.high,
							sd: snapshot.sd
						}
					});
				});
			});
			return candidates;
		}
		function activationReplacedGroupId(test, lot, targetGroupId, groupsForLot) {
			const target = (test.levels || []).find((level) => +level.level === +lot.level);
			if (!target?.qcLotId) return "";
			const group = groupsForLot(target.qcLotId)[0];
			return group && group.id !== targetGroupId ? group.id : "";
		}
		function applyLotGroupActivation(options) {
			const stoppedGroupIds = /* @__PURE__ */ new Set();
			let count = 0;
			(options.candidates || []).forEach(({ t, lot, pick }) => {
				const oldGroupId = activationReplacedGroupId(t, lot, options.group.id, options.groupsForLot);
				if (oldGroupId) stoppedGroupIds.add(oldGroupId);
				if (options.applyTarget(t, lot, pick, options.effectiveFrom, options.note)) count++;
			});
			if (!count) {
				if (options.groupInUse(options.group)) {
					delete options.group.status;
					delete options.group.stoppedAt;
					return {
						status: "already-active",
						count: 0,
						stoppedGroupIds: []
					};
				}
				return {
					status: "unready",
					count: 0,
					stoppedGroupIds: []
				};
			}
			stoppedGroupIds.forEach((id) => {
				const group = (options.groups || []).find((item) => item.id === id);
				if (group) {
					group.status = "stopped";
					group.stoppedAt = options.effectiveFrom;
				}
			});
			delete options.group.status;
			delete options.group.stoppedAt;
			return {
				status: "applied",
				count,
				stoppedGroupIds: [...stoppedGroupIds]
			};
		}
		function validateLot(state, { id = "", data = {} } = {}) {
			const lots = state.qcLots || [], record = lots.find((lot) => lot.id === id) || null, level = Number(data.level) || 1;
			if (!clean(data.lotNo)) return {
				error: "missing-lot-no",
				message: "Nhập số lot."
			};
			if (record && +record.level !== level && (state.tests || []).some((test) => (test.levels || []).some((item) => item.qcLotId === id))) return {
				error: "level-in-use",
				message: "Lô QC đang gắn với xét nghiệm nên không thể đổi mức QC. Hãy bỏ gán lô trong Mean/SD trước."
			};
			if (lots.some((lot) => lot.id !== id && +lot.level === level && sameText(lot.lotNo, data.lotNo))) return {
				error: "duplicate-lot",
				message: "Số lô QC này đã tồn tại ở cùng mức QC."
			};
			return {
				record,
				level
			};
		}
		function saveLot(state, { id = "", newId = "", data = {}, renamePoints = () => 0 } = {}) {
			const checked = validateLot(state, {
				id,
				data
			});
			if (checked.error) return checked;
			const old = checked.record, oldLotNo = old?.lotNo || "", oldLevel = old ? +old.level : checked.level;
			const record = old || { id: cleanId(newId) };
			if (!old && !record.id) return {
				error: "missing-id",
				message: "Không thể tạo mã lô QC."
			};
			Object.assign(record, data);
			if (!old) {
				state.qcLots = state.qcLots || [];
				state.qcLots.push(record);
			}
			(state.tests || []).forEach((test) => (test.levels || []).filter((level) => level.qcLotId === record.id).forEach((level) => {
				level.level = data.level;
				level.lot = data.lotNo;
				level.exp = data.exp;
				(level.meanSdHistory || []).filter((entry) => entry.qcLotId === record.id).forEach((entry) => {
					entry.lot = data.lotNo;
				});
			}));
			const renamedPoints = old ? renamePoints(oldLevel, oldLotNo, data.lotNo) : 0;
			return {
				record,
				created: !old,
				oldLotNo,
				oldLevel,
				renamedPoints
			};
		}
		function lotPointsToRename(state, oldLevel, oldLotNo) {
			if (!oldLotNo) return [];
			const rows = [];
			Object.keys(state.data || {}).forEach((testId) => {
				(state.data[testId] || []).forEach((point) => {
					if (+point.level === +oldLevel && (point.lot || "") === oldLotNo) rows.push(point);
				});
			});
			return rows;
		}
		function renameLotPoints(state, oldLevel, oldLotNo, newLotNo) {
			if (!oldLotNo || oldLotNo === newLotNo) return 0;
			const rows = lotPointsToRename(state, oldLevel, oldLotNo);
			rows.forEach((point) => {
				point.lot = newLotNo;
			});
			return rows.length;
		}
		function lotRemoval(state, { id = "", switchesLot } = {}) {
			const record = (state.qcLots || []).find((lot) => lot.id === id);
			if (!record) return { error: "not-found" };
			if ((state.tests || []).some((test) => (test.levels || []).some((level) => level.qcLotId === id))) return {
				error: "used-by-assay",
				message: "Lô QC này đang được gắn với xét nghiệm. Hãy đổi lô trong xét nghiệm trước."
			};
			if ((state.lotTransitions || []).some((transition) => (transition.fromLotId === id || transition.toLotId === id) && switchesLot(transition))) return {
				error: "used-by-accepted-transition",
				message: "Lô QC này có hồ sơ chuyển tiếp đã CHẤP NHẬN (đã áp dụng vào cấu hình/Mean-SD). Không thể xóa lô trực tiếp — nếu thực sự cần, hãy xử lý hồ sơ chuyển tiếp đó trước."
			};
			return { record };
		}
		function removeLot(state, options = {}) {
			const checked = lotRemoval(state, options);
			if (checked.error) return checked;
			const id = options.id;
			state.qcLots = (state.qcLots || []).filter((lot) => lot.id !== id);
			(state.lotGroups || []).forEach((group) => {
				group.lotIds = (group.lotIds || []).filter((lotId) => lotId !== id);
			});
			state.lotTransitions = (state.lotTransitions || []).filter((transition) => transition.fromLotId !== id && transition.toLotId !== id);
			return { record: checked.record };
		}
		function targetPickBackfillPoints(points, test, lot, pick) {
			if (!pick?.use) return [];
			const target = (test.levels || []).find((level) => level.qcLotId === lot.id) || (test.levels || []).find((level) => +level.level === +lot.level);
			if (!target || !target.lot || target.lot === lot.lotNo) return [];
			return (points || []).filter((point) => point.level === target.level && (point.lot == null || point.lot === target.lot));
		}
		function normalizeTargetPick(input = {}) {
			const meanRaw = String(input.meanRaw || "").trim(), lowRaw = String(input.lowRaw || "").trim(), highRaw = String(input.highRaw || "").trim(), sdRaw = String(input.sdRaw || "").trim();
			let mean = meanRaw === "" ? null : parseFloat(meanRaw), low = lowRaw === "" ? null : parseFloat(lowRaw), high = highRaw === "" ? null : parseFloat(highRaw), sd = sdRaw === "" ? null : parseFloat(sdRaw);
			const fromLimits = targetFromLimits(low, high);
			if (fromLimits) {
				if (!Number.isFinite(mean)) mean = fromLimits.mean;
				if (!Number.isFinite(sd) || sd <= 0) sd = fromLimits.sd;
			}
			const fromTarget = input.deriveLimits === false ? null : limitsFromTarget(mean, sd);
			if (fromTarget && lowRaw === "" && highRaw === "") {
				low = fromTarget.low;
				high = fromTarget.high;
			}
			if (!Number.isFinite(mean)) return {
				error: "invalid-mean",
				message: "Các xét nghiệm được chọn phải có trung bình mục tiêu hợp lệ."
			};
			if (lowRaw !== "" && !Number.isFinite(low) || highRaw !== "" && !Number.isFinite(high)) return {
				error: "invalid-limits",
				message: "Giới hạn dưới/trên phải là số hợp lệ."
			};
			if ((lowRaw !== "" || highRaw !== "") && (!Number.isFinite(low) || !Number.isFinite(high) || high <= low)) return {
				error: "invalid-range",
				message: "Nếu nhập giới hạn, cần nhập đủ giới hạn dưới và trên; giới hạn trên phải lớn hơn giới hạn dưới."
			};
			if (sdRaw !== "" && (!Number.isFinite(sd) || sd <= 0)) return {
				error: "invalid-sd",
				message: "Độ lệch chuẩn phải là số lớn hơn 0."
			};
			if ((sd == null || !Number.isFinite(sd)) && Number.isFinite(low) && Number.isFinite(high)) sd = (high - low) / 4;
			if (!Number.isFinite(sd) || sd <= 0) return {
				error: "missing-sd",
				message: "Các xét nghiệm được chọn cần có SD, hoặc có đủ giới hạn dưới/trên để app ước tính SD theo ±2SD."
			};
			return {
				use: true,
				mean,
				low,
				high,
				sd
			};
		}
		function applyTargetPick(options) {
			const { test, lot, pick, effectiveFrom, note, lots, points, upsertHistory } = options;
			const linked = (test.levels || []).find((level) => level.qcLotId === lot.id);
			if (!pick.use) {
				if (linked) {
					linked.qcLotId = "";
					linked.lot = "";
					linked.exp = "";
					return true;
				}
				return false;
			}
			const effectiveTo = lot.exp || "";
			let target = linked || (test.levels || []).find((level) => +level.level === +lot.level);
			if (!target) {
				target = {
					level: lot.level,
					mean: pick.mean,
					sd: pick.sd,
					low: pick.low,
					high: pick.high,
					rangeK: 2,
					mfgMean: pick.mean,
					mfgSd: pick.sd,
					applied: "mfg"
				};
				test.levels = test.levels || [];
				test.levels.push(target);
				test.levels.sort((first, second) => first.level - second.level);
			}
			target.meanSdHistory = Array.isArray(target.meanSdHistory) ? target.meanSdHistory : [];
			if (target.qcLotId && target.qcLotId !== lot.id) {
				const oldLot = (lots || []).find((item) => item.id === target.qcLotId) || {
					id: target.qcLotId,
					lotNo: target.lot || ""
				};
				if (Number.isFinite(+target.mean) && Number.isFinite(+target.sd) && +target.sd > 0) upsertHistory(target, oldLot, {
					mean: +target.mean,
					sd: +target.sd,
					low: target.low == null ? null : +target.low,
					high: target.high == null ? null : +target.high,
					effectiveFrom: (target.meanSdHistory || []).find((entry) => entry.qcLotId === oldLot.id)?.effectiveFrom || "",
					effectiveTo: effectiveFrom,
					source: target.applied || "mfg",
					planned: false,
					note: "Trước khi đổi sang lô khác qua Mean/SD theo nhóm"
				});
			}
			targetPickBackfillPoints(points, test, lot, pick).forEach((point) => {
				point.lot = target.lot;
				point.qcMean = point.qcMean == null ? target.mean : point.qcMean;
				point.qcSd = point.qcSd == null ? target.sd : point.qcSd;
			});
			upsertHistory(target, lot, {
				mean: pick.mean,
				sd: pick.sd,
				low: pick.low,
				high: pick.high,
				effectiveFrom,
				effectiveTo,
				source: "mfg",
				planned: false,
				note
			});
			Object.assign(target, {
				level: lot.level,
				qcLotId: lot.id,
				lot: lot.lotNo,
				exp: lot.exp,
				mean: pick.mean,
				sd: pick.sd,
				low: pick.low,
				high: pick.high,
				rangeK: 2,
				mfgMean: pick.mean,
				mfgSd: pick.sd,
				applied: "mfg"
			});
			return true;
		}
		function applyPlannedTarget(options) {
			const { test, lot, pick, note, upsertHistory } = options;
			if (!pick.use) return false;
			const target = (test.levels || []).find((level) => +level.level === +lot.level);
			if (!target) return false;
			target.meanSdHistory = Array.isArray(target.meanSdHistory) ? target.meanSdHistory : [];
			upsertHistory(target, lot, {
				mean: pick.mean,
				sd: pick.sd,
				low: pick.low,
				high: pick.high,
				effectiveFrom: "",
				effectiveTo: "",
				source: "mfg",
				planned: true,
				note
			});
			return true;
		}
		function applyTargetMatrix(options) {
			const overwriteKeys = new Set((options.overwrites || []).map((item) => item.testId + "|" + item.lot.level));
			const stoppedGroupIds = /* @__PURE__ */ new Set();
			let count = 0;
			(options.picked || []).forEach((pick) => {
				const test = (options.tests || []).find((item) => item.id === pick.testId);
				if (!test) return;
				const overwrite = overwriteKeys.has(pick.testId + "|" + pick.lot.level);
				if (overwrite && options.mode === "planned") {
					if (applyPlannedTarget({
						test,
						lot: pick.lot,
						pick,
						note: options.note + " (dự kiến)",
						upsertHistory: options.upsertHistory
					})) count++;
					return;
				}
				if (overwrite && options.mode === "switch") {
					const current = (test.levels || []).find((level) => +level.level === +pick.lot.level);
					const oldGroup = current?.qcLotId ? options.groupsForLot(current.qcLotId)[0] : null;
					if (oldGroup && oldGroup.id !== options.group.id) stoppedGroupIds.add(oldGroup.id);
				}
				if (applyTargetPick({
					test,
					lot: pick.lot,
					pick,
					effectiveFrom: options.effectiveFrom,
					note: options.note,
					lots: options.lots,
					points: options.pointsForTest(test),
					upsertHistory: options.upsertHistory
				})) count++;
			});
			if (options.mode === "switch" && count) {
				stoppedGroupIds.forEach((id) => {
					const group = (options.groups || []).find((item) => item.id === id);
					if (group) {
						group.status = "stopped";
						group.stoppedAt = options.effectiveFrom;
					}
				});
				delete options.group.status;
				delete options.group.stoppedAt;
			} else if (options.mode === "planned" && overwriteKeys.size && count) options.group.status = "planned";
			return {
				count,
				stoppedGroupIds: [...stoppedGroupIds]
			};
		}
		return Object.freeze({
			defaultAssayLevels,
			prepareInstrument,
			validateInstrument,
			saveInstrument,
			instrumentRemoval,
			removeInstrument,
			preparePanel,
			validatePanel,
			savePanel,
			panelRemoval,
			removePanel,
			prepareLotGroup,
			validateLotGroup,
			saveLotGroup,
			lotGroupRemoval,
			removeLotGroup,
			stopLotGroup,
			validateLotTransition,
			saveLotTransition,
			prepareLotTransitionData,
			inspectAcceptedLotTransition,
			transitionSwitchesLot,
			syncLotDepletion,
			normalizeLotGroups,
			applyAcceptedLotTransition,
			lotTransitionRemoval,
			removeLotTransition,
			validateAssay,
			saveAssay,
			assayRemoval,
			removeAssay,
			lotGroupActivationCandidates,
			activationReplacedGroupId,
			applyLotGroupActivation,
			validateLot,
			saveLot,
			lotPointsToRename,
			renameLotPoints,
			lotRemoval,
			removeLot,
			targetPickBackfillPoints,
			normalizeTargetPick,
			applyTargetPick,
			applyPlannedTarget,
			applyTargetMatrix
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
	//#region src/domain/sigma/sigma-presentation.ts
	function sigmaZone(value) {
		const sigma = Number(value);
		if (sigma >= 6) return {
			c: "#13603f",
			label: "Đẳng cấp thế giới"
		};
		if (sigma >= 5) return {
			c: "#2c7d5c",
			label: "Xuất sắc"
		};
		if (sigma >= 4) return {
			c: "#3f9a55",
			label: "Tốt"
		};
		if (sigma >= 3) return {
			c: "#dd8b1f",
			label: "Cận biên"
		};
		return {
			c: "#c0362c",
			label: "Không đạt"
		};
	}
	function sigmaRunPlan(value) {
		const sigma = Number(value);
		if (!Number.isFinite(sigma)) return null;
		if (sigma >= 6) return {
			risk: "Thấp",
			plan: "Thiết kế QC theo đánh giá nguy cơ; không tự động giảm tần suất."
		};
		if (sigma >= 5) return {
			risk: "Thấp–trung bình",
			plan: "Xác nhận bằng dữ liệu ổn định và SOP trước khi đơn giản hóa QC."
		};
		if (sigma >= 4) return {
			risk: "Trung bình",
			plan: "Cân nhắc đa quy tắc và tăng giám sát theo nguy cơ."
		};
		if (sigma >= 3) return {
			risk: "Cao",
			plan: "Tăng cường QC và ưu tiên cải thiện phương pháp."
		};
		return {
			risk: "Rất cao",
			plan: "Không dùng Sigma để hợp thức hóa vận hành; cần khắc phục phương pháp."
		};
	}
	function formatSigmaDpmo(value) {
		const dpmo = Number(value);
		return !Number.isFinite(dpmo) ? "—" : dpmo < 10 ? dpmo.toFixed(2) : dpmo < 1e3 ? dpmo.toFixed(0) : Math.round(dpmo).toLocaleString("en-US");
	}
	function sigmaReadiness(level) {
		if (!level || !["iqc-period", "iqc-cohort"].includes(level.cvSource)) return {
			status: "manual",
			label: "CV nhập tay — chưa xác nhận bằng nhóm dữ liệu IQC cùng lô/mức",
			classifiable: true,
			qcpEligible: false
		};
		const status = [
			"insufficient",
			"provisional",
			"eligible",
			"unstable"
		].includes(level.cohortStatus) ? level.cohortStatus : Number(level.n) < 20 ? "insufficient" : Number(level.n) < 30 ? "provisional" : "eligible";
		if (status === "insufficient") return {
			status,
			label: "Chưa đủ 20 điểm QC",
			classifiable: false,
			qcpEligible: false
		};
		if (status === "unstable") return {
			status,
			label: "Nhóm dữ liệu IQC không ổn định",
			classifiable: false,
			qcpEligible: false
		};
		if (status === "provisional") return {
			status,
			label: "Kết quả tạm thời (20–29 điểm)",
			classifiable: true,
			qcpEligible: false
		};
		return {
			status: "eligible",
			label: "Đủ điều kiện dữ liệu",
			classifiable: true,
			qcpEligible: true
		};
	}
	var sigmaPresentation = Object.freeze({
		sigmaZone,
		sigmaRunPlan,
		formatSigmaDpmo,
		sigmaReadiness
	});
	//#endregion
	//#region src/domain/sigma/sigma-period-view-model.ts
	function createSigmaPeriodViewModel(deps) {
		const comp = (test, entry, level, refs) => {
			const data = entry.lv && entry.lv[level] || {}, cv = Number.parseFloat(data.cv), bias = Number.parseFloat(data.biasEqa ?? data.bias);
			const tea = deps.teaFor(test, entry, level, refs), metric = deps.sigmaMetric(tea, bias, cv);
			if (!metric) return null;
			const { sigma, dpmo } = metric, ready = deps.readiness(data), zone = ready.classifiable ? deps.zone(sigma) : {
				c: "#6b756f",
				label: ready.label
			}, warnings = [];
			const source = entry.teaSource || deps.teaSource(test), meta = deps.teaMeta(test, source);
			if (Math.abs(bias) >= tea) warnings.push("|Bias| đã bằng hoặc vượt TEa");
			if (ready.status !== "eligible") warnings.push(ready.label);
			return {
				cv,
				bias,
				biasMethod: data.biasEqaMethod || "manual",
				biasLabel: data.biasEqaMethod === "rms" ? "Bias EQA/EQC (RMS)" : "Bias EQA/EQC",
				tea,
				teaTarget: Number.isFinite(Number(data.teaTarget)) ? Number(data.teaTarget) : null,
				teaCriterionRule: data.teaCriterionRule || "",
				teaCriterionPercent: Number.isFinite(Number(data.teaCriterionPercent)) ? Number(data.teaCriterionPercent) : null,
				teaCriterionAbsolute: Number.isFinite(Number(data.teaCriterionAbsolute)) ? Number(data.teaCriterionAbsolute) : null,
				teaCriterionUnit: data.teaCriterionUnit || "",
				teaSource: source,
				teaLabel: entry.teaLabel || deps.teaLabel(deps.teaSource(test)),
				teaReference: entry.teaReference || deps.teaReference(test),
				teaSourceId: entry.teaSourceId || meta.id || "",
				teaSourceVersion: entry.teaSourceVersion || meta.version || "",
				teaSourceUrl: entry.teaSourceUrl || meta.url || "",
				teaEffectiveDate: entry.teaEffectiveDate || meta.effectiveDate || "",
				teaReviewedDate: entry.teaReviewedDate || meta.reviewedDate || "",
				teaReviewedBy: entry.teaReviewedBy || meta.reviewedBy || "",
				cvSource: data.cvSource || "manual",
				n: Number.isFinite(Number(data.n)) ? Number(data.n) : null,
				sourceStart: data.sourceStart || "",
				sourceEnd: data.sourceEnd || "",
				sourceLot: data.sourceLot || "",
				cohortStatus: ready.status,
				classifiable: ready.classifiable,
				qcpEligible: ready.qcpEligible,
				readinessLabel: ready.label,
				warning: warnings.join(" · ") || null,
				mu: deps.muFor(test, entry, level, tea, refs),
				muBiasMode: data.muBiasMode === "exclude" ? "exclude" : "include",
				uCalBasis: data.uCalBasis || "",
				muReviewedBy: data.muReviewedBy || "",
				muReviewedDate: data.muReviewedDate || "",
				sigma,
				dpmo,
				yld: metric.yieldPercent,
				dse: sigma - 1.65,
				run: ready.qcpEligible ? deps.runPlan(sigma) : null,
				...zone
			};
		};
		const rows = (test, data, levels, refs) => (data || []).map((entry) => ({
			e: entry,
			rs: levels.map((level) => comp(test, entry, level, refs))
		})).sort((a, b) => String(a.e.period || "").localeCompare(String(b.e.period || "")));
		return Object.freeze({
			comp,
			rows
		});
	}
	//#endregion
	//#region src/domain/sigma/sigma-bias-service.ts
	function createSigmaBiasService(deps) {
		const stats = (rounds) => {
			const valid = (rounds || []).map((round) => {
				const lab = Number.parseFloat(String(round.lab ?? "")), target = Number.parseFloat(String(round.target ?? ""));
				return Number.isFinite(lab) && Number.isFinite(target) && target !== 0 ? {
					lab,
					target,
					bias: (lab - target) / Math.abs(target) * 100
				} : null;
			}).filter((round) => !!round);
			if (!valid.length) return {
				valid,
				signedMean: null,
				rms: null
			};
			return {
				valid,
				signedMean: valid.reduce((sum, round) => sum + round.bias, 0) / valid.length,
				rms: valid.length === 1 ? valid[0].bias : Math.sqrt(valid.reduce((sum, round) => sum + round.bias * round.bias, 0) / valid.length)
			};
		};
		const referenceUncertainty = (rounds) => {
			const biases = stats(rounds).valid.map((round) => round.bias);
			if (biases.length < 2) return null;
			const sd = deps.stats(biases).sd;
			return Number.isFinite(sd) ? Number(sd) / Math.sqrt(biases.length) : null;
		};
		const applyToPeriods = (periods, periodIds, level, bias, rounds, batchId) => {
			let applied = 0;
			(periods || []).forEach((period) => {
				if (!(periodIds || []).includes(period.id)) return;
				period.lv = period.lv || {};
				const data = period.lv[level] = period.lv[level] || {};
				data.biasEqa = Number(bias);
				data.biasEqaMethod = "rms";
				data.eqaRounds = (rounds || []).map((round) => ({
					lab: round.lab,
					target: round.target
				}));
				data.eqaBatchId = batchId;
				applied++;
			});
			return applied;
		};
		const roundsKey = (rounds) => JSON.stringify((rounds || []).map((round) => ({
			lab: Number(round.lab),
			target: Number(round.target)
		})).filter((round) => Number.isFinite(round.lab) && Number.isFinite(round.target) && round.target !== 0));
		const linkedPeriodIds = (periods, entryId, level) => {
			const data = (periods || []).find((period) => period.id === entryId)?.lv?.[level];
			if (!data) return [entryId];
			if (data.eqaBatchId) return (periods || []).filter((period) => period.lv?.[level]?.eqaBatchId === data.eqaBatchId).map((period) => period.id);
			const key = data.biasEqaMethod === "rms" ? roundsKey(data.eqaRounds) : "";
			if (!key || key === "[]") return [entryId];
			const linked = (periods || []).filter((period) => {
				const item = period.lv?.[level];
				return item && item.biasEqaMethod === "rms" && roundsKey(item.eqaRounds) === key && Number(item.biasEqa) === Number(data.biasEqa);
			}).map((period) => period.id);
			return linked.length ? linked : [entryId];
		};
		return Object.freeze({
			stats,
			referenceUncertainty,
			applyToPeriods,
			roundsKey,
			linkedPeriodIds
		});
	}
	//#endregion
	//#region src/application/sigma/sigma-cohort-import-service.ts
	function createSigmaCohortImportService(deps) {
		const clearImportedCv = (level) => {
			if (!level || !["iqc-period", "iqc-cohort"].includes(level.cvSource)) return false;
			[
				"cv",
				"cvSource",
				"n",
				"sourceStart",
				"sourceEnd",
				"sourceLot",
				"cohortStatus",
				"cohortIssues",
				"sourceExcludedVoided",
				"sourceExcludedInvalid",
				"sourceTargetMean",
				"sourceTargetSd"
			].forEach((key) => delete level[key]);
			return true;
		};
		const importCohort = (test, entry, level, cohort) => {
			entry.lv = entry.lv || {};
			const existing = entry.lv[level] || {}, force = deps.isCurrentPeriod(entry.period);
			if (!(cohort && cohort.stats?.n >= 2 && cohort.stats.cv > 0)) {
				const cleared = clearImportedCv(existing);
				if (cleared) deps.setTeaSnapshot(test, entry, level, force);
				return {
					imported: false,
					cleared
				};
			}
			const data = entry.lv[level] = existing, assessment = deps.assess(cohort);
			[
				"sourceTargetMean",
				"sourceTargetSd",
				"cohortIssues",
				"sourceExcludedVoided",
				"sourceExcludedInvalid"
			].forEach((key) => delete data[key]);
			Object.assign(data, {
				cv: cohort.stats.cv,
				cvSource: "iqc-cohort",
				n: cohort.stats.n,
				sourceStart: cohort.start,
				sourceEnd: cohort.end,
				sourceLot: cohort.lot,
				cohortStatus: assessment.status,
				cohortIssues: cohort.issues,
				sourceExcludedVoided: cohort.excluded.voided,
				sourceExcludedInvalid: cohort.excluded.invalidValue
			});
			if (cohort.targetMean != null && cohort.targetMean !== 0) data.sourceTargetMean = cohort.targetMean;
			if (cohort.targetSd != null && cohort.targetSd > 0) data.sourceTargetSd = cohort.targetSd;
			deps.setTeaSnapshot(test, entry, level, force);
			return {
				imported: true,
				cleared: false,
				status: assessment.status,
				mixedTarget: cohort.issues.includes("mixed-target-mean") || cohort.issues.includes("mixed-target-sd")
			};
		};
		const applyChoices = (test, entry, groups, choices) => {
			const summary = {
				imported: 0,
				cleared: 0,
				insufficient: 0,
				unstable: 0,
				mixedTargets: 0,
				missingLotN: 0,
				missingLotLevels: 0
			};
			(groups || []).forEach((group) => {
				const cohort = (group.cohorts || []).find((item) => item.lot === choices?.[group.level]);
				const result = importCohort(test, entry, group.level, cohort);
				if (result.imported) {
					summary.imported++;
					if (result.status === "insufficient") summary.insufficient++;
					if (result.status === "unstable") summary.unstable++;
					if (result.mixedTarget) summary.mixedTargets++;
				}
				if (result.cleared) summary.cleared++;
				if (group.missingLotN && !(group.cohorts || []).length) {
					summary.missingLotN += group.missingLotN;
					summary.missingLotLevels++;
				}
			});
			return summary;
		};
		return Object.freeze({
			clearImportedCv,
			importCohort,
			applyChoices
		});
	}
	//#endregion
	//#region src/application/sigma/sigma-period-record-service.ts
	function createSigmaPeriodRecordService() {
		const add = (records, period, id, teaSnapshot) => {
			if (records.some((record) => record.period === period)) return {
				added: false,
				entry: null
			};
			const entry = {
				id,
				period,
				...teaSnapshot,
				lv: {}
			};
			records.push(entry);
			return {
				added: true,
				entry
			};
		};
		const changePeriod = (records, id, period) => {
			const entry = records.find((record) => record.id === id);
			if (!entry) return {
				changed: false,
				duplicate: false
			};
			if (records.some((record) => record.id !== id && record.period === period)) return {
				changed: false,
				duplicate: true
			};
			entry.period = period;
			return {
				changed: true,
				duplicate: false
			};
		};
		const remove = (records, id) => {
			const index = records.findIndex((record) => record.id === id);
			if (index < 0) return false;
			records.splice(index, 1);
			return true;
		};
		return Object.freeze({
			add,
			changePeriod,
			remove
		});
	}
	//#endregion
	//#region src/application/sigma/sigma-level-edit-service.ts
	var COHORT_FIELDS = [
		"n",
		"sourceStart",
		"sourceEnd",
		"sourceLot",
		"cohortStatus",
		"cohortIssues",
		"sourceExcludedVoided",
		"sourceExcludedInvalid",
		"sourceTargetMean",
		"sourceTargetSd"
	];
	function createSigmaLevelEditService(deps) {
		const clean = (field, value) => {
			if (["cv", "biasEqa"].includes(field)) {
				const text = String(value ?? "").trim();
				if (!text) return "";
				const number = Number(text);
				return Number.isFinite(number) ? number : "";
			}
			return deps.cleanText(value, 120);
		};
		const update = (level, field, value) => {
			level[field] = clean(field, value);
			if (field === "biasEqa") {
				if (level.biasEqa === "") delete level.biasEqaMethod;
				else level.biasEqaMethod = "manual";
				delete level.eqaRounds;
				delete level.eqaBatchId;
			}
			if (field === "cv") {
				level.cvSource = "manual";
				COHORT_FIELDS.forEach((key) => delete level[key]);
			}
			return level;
		};
		return Object.freeze({
			clean,
			update
		});
	}
	//#endregion
	//#region src/application/sigma/sigma-tracked-test-service.ts
	function createSigmaTrackedTestService(deps) {
		const select = (tests, id) => tests.find((test) => test.id === id && test.sgTracked) || null;
		const track = (tests, id) => {
			const test = tests.find((item) => item.id === id);
			if (!test) return {
				tracked: false,
				selected: null
			};
			test.sgTracked = true;
			return {
				tracked: true,
				selected: test.id
			};
		};
		const remove = (tests, id, selectedId) => {
			const test = tests.find((item) => item.id === id);
			if (!test) return {
				removed: false,
				selected: selectedId
			};
			test.sgTracked = false;
			return {
				removed: true,
				selected: selectedId === id ? deps.orderedTracked(tests)[0]?.id || null : selectedId
			};
		};
		return Object.freeze({
			select,
			track,
			remove
		});
	}
	//#endregion
	//#region src/application/sigma/sigma-bias-workflow-service.ts
	function createSigmaBiasWorkflowService(deps) {
		const apply = (records, periodIds, level, rounds) => {
			const stats = deps.stats(rounds || []);
			if (!stats.valid.length) return {
				status: "invalid-rounds",
				applied: 0
			};
			if (!(periodIds || []).length) return {
				status: "missing-periods",
				applied: 0
			};
			const validRounds = stats.valid.map((round) => ({
				lab: round.lab,
				target: round.target
			}));
			const applied = deps.apply(records, periodIds, level, stats.rms, validRounds, deps.createId());
			return {
				status: applied ? "applied" : "no-matching-periods",
				applied,
				bias: stats.rms,
				rounds: validRounds
			};
		};
		return Object.freeze({ apply });
	}
	//#endregion
	//#region src/application/sigma/sigma-mu-workflow-service.ts
	function createSigmaMuWorkflowService(deps) {
		const apply = (records, periodIds, rows, reviewedBy, reviewedDate) => {
			if (!(periodIds || []).length) return {
				applied: 0,
				status: "missing-periods"
			};
			const by = deps.cleanText(reviewedBy, 120), date = deps.parseDate(reviewedDate) || "";
			let applied = 0;
			records.forEach((record) => {
				if (!periodIds.includes(record.id)) return;
				record.lv = record.lv || {};
				rows.forEach((row) => {
					const level = record.lv[row.level] = record.lv[row.level] || {}, raw = String(row.uCal ?? "").trim(), value = Number(raw);
					if (raw !== "" && Number.isFinite(value) && value >= 0) level.uCal = value;
					else delete level.uCal;
					const basis = deps.cleanText(row.uCalBasis, 500);
					if (basis) level.uCalBasis = basis;
					else delete level.uCalBasis;
					level.muBiasMode = row.muBiasMode === "exclude" ? "exclude" : "include";
					if (by) level.muReviewedBy = by;
					else delete level.muReviewedBy;
					if (date) level.muReviewedDate = date;
					else delete level.muReviewedDate;
				});
				applied++;
			});
			return {
				applied,
				status: applied ? "applied" : "no-matching-periods"
			};
		};
		return Object.freeze({ apply });
	}
	//#endregion
	//#region src/application/sigma/sigma-cohort-selection-service.ts
	function createSigmaCohortSelectionService(deps) {
		const cutoff = (period) => {
			const normalized = deps.normalizePeriod(period), today = deps.today();
			if (!normalized) return "";
			const [year, month] = normalized.split("-").map(Number), last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
			return last < today ? last : today;
		};
		const groups = (test, entry, levels, data) => {
			const endDate = cutoff(entry.period), periodStart = `${entry.period}-01`;
			return levels.map((level) => {
				const raw = deps.cohortsForLevelByLot(data, {
					testId: test.id,
					level,
					endDate
				}).filter((cohort) => cohort.n > 0 && cohort.end >= periodStart);
				const cohorts = raw.filter((cohort) => cohort.lot), missingLotN = raw.filter((cohort) => !cohort.lot).reduce((sum, cohort) => sum + cohort.n, 0);
				const saved = entry.lv && entry.lv[level] && entry.lv[level].sourceLot, latest = cohorts[cohorts.length - 1], config = (test.levels || []).find((item) => +item.level === +level);
				return {
					level,
					configuredLot: String(saved || latest && latest.lot || config && config.lot || ""),
					cohorts,
					missingLotN
				};
			});
		};
		return Object.freeze({
			cutoff,
			groups
		});
	}
	//#endregion
	//#region src/application/sigma/sigma-tea-edit-service.ts
	function createSigmaTeaEditService(deps) {
		const setValue = (test, value) => {
			const text = String(value ?? "").trim(), number = Number(text);
			test.tea = text && Number.isFinite(number) && number > 0 ? number : 0;
			return test.tea;
		};
		const setSource = (test, value, sourceIds) => {
			test.teaSource = sourceIds.includes(String(value)) ? String(value) : "ricos";
			if (test.teaSource === "eflm") {
				if (!test.eflmAnalyte) test.eflmAnalyte = test.name || "";
				if (!test.eflmAps) test.eflmAps = "desirable";
			}
			return test.teaSource;
		};
		const setMeta = (test, field, value) => {
			if (field === "eflmLookupDate") test[field] = deps.parseDate(value) || "";
			else if (field === "eflmAps") test[field] = [
				"minimum",
				"desirable",
				"optimum"
			].includes(String(value)) ? value : "desirable";
			else if (["eflmAnalyte", "eflmRef"].includes(field)) test[field] = deps.cleanText(value, field === "eflmRef" ? 500 : 160);
			return test;
		};
		return Object.freeze({
			setValue,
			setSource,
			setMeta
		});
	}
	//#endregion
	//#region src/application/sigma/sigma-tea-snapshot-service.ts
	var ENTRY_KEYS = [
		"tea",
		"teaSource",
		"teaLabel",
		"teaReference",
		"teaSourceId",
		"teaSourceVersion",
		"teaSourceUrl",
		"teaEffectiveDate",
		"teaReviewedDate",
		"teaReviewedBy"
	];
	var SNAPSHOT_KEYS = [
		"tea",
		"teaSource",
		"teaLabel",
		"teaReference",
		"teaCapturedAt",
		"teaSourceId",
		"teaSourceVersion",
		"teaSourceUrl",
		"teaEffectiveDate",
		"teaReviewedDate",
		"teaReviewedBy"
	];
	function createSigmaTeaSnapshotService() {
		const syncCurrent = (test, entries, period, snapshot, setLevelSnapshot) => {
			const entry = test && entries.find((item) => item.period === period);
			if (!entry) return null;
			const next = snapshot(test);
			let changed = ENTRY_KEYS.some((key) => String(entry[key] ?? "") !== String(next[key] ?? ""));
			if (changed) {
				SNAPSHOT_KEYS.forEach((key) => delete entry[key]);
				Object.assign(entry, next);
			}
			Object.keys(entry.lv || {}).forEach((level) => {
				const before = JSON.stringify(entry.lv[level]);
				setLevelSnapshot(test, entry, level, true);
				if (before !== JSON.stringify(entry.lv[level])) changed = true;
			});
			return changed ? entry : null;
		};
		const reconcile = (tests, entriesFor, period, snapshot, setLevelSnapshot) => {
			let changed = false;
			tests.forEach((test) => {
				if (syncCurrent(test, entriesFor(test), period, snapshot, setLevelSnapshot)) changed = true;
			});
			return changed;
		};
		return Object.freeze({
			syncCurrent,
			reconcile
		});
	}
	//#endregion
	//#region src/domain/sigma/sigma-level-selection-service.ts
	var sortedLevels = (values) => [...values].sort((left, right) => left - right);
	var addLevel = (values, value) => {
		const level = Number(value);
		if (Number.isFinite(level) && level > 0) values.add(level);
	};
	function createSigmaLevelSelectionService() {
		const historical = (test, points, entries, operational) => {
			const levels = /* @__PURE__ */ new Set();
			if (test) operational(test).forEach((level) => addLevel(levels, level.level));
			(test?.levels || []).forEach((level) => {
				if (level.qcLotId || Number.isFinite(+level.sd) && +level.sd > 0 || (level.meanSdHistory || []).length) addLevel(levels, level.level);
			});
			(points || []).forEach((point) => addLevel(levels, point?.level));
			(entries || []).forEach((entry) => Object.keys(entry?.lv || {}).forEach((level) => addLevel(levels, level)));
			return sortedLevels(levels);
		};
		const period = (test, entry, points, entries, operational, normalizePeriod, cutoff) => {
			const levels = /* @__PURE__ */ new Set(), normalized = normalizePeriod(entry?.period), start = normalized ? `${normalized}-01` : "", end = normalized ? cutoff(normalized) : "";
			Object.keys(entry?.lv || {}).forEach((level) => addLevel(levels, level));
			(points || []).forEach((point) => {
				const date = String(point?.date || "");
				if ((!start || date >= start) && (!end || date <= end)) addLevel(levels, point?.level);
			});
			if (!levels.size) historical(test, points, entries, operational).forEach((level) => levels.add(level));
			return sortedLevels(levels);
		};
		return Object.freeze({
			historical,
			period
		});
	}
	//#endregion
	//#region src/presentation/sigma/sigma-period-selection-service.ts
	function createSigmaPeriodSelectionService() {
		const resolve = (selectedId, entries) => {
			if (selectedId && entries.some((entry) => entry.id === selectedId)) return selectedId;
			return [...entries].sort((left, right) => String(left.period || "").localeCompare(String(right.period || ""))).pop()?.id || "";
		};
		const select = (selectedId, entries, nextId) => {
			if (!entries.some((entry) => entry.id === nextId) || selectedId === nextId) return {
				changed: false,
				selected: selectedId || ""
			};
			return {
				changed: true,
				selected: nextId
			};
		};
		return Object.freeze({
			resolve,
			select
		});
	}
	//#endregion
	//#region src/presentation/manage/lot-transition-picker-service.ts
	function createLotTransitionPickerService({ searchText, formatDate, transitionToNo }) {
		function label(lot) {
			if (!lot) return "";
			const nextLot = lot.depleted ? transitionToNo(lot.id) : "";
			return `${lot.lotNo} · Mức ${lot.level}${lot.exp ? " · HSD " + formatDate(lot.exp) : ""}${lot.depleted ? " · " + (nextLot ? "đã chuyển tiếp qua lô " + nextLot : "đã hết QC") : ""}`;
		}
		function availableLots(lots, selectedId = "") {
			return (lots || []).filter((lot) => !lot.depleted || lot.id === selectedId);
		}
		function match(lots, value, selectedId = "") {
			const query = searchText(value);
			if (!query) return null;
			const choices = availableLots(lots, selectedId);
			const exact = choices.find((lot) => searchText(label(lot)) === query || searchText(lot.lotNo) === query);
			if (exact) return exact;
			const matches = choices.filter((lot) => searchText(label(lot)).includes(query));
			return matches.length === 1 ? matches[0] : null;
		}
		return Object.freeze({
			label,
			availableLots,
			match
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
	//#region src/domain/nce/action-bias-service.ts
	function createActionBiasService({ teaFor, systematicShiftCritical, sigmaBiasValue }) {
		function numberOrNull(value) {
			const raw = String(value == null ? "" : value).trim(), number = Number(raw);
			return raw !== "" && Number.isFinite(number) ? number : null;
		}
		function info(test, level, biasBeforeRaw, biasAfterRaw) {
			const teaValue = test && level ? teaFor(test, level) : null, hasTea = Number.isFinite(teaValue) && teaValue > 0;
			const biasBefore = numberOrNull(biasBeforeRaw), biasAfter = numberOrNull(biasAfterRaw), threshold = hasTea ? teaValue / 4 : null;
			const withinThreshold = threshold != null && biasAfter != null ? Math.abs(biasAfter) <= threshold : null;
			const critical = hasTea && biasBefore != null && level && level.sd > 0 ? systematicShiftCritical(teaValue, biasBefore, level.sd) : null;
			const observedDeviation = critical && level && level.sd > 0 ? Math.abs(biasBefore) / level.sd : null;
			return {
				tea: hasTea ? teaValue : null,
				biasBefore,
				biasAfter,
				threshold,
				withinThreshold,
				crit: critical,
				degObs: observedDeviation
			};
		}
		function latestSigmaBias(test, level, sigmaData) {
			const periods = test && sigmaData && Array.isArray(sigmaData[test.id]) ? sigmaData[test.id] : [];
			if (!periods.length || !level) return null;
			const latest = [...periods].sort((first, second) => String(first.period || "").localeCompare(String(second.period || ""))).pop();
			const entry = latest?.lv?.[level], value = entry ? Number(sigmaBiasValue(entry)) : NaN;
			return entry && Number.isFinite(value) ? {
				value,
				period: latest?.period || ""
			} : null;
		}
		return Object.freeze({
			info,
			latestSigmaBias
		});
	}
	//#endregion
	//#region src/presentation/nce/action-bias-presentation.ts
	function createActionBiasPresentation(formatNumber) {
		function thresholdHtml(info) {
			if (!info.tea) return "Chưa có TEa% cho xét nghiệm này — vào Cấu hình Sigma để bổ sung, hoặc để trống nếu không áp dụng.";
			if (info.biasAfter == null) return `Ngưỡng cho phép: ≤ ${formatNumber(info.threshold)}% (TEa/4). Nhập "Bias sau khắc phục" để so sánh.`;
			return `${info.withinThreshold ? "✔ Đạt" : "✘ Vượt"} ngưỡng: |Bias sau khắc phục| ${formatNumber(Math.abs(info.biasAfter))}% so với ${formatNumber(info.threshold)}%.`;
		}
		function referenceHtml(info) {
			if (!info.crit) return info.tea ? "Nhập \"Bias trước khắc phục\" ở mục 4-6 để tính số tham khảo ΔSEcrit/ΔREcrit (mức độ sai số lúc sự cố xảy ra)." : "Chưa đủ TEa%/SD để tính số tham khảo ΔSEcrit/ΔREcrit.";
			return `Độ lệch quan sát lúc sự cố ${formatNumber(info.degObs)} lần SD so với ΔSEcrit ${formatNumber(info.crit.dSEcrit)} · ΔREcrit ${formatNumber(info.crit.dREcrit)}. <b>Tham khảo — không phải kết luận chính thức của hồ sơ.</b>`;
		}
		return Object.freeze({
			thresholdHtml,
			referenceHtml
		});
	}
	//#endregion
	//#region src/domain/nce/action-violation-service.ts
	function createActionViolationService(deps) {
		const info = (action) => {
			const rule = String(action?.rule || ""), recordedError = String(action?.errorType || ""), verdict = String(action?.qcVerdict || "");
			if (rule === "Hủy điểm QC" || recordedError === "Quản lý dữ liệu QC") {
				const point = action ? deps.pointForAction(action) : null;
				const test = action ? deps.findTest(String(action.testId || "")) : null;
				const pointMean = Number(point?.qcMean), pointSd = Number(point?.qcSd);
				const level = test && (!pointMean || !pointSd) ? deps.levelFor(test, action?.level) : null;
				const mean = pointMean || Number(level?.mean), sd = pointSd || Number(level?.sd);
				const z = point && Number.isFinite(mean) && sd > 0 ? Math.abs((Number(point.val) - mean) / sd) : 0;
				const guessedRule = z > 3 ? "1-3s" : z > 2 ? "1-2s" : "";
				return {
					rule: guessedRule ? `${guessedRule} (suy từ Z)` : "Không xác định (hồ sơ cũ)",
					errorType: deps.errorType(guessedRule ? [guessedRule] : []),
					verdict: verdict || (z > 3 ? "rej" : z > 2 ? "warn" : "invalid"),
					derived: true
				};
			}
			return {
				rule: rule || "—",
				errorType: recordedError || "—",
				verdict,
				derived: false
			};
		};
		const verdictLabel = (action) => {
			const verdict = info(action).verdict;
			return verdict === "rej" ? "Loại bỏ" : verdict === "warn" ? "Cảnh báo" : verdict === "invalid" ? "QC không hợp lệ" : "";
		};
		return Object.freeze({
			info,
			verdictLabel
		});
	}
	//#endregion
	//#region src/presentation/nce/action-list-presentation.ts
	function createActionListPresentation(deps) {
		const levelShort = (test, level, lotSnapshot) => {
			const number = parseInt(String(level), 10);
			if (!Number.isFinite(number) || number <= 0) return "Không gắn mức QC";
			const configured = test ? deps.levelFor(test, number) : null;
			return `M${number} · Lô ${lotSnapshot || configured?.lot || "?"}`;
		};
		const groupIssuesByTestDate = (issues) => {
			const groups = [], byKey = /* @__PURE__ */ new Map();
			issues.forEach((issue) => {
				const key = `${issue.t.id}|${issue.p.date}`;
				let group = byKey.get(key);
				if (!group) {
					group = {
						t: issue.t,
						date: issue.p.date,
						items: [],
						worst: "warn"
					};
					byKey.set(key, group);
					groups.push(group);
				}
				group.items.push(issue);
				if (issue.f.level === "rej") group.worst = "rej";
			});
			return groups;
		};
		return Object.freeze({
			levelShort,
			groupIssuesByTestDate
		});
	}
	//#endregion
	//#region src/presentation/nce/action-evidence-presentation.ts
	function createActionEvidencePresentation(deps) {
		const time = (value, dateOnly = false) => {
			if (!value) return "—";
			return dateOnly ? deps.formatDate(value) : deps.formatDateTime(String(value)) || deps.formatDate(value);
		};
		const timeline = (action, rerunStatus) => {
			const point = deps.pointForAction(action), rerun = rerunStatus?.point, eventDate = deps.eventDate(action);
			const voidText = !point ? "Không áp dụng" : point.voided ? point.voidedAt ? time(point.voidedAt) : "Đã hủy · thiếu thời điểm" : "Chưa hủy";
			const openedText = action.createdAt ? time(action.createdAt) : time(action.date, true);
			return [
				{
					label: "Ngày xảy ra",
					value: time(eventDate, true),
					note: point?.runId ? `Lần ${point.runId}` : ""
				},
				{
					label: "QC chạy lại",
					value: !point ? "Không áp dụng" : rerun ? time(rerun.date, true) : "—",
					note: !point ? "Nguồn ngoài IQC" : rerun?.runId ? `Lần ${rerun.runId}` : "Chưa có điểm phù hợp"
				},
				{
					label: "Hủy điểm",
					value: voidText,
					note: point?.voidedBy ? `Bởi ${point.voidedBy}` : ""
				},
				{
					label: "Mở hồ sơ",
					value: openedText,
					note: action.nceId || "NCE"
				}
			];
		};
		return Object.freeze({
			time,
			timeline
		});
	}
	//#endregion
	//#region src/presentation/nce/action-rerun-evidence-presentation.ts
	function createActionRerunEvidencePresentation(deps) {
		const model = (action, rerunStatus, test) => {
			if (!deps.pointForAction(action) || !rerunStatus?.needed) return null;
			if (!rerunStatus.point) return {
				kind: "pending",
				cls: "warn",
				heading: "Chưa có kết quả phù hợp",
				label: rerunStatus.label || "Đang chờ QC chạy lại được chấp nhận",
				point: null
			};
			const point = rerunStatus.point;
			return {
				kind: "accepted",
				cls: rerunStatus.cls === "warn" ? "warn" : "ok",
				heading: rerunStatus.cls === "warn" ? "QC được chấp nhận kèm cảnh báo" : "QC chạy lại được chấp nhận",
				point,
				context: deps.levelShort(test, point.level, point.lot)
			};
		};
		return Object.freeze({ model });
	}
	//#endregion
	//#region src/presentation/nce/action-status-presentation.ts
	function createActionStatusPresentation(deps) {
		const detailCheck = (status) => ({
			cls: ["abnormal", "checked-abnormal"].includes(status) ? "rej" : ["ok", "checked-ok"].includes(status) ? "ok" : "none",
			label: deps.checkLabels[status] || "Chưa ghi"
		});
		const sideChips = (action, stage, rerun, overdue, effectiveness) => {
			const chips = [];
			if (rerun.needed && stage !== "rerun") chips.push({
				cls: rerun.cls,
				label: rerun.label
			});
			if (overdue.overdue) chips.push({
				cls: "rej",
				label: overdue.label
			});
			if (effectiveness.escalated) chips.push({
				cls: "warn",
				label: `Đã chuyển ${action.followUpNceId}`
			});
			if (action.parentNceId) chips.push({
				cls: "none",
				label: `Nối tiếp ${action.parentNceId}`
			});
			return chips;
		};
		return Object.freeze({
			detailCheck,
			sideChips
		});
	}
	//#endregion
	//#region src/presentation/nce/action-review-presentation.ts
	function createActionReviewPresentation() {
		const buttons = (action, context) => ({
			edit: !context.cancelled && context.approval !== "approved" && context.canWrite,
			escalate: context.canEscalate && context.canWrite,
			approve: context.isAdmin && context.workflowStage === "approval",
			returnForRevision: context.isAdmin && context.workflowStage === "approval",
			reopen: context.isAdmin && context.canReopen,
			cancel: context.isAdmin && !context.cancelled && context.approval !== "approved"
		});
		return Object.freeze({ buttons });
	}
	//#endregion
	//#region src/presentation/nce/action-detail-presentation.ts
	function createActionDetailPresentation(deps) {
		const meta = (action, context) => {
			const modern = Number(action.protocolVersion) >= 2;
			const rows = [{
				label: modern ? action.nceId || "Mã NCE" : "Sự cố",
				value: `${context.testName} · ${context.levelShort}`
			}, {
				label: "Kết luận / luật / loại sai số",
				value: `${context.verdict ? `${context.verdict} · ` : ""}${context.violation.rule} · ${context.violation.errorType}`
			}];
			if (!modern) return rows;
			rows.push({
				label: "Nguồn / giai đoạn",
				value: `${deps.sourceLabels[action.eventSource] || "—"} · ${deps.phaseLabels[action.processPhase] || "—"}`
			}, {
				label: "Nguy cơ",
				value: `${deps.riskLabels[action.riskLevel] || "Chưa đánh giá"} · RPN ${context.riskScore || "—"}`,
				note: String(action.riskBasis || "")
			}, {
				label: "Phụ trách / hạn xử lý",
				value: `${action.by || "—"} · ${context.dueDate}${context.overdueLabel ? ` · ${context.overdueLabel}` : ""}`
			}, {
				label: "Trạng thái",
				value: context.workflowLabel
			});
			return rows;
		};
		return Object.freeze({ meta });
	}
	//#endregion
	//#region src/presentation/nce/action-guide-presentation.ts
	function createActionGuidePresentation() {
		const steps = Object.freeze([
			{
				phase: "Kiểm soát",
				title: "Ghi nhận và kiểm soát tức thời",
				text: "Dừng hoặc giữ kết quả liên quan, mở mã NCE và phân công người phụ trách."
			},
			{
				phase: "Phân tầng",
				title: "Đánh giá nguy cơ",
				text: "Chấm S–O–D, tính RPN và ghi căn cứ phân loại theo SOP của đơn vị."
			},
			{
				phase: "Điều tra",
				title: "Điều tra nguyên nhân",
				text: "Kiểm tra QC, thiết bị, hóa chất/calibrator, hiệu chuẩn và lot-to-lot."
			},
			{
				phase: "Phân tích",
				title: "Xác định nguyên nhân gốc",
				text: "Ghi bằng chứng; không đồng nhất nguyên nhân với thao tác xử lý tức thời."
			},
			{
				phase: "Khắc phục",
				title: "Thực hiện hành động khắc phục",
				text: "Loại bỏ nguyên nhân và giảm khả năng tái diễn."
			},
			{
				phase: "Xác nhận",
				title: "Xác nhận bằng QC",
				text: "Chỉ cho phép hoạt động/trả kết quả trở lại sau khi QC chạy lại được chấp nhận."
			},
			{
				phase: "An toàn người bệnh",
				title: "Đánh giá ảnh hưởng bệnh nhân",
				text: "Khoanh vùng từ lần QC đạt cuối cùng và xử lý kết quả liên quan."
			},
			{
				phase: "Khép vòng",
				title: "Đánh giá hiệu lực và phê duyệt",
				text: "Ghi bằng chứng, đánh giá RPN còn lại và phê duyệt độc lập trước khi khép vòng."
			}
		]);
		return Object.freeze({ steps });
	}
	//#endregion
	//#region src/presentation/report/report-period-presentation.ts
	function createReportPeriodPresentation() {
		const currentYearMonth = (value, fallback) => /^\d{4}-\d{2}$/.test(String(value || "")) ? String(value) : fallback;
		const setPart = (yearMonth, part, value) => {
			const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
			if (!match) return yearMonth;
			const year = part === "year" ? Number(value) : Number(match[1]), month = part === "month" ? Number(value) : Number(match[2]);
			return `${year}-${String(month).padStart(2, "0")}`;
		};
		const sortedLocks = (locks) => [...locks || []].sort((a, b) => String(b.ym || "").localeCompare(String(a.ym || "")));
		return Object.freeze({
			currentYearMonth,
			setPart,
			sortedLocks
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
			need(String(action.correction || "").trim().length < 5, "xử lý tức thời đã thực hiện — ô cuối mục 1, tối thiểu 5 ký tự", "correction");
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
	//#region src/domain/nce/action-protocol-service.ts
	var draftSection = {
		date: "ident",
		eventSource: "ident",
		processPhase: "ident",
		by: "ident",
		dueDate: "ident",
		containmentStatus: "immediate",
		correction: "immediate",
		action: "cause",
		actionCompletedDate: "cause"
	};
	function createActionProtocolService(deps) {
		const { actionLabels, protocolChecks, riskScale } = nceActionLabels;
		const has = (labels, value) => !!labels[String(value || "")];
		const protocolStatus = (action) => {
			if (!action || !action.protocolVersion) return {
				required: false,
				complete: true,
				label: "Hồ sơ cũ",
				missing: [],
				missingBySection: {}
			};
			const missing = [], bySection = {
				ident: [],
				immediate: [],
				risk: [],
				check: [],
				cause: [],
				patient: []
			};
			const need = (condition, label, section) => {
				if (condition) {
					missing.push(label);
					bySection[section]?.push(label);
				}
			};
			if (Number(action.protocolVersion) >= 2) {
				const draft = deps.draftStatus(action);
				draft.missing.forEach((label, index) => {
					missing.push(label);
					bySection[draftSection[draft.missingKeys[index]] || "ident"].push(label);
				});
				need(!has(actionLabels.risk, action.riskLevel) || ![
					action.riskSeverity,
					action.riskOccurrence,
					action.riskDetectability
				].every((value) => riskScale.includes(Number(value))), "đánh giá nguy cơ", "risk");
				need(Number(action.protocolVersion) >= 3 && has(actionLabels.risk, action.riskLevel) && [
					action.riskSeverity,
					action.riskOccurrence,
					action.riskDetectability
				].every((value) => riskScale.includes(Number(value))) && String(action.riskBasis || "").trim().length < 5, "căn cứ phân loại nguy cơ theo SOP", "risk");
				need(!!action.date && !!action.dueDate && action.dueDate < action.date, "hạn hoàn thành không được trước ngày ghi nhận sự cố", "ident");
			}
			need(Number(action.protocolVersion) < 2 && !has(actionLabels.containment, action.containmentStatus), "kiểm soát tức thời", "immediate");
			need(Number(action.protocolVersion) >= 2 && action.containmentStatus === "held" && String(action.containmentNote || "").trim().length < 3, "ghi chú phạm vi kiểm soát tức thời", "immediate");
			protocolChecks.forEach(([key, label]) => {
				const low = label.toLocaleLowerCase("vi");
				const value = action[key];
				need(!has(actionLabels.check, value), low, "check");
				need(has(actionLabels.check, value) && [
					"abnormal",
					"na",
					"checked-abnormal"
				].includes(value) && String(action[key.replace("Status", "Note")] || "").trim().length < 3, `${low} (ghi chú)`, "check");
			});
			need(!has(actionLabels.cause, action.causeCategory) || String(action.cause || "").trim().length < 5, "nguyên nhân", "cause");
			need(String(action.action || "").trim().length < 5, "hành động khắc phục", "cause");
			need(Number(action.protocolVersion) >= 3 && String(action.action || "").trim().length >= 5 && !action.actionCompletedDate, "ngày hoàn thành hành động khắc phục", "cause");
			need(!!action.actionCompletedDate && !!action.date && action.actionCompletedDate < action.date, "ngày hoàn thành hành động không được trước ngày ghi nhận sự cố", "cause");
			need(!!action.actionCompletedDate && action.actionCompletedDate > deps.todayIso(), "ngày hoàn thành hành động không được ở tương lai", "cause");
			const releaseRequired = Number(action.protocolVersion) >= 3 && action.containmentStatus === "held";
			need(releaseRequired && !has(actionLabels.release, action.releaseStatus), "quyết định cho phép hoạt động/trả kết quả trở lại", "cause");
			if (releaseRequired && has(actionLabels.release, action.releaseStatus)) {
				const rerun = deps.needsRerun(action) ? deps.rerunStatus(action) : null;
				need(!action.releaseDate, "ngày cho phép hoạt động/trả kết quả trở lại", "cause");
				need(String(action.releaseBy || "").trim().length < 2, "người cho phép hoạt động/trả kết quả trở lại", "cause");
				need(String(action.releaseNote || "").trim().length < 5, "căn cứ cho phép hoạt động/trả kết quả trở lại", "cause");
				need(!!action.releaseDate && !!action.actionCompletedDate && action.releaseDate < action.actionCompletedDate, "ngày cho phép trở lại không được trước ngày hoàn thành hành động", "cause");
				need(!!action.releaseDate && !!rerun?.point?.date && action.releaseDate < rerun.point.date, "ngày cho phép trở lại không được trước QC chạy lại được dùng làm bằng chứng", "cause");
				need(!!action.releaseDate && action.releaseDate > deps.todayIso(), "ngày cho phép trở lại không được ở tương lai", "cause");
				need(action.releaseStatus === "released" && deps.needsRerun(action) && !rerun?.ok, "chỉ được cho phép trở lại sau khi QC chạy lại được chấp nhận", "cause");
			}
			need(!has(actionLabels.patient, action.patientImpact), "đánh giá ảnh hưởng bệnh nhân", "patient");
			need(["held", "affected"].includes(action.patientImpact) && String(action.patientAction || "").trim().length < 5, "xử lý kết quả bệnh nhân", "patient");
			need(action.containmentStatus === "none" && ["held", "affected"].includes(action.patientImpact), "mâu thuẫn giữa mục 1 (không có kết quả liên quan) và mục 7", "patient");
			const unique = [...new Set(missing)], missingBySection = Object.fromEntries(Object.entries(bySection).map(([key, values]) => [key, [...new Set(values)]]));
			return {
				required: true,
				complete: !unique.length,
				label: unique.length ? `Thiếu: ${unique.join(", ")}` : "Đã hoàn tất checklist điều tra",
				missing: unique,
				missingBySection
			};
		};
		const effectivenessStatus = (action) => {
			if (!action || !(Number(action.protocolVersion) >= 2)) return {
				required: false,
				complete: true,
				effective: true,
				label: "Không yêu cầu cho hồ sơ cũ",
				cls: "none",
				escalated: false
			};
			if (action.effectivenessStatus !== "pending" && Number(action.protocolVersion) >= 3) {
				if (String(action.effectivenessNote || "").trim().length < 5 || !action.effectivenessDate) return {
					required: true,
					complete: false,
					effective: false,
					label: "Cần ngày và bằng chứng đánh giá hiệu lực",
					cls: "rej",
					escalated: false
				};
				if (!action.actionCompletedDate) return {
					required: true,
					complete: false,
					effective: false,
					label: "Cần ngày hoàn thành hành động trước khi đánh giá hiệu lực",
					cls: "rej",
					escalated: false
				};
				const rerun = deps.needsRerun(action) ? deps.rerunStatus(action) : null;
				const latestPrerequisite = [
					action.date,
					action.actionCompletedDate,
					action.releaseDate,
					rerun?.point?.date
				].filter(Boolean).sort().pop() || "";
				if (latestPrerequisite && action.effectivenessDate < latestPrerequisite) return {
					required: true,
					complete: false,
					effective: false,
					label: "Ngày đánh giá hiệu lực không được trước hành động, quyết định cho phép hoặc QC chạy lại dùng làm bằng chứng",
					cls: "rej",
					escalated: false
				};
				if (action.effectivenessDate > deps.todayIso()) return {
					required: true,
					complete: false,
					effective: false,
					label: "Ngày đánh giá hiệu lực không được ở tương lai",
					cls: "rej",
					escalated: false
				};
			}
			if (action.effectivenessStatus === "effective") {
				if (Number(action.protocolVersion) >= 3) {
					const residual = actionResidualRiskScore(action), initial = actionRiskScore(action);
					if (!residual || !has(actionLabels.risk, action.residualRiskLevel) || String(action.residualRiskBasis || "").trim().length < 5) return {
						required: true,
						complete: false,
						effective: false,
						label: "Cần đánh giá đầy đủ nguy cơ còn lại và căn cứ SOP",
						cls: "rej",
						escalated: false
					};
					if (initial && residual > initial) return {
						required: true,
						complete: false,
						effective: false,
						label: `RPN còn lại ${residual} cao hơn RPN ban đầu ${initial} — chưa thể kết luận có hiệu lực`,
						cls: "rej",
						escalated: false
					};
				}
				if (Number(action.protocolVersion) < 3 && (String(action.effectivenessNote || "").trim().length < 5 || !action.effectivenessDate)) return {
					required: true,
					complete: false,
					effective: false,
					label: "Chờ đánh giá hiệu lực",
					cls: "warn",
					escalated: false
				};
				return {
					required: true,
					complete: true,
					effective: true,
					label: Number(action.protocolVersion) >= 3 ? `Đã xác nhận hiệu lực · RPN còn lại ${actionResidualRiskScore(action)}` : "Đã xác nhận hiệu lực",
					cls: "ok",
					escalated: false
				};
			}
			if (action.effectivenessStatus === "ineffective") {
				const followUp = String(action.followUpNceId || "").trim();
				return followUp && deps.activeFollowUp(action) ? {
					required: true,
					complete: true,
					effective: false,
					label: `Chưa hiệu lực — đã chuyển ${followUp}`,
					cls: "warn",
					escalated: true
				} : {
					required: true,
					complete: false,
					effective: false,
					label: followUp ? "Hồ sơ tiếp theo đã hủy hoặc không còn tồn tại — cần mở vòng mới" : "Chưa hiệu lực — cần mở hồ sơ tiếp theo",
					cls: "rej",
					escalated: false
				};
			}
			return {
				required: true,
				complete: false,
				effective: false,
				label: "Chờ đánh giá hiệu lực",
				cls: "warn",
				escalated: false
			};
		};
		const protocolSummary = (action) => {
			if (!action || !action.protocolVersion) return "";
			const checks = protocolChecks.map(([key, label]) => `${label}: ${actionLabels.check[action[key]] || "Chưa ghi"}${action[key.replace("Status", "Note")] ? ` (${action[key.replace("Status", "Note")]})` : ""}`);
			const residual = actionResidualRiskScore(action);
			return [
				...Number(action.protocolVersion) >= 2 ? [`Mã NCE: ${action.nceId || "Chưa cấp"} · Nguồn: ${actionLabels.source[action.eventSource] || "Chưa ghi"} · Giai đoạn: ${actionLabels.phase[action.processPhase] || "Chưa ghi"}`, `Nguy cơ: ${actionLabels.risk[action.riskLevel] || "Chưa đánh giá"} · S×O×D ${action.riskSeverity || 0}×${action.riskOccurrence || 0}×${action.riskDetectability || 0} = ${actionRiskScore(action)}${action.riskBasis ? ` · Căn cứ: ${action.riskBasis}` : ""}`] : [],
				`Kiểm soát tức thời: ${actionLabels.containment[action.containmentStatus] || "Chưa ghi"}${action.containmentNote ? ` (${action.containmentNote})` : ""}`,
				...Number(action.protocolVersion) >= 2 ? [`Xử lý tức thời: ${action.correction || "Chưa ghi"}`] : [],
				...checks,
				`Nguyên nhân: ${actionLabels.cause[action.causeCategory] || "Chưa phân loại"}${action.cause ? ` — ${action.cause}` : ""}`,
				...Number(action.protocolVersion) >= 3 && action.containmentStatus === "held" ? [`Cho phép trở lại: ${actionLabels.release[action.releaseStatus] || "Chưa xác nhận"}${action.releaseDate ? ` · ${deps.formatDate(action.releaseDate)}` : ""}${action.releaseBy ? ` · ${action.releaseBy}` : ""}${action.releaseNote ? ` — ${action.releaseNote}` : ""}`] : [],
				`Ảnh hưởng bệnh nhân: ${actionLabels.patient[action.patientImpact] || "Chưa ghi"}${action.patientAction ? ` — ${action.patientAction}` : ""}`,
				...Number(action.protocolVersion) >= 2 ? [`Hiệu lực: ${action.effectivenessStatus === "effective" ? "Có hiệu lực" : action.effectivenessStatus === "ineffective" ? "Chưa hiệu lực" : "Chưa đánh giá"}${action.effectivenessDate ? ` · ${deps.formatDate(action.effectivenessDate)}` : ""}${action.effectivenessNote ? ` — ${action.effectivenessNote}` : ""}${action.effectivenessBy ? ` · ${action.effectivenessBy}` : ""}`] : [],
				...Number(action.protocolVersion) >= 3 && residual ? [`Nguy cơ còn lại: ${actionLabels.risk[action.residualRiskLevel] || "Chưa phân loại"} · S×O×D ${action.residualSeverity || 0}×${action.residualOccurrence || 0}×${action.residualDetectability || 0} = ${residual}${action.residualRiskBasis ? ` · Căn cứ: ${action.residualRiskBasis}` : ""}`] : [],
				...deps.isCancelled(action) ? [`Hồ sơ đã hủy: ${action.cancelReason || "Không ghi lý do"}${action.cancelledBy ? ` · ${action.cancelledBy}` : ""}${action.cancelledAt ? ` · ${action.cancelledAt}` : ""}`] : []
			].join(" | ");
		};
		return Object.freeze({
			protocolStatus,
			effectivenessStatus,
			protocolSummary
		});
	}
	//#endregion
	//#region src/application/nce/action-review-service.ts
	function createActionReviewService(deps) {
		const reviewToken = (action) => {
			const current = action || {};
			const rerun = action ? deps.rerunStatus(action) : {};
			return [
				current.id || "",
				current.updatedAt || current.createdAt || "",
				deps.workflowStatus(current).stage || "",
				rerun.point && rerun.point.id || "",
				deps.approvalStatus(current),
				deps.recordStatus(current)
			].join("|");
		};
		const cancelReadiness = (action) => {
			if (!action) return {
				ok: false,
				reason: "missing"
			};
			if (deps.isCancelled(action)) return {
				ok: false,
				reason: "cancelled"
			};
			if (deps.approvalStatus(action) === "approved") return {
				ok: false,
				reason: "approved"
			};
			const followUp = deps.activeFollowUp(action);
			if (followUp) return {
				ok: false,
				reason: "follow-up",
				followUp
			};
			return {
				ok: true,
				reason: "ready"
			};
		};
		const reopenReadiness = (action) => {
			if (!action) return {
				ok: false,
				reason: "missing"
			};
			if (deps.isCancelled(action)) return {
				ok: false,
				reason: "cancelled"
			};
			if (deps.approvalStatus(action) !== "approved") return {
				ok: false,
				reason: "not-approved"
			};
			if (deps.workflowStatus(action).complete) return {
				ok: false,
				reason: "complete"
			};
			return {
				ok: true,
				reason: "ready"
			};
		};
		const returnReadiness = (action) => {
			if (!action) return {
				ok: false,
				reason: "missing"
			};
			if (deps.isCancelled(action)) return {
				ok: false,
				reason: "cancelled"
			};
			if (deps.approvalStatus(action) !== "pending" || deps.workflowStatus(action).stage !== "approval") return {
				ok: false,
				reason: "not-pending"
			};
			return {
				ok: true,
				reason: "ready"
			};
		};
		const canCancel = (action) => cancelReadiness(action).ok;
		const canReopen = (action) => reopenReadiness(action).ok;
		const canReturn = (action) => returnReadiness(action).ok;
		const canApprove = (action) => canReturn(action);
		const approvalReadiness = (action, user) => {
			if (!action) return {
				ok: false,
				reason: "missing"
			};
			if (deps.isCancelled(action)) return {
				ok: false,
				reason: "cancelled"
			};
			if (!deps.isRecorded(action)) return {
				ok: false,
				reason: "unrecorded"
			};
			const protocol = deps.protocolStatus(action);
			if (!protocol.complete) return {
				ok: false,
				reason: "protocol",
				missing: protocol.missing || []
			};
			const rerun = deps.rerunStatus(action);
			if (rerun.needed && !rerun.ok) return {
				ok: false,
				reason: "rerun"
			};
			if (!deps.effectivenessStatus(action).complete) return {
				ok: false,
				reason: "effectiveness"
			};
			if (!canApprove(action)) return {
				ok: false,
				reason: "not-pending"
			};
			if (user && !deps.canApproveByUser(action, user)) return {
				ok: false,
				reason: "non-independent"
			};
			return {
				ok: true,
				reason: "ready"
			};
		};
		const cancel = (action, reason, by) => {
			if (!canCancel(action) || String(reason || "").trim().length < 5) return false;
			const at = deps.now();
			Object.assign(action, {
				recordStatus: "cancelled",
				cancelReason: reason,
				cancelledAt: at,
				cancelledBy: by,
				updatedAt: at
			});
			return true;
		};
		const approve = (action, note, by) => {
			if (!canApprove(action) || String(note || "").trim().length < 3) return false;
			Object.assign(action, {
				approvalStatus: "approved",
				approvedAt: deps.now(),
				approvedBy: by,
				approvalNote: note
			});
			return true;
		};
		const returnForRevision = (action, note, by) => {
			if (!canReturn(action) || String(note || "").trim().length < 3) return false;
			const at = deps.now();
			Object.assign(action, {
				approvalStatus: "returned",
				approvedAt: at,
				approvedBy: by,
				approvalNote: note,
				returnNote: note,
				returnBy: by,
				returnAt: at
			});
			return true;
		};
		const reopen = (action, note) => {
			if (!canReopen(action) || String(note || "").trim().length < 5) return false;
			Object.assign(action, {
				approvalStatus: "pending",
				approvedAt: "",
				approvedBy: "",
				approvalNote: `Mở lại: ${note}`
			});
			return true;
		};
		return Object.freeze({
			reviewToken,
			canCancel,
			canApprove,
			canReturn,
			canReopen,
			cancelReadiness,
			reopenReadiness,
			returnReadiness,
			approvalReadiness,
			cancel,
			approve,
			returnForRevision,
			reopen
		});
	}
	//#endregion
	//#region src/application/nce/action-escalation-service.ts
	function createActionEscalationService(deps) {
		const canEscalate = (actions, action) => !!action && !deps.isCancelled(action) && Number(action.protocolVersion) >= 2 && action.effectivenessStatus === "ineffective" && !deps.activeFollowUp(actions || [], action) && deps.approvalStatus(action) !== "approved";
		const createFollowUp = (actions, parent, user) => {
			if (!canEscalate(actions || [], parent)) return null;
			const parentId = parent.nceId || "hồ sơ trước", now = deps.now(), nceId = deps.nextNceId(actions || [], deps.today());
			const username = String(user.username || "").trim().toLowerCase();
			const record = {
				id: deps.createId(),
				nceId,
				parentNceId: parent.nceId || "",
				date: deps.today(),
				createdAt: now,
				updatedAt: now,
				createdByUserId: user.id || "",
				createdByUsername: user.username || "",
				contentEditorUserIds: [user.id || ""].filter(Boolean),
				contentEditorUsernames: [username].filter(Boolean),
				testId: parent.testId,
				level: parent.level,
				lot: parent.lot || "",
				pointId: parent.pointId || "",
				rule: parent.rule || "",
				errorType: parent.errorType || "",
				qcVerdict: parent.qcVerdict || "",
				protocolVersion: 3,
				eventSource: parent.eventSource || "iqc",
				processPhase: parent.processPhase || "exam",
				containmentStatus: parent.containmentStatus || "",
				containmentNote: parent.containmentNote || "",
				correction: `Hành động của ${parentId} được đánh giá chưa hiệu lực, mở vòng điều tra mới.`,
				by: user.name || "",
				dueDate: deps.dueDate(7),
				effectivenessStatus: "pending",
				approvalStatus: "pending",
				recordStatus: "active",
				approvedAt: "",
				approvedBy: "",
				approvalNote: ""
			};
			parent.followUpNceId = nceId;
			(actions || []).push(record);
			return record;
		};
		return Object.freeze({
			canEscalate,
			createFollowUp
		});
	}
	//#endregion
	//#region src/application/nce/action-record-service.ts
	var effectivenessKeys = [
		"effectivenessStatus",
		"effectivenessNote",
		"effectivenessDate",
		"residualSeverity",
		"residualOccurrence",
		"residualDetectability",
		"residualRiskLevel",
		"residualRiskBasis"
	];
	function createActionRecordService(deps) {
		const userFields = (user) => ({
			createdByUserId: user.id || "",
			createdByUsername: user.username || "",
			contentEditorUserIds: [user.id || ""].filter(Boolean),
			contentEditorUsernames: [String(user.username || "").trim().toLowerCase()].filter(Boolean)
		});
		const create = (actions, values, user) => {
			const now = deps.now(), effective = values.effectivenessStatus !== "pending";
			const record = {
				id: deps.createId(),
				...values,
				createdAt: now,
				updatedAt: now,
				...userFields(user),
				effectivenessBy: effective ? user.name || "" : "",
				effectivenessAt: effective ? now : "",
				approvalStatus: "pending",
				recordStatus: "active",
				approvedAt: "",
				approvedBy: "",
				approvalNote: ""
			};
			actions.push(record);
			return record;
		};
		const update = (action, values, user) => {
			if (deps.isCancelled(action) || deps.approvalStatus(action) === "approved") return null;
			const now = deps.now(), effective = values.effectivenessStatus !== "pending";
			const changed = effectivenessKeys.some((key) => String(values[key] ?? "") !== String(action[key] ?? (key === "effectivenessStatus" ? "pending" : "")));
			const editorIds = [...new Set([...action.contentEditorUserIds || [], user.id || ""].filter(Boolean))];
			const editorNames = [...new Set([...action.contentEditorUsernames || [], String(user.username || "").trim().toLowerCase()].filter(Boolean))];
			Object.assign(action, values, {
				updatedAt: now,
				contentEditorUserIds: editorIds,
				contentEditorUsernames: editorNames,
				approvalStatus: "pending",
				approvedAt: "",
				approvedBy: "",
				approvalNote: "",
				effectivenessBy: effective ? changed ? user.name || "" : action.effectivenessBy || user.name || "" : "",
				effectivenessAt: effective ? changed ? now : action.effectivenessAt || now : ""
			});
			return action;
		};
		return Object.freeze({
			create,
			update
		});
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
	if (!root.QCCore || typeof root.QCCore.stats !== "function" || typeof root.QCCore.cleanText !== "function" || typeof root.QCCore.cleanId !== "function" || typeof root.QCCore.targetFromLimits !== "function" || typeof root.QCCore.limitsFromTarget !== "function" || typeof root.QCCore.systematicShiftCritical !== "function") throw new Error("QCCore phải được nạp đủ dependency trước các module TypeScript");
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
	root.SigmaPresentation = sigmaPresentation;
	root.SigmaPeriodViewModel = createSigmaPeriodViewModel({
		sigmaMetric: (tea, bias, cv) => root.QCCore.sigmaMetric(tea, bias, cv),
		teaFor: (test, entry, level, refs) => globalThis.sgEntryTea(test, entry, level, refs),
		teaMeta: (test, source) => globalThis.sgTeaSourceMeta(test, source),
		teaSource: (test) => globalThis.sgTeaSource(test),
		teaLabel: (source) => globalThis.sgTeaLabel(source),
		teaReference: (test) => globalThis.sgTeaRefText(test),
		readiness: (level) => sigmaPresentation.sigmaReadiness(level),
		muFor: (test, entry, level, tea, refs) => globalThis.sgMU(test, entry, level, tea, refs),
		zone: (sigma) => sigmaPresentation.sigmaZone(sigma),
		runPlan: (sigma) => sigmaPresentation.sigmaRunPlan(sigma)
	});
	root.SigmaBiasService = createSigmaBiasService({ stats: (values) => root.QCCore.stats(values) });
	root.SigmaCohortImportService = createSigmaCohortImportService({
		assess: (cohort) => root.SigmaCohortService.assess(cohort),
		setTeaSnapshot: (test, entry, level, force) => globalThis.sgSetLevelTeaSnapshot(test, entry, level, force),
		isCurrentPeriod: (period) => period === globalThis.isoMonth()
	});
	root.SigmaPeriodRecordService = createSigmaPeriodRecordService();
	root.SigmaLevelEditService = createSigmaLevelEditService({ cleanText: (value, maximumLength) => root.QCCore.cleanText(value, maximumLength) });
	root.SigmaTrackedTestService = createSigmaTrackedTestService({ orderedTracked: (tests) => tests.filter((test) => test.sgTracked).sort((left, right) => globalThis.operationalTestOrder(left) - globalThis.operationalTestOrder(right) || String(globalThis.testDisplayName(left)).localeCompare(String(globalThis.testDisplayName(right)), "vi")) });
	root.SigmaBiasWorkflowService = createSigmaBiasWorkflowService({
		stats: (rounds) => root.SigmaBiasService.stats(rounds),
		apply: (records, periodIds, level, bias, rounds, batchId) => root.SigmaBiasService.applyToPeriods(records, periodIds, level, bias, rounds, batchId),
		createId: () => uid()
	});
	root.SigmaMuWorkflowService = createSigmaMuWorkflowService({
		cleanText: (value, maximumLength) => root.QCCore.cleanText(value, maximumLength),
		parseDate: (value) => {
			const parse = globalThis.parseVN;
			if (typeof parse === "function") return parse(value);
			const text = String(value || "").trim();
			return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
		}
	});
	root.SigmaCohortSelectionService = createSigmaCohortSelectionService({
		normalizePeriod: (period) => root.SigmaCohortService.normalizePeriod(period),
		today: () => globalThis.isoToday(),
		cohortsForLevelByLot: (data, options) => root.SigmaCohortService.cohortsForLevelByLot(data, options)
	});
	root.SigmaTeaEditService = createSigmaTeaEditService({
		cleanText: (value, maximumLength) => root.QCCore.cleanText(value, maximumLength),
		parseDate: (value) => {
			const parse = globalThis.parseVN;
			if (typeof parse === "function") return parse(value);
			const text = String(value || "").trim();
			return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
		}
	});
	root.SigmaTeaSnapshotService = createSigmaTeaSnapshotService();
	root.SigmaLevelSelectionService = createSigmaLevelSelectionService();
	root.SigmaPeriodSelectionService = createSigmaPeriodSelectionService();
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
	root.ActionProtocolService = createActionProtocolService({
		todayIso: () => isoToday(),
		draftStatus: (action) => root.ActionDraftStatusService(action),
		needsRerun: (action) => typeof root.actionNeedsRerun === "function" && !!root.actionNeedsRerun(action),
		rerunStatus: (action) => typeof root.actionRerunStatus === "function" ? root.actionRerunStatus(action) : {
			needed: false,
			ok: false,
			point: null
		},
		activeFollowUp: (action) => {
			const id = String(action.followUpNceId || "").trim();
			return id ? (state.actions || []).find((candidate) => candidate.nceId === id && !nceActionBasics.actionCancelled(candidate)) || null : null;
		},
		isCancelled: (action) => nceActionBasics.actionCancelled(action),
		formatDate: (value) => vnDate(value)
	});
	root.ActionReviewService = createActionReviewService({
		now: () => (/* @__PURE__ */ new Date()).toISOString(),
		isCancelled: (action) => nceActionBasics.actionCancelled(action),
		approvalStatus: (action) => nceActionBasics.actionApprovalStatus(action),
		recordStatus: (action) => nceActionBasics.actionRecordStatus(action),
		workflowStatus: (action) => typeof root.actionWorkflowStatus === "function" ? root.actionWorkflowStatus(action) : {},
		activeFollowUp: (action) => {
			const id = String(action.followUpNceId || "").trim();
			return id ? (state.actions || []).find((candidate) => candidate.nceId === id && !nceActionBasics.actionCancelled(candidate)) || null : null;
		},
		isRecorded: (action) => typeof root.actionRecorded === "function" && !!root.actionRecorded(action),
		protocolStatus: (action) => typeof root.actionProtocolStatus === "function" ? root.actionProtocolStatus(action) : {
			complete: false,
			missing: []
		},
		rerunStatus: (action) => typeof root.actionRerunStatus === "function" ? root.actionRerunStatus(action) : {
			needed: false,
			ok: false
		},
		effectivenessStatus: (action) => typeof root.actionEffectivenessStatus === "function" ? root.actionEffectivenessStatus(action) : { complete: false },
		canApproveByUser: (action, user) => typeof root.actionCanApprove === "function" && !!root.actionCanApprove(action, user)
	});
	root.ActionEscalationService = createActionEscalationService({
		now: () => (/* @__PURE__ */ new Date()).toISOString(),
		today: () => isoToday(),
		createId: () => uid(),
		nextNceId: (actions, today) => root.NceActionIdentityService.nextNceId(actions, today),
		dueDate: (days) => root.NceActionIdentityService.dueDate(days),
		isCancelled: (action) => nceActionBasics.actionCancelled(action),
		approvalStatus: (action) => nceActionBasics.actionApprovalStatus(action),
		activeFollowUp: (actions, action) => root.NceActionIdentityService.activeFollowUp(actions, action)
	});
	root.ActionRecordService = createActionRecordService({
		now: () => (/* @__PURE__ */ new Date()).toISOString(),
		createId: () => uid(),
		isCancelled: (action) => nceActionBasics.actionCancelled(action),
		approvalStatus: (action) => nceActionBasics.actionApprovalStatus(action)
	});
	root.ActionViolationService = createActionViolationService({
		pointForAction: (action) => typeof root.actionPoint === "function" ? root.actionPoint(action) : null,
		findTest: (testId) => (state.tests || []).find((test) => test.id === testId) || null,
		levelFor: (test, level) => lvlCfg(test, level) || null,
		errorType: (rules) => globalThis.errorType(rules)
	});
	root.ActionListPresentation = createActionListPresentation({ levelFor: (test, level) => lvlCfg(test, level) || null });
	root.ActionEvidencePresentation = createActionEvidencePresentation({
		pointForAction: (action) => typeof root.actionPoint === "function" ? root.actionPoint(action) : null,
		eventDate: (action) => typeof root.actionEventDate === "function" ? root.actionEventDate(action) : String(action.date || ""),
		formatDate: (value) => vnDate(value),
		formatDateTime: (value) => formatDateTimeVN(value)
	});
	root.ActionRerunEvidencePresentation = createActionRerunEvidencePresentation({
		pointForAction: (action) => typeof root.actionPoint === "function" ? root.actionPoint(action) : null,
		levelShort: (test, level, lot) => root.ActionListPresentation.levelShort(test, level, lot)
	});
	root.ActionStatusPresentation = createActionStatusPresentation({ checkLabels: nceActionLabels.actionLabels.check });
	root.ActionReviewPresentation = createActionReviewPresentation();
	root.ActionDetailPresentation = createActionDetailPresentation({
		sourceLabels: nceActionLabels.actionLabels.source,
		phaseLabels: nceActionLabels.actionLabels.phase,
		riskLabels: nceActionLabels.actionLabels.risk
	});
	root.ActionGuidePresentation = createActionGuidePresentation();
	root.ReportPeriodPresentation = createReportPeriodPresentation();
	root.ActionBiasService = createActionBiasService({
		teaFor: (test, level) => globalThis.sgTeaBySource(test, globalThis.sgTeaSource(test), level.mean),
		systematicShiftCritical: (tea, bias, sd) => root.QCCore.systematicShiftCritical(tea, bias, sd),
		sigmaBiasValue: (level) => typeof globalThis.sgBiasVal === "function" ? globalThis.sgBiasVal(level) : level.biasEqa ?? level.bias
	});
	root.ActionBiasPresentation = createActionBiasPresentation((value) => globalThis.fmt(value));
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
		cleanId: root.QCCore.cleanId,
		targetFromLimits: root.QCCore.targetFromLimits,
		limitsFromTarget: root.QCCore.limitsFromTarget
	});
	root.LotTransitionPickerService = createLotTransitionPickerService({
		searchText: (value) => globalThis.searchText(value),
		formatDate: (value) => globalThis.vnDate(value),
		transitionToNo: (lotId) => globalThis.lotTransitionToNo(lotId)
	});
	root.ReagentComparisonService = createReagentComparisonService({
		cleanText: root.QCCore.cleanText,
		cleanId: root.QCCore.cleanId
	});
	root.SigmaCohortService = createSigmaCohortService({ stats: root.QCCore.stats });
	root.WestgardViewModel = westgardViewModel;
	//#endregion
})();
