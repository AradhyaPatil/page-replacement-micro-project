// Page Replacement Visualizer - FIFO, LRU, Optimal
const refInput = document.getElementById('refInput');
const framesInput = document.getElementById('framesInput');
const algoSelect = document.getElementById('algoSelect');
const simulateBtn = document.getElementById('simulateBtn');
const stepBtn = document.getElementById('stepBtn');
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');
const visual = document.getElementById('visual');
const hitsEl = document.getElementById('hits');
const faultsEl = document.getElementById('faults');
const stepEl = document.getElementById('step');
const totalStepsEl = document.getElementById('totalSteps');

let state = null;
let playInterval = null;

function parseRefString(s){
  if(!s) return [];
  return s.split(/[\s,]+/).map(x=>x.trim()).filter(x=>x!=='').map(Number);
}

function simulate(refs, frames, algo){
  // returns array of steps; each step: {ref, frames: [...], hit: boolean}
  const steps = [];
  const frameArr = new Array(frames).fill(null);
  if(algo === 'FIFO'){
    let pointer = 0;
    for(const r of refs){
      const hit = frameArr.includes(r);
      if(hit){
        steps.push({ref:r, frames:[...frameArr], hit:true});
        continue;
      }
      // fault: replace at pointer
      frameArr[pointer] = r;
      steps.push({ref:r, frames:[...frameArr], hit:false, replacedAt:pointer});
      pointer = (pointer+1)%frames;
    }
    return steps;
  } else if(algo === 'LRU'){
    const frameArr = new Array(frames).fill(null);
    const accessOrder = [];
    for(const r of refs){
      const frameIdx = frameArr.indexOf(r);
      const hit = frameIdx !== -1;
      if(hit){
        const orderIdx = accessOrder.indexOf(frameIdx);
        accessOrder.splice(orderIdx, 1);
        accessOrder.push(frameIdx);
        steps.push({ref:r, frames:[...frameArr], hit:true});
        continue;
      }
      let targetFrame;
      if(accessOrder.length < frames){
        targetFrame = accessOrder.length;
        accessOrder.push(targetFrame);
      } else {
        targetFrame = accessOrder.shift();
        accessOrder.push(targetFrame);
      }
      frameArr[targetFrame] = r;
      steps.push({ref:r, frames:[...frameArr], hit:false, replacedAt:targetFrame});
    }
    return steps;
  } else if(algo === 'Optimal'){
    const arr = [];
    for(let i=0;i<refs.length;i++){
      const r = refs[i];
      const hit = arr.indexOf(r) !== -1;
      if(hit){
        const display = Array.from({length:frames}, (_,j)=> arr[j] ?? null);
        steps.push({ref:r, frames:display, hit:true});
        continue;
      }
      if(arr.length < frames){
        arr.push(r);
        const display = Array.from({length:frames}, (_,j)=> arr[j] ?? null);
        steps.push({ref:r, frames:display, hit:false});
        continue;
      }
      // need to replace a page that is used farthest in future (or not used)
      let replaceIdx = -1;
      let farthest = -1;
      for(let j=0;j<arr.length;j++){
        const page = arr[j];
        // find next index where page appears after i
        let next = refs.slice(i+1).indexOf(page);
        if(next === -1){
          replaceIdx = j;
          break;
        } else {
          // actual position = i+1+next
          if(next > farthest){ farthest = next; replaceIdx = j; }
        }
      }
      arr[replaceIdx] = r;
      const display = Array.from({length:frames}, (_,j)=> arr[j] ?? null);
      steps.push({ref:r, frames:display, hit:false, replacedAt:replaceIdx});
    }
    return steps;
  }
  return steps;
}

function buildGrid(steps, refs, frames){
  visual.innerHTML = '';
  // reference sequence row
  const refRow = document.createElement('div');
  refRow.className = 'ref-seq';
  refs.forEach(r=>{
    const d = document.createElement('div');
    d.className = 'ref-item';
    d.textContent = r;
    refRow.appendChild(d);
  });
  visual.appendChild(refRow);

  // grid container: rows = frames, columns = steps
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateRows = `repeat(${frames}, auto)`;
  visual.appendChild(grid);

  for(let f=0; f<frames; f++){
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('div');
    label.className = 'frame-label';
    label.textContent = `Frame ${f}`;
    row.appendChild(label);
    for(let s=0; s<steps.length; s++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      const val = steps[s].frames[f];
      cell.textContent = val === null || val === undefined ? '' : String(val);
      // mark hit/fault by comparing with current ref and presence
      const isHit = steps[s].hit && steps[s].frames.includes(steps[s].ref);
      // we will mark cells where the displayed value equals the current ref as either hit or fault
      if(val === steps[s].ref){
        cell.classList.add(steps[s].hit ? 'hit' : 'fault');
      }
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }

  // legend
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `<div class="small"><span style="display:inline-block;width:12px;height:12px;background:#d1fae5;border-radius:3px;margin-right:6px"></span> Hit</div>
  <div class="small"><span style="display:inline-block;width:12px;height:12px;background:#fee2e2;border-radius:3px;margin-right:6px"></span> Fault</div>`;
  visual.appendChild(legend);
}

function prepareAndStart(){
  const refs = parseRefString(refInput.value || '');
  const frames = Math.max(1, Number(framesInput.value)||1);
  const algo = algoSelect.value;
  if(refs.length === 0){
    alert('Enter a reference string.');
    return;
  }
  const steps = simulate(refs, frames, algo);
  state = {refs, frames, algo, steps, idx:0, hits:0, faults:0};
  // count hits/faults
  let hits = 0, faults = 0;
  for(const s of steps){ if(s.hit) hits++; else faults++; }
  state.hits = hits; state.faults = faults;
  hitsEl.textContent = hits; faultsEl.textContent = faults;
  stepEl.textContent = 0; totalStepsEl.textContent = steps.length;
  buildGrid(steps, refs, frames);
  // enable stepping controls
  stepBtn.disabled = false;
  playBtn.disabled = false;
  simulateBtn.disabled = true;
}

function resetAll(){
  if(playInterval) { clearInterval(playInterval); playInterval = null; playBtn.textContent = 'Play'; }
  state = null;
  visual.innerHTML = '';
  hitsEl.textContent = '0'; faultsEl.textContent = '0'; stepEl.textContent = '0'; totalStepsEl.textContent = '0';
  stepBtn.disabled = true; playBtn.disabled = true; simulateBtn.disabled = false;
}

function highlightStep(i){
  if(!state) return;
  const cells = visual.querySelectorAll('.grid .row');
  // Instead of complex per-cell toggles we will scroll into view the column and add a small border
  // Reset borders
  visual.querySelectorAll('.cell').forEach(c=> c.style.boxShadow = '');
  // mark column i by adding boxShadow to each cell in that column
  const gridRows = visual.querySelectorAll('.grid .row');
  gridRows.forEach(row=>{
    const cell = row.children[i+1]; // +1 because first child is label
    if(cell) cell.style.boxShadow = 'inset 0 0 0 2px rgba(37,99,235,0.12)';
  });
  // update step counters
  stepEl.textContent = i+1;
}

simulateBtn.addEventListener('click', ()=>{
  prepareAndStart();
});

stepBtn.addEventListener('click', ()=>{
  if(!state) return;
  if(state.idx >= state.steps.length) return;
  highlightStep(state.idx);
  state.idx++;
});

playBtn.addEventListener('click', ()=>{
  if(!state) return;
  if(playInterval){
    clearInterval(playInterval); playInterval = null; playBtn.textContent = 'Play';
    return;
  }
  playBtn.textContent = 'Pause';
  playInterval = setInterval(()=>{
    if(state.idx >= state.steps.length){
      clearInterval(playInterval); playInterval = null; playBtn.textContent = 'Play';
      return;
    }
    highlightStep(state.idx);
    state.idx++;
  }, 700);
});

resetBtn.addEventListener('click', resetAll);

// keyboard shortcuts: Space to step when prepared
document.addEventListener('keydown', (e)=>{
  if(e.code === 'Space' && !e.repeat){
    if(!state) return;
    stepBtn.click();
    e.preventDefault();
  }
});

function highlightStep(i){
  if(!state) return;
  const cells = visual.querySelectorAll('.grid .row');
  visual.querySelectorAll('.cell').forEach(c=> c.style.boxShadow = '');
  const gridRows = visual.querySelectorAll('.grid .row');
  gridRows.forEach(row=>{
    const cell = row.children[i+1]; // +1 because first child is label
    if(cell) cell.style.boxShadow = 'inset 0 0 0 2px rgba(37,99,235,0.12)';
  });
  stepEl.textContent = i+1;

  // update faults dynamically
  let faultCount = 0;
  for(let s=0; s<=i; s++){
    if(!state.steps[s].hit) faultCount++;
  }
  faultsEl.textContent = faultCount;
}

