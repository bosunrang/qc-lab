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
	//#region src/application/manage/tea-reference-service.ts
	function createTeaReferenceService(deps) {
		const find = (state, refKey) => {
			const key = deps.key(refKey);
			return (state.teaRefs || []).find((row) => row.analyteId === refKey) || (state.teaRefs || []).find((row) => deps.key(row.name) === key);
		};
		const numberOrNull = (value) => {
			const number = Number(value);
			return String(value == null ? "" : value).trim() !== "" && Number.isFinite(number) && number > 0 ? number : null;
		};
		const sourceMeta = (state, name, source) => {
			const base = deps.sourceRegistry()[source] || {};
			const custom = find(state, name)?.sources?.[source] || {};
			return {
				...base,
				...Object.fromEntries(Object.entries(custom).filter(([, value]) => String(value ?? "").trim() !== ""))
			};
		};
		const stampSource = (state, row, source) => {
			const base = sourceMeta(state, row.name, source);
			row.sources = row.sources || {};
			row.sources[source] = {
				...base,
				status: "reviewed",
				reviewedDate: deps.todayIso(),
				reviewedBy: deps.userName()
			};
			return row.sources[source];
		};
		const ensure = (state, refKey) => {
			let record = find(state, refKey);
			let created = false;
			if (!record) {
				const source = deps.effectiveReferences().find((row) => row[6] === refKey || deps.key(row[0]) === deps.key(refKey));
				const id = deps.createId();
				const naming = deps.analyteMeta(source ? source[0] : refKey);
				record = {
					id,
					analyteId: source && source[6] || naming.analyteId || "custom-" + id,
					name: source ? source[0] : refKey,
					displayName: naming.displayName,
					standardName: naming.standardName,
					abbreviation: naming.abbreviation,
					aliases: naming.aliases,
					matrix: naming.matrix,
					unit: source ? source[1] : "",
					clia: source ? source[2] : null,
					ricos: source ? source[3] : null,
					lab: source ? source[7] : null,
					section: source ? source[4] : "",
					sources: {}
				};
				state.teaRefs = state.teaRefs || [];
				state.teaRefs.push(record);
				created = true;
			}
			return {
				record,
				created
			};
		};
		const edit = (state, refKey, field, value) => {
			const result = ensure(state, refKey);
			const before = result.record[field];
			result.record[field] = numberOrNull(value);
			const source = stampSource(state, result.record, field);
			return {
				...result,
				before,
				source
			};
		};
		const addCustomReference = (state, input) => {
			const result = ensure(state, input.name);
			const record = result.record;
			record.name = input.name;
			record.abbreviation = input.abbreviation;
			record.standardName = input.name;
			record.displayName = input.abbreviation && deps.key(input.abbreviation) !== deps.key(input.name) ? `${input.name} (${input.abbreviation})` : input.name;
			record.aliases = input.abbreviation ? [input.abbreviation] : [];
			record.matrix = input.matrix;
			record.unit = input.unit;
			record.section = input.section;
			record.clia = numberOrNull(input.clia);
			record.ricos = numberOrNull(input.ricos);
			if (record.clia != null) stampSource(state, record, "clia");
			if (record.ricos != null) stampSource(state, record, "ricos");
			return result;
		};
		const saveLabProfile = (state, refKey, profile) => {
			const result = ensure(state, refKey);
			const before = result.record.lab;
			result.record.lab = profile.value;
			result.record.labSource = profile.source;
			result.record.labPreparedBy = profile.prepared;
			result.record.labNextReviewDate = profile.nextReview;
			result.record.sources = result.record.sources || {};
			result.record.sources.lab = {
				...deps.sourceRegistry().lab || {},
				id: "lab-" + result.record.analyteId,
				version: profile.sourceLabel,
				document: profile.reference,
				effectiveDate: profile.effective,
				reviewedDate: profile.approvedDate,
				reviewedBy: profile.approved,
				status: "reviewed",
				note: profile.reason
			};
			return {
				...result,
				before
			};
		};
		const externalChanged = (record, refKey) => {
			const base = deps.defaultReferences().find((row) => deps.analyteMeta(row[0]).analyteId === refKey);
			return !!(record && base && (record.unit !== base[1] || record.clia !== base[2] || record.ricos !== base[3] || record.section !== base[4] || [
				"cliaRule",
				"cliaAbsolute",
				"cliaAbsoluteUnit"
			].some((key) => record[key] != null && record[key] !== "")));
		};
		const removeLabProfile = (state, refKey, isDefault) => {
			const record = find(state, refKey);
			if (!record || record.lab == null) return {
				record,
				before: null,
				removedRecord: false
			};
			const before = record.lab;
			[
				"lab",
				"labSource",
				"labPreparedBy",
				"labNextReviewDate"
			].forEach((key) => delete record[key]);
			if (record.sources) delete record.sources.lab;
			const removedRecord = isDefault && !externalChanged(record, refKey);
			if (removedRecord) state.teaRefs = (state.teaRefs || []).filter((row) => row !== record);
			return {
				record,
				before,
				removedRecord
			};
		};
		const restoreOrRemove = (state, refKey, isDefault) => {
			const record = find(state, refKey);
			let restored = false;
			if (isDefault && record && record.lab != null) {
				const base = deps.defaultReferences().find((row) => deps.analyteMeta(row[0]).analyteId === refKey);
				if (base) {
					record.name = base[0];
					record.unit = base[1];
					record.clia = base[2];
					record.ricos = base[3];
					record.section = base[4];
					record.sources = { lab: record.sources?.lab || {} };
					[
						"cliaRule",
						"cliaAbsolute",
						"cliaAbsoluteUnit"
					].forEach((key) => delete record[key]);
					restored = true;
				}
			}
			if (!restored) state.teaRefs = (state.teaRefs || []).filter((row) => row.analyteId !== refKey && deps.key(row.name) !== deps.key(refKey));
			return {
				record,
				restored
			};
		};
		return Object.freeze({
			find,
			numberOrNull,
			sourceMeta,
			stampSource,
			ensure,
			edit,
			addCustomReference,
			saveLabProfile,
			externalChanged,
			removeLabProfile,
			restoreOrRemove
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
	//#region src/application/audit/audit-service.ts
	function createAuditService(deps) {
		let chainCache = {
			sig: "",
			result: null
		};
		const list = () => deps.getState().activity || [];
		const lastHashOf = (activity = []) => {
			for (let i = activity.length - 1; i >= 0; i--) {
				const hash = activity[i] && activity[i].hash;
				if (hash) return hash;
			}
			return "";
		};
		const lastHash = () => lastHashOf(list());
		const nextSeq = () => list().reduce((max, entry) => Math.max(max, Number(entry.seq) || 0), 0) + 1;
		const archiveCut = (activity = [], cutoffIso) => {
			const cutoff = String(cutoffIso || ""), segment = [], retained = [];
			activity.forEach((entry) => {
				const ts = String(entry && entry.ts || "");
				if (ts && ts < cutoff) segment.push(entry);
				else retained.push(entry);
			});
			return {
				segment,
				retained,
				tipHash: lastHashOf(segment)
			};
		};
		const pushRaw = (type, detail, target = "") => {
			const state = deps.getState();
			state.activity = state.activity || [];
			if (!state.activity.length && state.activityAnchor) state.activityAnchor = "";
			const actor = deps.actor();
			const entry = {
				id: deps.uid(),
				seq: nextSeq(),
				ts: deps.nowIso(),
				user: actor.user,
				username: actor.username,
				userId: actor.userId,
				role: actor.role,
				type,
				detail,
				target,
				clientId: actor.clientId,
				prevHash: lastHash()
			};
			entry.hash = deps.entryHash(entry);
			state.activity.push(entry);
		};
		const rotateOverflow = () => {
			const state = deps.getState(), activity = list(), limits = deps.limits();
			if (activity.length <= limits.hardCap) return;
			const dropped = activity.slice(0, activity.length - limits.rotateTo), tip = lastHashOf(dropped);
			state.activity = activity.slice(-limits.rotateTo);
			if (tip) state.activityAnchor = tip;
			pushRaw("Xoay vòng nhật ký hoạt động", `Nhật ký vượt ${limits.hardCap} dòng: tự động loại ${dropped.length} dòng cũ nhất, giữ lại ${limits.rotateTo} dòng mới nhất (không xuất CSV). Hash đỉnh phần đã loại: ${tip || "—"}. Nên dùng "Lưu trữ nhật ký cũ" ở trang Nhật ký để có file CSV trước khi cắt.`, "Nhật ký");
		};
		const log = (type, detail, target = "") => {
			pushRaw(type, detail, target);
			rotateOverflow();
		};
		const chainSignature = () => {
			const activity = list(), last = activity[activity.length - 1] || {};
			return `${activity.length}|${last.hash || ""}|${deps.getState().activityAnchor || ""}`;
		};
		const chainStatus = (force = false) => {
			const sig = chainSignature();
			if (chainCache.sig === sig && chainCache.result) return chainCache.result;
			const activity = list();
			if (!force && activity.length > deps.autoVerifyMax) return {
				idle: true,
				total: activity.length
			};
			const result = {
				...deps.verifyChain(activity, deps.getState().activityAnchor || ""),
				idle: false
			};
			chainCache = {
				sig,
				result
			};
			return result;
		};
		const resetChainCache = () => {
			chainCache = {
				sig: "",
				result: null
			};
		};
		const relinkChain = (activity = [], anchor = "") => {
			let previous = String(anchor || "");
			return activity.map((entry) => {
				if (!entry || !entry.hash && !entry.prevHash) return entry;
				const relinked = {
					...entry,
					prevHash: previous
				};
				relinked.hash = deps.entryHash(relinked);
				previous = relinked.hash;
				return relinked;
			});
		};
		return Object.freeze({
			lastHashOf,
			lastHash,
			nextSeq,
			archiveCut,
			pushRaw,
			rotateOverflow,
			log,
			chainSignature,
			chainStatus,
			resetChainCache,
			relinkChain
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
	//#region src/domain/qc/qc-point-run.ts
	function qcPointRunNumber(point) {
		const match = /-(\d+)$/.exec(String(point?.runId || ""));
		return match ? parseInt(match[1], 10) : 1;
	}
	//#endregion
	//#region src/domain/qc/cusum-config.ts
	function qcCusumConfig(test) {
		const config = test?.cusum;
		return {
			on: !!config?.on,
			k: Number.isFinite(Number(config?.k)) && Number(config?.k) > 0 ? Number(config?.k) : .5,
			h: Number.isFinite(Number(config?.h)) && Number(config?.h) > 0 ? Number(config?.h) : 4
		};
	}
	//#endregion
	//#region src/domain/qc/search-text.ts
	function normalizeSearchText(value) {
		return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
	}
	//#endregion
	//#region src/domain/qc/level-target.ts
	function qcLevelTargetValid(level) {
		return !!level && Number.isFinite(Number(level.mean)) && Number.isFinite(Number(level.sd)) && Number(level.sd) > 0;
	}
	//#endregion
	//#region src/domain/qc/lot-target.ts
	var finite = (value) => Number.isFinite(Number(value));
	function qcLotMeanSd(levelConfig, lotNo, points = []) {
		if (levelConfig && (levelConfig.lot || "") === (lotNo || "") && finite(levelConfig.mean) && finite(levelConfig.sd)) return {
			mean: Number(levelConfig.mean),
			sd: Number(levelConfig.sd)
		};
		const history = (levelConfig?.meanSdHistory || []).slice().reverse().find((entry) => (entry.lot || "") === (lotNo || "") && finite(entry.mean) && finite(entry.sd));
		if (history) return {
			mean: Number(history.mean),
			sd: Number(history.sd)
		};
		const point = points.find((item) => (item.lot || "") === (lotNo || "") && finite(item.qcMean) && finite(item.qcSd));
		return point ? {
			mean: Number(point.qcMean),
			sd: Number(point.qcSd)
		} : null;
	}
	function qcLotTargetSnapshot(levelConfig, lotId, lotNo) {
		if (!levelConfig) return null;
		const snapshot = (value) => ({
			mean: Number(value.mean),
			sd: Number(value.sd),
			low: value.low == null ? null : Number(value.low),
			high: value.high == null ? null : Number(value.high)
		});
		if (levelConfig.qcLotId === lotId && finite(levelConfig.mean) && finite(levelConfig.sd)) return snapshot(levelConfig);
		const history = (levelConfig.meanSdHistory || []).slice().reverse().find((entry) => (entry.qcLotId ? entry.qcLotId === lotId : (entry.lot || "") === (lotNo || "")) && finite(entry.mean) && finite(entry.sd));
		return history ? snapshot(history) : null;
	}
	//#endregion
	//#region src/domain/qc/report-level-stats.ts
	function createReportLevelStats(stats) {
		return (points, mean, teaValue) => {
			const summary = stats(points.map((point) => point.val)), denominator = Math.abs(Number(mean));
			const bias = denominator ? Math.abs(summary.m - mean) / denominator * 100 : 0;
			return {
				st: summary,
				bias,
				te: bias + 1.65 * summary.cv,
				sigma: summary.cv > 0 && teaValue ? (teaValue - bias) / summary.cv : null
			};
		};
	}
	//#endregion
	//#region src/domain/qc/error-detail.ts
	function createQcErrorDetail(deps) {
		return (rules) => {
			const type = deps.errorType(rules);
			return type === "—" ? {
				type,
				desc: ""
			} : {
				type,
				desc: deps.descriptions[deps.primaryRule(rules)] || ""
			};
		};
	}
	//#endregion
	//#region src/domain/qc/planned-target.ts
	function qcPlannedTarget(levelConfig, lot) {
		if (!levelConfig || !lot || levelConfig.qcLotId === lot.id) return null;
		return (levelConfig.meanSdHistory || []).find((history) => history.qcLotId === lot.id && history.planned) || null;
	}
	//#endregion
	//#region src/domain/qc/point-void-verdict.ts
	function createQcPointVoidVerdict(deps) {
		return (test, point) => {
			if (!test || !point) return {
				level: "ok",
				rules: []
			};
			if (point.lot && String(point.lot) !== String(deps.configuredLot(test, point.level))) return deps.parallelVerdict(test, {
				level: point.level,
				lot: point.lot,
				mean: Number(point.qcMean),
				sd: Number(point.qcSd),
				parallel: true
			}, point.id) || {
				level: "ok",
				rules: []
			};
			return deps.activeVerdict(test, point.id) || {
				level: "ok",
				rules: []
			};
		};
	}
	//#endregion
	//#region src/domain/qc/lot-group-status.ts
	function qcLotGroupOperational(group) {
		return !!group && group.active !== false && group.status !== "stopped" && group.status !== "planned";
	}
	//#endregion
	//#region src/domain/qc/derived-index.ts
	function createQcDerivedIndex(deps) {
		let cached = null;
		const stamp = (state, previous) => {
			const panels = state.qcPanels || [], lots = state.qcLots || [], groups = state.lotGroups || [], transitions = state.lotTransitions || [], tests = state.tests || [], build = !previous, out = build ? [] : null;
			let index = 0, ok = true;
			const check = (value) => {
				if (build) out.push(value);
				else if (ok && previous[index++] !== value) ok = false;
			};
			check(state);
			check(panels);
			check(panels.length);
			check(lots);
			check(lots.length);
			check(groups);
			check(groups.length);
			check(transitions);
			check(transitions.length);
			check(tests);
			check(tests.length);
			if (!build && !ok) return false;
			for (let i = 0; i < panels.length; i++) {
				const panel = panels[i], ids = panel && panel.testIds;
				check(panel);
				check(panel && panel.active);
				check(ids);
				check(ids ? ids.length : -1);
			}
			for (let i = 0; i < groups.length; i++) {
				const group = groups[i], ids = group && group.lotIds;
				check(group);
				check(group && group.active);
				check(group && group.status);
				check(ids);
				check(ids ? ids.length : -1);
			}
			for (let i = 0; i < transitions.length; i++) {
				const transition = transitions[i];
				check(transition);
				check(transition && transition.fromLotId);
				check(transition && transition.toLotId);
				check(transition && transition.status);
			}
			for (let i = 0; i < lots.length; i++) {
				const lot = lots[i];
				check(lot);
				check(lot && lot.id);
			}
			for (let i = 0; i < tests.length; i++) {
				const test = tests[i], levels = test && test.levels;
				check(test);
				check(levels);
				check(levels ? levels.length : -1);
			}
			return build ? out : ok && index === previous.length;
		};
		return (state) => {
			if (cached && stamp(state, cached.stamp) === true) return cached;
			const currentStamp = stamp(state), panels = (state.qcPanels || []).filter((panel) => panel.active !== false), testPanel = /* @__PURE__ */ new Map(), testOrder = /* @__PURE__ */ new Map(), lotGroupByLotId = /* @__PURE__ */ new Map();
			panels.forEach((panel, panelIndex) => (panel.testIds || []).forEach((id, testIndex) => {
				if (!testPanel.has(id)) testPanel.set(id, panel);
				const order = panelIndex * 1e4 + testIndex;
				if (!testOrder.has(id) || order < testOrder.get(id)) testOrder.set(id, order);
			}));
			(state.lotGroups || []).filter(deps.operationalGroup).forEach((group) => (group.lotIds || []).forEach((id) => {
				if (!lotGroupByLotId.has(id)) lotGroupByLotId.set(id, group);
			}));
			const acceptedTransitionToLot = /* @__PURE__ */ new Map();
			(state.lotTransitions || []).filter(deps.switchesLot).forEach((transition) => {
				if (!acceptedTransitionToLot.has(transition.toLotId)) acceptedTransitionToLot.set(transition.toLotId, transition);
			});
			return cached = {
				stamp: currentStamp,
				panels,
				testPanel,
				testOrder,
				lotById: new Map((state.qcLots || []).map((lot) => [lot.id, lot])),
				lotGroupByLotId,
				acceptedTransitionToLot,
				operationalTests: null,
				levels: /* @__PURE__ */ new Map(),
				groups: /* @__PURE__ */ new Map()
			};
		};
	}
	//#endregion
	//#region src/domain/qc/accepted-lot-points.ts
	function createAcceptedLotPoints(deps) {
		return (points, level, within, reject) => {
			const out = [], z = [], keys = [];
			points.forEach((p) => {
				const x = deps.pointTarget(p, level.mean, level.sd);
				z.push(x.z);
				keys.push(x.key);
				if (deps.latestRules(z, (r) => within.has(r), keys).some((r) => reject.has(r))) {
					z.pop();
					keys.pop();
				} else {
					out.push(p);
					if (z.length > 11) {
						z.shift();
						keys.shift();
					}
				}
			});
			return out;
		};
	}
	//#endregion
	//#region src/domain/qc/active-westgard.ts
	function createActiveWestgard(deps) {
		return (views, within, across, verdict) => {
			const rows = views.map((v) => ({
				...v,
				single: v.pts.length ? deps.single(v.pts, v.l.mean, v.l.sd, (r) => within.has(r)) : {
					F: [],
					zs: []
				}
			})), cross = deps.multi(rows.map((v) => ({
				level: v.l.level,
				pts: v.pts,
				mean: v.l.mean,
				sd: v.l.sd
			})), (r) => across.has(r)), byPoint = /* @__PURE__ */ new Map();
			rows.forEach((v) => v.pts.forEach((p, i) => {
				const one = v.single.F[i] || {}, rules = [.../* @__PURE__ */ new Set([...one.rules || [], ...cross.get(p) || []])], supportRules = [.../* @__PURE__ */ new Set([...one.supportRules || [], ...cross.support?.get(p) || []])].filter((r) => !rules.includes(r));
				byPoint.set(p.id, {
					level: verdict(rules),
					rules,
					supportRules,
					z: v.single.zs[i]
				});
			}));
			return {
				views: rows,
				cross,
				byPoint
			};
		};
	}
	//#endregion
	//#region src/domain/qc/cusum-series.ts
	function createCusumSeries(run) {
		return (points, level, config) => points.length ? run(points, level.mean, level.sd, config.k, config.h) : {
			cPos: [],
			cNeg: [],
			flags: [],
			k: config.k,
			h: config.h,
			ma: []
		};
	}
	//#endregion
	//#region src/domain/qc/parallel-westgard.ts
	function createParallelWestgard(run) {
		return (points, column, on, verdict) => {
			const byPoint = /* @__PURE__ */ new Map();
			if (!points.length) return {
				pts: points,
				byPoint
			};
			const wg = run(points, column.mean, column.sd, on);
			points.forEach((p, i) => {
				const f = wg.F[i] || {}, rules = [...new Set(f.rules || [])];
				byPoint.set(p.id, {
					level: verdict(rules),
					rules,
					supportRules: [...new Set(f.supportRules || [])],
					z: wg.zs[i]
				});
			});
			return {
				pts: points,
				byPoint
			};
		};
	}
	//#endregion
	//#region src/domain/qc/entry-columns.ts
	function createQcEntryColumns(deps) {
		return (test) => {
			const out = [];
			deps.levels(test).forEach((l) => {
				out.push({
					key: String(l.level),
					level: l.level,
					lot: l.lot || "",
					mean: l.mean,
					sd: l.sd,
					exp: l.exp,
					applied: l.applied,
					parallel: false
				});
				const p = deps.parallel(test, l.level);
				if (p) out.push({
					key: l.level + "|" + p.lotNo,
					level: l.level,
					lot: p.lotNo,
					mean: p.mean,
					sd: p.sd,
					exp: p.exp,
					applied: "mfg",
					parallel: true
				});
			});
			return out;
		};
	}
	//#endregion
	//#region src/domain/qc/entry-column-points.ts
	function selectEntryColumnPoints(column, operational, lot) {
		return column?.parallel ? lot() : operational();
	}
	//#endregion
	//#region src/domain/sync/snapshot-compare.ts
	function syncCanon(v) {
		if (v == null) return null;
		if (Array.isArray(v)) {
			const a = v.map(syncCanon);
			while (a.length && a[a.length - 1] === null) a.pop();
			return a.length ? a : null;
		}
		if (typeof v !== "object") return v;
		const o = {};
		Object.keys(v).sort().forEach((k) => {
			const x = syncCanon(v[k]);
			if (x !== null) o[k] = x;
		});
		return Object.keys(o).length ? o : null;
	}
	function syncedShape(state, keys) {
		const out = {};
		keys.forEach((k) => {
			const v = syncCanon(state?.[k]);
			if (v !== null) out[k] = v;
		});
		return out;
	}
	function syncJsonMap(value) {
		const out = {};
		Object.keys(value || {}).forEach((key) => out[key] = JSON.stringify(value[key]));
		return out;
	}
	//#endregion
	//#region src/domain/sync/array-merge.ts
	var syncItemKey = (v) => v?.id != null ? "#" + String(v.id) : "~" + JSON.stringify(v);
	function mergeSyncArray(local = [], remote = [], base = [], deletes = false) {
		const map = (a) => new Map(a.map((x) => [syncItemKey(x), x])), l = map(local), r = map(remote), b = map(base);
		return [...new Set([...remote, ...local].map(syncItemKey))].flatMap((k) => {
			const x = l.get(k), y = r.get(k), z = b.get(k), xs = x === void 0 ? null : JSON.stringify(x), ys = y === void 0 ? null : JSON.stringify(y), zs = z === void 0 ? null : JSON.stringify(z);
			if (deletes && zs != null) {
				if (xs == null && ys == null) return [];
				if (xs == null) return ys === zs ? [] : [y];
				if (ys == null) return xs === zs ? [] : [x];
			}
			const win = xs != null && xs !== zs ? x : ys != null && ys !== zs ? y : y ?? x;
			return win ? [win] : [];
		});
	}
	function mergeSyncBranch(local, remote, base, key) {
		const l = local[key] || {}, r = remote[key] || {}, b = base && base[key] || {}, out = {};
		(/* @__PURE__ */ new Set([
			...Object.keys(l),
			...Object.keys(r),
			...Object.keys(b)
		])).forEach((id) => {
			if (id in b && !(id in l)) return;
			const v = mergeSyncArray(l[id], r[id], b[id]);
			if (v.length) out[id] = v;
		});
		return out;
	}
	//#endregion
	//#region src/domain/sync/state-merge.ts
	function createSyncStateMerge(deps) {
		return (local, remote, base) => {
			const out = deps.clone(remote), ls = deps.snap(local), bs = deps.snap(base).keys;
			deps.top.forEach((k) => {
				if (deps.lists.has(k)) out[k] = deps.array(local[k], remote[k], (base || {})[k], true);
				else if (ls.keys[k] !== bs[k]) out[k] = deps.cloud(local[k]);
			});
			out.data = deps.branch(local, remote, base, "data");
			out.sigmaData = deps.branch(local, remote, base, "sigmaData");
			return out;
		};
	}
	function uniqueSyncUsers(users) {
		const seen = /* @__PURE__ */ new Set();
		return (users || []).filter((u) => {
			const k = String(u?.username || "").toLowerCase();
			if (!k) return true;
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	}
	//#endregion
	//#region src/domain/sync/update-payload.ts
	function createSyncUpdateBuilder(deps) {
		let baseRef, baseCache;
		const baseSnapshot = (base) => {
			if (base === baseRef && baseCache) return baseCache;
			const snap = deps.snapshot(base);
			baseRef = base;
			baseCache = snap;
			return snap;
		}, add = (payload, next, base, current, path) => {
			Object.keys(next).forEach((id) => {
				if (next[id] !== base[id]) payload[path + "/" + id] = current[id];
			});
			Object.keys(base).forEach((id) => {
				if (!(id in next)) payload[path + "/" + id] = null;
			});
		}, build = (current, base) => {
			const next = deps.snapshot(current), previous = baseSnapshot(base), payload = {};
			deps.top.forEach((key) => {
				if (next.keys[key] !== previous.keys[key]) payload[key] = current[key] === void 0 ? null : current[key];
			});
			add(payload, next.data, previous.data, current.data || {}, "data");
			add(payload, next.sigma, previous.sigma, current.sigmaData || {}, "sigmaData");
			return { payload };
		};
		return {
			baseSnapshot,
			build
		};
	}
	//#endregion
	//#region src/domain/sync/snapshot-keys.ts
	function createSyncSnapshot(top, mapJson) {
		return (value) => {
			const source = value || {}, keys = {};
			top.forEach((key) => keys[key] = JSON.stringify(source[key] === void 0 ? null : source[key]));
			return {
				keys,
				data: mapJson(source.data),
				sigma: mapJson(source.sigmaData)
			};
		};
	}
	//#endregion
	//#region src/domain/sync/retry-scheduler.ts
	function createSyncRetryScheduler(clock) {
		const reset = (retry) => {
			if (retry.timer !== null) clock.clearTimeout(retry.timer);
			return {
				timer: null,
				delay: 1e3
			};
		}, schedule = (input) => {
			const retry = input.retry;
			if (!input.dirty || !input.writable || !input.online || retry.timer !== null) return retry;
			return {
				timer: clock.setTimeout(input.retryFn, retry.delay),
				delay: Math.min(3e4, retry.delay * 2)
			};
		};
		return {
			reset,
			schedule
		};
	}
	//#endregion
	//#region src/domain/sync/first-connect.ts
	function hasSyncContent(source, keys) {
		if (!source) return false;
		if (Object.values(source.data || {}).some((rows) => Array.isArray(rows) && rows.length)) return true;
		return keys.some((key) => (source[key] || []).length);
	}
	function createFirstConnectMerge(deps) {
		return (local, remote) => {
			const out = deps.merge(local, remote, null);
			deps.top.forEach((key) => {
				if (!deps.lists.has(key)) out[key] = deps.cloud(remote[key]);
			});
			out.users = deps.uniqueUsers(out.users || []);
			return out;
		};
	}
	//#endregion
	//#region src/domain/qc/run-id-normalizer.ts
	function createRunIdNormalizer(run) {
		return (source) => {
			(source.tests || []).forEach((test) => {
				const rows = source.data?.[test.id] || [], seen = /* @__PURE__ */ new Set(), conflicts = /* @__PURE__ */ new Set();
				rows.forEach((point) => {
					if (point.voided) return;
					const key = [
						point.date || "",
						point.level,
						point.lot || ""
					].join("|"), runKey = key + "\0" + (point.runId || "");
					if (seen.has(runKey)) conflicts.add(key);
					else seen.add(runKey);
				});
				if (!conflicts.size) return;
				const groups = new Map([...conflicts].map((key) => [key, []]));
				rows.forEach((point, index) => {
					if (point.voided) return;
					const key = [
						point.date || "",
						point.level,
						point.lot || ""
					].join("|");
					if (groups.has(key)) groups.get(key)?.push(index);
				});
				groups.forEach((group) => group.sort((left, right) => run(rows[left]) - run(rows[right]) || left - right).forEach((index, order) => {
					const point = rows[index];
					if (point.date) point.runId = `${point.date}-${order + 1}`;
				}));
			});
		};
	}
	//#endregion
	//#region src/domain/qc/point-lot-normalizer.ts
	function createPointLotNormalizer(deps) {
		return (source) => {
			(source.tests || []).forEach((test) => (source.data?.[test.id] || []).forEach((point) => {
				const level = (test.levels || []).find((item) => item.level === point.level);
				if (!level) return;
				if (!point.id) point.id = deps.id();
				if (point.lot == null) point.lot = level.lot || "";
				if (point.qcMean == null) point.qcMean = level.mean;
				if (point.qcSd == null) point.qcSd = level.sd;
				if (!point.runId) point.runId = (point.date || deps.today()) + "-1";
			}));
			deps.normalizeRuns(source);
		};
	}
	//#endregion
	//#region src/domain/qc/lot-lineage.ts
	function qcLotLineage(index, currentLotId) {
		const chain = [], seen = /* @__PURE__ */ new Set();
		let current = index.lotById.get(currentLotId);
		while (current && !seen.has(current.id)) {
			chain.unshift(current);
			seen.add(current.id);
			const transition = index.acceptedTransitionToLot.get(current.id);
			current = transition ? index.lotById.get(transition.fromLotId) : null;
		}
		return chain;
	}
	//#endregion
	//#region src/domain/qc/operational-access.ts
	var qcLevelConfig = (test, level) => (test?.levels || []).find((item) => item.level === level);
	function createQcOperationalAccess(deps) {
		const canEnter = (test, level) => {
			const config = qcLevelConfig(test, +level);
			return !!(config && deps.test(test) && deps.levels(test).includes(config));
		}, lotPoints = (test, level, withIndex = false) => {
			const config = qcLevelConfig(test, level);
			if (!config || !deps.panel(test) || !deps.group(config)) return [];
			return deps.activePoints(test, level, withIndex);
		}, lotGroupInUse = (group, tests) => !!(group && (tests || []).some((test) => (test.levels || []).some((level) => level.qcLotId && (group.lotIds || []).includes(level.qcLotId)))), selectLabel = (test, list) => {
			const levels = deps.test(test) ? deps.levels(test) : test.levels || [], lots = [...new Set(levels.map((level) => level.lot).filter(Boolean))], same = (list || []).filter((item) => String(item.name || "").trim().toLowerCase() === String(test.name || "").trim().toLowerCase()).length > 1;
			return `${deps.display(test)}${lots.length ? " · LOT " + lots.join("/") : ""}${same && test.machine ? " · " + test.machine : ""}`;
		};
		return {
			canEnter,
			lotPoints,
			lotGroupInUse,
			selectLabel
		};
	}
	//#endregion
	//#region src/domain/qc/parallel-lot-lookup.ts
	function createParallelLotLookup(deps) {
		return (test, level) => {
			const config = deps.level(test, +level);
			if (!config || !config.qcLotId) return null;
			const panel = deps.panel(test);
			if (!panel) return null;
			const transition = (deps.transitions() || []).find((item) => item && item.status === "active" && item.panelId === panel.id && item.fromLotId === config.qcLotId);
			if (!transition) return null;
			const lot = (deps.lots() || []).find((item) => item.id === transition.toLotId);
			if (!lot || +lot.level !== +config.level) return null;
			const target = deps.target(test, config.level, lot.id, lot.lotNo);
			if (!target || !Number.isFinite(+target.mean) || !(+target.sd > 0)) return null;
			return {
				tr: transition,
				lot,
				lotNo: lot.lotNo || "",
				mean: +target.mean,
				sd: +target.sd,
				low: target.low,
				high: target.high,
				exp: lot.exp || ""
			};
		};
	}
	//#endregion
	//#region src/domain/westgard/worker-job.ts
	function createWestgardWorkerJob(deps) {
		return (test, generation, revision) => ({
			type: "compute",
			generation,
			revision,
			testId: test.id,
			ruleActions: { ...test.ruleActions || {} },
			ruleScopes: { ...test.ruleScopes || {} },
			globalRules: { ...deps.globalRules() || {} },
			levels: deps.levels(test).map((level) => ({
				level: level.level,
				mean: level.mean,
				sd: level.sd,
				lot: level.lot || ""
			})),
			points: (deps.points(test.id) || []).filter((point) => !point.voided).map((point) => ({
				id: point.id,
				val: point.val,
				qcMean: point.qcMean,
				qcSd: point.qcSd,
				date: point.date,
				runId: point.runId,
				level: point.level,
				lot: point.lot || ""
			}))
		});
	}
	//#endregion
	//#region src/domain/westgard/worker-revision.ts
	function createWestgardWorkerRevisionService() {
		const revision = (revisions, testId) => revisions.get(String(testId || "")) || 0, invalidateTest = (revisions, pending, testId) => {
			const id = String(testId || ""), next = revision(revisions, id) + 1;
			revisions.set(id, next);
			pending.delete(id);
			return next;
		}, invalidateAll = (revisions, pending, generation) => {
			revisions.clear();
			pending.clear();
			return generation + 1;
		}, settle = (pending, testId, revisionValue) => {
			if (pending.get(testId) === revisionValue) pending.delete(testId);
		}, markPending = (pending, testId, revisionValue) => {
			if (pending.get(testId) === revisionValue) return false;
			pending.set(testId, revisionValue);
			return true;
		};
		return {
			revision,
			invalidateTest,
			invalidateAll,
			settle,
			markPending
		};
	}
	//#endregion
	//#region src/domain/westgard/worker-hydrate.ts
	function hydrateWestgardWorkerResult(message, deps) {
		const test = deps.test(message.testId);
		if (!test) return false;
		const cross = /* @__PURE__ */ new Map(), resultLevels = new Map((message.levels || []).map((level) => [String(level.level), level])), views = [], crossSupport = /* @__PURE__ */ new Map(), byPoint = /* @__PURE__ */ new Map();
		for (const level of deps.levels(test)) {
			const points = deps.points(test, level.level), source = resultLevels.get(String(level.level));
			if (!source || source.points.length !== points.length) return false;
			const rows = new Map(source.points.map((row) => [row.id, row])), F = [], zs = [];
			for (const point of points) {
				const row = rows.get(point.id);
				if (!row) return false;
				const singleRules = row.singleRules || [], crossRules = row.crossRules || [], singleSupportRules = row.singleSupportRules || [], crossSupportRules = row.crossSupportRules || [];
				F.push({
					level: deps.verdict(test, singleRules),
					rules: singleRules,
					supportRules: singleSupportRules
				});
				zs.push(row.z);
				if (crossRules.length) cross.set(point, crossRules);
				if (crossSupportRules.length) crossSupport.set(point, crossSupportRules);
				byPoint.set(point.id, {
					level: row.level,
					rules: row.rules || [],
					supportRules: row.supportRules || [],
					z: row.z
				});
			}
			views.push({
				l: level,
				pts: points,
				single: {
					F,
					zs
				}
			});
		}
		cross.support = crossSupport;
		deps.setMemo(test.id, {
			views,
			cross,
			byPoint
		});
		return true;
	}
	//#endregion
	//#region src/domain/westgard/worker-prewarm.ts
	function createWestgardWorkerPrewarmPlanner(threshold) {
		const worthwhile = (workerAvailable, failed, tests, count) => {
			if (!workerAvailable || failed) return false;
			let total = 0;
			for (const test of tests || []) {
				total += count(test);
				if (total >= threshold) return true;
			}
			return false;
		}, missing = (tests, memo) => (tests || []).filter((test) => !memo.has(test.id));
		return {
			worthwhile,
			missing
		};
	}
	//#endregion
	//#region src/domain/qc/lot-history-view-model.ts
	function previousLotHistory(level, lineage, meanSd, points) {
		if (!level) return [];
		return lineage.filter((x) => (x.lotNo || "") !== (level.lot || "")).map((x) => {
			const m = meanSd(x.lotNo), p = points(x.lotNo);
			return m && p.length ? {
				lot: x.lotNo,
				mean: m.mean,
				sd: m.sd,
				pts: p
			} : null;
		}).filter(Boolean);
	}
	function lotGroupLevels(group, tests, lots) {
		const ids = new Set(group?.lotIds || []), out = [];
		tests.forEach((t) => (t.levels || []).forEach((l) => {
			let lot, mean = NaN, sd = NaN;
			if (ids.has(l.qcLotId)) {
				lot = lots.get(l.qcLotId);
				mean = +l.mean;
				sd = +l.sd;
			} else {
				const h = (l.meanSdHistory || []).slice().reverse().find((x) => ids.has(x.qcLotId));
				if (h) {
					lot = lots.get(h.qcLotId);
					mean = +h.mean;
					sd = +h.sd;
				}
			}
			if (lot && Number.isFinite(mean) && Number.isFinite(sd) && sd > 0) out.push({
				t,
				l,
				lot,
				mean,
				sd
			});
		}));
		return out.sort((a, b) => String(a.t.name || "").localeCompare(String(b.t.name || ""), "vi") || a.l.level - b.l.level);
	}
	//#endregion
	//#region src/application/qc/point-cache-service.ts
	function createPointCacheService(data, run) {
		const base = /* @__PURE__ */ new Map(), indexed = /* @__PURE__ */ new Map(), lots = /* @__PURE__ */ new Map(), sort = (a, b) => String(a.date || "").localeCompare(String(b.date || "")) || run(a) - run(b), clear = (id) => {
			if (id == null) {
				base.clear();
				indexed.clear();
				lots.clear();
				return;
			}
			const prefix = String(id) + "|";
			[
				base,
				indexed,
				lots
			].forEach((cache) => [...cache.keys()].forEach((key) => {
				if (String(key).startsWith(prefix)) cache.delete(key);
			}));
		}, points = (id, l, idx = false) => {
			const k = id + "|" + l, src = data()[id] || [], m = idx ? indexed : base, h = m.get(k);
			if (h && h.src === src && h.len === src.length) return h.a;
			const a = src.map((p, i) => idx ? {
				...p,
				_idx: i
			} : p).filter((p) => +p.level === +l && !p.voided).sort((a, b) => sort(a, b) || (idx ? a._idx - b._idx : 0));
			m.set(k, {
				src,
				len: src.length,
				a
			});
			return a;
		};
		return {
			points,
			lot: (id, l, lot, idx = false) => points(id, l, idx).filter((p) => (p.lot || "") === (lot || "")),
			clear
		};
	}
	//#endregion
	//#region src/application/storage/storage-serialize-policy.ts
	function createStorageSerializePolicy(clock) {
		let revision = -1, raw = "", bytes = 0, ms = 0, count = 0;
		return {
			serialize: (state, current) => {
				if (revision === current && raw) return raw;
				const start = clock();
				raw = JSON.stringify(state);
				ms = clock() - start;
				bytes = raw.length;
				count++;
				revision = current;
				return raw;
			},
			delay: () => bytes > 8388608 || ms > 30 ? 1200 : bytes > 2097152 || ms > 10 ? 700 : 400,
			stats: () => ({
				bytes,
				ms,
				count
			}),
			invalidate: () => {
				revision = -1;
				raw = "";
			}
		};
	}
	//#endregion
	//#region src/application/storage/save-scheduler.ts
	function createSaveScheduler(api) {
		let timeout = null, idle = null;
		const cancel = () => {
			api.clearTimeout(timeout);
			timeout = null;
			if (idle !== null && api.cancelIdle) api.cancelIdle(idle);
			idle = null;
		};
		return {
			cancel,
			schedule: (delay, run) => {
				cancel();
				timeout = api.setTimeout(run, delay);
			}
		};
	}
	//#endregion
	//#region src/application/storage/retry-delay.ts
	function storageRetryDelay(failures) {
		return Math.min(3e4, 1e3 * Math.pow(2, Math.min(Number(failures) || 0, 5)));
	}
	//#endregion
	//#region src/application/storage/derived-save-policy.ts
	function saveDerivedTestIds(opts = {}) {
		if (opts.clearDerived === false) return null;
		const ids = Array.isArray(opts.testIds) ? opts.testIds : opts.testId ? [opts.testId] : [];
		return [...new Set(ids.filter(Boolean))];
	}
	//#endregion
	//#region src/application/storage/save-command-policy.ts
	var idsFor = (options) => Array.isArray(options.testIds) ? options.testIds : options.testId ? [options.testId] : [];
	var storageIdsFor = (options) => {
		const ids = idsFor(options);
		return ids.length ? ids : options.sigmaTestId ? [options.sigmaTestId] : [];
	};
	function saveCommandPlan(options = {}) {
		const derivedTestIds = options.clearDerived === false ? null : [...new Set(idsFor(options).filter(Boolean))];
		const storageTestIds = [...new Set(storageIdsFor(options).filter(Boolean).map(String))];
		return Object.freeze({
			derivedTestIds,
			storageTestIds,
			fullDirty: !storageTestIds.length && options.clearDerived !== false,
			persistSigmaDraft: !!options.sigmaTestId,
			pushCloud: options.cloud !== false
		});
	}
	//#endregion
	//#region src/application/storage/storage-boot-service.ts
	function createStorageBootService(deps) {
		const load = () => {
			if (deps.partitionedSupported()) try {
				const raw = deps.readBootRecord();
				if (raw) {
					const record = JSON.parse(raw);
					if (!record.shell || record.slot !== "a" && record.slot !== "b") throw new Error("Partition boot record khong hop le.");
					deps.activatePartitionShell(record.shell, record.slot);
					return true;
				}
			} catch {
				try {
					deps.discardBootRecord();
				} catch {}
			}
			return deps.loadLegacy();
		};
		const loadBootState = async () => {
			const localOk = load();
			if (localOk && deps.localLoadStatus() !== "partition-shell") deps.recoverPendingSigmaDraft();
			const status = deps.localLoadStatus();
			if (status === "local" || status === "partition-shell" || !deps.partitionedSupported()) return localOk;
			const restored = await deps.restoreFromIndexedDb();
			if (restored) deps.recoverPendingSigmaDraft();
			return restored || localOk;
		};
		return Object.freeze({
			load,
			loadBootState
		});
	}
	//#endregion
	//#region src/application/storage/indexeddb-recovery-service.ts
	function createIndexedDbRecoveryService(deps) {
		const restore = async () => {
			if (!deps.supported()) return false;
			try {
				const partitioned = await deps.readPartitioned();
				if (partitioned?.state) {
					deps.adopt(partitioned.state);
					deps.acceptPartitioned(partitioned);
					return true;
				}
			} catch (error) {
				deps.reportFailure("partitioned", error);
				return false;
			}
			let record;
			try {
				record = await deps.readLegacy();
			} catch {
				return false;
			}
			let parsed = record?.state;
			if (!parsed && record?.json) try {
				parsed = JSON.parse(String(record.json));
			} catch (error) {
				deps.reportFailure("legacy", error, String(record.json));
				return false;
			}
			if (!parsed) return false;
			try {
				deps.adopt(parsed);
				deps.acceptLegacy();
				return true;
			} catch (error) {
				deps.reportFailure("legacy", error, JSON.stringify(parsed));
				return false;
			}
		};
		return Object.freeze({ restore });
	}
	//#endregion
	//#region src/application/storage/partition-hydration-service.ts
	function createPartitionHydrationService(deps) {
		const hydrate = async () => {
			try {
				const record = await deps.read();
				if (!record?.state) throw new Error("Khong tim thay cac phan vung du lieu QC.");
				deps.adopt(record.state);
				deps.recoverPendingSigmaDraft();
				deps.accept(record);
				return true;
			} catch (error) {
				deps.reportFailure(error);
				return false;
			}
		};
		return Object.freeze({ hydrate });
	}
	//#endregion
	//#region src/application/storage/indexeddb-mirror-service.ts
	function createIndexedDbMirrorService(deps) {
		const mirror = (raw, state) => {
			if (!deps.supported()) return false;
			(deps.writeSerialized(raw) || deps.writeState(state)).catch(deps.failed);
			return true;
		};
		return Object.freeze({ mirror });
	}
	//#endregion
	//#region src/application/storage/local-storage-load-service.ts
	function createLocalStorageLoadService(deps) {
		const load = () => {
			let raw;
			try {
				raw = deps.read();
			} catch (error) {
				deps.rejectedRead(error);
				return false;
			}
			if (!raw) return deps.adoptEmpty();
			try {
				deps.adopt(JSON.parse(raw));
				deps.accepted();
				return true;
			} catch (error) {
				deps.rejectedInvalid(raw, error);
				return false;
			}
		};
		return Object.freeze({ load });
	}
	//#endregion
	//#region src/application/storage/local-storage-snapshot-writer.ts
	function createLocalStorageSnapshotWriter(deps) {
		const write = (raw, savedAt, quiet) => {
			try {
				deps.set("qclab", raw);
				deps.set("qclab_saved_at", String(savedAt));
				deps.saved(quiet);
				return true;
			} catch {
				try {
					deps.remove("qclab");
					deps.remove("qclab_saved_at");
				} catch {}
				deps.failed(quiet);
				return false;
			}
		};
		return Object.freeze({ write });
	}
	//#endregion
	//#region src/application/storage/partitioned-snapshot-writer.ts
	function createPartitionedSnapshotWriter(deps) {
		const write = (input) => {
			if (input.localLoadStatus === "partition-shell") {
				deps.defer();
				return false;
			}
			const dirtyTestIds = deps.plan(input);
			const pending = deps.writePartitioned(input.state, input.slot, dirtyTestIds).then((result) => {
				if (!result) throw new Error("Khong the ghi snapshot phan vung.");
				deps.completed(result, input);
				return true;
			}).catch(() => {
				deps.failed(input);
				return false;
			});
			deps.setPending(pending);
			return true;
		};
		return Object.freeze({ write });
	}
	//#endregion
	//#region src/application/storage/save-service.ts
	function createSaveService(deps) {
		const save = (options = {}) => {
			const plan = deps.plan(options);
			deps.invalidate(plan.derivedTestIds);
			deps.captureState();
			if (plan.pushCloud) deps.touchCloud();
			deps.prepareStorage(plan, options);
			deps.beginLocalSave();
			if (plan.pushCloud) deps.scheduleCloud();
		};
		return Object.freeze({ save });
	}
	//#endregion
	//#region src/application/sync/firebase-local-store-service.ts
	function createFirebaseLocalStoreService(deps) {
		const store = (state) => {
			if (deps.persistSnapshot()) return;
			const raw = deps.serialize(state);
			try {
				deps.writeLocal(raw);
			} catch {}
			deps.mirror(raw);
		};
		return Object.freeze({ store });
	}
	//#endregion
	//#region src/application/sync/firebase-disconnect-service.ts
	function createFirebaseDisconnectService(deps) {
		const disconnect = (clearAuthUser = false) => {
			deps.stopPolling();
			deps.cancelPendingPush();
			deps.resetRetry();
			deps.detachListener();
			deps.resetSession(clearAuthUser);
		};
		return Object.freeze({ disconnect });
	}
	//#endregion
	//#region src/application/sync/firebase-push-service.ts
	function createFirebasePushService(deps) {
		const flush = async (connection) => {
			if (!deps.canPush(connection) || !deps.auditMaySync()) return false;
			const prepared = deps.prepare();
			if (!Object.keys(prepared.payload).length) {
				deps.noChanges(prepared.draftStamp);
				return true;
			}
			deps.beforeWrite();
			try {
				await deps.update(connection.ref, prepared.payload);
				deps.succeeded(prepared.current, prepared.draftStamp);
				return true;
			} catch {
				deps.failed();
				return false;
			}
		};
		return Object.freeze({ flush });
	}
	//#endregion
	//#region src/application/sync/firebase-full-sync-service.ts
	function createFirebaseFullSyncService(deps) {
		const sync = async (connection) => {
			if (!deps.canSync(connection) || !deps.auditMaySync()) return false;
			const prepared = deps.prepare();
			deps.beforeWrite();
			try {
				await deps.write(connection.ref, prepared.payload);
				deps.succeeded(prepared.payload, prepared.draftStamp);
				return true;
			} catch (error) {
				deps.failed();
				throw error;
			}
		};
		return Object.freeze({ sync });
	}
	//#endregion
	//#region src/application/sync/firebase-push-scheduler.ts
	function createFirebasePushScheduler(deps) {
		const schedule = (connection, timer) => {
			if (!deps.canWrite(connection)) return timer;
			if (!deps.networkOnline()) {
				deps.offline();
				return timer;
			}
			deps.resetRetry();
			deps.clearTimer(timer);
			deps.queued();
			return deps.setTimer(deps.flush, 500);
		};
		return Object.freeze({ schedule });
	}
	//#endregion
	//#region src/domain/sync/firebase-empty-snapshot.ts
	function firebaseEmptySnapshotPlan(initialized, dirty, hasLocalContent) {
		const firstSnapshot = !initialized;
		return {
			firstSnapshot,
			push: dirty || firstSnapshot && hasLocalContent
		};
	}
	//#endregion
	//#region src/application/sync/firebase-empty-snapshot-service.ts
	function createFirebaseEmptySnapshotService(deps) {
		const handle = (input) => {
			const plan = firebaseEmptySnapshotPlan(input.initialized, input.dirty, input.hasLocalContent);
			deps.setReady();
			deps.clearSynced();
			deps.connected();
			if (plan.push) deps.schedulePush();
			else if (!input.silent) deps.readyWithoutPush();
		};
		return Object.freeze({ handle });
	}
	//#endregion
	//#region src/application/sync/firebase-own-snapshot-service.ts
	function createFirebaseOwnSnapshotService(deps) {
		const handle = (remote, silent) => {
			deps.setReady();
			deps.setBaseline(remote);
			deps.clearDirty();
			deps.resetRetry();
			deps.connected();
			if (!silent) deps.synchronized();
		};
		return Object.freeze({ handle });
	}
	//#endregion
	//#region src/application/sync/firebase-invalid-snapshot-service.ts
	function createFirebaseInvalidSnapshotService(deps) {
		const handle = (firstError) => {
			deps.setReady();
			deps.report(firstError);
		};
		return Object.freeze({ handle });
	}
	//#endregion
	//#region src/application/sync/firebase-audit-rejection-service.ts
	function createFirebaseAuditRejectionService(deps) {
		const reject = (source, result) => {
			const where = result && Number(result.brokenIndex) >= 0 ? ` dòng ${Number(result.brokenIndex) + 1}` : "";
			deps.disconnect();
			deps.disconnected();
			deps.report(`${source}${where}: ${result?.reason || "chuỗi hash bị hỏng"} · dữ liệu cục bộ được giữ nguyên`);
			return false;
		};
		return Object.freeze({ reject });
	}
	//#endregion
	//#region src/application/sync/firebase-remote-render-service.ts
	function createFirebaseRemoteRenderService(deps) {
		const apply = () => {
			if (!deps.loggedIn()) {
				deps.received();
				deps.focusLogin();
				return;
			}
			if (deps.unsafe()) {
				deps.deferred();
				deps.clearPending();
				deps.defer(apply, 1500);
				return;
			}
			deps.clearPending();
			deps.received();
			deps.rerender();
		};
		return Object.freeze({ apply });
	}
	//#endregion
	//#region src/application/sync/firebase-session-start-service.ts
	function createFirebaseSessionStartService(deps) {
		const start = async (config) => {
			try {
				await deps.ensureApp(config.config);
				await deps.persistAuth();
				let user = await deps.currentAuthUser();
				if (!user && config.anonymous) user = await deps.signInAnonymously();
				if (!user) {
					deps.unauthenticated();
					return false;
				}
				deps.setAuthUser(user);
				deps.disconnect();
				const ref = deps.createRef();
				deps.setRef(ref);
				deps.subscribe(ref);
				deps.startPull();
				deps.loading();
				return true;
			} catch (error) {
				deps.failed(error);
				return false;
			}
		};
		return Object.freeze({ start });
	}
	//#endregion
	//#region src/application/sync/firebase-merge-commit-service.ts
	function createFirebaseMergeCommitService(deps) {
		const commit = (input) => {
			const previous = deps.state();
			const next = deps.merge(input.base, input.mergeFirstConnect, previous, input.remote);
			deps.replaceState(next);
			deps.relinkAudit(next);
			deps.clearDerived();
			deps.ensureShape();
			const errors = deps.invariantErrors(deps.state());
			if (errors.length) {
				deps.replaceState(previous);
				deps.clearDerived();
				deps.rejected(previous, input.hadLocalChanges, errors[0]);
				return false;
			}
			deps.accepted(deps.state(), input.remote);
			return true;
		};
		return Object.freeze({ commit });
	}
	//#endregion
	//#region src/presentation/sync/firebase-conflict-dialog-service.ts
	function createFirebaseConflictDialogService(confirm) {
		const ask = (labCode) => confirm({
			kicker: "Thao tác không thể hoàn tác",
			title: "Dữ liệu cục bộ khác dữ liệu trung tâm",
			message: `Phòng "${labCode || "default"}" đã có một bộ dữ liệu khác trên đám mây.`,
			detail: "Dùng dữ liệu trung tâm sẽ thay thế dữ liệu trên máy này; các mục chỉ có cục bộ (máy XN, panel, lô, điểm QC...) sẽ không được giữ lại. Chọn Giữ dữ liệu cục bộ để ngắt đồng bộ và bảo vệ dữ liệu trên máy này.",
			confirmLabel: "Dùng dữ liệu trung tâm",
			cancelLabel: "Giữ dữ liệu cục bộ",
			danger: true
		});
		return Object.freeze({ ask });
	}
	//#endregion
	//#region src/presentation/sync/firebase-cloud-status-presentation.ts
	function createFirebaseCloudStatusPresentation(find) {
		const set = (text, connected) => {
			const element = find("cloudStatus");
			if (!element) return;
			const safe = String(text ?? "").replace(/[&<>"']/g, (character) => ({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				"\"": "&quot;",
				"'": "&#39;"
			})[character]);
			element.className = `cloud ${connected ? "connected" : "offline"}`;
			element.innerHTML = connected ? `<b>Đang kết nối</b><small>${safe}</small>` : safe;
		};
		return Object.freeze({ set });
	}
	//#endregion
	//#region src/presentation/sync/firebase-save-status-service.ts
	function createFirebaseSaveStatusService(find) {
		const mark = (label, detail = "") => {
			const element = find("saveStatus");
			if (element) element.innerHTML = `Lưu trữ: <b>${label}</b>${detail ? `<br>${detail}` : ""}`;
		};
		return Object.freeze({ mark });
	}
	//#endregion
	//#region src/presentation/sync/firebase-remote-render-safety-service.ts
	function createFirebaseRemoteRenderSafetyService(deps) {
		const unsafe = () => deps.modalOpen() || deps.editingFieldFocused();
		return Object.freeze({ unsafe });
	}
	//#endregion
	//#region src/application/sync/firebase-app-service.ts
	function createFirebaseAppService(deps) {
		const ensure = async (config) => {
			const sdk = deps.sdk();
			if (!sdk || typeof sdk.initializeApp !== "function") throw new Error("Chưa tải được Firebase.");
			const desired = deps.signature(config), apps = sdk.apps || [];
			if (apps.length) {
				const app = typeof sdk.app === "function" ? sdk.app() : apps[0];
				if (deps.signature(app?.options || {}) === desired) return app;
				await Promise.all(apps.slice().map((item) => item && typeof item.delete === "function" ? item.delete() : Promise.resolve()));
			}
			return sdk.initializeApp(config);
		};
		return Object.freeze({ ensure });
	}
	//#endregion
	//#region src/application/sync/firebase-config-source-service.ts
	function createFirebaseConfigSourceService(deps) {
		const deploy = () => {
			const cloud = deps.cloud();
			if (!cloud || !cloud.config) return null;
			return {
				labCode: cloud.labCode || "khoaXN",
				email: cloud.email || (cloud.anonymous ? "anonymous" : ""),
				anonymous: cloud.anonymous !== false,
				config: cloud.config,
				deploy: true,
				locked: cloud.locked === true
			};
		};
		const stored = () => {
			try {
				const value = JSON.parse(deps.readStored() || "null");
				return value && typeof value === "object" ? {
					...value,
					anonymous: value.anonymous === true
				} : null;
			} catch {
				return null;
			}
		};
		return Object.freeze({
			deploy,
			stored
		});
	}
	//#endregion
	//#region src/domain/sync/firebase-ready-state.ts
	function firebaseReadyState(current) {
		return {
			...current,
			initialized: true,
			ready: true
		};
	}
	//#endregion
	//#region src/application/sync/firebase-config-parser.ts
	var requiredKeys = [
		"apiKey",
		"authDomain",
		"databaseURL",
		"projectId",
		"appId"
	];
	function validateFirebaseConfig(config) {
		if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Firebase config phải là một object.");
		const value = config;
		const missing = requiredKeys.filter((key) => !String(value[key] || "").trim());
		if (missing.length) throw new Error("Firebase config thiếu: " + missing.join(", ") + ".");
		return value;
	}
	function parseFirebaseConfig(raw) {
		const input = String(raw || "").trim();
		if (!input) throw new Error("Dán Firebase config trước khi kết nối.");
		try {
			return validateFirebaseConfig(JSON.parse(input));
		} catch {}
		const start = input.indexOf("{");
		const end = input.lastIndexOf("}");
		if (start < 0 || end <= start) throw new Error("Không tìm thấy object firebaseConfig. Hãy dán đoạn Config từ Firebase console.");
		const normalized = input.slice(start, end + 1).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, "$1\"$2\":").replace(/,\s*([}\]])/g, "$1");
		try {
			return validateFirebaseConfig(JSON.parse(normalized));
		} catch {
			throw new Error("Firebase config không hợp lệ. Có thể dán nguyên đoạn từ tab Config của Firebase console, ví dụ: const firebaseConfig = { ... };");
		}
	}
	//#endregion
	//#region src/presentation/settings/storage-usage.ts
	function storageBytesText(bytes) {
		const amount = Math.max(0, Number(bytes) || 0);
		const units = [
			"B",
			"KB",
			"MB",
			"GB",
			"TB"
		];
		let value = amount;
		let unit = 0;
		while (value >= 1024 && unit < units.length - 1) {
			value /= 1024;
			unit++;
		}
		return (value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value).toLocaleString("vi-VN")) + " " + units[unit];
	}
	function storageUsageText(data, estimate) {
		const points = Object.values(data || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
		if (!estimate || typeof estimate !== "object") return `Số điểm QC: ${points.toLocaleString("vi-VN")}.\n\nTrình duyệt này không cung cấp thông tin hạn mức lưu trữ.`;
		const usage = Math.max(0, Number(estimate.usage) || 0);
		const quota = Math.max(0, Number(estimate.quota) || 0);
		const indexed = estimate.usageDetails && Number.isFinite(Number(estimate.usageDetails.indexedDB)) ? Math.max(0, Number(estimate.usageDetails.indexedDB)) : null;
		const ratio = quota ? Math.min(100, usage / quota * 100) : null;
		return `Số điểm QC: ${points.toLocaleString("vi-VN")}.\nDung lượng IndexedDB: ${indexed == null ? "trình duyệt không tách riêng" : storageBytesText(indexed)}.\nTổng dung lượng app đang dùng: ${storageBytesText(usage)}${quota ? " / " + storageBytesText(quota) : ""}${ratio == null ? "" : " (" + ratio.toFixed(2) + "%)"}.`;
	}
	//#endregion
	//#region src/presentation/settings/brand-profile.ts
	function createBrandProfile(cleanText) {
		return (lab) => {
			const value = lab || {};
			return {
				brandTitle: cleanText(value.brandTitle || "QC Lab", 80),
				brandSub: cleanText(value.brandSub || "Nội kiểm xét nghiệm", 120),
				logoText: cleanText(value.logoText || "QC", 8).slice(0, 4),
				logoData: cleanText(value.logoData || "", 12e4)
			};
		};
	}
	//#endregion
	//#region src/presentation/settings/firebase-acl-help.ts
	function firebaseAclHelp(labCode, uid) {
		const code = String(labCode || "");
		return `Đăng nhập Firebase đã thành công nhưng tài khoản chưa có quyền với mã phòng "${code}".\n\nVào Realtime Database → Data và tạo:\nqclab-acl/${code}/${String(uid || "UID_TAI_KHOAN_FIREBASE")} = true\n\nSau đó bấm Lưu & kết nối lại.`;
	}
	//#endregion
	//#region src/presentation/settings/firebase-rules.ts
	function firebaseRulesText() {
		return `{
  "rules": {
    ".read": false,
    ".write": false,
    "qclab-acl": {
      "$labCode": {
        "$uid": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": false
        }
      }
    },
    "qclab-shared": {
      "$labCode": {
        ".read":  "auth != null && root.child('qclab-acl').child($labCode).child(auth.uid).exists()",
        ".write": "auth != null && root.child('qclab-acl').child($labCode).child(auth.uid).exists()",
        ".validate": "newData.hasChildren(['_ts'])",
        "_ts": { ".validate": "newData.isNumber()" },
        "_client": { ".validate": "newData.isString()" }
      }
    }
  }
}`;
	}
	//#endregion
	//#region src/presentation/settings/firebase-guide-html.ts
	function firebaseGuideStep(number, title, body) {
		return `<div class="fb-step"><div class="fb-num">${number}</div><div class="fb-step-body"><h4>${title}</h4>${body}</div></div>`;
	}
	function firebaseGuideHtml() {
		return `<details class="firebase-guide"><summary>Hướng dẫn Firebase chi tiết</summary>
    <div class="firebase-guide-body">
      ${firebaseGuideStep(1, "Bật đăng nhập Email/Password", "<p>Firebase Console → Authentication → Sign-in method: tắt <b>Anonymous</b>, bật <b>Email/Password</b>.</p>")}
      ${firebaseGuideStep(2, "Tạo tài khoản, lấy UID", "<p>Authentication → Users → Add user — mỗi máy/người 1 tài khoản, sau đó copy <b>User UID</b>.</p>")}
      ${firebaseGuideStep(3, "Thêm UID vào danh sách được phép", "<p>Realtime Database → Data, tạo đúng cấu trúc theo mã phòng (labCode) đang dùng:</p><pre>qclab-acl\n  khoaXN\n    UID_TAI_KHOAN_1: true\n    UID_TAI_KHOAN_2: true</pre><p>Đổi labCode thành <code>labA</code> thì ACL nằm ở <code>qclab-acl/labA/{uid}</code>.</p>")}
      ${firebaseGuideStep(4, "Dán Rules", "<p>Realtime Database → Rules → dán nguyên nội dung khung <b>Firebase Rules</b> bên dưới → Publish. Không sửa <code>$labCode</code>/<code>$uid</code>.</p>")}
      ${firebaseGuideStep(5, "Kết nối trong app", "<p>Thẻ Đồng bộ Đám mây → nhập labCode, email/mật khẩu, dán Firebase config → bấm <b>Lưu &amp; kết nối</b>.</p>")}
    </div>
  </details>`;
	}
	//#endregion
	//#region src/presentation/backup/backup-reminder.ts
	function createBackupReminder(deps) {
		const dayMs = deps.dayMs || 864e5;
		const lastBackupInfo = (raw) => {
			if (!raw) return {
				never: true,
				days: Infinity
			};
			const timestamp = new Date(String(raw)).getTime();
			if (Number.isNaN(timestamp)) return {
				never: true,
				days: Infinity
			};
			return {
				never: false,
				ts: timestamp,
				days: Math.floor((deps.now() - timestamp) / dayMs)
			};
		};
		const statusText = (cloudReady, info) => {
			if (cloudReady) return "Đang đồng bộ đám mây — đã có bản sao từ xa.";
			if (info.never) return "Chưa sao lưu trên máy này.";
			if (info.days <= 0) return "Sao lưu gần nhất: hôm nay.";
			return "Sao lưu gần nhất: " + info.days + " ngày trước.";
		};
		const capacityText = (bytes, maxBytes, sizeMb, warning) => {
			const value = Number(bytes) || 0;
			const limit = Number(maxBytes) / 1024 / 1024;
			if (!value) return `Khuyến nghị dưới ${limit} MB.`;
			return `Backup gần nhất ${sizeMb(value)} MB (khuyến nghị dưới ${limit} MB).` + (warning(value) ? " Gần mức khuyến nghị." : "");
		};
		const overdue = (cloudReady, info, remindDays) => !cloudReady && info.days >= Number(remindDays);
		const banner = (cloudReady, currentUser, info, remindDays) => {
			if (!currentUser || !overdue(cloudReady, info, remindDays)) return {
				hidden: true,
				className: "",
				text: "",
				title: ""
			};
			const text = info.never ? "Chưa sao lưu" : "Sao lưu: " + info.days + " ngày";
			const title = (info.never ? "Bạn chưa sao lưu dữ liệu trên máy này." : "Đã " + info.days + " ngày chưa sao lưu dữ liệu.") + " Dữ liệu lưu trong trình duyệt — nhấn để xuất backup ngay.";
			return {
				hidden: false,
				className: "backup-dot" + (info.never ? " crit" : ""),
				text,
				title
			};
		};
		return {
			lastBackupInfo,
			statusText,
			capacityText,
			overdue,
			banner
		};
	}
	//#endregion
	//#region src/presentation/lis/lis-queue-presentation.ts
	function createLisQueuePresentation(deps) {
		const valueText = (record) => {
			const message = record.message || {}, resolved = record.resolved;
			const test = resolved && resolved.ok ? deps.test(resolved.qclabTestId) : null;
			return (test ? deps.formatTestValue(test, message.value) : deps.format(message.value, 3)) + (message.unit ? " " + deps.escape(message.unit) : "");
		};
		const onclick = (functionName, messageId) => deps.escapeAttribute(`${functionName}('${deps.quoteJs(messageId)}')`);
		const rowHtml = (record) => {
			const message = record.message || {}, resolved = record.resolved;
			const when = deps.formatDateTime(message.measuredAt) || message.measuredAt || "—";
			if (resolved && resolved.ok) {
				const test = deps.test(resolved.qclabTestId);
				const name = deps.testDisplayName(test) || resolved.displayName || resolved.qclabTestId;
				return `<tr><td>${deps.escape(when)}</td><td><b>${deps.escape(name)}</b><div class="hint">M${deps.escape(resolved.level)} · Lô ${deps.escape(resolved.lot || "—")}</div></td><td class="num">${valueText(record)}</td><td>${deps.escape(message.runId || "—")}${message.operator ? " · " + deps.escape(message.operator) : ""}</td><td class="acts">${deps.button("Nhận", onclick("lisQueueImport", message.messageId), "teal sm")}${deps.button("Bỏ", onclick("lisQueueReject", message.messageId), "ghost sm")}</td></tr>`;
			}
			return `<tr><td>${deps.escape(when)}</td><td><b>${deps.escape(message.analyzerId)}/${deps.escape(message.testCode)}</b><div class="hint">${deps.escape(resolved && resolved.reason || "Chưa khớp cấu hình")}</div></td><td class="num">${valueText(record)}</td><td>${deps.escape(message.runId || "—")}${message.operator ? " · " + deps.escape(message.operator) : ""}</td><td class="acts">${deps.button("Bỏ", onclick("lisQueueReject", message.messageId), "ghost sm")}</td></tr>`;
		};
		const sectionHtml = (title, records, emptyText) => {
			if (!records.length) return `<h4>${deps.escape(title)}</h4><div class="hint">${deps.escape(emptyText)}</div>`;
			const rows = records.map(rowHtml).join("");
			return `<h4>${deps.escape(title)} (${records.length})</h4><div class="table-wrap"><table class="lis-queue-table"><thead><tr><th>Thời gian đo</th><th>Xét nghiệm</th><th class="num">Giá trị</th><th>Lần chạy · NV</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
		};
		const modalHtml = (pending, unresolved) => {
			const body = pending.length || unresolved.length ? sectionHtml("Sẵn sàng nhận", pending, "") + (unresolved.length ? `<div class="flow-panel">${sectionHtml("Chưa khớp cấu hình", unresolved, "")}</div>` : "") : deps.emptyState("Hàng chờ trống", "Không có kết quả QC nào đang chờ từ LIS Gateway.", "");
			return `<div class="modal" style="width:820px"><div class="modal-h"><h3>QC chờ nhập từ LIS</h3>${deps.modalCloseButton("closeModal()")}</div><div class="modal-b" tabindex="0">${body}</div><div class="modal-f">${deps.button("Làm mới", "lisQueueRefresh()", "ghost")}${deps.button("Đóng", "closeModal()", "ghost")}</div></div>`;
		};
		return {
			valueText,
			onclick,
			rowHtml,
			sectionHtml,
			modalHtml
		};
	}
	//#endregion
	//#region src/application/lis/lis-settings-service.ts
	function createLisSettingsService(normalizeGatewayUrl) {
		const prepare = (input) => {
			const enabled = !!input.enabled;
			const url = normalizeGatewayUrl(input.url);
			const token = String(input.token || "").trim() || String(input.savedToken || "");
			if (!url) return {
				ok: false,
				error: "invalid-url"
			};
			if (enabled && !token) return {
				ok: false,
				error: "missing-token"
			};
			return {
				ok: true,
				settings: {
					enabled,
					url,
					token
				}
			};
		};
		return { prepare };
	}
	//#endregion
	//#region src/application/settings/lab-profile-service.ts
	function createLabProfileService(cleanText, brandProfile) {
		const updateLab = (current, input) => ({
			...current || {},
			name: cleanText(input.name),
			dept: cleanText(input.dept),
			address: cleanText(input.address, 5e3)
		});
		const updateBrand = (current, input) => ({
			...current || {},
			...brandProfile({
				brandTitle: input.brandTitle || "QC Lab",
				brandSub: input.brandSub || "Nội kiểm xét nghiệm",
				logoText: input.logoText || "QC",
				logoData: current && current.logoData
			})
		});
		const updateLogo = (current, logoData) => ({
			...current || {},
			logoData: String(logoData || "")
		});
		const clearLogo = (current) => updateLogo(current, "");
		return {
			updateLab,
			updateBrand,
			updateLogo,
			clearLogo
		};
	}
	//#endregion
	//#region src/application/sync/firebase-settings-service.ts
	function createFirebaseSettingsService(parseConfig) {
		const prepare = (input) => {
			const config = parseConfig(input.config);
			const labCode = String(input.labCode || "").trim() || "default";
			const email = String(input.email || "").trim();
			const password = String(input.password || "");
			if (!email || !password) return {
				ok: false,
				error: "missing-credentials"
			};
			return {
				ok: true,
				labCode,
				email,
				password,
				config
			};
		};
		return { prepare };
	}
	//#endregion
	//#region src/presentation/settings/brand-preview-html.ts
	function createBrandPreviewHtml(escape, escapeAttribute) {
		return (input) => {
			const logo = input.logo;
			return `<div class="brand-preview"><div class="brand-mark">${logo ? `<img src="${escapeAttribute(logo)}" alt="">` : escape(input.markText)}</div><div><b>${escape(input.title)}</b><small>${escape(input.subtitle)}</small></div></div>`;
		};
	}
	//#endregion
	//#region src/presentation/settings/unit-profile-html.ts
	function createUnitProfileHtml(deps) {
		return (lab) => {
			const value = lab || {};
			return `<div class="panel"><h2 class="panel-title">Thông tin đơn vị</h2>
      <div class="settings-unit-fields"><div><label>Tên bệnh viện / đơn vị</label><input id="labName" aria-label="Tên bệnh viện / đơn vị" value="${deps.escapeAttribute(value.name || "")}"></div>
        <div><label>Khoa / phòng</label><input id="labDept" aria-label="Khoa / phòng" value="${deps.escapeAttribute(value.dept || "")}"></div>
        <div><label>Địa chỉ</label><input id="labAddr" aria-label="Địa chỉ" value="${deps.escapeAttribute(value.address || "")}"></div></div>
     <div class="settings-panel-actions">${deps.button("Lưu thông tin", "saveLab()", "teal")}</div>
    </div>`;
		};
	}
	//#endregion
	//#region src/presentation/settings/brand-panel-html.ts
	function createBrandPanelHtml(deps) {
		return (input) => `<div class="panel"><h2 class="panel-title">Logo & tên phần mềm</h2>
     <div class="grid2">
       <div>
         <label>Tên hiển thị trên thanh bên</label><input id="brandTitle" aria-label="Tên hiển thị trên thanh bên" value="${deps.escapeAttribute(input.title || "")}">
         <label>Dòng phụ</label><input id="brandSub" aria-label="Dòng phụ" value="${deps.escapeAttribute(input.subtitle || "")}">
         <label>Chữ trong logo khi chưa dùng ảnh</label><input id="logoText" aria-label="Chữ trong logo khi chưa dùng ảnh" maxlength="4" value="${deps.escapeAttribute(input.markText || "")}">
       </div>
       <div>
         <label>Logo hiện tại</label>${input.previewHtml || ""}
         <label>Chọn ảnh logo</label>
         <div class="file-pick">${deps.button("Chọn tệp", "document.getElementById('logoFile').click()", "ghost sm", "", { attrs: { type: "button" } })}<span id="logoFileName" class="hint">Chưa chọn tệp</span></div>
         <input id="logoFile" type="file" accept="image/*" style="display:none" onchange="pickLogo(event)">
         <div class="hint settings-brand-note">Nên dùng ảnh vuông PNG/JPG, dung lượng nhỏ. Logo được lưu cùng dữ liệu phần mềm.</div>
       </div>
     </div>
     <div class="settings-panel-actions">${deps.button("Lưu logo", "saveBrand()", "teal")}${deps.button("Bỏ ảnh logo", "clearLogo()", "ghost")}</div>
    </div>`;
	}
	//#endregion
	//#region src/presentation/settings/admin-tools-html.ts
	function createAdminToolsHtml(button) {
		return (backupStatus, backupCapacity) => `<div class="panel"><h2 class="panel-title">Quản trị dữ liệu</h2>
     <div class="admin-tools">
        <div class="admin-tool"><b>Xuất backup</b><span>Lưu dữ liệu hiện tại ra file. ${backupStatus} ${backupCapacity}</span>${button("Xuất backup", "exportData()", "ghost")}</div>
        <div class="admin-tool"><b>Nhập backup</b><span>Khôi phục dữ liệu từ file backup đã xuất. Chỉ quản trị viên được nhập.</span>${button("Chọn file backup", "document.getElementById('imp').click()", "ghost")}<input id="imp" type="file" accept="application/json" style="display:none" onchange="importData(event)"></div>
        <div class="admin-tool"><b>Kiểm tra backup</b><span>Kiểm tra checksum, cấu trúc và số điểm — không ảnh hưởng dữ liệu đang dùng.</span>${button("Chọn file để kiểm tra", "document.getElementById('verifyBackup').click()", "ghost")}<input id="verifyBackup" type="file" accept="application/json" style="display:none" onchange="verifyBackupFile(event)"></div>
        <div class="admin-tool"><b>Dung lượng cục bộ</b><span>Xem số điểm QC và dung lượng trình duyệt đang dùng.</span>${button("Kiểm tra dung lượng", "checkStorageUsage()", "ghost")}</div>
        <div class="admin-tool"><b>Xóa sạch dữ liệu test</b><span>Xóa toàn bộ dữ liệu, giữ lại tài khoản đang đăng nhập.</span>${button("Xóa sạch dữ liệu", "resetAllData()", "danger")}</div>
      </div></div>`;
	}
	//#endregion
	//#region src/presentation/settings/firebase-rules-panel-html.ts
	function createFirebaseRulesPanelHtml(deps) {
		return (guideHtml, rulesText) => `<div class="panel"><h2 class="panel-title">Firebase Rules</h2>
     ${guideHtml}
     <div class="rules-tools"><span>Copy cố định vào Realtime Database → Rules. Không sửa <code>$labCode</code> hoặc <code>$uid</code>.</span>${deps.button("Copy rules", "copyFirebaseRules()", "ghost sm")}</div>
     <pre class="rules-code" tabindex="0">${deps.escape(rulesText)}</pre></div>`;
	}
	//#endregion
	//#region src/presentation/settings/lis-gateway-panel-html.ts
	function createLisGatewayPanelHtml(deps) {
		return (input) => {
			const status = input.status === "ok" ? "ok" : input.status === "error" ? "rej" : "";
			const token = String(input.token || "");
			return `<div class="panel lis-gateway-panel"><h2 class="panel-title">LIS Gateway (thử nghiệm)</h2>
     <div class="lis-gateway-body"><div class="lis-gateway-grid"><div><label for="lisGatewayUrl">Địa chỉ Gateway cục bộ</label><input id="lisGatewayUrl" value="${deps.escapeAttribute(input.url || "")}" placeholder="http://127.0.0.1:8787"></div><div><label for="lisGatewayToken">Bearer token${token ? " (đã lưu — để trống nếu giữ nguyên)" : ""}</label><input id="lisGatewayToken" type="password" autocomplete="off" placeholder="${token ? "••••••••" : "Dán token in ra khi chạy npm run lis:gateway"}"></div><label class="lis-gateway-toggle"><input id="lisGatewayEnabled" type="checkbox" ${input.enabled ? "checked" : ""}><span>Tự động kiểm tra hàng chờ mỗi 5 phút</span></label></div>
       <div id="lisGatewayStatus" class="alert ${status}">${deps.escape(input.statusText || "")}</div>
       <div class="hint">Lấy kết quả nội kiểm mà middleware LIS đã đẩy vào Gateway. Kết quả KHÔNG tự thành điểm QC — phải mở hàng chờ và xác nhận từng dòng thì mới ghi vào dữ liệu nội kiểm. Không nhận dữ liệu bệnh nhân. Prototype chỉ cho phép localhost:8787.</div></div>
     <div class="settings-panel-actions">${deps.button("Lưu &amp; kiểm tra", "lisGatewaySaveSettings()", "teal")}${deps.button("Xem hàng chờ QC", "lisOpenQueueModal()", "ghost")}</div></div>`;
		};
	}
	//#endregion
	//#region src/presentation/settings/firebase-connection-panel-html.ts
	function createFirebaseConnectionPanelHtml(deps) {
		return (input) => {
			const locked = !!input.locked;
			const readOnly = locked ? "readonly" : "";
			const config = input.config ? JSON.stringify(input.config, null, 2) : "";
			const lockNote = locked ? `<div class="hint flow-note">Bản deploy này khóa sẵn <code>${deps.escape(input.dataPath || "")}</code>. Muốn đổi mã phòng cần sửa <code>assets/modules/app-meta.js</code>.</div>` : "";
			return `<div class="panel firebase-sync-panel"><h2 class="panel-title">Đồng bộ Đám mây (Firebase Realtime Database)</h2>
     <div class="firebase-auth-grid"><div><label>Mã phòng</label><input id="fbCode" aria-label="Mã phòng" value="${deps.escapeAttribute(input.labCode || "khoaXN")}" ${readOnly}></div>
       <div><label>Email Firebase Authentication</label><input id="fbEmail" aria-label="Email Firebase Authentication" type="email" autocomplete="username" value="${deps.escapeAttribute(input.email || "")}"></div>
       <div><label>Mật khẩu Firebase</label><input id="fbPassword" type="password" autocomplete="current-password" placeholder="Chỉ dùng để đăng nhập, không lưu"></div></div>
     ${lockNote}
     <label>Firebase config (dán nguyên đoạn từ tab Config của Firebase console)</label>
     <textarea id="fbConfig" class="firebase-config-input" ${readOnly} placeholder='const firebaseConfig = {
  apiKey: "...",
  authDomain: "yourapp.firebaseapp.com",
  databaseURL: "https://yourapp-default-rtdb.firebaseio.com",
  projectId: "yourapp",
  storageBucket: "yourapp.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};'>${deps.escape(config)}</textarea>
     <div class="firebase-actions">${deps.button("Lưu &amp; kết nối", "saveFb()", "teal")} ${deps.button("Ngắt đám mây", "clearFb()", "ghost")}</div></div>`;
		};
	}
	//#endregion
	//#region src/presentation/settings/settings-page-layout-html.ts
	function createSettingsPageLayoutHtml(head) {
		return (input) => head("Cài đặt & Đồng bộ", "Thông tin đơn vị, backup và kết nối Firebase") + `<div class="settings-profile-grid">${input.profileHtml}</div>${input.adminHtml}<div class="settings-cloud-grid">${input.firebaseHtml}${input.lisHtml}</div>${input.rulesHtml}`;
	}
	//#endregion
	//#region src/application/storage/indexeddb-open-service.ts
	function createIndexedDbOpenService(deps) {
		const databaseName = deps.databaseName || "qclab-local", databaseVersion = deps.databaseVersion || 1, storeName = deps.storeName || "snapshots";
		let pending = null;
		const open = () => {
			const indexedDb = deps.indexedDb();
			if (!indexedDb) return Promise.resolve(null);
			if (pending) return pending;
			pending = new Promise((resolve, reject) => {
				let request;
				try {
					request = indexedDb.open(databaseName, databaseVersion);
				} catch (error) {
					reject(error);
					return;
				}
				request.onupgradeneeded = () => {
					if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath: "key" });
				};
				request.onsuccess = () => {
					const database = request.result;
					database.onversionchange = () => {
						database.close();
						pending = null;
					};
					resolve(database);
				};
				request.onerror = () => reject(request.error || /* @__PURE__ */ new Error("IndexedDB open failed"));
				request.onblocked = () => reject(/* @__PURE__ */ new Error("IndexedDB is blocked"));
			}).catch((error) => {
				pending = null;
				throw error;
			});
			return pending;
		};
		return Object.freeze({ open });
	}
	//#endregion
	//#region src/application/storage/indexeddb-record-service.ts
	function createIndexedDbRecordService(deps) {
		const storeName = deps.storeName || "snapshots";
		const request = (mode, run, empty, message) => deps.open().then((database) => new Promise((resolve, reject) => {
			if (!database) {
				resolve(empty);
				return;
			}
			const operation = run(database.transaction(storeName, mode).objectStore(storeName));
			operation.onsuccess = () => resolve(operation.result === void 0 ? empty : operation.result);
			operation.onerror = () => reject(operation.error || new Error(message));
		}));
		return Object.freeze({
			get: (key) => request("readonly", (store) => store.get(key), null, "IndexedDB read failed"),
			put: (record) => request("readwrite", (store) => store.put(record), false, "IndexedDB write failed").then(() => true),
			delete: (key) => request("readwrite", (store) => store.delete(key), false, "IndexedDB clear failed").then(() => true)
		});
	}
	//#endregion
	//#region src/application/storage/partitioned-indexeddb-write-service.ts
	function createPartitionedIndexedDbWriteService(deps) {
		const write = async (input) => {
			if (!deps.supported()) return false;
			const manifest = input.currentSlot === "a" || input.currentSlot === "b" ? await input.read(deps.key(input.currentSlot, "manifest")) : null;
			const draft = deps.draft(input.state, input.currentSlot, input.dirtyTestIds, manifest);
			const slotManifest = draft.incremental ? manifest : await input.read(deps.key(draft.slot, "manifest"));
			const plan = deps.finalize(input.state, manifest, slotManifest, draft);
			await Promise.all([input.put({
				key: deps.key(plan.slot, "shell"),
				savedAt: plan.savedAt,
				state: plan.shell
			}), ...plan.partitions.map((testId) => input.put({
				key: deps.key(plan.slot, "data", testId),
				savedAt: plan.savedAt,
				testId,
				points: plan.data[testId] || []
			}))]);
			await input.put({
				key: deps.key(plan.slot, "manifest"),
				savedAt: plan.savedAt,
				slot: plan.slot,
				testIds: plan.testIds
			});
			await input.put({
				key: "partition:latest",
				savedAt: plan.savedAt,
				slot: plan.slot
			});
			await Promise.all(plan.removedTestIds.map((testId) => input.remove(deps.key(plan.slot, "data", testId))));
			return {
				slot: plan.slot,
				savedAt: plan.savedAt,
				shell: plan.shell,
				mode: plan.incremental ? "incremental" : "full",
				partitionsWritten: plan.partitions.length
			};
		};
		return Object.freeze({ write });
	}
	//#endregion
	//#region src/application/storage/partitioned-indexeddb-read-service.ts
	function createPartitionedIndexedDbReadService(deps) {
		const readSlot = async (slot, get) => {
			if (slot !== "a" && slot !== "b") return null;
			const manifest = await get(deps.key(slot, "manifest")), shell = await get(deps.key(slot, "shell"));
			const testIds = manifest && Array.isArray(manifest.testIds) ? manifest.testIds : [];
			const rows = await Promise.all(testIds.map((testId) => get(deps.key(slot, "data", testId))));
			return deps.recover(slot, manifest, shell, rows);
		};
		const read = async (slot, get) => {
			if (!deps.supported()) return null;
			if (slot) return readSlot(slot, get);
			const latest = await get("partition:latest"), slots = deps.slots(latest && latest.slot);
			return await readSlot(slots[0], get) || await readSlot(slots[1], get);
		};
		return Object.freeze({ read });
	}
	//#endregion
	//#region src/application/storage/indexeddb-clear-service.ts
	function createIndexedDbClearService(deps) {
		const clear = async (read, remove) => {
			if (!deps.supported()) return false;
			const manifests = await Promise.all(["a", "b"].map((slot) => read(deps.key(slot, "manifest"))));
			await Promise.all(deps.keys(manifests).map(remove));
			return true;
		};
		return Object.freeze({ clear });
	}
	//#endregion
	//#region src/domain/auth/password-policy.ts
	function passwordPolicyError(value) {
		const password = String(value || "");
		if (!password) return "Mật khẩu không được để trống.";
		if (password.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự.";
		return "";
	}
	function passwordChangeError(password, confirmation) {
		const policyError = passwordPolicyError(password);
		if (policyError) return policyError;
		if (String(password || "") !== String(confirmation || "")) return "Hai mật khẩu không khớp.";
		return "";
	}
	//#endregion
	//#region src/domain/auth/pbkdf2-password-service.ts
	var PASSWORD_HASH_ITERATIONS = 6e5;
	function isPbkdf2PasswordHash(stored) {
		return String(stored || "").startsWith("pbkdf2$");
	}
	function passwordHashNeedsUpgrade(stored) {
		if (!isPbkdf2PasswordHash(stored)) return true;
		return Number(String(stored).split("$")[1] || 0) < PASSWORD_HASH_ITERATIONS;
	}
	function passwordBytesHex(bytes) {
		return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	function passwordHexBytes(value) {
		return new Uint8Array((String(value || "").match(/.{1,2}/g) || []).map((hex) => parseInt(hex, 16)));
	}
	function createPbkdf2PasswordService(dependencies) {
		const secureCrypto = () => {
			const value = dependencies.crypto();
			if (!value || !value.subtle) throw new Error("Trình duyệt không hỗ trợ mã hóa mật khẩu an toàn.");
			return value;
		};
		const derive = async (password, salt, iterations) => {
			const crypto = secureCrypto();
			const key = await crypto.subtle.importKey("raw", dependencies.textEncoder().encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
			const bits = await crypto.subtle.deriveBits({
				name: "PBKDF2",
				hash: "SHA-256",
				salt,
				iterations
			}, key, 256);
			return passwordBytesHex(new Uint8Array(bits));
		};
		return {
			async hash(password) {
				const salt = secureCrypto().getRandomValues(/* @__PURE__ */ new Uint8Array(16));
				return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${passwordBytesHex(salt)}$${await derive(password, salt, PASSWORD_HASH_ITERATIONS)}`;
			},
			async verify(password, stored) {
				const [, iterationsText, saltHex, expected] = String(stored || "").split("$");
				return await derive(password, passwordHexBytes(saltHex), Number(iterationsText)) === expected;
			}
		};
	}
	//#endregion
	//#region src/domain/auth/legacy-password-hash-service.ts
	function createLegacyPasswordHashService(dependencies) {
		const fallback = (password) => {
			let hash = 0;
			const text = `qclab::${String(password || "")}`;
			for (let index = 0; index < text.length; index += 1) hash = hash * 31 + text.charCodeAt(index) >>> 0;
			return `f${hash.toString(16)}`;
		};
		return { async hash(password) {
			try {
				const crypto = dependencies.crypto();
				if (!crypto?.subtle) return fallback(password);
				const digest = await crypto.subtle.digest("SHA-256", dependencies.textEncoder().encode(`qclab::${String(password || "")}`));
				return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
			} catch {
				return fallback(password);
			}
		} };
	}
	var LOGIN_LOCKOUT_MILLISECONDS = 3e4;
	function normalizeLoginLockoutState(value) {
		const lockout = value;
		return {
			fails: lockout && Number(lockout.fails) || 0,
			until: lockout && Number(lockout.until) || 0
		};
	}
	function createLoginLockoutPolicy() {
		const numberOrZero = (value) => Number(value) || 0;
		return {
			isLocked(until, now) {
				return now < numberOrZero(until);
			},
			remainingSeconds(until, now) {
				return Math.ceil((numberOrZero(until) - now) / 1e3);
			},
			recordFailure(current, now) {
				const fails = numberOrZero(current.fails) + 1;
				return fails >= 5 ? {
					fails: 0,
					until: now + LOGIN_LOCKOUT_MILLISECONDS
				} : {
					fails,
					until: numberOrZero(current.until)
				};
			},
			reset() {
				return {
					fails: 0,
					until: 0
				};
			},
			message(until, now) {
				return `Sai mật khẩu quá nhiều lần. Thử lại sau ${Math.ceil((numberOrZero(until) - now) / 1e3)} giây.`;
			}
		};
	}
	//#endregion
	//#region src/application/state/blank-app-state.ts
	function createBlankAppState(options) {
		return {
			lab: {
				name: "",
				dept: "",
				address: "",
				brandTitle: "QC Lab",
				brandSub: "Nội kiểm xét nghiệm",
				logoText: "QC",
				logoData: ""
			},
			tests: [],
			machines: [],
			instruments: [],
			assayGroups: [],
			qcPanels: [],
			lotTransitions: [],
			lotGroups: [],
			qcLots: [],
			data: {},
			actions: [],
			activity: [],
			activityAnchor: "",
			users: Array.isArray(options.users) ? options.users : [],
			reagentTests: [],
			reagentOperators: [],
			reagentSampleTypes: [
				"Mẫu bệnh nhân",
				"Mẫu nội kiểm (IQC)",
				"Mẫu ngoại kiểm (EQA)"
			],
			sigmaData: {},
			periodLocks: [],
			teaRefs: [],
			teaRegistryVersion: options.teaRegistryVersion,
			westgardRules: { ...options.westgardDefaults },
			westgardProfileVersion: 2,
			configMigrationVersion: 1,
			schemaVersion: options.schemaVersion
		};
	}
	function createDefaultAdminUser(input) {
		return {
			id: input.id,
			username: "admin",
			name: "Quản trị viên",
			role: "admin",
			passHash: input.passHash,
			active: true,
			mustChangePassword: true
		};
	}
	//#endregion
	//#region src/domain/auth/new-user-validation.ts
	function newUserValidationError(input) {
		const username = String(input.username || "").trim();
		const password = String(input.password || "");
		if (!username || !password) return "Nhập tên đăng nhập và mật khẩu.";
		const passwordError = passwordPolicyError(password);
		if (passwordError) return passwordError;
		if ((Array.isArray(input.existingUsernames) ? input.existingUsernames : []).some((value) => String(value || "") === username)) return "Tên đăng nhập đã tồn tại.";
		return "";
	}
	//#endregion
	//#region src/domain/auth/user-permission-selection.ts
	function selectUserPermissions(selectedIds, allowedIds) {
		const allowed = new Set(Array.isArray(allowedIds) ? allowedIds.map((value) => String(value)) : []);
		return [...new Set((Array.isArray(selectedIds) ? selectedIds : []).map((value) => String(value)).filter((id) => allowed.has(id)))];
	}
	//#endregion
	//#region src/presentation/audit/activity-audit-filter.ts
	function createActivityAuditFilter(dependencies) {
		const dateKey = (activity) => {
			const date = new Date(activity && activity.ts);
			return Number.isFinite(+date) ? dependencies.isoDate(date) : "";
		};
		return {
			dateKey,
			filter(items, query, from, to) {
				const text = dependencies.searchText(query);
				const start = String(from || ""), end = String(to || "");
				return (Array.isArray(items) ? items : []).filter((activity) => {
					const date = dateKey(activity);
					if (start && (!date || date < start)) return false;
					if (end && (!date || date > end)) return false;
					if (!text) return true;
					return dependencies.searchText([
						activity.seq,
						dependencies.formatDateTime(activity.ts),
						activity.user,
						activity.username,
						dependencies.roleLabel(activity.role || "viewer"),
						activity.type,
						activity.target,
						activity.detail
					].join(" ")).includes(text);
				}).slice().reverse();
			}
		};
	}
	//#endregion
	//#region src/presentation/audit/activity-audit-page-html.ts
	function createActivityAuditPageHtml() {
		return (input) => `${input.head}
    <div class="panel"><h2 class="panel-title">Công cụ</h2><div class="row-flex">
      ${input.exportButton}
      ${input.archiveButton}
      <div class="hint audit-summary-status">${input.total} dòng hoạt động đã ghi nhận. ${input.chainHtml}${input.oversizeWarn}</div>
    </div></div>
    <div class="panel audit-log-panel"><div class="audit-log-head"><h2 class="panel-title">Hoạt động gần đây</h2><input id="auditSearch" type="search" aria-label="Tìm nhật ký hoạt động" placeholder="Tìm người dùng, hành động, đối tượng..." value="${input.searchValue}" oninput="auditSetQuery(this.value)"></div>
      <div class="audit-filterbar"><div><label>Từ ngày</label>${input.fromDate}</div><div><label>Đến ngày</label>${input.toDate}</div><div><label>Số dòng mỗi trang</label><select aria-label="Số dòng nhật ký mỗi trang" onchange="auditSetPageSize(this.value)">${input.pageSizeOptions}</select></div>${input.clearFiltersButton}<div class="audit-filter-summary" role="status">${input.filteredCount}/${input.total} dòng</div></div>
      ${input.rowsOrEmptyState}
      ${input.pagination}</div>`;
	}
	//#endregion
	//#region src/presentation/audit/activity-audit-pagination.ts
	function activityAuditPagination(items, page, pageSize) {
		const rows = Array.isArray(items) ? items : [];
		const size = Math.max(1, Number(pageSize) || 1);
		const pageCount = Math.max(1, Math.ceil(rows.length / size));
		const safePage = Math.min(Math.max(1, Number(page) || 1), pageCount);
		const offset = (safePage - 1) * size;
		return {
			page: safePage,
			pageCount,
			offset,
			rows: rows.slice(offset, offset + size),
			resultFrom: rows.length ? offset + 1 : 0,
			resultTo: Math.min(offset + size, rows.length)
		};
	}
	//#endregion
	//#region src/presentation/audit/activity-audit-csv.ts
	function createActivityAuditCsv(dependencies) {
		return (items) => {
			const rows = [[
				"Seq",
				"Thời gian",
				"Người dùng",
				"Tên đăng nhập",
				"Vai trò",
				"Hành động",
				"Đối tượng",
				"Chi tiết",
				"PrevHash",
				"Hash"
			]];
			(Array.isArray(items) ? items : []).forEach((activity) => rows.push([
				activity.seq || "",
				dependencies.formatDateTime(activity.ts),
				activity.user || "",
				activity.username || "",
				dependencies.roleLabel(activity.role || "viewer"),
				activity.type || "",
				activity.target || "",
				activity.detail || "",
				activity.prevHash || "",
				activity.hash || ""
			]));
			return rows;
		};
	}
	//#endregion
	//#region src/presentation/audit/activity-audit-date-range.ts
	function updateActivityAuditDateRange(current, field, value) {
		let from = String(current.from || ""), to = String(current.to || ""), date = String(value || "");
		if (field === "from") {
			from = date;
			if (from && to && from > to) to = from;
		} else {
			to = date;
			if (to && from && to < from) from = to;
		}
		return {
			from,
			to
		};
	}
	//#endregion
	//#region src/presentation/audit/activity-audit-filter-state.ts
	var ACTIVITY_AUDIT_PAGE_SIZES = Object.freeze([
		25,
		50,
		100
	]);
	var activityAuditFilterState = Object.freeze({
		withQuery(state, value) {
			return {
				...state,
				query: String(value || ""),
				page: 1
			};
		},
		withPageSize(state, value, allowedSizes) {
			const allowed = Array.isArray(allowedSizes) ? allowedSizes.map(Number) : [];
			const size = Number(value);
			return {
				...state,
				pageSize: allowed.includes(size) ? size : 25,
				page: 1
			};
		},
		withPage(state, value) {
			return {
				...state,
				page: Math.max(1, Number(value) || 1)
			};
		},
		cleared(state) {
			return {
				...state,
				query: "",
				from: "",
				to: "",
				page: 1
			};
		}
	});
	//#endregion
	//#region src/presentation/audit/activity-audit-archive-window.ts
	function activityAuditArchiveWindow(value, now = /* @__PURE__ */ new Date()) {
		const months = Math.max(1, Math.floor(Number(value) || 24));
		const cutoff = new Date(now);
		cutoff.setMonth(cutoff.getMonth() - months);
		return {
			months,
			cutoffIso: cutoff.toISOString()
		};
	}
	//#endregion
	//#region src/presentation/auth/user-list-model.ts
	function userListModel(users, currentUserId) {
		return (Array.isArray(users) ? users : []).map((user) => ({
			...user,
			id: String(user.id || ""),
			name: String(user.name || user.username || ""),
			username: String(user.username || ""),
			initials: String(user.initials || ""),
			role: String(user.role || "viewer"),
			active: user.active !== false,
			current: String(user.id || "") === String(currentUserId || "")
		}));
	}
	//#endregion
	//#region src/presentation/auth/user-row-html.ts
	function createUserRowHtml() {
		return ({ user, currentUserId, esc, roleLabel, btn }) => {
			const actions = Boolean(user.current || currentUserId && user.id === currentUserId) ? `<span class="hint">(bạn)</span> ${btn("Đổi mật khẩu", `resetPass('${user.id}')`, "ghost sm")}` : `${btn("Sửa quyền", `openUserPerms('${user.id}')`, "ghost sm")} ${btn("Đặt lại MK", `resetPass('${user.id}')`, "ghost sm")} ${btn(user.active === false ? "Mở khóa" : "Khóa", `toggleUser('${user.id}')`, "ghost sm")} ${btn("Xóa", `delUser('${user.id}')`, "danger sm")}`;
			return `<tr>
    <td><b>${esc(user.name || user.username)}</b><div class="hint">@${esc(user.username)}${user.initials ? " · " + esc(user.initials) : ""}</div></td>
    <td>${roleLabel(user.role)}</td>
    <td>${user.active === false ? "<span class=\"tag rej\">Khóa</span>" : "<span class=\"tag ok\">Hoạt động</span>"}</td>
    <td><div class="user-row-actions">${actions}</div></td></tr>`;
		};
	}
	//#endregion
	//#region src/presentation/auth/users-page-html.ts
	function createUsersPageHtml() {
		return ({ head, rows, roleOptions, permissionChecks, addButton }) => `${head}
   <div class="panel"><h2 class="panel-title">Thêm người dùng</h2><div class="user-create-layout">
     <div class="user-create-card">
       <div class="user-create-card-title">Thông tin tài khoản</div>
       <div class="user-create-fields">
       <div><label>Tên đăng nhập</label><input id="uUser" placeholder="vd: lan.nt"></div>
       <div><label>Họ tên</label><input id="uName" aria-label="Họ tên"></div>
       <div><label>Mã viết tắt</label><input id="uInitials" maxlength="12" placeholder="NTL"></div>
       <div><label>Vai trò</label><select id="uRole" aria-label="Vai trò" onchange="syncUserPermChecks('newUserPerms',this.value)">${roleOptions}</select></div>
       <div><label>Mật khẩu tạm</label><input id="uPass" aria-label="Mật khẩu tạm" type="password" autocomplete="new-password"></div>
       <div class="user-create-actions">${addButton}</div>
       </div>
     </div>
     <div class="user-create-card"><div class="user-create-card-title">Thẻ được phép dùng</div><div class="user-perm-block">${permissionChecks}</div></div>
     </div>
     <div class="hint user-create-hint"><b>Vai trò</b> quyết định quyền sửa/quản trị trong các thẻ được tick. <b>KTV:</b> nhập/sửa dữ liệu vận hành · <b>Chỉ xem:</b> chỉ đọc. Người dùng mới sẽ phải đổi mật khẩu khi đăng nhập lần đầu.</div></div>
   <div class="panel"><h2 class="panel-title">Danh sách người dùng</h2>
     <div class="user-table-wrap"><table class="user-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
	}
	//#endregion
	//#region src/presentation/reagent/reagent-select-options-html.ts
	function createReagentSelectOptionsHtml() {
		return (items, selectedId, escAttr, label) => (Array.isArray(items) ? items : []).map((item) => `<option value="${escAttr(item.id)}"${item.id === selectedId ? " selected" : ""}>${label(item)}</option>`).join("");
	}
	//#endregion
	//#region src/presentation/reagent/reagent-result-html.ts
	function resultVerdict(result, format) {
		const calibrationWarning = !result.passR2 || !result.passSlope;
		if (result.level === "ok") return {
			cls: "ok",
			icon: "✓",
			title: "Kết luận: Đạt tiêu chí sàng lọc phần mềm",
			desc: "Độ chệch trong giới hạn, đủ cỡ mẫu (n≥20) và đã xác nhận bao phủ khoảng đo/điểm quyết định. Lô mới đủ điều kiện trình phê duyệt theo SOP trước khi đưa vào sử dụng cho mẫu bệnh nhân." + (calibrationWarning || !result.passP ? " Lưu ý: một số chỉ số mô tả (P-value/R²/độ dốc) chưa lý tưởng, cần ghi nhận khi phê duyệt." : "")
		};
		if (result.level === "mid") return {
			cls: "mid",
			icon: "!",
			title: "Kết luận: Chưa đủ điều kiện sàng lọc",
			desc: "Độ chệch (%Bias) nằm trong giới hạn cho phép, song chưa đủ cỡ mẫu (n≥20) và/hoặc chưa xác nhận bao phủ khoảng đo/điểm quyết định theo SOP." + (calibrationWarning ? " Ngoài ra hệ số tương quan và/hoặc độ dốc hồi quy chưa đạt, nên kiểm tra hiệu chuẩn." : "") + " Bổ sung dữ liệu hoặc ghi nhận ngoại lệ theo SOP trước khi phê duyệt."
		};
		return {
			cls: "no",
			icon: "✕",
			title: "Kết luận: Hai lô hóa chất có khác biệt",
			desc: "Độ chệch (%Bias) vượt giới hạn cho phép. Không đưa lô mới vào sử dụng cho mẫu bệnh nhân; tiến hành điều tra, xử lý theo quy trình."
		};
	}
	function createReagentResultHtml() {
		return (result, minimumPairs, format, formatT) => {
			if (!result) return {
				statsHtml: `<div class="empty">Nhập tối thiểu ${minimumPairs} cặp giá trị hợp lệ để xem thống kê mô tả; khuyến nghị ≥20 cặp cho sàng lọc phần mềm.</div>`,
				criteriaHtml: "",
				verdictHtml: ""
			};
			const row = (label, value) => `<div class="rc-stat-row"><span>${label}</span><b>${value}</b></div>`;
			const equation = (slope, intercept) => `y = ${format(slope, 4)}x ${intercept >= 0 ? "+" : "−"} ${format(Math.abs(intercept), 4)}`;
			const statsHtml = `<div class="rc-stat-kpis">
      <div class="rc-stat-card"><div class="rc-stat-label">Hệ số tương quan (Pearson r)</div><div class="rc-stat-value">${format(result.r, 4)}</div><div class="rc-stat-sub">R² = ${format(result.fit.r2, 4)}</div></div>
      <div class="rc-stat-card"><div class="rc-stat-label">%Bias</div><div class="rc-stat-value ${result.passBias ? "ok" : "bad"}">${format(result.bias, 3)}%</div><div class="rc-stat-sub">Mong muốn &lt; ${format(result.biasT, 3)}%</div></div>
      <div class="rc-stat-card"><div class="rc-stat-label">P (hai phía / two-tail)</div><div class="rc-stat-value">${format(result.p2, 4)}</div><div class="rc-stat-sub">α = ${format(result.alpha, 4)}</div></div>
    </div><div class="rc-stat-section"><h4>Kiểm định t bắt cặp (t-Test: Paired Two Sample for Means)</h4><div class="rc-stat-columns"><div>${row("Trung bình (Mean) – Lô cũ / Lô mới", `${format(result.mO, 3)} / ${format(result.mN, 3)}`)}${row("Phương sai (Variance) – cũ / mới", `${format(result.vO, 3)} / ${format(result.vN, 3)}`)}${row("Số quan sát (Observations), n", result.N)}${row("Tương quan Pearson (Pearson Correlation)", format(result.r, 5))}${row("Chênh lệch TB giả định (Hypothesized Mean Diff.)", "0")}</div><div>${row("Bậc tự do (df)", result.df)}${row("Giá trị t (t Stat)", formatT(result.tStat))}${row("P(T≤t) một phía (one-tail)", format(result.p1, 5))}${row("t tới hạn một phía (t Critical one-tail)", format(result.tc1, 4))}${row("P(T≤t) hai phía (two-tail)", format(result.p2, 4))}${row("t tới hạn hai phía (t Critical two-tail)", format(result.tc2, 4))}</div></div></div><div class="rc-stat-section"><h4>Hồi quy &amp; độ chệch (Regression &amp; bias)</h4><div class="rc-stat-columns"><div>${row("Hồi quy tuyến tính (OLS)", equation(result.fit.b, result.fit.a))}${row("R² (OLS)", format(result.fit.r2, 5))}</div><div>${row("Passing-Bablok", equation(result.pb.b, result.pb.a))}${row("Chênh lệch tương đối TB theo cặp (Mean abs. rel. diff.)", `${format(result.mard, 3)}%`)}</div></div></div>`;
			const criteriaHtml = [
				[
					result.passBias,
					true,
					"Độ chệch trong giới hạn cho phép (tiêu chí quyết định)",
					`%Bias = ${format(result.bias, 3)}% ${result.passBias ? "<" : "≥"} ${format(result.biasT, 3)}% mong muốn`
				],
				[
					result.enoughN,
					true,
					"Đủ cỡ mẫu sàng lọc (tiêu chí quyết định)",
					`n = ${result.N} ${result.enoughN ? "≥" : "<"} 20 cặp hợp lệ`
				],
				[
					result.coverage,
					true,
					"Bao phủ khoảng đo / điểm quyết định (tiêu chí quyết định)",
					result.coverage ? "Đã xác nhận theo SOP" : "Chưa xác nhận theo SOP"
				],
				[
					result.passP,
					false,
					"Không khác biệt có ý nghĩa thống kê (mô tả)",
					`P(two-tail) = ${format(result.p2, 4)} ${result.passP ? ">" : "≤"} α = ${format(result.alpha, 4)}; không dùng riêng để chấp nhận lô`
				],
				[
					result.passR2,
					false,
					"Tương quan chặt chẽ (mô tả)",
					`R² = ${format(result.fit.r2, 4)}; cần ≥ 0,95 để xem là tương quan chặt`
				],
				[
					result.passSlope,
					false,
					"Độ dốc hồi quy chấp nhận được (mô tả)",
					`Slope = ${format(result.fit.b, 4)}; mục tiêu trong khoảng [0,90 - 1,10]`
				]
			].map(([ok, decision, title, why]) => {
				return `<div class="rc-crit-item"><span class="rc-crit-badge ${decision ? ok ? "pass" : "fail" : ok ? "info" : "note"}">${decision ? ok ? "ĐẠT" : "KHÔNG ĐẠT" : ok ? "TỐT" : "LƯU Ý"}</span><div class="rc-crit-text">${title}<div>${why}</div></div></div>`;
			}).join("");
			const verdict = resultVerdict(result, format);
			return {
				statsHtml,
				criteriaHtml,
				verdictHtml: `<div class="rc-verdict ${verdict.cls}"><div class="rc-verdict-icon">${verdict.icon}</div><div><div class="rc-verdict-title">${verdict.title}</div><div class="rc-verdict-desc">${verdict.desc}</div></div></div>`
			};
		};
	}
	//#endregion
	//#region src/presentation/reagent/reagent-pair-row-html.ts
	function createReagentPairRowHtml() {
		return ({ index, row, readOnly, pair, format, escAttr }) => `<div class="rc-pair-row" data-rc-row="${index}"><div class="rc-idx">${index + 1}</div><input ${readOnly ? "disabled" : ""} value="${escAttr(row?.[0])}" oninput="rcCell(${index},0,this.value)" type="number" step="any" placeholder="–"><input ${readOnly ? "disabled" : ""} value="${escAttr(row?.[1])}" oninput="rcCell(${index},1,this.value)" type="number" step="any" placeholder="–"><div class="rc-calc avg">${pair ? format(pair.avg, 3) : "–"}</div><div class="rc-calc dif ${pair && pair.dif < 0 ? "neg" : ""}">${pair ? format(pair.dif, 3) : "–"}</div>${readOnly ? "<span></span>" : `<button class="x" onclick="rcRmRow(${index})" title="Xóa dòng">✕</button>`}</div>`;
	}
	//#endregion
	//#region src/application/storage/partition-write-policy.ts
	function planPartitionWrite(input) {
		const full = !!input.fullDirty || input.streak >= input.maxIncrementals || input.now - input.lastFull >= input.maxMs;
		return {
			dirtyTestIds: full ? null : input.dirtyTestIds,
			streak: full ? 0 : input.streak + 1,
			lastFull: full ? input.now : input.lastFull
		};
	}
	function createQcValueFormat() {
		const qcValueDecimals = (value) => {
			const text = String(value == null ? "" : value).trim(), match = /^[+-]?(?:\d+(?:[.,](\d+))?|[.,](\d+))(?:e([+-]?\d+))?$/i.exec(text);
			if (!match) return 0;
			const fraction = (match[1] || match[2] || "").length, exponent = Number(match[3] || 0);
			return Math.max(0, Math.min(6, fraction - exponent));
		};
		const testDecimalPlaces = (test, point = null) => {
			const raw = test && test.decimalPlaces, configured = Number(raw);
			if (raw != null && raw !== "" && Number.isInteger(configured) && configured >= 0 && configured <= 6) return configured;
			if (point) {
				const saved = Number(point.valueDecimals), own = Number.isInteger(saved) && saved >= 0 ? saved : qcValueDecimals(point.val);
				return Math.min(6, Math.max(2, own));
			}
			return 2;
		};
		const testStatDecimals = (test) => Math.min(6, Math.max(2, testDecimalPlaces(test) + 2));
		const formatValue = (test, value, point = null) => {
			const number = Number(value);
			return Number.isFinite(number) ? number.toFixed(testDecimalPlaces(test, point)) : "—";
		};
		const formatStat = (test, value) => {
			const number = Number(value);
			return Number.isFinite(number) ? number.toFixed(testStatDecimals(test)) : "—";
		};
		return {
			qcValueDecimals,
			testDecimalPlaces,
			testStatDecimals,
			formatValue,
			formatStat,
			formatPoint: (point, test = null) => formatValue(test, point && point.val, point)
		};
	}
	//#endregion
	//#region src/domain/qc/staff-identity.ts
	function createQcStaffIdentity() {
		const initials = (name) => String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").split(/[^A-Za-z0-9]+/).filter(Boolean).map((value) => value.charAt(0)).join("").toUpperCase().slice(0, 8) || "—";
		return {
			initials,
			point: (point) => {
				const name = String(point && point.operatorName || "").trim();
				return {
					name,
					code: String(point && point.operatorCode || "").trim().toUpperCase() || (name ? initials(name) : "")
				};
			}
		};
	}
	//#endregion
	//#region src/domain/qc/date-format.ts
	function createQcDateFormat(now = () => /* @__PURE__ */ new Date()) {
		const dateObject = (value) => {
			const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
			return match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(value);
		};
		const isoDate = (value = now()) => value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
		return {
			dateObject,
			daysToExpiry: (value) => !value ? null : Math.round((dateObject(value).getTime() - now().getTime()) / 864e5),
			isoDate,
			isoToday: () => isoDate(),
			isoMonth: () => {
				const value = now();
				return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
			},
			vnDate: (value) => {
				if (!value) return "";
				const text = String(value), match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
				return match ? match[3] + "/" + match[2] + "/" + match[1] : text;
			},
			vnPeriod: (value) => {
				if (!value) return "";
				const text = String(value).trim();
				let match = /^(\d{4})-(\d{2})/.exec(text);
				if (match) return "Kỳ " + match[2] + "/" + match[1];
				match = /^(\d{1,2})\/(\d{4})$/.exec(text);
				return match ? "Kỳ " + match[1].padStart(2, "0") + "/" + match[2] : text;
			},
			monthVN: (value) => {
				const match = /^(\d{4})-(\d{2})/.exec(String(value || ""));
				return match ? match[2] + "/" + match[1] : value || "";
			},
			formatDateTimeVN: (value) => {
				const date = new Date(value);
				return isNaN(+date) ? "" : date.toLocaleTimeString("vi-VN", {
					hour: "2-digit",
					minute: "2-digit"
				}) + " " + date.toLocaleDateString("vi-VN");
			}
		};
	}
	//#endregion
	//#region src/domain/qc/lot-target-history.ts
	function createLotTargetHistory(id) {
		const dedupe = (target) => {
			const rows = Array.isArray(target && target.meanSdHistory) ? target.meanSdHistory : [], out = [], indexes = /* @__PURE__ */ new Map();
			rows.forEach((row) => {
				const key = row && row.qcLotId ? "id:" + row.qcLotId : row && row.lot ? "lot:" + row.lot : "";
				if (!key) {
					out.push(row);
					return;
				}
				if (indexes.has(key)) out[indexes.get(key)] = row;
				else {
					indexes.set(key, out.length);
					out.push(row);
				}
			});
			if (target) target.meanSdHistory = out;
			return out;
		};
		const upsert = (target, lot, values) => {
			target.meanSdHistory = Array.isArray(target.meanSdHistory) ? target.meanSdHistory : [];
			const matches = (row) => row && (row.qcLotId ? row.qcLotId === lot.id : (row.lot || "") === (lot.lotNo || "")), existing = target.meanSdHistory.slice().reverse().find(matches), entry = {
				...existing || {},
				...values,
				id: existing && existing.id || id(),
				qcLotId: lot.id,
				lot: lot.lotNo
			};
			target.meanSdHistory = target.meanSdHistory.filter((row) => !matches(row));
			target.meanSdHistory.push(entry);
			return entry;
		};
		return {
			dedupe,
			upsert
		};
	}
	//#endregion
	//#region src/domain/tea/analyte-meta.ts
	function createTeaAnalyteMeta(catalogSource) {
		const key = (value) => String(value == null ? "" : value).trim().toLowerCase();
		let lastCatalog = null, rows = {}, byId = {};
		const registry = () => {
			const catalog = typeof catalogSource === "function" ? catalogSource() : catalogSource;
			if (catalog === lastCatalog) return {
				rows,
				byId
			};
			lastCatalog = catalog;
			rows = Object.freeze(Object.fromEntries((catalog || []).map((row) => {
				const aliases = [row.name, row.abbreviation].filter(Boolean), displayName = row.abbreviation && key(row.abbreviation) !== key(row.name) ? `${row.name} (${row.abbreviation})` : row.name;
				return [key(row.name), Object.freeze({
					analyteId: row.analyteId,
					displayName,
					standardName: row.name,
					abbreviation: row.abbreviation || "",
					aliases: Object.freeze(aliases),
					matrix: row.matrix
				})];
			})));
			byId = Object.freeze(Object.fromEntries(Object.values(rows).map((row) => [row.analyteId, row])));
			return {
				rows,
				byId
			};
		};
		const builtIn = (value) => {
			const current = registry(), normalized = key(value);
			return current.rows[normalized] || Object.values(current.rows).find((row) => row.aliases.some((alias) => key(alias) === normalized)) || {};
		};
		const meta = (name, record) => {
			const current = registry(), custom = record && typeof record === "object" ? record : {}, base = custom.analyteId && current.byId[custom.analyteId] || builtIn(name), aliases = [
				name,
				base.displayName,
				base.standardName,
				base.abbreviation,
				...base.aliases || [],
				custom.displayName,
				custom.standardName,
				custom.abbreviation,
				...custom.aliases || []
			].filter(Boolean);
			return {
				analyteId: custom.analyteId || base.analyteId || "",
				displayName: custom.displayName || base.displayName || name || "",
				standardName: custom.standardName || base.standardName || name || "",
				abbreviation: custom.abbreviation || base.abbreviation || "",
				aliases: [...new Set(aliases)],
				matrix: custom.matrix || base.matrix || ""
			};
		};
		return {
			key,
			builtIn,
			byId: (id) => registry().byId[id] || {},
			meta,
			display: (name, record) => meta(name, record).displayName || name || ""
		};
	}
	//#endregion
	//#region src/domain/qc/level-reconciliation.ts
	function createQcLevelReconciliation() {
		const pruneUnused = (state) => {
			let pruned = 0;
			(state.tests || []).forEach((test) => {
				const levels = Array.isArray(test.levels) ? test.levels : [];
				if (levels.length <= 1) return;
				const points = state.data && state.data[test.id] || [], isUnused = (level) => !level.qcLotId && !(Number.isFinite(+level.sd) && +level.sd > 0) && (!Array.isArray(level.meanSdHistory) || !level.meanSdHistory.length) && !points.some((point) => +point.level === +level.level);
				let kept = levels.filter((level) => !isUnused(level));
				if (!kept.length) kept = [levels[0]];
				if (kept.length !== levels.length) {
					pruned += levels.length - kept.length;
					test.levels = kept;
				}
			});
			return pruned;
		};
		const reconcileSigma = (state) => {
			const lotsById = new Map((state.qcLots || []).filter(Boolean).map((lot) => [String(lot.id), lot])), groupedLotIds = /* @__PURE__ */ new Set();
			(state.lotGroups || []).filter((group) => group && group.active !== false).forEach((group) => (group.lotIds || []).forEach((id) => {
				const lot = lotsById.get(String(id));
				if (lot && (!lot.groupId || String(lot.groupId) === String(group.id || ""))) groupedLotIds.add(String(id));
			}));
			let unlinked = 0, pruned = 0, tests = 0;
			(state.tests || []).forEach((test) => {
				const levels = Array.isArray(test.levels) ? test.levels : [], valid = /* @__PURE__ */ new Set(), orphaned = /* @__PURE__ */ new Set();
				levels.forEach((level) => {
					const key = String(+level.level);
					if (level.qcLotId && groupedLotIds.has(level.qcLotId)) valid.add(key);
					else if (level.qcLotId) {
						orphaned.add(key);
						level.qcLotId = "";
						level.lot = "";
						level.exp = "";
						unlinked++;
					}
				});
				const pruneAllOutsideValid = valid.size > 0;
				if (!pruneAllOutsideValid && !orphaned.size) return;
				let changed = false;
				(state.sigmaData && Array.isArray(state.sigmaData[test.id]) ? state.sigmaData[test.id] : []).forEach((entry) => {
					if (!entry || !entry.lv || typeof entry.lv !== "object") return;
					Object.keys(entry.lv).forEach((key) => {
						if (pruneAllOutsideValid && !valid.has(String(+key)) || orphaned.has(String(+key))) {
							delete entry.lv[key];
							pruned++;
							changed = true;
						}
					});
				});
				if (changed || orphaned.size) tests++;
			});
			return {
				unlinked,
				pruned,
				tests
			};
		};
		return {
			pruneUnused,
			reconcileSigma
		};
	}
	//#endregion
	//#region src/domain/qc/range-limit-repair.ts
	function createRangeLimitRepair(limitsFromTarget) {
		return (state) => {
			let repaired = 0;
			(state.tests || []).forEach((test) => (test.levels || []).forEach((level) => {
				if (level.applied !== "lab") return;
				const next = limitsFromTarget(level.mean, level.sd, 2);
				if (!next) return;
				if (level.low !== next.low || level.high !== next.high || level.rangeK !== 2) {
					level.low = next.low;
					level.high = next.high;
					level.rangeK = 2;
					repaired++;
				}
			}));
			return repaired;
		};
	}
	//#endregion
	//#region src/application/state/derived-cache-invalidation.ts
	var attempt = (work) => {
		try {
			work();
		} catch {}
	};
	var clearPrefixed = (cache, prefix) => {
		[...cache.keys()].forEach((key) => {
			if (String(key).startsWith(prefix)) cache.delete(key);
		});
	};
	function createDerivedCacheInvalidation(deps) {
		const clearAll = () => {
			deps.pointCaches().forEach((cache) => cache.clear());
			attempt(() => deps.pointCache()?.clear());
			deps.westgardMemo().clear();
			attempt(() => deps.westgardCache()?.clear());
			deps.acceptedMemo().clear();
			attempt(() => deps.acceptedCache()?.clear());
			deps.cusumMemo().clear();
			attempt(() => deps.cusumCache()?.clear());
			deps.resetDerivedIndex();
			attempt(deps.resetStatus);
			attempt(() => deps.invalidateWestgardWorker());
			attempt(() => deps.invalidateActionCaches());
		};
		const clearForTest = (testId) => {
			const prefix = String(testId || "") + "|";
			deps.pointCaches().forEach((cache) => clearPrefixed(cache, prefix));
			attempt(() => deps.cusumCache()?.clear(testId));
			attempt(() => deps.pointCache()?.clear(testId));
			deps.westgardMemo().delete(testId);
			attempt(() => deps.westgardCache()?.clear(testId));
			clearPrefixed(deps.acceptedMemo(), prefix);
			attempt(() => deps.acceptedCache()?.clear(testId));
			attempt(() => deps.clearStatus(testId));
			attempt(() => deps.invalidateWestgardWorker(testId));
			attempt(() => deps.invalidateActionCaches(testId));
		};
		return {
			clearAll,
			clearForTest
		};
	}
	//#endregion
	//#region src/application/state/configuration-relations.ts
	function reconcileConfigurationRelations(state, deps) {
		if (!state.qcPanels.length && state.assayGroups.length) state.assayGroups.forEach((group) => {
			const first = (state.tests || []).find((test) => (group.testIds || []).includes(test.id));
			state.qcPanels.push({
				id: group.id || deps.uid(),
				name: group.name || "Panel QC",
				instrumentId: first && first.instrumentId || state.instruments[0].id,
				testIds: [...group.testIds || []],
				note: group.note || "Chuyển từ nhóm xét nghiệm cũ",
				active: group.active !== false
			});
		});
		state.lotGroups.forEach((group) => {
			group.lotIds = Array.isArray(group.lotIds) ? [...new Set(group.lotIds)].filter((id) => (state.qcLots || []).some((lot) => lot.id === id)) : [];
		});
		state.qcLots.forEach((lot) => {
			if (lot.groupId) {
				const group = state.lotGroups.find((item) => item.id === lot.groupId);
				if (group && !group.lotIds.includes(lot.id)) group.lotIds.push(lot.id);
			}
		});
		const retiredTo = new Map((state.lotTransitions || []).filter(deps.switchesLot).map((transition) => [String(transition.fromLotId), String(transition.toLotId)]));
		state.lotGroups.forEach((group) => {
			if (group.active === false) return;
			group.lotIds = (group.lotIds || []).filter((id) => {
				const replacement = retiredTo.get(String(id));
				return !(replacement && (group.lotIds || []).some((lotId) => String(lotId) === replacement));
			});
		});
		state.lotGroups.forEach((group) => {
			group.lotIds = [...new Set(group.lotIds || [])].filter((id) => (state.qcLots || []).some((lot) => lot.id === id));
		});
		state.qcLots.forEach((lot) => {
			const group = state.lotGroups.find((item) => (item.lotIds || []).includes(lot.id));
			lot.groupId = group ? group.id : "";
		});
		state.assayGroups.forEach((group) => {
			group.testIds = Array.isArray(group.testIds) ? group.testIds.filter((id) => (state.tests || []).some((test) => test.id === id)) : [];
		});
		state.qcPanels.forEach((panel) => {
			if (!(state.instruments || []).some((instrument) => instrument.id === panel.instrumentId)) panel.instrumentId = state.instruments[0] && state.instruments[0].id || "";
			panel.testIds = Array.isArray(panel.testIds) ? panel.testIds.filter((id) => (state.tests || []).some((test) => test.id === id)) : [];
			if (panel.active == null) panel.active = true;
		});
		state.lotTransitions = state.lotTransitions.filter((transition) => (state.qcLots || []).some((lot) => lot.id === transition.fromLotId) && (state.qcLots || []).some((lot) => lot.id === transition.toLotId) && (!transition.panelId || (state.qcPanels || []).some((panel) => panel.id === transition.panelId)));
		state.lotTransitions.filter(deps.switchesLot).forEach(deps.applyAcceptedTransition);
		deps.normalizeLotGroups();
		deps.syncLotDepletion();
	}
	//#endregion
	//#region src/application/state/test-configuration-normalization.ts
	function normalizeTestConfiguration(state, migrateLegacyLots, deps) {
		(state.teaRefs || []).forEach((reference) => {
			if (!reference.analyteId) reference.analyteId = deps.builtInMeta(reference.name).analyteId || "custom-" + String(reference.id || deps.uid()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 72);
			const built = deps.metaById(reference.analyteId);
			if (built.analyteId) {
				reference.name = built.standardName;
				reference.displayName = built.displayName;
				reference.standardName = built.standardName;
				reference.abbreviation = built.abbreviation;
				reference.aliases = [...built.aliases];
				reference.matrix = built.matrix;
			}
		});
		(state.machines || []).forEach((name) => {
			if (name && !state.instruments.some((instrument) => deps.searchText(instrument.name) === deps.searchText(name))) state.instruments.push({
				id: deps.uid(),
				name,
				manufacturer: "",
				model: "",
				serial: "",
				section: "",
				active: true
			});
		});
		if (!state.instruments.length) state.instruments.push({
			id: deps.uid(),
			name: "Máy A",
			manufacturer: "",
			model: "",
			serial: "",
			section: "",
			active: true
		});
		state.machines = [...new Set(state.instruments.map((instrument) => instrument.name).filter(Boolean))];
		state.tests.forEach((test) => {
			let instrument = state.instruments.find((item) => item.id === test.instrumentId) || state.instruments.find((item) => deps.searchText(item.name) === deps.searchText(test.machine));
			if (!instrument) {
				instrument = {
					id: deps.uid(),
					name: test.machine || "Máy A",
					manufacturer: "",
					model: "",
					serial: "",
					section: "",
					active: true
				};
				state.instruments.push(instrument);
			}
			test.instrumentId = instrument.id;
			test.machine = instrument.name;
			if (!test.section) test.section = instrument.section || "";
			if (test.active == null) test.active = true;
			test.ruleActions = test.ruleActions || {};
			test.ruleScopes = test.ruleScopes || {};
			test.cusum = test.cusum || {
				on: false,
				k: .5,
				h: 4
			};
			const reference = (state.teaRefs || []).find((item) => test.analyteId && item.analyteId === test.analyteId) || (state.teaRefs || []).find((item) => deps.teaKey(item.name) === deps.teaKey(test.name)), naming = deps.meta(test.name, reference);
			test.analyteId = test.analyteId || naming.analyteId || "local-" + String(test.id || deps.uid()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 73);
			const built = deps.metaById(test.analyteId);
			if (built.analyteId) {
				test.name = built.standardName;
				test.displayName = built.displayName;
				test.standardName = built.standardName;
				test.abbreviation = built.abbreviation;
				test.aliases = [...built.aliases];
				test.matrix = built.matrix;
			} else if (naming.standardName) {
				test.displayName = test.displayName || naming.displayName;
				test.standardName = test.standardName || naming.standardName;
				test.abbreviation = test.abbreviation || naming.abbreviation;
				test.aliases = Array.isArray(test.aliases) && test.aliases.length ? test.aliases : naming.aliases;
				test.matrix = test.matrix || naming.matrix;
			}
			test.levels.forEach((level) => {
				let lot = state.qcLots.find((item) => item.id === level.qcLotId);
				if (migrateLegacyLots && !lot && level.lot) {
					let group = state.lotGroups.find((item) => deps.searchText(item.name) === deps.searchText(test.name + " QC"));
					if (!group) {
						group = {
							id: deps.uid(),
							name: test.name + " QC",
							lotIds: [],
							manufacturer: "",
							material: "",
							catalog: "",
							note: "Tự động chuyển từ dữ liệu cũ",
							active: true
						};
						state.lotGroups.push(group);
					}
					lot = state.qcLots.find((item) => item.groupId === group.id && item.lotNo === level.lot && +item.level === +level.level);
					if (!lot) {
						lot = {
							id: deps.uid(),
							groupId: group.id,
							lotNo: level.lot,
							level: level.level,
							exp: level.exp || "",
							opened: "",
							active: true,
							note: ""
						};
						state.qcLots.push(lot);
					}
					if (lot && !group.lotIds.includes(lot.id)) group.lotIds.push(lot.id);
				}
				if (lot) {
					level.qcLotId = lot.id;
					level.lot = lot.lotNo;
					level.exp = lot.exp;
				}
				level.meanSdHistory = Array.isArray(level.meanSdHistory) ? level.meanSdHistory : [];
				if (!level.meanSdHistory.length && Number.isFinite(+level.mean) && Number.isFinite(+level.sd) && +level.sd > 0) level.meanSdHistory.push({
					id: deps.uid(),
					qcLotId: level.qcLotId || "",
					lot: level.lot || "",
					mean: +level.mean,
					sd: +level.sd,
					low: level.low == null ? null : +level.low,
					high: level.high == null ? null : +level.high,
					effectiveFrom: "",
					effectiveTo: level.exp || "",
					source: level.applied === "lab" ? "lab" : "mfg",
					note: "Tự động chuyển từ cấu hình hiện hành"
				});
				deps.dedupeHistory(level);
			});
		});
	}
	//#endregion
	//#region src/application/state/foundation-normalization.ts
	function normalizeStateFoundation(input, options, deps) {
		const previousSchema = Number(input && input.schemaVersion || 1), merged = {
			...deps.defaults(),
			...input || {}
		}, state = options.sanitized ? merged : deps.sanitize(merged);
		if (previousSchema < 2) state.periodLocks = Array.isArray(state.periodLocks) ? state.periodLocks : [];
		delete state.archiveRegistry;
		if (state.lab && typeof state.lab === "object") delete state.lab.kpiTargets;
		if (previousSchema < 3 || !state.teaRegistryVersion || state.teaRegistryVersion < deps.teaRegistryVersion) state.teaRegistryVersion = deps.teaRegistryVersion;
		state.schemaVersion = deps.schemaVersion;
		if (!state.westgardProfileVersion) {
			state.westgardRules = { ...deps.westgardDefaults };
			state.westgardProfileVersion = 2;
		}
		return {
			state,
			previousSchema
		};
	}
	//#endregion
	//#region src/application/state/state-lifecycle-normalization.ts
	function normalizeStateLifecycle(state, deps) {
		deps.ensureLab();
		deps.ensureConfiguration();
		deps.repairRanges();
		deps.ensureReagent(state);
		deps.reconcileSigma();
		deps.reconcileTea();
		deps.normalizePointLots();
		deps.pruneUnusedLevels();
		(state.tests || []).forEach((test) => (test.levels || []).forEach((level) => {
			if (level.mfgMean == null) {
				level.mfgMean = level.mean;
				level.mfgSd = level.sd;
				level.applied = "mfg";
			}
		}));
	}
	//#endregion
	//#region src/presentation/export/csv-download.ts
	function createCsvDownload(deps) {
		return (name, rows, encode) => {
			const blob = deps.createBlob("﻿" + rows.map((row) => row.map(encode).join(",")).join("\r\n")), url = deps.createUrl(blob);
			deps.download(url, name);
			deps.schedule(() => deps.revokeUrl(url), 1e3);
		};
	}
	//#endregion
	//#region src/presentation/style/css-token-pixel.ts
	function cssTokenPixel(token, fallback, readToken) {
		const value = parseFloat(String(readToken(token) || ""));
		return Number.isFinite(value) ? value : fallback;
	}
	//#endregion
	//#region src/presentation/export/blob-download.ts
	function createBlobDownload(deps) {
		return (name, blob) => {
			const url = deps.createUrl(blob);
			deps.download(url, name);
			deps.schedule(() => deps.revokeUrl(url), 1e3);
		};
	}
	//#endregion
	//#region src/presentation/report/qc-report-csv-rows.ts
	function createQcReportCsvRows(d) {
		return (tid, start, end) => {
			const test = d.test(tid);
			if (!test) return [];
			const inRange = (point) => (!start || point.date >= start) && (!end || point.date <= end), westgard = d.westgard(test), tea = d.tea(test), rows = [
				...d.meta("Báo cáo nội kiểm"),
				[],
				[
					"BÁO CÁO NỘI KIỂM",
					d.lab().name || "",
					d.lab().dept || "",
					d.range(start, end)
				],
				[],
				[
					"Xét nghiệm",
					d.testName(test),
					"Máy",
					test.machine || "",
					"Đơn vị",
					test.unit || "",
					"TEa%",
					tea || ""
				],
				[
					"Nguồn TEa",
					d.teaLabel(d.teaSource(test)),
					"Cơ sở",
					d.teaReference(test),
					"Tài liệu",
					test.teaDoc || "",
					"Người duyệt",
					test.teaApprovedBy || ""
				]
			];
			d.levels(test).forEach((level) => {
				d.previous(test, level.level).forEach((series) => {
					const previous = d.rows.previousLot(test, series, inRange);
					if (!previous.inPts.length) return;
					rows.push([], [
						"Mức " + level.level,
						"Lô " + series.lot,
						"Đã chuyển tiếp",
						"Mean",
						series.mean,
						"SD",
						series.sd
					], [
						"Ngày",
						"Lần chạy",
						"NV thực hiện",
						"Họ tên nhân viên",
						"Giá trị",
						"Z",
						"Kết luận",
						"Luật",
						"Loại sai số"
					]);
					previous.items.forEach(({ p, f, z }) => {
						const staff = d.staff(p);
						rows.push([
							d.date(p.date),
							p.runId || "",
							staff.code,
							staff.name,
							p.val,
							(z >= 0 ? "+" : "") + d.number(z) + "s",
							d.state(f.level),
							(f.rules || []).join(" | ") || ((f.supportRules || []).length ? "Bằng chứng: " + f.supportRules.join(" | ") : ""),
							d.error(f.rules || [])
						]);
					});
					const metric = d.stats(previous.inPts, series.mean, tea);
					rows.push([
						"Thống kê (lô cũ)",
						"n",
						metric.st.n,
						"Mean thực",
						d.number(metric.st.m),
						"SD",
						d.number(metric.st.sd, 3),
						"CV%",
						d.number(metric.st.cv),
						"Bias%",
						d.number(metric.bias),
						"TE%",
						d.number(metric.te),
						"Sigma (kỳ)",
						metric.sigma == null ? "" : d.number(metric.sigma, 2) + (metric.st.n < 20 ? " *" : "")
					]);
				});
				const current = d.rows.currentLot(test, level, westgard, inRange);
				rows.push([], [
					"Mức " + level.level,
					"Lô " + (level.lot || ""),
					"Dải " + (level.applied === "lab" ? "PXN" : "NSX"),
					"Mean",
					level.mean,
					"SD",
					level.sd
				], [
					"Ngày",
					"Lần chạy",
					"NV thực hiện",
					"Họ tên nhân viên",
					"Giá trị",
					"Z",
					"Kết luận",
					"Luật",
					"Loại sai số"
				]);
				if (current.pts.length) {
					current.items.forEach(({ p, f, z }) => {
						const staff = d.staff(p);
						rows.push([
							d.date(p.date),
							p.runId || "",
							staff.code,
							staff.name,
							p.val,
							(z >= 0 ? "+" : "") + d.number(z) + "s",
							d.state(f.level),
							(f.rules || []).join(" | ") || ((f.supportRules || []).length ? "Bằng chứng: " + f.supportRules.join(" | ") : ""),
							d.error(f.rules || [])
						]);
					});
					const metric = d.stats(current.pts, level.mean, tea);
					rows.push([
						"Thống kê",
						"n",
						metric.st.n,
						"Mean thực",
						d.number(metric.st.m),
						"SD",
						d.number(metric.st.sd, 3),
						"CV%",
						d.number(metric.st.cv),
						"Bias%",
						d.number(metric.bias),
						"TE%",
						d.number(metric.te),
						"Sigma (kỳ)",
						metric.sigma == null ? "" : d.number(metric.sigma, 2) + (metric.st.n < 20 ? " *" : "")
					]);
				} else rows.push(["Không có dữ liệu trong khoảng ngày đã chọn"]);
			});
			rows.push([], ["NHẬT KÝ KHẮC PHỤC"], [
				"Ngày",
				"Mã NCE",
				"Mức / lô",
				"Luật",
				"Loại sai số",
				"Hành động",
				"Điều tra & ảnh hưởng",
				"Người phụ trách",
				"QC chạy lại",
				"Trạng thái duyệt",
				"Người duyệt",
				"Ý kiến duyệt",
				"Trạng thái hồ sơ"
			]);
			d.rows.actions(tid, inRange).forEach((action) => {
				const workflow = d.workflow(action), rerun = d.rerun(action);
				rows.push([
					d.date(action.date),
					action.nceId || "",
					d.levelLabel(test, action.level, action.lot),
					action.rule || "",
					action.errorType || "",
					action.action || action.correction || "",
					d.protocol(action),
					action.by || "",
					rerun.label || "",
					d.approval(action),
					action.approvedBy || "",
					action.approvalNote || "",
					workflow.label || "Chưa hoàn tất"
				]);
			});
			return rows;
		};
	}
	//#endregion
	//#region src/presentation/format/basic-format.ts
	function createBasicFormat() {
		return {
			number: (value, digits = 2) => value == null || isNaN(value) ? "—" : Number(value).toFixed(digits),
			safeName: (value) => String(value || "file").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "file"
		};
	}
	//#endregion
	//#region src/domain/westgard/rule-policy.ts
	function createWestgardRulePolicy(api) {
		const levelCount = (test) => api.levels(test).length || (test?.levels || []).length, action = (test, rule) => api.resolveAction(rule, api.enabled(rule), test?.ruleActions?.[rule]), scope = (test, rule) => api.resolveScope(rule, levelCount(test), test?.ruleScopes?.[rule]), onIn = (test, rule, channel) => api.onInScope(rule, levelCount(test), test?.ruleScopes?.[rule], action(test, rule), channel);
		return {
			levelCount,
			action,
			scope,
			onIn,
			within: (test, rule) => onIn(test, rule, "within"),
			across: (test, rule) => onIn(test, rule, "across"),
			set: (test, channel) => new Set(api.rules.filter((rule) => onIn(test, rule, channel))),
			verdict: (test, rules) => api.verdict(rules, (rule) => action(test, rule))
		};
	}
	//#endregion
	//#region src/domain/westgard/memo-cache.ts
	function createWestgardMemoCache() {
		const cache = /* @__PURE__ */ new Map();
		return {
			get: (id) => cache.get(String(id || "")),
			set: (id, value) => cache.set(String(id || ""), value),
			clear: (id) => id == null ? cache.clear() : cache.delete(String(id || ""))
		};
	}
	//#endregion
	//#region src/domain/qc/cusum-memo-cache.ts
	function createCusumMemoCache() {
		const cache = /* @__PURE__ */ new Map();
		return {
			get: (key) => cache.get(key),
			set: (key, value) => cache.set(key, value),
			clear: (testId) => {
				if (testId == null) return cache.clear();
				const prefix = String(testId) + "|";
				[...cache.keys()].forEach((key) => {
					if (key.startsWith(prefix)) cache.delete(key);
				});
			}
		};
	}
	//#endregion
	//#region src/domain/qc/accepted-memo-cache.ts
	function createAcceptedMemoCache() {
		const cache = /* @__PURE__ */ new Map();
		return {
			get: (key) => cache.get(key),
			set: (key, value) => cache.set(key, value),
			clear: (testId) => {
				if (testId == null) return cache.clear();
				const prefix = String(testId) + "|";
				[...cache.keys()].forEach((key) => {
					if (key.startsWith(prefix)) cache.delete(key);
				});
			}
		};
	}
	//#endregion
	//#region src/domain/westgard/rule-settings.ts
	function createWestgardRuleSettings(deps) {
		return {
			enabled: (rule) => deps.ruleEnabled(deps.getState().westgardRules, rule),
			set: (rule, on) => {
				if (!deps.requireWrite()) return;
				const state = deps.getState();
				state.westgardRules = state.westgardRules || { ...deps.defaults };
				state.westgardRules[rule] = !!on;
				deps.save();
				deps.rerender();
			},
			reset: () => {
				if (!deps.requireWrite()) return;
				deps.getState().westgardRules = { ...deps.defaults };
				deps.save();
				deps.rerender();
			}
		};
	}
	//#endregion
	//#region src/domain/qc/range-candidate.ts
	function createRangeCandidateService(deps) {
		const systematicNce = (testId, level) => {
			const matches = deps.actions().filter((action) => action.testId === testId && +action.level === +level && !deps.actionCancelled(action) && String(action.rule || "").split(",").map((value) => value.trim()).some((rule) => deps.systematicRules.includes(rule)));
			return matches.length ? matches.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] : null;
		};
		const candidate = (testId, level) => {
			const test = deps.tests().find((value) => value.id === testId), config = test && deps.levelConfig(test, level);
			if (!test || !config) return {
				t: test,
				l: config,
				pts: [],
				wg: {
					F: [],
					zs: []
				},
				c: null,
				days: 0,
				bad: 0,
				warn: 0,
				eligible: false,
				nce: null
			};
			const points = deps.points(test, level), westgard = deps.westgard(test), F = points.map((point) => westgard.byPoint.get(point.id) || {
				level: "ok",
				rules: []
			}), zs = points.map((point) => deps.pointZ(point, config.mean, config.sd)), c = deps.stats(points.map((point) => point.val)), days = new Set(points.map((point) => point.date)).size, bad = F.filter((value) => value.level === "rej").length, warn = F.filter((value) => value.level === "warn").length;
			return {
				t: test,
				l: config,
				pts: points,
				wg: {
					F,
					zs
				},
				c,
				days,
				bad,
				warn,
				eligible: !!(c && c.n >= 20 && days >= 20 && bad === 0 && warn === 0 && c.sd > 0),
				nce: systematicNce(testId, level)
			};
		};
		const assignTarget = (config, mean, sd, source) => {
			const next = deps.limitsFromTarget(mean, sd, 2);
			if (!config || !next) return false;
			Object.assign(config, {
				mean: next.mean,
				sd: next.sd,
				low: next.low,
				high: next.high,
				rangeK: 2,
				applied: source
			});
			return true;
		};
		return {
			systematicNce,
			candidate,
			assignTarget
		};
	}
	//#endregion
	//#region src/domain/qc/range-safety-gate.ts
	function rangeBiasEvaluation(tea, bias, sd, systematicShiftCritical) {
		const teaValue = Number(tea), biasValue = Number(bias);
		const threshold = Number.isFinite(teaValue) && teaValue > 0 ? teaValue / 4 : null;
		const valid = Number.isFinite(biasValue);
		return {
			threshold,
			valid,
			withinThreshold: threshold !== null && valid && Math.abs(biasValue) <= threshold,
			critical: threshold !== null && valid && systematicShiftCritical ? systematicShiftCritical(teaValue, biasValue, sd) : null
		};
	}
	function rangeSafetyGate(nce, tea, causeConfirmed, bias) {
		if (!nce) return {
			needed: false,
			threshold: null,
			passes: true
		};
		const evaluation = rangeBiasEvaluation(tea, bias, null);
		return {
			needed: true,
			threshold: evaluation.threshold,
			passes: !!causeConfirmed && evaluation.withinThreshold
		};
	}
	//#endregion
	//#region src/domain/export/csv-cell.ts
	function csvCell(value) {
		if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
		let text = value == null ? "" : String(value);
		if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
		return /[",\n\r;]/.test(text) ? "\"" + text.replace(/"/g, "\"\"") + "\"" : text;
	}
	//#endregion
	//#region src/presentation/report/export-helpers.ts
	var periodLabel = (value) => {
		const raw = String(value || "").trim().replace(/^Kỳ\s*/i, ""), iso = raw.match(/^(\d{4})-(\d{1,2})$/), vn = raw.match(/^(\d{1,2})\/(\d{4})$/);
		if (iso) return String(Number(iso[2])).padStart(2, "0") + "/" + iso[1];
		if (vn) return String(Number(vn[1])).padStart(2, "0") + "/" + vn[2];
		return raw || "?";
	};
	var reportExportHelpers = Object.freeze({
		inRange: (start, end) => (point) => (!start || point.date >= start) && (!end || point.date <= end),
		nceExcerpt: (value, max = 150) => {
			const text = String(value || "").replace(/\s+/g, " ").trim();
			if (text.length <= max) return text || "—";
			return (text.slice(0, max - 1).replace(/\s+\S*$/, "").trim() || text.slice(0, max - 1)) + "…";
		},
		sigmaLevels: (row) => {
			return (Array.isArray(row && row.levels) ? row.levels : [{
				level: 1,
				metric: row && row.r1 || null
			}, {
				level: 2,
				metric: row && row.r2 || null
			}]).filter((value) => value && value.metric);
		},
		periodLabel,
		mdcPeriodLabel: (value) => periodLabel(value).replace(/^0(?=\d\/)/, ""),
		exportPeriods: (rows) => [...new Set((rows || []).map((row) => periodLabel(row && row.period)).filter(Boolean))].join(", ")
	});
	//#endregion
	//#region src/presentation/nce/action-report-summary.ts
	function createActionReportSummary(deps) {
		return (action) => {
			const labels = deps.labels() || {}, causeLabel = labels.cause && labels.cause[action.causeCategory];
			return [
				["Tức thời", deps.excerpt(action.correction || action.containmentNote || "Chưa ghi", 120)],
				["Nguyên nhân", deps.excerpt([causeLabel, action.cause].filter(Boolean).join(" - ") || "Chưa xác định", 140)],
				["Khắc phục", deps.excerpt(action.action || "Chưa ghi", 160)]
			];
		};
	}
	//#endregion
	//#region src/presentation/nce/action-report-model.ts
	function createActionReportModel(deps) {
		return (action, test) => {
			const labels = deps.labels() || {}, pick = (group, key) => labels[group] && labels[group][key], rerun = deps.rerunStatus(action), workflow = deps.workflowStatus(action), effectiveness = deps.effectivenessStatus(action), risk = deps.riskScore(action), residual = deps.residualRiskScore(action), eventDate = deps.eventDate(action), approval = deps.approvalLabel(action), rerunPoint = rerun && rerun.point, rerunText = rerunPoint ? deps.pointValue(rerunPoint, test) + " " + (test && test.unit || "") + " - " + deps.formatDate(rerunPoint.date) + (rerunPoint.runId ? " - lần " + rerunPoint.runId : "") : rerun.label || "Chưa có kết quả phù hợp";
			return {
				modern: +action.protocolVersion >= 2,
				cancelled: action.recordStatus === "cancelled",
				nceTitle: action.nceId || "chưa cấp mã",
				wfLabel: workflow.label || "Chưa hoàn tất",
				eventDateText: deps.formatDate(eventDate),
				testLevelText: (test ? deps.testName(test) : "—") + " - " + deps.levelShort(test, action.level, action.lot),
				ruleErrText: (action.rule || "—") + " - " + (action.errorType || "—"),
				sourcePhaseText: (pick("source", action.eventSource) || "—") + " - " + (pick("phase", action.processPhase) || "—"),
				ownerDueText: (action.by || "—") + " - " + (action.dueDate ? deps.formatDate(action.dueDate) : "—"),
				recordStatusText: action.recordStatus === "cancelled" ? "Đã hủy" : "Đang hiệu lực",
				containmentText: pick("containment", action.containmentStatus) || "Chưa ghi",
				containmentNote: action.containmentNote || "—",
				correctionText: action.correction || "Chưa ghi xử lý tức thời",
				riskText: (pick("risk", action.riskLevel) || "Chưa đánh giá") + " / " + (risk || "—"),
				sodText: (action.riskSeverity || "—") + " x " + (action.riskOccurrence || "—") + " x " + (action.riskDetectability || "—"),
				riskBasis: action.riskBasis || "—",
				checks: [
					[
						"Vật liệu QC",
						action.qcMaterialStatus,
						action.qcMaterialNote
					],
					[
						"Máy phân tích",
						action.instrumentStatus,
						action.instrumentNote
					],
					[
						"Hóa chất / calibrator",
						action.reagentStatus,
						action.reagentNote
					],
					[
						"Hiệu chuẩn",
						action.calibrationStatus,
						action.calibrationNote
					],
					[
						"So sánh lot-to-lot",
						action.lotToLotStatus,
						action.lotToLotNote
					]
				].map(([label, status, note]) => [
					label,
					pick("check", status) || "Chưa ghi",
					note || "—"
				]),
				causeCategoryText: pick("cause", action.causeCategory) || "Chưa phân loại",
				actionCompletedText: action.actionCompletedDate ? deps.formatDate(action.actionCompletedDate) : "—",
				causeText: action.cause || "Chưa xác định",
				actionText: action.action || "Chưa ghi",
				legacyActionText: action.action || action.correction || "—",
				rerunText,
				releaseText: pick("release", action.releaseStatus) || "Không áp dụng",
				releaseWhoText: (action.releaseDate ? deps.formatDate(action.releaseDate) : "—") + " - " + (action.releaseBy || "—"),
				releaseNote: action.releaseNote || "—",
				patientText: pick("patient", action.patientImpact) || "Chưa đánh giá",
				patientAction: action.patientAction || "—",
				effLabel: effectiveness.label || "Chưa đánh giá",
				effWhoText: (action.effectivenessDate ? deps.formatDate(action.effectivenessDate) : "—") + " - " + (action.effectivenessBy || "—"),
				effNote: action.effectivenessNote || "—",
				residualText: (pick("risk", action.residualRiskLevel) || "Chưa đánh giá") + " / RPN " + (residual || "—"),
				residualBasis: action.residualRiskBasis || "—",
				approvalShortText: approval + (action.approvedBy ? " - " + action.approvedBy : ""),
				approvalText: approval + (action.approvedBy ? " - " + action.approvedBy : "") + (action.approvedAt ? " - " + deps.formatDateTime(action.approvedAt) : ""),
				approvalNote: action.approvalNote || action.returnNote || "—",
				cancelText: (action.cancelReason || "Không ghi lý do") + (action.cancelledBy ? " - " + action.cancelledBy : "") + (action.cancelledAt ? " - " + deps.formatDateTime(action.cancelledAt) : "")
			};
		};
	}
	//#endregion
	//#region src/presentation/nce/action-csv-row.ts
	function createActionCsvRow(d) {
		return (action) => {
			const test = d.test(action.testId), workflow = d.workflow(action), rerun = d.rerun(action), labels = d.labels() || {};
			return [
				action.nceId || "",
				d.date(d.eventDate(action)),
				action.createdAt ? d.dateTime(action.createdAt) : "",
				labels.source?.[action.eventSource] || action.eventSource || "",
				labels.phase?.[action.processPhase] || action.processPhase || "",
				test ? d.testName(test) : "",
				d.level(test, action.level, action.lot),
				action.rule || "",
				action.errorType || "",
				action.action || action.correction || "",
				d.protocol(action),
				action.biasBefore || "",
				action.biasAfter || "",
				action.by || "",
				action.dueDate ? d.date(action.dueDate) : "",
				action.riskSeverity || "",
				action.riskOccurrence || "",
				action.riskDetectability || "",
				d.risk(action),
				labels.risk?.[action.riskLevel] || action.riskLevel || "",
				action.riskBasis || "",
				labels.release?.[action.releaseStatus] || action.releaseStatus || "",
				action.releaseDate ? d.date(action.releaseDate) : "",
				action.releaseBy || "",
				action.releaseNote || "",
				rerun.label || "",
				{
					pending: "Chưa đánh giá",
					effective: "Có hiệu lực",
					ineffective: "Chưa hiệu lực"
				}[action.effectivenessStatus] || action.effectivenessStatus || "",
				action.effectivenessDate ? d.date(action.effectivenessDate) : "",
				action.effectivenessNote || "",
				action.effectivenessBy || "",
				action.residualSeverity || "",
				action.residualOccurrence || "",
				action.residualDetectability || "",
				d.residualRisk(action),
				labels.risk?.[action.residualRiskLevel] || action.residualRiskLevel || "",
				action.residualRiskBasis || "",
				d.approval(action),
				action.approvedBy || "",
				action.approvedAt ? d.dateTime(action.approvedAt) : "",
				action.approvalNote || "",
				action.returnNote || "",
				action.returnBy || "",
				action.returnAt ? d.dateTime(action.returnAt) : "",
				action.recordStatus === "cancelled" ? "Đã hủy" : "Đang hoạt động",
				action.cancelReason || "",
				action.cancelledBy || "",
				action.cancelledAt ? d.dateTime(action.cancelledAt) : "",
				action.parentNceId || "",
				action.followUpNceId || "",
				workflow.label || "Chưa hoàn tất"
			];
		};
	}
	//#endregion
	//#region src/presentation/sigma/sigma-canvas.ts
	function createSigmaCanvas(deps) {
		return (width, height, value) => {
			const scale = deps.scale(width, height, value), canvas = deps.create();
			canvas.width = Math.round(width * scale);
			canvas.height = Math.round(height * scale);
			const context = canvas.getContext("2d");
			context.scale(scale, scale);
			context.fillStyle = "#fff";
			context.fillRect(0, 0, width, height);
			return {
				cv: canvas,
				ctx: context
			};
		};
	}
	//#endregion
	//#region src/presentation/sigma/sigma-chart-renderer.ts
	function createSigmaChartRenderer(deps) {
		return (rows) => {
			const data = rows.map((row) => ({
				name: row.period || row.name,
				levels: deps.levels(row).filter((item) => item.metric.classifiable !== false && Number.isFinite(item.metric.sigma))
			})).filter((row) => row.levels.length);
			if (!data.length) return null;
			const count = data.length, width = Math.max(760, 72 * count + 170), height = 400, scale = 6, left = 52, right = 22, top = 54, innerWidth = width - left - right, innerHeight = 254, all = data.flatMap((row) => row.levels.map((level) => level.metric.sigma)), maximum = Math.max(8, Math.ceil(Math.max(...all) * 1.05)), canvas = deps.canvas(width, height, scale), ctx = canvas.ctx, y = (value) => 308 - value / maximum * innerHeight;
			[
				[
					0,
					3,
					"#f6dcd8"
				],
				[
					3,
					4,
					"#fdeecb"
				],
				[
					4,
					6,
					"#e4eee3"
				],
				[
					6,
					maximum,
					"#d6e8de"
				]
			].forEach((band) => {
				if (band[1] > band[0]) {
					ctx.fillStyle = band[2];
					const y1 = y(Math.min(band[1], maximum)), y2 = y(band[0]);
					ctx.fillRect(left, y1, innerWidth, y2 - y1);
				}
			});
			ctx.font = deps.font("", "type-meta", 12.5);
			ctx.fillStyle = "#9a9486";
			ctx.textAlign = "right";
			ctx.strokeStyle = "rgba(0,0,0,.06)";
			ctx.lineWidth = 1;
			for (let grid = 0; grid <= maximum; grid += 2) {
				const position = y(grid);
				ctx.beginPath();
				ctx.moveTo(left, position);
				ctx.lineTo(width - right, position);
				ctx.stroke();
				ctx.fillText(String(grid), 46, position + 4);
			}
			const reference = (value, color) => {
				ctx.save();
				ctx.strokeStyle = color;
				ctx.setLineDash([5, 4]);
				ctx.lineWidth = 1.3;
				const position = y(value);
				ctx.beginPath();
				ctx.moveTo(left, position);
				ctx.lineTo(width - right, position);
				ctx.stroke();
				ctx.restore();
				ctx.fillStyle = color;
				ctx.textAlign = "left";
				ctx.font = deps.font("bold", "type-meta", 12.5);
				ctx.fillText(value + "σ", width - right - 26, position - 4);
			};
			reference(3, "#c0392b");
			reference(6, "#13603f");
			const slot = innerWidth / count, maxLevels = Math.max(...data.map((row) => row.levels.length)), barWidth = Math.max(5, Math.min(24, slot * .72 / maxLevels));
			data.forEach((row, index) => {
				const center = left + (index + .5) * slot, bar = (sigma, level, offset) => {
					if (sigma == null) return;
					const color = deps.zone(sigma).c, x = center + offset - barWidth / 2, position = y(sigma), barHeight = y(0) - position;
					ctx.fillStyle = color;
					ctx.fillRect(x, position, barWidth, barHeight);
					ctx.strokeStyle = "rgba(0,0,0,.18)";
					ctx.lineWidth = 1;
					ctx.strokeRect(x, position, barWidth, barHeight);
					ctx.fillStyle = "#16211f";
					ctx.font = deps.font("bold", "type-caption", 11.5);
					ctx.textAlign = "center";
					ctx.fillText(sigma.toFixed(2), x + barWidth / 2, position - 5);
					ctx.fillStyle = "#fff";
					ctx.font = deps.font("bold", "type-overline", 10.5);
					ctx.fillText(String(level), x + barWidth / 2, y(0) - 4);
				};
				row.levels.forEach((level, index) => bar(level.metric.sigma, level.level, (index - (row.levels.length - 1) / 2) * barWidth * 1.15));
				ctx.save();
				ctx.translate(center, 320);
				ctx.rotate(-Math.PI / 4.2);
				ctx.fillStyle = "#3a443f";
				ctx.font = deps.font("", "type-caption", 11.5);
				ctx.textAlign = "right";
				ctx.fillText(row.name.length > 16 ? row.name.slice(0, 15) + "…" : row.name, 0, 0);
				ctx.restore();
			});
			ctx.strokeStyle = "#16211f";
			ctx.lineWidth = 1.3;
			ctx.beginPath();
			ctx.moveTo(left, top);
			ctx.lineTo(left, 308);
			ctx.lineTo(width - right, 308);
			ctx.stroke();
			ctx.fillStyle = "#16211f";
			ctx.font = deps.font("bold", "type-heading-sm", 16);
			ctx.textAlign = "left";
			ctx.fillText("Sigma theo xét nghiệm", left, 22);
			let legendX = left;
			[
				["#c0392b", "<3σ"],
				["#dd8b1f", "3–4σ"],
				["#3f9a55", "4–6σ"],
				["#13603f", "≥6σ"]
			].forEach((legend) => {
				ctx.fillStyle = legend[0];
				ctx.fillRect(legendX, 29, 14, 8);
				ctx.fillStyle = "#16211f";
				ctx.font = deps.font("bold", "type-caption", 11.5);
				ctx.fillText(legend[1], legendX + 18, 37);
				legendX += 66;
			});
			ctx.fillStyle = "#6b756f";
			ctx.font = deps.font("", "type-caption", 11.5);
			ctx.fillText("Số trong cột = mức QC", legendX + 6, 37);
			return {
				bytes: deps.bytes(canvas.cv.toDataURL("image/png")),
				dispW: width,
				dispH: height
			};
		};
	}
	//#endregion
	//#region src/presentation/sigma/sigma-mdc-renderer.ts
	function createSigmaMdcRenderer(deps) {
		return (rows) => {
			const items = deps.items(rows);
			if (!items.length) return null;
			const width = 780, height = 420, scale = 6, left = 58, top = 50, innerWidth = 700, innerHeight = 316, maxX = Math.max(50, Math.max(...items.map((point) => point.x))) * 1.1, maxY = 100, canvas = deps.canvas(width, height, scale), ctx = canvas.ctx, x = (value) => left + Math.min(value, maxX) / maxX * innerWidth, y = (value) => 366 - Math.min(value, maxY) / maxY * innerHeight;
			ctx.font = deps.font("", "type-caption", 11.5);
			ctx.fillStyle = "#9a9486";
			ctx.strokeStyle = "#eee7d8";
			ctx.lineWidth = 1;
			ctx.textAlign = "right";
			for (let grid = 0; grid <= maxY; grid += 20) {
				const position = y(grid);
				ctx.beginPath();
				ctx.moveTo(left, position);
				ctx.lineTo(758, position);
				ctx.stroke();
				ctx.fillText(String(grid), 52, position + 4);
			}
			ctx.textAlign = "center";
			for (let grid = 0; grid <= maxX; grid += 10) ctx.fillText(String(Math.round(grid)), x(grid), 382);
			[
				[2, "#c0392b"],
				[3, "#dd8b1f"],
				[4, "#b59a00"],
				[5, "#3f9a55"],
				[6, "#0e4d4a"]
			].forEach((line) => {
				const sigma = line[0], color = line[1], x2 = 100 / sigma, endX = Math.min(x2, maxX), endY = Math.max(0, 100 - sigma * endX);
				ctx.strokeStyle = color;
				ctx.lineWidth = 1.6;
				ctx.beginPath();
				ctx.moveTo(x(0), y(100));
				ctx.lineTo(x(endX), y(endY));
				ctx.stroke();
				ctx.fillStyle = color;
				ctx.font = deps.font("bold", "type-meta", 12.5);
				ctx.textAlign = "left";
				ctx.fillText(sigma + "σ", x2 <= maxX ? x(x2) + 2 : 736, x2 <= maxX ? y(0) - 3 : y(100 - sigma * maxX) - 2);
			});
			items.forEach((point) => {
				ctx.beginPath();
				ctx.arc(x(point.x), y(point.y), 7, 0, 2 * Math.PI);
				ctx.fillStyle = deps.zone(point.sigma).c;
				ctx.fill();
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = "#fff";
				ctx.stroke();
				ctx.fillStyle = "#fff";
				ctx.font = deps.font("bold", "type-overline", 10.5);
				ctx.textAlign = "center";
				ctx.fillText(String(point.level), x(point.x), y(point.y) + 3);
			});
			ctx.fillStyle = "#16211f";
			ctx.font = deps.font("", "type-overline", 10.5);
			ctx.textAlign = "left";
			deps.placements(items, x, y, ctx, {
				left,
				right: 758,
				top,
				bottom: 366
			}).forEach((point) => ctx.fillText(point.label, point.x, point.y));
			ctx.strokeStyle = "#16211f";
			ctx.lineWidth = 1.3;
			ctx.beginPath();
			ctx.moveTo(left, top);
			ctx.lineTo(left, 366);
			ctx.lineTo(758, 366);
			ctx.stroke();
			ctx.fillStyle = "#16211f";
			ctx.font = deps.font("bold", "type-heading-sm", 16);
			ctx.textAlign = "left";
			ctx.fillText("Biểu đồ Quyết định Phương pháp (MDC) — các mức QC", left, 22);
			ctx.font = deps.font("", "type-caption", 11.5);
			ctx.fillStyle = "#6b756f";
			ctx.fillText("Màu điểm theo xếp loại Sigma · số trong điểm là mức QC · đường 2σ–6σ", left, 40);
			ctx.font = deps.font("", "type-meta", 12.5);
			ctx.fillStyle = "#16211f";
			ctx.textAlign = "center";
			ctx.fillText("CV / TEa (%)", 408, 412);
			ctx.save();
			ctx.translate(16, 183);
			ctx.rotate(-Math.PI / 2);
			ctx.fillText("|Bias| / TEa (%)", 0, 0);
			ctx.restore();
			return {
				bytes: deps.bytes(canvas.cv.toDataURL("image/png")),
				dispW: width,
				dispH: height
			};
		};
	}
	//#endregion
	//#region src/presentation/sigma/rename-xlsx-sheet.ts
	function renameXlsxSheet(bytes, sheetName, deps) {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), decode = new TextDecoder(), files = [];
		let offset = 0;
		while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 67324752) {
			const nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true), size = view.getUint32(offset + 18, true), nameStart = offset + 30, dataStart = nameStart + nameLength + extraLength, name = decode.decode(bytes.slice(nameStart, nameStart + nameLength));
			let data = bytes.slice(dataStart, dataStart + size);
			if (name === "xl/workbook.xml") {
				const xml = decode.decode(data).replace(/(<sheet name=")[^"]*(")/, "$1" + deps.escape(sheetName) + "$2");
				data = deps.bytes(xml);
			}
			files.push({
				name,
				data
			});
			offset = dataStart + size;
		}
		return files.length ? deps.zip(files) : bytes;
	}
	//#endregion
	//#region src/presentation/export/xlsx-cell.ts
	function createXlsxCells(escape) {
		const text = (ref, style, value) => "<c r=\"" + ref + "\" s=\"" + style + "\" t=\"inlineStr\"><is><t xml:space=\"preserve\">" + escape(value) + "</t></is></c>", number = (ref, style, value) => value === "" || value == null || typeof value === "number" && !Number.isFinite(value) ? text(ref, style, "") : "<c r=\"" + ref + "\" s=\"" + style + "\"><v>" + value + "</v></c>";
		return {
			text,
			number
		};
	}
	//#endregion
	//#region src/presentation/export/xlsx-zip.ts
	function createXlsxZip(bytes) {
		const crcTable = (() => {
			const table = [];
			for (let value = 0; value < 256; value++) {
				let crc = value;
				for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 3988292384 ^ crc >>> 1 : crc >>> 1;
				table[value] = crc >>> 0;
			}
			return table;
		})(), crc32 = (buffer) => {
			let crc = 4294967295;
			for (let index = 0; index < buffer.length; index++) crc = crcTable[(crc ^ buffer[index]) & 255] ^ crc >>> 8;
			return (crc ^ 4294967295) >>> 0;
		};
		return (files) => {
			const parts = [], central = [];
			let offset = 0;
			const number = (value, length) => {
				const out = new Uint8Array(length);
				for (let index = 0; index < length; index++) {
					out[index] = value & 255;
					value >>>= 8;
				}
				return out;
			}, push = (value) => {
				parts.push(value);
				offset += value.length;
			};
			files.forEach((file) => {
				const nameB = bytes(file.name), crc = crc32(file.data), off = offset;
				[
					number(67324752, 4),
					number(20, 2),
					number(0, 2),
					number(0, 2),
					number(0, 2),
					number(0, 2),
					number(crc, 4),
					number(file.data.length, 4),
					number(file.data.length, 4),
					number(nameB.length, 2),
					number(0, 2),
					nameB,
					file.data
				].forEach(push);
				central.push({
					nameB,
					crc,
					len: file.data.length,
					off
				});
			});
			const centralStart = offset;
			central.forEach((item) => [
				number(33639248, 4),
				number(20, 2),
				number(20, 2),
				number(0, 2),
				number(0, 2),
				number(0, 2),
				number(0, 2),
				number(item.crc, 4),
				number(item.len, 4),
				number(item.len, 4),
				number(item.nameB.length, 2),
				number(0, 2),
				number(0, 2),
				number(0, 2),
				number(0, 2),
				number(0, 4),
				number(item.off, 4),
				item.nameB
			].forEach(push));
			const centralLength = offset - centralStart;
			[
				number(101010256, 4),
				number(0, 2),
				number(0, 2),
				number(central.length, 2),
				number(central.length, 2),
				number(centralLength, 4),
				number(centralStart, 4),
				number(0, 2)
			].forEach(push);
			const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
			let position = 0;
			parts.forEach((part) => {
				out.set(part, position);
				position += part.length;
			});
			return out;
		};
	}
	//#endregion
	//#region src/presentation/export/xlsx-period.ts
	function xlsxPeriodNumber(value) {
		const match = String(value || "").match(/(?:Kỳ\s*)?(\d{1,2})\/\d{4}$/i);
		return match ? Number(match[1]) : value;
	}
	//#endregion
	//#region src/presentation/export/xlsx-drawing.ts
	function createXlsxDrawing(toEmu) {
		return (images, startRow) => {
			let nextRow = startRow;
			return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><xdr:wsDr xmlns:xdr=\"http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\">" + images.map((image, index) => {
				const row = nextRow;
				nextRow += Math.ceil(image.dispH / 15) + 1;
				const cx = toEmu(image.dispW), cy = toEmu(image.dispH);
				return "<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>" + row + "</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx=\"" + cx + "\" cy=\"" + cy + "\"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id=\"" + (index + 1) + "\" name=\"Chart" + (index + 1) + "\"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" r:embed=\"rId" + (index + 1) + "\"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"" + cx + "\" cy=\"" + cy + "\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>";
			}).join("") + "</xdr:wsDr>";
		};
	}
	//#endregion
	//#region src/presentation/sigma/sigma-xlsx-styles.ts
	function sigmaXlsxStyles() {
		const fonts = [
			"<font><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"FF000000\"/></font>",
			"<font><b/><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"FF000000\"/></font>",
			"<font><b/><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"FFFFFFFF\"/></font>",
			"<font><b/><sz val=\"13\"/><name val=\"Arial\"/><color rgb=\"FFFFFFFF\"/></font>",
			"<font><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"FF555555\"/></font>"
		], fills = ["<fill><patternFill patternType=\"none\"/></fill>", "<fill><patternFill patternType=\"gray125\"/></fill>"];
		[
			"0D3D24",
			"1F5C3A",
			"2D8653",
			"5AAA6B",
			"E07B1A",
			"C0392B",
			"F2F7F4",
			"FFF3E0",
			"FFFFFF"
		].forEach((color) => fills.push("<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF" + color + "\"/></patternFill></fill>"));
		const borders = ["<border><left/><right/><top/><bottom/><diagonal/></border>", "<border><left style=\"thin\"><color rgb=\"FFAAAAAA\"/></left><right style=\"thin\"><color rgb=\"FFAAAAAA\"/></right><top style=\"thin\"><color rgb=\"FFAAAAAA\"/></top><bottom style=\"thin\"><color rgb=\"FFAAAAAA\"/></bottom><diagonal/></border>"], xf = (font, fill, border, horizontal, vertical, wrap) => "<xf numFmtId=\"0\" fontId=\"" + font + "\" fillId=\"" + fill + "\" borderId=\"" + border + "\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment" + (horizontal ? " horizontal=\"" + horizontal + "\"" : "") + (vertical ? " vertical=\"" + vertical + "\"" : "") + (wrap ? " wrapText=\"1\"" : "") + "/></xf>", xfs = [
			"<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>",
			xf(3, 2, 0, "center", "center", 0),
			xf(4, 0, 0, "center", "center", 1),
			xf(2, 3, 1, "center", "center", 1),
			xf(1, 8, 1, "center", "center", 1),
			xf(1, 10, 1, "center", "center", 1),
			xf(0, 8, 1, "center", "center", 1),
			xf(0, 10, 1, "center", "center", 1),
			xf(0, 9, 1, "center", "center", 1),
			xf(2, 3, 1, "center", "center", 1),
			xf(2, 4, 1, "center", "center", 1),
			xf(2, 5, 1, "center", "center", 1),
			xf(2, 6, 1, "center", "center", 1),
			xf(2, 7, 1, "center", "center", 1),
			xf(0, 0, 0, "left", "center", 1)
		];
		return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"" + fonts.length + "\">" + fonts.join("") + "</fonts><fills count=\"" + fills.length + "\">" + fills.join("") + "</fills><borders count=\"" + borders.length + "\">" + borders.join("") + "</borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"" + xfs.length + "\">" + xfs.join("") + "</cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>";
	}
	//#endregion
	//#region src/presentation/report/report-xlsx-styles.ts
	function reportXlsxStyles() {
		const fonts = [
			"<font><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"FF16202B\"/></font>",
			"<font><b/><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"FF16202B\"/></font>",
			"<font><b/><sz val=\"12\"/><name val=\"Arial\"/><color rgb=\"FFFFFFFF\"/></font>",
			"<font><b/><sz val=\"15\"/><name val=\"Arial\"/><color rgb=\"FF16202B\"/></font>",
			"<font><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"FF647686\"/></font>",
			"<font><b/><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"FF244452\"/></font>",
			"<font><i/><sz val=\"9\"/><name val=\"Arial\"/><color rgb=\"FF647686\"/></font>"
		];
		const fills = ["<fill><patternFill patternType=\"none\"/></fill>", "<fill><patternFill patternType=\"gray125\"/></fill>"];
		[
			"0E8F8F",
			"E7F1F4",
			"FFFFFF",
			"FDECEA",
			"FFF6E5"
		].forEach((color) => fills.push("<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF" + color + "\"/></patternFill></fill>"));
		const borders = ["<border><left/><right/><top/><bottom/><diagonal/></border>", "<border><left style=\"thin\"><color rgb=\"FFCBD8DF\"/></left><right style=\"thin\"><color rgb=\"FFCBD8DF\"/></right><top style=\"thin\"><color rgb=\"FFCBD8DF\"/></top><bottom style=\"thin\"><color rgb=\"FFCBD8DF\"/></bottom><diagonal/></border>"];
		const xf = (font, fill, border, horizontal, vertical, wrap) => "<xf numFmtId=\"0\" fontId=\"" + font + "\" fillId=\"" + fill + "\" borderId=\"" + border + "\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment" + (horizontal ? " horizontal=\"" + horizontal + "\"" : "") + (vertical ? " vertical=\"" + vertical + "\"" : "") + (wrap ? " wrapText=\"1\"" : "") + "/></xf>";
		const xfs = [
			"<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>",
			xf(3, 0, 0, "center", "center", 0),
			xf(4, 0, 0, "center", "center", 1),
			xf(2, 2, 0, "left", "center", 0),
			xf(5, 3, 1, "left", "center", 1),
			xf(0, 4, 1, "left", "center", 1),
			xf(5, 3, 1, "center", "center", 1),
			xf(0, 4, 1, "center", "center", 1),
			xf(0, 4, 1, "left", "center", 1),
			xf(6, 0, 0, "left", "center", 1),
			xf(1, 5, 1, "center", "center", 1),
			xf(1, 6, 1, "center", "center", 1)
		];
		return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"" + fonts.length + "\">" + fonts.join("") + "</fonts><fills count=\"" + fills.length + "\">" + fills.join("") + "</fills><borders count=\"" + borders.length + "\">" + borders.join("") + "</borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"" + xfs.length + "\">" + xfs.join("") + "</cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>";
	}
	//#endregion
	//#region src/presentation/report/report-xlsx-drawing.ts
	function createReportXlsxDrawing(toEmu) {
		return (images) => "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><xdr:wsDr xmlns:xdr=\"http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\">" + images.map((image, index) => {
			const cx = toEmu(image.dispW), cy = toEmu(image.dispH);
			return "<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>" + image.row0 + "</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx=\"" + cx + "\" cy=\"" + cy + "\"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id=\"" + (index + 1) + "\" name=\"Chart" + (index + 1) + "\"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" r:embed=\"rId" + (index + 1) + "\"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"" + cx + "\" cy=\"" + cy + "\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>";
		}).join("") + "</xdr:wsDr>";
	}
	//#endregion
	//#region src/presentation/report/report-xlsx-sheet.ts
	function createReportXlsxSheet(deps) {
		return (doc) => {
			const colsXml = "<cols>" + doc.cols.map((width, index) => "<col min=\"" + (index + 1) + "\" max=\"" + (index + 1) + "\" width=\"" + width + "\" customWidth=\"1\"/>").join("") + "</cols>";
			const body = doc.rows.map((cells, rowIndex) => {
				const row = rowIndex + 1, height = doc.rowHeights && doc.rowHeights[row];
				const values = (cells || []).map((cell, columnIndex) => {
					if (!cell) return "";
					const ref = deps.columns[columnIndex] + row;
					return cell.num ? deps.number(ref, cell.s, cell.v) : deps.text(ref, cell.s, cell.v);
				}).join("");
				return "<row r=\"" + row + "\"" + (height ? " ht=\"" + height + "\" customHeight=\"1\"" : "") + ">" + values + "</row>";
			}).join("");
			const lastRow = doc.rows.length || 1, lastCol = deps.columns[doc.cols.length - 1], merges = doc.merges || [], mergeXml = merges.length ? "<mergeCells count=\"" + merges.length + "\">" + merges.map((merge) => "<mergeCell ref=\"" + merge + "\"/>").join("") + "</mergeCells>" : "";
			return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><dimension ref=\"A1:" + lastCol + lastRow + "\"/><sheetViews><sheetView showGridLines=\"0\" workbookViewId=\"0\"/></sheetViews><sheetFormatPr defaultRowHeight=\"15\"/>" + colsXml + "<sheetData>" + body + "</sheetData>" + mergeXml + "<pageMargins left=\"0.3\" right=\"0.3\" top=\"0.4\" bottom=\"0.4\" header=\"0.2\" footer=\"0.2\"/>" + (doc.hasDrawing ? "<drawing r:id=\"rId1\"/>" : "") + "</worksheet>";
		};
	}
	//#endregion
	//#region src/presentation/report/report-xlsx-builder.ts
	function createReportXlsxBuilder(deps) {
		return (doc) => {
			const images = (doc.images || []).filter((image) => image && image.bytes && image.bytes.length), hasDrawing = images.length > 0, document = {
				...doc,
				hasDrawing
			};
			const types = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/>" + (hasDrawing ? "<Default Extension=\"png\" ContentType=\"image/png\"/>" : "") + "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" + (hasDrawing ? "<Override PartName=\"/xl/drawings/drawing1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.drawing+xml\"/>" : "") + "</Types>";
			const bytes = deps.bytes, files = [
				{
					name: "[Content_Types].xml",
					data: bytes(types)
				},
				{
					name: "_rels/.rels",
					data: bytes("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" Target=\"xl/workbook.xml\"/></Relationships>")
				},
				{
					name: "xl/workbook.xml",
					data: bytes("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"" + deps.escape(doc.sheetName || "Báo cáo") + "\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>")
				},
				{
					name: "xl/_rels/workbook.xml.rels",
					data: bytes("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>")
				},
				{
					name: "xl/styles.xml",
					data: bytes(deps.styles())
				},
				{
					name: "xl/worksheets/sheet1.xml",
					data: bytes(deps.sheet(document))
				}
			];
			if (hasDrawing) {
				files.push({
					name: "xl/worksheets/_rels/sheet1.xml.rels",
					data: bytes("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing\" Target=\"../drawings/drawing1.xml\"/></Relationships>")
				});
				files.push({
					name: "xl/drawings/drawing1.xml",
					data: bytes(deps.drawing(images))
				});
				let relationships = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">";
				images.forEach((image, index) => relationships += "<Relationship Id=\"rId" + (index + 1) + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"../media/image" + (index + 1) + ".png\"/>");
				files.push({
					name: "xl/drawings/_rels/drawing1.xml.rels",
					data: bytes(relationships + "</Relationships>")
				});
				images.forEach((image, index) => files.push({
					name: "xl/media/image" + (index + 1) + ".png",
					data: image.bytes
				}));
			}
			return deps.zip(files);
		};
	}
	//#endregion
	//#region src/presentation/report/report-xlsx-header.ts
	function createReportXlsxHeader(input) {
		const S = (v, s) => ({
			v,
			s
		});
		const row = (l1, v1, l2, v2) => [
			S(l1, input.styles.LABEL),
			S("", input.styles.LABEL),
			S(v1, input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S(l2, input.styles.LABEL),
			S("", input.styles.LABEL),
			S(v2, input.styles.VAL),
			S("", input.styles.VAL)
		];
		const wide = (label, value) => [
			S(label, input.styles.LABEL),
			S("", input.styles.LABEL),
			S(value, input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL)
		];
		const brand = (input.labName || "BỆNH VIỆN / ĐƠN VỊ") + " · " + (input.department || "Khoa Xét nghiệm") + (input.address ? " · " + input.address : "") + "   ·   Xuất " + input.exportedAt + " · Người xuất: " + input.exportedBy;
		const teaSource = input.teaSource + (input.teaReference ? " · " + input.teaReference : "") + (input.teaDocument ? " · " + input.teaDocument : "") + (input.teaApprovedBy ? " · duyệt " + input.teaApprovedBy : "");
		const rows = [
			[S("BÁO CÁO NỘI KIỂM CHẤT LƯỢNG XÉT NGHIỆM", input.styles.TITLE)],
			[S(brand, input.styles.SUB)],
			[],
			row("Phiên bản app", (input.appName || "QC Lab") + " " + (input.appVersion || "dev"), "Bộ luật áp dụng", input.rules || "Chưa cấu hình"),
			row("Xét nghiệm", input.testName + (input.testUnit ? " · " + input.testUnit : ""), "Máy", input.machine),
			row("Khoảng ngày", input.range, "TEa%", String(input.tea || "—")),
			wide("Nguồn TEa", teaSource),
			wide("Ghi chú Sigma", "Sigma (kỳ) tính từ Mean/CV thực tế trong đúng khoảng ngày báo cáo này, khác với Sigma đã thẩm định ở trang Six Sigma & Sai số. Dấu * nghĩa là kỳ có n < 20 kết quả, CV/Sigma chưa đủ ổn định.")
		];
		return {
			rows,
			merges: [
				"A1:J1",
				"A2:J2",
				"A4:B4",
				"C4:F4",
				"G4:H4",
				"I4:J4",
				"A5:B5",
				"C5:F5",
				"G5:H5",
				"I5:J5",
				"A6:B6",
				"C6:F6",
				"G6:H6",
				"I6:J6",
				"A7:B7",
				"C7:J7",
				"A8:B8",
				"C8:J8"
			],
			rowHeights: {
				1: 24,
				2: brand.length > 120 ? 29 : 15,
				4: 21,
				5: 21,
				6: 21,
				7: Math.min(54, 18 + Math.ceil(teaSource.length / 110) * 12),
				8: Math.min(54, 18 + Math.ceil(rows[7][2].v.length / 110) * 12)
			}
		};
	}
	//#endregion
	//#region src/presentation/report/report-header.ts
	function reportHeaderPresentation(input) {
		const esc = input.escape;
		const lab = input.lab || {};
		const app = input.app || { version: "dev" };
		const rules = Object.entries(input.westgardRules || {}).filter(([, enabled]) => enabled !== false).map(([id]) => id).join(", ");
		const subtitle = input.subtitle || "Nội kiểm chất lượng xét nghiệm";
		return "<div class=\"rpt-head\"><div class=\"rpt-brand\"><div><div class=\"rpt-hosp\">" + esc(lab.name || "BỆNH VIỆN / ĐƠN VỊ") + "</div><div class=\"rpt-dept\">" + esc(lab.dept || "Khoa Xét nghiệm") + "</div><div class=\"rpt-addr\">" + esc(lab.address || "") + "</div></div></div><div class=\"rpt-meta\"><b>Thời gian xuất</b><span>" + input.exportedAt + "</span><b class=\"rpt-meta-label\">Người xuất</b><span>" + esc(input.exportedBy) + "</span></div></div><table class=\"meta-table\"><tr><th>Phiên bản app</th><td>" + esc((app.name || "QC Lab") + " " + (app.version || "dev")) + "</td><th>Bộ luật áp dụng</th><td>" + esc(rules || "Chưa cấu hình") + "</td></tr></table><div class=\"rpt-title\"><div>" + input.title + "</div><span>" + esc(subtitle) + "</span></div>";
	}
	//#endregion
	//#region src/presentation/report/report-nce-appendix.ts
	function createReportNceAppendix(deps) {
		return (actions, test) => "<div class=\"nce-appendix\"><h3>Phụ lục - Hồ sơ NCE chi tiết</h3><p class=\"nce-appendix-intro\">Phụ lục giữ đầy đủ nội dung điều tra, bằng chứng QC chạy lại, đánh giá hiệu lực và phê duyệt. Bảng tổng hợp phía trên chỉ trình bày thông tin trọng yếu.</p>" + actions.map((action) => deps.detail(action, test)).join("") + "</div>";
	}
	//#endregion
	//#region src/presentation/report/report-nce-detail-html.ts
	function createReportNceDetailHtml(deps) {
		return (action, test) => {
			const model = deps.model(action, test), field = deps.field, checks = (model.checks || []).map((check) => `<tr><td><b>${deps.escape(check[0])}</b></td><td>${deps.escape(check[1])}</td><td>${deps.escape(check[2])}</td></tr>`).join("");
			let html = `<section class="nce-detail"><div class="nce-detail-head"><h3>Phiếu NCE ${deps.escape(model.nceTitle)}</h3><div class="nce-detail-status">${deps.escape(model.wfLabel)}</div></div><div class="nce-detail-grid">${field("Ngày xảy ra", model.eventDateText)}${field("Xét nghiệm / mức / lô", model.testLevelText)}${field("Luật / loại sai số", model.ruleErrText)}${field("Nguồn / giai đoạn", model.sourcePhaseText)}${field("Người phụ trách / hạn", model.ownerDueText)}${field("Trạng thái bản ghi", model.recordStatusText)}</div>`;
			if (!model.modern) return html + `<h4>Hành động đã ghi</h4><div class="nce-detail-text">${deps.escape(model.legacyActionText)}</div><h4>QC chạy lại / duyệt</h4><div class="nce-detail-grid">${field("QC chạy lại", model.rerunText)}${field("Phê duyệt", model.approvalShortText)}</div></section>`;
			html += `<h4>1. Kiểm soát và xử lý tức thời</h4><div class="nce-detail-stack"><div class="nce-detail-grid">${field("Phạm vi kiểm soát", model.containmentText)}${field("Ghi chú phạm vi", model.containmentNote)}</div><div class="nce-detail-text">${deps.escape(model.correctionText)}</div></div>`;
			html += `<h4>2. Đánh giá nguy cơ ban đầu</h4><div class="nce-detail-grid">${field("Phân loại / RPN", model.riskText)}${field("S x O x D", model.sodText)}${field("Căn cứ SOP", model.riskBasis, true)}</div>`;
			html += `<h4>3. Checklist điều tra</h4><table class="nce-check-table"><colgroup><col class="nce-check-item-col"><col class="nce-check-result-col"><col class="nce-check-note-col"></colgroup><tr><th>Hạng mục</th><th>Kết luận</th><th>Ghi chú / bằng chứng</th></tr>${checks}</table>`;
			html += `<h4>4. Nguyên nhân và hành động khắc phục</h4><div class="nce-detail-stack"><div class="nce-detail-grid">${field("Nhóm nguyên nhân", model.causeCategoryText)}${field("Ngày hoàn thành hành động", model.actionCompletedText)}</div><div class="nce-detail-text"><b>Nguyên nhân:</b> ${deps.escape(model.causeText)}\n<b>Hành động khắc phục:</b> ${deps.escape(model.actionText)}</div></div>`;
			html += `<h4>5. Bằng chứng QC chạy lại và cho phép trở lại</h4><div class="nce-detail-grid">${field("QC chạy lại", model.rerunText)}${field("Quyết định", model.releaseText)}${field("Ngày / người cho phép", model.releaseWhoText)}${field("Căn cứ cho phép", model.releaseNote)}</div>`;
			html += `<h4>6. Ảnh hưởng người bệnh</h4><div class="nce-detail-grid">${field("Kết luận", model.patientText)}${field("Xử lý kết quả liên quan", model.patientAction)}</div>`;
			html += `<h4>7. Hiệu lực, nguy cơ còn lại và phê duyệt</h4><div class="nce-detail-grid">${field("Đánh giá hiệu lực", model.effLabel)}${field("Ngày / người đánh giá", model.effWhoText)}${field("Bằng chứng hiệu lực", model.effNote)}${field("Nguy cơ còn lại", model.residualText)}${field("Căn cứ đánh giá lại", model.residualBasis)}${field("Phê duyệt", model.approvalText)}${field("Ý kiến duyệt", model.approvalNote, true)}</div>`;
			if (model.cancelled) html += `<h4>Thông tin hủy hồ sơ</h4><div class="nce-detail-text">${deps.escape(model.cancelText)}</div>`;
			return html + "</section>";
		};
	}
	//#endregion
	//#region src/presentation/report/report-sign-block.ts
	function reportSignBlock() {
		return "<div class=\"sign-grid\"><div><b>Người thực hiện</b><span>(Ký, ghi rõ họ tên)</span></div><div><b>Người kiểm tra</b><span>(Ký, ghi rõ họ tên)</span></div><div><b>Phụ trách khoa</b><span>(Ký, ghi rõ họ tên)</span></div></div>";
	}
	//#endregion
	//#region src/presentation/report/report-lock-list-html.ts
	function createReportLockListHtml(deps) {
		return (locks, isAdmin) => {
			const rows = deps.sorted(locks || []);
			if (!rows.length) return "<div class=\"hint\">Chưa có kỳ nào được khóa.</div>";
			return `<div class="period-lock-list">${rows.map((lock) => {
				const by = deps.escape(lock.lockedBy || "—");
				const at = lock.lockedAt ? ` lúc ${deps.dateTime(lock.lockedAt)}` : "";
				const action = isAdmin ? deps.button("Mở khóa", `reportUnlockPeriod('${deps.quote(lock.ym)}')`, "ghost sm") : "";
				return `<div class="period-lock-row"><div><b>Kỳ ${deps.escape(deps.month(lock.ym))}</b><span class="hint"> · Khóa bởi ${by}${at}</span></div>${action}</div>`;
			}).join("")}</div>`;
		};
	}
	//#endregion
	//#region src/presentation/report/report-unlock-reason.ts
	function createReportUnlockReason(deps) {
		return (value) => {
			const reason = deps.clean(value, 1e3).trim();
			return reason.length >= 5 ? {
				valid: true,
				reason,
				error: ""
			} : {
				valid: false,
				reason,
				error: "Cần ghi lý do mở khóa tối thiểu 5 ký tự."
			};
		};
	}
	//#endregion
	//#region src/presentation/report/report-lock-picker.ts
	function reportLockPicker(ym, nowYear) {
		const match = /^(\d{4})-(\d{2})$/.exec(ym);
		const year = match ? Number(match[1]) : nowYear;
		const rawMonth = match ? Number(match[2]) : 1;
		return {
			year,
			month: rawMonth >= 1 && rawMonth <= 12 ? rawMonth : 1,
			months: Array.from({ length: 12 }, (_, index) => index + 1),
			years: Array.from({ length: 5 }, (_, index) => nowYear - 3 + index)
		};
	}
	//#endregion
	//#region src/presentation/report/report-lock-panel-html.ts
	function createReportLockPanelHtml(deps) {
		return (input) => {
			const monthOptions = input.months.map((month) => `<option value="${month}" ${input.month === month ? "selected" : ""}>Tháng ${month}</option>`).join("");
			const yearOptions = input.years.map((year) => `<option value="${year}" ${input.year === year ? "selected" : ""}>${year}</option>`).join("");
			const action = input.isAdmin ? input.already ? deps.button("Kỳ này đã khóa", "", "ghost", "", { disabled: true }) : deps.button("Khóa kỳ này", "reportLockPeriod()", "teal") : "<span class=\"hint\">Chỉ admin mới khóa/mở khóa được kỳ báo cáo.</span>";
			return `<div class="panel"><h2 class="panel-title">Khóa kỳ báo cáo</h2>
     <div class="hint">Khóa 1 kỳ (theo tháng) sẽ chặn sửa/hủy điểm QC của kỳ đó ở <b>mọi xét nghiệm</b> — nên làm sau khi đã xuất xong báo cáo chính thức của kỳ.</div>
     <div class="report-lock-controls">
       <div><label>Tháng</label><select aria-label="Tháng" ${input.isAdmin ? "" : "disabled"} onchange="reportSetLockPart('month',this.value)">${monthOptions}</select></div>
       <div><label>Năm</label><select aria-label="Năm" ${input.isAdmin ? "" : "disabled"} onchange="reportSetLockPart('year',this.value)">${yearOptions}</select></div>
       <div style="align-self:end">${action}</div>
     </div>
     <div class="flow-panel">${input.lockListHtml}</div>
   </div>`;
		};
	}
	//#endregion
	//#region src/presentation/report/report-page-html.ts
	function createReportPageHtml(deps) {
		return (input) => {
			if (!input.tests.length) return deps.head("Báo cáo & Biểu mẫu", "") + `<div class="panel">${deps.empty("Chưa có xét nghiệm đang vận hành", "Cần có Panel QC, Nhóm lô QC, Mean/SD và dữ liệu QC trước khi tạo báo cáo.", input.isAdmin ? deps.button("Cấu hình Mean/SD", "go('manage');setManageTab('targets')", "teal") : "")}</div>${input.lockPanelHtml}`;
			const options = input.matched.length ? input.matched.map((test) => `<option value="${deps.escapeAttr(test.id)}" ${test.id === input.selectedId ? "selected" : ""}>${deps.escape(deps.label(test, input.tests))}</option>`).join("") : "<option value=\"\">Không tìm thấy xét nghiệm phù hợp</option>";
			const actionOptions = {
				disabled: !input.matched.length,
				attrs: { "data-report-action": "" }
			};
			return deps.head("Báo cáo & Biểu mẫu", "Tổng hợp hồ sơ nội kiểm theo khoảng ngày lựa chọn") + `<div class="panel"><h2 class="panel-title">Báo cáo nội kiểm theo ngày</h2>
       <div class="grid4"><div><label>Tìm xét nghiệm</label><input id="reportSearch" type="search" placeholder="Tìm tên xét nghiệm" value="${deps.escapeAttr(input.query)}" oninput="reportSearchSet(this.value)"></div>
         <div><label>Xét nghiệm <span id="reportTestCount" class="hint">(${input.matched.length}/${input.tests.length})</span></label><select id="rTest" aria-label="Xét nghiệm" ${input.matched.length ? "" : "disabled"} onchange="reportTest=this.value">${options}</select></div>
         ${deps.rangePicker(input.start, input.end)}</div>
       <div class="report-export-options"><label class="report-nce-option"><input id="reportNceAppendix" type="checkbox" checked><span><b>Kèm phụ lục NCE</b><small>(Áp dụng cho PDF và Excel)</small></span></label></div>
       <div class="report-actions">${deps.button(deps.actionIcon("print") + "Tạo báo cáo &amp; In", "printReport()", "teal", "", actionOptions)}${deps.button("Xuất Excel", "exportReportXLSX()", "teal", "", actionOptions)}${deps.button("Xuất CSV", "exportReportCSV()", "teal", "", actionOptions)}</div>
     </div>${input.lockPanelHtml}`;
		};
	}
	//#endregion
	//#region src/presentation/report/report-range-picker-html.ts
	function createReportRangePickerHtml(deps) {
		return (start, end) => `<div><label>Từ ngày</label>${deps.dateBox("rStartDate", start, "", "onchange=\"reportRangeChanged()\"")}</div><div><label>Đến ngày</label>${deps.dateBox("rEndDate", end, "", "onchange=\"reportRangeChanged()\"")}</div>`;
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-loading.ts
	function createDashboardLoading(deps) {
		return (tests, pending, data, lab) => {
			const points = (tests || []).reduce((sum, test) => sum + (data[test.id] || []).length, 0);
			const department = lab.dept ? " · " + deps.escape(lab.dept) : "";
			return `<div class="head"><div><h1>Bảng điều khiển</h1><p>${deps.escape(lab.name || "Khoa Xét nghiệm")}${department}</p></div>${deps.topUserBox()}</div>
    <div class="dash-hero dash-analysis-loading">
      <div class="dash-status"><div class="eyebrow">Đang chuẩn bị dữ liệu</div><h2>Phân tích Westgard chạy nền</h2><p>Bạn có thể tiếp tục sử dụng ứng dụng. Bảng điều khiển sẽ tự cập nhật khi phân tích hoàn tất.</p><div class="dash-loading-bar"><span></span></div></div>
      <div class="dash-kpis"><div class="dash-kpi"><div class="k">Xét nghiệm</div><div class="v">${tests.length}</div></div><div class="dash-kpi"><div class="k">Điểm QC</div><div class="v">${points}</div></div><div class="dash-kpi"><div class="k">Đang xử lý</div><div class="v">${pending}</div></div><div class="dash-kpi"><div class="k">Giao diện</div><div class="v dash-ready-mark">✓</div></div></div>
    </div>
    <div class="panel dash-loading-panel"><div class="dash-spinner"></div><div><h2 class="panel-title">Đang tính trạng thái kiểm soát chất lượng</h2><p class="hint">Công việc nặng đã được chuyển khỏi luồng giao diện để thao tác không bị đóng băng.</p></div></div>`;
		};
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-status-filter.ts
	var DASH_TEST_STATUSES = Object.freeze([
		"all",
		"missing",
		"rej",
		"warn",
		"ok"
	]);
	function createDashboardStatusFilter() {
		const normalize = (value) => DASH_TEST_STATUSES.includes(value) ? value : "all";
		const matches = (item, value) => {
			const status = normalize(value);
			return status === "all" || (status === "missing" ? item.missingToday : item.s === status);
		};
		return Object.freeze({
			normalize,
			matches
		});
	}
	//#endregion
	//#region src/domain/qc/dashboard-expiring-lots.ts
	function dashboardExpiringLots(entries) {
		const grouped = /* @__PURE__ */ new Map();
		entries.forEach((entry) => {
			const key = entry.l.qcLotId || (entry.l.lot || "") + "|" + entry.l.level;
			const current = grouped.get(key);
			if (!current || entry.d < current.d) grouped.set(key, {
				...entry,
				count: (current ? current.count : 0) + 1
			});
			else current.count++;
		});
		return grouped;
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-shift-status.ts
	function dashboardShiftStatus(input) {
		if (input.rejected) return {
			mood: "Cần xử lý ngay",
			text: "Có xét nghiệm đang bị loại, ưu tiên kiểm tra và ghi nhận khắc phục."
		};
		if (input.overdueActions) return {
			mood: "Có hồ sơ NCE quá hạn",
			text: `${input.overdueActions} hồ sơ khắc phục đã qua hạn xử lý mà chưa khép vòng.`
		};
		if (input.warnings) return {
			mood: "Có cảnh báo cần theo dõi",
			text: "Có tín hiệu cảnh báo, nên xem lại biểu đồ và xu hướng trước khi trả kết quả."
		};
		if (input.missingToday) return {
			mood: "Còn QC cần nhập",
			text: "Một số xét nghiệm chưa đủ QC hôm nay, nên hoàn tất trước giờ chạy mẫu."
		};
		return {
			mood: "Đang trong kiểm soát",
			text: "Không có cảnh báo trọng yếu trong dữ liệu hiện tại."
		};
	}
	//#endregion
	//#region src/domain/qc/dashboard-kpis.ts
	function dashboardKpis(items, testCount) {
		const totalPoints = items.reduce((sum, item) => sum + item.totalPoints, 0);
		const todayPoints = items.reduce((sum, item) => sum + item.todayCount, 0);
		const rejected = items.filter((item) => item.s === "rej").length;
		const warnings = items.filter((item) => item.s === "warn").length;
		const missingToday = items.filter((item) => item.missingToday).length;
		const completeTests = Math.max(0, testCount - missingToday);
		return {
			totalPoints,
			todayPoints,
			rejected,
			warnings,
			missingToday,
			completeTests,
			completionPercent: testCount ? Math.round(completeTests / testCount * 100) : 0
		};
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-status-tabs-html.ts
	var TABS = [
		["all", "Tất cả"],
		["missing", "Chưa QC"],
		["rej", "Loại bỏ"],
		["warn", "Cảnh báo"],
		["ok", "Đạt"]
	];
	function createDashboardStatusTabsHtml(deps) {
		return (items, selected) => TABS.map(([key, label]) => {
			const count = key === "all" ? items.length : items.filter((item) => deps.matches(item, key)).length;
			return `<button class="${selected === key ? "on" : ""}" onclick="dashTestSetStatus('${key}')">${label}<b>${count}</b></button>`;
		}).join("");
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-expiring-lots-html.ts
	function createDashboardExpiringLotsHtml(deps) {
		return (lots) => {
			return [...lots].sort((a, b) => a.d - b.d).slice(0, 5).map((item) => {
				const expired = item.d < 0;
				const state = expired ? "rej" : "warn";
				const meta = item.count > 1 ? `${item.count} xét nghiệm · ` : "";
				const remaining = expired ? `Hết hạn ${-item.d} ngày` : `Còn ${item.d} ngày`;
				return `<div class="shift-item ${state}"><div><b>Lô ${deps.escape(item.l.lot || "?")} · M${item.l.level}</b><div class="meta">${meta}${remaining}</div></div><span class="tag ${state}">${expired ? "Hết hạn" : "Sắp hết"}</span></div>`;
			}).join("") || "<div class=\"hint\">Không có lô sắp hết hạn trong 30 ngày.</div>";
		};
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-qc-followup-item-html.ts
	function createDashboardQcFollowupItemHtml(deps) {
		return (item, status) => `<div class="shift-item ${status}"><div><b>${deps.escape(deps.testLabel(item.t))} · M${item.l.level}</b><div class="meta">${deps.date(item.p.date)} · ${deps.pointValue(item.p, item.t)} ${deps.escape(item.t.unit || "")} · ${item.rules.join(", ") || "—"}</div></div>${deps.button("Xem", `entrySel={testId:'${deps.quote(item.t.id)}',level:${item.l.level}};entryStart=null;entryEnd=null;go('entry')`, "ghost sm")}</div>`;
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-missing-target-item-html.ts
	function createDashboardMissingTargetItemHtml(deps) {
		return (item) => `<div class="shift-item warn"><div><b>${deps.escape(deps.testLabel(item.t))} · M${item.l.level}</b><div class="meta">Chưa có Mean/SD hợp lệ — điểm QC mức này không được đánh giá Westgard</div></div>${deps.button("Gán Mean/SD", "go('manage');setManageTab('targets')", "ghost sm")}</div>`;
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-overdue-action-item-html.ts
	function createDashboardOverdueActionItemHtml(deps) {
		return (input) => {
			const title = input.test ? deps.escape(deps.testLabel(input.test)) : deps.escape(input.action.rule || "Sự cố");
			return `<div class="shift-item rej"><div><b>${deps.escape(input.action.nceId || "Hồ sơ khắc phục")} · ${title}</b><div class="meta">${deps.escape(input.info.label)} · hạn ${deps.date(input.action.dueDate)} · phụ trách ${deps.escape(input.action.by || "—")}</div></div>${deps.button("Tiếp tục hồ sơ", `go('actions');editAction(${input.index})`, "ghost sm")}</div>`;
		};
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-test-status-tags.ts
	var dashboardTestStatusTags = Object.freeze({
		westgard(status) {
			if (status === "rej") return "<span class=\"tag rej\">Loại bỏ</span>";
			if (status === "warn") return "<span class=\"tag warn\">Cảnh báo</span>";
			if (status === "ok") return "<span class=\"tag ok\">Đạt</span>";
			return "<span class=\"pill\">chưa có</span>";
		},
		today(todayCount, levelCount) {
			if (todayCount >= levelCount && levelCount) return "<span class=\"tag ok\">Đủ hôm nay</span>";
			if (todayCount) return `<span class="tag warn">${todayCount}/${levelCount} mức</span>`;
			return "<span class=\"tag none\">Chưa QC</span>";
		}
	});
	//#endregion
	//#region src/presentation/dashboard/dashboard-level-pill-html.ts
	function createDashboardLevelPillHtml(deps) {
		return (input) => {
			const className = `dash-level-pill ${input.today ? "done" : ""}${input.targetOk ? "" : " missing-target"}`;
			const title = input.targetOk ? "" : " title=\"Chưa có Mean/SD hợp lệ — không đánh giá Westgard\"";
			const lot = input.level.lot ? ` · ${deps.escape(input.level.lot)}` : "";
			const cv = input.cv == null ? "" : ` · CV ${deps.format(input.cv)}%`;
			return `<span class="${className}"${title}>M${input.level.level}${lot}${cv}${input.targetOk ? "" : " · thiếu Mean/SD"}</span>`;
		};
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-test-rank.ts
	function dashboardTestRank(status, todayCount, levelCount) {
		if (status === "rej") return 0;
		if (status === "warn") return 1;
		if (todayCount < levelCount) return 2;
		if (status === "ok") return 3;
		return 4;
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-latest-point-text.ts
	function createDashboardLatestPointText(deps) {
		return (point, test) => point ? `${deps.date(point.date)} · M${point._level} · ${deps.pointValue(point, test)}` : "Chưa có điểm";
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-completion.ts
	function dashboardCompletion(testCount, missingTodayCount) {
		const completeTests = Math.max(0, testCount - missingTodayCount);
		return {
			completeTests,
			percent: testCount ? Math.round(completeTests / testCount * 100) : 0
		};
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-followup-panel-html.ts
	function dashboardFollowupPanelHtml(urgent, overdue, missingTarget, watch) {
		const content = `${urgent}${overdue}${missingTarget}${watch}`;
		return content ? `<div class="dash-list">${content}</div>` : "<div class=\"alert ok\">Không có điểm bị loại/cảnh báo cần xử lý ngay.</div>";
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-test-search-text.ts
	function createDashboardTestSearchText(deps) {
		return (test, levels) => deps.normalize([
			test.name,
			deps.label(test),
			test.machine,
			test.section,
			test.method,
			test.unit,
			...levels.map((item) => `M${item.l.level} ${item.l.lot || ""}`)
		].join(" "));
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-latest-point.ts
	function createDashboardLatestPoint(deps) {
		return (points) => {
			const sorted = points.slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""), "vi", { numeric: true }) || deps.runNumber(a) - deps.runNumber(b));
			return sorted[sorted.length - 1];
		};
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-kpis-html.ts
	function dashboardKpisHtml(items) {
		return `<div class="dash-kpis">${items.map((item) => `<div class="dash-kpi"><div class="k">${item.label}</div><div class="v${item.className ? ` ${item.className}` : ""}"${item.color ? ` style="color:${item.color}"` : ""}>${item.value}</div></div>`).join("")}</div>`;
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-progress-html.ts
	function dashboardProgressHtml(completeTests, testCount, percent) {
		const safePercent = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
		return `<div class="dash-progress"><span style="width:${safePercent}%"></span></div><div class="hint flow-item">${completeTests}/${testCount || 0} xét nghiệm đã đủ QC hôm nay · ${safePercent}% hoàn tất</div>`;
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-test-list-html.ts
	function dashboardTestListHtml(visibleCount, rowsHtml) {
		if (!visibleCount) return "<div class=\"dash-test-empty\">Không tìm thấy xét nghiệm phù hợp.</div>";
		return `<div class="dash-test-list"><table><thead><tr><th>Xét nghiệm</th><th>Mức QC / lô</th><th>QC hôm nay</th><th class="num">Tổng điểm</th><th>Westgard</th><th>Gần nhất</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>${rowsHtml}</tbody></table></div><div id="dashTestEmpty" class="dash-test-empty" style="display:none">Không tìm thấy xét nghiệm phù hợp.</div>`;
	}
	//#endregion
	//#region src/presentation/dashboard/dashboard-page-html.ts
	function createDashboardPageHtml() {
		return (input) => `${input.headHtml}
   <div class="dash-hero">
     <div class="dash-status"><div class="eyebrow">Trạng thái trực ca · ${input.todayText}</div><h2>${input.mood}</h2><p>${input.moodText}</p>${input.progressHtml}</div>
     ${input.kpisHtml}
   </div>
   <div class="dash-main">
     <div class="panel"><h2 class="panel-title">Cần xử lý / Theo dõi</h2>${input.followHtml}</div>
     <div class="panel"><h2 class="panel-title">Lô & hạn dùng</h2><div class="dash-list">${input.expiringLotsHtml}</div></div>
   </div>
   ${input.testsPanelHtml}`;
	}
	//#endregion
	//#region src/presentation/report/report-qc-format.ts
	function createReportQcFormat(deps) {
		const value = (test, raw) => deps.testValue ? deps.testValue(test, raw) : deps.format(raw, 3);
		const stat = (test, raw) => deps.testStat ? deps.testStat(test, raw) : deps.format(raw, 3);
		const point = (item, test) => deps.pointValue ? deps.pointValue(item, test) : deps.format(item?.val, Math.max(2, Number(item?.valueDecimals) || 0));
		return Object.freeze({
			value,
			stat,
			point
		});
	}
	//#endregion
	//#region src/domain/qc/range-tea.ts
	function createRangeTea(deps) {
		const percent = (test, level) => {
			const value = test && level ? deps.teaBySource(test, deps.teaSource(test), level.mean) : 0;
			return Number.isFinite(value) && Number(value) > 0 ? Number(value) : null;
		};
		const quarter = (teaPercent) => teaPercent != null && teaPercent > 0 ? teaPercent / 4 : null;
		return Object.freeze({
			percent,
			quarter
		});
	}
	//#endregion
	//#region src/presentation/entry/entry-rows-window.ts
	function entryRowsWindow(rows, expanded, initialRows) {
		const all = rows || [];
		const visible = expanded ? all : all.slice(-initialRows);
		return {
			rows: visible,
			total: all.length,
			limited: visible.length < all.length,
			expanded
		};
	}
	function entryLotLabels(levels) {
		return (levels || []).map((level) => String(level.lot || "").trim()).filter(Boolean).join(" / ") || "Chưa gán lô";
	}
	//#endregion
	//#region src/presentation/entry/entry-sheet-month.ts
	function entrySheetMonthValue(value) {
		const month = String(value || "");
		return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
	}
	function entrySheetMonthPart(current, fallback, part, value) {
		const match = /^(\d{4})-(\d{2})$/.exec(String(current || fallback));
		if (!match) return fallback;
		const year = part === "year" ? Number(value) : Number(match[1]);
		const month = part === "month" ? Number(value) : Number(match[2]);
		if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return fallback;
		return `${year}-${String(month).padStart(2, "0")}`;
	}
	//#endregion
	//#region src/presentation/entry/entry-tree-state.ts
	function createEntryTreeState(deps) {
		return (test) => {
			if (!test) return "none";
			const order = {
				none: -1,
				ok: 0,
				warn: 1,
				rej: 2
			};
			const westgard = deps.activeWestgard(test);
			let worst = "none";
			deps.operationalLevels(test).forEach((level) => {
				const points = deps.pointsForLot(test.id, level.level, level.lot || "");
				const last = points[points.length - 1];
				const verdict = (last && westgard.byPoint.get(last.id) || {}).level || "none";
				if ((order[verdict] ?? -1) > order[worst]) worst = verdict;
			});
			return worst;
		};
	}
	//#endregion
	//#region src/presentation/entry/entry-sheet-navigation.ts
	function createEntrySheetNavigation(deps) {
		const target = (inputs, current, key, shiftKey = false) => {
			const available = inputs || [];
			if (!available.length || !available.includes(current)) return null;
			if (key === "ArrowLeft" || key === "ArrowRight" || key === "Tab") {
				const row = available.filter((item) => deps.date(item) === deps.date(current) && deps.run(item) === deps.run(current));
				const index = row.indexOf(current);
				const step = key === "ArrowLeft" || key === "Tab" && shiftKey ? -1 : 1;
				if (index < 0 || row.length < 2) return null;
				return key === "Tab" ? row[(index + step + row.length) % row.length] : row[index + step] || null;
			}
			if (key === "ArrowUp" || key === "ArrowDown" || key === "Enter") {
				const column = available.filter((item) => deps.level(item) === deps.level(current));
				const index = column.indexOf(current);
				const step = key === "ArrowUp" ? -1 : 1;
				if (index < 0 || column.length < 2) return null;
				return key === "Enter" ? column[(index + 1) % column.length] : column[index + step] || null;
			}
			return null;
		};
		return Object.freeze({ target });
	}
	//#endregion
	//#region src/presentation/entry/entry-sheet-input-order.ts
	function createEntrySheetInputOrder(deps) {
		return (inputs) => [...inputs].sort((left, right) => deps.date(left).localeCompare(deps.date(right), "vi", { numeric: true }) || deps.run(left) - deps.run(right) || deps.level(left) - deps.level(right));
	}
	//#endregion
	//#region src/presentation/entry/entry-tree-group-state.ts
	var ENTRY_TREE_STATE_ORDER = {
		none: -1,
		ok: 0,
		warn: 1,
		rej: 2
	};
	function entryTreeGroupState(states) {
		let worst = "none";
		states.forEach((state) => {
			if ((ENTRY_TREE_STATE_ORDER[state] ?? -1) > ENTRY_TREE_STATE_ORDER[worst]) worst = state;
		});
		return worst;
	}
	//#endregion
	//#region src/presentation/entry/entry-tree-navigation.ts
	function createEntryTreeNavigation() {
		const target = (items, current, key) => {
			const visible = items || [];
			const index = visible.indexOf(current);
			if (index < 0 || !visible.length) return null;
			if (key === "Home") return visible[0] || null;
			if (key === "End") return visible[visible.length - 1] || null;
			return visible[(index + (key === "ArrowDown" ? 1 : -1) + visible.length) % visible.length] || null;
		};
		return Object.freeze({ target });
	}
	//#endregion
	//#region src/presentation/entry/entry-sheet-focus.ts
	function createEntrySheetFocus(isEmpty) {
		return (candidates) => {
			const items = candidates || [];
			return items.find(isEmpty) || items[0] || null;
		};
	}
	//#endregion
	//#region src/presentation/entry/entry-column-config.ts
	function createEntryColumnConfig(deps) {
		return (test, level, lotNo) => {
			const config = test && deps.levelConfig(test, Number(level));
			if (!config) return null;
			if (!lotNo || String(lotNo) === String(config.lot || "")) return config;
			const parallel = deps.parallelLot(test, Number(level));
			if (!parallel || String(parallel.lotNo) !== String(lotNo)) return null;
			return {
				level: config.level,
				lot: parallel.lotNo,
				mean: parallel.mean,
				sd: parallel.sd,
				low: parallel.low,
				high: parallel.high,
				exp: parallel.exp,
				meanSdHistory: [],
				applied: "mfg"
			};
		};
	}
	//#endregion
	//#region src/presentation/entry/entry-range-preset.ts
	function entryRangePreset(days) {
		return {
			days: Math.min(90, days),
			start: null,
			end: null
		};
	}
	//#endregion
	//#region src/presentation/entry/entry-tree-collapse-preference.ts
	function readEntryTreeCollapsed(read) {
		try {
			return read() === "1";
		} catch {
			return false;
		}
	}
	function writeEntryTreeCollapsed(collapsed) {
		return collapsed ? "1" : "0";
	}
	//#endregion
	//#region src/presentation/entry/entry-tree-visibility.ts
	function entryTreeVisibility(nodes, query, openKeys) {
		if (!query) {
			const visible = nodes.map(() => true);
			nodes.forEach((node, index) => {
				if (node.role === "group" && !openKeys.has(String(node.key || ""))) for (let cursor = index + 1; nodes[cursor]?.role === "assay"; cursor += 1) visible[cursor] = false;
				if (node.role === "machine" && !openKeys.has(String(node.key || ""))) for (let cursor = index + 1; cursor < nodes.length && nodes[cursor].role !== "machine"; cursor += 1) visible[cursor] = false;
			});
			return visible;
		}
		const visible = nodes.map(() => false);
		nodes.forEach((node, index) => {
			if (node.role !== "assay" || !String(node.search || "").includes(query)) return;
			visible[index] = true;
			for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (nodes[cursor].role === "group") {
				visible[cursor] = true;
				break;
			}
			for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (nodes[cursor].role === "machine") {
				visible[cursor] = true;
				break;
			}
		});
		return visible;
	}
	//#endregion
	//#region src/presentation/entry/entry-tree-key-command.ts
	function entryTreeKeyCommand(key, expanded) {
		if (key === "Enter" || key === " ") return "toggle";
		if (key === "ArrowRight" && expanded === "false" || key === "ArrowLeft" && expanded === "true") return "toggle";
		return key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End" ? "navigate" : null;
	}
	//#endregion
	//#region src/presentation/entry/entry-selection-state.ts
	var entrySelectionState = Object.freeze({
		pick(testId, level) {
			return {
				selection: {
					testId,
					level
				},
				start: null,
				end: null,
				message: ""
			};
		},
		focus(selection, level) {
			return selection ? {
				testId: selection.testId,
				level
			} : null;
		},
		previousLotKey(selection, level) {
			return selection ? `${selection.testId}|${level}` : null;
		}
	});
	//#endregion
	//#region src/presentation/entry/entry-expanded-tables-state.ts
	function entryExpandedTablesToggle(keys, key, limit = 24) {
		const next = [...keys];
		const index = next.indexOf(key);
		if (index >= 0) {
			next.splice(index, 1);
			return next;
		}
		next.push(key);
		return next.slice(-Math.max(1, limit));
	}
	//#endregion
	//#region src/presentation/entry/entry-point-context.ts
	function entryPointContext(testId, level, lotNo, activeLot) {
		return {
			parallel: !!lotNo && String(lotNo) !== String(activeLot || ""),
			selection: {
				testId,
				level
			}
		};
	}
	//#endregion
	//#region src/presentation/entry/entry-void-nce-choice.ts
	function entryVoidNceChoice(kind) {
		if (kind === "analytical") return {
			openNce: true,
			disabled: true,
			hint: "Hệ thống sẽ lập hồ sơ NCE mới, hoặc dùng lại hồ sơ đang mở của điểm này, rồi chờ một kết quả QC chạy lại được chấp nhận.",
			reasonLabel: "Ghi chú / bằng chứng (khuyến nghị)"
		};
		if (kind === "data-entry") return {
			openNce: false,
			disabled: true,
			hint: "Chỉ lưu dấu vết hủy; không mở NCE và không yêu cầu chạy lại QC.",
			reasonLabel: "Ghi chú / bằng chứng (khuyến nghị)"
		};
		return {
			openNce: false,
			disabled: false,
			hint: "Chọn mục này nếu sự việc cần điều tra và xác nhận QC chạy lại.",
			reasonLabel: "Lý do hủy (bắt buộc, tối thiểu 5 ký tự)"
		};
	}
	function entryVoidReasonValid(kind, reason) {
		return kind !== "other" || String(reason || "").trim().length >= 5;
	}
	//#endregion
	//#region src/presentation/entry/entry-record-error-message.ts
	function entryRecordErrorMessage(error) {
		return error === "period-locked" ? "Kỳ này đã chốt, không thể nhập điểm QC." : "Không thể lưu điểm QC không hợp lệ.";
	}
	//#endregion
	//#region src/presentation/entry/entry-save-feedback.ts
	function entrySaveFeedback(input) {
		const tag = `Mức ${input.level}${input.parallel ? ` · lô song song ${input.lotNo || ""}` : ""}`;
		const rules = Array.isArray(input.rules) ? input.rules.filter(Boolean).join(", ") : "";
		if (input.verdict === "rej") return {
			cls: "rej",
			emphasis: true,
			message: `⚠ ${tag} vi phạm — ${rules}`
		};
		if (input.verdict === "warn") return {
			cls: "warn",
			emphasis: true,
			message: `${tag} cảnh báo — ${rules}`
		};
		return {
			cls: "ok",
			emphasis: false,
			message: `✓ Đã lưu ${tag} ngày ${input.dateText}.`
		};
	}
	//#endregion
	//#region src/presentation/entry/entry-extra-run-request.ts
	function entryExtraRunRequest(testId, columnKey, date, levelIndex, runNo) {
		return {
			key: `${testId}|${columnKey}|${date}|${runNo}`,
			focus: `${date}|${levelIndex}`
		};
	}
	//#endregion
	//#region src/presentation/entry/entry-date-note-feedback.ts
	function entryDateNoteFeedback(note, dateText) {
		return note ? {
			cls: "ok",
			message: `✓ Đã lưu ghi chú ngày ${dateText}.`
		} : {
			cls: "ok",
			message: `✓ Đã xóa ghi chú ngày ${dateText}.`
		};
	}
	function entryDateNoteErrorMessage(error) {
		return error === "period-locked" ? "Kỳ này đã chốt, không thể sửa ghi chú." : "";
	}
	//#endregion
	//#region src/presentation/entry/entry-date-range-input.ts
	function createEntryDateRangeInput(parseDate) {
		return (current, field, value) => {
			const date = parseDate(value) || null;
			return field === "start" ? {
				start: date,
				end: current.end || null
			} : {
				start: current.start || null,
				end: date
			};
		};
	}
	//#endregion
	//#region src/presentation/westgard/westgard-ui-state.ts
	var westgardUiState = Object.freeze({
		toggleOpen(keys, key) {
			const next = new Set(keys);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		},
		viewMode(mode) {
			return mode === "archived" ? "archived" : "current";
		},
		chartMode(mode) {
			return mode === "cusum" ? "cusum" : "lj";
		},
		query(value) {
			return String(value || "");
		},
		archivedGroup(id) {
			return {
				groupId: id,
				testId: ""
			};
		},
		archivedTest(id) {
			return { testId: id };
		}
	});
	//#endregion
	//#region src/presentation/westgard/westgard-mode-tabs.ts
	var westgardModeTabs = Object.freeze({
		view(mode, archivedCount) {
			if (!archivedCount) return "";
			return `<div class="dayseg wg-view-mode"><button class="${mode === "current" ? "on" : ""}" onclick="wgSetViewMode('current')">Xét nghiệm đang vận hành</button><button class="${mode === "archived" ? "on" : ""}" onclick="wgSetViewMode('archived')">Nhóm lô đã dừng/lưu trữ (${archivedCount})</button></div>`;
		},
		chart(mode) {
			return `<div class="dayseg wg-view-mode"><button class="${mode === "lj" ? "on" : ""}" onclick="wgSetChartMode('lj')">Levey-Jennings</button><button class="${mode === "cusum" ? "on" : ""}" onclick="wgSetChartMode('cusum')">Xu hướng CUSUM</button></div>`;
		}
	});
	//#endregion
	//#region src/presentation/westgard/westgard-test-search.ts
	function createWestgardTestSearch(deps) {
		const select = (tests, query, selectedId) => {
			const normalized = deps.text(query);
			const matches = (tests || []).filter((test) => !normalized || deps.text(deps.label(test)).includes(normalized));
			const selected = matches.some((test) => deps.id(test) === selectedId) ? selectedId : matches[0] ? deps.id(matches[0]) : selectedId;
			return {
				matches,
				selected,
				changed: selected !== selectedId
			};
		};
		return Object.freeze({ select });
	}
	//#endregion
	//#region src/presentation/westgard/westgard-multi-views.ts
	function createWestgardMultiViews(deps) {
		return (test, openKeys) => {
			const levels = deps.levels(test).map((level) => ({
				...level,
				pts: deps.points(test, level.level)
			}));
			const previousByLevel = new Map(levels.map((level) => [level.level, deps.previous(test, level.level)]));
			const openLevels = levels.filter((level) => openKeys.has(`${test.id}|${level.level}`)).map((level) => level.level);
			return deps.build({
				levels,
				previousByLevel,
				openLevels
			});
		};
	}
	//#endregion
	//#region src/presentation/westgard/westgard-cusum-levels.ts
	function createWestgardCusumLevels(deps) {
		return (test) => deps.levels(test).map((level) => ({
			...level,
			pts: deps.points(test, level.level)
		}));
	}
	//#endregion
	//#region src/presentation/westgard/westgard-point-rows-html.ts
	function createWestgardPointRowsHtml(deps) {
		return (rows, test) => rows.map((row) => {
			const verdict = deps.verdictLabel(row.level);
			const error = row.rules.length ? deps.errorParts(row.rules) : null;
			const errorHtml = error ? `<div class="wg-error-type"><b>${deps.escape(error.type)}</b>${error.desc ? `<small>${deps.escape(error.desc)}</small>` : ""}</div>` : "—";
			const support = (row.supportRules || []).map((rule) => `<span class="pill" title="Điểm lịch sử cấu thành quy tắc, không bị loại hồi tố">${deps.referenceIcon()} ${rule}</span>`).join("");
			const z = Number.isFinite(row.z) ? `${row.z >= 0 ? "+" : ""}${deps.format(row.z)}s` : "—";
			const rules = row.rules.map((rule) => `<span class="pill">${rule}</span>`).join("") || support || "—";
			const evidence = row.rules.length && support ? `<div class="hint flow-tight">Bằng chứng: ${support}</div>` : "";
			return `<tr><td>${row.index}</td><td>${deps.date(row.date)}</td><td class="num">${deps.testValue(test, row.value)}</td><td class="num">${z}</td><td><span class="tag ${row.level}">${verdict}</span></td><td>${rules}${evidence}</td><td class="hint">${errorHtml}</td></tr>`;
		}).join("");
	}
	//#endregion
	//#region src/presentation/westgard/westgard-rows-control.ts
	function createWestgardRowsControl(deps) {
		return (view, key, initialRows) => {
			if (view.total <= initialRows) return "";
			const label = view.expanded ? `Thu gọn còn ${initialRows} điểm` : `Xem toàn bộ ${view.total} điểm`;
			const suffix = view.expanded ? "" : " mới nhất";
			return `<div class="wg-row-window"><span>Đang hiển thị ${view.rows.length}/${view.total} điểm${suffix}</span>${deps.button(label, `wgToggleRows('${deps.quote(key)}')`, "ghost sm")}</div>`;
		};
	}
	//#endregion
	//#region src/presentation/westgard/westgard-cusum-page-html.ts
	function createWestgardCusumPageHtml(deps) {
		return (input) => {
			if (!input.cfg.on) {
				const action = input.canWrite ? deps.button("Mở cấu hình xét nghiệm", `openConfigAssay('${deps.quote(input.test.id)}')`, "teal") : "";
				return `<div class="panel">${deps.empty("Chưa bật CUSUM cho xét nghiệm này", "Bật trong cấu hình xét nghiệm để xem biểu đồ xu hướng CUSUM.", action)}</div>`;
			}
			if (!input.levels.length) return `<div class="panel">${deps.empty("Chưa có mức QC đang vận hành", "Cần Panel QC, Nhóm lô QC và Mean/SD hợp lệ trước khi vẽ CUSUM.")}</div>`;
			return input.levels.map((level) => {
				const title = `<h3><span class="wg-level-title"><span>Mức ${level.level}</span><span class="wg-lot-name">Lô ${deps.escape(level.lot || "?")}</span></span><span class="wg-level-meta"><span>Mean ${deps.testValue(input.test, level.mean)}</span><span>SD ${deps.testValue(input.test, level.sd)}</span><span>${level.pts.length} điểm</span><span>k=${deps.format(input.cfg.k, 2)} · h=${deps.format(input.cfg.h, 2)}</span></span></h3>`;
				if (!level.pts.length) return `<div class="panel">${title}${deps.empty("Chưa có dữ liệu", "LOT đang dùng chưa có điểm QC.")}</div>`;
				return `<div class="panel">${title}<div class="hint wg-panel-intro">Đường CUSUM+ (teal)/CUSUM− (xanh tím) cộng dồn độ lệch z-score qua từng điểm; vượt vạch đứt ±h là dấu hiệu trôi/shift kéo dài. Đường xám mờ là trung bình động 5 điểm, chỉ để tham khảo hình dạng xu hướng.</div><div class="chart-scroll" tabindex="0"><canvas class="cusumChart" data-test="${deps.escape(input.test.id)}" data-level="${level.level}" width="1400" height="430"></canvas></div></div>`;
			}).join("");
		};
	}
	//#endregion
	//#region src/presentation/westgard/westgard-lot-block-html.ts
	function createWestgardLotBlockHtml(deps) {
		return (input) => {
			const meta = input.extraMeta || "";
			const heading = `<h3><span class="wg-level-title"><span>${input.title}</span><span class="wg-lot-name">${input.lotLabel}</span></span><span class="wg-level-meta"><span class="tag rej">${input.badge}</span><span>Mean ${deps.testValue(input.test, input.mean)}</span><span>SD ${deps.testValue(input.test, input.sd)}</span><span>${input.points.length} điểm</span>${meta}</span></h3>`;
			if (!input.points.length) return `<div class="panel wg-prev-lot">${heading}${deps.empty("Chưa có dữ liệu", "Không tìm thấy điểm QC nào cho lô này.")}</div>`;
			const prepared = deps.buildRows(input.test, input.level, input.lotNo, input.mean, input.sd, input.points);
			return `<div class="panel wg-prev-lot">${heading}${deps.rowsControl(prepared.view, prepared.key)}<table class="wg-table"><thead><tr><th>#</th><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead><tbody>${deps.pointRows(prepared.view.rows, input.test)}</tbody></table></div>`;
		};
	}
	//#endregion
	//#region src/presentation/westgard/westgard-rule-guide-html.ts
	function createWestgardRuleGuideHtml(deps) {
		return (rules) => {
			const rows = rules.map((rule) => `<tr><td>${rule.id}</td><td>${deps.escape(rule.desc)}</td><td>${rule.alert ? "<span class=\"warn\">Cảnh báo</span>" : "<span class=\"rej\">Loại bỏ</span>"}</td><td>${deps.escape(rule.fix)}</td></tr>`).join("");
			return `<details class="wg-guide"><summary>Hướng dẫn nhanh luật Westgard</summary><div class="alert info" style="margin:10px 12px 18px"><span>Ký hiệu ${deps.referenceIcon()} trong bảng là điểm lịch sử cấu thành quy tắc. Điểm này chỉ là bằng chứng; trạng thái cảnh báo/loại được gắn cho lần chạy phát hiện hiện tại, không đổi hồi tố kết luận cũ.</span></div><div class="chart-scroll" tabindex="0"><table><thead><tr><th>Luật</th><th>Điều kiện</th><th>Kết luận</th><th>Gợi ý xử lý</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
		};
	}
	//#endregion
	//#region src/presentation/westgard/westgard-rule-toggles-html.ts
	function createWestgardRuleTogglesHtml(deps) {
		return (rules, enabled, canWrite) => {
			return rules.map((rule) => `<span class="wg-rule-item"><label><input type="checkbox" ${enabled(rule.id) ? "checked" : ""} ${canWrite ? "" : "disabled"} onchange="wgSet('${rule.id}',this.checked)"> <span class="pill">${rule.id}</span></label></span>`).join("") + (canWrite ? `<div class="wg-rule-reset">${deps.button("Khôi phục mặc định", "wgReset()", "ghost sm")}</div>` : "");
		};
	}
	//#endregion
	//#region src/presentation/westgard/westgard-export-actions-html.ts
	function createWestgardExportActionsHtml(deps) {
		return (chartMode) => chartMode === "lj" ? `<div><label>&nbsp;</label><div class="wg-export-actions">${deps.button(deps.downloadIcon() + "Xuất Excel", "exportWestgardXLSX()", "teal wg-excel-btn", "Xuất Excel biểu đồ Levey-Jennings, các vi phạm và điểm bằng chứng đang xem")}${deps.button(deps.printIcon() + "In PDF", "printWestgard()", "teal wg-print-btn", "Tạo bản in PDF/HTML biểu đồ Levey-Jennings và các vi phạm đang xem")}</div></div>` : "";
	}
	//#endregion
	//#region src/presentation/export/xlsx-escape.ts
	function xlsxEscape(value) {
		return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}
	//#endregion
	//#region src/presentation/report/report-xlsx-style-ids.ts
	var REPORT_XLSX_STYLE_IDS = Object.freeze({
		TITLE: 1,
		SUB: 2,
		SECTION: 3,
		LABEL: 4,
		VAL: 5,
		TH: 6,
		TD: 7,
		TDL: 8,
		NOTE: 9,
		REJ: 10,
		WARN: 11
	});
	//#endregion
	//#region src/presentation/export/xlsx-columns.ts
	var XLSX_COLUMNS = Object.freeze("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
	//#endregion
	//#region src/presentation/export/xlsx-emu.ts
	function xlsxEmu(pixels) {
		return Math.round(pixels * 9525);
	}
	//#endregion
	//#region src/presentation/export/xlsx-utf8.ts
	function xlsxUtf8(value) {
		return new TextEncoder().encode(value);
	}
	//#endregion
	//#region src/presentation/export/xlsx-rounding.ts
	function xlsxRound(value, digits) {
		return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : "";
	}
	//#endregion
	//#region src/presentation/sigma/sigma-report-metric.ts
	function sigmaReportMetric(metric) {
		return metric ? {
			cv: metric.cv,
			bias: metric.bias,
			biasMethod: metric.biasMethod,
			biasLabel: metric.biasLabel,
			tea: metric.tea,
			teaTarget: metric.teaTarget,
			teaCriterionRule: metric.teaCriterionRule,
			teaCriterionPercent: metric.teaCriterionPercent,
			teaCriterionAbsolute: metric.teaCriterionAbsolute,
			teaCriterionUnit: metric.teaCriterionUnit,
			sigma: metric.sigma,
			dpmo: metric.dpmo,
			yld: metric.yld,
			label: metric.label,
			n: metric.n,
			cvSource: metric.cvSource,
			sourceStart: metric.sourceStart,
			sourceEnd: metric.sourceEnd,
			sourceLot: metric.sourceLot,
			cohortStatus: metric.cohortStatus,
			classifiable: metric.classifiable,
			qcpEligible: metric.qcpEligible,
			warning: metric.warning
		} : null;
	}
	//#endregion
	//#region src/presentation/sigma/sigma-mdc-items.ts
	function sigmaMdcItems(rows, levels) {
		const items = [];
		(rows || []).forEach((row) => {
			levels(row).forEach((level) => {
				const metric = level.metric, tea = Number(metric && metric.tea) || Number(row.tea);
				if (metric && tea > 0 && metric.classifiable !== false && Number.isFinite(metric.cv) && metric.cv >= 0 && Number.isFinite(metric.bias) && Number.isFinite(metric.sigma)) items.push({
					name: row.period || row.name,
					level: level.level,
					x: metric.cv / tea * 100,
					y: Math.abs(metric.bias) / tea * 100,
					sigma: metric.sigma
				});
			});
		});
		return items;
	}
	//#endregion
	//#region src/presentation/sigma/sigma-mdc-label-placement.ts
	function sigmaMdcLabelPlacements(items, X, Y, ctx, bounds, labelFor) {
		const used = [], points = (items || []).map((point) => ({
			left: X(point.x) - 9,
			right: X(point.x) + 9,
			top: Y(point.y) - 9,
			bottom: Y(point.y) + 9
		})), bound = bounds || {}, left = bound.left || 0, right = bound.right || Infinity, top = bound.top || 0, bottom = bound.bottom || Infinity, overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
		return (items || []).map((point, index) => {
			const label = labelFor(point.name), px = X(point.x), py = Y(point.y), width = Math.ceil(ctx && ctx.measureText ? ctx.measureText(label).width : label.length * 6), height = 12, raw = [
				[px + 11, py + 3],
				[px + 11, py - 10],
				[px + 11, py + 16],
				[px - width - 11, py + 3],
				[px - width - 11, py - 10],
				[px - width - 11, py + 16],
				[px - width / 2, py - 13],
				[px - width / 2, py + 20]
			], candidates = raw.map(([x, y]) => ({
				x,
				y,
				left: x - 2,
				right: x + width + 2,
				top: y - height,
				bottom: y + 3
			})).filter((candidate) => candidate.left >= left && candidate.right <= right && candidate.top >= top && candidate.bottom <= bottom), score = (candidate) => used.reduce((total, value) => total + (overlap(candidate, value) ? 10 : 0), 0) + points.reduce((total, value, i) => total + (i !== index && overlap(candidate, value) ? 3 : 0), 0), chosen = (candidates.length ? candidates : raw.map(([x, y]) => ({
				x,
				y,
				left: x - 2,
				right: x + width + 2,
				top: y - height,
				bottom: y + 3
			}))).sort((a, b) => score(a) - score(b))[0];
			used.push(chosen);
			return {
				label,
				x: chosen.x,
				y: chosen.y
			};
		});
	}
	//#endregion
	//#region src/presentation/sigma/sigma-export-pixel-ratio.ts
	function sigmaExportPixelRatio(width, height, scale = 6, maxDimension = 16384) {
		const W = Number(width), H = Number(height), ratio = Number(scale);
		if (!(W > 0 && H > 0 && ratio > 0)) return 1;
		return Math.max(.1, Math.min(ratio, maxDimension / W, maxDimension / H));
	}
	//#endregion
	//#region src/presentation/sigma/sigma-report-rows.ts
	function createSigmaReportRows(deps) {
		return (onlyTestId = "", mode = "latest", period = "", periodId = "") => deps.trackedTests().filter((test) => !onlyTestId || test.id === onlyTestId).flatMap((test) => {
			const levels = deps.visibleLevels(test);
			if (!levels.length) return [];
			const rows = deps.rows(test, deps.data(test.id), levels).filter((row) => row.rs.some(Boolean));
			if (!rows.length) return [];
			const selected = mode === "all" ? rows : mode === "period" ? rows.filter((row) => periodId ? row.e.id === periodId : row.e.period === period) : rows.slice(-1), name = deps.testName(test) || "(chưa đặt tên)";
			return selected.map((row) => {
				const currentSource = deps.teaSource(test), first = row.rs.find(Boolean), tea = first ? first.tea : deps.entryTea(test, row.e), metrics = levels.map((level, index) => ({
					level,
					metric: deps.metric(row.rs[index])
				})).filter((value) => value.metric), meta = deps.teaMeta(test, row.e.teaSource || currentSource) || {};
				return {
					name,
					period: deps.periodLabel(row.e.period) || row.e.period || "",
					tea,
					teaSource: row.e.teaSource || currentSource,
					teaLabel: row.e.teaLabel || deps.teaLabel(currentSource),
					teaReference: row.e.teaReference || deps.teaReference(test),
					teaSourceId: row.e.teaSourceId || meta.id || "",
					teaSourceVersion: row.e.teaSourceVersion || meta.version || "",
					teaSourceUrl: row.e.teaSourceUrl || meta.url || "",
					teaEffectiveDate: row.e.teaEffectiveDate || meta.effectiveDate || "",
					teaReviewedDate: row.e.teaReviewedDate || meta.reviewedDate || "",
					teaReviewedBy: row.e.teaReviewedBy || meta.reviewedBy || "",
					levels: metrics,
					r1: metrics[0] && metrics[0].metric,
					r2: metrics[1] && metrics[1].metric
				};
			});
		});
	}
	//#endregion
	//#region src/presentation/report/qc-report-rows.ts
	function createQcReportRows(deps) {
		const previousLot = (test, series, inRange) => {
			const inPts = series.pts.filter(inRange);
			if (!inPts.length) return {
				inPts,
				items: []
			};
			const westgard = deps.westgardByPoint(series.pts, series.mean, series.sd, (rule) => deps.ruleOnWithin(test, rule));
			const index = new Map(series.pts.map((point, position) => [point.id, position]));
			return {
				inPts,
				items: inPts.map((point) => {
					const position = index.get(point.id), raw = westgard.F[position ?? -1] || { rules: [] };
					return {
						p: point,
						f: {
							...raw,
							level: deps.resultLevel(test, raw.rules || [])
						},
						z: westgard.zs[position ?? -1]
					};
				})
			};
		};
		const currentLot = (test, level, westgard, inRange) => {
			const pts = deps.points(test, level.level).filter(inRange);
			return {
				pts,
				items: pts.map((point) => {
					const verdict = westgard.byPoint.get(point.id) || {
						level: "ok",
						rules: [],
						z: (Number(point.val) - level.mean) / level.sd
					};
					return {
						p: point,
						f: verdict,
						z: verdict.z
					};
				})
			};
		};
		const actions = (testId, inRange) => deps.actions().filter((action) => action.testId === testId && inRange({ date: deps.eventDate(action) }));
		return Object.freeze({
			previousLot,
			currentLot,
			actions
		});
	}
	//#endregion
	//#region src/presentation/report/qc-report-context.ts
	function createQcReportContext(deps) {
		return {
			teaInfo: (test) => ({
				teaVal: deps.tea(test),
				teaSourceText: deps.teaLabel(deps.teaSource(test))
			}),
			multiViews: (test, inRange) => deps.levels(test).map((level) => ({
				level: level.level,
				lot: level.lot,
				mean: level.mean,
				sd: level.sd,
				pts: deps.points(test, level.level).filter(inRange),
				label: "M" + level.level + "·" + (level.lot || "?")
			}))
		};
	}
	//#endregion
	//#region src/presentation/sigma/data-url-bytes.ts
	function dataUrlBytes(dataUrl, decode) {
		const binary = decode(dataUrl.split(",")[1] || ""), bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
		return bytes;
	}
	//#endregion
	//#region src/presentation/sigma/sigma-export-meta.ts
	function createSigmaExportMeta(deps) {
		const meta = () => ({
			app: deps.app() || {},
			rules: Object.entries(deps.rules() || {}).filter((entry) => entry[1] !== false).map((entry) => entry[0]).join(", ") || "Chưa cấu hình"
		}), teaTrace = (rows) => {
			const groups = /* @__PURE__ */ new Map();
			(rows || []).forEach((row) => {
				const trace = [
					[row.teaLabel || row.teaSource || "TEa", row.teaSourceVersion || ""].filter(Boolean).join(" "),
					row.teaReference || "",
					row.teaEffectiveDate ? "hiệu lực " + deps.formatDate(row.teaEffectiveDate) : ""
				].filter(Boolean).join(" · "), period = deps.periodLabel(row.period);
				if (!groups.has(trace)) groups.set(trace, /* @__PURE__ */ new Set());
				groups.get(trace).add(period);
			});
			const distinguish = groups.size > 1;
			return [...groups.entries()].map(([trace, periods]) => trace + (distinguish ? " (kỳ " + [...periods].join(", ") + ")" : "")).join(" | ");
		};
		return {
			meta,
			teaTrace
		};
	}
	//#endregion
	//#region src/presentation/report/export-meta-rows.ts
	function createExportMetaRows(deps) {
		return (kind = "Báo cáo") => {
			const app = deps.app() || { version: "dev" }, rules = Object.entries(deps.rules() || {}).filter((entry) => entry[1] !== false).map((entry) => entry[0]).join(", ");
			return [
				["Metadata", kind],
				["Phiên bản app", `${app.name || "QC Lab"} ${app.version || "dev"}`],
				["Người xuất", deps.userName()],
				["Thời gian xuất", deps.formatDateTime(deps.now())],
				["Bộ luật áp dụng", rules || "Chưa cấu hình"]
			];
		};
	}
	//#endregion
	//#region src/presentation/report/qc-export-value-format.ts
	function createQcExportValueFormat(deps) {
		return {
			value: (test, value) => deps.testValue(test, value, deps.number),
			stat: (test, value) => deps.testStat(test, value, deps.number),
			point: (point, test) => deps.pointValue(point, test, deps.number)
		};
	}
	//#endregion
	//#region src/presentation/sigma/canvas-font.ts
	function createCanvasFont(tokenPx) {
		return (weight, token, fallback) => `${weight ? weight + " " : ""}${tokenPx(token, fallback)}px Arial`;
	}
	//#endregion
	//#region src/presentation/report/report-labels.ts
	function createReportLabels(formatDate) {
		return {
			rangeText: (start, end) => !start && !end ? "Toàn bộ dữ liệu" : start && end ? formatDate(start) + " – " + formatDate(end) : start ? "Từ " + formatDate(start) : "Đến " + formatDate(end),
			stateName: (value) => value === "rej" ? "Loại" : value === "warn" ? "Cảnh báo" : value === "ok" ? "Đạt" : "Chưa có",
			verdictLabel: (value) => value === "ok" ? "Đạt" : value === "warn" ? "Cảnh báo" : value === "none" ? "Chưa đánh giá" : "Loại bỏ"
		};
	}
	//#endregion
	//#region src/presentation/report/report-selection.ts
	function createReportSelection() {
		const defaults = (start, end, monthStart, today) => ({
			start: start || end ? start : `${monthStart}-01`,
			end: start || end ? end : today
		});
		const dateRange = (start, end) => start && end && start > end ? {
			start: end,
			end: start
		} : {
			start,
			end
		};
		const exportSelection = (tests, testId, start, end, includeNceAppendix) => ({
			tid: testId,
			t: tests.find((test) => test.id === testId),
			start,
			end,
			includeNceAppendix
		});
		return Object.freeze({
			defaults,
			dateRange,
			exportSelection
		});
	}
	//#endregion
	//#region src/presentation/report/report-search.ts
	function createReportSearch() {
		const select = (tests, query, currentId, values, normalize) => {
			const needle = normalize(query);
			const matched = tests.filter((test) => !needle || values(test).some((value) => normalize(value).includes(needle)));
			return {
				matched,
				selected: matched.some((test) => test.id === currentId) ? currentId : matched[0]?.id || ""
			};
		};
		return Object.freeze({ select });
	}
	//#endregion
	//#region src/presentation/sigma/sigma-mu-trace.ts
	function createSigmaMuTrace(deps) {
		return (row, levels) => {
			const trace = [];
			(levels || []).forEach((level) => {
				const item = row.e.lv && row.e.lv[level] || {};
				if (item.uCalBasis) trace.push("Má»©c " + level + " Â· nguá»“n u(cal): " + deps.escape(item.uCalBasis));
			});
			const signed = (levels || []).map((level) => row.e.lv && row.e.lv[level] || {}).find((item) => item.muReviewedBy || item.muReviewedDate);
			if (signed) trace.push("NgÆ°á»i rÃ\xA0 soÃ¡t ngÃ¢n sÃ¡ch MU: " + deps.escape(signed.muReviewedBy || "â€”") + (signed.muReviewedDate ? " Â· " + deps.formatDate(signed.muReviewedDate) : ""));
			return trace;
		};
	}
	//#endregion
	//#region src/presentation/sigma/sigma-print-rows.ts
	function createSigmaPrintRows(deps) {
		const source = (metric) => metric.cvSource === "iqc-period" || metric.cvSource === "iqc-cohort" ? (metric.n || 0) + " Ä‘iá»ƒm" + (metric.sourceLot ? " Â· LÃ´ " + deps.escape(metric.sourceLot) : "") : "Nháº­p tay";
		const rowCells = (metric) => {
			const sigma = (metric.classifiable ? "" : "â‰ˆ") + deps.format(metric.sigma, 2);
			return "<td class=\"num\">" + deps.format(metric.tea, 2) + "</td><td class=\"num\"><b style=\"color:" + deps.escapeAttr(metric.c) + "\">" + sigma + "</b></td><td><span class=\"pill\" style=\"color:" + deps.escapeAttr(metric.c) + "\">" + deps.escape(metric.label) + "</span></td><td class=\"num\">" + deps.format(metric.cv, 2) + "</td><td class=\"num\">" + deps.format(metric.bias, 2) + "</td><td class=\"num\">" + deps.dpmo(metric.dpmo) + "</td><td class=\"num\">" + deps.format(metric.yld, 4) + "%</td><td>" + source(metric) + "</td><td>" + deps.escape(metric.readinessLabel || metric.cohortStatus || "â€”") + "</td>";
		};
		const periodRows = (row, levels) => (levels || []).map((level, index) => {
			const metric = row && row.rs && row.rs[index];
			return !metric ? "<tr><td>Má»©c " + level + "</td><td colspan=\"9\" class=\"muted\">ChÆ°a Ä‘á»§ CV IQC vÃ\xA0 Bias EQA/EQC Ä‘á»ƒ tÃ­nh Sigma</td></tr>" : "<tr><td><b>Má»©c " + level + "</b></td>" + rowCells(metric) + "</tr>";
		}).join("");
		const periodsRows = (rows, levels) => (rows || []).flatMap((row) => {
			const period = deps.period(row.e.period) || row.e.period || "?";
			return (levels || []).map((level, index) => {
				const metric = row.rs && row.rs[index];
				return !metric ? "<tr><td><b>" + deps.escape(period) + "</b></td><td>Má»©c " + level + "</td><td colspan=\"9\" class=\"muted\">ChÆ°a Ä‘á»§ CV IQC vÃ\xA0 Bias EQA/EQC Ä‘á»ƒ tÃ­nh Sigma</td></tr>" : "<tr><td><b>" + deps.escape(period) + "</b></td><td><b>Má»©c " + level + "</b></td>" + rowCells(metric) + "</tr>";
			});
		}).join("");
		return Object.freeze({
			periodRows,
			periodsRows
		});
	}
	//#endregion
	//#region src/presentation/sigma/sigma-mu-print-rows.ts
	function createSigmaMuPrintRows(deps) {
		const cells = (test, row, level, index) => {
			const metric = row && row.rs && row.rs[index], mu = metric && metric.mu || deps.mu(test, row.e, level), unit = test && test.unit || "";
			if (!mu) return "<td colspan=\"7\" class=\"muted\">ChÆ°a cÃ³ CV IQC â€” chÆ°a láº­p Ä‘Æ°á»£c ngÃ¢n sÃ¡ch MU</td>";
			const uBias = !mu.includeBias ? "KhÃ´ng cá»™ng" : mu.uBias == null ? "ChÆ°a cÃ³ Bias" : deps.format(mu.uBias, 2), uCal = mu.uCal == null ? "ChÆ°a cÃ³ CoA" : deps.format(mu.uCal, 2);
			const absolute = mu.absoluteU == null ? "â€”" : deps.format(mu.absoluteU, 3) + (unit ? " " + deps.escape(unit) : "");
			return "<td class=\"num\">" + deps.format(mu.uRw, 2) + "</td><td class=\"num\">" + uBias + "</td><td class=\"num\">" + uCal + "</td><td class=\"num\">" + deps.format(mu.uc, 2) + "</td><td class=\"num\"><b>" + deps.format(mu.U, 2) + "</b></td><td class=\"num\">" + absolute + "</td><td>" + (mu.complete ? "<span class=\"pill\">Äá»§ thÃ\xA0nh pháº§n</span>" : "Thiáº¿u " + deps.escape(mu.missing.join(", "))) + "</td>";
		};
		const periodRows = (test, row, levels) => (levels || []).map((level, index) => "<tr><td><b>Má»©c " + level + "</b></td>" + cells(test, row, level, index) + "</tr>").join("");
		const periodsRows = (test, rows, levels) => (rows || []).flatMap((row) => {
			const period = deps.period(row.e.period) || row.e.period || "?";
			return (levels || []).map((level, index) => "<tr><td><b>" + deps.escape(period) + "</b></td><td><b>Má»©c " + level + "</b></td>" + cells(test, row, level, index) + "</tr>");
		}).join("");
		return Object.freeze({
			periodRows,
			periodsRows
		});
	}
	//#endregion
	//#region src/presentation/report/report-points-table.ts
	function createReportPointsTable(deps) {
		return (items, test) => {
			if (!items.length) return "<p><i>Không có điểm nào trong khoảng ngày đã chọn.</i></p>";
			return "<table><tr><th>Ngày</th><th>Lần chạy</th><th>NV</th><th class=\"num\">Giá trị</th><th class=\"num\">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th></tr>" + items.map((item) => {
				const rules = [...new Set(item.f.rules || [])], support = [...new Set(item.f.supportRules || [])].filter((rule) => !rules.includes(rule));
				const ruleText = rules.join(", ") || (support.length ? "Bằng chứng: " + support.join(", ") : "—"), verdict = deps.verdict(item.f.level), staff = deps.staff(item.p);
				return "<tr><td>" + deps.formatDate(item.p.date) + "</td><td>" + deps.escape(item.p.runId || "—") + "</td><td>" + deps.escape(staff.code || "—") + "</td><td class=\"num\">" + deps.pointValue(item.p, test) + "</td><td class=\"num\">" + (item.z >= 0 ? "+" : "") + deps.format(item.z) + "s</td><td>" + deps.escape(verdict) + "</td><td>" + deps.escape(ruleText) + "</td></tr>";
			}).join("") + "</table>";
		};
	}
	//#endregion
	//#region src/presentation/nce/action-report-html.ts
	function createActionReportHtml(escape) {
		const summary = (parts) => "<div class=\"nce-summary\">" + parts.map(([label, text]) => "<div><b>" + escape(label) + ":</b> " + escape(text) + "</div>").join("") + "</div>";
		const detailField = (label, value, wide = false) => "<div" + (wide ? " class=\"nce-detail-wide\"" : "") + "><span>" + escape(label) + "</span><b>" + escape(value || "—") + "</b></div>";
		return Object.freeze({
			summary,
			detailField
		});
	}
	//#endregion
	//#region src/presentation/nce/action-guide-content.ts
	function createActionGuideContent(deps) {
		return (steps) => {
			return {
				body: `<div class="modal-b" tabindex="0" aria-label="Nội dung quy trình 8 bước"><div class="action-guide-intro"><b>Nguyên tắc thực hiện</b><p>Lưu hồ sơ ngay sau bước 1 ở trạng thái <strong>Đang điều tra</strong>, sau đó hoàn thiện theo tiến độ xử lý.</p></div><ol class="action-guide-list">${steps.map((step, index) => `<li class="action-guide-card"><span class="action-guide-number">${index + 1}</span><div><small>${deps.escape(step.phase)}</small><b>${deps.escape(step.title)}</b><p>${deps.escape(step.text)}</p></div></li>`).join("")}</ol></div>`,
				footer: `<div class="action-guide-footer-note"><b>Điều kiện khép vòng</b><span>Đủ bằng chứng QC, quyết định cho phép trở lại khi cần, đánh giá nguy cơ còn lại và phê duyệt độc lập.</span></div>${deps.button("Đóng", "closeModal()", "ghost")}`
			};
		};
	}
	//#endregion
	//#region src/presentation/nce/action-page-html.ts
	function createActionPageHtml() {
		return (input) => `${input.headHtml}${input.issuesHtml}${input.formHtml}${input.logHtml}`;
	}
	//#endregion
	//#region src/presentation/nce/action-side-chips-html.ts
	function createActionSideChipsHtml(deps) {
		return (chips) => chips.map((chip) => `<span class="action-chip ${chip.cls}">${deps.escape(chip.label)}</span>`).join("");
	}
	//#endregion
	//#region src/presentation/nce/action-detail-check-html.ts
	function createActionDetailCheckHtml(deps) {
		return (label, view, note) => `<div class="action-detail-check"><div><b>${deps.escape(label)}</b>${note ? `<div class="hint">${deps.escape(note)}</div>` : ""}</div><span class="tag ${view.cls}">${deps.escape(view.label)}</span></div>`;
	}
	//#endregion
	//#region src/presentation/nce/action-evidence-timeline-html.ts
	function createActionEvidenceTimelineHtml(deps) {
		return (items) => `<div class="action-evidence-timeline" aria-label="Các mốc thời gian hồ sơ">${items.map((item) => `<div><span>${deps.escape(item.label)}</span><b>${deps.escape(item.value)}</b>${item.note ? `<small>${deps.escape(item.note)}</small>` : ""}</div>`).join("")}</div>`;
	}
	//#endregion
	//#region src/presentation/nce/action-review-buttons-html.ts
	function createActionReviewButtonsHtml(deps) {
		return (index, model) => `<div class="action-row-actions">${deps.button("Chi tiết", `viewActionDetail(${index})`, "ghost sm")}${model.edit ? deps.button("Tiếp tục", `editAction(${index})`, "ghost sm") : ""}${model.escalate ? deps.button("Lập hồ sơ tiếp theo", `escalateAction(${index})`, "teal sm", "Hành động chưa hiệu lực — mở vòng điều tra mới") : ""}${model.approve ? deps.button("Duyệt", `approveAction(${index})`, "teal sm") : ""}${model.returnForRevision ? deps.button("Trả lại", `returnAction(${index})`, "ghost sm") : ""}${model.reopen ? deps.button("Mở lại", `reopenAction(${index})`, "danger sm", "Hồ sơ đã duyệt nhưng không còn đủ điều kiện khép vòng") : ""}${model.cancel ? deps.button("Hủy hồ sơ", `cancelAction(${index})`, "danger sm", "Hủy có lưu vết — không xóa dữ liệu") : ""}</div>`;
	}
	//#endregion
	//#region src/presentation/nce/action-rerun-evidence-html.ts
	function createActionRerunEvidenceHtml(deps) {
		return (evidence, testId, test) => {
			if (!evidence) return "";
			if (evidence.kind === "pending") return `<div class="action-rerun-evidence ${evidence.cls}"><div class="action-rerun-mark" aria-hidden="true">QC</div><div class="action-rerun-copy"><small>Bằng chứng QC chạy lại</small><b>${deps.escape(evidence.heading)}</b><span>${deps.escape(evidence.label)}</span></div></div>`;
			const point = evidence.point;
			const action = `openActionQcEvidence('${deps.quote(testId)}',${Number(point.level) || 0},'${deps.quote(point.id)}','${deps.quote(point.date || "")}','${deps.quote(point.lot || "")}')`;
			const viewButton = deps.button("Xem điểm QC", action, "ghost sm", "Mở đúng điểm QC được dùng làm bằng chứng");
			return `<div class="action-rerun-evidence ${evidence.cls}"><div class="action-rerun-mark" aria-hidden="true">QC</div><div class="action-rerun-copy"><small>Bằng chứng QC chạy lại</small><b>${deps.escape(evidence.heading)}</b><span>${deps.pointValue(point, test)} ${deps.escape(test?.unit || "")} · ${deps.date(point.date)} · ${deps.escape(point.runId || "Không có mã lần chạy")}</span><span>${deps.escape(evidence.context || "")}</span></div><div class="action-rerun-actions">${viewButton}</div></div>`;
		};
	}
	//#endregion
	//#region src/presentation/nce/action-issue-row-html.ts
	function createActionIssueRowHtml(deps) {
		return (model) => {
			const action = !model.action ? "" : model.action.kind === "continue" ? deps.button("Tiếp tục hồ sơ", `editAction(${model.action.index})`, "ghost sm") : deps.button("Lập hồ sơ", `beginActionFromIssue('${deps.quote(model.action.testId)}',${model.action.level},'${deps.quote(model.action.rules)}','${deps.quote(model.action.error)}','${deps.quote(model.action.hint)}','${deps.quote(model.action.pointId)}','${deps.quote(model.action.date)}')`, "ghost sm");
			return `<div class="issue-row ${model.severity}"><div class="issue-row-main"><b>${deps.escape(model.level)} · ${deps.escape(model.state)}</b><div class="meta">${model.value} ${deps.escape(model.unit || "")} · ${model.rules || "—"} · ${model.error}</div><div class="action-chipline"><span class="action-chip ${model.workflowClass}">${deps.escape(model.workflowLabel)}</span>${model.sideChips}</div><div class="hint">${model.footer}</div></div>${action}</div>`;
		};
	}
	//#endregion
	//#region src/presentation/nce/action-open-issue-html.ts
	function createActionOpenIssueHtml(deps) {
		return (model) => `<div class="issue-row ${model.severity}"><div class="issue-row-main"><b>${deps.escape(model.title)} · ${deps.escape(model.context)}</b><div class="meta">${model.date}${model.verdict ? " · " + deps.escape(model.verdict) : ""} · ${deps.escape(model.rule)} · ${deps.escape(model.errorType)}</div><div class="action-chipline"><span class="action-chip ${model.workflowClass}">${deps.escape(model.workflowLabel)}</span>${model.sideChips}</div><div class="hint">${deps.escape(model.primary)} · Phụ trách: ${deps.escape(model.owner || "—")}${model.dueDate ? " · hạn " + model.dueDate : ""}</div></div>${model.editable ? deps.button("Tiếp tục hồ sơ", `editAction(${model.index})`, "ghost sm") : ""}</div>`;
	}
	//#endregion
	//#region src/presentation/nce/action-issue-group-html.ts
	function createActionIssueGroupHtml(deps) {
		return (model) => `<div class="issue-group ${model.severity}"><div class="issue-group-h"><div><b>${deps.escape(model.title)}</b><span class="issue-group-date">${deps.escape(model.date)}</span></div><span class="issue-group-count">${model.count} ${deps.escape(model.countLabel)}</span></div><div class="issue-group-body">${model.itemsHtml}</div></div>`;
	}
	//#endregion
	//#region src/presentation/nce/action-log-row-html.ts
	function createActionLogRowHtml(deps) {
		return (model) => `<tr><td><div class="action-date">${deps.escape(model.date)}</div>${model.openedAt ? `<div class="action-time">Mở: ${deps.escape(model.openedAt)}</div>` : ""}</td><td><div class="action-test">${model.identity}</div><div class="action-sub">${model.sub}</div><div class="action-rule">${model.rule}</div></td><td><div class="action-text">${deps.escape(model.primary)}</div><div class="action-sub">Phụ trách: ${deps.escape(model.owner || "—")}${model.dueDate ? " · hạn " + deps.escape(model.dueDate) : ""}</div></td><td><div class="action-status-stack"><span class="action-chip ${model.workflowClass}">${deps.escape(model.workflowLabel)}</span>${model.sideChips}${model.approvalTag}${model.approvalMeta}</div></td><td>${model.actions}</td></tr>`;
	}
	//#endregion
	//#region src/presentation/nce/action-approval-tag-html.ts
	function createActionApprovalTagHtml(deps) {
		return (view, label) => `<span class="tag ${view.cls}">${deps.escape(label)}</span>`;
	}
	//#endregion
	//#region src/presentation/nce/action-detail-meta-html.ts
	function createActionDetailMetaHtml(deps) {
		return (rows) => `<div class="action-detail-meta">${rows.map((row) => `<div><span>${deps.escape(row.label)}</span><b>${deps.escape(row.value)}</b>${row.note ? `<small>${deps.escape(row.note)}</small>` : ""}</div>`).join("")}</div>`;
	}
	//#endregion
	//#region src/presentation/nce/action-cancelled-alert-html.ts
	function createActionCancelledAlertHtml(deps) {
		return (model) => !model ? "" : `<div class="alert warn"><b>Hồ sơ đã hủy — dữ liệu được giữ để truy xuất.</b><div>${deps.escape(model.reason || "Không có lý do")}${model.by ? " · " + deps.escape(model.by) : ""}${model.at ? " · " + deps.escape(model.at) : ""}</div></div>`;
	}
	//#endregion
	//#region src/presentation/nce/action-legacy-detail-html.ts
	function createActionLegacyDetailHtml(deps) {
		return (model) => `<div class="action-detail-legacy"><b>Hành động đã ghi</b><div>${deps.escape(model.action || "—")}</div><div class="hint">${deps.escape(model.owner || "—")} · ${deps.escape(model.rerunLabel || "Chưa có dữ liệu")} · ${deps.escape(model.approvalLabel)}</div></div>`;
	}
	//#endregion
	//#region src/presentation/nce/action-containment-detail-html.ts
	function createActionContainmentDetailHtml(deps) {
		return (model) => `<li><b>Kiểm soát tức thời</b><div>${deps.escape(model.status || "Chưa ghi")}</div>${model.modern ? `<div>${deps.escape(model.correction || "Chưa ghi xử lý tức thời")}</div>` : ""}${model.note ? `<div class="hint">${deps.escape(model.note)}</div>` : ""}</li>`;
	}
	//#endregion
	//#region src/presentation/nce/action-inspection-details-html.ts
	function createActionInspectionDetailsHtml() {
		return (items) => items.map((item) => `<li><b>${item.title}</b>${item.checksHtml}</li>`).join("");
	}
	//#endregion
	//#region src/presentation/nce/action-patient-impact-html.ts
	function createActionPatientImpactHtml(deps) {
		return (impact, action) => `<li><b>Đánh giá ảnh hưởng bệnh nhân</b><div>${deps.escape(impact || "Chưa đánh giá")}</div>${action ? `<div class="hint">${deps.escape(action)}</div>` : ""}</li>`;
	}
	//#endregion
	//#region src/presentation/nce/action-cause-detail-html.ts
	function createActionCauseDetailHtml(deps) {
		return (model) => `<li><b>Nguyên nhân, hành động và QC chạy lại</b><div>${deps.escape(model.cause || "Chưa xác định nguyên nhân")}</div><div>${deps.escape(model.action || "Chưa ghi hành động khắc phục")}</div>${model.completedDate ? `<div class="hint">Hoàn thành hành động: ${deps.escape(model.completedDate)}</div>` : ""}${model.release ? `<div><b>${deps.escape(model.release.status || "Chưa cho phép hoạt động/trả kết quả trở lại")}</b></div>${model.release.details ? `<div class="hint">${deps.escape(model.release.details)}</div>` : ""}` : ""}</li>`;
	}
	//#endregion
	//#region src/presentation/nce/action-effectiveness-detail-html.ts
	function createActionEffectivenessDetailHtml(deps) {
		return (model) => `<li><b>Đánh giá hiệu lực, phê duyệt và khép vòng</b><div>${deps.escape(model.effectiveness || "—")}</div>${model.note ? `<div class="hint">${deps.escape(model.note)}</div>` : ""}${model.residual ? `<div>Nguy cơ còn lại: ${deps.escape(model.residual.risk || "Chưa phân loại")} · RPN ${model.residual.score}</div>${model.residual.basis ? `<div class="hint">${deps.escape(model.residual.basis)}</div>` : ""}` : ""}${model.returned ? `<div class="hint">Đã trả lại: ${deps.escape(model.returned)}</div>` : ""}${model.followUpNceId ? `<div class="hint">Đã chuyển sang hồ sơ ${deps.escape(model.followUpNceId)}</div>` : ""}${model.parentNceId ? `<div class="hint">Nối tiếp hồ sơ ${deps.escape(model.parentNceId)}</div>` : ""}<div class="hint">${deps.escape(model.approval)} · ${deps.escape(model.workflow)}</div></li>`;
	}
	//#endregion
	//#region src/presentation/nce/action-log-panel-html.ts
	function createActionLogPanelHtml(deps) {
		return (rows) => `<div class="panel action-log-panel"><h2 class="panel-title">Nhật ký khắc phục</h2>${rows ? `<div class="action-log-tools">${deps.button("Xuất CSV nhật ký", "exportActionsCSV()", "teal sm")}</div><div class="action-log-wrap"><table class="action-log-table"><thead><tr><th>Thời điểm</th><th>Sự cố</th><th>Hành động</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>` : deps.emptyState("Chưa có nhật ký", "Các hành động khắc phục sẽ xuất hiện ở đây sau khi được lưu.")}</div>`;
	}
	//#endregion
	//#region src/presentation/nce/action-issues-panel-html.ts
	function actionIssuesPanelHtml(issuesHtml) {
		return `<div class="panel action-issues-panel"><h2 class="panel-title">Sự cố cần xử lý</h2><div class="dash-list">${issuesHtml}</div></div>`;
	}
	//#endregion
	//#region src/presentation/manage/manage-toolbar-html.ts
	function createManageToolbarHtml(deps) {
		return (model) => {
			const search = model.placeholder ? `<input id="manageSearch" placeholder="${deps.escapeAttr(model.placeholder)}" value="${deps.escapeAttr(model.query || "")}" oninput="manageSearchSet(this.value)">` : "";
			return `<div class="rcfg-toolbar"><div><h2>${deps.escape(model.title)}</h2>${model.subtitle ? `<p>${deps.escape(model.subtitle)}</p>` : ""}</div><div class="rcfg-tools">${search}${model.action ? deps.button("＋ " + (model.actionLabel || ""), model.action, "teal") : ""}</div></div>`;
		};
	}
	//#endregion
	//#region src/presentation/manage/manage-page-html.ts
	function createManagePageHtml() {
		return (headHtml, shellHtml) => `${headHtml}${shellHtml}`;
	}
	//#endregion
	//#region src/presentation/manage/manage-shell-html.ts
	function createManageShellHtml(deps) {
		return (items, selected, body) => `<div class="config-shell"><aside class="config-shell-nav" aria-label="Danh mục cấu hình"><div class="rcfg-title">CẤU HÌNH CHUNG</div>${items.map((item) => `<button class="${selected === item.id ? "on" : ""}" onclick="setManageTab('${item.id}')"><b>${deps.escape(item.label)}</b><small>${deps.escape(item.count)}</small></button>`).join("")}</aside><section class="config-shell-main">${body}</section></div>`;
	}
	//#endregion
	//#region src/presentation/manage/manage-instrument-row-html.ts
	function createManageInstrumentRowHtml(deps) {
		return (model) => `<tr><td><b>${deps.escape(model.name)}</b><div class="hint">${deps.escape(model.section || "Chưa phân khoa")}</div></td><td>${deps.escape(model.manufacturer || "—")}</td><td>${deps.escape(model.serial || "—")}</td><td class="num">${model.assayCount}</td><td><span class="tag ${model.active ? "ok" : "none"}">${model.active ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td><td><div class="manage-actions">${deps.button("Sửa", `openConfigInstrument('${deps.quote(model.id)}')`, "ghost sm")}${deps.button("Xóa", `deleteConfigInstrument('${deps.quote(model.id)}')`, "danger sm")}</div></td></tr>`;
	}
	//#endregion
	//#region src/presentation/manage/manage-panel-row-html.ts
	function createManagePanelRowHtml(deps) {
		return (model) => `<tr><td><b>${deps.escape(model.name)}</b></td><td>${deps.escape(model.instrument)}</td><td>${model.testsHtml || "—"}</td><td class="num">${model.testCount}</td><td><span class="tag ${model.active ? "ok" : "none"}">${model.active ? "Đang dùng" : "Tạm ngưng"}</span></td><td><div class="manage-actions">${deps.button("Sửa", `openConfigPanel('${deps.quote(model.id)}')`, "ghost sm")}${deps.button("Xóa", `deleteConfigPanel('${deps.quote(model.id)}')`, "danger sm")}</div></td></tr>`;
	}
	//#endregion
	//#region src/presentation/manage/manage-lot-row-html.ts
	function createManageLotRowHtml(deps) {
		return (model) => `<tr><td><b>${deps.escape(model.lotNo)}</b>${model.description || model.program ? `<div class="hint">${deps.escape(model.description || model.program || "")}</div>` : ""}</td><td><span class="pill">M${model.level}</span></td><td>${deps.escape(model.expiry || "—")}</td><td><span class="tag ${model.status.cls}">${deps.escape(model.status.text)}</span></td><td class="num">${model.used}</td><td><div class="lot-row-actions">${deps.button("Sửa", `openConfigLot('${deps.quote(model.id)}')`, "ghost sm")}${deps.button("Xóa", `deleteConfigLot('${deps.quote(model.id)}')`, "danger sm")}</div></td></tr>`;
	}
	//#endregion
	//#region src/presentation/manage/manage-lot-group-card-html.ts
	function createManageLotGroupCardHtml(deps) {
		return (model) => `<div class="lot-group-card${model.archived ? " lot-opt-depleted" : ""}"><div class="lot-group-card-h"><div><b>${deps.escape(model.name)}</b><small>${deps.escape(model.note || "Nhóm lô để gán Mean/SD theo Panel")}</small></div><span class="tag ${model.status.cls}">${deps.escape(model.status.text)}</span></div><div class="lot-group-chipline">${model.lotsHtml || "<span class=\"hint\">Chưa chọn lô</span>"}</div><div class="lot-group-actions">${model.actionsHtml}</div></div>`;
	}
	//#endregion
	//#region src/presentation/manage/manage-transition-row-html.ts
	function createManageTransitionRowHtml(deps) {
		return (model) => `<tr><td><b>${deps.escape(model.panel)}</b></td><td><div><b>${deps.escape(model.fromLot)}</b></div><div class="hint">→ ${deps.escape(model.toLot)}</div></td><td>${deps.escape(model.startDate || "—")}</td><td><span class="tag ${model.status.cls}">${deps.escape(model.status.text)}</span>${model.movedHtml}${model.approvalHtml}</td><td><div class="manage-actions">${deps.button("Sửa", `openLotTransitionV2('${deps.quote(model.id)}')`, "ghost sm")}${deps.button("Xóa", `deleteLotTransition('${deps.quote(model.id)}')`, "danger sm")}</div></td></tr>`;
	}
	//#endregion
	//#region src/presentation/manage/tea-source-registry-html.ts
	function createTeaSourceRegistryHtml(deps) {
		return (items) => `<div class="tea-source-registry">${items.map((item) => `<div class="tea-source-card ${item.status}"><div><b>${deps.escape(item.label)}</b><span class="tag ${item.tagClass}">${deps.escape(item.statusLabel)}</span></div><p>${deps.escape(item.version)}${item.effectiveDate ? " · hiệu lực " + deps.escape(item.effectiveDate) : ""} · rà soát ${deps.escape(item.reviewedDate)}</p><a href="${deps.escapeAttr(item.url)}" target="_blank" rel="noopener">Mở nguồn chính thức</a></div>`).join("")}</div>`;
	}
	//#endregion
	//#region src/presentation/manage/manage-history-row-html.ts
	function createManageHistoryRowHtml(deps) {
		return (model) => `<tr><td><span class="pill">M${model.level}</span></td><td><b>${deps.escape(model.lot || "—")}</b><div class="hint">${deps.escape(model.group)}</div></td><td class="num">${model.mean}</td><td class="num">${model.low}</td><td class="num">${model.high}</td><td class="num">${model.sd}</td><td>${deps.escape(model.period)}</td><td><span class="tag ${model.source === "lab" ? "warn" : "ok"}">${model.source === "lab" ? "PXN" : "NSX"}</span></td><td class="num">${model.pointCount}</td><td>${deps.button("Chi tiết", `openQcHistoryDetail('${deps.quote(model.testId)}',${model.level},'${deps.quote(model.lot || "")}')`, "ghost sm")}</td></tr>`;
	}
	//#endregion
	//#region src/presentation/manage/manage-search-placeholder.ts
	var PLACEHOLDERS = Object.freeze({
		instruments: "Tìm theo tên máy, hãng, số sê-ri...",
		assays: "Tìm theo tên xét nghiệm, máy, đơn vị, phương pháp, hóa chất, TEa...",
		panels: "Tìm theo tên panel QC, máy và xét nghiệm...",
		lots: "Tìm theo số lô, nhóm lô QC...",
		targets: "Tìm theo tên xét nghiệm...",
		transitions: "Tìm theo panel QC, lô cũ/mới...",
		history: "Tìm theo xét nghiệm, mức, lô QC...",
		tearefs: "Tìm theo tên xét nghiệm, nhóm, đơn vị..."
	});
	function manageSearchPlaceholder(tab) {
		return PLACEHOLDERS[tab] || "";
	}
	//#endregion
	//#region src/presentation/manage/manage-assay-row-html.ts
	function createManageAssayRowHtml(deps) {
		return (model) => `<tr><td class="num">${model.index}</td><td><b>${deps.escape(model.name)}</b><div class="hint">${deps.escape(model.method || "Chưa nhập phương pháp")} · ${deps.escape(model.unit || "Chưa có đơn vị")}</div></td><td>${deps.escape(model.instrument)}<div class="hint">${deps.escape(model.section || "Chưa gán khoa/khu vực")}</div></td><td>${deps.escape(model.reagent || "—")}</td><td>${model.tea ? deps.escape(model.tea) + "%" : "—"}</td><td><span class="tag ${model.closed ? "none" : "ok"}">${model.closed ? "Ngưng dùng" : "Đang dùng"}</span></td><td><div class="manage-actions">${deps.button("Sửa", `openConfigAssay('${deps.quote(model.id)}')`, "ghost sm")}${deps.button("Xóa", `delTest('${deps.quote(model.id)}')`, "danger sm")}</div></td></tr>`;
	}
	//#endregion
	//#region src/presentation/manage/tea-reference-status-html.ts
	var STATUS = Object.freeze({
		default: {
			cls: "none",
			label: "Mặc định"
		},
		override: {
			cls: "warn",
			label: "Đã sửa"
		},
		lab: {
			cls: "ok",
			label: "TEa PXN"
		},
		custom: {
			cls: "ok",
			label: "Tự thêm"
		}
	});
	function teaReferenceStatusHtml(kind) {
		const status = STATUS[kind] || STATUS.default;
		return `<span class="tag ${status.cls}">${status.label}</span>`;
	}
	//#endregion
	//#region src/presentation/manage/manage-transition-status.ts
	function manageTransitionStatus(status) {
		if (status === "active") return {
			text: "Đang chạy song song",
			cls: "warn"
		};
		if (status === "accepted") return {
			text: "Chấp nhận lô mới",
			cls: "ok"
		};
		if (status === "rejected") return {
			text: "Không chấp nhận",
			cls: "rej"
		};
		return {
			text: "Dự kiến",
			cls: "none"
		};
	}
	//#endregion
	//#region src/presentation/manage/manage-lot-status.ts
	function createManageLotStatus(deps) {
		return (lot, nextLot) => {
			if (lot && lot.depleted) return {
				text: nextLot ? `Đã chuyển tiếp qua lô ${nextLot}` : "Đã chuyển tiếp",
				cls: "rej"
			};
			const days = deps.daysToExpiry(lot.exp);
			if (days == null) return {
				text: "Chưa có HSD",
				cls: "none"
			};
			if (days < 0) return {
				text: "Hết hạn",
				cls: "rej"
			};
			if (days <= 30) return {
				text: `Còn ${days} ngày`,
				cls: "warn"
			};
			return {
				text: "Đang hoạt động",
				cls: "ok"
			};
		};
	}
	//#endregion
	//#region src/presentation/manage/same-id-set.ts
	function sameIdSet(left, right) {
		const a = [...new Set(left || [])].sort();
		const b = [...new Set(right || [])].sort();
		return a.length === b.length && a.every((value, index) => value === b[index]);
	}
	//#endregion
	//#region src/presentation/manage/manage-instrument-name.ts
	function manageInstrumentName(instruments, id, fallback = "") {
		return instruments.find((item) => item.id === id)?.name || fallback || "Chưa gán máy";
	}
	//#endregion
	//#region src/presentation/manage/manage-lot-label.ts
	function manageLotLabel(lots, id) {
		const lot = lots.find((item) => item.id === id);
		return lot ? `${lot.lotNo} · Mức ${lot.level}` : "Chưa chọn lô";
	}
	//#endregion
	//#region src/presentation/manage/manage-panel-name.ts
	function managePanelName(panels, id) {
		return panels.find((item) => item.id === id)?.name || "Chưa chọn Panel QC";
	}
	//#endregion
	//#region src/presentation/manage/manage-lot-group-labels.ts
	function manageLotGroupLabels(groups, lotId) {
		const names = groups.filter((group) => (group.lotIds || []).includes(lotId)).map((group) => group.name || "");
		return names.length ? names.join(", ") : "Chưa thuộc nhóm";
	}
	//#endregion
	//#region src/presentation/manage/same-normalized-text.ts
	function createSameNormalizedText(deps) {
		return (left, right) => deps.normalize(left) === deps.normalize(right);
	}
	//#endregion
	//#region src/presentation/manage/groups-of-lot.ts
	function groupsOfLot(groups, lotId) {
		return groups.filter((group) => (group.lotIds || []).includes(lotId));
	}
	//#endregion
	//#region src/presentation/manage/target-group-lots.ts
	function targetGroupLots(lots, group) {
		return (group?.lotIds || []).map((id) => lots.find((lot) => lot.id === id)).filter((lot) => !!lot).sort((left, right) => Number(left.level || 0) - Number(right.level || 0) || String(left.lotNo || "").localeCompare(String(right.lotNo || ""), "vi", { numeric: true }));
	}
	//#endregion
	//#region src/presentation/manage/target-group-label.ts
	function targetGroupLabel(group) {
		return group?.name || "Chưa chọn nhóm lô";
	}
	//#endregion
	//#region src/presentation/manage/target-group-status-suffix.ts
	function targetGroupStatusSuffix(group) {
		if (group?.status === "stopped") return " · Đã dừng";
		if (group?.status === "planned") return " · Dự kiến";
		return "";
	}
	//#endregion
	//#region src/presentation/manage/target-panel-label.ts
	function targetPanelLabel(panels, panelId) {
		return panels.find((panel) => panel.id === panelId)?.name || "Panel QC";
	}
	//#endregion
	//#region src/presentation/manage/target-panel-tests.ts
	function targetPanelTests(panels, tests, panelId) {
		return (panels.find((item) => item.id === panelId)?.testIds || []).map((id) => tests.find((test) => test.id === id)).filter((test) => !!test);
	}
	//#endregion
	//#region src/presentation/manage/target-panel-options-html.ts
	function targetPanelOptionsHtml(panels, panelId, instrumentName, escape) {
		return panels.map((panel) => `<option value="${panel.id}" ${panel.id === panelId ? "selected" : ""}>${escape(panel.name)} · ${escape(instrumentName(panel.instrumentId))}</option>`).join("");
	}
	//#endregion
	//#region src/presentation/manage/target-group-options-html.ts
	function targetGroupOptionsHtml(groups, selectedId, lotsOf, labelOf, statusSuffix, escape) {
		const available = groups.filter((group) => lotsOf(group).length);
		return available.length ? available.map((group) => `<option value="${group.id}" ${group.id === selectedId ? "selected" : ""}>${escape(labelOf(group) + statusSuffix(group))}</option>`).join("") : "<option value=\"\">Không tìm thấy nhóm lô QC phù hợp</option>";
	}
	//#endregion
	//#region src/presentation/manage/target-selection.ts
	function targetSelection(panels, groups, selectedPanelId, selectedGroupId, lotsOf) {
		const panelId = panels.some((panel) => panel.id === selectedPanelId) ? selectedPanelId : panels[0]?.id || "";
		const availableGroups = groups.filter((group) => group.active !== false && lotsOf(group).length);
		return {
			panelId,
			groupId: availableGroups.some((group) => group.id === selectedGroupId) ? selectedGroupId : availableGroups[0]?.id || ""
		};
	}
	//#endregion
	//#region src/presentation/manage/target-level-selection.ts
	function targetLevelSelection(lots, selectedLevel) {
		const levels = [...new Set(lots.map((lot) => Number(lot.level)).filter(Number.isFinite))].sort((left, right) => left - right);
		return {
			levels,
			level: levels.map(String).includes(String(selectedLevel)) ? String(selectedLevel) : levels[0] != null ? String(levels[0]) : ""
		};
	}
	//#endregion
	//#region src/presentation/manage/history-search-values.ts
	function historySearchValues(assay, lots, displayName) {
		const values = [assay.name, displayName(assay)];
		(assay.levels || []).forEach((level) => {
			(level.meanSdHistory?.length ? level.meanSdHistory : [{
				qcLotId: level.qcLotId,
				lot: level.lot
			}]).forEach((item) => {
				if (item.planned) return;
				const lot = lots.find((candidate) => candidate.id === (item.qcLotId || level.qcLotId)) || lots.find((candidate) => candidate.lotNo === (item.lot || level.lot) && Number(candidate.level) === Number(level.level));
				values.push(level.level, `M${level.level}`, `Mức ${level.level}`, item.lot, level.lot, lot?.lotNo);
			});
		});
		return values;
	}
	//#endregion
	//#region src/presentation/manage/tea-lab-basis-label.ts
	function teaLabBasisLabel(sources, source) {
		return sources.find((item) => item[0] === source)?.[1] || "";
	}
	//#endregion
	//#region src/presentation/manage/target-level-lots.ts
	function targetLevelLots(lots, selectedLevel) {
		const levelLots = lots.filter((lot) => Number(lot.level) === Number(selectedLevel));
		return {
			levelLots,
			depletedLots: levelLots.filter((lot) => !!lot.depleted)
		};
	}
	//#endregion
	//#region src/presentation/manage/target-search-values.ts
	function targetSearchValues(assay, groupName, lots, displayName, instrumentName) {
		return [
			assay.name,
			displayName(assay),
			assay.unit,
			assay.method,
			assay.reagent,
			assay.section,
			instrumentName(assay.instrumentId, assay.machine),
			groupName,
			...lots.map((lot) => lot.lotNo)
		];
	}
	//#endregion
	//#region src/presentation/manage/history-assay-options-html.ts
	function historyAssayOptionsHtml(assays, selectedId, displayName, escape) {
		return assays.map((assay) => `<option value="${assay.id}" ${assay.id === selectedId ? "selected" : ""}>${escape(displayName(assay))}</option>`).join("");
	}
	//#endregion
	//#region src/presentation/manage/history-assay-selection.ts
	function historyAssaySelection(assays, selectedId) {
		const assay = assays.find((item) => item.id === selectedId) || assays[0];
		return {
			selectedId: assay?.id || "",
			assay
		};
	}
	//#endregion
	//#region src/presentation/manage/history-visible-rows.ts
	function historyVisibleRows(rows, assayName, query, normalize) {
		const needle = normalize(query);
		if (!needle) return rows;
		return rows.filter((row) => [
			assayName,
			row.l.level,
			`M${row.l.level}`,
			`Mức ${row.l.level}`,
			row.lotNo
		].some((value) => normalize(value).includes(needle)));
	}
	//#endregion
	//#region src/presentation/manage/history-row-sort.ts
	function sortHistoryRows(rows) {
		return rows.sort((left, right) => Number(left.l.level) - Number(right.l.level) || (left.lotNo || "").localeCompare(right.lotNo || "", "vi") || String(left.h.effectiveFrom || "").localeCompare(String(right.h.effectiveFrom || "")));
	}
	//#endregion
	//#region src/presentation/manage/history-summary.ts
	function historySummary(rows) {
		return {
			rowCount: rows.length,
			pointCount: rows.reduce((count, row) => count + (row.pts?.length || 0), 0)
		};
	}
	//#endregion
	//#region src/presentation/manage/tea-positive-number.ts
	function teaPositiveNumber(value) {
		const number = Number(value);
		return String(value == null ? "" : value).trim() !== "" && Number.isFinite(number) && number > 0 ? number : null;
	}
	//#endregion
	//#region src/presentation/manage/tea-reference-external-changed.ts
	function teaReferenceExternalChanged(row, base) {
		return !!(row && base && (row.unit !== base[1] || row.clia !== base[2] || row.ricos !== base[3] || row.section !== base[4] || [
			"cliaRule",
			"cliaAbsolute",
			"cliaAbsoluteUnit"
		].some((field) => row[field] != null && row[field] !== "")));
	}
	//#endregion
	//#region src/presentation/manage/tea-source-registry-items.ts
	function teaSourceRegistryItems(registry, formatDate) {
		return [
			"clia",
			"ricos",
			"eflm"
		].map((key) => {
			const source = registry[key] || {};
			const status = source.status || "";
			return {
				status,
				label: source.label || "",
				statusLabel: status === "retired" ? "Nguồn cũ" : status === "dynamic" ? "Cập nhật liên tục" : "Hiện hành",
				tagClass: status === "retired" ? "warn" : status === "dynamic" ? "ok" : "none",
				version: source.version || "",
				effectiveDate: source.effectiveDate ? formatDate(source.effectiveDate) : "",
				reviewedDate: formatDate(source.reviewedDate || ""),
				url: source.url || ""
			};
		});
	}
	//#endregion
	//#region src/presentation/manage/manage-search-match.ts
	function manageSearchMatch(values, query, normalize) {
		const needle = normalize(query);
		return !needle || values.some((value) => normalize(value).includes(needle));
	}
	//#endregion
	//#region src/presentation/manage/lot-transition-target-number.ts
	function lotTransitionTargetNumber(transitions, lots, lotId, switchesLot) {
		const transition = transitions.find((item) => item.fromLotId === lotId && switchesLot(item));
		if (!transition) return "";
		return lots.find((lot) => lot.id === transition.toLotId)?.lotNo || "";
	}
	//#endregion
	//#region src/presentation/manage/history-period-label.ts
	function historyPeriodLabel(from, to, formatDate) {
		return `${from ? formatDate(from) : "Không giới hạn"} → ${to ? formatDate(to) : "Không giới hạn"}`;
	}
	//#endregion
	//#region src/presentation/manage/target-row-state.ts
	function targetRowState(linked, assigned, planned, depleted) {
		const locked = !!depleted;
		const checked = locked ? false : !!linked || !assigned;
		return {
			locked,
			checked,
			disabled: locked || !checked,
			status: locked ? "retired" : linked ? "linked" : planned ? "planned" : assigned ? "other" : "empty"
		};
	}
	//#endregion
	//#region src/presentation/manage/target-matrix-stats.ts
	function targetMatrixStats(rows) {
		return rows.reduce((stats, row) => {
			if (row.linked) stats.linked++;
			else if (row.assigned) stats.other++;
			else stats.empty++;
			const config = row.cfg;
			const hasMean = !!config && Number.isFinite(Number(config.mean));
			const hasSd = !!config && Number.isFinite(Number(config.sd)) && Number(config.sd) > 0;
			const hasRange = !!config && Number.isFinite(Number(config.low)) && Number.isFinite(Number(config.high)) && Number(config.high) > Number(config.low);
			if (!hasMean || !hasSd && !hasRange) stats.missing++;
			return stats;
		}, {
			linked: 0,
			other: 0,
			empty: 0,
			missing: 0
		});
	}
	//#endregion
	//#region src/presentation/manage/target-matrix-items.ts
	function targetMatrixItems(assays, lots, assigned, plannedTarget, snapshot) {
		return assays.flatMap((assay) => lots.map((lot) => ({
			assay,
			lot
		}))).filter(({ assay, lot }) => !lot.depleted || (assay.levels || []).some((level) => level.qcLotId === lot.id)).map(({ assay, lot }) => {
			const linked = (assay.levels || []).find((level) => level.qcLotId === lot.id);
			const same = (assay.levels || []).find((level) => Number(level.level) === Number(lot.level));
			return {
				t: assay,
				lot,
				linked,
				same,
				assigned: assigned(same),
				planned: !linked && plannedTarget(assay, lot),
				cfg: linked || snapshot(assay, lot.level, lot.id, lot.lotNo)
			};
		});
	}
	//#endregion
	//#region src/presentation/manage/target-level-tabs-html.ts
	function targetLevelTabsHtml(levels, selectedLevel, setLevelAction = "setTargetLevel") {
		return levels.map((level) => `<button class="${String(level) === String(selectedLevel) ? "on" : ""}" onclick="${setLevelAction}(${level})">Mức ${level}</button>`).join("");
	}
	//#endregion
	//#region src/presentation/manage/target-summary-html.ts
	function targetSummaryHtml(stats) {
		return `<div class="target-summary"><span class="ok"><b>${stats.linked}</b> đã gán mức này</span><span class="${stats.other ? "warn" : "none"}"><b>${stats.other}</b> đang dùng lô khác</span><span class="${stats.empty ? "warn" : "none"}"><b>${stats.empty}</b> chưa gán lô</span><span class="${stats.missing ? "warn" : "ok"}"><b>${stats.missing}</b> thiếu Mean/SD</span></div>`;
	}
	//#endregion
	//#region src/presentation/manage/target-matrix-row-html.ts
	function targetMatrixRowHtml(model, escape, escapeAttribute) {
		const statusHtml = model.status === "retired" ? `<b class="tag rej">${model.retiredTo ? `Đã chuyển tiếp qua lô ${escape(model.retiredTo)}` : "Đã chuyển tiếp"}</b>` : model.status === "linked" ? "<b class=\"tag ok\">Đã gán</b>" : model.status === "planned" ? "<b class=\"tag warn\">Dự kiến</b>" : model.status === "other" ? `<b class="tag warn">Đang dùng ${escape(model.otherLot || "lô khác")}</b>` : "<b class=\"tag none\">Chưa gán</b>";
		return `<div class="target-row${model.locked ? " target-row-locked" : ""}" data-test="${model.testId}" data-lot="${model.lotId}"${model.locked ? " data-locked=\"1\"" : ""}>
    <label class="lot-assay-check"><input class="tm-use" type="checkbox" ${model.checked ? "checked" : ""} ${model.locked ? "disabled" : ""} onchange="toggleTargetRow(this)"><span></span></label>
    <div class="lot-assay-name"><b>${escape(model.name)}</b><small>${escape(model.unit || "Chưa có đơn vị")}</small></div>
    <input class="tm-mean" type="number" step="any" value="${escapeAttribute(model.mean)}" placeholder="Trung bình" oninput="syncTargetRange(this,'target')" ${model.disabled ? "disabled" : ""}>
    <input class="tm-low" type="number" step="any" value="${escapeAttribute(model.low)}" placeholder="Giới hạn dưới" oninput="syncTargetRange(this,'limits')" ${model.disabled ? "disabled" : ""}>
    <input class="tm-high" type="number" step="any" value="${escapeAttribute(model.high)}" placeholder="Giới hạn trên" oninput="syncTargetRange(this,'limits')" ${model.disabled ? "disabled" : ""}>
    <input class="tm-sd" type="number" step="any" value="${escapeAttribute(model.sd)}" placeholder="Độ lệch chuẩn" oninput="syncTargetRange(this,'target')" ${model.disabled ? "disabled" : ""}>
    <span>${statusHtml}</span>
  </div>`;
	}
	//#endregion
	//#region src/presentation/manage/history-rows.ts
	function historyRows(assay, lots, points, groupLabel) {
		const rows = [];
		(assay.levels || []).forEach((level) => {
			(level.meanSdHistory?.length ? level.meanSdHistory : [{
				qcLotId: level.qcLotId,
				lot: level.lot,
				mean: level.mean,
				sd: level.sd,
				low: level.low,
				high: level.high,
				effectiveFrom: "",
				effectiveTo: level.exp,
				source: level.applied || "mfg"
			}]).forEach((item) => {
				if (item.planned) return;
				const lotObj = lots.find((lot) => lot.id === (item.qcLotId || level.qcLotId)) || lots.find((lot) => lot.lotNo === (item.lot || level.lot) && Number(lot.level) === Number(level.level));
				const lotNo = item.lot || level.lot || lotObj?.lotNo || "";
				rows.push({
					t: assay,
					l: level,
					h: item,
					lotObj,
					lotNo,
					group: lotObj ? groupLabel(lotObj.id) : "Chưa thuộc nhóm",
					pts: points.filter((point) => Number(point.level) === Number(level.level) && (point.lot || "") === (lotNo || ""))
				});
			});
		});
		return rows;
	}
	//#endregion
	//#region src/presentation/manage/history-selector-html.ts
	function historySelectorHtml(optionsHtml, rowCount, pointCount) {
		return `<div class="target-selector history-selector">
      <div><label>Xét nghiệm</label><select onchange="setHistoryTest(this.value)">${optionsHtml}</select></div>
      <div class="target-lot-info"><b>${rowCount}</b><span>mốc lô/Mean-SD</span></div>
      <div class="target-lot-info"><b>${pointCount}</b><span>điểm QC đã nhập</span></div>
    </div>`;
	}
	//#endregion
	//#region src/presentation/manage/target-selector-html.ts
	function targetSelectorHtml(panelOptionsHtml, groupOptionsHtml) {
		return `<div class="target-selector">
      <div><label>Panel QC</label><select onchange="setTargetPanel(this.value)">${panelOptionsHtml || "<option value=\"\">Chưa có panel</option>"}</select></div>
      <div><label>Nhóm lô QC</label><select onchange="setTargetGroup(this.value)">${groupOptionsHtml}</select></div>
    </div>`;
	}
	//#endregion
	//#region src/presentation/manage/history-table-html.ts
	function historyTableHtml(rowsHtml, emptyHtml) {
		return `<div class="rcfg-list">${rowsHtml ? `<table class="history-table"><thead><tr><th>Mức</th><th>Lô QC / Nhóm lô</th><th class="num">Mean</th><th class="num">Giới hạn dưới</th><th class="num">Giới hạn trên</th><th class="num">SD</th><th>Hiệu lực</th><th>Nguồn</th><th class="num">Điểm QC</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table>` : emptyHtml}</div>`;
	}
	//#endregion
	//#region src/presentation/manage/target-empty-state.ts
	function targetEmptyState(allAssayCount, levelLotNos, depletedLotNos, level) {
		if (!allAssayCount) return {
			title: "Panel chưa có xét nghiệm",
			description: "Sửa Panel QC và chọn các xét nghiệm thành viên trước."
		};
		if (levelLotNos.length && depletedLotNos.length === levelLotNos.length) return {
			title: `Lô mức ${level} đã hết QC`,
			description: `Lô ${depletedLotNos.join(", ")} (Mức ${level}) trong nhóm này đã hết QC nên không nhập Mean/SD được. Hãy chọn nhóm lô khác ở ô “Nhóm lô QC” phía trên, hoặc tạo lô mới rồi lập hồ sơ chuyển tiếp lô.`
		};
		return {
			title: "Không tìm thấy xét nghiệm",
			description: "Thử tìm theo tên xét nghiệm, máy, khoa, đơn vị hoặc lô QC."
		};
	}
	//#endregion
	//#region src/presentation/manage/target-matrix-table-html.ts
	function targetMatrixTableHtml(rowsHtml) {
		return `<div class="target-table"><div class="target-head"><span>Dùng</span><span>Xét nghiệm</span><span>Trung bình mục tiêu</span><span>Giới hạn dưới</span><span>Giới hạn trên</span><span>Độ lệch chuẩn</span><span>Trạng thái</span></div>${rowsHtml}</div>`;
	}
	//#endregion
	//#region src/presentation/manage/target-matrix-actions-html.ts
	function targetMatrixActionsHtml(clearButtonHtml, selectButtonHtml, saveButtonHtml) {
		return `<div class="modal-f target-actions">${clearButtonHtml}${selectButtonHtml}${saveButtonHtml}</div>`;
	}
	//#endregion
	//#region src/presentation/manage/target-prerequisite.ts
	function targetPrerequisite(counts) {
		if (!counts.tests) return "tests";
		if (!counts.panels) return "panels";
		if (!counts.lots) return "lots";
		if (!counts.groups) return "groups";
		return null;
	}
	//#endregion
	//#region src/presentation/manage/target-level-toolbar-html.ts
	function targetLevelToolbarHtml(level, lotNos, tabsHtml, escape) {
		return `<div class="target-level-toolbar"><div><b>Mức ${escape(level)}</b><span class="target-level-lot">${lotNos.map((lotNo) => escape(lotNo)).join(" / ")}</span></div><div class="dayseg">${tabsHtml}</div></div>`;
	}
	//#endregion
	//#region src/presentation/manage/tea-reference-kind.ts
	function teaReferenceKind(isDefault, externallyChanged, hasLabValue) {
		if (!isDefault) return "custom";
		if (externallyChanged) return "override";
		if (hasLabValue) return "lab";
		return "default";
	}
	//#endregion
	//#region src/presentation/manage/tea-reference-row-actions.ts
	function teaReferenceRowActions(kind, canManage, hasLabValue) {
		return {
			action: !canManage ? "none" : kind === "override" ? "restore" : kind === "custom" ? "remove" : "none",
			labProfile: canManage ? hasLabValue ? "view" : "add" : "none"
		};
	}
	//#endregion
	//#region src/presentation/manage/tea-reference-sort.ts
	function sortTeaReferences(rows) {
		return rows.sort((left, right) => String(left.section || "").localeCompare(String(right.section || ""), "vi") || String(left.displayName || "").localeCompare(String(right.displayName || ""), "vi"));
	}
	//#endregion
	//#region src/presentation/manage/tea-reference-naming-title.ts
	function teaReferenceNamingTitle(values) {
		return [
			values.standardName && `Tên chuẩn: ${values.standardName}`,
			values.abbreviation && `Viết tắt: ${values.abbreviation}`,
			values.matrix && `Loại mẫu: ${values.matrix}`
		].filter(Boolean).join(" · ");
	}
	//#endregion
	//#region src/presentation/manage/tea-reference-empty-state.ts
	function teaReferenceEmptyState(hasSearchQuery) {
		return hasSearchQuery ? {
			title: "Không tìm thấy",
			description: "Thử từ khóa khác."
		} : {
			title: "Chưa có bảng tham chiếu",
			description: "Không có xét nghiệm nào."
		};
	}
	//#endregion
	//#region src/presentation/manage/tea-reference-lab-value-html.ts
	function teaReferenceLabValueHtml(value, formatNumber) {
		return value == null ? "" : `<b>${formatNumber(value, 2)}%</b>`;
	}
	//#endregion
	//#region src/presentation/manage/tea-reference-input-value.ts
	function teaReferenceInputValue(value) {
		return value == null ? "" : String(value);
	}
	//#endregion
	//#region src/application/storage/sigma-draft-service.ts
	function createSigmaDraftService(deps) {
		const read = () => {
			try {
				const value = JSON.parse(deps.get(deps.key) || "null");
				return value && typeof value === "object" && value.branches && typeof value.branches === "object" ? value : null;
			} catch {
				return null;
			}
		};
		const stamp = () => Number(read()?.savedAt || 0);
		const persist = (testId, sigmaData, path) => {
			if (!testId) return false;
			try {
				const persistedAt = Number(deps.get(deps.savedAtKey) || 0), previous = read(), branches = previous && Number(previous.savedAt || 0) > persistedAt ? { ...previous.branches } : {};
				branches[String(testId)] = deps.clone(sigmaData && sigmaData[testId] || []);
				const savedAt = Math.max(deps.now(), Number(previous?.savedAt || 0) + 1);
				deps.set(deps.key, JSON.stringify({
					savedAt,
					path,
					branches
				}));
				return true;
			} catch {
				return false;
			}
		};
		const clearThrough = (value) => {
			try {
				const current = read();
				if (current && Number(current.savedAt || 0) <= Number(value || 0)) deps.remove(deps.key);
			} catch {}
		};
		return Object.freeze({
			read,
			stamp,
			persist,
			clearThrough
		});
	}
	//#endregion
	//#region src/application/storage/state-adoption-service.ts
	function createStateAdoptionService(deps) {
		const sanitize = (value) => {
			const errors = deps.validate(value);
			if (errors.length) throw new Error(errors.join("\n"));
			return deps.sanitize(value, { owned: true });
		};
		const assertInvariants = (value) => {
			const errors = deps.invariants(value, { sanitized: true });
			if (errors.length) throw new Error(errors.join("\n"));
			return value;
		};
		return Object.freeze({
			sanitize,
			assertInvariants
		});
	}
	//#endregion
	//#region src/application/storage/corrupt-local-quarantine.ts
	function createCorruptLocalQuarantine(now) {
		return (raw, error) => ({
			capturedAt: now(),
			source: "localStorage:qclab",
			message: error && error.message ? error.message : "Dá»¯ liá»‡u cá»¥c bá»™ khÃ´ng há»£p lá»‡.",
			raw: String(raw || "")
		});
	}
	//#endregion
	//#region src/domain/sync/value-codec.ts
	function createSyncValueCodec() {
		const clone = (value) => value === void 0 ? void 0 : JSON.parse(JSON.stringify(value));
		const cloudValue = (value) => value === void 0 ? null : clone(value);
		const json = (value) => JSON.stringify(value === void 0 ? null : value);
		return Object.freeze({
			clone,
			cloudValue,
			json
		});
	}
	//#endregion
	//#region src/domain/sync/firebase-config-selection.ts
	function createFirebaseConfigSelection(keys) {
		const select = (deploy, stored) => deploy && deploy.locked ? deploy : stored || deploy;
		const signature = (config) => JSON.stringify(Object.fromEntries(keys.map((key) => [key, String(config && config[key] || "")])));
		return Object.freeze({
			select,
			signature
		});
	}
	//#endregion
	//#region src/domain/sync/firebase-connection-gate.ts
	function createFirebaseConnectionGate() {
		const canWrite = (connection) => !!(connection.ready && connection.initialized && connection.ref);
		const networkOnline = (online) => online !== false;
		return Object.freeze({
			canWrite,
			networkOnline
		});
	}
	//#endregion
	//#region src/domain/sync/snapshot-signature.ts
	function syncSnapshotSignature(value) {
		if (!value) return "empty";
		const text = JSON.stringify(value);
		let hash = 0;
		for (let index = 0; index < text.length; index++) hash = hash * 31 + text.charCodeAt(index) >>> 0;
		return text.length + ":" + hash.toString(36);
	}
	//#endregion
	//#region src/domain/sync/firebase-identity.ts
	function createFirebaseIdentity() {
		const dataPath = (config) => "qclab-shared/" + String(config && config.labCode || "default").replace(/[.#$/\[\]]/g, "_");
		const statusLabel = (config, user) => (user.email || (user.isAnonymous ? "áº©n danh" : "Ä‘Ã£ xÃ¡c thá»±c")) + " Â· " + (config.labCode || "default") + " Â· " + dataPath(config);
		return Object.freeze({
			dataPath,
			statusLabel
		});
	}
	//#endregion
	//#region src/domain/sync/firebase-audit-gate.ts
	function createFirebaseAuditGate(verify) {
		return (snapshot) => verify(snapshot && snapshot.activity || [], snapshot && snapshot.activityAnchor || "");
	}
	//#endregion
	//#region src/application/sync/firebase-polling-service.ts
	function createFirebasePollingService(clock) {
		const stop = (timer) => {
			if (timer) clock.clearInterval(timer);
			return null;
		};
		const start = (timer, pull, interval = 8e3) => {
			stop(timer);
			return clock.setInterval(pull, interval);
		};
		return Object.freeze({
			stop,
			start
		});
	}
	//#endregion
	//#region src/domain/sync/firebase-lifecycle-state.ts
	function firebaseDisconnectedState(current, clearAuthUser) {
		return {
			...current,
			ready: false,
			initialized: false,
			ref: null,
			synced: null,
			seenSig: null,
			...clearAuthUser ? { authUser: null } : {}
		};
	}
	//#endregion
	//#region src/domain/sync/firebase-pull-gate.ts
	function firebaseCanPull(connection) {
		return !!(connection && connection.ref && connection.authUser);
	}
	//#endregion
	//#region src/application/sync/firebase-pull-service.ts
	function createFirebasePullService(deps) {
		const pull = async (connection) => {
			if (!deps.canPull(connection)) return false;
			try {
				const snapshot = await deps.read(connection.ref);
				deps.handle(snapshot.val(), { silent: true });
				return true;
			} catch {
				return false;
			}
		};
		return Object.freeze({ pull });
	}
	//#endregion
	//#region src/application/sync/firebase-merge-application.ts
	function createFirebaseMergeApplication(deps) {
		return (base, mergeFirstConnect, local, remote) => base ? deps.merge(local, remote, base) : mergeFirstConnect ? deps.firstMerge(local, remote) : remote;
	}
	//#endregion
	//#region src/application/storage/local-partition-helpers.ts
	function createLocalPartitionHelpers() {
		const key = (slot, type, id) => "partition:" + slot + ":" + type + (id == null ? "" : ":" + id);
		const nextSlot = (current) => current === "a" ? "b" : "a";
		const shell = (state) => ({
			...state,
			data: {}
		});
		return Object.freeze({
			key,
			nextSlot,
			shell
		});
	}
	//#endregion
	//#region src/application/storage/local-snapshot-record.ts
	function createLocalSnapshotRecord(deps) {
		const state = (value) => ({
			key: deps.key,
			savedAt: deps.now(),
			state: deps.clone(value)
		});
		const serialized = (value) => ({
			key: deps.key,
			savedAt: deps.now(),
			json: String(value)
		});
		return Object.freeze({
			state,
			serialized
		});
	}
	//#endregion
	//#region src/application/storage/local-partition-validation.ts
	function localPartitionValid(manifest, shell, rows) {
		if (!manifest || !shell || !shell.state || Number(shell.savedAt || 0) > Number(manifest.savedAt || 0)) return false;
		return !(rows || []).some((row) => !row || !Array.isArray(row.points) || Number(row.savedAt || 0) > Number(manifest.savedAt || 0));
	}
	//#endregion
	//#region src/application/storage/local-recovery-slots.ts
	function localRecoverySlots(preferred) {
		return preferred === "a" ? ["a", "b"] : preferred === "b" ? ["b", "a"] : [preferred, preferred === "a" ? "b" : "a"];
	}
	//#endregion
	//#region src/application/storage/local-partition-transaction.ts
	function createLocalPartitionTransaction(deps) {
		const draft = (state, currentSlot, dirtyTestIds, currentManifest) => {
			const data = state && state.data || {}, testIds = Object.keys(data), dirty = Array.isArray(dirtyTestIds) ? [...new Set(dirtyTestIds.map(String))] : null;
			const incremental = !!(currentManifest && dirty);
			return {
				data,
				testIds,
				dirtyTestIds: dirty,
				incremental,
				slot: incremental ? currentSlot : deps.nextSlot(currentSlot)
			};
		};
		const finalize = (state, currentManifest, slotManifest, draftPlan) => {
			const partitions = draftPlan.incremental ? draftPlan.dirtyTestIds.filter((id) => Object.prototype.hasOwnProperty.call(draftPlan.data, id)) : draftPlan.testIds;
			const removedTestIds = (slotManifest && Array.isArray(slotManifest.testIds) ? slotManifest.testIds : []).filter((id) => !draftPlan.testIds.includes(id));
			return {
				...draftPlan,
				savedAt: Math.max(deps.now(), Number(currentManifest && currentManifest.savedAt || 0) + 1),
				shell: deps.shell(state),
				partitions,
				removedTestIds
			};
		};
		return Object.freeze({
			draft,
			finalize
		});
	}
	//#endregion
	//#region src/application/storage/local-partition-recovery.ts
	function createLocalPartitionRecovery(valid) {
		return (slot, manifest, shell, rows) => {
			if (slot !== "a" && slot !== "b" || !valid(manifest, shell, rows)) return null;
			const testIds = Array.isArray(manifest.testIds) ? manifest.testIds : [], data = {};
			testIds.forEach((testId, index) => {
				data[testId] = rows[index].points;
			});
			return {
				slot,
				savedAt: manifest.savedAt || 0,
				state: {
					...shell.state,
					data
				}
			};
		};
	}
	//#endregion
	//#region src/application/storage/local-clear-keys.ts
	function createLocalClearKeys(key, stateKey) {
		return (manifests) => {
			const keys = [stateKey, "partition:latest"];
			["a", "b"].forEach((slot, index) => {
				keys.push(key(slot, "manifest"), key(slot, "shell"));
				(manifests[index] && Array.isArray(manifests[index].testIds) ? manifests[index].testIds : []).forEach((testId) => keys.push(key(slot, "data", testId)));
			});
			return keys;
		};
	}
	//#endregion
	//#region src/domain/sync/firebase-snapshot-gate.ts
	function firebaseSnapshotGate(seenSignature, nextSignature) {
		return {
			handle: !(nextSignature && nextSignature === seenSignature),
			seenSignature: nextSignature
		};
	}
	//#endregion
	//#region src/domain/sync/firebase-remote-snapshot.ts
	function createFirebaseRemoteSnapshot(validate, sanitize) {
		return (value) => {
			const errors = validate(value);
			return {
				errors,
				remote: errors.length ? null : sanitize(value)
			};
		};
	}
	//#endregion
	//#region src/domain/sync/firebase-own-snapshot.ts
	function firebaseOwnSnapshotPlan(snapshot, clientId) {
		return { own: !!(snapshot && snapshot._client && snapshot._client === clientId) };
	}
	//#endregion
	//#region src/domain/sync/firebase-first-connect-plan.ts
	function firebaseFirstConnectPlan(base, dirty, localHasContent, statesEqual) {
		const sameFirstConnectData = !base && !dirty && localHasContent && statesEqual;
		return {
			mergeFirstConnect: dirty || sameFirstConnectData,
			confirmConflict: !base && !dirty && localHasContent && !sameFirstConnectData
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
	//#region src/presentation/reagent/reagent-report-presentation.ts
	function formatReagentNumber(value, decimals = 4) {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Number(numeric.toFixed(decimals)).toString() : "—";
	}
	function formatReagentTStatistic(value) {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? Number(numeric.toFixed(4)).toString() : numeric > 0 ? "+∞" : "−∞";
	}
	function reagentReportVerdict(result, palette) {
		if (!result) return {
			text: "Thiếu dữ liệu",
			cls: "mid",
			bg: palette.midBg,
			fg: palette.midFg
		};
		if (result.level === "ok") return {
			text: "Đạt sàng lọc",
			cls: "ok",
			bg: palette.okBg,
			fg: palette.okFg
		};
		if (result.level === "mid") return {
			text: "Chưa đủ điều kiện",
			cls: "mid",
			bg: palette.midBg,
			fg: palette.midFg
		};
		return {
			text: "Có khác biệt",
			cls: "no",
			bg: palette.noBg,
			fg: palette.noFg
		};
	}
	function reagentReportConclusion(result) {
		if (!result) return "";
		if (result.level === "ok") return "Không khác biệt có ý nghĩa theo tiêu chí sàng lọc phần mềm; trình phê duyệt theo SOP trước khi dùng lô mới.";
		if (result.level === "mid") return "Chưa đủ điều kiện sàng lọc phần mềm; cần bổ sung dữ liệu/xác nhận bao phủ hoặc ghi nhận ngoại lệ theo SOP.";
		return "Có khác biệt vượt giới hạn; không dùng lô mới trước khi điều tra và xử lý.";
	}
	function reagentReportSummaryRows(items, palette) {
		return (items || []).map((item, index) => {
			const test = item?.ds?.test || {}, result = item?.R || null;
			return {
				index: index + 1,
				reagent: String(test.reagent || "Hóa chất mới"),
				unit: String(test.unit || ""),
				lotOld: String(test.lotOld || "?"),
				lotNew: String(test.lotNew || "?"),
				result,
				n: result ? result.N : "—",
				r: result ? formatReagentNumber(result.r, 4) : "—",
				bias: result ? `${formatReagentNumber(result.bias, 2)}%` : "—",
				p2: result ? formatReagentNumber(result.p2, 4) : "—",
				verdict: reagentReportVerdict(result, palette)
			};
		});
	}
	function reagentReportDetailModel(result, test, minPairs, dateText) {
		const metadata = {
			reagent: String(test?.reagent || "Hóa chất mới"),
			lotOld: String(test?.lotOld || "—"),
			lotNew: String(test?.lotNew || "—"),
			dateText,
			operator: String(test?.operator || "—"),
			sampleType: String(test?.sampleType || "—"),
			biasTarget: String(test?.biasTarget || 6),
			alpha: String(test?.alpha || .05)
		};
		if (!result) return {
			complete: false,
			minPairs,
			metadata,
			pairs: [],
			metrics: null,
			conclusion: ""
		};
		return {
			complete: true,
			minPairs,
			metadata,
			pairs: (result.o || []).map((oldValue, index) => {
				const newValue = result.n[index];
				return {
					index: index + 1,
					oldValue,
					newValue,
					average: ((oldValue + newValue) / 2).toFixed(3),
					difference: (oldValue - newValue).toFixed(3)
				};
			}),
			metrics: {
				meanOld: formatReagentNumber(result.mO, 2),
				meanNew: formatReagentNumber(result.mN, 2),
				correlation: formatReagentNumber(result.r, 5),
				tStatistic: formatReagentTStatistic(result.tStat),
				df: result.df,
				p2: formatReagentNumber(result.p2, 5),
				bias: formatReagentNumber(result.bias, 3),
				olsSlope: formatReagentNumber(result.fit.b, 3),
				olsIntercept: formatReagentNumber(Math.abs(result.fit.a), 3),
				olsInterceptSign: result.fit.a >= 0 ? "+" : "−",
				olsR2: formatReagentNumber(result.fit.r2, 4),
				pbSlope: formatReagentNumber(result.pb.b, 3),
				pbIntercept: formatReagentNumber(Math.abs(result.pb.a), 3),
				pbInterceptSign: result.pb.a >= 0 ? "+" : "−"
			},
			conclusion: reagentReportConclusion(result)
		};
	}
	var reagentReportPresentation = Object.freeze({
		formatNumber: formatReagentNumber,
		formatTStatistic: formatReagentTStatistic,
		verdict: reagentReportVerdict,
		conclusion: reagentReportConclusion,
		summaryRows: reagentReportSummaryRows,
		detailModel: reagentReportDetailModel
	});
	//#endregion
	//#region src/presentation/reagent/reagent-chart-range.ts
	function reagentChartRange(values, paddingRatio = .08) {
		const minimum = values.reduce((current, value) => value < current ? value : current, values[0]);
		const maximum = values.reduce((current, value) => value > current ? value : current, values[0]);
		const padding = (maximum - minimum || Math.abs(maximum) || 1) * paddingRatio;
		return [minimum - padding, maximum + padding];
	}
	var reagentChartPresentation = Object.freeze({ range: reagentChartRange });
	//#endregion
	//#region src/presentation/reagent/reagent-report-items.ts
	function reagentReportItems(comparisons, calculate) {
		return (comparisons || []).map((comparison) => ({
			ds: comparison,
			R: calculate(comparison)
		}));
	}
	var reagentReportItemPresentation = Object.freeze({ items: reagentReportItems });
	//#endregion
	//#region src/presentation/reagent/reagent-comparison-label.ts
	function reagentComparisonLabel(test, analyteLabel) {
		let label = String(analyteLabel(test?.reagent) || test?.reagent || "Hóa chất mới");
		if (test?.lotOld || test?.lotNew) label += ` — ${test.lotOld || "?"}→${test.lotNew || "?"}`;
		return label;
	}
	var reagentComparisonLabelPresentation = Object.freeze({ label: reagentComparisonLabel });
	//#endregion
	//#region src/presentation/reagent/reagent-quick-label.ts
	function reagentQuickLabel(type) {
		return type === "sampleType" ? "loại mẫu" : "người thực hiện";
	}
	var reagentQuickLabelPresentation = Object.freeze({ label: reagentQuickLabel });
	//#endregion
	//#region src/presentation/reagent/reagent-tool-icon.ts
	var paths = {
		search: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>",
		print: "<path d=\"M6 9V2h12v7\"/>",
		report: "<path d=\"M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z\"/>",
		trash: "<path d=\"M3 6h18\"/>"
	};
	function reagentToolIcon(type) {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[type] || ""}</svg>`;
	}
	var reagentToolIconPresentation = Object.freeze({ icon: reagentToolIcon });
	//#endregion
	//#region src/domain/reagent/reagent-pairs.ts
	function reagentValidPairs(rows) {
		const o = [], n = [];
		(rows || []).forEach((row) => {
			const oldValue = Number.parseFloat(String(row?.[0] ?? "")), newValue = Number.parseFloat(String(row?.[1] ?? ""));
			if (!Number.isNaN(oldValue) && !Number.isNaN(newValue)) {
				o.push(oldValue);
				n.push(newValue);
			}
		});
		return {
			o,
			n
		};
	}
	function reagentPairCalc(row) {
		const oldValue = Number.parseFloat(String(row?.[0] ?? "")), newValue = Number.parseFloat(String(row?.[1] ?? ""));
		return Number.isFinite(oldValue) && Number.isFinite(newValue) ? {
			avg: (oldValue + newValue) / 2,
			dif: oldValue - newValue
		} : null;
	}
	var reagentPairMath = Object.freeze({
		validPairs: reagentValidPairs,
		pairCalc: reagentPairCalc
	});
	//#endregion
	//#region src/domain/reagent/reagent-statistics.ts
	function reagentMax(values) {
		return values.reduce((max, value) => value > max ? value : max, values[0]);
	}
	function reagentMin(values) {
		return values.reduce((min, value) => value < min ? value : min, values[0]);
	}
	function reagentMean(values) {
		return values.reduce((sum, value) => sum + value, 0) / values.length;
	}
	function reagentVariance(values) {
		const mean = reagentMean(values);
		return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
	}
	function reagentPearson(x, y) {
		const count = x.length;
		let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
		for (let index = 0; index < count; index++) {
			sx += x[index];
			sy += y[index];
			sxy += x[index] * y[index];
			sx2 += x[index] * x[index];
			sy2 += y[index] * y[index];
		}
		const denominator = Math.sqrt((count * sx2 - sx * sx) * (count * sy2 - sy * sy));
		return denominator === 0 ? 0 : (count * sxy - sx * sy) / denominator;
	}
	function reagentOls(x, y) {
		const count = x.length, meanX = reagentMean(x), meanY = reagentMean(y);
		let sumXY = 0, sumXX = 0;
		for (let index = 0; index < count; index++) {
			sumXY += (x[index] - meanX) * (y[index] - meanY);
			sumXX += (x[index] - meanX) ** 2;
		}
		const b = sumXX === 0 ? 0 : sumXY / sumXX, a = meanY - b * meanX, r = reagentPearson(x, y);
		return {
			a,
			b,
			r2: r * r
		};
	}
	function reagentMedian(values) {
		const sorted = [...values].sort((left, right) => left - right), count = sorted.length;
		return count % 2 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
	}
	function reagentPassingBablok(x, y) {
		const slopes = [], count = x.length;
		for (let left = 0; left < count; left++) for (let right = left + 1; right < count; right++) {
			const dx = x[right] - x[left], dy = y[right] - y[left];
			if (dx === 0) continue;
			const slope = dy / dx;
			if (slope !== -1) slopes.push(slope);
		}
		if (!slopes.length) return {
			a: 0,
			b: 1
		};
		slopes.sort((left, right) => left - right);
		const k = slopes.filter((slope) => slope < -1).length, countSlopes = slopes.length;
		const b = countSlopes % 2 ? slopes[(countSlopes + 1) / 2 - 1 + k] : (slopes[countSlopes / 2 - 1 + k] + slopes[countSlopes / 2 + k]) / 2;
		return {
			a: reagentMedian(x.map((value, index) => y[index] - b * value)),
			b
		};
	}
	var reagentStatistics = Object.freeze({
		max: reagentMax,
		min: reagentMin,
		mean: reagentMean,
		variance: reagentVariance,
		pearson: reagentPearson,
		ols: reagentOls,
		median: reagentMedian,
		passingBablok: reagentPassingBablok
	});
	//#endregion
	//#region src/domain/reagent/reagent-t-distribution.ts
	function reagentLogGamma(value) {
		const coefficients = [
			76.18009172947146,
			-86.50532032941678,
			24.01409824083091,
			-1.231739572450155,
			.001208650973866179,
			-5395239384953e-18
		];
		let y = value, x = value + 5.5;
		x -= (value + .5) * Math.log(x);
		let sum = 1.000000000190015;
		for (let index = 0; index < 6; index++) {
			y++;
			sum += coefficients[index] / y;
		}
		return -x + Math.log(2.5066282746310007 * sum / value);
	}
	function reagentBetaContinuedFraction(a, b, x) {
		const maxIterations = 200, epsilon = 3e-12, floor = 1e-300;
		let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
		if (Math.abs(d) < floor) d = floor;
		d = 1 / d;
		let h = d;
		for (let iteration = 1; iteration <= maxIterations; iteration++) {
			const twice = 2 * iteration;
			let aa = iteration * (b - iteration) * x / ((qam + twice) * (a + twice));
			d = 1 + aa * d;
			if (Math.abs(d) < floor) d = floor;
			c = 1 + aa / c;
			if (Math.abs(c) < floor) c = floor;
			d = 1 / d;
			h *= d * c;
			aa = -(a + iteration) * (qab + iteration) * x / ((a + twice) * (qap + twice));
			d = 1 + aa * d;
			if (Math.abs(d) < floor) d = floor;
			c = 1 + aa / c;
			if (Math.abs(c) < floor) c = floor;
			d = 1 / d;
			const delta = d * c;
			h *= delta;
			if (Math.abs(delta - 1) < epsilon) break;
		}
		return h;
	}
	function reagentRegularizedBeta(a, b, x) {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		const factor = Math.exp(reagentLogGamma(a + b) - reagentLogGamma(a) - reagentLogGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
		return x < (a + 1) / (a + b + 2) ? factor * reagentBetaContinuedFraction(a, b, x) / a : 1 - factor * reagentBetaContinuedFraction(b, a, 1 - x) / b;
	}
	function reagentTwoSidedPValue(t, degreesOfFreedom) {
		return reagentRegularizedBeta(degreesOfFreedom / 2, .5, degreesOfFreedom / (degreesOfFreedom + t * t));
	}
	function reagentTCritical(degreesOfFreedom, alpha) {
		let low = 0, high = 1e3;
		for (let iteration = 0; iteration < 200; iteration++) {
			const middle = (low + high) / 2;
			if (reagentTwoSidedPValue(middle, degreesOfFreedom) > alpha) low = middle;
			else high = middle;
		}
		return (low + high) / 2;
	}
	var reagentTDistribution = Object.freeze({
		logGamma: reagentLogGamma,
		betaContinuedFraction: reagentBetaContinuedFraction,
		regularizedBeta: reagentRegularizedBeta,
		twoSidedPValue: reagentTwoSidedPValue,
		tCritical: reagentTCritical
	});
	//#endregion
	//#region src/domain/reagent/reagent-comparison-calculation.ts
	function createReagentComparisonCalculator(deps) {
		const calculate = (dataset, minimumPairs) => {
			const { o, n } = deps.validPairs(dataset?.rows);
			if (o.length < minimumPairs) return null;
			const test = dataset?.test || {}, N = o.length, df = N - 1, d = o.map((value, index) => value - n[index]);
			const mO = deps.mean(o), mN = deps.mean(n), vO = deps.variance(o), vN = deps.variance(n), md = deps.mean(d), sdd = Math.sqrt(deps.variance(d));
			const tStat = deps.max(d) - deps.min(d) < 1e-9 * (Math.abs(mO) + Math.abs(mN) + 1) ? md === 0 ? 0 : md > 0 ? Infinity : -Infinity : md / (sdd / Math.sqrt(N)), r = deps.pearson(o, n);
			const alpha = Number.parseFloat(String(test.alpha ?? "")) || .05, p2 = Number.isFinite(tStat) ? deps.twoSidedPValue(tStat, df) : 0;
			const bias = mO ? Math.abs((mO - mN) / Math.abs(mO)) * 100 : mN ? Infinity : 0, biasT = Number.parseFloat(String(test.biasTarget ?? "")) || 6, coverage = !!test.coverageConfirmed, enoughN = N >= 20;
			const fit = deps.ols(o, n), pb = deps.passingBablok(o, n);
			const relPairs = o.map((value, index) => {
				const midpoint = (value + n[index]) / 2;
				return midpoint !== 0 ? Math.abs((value - n[index]) / midpoint) : null;
			}).filter((value) => value != null);
			const mard = relPairs.length ? deps.mean(relPairs) * 100 : NaN;
			const passP = p2 > alpha, passBias = bias < biasT, passR2 = fit.r2 > .95, passSlope = fit.b >= .9 && fit.b <= 1.1;
			const passScreen = enoughN && coverage && passBias, level = !passBias ? "no" : passScreen ? "ok" : "mid";
			return {
				o,
				n,
				N,
				df,
				d,
				mO,
				mN,
				vO,
				vN,
				md,
				sdd,
				tStat,
				r,
				alpha,
				p2,
				p1: p2 / 2,
				tc2: deps.tCritical(df, alpha),
				tc1: deps.tCritical(df, 2 * alpha),
				bias,
				biasT,
				fit,
				pb,
				mard,
				passP,
				passBias,
				passR2,
				passSlope,
				coverage,
				enoughN,
				passScreen,
				level
			};
		};
		return Object.freeze({ calculate });
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
	//#endregion
	//#region src/presentation/westgard/westgard-row-window.ts
	function westgardRowsWindow(rows, expanded, initialRows = 120) {
		const all = Array.isArray(rows) ? rows : [];
		const limit = Number.isInteger(initialRows) && initialRows > 0 ? initialRows : 120;
		const visible = expanded ? all : all.slice(-limit);
		return {
			rows: visible,
			total: all.length,
			expanded: !!expanded,
			limited: visible.length < all.length
		};
	}
	//#endregion
	//#region src/presentation/westgard/westgard-xlsx-rows.ts
	function createWestgardXlsxRows(deps) {
		const detail = (item, index) => {
			const rules = [...new Set(item.f.rules || [])];
			const support = [...new Set(item.f.supportRules || [])].filter((rule) => !rules.includes(rule));
			const evidence = !rules.length && support.length > 0;
			const used = rules.length ? rules : support;
			return {
				index,
				date: deps.date(item.p.date),
				runId: item.p.runId || "—",
				staffCode: deps.staffCode(item.p) || "—",
				value: Number.isFinite(item.p.val) ? item.p.val : "",
				z: (Number(item.z) >= 0 ? "+" : "") + deps.number(item.z) + "s",
				verdict: evidence ? "Bằng chứng" : deps.verdict(item.f.level),
				style: item.f.level === "rej" ? "rej" : item.f.level === "warn" ? "warn" : "ok",
				ruleText: rules.join(", ") || (evidence ? "Bằng chứng: " + support.join(", ") : "—"),
				error: used.length ? deps.error(used) : "—"
			};
		};
		return Object.freeze({ detail });
	}
	//#endregion
	//#region src/presentation/westgard/westgard-xlsx-header.ts
	function createWestgardXlsxHeader(input) {
		const S = (v, s) => ({
			v,
			s
		});
		const pair = (l1, v1, l2, v2) => [
			S(l1, input.styles.LABEL),
			S("", input.styles.LABEL),
			S(v1, input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S(l2, input.styles.LABEL),
			S("", input.styles.LABEL),
			S(v2, input.styles.VAL),
			S("", input.styles.VAL)
		];
		const wide = (label, value) => [
			S(label, input.styles.LABEL),
			S("", input.styles.LABEL),
			S(value, input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL),
			S("", input.styles.VAL)
		];
		const brand = (input.labName || "BỆNH VIỆN / ĐƠN VỊ") + " · " + (input.department || "Khoa Xét nghiệm") + (input.address ? " · " + input.address : "") + "   ·   Xuất " + input.exportedAt + " · Người xuất: " + input.exportedBy;
		const rows = [
			[S(input.title, input.styles.TITLE)],
			[S(brand, input.styles.SUB)],
			[],
			pair("Xét nghiệm", input.testName + (input.testUnit ? " · " + input.testUnit : ""), "Thiết bị", input.machine),
			pair("Phiên bản app", (input.appName || "QC Lab") + " " + (input.appVersion || "dev"), "Phạm vi", "Lô/mức đang xem"),
			wide("Luật theo từng mức", input.withinRules || "Không có"),
			wide("Luật liên mức / lần chạy", input.acrossRules || "Không có"),
			wide("Dữ liệu chi tiết", "Chỉ gồm điểm cảnh báo/loại và điểm lịch sử cấu thành quy tắc; các điểm QC bình thường không được xuất.")
		];
		return {
			rows,
			merges: [
				"A1:I1",
				"A2:I2",
				"A4:B4",
				"C4:E4",
				"F4:G4",
				"H4:I4",
				"A5:B5",
				"C5:E5",
				"F5:G5",
				"H5:I5",
				"A6:B6",
				"C6:I6",
				"A7:B7",
				"C7:I7",
				"A8:B8",
				"C8:I8"
			],
			rowHeights: {
				1: 24,
				2: brand.length > 115 ? 29 : 15,
				4: 21,
				5: 21,
				6: Math.min(48, 18 + Math.ceil(rows[5][2].v.length / 105) * 12),
				7: Math.min(48, 18 + Math.ceil(rows[6][2].v.length / 105) * 12),
				8: Math.min(48, 18 + Math.ceil(rows[7][2].v.length / 105) * 12)
			}
		};
	}
	//#endregion
	//#region src/presentation/westgard/westgard-archived-groups.ts
	function westgardArchivedGroups(groups) {
		return (groups || []).filter((group) => group?.active === false || group?.status === "stopped").slice().sort((left, right) => String(right.stoppedAt || "").localeCompare(String(left.stoppedAt || "")) || String(left.name || "").localeCompare(String(right.name || ""), "vi"));
	}
	//#endregion
	//#region src/presentation/westgard/westgard-archived-multi-views.ts
	function westgardArchivedMultiViews(rows, lotPoints) {
		return (rows || []).map((row) => ({
			level: row.l.level,
			lot: row.lot.lotNo,
			mean: row.mean,
			sd: row.sd,
			pts: lotPoints(row.t, row.l.level, row.lot.lotNo),
			label: `M${row.l.level}·${row.lot.lotNo}`
		}));
	}
	//#endregion
	//#region src/presentation/westgard/westgard-archived-group-match.ts
	function westgardArchivedGroupMatches(group, query, searchText, lotById) {
		if (!query) return true;
		if (searchText(group?.name).includes(query)) return true;
		return (group?.lotIds || []).some((id) => {
			const lot = lotById(id);
			return !!lot && searchText(lot.lotNo).includes(query);
		});
	}
	//#endregion
	//#region src/presentation/westgard/westgard-archived-test-selection.ts
	function westgardArchivedTestSelection(entries, query, selectedId, deps) {
		const all = entries || [];
		const matched = all.filter((entry) => !query || deps.searchText(entry.t.name).includes(query) || deps.searchText(deps.testDisplayName(entry.t)).includes(query) || deps.searchText(deps.instrumentName(entry.t.instrumentId, entry.t.machine)).includes(query));
		const list = matched.length ? matched : all;
		const selected = matched.length && !matched.some((entry) => entry.t.id === selectedId) ? matched[0].t.id : !all.some((entry) => entry.t.id === selectedId) ? all[0]?.t.id : selectedId;
		return {
			matched,
			list,
			selected,
			entry: all.find((item) => item.t.id === selected) || all[0]
		};
	}
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
		const approvalTag = (approval, cancelled) => ({ cls: cancelled ? "none" : approval === "approved" ? "ok" : approval === "returned" ? "rej" : "warn" });
		const buttons = (action, context) => ({
			edit: !context.cancelled && context.approval !== "approved" && context.canWrite,
			escalate: context.canEscalate && context.canWrite,
			approve: context.isAdmin && context.workflowStage === "approval",
			returnForRevision: context.isAdmin && context.workflowStage === "approval",
			reopen: context.isAdmin && context.canReopen,
			cancel: context.isAdmin && !context.cancelled && context.approval !== "approved"
		});
		return Object.freeze({
			approvalTag,
			buttons
		});
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
	//#region src/presentation/nce/action-investigation-presentation.ts
	function actionInvestigationChoiceLabel(value, label) {
		return value === "not-needed" ? "Không cần" : value === "checked-ok" ? "Đạt" : value === "checked-abnormal" ? "Bất thường" : label;
	}
	function actionInvestigationStateClass(value) {
		return ["ok", "checked-ok"].includes(String(value)) ? "is-ok" : ["abnormal", "checked-abnormal"].includes(String(value)) ? "is-abnormal" : ["na", "not-needed"].includes(String(value)) ? "is-na" : "is-empty";
	}
	var actionInvestigationPresentation = Object.freeze({
		choiceLabel: actionInvestigationChoiceLabel,
		stateClass: actionInvestigationStateClass
	});
	//#endregion
	//#region src/presentation/nce/action-checklist-presentation.ts
	function createActionChecklistPresentation(deps) {
		const rowComplete = ({ status, note }) => {
			const normalized = String(status || "");
			const needsNote = [
				"abnormal",
				"na",
				"checked-abnormal"
			].includes(normalized);
			return !!deps.checkLabels[normalized] && (!needsNote || String(note || "").trim().length >= 3);
		};
		const checklist = (rows) => {
			const total = rows.length, done = rows.filter(rowComplete).length;
			return {
				done,
				total,
				complete: done === total
			};
		};
		const checklistChip = (rows) => {
			const progress = checklist(rows);
			return {
				cls: progress.complete ? "ok" : "warn",
				label: `Đã hoàn tất ${progress.done}/${progress.total}`
			};
		};
		const sectionChip = (missing) => {
			const items = Array.isArray(missing) ? missing : [];
			return items.length ? {
				cls: "warn",
				label: `Còn thiếu ${items.length} mục`,
				title: `Còn thiếu: ${items.join("; ")}`
			} : {
				cls: "ok",
				label: "Đã xong",
				title: "Không còn mục bắt buộc chưa hoàn thành"
			};
		};
		const effectivenessChip = (form) => {
			const effectiveness = deps.effectivenessStatus({
				...form,
				protocolVersion: form.protocolVersion || 3
			});
			return {
				cls: effectiveness.cls === "none" ? "none" : effectiveness.cls,
				label: effectiveness.complete ? effectiveness.label : form.effectivenessStatus === "ineffective" ? effectiveness.label : "Chưa đánh giá",
				title: effectiveness.label
			};
		};
		return Object.freeze({
			checklist,
			checklistChip,
			sectionChip,
			effectivenessChip
		});
	}
	//#endregion
	//#region src/presentation/nce/action-form-model.ts
	var ACTION_FORM_FIELDS = Object.freeze([
		[
			"aNceId",
			"nceId",
			"text"
		],
		[
			"aTest",
			"testId",
			"text"
		],
		[
			"aLevel",
			"level",
			"text"
		],
		[
			"aPointId",
			"pointId",
			"text"
		],
		[
			"aDate",
			"date",
			"date"
		],
		[
			"aRule",
			"rule",
			"text"
		],
		[
			"aEventSource",
			"eventSource",
			"text"
		],
		[
			"aProcessPhase",
			"processPhase",
			"text"
		],
		[
			"aErr",
			"errorType",
			"text"
		],
		[
			"aBy",
			"by",
			"text"
		],
		[
			"aDueDate",
			"dueDate",
			"date"
		],
		[
			"aContainment",
			"containmentStatus",
			"text"
		],
		[
			"aContainmentNote",
			"containmentNote",
			"text"
		],
		[
			"aCorrection",
			"correction",
			"text"
		],
		[
			"aRiskSeverity",
			"riskSeverity",
			"num"
		],
		[
			"aRiskOccurrence",
			"riskOccurrence",
			"num"
		],
		[
			"aRiskDetectability",
			"riskDetectability",
			"num"
		],
		[
			"aRiskLevel",
			"riskLevel",
			"text"
		],
		[
			"aRiskBasis",
			"riskBasis",
			"text"
		],
		[
			"aQcMaterial",
			"qcMaterialStatus",
			"text"
		],
		[
			"aQcMaterialNote",
			"qcMaterialNote",
			"text"
		],
		[
			"aInstrument",
			"instrumentStatus",
			"text"
		],
		[
			"aInstrumentNote",
			"instrumentNote",
			"text"
		],
		[
			"aReagent",
			"reagentStatus",
			"text"
		],
		[
			"aReagentNote",
			"reagentNote",
			"text"
		],
		[
			"aCalibration",
			"calibrationStatus",
			"text"
		],
		[
			"aCalibrationNote",
			"calibrationNote",
			"text"
		],
		[
			"aLotToLot",
			"lotToLotStatus",
			"text"
		],
		[
			"aLotToLotNote",
			"lotToLotNote",
			"text"
		],
		[
			"aCauseCategory",
			"causeCategory",
			"text"
		],
		[
			"aCause",
			"cause",
			"text"
		],
		[
			"aAct",
			"action",
			"text"
		],
		[
			"aActionCompletedDate",
			"actionCompletedDate",
			"date"
		],
		[
			"aBiasBefore",
			"biasBefore",
			"text"
		],
		[
			"aBiasAfter",
			"biasAfter",
			"text"
		],
		[
			"aReleaseStatus",
			"releaseStatus",
			"text"
		],
		[
			"aReleaseDate",
			"releaseDate",
			"date"
		],
		[
			"aReleaseBy",
			"releaseBy",
			"text"
		],
		[
			"aReleaseNote",
			"releaseNote",
			"text"
		],
		[
			"aPatientImpact",
			"patientImpact",
			"text"
		],
		[
			"aPatientAction",
			"patientAction",
			"text"
		],
		[
			"aEffectivenessStatus",
			"effectivenessStatus",
			"text"
		],
		[
			"aEffectivenessDate",
			"effectivenessDate",
			"date"
		],
		[
			"aEffectivenessNote",
			"effectivenessNote",
			"text"
		],
		[
			"aResidualSeverity",
			"residualSeverity",
			"num"
		],
		[
			"aResidualOccurrence",
			"residualOccurrence",
			"num"
		],
		[
			"aResidualDetectability",
			"residualDetectability",
			"num"
		],
		[
			"aResidualRiskLevel",
			"residualRiskLevel",
			"text"
		],
		[
			"aResidualRiskBasis",
			"residualRiskBasis",
			"text"
		]
	]);
	function createActionFormModel(deps) {
		const fields = deps.fields || ACTION_FORM_FIELDS;
		const sourceOptions = (options, qcBound, current) => qcBound || current === "iqc" ? [...options] : options.filter(([value]) => value !== "iqc");
		const defaultOpenSections = (editing, protocol) => {
			if (!editing) return /* @__PURE__ */ new Set(["immediate"]);
			const missing = protocol?.missingBySection || {};
			const open = new Set([
				"immediate",
				"risk",
				"check",
				"cause",
				"patient"
			].filter((key) => (missing[key] || []).length));
			if (!open.size && !deps.effectivenessComplete({
				...editing,
				protocolVersion: editing.protocolVersion || 2
			})) open.add("eff");
			return open;
		};
		const defaults = (tests, seed, currentUser) => {
			const initial = seed || {}, manual = !!initial.manual, firstTest = tests[0];
			const testId = manual ? "" : initial.testId || firstTest?.id || "";
			const test = tests.find((candidate) => candidate.id === testId);
			const levels = test ? deps.operationalLevels(test) : [];
			return {
				protocolVersion: 3,
				testId,
				level: manual ? "" : levels.some((item) => String(item.level) === String(initial.level)) ? initial.level : levels[0]?.level || "",
				lot: "",
				date: initial.date || deps.todayIso(),
				rule: initial.rule || "",
				errorType: initial.errorType || "",
				pointId: initial.pointId || "",
				by: currentUser ? currentUser.name || currentUser.username : "",
				dueDate: deps.dueDate(7),
				eventSource: manual ? "" : "iqc",
				processPhase: "exam",
				effectivenessStatus: "pending"
			};
		};
		const mergeDraft = (base, draft) => {
			if (!draft) return base;
			const output = { ...base };
			fields.forEach(([id, key, kind]) => {
				if (id in draft) output[key] = kind === "num" ? +draft[id] || 0 : draft[id];
			});
			return output;
		};
		const build = (editing, tests, seed, currentUser, draft) => mergeDraft(editing ? {
			...editing,
			effectivenessStatus: editing.effectivenessStatus || "pending"
		} : defaults(tests, seed, currentUser), draft);
		return Object.freeze({
			fields,
			sourceOptions,
			defaultOpenSections,
			defaults,
			mergeDraft,
			build
		});
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
	//#region src/presentation/report/report-search-values.ts
	function reportSearchValues(test, deps) {
		const levels = deps.operationalLevels(test) || [], panel = deps.panelForTest(test), lotGroup = deps.lotGroupForTest(test);
		return [
			deps.testLabel(test),
			test.name,
			test.machine,
			test.unit,
			panel?.name,
			lotGroup?.name,
			...levels.map((level) => level.lot)
		];
	}
	var reportSearchValuePresentation = Object.freeze({ values: reportSearchValues });
	//#endregion
	//#region src/presentation/report/report-action-icon.ts
	var REPORT_ACTION_ICON_PATHS = Object.freeze({ print: "<path d=\"M6 9V3h12v6\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\" rx=\"1\"/><path d=\"M18 12h.01\"/>" });
	function reportActionIcon(type) {
		return `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${REPORT_ACTION_ICON_PATHS[type] || ""}</svg>`;
	}
	var reportActionIconPresentation = Object.freeze({ icon: reportActionIcon });
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
		const effectivenessMissingKey = (action) => {
			if (Number(action.protocolVersion) >= 3 && !action.actionCompletedDate) return "actionCompletedDate";
			if (!action.effectivenessDate) return "effectivenessDate";
			if (String(action.effectivenessNote || "").trim().length < 5) return "effectivenessNote";
			const rerun = deps.needsRerun(action) ? deps.rerunStatus(action) : null;
			const earliest = [
				action.date,
				action.actionCompletedDate,
				action.releaseDate,
				rerun?.ok && rerun.point?.date
			].filter(Boolean).sort().pop();
			if (action.effectivenessDate > deps.todayIso() || earliest && action.effectivenessDate < earliest) return "effectivenessDate";
			if (action.effectivenessStatus === "effective" && Number(action.protocolVersion) >= 3) {
				if (!riskScale.includes(Number(action.residualSeverity))) return "residualSeverity";
				if (!riskScale.includes(Number(action.residualOccurrence))) return "residualOccurrence";
				if (!riskScale.includes(Number(action.residualDetectability))) return "residualDetectability";
				if (!has(actionLabels.risk, action.residualRiskLevel)) return "residualRiskLevel";
				if (String(action.residualRiskBasis || "").trim().length < 5) return "residualRiskBasis";
				const initial = actionRiskScore(action), residual = actionResidualRiskScore(action);
				if (initial && residual > initial) return "residualSeverity";
			}
			return "effectivenessNote";
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
			effectivenessMissingKey,
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
	//#region src/presentation/nce/action-review-messages.ts
	function actionApprovalReadinessMessage(readiness, afterAuth) {
		if (readiness.reason === "cancelled") return "Hồ sơ đã hủy không thể được duyệt.";
		if (readiness.reason === "unrecorded") return afterAuth ? "Chưa có hành động khắc phục thực tế để duyệt." : "Chưa có hành động khắc phục thực tế để duyệt. Hãy ghi hành động trước.";
		if (readiness.reason === "protocol") return (afterAuth ? "Phiếu điều tra không còn đủ điều kiện duyệt: " : "Chưa thể duyệt vì phiếu điều tra còn thiếu: ") + (readiness.missing || []).join(", ") + ".";
		if (readiness.reason === "rerun") return afterAuth ? "Kết quả QC chạy lại không còn hợp lệ." : "Chưa thể duyệt vì chưa có kết quả QC chạy lại được chấp nhận.";
		if (readiness.reason === "effectiveness") return afterAuth ? "Đánh giá hiệu lực không còn đủ điều kiện khép vòng." : "Chưa thể duyệt vì hành động chưa được đánh giá là có hiệu lực.";
		if (readiness.reason === "not-pending") return "Hồ sơ không còn ở trạng thái chờ duyệt.";
		if (readiness.reason === "non-independent") return afterAuth ? "Không thể duyệt hồ sơ do tài khoản này đã tham gia tạo hoặc chỉnh sửa nội dung." : "Người ghi nhận hành động không được tự duyệt chính hành động đó. Hãy đăng nhập bằng tài khoản quản trị độc lập.";
		return "Hồ sơ không còn đủ điều kiện duyệt.";
	}
	function actionReviewReadinessMessage(kind, readiness, afterAuth) {
		if (kind === "cancel") {
			if (readiness.reason === "cancelled") return afterAuth ? "" : "Hồ sơ này đã được hủy và đang được giữ lại trong nhật ký.";
			if (readiness.reason === "approved") return afterAuth ? "Không thể hủy hồ sơ đã duyệt." : "Không thể hủy hồ sơ đã duyệt. Nếu cần xử lý tiếp, hãy lập hồ sơ NCE mới.";
			if (readiness.reason === "follow-up") return afterAuth ? "Không thể hủy vì hồ sơ này vừa phát sinh một hồ sơ nối tiếp đang hoạt động." : `Không thể hủy ${readiness.action?.nceId || "hồ sơ này"} khi hồ sơ nối tiếp ${readiness.followUp?.nceId || readiness.action?.followUpNceId || ""} vẫn đang hoạt động. Hãy xử lý hoặc hủy hồ sơ nối tiếp trước.`;
		}
		if (kind === "return") {
			if (readiness.reason === "cancelled") return "Hồ sơ đã hủy không thể trả lại để chỉnh sửa.";
			if (readiness.reason === "not-pending") return "Hồ sơ không còn ở trạng thái chờ duyệt.";
		}
		return actionApprovalReadinessMessage(readiness, afterAuth);
	}
	var actionReviewMessages = Object.freeze({
		approval: actionApprovalReadinessMessage,
		review: actionReviewReadinessMessage
	});
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
	//#region src/application/nce/action-rerun-service.ts
	function createActionRerunService(deps) {
		const rerunMemo = /* @__PURE__ */ new Map(), pointIndexMemo = /* @__PURE__ */ new Map(), lotIndexMemo = /* @__PURE__ */ new Map();
		const invalidate = (testId) => {
			if (testId == null) {
				rerunMemo.clear();
				pointIndexMemo.clear();
				lotIndexMemo.clear();
				return;
			}
			pointIndexMemo.delete(testId);
			[...lotIndexMemo.keys()].forEach((key) => {
				if (key.startsWith(testId + "|")) lotIndexMemo.delete(key);
			});
			[...rerunMemo.keys()].forEach((key) => {
				if (rerunMemo.get(key)?.testId === testId) rerunMemo.delete(key);
			});
		};
		const pointIndex = (testId) => {
			const points = deps.pointsFor(testId) || null, hit = pointIndexMemo.get(testId);
			if (hit && hit.points === points && hit.len === (points ? points.length : -1)) return hit.index;
			const index = deps.pointIndex(points);
			pointIndexMemo.set(testId, {
				points,
				len: points ? points.length : -1,
				index
			});
			return index;
		};
		const point = (action) => action?.pointId ? pointIndex(String(action.testId || "")).get(action.pointId) || null : null;
		const lotPoints = (testId, level, lot) => {
			const points = deps.pointsFor(testId) || null, key = `${testId}|${level}|${lot || ""}`, hit = lotIndexMemo.get(key);
			if (hit && hit.points === points && hit.len === (points ? points.length : -1)) return hit.list;
			const list = deps.lotPoints(points, level, lot, deps.runNumber);
			lotIndexMemo.set(key, {
				points,
				len: points ? points.length : -1,
				list
			});
			return list;
		};
		const signature = (action, test) => [
			action.id,
			action.testId,
			action.pointId,
			Number(action.protocolVersion) || 0,
			action.actionCompletedDate || "",
			action.parentNceId || "",
			action.date || "",
			action.openedFromVoid ? 1 : 0,
			test?.decimalPlaces ?? "auto"
		].join("|");
		const compute = (action) => {
			const test = deps.testFor(action.testId), incident = point(action), needed = deps.needsRerun(action), gateDate = incident ? deps.gateDate(action, incident) : "";
			return deps.evaluate({
				action,
				needed,
				point: incident,
				gateDate,
				incidentRunNumber: incident ? deps.runNumber(incident) : 0,
				candidates: incident ? lotPoints(action.testId, incident.level, incident.lot || "") : [],
				runNumber: deps.runNumber,
				verdictFor: (id) => deps.verdictFor(test, id),
				formatValue: (value) => deps.formatValue(value, test),
				formatDate: deps.formatDate
			});
		};
		const status = (action) => {
			if (!action || !action.id) return compute(action || {});
			const points = deps.pointsFor(action.testId) || null, sig = signature(action, deps.testFor(action.testId)), hit = rerunMemo.get(action.id);
			if (hit && hit.sig === sig && hit.points === points && hit.len === (points ? points.length : -1)) return hit.result;
			const result = compute(action);
			rerunMemo.set(action.id, {
				sig,
				testId: action.testId,
				points,
				len: points ? points.length : -1,
				result
			});
			return result;
		};
		return Object.freeze({
			invalidate,
			pointIndex,
			point,
			lotPoints,
			status
		});
	}
	//#endregion
	//#region src/application/nce/action-point-index-service.ts
	function createActionPointIndexService(getActions) {
		let memo = {
			ref: null,
			len: -1,
			index: null
		};
		const index = () => {
			const actions = getActions() || [];
			if (memo.ref === actions && memo.len === actions.length && memo.index) return memo.index;
			const next = /* @__PURE__ */ new Map();
			actions.forEach((action) => {
				const key = action.pointId, items = next.get(key);
				if (items) items.push(action);
				else next.set(key, [action]);
			});
			memo = {
				ref: actions,
				len: actions.length,
				index: next
			};
			return next;
		};
		const forPoint = (pointId) => index().get(pointId) || [];
		const invalidate = () => {
			memo = {
				ref: null,
				len: -1,
				index: null
			};
		};
		return Object.freeze({
			index,
			forPoint,
			invalidate
		});
	}
	//#endregion
	//#region src/application/nce/action-current-issues.ts
	function createActionCurrentIssues(deps) {
		return () => {
			const output = [];
			const rank = {
				rej: 2,
				warn: 1,
				ok: 0
			};
			deps.operationalTests().forEach((test) => {
				const westgard = deps.activeWestgard(test);
				westgard.views.forEach((view) => {
					(view.pts || []).forEach((point) => {
						const finding = westgard.byPoint.get(point.id);
						if (!finding || finding.level === "ok" || deps.pointWorkflowComplete(point.id)) return;
						output.push({
							t: test,
							l: view.l,
							p: point,
							f: finding,
							rules: finding.rules
						});
					});
				});
			});
			return output.sort((left, right) => (rank[right.f.level] || 0) - (rank[left.f.level] || 0) || String(right.p.date || "").localeCompare(String(left.p.date || "")));
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
		const normalized = normalizeLoginLockoutState(lockout);
		return {
			currentUser: null,
			loginFails: normalized.fails,
			loginLockUntil: normalized.until
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
	root.qcPointRunNumber = qcPointRunNumber;
	root.qcCusumConfig = qcCusumConfig;
	root.normalizeSearchText = normalizeSearchText;
	root.qcLevelTargetValid = qcLevelTargetValid;
	root.qcLotMeanSd = qcLotMeanSd;
	root.qcLotTargetSnapshot = qcLotTargetSnapshot;
	root.reportLevelStatsService = createReportLevelStats(root.QCCore.stats);
	root.qcErrorDetail = createQcErrorDetail({
		errorType: (rules) => root.QCCore.errorType(rules),
		primaryRule: (rules) => root.QCCore.primaryErrorRule(rules),
		descriptions: root.QCCore.WG_RULE_DESCRIPTIONS
	});
	root.qcPlannedTarget = qcPlannedTarget;
	root.qcPointVoidVerdict = createQcPointVoidVerdict({
		configuredLot: (test, level) => (root.lvlCfg(test, level) || {}).lot || "",
		activeVerdict: (test, pointId) => root.activeWestgard(test).byPoint.get(pointId),
		parallelVerdict: (test, input, pointId) => root.parallelWestgard(test, input).byPoint.get(pointId)
	});
	root.qcLotGroupOperational = qcLotGroupOperational;
	root.qcDerivedIndex = createQcDerivedIndex({
		operationalGroup: qcLotGroupOperational,
		switchesLot: (transition) => root.transitionSwitchesLot(transition)
	});
	root.qcAcceptedLotPoints = createAcceptedLotPoints({
		pointTarget: root.QCCore.pointTarget,
		latestRules: root.QCCore.westgardLatestRulesFromZ
	});
	root.qcActiveWestgard = createActiveWestgard({
		single: root.QCCore.westgardByPoint,
		multi: root.QCCore.westgardMultiByPoint
	});
	root.qcCusumSeries = createCusumSeries(root.QCCore.cusumMovingAverage);
	root.qcParallelWestgard = createParallelWestgard(root.QCCore.westgardByPoint);
	root.qcEntryColumns = createQcEntryColumns({
		levels: (test) => root.operationalLevels(test),
		parallel: (test, level) => root.parallelLotForLevel(test, level)
	});
	root.qcEntryColumnPoints = selectEntryColumnPoints;
	root.syncCanon = syncCanon;
	root.syncedShape = syncedShape;
	root.syncJsonMap = syncJsonMap;
	root.mergeSyncArray = mergeSyncArray;
	root.mergeSyncBranch = mergeSyncBranch;
	root.uniqueSyncUsers = uniqueSyncUsers;
	var syncConfig = root.fbSyncMergeConfig;
	if (syncConfig) {
		root.syncSnapshot = createSyncSnapshot(syncConfig.top, syncJsonMap);
		root.syncStateMerge = createSyncStateMerge(syncConfig);
		root.syncUpdateBuilder = createSyncUpdateBuilder({
			...syncConfig,
			snapshot: root.syncSnapshot
		});
		root.syncFirstConnectMerge = createFirstConnectMerge({
			...syncConfig,
			merge: root.syncStateMerge,
			uniqueUsers: uniqueSyncUsers
		});
		root.syncHasContent = (source) => hasSyncContent(source, syncConfig.contentKeys);
	}
	root.syncRetryScheduler = createSyncRetryScheduler({
		setTimeout: (fn, delay) => globalThis.setTimeout(fn, delay),
		clearTimeout: (timer) => globalThis.clearTimeout(timer)
	});
	root.qcPreviousLotHistory = previousLotHistory;
	root.qcLotGroupLevels = lotGroupLevels;
	root.qcPointCache = createPointCacheService(() => state.data || {}, (point) => root.pointRunNo(point));
	root.qcNormalizeDuplicateRunIds = createRunIdNormalizer((point) => root.pointRunNo(point));
	root.qcNormalizePointLots = createPointLotNormalizer({
		id: () => root.uid(),
		today: () => root.isoToday(),
		normalizeRuns: (source) => root.qcNormalizeDuplicateRunIds?.(source)
	});
	root.qcLotLineage = qcLotLineage;
	root.qcLevelConfig = qcLevelConfig;
	root.qcOperationalAccess = createQcOperationalAccess({
		test: (test) => root.isOperationalTest(test),
		levels: (test) => root.operationalLevels(test),
		panel: (test) => root.operationalPanelForTest(test),
		group: (level) => root.operationalLotGroupForLevel(level),
		activePoints: (test, level, withIndex) => root.activeLotPoints(test, level, withIndex),
		display: (test) => root.testDisplayName(test)
	});
	root.qcParallelLotLookup = createParallelLotLookup({
		level: qcLevelConfig,
		panel: (test) => root.operationalPanelForTest(test),
		transitions: () => state.lotTransitions || [],
		lots: () => state.qcLots || [],
		target: (test, level, lotId, lotNo) => root.lotTargetSnapshot(test, level, lotId, lotNo)
	});
	root.westgardWorkerJobBuilder = createWestgardWorkerJob({
		globalRules: () => state.westgardRules || {},
		levels: (test) => root.operationalLevels(test),
		points: (testId) => state.data?.[testId] || []
	});
	root.westgardWorkerRevisionService = createWestgardWorkerRevisionService();
	root.westgardWorkerHydrate = hydrateWestgardWorkerResult;
	root.westgardWorkerPrewarmPlanner = createWestgardWorkerPrewarmPlanner(3e3);
	root.storageSerializePolicy = createStorageSerializePolicy(() => typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
	root.localSaveScheduler = createSaveScheduler({
		setTimeout: (fn, delay) => globalThis.setTimeout(fn, delay),
		clearTimeout: (timer) => globalThis.clearTimeout(timer),
		cancelIdle: typeof globalThis.cancelIdleCallback === "function" ? (handle) => globalThis.cancelIdleCallback(handle) : null
	});
	root.storageRetryDelay = storageRetryDelay;
	root.saveDerivedTestIds = saveDerivedTestIds;
	root.saveCommandPolicy = saveCommandPlan;
	root.localStorageLoadService = createLocalStorageLoadService({
		read: () => localStorage.getItem("qclab"),
		adoptEmpty: () => {
			localLoadStatus = "missing";
			if (mem) state = mem;
			ensureShape();
			const errors = root.QCCore.validateStateInvariants(state);
			if (errors.length) {
				startupProblem = {
					raw: "",
					message: errors.join("\n")
				};
				return false;
			}
			return true;
		},
		adopt: (value) => adoptValidatedState(value),
		accepted: () => {
			localLoadStatus = "local";
		},
		rejectedRead: () => {
			startupProblem = {
				raw: "",
				message: "TrÃ¬nh duyá»‡t khÃ´ng cho phÃ©p Ä‘á»c vÃ¹ng lÆ°u trá»¯ cá»¥c bá»™."
			};
		},
		rejectedInvalid: (raw, error) => {
			localLoadStatus = "invalid";
			quarantineCorruptLocal(raw, error);
			startupProblem = {
				raw,
				message: error && error.message ? error.message : "Dá»¯ liá»‡u cá»¥c bá»™ khÃ´ng há»£p lá»‡."
			};
		}
	});
	root.localStorageSnapshotWriter = createLocalStorageSnapshotWriter({
		set: (key, value) => localStorage.setItem(key, value),
		remove: (key) => localStorage.removeItem(key),
		saved: (quiet) => {
			if (!quiet) markSaved("Ä‘Ã£ lÆ°u cá»¥c bá»™", "LÃºc " + saveTime());
		},
		failed: (quiet) => {
			if (!quiet) markSaved("lá»—i lÆ°u cá»¥c bá»™", "Kiá»ƒm tra dung lÆ°á»£ng trÃ¬nh duyá»‡t");
		}
	});
	root.partitionedSnapshotWriter = createPartitionedSnapshotWriter({
		plan: (input) => {
			let plan;
			if (root.planPartitionWrite) plan = root.planPartitionWrite({
				fullDirty: input.fullDirty,
				streak: input.streak,
				lastFull: input.lastFull,
				now: input.now,
				maxIncrementals: input.maxIncrementals,
				maxMs: input.maxMs,
				dirtyTestIds: input.dirtyTestIds
			});
			else {
				const full = input.fullDirty || input.streak >= input.maxIncrementals || input.now - input.lastFull >= input.maxMs;
				plan = {
					dirtyTestIds: full ? null : input.dirtyTestIds,
					streak: full ? 0 : input.streak + 1,
					lastFull: full ? input.now : input.lastFull
				};
			}
			lsIncrementalStreak = plan.streak;
			lsLastFullSaveAt = plan.lastFull;
			lsFullDirty = false;
			lsDirtyTestIds.clear();
			return plan.dirtyTestIds;
		},
		defer: () => {
			lsDirty = true;
			scheduleLocalSave();
		},
		writePartitioned: (value, slot, dirtyTestIds) => partitionWrite.catch(() => false).then(() => LocalStore.writePartitioned(value, slot, { dirtyTestIds })),
		setPending: (pending) => {
			partitionWrite = pending;
		},
		completed: (result, input) => {
			partitionSlot = String(result.slot || "");
			lsSaveFailures = 0;
			try {
				localStorage.setItem("qclab_boot", JSON.stringify({
					format: 1,
					slot: result.slot,
					savedAt: result.savedAt,
					shell: result.shell
				}));
				localStorage.setItem("qclab_saved_at", String(result.savedAt));
				localStorage.removeItem("qclab");
			} catch {}
			if (!sigmaDraftNeedsCloud()) clearSigmaDraftThrough(input.localDraftStamp);
			if (!input.quiet) markSaved("Ä‘Ã£ lÆ°u cá»¥c bá»™", "IndexedDB phÃ¢n vÃ¹ng Â· LÃºc " + saveTime());
		},
		failed: (input) => {
			lsDirty = true;
			lsFullDirty = true;
			lsSaveFailures++;
			scheduleLocalRetry();
			if (!input.quiet) markSaved("lá»—i lÆ°u cá»¥c bá»™", "KhÃ´ng thá»ƒ ghi IndexedDB phÃ¢n vÃ¹ng");
		}
	});
	root.saveService = createSaveService({
		plan: (options) => saveCommandPlan(options),
		invalidate: (ids) => {
			if (ids === null) return;
			if (ids.length) [...new Set(ids.filter(Boolean))].forEach(clearDerivedForTest);
			else clearDerived();
		},
		captureState: () => {
			mem = state;
		},
		touchCloud: () => {
			state._ts = Date.now();
			state._client = fb.clientId;
		},
		prepareStorage: (plan, options) => {
			if (plan.storageTestIds.length) plan.storageTestIds.forEach((id) => lsDirtyTestIds.add(String(id)));
			else if (plan.fullDirty) lsFullDirty = true;
			if (plan.persistSigmaDraft) persistSigmaDraft(options.sigmaTestId);
		},
		beginLocalSave: () => {
			lsRevision++;
			lsDirty = true;
			markSaved("Ä‘ang lÆ°u", "...");
			scheduleLocalSave();
		},
		scheduleCloud: () => {
			fb.dirty = true;
			scheduleFbPush();
		}
	});
	root.firebaseLocalStoreService = createFirebaseLocalStoreService({
		persistSnapshot: () => {
			if (typeof persistLocalSnapshot !== "function") return false;
			persistLocalSnapshot({
				changed: true,
				quiet: true
			});
			return true;
		},
		serialize: (value) => JSON.stringify(value),
		writeLocal: (raw) => localStorage.setItem("qclab", raw),
		mirror: (raw) => {
			if (typeof mirrorIndexedDb === "function") mirrorIndexedDb(raw);
		}
	});
	if (typeof root.fbDisconnect === "function") root.firebaseDisconnectService = createFirebaseDisconnectService({
		stopPolling: () => fbStopPull(),
		cancelPendingPush: () => {
			if (fbSaveT) {
				clearTimeout(fbSaveT);
				fbSaveT = null;
			}
		},
		resetRetry: () => fbResetRetry(),
		detachListener: () => {
			if (fb.ref) fb.ref.off();
		},
		resetSession: (clearAuthUser) => {
			if (root.firebaseDisconnectedState) {
				Object.assign(fb, root.firebaseDisconnectedState(fb, clearAuthUser));
				return;
			}
			fb.ready = false;
			fb.initialized = false;
			fb.ref = null;
			fb.synced = null;
			fb.seenSig = null;
			if (clearAuthUser) fb.authUser = null;
		}
	});
	if (typeof root.fbFlushPush === "function") root.firebasePushService = createFirebasePushService({
		canPush: () => fbCanWrite() && fbNetworkOnline(),
		auditMaySync: () => fbAuditMaySync(state, "Nhật ký cục bộ"),
		prepare: () => {
			state._ts = Date.now();
			state._client = fb.clientId;
			const current = fbClone(state), { payload } = fbBuildUpdate(current);
			return {
				current,
				payload,
				draftStamp: typeof sigmaDraftStamp === "function" ? sigmaDraftStamp() : 0
			};
		},
		noChanges: (draftStamp) => {
			fb.dirty = false;
			fbResetRetry();
			if (typeof clearSigmaDraftThrough === "function") clearSigmaDraftThrough(draftStamp);
			markSaved("đã đồng bộ", "Lúc " + saveTime());
		},
		beforeWrite: () => markSaved("đang đồng bộ", "Firebase"),
		update: (ref, payload) => ref.update(payload),
		succeeded: (current, draftStamp) => {
			fb.synced = current;
			fb.dirty = false;
			fbResetRetry();
			markSaved("đã đồng bộ", "Lúc " + saveTime());
			if (typeof clearSigmaDraftThrough === "function") clearSigmaDraftThrough(draftStamp);
			fbStoreLocal();
		},
		failed: () => {
			fb.dirty = true;
			markSaved("lỗi đồng bộ", "Dữ liệu cục bộ vẫn còn · sẽ tự thử lại");
			fbScheduleRetry();
		}
	});
	if (typeof root.syncNow === "function") root.firebaseFullSyncService = createFirebaseFullSyncService({
		canSync: () => fbCanWrite(),
		auditMaySync: () => fbAuditMaySync(state, "Nhật ký cục bộ"),
		prepare: () => {
			mem = state;
			state._ts = Date.now();
			state._client = fb.clientId;
			return {
				payload: fbClone(state),
				draftStamp: typeof sigmaDraftStamp === "function" ? sigmaDraftStamp() : 0
			};
		},
		beforeWrite: () => markSaved("đang đồng bộ", "Firebase"),
		write: (ref, payload) => ref.set(payload),
		succeeded: (payload, draftStamp) => {
			fb.synced = payload;
			fb.dirty = false;
			markSaved("đã đồng bộ", "Lúc " + saveTime());
			if (typeof clearSigmaDraftThrough === "function") clearSigmaDraftThrough(draftStamp);
			fbStoreLocal();
		},
		failed: () => markSaved("lỗi đồng bộ", "Dữ liệu cục bộ vẫn còn")
	});
	if (typeof root.scheduleFbPush === "function") root.firebasePushScheduler = createFirebasePushScheduler({
		canWrite: () => fbCanWrite(),
		networkOnline: () => fbNetworkOnline(),
		resetRetry: () => fbResetRetry(),
		clearTimer: (timer) => clearTimeout(timer),
		setTimer: (fn, delay) => setTimeout(fn, delay),
		flush: () => fbFlushPush(),
		offline: () => markSaved("cục bộ", "Mạng ngoại tuyến · sẽ tự đồng bộ khi có mạng"),
		queued: () => markSaved("chờ đồng bộ", "Firebase")
	});
	if (typeof root.fbHandleValue === "function") root.firebaseEmptySnapshotService = createFirebaseEmptySnapshotService({
		setReady: () => fbSetReady(),
		clearSynced: () => {
			fb.synced = null;
		},
		connected: () => setCloudStatus(fbStatusLabel(), true),
		schedulePush: () => scheduleFbPush(),
		readyWithoutPush: () => markSaved("đám mây", "Sẵn sàng đồng bộ · " + fbDataPath())
	});
	if (typeof root.fbHandleValue === "function") root.firebaseOwnSnapshotService = createFirebaseOwnSnapshotService({
		setReady: () => fbSetReady(),
		setBaseline: (remote) => {
			fb.synced = remote;
		},
		clearDirty: () => {
			fb.dirty = false;
		},
		resetRetry: () => fbResetRetry(),
		connected: () => setCloudStatus(fbStatusLabel(), true),
		synchronized: () => markSaved("đã đồng bộ", "Lúc " + saveTime())
	});
	if (typeof root.fbHandleValue === "function") root.firebaseInvalidSnapshotService = createFirebaseInvalidSnapshotService({
		setReady: () => fbSetReady(),
		report: (firstError) => markSaved("dữ liệu đám mây không hợp lệ", firstError + " · " + fbDataPath())
	});
	if (typeof root.fbRejectBrokenAudit === "function") root.firebaseAuditRejectionService = createFirebaseAuditRejectionService({
		disconnect: () => fbDisconnect(),
		disconnected: () => setCloudStatus("Đã ngắt đồng bộ để bảo vệ nhật ký", false),
		report: (detail) => markSaved("audit không hợp lệ", detail)
	});
	if (typeof root.applyRemoteRender === "function") root.firebaseRemoteRenderService = createFirebaseRemoteRenderService({
		loggedIn: () => typeof currentUser !== "undefined" && !!currentUser,
		focusLogin: () => {
			if (typeof focusLoginField === "function") try {
				focusLoginField();
			} catch {}
		},
		unsafe: () => remoteRenderUnsafe(),
		clearPending: () => clearTimeout(fb.pendingRenderT),
		defer: (fn, delay) => {
			fb.pendingRenderT = setTimeout(fn, delay);
		},
		received: () => markSaved("đã nhận đồng bộ", "Lúc " + saveTime()),
		deferred: () => markSaved("có dữ liệu mới", "Sẽ hiển thị khi bạn xong thao tác"),
		rerender: () => rerender()
	});
	if (typeof root.initFirebase === "function") root.firebaseSessionStartService = createFirebaseSessionStartService({
		ensureApp: (config) => ensureFirebaseApp(config),
		persistAuth: () => firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL),
		currentAuthUser: () => new Promise((resolve) => {
			let off = null;
			off = firebase.auth().onAuthStateChanged((user) => {
				if (off) off();
				resolve(user || null);
			}, () => resolve(null));
		}),
		signInAnonymously: async () => {
			const credential = await firebase.auth().signInAnonymously();
			return credential && credential.user || firebase.auth().currentUser || null;
		},
		unauthenticated: () => {
			fbDisconnect(true);
			setCloudStatus("Cần đăng nhập Firebase", false);
			markSaved("cục bộ", "Firebase chưa xác thực");
		},
		setAuthUser: (user) => {
			fb.authUser = user;
		},
		disconnect: () => fbDisconnect(),
		createRef: () => firebase.database().ref(fbDataPath()),
		setRef: (ref) => {
			fb.ref = ref;
		},
		subscribe: (ref) => ref.on("value", (snapshot) => {
			fbHandleValue(snapshot.val());
		}, (error) => {
			fbDisconnect();
			setCloudStatus(error && error.message && error.message.indexOf("permission_denied") >= 0 ? "Chưa được cấp quyền Firebase" : "Lỗi đọc Firebase", false);
			markSaved("lỗi kết nối", error && error.message ? error.message : "Firebase");
		}),
		startPull: () => fbStartPull(),
		loading: () => {
			setCloudStatus("Đang tải dữ liệu Firebase · " + fbDataPath(), true);
			markSaved("đang tải dữ liệu", "Firebase");
		},
		failed: (error) => {
			fbDisconnect();
			setCloudStatus("Lỗi xác thực/kết nối Firebase", false);
			markSaved("lỗi kết nối", error && error.message ? error.message : "Firebase");
		}
	});
	if (typeof root.fbHandleValue === "function") root.firebaseMergeCommitService = createFirebaseMergeCommitService({
		state: () => state,
		replaceState: (value) => {
			state = value;
		},
		merge: (base, mergeFirstConnect, local, remote) => root.firebaseMergeApplication ? root.firebaseMergeApplication(base, mergeFirstConnect, local, remote) : base ? fbMerge(local, remote, base) : mergeFirstConnect ? fbFirstConnectMerge(local, remote) : remote,
		relinkAudit: (value) => {
			if (typeof auditRelinkChain === "function" && Array.isArray(value.activity)) value.activity = auditRelinkChain(value.activity, value.activityAnchor || "");
		},
		clearDerived: () => clearDerived(),
		ensureShape: () => ensureShape(),
		invariantErrors: (value) => root.QCCore.validateStateInvariants(value),
		rejected: (previous, hadLocalChanges, error) => {
			state = previous;
			fb.dirty = hadLocalChanges;
			fbSetReady();
			markSaved("dữ liệu đồng bộ không hợp lệ", error);
		},
		accepted: (merged, remote) => {
			mem = merged;
			fb.synced = fbClone(remote);
			fbStoreLocal();
			if (typeof currentUser !== "undefined" && currentUser) {
				const user = (merged.users || []).find((x) => x.id === currentUser.id) || (merged.users || []).find((x) => x.username === currentUser.username);
				if (user) currentUser = user;
			}
			if (!merged.users.length) ensureAdmin();
			try {
				renderBrand();
			} catch {}
			fbSetReady();
			setCloudStatus(fbStatusLabel(), true);
			applyRemoteRender();
			if (fbHasLocalChanges()) scheduleFbPush();
		}
	});
	if (typeof root.fbHandleValue === "function" && typeof confirmDialog === "function") root.firebaseConflictDialogService = createFirebaseConflictDialogService(confirmDialog);
	if (typeof root.setCloudStatus === "function") root.firebaseCloudStatusPresentation = createFirebaseCloudStatusPresentation((id) => document.getElementById(id));
	if (typeof root.markSaved === "function") root.firebaseSaveStatusService = createFirebaseSaveStatusService((id) => document.getElementById(id));
	if (typeof root.remoteRenderUnsafe === "function") root.firebaseRemoteRenderSafetyService = createFirebaseRemoteRenderSafetyService({
		modalOpen: () => {
			const modal = document.getElementById("modalRoot");
			return !!(modal && modal.children && modal.children.length);
		},
		editingFieldFocused: () => {
			const active = document.activeElement, main = document.getElementById("main");
			return !!(active && main && main.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
		}
	});
	if (typeof root.ensureFirebaseApp === "function") root.firebaseAppService = createFirebaseAppService({
		sdk: () => firebase,
		signature: (config) => fbConfigSig(config)
	});
	if (typeof root.getDeployFbCfg === "function") root.firebaseConfigSourceService = createFirebaseConfigSourceService({
		cloud: () => window.QCLAB_CLOUD,
		readStored: () => localStorage.getItem("qclab_fb")
	});
	root.firebaseReadyState = firebaseReadyState;
	root.firebaseConfigParser = parseFirebaseConfig;
	root.firebaseConfigValidator = validateFirebaseConfig;
	root.settingsStorageBytesText = storageBytesText;
	root.settingsStorageUsageText = storageUsageText;
	root.settingsBrandProfile = createBrandProfile((value, limit) => root.QCCore.cleanText(value, limit));
	root.settingsFirebaseAclHelp = firebaseAclHelp;
	root.settingsFirebaseRulesText = firebaseRulesText;
	root.settingsFirebaseGuideHtml = firebaseGuideHtml;
	root.backupReminderService = createBackupReminder({ now: () => Date.now() });
	root.lisQueuePresentation = createLisQueuePresentation({
		test: (id) => (state.tests || []).find((test) => test.id === id),
		formatTestValue: (test, value) => root.fmtTestValue(test, value),
		format: (value, decimals) => root.fmt(value, decimals),
		escape: (value) => root.esc(value),
		escapeAttribute: (value) => root.escAttr(value),
		quoteJs: (value) => root.jsq(value),
		formatDateTime: (value) => root.formatDateTimeVN(value),
		testDisplayName: (test) => typeof root.testDisplayName === "function" ? root.testDisplayName(test) : "",
		button: (label, action, variant) => root.btn(label, action, variant),
		emptyState: (title, message, action) => root.emptyState(title, message, action),
		modalCloseButton: (action) => root.modalCloseButton(action)
	});
	root.lisSettingsService = createLisSettingsService((value) => root.lisNormalizeGatewayUrl(value));
	root.labProfileService = createLabProfileService((value, limit) => root.QCCore.cleanText(value, limit), (value) => root.settingsBrandProfile(value));
	root.firebaseSettingsService = createFirebaseSettingsService((value) => root.firebaseConfigParser(value));
	root.settingsBrandPreviewHtml = createBrandPreviewHtml((value) => root.esc(value), (value) => root.escAttr(value));
	root.settingsUnitProfileHtml = createUnitProfileHtml({
		escapeAttribute: (value) => root.escAttr(value),
		button: (label, action, variant) => root.btn(label, action, variant)
	});
	root.settingsBrandPanelHtml = createBrandPanelHtml({
		escapeAttribute: (value) => root.escAttr(value),
		button: (label, action, variant, title, options) => root.btn(label, action, variant, title, options)
	});
	root.settingsAdminToolsHtml = createAdminToolsHtml((label, action, variant) => root.btn(label, action, variant));
	root.settingsFirebaseRulesPanelHtml = createFirebaseRulesPanelHtml({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant)
	});
	root.settingsLisGatewayPanelHtml = createLisGatewayPanelHtml({
		escape: (value) => root.esc(value),
		escapeAttribute: (value) => root.escAttr(value),
		button: (label, action, variant) => root.btn(label, action, variant)
	});
	root.settingsFirebaseConnectionPanelHtml = createFirebaseConnectionPanelHtml({
		escape: (value) => root.esc(value),
		escapeAttribute: (value) => root.escAttr(value),
		button: (label, action, variant) => root.btn(label, action, variant)
	});
	root.settingsPageLayoutHtml = createSettingsPageLayoutHtml((title, subtitle) => root.headOnly(title, subtitle));
	if (typeof LocalStore !== "undefined") root.indexedDbOpenService = createIndexedDbOpenService({ indexedDb: () => typeof indexedDB === "undefined" ? null : indexedDB });
	if (root.indexedDbOpenService) root.indexedDbRecordService = createIndexedDbRecordService({ open: () => root.indexedDbOpenService.open() });
	root.partitionedIndexedDbWriteService = createPartitionedIndexedDbWriteService({
		supported: () => typeof indexedDB !== "undefined",
		key: (slot, type, id) => root.localPartitionHelpers ? root.localPartitionHelpers.key(slot, type, id) : "partition:" + slot + ":" + type + (id == null ? "" : ":" + id),
		draft: (state, currentSlot, dirtyTestIds, manifest) => root.localPartitionTransaction.draft(state, currentSlot, dirtyTestIds, manifest),
		finalize: (state, manifest, slotManifest, draft) => root.localPartitionTransaction.finalize(state, manifest, slotManifest, draft)
	});
	root.partitionedIndexedDbReadService = createPartitionedIndexedDbReadService({
		supported: () => typeof indexedDB !== "undefined",
		key: (slot, type, id) => root.localPartitionHelpers ? root.localPartitionHelpers.key(slot, type, id) : "partition:" + slot + ":" + type + (id == null ? "" : ":" + id),
		slots: (preferred) => root.localRecoverySlots ? root.localRecoverySlots(preferred) : [preferred, preferred === "a" ? "b" : "a"],
		recover: (slot, manifest, shell, rows) => root.localPartitionRecovery(slot, manifest, shell, rows)
	});
	root.indexedDbClearService = createIndexedDbClearService({
		supported: () => typeof indexedDB !== "undefined",
		key: (slot, type, id) => root.localPartitionHelpers ? root.localPartitionHelpers.key(slot, type, id) : "partition:" + slot + ":" + type + (id == null ? "" : ":" + id),
		keys: (manifests) => root.localClearKeys(manifests)
	});
	root.passwordPolicyError = passwordPolicyError;
	root.passwordChangeError = passwordChangeError;
	root.pbkdf2PasswordService = createPbkdf2PasswordService({
		crypto: () => globalThis.crypto || null,
		textEncoder: () => new TextEncoder()
	});
	root.isPbkdf2PasswordHash = isPbkdf2PasswordHash;
	root.passwordHashNeedsUpgrade = passwordHashNeedsUpgrade;
	root.legacyPasswordHashService = createLegacyPasswordHashService({
		crypto: () => globalThis.crypto || null,
		textEncoder: () => new TextEncoder()
	});
	root.loginLockoutPolicy = createLoginLockoutPolicy();
	root.blankAppStateFactory = (users) => createBlankAppState({
		users,
		teaRegistryVersion: Number(root.teaReferenceSchemaVersion) || 3,
		schemaVersion: root.QCCore.STATE_SCHEMA_VERSION,
		westgardDefaults: Object.fromEntries(root.QCCore.WG_RULES.map((rule) => [rule, root.QCCore.WG_DEFAULT_ON.has(rule)]))
	});
	root.defaultAdminUserFactory = (id, passHash) => createDefaultAdminUser({
		id,
		passHash
	});
	root.newUserValidationError = newUserValidationError;
	root.selectUserPermissions = selectUserPermissions;
	root.activityAuditFilter = createActivityAuditFilter({
		searchText: (value) => globalThis.searchText(value),
		isoDate: (value) => globalThis.isoDate(value),
		formatDateTime: (value) => globalThis.formatDateTimeVN(value),
		roleLabel: (value) => globalThis.roleLabel(value)
	});
	root.activityAuditPageHtml = createActivityAuditPageHtml();
	root.activityAuditPagination = activityAuditPagination;
	root.activityAuditCsv = createActivityAuditCsv({
		formatDateTime: (value) => globalThis.formatDateTimeVN(value),
		roleLabel: (value) => globalThis.roleLabel(value)
	});
	root.updateActivityAuditDateRange = updateActivityAuditDateRange;
	root.activityAuditFilterState = activityAuditFilterState;
	root.activityAuditPageSizes = ACTIVITY_AUDIT_PAGE_SIZES;
	root.activityAuditArchiveWindow = activityAuditArchiveWindow;
	root.userListModel = userListModel;
	root.userRowHtml = createUserRowHtml();
	root.usersPageHtml = createUsersPageHtml();
	root.reagentSelectOptionsHtml = createReagentSelectOptionsHtml();
	root.reagentResultHtml = createReagentResultHtml();
	root.reagentPairRowHtml = createReagentPairRowHtml();
	if (typeof StateStorageLegacy !== "undefined") root.storageBootService = createStorageBootService({
		partitionedSupported: () => typeof LocalStore !== "undefined" && LocalStore.supported(),
		readBootRecord: () => localStorage.getItem("qclab_boot"),
		discardBootRecord: () => localStorage.removeItem("qclab_boot"),
		activatePartitionShell: (shell, slot) => {
			adoptValidatedState(shell);
			partitionSlot = slot;
			localLoadStatus = "partition-shell";
			storageHydrationPromise = hydratePartitionedState();
		},
		loadLegacy: () => root.localStorageLoadService.load(),
		localLoadStatus: () => localLoadStatus,
		recoverPendingSigmaDraft,
		restoreFromIndexedDb
	});
	if (typeof StateStorageLegacy !== "undefined") root.indexedDbRecoveryService = createIndexedDbRecoveryService({
		supported: () => typeof LocalStore !== "undefined" && LocalStore.supported(),
		readPartitioned: () => typeof LocalStore.readPartitioned === "function" ? LocalStore.readPartitioned() : Promise.resolve(null),
		readLegacy: () => LocalStore.read(),
		adopt: (value) => adoptValidatedState(value),
		acceptPartitioned: (record) => {
			mem = state;
			partitionSlot = String(record.slot || "");
			localLoadStatus = "partitioned";
			startupProblem = null;
			try {
				localStorage.setItem("qclab_boot", JSON.stringify({
					format: 1,
					slot: record.slot,
					savedAt: record.savedAt,
					shell: {
						...state,
						data: {}
					}
				}));
			} catch {}
		},
		acceptLegacy: () => {
			mem = state;
			localLoadStatus = "indexeddb";
			startupProblem = null;
			try {
				localStorage.setItem("qclab", JSON.stringify(state));
			} catch {}
		},
		reportFailure: (kind, error, raw = "") => {
			const message = kind === "partitioned" ? "Dá»¯ liá»‡u phÃ¢n vÃ¹ng IndexedDB khÃ´ng há»£p lá»‡." : "Dá»¯ liá»‡u IndexedDB khÃ´ng há»£p lá»‡.";
			startupProblem = {
				raw,
				message: error && error.message ? error.message : message
			};
			if (raw) startupProblem.raw = raw;
		}
	});
	if (typeof StateStorageLegacy !== "undefined") root.partitionHydrationService = createPartitionHydrationService({
		read: () => LocalStore.readPartitioned(),
		adopt: (value) => adoptValidatedState(value),
		recoverPendingSigmaDraft,
		accept: (record) => {
			mem = state;
			partitionSlot = String(record.slot || "");
			localLoadStatus = "partitioned";
			clearDerived();
			startupProblem = null;
			if (lsDirty) scheduleLocalSave();
		},
		reportFailure: (error) => {
			startupProblem = {
				raw: "",
				message: error && error.message ? error.message : "KhÃ´ng thá»ƒ táº£i cÃ¡c phÃ¢n vÃ¹ng dá»¯ liá»‡u QC."
			};
		}
	});
	root.indexedDbMirrorService = createIndexedDbMirrorService({
		supported: () => typeof LocalStore !== "undefined" && LocalStore.supported(),
		writeSerialized: (raw) => typeof LocalStore.writeSerialized === "function" ? LocalStore.writeSerialized(raw) : null,
		writeState: (value) => LocalStore.write(value),
		failed: () => {
			lsDirty = true;
			lsSaveFailures++;
			scheduleLocalRetry();
		}
	});
	root.planPartitionWrite = planPartitionWrite;
	root.qcValueFormat = createQcValueFormat();
	root.qcStaffIdentity = createQcStaffIdentity();
	root.qcDateFormat = createQcDateFormat();
	root.qcLotTargetHistory = createLotTargetHistory(() => uid());
	root.teaAnalyteMetaService = createTeaAnalyteMeta(() => typeof TEA_ANALYTE_CATALOG === "undefined" ? [] : TEA_ANALYTE_CATALOG);
	root.qcLevelReconciliation = createQcLevelReconciliation();
	root.qcRangeLimitRepair = createRangeLimitRepair((mean, sd, k) => root.QCCore.limitsFromTarget(mean, sd, k));
	root.qcConfigurationRelations = reconcileConfigurationRelations;
	root.qcTestConfiguration = normalizeTestConfiguration;
	root.qcStateFoundation = normalizeStateFoundation;
	root.qcStateLifecycle = normalizeStateLifecycle;
	root.csvDownload = createCsvDownload({
		createBlob: (text) => new Blob([text], { type: "text/csv;charset=utf-8" }),
		createUrl: (blob) => URL.createObjectURL(blob),
		revokeUrl: (url) => URL.revokeObjectURL(url),
		download: (url, name) => {
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = name;
			anchor.click();
		},
		schedule: (work, delay) => globalThis.setTimeout(work, delay)
	});
	root.cssTokenPixel = (token, fallback) => cssTokenPixel(token, fallback, (key) => typeof getComputedStyle === "function" && typeof document !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--" + key) : "");
	root.blobDownload = createBlobDownload({
		createUrl: (blob) => URL.createObjectURL(blob),
		revokeUrl: (url) => URL.revokeObjectURL(url),
		download: (url, name) => {
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = name;
			anchor.click();
		},
		schedule: (work, delay) => globalThis.setTimeout(work, delay)
	});
	root.qcReportCsvRows = createQcReportCsvRows({
		test: (id) => (state.tests || []).find((test) => test.id === id),
		lab: () => state.lab || {},
		meta: (kind) => root.exportMetaRows(kind),
		range: (start, end) => root.reportRangeText(start, end),
		testName: (test) => root.testDisplayName(test),
		tea: (test) => root.sgTea(test),
		teaSource: (test) => root.sgTeaSource(test),
		teaLabel: (source) => root.sgTeaLabel(source),
		teaReference: (test) => root.sgTeaRefText(test),
		levels: (test) => root.operationalLevels(test),
		previous: (test, level) => root.previousLotSeries(test, level),
		rows: root.qcReportRowsService,
		westgard: (test) => root.activeWestgard(test),
		staff: (point) => root.pointStaff(point),
		date: (value) => root.vnDate(value),
		number: (value, decimals) => root.fmt(value, decimals),
		state: (value) => root.stateName(value),
		error: (rules) => root.errorType(rules),
		stats: (points, mean, tea) => root.reportLevelStats(points, mean, tea),
		levelLabel: (test, level, lot) => root.actionLevelShort(test, level, lot),
		workflow: (action) => root.actionWorkflowStatus(action),
		rerun: (action) => root.actionRerunStatus(action),
		protocol: (action) => root.actionProtocolSummary(action),
		approval: (action) => root.actionApprovalLabel(action)
	});
	var legacyDerivedCacheState = root.legacyDerivedCacheState;
	if (legacyDerivedCacheState) root.derivedCacheInvalidation = createDerivedCacheInvalidation({
		...legacyDerivedCacheState,
		pointCache: () => root.qcPointCache,
		westgardCache: () => root.westgardMemoCache,
		acceptedCache: () => root.qcAcceptedMemoCache,
		cusumCache: () => root.qcCusumMemoCache,
		invalidateWestgardWorker: (testId) => root.invalidateWestgardWorker(testId),
		invalidateActionCaches: (testId) => root.invalidateActionCaches(testId)
	});
	root.qcBasicFormat = createBasicFormat();
	root.westgardRulePolicy = createWestgardRulePolicy({
		rules: root.QCCore.WG_RULES,
		enabled: (rule) => root.QCCore.ruleEnabled(state.westgardRules, rule),
		levels: (test) => root.operationalLevels(test),
		resolveAction: root.QCCore.resolveRuleAction,
		resolveScope: root.QCCore.resolveRuleScope,
		onInScope: root.QCCore.ruleOnInScope,
		verdict: root.QCCore.ruleVerdictLevel
	});
	root.westgardMemoCache = createWestgardMemoCache();
	root.qcCusumMemoCache = createCusumMemoCache();
	root.qcAcceptedMemoCache = createAcceptedMemoCache();
	root.westgardRuleSettings = createWestgardRuleSettings({
		defaults: root.QCCore.WG_DEFAULT_ON ? Object.fromEntries(root.QCCore.WG_RULES.map((rule) => [rule, root.QCCore.WG_DEFAULT_ON.has(rule)])) : {},
		getState: () => state,
		ruleEnabled: (rules, rule) => root.QCCore.ruleEnabled(rules, rule),
		requireWrite: () => requireWrite(),
		save: () => save({}),
		rerender: () => rerender()
	});
	root.qcRangeCandidateService = createRangeCandidateService({
		tests: () => state.tests || [],
		actions: () => state.actions || [],
		levelConfig: (test, level) => lvlCfg(test, level),
		points: (test, level) => globalThis.operationalLotPoints(test, level),
		westgard: (test) => globalThis.activeWestgard(test),
		pointZ: (point, mean, sd) => root.QCCore.pointZ(point, mean, sd),
		stats: (values) => root.QCCore.stats(values),
		actionCancelled: (action) => typeof globalThis.actionCancelled === "function" && globalThis.actionCancelled(action),
		systematicRules: root.QCCore.WG_SE_RULES,
		limitsFromTarget: (mean, sd, k) => root.QCCore.limitsFromTarget(mean, sd, k)
	});
	root.qcRangeSafetyGate = rangeSafetyGate;
	root.qcRangeBiasEvaluation = rangeBiasEvaluation;
	root.csvCellService = csvCell;
	root.reportExportHelpers = reportExportHelpers;
	root.actionReportSummary = createActionReportSummary({
		labels: () => typeof globalThis.ACTION_LABELS === "object" ? globalThis.ACTION_LABELS : {},
		excerpt: (value, max) => root.reportExportHelpers.nceExcerpt(value, max)
	});
	root.actionReportModel = createActionReportModel({
		labels: () => typeof globalThis.ACTION_LABELS === "object" ? globalThis.ACTION_LABELS : {},
		rerunStatus: (action) => typeof globalThis.actionRerunStatus === "function" ? globalThis.actionRerunStatus(action) : { label: "" },
		workflowStatus: (action) => typeof globalThis.actionWorkflowStatus === "function" ? globalThis.actionWorkflowStatus(action) : { label: "Chưa hoàn tất" },
		effectivenessStatus: (action) => typeof globalThis.actionEffectivenessStatus === "function" ? globalThis.actionEffectivenessStatus(action) : { label: "Chưa đánh giá" },
		riskScore: (action) => typeof globalThis.actionRiskScore === "function" ? globalThis.actionRiskScore(action) : 0,
		residualRiskScore: (action) => typeof globalThis.actionResidualRiskScore === "function" ? globalThis.actionResidualRiskScore(action) : 0,
		eventDate: (action) => typeof globalThis.actionEventDate === "function" ? globalThis.actionEventDate(action) : action.date,
		approvalLabel: (action) => typeof globalThis.actionApprovalLabel === "function" ? globalThis.actionApprovalLabel(action) : action.approvalStatus || "Chờ duyệt",
		pointValue: (point, test) => globalThis.dataIoQcPoint(point, test),
		formatDate: (value) => vnDate(value),
		formatDateTime: (value) => formatDateTimeVN(value),
		testName: (test) => globalThis.testDisplayName(test),
		levelShort: (test, level, lot) => globalThis.actionLevelShort(test, level, lot)
	});
	root.nceCsvRow = createActionCsvRow({
		test: (id) => (state.tests || []).find((test) => test.id === id),
		workflow: (action) => root.actionWorkflowStatus(action),
		rerun: (action) => root.actionRerunStatus(action),
		labels: () => globalThis.ACTION_LABELS || {},
		date: (value) => root.vnDate(value),
		dateTime: (value) => root.formatDateTimeVN(value),
		eventDate: (action) => root.actionEventDate(action),
		testName: (test) => root.testDisplayName(test),
		level: (test, level, lot) => root.actionLevelShort(test, level, lot),
		protocol: (action) => root.actionProtocolSummary(action),
		risk: (action) => root.actionRiskScore(action),
		residualRisk: (action) => root.actionResidualRiskScore(action),
		approval: (action) => root.actionApprovalLabel(action)
	});
	root.sigmaCanvasFactory = createSigmaCanvas({
		scale: (width, height, value) => root.sigmaExportPixelRatio(width, height, value),
		create: () => document.createElement("canvas")
	});
	root.sigmaChartRenderer = createSigmaChartRenderer({
		levels: (row) => root.sigmaLevelsOf(row),
		canvas: (width, height, scale) => root.sigmaCanvas(width, height, scale),
		font: (weight, token, fallback) => root.dataIoCanvasFont(weight, token, fallback),
		zone: (sigma) => root.sgZone(sigma),
		bytes: (url) => root.sigmaDataURLBytes(url)
	});
	root.sigmaMdcRenderer = createSigmaMdcRenderer({
		items: (rows) => root.sigmaMdcItems(rows),
		canvas: (width, height, scale) => root.sigmaCanvas(width, height, scale),
		font: (weight, token, fallback) => root.dataIoCanvasFont(weight, token, fallback),
		zone: (sigma) => root.sgZone(sigma),
		placements: (items, x, y, ctx, bounds) => root.sigmaMdcLabelPlacements(items, x, y, ctx, bounds),
		bytes: (url) => root.sigmaDataURLBytes(url)
	});
	root.renameSigmaXlsxSheet = (bytes, sheetName) => renameXlsxSheet(bytes, sheetName, {
		escape: (value) => root.XlsxCore.escX(value),
		bytes: (value) => root.XlsxCore.u8(value),
		zip: (files) => root.XlsxCore.zip(files)
	});
	root.xlsxCells = createXlsxCells((value) => root.XlsxCore.escX(value));
	root.xlsxZip = createXlsxZip((value) => new TextEncoder().encode(value));
	root.xlsxPeriodNumber = xlsxPeriodNumber;
	root.xlsxDrawing = createXlsxDrawing((pixels) => root.XlsxCore.emu(pixels));
	root.sigmaXlsxStyles = sigmaXlsxStyles;
	root.reportXlsxStyles = reportXlsxStyles;
	root.reportXlsxDrawing = createReportXlsxDrawing((pixels) => root.XlsxCore.emu(pixels));
	root.reportXlsxSheet = (doc) => {
		const core = root.XlsxCore;
		return createReportXlsxSheet({
			columns: core.COLS,
			text: core.cellStr,
			number: core.cellNum
		})(doc);
	};
	root.reportXlsxBuild = (doc) => {
		const core = root.XlsxCore;
		return createReportXlsxBuilder({
			bytes: core.u8,
			escape: core.escX,
			styles: () => root.reportXlsxStyles(),
			sheet: (item) => root.reportXlsxSheet(item),
			drawing: (images) => root.reportXlsxDrawing(images),
			zip: core.zip
		})(doc);
	};
	root.reportXlsxHeader = createReportXlsxHeader;
	root.reportHeaderPresentation = reportHeaderPresentation;
	root.reportNceAppendixPresentation = createReportNceAppendix({ detail: (action, test) => globalThis.reportNceDetailHtml(action, test) });
	root.reportNceDetailHtmlPresentation = createReportNceDetailHtml({
		model: (action, test) => globalThis.reportNceModel(action, test),
		field: (label, value, wide) => globalThis.reportNceDetailField(label, value, wide),
		escape: (value) => typeof globalThis.esc === "function" ? globalThis.esc(value) : String(value ?? "")
	});
	root.reportSignBlock = reportSignBlock;
	root.reportLockListHtmlPresentation = createReportLockListHtml({
		sorted: (locks) => root.ReportPeriodPresentation.sortedLocks(locks),
		month: (ym) => root.monthVN(ym),
		dateTime: (value) => root.formatDateTimeVN(value),
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.reportUnlockReason = createReportUnlockReason({ clean: (value, maxLength) => root.QCCore.cleanText(value, maxLength) });
	root.reportLockPicker = reportLockPicker;
	root.reportLockPanelHtmlPresentation = createReportLockPanelHtml({ button: (label, action, variant, title, options) => root.btn(label, action, variant, title, options) });
	root.reportPageHtml = createReportPageHtml({
		head: (title, subtitle) => root.headOnly(title, subtitle),
		empty: (title, message, action) => root.emptyState(title, message, action),
		button: (label, action, variant, title, options) => root.btn(label, action, variant, title, options),
		escape: (value) => root.esc(value),
		escapeAttr: (value) => root.escAttr(value),
		label: (test, tests) => root.testSelectLabel(test, tests),
		rangePicker: (start, end) => root.reportRangePicker(start, end),
		actionIcon: (type) => root.reportActionIcon(type)
	});
	root.reportRangePickerHtml = createReportRangePickerHtml({ dateBox: (id, value, placeholder, attrs) => root.dateBox(id, value, placeholder, attrs) });
	root.ActionCurrentIssues = createActionCurrentIssues({
		operationalTests: () => typeof globalThis.operationalTests === "function" ? globalThis.operationalTests() : [],
		activeWestgard: (test) => globalThis.activeWestgard(test),
		pointWorkflowComplete: (pointId) => typeof globalThis.pointWorkflowComplete === "function" ? globalThis.pointWorkflowComplete(pointId) : false
	});
	root.ActionReviewMessages = actionReviewMessages;
	root.dashboardLoadingPresentation = createDashboardLoading({
		escape: (value) => typeof globalThis.esc === "function" ? globalThis.esc(value) : String(value ?? ""),
		topUserBox: () => typeof globalThis.topUserBox === "function" ? globalThis.topUserBox() : ""
	});
	root.dashboardStatusFilter = createDashboardStatusFilter();
	root.dashboardExpiringLots = dashboardExpiringLots;
	root.dashboardShiftStatus = dashboardShiftStatus;
	root.dashboardKpis = dashboardKpis;
	root.reportQcFormat = createReportQcFormat({
		testValue: (test, value) => typeof globalThis.fmtTestValue === "function" ? globalThis.fmtTestValue(test, value) : globalThis.fmt(value, 3),
		testStat: (test, value) => typeof globalThis.fmtTestStat === "function" ? globalThis.fmtTestStat(test, value) : globalThis.fmt(value, 3),
		pointValue: (point, test) => typeof globalThis.fmtPointValue === "function" ? globalThis.fmtPointValue(point, test) : globalThis.fmt(point && point.val, Math.max(2, Number(point && point.valueDecimals) || 0)),
		format: (value, decimals) => globalThis.fmt(value, decimals)
	});
	root.qcRangeTea = createRangeTea({
		teaBySource: (test, source, target) => globalThis.sgTeaBySource(test, source, target),
		teaSource: (test) => globalThis.sgTeaSource(test)
	});
	root.entryRowsWindowTs = entryRowsWindow;
	root.entryLotLabelsTs = entryLotLabels;
	root.entrySheetMonthPart = entrySheetMonthPart;
	root.entrySheetMonthValue = entrySheetMonthValue;
	root.entryTreeState = createEntryTreeState({
		activeWestgard: (test) => globalThis.activeWestgard(test),
		operationalLevels: (test) => globalThis.operationalLevels(test),
		pointsForLot: (testId, level, lot) => globalThis.pointsForLot(testId, level, lot)
	});
	root.entrySheetNavigation = createEntrySheetNavigation({
		date: (element) => String(element.dataset.focusDate || ""),
		run: (element) => String(element.dataset.focusRun || ""),
		level: (element) => String(element.dataset.focusLevel || "")
	});
	root.entrySheetInputOrder = createEntrySheetInputOrder({
		date: (element) => String(element.dataset.focusDate || ""),
		run: (element) => Number(element.dataset.focusRun || 0),
		level: (element) => Number(element.dataset.focusLevel || 0)
	});
	root.entryTreeGroupState = entryTreeGroupState;
	root.entryTreeNavigation = createEntryTreeNavigation();
	root.entrySheetFocus = createEntrySheetFocus((element) => !!element.classList.contains("empty"));
	root.entryColumnConfig = createEntryColumnConfig({
		levelConfig: qcLevelConfig,
		parallelLot: (test, level) => root.qcParallelLotLookup(test, level)
	});
	root.entryRangePreset = entryRangePreset;
	root.entryTreeCollapsePreference = {
		read: readEntryTreeCollapsed,
		write: writeEntryTreeCollapsed
	};
	root.entryTreeVisibility = entryTreeVisibility;
	root.entryTreeKeyCommand = entryTreeKeyCommand;
	root.entrySelectionState = entrySelectionState;
	root.entryExpandedTablesToggle = entryExpandedTablesToggle;
	root.entryPointContext = entryPointContext;
	root.entryVoidNceChoice = entryVoidNceChoice;
	root.entryVoidReasonValid = entryVoidReasonValid;
	root.entryRecordErrorMessage = entryRecordErrorMessage;
	root.entrySaveFeedback = entrySaveFeedback;
	root.entryExtraRunRequest = entryExtraRunRequest;
	root.entryDateNoteFeedback = entryDateNoteFeedback;
	root.entryDateNoteErrorMessage = entryDateNoteErrorMessage;
	root.entryDateRangeInput = createEntryDateRangeInput((value) => root.parseVN(value));
	root.westgardUiState = westgardUiState;
	root.westgardModeTabs = westgardModeTabs;
	root.westgardTestSearch = createWestgardTestSearch({
		text: (value) => root.searchText(value),
		label: (test) => root.testSelectLabel(test),
		id: (test) => test.id
	});
	root.westgardMultiViews = createWestgardMultiViews({
		levels: (test) => root.operationalLevels(test),
		points: (test, level) => root.operationalLotPoints(test, level),
		previous: (test, level) => root.previousLotSeries(test, level),
		build: (input) => root.WestgardViewModel.buildMultiViews(input)
	});
	root.westgardCusumLevels = createWestgardCusumLevels({
		levels: (test) => root.operationalLevels(test),
		points: (test, level) => root.operationalLotPoints(test, level)
	});
	root.westgardPointRowsHtml = createWestgardPointRowsHtml({
		verdictLabel: (level) => root.qcVerdictLabel(level),
		errorParts: (rules) => root.errorTypeDetailParts(rules),
		escape: (value) => root.esc(value),
		date: (value) => root.vnDate(value),
		testValue: (test, value) => root.fmtTestValue(test, value),
		format: (value) => root.fmt(value),
		referenceIcon: () => root.icoRefArrow()
	});
	root.westgardRowsControl = createWestgardRowsControl({
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.westgardCusumPageHtml = createWestgardCusumPageHtml({
		empty: (title, message, action) => root.emptyState(title, message, action),
		button: (label, action, variant) => root.btn(label, action, variant),
		escape: (value) => root.esc(value),
		testValue: (test, value) => root.fmtTestValue(test, value),
		format: (value, decimals) => root.fmt(value, decimals),
		quote: (value) => root.jsq(value)
	});
	root.westgardLotBlockHtml = createWestgardLotBlockHtml({
		testValue: (test, value) => root.fmtTestValue(test, value),
		empty: (title, message) => root.emptyState(title, message),
		buildRows: (test, level, lotNo, mean, sd, points) => {
			const wgP = root.QCCore.westgardByPoint(points, mean, sd, (rule) => root.testRuleOnWithin(test, rule)), rows = root.WestgardViewModel.buildPointRows({
				points,
				verdicts: wgP.F.map((f) => ({
					rules: f.rules,
					supportRules: f.supportRules,
					level: root.ruleResultLevel(test, f.rules)
				})),
				zs: wgP.zs,
				mean,
				sd
			}), key = `lot:${test.id}|${level}|${lotNo}`;
			return {
				key,
				view: root.wgRowsWindow(rows, key)
			};
		},
		pointRows: (rows, test) => root.westgardPointRowsHtml(rows, test),
		rowsControl: (view, key) => root.westgardRowsControl(view, key, 120)
	});
	root.westgardRuleGuideHtml = createWestgardRuleGuideHtml({
		escape: (value) => root.esc(value),
		referenceIcon: () => root.icoRefArrow()
	});
	root.westgardRuleTogglesHtml = createWestgardRuleTogglesHtml({ button: (label, action, variant) => root.btn(label, action, variant) });
	root.westgardExportActionsHtml = createWestgardExportActionsHtml({
		button: (label, action, variant, title) => root.btn(label, action, variant, title),
		downloadIcon: () => root.icoDownload(),
		printIcon: () => root.icoPrint()
	});
	root.dashboardStatusTabsHtml = createDashboardStatusTabsHtml({ matches: (item, key) => root.dashboardStatusFilter.matches(item, key) });
	root.dashboardExpiringLotsHtml = createDashboardExpiringLotsHtml({ escape: (value) => root.esc(value) });
	root.dashboardQcFollowupItemHtml = createDashboardQcFollowupItemHtml({
		escape: (value) => root.esc(value),
		testLabel: (test) => root.testDisplayName(test),
		date: (value) => root.vnDate(value),
		pointValue: (point, test) => root.fmtPointValue(point, test),
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.dashboardMissingTargetItemHtml = createDashboardMissingTargetItemHtml({
		escape: (value) => root.esc(value),
		testLabel: (test) => root.testDisplayName(test),
		button: (label, action, variant) => root.btn(label, action, variant)
	});
	root.dashboardOverdueActionItemHtml = createDashboardOverdueActionItemHtml({
		escape: (value) => root.esc(value),
		testLabel: (test) => root.testDisplayName(test),
		date: (value) => root.vnDate(value),
		button: (label, action, variant) => root.btn(label, action, variant)
	});
	root.dashboardTestStatusTags = dashboardTestStatusTags;
	root.dashboardLevelPillHtml = createDashboardLevelPillHtml({
		escape: (value) => root.esc(value),
		format: (value) => root.fmt(value)
	});
	root.dashboardTestRank = dashboardTestRank;
	root.dashboardLatestPointText = createDashboardLatestPointText({
		date: (value) => root.vnDate(value),
		pointValue: (point, test) => root.fmtPointValue(point, test)
	});
	root.dashboardCompletion = dashboardCompletion;
	root.dashboardFollowupPanelHtml = dashboardFollowupPanelHtml;
	root.dashboardTestSearchText = createDashboardTestSearchText({
		normalize: (value) => root.searchText(value),
		label: (test) => root.testDisplayName(test)
	});
	root.dashboardLatestPoint = createDashboardLatestPoint({ runNumber: (point) => root.pointRunNo(point) });
	root.dashboardKpisHtml = dashboardKpisHtml;
	root.dashboardProgressHtml = dashboardProgressHtml;
	root.dashboardTestListHtml = dashboardTestListHtml;
	root.dashboardPageHtml = createDashboardPageHtml();
	root.actionGuideContent = createActionGuideContent({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant)
	});
	root.actionPageHtml = createActionPageHtml();
	root.actionSideChipsHtml = createActionSideChipsHtml({ escape: (value) => root.esc(value) });
	root.actionDetailCheckHtml = createActionDetailCheckHtml({ escape: (value) => root.esc(value) });
	root.actionEvidenceTimelinePresentation = createActionEvidenceTimelineHtml({ escape: (value) => root.esc(value) });
	root.actionReviewButtonsHtml = createActionReviewButtonsHtml({ button: (label, action, variant, title) => root.btn(label, action, variant, title) });
	root.actionRerunEvidencePresentation = createActionRerunEvidenceHtml({
		escape: (value) => root.esc(value),
		pointValue: (point, test) => root.fmtPointValue(point, test),
		date: (value) => root.vnDate(value),
		button: (label, action, variant, title) => root.btn(label, action, variant, title),
		quote: (value) => root.jsq(value)
	});
	root.actionIssueRowPresentation = createActionIssueRowHtml({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.actionOpenIssuePresentation = createActionOpenIssueHtml({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant)
	});
	root.actionIssueGroupPresentation = createActionIssueGroupHtml({ escape: (value) => root.esc(value) });
	root.actionLogRowPresentation = createActionLogRowHtml({ escape: (value) => root.esc(value) });
	root.actionApprovalTagPresentation = createActionApprovalTagHtml({ escape: (value) => root.esc(value) });
	root.actionDetailMetaHtml = createActionDetailMetaHtml({ escape: (value) => root.esc(value) });
	root.actionCancelledAlertHtml = createActionCancelledAlertHtml({ escape: (value) => root.esc(value) });
	root.actionLegacyDetailHtml = createActionLegacyDetailHtml({ escape: (value) => root.esc(value) });
	root.actionContainmentDetailHtml = createActionContainmentDetailHtml({ escape: (value) => root.esc(value) });
	root.actionInspectionDetailsHtml = createActionInspectionDetailsHtml();
	root.actionPatientImpactHtml = createActionPatientImpactHtml({ escape: (value) => root.esc(value) });
	root.actionCauseDetailHtml = createActionCauseDetailHtml({ escape: (value) => root.esc(value) });
	root.actionEffectivenessDetailHtml = createActionEffectivenessDetailHtml({ escape: (value) => root.esc(value) });
	root.actionLogPanelHtml = createActionLogPanelHtml({
		button: (label, action, variant) => root.btn(label, action, variant),
		emptyState: (title, text) => root.emptyState(title, text)
	});
	root.actionIssuesPanelHtml = actionIssuesPanelHtml;
	root.manageToolbarPresentation = createManageToolbarHtml({
		escape: (value) => root.esc(value),
		escapeAttr: (value) => root.escAttr(value),
		button: (label, action, variant) => root.btn(label, action, variant)
	});
	root.managePageHtml = createManagePageHtml();
	root.manageShellPresentation = createManageShellHtml({ escape: (value) => root.esc(value) });
	root.manageInstrumentRowPresentation = createManageInstrumentRowHtml({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.managePanelRowPresentation = createManagePanelRowHtml({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.manageLotRowPresentation = createManageLotRowHtml({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.manageLotGroupCardPresentation = createManageLotGroupCardHtml({ escape: (value) => root.esc(value) });
	root.manageTransitionRowPresentation = createManageTransitionRowHtml({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.teaSourceRegistryPresentation = createTeaSourceRegistryHtml({
		escape: (value) => root.esc(value),
		escapeAttr: (value) => root.escAttr(value)
	});
	root.manageHistoryRowPresentation = createManageHistoryRowHtml({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.manageSearchPlaceholderPresentation = manageSearchPlaceholder;
	root.manageAssayRowPresentation = createManageAssayRowHtml({
		escape: (value) => root.esc(value),
		button: (label, action, variant) => root.btn(label, action, variant),
		quote: (value) => root.jsq(value)
	});
	root.teaReferenceStatusPresentation = teaReferenceStatusHtml;
	root.manageTransitionStatusPresentation = manageTransitionStatus;
	root.manageLotStatusPresentation = createManageLotStatus({ daysToExpiry: (value) => root.daysToExp(value) });
	root.sameIdSetPresentation = sameIdSet;
	root.manageInstrumentNamePresentation = manageInstrumentName;
	root.manageLotLabelPresentation = manageLotLabel;
	root.managePanelNamePresentation = managePanelName;
	root.manageLotGroupLabelsPresentation = manageLotGroupLabels;
	root.sameNormalizedTextPresentation = createSameNormalizedText({ normalize: (value) => root.searchText(value) });
	root.groupsOfLotPresentation = groupsOfLot;
	root.targetGroupLotsPresentation = targetGroupLots;
	root.targetGroupLabelPresentation = targetGroupLabel;
	root.targetGroupStatusSuffixPresentation = targetGroupStatusSuffix;
	root.targetPanelLabelPresentation = targetPanelLabel;
	root.targetPanelTestsPresentation = targetPanelTests;
	root.targetPanelOptionsPresentation = targetPanelOptionsHtml;
	root.targetGroupOptionsPresentation = targetGroupOptionsHtml;
	root.targetSelectionPresentation = targetSelection;
	root.targetLevelSelectionPresentation = targetLevelSelection;
	root.historySearchValuesPresentation = historySearchValues;
	root.teaLabBasisLabelPresentation = teaLabBasisLabel;
	root.targetLevelLotsPresentation = targetLevelLots;
	root.targetSearchValuesPresentation = targetSearchValues;
	root.historyAssayOptionsPresentation = historyAssayOptionsHtml;
	root.historyAssaySelectionPresentation = historyAssaySelection;
	root.historyVisibleRowsPresentation = historyVisibleRows;
	root.historyRowSortPresentation = sortHistoryRows;
	root.historySummaryPresentation = historySummary;
	root.teaPositiveNumberPresentation = teaPositiveNumber;
	root.teaReferenceExternalChangedPresentation = teaReferenceExternalChanged;
	root.teaSourceRegistryItemsPresentation = teaSourceRegistryItems;
	root.manageSearchMatchPresentation = manageSearchMatch;
	root.lotTransitionTargetNumberPresentation = lotTransitionTargetNumber;
	root.historyPeriodLabelPresentation = historyPeriodLabel;
	root.targetRowStatePresentation = targetRowState;
	root.targetMatrixStatsPresentation = targetMatrixStats;
	root.targetMatrixItemsPresentation = targetMatrixItems;
	root.targetLevelTabsPresentation = targetLevelTabsHtml;
	root.targetSummaryPresentation = targetSummaryHtml;
	root.targetMatrixRowPresentation = targetMatrixRowHtml;
	root.historyRowsPresentation = historyRows;
	root.historySelectorPresentation = historySelectorHtml;
	root.targetSelectorPresentation = targetSelectorHtml;
	root.historyTablePresentation = historyTableHtml;
	root.targetEmptyStatePresentation = targetEmptyState;
	root.targetMatrixTablePresentation = targetMatrixTableHtml;
	root.targetMatrixActionsPresentation = targetMatrixActionsHtml;
	root.targetPrerequisitePresentation = targetPrerequisite;
	root.targetLevelToolbarPresentation = targetLevelToolbarHtml;
	root.teaReferenceKindPresentation = teaReferenceKind;
	root.teaReferenceRowActionsPresentation = teaReferenceRowActions;
	root.teaReferenceSortPresentation = sortTeaReferences;
	root.teaReferenceNamingTitlePresentation = teaReferenceNamingTitle;
	root.teaReferenceEmptyStatePresentation = teaReferenceEmptyState;
	root.teaReferenceLabValuePresentation = teaReferenceLabValueHtml;
	root.teaReferenceInputValuePresentation = teaReferenceInputValue;
	root.xlsxEscape = xlsxEscape;
	root.reportXlsxStyleIds = REPORT_XLSX_STYLE_IDS;
	root.xlsxColumns = XLSX_COLUMNS;
	root.xlsxEmu = xlsxEmu;
	root.xlsxUtf8 = xlsxUtf8;
	root.xlsxRound = xlsxRound;
	root.sigmaReportMetricService = sigmaReportMetric;
	root.sigmaMdcItemsService = (rows) => sigmaMdcItems(rows, globalThis.sigmaLevelsOf);
	root.sigmaMdcLabelPlacementService = (items, X, Y, ctx, bounds) => sigmaMdcLabelPlacements(items, X, Y, ctx, bounds, globalThis.sigmaMdcPeriodLabel);
	root.sigmaExportPixelRatioService = sigmaExportPixelRatio;
	root.sigmaReportRowsService = createSigmaReportRows({
		trackedTests: () => typeof globalThis.sgTrackedTests === "function" ? globalThis.sgTrackedTests() : [],
		visibleLevels: (test) => typeof globalThis.sgVisibleLevels === "function" ? globalThis.sgVisibleLevels(test) : (test.levels || []).map((level) => level.level),
		rows: (test, data, levels) => globalThis.sgRows(test, data, levels),
		data: (id) => globalThis.sgData(id),
		teaSource: (test) => typeof globalThis.sgTeaSource === "function" ? globalThis.sgTeaSource(test) : test.teaSource || "ricos",
		entryTea: (test, entry) => typeof globalThis.sgEntryTea === "function" ? globalThis.sgEntryTea(test, entry) : globalThis.sgTea(test),
		testName: (test) => globalThis.testDisplayName(test),
		periodLabel: (value) => globalThis.vnPeriod(value),
		metric: (value) => root.sigmaReportMetricService(value),
		teaMeta: (test, source) => typeof globalThis.sgTeaSourceMeta === "function" ? globalThis.sgTeaSourceMeta(test, source) : {},
		teaLabel: (source) => typeof globalThis.sgTeaLabel === "function" ? globalThis.sgTeaLabel(source) : source,
		teaReference: (test) => typeof globalThis.sgTeaRefText === "function" ? globalThis.sgTeaRefText(test) : ""
	});
	root.qcReportRowsService = createQcReportRows({
		westgardByPoint: (points, mean, sd, on) => root.QCCore.westgardByPoint(points, mean, sd, on),
		ruleOnWithin: (test, rule) => globalThis.testRuleOnWithin(test, rule),
		resultLevel: (test, rules) => globalThis.ruleResultLevel(test, rules),
		points: (test, level) => globalThis.operationalLotPoints(test, level),
		actions: () => state.actions || [],
		eventDate: (action) => typeof globalThis.actionEventDate === "function" ? globalThis.actionEventDate(action) : action.date
	});
	root.qcReportContext = createQcReportContext({
		tea: (test) => typeof globalThis.sgTea === "function" ? globalThis.sgTea(test) : test.tea || 0,
		teaSource: (test) => typeof globalThis.sgTeaSource === "function" ? globalThis.sgTeaSource(test) : "",
		teaLabel: (source) => typeof globalThis.sgTeaLabel === "function" ? globalThis.sgTeaLabel(source) : "Ricos / Westgard biological variation",
		levels: (test) => globalThis.operationalLevels(test),
		points: (test, level) => globalThis.operationalLotPoints(test, level)
	});
	root.sigmaDataUrlBytes = (value) => dataUrlBytes(value, (encoded) => atob(encoded));
	root.sigmaExportMetaService = createSigmaExportMeta({
		app: () => typeof window !== "undefined" ? window.QCLAB_APP || {} : {},
		rules: () => state.westgardRules || {},
		formatDate: (value) => vnDate(value),
		periodLabel: (value) => globalThis.sigmaPeriodLabel(value)
	});
	root.exportMetaRowsService = createExportMetaRows({
		app: () => typeof window !== "undefined" ? window.QCLAB_APP || { version: "dev" } : { version: "dev" },
		rules: () => state.westgardRules || {},
		userName: () => userName(),
		formatDateTime: (value) => formatDateTimeVN(value),
		now: () => (/* @__PURE__ */ new Date()).toISOString()
	});
	root.qcExportValueFormat = createQcExportValueFormat({
		testValue: (test, value, number) => typeof globalThis.fmtTestValue === "function" ? globalThis.fmtTestValue(test, value) : number(value, 3),
		testStat: (test, value, number) => typeof globalThis.fmtTestStat === "function" ? globalThis.fmtTestStat(test, value) : number(value, 3),
		pointValue: (point, test, number) => typeof globalThis.fmtPointValue === "function" ? globalThis.fmtPointValue(point, test) : number(point && point.val, Math.max(2, Number(point && point.valueDecimals) || 0)),
		number: (value, decimals) => fmt(value, decimals)
	});
	root.sigmaCanvasFont = createCanvasFont((token, fallback) => {
		if (typeof getComputedStyle === "function" && typeof document !== "undefined") {
			const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--" + token));
			if (Number.isFinite(value)) return value;
		}
		return fallback;
	});
	root.reportLabels = createReportLabels((value) => vnDate(value));
	root.reportSelection = createReportSelection();
	root.reportSearch = createReportSearch();
	root.sigmaMuTraceService = createSigmaMuTrace({
		escape: (value) => typeof globalThis.esc === "function" ? globalThis.esc(value) : String(value ?? ""),
		formatDate: (value) => vnDate(value)
	});
	root.sigmaPrintRowsService = createSigmaPrintRows({
		escape: (value) => typeof globalThis.esc === "function" ? globalThis.esc(value) : String(value ?? ""),
		escapeAttr: (value) => typeof globalThis.escAttr === "function" ? globalThis.escAttr(value) : String(value ?? ""),
		format: (value, decimals) => fmt(value, decimals),
		dpmo: (value) => globalThis.sgFmtDPMO(value),
		period: (value) => typeof globalThis.vnPeriod === "function" ? globalThis.vnPeriod(value) : String(value ?? "")
	});
	root.sigmaMuPrintRowsService = createSigmaMuPrintRows({
		mu: (test, entry, level) => typeof globalThis.sgMU === "function" ? globalThis.sgMU(test, entry, level) : void 0,
		format: (value, decimals) => fmt(value, decimals),
		escape: (value) => typeof globalThis.esc === "function" ? globalThis.esc(value) : String(value ?? ""),
		period: (value) => typeof globalThis.vnPeriod === "function" ? globalThis.vnPeriod(value) : String(value ?? "")
	});
	root.reportPointsTableService = createReportPointsTable({
		formatDate: (value) => vnDate(value),
		escape: (value) => typeof globalThis.esc === "function" ? globalThis.esc(value) : String(value ?? ""),
		pointValue: (point, test) => typeof globalThis.reportQcPoint === "function" ? globalThis.reportQcPoint(point, test) : fmt(point && point.val, 3),
		format: (value, decimals) => fmt(value, decimals),
		verdict: (value) => typeof globalThis.qcVerdictLabel === "function" ? globalThis.qcVerdictLabel(value) : String(value ?? ""),
		staff: (point) => typeof globalThis.pointStaff === "function" ? globalThis.pointStaff(point) : {}
	});
	root.actionReportHtml = createActionReportHtml((value) => typeof globalThis.esc === "function" ? globalThis.esc(value) : String(value ?? ""));
	root.sigmaDraftService = createSigmaDraftService({
		get: (key) => localStorage.getItem(key),
		set: (key, value) => localStorage.setItem(key, value),
		remove: (key) => localStorage.removeItem(key),
		now: () => Date.now(),
		clone: (value) => JSON.parse(JSON.stringify(value)),
		key: "qclab_sigma_draft",
		savedAtKey: "qclab_saved_at"
	});
	root.stateAdoptionService = createStateAdoptionService({
		validate: (value) => root.QCCore.validateBackup(value),
		sanitize: (value, options) => root.QCCore.sanitizeBackup(value, options),
		invariants: (value, options) => root.QCCore.validateStateInvariants(value, options)
	});
	root.corruptLocalQuarantine = createCorruptLocalQuarantine(() => (/* @__PURE__ */ new Date()).toISOString());
	root.syncValueCodec = createSyncValueCodec();
	root.firebaseConfigSelection = createFirebaseConfigSelection([
		"apiKey",
		"authDomain",
		"databaseURL",
		"projectId",
		"appId"
	]);
	root.firebaseConnectionGate = createFirebaseConnectionGate();
	root.syncSnapshotSignature = syncSnapshotSignature;
	root.firebaseIdentity = createFirebaseIdentity();
	root.firebaseAuditGate = createFirebaseAuditGate((entries, anchor) => root.QCCore.verifyAuditChain(entries, anchor));
	root.firebasePollingService = createFirebasePollingService({
		setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
		clearInterval: (timer) => globalThis.clearInterval(timer)
	});
	root.firebaseDisconnectedState = firebaseDisconnectedState;
	root.firebaseCanPull = firebaseCanPull;
	root.firebasePullService = createFirebasePullService({
		read: (ref) => ref.once("value"),
		handle: (value, options) => globalThis.fbHandleValue(value, options),
		canPull: firebaseCanPull
	});
	root.firebaseMergeApplication = createFirebaseMergeApplication({
		merge: (local, remote, base) => globalThis.fbMerge(local, remote, base),
		firstMerge: (local, remote) => globalThis.fbFirstConnectMerge(local, remote)
	});
	root.localPartitionHelpers = createLocalPartitionHelpers();
	root.localSnapshotRecord = createLocalSnapshotRecord({
		clone: (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)),
		now: () => Date.now(),
		key: "state"
	});
	root.localPartitionValid = localPartitionValid;
	root.localRecoverySlots = localRecoverySlots;
	root.localPartitionTransaction = createLocalPartitionTransaction({
		nextSlot: (value) => root.localPartitionHelpers.nextSlot(value),
		shell: (value) => root.localPartitionHelpers.shell(value),
		now: () => Date.now()
	});
	root.localPartitionRecovery = createLocalPartitionRecovery(localPartitionValid);
	root.localClearKeys = createLocalClearKeys((slot, type, id) => root.localPartitionHelpers.key(slot, type, id), "state");
	root.firebaseSnapshotGate = firebaseSnapshotGate;
	root.firebaseEmptySnapshotPlan = firebaseEmptySnapshotPlan;
	root.firebaseRemoteSnapshot = createFirebaseRemoteSnapshot((value) => root.QCCore.validateBackup(value), (value) => root.QCCore.sanitizeBackup(value));
	root.firebaseOwnSnapshotPlan = firebaseOwnSnapshotPlan;
	root.firebaseFirstConnectPlan = firebaseFirstConnectPlan;
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
	root.ActionInvestigationPresentation = actionInvestigationPresentation;
	root.ActionChecklistPresentation = createActionChecklistPresentation({
		checkLabels: nceActionLabels.actionLabels.check,
		effectivenessStatus: (form) => typeof root.actionEffectivenessStatus === "function" ? root.actionEffectivenessStatus(form) : {
			cls: "none",
			label: "Chưa đánh giá",
			complete: false
		}
	});
	root.ActionFormModel = createActionFormModel({
		todayIso: () => isoToday(),
		dueDate: (days) => root.NceActionIdentityService.dueDate(days),
		operationalLevels: (test) => root.operationalLevels(test),
		effectivenessComplete: (action) => typeof root.actionEffectivenessStatus === "function" && root.actionEffectivenessStatus(action).complete
	});
	root.ReportPeriodPresentation = createReportPeriodPresentation();
	root.reportSearchValuePresentation = reportSearchValuePresentation;
	root.reportActionIconPresentation = reportActionIconPresentation;
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
	root.AuditService = createAuditService({
		getState: () => state,
		uid: () => typeof root.uid === "function" ? root.uid() : "",
		nowIso: () => (/* @__PURE__ */ new Date()).toISOString(),
		actor: () => typeof root.auditActor === "function" ? root.auditActor() : {
			user: "",
			username: "",
			userId: "",
			role: "",
			clientId: ""
		},
		entryHash: (entry) => typeof root.auditEntryHash === "function" ? root.auditEntryHash(entry) : "",
		verifyChain: (activity, anchor) => typeof root.auditVerifyChain === "function" ? root.auditVerifyChain(activity, anchor) : {
			ok: true,
			checked: 0,
			legacy: 0
		},
		limits: () => {
			const config = typeof root.auditRuntimeConfig === "function" ? root.auditRuntimeConfig() : {
				hardCap: 5e4,
				rotateTo: 4e4
			};
			return {
				hardCap: config.hardCap,
				rotateTo: config.rotateTo
			};
		},
		autoVerifyMax: typeof root.auditRuntimeConfig === "function" ? root.auditRuntimeConfig().autoVerifyMax : 5e3
	});
	root.ActionRerunService = createActionRerunService({
		pointsFor: (testId) => state.data?.[testId],
		testFor: (testId) => state.tests?.find((test) => test.id === testId),
		runNumber: (point) => root.pointRunNo(point),
		lotPoints: (points, level, lot, runNumber) => root.NceActionQcIndex.actionLotPoints(points, level, lot, runNumber),
		pointIndex: (points) => root.NceActionQcIndex.actionPointIndex(points),
		needsRerun: (action) => root.actionNeedsRerun(action),
		gateDate: (action, point) => root.actionRerunGateDate(action, point),
		evaluate: (input) => root.NceActionRerunEvaluator.evaluateActionRerun(input),
		verdictFor: (test, pointId) => root.activeWestgard(test).byPoint.get(pointId) || { level: "ok" },
		formatValue: (point, test) => root.fmtPointValue(point, test),
		formatDate: (value) => vnDate(value)
	});
	root.ActionPointIndexService = createActionPointIndexService(() => state.actions || []);
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
	root.TeaReferenceService = createTeaReferenceService({
		key: (value) => globalThis.teaRefName(value),
		analyteMeta: (name, record) => globalThis.teaAnalyteMeta(name, record),
		effectiveReferences: () => globalThis.effectiveTeaRefs(),
		defaultReferences: () => globalThis.REFTESTS,
		sourceRegistry: () => globalThis.TEA_SOURCE_REGISTRY,
		createId: () => globalThis.uid(),
		todayIso: () => globalThis.isoToday(),
		userName: () => globalThis.userName()
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
	root.reagentReportPresentation = reagentReportPresentation;
	root.reagentChartPresentation = reagentChartPresentation;
	root.reagentReportItemPresentation = reagentReportItemPresentation;
	root.reagentComparisonLabelPresentation = reagentComparisonLabelPresentation;
	root.reagentQuickLabelPresentation = reagentQuickLabelPresentation;
	root.reagentToolIconPresentation = reagentToolIconPresentation;
	root.reagentPairMath = reagentPairMath;
	root.reagentStatistics = reagentStatistics;
	root.reagentTDistribution = reagentTDistribution;
	root.reagentComparisonCalculator = createReagentComparisonCalculator({
		validPairs: reagentPairMath.validPairs,
		mean: reagentStatistics.mean,
		variance: reagentStatistics.variance,
		max: reagentStatistics.max,
		min: reagentStatistics.min,
		pearson: reagentStatistics.pearson,
		ols: reagentStatistics.ols,
		passingBablok: reagentStatistics.passingBablok,
		twoSidedPValue: reagentTDistribution.twoSidedPValue,
		tCritical: reagentTDistribution.tCritical
	});
	root.SigmaCohortService = createSigmaCohortService({ stats: root.QCCore.stats });
	root.WestgardViewModel = westgardViewModel;
	root.westgardRowsWindow = westgardRowsWindow;
	root.westgardXlsxRows = createWestgardXlsxRows({
		date: (value) => root.vnDate(value),
		staffCode: (point) => root.pointStaff(point).code || "",
		verdict: (level) => root.qcVerdictLabel(level),
		error: (rules) => root.errorType(rules),
		number: (value) => root.fmt(value)
	});
	root.westgardXlsxHeader = createWestgardXlsxHeader;
	root.westgardArchivedGroups = westgardArchivedGroups;
	root.westgardArchivedMultiViews = westgardArchivedMultiViews;
	root.westgardArchivedGroupMatches = westgardArchivedGroupMatches;
	root.westgardArchivedTestSelection = westgardArchivedTestSelection;
	//#endregion
})();
