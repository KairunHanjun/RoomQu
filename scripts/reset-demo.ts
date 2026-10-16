import { getStore } from '../src/lib/server/demo/store.ts';
const store = getStore();
store.reset();
store.close();
console.log('Database SQLite demo RoomQu kembali ke data awal.');
