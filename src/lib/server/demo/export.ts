import ExcelJS from 'exceljs';
import type { Snapshot } from './store.ts';
export async function exportWorkbook(data: Snapshot, kind: string) {
	const book = new ExcelJS.Workbook();
	book.creator = 'RoomQu Demo';
	const sheet = book.addWorksheet(
		kind === 'bookings' ? 'Tamu' : kind === 'issues' ? 'Masalah' : 'Absensi'
	);
	if (kind === 'bookings') {
		sheet.columns = [
			{ header: 'Unit', key: 'unitName', width: 14 },
			{ header: 'Tamu (dummy)', key: 'guestName', width: 28 },
			{ header: 'Agen', key: 'agentName', width: 22 },
			{ header: 'Malam', key: 'nights', width: 12 },
			{ header: 'Total', key: 'amount', width: 20 },
			{ header: 'Komisi', key: 'commission', width: 20 },
			{ header: 'Masuk (UTC)', key: 'checkinAt', width: 25 },
			{ header: 'Keluar (UTC)', key: 'checkoutAt', width: 25 },
			{ header: 'Status', key: 'status', width: 15 }
		];
		for (const row of data.bookings)
			sheet.addRow({
				...row,
				checkinAt: new Date(row.checkinAt),
				checkoutAt: new Date(row.checkoutAt)
			});
		sheet.getColumn('amount').numFmt = '#,##0';
		sheet.getColumn('commission').numFmt = '#,##0';
		sheet.getColumn('checkinAt').numFmt = 'dd-mmm-yyyy hh:mm';
		sheet.getColumn('checkoutAt').numFmt = 'dd-mmm-yyyy hh:mm';
	} else if (kind === 'issues') {
		sheet.columns = [
			{ header: 'Unit', key: 'unitName', width: 12 },
			{ header: 'Laporan', key: 'description', width: 60 },
			{ header: 'Pelapor', key: 'reporter', width: 25 },
			{ header: 'Berat', key: 'severe', width: 12 },
			{ header: 'Selesai', key: 'done', width: 12 },
			{ header: 'Dibuat (UTC)', key: 'createdAt', width: 25 }
		];
		for (const row of data.issues)
			sheet.addRow({
				...row,
				severe: row.severe ? 'Ya' : 'Tidak',
				done: row.done ? 'Ya' : 'Tidak',
				createdAt: new Date(row.createdAt)
			});
		sheet.getColumn('createdAt').numFmt = 'dd-mmm-yyyy hh:mm';
	} else if (kind === 'attendance') {
		sheet.columns = [
			{ header: 'Nama', key: 'name', width: 25 },
			{ header: 'Peran', key: 'role', width: 15 },
			{ header: 'Tanggal Bangkok', key: 'day', width: 22 },
			{ header: 'Waktu (UTC)', key: 'createdAt', width: 25 }
		];
		for (const row of data.attendance) sheet.addRow({ ...row, createdAt: new Date(row.createdAt) });
		sheet.getColumn('createdAt').numFmt = 'dd-mmm-yyyy hh:mm';
	} else throw new Error('Jenis ekspor tidak valid.');
	sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
	sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5263CC' } };
	sheet.views = [{ state: 'frozen', ySplit: 1 }];
	return new Uint8Array(await book.xlsx.writeBuffer());
}
