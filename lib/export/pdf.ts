import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PDFSection {
  title: string;
  headers: string[];
  rows: string[][];
}

export function exportToPDF(title: string, sections: PDFSection[], fileName = "ptce-report.pdf"): void {
  const doc = new jsPDF();

  // Title page
  doc.setFontSize(20);
  doc.text(title, 14, 30);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);

  let yOffset = 55;

  for (const section of sections) {
    if (yOffset > 250) {
      doc.addPage();
      yOffset = 20;
    }

    doc.setFontSize(14);
    doc.text(section.title, 14, yOffset);
    yOffset += 8;

    autoTable(doc, {
      head: [section.headers],
      body: section.rows,
      startY: yOffset,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    yOffset = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  doc.save(fileName);
}
