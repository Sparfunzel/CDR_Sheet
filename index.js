let editModeOn = false;
let editedElem = null;
let editElemMoved = false;
let editOp = '';
let editTransformCoords = {
  mouseX: 0,
  mouseY: 0,
  elemX: 0,
  elemY: 0,
};
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

function setTransform(elemObjOrId, newTransform, initialTransform = {}) {
  const elem = getOverlayElem(elemObjOrId);

  if (newTransform.hasOwnProperty('x')) {
    const init = initialTransform.x || 0;
    elem.style.left = addCoord(init, newTransform.x);
  }
  if (newTransform.hasOwnProperty('y')) {
    const init = initialTransform.y || 0;
    elem.style.top = addCoord(init, newTransform.y);
  }
  if (newTransform.hasOwnProperty('width')) {
    const init = initialTransform.width || 0;
    elem.style.width = addCoord(init, newTransform.width);
  }
  if (newTransform.hasOwnProperty('height')) {
    const init = initialTransform.height || 0;
    elem.style.height = addCoord(init, newTransform.height);
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

function duplicateElem(elem) {
  const newElem = elem.cloneNode(true);
  newElem.id = uniqueId();
  setTransform(newElem, { x: 0, y: 20 }, getTransform(newElem));
  appendElemToOverlay(newElem);
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
  newElem.id = uniqueId();
  return newElem;
}

function addNewElem(tagName) {
  const newElem = createOverlayElem(tagName);
  setTransform(newElem, {
    x: 50,
    y: window.scrollY + 50,
    width: 80,
    height: 20,
  });
  newElem.style.fontSize = '16px';
  if (editModeOn) {
    newElem.classList.add('editable');
    if (newElem instanceof HTMLSpanElement) {
      newElem.setAttribute('contenteditable', 'true');
    }
  }

  appendElemToOverlay(newElem);
  return newElem.id;
}

function appendElemToOverlay(elem) {
  elem.addEventListener('mousedown', onElemMouseDown);
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
      classes: elem.className?.replace('editable', ''),
      fontSize: elem.style.fontSize,
      ...getTransform(elem),
    };

    if (elem instanceof HTMLImageElement) {
      overlayDef.content = elem.src;
    }
    if (
      elem instanceof HTMLInputElement ||
      elem instanceof HTMLTextAreaElement
    ) {
      overlayDef.content = elem.value;
      setInputValueAsAttrib(elem);
    }
    if (elem instanceof HTMLSpanElement) {
      overlayDef.content = elem.innerHTML;
    }

    allOverlays.push(overlayDef);
  });

  localStorage.setItem('overlays', JSON.stringify(allOverlays));
}

function loadAllOverlays() {
  let storageOverlays = localStorage.getItem('overlays');
  if (storageOverlays === null) {
    storageOverlays = SHEET_CONTENT;
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
    if (
      newElem instanceof HTMLInputElement ||
      newElem instanceof HTMLTextAreaElement
    ) {
      newElem.value = overlayObj.content;
    }
    if (newElem instanceof HTMLSpanElement) {
      newElem.innerHTML = overlayObj.content;
    }

    appendElemToOverlay(newElem);
  });
}

function onMouseMove(ev) {
  if (editModeOn && editedElem !== null) {
    if (!editElemMoved) {
      editElemMoved = true;
      addToHistory(editedElem.id, editOp, getTransform(editedElem));
    }

    let deltaX = ev.clientX - editTransformCoords.mouseX;
    let deltaY = ev.clientY - editTransformCoords.mouseY;

    if (editOp === 'move') {
      setTransform(
        editedElem.id,
        { x: deltaX, y: deltaY },
        { x: editTransformCoords.elemX, y: editTransformCoords.elemY }
      );
    }
    if (editOp === 'resize') {
      if (editedElem instanceof HTMLImageElement) {
        deltaX = deltaY = deltaX + deltaY;
      }
      setTransform(
        editedElem.id,
        { width: deltaX, height: deltaY },
        { width: editTransformCoords.elemX, height: editTransformCoords.elemY }
      );
    }
  }
}

function onMouseUp(ev) {
  if (editedElem) {
    editedElem.focus();
  }

  editElemMoved = false;
  editedElem = null;
}

function onElemMouseDown(ev) {
  if (!editModeOn) {
    return;
  }

  let targetElem = ev.target;
  while (!targetElem.id) {
    if (targetElem.className === 'overlay') {
      throw new Error('Could not find selected overlay?!');
    }
    targetElem = targetElem.parentElement;
  }
  editedElem = targetElem;

  if (ev.button === 0) {
    editOp = 'move';
    editTransformCoords.mouseX = ev.clientX;
    editTransformCoords.mouseY = ev.clientY;
    editTransformCoords.elemX = parseInt(editedElem.style.left) || 0;
    editTransformCoords.elemY = parseInt(editedElem.style.top) || 0;
  }
  if (ev.button === 1) {
    editOp = 'resize';
    editTransformCoords.mouseX = ev.clientX;
    editTransformCoords.mouseY = ev.clientY;
    editTransformCoords.elemX = parseInt(editedElem.style.width) || 0;
    editTransformCoords.elemY = parseInt(editedElem.style.height) || 0;
  }
  if (ev.button === 2) {
    addToHistory(editedElem.cloneNode(true), 'delete');
    document.querySelector('.overlay').removeChild(editedElem);
  }

  ev.preventDefault();
  ev.stopPropagation();
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
    if (ev.key === 'd' && ev.ctrlKey) {
      duplicateElem(activeElem);
      ev.preventDefault();
    }
  }
}

function setInputValueAsAttrib(inputElem) {
  inputElem.setAttribute('value', inputElem.value);
}

function enableEditMode() {
  document.querySelectorAll('.overlay > *').forEach((elem) => {
    elem.classList.add('editable');
    if (elem instanceof HTMLSpanElement) {
      elem.setAttribute('contenteditable', 'true');
    }
  });
  document
    .querySelectorAll('.controls button:not(#save)')
    .forEach((btn) => btn.removeAttribute('disabled'));
  editModeOn = true;
}

function disableEditMode() {
  document.querySelectorAll('.overlay > *').forEach((elem) => {
    elem.classList.remove('editable');
    if (elem instanceof HTMLSpanElement) {
      elem.removeAttribute('contenteditable');
    }
  });
  document
    .querySelectorAll('.controls button:not(#save)')
    .forEach((btn) => btn.setAttribute('disabled', ''));
  editModeOn = false;

  document
    .querySelectorAll('.overlay > input')
    .forEach((inputElem) => setInputValueAsAttrib(inputElem));
}

function toggleBackground(checked) {
  document
    .querySelector('.sheet > img')
    .setAttribute(
      'src',
      `https://raw.githubusercontent.com/Sparfunzel/CDR_Sheet/main/CPR_Sheet_BG${
        checked ? '' : '2'
      }.png`
    );
}

function main() {
  document.addEventListener('contextmenu', (ev) => ev.preventDefault());
  document.body.addEventListener('mousemove', onMouseMove);
  document.body.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);

  document.querySelectorAll('.overlay > *').forEach((elem) => {
    elem.addEventListener('mousedown', onElemMouseDown);
  });

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
  document
    .querySelector('button#newtextarea')
    .addEventListener('click', (ev) => {
      const elemId = addNewElem('textarea');
      addToHistory(elemId, 'create');
    });
  document.querySelector('button#save').addEventListener('click', (ev) => {
    saveAllOverlays();
  });
  document.querySelector('input#bgtoggle').addEventListener('change', (ev) => {
    toggleBackground(ev.target.checked);
  });

  loadAllOverlays();
}

window.addEventListener('load', () => {
  main();
});
