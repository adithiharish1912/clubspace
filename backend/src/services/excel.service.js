const ExcelJS = require('exceljs');

/** Builds an .xlsx buffer with a styled header row, optional summary sheet. */
async function tableXlsx({ title, columns, rows, summary = [] }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ClubSpace';
  wb.created = new Date();

  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, (c.width || 1) * 14) }));
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    cell.alignment = { vertical: 'middle' };
  });
  rows.forEach((r) => ws.addRow(r));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  if (summary.length) {
    const s = wb.addWorksheet('Summary');
    s.columns = [
      { header: 'Metric', key: 'k', width: 30 },
      { header: 'Value', key: 'v', width: 24 },
    ];
    s.getRow(1).font = { bold: true };
    summary.forEach(([k, v]) => s.addRow({ k, v }));
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { tableXlsx };
