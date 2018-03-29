function $(id) { return document.getElementById(id); }
function $trim(s) { return s.replace(/^\s+|\s+$/g, ""); }


// -------------------------------------------------------------------------------------------------
function $join(A, delim) {
  return $filter(function (x) { return !!x; }, A).join(delim);
}


// -------------------------------------------------------------------------------------------------
function $hide() {
  for (var i=0, ni=arguments.length; i < ni; i++) {
    var x = arguments[i];
    (typeof x === "string" ? $(x).style.display = "none" : x.style.display = "none");
  }
}


// -------------------------------------------------------------------------------------------------
function $show() {
  for (var i=0, ni=arguments.length; i < ni; i++) {
    var x = arguments[i];
    (typeof x === "string" ? $(x).style.display = "block" : x.style.display = "block");
  }
}


// -------------------------------------------------------------------------------------------------
function $min(A) {
  return $lfold(function (a,b) { return Math.min(a,b); }, A, 9999999999)
}


// -------------------------------------------------------------------------------------------------
function $max(A) {
  return $lfold(function (a,b) { return Math.max(a,b); }, A, -9999999999)
}


// -------------------------------------------------------------------------------------------------
function $$(name, parent, id, clazz, html) {
  var el = document.createElement(name);
  if (id) el.id = id;
  if (clazz) el.className = clazz;
  if (html) el.innerHTML = html;
  if (parent) parent.appendChild(el);
  return el;
}


// -------------------------------------------------------------------------------------------------
function $$$(x) { return x; }


// -------------------------------------------------------------------------------------------------
function $arrDup(A, x, optional) {
  var n = A.length;
  for (var i=0; i < n; i++) {
    for (var j=i+1; j < n; j++) {
      if (optional) {
        if (A[i][x] !== undefined && A[j][x] !== undefined && A[i][x] === A[j][x]) return true;
      }
      else if (A[i][x] === A[j][x]) return true;
    }
  }
  return false;
}


// -------------------------------------------------------------------------------------------------
function $arrRange(A, x, min, max, optional) {
  for (var i=0, n=A.length; i < n; i++) {
    if (optional) {
      if (A[i][x] && (A[i][x] < min || A[i][x] > max)) return false;
    }
    else if (A[i][x] < min || A[i][x] > max) return false;
  }
  return true;
}


// -------------------------------------------------------------------------------------------------
/**
 * Returns only elements for which 'fn' returns 'true' (or anything 
 * that evaluates to 'true').
 * 
 * Pass a single object, an array, or multiple arrays after the 
 * 'fn' argument. In the case of multiple arrays they are 
 * anticipated to be of the same size.
 *
 * 'fn' should accept a single argument. In the case of multiple 
 * arrays that element will be an array.
 */
function $filter(fn) {
  var lstCnt = arguments.length-1;
  var res = [];
  
  if (lstCnt === 1) {  // one extra argument
    if (!(arguments[1] instanceof Array)) {  // and this argument ain't an array
      var ok = fn(arguments[1])
      return (ok ? arguments[1] : null);
    }
    
    for (var i=0, l=arguments[1].length; i < l; i++) {  // it is an array
      var ok = fn(arguments[1][i])
      if (ok) res.push(arguments[1][i]);
    }
  }
  else {  // multiple extra arguments
    for (var i=0, l=arguments[1].length; i < l; i++) {
      var lst = [];
      for (var j=1; j <= lstCnt; j++) {
        lst.push(arguments[j][i]);
      }
      var ok = fn(lst)
      if (ok) res.push(lst);
    }
  }
  
  return res;
}


// -------------------------------------------------------------------------------------------------
function $lfold(fn, A, init) {
  var res = init;
  for (var i=0,ni=A.length; i < ni; i++) {
    res = fn(res, A[i]);
  }
  return res;
}


// -------------------------------------------------------------------------------------------------
/**
 * Pass a single object, an array, or multiple arrays after the 
 * 'fn' argument. In the case of multiple arrays they are 
 * anticipated to be of the same size.
 *
 * 'fn' should accept a single argument. In the case of multiple 
 * arrays that element will be an array.
 */
function $map(fn) {
  var lstCnt = arguments.length-1;
  var res = [];
  
  if (lstCnt === 1) {  // one extra argument
    if (!(arguments[1] instanceof Array)) {  // and this argument ain't an array
      return fn(arguments[1]);
    }
    
    for (var i=0, l=arguments[1].length; i < l; i++) {  // it is an array
      res[i] = fn(arguments[1][i]);
    }
  }
  else {  // multiple extra arguments
    for (var i=0, l=arguments[1].length; i < l; i++) {
      var lst = [];
      for (var j=1; j <= lstCnt; j++) {
        lst.push(arguments[j][i]);
      }
      res[i] = fn(lst);
    }
  }
  
  return res;
}


// -------------------------------------------------------------------------------------------------
function $removeChildren(el) {
  if (typeof x === "string") el = $(id);
  while (el.hasChildNodes()) el.removeChild(el.childNodes[0] || el.children[0]);
}
