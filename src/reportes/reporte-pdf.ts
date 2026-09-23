import PDFDocument from 'pdfkit';
import type { ReporteHorasDto } from './dto/reporte.dto';

const ANCHO_UTIL = 532; // letter (612pt) - márgenes (40 + 40)

const COLUMNAS = [
  { clave: 'codigo', titulo: 'Código', ancho: 55, alinear: 'left' as const },
  { clave: 'nombre', titulo: 'Empleado', ancho: 167, alinear: 'left' as const },
  { clave: 'horas', titulo: 'Horas', ancho: 70, alinear: 'right' as const },
  { clave: 'tarifa', titulo: 'Tarifa/h', ancho: 80, alinear: 'right' as const },
  { clave: 'pagoBase', titulo: 'Pago base', ancho: 80, alinear: 'right' as const },
  { clave: 'pago', titulo: 'Pago total', ancho: 80, alinear: 'right' as const },
];

const formatoLempiras = (valor: number | null): string => (valor === null ? '—' : `L ${valor.toFixed(2)}`);

// Genera el mismo reporte que devuelve ReportesService.generarReporteHoras, en PDF,
// listo para imprimir o archivar. Sin dependencias de navegador (pdfkit es puro Node),
// así que funciona bien en un entorno serverless como Vercel.
export const generarPdfReporteHoras = (reporte: ReporteHorasDto): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'letter', margin: 40 });
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const margenIzquierdo = doc.page.margins.left;
    const limiteInferior = doc.page.height - doc.page.margins.bottom;

    const dibujarEncabezadoTabla = () => {
      const y = doc.y;
      let x = margenIzquierdo;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b');
      for (const columna of COLUMNAS) {
        doc.text(columna.titulo, x, y, { width: columna.ancho, align: columna.alinear });
        x += columna.ancho;
      }
      doc.y = y + 14;
      doc
        .moveTo(margenIzquierdo, doc.y)
        .lineTo(margenIzquierdo + ANCHO_UTIL, doc.y)
        .strokeColor('#cbd5e1')
        .stroke();
      doc.y += 6;
    };

    // Encabezado del documento
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text('AssistIQ', margenIzquierdo, 40);
    doc.font('Helvetica').fontSize(11).fillColor('#475569').text('Reporte de horas trabajadas');
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(reporte.empresa.nombre);
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Periodo: ${reporte.desde} al ${reporte.hasta}`);
    doc.moveDown(1);

    dibujarEncabezadoTabla();

    if (reporte.empleados.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('No hay empleados para mostrar en este periodo.');
    }

    for (const fila of reporte.empleados) {
      const notas: string[] = [];
      if (fila.turnosIncompletos > 0) {
        notas.push(`${fila.turnosIncompletos} turno(s) sin marcar salida (no se cuentan en las horas)`);
      }
      for (const regla of fila.desglose) {
        notas.push(`${regla.nombre} (+${regla.porcentaje}%): ${regla.horas.toFixed(2)}h → +${formatoLempiras(regla.monto)}`);
      }

      const alturaFila = 16 + notas.length * 11;
      if (doc.y + alturaFila > limiteInferior) {
        doc.addPage();
        dibujarEncabezadoTabla();
      }

      const yFila = doc.y;
      const valores: Record<string, string> = {
        codigo: fila.codigo,
        nombre: `${fila.nombre} ${fila.apellido}`,
        horas: fila.horas.toFixed(2),
        tarifa: formatoLempiras(fila.tarifaHoraBase),
        pagoBase: formatoLempiras(fila.pagoBase),
        pago: formatoLempiras(fila.pago),
      };

      let x = margenIzquierdo;
      for (const columna of COLUMNAS) {
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
        doc.text(valores[columna.clave], x, yFila, { width: columna.ancho, align: columna.alinear });
        x += columna.ancho;
      }

      notas.forEach((nota, indice) => {
        doc
          .font('Helvetica-Oblique')
          .fontSize(8)
          .fillColor('#64748b')
          .text(nota, margenIzquierdo, yFila + 12 + indice * 11, { width: ANCHO_UTIL });
      });

      doc.y = yFila + alturaFila;
    }

    if (doc.y + 40 > limiteInferior) doc.addPage();
    doc.moveDown(0.5);
    doc
      .moveTo(margenIzquierdo, doc.y)
      .lineTo(margenIzquierdo + ANCHO_UTIL, doc.y)
      .strokeColor('#94a3b8')
      .stroke();
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
    doc.text(`Total horas: ${reporte.totales.horas.toFixed(2)}`, margenIzquierdo, doc.y);
    doc.text(`Total a pagar: ${formatoLempiras(reporte.totales.pago)}`, margenIzquierdo, doc.y + 14);

    doc.end();
  });
