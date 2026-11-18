/** Paraphrased rules from the supplied episode, mapped to playable, telegraphed events. */
export interface EpisodeState {
  phase: 'menu' | 'playing' | 'paused' | 'dead' | 'won';
  step: number;
  elapsed: number;
  stepElapsed: number;
  dread: number;
  violations: number;
  message: string;
  cause: string;
  noteRead: boolean;
  completed: number[];
}
export type Action =
  | 'note'
  | 'lock'
  | 'light'
  | 'shower'
  | 'eyes'
  | 'mirror'
  | 'door'
  | 'towel'
  | 'drain'
  | 'leave'
  | 'exit'
  | 'bath'
  | 'heater'
  | 'rinse'
  | 'bag';
export const RULES = [
  {
    title: 'เติมอ่างให้เต็ม',
    body: 'ก่อนเริ่มอาบน้ำ ต้องเติมน้ำในอ่างให้เต็มทุกครั้ง แม้ไม่ได้ตั้งใจจะลงแช่ก็ตาม',
    objective: 'อ่านจดหมาย แล้วเปิดก๊อกเติมอ่าง',
    hint: 'เล็งจดหมายแล้วกด E จากนั้นเปิดก๊อกที่อ่าง รอ 8 วินาที',
  },
  {
    title: 'อย่าปรับอุณหภูมิ',
    body: 'น้ำอาจเย็นหรือร้อนผิดปกติ อย่าปรับเครื่องทำน้ำอุ่น ให้อาบต่อไปโดยไม่แตะมัน',
    objective: 'เปิดฝักบัว อดทนต่ออุณหภูมิที่เปลี่ยนไป',
    hint: 'เปิดฝักบัวแล้วรอ 8 วินาที อย่าแตะเครื่องทำน้ำอุ่น',
  },
  {
    title: 'หลีกเลี่ยงกระจก',
    body: 'อย่าจ้องกระจก เงาที่เห็นอาจเคลื่อนไหวหรือยิ้มได้เอง และอาจไม่ใช่เงาของคุณ',
    objective: 'หันหนีจากกระจก 8 วินาที',
    hint: 'มองพื้นหรือผนัง อย่าจ้องกระจกเกิน 2 วินาที กฎนี้ยังใช้จนกว่าจะออกจากห้อง',
  },
  {
    title: 'อย่าเงยหน้ามอง',
    body: 'หากรู้สึกเหมือนมีมือสัมผัสหรือสระผมให้ อย่าเงยหน้าขึ้นไปดูว่าใครอยู่ข้างบน',
    objective: 'อย่าเงยหน้า รอให้สัมผัสหายไป',
    hint: 'มองระดับสายตาหรือต่ำกว่าไว้ 8 วินาที',
  },
  {
    title: 'ล้างสบู่ออกจากตาทันที',
    body: 'ถ้าสบู่หรือแชมพูเข้าตา ให้รีบใช้น้ำล้าง อย่าปล่อยให้บางสิ่งเข้ามาช่วยคุณ',
    objective: 'กลับใต้ฝักบัว แล้วกด E ล้างตาภายใน 12 วินาที',
    hint: 'ยืนใต้สายน้ำแล้วกด E ที่จุดล้างตา ไม่ต้องแตะเครื่องทำน้ำอุ่น',
  },
  {
    title: 'ก้มหน้า ปล่อยให้น้ำไหล',
    body: 'เส้นผมแปลกปลอมและภาพเลือดเป็นภาพหลอน ก้มหน้าอยู่ใต้ฝักบัว ปล่อยให้น้ำไหลจนสิ่งเหล่านั้นหายไป การกะพริบตาช่วยได้',
    objective: 'ก้มหน้าค้างใต้ฝักบัวที่เปิดอยู่ 8 วินาที',
    hint: 'มองพื้นใต้ฝักบัว อย่าปิดน้ำ กด C สองครั้งเพื่อกะพริบตา',
  },
  {
    title: 'หลับตาจนกว่าน้ำปกติ',
    body: 'ถ้ากำลังหลับตาและรู้สึกว่าน้ำเปลี่ยนสภาพ อย่าเพิ่งลืมตา รอให้น้ำกลับเป็นปกติก่อน',
    objective: 'กด C หลับตา แล้วรอให้น้ำกลับปกติ',
    hint: 'มีเวลา 3 วินาทีให้หลับตา จากนั้นรอ 7 วินาทีจนข้อความบอกว่าปลอดภัย',
  },
  {
    title: 'อย่าลงแช่ในอ่าง',
    body: 'หลีกเลี่ยงการลงแช่ น้ำในอ่างอาจเปลี่ยนเป็นสีเลือด และบางสิ่งอาจกดคุณให้จมลง',
    objective: 'หยิบผ้าขนหนู โดยไม่ลงแช่อ่าง',
    hint: 'ลืมตาด้วย C แล้วหยิบผ้าบนราว อย่ากด E ที่อ่างที่เติมเต็มแล้ว',
  },
  {
    title: 'นำของออกไปให้ครบ',
    body: 'ก่อนออกจากห้อง ตรวจและนำของส่วนตัวของคุณออกไปทั้งหมด อย่าทิ้งสิ่งใดไว้ข้างใน',
    objective: 'เก็บกระเป๋าจากห้องนอน แล้วเปิดประตูห้อง 316 ออกไป',
    hint: 'เล็งกระเป๋าบนชั้นวางในห้องนอนแล้วกด E จากนั้นไปเปิดประตู 316 อย่าหันไปจ้องกระจก',
  },
] as const;

type Context = {
  lookingAtMirror: boolean;
  inShower: boolean;
  lookingUp?: boolean;
  lookingDown?: boolean;
};
export class Episode {
  state: EpisodeState = this.fresh();
  eyesClosed = false;
  waterOn = false;
  locked = false;
  lightsOn = true;
  bathFilled = false;
  bagCollected = false;
  private fillingBath = false;
  private mirrorTime = 0;
  private upTime = 0;
  private hairUpTime = 0;
  private bowedTime = 0;
  private wrongBowTime = 0;
  private closedTime = 0;
  private closedDuringStrangeWater = false;
  private context: Context = { lookingAtMirror: false, inShower: false };

  private fresh(): EpisodeState {
    return {
      phase: 'menu',
      step: 0,
      elapsed: 0,
      stepElapsed: 0,
      dread: 0,
      violations: 0,
      message: '',
      cause: '',
      noteRead: false,
      completed: [],
    };
  }
  start(): void {
    this.state = this.fresh();
    this.state.phase = 'playing';
    this.state.message = '00:13 น. — อ่านจดหมายก่อนอาบน้ำ มีเก้าข้อที่คุณต้องจำ';
    this.eyesClosed =
      this.waterOn =
      this.locked =
      this.bathFilled =
      this.bagCollected =
      this.fillingBath =
        false;
    this.lightsOn = true;
    this.mirrorTime = this.upTime = this.hairUpTime = this.bowedTime = this.wrongBowTime = this.closedTime = 0;
    this.closedDuringStrangeWater = false;
    this.context = { lookingAtMirror: false, inShower: false };
  }
  pause(): void {
    if (this.state.phase === 'playing') this.state.phase = 'paused';
  }
  resume(): void {
    if (this.state.phase === 'paused') this.state.phase = 'playing';
  }
  private advance(message: string): void {
    this.state.completed.push(this.state.step);
    this.state.step++;
    this.state.stepElapsed = 0;
    this.state.message = message;
  }
  private fail(cause: string): void {
    this.state.phase = 'dead';
    this.state.violations++;
    this.state.cause = this.state.message = cause;
    this.state.dread = 1;
    this.eyesClosed = this.waterOn = false;
  }
  act(action: Action): void {
    if (this.state.phase !== 'playing') return;
    const step = this.state.step;
    if (action === 'note') {
      this.state.noteRead = true;
      this.state.message = 'อ่านครบทั้งเก้าข้อแล้ว เริ่มจากเติมอ่างให้เต็ม';
      return;
    }
    if (action === 'eyes') {
      this.eyesClosed = !this.eyesClosed;
      if (step === 6) {
        if (this.eyesClosed) this.closedDuringStrangeWater = true;
        else if (this.closedDuringStrangeWater) this.fail('กฎข้อ 7: คุณลืมตาทั้งที่น้ำยังไม่กลับเป็นปกติ');
      }
      if (
        step === 5 &&
        !this.eyesClosed &&
        this.context.inShower &&
        this.context.lookingDown &&
        this.waterOn
      )
        this.bowedTime += 1;
      return;
    }
    if (this.eyesClosed) {
      this.state.message = 'คุณมองไม่เห็นขณะหลับตา กด C เพื่อลืมตาเมื่อปลอดภัย';
      return;
    }
    if (action === 'lock') {
      this.locked = !this.locked;
      this.state.message = this.locked ? 'คุณลงกลอนประตูแล้ว' : 'กลอนถูกปลดแล้ว';
      return;
    }
    if (action === 'light') {
      this.lightsOn = !this.lightsOn;
      this.state.message = this.lightsOn ? 'ไฟห้องน้ำติดขึ้น' : 'คุณดับไฟ ความมืดไม่ช่วยให้ลืมกฎ';
      return;
    }
    if (action === 'bath') {
      if (this.bathFilled) {
        this.fail('กฎข้อ 8: คุณลงแช่ในอ่างที่เต็มแล้ว บางสิ่งดึงคุณลงไปใต้ผิวน้ำ');
        return;
      }
      if (!this.state.noteRead) {
        this.state.message = 'อ่านจดหมายก่อนเริ่มอาบน้ำ';
        return;
      }
      this.fillingBath = true;
      this.state.message = 'เปิดก๊อกอ่างแล้ว รอให้น้ำเต็มก่อนใช้ฝักบัว';
      return;
    }
    if (action === 'heater') {
      if (this.waterOn) this.fail('กฎข้อ 2: คุณปรับเครื่องทำน้ำอุ่น แทนที่จะยอมรับอุณหภูมิที่เปลี่ยนไป');
      else this.state.message = 'อย่าแตะเครื่องทำน้ำอุ่น แม้น้ำจะร้อนหรือเย็นผิดปกติ';
      return;
    }
    if (action === 'shower') {
      if (!this.bathFilled) {
        this.fail('กฎข้อ 1: คุณเปิดฝักบัวก่อนเติมอ่างให้เต็ม');
        return;
      }
      if (step === 5 && this.waterOn) {
        this.fail('กฎข้อ 6: คุณปิดน้ำ ทั้งที่ต้องก้มหน้าและปล่อยให้น้ำไหลจนภาพหลอนหาย');
        return;
      }
      if (step === 6 && this.waterOn) {
        this.state.message = 'ปล่อยน้ำให้ไหล รอจนกลับเป็นปกติ';
        return;
      }
      this.waterOn = !this.waterOn;
      this.state.message = this.waterOn
        ? 'น้ำเปลี่ยนจากเย็นจัดเป็นร้อน… อย่าปรับเครื่องทำน้ำอุ่น'
        : 'คุณปิดฝักบัวแล้ว';
      return;
    }
    if (action === 'rinse') {
      if (step !== 4) {
        this.state.message = 'คุณล้างหน้าด้วยน้ำ พยายามอย่ามองกระจก';
        return;
      }
      if (this.context.inShower && this.waterOn)
        this.advance('ล้างสบู่ออกแล้ว… มีเส้นผมของใครบางคนไหลลงมา ก้มหน้าและปล่อยน้ำต่อไป');
      else this.state.message = 'กลับไปใต้ฝักบัวที่เปิดอยู่ แล้วกด E เพื่อล้างตา';
      return;
    }
    if (action === 'towel') {
      if (step === 7) this.advance('เช็ดตัวเสร็จแล้ว ตรวจของส่วนตัวให้ครบก่อนออกจากห้องน้ำ');
      else this.state.message = 'ยังอาบน้ำไม่เสร็จ ทำตามกฎปัจจุบันก่อน';
      return;
    }
    if (action === 'bag') {
      if (step === 8) {
        this.bagCollected = true;
        this.advance('เก็บของส่วนตัวครบแล้ว เดินผ่านห้องนอนไปเปิดประตูห้อง 316 ออกไป');
      } else this.state.message = 'กระเป๋าของคุณอยู่บนชั้นวางในห้องนอน อย่าลืมเก็บก่อนออกไป';
      return;
    }
    if (action === 'exit') {
      if (step >= 9 && this.bagCollected) {
        this.state.phase = 'won';
        this.state.dread = 0;
        this.state.message = 'คุณออกจากห้อง 316 พร้อมของครบแล้ว… ต่อไปอย่าอาบน้ำหลังเที่ยงคืน';
        this.eyesClosed = this.waterOn = this.locked = false;
      } else if (step === 8) this.fail('กฎข้อ 9: คุณออกไปโดยทิ้งของส่วนตัวไว้ในห้อง');
      else this.state.message = 'ประตูห้อง 316 ล็อกอยู่ จนกว่าพิธีในห้องน้ำจะเสร็จ';
      return;
    }
    if (action === 'door' || action === 'leave') {
      if (action === 'leave' && step === 8) {
        this.fail('กฎข้อ 9: คุณออกไปโดยทิ้งของส่วนตัวไว้ในห้องน้ำ');
        return;
      }
      this.state.message = 'คุณขยับประตูห้องน้ำ';
      return;
    }
    if (action === 'mirror') {
      this.state.message = 'เงาในกระจกยิ้มให้คุณ… หันหนีเดี๋ยวนี้';
      return;
    }
    if (action === 'drain') this.state.message = 'เส้นผมรวมตัวอยู่ตรงท่อ ปล่อยให้น้ำพามันลงไป';
  }
  update(dt: number, context: Context): void {
    this.context = context;
    if (this.state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    const delta = Math.min(dt, 0.1);
    this.state.elapsed += delta;
    this.state.stepElapsed += delta;
    const step = this.state.step;
    this.state.dread = Math.min(
      0.92,
      0.08 + step * 0.085 + (step === 4 ? this.state.stepElapsed * 0.018 : 0),
    );
    if (step >= 2 && !this.eyesClosed && context.lookingAtMirror) this.mirrorTime += delta;
    else this.mirrorTime = 0;
    if (this.mirrorTime >= 2) {
      this.fail('กฎข้อ 3: คุณจ้องเงาในกระจกนานเกินไป มันรู้แล้วว่าคุณมองเห็น');
      return;
    }
    if (step === 0) {
      if (this.fillingBath) this.bowedTime += delta;
      if (this.bowedTime >= 8) {
        this.bathFilled = true;
        this.bowedTime = 0;
        this.advance('อ่างเต็มแล้ว ห้ามลงแช่ — เปิดฝักบัว และอย่าปรับเครื่องทำน้ำอุ่น');
      }
    } else if (step === 1) {
      if (this.waterOn) this.bowedTime += delta;
      if (this.bowedTime >= 8) {
        this.bowedTime = 0;
        this.advance('อุณหภูมิคงที่แล้ว… เงาในกระจกเริ่มยิ้ม หันหนีจากมัน');
      }
    } else if (step === 2 && this.state.stepElapsed >= 8)
      this.advance('รู้สึกเหมือนมีมือสองข้างสระผมให้ อย่าเงยหน้าขึ้นไปดู');
    else if (step === 3) {
      if (context.lookingUp) this.upTime += delta;
      else this.upTime = 0;
      if (this.upTime >= 1.2) this.fail('กฎข้อ 4: คุณเงยหน้ามองสิ่งที่กำลังสัมผัสศีรษะคุณ');
      else if (this.state.stepElapsed >= 8)
        this.advance('แชมพูเข้าตา! กลับใต้ฝักบัวแล้วกด E ล้างออกภายใน 12 วินาที');
    } else if (step === 4 && this.state.stepElapsed >= 12)
      this.fail('กฎข้อ 5: คุณไม่ล้างแชมพูออกจากตาให้ทันเวลา');
    else if (step === 5) {
      // The falling-hair beat: looking up at it earns an immediate scare, not the slow bow timer.
      if (context.lookingUp) this.hairUpTime += delta;
      else this.hairUpTime = 0;
      if (this.hairUpTime >= 0.4) {
        this.fail('กฎข้อ 6: คุณเงยหน้าขึ้นไปดูตอนที่เส้นผมไหลลงมา เจ้าของเส้นผมกำลังอยู่เหนือหัวคุณ');
        return;
      }
      if (context.inShower && context.lookingDown && this.waterOn) {
        this.bowedTime += delta;
        this.wrongBowTime = 0;
      } else {
        this.bowedTime = 0;
        if (this.state.stepElapsed >= 3) this.wrongBowTime += delta;
      }
      if (this.wrongBowTime >= 3)
        this.fail('กฎข้อ 6: คุณไม่ก้มหน้าอยู่ใต้สายน้ำ เพื่อรอให้เส้นผมและภาพหลอนหายไป');
      else if (this.bowedTime >= 8) {
        this.bowedTime = 0;
        this.advance('เส้นผมหายไปแล้ว หลับตาด้วย C — สายน้ำกำลังเปลี่ยนสภาพ อย่าลืมตาจนกว่าจะปกติ');
      }
    } else if (step === 6) {
      if (this.eyesClosed) {
        this.closedDuringStrangeWater = true;
        this.closedTime += delta;
        if (this.closedTime >= 7) this.advance('น้ำกลับเป็นปกติแล้ว ลืมตาได้ หยิบผ้าขนหนู และอย่าลงแช่อ่าง');
      } else if (this.state.stepElapsed >= 3)
        this.fail('กฎข้อ 7: คุณไม่หลับตาเมื่อสายน้ำเริ่มเปลี่ยนสภาพ กด C ให้ทันในครั้งหน้า');
    }
  }
}
