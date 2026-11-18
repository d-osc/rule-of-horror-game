export type Point = [x: number, y: number, z: number];

export type Objective =
  | { kind: 'inspect' | 'reach' | 'observe'; target: Point; range: number; hint: string }
  | { kind: 'horn' | 'wait' | 'avert' | 'junction' | 'signal' | 'finish'; hint: string };

// Indices correspond to the narrative beats. Landmark coordinates match the authored scene.
export const objectives: readonly Objective[] = [
  {
    kind: 'inspect',
    target: [0.32, 0.63, 1.59],
    range: 1.5,
    hint: 'มองกระดาษบนหน้ารถแล้วกด E เพื่อเก็บคำเตือนของย่า',
  },
  { kind: 'horn', hint: 'กด E บีบแตรเมื่อเห็นศาลไม้ด้านซ้าย ก่อนรถขับเลยไป' },
  { kind: 'wait', hint: 'ทนกลิ่นไว้ อย่าเปิดกระจก' },
  { kind: 'avert', hint: 'มองถนนไว้ อย่าจ้องหรือทักชายข้างทางทั้งสองครั้ง' },
  { kind: 'junction', hint: 'ย่าบอกให้เลี้ยวขวา เลือกทางเมื่อรถถึงทางแยก' },
  { kind: 'inspect', target: [0.32, 0.63, 1.59], range: 1.5, hint: 'มองหน้ารถแล้วกด E เพื่อพักจนเช้า' },
  { kind: 'reach', target: [0, 1.65, -4.18], range: 1.15, hint: 'เดินไปทางบันไดหน้าบ้านย่านุ่น' },
  {
    kind: 'inspect',
    target: [0.7, 2.46, -2.95],
    range: 1.8,
    hint: 'เดินเข้ากระท่อม มองกระดาษที่คานใต้หลังคา แล้วกด E',
  },
  {
    kind: 'inspect',
    target: [0.53, 0.79, -3.5],
    range: 1.65,
    hint: 'มองย่ามข้างที่นอนแล้วกด E เก็บของกับตะเกียง',
  },
  {
    kind: 'observe',
    target: [0.2, 1.15, -3.6],
    range: 7,
    hint: 'หันแสงตะเกียงไปที่เงาหน้าเล้า มองค้างจนเห็นชัด',
  },
  {
    kind: 'reach',
    target: [0, 1.65, 4],
    range: 0.85,
    hint: 'หันกลับแล้วเดินไปตามแสงตะเกียงที่ทางกลับกระท่อม',
  },
  {
    kind: 'inspect',
    target: [-0.65, 0.68, -3.6],
    range: 1.85,
    hint: 'เดินเข้ากระท่อม มองที่นอนแล้วกด E พัก',
  },
  { kind: 'reach', target: [0.2, 1.65, -4.2], range: 1.1, hint: 'เดินตามคันนาไปหาชายแก่' },
  { kind: 'signal', hint: 'บางอย่างดึงขาอยู่ กด E เรียกให้ชายแก่ช่วย' },
  {
    kind: 'inspect',
    target: [0.2, 1.05, -2.5],
    range: 1.75,
    hint: 'เดินเข้าใกล้ชายแก่ มองไปที่เขาแล้วกด E ยื่นห่อยาเส้น',
  },
  { kind: 'finish', hint: 'ผ่านคืนเฝ้ากระท่อมแล้ว' },
];
