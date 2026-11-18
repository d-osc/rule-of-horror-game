export function agedPaper(page: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  let seed = 316 + page;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;

  ctx.fillStyle = page ? '#c3aa7c' : '#cfba91';
  ctx.fillRect(0, 0, 384, 512);
  for (let i = 0; i < 10500; i++) {
    ctx.fillStyle = random() > 0.4 ? '#67432215' : '#fff3d22e';
    ctx.fillRect(random() * 384, random() * 512, 1 + random() * 3, 0.5 + random());
  }
  const stain = (x: number, y: number, radius: number, color: string) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, '#6c351900');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  stain(17, 490, 124, '#74411a75');
  stain(374, 44, 102, '#6b3b1b80');
  stain(page ? 34 : 351, 337, 66, '#79502057');
  for (let i = 0; i < 24; i++)
    stain(random() * 384, random() * 512, 5 + random() * 19, '#78512624');

  // Repeated folding leaves a narrow shadow and a bright ridge in the fibers.
  for (const y of [126, 317]) {
    const fold = ctx.createLinearGradient(0, y - 7, 0, y + 6);
    fold.addColorStop(0, '#50301800');
    fold.addColorStop(0.45, '#50301834');
    fold.addColorStop(0.55, '#ffeccc66');
    fold.addColorStop(1, '#ffeccc00');
    ctx.fillStyle = fold;
    ctx.fillRect(0, y - 7, 384, 13);
  }
  ctx.strokeStyle = '#79532e65';
  ctx.lineWidth = 5;
  ctx.strokeRect(2, 2, 380, 508);
  return canvas;
}
