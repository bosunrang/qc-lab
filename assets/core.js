(function(global, factory) {
	typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.QCCore = {}));
})(this, function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region src/domain/core/qc-core.ts
	var TEXT_LIMIT = 500;
	var LONG_TEXT_LIMIT = 5e3;
	var STATE_SCHEMA_VERSION = 6;
	var ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
	var ROLE_SET = /* @__PURE__ */ new Set([
		"admin",
		"technician",
		"viewer"
	]);
	var PAGE_SET = /* @__PURE__ */ new Set([
		"dash",
		"entry",
		"westgard",
		"sigma",
		"reagent",
		"actions",
		"report",
		"manage",
		"users",
		"audit",
		"settings"
	]);
	var WG_RULE_REGISTRY = [
		{
			id: "1-2s",
			desc: "1 điểm QC vượt ±2SD",
			err: "",
			defaultOn: true,
			alert: true,
			scope: "within",
			scopeMin: 2,
			priority: 13,
			run: null,
			fix: "Theo dõi điểm kế tiếp, chưa loại bỏ nếu không kèm luật khác."
		},
		{
			id: "1-3s",
			desc: "1 điểm QC vượt ±3SD",
			err: "RE",
			defaultOn: true,
			alert: false,
			scope: "within",
			scopeMin: 2,
			priority: 1,
			run: null,
			fix: "Kiểm tra sai số ngẫu nhiên: thao tác, bọt khí, pipet, QC pha/bảo quản."
		},
		{
			id: "2-2s",
			desc: "2 điểm liên tiếp hoặc 2 mức cùng lần chạy, cùng phía vượt ±2SD",
			err: "SE",
			defaultOn: true,
			alert: false,
			scope: "both",
			scopeMin: 2,
			priority: 3,
			run: [
				2,
				(z) => z > 2,
				(z) => z < -2
			],
			fix: "Nghi sai số hệ thống: hiệu chuẩn, lô QC/hóa chất, nhiệt độ, máy."
		},
		{
			id: "R4s",
			desc: "Cùng lần chạy có 1 mức > +2SD và 1 mức < -2SD, chênh nhau trên 4SD",
			err: "RE",
			defaultOn: true,
			alert: false,
			scope: "across",
			scopeMin: 2,
			priority: 2,
			run: null,
			fix: "Nghi sai số ngẫu nhiên lớn: hút mẫu, bọt khí, thao tác, điện áp."
		},
		{
			id: "3-1s",
			desc: "3 điểm liên tiếp hoặc 3 mức cùng phía vượt ±1SD",
			err: "SE",
			defaultOn: false,
			alert: false,
			scope: "across",
			scopeMin: 3,
			priority: 5,
			run: [
				3,
				(z) => z > 1,
				(z) => z < -1
			],
			fix: "Nghi dịch chuyển hệ thống nhỏ; kiểm tra hiệu chuẩn và lô thuốc thử."
		},
		{
			id: "4-1s",
			desc: "4 điểm liên tiếp cùng phía vượt ±1SD",
			err: "SE",
			defaultOn: true,
			alert: false,
			scope: "both",
			scopeMin: 2,
			priority: 6,
			run: [
				4,
				(z) => z > 1,
				(z) => z < -1
			],
			fix: "Nghi lệch hệ thống nhẹ, kiểm tra xu hướng và hiệu chuẩn."
		},
		{
			id: "6x",
			desc: "6 điểm liên tiếp nằm cùng một phía so với Mean",
			err: "SE",
			defaultOn: true,
			alert: true,
			scope: "across",
			scopeMin: 2,
			priority: 7,
			run: [
				6,
				(z) => z > 0,
				(z) => z < 0
			],
			fix: "Phát hiện dịch chuyển sớm, khá nhạy khi gộp nhiều mức; xem lại Mean, hiệu chuẩn và lô mới. Có thể nâng thành loại bỏ theo SOP từng xét nghiệm."
		},
		{
			id: "8x",
			desc: "8 điểm liên tiếp nằm cùng một phía so với Mean",
			err: "SE",
			defaultOn: false,
			alert: false,
			scope: "across",
			scopeMin: 2,
			priority: 8,
			run: [
				8,
				(z) => z > 0,
				(z) => z < 0
			],
			fix: "Biến thể thường dùng khi chạy 2 hoặc 4 mức QC; nghi lệch hệ thống."
		},
		{
			id: "9x",
			desc: "9 điểm liên tiếp nằm cùng một phía so với Mean",
			err: "SE",
			defaultOn: false,
			alert: false,
			scope: "across",
			scopeMin: 2,
			priority: 9,
			run: [
				9,
				(z) => z > 0,
				(z) => z < 0
			],
			fix: "Biến thể phù hợp khi chạy 3 mức QC qua nhiều lần chạy."
		},
		{
			id: "10x",
			desc: "10 điểm liên tiếp nằm cùng một phía so với Mean",
			err: "SE",
			defaultOn: true,
			alert: false,
			scope: "across",
			scopeMin: 2,
			priority: 10,
			run: [
				10,
				(z) => z > 0,
				(z) => z < 0
			],
			fix: "Nghi dịch chuyển nền, xem lại Mean/SD, lô mới, hiệu chuẩn."
		},
		{
			id: "12x",
			desc: "12 điểm liên tiếp nằm cùng một phía so với Mean",
			err: "SE",
			defaultOn: false,
			alert: false,
			scope: "across",
			scopeMin: 2,
			priority: 11,
			run: [
				12,
				(z) => z > 0,
				(z) => z < 0
			],
			fix: "Biến thể ít nhạy hơn 8x/10x, dùng để theo dõi bias dài hơn."
		},
		{
			id: "7T",
			desc: "7 lần tăng dần hoặc giảm dần liên tiếp (8 điểm QC)",
			err: "SE",
			defaultOn: false,
			alert: true,
			scope: "within",
			scopeMin: 2,
			priority: 12,
			run: null,
			fix: "Theo dõi xu hướng, kiểm tra bảo quản QC, thuốc thử, môi trường."
		},
		{
			id: "2of3-2s",
			desc: "Trong 3 kết quả, có ít nhất 2 điểm cùng phía vượt ±2SD",
			err: "SE",
			defaultOn: false,
			alert: false,
			scope: "across",
			scopeMin: 3,
			priority: 4,
			run: null,
			fix: "Nghi sai số hệ thống; đặc biệt hữu ích khi chạy 3 mức QC."
		}
	];
	WG_RULE_REGISTRY.forEach((r) => {
		if (r.run) Object.freeze(r.run);
		Object.freeze(r);
	});
	Object.freeze(WG_RULE_REGISTRY);
	var WG_RULE_BY_ID = Object.fromEntries(WG_RULE_REGISTRY.map((r) => [r.id, r]));
	var WG_RULES = WG_RULE_REGISTRY.map((r) => r.id);
	var WG_DEFAULT_ON = new Set(WG_RULE_REGISTRY.filter((r) => r.defaultOn).map((r) => r.id));
	var WG_RUN_RULES = WG_RULE_REGISTRY.filter((r) => r.run).map((r) => [
		r.id,
		r.run[0],
		r.run[1],
		r.run[2]
	]);
	function wgScanRuns(zs, rules, isOn, onHit) {
		rules.forEach(([rule, n, pos, neg]) => {
			if (!isOn(rule)) return;
			let posRun = 0, negRun = 0;
			for (let i = 0; i < zs.length; i++) {
				posRun = pos(zs[i]) ? posRun + 1 : 0;
				negRun = neg(zs[i]) ? negRun + 1 : 0;
				const run = Math.max(posRun, negRun);
				if (run === n) {
					const w = [];
					for (let k = i - n + 1; k <= i; k++) w.push(k);
					onHit(w, rule);
				} else if (run > n) onHit([i], rule);
			}
		});
	}
	function cleanText(value, max = TEXT_LIMIT) {
		if (value == null || value === "") return "";
		const text = String(value);
		if (text.length <= max && !/[\u0000-\u0008\u000B\u000C\u000D\u000E-\u001F\u007F<>]/.test(text)) return text;
		return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").replace(/</g, "‹").replace(/>/g, "›").slice(0, max);
	}
	function cleanId(value) {
		const id = cleanText(value, 80).trim();
		return ID_RE.test(id) ? id : "";
	}
	function finiteNumber(value, fallback = 0) {
		const n = Number(value);
		return Number.isFinite(n) ? n : fallback;
	}
	function numericCell(value) {
		if (value == null || String(value).trim() === "") return "";
		const n = Number(value);
		return Number.isFinite(n) ? n : "";
	}
	function cleanDate(value) {
		const s = cleanText(value, 10);
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
		if (!m) return "";
		const y = +m[1], mo = +m[2], d = +m[3], days = [
			31,
			y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
			31,
			30,
			31,
			30,
			31,
			31,
			30,
			31,
			30,
			31
		];
		return y >= 1e3 && mo >= 1 && mo <= 12 && d >= 1 && d <= days[mo - 1] ? s : "";
	}
	function cleanPeriod(value) {
		const s = cleanText(value, 7), m = /^(\d{4})-(\d{2})$/.exec(s);
		if (!m) return "";
		const mo = +m[2];
		return +m[1] >= 1e3 && mo >= 1 && mo <= 12 ? s : "";
	}
	function cleanRole(value) {
		return ROLE_SET.has(value) ? value : "viewer";
	}
	function cleanSigmaRounds(rows) {
		return (Array.isArray(rows) ? rows : []).slice(0, 200).map((r) => ({
			lab: numericCell(r && r.lab),
			target: numericCell(r && r.target)
		})).filter((r) => r.lab !== "" && r.target !== "" && r.target !== 0);
	}
	function cleanSigmaLevel(raw) {
		raw = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
		const out = {};
		const cv = numericCell(raw.cv), biasEqa = numericCell(raw.biasEqa), legacyBias = numericCell(raw.bias);
		if (cv !== "") out.cv = cv;
		if (biasEqa !== "") out.biasEqa = biasEqa;
		else if (legacyBias !== "") out.biasEqa = legacyBias;
		if (["manual", "rms"].includes(raw.biasEqaMethod)) out.biasEqaMethod = raw.biasEqaMethod;
		if ([
			"manual",
			"iqc-period",
			"iqc-cohort"
		].includes(raw.cvSource)) out.cvSource = raw.cvSource;
		const n = Number(raw.n);
		if (Number.isFinite(n) && n >= 0) out.n = Math.floor(n);
		if ([
			"insufficient",
			"provisional",
			"eligible",
			"unstable"
		].includes(raw.cohortStatus)) out.cohortStatus = raw.cohortStatus;
		const cohortIssues = Array.isArray(raw.cohortIssues) ? raw.cohortIssues.filter((x) => [
			"missing-lot",
			"mixed-target-mean",
			"mixed-target-sd"
		].includes(x)).slice(0, 10) : [];
		if (cohortIssues.length) out.cohortIssues = [...new Set(cohortIssues)];
		["sourceExcludedVoided", "sourceExcludedInvalid"].forEach((k) => {
			const v = Number(raw[k]);
			if (Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
		});
		const sourceTargetMean = numericCell(raw.sourceTargetMean), sourceTargetSd = numericCell(raw.sourceTargetSd);
		if (sourceTargetMean !== "") out.sourceTargetMean = sourceTargetMean;
		if (sourceTargetSd !== "" && sourceTargetSd > 0) out.sourceTargetSd = sourceTargetSd;
		[
			"tea",
			"teaTarget",
			"teaCriterionPercent",
			"teaCriterionAbsolute"
		].forEach((k) => {
			const v = numericCell(raw[k]);
			if (v !== "" && (k === "teaTarget" || v > 0)) out[k] = v;
		});
		if ([
			"percent",
			"absolute",
			"greater-of"
		].includes(raw.teaCriterionRule)) out.teaCriterionRule = raw.teaCriterionRule;
		const teaCriterionUnit = cleanText(raw.teaCriterionUnit, 40);
		if (teaCriterionUnit) out.teaCriterionUnit = teaCriterionUnit;
		const sourceStart = cleanDate(raw.sourceStart), sourceEnd = cleanDate(raw.sourceEnd);
		if (sourceStart) out.sourceStart = sourceStart;
		if (sourceEnd) out.sourceEnd = sourceEnd;
		const sourceLot = cleanText(raw.sourceLot, 120);
		if (sourceLot) out.sourceLot = sourceLot;
		const eqaRounds = cleanSigmaRounds(raw.eqaRounds);
		if (eqaRounds.length) out.eqaRounds = eqaRounds;
		const eqaBatchId = cleanId(raw.eqaBatchId);
		if (eqaBatchId) out.eqaBatchId = eqaBatchId;
		const uCal = numericCell(raw.uCal);
		if (uCal !== "" && uCal >= 0) out.uCal = uCal;
		const uCalBasis = cleanText(raw.uCalBasis, 500);
		if (uCalBasis) out.uCalBasis = uCalBasis;
		if (["include", "exclude"].includes(raw.muBiasMode)) out.muBiasMode = raw.muBiasMode;
		const muReviewedBy = cleanText(raw.muReviewedBy, 120);
		if (muReviewedBy) out.muReviewedBy = muReviewedBy;
		const muReviewedDate = cleanDate(raw.muReviewedDate);
		if (muReviewedDate) out.muReviewedDate = muReviewedDate;
		return out;
	}
	function stats(values) {
		const vals = (values || []).map(Number).filter(Number.isFinite), n = vals.length;
		if (!n) return null;
		const m = vals.reduce((a, b) => a + b, 0) / n;
		const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
		return {
			n,
			m,
			sd,
			cv: m ? sd / Math.abs(m) * 100 : 0
		};
	}
	function westgard(points, mean, sd, isOn = () => true) {
		mean = Number(mean);
		sd = Number(sd);
		if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) return {
			F: (points || []).map(() => ({
				level: "ok",
				rules: [],
				supportRules: []
			})),
			zs: (points || []).map(() => NaN)
		};
		const zs = (points || []).map((p) => (Number(p.val) - mean) / sd);
		const F = zs.map(() => ({
			level: "ok",
			rules: [],
			supportRules: []
		})), ord = {
			ok: 0,
			warn: 1,
			rej: 2
		};
		const set = (i, l, r) => {
			if (i < 0 || i >= F.length) return;
			if (!F[i].rules.includes(r)) F[i].rules.push(r);
			if (ord[l] > ord[F[i].level]) F[i].level = l;
		};
		const support = (i, r) => {
			if (i < 0 || i >= F.length || F[i].rules.includes(r)) return;
			if (!F[i].supportRules.includes(r)) F[i].supportRules.push(r);
		};
		for (let i = 0; i < zs.length; i++) {
			const a = Math.abs(zs[i]);
			if (isOn("1-3s") && a > 3) set(i, "rej", "1-3s");
			else if (isOn("1-2s") && a > 2) set(i, "warn", "1-2s");
			if (isOn("2of3-2s") && i >= 2) {
				const pos = [], neg = [];
				for (let k = i - 2; k < i; k++) {
					if (zs[k] > 2) pos.push(k);
					if (zs[k] < -2) neg.push(k);
				}
				if (zs[i] > 2 && pos.length >= 1) {
					set(i, "rej", "2of3-2s");
					pos.forEach((k) => support(k, "2of3-2s"));
				}
				if (zs[i] < -2 && neg.length >= 1) {
					set(i, "rej", "2of3-2s");
					neg.forEach((k) => support(k, "2of3-2s"));
				}
			}
			if (isOn("7T") && i >= 7 && sameTrendTarget(points, i - 7, i)) {
				let inc = true, dec = true;
				for (let k = i - 6; k <= i; k++) {
					if (!(zs[k] > zs[k - 1])) inc = false;
					if (!(zs[k] < zs[k - 1])) dec = false;
				}
				if (inc || dec) {
					set(i, "warn", "7T");
					for (let k = i - 7; k < i; k++) support(k, "7T");
				}
			}
		}
		wgScanRuns(zs, WG_RUN_RULES, isOn, (idx, rule) => {
			const trigger = idx[idx.length - 1];
			set(trigger, "rej", rule);
			idx.slice(0, -1).forEach((k) => support(k, rule));
		});
		return {
			F,
			zs
		};
	}
	function westgardMulti(levelSets, isOn = () => true) {
		const flags = /* @__PURE__ */ new Map(), supportFlags = /* @__PURE__ */ new Map(), runs = {};
		(levelSets || []).forEach((s) => (s.pts || []).forEach((p) => {
			if (!Number.isFinite(+s.sd) || +s.sd <= 0) return;
			const run = cleanText(p.runId || p.date, 120), item = {
				p,
				z: (Number(p.val) - Number(s.mean)) / Number(s.sd),
				level: s.level,
				run
			};
			(runs[run] = runs[run] || []).push(item);
		}));
		const add = (items, rule) => items.forEach((o) => {
			const a = flags.get(o.p) || [];
			if (!a.includes(rule)) a.push(rule);
			flags.set(o.p, a);
		});
		const addEvidence = (items, rule, triggerRun) => items.forEach((o) => {
			const target = o.run === triggerRun ? flags : supportFlags, a = target.get(o.p) || [];
			if (!a.includes(rule)) a.push(rule);
			target.set(o.p, a);
		});
		const runOrder = Object.keys(runs).sort((a, b) => String(a).localeCompare(String(b), "vi", { numeric: true }));
		Object.values(runs).forEach((runItems) => {
			const items = [...new Map(runItems.map((o) => [o.level, o])).values()];
			if (items.length < 2) return;
			const pos2 = items.filter((o) => o.z > 2), neg2 = items.filter((o) => o.z < -2);
			if (isOn("R4s")) {
				let lo = items[0], hi = items[0];
				items.forEach((o) => {
					if (o.z < lo.z) lo = o;
					if (o.z > hi.z) hi = o;
				});
				if (hi.z > 2 && lo.z < -2 && hi.z - lo.z > 4) add([lo, hi], "R4s");
			}
			if (isOn("2-2s")) {
				if (pos2.length >= 2) add(pos2, "2-2s");
				if (neg2.length >= 2) add(neg2, "2-2s");
			}
			if (items.length >= 3) {
				if (isOn("2of3-2s")) {
					if (pos2.length >= 2) add(pos2, "2of3-2s");
					if (neg2.length >= 2) add(neg2, "2of3-2s");
				}
				if (isOn("3-1s")) {
					const pos1 = items.filter((o) => o.z > 1), neg1 = items.filter((o) => o.z < -1);
					if (pos1.length >= 3) add(pos1, "3-1s");
					if (neg1.length >= 3) add(neg1, "3-1s");
				}
			}
		});
		const seq = runOrder.flatMap((run) => [...new Map(runs[run].map((o) => [o.level, o])).values()].sort((a, b) => Number(a.level) - Number(b.level)));
		wgScanRuns(seq.map((o) => o.z), WG_RUN_RULES.filter((r) => r[0] !== "2-2s"), isOn, (idx, rule) => {
			const items = idx.map((k) => seq[k]);
			addEvidence(items, rule, items[items.length - 1].run);
		});
		flags.support = supportFlags;
		return flags;
	}
	function pointTarget(point, fallbackMean, fallbackSd) {
		const savedMean = Number(point && point.qcMean), savedSd = Number(point && point.qcSd);
		const hasSnapshot = Number.isFinite(savedMean) && Number.isFinite(savedSd) && savedSd > 0;
		const mean = hasSnapshot ? savedMean : Number(fallbackMean);
		const sd = hasSnapshot ? savedSd : Number(fallbackSd);
		const key = Number.isFinite(mean) && Number.isFinite(sd) && sd > 0 ? mean + "\0" + sd : "";
		return {
			mean,
			sd,
			key,
			z: key ? (Number(point && point.val) - mean) / sd : NaN
		};
	}
	function pointZ(point, fallbackMean, fallbackSd) {
		return pointTarget(point, fallbackMean, fallbackSd).z;
	}
	function sameTrendTarget(points, start, end) {
		const first = points && points[start] && points[start].trendTarget;
		for (let i = start + 1; i <= end; i++) if ((points[i] && points[i].trendTarget) !== first) return false;
		return true;
	}
	function westgardByPoint(points, mean, sd, isOn = () => true) {
		return westgard((points || []).map((p) => {
			const target = pointTarget(p, mean, sd);
			return {
				val: target.z,
				trendTarget: target.key
			};
		}), 0, 1, isOn);
	}
	function westgardLatestRulesFromZ(values, isOn = () => true, trendTargets = null) {
		const source = values || [], start = Math.max(0, source.length - 12), zs = start ? source.slice(start) : source, targets = Array.isArray(trendTargets) ? start ? trendTargets.slice(start) : trendTargets : null;
		if (!zs.length) return [];
		const i = zs.length - 1, z = zs[i], rules = [], add = (rule) => {
			if (!rules.includes(rule)) rules.push(rule);
		};
		const abs = Math.abs(z);
		if (isOn("1-3s") && abs > 3) add("1-3s");
		else if (isOn("1-2s") && abs > 2) add("1-2s");
		if (isOn("2of3-2s") && i >= 2) {
			const a = zs[i - 2], b = zs[i - 1];
			if (z > 2 && (a > 2 || b > 2)) add("2of3-2s");
			else if (z < -2 && (a < -2 || b < -2)) add("2of3-2s");
		}
		if (isOn("7T") && i >= 7 && (!targets || targets.slice(i - 7, i + 1).every((key) => key === targets[i]))) {
			let inc = true, dec = true;
			for (let k = i - 6; k <= i; k++) {
				if (!(zs[k] > zs[k - 1])) inc = false;
				if (!(zs[k] < zs[k - 1])) dec = false;
			}
			if (inc || dec) add("7T");
		}
		WG_RUN_RULES.forEach(([rule, n, pos, neg]) => {
			if (!isOn(rule) || zs.length < n) return;
			let allPos = true, allNeg = true;
			for (let k = zs.length - n; k < zs.length; k++) {
				if (!pos(zs[k])) allPos = false;
				if (!neg(zs[k])) allNeg = false;
			}
			if (allPos || allNeg) add(rule);
		});
		return rules;
	}
	function westgardLatestRules(points, mean, sd, isOn = () => true) {
		const rows = points || [], start = Math.max(0, rows.length - 12), zs = [], targets = [];
		for (let i = start; i < rows.length; i++) {
			const target = pointTarget(rows[i], mean, sd);
			zs.push(target.z);
			targets.push(target.key);
		}
		return westgardLatestRulesFromZ(zs, isOn, targets);
	}
	function westgardMultiByPoint(levelSets, isOn = () => true) {
		const sourceByNormalized = /* @__PURE__ */ new Map();
		const raw = westgardMulti((levelSets || []).map((s) => ({
			...s,
			mean: 0,
			sd: 1,
			pts: (s.pts || []).map((p) => {
				const np = {
					val: pointZ(p, s.mean, s.sd),
					runId: p.runId,
					date: p.date
				};
				sourceByNormalized.set(np, p);
				return np;
			})
		})), isOn);
		const flags = /* @__PURE__ */ new Map(), supportFlags = /* @__PURE__ */ new Map();
		raw.forEach((rules, np) => flags.set(sourceByNormalized.get(np), rules));
		if (raw.support) raw.support.forEach((rules, np) => supportFlags.set(sourceByNormalized.get(np), rules));
		flags.support = supportFlags;
		return flags;
	}
	function cusumScan(points, mean, sd, k = .5, h = 4, maWindow = 0) {
		mean = Number(mean);
		sd = Number(sd);
		k = Math.abs(Number(k));
		k = Number.isFinite(k) && k > 0 ? k : .5;
		h = Math.abs(Number(h));
		h = Number.isFinite(h) && h > 0 ? h : 4;
		maWindow = maWindow ? Math.max(1, Math.round(Number(maWindow)) || 5) : 0;
		let cPos = 0, cNeg = 0, maSum = 0, maCount = 0;
		const cPosArr = [], cNegArr = [], flags = [], ma = [], queue = [];
		(points || []).forEach((p) => {
			const z = pointZ(p, mean, sd);
			if (Number.isFinite(z)) {
				cPos = Math.max(0, cPos + z - k);
				cNeg = Math.min(0, cNeg + z + k);
			}
			cPosArr.push(cPos);
			cNegArr.push(cNeg);
			flags.push(Number.isFinite(z) && (cPos >= h || cNeg <= -h) ? "rej" : "ok");
			if (maWindow) {
				queue.push(z);
				if (Number.isFinite(z)) {
					maSum += z;
					maCount++;
				}
				if (queue.length > maWindow) {
					const old = queue.shift();
					if (Number.isFinite(old)) {
						maSum -= old;
						maCount--;
					}
				}
				ma.push(maCount ? maSum / maCount : NaN);
			}
		});
		return maWindow ? {
			cPos: cPosArr,
			cNeg: cNegArr,
			flags,
			k,
			h,
			ma
		} : {
			cPos: cPosArr,
			cNeg: cNegArr,
			flags,
			k,
			h
		};
	}
	function cusum(points, mean, sd, k = .5, h = 4) {
		return cusumScan(points, mean, sd, k, h, 0);
	}
	function cusumMovingAverage(points, mean, sd, k = .5, h = 4, window = 5) {
		return cusumScan(points, mean, sd, k, h, window);
	}
	function movingAverage(points, mean, sd, window = 5) {
		window = Math.max(1, Math.round(Number(window)) || 5);
		const queue = [], out = [];
		let sum = 0, count = 0;
		(points || []).forEach((p) => {
			const z = pointZ(p, mean, sd), finite = Number.isFinite(z);
			queue.push(z);
			if (finite) {
				sum += z;
				count++;
			}
			if (queue.length > window) {
				const old = queue.shift();
				if (Number.isFinite(old)) {
					sum -= old;
					count--;
				}
			}
			out.push(count ? sum / count : NaN);
		});
		return out;
	}
	function erf(x) {
		const sign = x < 0 ? -1 : 1;
		x = Math.abs(x);
		const a1 = .254829592, a2 = -.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, t = 1 / (1 + .3275911 * x);
		return sign * (1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
	}
	function normalCdf(z) {
		return .5 * (1 + erf(z / Math.SQRT2));
	}
	function dpmoFromSigma(sigma) {
		return Math.max(0, (1 - normalCdf(Number(sigma) - 1.5)) * 1e6);
	}
	function sigmaMetric(tea, bias, cv) {
		tea = Number(tea);
		bias = Number(bias);
		cv = Number(cv);
		if (!Number.isFinite(tea) || tea <= 0 || !Number.isFinite(bias) || !Number.isFinite(cv) || cv <= 0) return null;
		const sigma = (tea - Math.abs(bias)) / cv, dpmo = dpmoFromSigma(sigma);
		return {
			tea,
			bias,
			cv,
			sigma,
			dpmo,
			yieldPercent: 100 - dpmo / 1e4
		};
	}
	function systematicShiftCritical(tea, bias, sd) {
		tea = Number(tea);
		bias = Number(bias);
		sd = Number(sd);
		if (!Number.isFinite(tea) || tea <= 0 || !Number.isFinite(bias) || !Number.isFinite(sd) || sd <= 0) return null;
		const dSEcrit = (tea - bias) / sd - 1.65, dREcrit = (tea - bias) / (1.65 * sd);
		return {
			tea,
			bias,
			sd,
			dSEcrit,
			dREcrit
		};
	}
	function uncertaintyBudget(input) {
		const o = input && typeof input === "object" ? input : {};
		const pct = (v) => {
			const n = Number(v);
			return String(v == null ? "" : v).trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
		};
		const uRw = pct(o.cv);
		if (uRw == null || uRw <= 0) return null;
		const k = Number.isFinite(+o.k) && +o.k > 0 ? +o.k : 2, includeBias = o.includeBias !== false;
		const biasRaw = Number(o.bias), bias = String(o.bias == null ? "" : o.bias).trim() !== "" && Number.isFinite(biasRaw) ? Math.abs(biasRaw) : null;
		const biasRefU = pct(o.biasRefU), uCal = pct(o.uCal);
		const uBias = includeBias && bias != null ? Math.sqrt(bias * bias + (biasRefU || 0) * (biasRefU || 0)) : null;
		const parts = Object.entries({
			uRw,
			uBias,
			uCal
		}).filter(([, v]) => v != null && v > 0);
		const variance = parts.reduce((s, [, v]) => s + Number(v) * Number(v), 0), uc = Math.sqrt(variance), U = k * uc;
		const missing = [];
		if (includeBias && bias == null) missing.push("u(bias)");
		if (uCal == null) missing.push("u(cal)");
		const shares = Object.fromEntries(parts.map(([key, v]) => [key, variance > 0 ? Number(v) * Number(v) / variance : null]));
		const teaRaw = Number(o.tea), tea = Number.isFinite(teaRaw) && teaRaw > 0 ? teaRaw : null;
		const targetRaw = Number(o.target), target = Number.isFinite(targetRaw) && targetRaw !== 0 ? Math.abs(targetRaw) : null;
		return {
			k,
			uRw,
			uBias,
			uCal,
			bias: includeBias ? bias : null,
			biasRefU: includeBias ? biasRefU : null,
			includeBias,
			uc,
			U,
			shares,
			complete: !missing.length,
			missing,
			target,
			absoluteUc: target != null ? uc * target / 100 : null,
			absoluteU: target != null ? U * target / 100 : null,
			tea,
			teaRatio: tea != null ? U / tea : null,
			withinTea: tea != null ? U <= tea : null
		};
	}
	function westgardSigmaRules(sigma) {
		sigma = Number(sigma);
		if (!Number.isFinite(sigma)) return null;
		if (sigma >= 6) return {
			tier: "≥6",
			rules: ["1-3s"],
			n: 2,
			r: 1,
			capable: true,
			single: true,
			marginal: false
		};
		if (sigma >= 5) return {
			tier: "5–6",
			rules: [
				"1-3s",
				"2-2s",
				"R4s",
				"4-1s"
			],
			n: 4,
			r: 1,
			capable: true,
			single: false,
			marginal: false
		};
		if (sigma >= 4) return {
			tier: "4–5",
			rules: [
				"1-3s",
				"2-2s",
				"R4s",
				"4-1s",
				"8x"
			],
			n: 8,
			r: 1,
			capable: true,
			single: false,
			marginal: false
		};
		if (sigma >= 3) return {
			tier: "3–4",
			rules: [
				"1-3s",
				"2-2s",
				"R4s",
				"4-1s",
				"6x"
			],
			n: 8,
			r: 1,
			capable: true,
			single: false,
			marginal: true
		};
		return {
			tier: "<3",
			rules: [
				"1-3s",
				"2-2s",
				"R4s",
				"4-1s",
				"6x"
			],
			n: 8,
			r: 1,
			capable: false,
			single: false,
			marginal: false
		};
	}
	function targetFromLimits(low, high, k = 2) {
		if (low == null || high == null || String(low).trim() === "" || String(high).trim() === "") return null;
		low = Number(low);
		high = Number(high);
		k = Number(k);
		if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low || !Number.isFinite(k) || k <= 0) return null;
		return {
			low,
			high,
			mean: (low + high) / 2,
			sd: (high - low) / (2 * k),
			k
		};
	}
	function limitsFromTarget(mean, sd, k = 2) {
		if (mean == null || sd == null || String(mean).trim() === "" || String(sd).trim() === "") return null;
		mean = Number(mean);
		sd = Number(sd);
		k = Number(k);
		if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0 || !Number.isFinite(k) || k <= 0) return null;
		return {
			mean,
			sd,
			low: mean - k * sd,
			high: mean + k * sd,
			k
		};
	}
	function validateBackup(x) {
		if (!x || typeof x !== "object" || Array.isArray(x)) return ["Dữ liệu gốc phải là object."];
		const errors = [], obj = (v, n) => {
			if (v != null && (typeof v !== "object" || Array.isArray(v))) errors.push(n + " phải là object.");
		}, arr = (v, n) => {
			if (v != null && !Array.isArray(v)) errors.push(n + " phải là mảng.");
		};
		const schema = Number(x.schemaVersion);
		if (Number.isFinite(schema) && schema > 6) errors.push(`schemaVersion ${schema} cao hơn phiên bản app hỗ trợ (6).`);
		obj(x.lab, "lab");
		arr(x.tests, "tests");
		obj(x.data, "data");
		arr(x.actions, "actions");
		arr(x.activity, "activity");
		arr(x.users, "users");
		if (x.machines != null) arr(x.machines, "machines");
		if (x.instruments != null) arr(x.instruments, "instruments");
		if (x.assayGroups != null) arr(x.assayGroups, "assayGroups");
		if (x.qcPanels != null) arr(x.qcPanels, "qcPanels");
		if (x.lotTransitions != null) arr(x.lotTransitions, "lotTransitions");
		if (x.lotGroups != null) arr(x.lotGroups, "lotGroups");
		if (x.qcLots != null) arr(x.qcLots, "qcLots");
		if (x.reagentTests != null) arr(x.reagentTests, "reagentTests");
		if (x.reagentOperators != null) arr(x.reagentOperators, "reagentOperators");
		if (x.reagentSampleTypes != null) arr(x.reagentSampleTypes, "reagentSampleTypes");
		if (x.sigmaData != null) obj(x.sigmaData, "sigmaData");
		if (x.teaRefs != null) arr(x.teaRefs, "teaRefs");
		(Array.isArray(x.tests) ? x.tests : []).forEach((t, i) => {
			if (!t || typeof t !== "object" || !cleanId(t.id) || !cleanText(t.name).trim()) errors.push(`tests[${i}] thiếu id hoặc tên hợp lệ.`);
			if (!Array.isArray(t && t.levels) || !t.levels.length || t.levels.length > 10) errors.push(`tests[${i}].levels không hợp lệ.`);
		});
		(Array.isArray(x.users) ? x.users : []).forEach((u, i) => {
			if (!u || !cleanText(u.username, 80).trim() || !ROLE_SET.has(u.role) || !cleanText(u.passHash, 500).trim()) errors.push(`users[${i}] không hợp lệ.`);
		});
		if (Array.isArray(x.tests) && x.tests.length > 5e3) errors.push("Backup có quá nhiều xét nghiệm.");
		if (Array.isArray(x.users) && x.users.length > 1e3) errors.push("Backup có quá nhiều người dùng.");
		return errors.slice(0, 20);
	}
	function auditCanonicalCore(value) {
		if (value === null || typeof value !== "object") return JSON.stringify(value);
		if (Array.isArray(value)) return "[" + value.map(auditCanonicalCore).join(",") + "]";
		return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + auditCanonicalCore(value[k])).join(",") + "}";
	}
	function auditSha256Core(ascii) {
		function rightRotate(value, amount) {
			return value >>> amount | value << 32 - amount;
		}
		const mathPow = Math.pow, maxWord = mathPow(2, 32), lengthProperty = "length", words = [];
		const self = auditSha256Core;
		let hash = self.h = self.h || [], k = self.k = self.k || [], primeCounter = k[lengthProperty], isComposite = {};
		for (let candidate = 2; primeCounter < 64; candidate++) if (!isComposite[candidate]) {
			for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
			hash[primeCounter] = mathPow(candidate, .5) * maxWord | 0;
			k[primeCounter++] = mathPow(candidate, 1 / 3) * maxWord | 0;
		}
		ascii = unescape(encodeURIComponent(String(ascii)));
		const asciiBitLength = ascii[lengthProperty] * 8;
		ascii += "";
		while (ascii[lengthProperty] % 64 - 56) ascii += "\0";
		for (let i = 0; i < ascii[lengthProperty]; i++) words[i >> 2] |= ascii.charCodeAt(i) << (3 - i) % 4 * 8;
		words[words[lengthProperty]] = asciiBitLength / maxWord | 0;
		words[words[lengthProperty]] = asciiBitLength;
		for (let j = 0; j < words[lengthProperty];) {
			const w = words.slice(j, j += 16), oldHash = hash;
			hash = hash.slice(0, 8);
			for (let i = 0; i < 64; i++) {
				const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4], temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + (e & hash[5] ^ ~e & hash[6]) + k[i] + (w[i] = i < 16 ? w[i] : w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ w15 >>> 3) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ w2 >>> 10) | 0);
				hash = [temp1 + ((rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + (a & hash[1] ^ a & hash[2] ^ hash[1] & hash[2])) | 0].concat(hash);
				hash[4] = hash[4] + temp1 | 0;
				hash.pop();
			}
			for (let i = 0; i < 8; i++) hash[i] = hash[i] + oldHash[i] | 0;
		}
		let result = "";
		for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) {
			const b = hash[i] >> j * 8 & 255;
			result += (b < 16 ? 0 : "") + b.toString(16);
		}
		return result;
	}
	function auditEntryHashCore(entry) {
		const { hash, prevHash, ...payload } = entry || {};
		return auditSha256Core(String(entry && entry.prevHash || "") + "|" + auditCanonicalCore(payload));
	}
	function verifyAuditChain(activity = [], anchor = "") {
		let prev = String(anchor || ""), checked = 0, legacy = 0;
		for (let i = 0; i < activity.length; i++) {
			const a = activity[i] || {};
			if (!a.hash && !a.prevHash) {
				legacy++;
				continue;
			}
			if (a.prevHash !== prev) return {
				ok: false,
				checked,
				legacy,
				brokenIndex: i,
				reason: "prevHash không khớp"
			};
			if (a.hash !== auditEntryHashCore(a)) return {
				ok: false,
				checked,
				legacy,
				brokenIndex: i,
				reason: "hash không khớp"
			};
			prev = a.hash;
			checked++;
		}
		return {
			ok: true,
			checked,
			legacy,
			brokenIndex: -1,
			reason: ""
		};
	}
	function validateStateInvariants(x, opts = {}) {
		const sanitized = opts.sanitized === true;
		const errors = [], seen = (rows, label) => {
			const ids = /* @__PURE__ */ new Set();
			(Array.isArray(rows) ? rows : []).forEach((row, i) => {
				const id = String(row && row.id || "");
				if (!id) return;
				if (ids.has(id)) errors.push(`${label}[${i}] trùng id ${id}.`);
				else ids.add(id);
			});
			return ids;
		};
		if (!x || typeof x !== "object" || Array.isArray(x)) return ["State không phải object."];
		const testIds = seen(x.tests, "tests");
		seen(x.users, "users");
		seen(x.instruments, "instruments");
		seen(x.qcPanels, "qcPanels");
		seen(x.lotGroups, "lotGroups");
		seen(x.qcLots, "qcLots");
		seen(x.teaRefs, "teaRefs");
		const usernames = /* @__PURE__ */ new Set();
		(Array.isArray(x.users) ? x.users : []).forEach((u, i) => {
			const name = String(u && u.username || "").trim().toLowerCase();
			if (name && usernames.has(name)) errors.push(`users[${i}] trùng tên đăng nhập ${name}.`);
			else if (name) usernames.add(name);
		});
		Object.entries(x.data && typeof x.data === "object" ? x.data : {}).forEach(([tid, rows]) => {
			if (!testIds.has(tid)) {
				errors.push(`data.${tid} không tham chiếu xét nghiệm tồn tại.`);
				return;
			}
			const pointIds = /* @__PURE__ */ new Set();
			(Array.isArray(rows) ? rows : []).forEach((p, i) => {
				if (!p || typeof p !== "object") {
					errors.push(`data.${tid}[${i}] không phải object.`);
					return;
				}
				if (!(sanitized ? String(p.id || "") : cleanId(p.id))) errors.push(`data.${tid}[${i}] thiếu id điểm QC.`);
				else if (pointIds.has(p.id)) errors.push(`data.${tid}[${i}] trùng id điểm QC ${p.id}.`);
				else pointIds.add(p.id);
				if (!(sanitized ? String(p.date || "") : cleanDate(p.date)) || !Number.isFinite(Number(p.val))) errors.push(`data.${tid}[${i}] có ngày hoặc giá trị không hợp lệ.`);
				if (!String(p.runId || "").trim()) errors.push(`data.${tid}[${i}] thiếu runId.`);
			});
		});
		const lockPeriods = /* @__PURE__ */ new Set();
		(Array.isArray(x.periodLocks) ? x.periodLocks : []).forEach((lock, i) => {
			const ym = cleanPeriod(lock && lock.ym);
			if (!ym) return;
			if (lockPeriods.has(ym)) errors.push(`periodLocks[${i}] trùng kỳ ${ym}.`);
			else lockPeriods.add(ym);
		});
		return errors.slice(0, 20);
	}
	function sanitizeBackup(input, opts = {}) {
		const source = opts.owned && input && typeof input === "object" && !Array.isArray(input) ? input : JSON.parse(JSON.stringify(input));
		source.lab = {
			name: cleanText(source.lab && source.lab.name),
			dept: cleanText(source.lab && source.lab.dept),
			address: cleanText(source.lab && source.lab.address, LONG_TEXT_LIMIT),
			brandTitle: cleanText(source.lab && source.lab.brandTitle, 80),
			brandSub: cleanText(source.lab && source.lab.brandSub, 120),
			logoText: cleanText(source.lab && source.lab.logoText, 8).slice(0, 4),
			logoData: cleanText(source.lab && source.lab.logoData, 12e4)
		};
		source.machines = (source.machines || []).slice(0, 1e3).map((v) => cleanText(v)).filter(Boolean);
		source.instruments = (source.instruments || []).slice(0, 1e3).map((x) => ({
			...x,
			id: cleanId(x.id),
			name: cleanText(x.name),
			manufacturer: cleanText(x.manufacturer),
			model: cleanText(x.model),
			serial: cleanText(x.serial),
			section: cleanText(x.section),
			active: x.active !== false
		})).filter((x) => x.id && x.name);
		source.assayGroups = (source.assayGroups || []).slice(0, 2e3).map((x) => ({
			...x,
			id: cleanId(x.id),
			name: cleanText(x.name),
			testIds: (x.testIds || []).slice(0, 5e3).map(cleanId).filter(Boolean),
			note: cleanText(x.note, LONG_TEXT_LIMIT),
			active: x.active !== false
		})).filter((x) => x.id && x.name);
		source.qcPanels = (source.qcPanels || []).slice(0, 2e3).map((x) => ({
			...x,
			id: cleanId(x.id),
			name: cleanText(x.name),
			instrumentId: cleanId(x.instrumentId),
			testIds: (x.testIds || []).slice(0, 5e3).map(cleanId).filter(Boolean),
			note: cleanText(x.note, LONG_TEXT_LIMIT),
			active: x.active !== false
		})).filter((x) => x.id && x.name);
		source.lotTransitions = (source.lotTransitions || []).slice(0, 1e4).map((x) => ({
			...x,
			id: cleanId(x.id),
			panelId: cleanId(x.panelId),
			fromLotId: cleanId(x.fromLotId),
			toLotId: cleanId(x.toLotId),
			startDate: cleanDate(x.startDate),
			status: x.status === "completed" ? "active" : [
				"planned",
				"active",
				"accepted",
				"rejected"
			].includes(x.status) ? x.status : "planned",
			criteria: cleanText(x.criteria, LONG_TEXT_LIMIT),
			conclusion: cleanText(x.conclusion, LONG_TEXT_LIMIT),
			approvedAt: cleanText(x.approvedAt, 40),
			approvedBy: cleanText(x.approvedBy, 120),
			note: cleanText(x.note, LONG_TEXT_LIMIT)
		})).filter((x) => x.id && x.fromLotId && x.toLotId);
		source.lotGroups = (source.lotGroups || []).slice(0, 2e3).map((x) => ({
			...x,
			id: cleanId(x.id),
			name: cleanText(x.name),
			lotIds: (x.lotIds || []).slice(0, 100).map(cleanId).filter(Boolean),
			manufacturer: cleanText(x.manufacturer),
			material: cleanText(x.material),
			catalog: cleanText(x.catalog),
			note: cleanText(x.note, LONG_TEXT_LIMIT),
			active: x.active !== false
		})).filter((x) => x.id && x.name);
		source.qcLots = (source.qcLots || []).slice(0, 1e4).map((x) => ({
			...x,
			id: cleanId(x.id),
			groupId: cleanId(x.groupId),
			lotNo: cleanText(x.lotNo),
			level: finiteNumber(x.level, 1),
			description: cleanText(x.description),
			supplier: cleanText(x.supplier),
			program: cleanText(x.program),
			exp: cleanDate(x.exp),
			opened: cleanDate(x.opened),
			active: x.active !== false,
			depleted: x.depleted === true,
			note: cleanText(x.note, LONG_TEXT_LIMIT)
		})).filter((x) => x.id && x.lotNo);
		source.tests = (source.tests || []).slice(0, 5e3).map((t) => ({
			...t,
			id: cleanId(t.id),
			analyteId: cleanId(t.analyteId),
			name: cleanText(t.name),
			displayName: cleanText(t.displayName, 160),
			standardName: cleanText(t.standardName, 160),
			abbreviation: cleanText(t.abbreviation, 40),
			aliases: (Array.isArray(t.aliases) ? t.aliases : []).slice(0, 30).map((v) => cleanText(v, 120)).filter(Boolean),
			matrix: cleanText(t.matrix, 80),
			unit: cleanText(t.unit),
			decimalPlaces: t.decimalPlaces != null && t.decimalPlaces !== "" && Number.isInteger(Number(t.decimalPlaces)) && Number(t.decimalPlaces) >= 0 && Number(t.decimalPlaces) <= 6 ? Number(t.decimalPlaces) : null,
			machine: cleanText(t.machine),
			instrumentId: cleanId(t.instrumentId),
			method: cleanText(t.method),
			reagent: cleanText(t.reagent),
			reagentSupplier: cleanText(t.reagentSupplier),
			temperature: finiteNumber(t.temperature, 0),
			genNo: cleanText(t.genNo),
			performanceLimit: cleanText(t.performanceLimit),
			tea: finiteNumber(t.tea, 0),
			teaSource: [
				"lab",
				"eflm",
				"clia",
				"ricos"
			].includes(t.teaSource) ? t.teaSource : "ricos",
			teaRef: cleanText(t.teaRef, 240),
			teaDoc: cleanText(t.teaDoc, 240),
			teaApprovedBy: cleanText(t.teaApprovedBy, 120),
			teaApprovedDate: cleanDate(t.teaApprovedDate),
			teaEffectiveDate: cleanDate(t.teaEffectiveDate),
			teaNote: cleanText(t.teaNote, LONG_TEXT_LIMIT),
			eflmAnalyte: cleanText(t.eflmAnalyte, 160),
			eflmAps: [
				"minimum",
				"desirable",
				"optimum"
			].includes(t.eflmAps) ? t.eflmAps : t.teaSource === "eflm" ? "desirable" : "",
			eflmLookupDate: cleanDate(t.eflmLookupDate),
			eflmRef: cleanText(t.eflmRef, 500),
			active: t.active !== false,
			closed: !!t.closed,
			ruleActions: Object.fromEntries(WG_RULES.map((r) => [r, [
				"inactive",
				"alert",
				"reject"
			].includes(t.ruleActions && t.ruleActions[r]) ? t.ruleActions[r] : ""])),
			ruleScopes: Object.fromEntries(WG_RULES.map((r) => [r, [
				"protocol",
				"within",
				"across",
				"both"
			].includes(t.ruleScopes && t.ruleScopes[r]) ? t.ruleScopes[r] : ""])),
			cusum: {
				on: !!(t.cusum && t.cusum.on),
				k: Number.isFinite(+(t.cusum && t.cusum.k)) && +(t.cusum && t.cusum.k) > 0 ? +t.cusum.k : .5,
				h: Number.isFinite(+(t.cusum && t.cusum.h)) && +(t.cusum && t.cusum.h) > 0 ? +t.cusum.h : 4
			},
			levels: (t.levels || []).slice(0, 10).map((l) => ({
				...l,
				level: finiteNumber(l.level, 1),
				qcLotId: cleanId(l.qcLotId),
				mean: finiteNumber(l.mean, 0),
				sd: Math.max(0, finiteNumber(l.sd, 0)),
				low: l.low == null ? null : finiteNumber(l.low, 0),
				high: l.high == null ? null : finiteNumber(l.high, 0),
				rangeK: finiteNumber(l.rangeK, 2),
				lot: cleanText(l.lot),
				exp: cleanDate(l.exp),
				mfgMean: finiteNumber(l.mfgMean, l.mean),
				mfgSd: Math.max(0, finiteNumber(l.mfgSd, l.sd)),
				applied: l.applied === "lab" ? "lab" : "mfg",
				meanSdHistory: (l.meanSdHistory || []).slice(-1e3).map((h) => ({
					id: cleanId(h.id),
					qcLotId: cleanId(h.qcLotId),
					lot: cleanText(h.lot),
					mean: finiteNumber(h.mean, 0),
					sd: Math.max(0, finiteNumber(h.sd, 0)),
					low: h.low == null ? null : finiteNumber(h.low, 0),
					high: h.high == null ? null : finiteNumber(h.high, 0),
					effectiveFrom: cleanDate(h.effectiveFrom),
					effectiveTo: cleanDate(h.effectiveTo),
					source: h.source === "lab" ? "lab" : "mfg",
					planned: !!h.planned,
					note: cleanText(h.note, LONG_TEXT_LIMIT)
				})).filter((h) => h.id && h.sd > 0)
			}))
		}));
		const ids = new Set(source.tests.map((t) => t.id));
		source.data = Object.fromEntries(Object.entries(source.data || {}).filter(([id, v]) => ids.has(id) && Array.isArray(v)).map(([id, rows]) => [id, rows.slice(0, 1e5).map((p) => {
			if (!p || typeof p !== "object") return null;
			const val = Number(p.val), date = cleanDate(p.date);
			if (!Number.isFinite(val) || !date) return null;
			const qm = Number(p.qcMean), qs = Number(p.qcSd), snap = Number.isFinite(qm) && Number.isFinite(qs) && qs > 0;
			return {
				...p,
				id: cleanId(p.id),
				date,
				runId: cleanText(p.runId, 120),
				lot: cleanText(p.lot),
				level: finiteNumber(p.level, 1),
				val,
				valueDecimals: Number.isInteger(p.valueDecimals) && p.valueDecimals >= 0 && p.valueDecimals <= 6 ? p.valueDecimals : null,
				qcMean: snap ? qm : 0,
				qcSd: snap ? qs : 0,
				note: cleanText(p.note, LONG_TEXT_LIMIT),
				operatorId: cleanId(p.operatorId),
				operatorUsername: cleanText(p.operatorUsername, 80).trim().toLowerCase(),
				operatorName: cleanText(p.operatorName, 120),
				operatorCode: cleanText(p.operatorCode, 12).toUpperCase(),
				voided: !!p.voided,
				voidReason: cleanText(p.voidReason, LONG_TEXT_LIMIT),
				voidKind: [
					"data-entry",
					"analytical",
					"other"
				].includes(p.voidKind) ? p.voidKind : "",
				voidRequiresRerun: p.voidRequiresRerun == null ? void 0 : !!p.voidRequiresRerun,
				voidedAt: cleanText(p.voidedAt, 40),
				voidedBy: cleanText(p.voidedBy, 120)
			};
		}).filter(Boolean)]));
		source.actions = (source.actions || []).slice(-1e5).map((a) => ({
			...a,
			id: cleanId(a.id) || void 0,
			date: cleanDate(a.date),
			createdAt: cleanText(a.createdAt, 40),
			updatedAt: cleanText(a.updatedAt, 40),
			createdByUserId: cleanId(a.createdByUserId),
			createdByUsername: cleanText(a.createdByUsername, 80).trim().toLowerCase(),
			contentEditorUserIds: [...new Set((Array.isArray(a.contentEditorUserIds) ? a.contentEditorUserIds : []).map(cleanId).filter(Boolean))].slice(-100),
			contentEditorUsernames: [...new Set((Array.isArray(a.contentEditorUsernames) ? a.contentEditorUsernames : []).map((x) => cleanText(x, 80).trim().toLowerCase()).filter(Boolean))].slice(-100),
			testId: cleanId(a.testId),
			level: finiteNumber(a.level, 0),
			lot: cleanText(a.lot),
			pointId: cleanId(a.pointId),
			rule: cleanText(a.rule),
			errorType: cleanText(a.errorType),
			qcVerdict: [
				"warn",
				"rej",
				"invalid"
			].includes(a.qcVerdict) ? a.qcVerdict : "",
			action: cleanText(a.action, LONG_TEXT_LIMIT),
			by: cleanText(a.by),
			protocolVersion: [
				1,
				2,
				3
			].includes(+a.protocolVersion) ? +a.protocolVersion : 0,
			nceId: cleanText(a.nceId, 40),
			parentNceId: cleanText(a.parentNceId, 40),
			followUpNceId: cleanText(a.followUpNceId, 40),
			eventSource: [
				"iqc",
				"eqa",
				"instrument",
				"clinical",
				"audit",
				"other"
			].includes(a.eventSource) ? a.eventSource : "",
			processPhase: [
				"pre",
				"exam",
				"post"
			].includes(a.processPhase) ? a.processPhase : "",
			correction: cleanText(a.correction, LONG_TEXT_LIMIT),
			dueDate: cleanDate(a.dueDate),
			riskSeverity: Math.min(5, Math.max(0, Math.floor(finiteNumber(a.riskSeverity, 0)))),
			riskOccurrence: Math.min(5, Math.max(0, Math.floor(finiteNumber(a.riskOccurrence, 0)))),
			riskDetectability: Math.min(5, Math.max(0, Math.floor(finiteNumber(a.riskDetectability, 0)))),
			riskLevel: [
				"low",
				"medium",
				"high",
				"critical"
			].includes(a.riskLevel) ? a.riskLevel : "",
			riskBasis: cleanText(a.riskBasis, LONG_TEXT_LIMIT),
			containmentStatus: ["held", "none"].includes(a.containmentStatus) ? a.containmentStatus : "",
			containmentNote: cleanText(a.containmentNote, LONG_TEXT_LIMIT),
			qcMaterialStatus: [
				"ok",
				"abnormal",
				"na"
			].includes(a.qcMaterialStatus) ? a.qcMaterialStatus : "",
			qcMaterialNote: cleanText(a.qcMaterialNote, LONG_TEXT_LIMIT),
			instrumentStatus: [
				"ok",
				"abnormal",
				"na"
			].includes(a.instrumentStatus) ? a.instrumentStatus : "",
			instrumentNote: cleanText(a.instrumentNote, LONG_TEXT_LIMIT),
			reagentStatus: [
				"ok",
				"abnormal",
				"na"
			].includes(a.reagentStatus) ? a.reagentStatus : "",
			reagentNote: cleanText(a.reagentNote, LONG_TEXT_LIMIT),
			calibrationStatus: [
				"ok",
				"abnormal",
				"na"
			].includes(a.calibrationStatus) ? a.calibrationStatus : "",
			calibrationNote: cleanText(a.calibrationNote, LONG_TEXT_LIMIT),
			lotToLotStatus: [
				"not-needed",
				"checked-ok",
				"checked-abnormal"
			].includes(a.lotToLotStatus) ? a.lotToLotStatus : "",
			lotToLotNote: cleanText(a.lotToLotNote, LONG_TEXT_LIMIT),
			causeCategory: [
				"qc",
				"operator",
				"instrument",
				"reagent",
				"calibration",
				"environment",
				"unknown"
			].includes(a.causeCategory) ? a.causeCategory : "",
			cause: cleanText(a.cause, LONG_TEXT_LIMIT),
			actionCompletedDate: cleanDate(a.actionCompletedDate),
			biasBefore: cleanText(a.biasBefore, 20),
			biasAfter: cleanText(a.biasAfter, 20),
			openedFromVoid: !!a.openedFromVoid,
			releaseStatus: a.releaseStatus === "released" ? "released" : "",
			releaseDate: cleanDate(a.releaseDate),
			releaseBy: cleanText(a.releaseBy, 120),
			releaseNote: cleanText(a.releaseNote, LONG_TEXT_LIMIT),
			patientImpact: [
				"none",
				"held",
				"affected"
			].includes(a.patientImpact) ? a.patientImpact : "",
			patientAction: cleanText(a.patientAction, LONG_TEXT_LIMIT),
			effectivenessStatus: [
				"pending",
				"effective",
				"ineffective"
			].includes(a.effectivenessStatus) ? a.effectivenessStatus : "pending",
			effectivenessDate: cleanDate(a.effectivenessDate),
			effectivenessNote: cleanText(a.effectivenessNote, LONG_TEXT_LIMIT),
			residualSeverity: Math.min(5, Math.max(0, Math.floor(finiteNumber(a.residualSeverity, 0)))),
			residualOccurrence: Math.min(5, Math.max(0, Math.floor(finiteNumber(a.residualOccurrence, 0)))),
			residualDetectability: Math.min(5, Math.max(0, Math.floor(finiteNumber(a.residualDetectability, 0)))),
			residualRiskLevel: [
				"low",
				"medium",
				"high",
				"critical"
			].includes(a.residualRiskLevel) ? a.residualRiskLevel : "",
			residualRiskBasis: cleanText(a.residualRiskBasis, LONG_TEXT_LIMIT),
			effectivenessBy: cleanText(a.effectivenessBy, 120),
			effectivenessAt: cleanText(a.effectivenessAt, 40),
			approvalStatus: [
				"pending",
				"approved",
				"returned"
			].includes(a.approvalStatus) ? a.approvalStatus : "pending",
			approvedAt: cleanText(a.approvedAt, 40),
			approvedBy: cleanText(a.approvedBy, 120),
			approvalNote: cleanText(a.approvalNote, LONG_TEXT_LIMIT),
			returnNote: cleanText(a.returnNote, LONG_TEXT_LIMIT),
			returnBy: cleanText(a.returnBy, 120),
			returnAt: cleanText(a.returnAt, 40),
			recordStatus: a.recordStatus === "cancelled" ? "cancelled" : "active",
			cancelledAt: cleanText(a.cancelledAt, 40),
			cancelledBy: cleanText(a.cancelledBy, 120),
			cancelReason: cleanText(a.cancelReason, LONG_TEXT_LIMIT),
			autoCreated: !!a.autoCreated
		})).filter((a) => !a.autoCreated && a.rule !== "Cập nhật Mean/SD");
		source.activityAnchor = cleanText(source.activityAnchor, 80);
		source.activity = (source.activity || []).map((a) => ({
			...a,
			id: cleanId(a.id),
			seq: finiteNumber(a.seq, 0),
			ts: cleanText(a.ts, 40),
			user: cleanText(a.user),
			username: cleanText(a.username, 80),
			userId: cleanId(a.userId),
			role: cleanRole(a.role),
			type: cleanText(a.type),
			detail: cleanText(a.detail, LONG_TEXT_LIMIT),
			target: cleanText(a.target),
			clientId: cleanText(a.clientId, 80),
			prevHash: cleanText(a.prevHash, 80),
			hash: cleanText(a.hash, 80)
		}));
		source.users = (source.users || []).slice(0, 1e3).map((u) => ({
			...u,
			id: cleanId(u.id),
			username: cleanText(u.username, 80).trim().toLowerCase(),
			name: cleanText(u.name),
			initials: cleanText(u.initials, 12).toUpperCase(),
			externalCode: cleanText(u.externalCode, 40),
			role: cleanRole(u.role),
			pagePerms: Array.isArray(u.pagePerms) ? [...new Set(u.pagePerms.map(cleanId).filter((id) => PAGE_SET.has(id)))] : null,
			passHash: cleanText(u.passHash, 500),
			active: u.active !== false,
			mustChangePassword: !!u.mustChangePassword
		}));
		source.reagentTests = (source.reagentTests || []).slice(0, 5e3).map((d) => {
			const { reviewStatus: _rs, reviewedBy: _rb, reviewedAt: _ra, reviewNote: _rn, ...tRest } = d.test || {};
			return {
				...d,
				id: cleanId(d.id),
				test: {
					...tRest,
					reagent: cleanText(d.test && d.test.reagent),
					lotOld: cleanText(d.test && d.test.lotOld),
					lotNew: cleanText(d.test && d.test.lotNew),
					date: cleanDate(d.test && d.test.date),
					operator: cleanText(d.test && d.test.operator),
					sampleType: cleanText(d.test && d.test.sampleType),
					unit: cleanText(d.test && d.test.unit),
					biasTarget: finiteNumber(d.test && d.test.biasTarget, 6),
					alpha: finiteNumber(d.test && d.test.alpha, .05),
					coverageConfirmed: !!(d.test && d.test.coverageConfirmed)
				},
				rows: (d.rows || []).slice(0, 1e4).map((r) => [numericCell(r && r[0]), numericCell(r && r[1])])
			};
		});
		source.reagentOperators = (source.reagentOperators || []).slice(0, 1e3).map((v) => cleanText(v, 120)).filter(Boolean);
		source.reagentSampleTypes = (source.reagentSampleTypes || [
			"Mẫu bệnh nhân",
			"Mẫu nội kiểm (IQC)",
			"Mẫu ngoại kiểm (EQA)"
		]).slice(0, 1e3).map((v) => cleanText(v, 120)).filter(Boolean);
		source.periodLocks = (source.periodLocks || []).slice(-1e3).map((x, i) => ({
			id: cleanId(x.id) || "lock_" + i,
			ym: cleanPeriod(x.ym),
			lockedAt: cleanText(x.lockedAt, 40),
			lockedBy: cleanText(x.lockedBy, 120),
			note: cleanText(x.note, LONG_TEXT_LIMIT)
		})).filter((x) => x.ym);
		source.teaRefs = (source.teaRefs || []).slice(0, 2e3).map((x, i) => {
			const num = (v) => {
				const n = Number(v);
				return String(v == null ? "" : v).trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
			}, rule = [
				"percent",
				"absolute",
				"greater-of"
			].includes(x.cliaRule) ? x.cliaRule : null, meta = (v) => {
				v = v && typeof v === "object" && !Array.isArray(v) ? v : {};
				const status = [
					"reference",
					"reviewed",
					"retired",
					"dynamic"
				].includes(v.status) ? v.status : "reference", url = /^https:\/\//i.test(String(v.url || "")) ? cleanText(v.url, 1e3) : "";
				return {
					id: cleanId(v.id),
					version: cleanText(v.version, 120),
					document: cleanText(v.document, 500),
					url,
					effectiveDate: cleanDate(v.effectiveDate),
					reviewedDate: cleanDate(v.reviewedDate),
					reviewedBy: cleanText(v.reviewedBy, 120),
					status,
					note: cleanText(v.note, LONG_TEXT_LIMIT)
				};
			}, out = {
				id: cleanId(x.id) || "tref_" + i,
				analyteId: cleanId(x.analyteId),
				name: cleanText(x.name, 120),
				displayName: cleanText(x.displayName, 160),
				standardName: cleanText(x.standardName, 160),
				abbreviation: cleanText(x.abbreviation, 40),
				aliases: (Array.isArray(x.aliases) ? x.aliases : []).slice(0, 30).map((v) => cleanText(v, 120)).filter(Boolean),
				matrix: cleanText(x.matrix, 80),
				unit: cleanText(x.unit, 40),
				section: cleanText(x.section, 80),
				clia: num(x.clia),
				ricos: num(x.ricos),
				lab: num(x.lab),
				labSource: [
					"regulation",
					"pt",
					"eflm",
					"ricos",
					"professional",
					"other"
				].includes(x.labSource) ? x.labSource : "",
				labPreparedBy: cleanText(x.labPreparedBy, 120),
				labNextReviewDate: cleanDate(x.labNextReviewDate),
				sources: {
					clia: meta(x.sources && x.sources.clia),
					ricos: meta(x.sources && x.sources.ricos),
					lab: meta(x.sources && x.sources.lab)
				}
			}, absolute = num(x.cliaAbsolute), absoluteUnit = cleanText(x.cliaAbsoluteUnit, 40);
			if (rule) out.cliaRule = rule;
			if (absolute != null) out.cliaAbsolute = absolute;
			if (absoluteUnit) out.cliaAbsoluteUnit = absoluteUnit;
			return out;
		}).filter((x) => x.id && x.name);
		source.teaRegistryVersion = Math.max(1, Math.floor(finiteNumber(source.teaRegistryVersion, 1)));
		source.sigmaData = source.sigmaData && typeof source.sigmaData === "object" && !Array.isArray(source.sigmaData) ? Object.fromEntries(Object.entries(source.sigmaData).filter(([id, v]) => ids.has(id) && Array.isArray(v)).map(([id, rows]) => [id, rows.slice(-1e3).map((e, i) => {
			e = e && typeof e === "object" && !Array.isArray(e) ? e : {};
			const lvSource = e.lv && typeof e.lv === "object" ? e.lv : {};
			const lv = Object.fromEntries(Object.entries(lvSource).filter(([level]) => Number.isFinite(Number(level)) && Number(level) > 0).slice(0, 20).map(([level, raw]) => [String(Number(level)), cleanSigmaLevel(raw)]));
			const tea = Number(e.tea), teaSource = [
				"lab",
				"eflm",
				"clia",
				"ricos"
			].includes(e.teaSource) ? e.teaSource : "", teaLabel = cleanText(e.teaLabel, 160), teaReference = cleanText(e.teaReference, 500), teaCapturedAt = cleanText(e.teaCapturedAt, 40), teaSourceId = cleanId(e.teaSourceId), teaSourceVersion = cleanText(e.teaSourceVersion, 120), teaSourceUrl = /^https:\/\//i.test(String(e.teaSourceUrl || "")) ? cleanText(e.teaSourceUrl, 1e3) : "", teaEffectiveDate = cleanDate(e.teaEffectiveDate), teaReviewedDate = cleanDate(e.teaReviewedDate), teaReviewedBy = cleanText(e.teaReviewedBy, 120);
			return {
				id: cleanId(e.id) || "sg_" + i,
				period: cleanPeriod(e.period),
				...Number.isFinite(tea) && tea > 0 ? { tea } : {},
				...teaSource ? { teaSource } : {},
				...teaLabel ? { teaLabel } : {},
				...teaReference ? { teaReference } : {},
				...teaCapturedAt ? { teaCapturedAt } : {},
				...teaSourceId ? { teaSourceId } : {},
				...teaSourceVersion ? { teaSourceVersion } : {},
				...teaSourceUrl ? { teaSourceUrl } : {},
				...teaEffectiveDate ? { teaEffectiveDate } : {},
				...teaReviewedDate ? { teaReviewedDate } : {},
				...teaReviewedBy ? { teaReviewedBy } : {},
				lv
			};
		})])) : {};
		source.westgardRules = Object.fromEntries(WG_RULES.map((r) => [r, source.westgardRules && Object.prototype.hasOwnProperty.call(source.westgardRules, r) ? source.westgardRules[r] !== false : WG_DEFAULT_ON.has(r)]));
		source.configMigrationVersion = Number.isFinite(+source.configMigrationVersion) ? Math.max(0, +source.configMigrationVersion) : 0;
		return source;
	}
	var RULE_ACTIONS = [
		"inactive",
		"alert",
		"reject"
	];
	var RULE_SCOPES = [
		"within",
		"across",
		"both"
	];
	var WG_ALERT_RULES = WG_RULE_REGISTRY.filter((r) => r.alert).map((r) => r.id);
	function ruleEnabled(toggles, rule) {
		return !toggles || toggles[rule] !== false;
	}
	function defaultRuleAction(rule, enabled) {
		return enabled ? WG_ALERT_RULES.includes(rule) ? "alert" : "reject" : "inactive";
	}
	function resolveRuleAction(rule, enabled, override) {
		return RULE_ACTIONS.includes(override) ? override : defaultRuleAction(rule, enabled);
	}
	function defaultRuleScope(rule, levelCount) {
		const levels = +levelCount || 0, def = WG_RULE_BY_ID[rule];
		if (!def) return levels >= 2 ? "both" : "within";
		return levels >= def.scopeMin ? def.scope : "within";
	}
	function resolveRuleScope(rule, levelCount, override) {
		return RULE_SCOPES.includes(override) ? override : defaultRuleScope(rule, levelCount);
	}
	function ruleOnInScope(rule, levelCount, override, action, channel) {
		if (action === "inactive") return false;
		const scope = resolveRuleScope(rule, levelCount, override);
		return scope === "both" || scope === channel;
	}
	function ruleVerdictLevel(rules, actionOf) {
		const list = rules || [];
		return list.some((r) => actionOf(r) === "reject") ? "rej" : list.some((r) => actionOf(r) === "alert") ? "warn" : "ok";
	}
	var WG_RE_RULES = WG_RULE_REGISTRY.filter((r) => r.err === "RE").map((r) => r.id);
	var WG_SE_RULES = WG_RULE_REGISTRY.filter((r) => r.err === "SE").map((r) => r.id);
	var WG_RULE_DESCRIPTIONS = Object.fromEntries(WG_RULE_REGISTRY.map((r) => [r.id, r.desc]));
	var WG_RULE_PRIORITY = WG_RULE_REGISTRY.slice().sort((a, b) => a.priority - b.priority).map((r) => r.id);
	function primaryErrorRule(rules) {
		return WG_RULE_PRIORITY.find((r) => (rules || []).includes(r)) || (rules || [])[0] || "";
	}
	function errorType(rules) {
		rules = rules || [];
		if (rules.some((r) => WG_SE_RULES.includes(r))) return "SE — Sai số hệ thống";
		if (rules.some((r) => WG_RE_RULES.includes(r))) return "RE — Sai số ngẫu nhiên";
		return "—";
	}
	function fixHint(rules) {
		rules = rules || [];
		if (rules.some((r) => WG_SE_RULES.includes(r))) return "Hướng hệ thống: kiểm tra hiệu chuẩn, lô hóa chất/QC mới, nhiệt độ, đầu hút, đèn quang.";
		if (rules.some((r) => WG_RE_RULES.includes(r))) return "Hướng ngẫu nhiên: bọt khí, thể tích hút, mẫu QC pha/bảo quản, điện áp, thao tác.";
		return "";
	}
	//#endregion
	exports.PAGE_SET = PAGE_SET;
	exports.ROLE_SET = ROLE_SET;
	exports.RULE_ACTIONS = RULE_ACTIONS;
	exports.RULE_SCOPES = RULE_SCOPES;
	exports.STATE_SCHEMA_VERSION = STATE_SCHEMA_VERSION;
	exports.WG_ALERT_RULES = WG_ALERT_RULES;
	exports.WG_DEFAULT_ON = WG_DEFAULT_ON;
	exports.WG_RE_RULES = WG_RE_RULES;
	exports.WG_RULES = WG_RULES;
	exports.WG_RULE_DESCRIPTIONS = WG_RULE_DESCRIPTIONS;
	exports.WG_RULE_REGISTRY = WG_RULE_REGISTRY;
	exports.WG_SE_RULES = WG_SE_RULES;
	exports.auditCanonical = auditCanonicalCore;
	exports.auditEntryHash = auditEntryHashCore;
	exports.auditSha256 = auditSha256Core;
	exports.cleanId = cleanId;
	exports.cleanText = cleanText;
	exports.cusum = cusum;
	exports.cusumMovingAverage = cusumMovingAverage;
	exports.defaultRuleAction = defaultRuleAction;
	exports.defaultRuleScope = defaultRuleScope;
	exports.dpmoFromSigma = dpmoFromSigma;
	exports.erf = erf;
	exports.errorType = errorType;
	exports.finiteNumber = finiteNumber;
	exports.fixHint = fixHint;
	exports.limitsFromTarget = limitsFromTarget;
	exports.movingAverage = movingAverage;
	exports.normalCdf = normalCdf;
	exports.pointTarget = pointTarget;
	exports.pointZ = pointZ;
	exports.primaryErrorRule = primaryErrorRule;
	exports.resolveRuleAction = resolveRuleAction;
	exports.resolveRuleScope = resolveRuleScope;
	exports.ruleEnabled = ruleEnabled;
	exports.ruleOnInScope = ruleOnInScope;
	exports.ruleVerdictLevel = ruleVerdictLevel;
	exports.sanitizeBackup = sanitizeBackup;
	exports.sigmaMetric = sigmaMetric;
	exports.stats = stats;
	exports.systematicShiftCritical = systematicShiftCritical;
	exports.targetFromLimits = targetFromLimits;
	exports.uncertaintyBudget = uncertaintyBudget;
	exports.validateBackup = validateBackup;
	exports.validateStateInvariants = validateStateInvariants;
	exports.verifyAuditChain = verifyAuditChain;
	exports.westgard = westgard;
	exports.westgardByPoint = westgardByPoint;
	exports.westgardLatestRules = westgardLatestRules;
	exports.westgardLatestRulesFromZ = westgardLatestRulesFromZ;
	exports.westgardMulti = westgardMulti;
	exports.westgardMultiByPoint = westgardMultiByPoint;
	exports.westgardSigmaRules = westgardSigmaRules;
});
