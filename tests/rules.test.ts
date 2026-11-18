import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Episode, RULES } from '../src/game/rules';

const safe = { lookingAtMirror: false, inShower: true, lookingUp: false, lookingDown: true };
function wait(game: Episode, seconds: number, context = safe): void {
  for (let frames = 0; frames < Math.ceil(seconds * 60); frames++) game.update(1 / 60, context);
}
function prepare(): Episode {
  const game = new Episode();
  game.start();
  game.act('note');
  game.act('bath');
  wait(game, 8.1);
  assert.equal(game.bathFilled, true);
  game.act('shower');
  wait(game, 8.1);
  assert.equal(game.state.step, 2);
  return game;
}
function toHair(): Episode {
  const game = prepare();
  wait(game, 8.1);
  wait(game, 8.1);
  assert.equal(game.state.step, 4);
  game.act('rinse');
  assert.equal(game.state.step, 5);
  return game;
}

test('all nine source-derived rules form a complete playable win route', () => {
  const game = toHair();
  wait(game, 8.1);
  game.act('eyes');
  wait(game, 7.1);
  assert.equal(game.state.step, 7);
  game.act('eyes');
  game.act('towel');
  assert.equal(game.state.step, 8);
  game.act('bag');
  assert.equal(game.bagCollected, true);
  assert.equal(game.state.step, 9);
  assert.equal(game.state.phase, 'playing');
  game.act('exit');
  assert.equal(game.state.phase, 'won');
  assert.deepEqual(
    game.state.completed,
    RULES.map((_, i) => i),
  );
});

test('room exit is inert until the shower rite completes, then enforces belongings', () => {
  const early = prepare();
  early.act('exit');
  assert.equal(early.state.phase, 'playing');
  assert.match(early.state.message, /ประตูห้อง 316 ล็อกอยู่/);
  const bag = toHair();
  wait(bag, 8.1);
  bag.act('eyes');
  wait(bag, 7.1);
  bag.act('eyes');
  bag.act('towel');
  bag.act('exit');
  assert.equal(bag.state.phase, 'dead');
  assert.match(bag.state.cause, /กฎข้อ 9:/);
});

test('note is required before bath; shower before full bath breaks rule one', () => {
  const game = new Episode();
  game.start();
  game.act('bath');
  wait(game, 9);
  assert.equal(game.state.step, 0);
  assert.equal(game.bathFilled, false);
  game.act('shower');
  assert.equal(game.state.phase, 'dead');
  assert.match(game.state.cause, /กฎข้อ 1:/);
});

test('changing heater under running water breaks rule two', () => {
  const game = prepare();
  game.act('heater');
  assert.equal(game.state.phase, 'dead');
  assert.match(game.state.cause, /กฎข้อ 2:/);
});

test('mirror exposure is continuous and avertable; remains dangerous after its introduction', () => {
  const game = prepare();
  wait(game, 1.5, { ...safe, lookingAtMirror: true });
  wait(game, 0.1);
  wait(game, 1.5, { ...safe, lookingAtMirror: true });
  assert.equal(game.state.phase, 'playing');
  wait(game, 0.7, { ...safe, lookingAtMirror: true });
  assert.equal(game.state.phase, 'dead');
  assert.match(game.state.cause, /กฎข้อ 3:/);
});

test('hands event punishes looking up and soap requires real shower proximity', () => {
  const hands = prepare();
  wait(hands, 8.1);
  wait(hands, 1.3, { ...safe, lookingUp: true });
  assert.equal(hands.state.phase, 'dead');
  assert.match(hands.state.cause, /กฎข้อ 4:/);
  const soap = prepare();
  wait(soap, 16.2);
  wait(soap, 0.1, { ...safe, inShower: false });
  soap.act('rinse');
  assert.equal(soap.state.step, 4);
  wait(soap, 12.1);
  assert.equal(soap.state.phase, 'dead');
  assert.match(soap.state.cause, /กฎข้อ 5:/);
});

test('hair event needs bowed head and flowing water; blinking speeds recovery', () => {
  const interrupted = toHair();
  interrupted.act('shower');
  assert.equal(interrupted.state.phase, 'dead');
  assert.match(interrupted.state.cause, /กฎข้อ 6:/);
  const blinking = toHair();
  wait(blinking, 4);
  blinking.act('eyes');
  blinking.act('eyes');
  blinking.act('eyes');
  blinking.act('eyes');
  wait(blinking, 2.1);
  assert.equal(blinking.state.step, 6);
  const upright = toHair();
  wait(upright, 6.2, { ...safe, lookingDown: false });
  assert.equal(upright.state.phase, 'dead');
});

test('strange water allows warning time, then punishes failure to close or premature opening', () => {
  const late = toHair();
  wait(late, 8.1);
  wait(late, 3.1);
  assert.equal(late.state.phase, 'dead');
  assert.match(late.state.cause, /กฎข้อ 7:/);
  const peek = toHair();
  wait(peek, 8.1);
  peek.act('eyes');
  wait(peek, 2);
  peek.act('eyes');
  assert.equal(peek.state.phase, 'dead');
});

test('soaking and leaving belongings are independent real failure paths', () => {
  const bath = prepare();
  bath.act('bath');
  assert.equal(bath.state.phase, 'dead');
  assert.match(bath.state.cause, /กฎข้อ 8:/);
  const bag = toHair();
  wait(bag, 8.1);
  bag.act('eyes');
  wait(bag, 7.1);
  bag.act('eyes');
  bag.act('towel');
  bag.act('door');
  assert.equal(bag.state.phase, 'playing');
  bag.act('exit');
  assert.equal(bag.state.phase, 'dead');
  assert.match(bag.state.cause, /กฎข้อ 9:/);
});

test('pause, menu, and terminal states freeze timers; retry resets the episode', () => {
  const game = new Episode();
  wait(game, 5);
  assert.equal(game.state.elapsed, 0);
  game.start();
  game.act('note');
  game.act('bath');
  game.pause();
  wait(game, 9);
  assert.equal(game.state.elapsed, 0);
  assert.equal(game.bathFilled, false);
  game.resume();
  wait(game, 8.1);
  game.act('bath');
  assert.equal(game.state.phase, 'dead');
  const elapsed = game.state.elapsed;
  wait(game, 5);
  assert.equal(game.state.elapsed, elapsed);
  game.start();
  assert.equal(game.state.phase, 'playing');
  assert.equal(game.state.step, 0);
  assert.equal(game.state.violations, 0);
  assert.deepEqual(game.state.completed, []);
  assert.equal(game.bathFilled || game.bagCollected || game.waterOn || game.eyesClosed, false);
});
