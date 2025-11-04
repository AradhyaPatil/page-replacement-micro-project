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
    const arr = [];
    for(const r of refs){
      const idx = arr.indexOf(r);
      const hit = idx !== -1;
      if(hit){
        // move to most recently used end
        arr.splice(idx,1);
        arr.push(r);
        const display = Array.from({length:frames}, (_,i)=> arr[i] ?? null);
        steps.push({ref:r, frames:display, hit:true});
        continue;
      }
      // fault
      if(arr.length < frames){
        arr.push(r);
      } else {
        arr.shift(); // remove least recently used
        arr.push(r);
      }
      const display = Array.from({length:frames}, (_,i)=> arr[i] ?? null);
      steps.push({ref:r, frames:display, hit:false});
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

  // Build frames in descending order (frames-1 down to 0)
  for(let f=frames-1; f>=0; f--){
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('div');
    label.className = 'frame-label';
    label.textContent = `Frame ${f}`;
    row.appendChild(label);
    for(let s=0; s<steps.length; s++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('data-step', s); // Mark which step this cell belongs to
      cell.setAttribute('data-frame', f); // Mark which frame this cell belongs to
      const val = steps[s].frames[f];
      cell.textContent = val === null || val === undefined ? '' : String(val);
      // Initially hide all cells - they'll be revealed during step/play
      cell.style.visibility = 'hidden';
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

simulateBtn.addEventListener('click', ()=>{
  prepareAndStart();
});

stepBtn.addEventListener('click', ()=>{
  if(!state) return;
  // If we reached the end, reset to start
  if(state.idx >= state.steps.length){
    state.idx = 0;
    // Clear all highlights and hide all cells
    visual.querySelectorAll('.cell').forEach(c=> { 
      c.style.boxShadow = ''; 
      c.classList.remove('hit','fault','reveal');
      c.style.visibility = 'hidden';
    });
    stepEl.textContent = 0;
    faultsEl.textContent = 0;
  }
  highlightStep(state.idx);
  state.idx++;
});

playBtn.addEventListener('click', ()=>{
  if(!state) return;
  if(playInterval){
    clearInterval(playInterval); playInterval = null; playBtn.textContent = 'Play';
    return;
  }
  // If we reached the end, reset to start before playing
  if(state.idx >= state.steps.length){
    state.idx = 0;
    // Clear all highlights and hide all cells
    visual.querySelectorAll('.cell').forEach(c=> { 
      c.style.boxShadow = ''; 
      c.classList.remove('hit','fault','reveal');
      c.style.visibility = 'hidden';
    });
    stepEl.textContent = 0;
    faultsEl.textContent = 0;
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
  // Clear only box shadows, but keep hit/fault classes from previous steps
  visual.querySelectorAll('.cell').forEach(c=> { c.style.boxShadow = ''; });
  
  // Reveal all cells up to and including the current step with animation
  visual.querySelectorAll('.cell').forEach(c => {
    const stepNum = parseInt(c.getAttribute('data-step'));
    if(stepNum <= i){
      // Only add reveal animation to the current step's new cells
      if(stepNum === i && c.style.visibility === 'hidden'){
        c.classList.add('reveal');
      }
      c.style.visibility = 'visible';
    }
  });
  
  const currentStep = state.steps[i];
  const gridRows = visual.querySelectorAll('.grid .row');
  
  // Find which frame position changed or was accessed FIRST
  let changedFrameIndex = -1;
  
  if(currentStep.hit){
    // On a hit, highlight the frame that contains the referenced page
    for(let f=0; f<currentStep.frames.length; f++){
      if(currentStep.frames[f] === currentStep.ref){
        changedFrameIndex = f;
        break;
      }
    }
  } else {
    // On a fault, check if replacedAt is specified
    if(currentStep.replacedAt !== undefined){
      changedFrameIndex = currentStep.replacedAt;
    } else {
      // For LRU or when no replacedAt is specified, compare with previous step
      if(i > 0){
        const prevFrames = state.steps[i-1].frames;
        for(let f=0; f<currentStep.frames.length; f++){
          if(currentStep.frames[f] !== prevFrames[f]){
            changedFrameIndex = f;
            break;
          }
        }
      } else {
        // First step - find the first non-null frame
        for(let f=0; f<currentStep.frames.length; f++){
          if(currentStep.frames[f] !== null){
            changedFrameIndex = f;
            break;
          }
        }
      }
    }
  }
  
  // Lightly outline ALL cells in the current column EXCEPT the changed one
  // Note: Rows are in reverse order (frames-1 to 0), so we need to map frame index to row index
  const totalFrames = state.frames;
  gridRows.forEach((row, rowIndex) => {
    const colCell = row.children[i+1]; // +1 for label cell
    const actualFrameIndex = totalFrames - 1 - rowIndex; // Convert row index to frame index
    if(colCell && actualFrameIndex !== changedFrameIndex){
      colCell.style.boxShadow = 'inset 0 0 0 2px rgba(37,99,235,0.12)';
    }
  });
  
  // Highlight only the changed cell with stronger border and hit/fault color
  if(changedFrameIndex !== -1){
    // Convert frame index to row index (reverse order)
    const rowIndex = totalFrames - 1 - changedFrameIndex;
    if(gridRows[rowIndex]){
      const cell = gridRows[rowIndex].children[i+1]; // +1 because first child is label
      if(cell){
        // Use green for hit, red for fault as the highlight color
        const highlightColor = currentStep.hit ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        cell.style.boxShadow = `inset 0 0 0 3px ${highlightColor}`;
        // Mark hit/fault color - this will persist after the step
        cell.classList.add(currentStep.hit ? 'hit' : 'fault');
      }
    }
  }
  
  stepEl.textContent = i+1;

  // update faults dynamically
  let faultCount = 0;
  for(let s=0; s<=i; s++){
    if(!state.steps[s].hit) faultCount++;
  }
  faultsEl.textContent = faultCount;
}

