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

function addCoord(baseVal, addVal) {
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

function getOverlayElem(elemOrId) {
  if (typeof elemOrId === 'string') {
    const elem = document.querySelector(`.overlay #${elemOrId}`);

    if (elem === null) {
      throw new Error(`Element with ID '${elemOrId}' does not exist!`);
    }

    return elem;
  }

  if (elemOrId instanceof HTMLElement) {
    return elemOrId;
  }
}

function addToHistory(editedElemOrId, op, initialTransform) {
  while (editHistory.length >= editMaxUndo) {
    editHistory.dequeue();
  }

  const historyObj = {
    op: op,
    x: initialTransform?.x,
    y: initialTransform?.y,
    width: initialTransform?.width,
    height: initialTransform?.height,
  };

  if (typeof editedElemOrId === 'string') {
    historyObj.elemId = editedElemOrId;
  } else if (editedElemOrId instanceof HTMLElement) {
    historyObj.elem = editedElemOrId;
  }

  editHistory.push(historyObj);
}

function undoFromHistory() {
  if (editHistory.length === 0) {
    return;
  }

  const undoObj = editHistory.pop();

  switch (undoObj.op) {
    case 'resize':
    case 'move':
      setTransform(undoObj.elemId, undoObj);
      break;
    case 'delete':
      appendElemToOverlay(undoObj.elem);
      break;
    case 'create':
      removeElemFromOverlay(undoObj.elemId);
      break;
  }
}

function setTransform(elemObjOrId, newTransform) {
  const elem = getOverlayElem(elemObjOrId);

  if (newTransform.hasOwnProperty('x')) {
    elem.style.left = addCoord(0, newTransform.x);
  }
  if (newTransform.hasOwnProperty('y')) {
    elem.style.top = addCoord(0, newTransform.y);
  }
  if (newTransform.hasOwnProperty('width')) {
    elem.style.width = addCoord(0, newTransform.width);
  }
  if (newTransform.hasOwnProperty('height')) {
    elem.style.height = addCoord(0, newTransform.height);
  }
}

function moveTransform(elemId, deltaTransform) {
  const elem = getOverlayElem(elemId);

  if (deltaTransform.hasOwnProperty('x')) {
    elem.style.left = addCoord(elem.style.left, deltaTransform.x);
  }
  if (deltaTransform.hasOwnProperty('y')) {
    elem.style.top = addCoord(elem.style.top, deltaTransform.y);
  }
  if (deltaTransform.hasOwnProperty('width')) {
    elem.style.width = addCoord(elem.style.width, deltaTransform.width);
  }
  if (deltaTransform.hasOwnProperty('height')) {
    elem.style.height = addCoord(elem.style.height, deltaTransform.height);
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

function sizeUpFont(elem) {
  elem.style.fontSize = addCoord(elem.style.fontSize, 1);
}

function sizeDownFont(elem) {
  elem.style.fontSize = addCoord(elem.style.fontSize, -1);
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
  newElem.style.fontSize = '16px';
  if (newElem instanceof HTMLSpanElement) {
    newElem.setAttribute('contenteditable', 'true');
  }

  appendElemToOverlay(newElem);
  return newElem.id;
}

function appendElemToOverlay(elem) {
  elem.addEventListener('mousedown', onElemEdit);
  elem.addEventListener('keydown', onKeyDown);
  document.querySelector('.overlay').appendChild(elem);
}

function removeElemFromOverlay(elemId) {
  const elem = getOverlayElem(elemId);

  document.querySelector('.overlay').removeChild(elem);
}

function saveAllOverlays() {
  const allOverlays = [];

  document.querySelectorAll('.overlay > *').forEach((elem) => {
    const overlayDef = {
      type: elem.tagName,
      classes: elem.className,
      fontSize: elem.style.fontSize,
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
    newElem.style.fontSize = overlayObj.fontSize;

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
  if (!editModeOn) {
    return;
  }

  if (ev.key === 'z' && ev.ctrlKey) {
    undoFromHistory();
    ev.preventDefault();
  }

  const activeElem = document.activeElement;

  if (activeElem !== null && activeElem.id.startsWith?.('o_')) {
    if (ev.key === '+' && ev.altKey) {
      sizeUpFont(activeElem);
      ev.preventDefault();
    }
    if (ev.key === '-' && ev.altKey) {
      sizeDownFont(activeElem);
      ev.preventDefault();
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
    addToHistory(editedElem.cloneNode(true), 'delete');
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

function main() {
  document.addEventListener('contextmenu', (ev) => ev.preventDefault());
  document.querySelector('.overlay').addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);

  document.querySelector('input#editmode').addEventListener('change', (ev) => {
    ev.target.checked ? enableEditMode() : disableEditMode();
  });

  document.querySelector('button#newtext').addEventListener('click', (ev) => {
    const elemId = addNewElem('span');
    addToHistory(elemId, 'create');
  });
  document.querySelector('button#newinput').addEventListener('click', (ev) => {
    const elemId = addNewElem('input');
    addToHistory(elemId, 'create');
  });
  document.querySelector('button#save').addEventListener('click', (ev) => {
    saveAllOverlays();
  });

  loadAllOverlays();
}

window.addEventListener('load', () => {
  main();
});
