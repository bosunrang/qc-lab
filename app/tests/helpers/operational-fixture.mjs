let sequence = 0;

/**
 * Dựng cấu hình tối thiểu nhưng hợp lệ theo nghiệp vụ Nhập QC mà không tạo
 * thêm audit ngoài phạm vi test đang kiểm: Panel hoạt động, nhóm hoạt động có
 * ít nhất hai lô, và mỗi mức được gán đúng lô trong nhóm.
 */
export function makeOperationalQc(db, { testId, instrumentId, panelId, assignments }) {
  const suffix = `${++sequence}-${testId}`;
  const actualPanelId = panelId || `fixture-panel-${suffix}`;
  if (!panelId) {
    db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)')
      .run(actualPanelId, `Panel fixture ${suffix}`, instrumentId);
  } else {
    db.prepare('UPDATE qc_panels SET active=1 WHERE id=?').run(actualPanelId);
  }
  db.prepare('INSERT OR IGNORE INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run(actualPanelId, testId);

  const groupId = `fixture-group-${suffix}`;
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES (?,?,1,'')")
    .run(groupId, `Nhóm fixture ${suffix}`);

  const assignedLotIds = [];
  for (const item of assignments) {
    const lotId = item.lotId || `fixture-lot-${item.level}-${suffix}`;
    if (item.lotId) {
      db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(groupId, lotId);
    } else {
      db.prepare('INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES (?,?,?,?)')
        .run(lotId, groupId, item.lotNo || `LOT-${item.level}-${suffix}`, item.level);
    }
    db.prepare('UPDATE test_levels SET qc_lot_id=? WHERE test_id=? AND level=?').run(lotId, testId, item.level);
    assignedLotIds.push(lotId);
  }

  if (assignedLotIds.length < 2) {
    db.prepare('INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES (?,?,?,?)')
      .run(`fixture-spare-${suffix}`, groupId, `LOT-DU-PHONG-${suffix}`, assignments[0]?.level || 1);
  }
  return { panelId: actualPanelId, groupId, lotIds: assignedLotIds };
}


