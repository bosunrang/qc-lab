"use strict";
/* Pha "nhóm D" (2026-08-20): chuyển assets/workers/westgard-worker.js sang TypeScript.
   Cố ý giữ NGUYÊN VĂN cấu trúc gốc — một biểu thức IIFE duy nhất ở top-level, KHÔNG
   import/export — để file này vẫn là một "script" thuần theo TS (không phải module),
   đúng như hợp đồng mà tests/westgard-worker-onmessage.test.js dựa vào: test đó đọc
   RAW TEXT của file build ra rồi tự vm.runInContext(...) với CHỈ `self` trong scope
   (không có `module`), để mô phỏng đúng ngữ cảnh worker thật trong trình duyệt. Nếu
   tách bootstrap (require/importScripts/onmessage) và logic thuần
   (computeWestgardJob/ruleAction/...) ra hai file, bản build ra sẽ cần TẢI THÊM một
   importScripts() nữa cho phần logic — nhưng ngữ cảnh vm tối giản của test đó không có
   importScripts, nên đường thành công sẽ vỡ; giữ một file như bản gốc thì hợp đồng của
   test không cần đổi gì cả (xem docs/TYPESCRIPT-MIGRATION-PLAN.md "nhóm D" cho phân
   tích đầy đủ). Build qua vite.worker.config.mjs, formats:['es'] — file không có
   export nào ở top-level nên Rollup không thêm wrapper, kết quả gần như nguyên văn. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../core.js'));
        return;
    }
    if (typeof importScripts === 'function' && typeof root.QCCore === 'undefined')
        importScripts('../core.js?v=ts-nhom-d-core-20260820-1');
    const api = factory(root.QCCore);
    root.onmessage = function (event) {
        const job = event && event.data;
        if (!job || job.type !== 'compute')
            return;
        try {
            root.postMessage({ type: 'result', ...api.computeWestgardJob(job) });
        }
        catch (error) {
            root.postMessage({ type: 'error', generation: job.generation, revision: job.revision, testId: job.testId, message: (error && error.message) || 'Westgard worker failed' });
        }
    };
})(typeof self !== 'undefined' ? self : globalThis, function (QCCore) {
    'use strict';
    /* Hành động + phạm vi của luật phải GIỐNG HỆT luồng chính, nếu không thì cùng
       một bộ dữ liệu sẽ cho kết luận nhận/loại khác nhau chỉ vì nó vượt
       WG_WORKER_POINT_THRESHOLD. Nên cả hai bên đều gọi cùng một bảng thuần trong
       core.js — đừng chép lại bảng đó vào đây. */
    function ruleAction(job, rule) { return QCCore.resolveRuleAction(rule, QCCore.ruleEnabled(job.globalRules, rule), job.ruleActions && job.ruleActions[rule]); }
    function verdictLevel(job, rules) { return QCCore.ruleVerdictLevel(rules, (rule) => ruleAction(job, rule)); }
    function ruleScope(job, rule) { return QCCore.resolveRuleScope(rule, (job.levels || []).length, job.ruleScopes && job.ruleScopes[rule]); }
    function ruleOnIn(job, rule, channel) { return QCCore.ruleOnInScope(rule, (job.levels || []).length, job.ruleScopes && job.ruleScopes[rule], ruleAction(job, rule), channel); }
    function pointRunNo(point) { const match = /-(\d+)$/.exec(String((point && point.runId) || '')); return match ? parseInt(match[1]) : 1; }
    function pointOrder(a, b) { return String(a.date || '').localeCompare(String(b.date || '')) || pointRunNo(a) - pointRunNo(b); }
    function computeWestgardJob(job) {
        if (!QCCore)
            throw new Error('QCCore unavailable');
        const within = (rule) => ruleOnIn(job, rule, 'within'), across = (rule) => ruleOnIn(job, rule, 'across');
        const source = job.points || [];
        const sets = (job.levels || []).map((level) => ({
            level: level.level, mean: level.mean, sd: level.sd,
            pts: (Array.isArray(level.points) ? level.points : source.filter((point) => +point.level === +level.level && (point.lot || '') === (level.lot || ''))).sort(pointOrder)
        }));
        const singles = sets.map((set) => QCCore.westgardByPoint(set.pts, set.mean, set.sd, within));
        const cross = QCCore.westgardMultiByPoint(sets, across);
        const levels = sets.map((set, levelIndex) => ({
            level: set.level,
            points: set.pts.map((point, pointIndex) => {
                const singleVerdict = singles[levelIndex].F[pointIndex] || {}, singleRules = singleVerdict.rules || [], singleSupportRules = singleVerdict.supportRules || [];
                const crossRules = cross.get(point) || [];
                const crossSupportRules = (cross.support && cross.support.get(point)) || [], rules = [...new Set([...singleRules, ...crossRules])], supportRules = [...new Set([...singleSupportRules, ...crossSupportRules])].filter((rule) => !rules.includes(rule));
                return { id: point.id, z: singles[levelIndex].zs[pointIndex], singleRules, crossRules, singleSupportRules, crossSupportRules, rules, supportRules, level: verdictLevel(job, rules) };
            })
        }));
        return { generation: job.generation, revision: job.revision, testId: job.testId, levels };
    }
    return { computeWestgardJob, ruleAction, verdictLevel, ruleScope, ruleOnIn };
});
