var RSpan = function (_cont) {
  
  // ===============================================================================================
  // ==[ PRIVATE ]==================================================================================
  // ===============================================================================================
  
  var CONST = {
    seq: {
      type: { instruction:0, btn:1, item:2, stim:3, timerStart:4, timerStop:5, respTimeRec:6, respTimeCalc:7, newTrial:8, nextItem:9, recallPrompt:10, recallOutcome:11, resetStimRespAcc: 12 }
    },
    respTimeSDRatio: 2.5
  };
  
  var dt = {
    items           : [],
    seq             : [],
    stim            : [],
    respTimes       : [],
    respTimeAvg     : 0,
    respTimeSD      : 0,
    timeBtnDelay    : 250,
    timeItemPres    : 1000,
    timeStimPres    : 0,
    timeOutcomePres : 2000,
    trials          : []
  };
  
  var st = {
    currItemIdx  : 0,
    currSeqIdx   : 0,
    currTrialIdx : -1,
    stimRespAcc  : 0,
    stimRespN    : 0,  // number of stimuli responses
    stimResp1    : 0,  // number of correct stimuli responses
    stimTimeout  : null
  };
  
  var ui = {
    btn               : null,
    btnCont           : null,
    cont              : null,
    mask              : null,
    recallOutcomeCont : null,
    recallPromptCont  : null,
    recallSeqCont     : null,
    roCont            : null,  // reset-ok
    roOk              : null,
    roReset           : null,
    roBack            : null,
    stimRespAccCont   : null,
    tfCont            : null,  // true-false
    tfResp0           : null,
    tfResp1           : null,
    txtInstr          : null,
    txtInstrCont      : null,
    txtItem           : null,
    txtItemCont       : null,
    txtStim           : null,
    txtStimCont       : null
  };
  
  var timer = Timer();
  
  
  // -----------------------------------------------------------------------------------------------
  function calcRespTime() {
    var N = dt.respTimes.length;
    dt.respTimeAvg  = $lfold(function (a,b) { return a+b; }, dt.respTimes, 0) / N;
    dt.respTimeSD   = Math.sqrt( $lfold(function (a,b) { return a+b; }, $map(function (x) { return (x-dt.respTimeAvg)*(x-dt.respTimeAvg); }, dt.respTimes), 0) / (N-1));
    dt.timeStimPres = dt.respTimeAvg + CONST.respTimeSDRatio * dt.respTimeSD;
  }
  
  
  // -----------------------------------------------------------------------------------------------
  /**
   * Compute scores according to the following scoring procedures:
   *
   * - partial-credit unit (PU)
   * - partial-credit load (PL)
   * - full-credit unit (FU)
   * - full-credit load (FL)
   * 
   * Also outputs accuracy on the secondary task (in percent).
   */
  function computeScores() {
    var presCnt = 0;
    var scores = $map(
      function (x) {
        presCnt += x.length;
        
        var errors = false;  // flag: errors encountered in the current trial? (for full-credit scoring)
        return {
          pu  : $lfold(function (a,b) { errors = (errors || b.outcomeItem === 0); return a + b.outcomeItem / x.length; }, x, 0),
          pl  : $lfold(function (a,b) { return a + b.outcomeItem; }, x, 0),
          fu  : (errors ? 0 : 1),
          fl  : (errors ? 0 : x.length),
          acc : $lfold(function (a,b) { return a + (b.outcomeStim ? 1 : 0); }, x, 0)
        };
      },
      dt.trials.slice(3)
    );
    
    var pu=0, pl=0, fu=0, fl=0;
    
    $map(
      function (x) {
        pu  += x.pu;
        pl  += x.pl;
        fu  += x.fu;
        fl  += x.fl;
      },
      scores
    );
    
    pu  /= dt.trials.length - 3;
    pl  /= presCnt;
    fu  /= dt.trials.length - 3;
    fl  /= presCnt;
    
    saveRes("<br />RESULTS: n=" + presCnt + ", acc=" + st.stimRespAcc + "%, PU=" + pu.toFixed(2) + ", PL=" + pl.toFixed(2) + ", FU=" + fu.toFixed(2) + ", FL=" + fl.toFixed(2) + "<br />");
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function construct() {
    // Containers:
    ui.cont              = _cont;
    ui.mask              = $$("div", ui.cont, "mask");
    ui.btnCont           = $$("div", ui.cont, "btn");
    ui.txtInstrCont      = $$("div", ui.cont, "txt-instr");
    ui.txtItemCont       = $$("div", ui.cont, "txt-item");
    ui.txtStimCont       = $$("div", ui.cont, "txt-stim");
    ui.roCont            = $$("div", ui.cont, "reset-ok");
    ui.tfCont            = $$("div", ui.cont, "true-false");
    ui.recallPromptCont  = $$("div", ui.cont, "recall-prompt");
    ui.recallOutcomeCont = $$("div", ui.cont, "recall-outcome");
    ui.recallSeqCont     = $$("div", ui.cont, "recall-seq");
    ui.stimRespAccCont   = $$("div", ui.cont, "stim-resp-acc");
    
    // Button:
    ui.btn = $$("input", ui.btnCont);
    ui.btn.setAttribute("type", "button");
    ui.btn.onclick = function (e) {
      $hide(ui.recallOutcomeCont);
      $hide(ui.txtInstrCont);
      $hide(ui.txtItemCont);
      $hide(ui.txtStimCont);
      $hide(ui.btnCont);
      window.setTimeout(function () { step(); }, dt.timeBtnDelay);
    };
    
    // Reset-Ok:
    ui.roReset = $$("input", ui.roCont);
    ui.roReset.setAttribute("type", "button");
    ui.roReset.setAttribute("value", "Start over");
    ui.roReset.className = "enabled";
    ui.roReset.style.marginRight = "50px";
    ui.roReset.onclick = function (e) {
      $removeChildren(ui.recallSeqCont);
      
      ui.roBack.className = "disabled";
      ui.roBack.disabled = true;
      
      ui.roOk.className = "disabled";
      ui.roOk.disabled = true;
      
      $hide(ui.mask);
      
      st.currItemIdx = 0;
    };
    
    ui.roBack = $$("input", ui.roCont);
    ui.roBack.setAttribute("type", "button");
    ui.roBack.setAttribute("value", "Backspace");
    ui.roBack.onclick = function (e) {
      ui.recallSeqCont.removeChild(ui.recallSeqCont.lastChild);
      st.currItemIdx--;
      
      ui.roOk.className = "disabled";
      ui.roOk.disabled = true;
      
      if (st.currItemIdx === 0) {
        ui.roBack.className = "disabled";
        ui.roBack.disabled = true;
      }
      
      $hide(ui.mask);
    };
    
    ui.roOk = $$("input", ui.roCont);
    ui.roOk.setAttribute("type", "button");
    ui.roOk.setAttribute("value", "Ok");
    ui.roOk.onclick = function (e) {
      $hide(ui.recallPromptCont);
      $hide(ui.roCont);
      $hide(ui.recallSeqCont);
      $hide(ui.stimRespAccCont);
      saveRes($lfold(function (a,b) { return a+b; }, $map(function (x) { return x.item + "," + x.recall + "," + x.outcomeItem + "," + (x.outcomeStim ? "1" : "0") + ";" }, dt.trials[st.currTrialIdx]), ""));
      step();
    };
    
    // True-False:
    ui.tfResp0 = $$("input", ui.tfCont, null, "resp resp-0");
    ui.tfResp0.setAttribute("type", "button");
    ui.tfResp0.setAttribute("value", "Incorrect");
    ui.tfResp0.onclick = function (e) {
      window.clearTimeout(st.stimTimeout);
      st.stimTimeout = null;
      
      var ti = dt.trials[st.currTrialIdx][st.currItemIdx];  // trial item
      if (ti) ti.outcomeStim = (ti.correct === false);
      digestStimResp(ti.outcomeStim);
      
      $hide(ui.tfCont);
      $hide(ui.txtStimCont);
      step();
    };
    
    ui.tfResp1 = $$("input", ui.tfCont, null, "resp resp-1");
    ui.tfResp1.setAttribute("type", "button");
    ui.tfResp1.setAttribute("value", "Correct");
    ui.tfResp1.onclick = function (e) {
      window.clearTimeout(st.stimTimeout);
      st.stimTimeout = null;
      
      var ti = dt.trials[st.currTrialIdx][st.currItemIdx];  // trial item
      if (ti) ti.outcomeStim = (ti.correct === true);
      digestStimResp(ti.outcomeStim);
      
      $hide(ui.tfCont);
      $hide(ui.txtStimCont);
      step();
    };
    
    // Misc.:
    ui.txtInstr = $$("div", ui.txtInstrCont);
    ui.txtItem  = $$("div", ui.txtItemCont);
    ui.txtStim  = $$("div", ui.txtStimCont);
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function digestRecallItem(input) {
    if (st.currItemIdx === dt.trials[st.currTrialIdx].length) return;
    
    var ti = dt.trials[st.currTrialIdx][st.currItemIdx++];  // trial item
    ti.recall = input.value;
    ti.outcomeItem = (ti.item === ti.recall ? 1 : 0);
    
    $$("span", ui.recallSeqCont, null, null, (ti.recall === "  " ? "&nbsp;&nbsp;" : ti.recall));
    
    ui.roBack.className = "enabled";
    ui.roBack.disabled = false;
    
    if (st.currItemIdx === dt.trials[st.currTrialIdx].length) {
      $show(ui.mask);
      ui.roOk.className = "enabled";
      ui.roOk.disabled = false;
    }
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function digestStimResp(outcome) {
    st.stimRespN++;
    if (outcome) st.stimResp1++;
    st.stimRespAcc = Math.round((st.stimResp1 / st.stimRespN) * 100);
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function genRecallPrompt(rp) {
    // (1) Clear:
    $removeChildren(ui.recallPromptCont);
    
    // (2) Create table:
    var tbl = $$("table", ui.recallPromptCont);
    tbl.setAttribute("cellspacing", 0);
    tbl.setAttribute("cellpadding", 0);
    tbl.setAttribute("align", "center");
    
    // (3) Function for adding items:
    var fnAddItem = function (tr, item, colSpan) {
      var td = $$("td", tr);
      if (colSpan) td.setAttribute("colSpan", colSpan);
      
      var input = $$("input", td);
      input.setAttribute("type", "button");
      input.setAttribute("value", item);
      input.onclick = function (input) {
        return function (e) { digestRecallItem(input); };
      }(input);
    };
    
    // (4) Add items:
    for (var r = 0; r < rp.length; r++) {
      var R = rp[r];
      var tr = $$("tr", tbl);
      for (var c = 0; c < R.length; c++) {
        fnAddItem(tr, R[c]);
      }
    }
    
    // (5) Add the blank item:
    var tr = $$("tr", tbl);
    fnAddItem(tr, "  ", rp[0].length);
  }
  
  
  // -----------------------------------------------------------------------------------------------
  /**
   * Returns a random item. If 'currItem' is not null, it returns a random item that is different 
   * that 'currItem'.
   */
  function getNextItem(currItem) {
    if (currItem === null) return dt.items[Math.floor(Math.random() * dt.items.length)];
    
    var newItem = null;
    do {
      newItem = dt.items[Math.floor(Math.random() * dt.items.length)];
    } while (newItem === currItem);
    return newItem;
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function procStim(stim, minSentLen, maxSentLen) {
    $map(
      function (s) {
        var idx01 = s.indexOf("{");
        var idx02 = s.indexOf("}");
        var variants = s.substring(idx01 + 1, idx02).split("|");
        var s0 = s.substring(0, idx01) + variants[0] + s.substring(idx02 + 1);  // variant 0 (correct)
        var s1 = s.substring(0, idx01) + variants[1] + s.substring(idx02 + 1);  // variant 1 (incorrect)
        var len = s0.split(" ").length;
        if (len < minSentLen && len > maxSentLen) return;
        
        dt.stim.push({ stim: [s0,s1], presIdx: Math.floor(Math.random() * 2) });  // randomize the presentation item index ('pres')
      },
      stim
    );
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function randomizeSetSizeOrd(ss) {
    for (var i=0, ni=ss.length*2; i < ni; i++) {
      var idx01 = Math.floor(Math.random() * ss.length);
      var idx02 = Math.floor(Math.random() * ss.length);
      var tmp = ss[idx02];
      ss[idx02] = ss[idx01];
      ss[idx01] = tmp;
    }
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function randomizeStimOrd(s) {
    for (var i=0, ni=s.length*2; i < ni; i++) {
      var idx01 = Math.floor(Math.random() * s.length);
      var idx02 = Math.floor(Math.random() * s.length);
      var tmp = s[idx02];
      s[idx02] = s[idx01];
      s[idx01] = tmp;
    }
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function saveRes(r) { window.opener.appendRes(r); }
  
  
  // -----------------------------------------------------------------------------------------------
  function showItem(i) {
    var ti = dt.trials[st.currTrialIdx][st.currItemIdx];  // trial item
    if (!ti) {
      dt.trials[st.currTrialIdx][st.currItemIdx] = { item: i, recall: null, correct: null, outcomeItem: -1, outcomeStim: false };
      ti = dt.trials[st.currTrialIdx][st.currItemIdx];
    }
    else ti.item = i;
    
    ui.txtItem.innerHTML = i;
    $show(ui.txtItemCont);
    
    window.setTimeout(
      function() {
        $hide(ui.txtItemCont);
        step();
      },
      dt.timeItemPres
    );
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function showRecallOutcome() {
    $hide(ui.recallPromptCont);
    $removeChildren(ui.recallOutcomeCont);
    $map(
      function (x) {
        var input = $$("input", ui.recallOutcomeCont, null, "item item-" + x.outcomeItem);
        input.setAttribute("type", "button");
        input.setAttribute("value", x.recall);
      },
      dt.trials[st.currTrialIdx]
    );
    $show(ui.recallOutcomeCont);
    
    window.setTimeout(
      function() {
        $hide(ui.recallOutcomeCont);
        step();
      },
      dt.timeOutcomePres
    );
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function showRecallPrompt() {
    ui.roReset.onclick();
    ui.stimRespAccCont.innerHTML = st.stimRespAcc + "%";
    $show(ui.stimRespAccCont);
    
    $show(ui.recallPromptCont);
    $show(ui.roCont);
    $show(ui.recallSeqCont);
  }
  
  
  // -----------------------------------------------------------------------------------------------
  function showStim(s, force) {
    var ti = dt.trials[st.currTrialIdx][st.currItemIdx];  // trial item
    if (!ti) {
      dt.trials[st.currTrialIdx][st.currItemIdx] = { item: null, recall: null, correct: (s.presIdx === 0), outcomeItem: -1, outcomeStim: false };
      ti = dt.trials[st.currTrialIdx][st.currItemIdx];
    }
    else ti.correct = (s.presIdx === 0);
    
    ui.txtStim.innerHTML = s.stim[s.presIdx];
    $show(ui.txtStimCont);
    $show(ui.tfCont);
    
    if (force) {
      st.stimTimeout = window.setTimeout(
        function() {
          $hide(ui.tfCont);
          $hide(ui.txtStimCont);
          digestStimResp(false);
          
          step();
        },
        dt.timeStimPres
      );
    }
  }
  
  
  // -----------------------------------------------------------------------------------------------
  /**
   * Advances to the next step (e.g., to item presentation from stimulus presentation).
   */
  function step() {
    if (st.currSqIdx === dt.seq.length) return;
    
    var si = dt.seq[st.currSeqIdx++];  // sequence item
    switch (si.type) {
      case CONST.seq.type.instruction:
        if (si.txt) {
          ui.txtInstr.innerHTML = si.txt;
          $show(ui.txtInstrCont);
        }
        if (si.btn) {
          ui.btn.value = si.btn;
          $show(ui.btnCont);
        }
        break;
      
      case CONST.seq.type.btn:
        ui.btn.value = si.txt;
        $show(ui.btnCont);
        break;
      
      case CONST.seq.type.item:
        showItem(si.item);
        break;
      
      case CONST.seq.type.stim:
        showStim(si.stim, si.force);
        break;
      
      case CONST.seq.type.timerStart:
        timer.reset();
        timer.start();
        step();
        break;
      
      case CONST.seq.type.timerStop:
        timer.stop();
        step();
        break;
      
      case CONST.seq.type.respTimeRec:
        dt.respTimes.push(timer.getMs());
        step();
        break;
      
      case CONST.seq.type.respTimeCalc:
        calcRespTime();
        step();
        break;
      
      case CONST.seq.type.newTrial:
        dt.trials[++st.currTrialIdx] = [];
        st.currItemIdx = 0;
        step();
        break;
      
      case CONST.seq.type.nextItem:
        st.currItemIdx++
        step();
        break;
      
      case CONST.seq.type.recallPrompt:
        showRecallPrompt();
        break;
      
      case CONST.seq.type.recallOutcome:
        showRecallOutcome();
        break;
      
      case CONST.seq.type.resetStimRespAcc:
        st.stimRespAcc = 0;
        st.stimRespN   = 0;
        st.stimResp1   = 0;
        step();
        break;
      
      case CONST.seq.type.computeScores:
        computeScores();
        step();
        break;
    }
  }
  
  
  // ===============================================================================================
  // ==[ PUBLIC ]===================================================================================
  // ===============================================================================================
  
  var pub = {
    
    // ---------------------------------------------------------------------------------------------
    /**
     * Starts the entire procedure including test runs that are also used to estimate stimulus 
     * response time.
     */
    run: function (items, recallPrompt, stim, timeItemPres, timeOutcomePres, timeBtnDelay, practiceItemCnt, practiceStimCnt, practiceSetSize, setSizes, randSetSizeOrd, randStimOrd, minSentLen, maxSentLen) {
      // (1) Init:
      dt.items = items;
      
      dt.timeItemPres    = timeItemPres;
      dt.timeOutcomePres = timeOutcomePres;
      dt.timeBtnDelay    = timeBtnDelay;
      
      var stimIdx = 0;  // to iterate through stimuli in a linear manner
      
      procStim(stim, minSentLen, maxSentLen);
      
      genRecallPrompt(recallPrompt);
      if (randSetSizeOrd) randomizeSetSizeOrd(setSizes);
      if (randStimOrd) randomizeStimOrd(dt.stim);
      saveRes("ORDER: " + setSizes + "<br />");
      
      var presCnt = $lfold(function (a,b) { return a+b; }, setSizes, 0);  // presentation count
      /*
      alert("ITEMS (n=" + dt.items.length + "):\n\n" + dt.items);
      alert("STIMULI (n=" + dt.stim.length + "; " + (stim.length - dt.stim.length) + " excluded due to length):\n\n" + $lfold(function (a,b) { return a+b; }, $map(function (s) { return s.stim + "\n"; }, dt.stim), ""));
      alert("TRIALS (n=" + setSizes.length + "; " + (presCnt + practiceStimCnt + practiceSetSize) + " sentences required, " + dt.stim.length + " available):\n\n" + setSizes);
      */
      if (dt.stim.length < (presCnt + practiceStimCnt + practiceSetSize)) return alert("ERROR:\n\nThe requested combination of number of trials and set sizes (including practice trials) requires more senteces (" + (presCnt + practiceStimCnt + practiceSetSize) + ") then have been submitted (and met the length criteria; " + dt.stim.length + "). Please add more sentences. This program will now terminate.");
      
      // (2) Sequence:
      // (2.1) Sequence: Start:
      dt.seq.push({ type: CONST.seq.type.instruction, txt: "Welcome and thank you for your participation!<br /><br />This part of the experiment consist of doing two tasks, A and B, at the same time. Good performance on both is important. Before the real test starts, you will have a chance to first practice both of the tasks separately, then both of them at the same time. On-screen instruction will tell you what to do.<br /><br />All instructions will be presented in blue while <span style=\"color:#000000;\">stimuli will be presented in black</span>.<br /><br />Please read all instructions carefully and if at any point you have questions, please ask the experimenter.", btn: "Continue" });
      
      // (2.2) Sequence: Practice items only:
      dt.seq.push({ type: CONST.seq.type.instruction, txt: "Task A focuses on retaining a series of letters in memory for later recall. When the recall prompt is presented, choose letters in the order in which they were presented. If you forgot a particular letter, hit the blank box. The recall prompt will also allow you to reset your answer and start over. After you provide the answer you will be presented with the results (<span style=\"color: #56CF34;\">green</span>&nbsp;=&nbsp;correct, <span style=\"color: #ED5252;\">red</span>&nbsp;=&nbsp;incorrect).", btn: "Continue" });
      dt.seq.push({ type: CONST.seq.type.btn, txt: "Start practice for task A" });
      dt.seq.push({ type: CONST.seq.type.newTrial });
      
      var item = null;
      for (var i = 0; i < practiceItemCnt; i++) {
        item = getNextItem(item);
        dt.seq.push({ type: CONST.seq.type.item, item: item });
        dt.seq.push({ type: CONST.seq.type.nextItem });
      }
      
      dt.seq.push({ type: CONST.seq.type.recallPrompt });
      dt.seq.push({ type: CONST.seq.type.recallOutcome });
      
      // (2.3) Sequence: Practice stimuli only:
      dt.seq.push({ type: CONST.seq.type.instruction, txt: "Task B focuses on judging if English language sentences makes sense. You will be presented with one sentence at a time and be able to choose between \"Correct\" and \"Incorrect.\" Below are examples of correct and incorrect sentences.<br /><br />John was asked to sit on a chair. (correct)<br />John was asked to sit on a marmalade. (incorrect)<br /><br />Your overall accuracy will be displayed in red in the top-right corner of the recall prompt screen. It is imperative that you answer as QUICKLY and ACCURATELY as possible. For our purposes we will not be able to use data with accuracy below 85%. Please try not to fall below that threshold.", btn: "Continue" });
      dt.seq.push({ type: CONST.seq.type.btn, txt: "Start practice for task B" });
      dt.seq.push({ type: CONST.seq.type.newTrial });
      
      dt.seq.push({ type: CONST.seq.type.stim, stim: dt.stim[stimIdx++], force: false });
      dt.seq.push({ type: CONST.seq.type.nextItem });
      
      for (var i = 0; i < practiceStimCnt-1; i++) {
        dt.seq.push({ type: CONST.seq.type.timerStart });
        dt.seq.push({ type: CONST.seq.type.stim, stim: dt.stim[stimIdx++], force: false });
        dt.seq.push({ type: CONST.seq.type.timerStop });
        dt.seq.push({ type: CONST.seq.type.respTimeRec });
        dt.seq.push({ type: CONST.seq.type.nextItem });
      }
      
      dt.seq.push({ type: CONST.seq.type.respTimeCalc });
      
      // (2.4) Sequence: Practice real trial:
      dt.seq.push({ type: CONST.seq.type.instruction, txt: "In the real test, tasks A and B will be interleaved, like in the following practice trial. Please note, that the computer may force you out of the task B (i.e., the sentence assessment task) if you take too much time to complete it, so please answer promptly. Please also remember about the 85% accuracy threshold.", btn: "Continue" });
      dt.seq.push({ type: CONST.seq.type.btn, txt: "Start practice for both tasks (A+B)" });
      dt.seq.push({ type: CONST.seq.type.newTrial });
      
      dt.seq.push({ type: CONST.seq.type.resetStimRespAcc });
      
      for (var i = 0; i < practiceSetSize; i++) {
        dt.seq.push({ type: CONST.seq.type.stim, stim: dt.stim[stimIdx++], force: true });
        dt.seq.push({ type: CONST.seq.type.item, item: getNextItem() });
        dt.seq.push({ type: CONST.seq.type.nextItem });
      }
      
      dt.seq.push({ type: CONST.seq.type.recallPrompt });
      dt.seq.push({ type: CONST.seq.type.recallOutcome });
      
      dt.seq.push({ type: CONST.seq.type.instruction, txt: "This concludes the practice part. You are now ready to start the real test.<br /><br />Your accuracy with the sentence assessment task will be reset. The amount of letters and sentences presented within a single trial will vary from " + $min(setSizes) + " to " + $max(setSizes) + ". The order will be random. Since long sequences can come first, please do not feel discouraged. The longest sequences would be very difficult to pretty much anyone. Just try to do your best in both tasks.", btn: "Continue" });
      
      // (2.5) Sequence: Test:
      dt.seq.push({ type: CONST.seq.type.resetStimRespAcc });
      var trialCnt = 0;
      $map(
        function (x) {
          dt.seq.push({ type: CONST.seq.type.btn, txt: "Start trial " + (++trialCnt) + " of " + setSizes.length });
          dt.seq.push({ type: CONST.seq.type.newTrial });
          
          for (var i = 0; i < x; i++) {
            dt.seq.push({ type: CONST.seq.type.stim, stim: dt.stim[stimIdx++], force: true });
            dt.seq.push({ type: CONST.seq.type.item, item: getNextItem() });
            dt.seq.push({ type: CONST.seq.type.nextItem });
          }
          
          dt.seq.push({ type: CONST.seq.type.recallPrompt });
          dt.seq.push({ type: CONST.seq.type.recallOutcome });
        },
        setSizes
      );
      
      // (2.6) Sequence: Stop:
      dt.seq.push({ type: CONST.seq.type.computeScores });
      dt.seq.push({ type: CONST.seq.type.instruction, txt: "This part of the experiment is concluded. Please let the experimenter know you are done.<br /><br />Thank you!", btn: null });
      
      // (3) Run:
      step();
    }
  };
  
  
  // ===============================================================================================
  // ==[ CONSTRUCT ]================================================================================
  // ===============================================================================================
  
  construct();
  return pub;
};
