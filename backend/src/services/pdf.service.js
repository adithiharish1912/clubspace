const PDFDocument = require('pdfkit');

const BLUE = '#1d4ed8';
const SLATE = '#475569';

const money = (n, currency = 'INR') =>
  `${currency === 'INR' ? 'Rs.' : currency} ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

function toBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function header(doc, settings, title) {
  doc.rect(0, 0, doc.page.width, 80).fill(BLUE);
  doc.fillColor('#fff').fontSize(20).font('Helvetica-Bold').text(settings.clubName || 'ClubSpace', 40, 24);
  doc.fontSize(10).font('Helvetica').text(settings.tagline || '', 40, 50);
  doc.fontSize(14).font('Helvetica-Bold').text(title, 0, 30, { align: 'right', width: doc.page.width - 40 });
  doc.fillColor('#0f172a');
  doc.y = 100;
}

/** Payment receipt as a PDF buffer. */
async function receiptPdf({ payment, member, settings }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  header(doc, settings, 'PAYMENT RECEIPT');

  doc.fontSize(10).fillColor(SLATE);
  const contact = [settings.address, settings.phone, settings.email, settings.gstNumber && `GSTIN: ${settings.gstNumber}`]
    .filter(Boolean)
    .join('  |  ');
  if (contact) doc.text(contact, 40, 95);

  const top = 130;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('Receipt No.', 40, top);
  doc.font('Helvetica').text(payment.receiptNo || '-', 140, top);
  doc.font('Helvetica-Bold').text('Date', 330, top);
  doc.font('Helvetica').text(fmtDate(payment.paidAt || payment.createdAt), 420, top);

  doc.font('Helvetica-Bold').text('Member', 40, top + 22);
  doc.font('Helvetica').text(`${member.firstName} ${member.lastName || ''}`.trim(), 140, top + 22);
  doc.font('Helvetica-Bold').text('Member ID', 330, top + 22);
  doc.font('Helvetica').text(member.membershipId, 420, top + 22);

  doc.font('Helvetica-Bold').text('Email', 40, top + 44);
  doc.font('Helvetica').text(member.email || '-', 140, top + 44);
  doc.font('Helvetica-Bold').text('Method', 330, top + 44);
  doc.font('Helvetica').text(String(payment.method).replace('_', ' ').toUpperCase(), 420, top + 44);

  // Line items
  const tableTop = top + 90;
  doc.rect(40, tableTop, doc.page.width - 80, 24).fill('#eff6ff');
  doc.fillColor(BLUE).font('Helvetica-Bold').text('Description', 50, tableTop + 7);
  doc.text('Amount', 0, tableTop + 7, { align: 'right', width: doc.page.width - 50 });
  doc.fillColor('#0f172a').font('Helvetica');
  doc.text(payment.description || payment.purpose, 50, tableTop + 34, { width: 340 });
  doc.text(money(payment.amount, payment.currency), 0, tableTop + 34, { align: 'right', width: doc.page.width - 50 });

  let y = tableTop + 70;
  doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor('#cbd5e1').stroke();
  y += 10;
  doc.font('Helvetica-Bold').text('Total Paid', 50, y);
  doc.text(money(payment.amount, payment.currency), 0, y, { align: 'right', width: doc.page.width - 50 });
  if (payment.refundedAmount > 0) {
    y += 20;
    doc.fillColor('#b91c1c').text('Refunded', 50, y);
    doc.text(`- ${money(payment.refundedAmount, payment.currency)}`, 0, y, { align: 'right', width: doc.page.width - 50 });
    doc.fillColor('#0f172a');
  }

  y += 40;
  doc.font('Helvetica').fontSize(9).fillColor(SLATE);
  if (payment.razorpayPaymentId) doc.text(`Razorpay Payment ID: ${payment.razorpayPaymentId}`, 40, y);
  if (payment.referenceNo) doc.text(`Reference: ${payment.referenceNo}`, 40, y + 14);
  doc.text(`Status: ${String(payment.status).toUpperCase()}`, 40, y + 28);

  doc.fontSize(9).text('This is a computer-generated receipt and does not require a signature.', 40, doc.page.height - 70, {
    align: 'center',
    width: doc.page.width - 80,
  });
  return toBuffer(doc);
}

/**
 * Generic tabular report PDF.
 * @param {{title:string, subtitle?:string, columns:{header:string,key:string,width?:number,align?:string}[], rows:object[], summary?:[string,string][]}} opts
 */
async function tablePdf({ settings, title, subtitle, columns, rows, summary = [] }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  header(doc, settings, title.toUpperCase());
  const usable = doc.page.width - 60;
  const totalW = columns.reduce((s, c) => s + (c.width || 1), 0);
  const widths = columns.map((c) => ((c.width || 1) / totalW) * usable);

  doc.fontSize(10).fillColor(SLATE).text(subtitle || '', 30, 92);
  let y = 112;

  if (summary.length) {
    summary.forEach(([k, v], i) => {
      const x = 30 + (i % 4) * (usable / 4);
      if (i && i % 4 === 0) y += 34;
      doc.fillColor(SLATE).fontSize(8).text(k.toUpperCase(), x, y);
      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text(String(v), x, y + 11);
      doc.font('Helvetica');
    });
    y += 42;
  }

  const drawHead = () => {
    doc.rect(30, y, usable, 20).fill(BLUE);
    let x = 30;
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8.5);
    columns.forEach((c, i) => {
      doc.text(c.header, x + 4, y + 6, { width: widths[i] - 8, align: c.align || 'left', lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    doc.font('Helvetica').fillColor('#0f172a');
    y += 20;
  };
  drawHead();

  rows.forEach((row, ri) => {
    if (y > doc.page.height - 50) {
      doc.addPage();
      y = 30;
      drawHead();
    }
    if (ri % 2 === 0) doc.rect(30, y, usable, 18).fill('#f8fafc').fillColor('#0f172a');
    let x = 30;
    doc.fontSize(8);
    columns.forEach((c, i) => {
      const v = row[c.key];
      doc.text(v === undefined || v === null ? '-' : String(v), x + 4, y + 5, {
        width: widths[i] - 8,
        align: c.align || 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += widths[i];
    });
    y += 18;
  });

  if (!rows.length) doc.fontSize(10).fillColor(SLATE).text('No records for the selected period.', 30, y + 10);

  doc.fontSize(8).fillColor(SLATE).text(`Generated on ${new Date().toLocaleString('en-IN')}`, 30, doc.page.height - 40);
  return toBuffer(doc);
}

module.exports = { receiptPdf, tablePdf, money, fmtDate };
