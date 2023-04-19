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

function addToHistory(editedElem, op, initialTransform) {
  while (editHistory.length >= editMaxUndo) {
    editHistory.dequeue();
  }

  editHistory.push({
    elem: editedElem,
    op: op,
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

  switch (undoObj.op) {
    case 'resize':
    case 'move':
      setTransform(editedElem, undoObj);
      break;
    case 'delete':
      appendElemToOverlay(editedElem);
      break;
    case 'create':
      break;
  }
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
      addToHistory(editedElem.id, editOp, getTransform(editedElem));
    }

    if (editOp === 'move') {
      moveTransform(editedElem.id, { x: ev.movementX, y: ev.movementY });
    }
    if (editOp === 'resize') {
      let xVal = ev.movementX;
      let yVal = ev.movementY;

      if (editedElem instanceof HTMLImageElement) {
        xVal = yVal = ev.movementX + ev.movementY;
      }
      moveTransform(editedElem.id, { width: xVal, height: yVal });
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

  if (editedElem !== null) {
    if (ev.key === '+' && ev.ctrlKey) {
      sizeUpFont();
    }
    if (ev.key === '-' && ev.ctrlKey) {
      sizeDownFont();
    }
  }
}

function onElemEdit(ev) {
  if (
    ev.target instanceof HTMLInputElement ||
    ev.target instanceof HTMLImageElement
  ) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  editedElem = ev.target;

  if (ev.button === 0) {
    editOp = 'move';
  }
  if (ev.button === 1) {
    editOp = 'resize';
    ev.preventDefault();
    ev.stopPropagation();
  }
  if (ev.button === 2) {
    addToHistory(
      editedElem.cloneNode(true),
      'delete',
      getTransform(editedElem)
    );
    document.querySelector('.overlay').removeChild(editedElem);
  }
}

function sizeUpFont() {
  if (editedElem === null) {
    return;
  }

  editedElem.style.fontSize = add(editedElem.style.fontSize, 1);
}

function sizeDownFont() {
  if (editedElem === null) {
    return;
  }

  editedElem.style.fontSize = add(editedElem.style.fontSize, -1);
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

function uniqueId() {
  return (
    'o_' +
    Math.floor(Math.random() * Date.now())
      .toString(16)
      .substring(0, 10)
      .padStart(10, '0')
  );
}

function createOverlayElem(tagName) {
  const newElem = document.createElement(tagName);
  newElem.setAttribute('id', uniqueId());
  return newElem;
}

function addNewElem(tagName) {
  const newElem = createOverlayElem(tagName);
  setTransform(newElem, { x: 50, y: 50, width: 80, height: 20 });
  newElem.classList.add('editable');
  if (newElem instanceof HTMLSpanElement) {
    newElem.setAttribute('contenteditable', 'true');
  }

  appendElemToOverlay(newElem);
  return newElem.getAttribute('id');
}

function appendElemToOverlay(elem) {
  elem.addEventListener('mousedown', onElemEdit);
  document.querySelector('.overlay').appendChild(elem);
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
    const newElem = createOverlayElem(overlayObj.type);
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
    ev.target.checked ? enableEditMode() : disableEditMode();
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
