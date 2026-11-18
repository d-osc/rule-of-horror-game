import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/mounting-fixes';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chromium',headless:true});const page=await browser.newPage({viewport:{width:1100,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:4188/?qa=1');await page.waitForFunction(()=>!document.getElementById('start').disabled);
await page.evaluate(async()=>{const h=window.__THREE_GAME_TEST_HOOKS__;await h.setState('active-play');h.setPausedForScreenshot(true);h.setReducedMotion(true)});
const views=[['mirror-side',[-.05,1.72,-3.02],[-.8,1.7,-3.36]],['paper-side',[-1.05,1.6,-3.12],[-1.77,1.6,-3.474]],['chain',[-2.35,1.4,1.9],[-3.1,1.4,1.16]],['bottles',[-.5,1.35,-2.65],[-1.15,1.15,-3.12]],['room',[0,1.65,2.5],[-.5,1.4,-3.2]]];
for(const[name,pos,target]of views){await page.evaluate(({pos,target})=>{const q=window.__HORROR_QA__;q.camera.position.set(...pos);q.look(...target)}, {pos,target});await page.waitForTimeout(350);await page.screenshot({path:`${out}/${name}.png`})}
await writeFile(`${out}/errors.json`,JSON.stringify(errors));await browser.close();console.log(JSON.stringify({errors,views:views.map(v=>v[0])}));
