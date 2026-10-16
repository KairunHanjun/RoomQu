export const roles = { H: 'Host', FO: 'Front Office', HK: 'House Keeping', T: 'Teknisi' };
export const areas = { H: 'host', FO: 'front-office', HK: 'housekeeping', T: 'technician' };
export const stateLabels = {
	Ready: 'Siap digunakan',
	Working: 'Terisi',
	StandBy: 'Menunggu bersih',
	Closed: 'Perawatan'
};
export const money = (value: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(value);
export const dateTime = (value: string) =>
	new Intl.DateTimeFormat('id-ID', {
		timeZone: 'Asia/Bangkok',
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(value));
