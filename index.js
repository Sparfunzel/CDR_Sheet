let editModeOn = false;
let editedElem = null;
let editElemMoved = false;
let editOp = '';
let editMaxUndo = 50;
let editHistory = [];

Array.prototype.dequeue = function () {
  if (this.length === 0) {
    return undefined;
  }

  if (this.length === 1) {
    return this.pop();
  }

  const out = this[0];
  for (let i = 0; i < this.length - 1; i++) {
    this[i] = this[i + 1];
  }
  this.pop();
  return out;
};

function addToHistory(editedElem, initialTransform) {
  while (editHistory.length >= editMaxUndo) {
    editHistory.dequeue();
  }

  editHistory.push({
    elem: editedElem,
    x: initialTransform.x,
    y: initialTransform.y,
    width: initialTransform.width,
    height: initialTransform.height,
  });
}

function undoFromHistory() {
  if (editHistory.length === 0) {
    return;
  }

  const undoObj = editHistory.pop();
  const editedElem = undoObj.elem;
  setTransform(editedElem, undoObj);
}

function setTransform(elem, newTransform) {
  if (newTransform.hasOwnProperty('x')) {
    elem.style.left = add(0, newTransform.x);
  }
  if (newTransform.hasOwnProperty('y')) {
    elem.style.top = add(0, newTransform.y);
  }
  if (newTransform.hasOwnProperty('width')) {
    elem.style.width = add(0, newTransform.width);
  }
  if (newTransform.hasOwnProperty('height')) {
    elem.style.height = add(0, newTransform.height);
  }
}

function moveTransform(elem, deltaTransform) {
  if (deltaTransform.hasOwnProperty('x')) {
    elem.style.left = add(elem.style.left, deltaTransform.x);
  }
  if (deltaTransform.hasOwnProperty('y')) {
    elem.style.top = add(elem.style.top, deltaTransform.y);
  }
  if (deltaTransform.hasOwnProperty('width')) {
    elem.style.width = add(elem.style.width, deltaTransform.width);
  }
  if (deltaTransform.hasOwnProperty('height')) {
    elem.style.height = add(elem.style.height, deltaTransform.height);
  }
}

function getTransform(elem) {
  return {
    x: elem.style.left || 0,
    y: elem.style.top || 0,
    width: elem.style.width || 0,
    height: elem.style.height || 0,
  };
}

function add(baseVal, addVal) {
  if (typeof baseVal !== 'number') {
    baseVal = parseInt(baseVal.replace(/px$/, ''));
    if (isNaN(baseVal)) {
      baseVal = 0;
    }
  }
  if (typeof addVal !== 'number') {
    addVal = parseInt(addVal.replace(/px$/, ''));
    if (isNaN(addVal)) {
      addVal = 0;
    }
  }
  return baseVal + addVal + 'px';
}

function onMouseMove(ev) {
  if (editModeOn && editedElem !== null) {
    if (!editElemMoved) {
      editElemMoved = true;
      console.log('adding to history');
      addToHistory(editedElem, getTransform(editedElem));
    }

    if (editOp === 'move') {
      moveTransform(editedElem, { x: ev.movementX, y: ev.movementY });
    }
    if (editOp === 'resize') {
      let xVal = ev.movementX;
      let yVal = ev.movementY;

      if (editedElem instanceof HTMLImageElement) {
        xVal = yVal = ev.movementX + ev.movementY;
      }
      moveTransform(editedElem, { width: xVal, height: yVal });
    }
  }
}

function onMouseUp(ev) {
  editElemMoved = false;
  editedElem = null;
}

function onKeyDown(ev) {
  if (ev.key === 'z' && ev.ctrlKey) {
    undoFromHistory();
  }
}

function onElemEdit(ev) {
  if (
    ev.srcElement instanceof HTMLInputElement ||
    ev.srcElement instanceof HTMLImageElement
  ) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  editedElem = ev.srcElement;

  if (ev.button === 0) {
    editOp = 'move';
  }
  if (ev.button === 1) {
    editOp = 'resize';
    ev.preventDefault();
    ev.stopPropagation();
  }
  if (ev.button === 2) {
    document.querySelector('.overlay').removeChild(editedElem);
  }
}

function enableEditMode() {
  document.querySelectorAll('.overlay > *').forEach((elem) => {
    elem.classList.add('editable');
    elem.addEventListener('mousedown', onElemEdit);
    if (elem instanceof HTMLSpanElement) {
      elem.setAttribute('contenteditable', 'true');
    }
  });
  document.querySelector('button#newtext').removeAttribute('disabled');
  document.querySelector('button#newinput').removeAttribute('disabled');
  editModeOn = true;
}

function disableEditMode() {
  document.querySelectorAll('.overlay > *').forEach((elem) => {
    elem.classList.remove('editable');
    elem.removeEventListener('mousedown', onElemEdit);
    if (elem instanceof HTMLSpanElement) {
      elem.removeAttribute('contenteditable');
    }
  });
  document.querySelector('button#newtext').setAttribute('disabled', '');
  document.querySelector('button#newinput').setAttribute('disabled', '');
  editModeOn = false;
}

function addNewElem(tagName) {
  const newElem = document.createElement(tagName);
  setTransform(newElem, { x: 50, y: 50, width: 80, height: 20 });
  newElem.classList.add('editable');
  if (newElem instanceof HTMLSpanElement) {
    newElem.setAttribute('contenteditable', 'true');
  }
  newElem.addEventListener('mousedown', onElemEdit);

  document.querySelector('.overlay').appendChild(newElem);
}

function saveAllOverlays() {
  const allOverlays = [];

  document.querySelectorAll('.overlay > *').forEach((elem) => {
    const overlayDef = {
      type: elem.tagName,
      classes: elem.className,
      ...getTransform(elem),
    };

    if (elem instanceof HTMLImageElement) {
      overlayDef.content = elem.src;
    }
    if (elem instanceof HTMLInputElement) {
      overlayDef.content = elem.value;
    }
    if (elem instanceof HTMLSpanElement) {
      overlayDef.content = elem.innerHTML;
    }

    allOverlays.push(overlayDef);
  });

  localStorage.setItem('overlays', JSON.stringify(allOverlays));
}

function loadAllOverlays() {
  const storageOverlays = localStorage.getItem('overlays');
  if (storageOverlays === null) {
    return;
  }

  const allOverlays = JSON.parse(storageOverlays);
  document.querySelector('.overlay').innerHTML = '';

  allOverlays.forEach((overlayObj) => {
    const newElem = document.createElement(overlayObj.type);
    setTransform(newElem, overlayObj);
    newElem.className = overlayObj.classes;

    if (newElem instanceof HTMLImageElement) {
      newElem.src = overlayObj.content;
    }
    if (newElem instanceof HTMLInputElement) {
      newElem.value = overlayObj.content;
    }
    if (newElem instanceof HTMLSpanElement) {
      newElem.innerHTML = overlayObj.content;
    }

    document.querySelector('.overlay').appendChild(newElem);
  });
}

function main() {
  document.addEventListener('contextmenu', (ev) => ev.preventDefault());
  document.querySelector('.overlay').addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);

  document.querySelector('input#editmode').addEventListener('change', (ev) => {
    ev.srcElement.checked ? enableEditMode() : disableEditMode();
  });

  document.querySelector('button#newtext').addEventListener('click', (ev) => {
    addNewElem('span');
  });
  document.querySelector('button#newinput').addEventListener('click', (ev) => {
    addNewElem('input');
  });
  document.querySelector('button#save').addEventListener('click', (ev) => {
    saveAllOverlays();
  });

  loadAllOverlays();
}

window.addEventListener('load', () => {
  main();
});